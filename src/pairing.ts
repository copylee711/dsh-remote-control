import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const random = () => randomBytes(32).toString('base64url')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const matches = (value: string, expected: string) => {
  const a = Buffer.from(hash(value), 'hex'), b = Buffer.from(expected, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
export const IDLE_MS = 30 * 24 * 3600_000
export interface Device { id: string; name: string; createdAt: number; lastSeenAt: number; hash: string }
interface Pending { id: string; name: string; expiresAt: number; keyHash: string; state: 'pending' | 'approved' | 'rejected'; credential?: string }
export interface PairingOptions { file: string; now?: () => number; onRevoke?: (id: string) => void; idleMs?: number; isOnline?: (id: string) => boolean }
/** Devices kept on record. A temporary public address changes on every start, and each one needs a new pairing. */
export const MAX_DEVICES = 32

/** Only hashes of device secrets reach disk. Pending claims live in memory. */
export class PairingService {
  private readonly devices = new Map<string, Device>()
  private readonly pending = new Map<string, Pending>()
  private token?: { hash: string; expiresAt: number }
  private readonly now: () => number
  readonly idleMs: number
  constructor(private readonly options: PairingOptions) {
    this.now = options.now ?? Date.now
    this.idleMs = options.idleMs ?? IDLE_MS
    if (existsSync(options.file)) {
      const input: unknown = JSON.parse(readFileSync(options.file, 'utf8'))
      if (!input || typeof input !== 'object' || !('devices' in input) || !Array.isArray(input.devices)) throw new Error('设备授权文件格式不正确，请备份后修复；不会忽略损坏的授权记录。')
      for (const row of input.devices) {
        if (!row || typeof row.id !== 'string' || typeof row.name !== 'string' || !/^[a-f0-9]{64}$/.test(row.hash) || !Number.isFinite(row.lastSeenAt) || !Number.isFinite(row.createdAt)) throw new Error('设备授权记录损坏。')
        this.devices.set(row.id, row)
      }
      this.expire()
    }
  }
  private save(): void {
    mkdirSync(dirname(this.options.file), { recursive: true })
    const temporary = `${this.options.file}.${randomUUID()}.tmp`
    writeFileSync(temporary, JSON.stringify({ version: 1, devices: [...this.devices.values()] }), { mode: 0o600 })
    renameSync(temporary, this.options.file)
  }
  private expire(): void {
    const expired = [...this.devices.values()].filter(d => this.now() - d.lastSeenAt >= this.idleMs)
    if (expired.length) {
      for (const device of expired) this.devices.delete(device.id)
      this.save()
      for (const device of expired) this.options.onRevoke?.(device.id)
    }
    for (const [id, claim] of this.pending) if (this.now() >= claim.expiresAt) this.pending.delete(id)
  }
  issue(): { token: string; expiresAt: number } {
    const token = random(), expiresAt = this.now() + 5 * 60_000
    this.token = { hash: hash(token), expiresAt }
    // A refresh also invalidates outstanding claims from the previous QR.
    this.pending.clear()
    return { token, expiresAt }
  }
  invalidate(): void { this.token = undefined; this.pending.clear() }
  request(token: string, userAgent: string): { id: string; key: string; expiresAt: number } {
    this.expire()
    if (!this.token || this.now() >= this.token.expiresAt || !matches(token, this.token.hash)) throw new Error('二维码已过期或已刷新，请重新扫码。')
    if (this.pending.size >= 16) throw new Error('等待配对的设备过多，请稍后再试。')
    const id = randomUUID(), key = random(), expiresAt = Math.min(this.now() + 5 * 60_000, this.token.expiresAt)
    const name = /iPhone|iPad/.test(userAgent) ? 'iPhone / iPad' : /Android/.test(userAgent) ? 'Android 手机' : /Windows/.test(userAgent) ? 'Windows 浏览器' : '远程浏览器'
    this.pending.set(id, { id, name, expiresAt, keyHash: hash(key), state: 'pending' })
    return { id, key, expiresAt }
  }
  requests(): Array<{ id: string; name: string; expiresAt: number }> {
    this.expire()
    return [...this.pending.values()].filter(p => p.state === 'pending').map(({ id, name, expiresAt }) => ({ id, name, expiresAt }))
  }
  approve(id: string): void {
    this.expire()
    const claim = this.pending.get(id)
    if (!claim || claim.state !== 'pending') throw new Error('配对请求已失效。')
    if (this.devices.size >= MAX_DEVICES) {
      // Make room by dropping the device unused for longest, never one that is connected now.
      const idle = [...this.devices.values()].filter(d => !this.options.isOnline?.(d.id)).sort((a, b) => a.lastSeenAt - b.lastSeenAt)[0]
      if (!idle) throw new Error(`已有 ${MAX_DEVICES} 台设备在线，请先撤销不再使用的设备。`)
      this.revoke(idle.id)
    }
    const deviceId = randomUUID(), secret = random()
    const device: Device = { id: deviceId, name: claim.name, hash: hash(secret), createdAt: this.now(), lastSeenAt: this.now() }
    this.devices.set(deviceId, device)
    try { this.save() } catch (error) { this.devices.delete(deviceId); throw error }
    claim.state = 'approved'
    claim.credential = `${deviceId}.${secret}`
  }
  reject(id: string): void {
    const claim = this.pending.get(id)
    if (claim?.state === 'pending') claim.state = 'rejected'
  }
  claim(id: string, key: string): { state: 'pending' | 'approved' | 'rejected'; credential?: string } {
    this.expire()
    const claim = this.pending.get(id)
    if (!claim || !matches(key, claim.keyHash)) throw new Error('配对请求已失效。')
    const result = { state: claim.state, credential: claim.credential }
    if (claim.state !== 'pending') this.pending.delete(id)
    return result
  }
  authenticate(credential: string | undefined): Device | undefined {
    this.expire()
    if (!credential || credential.length > 128) return undefined
    const [id, secret, extra] = credential.split('.')
    if (!id || !secret || extra) return undefined
    const device = this.devices.get(id)
    if (!device || !matches(secret, device.hash)) return undefined
    // Bound disk writes while preserving sliding idle expiry across restarts.
    if (this.now() - device.lastSeenAt >= 60_000) {
      const previous = device.lastSeenAt
      device.lastSeenAt = this.now()
      try { this.save() } catch (error) { device.lastSeenAt = previous; throw error }
    }
    return device
  }
  list(): Array<Omit<Device, 'hash'>> { this.expire(); return [...this.devices.values()].map(({ hash: _hash, ...device }) => device) }
  revoke(id: string): void {
    const previous = this.devices.get(id)
    if (!previous) return
    this.devices.delete(id)
    try { this.save() } catch (error) { this.devices.set(id, previous); throw error }
    this.options.onRevoke?.(id)
    // Do not let an approved-but-unclaimed request restore a revoked device.
    for (const [key, claim] of this.pending) if (claim.credential?.startsWith(`${id}.`)) this.pending.delete(key)
  }
  revokeAll(): void { for (const id of [...this.devices.keys()]) this.revoke(id); this.invalidate() }
}
