import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as Connection from '@deepseek-ai/dsh-client-connection'
import { createServer, request } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Plugin from '../src/index.js'
import { Gateway, MANAGE_PATH, REMOTE_MARK } from '../src/gateway.js'
import { MAX_DEVICES, PairingService } from '../src/pairing.js'
import { TunnelManager } from '../src/tunnel.js'

const cleanup: Array<() => Promise<unknown> | void> = []
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); vi.restoreAllMocks() })
function folder(): string {
  const path = mkdtempSync(join(tmpdir(), 'dsh-rc-hardening-')); cleanup.push(() => rmSync(path, { recursive: true, force: true }))
  return path
}
function pair(service: PairingService): string {
  const claim = service.request(service.issue().token, 'Android'); service.approve(claim.id)
  return service.claim(claim.id, claim.key).credential!
}
/** A raw request, so the Host header can differ from the address dialled. */
function get(port: number, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: '/api/echo', headers }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject); req.end()
  })
}

it('makes room for a new device by dropping the one unused for longest, never one that is online', () => {
  let now = 1_000_000
  const online = new Set<string>(), revoked: string[] = []
  const service = new PairingService({ file: join(folder(), 'devices.json'), now: () => now, onRevoke: id => revoked.push(id), isOnline: id => online.has(id) })
  const ids: string[] = []
  for (let i = 0; i < MAX_DEVICES; i++) { now += 1000; ids.push(pair(service).split('.')[0]!) }
  online.add(ids[0]!)
  now += 1000
  const added = pair(service).split('.')[0]!
  const kept = service.list().map(device => device.id)
  expect(kept).toHaveLength(MAX_DEVICES)
  expect(kept).toContain(ids[0])
  expect(kept).toContain(added)
  expect(kept).not.toContain(ids[1])
  expect(revoked).toEqual([ids[1]])
  for (const id of kept) online.add(id)
  expect(() => pair(service)).toThrow(/在线/)
})

it('lists the address of the physical network before virtual adapters and unreachable ranges', () => {
  const row = (address: string) => ({ address, family: 'IPv4' as const, internal: false, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: null })
  expect(Plugin.lanAddresses({
    'Clash': [row('198.18.0.1')],
    'vEthernet (WSL)': [row('172.29.16.1')],
    'Link': [row('169.254.10.2')],
    'WLAN': [row('192.168.1.23')],
    'Loopback': [{ ...row('127.0.0.1'), internal: true }],
  })).toEqual(['192.168.1.23', '172.29.16.1', '198.18.0.1', '169.254.10.2'])
})

it('admits the addresses the computer has now, and marks what it forwards as remote', async () => {
  const upstream = createServer((req, res) => res.end(JSON.stringify({ mark: req.headers[REMOTE_MARK] })))
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve))
  cleanup.push(() => new Promise<void>(resolve => { upstream.closeAllConnections(); upstream.close(() => resolve()) }))
  const pairing = new PairingService({ file: join(folder(), 'devices.json') })
  let addresses = ['192.168.1.23']
  const gateway = new Gateway({ pairing, upstreamPort: (upstream.address() as { port: number }).port, upstreamCookie: () => 'host=1', manage: async () => ({}), addresses: () => addresses })
  await gateway.listen('127.0.0.1'); cleanup.push(() => gateway.close())
  const cookie = `dsh_rc=${pair(pairing)}`
  expect((await get(gateway.port, { host: `192.168.1.23:${gateway.port}`, cookie })).status).toBe(200)
  expect((await get(gateway.port, { host: `192.168.1.99:${gateway.port}`, cookie })).status).toBe(403)
  // The network changed after the gateway started.
  addresses = ['192.168.1.99']
  expect((await get(gateway.port, { host: `192.168.1.99:${gateway.port}`, cookie })).status).toBe(200)
  expect((await get(gateway.port, { host: `192.168.1.23:${gateway.port}`, cookie })).status).toBe(403)
  // A client cannot clear or forge the marker.
  const forwarded = await get(gateway.port, { host: `127.0.0.1:${gateway.port}`, cookie, [REMOTE_MARK]: '0' })
  expect(JSON.parse(forwarded.body)).toEqual({ mark: '1' })
})

it('keeps a verified public connection when only the computer loses sight of it', async () => {
  const gateway = { port: 1, healthURL: (base: string) => `${base}/rc/health`, verifyHealth: () => true, allowAuthority() {}, disallowAuthority() {} } as unknown as Gateway
  const failed = vi.fn()
  const tunnel = new TunnelManager(gateway, failed) as unknown as { phase: string; url?: string; warning?: string; error?: string; verifyUntil: number; generation: number; probe(generation: number): Promise<void>; stop(): Promise<void> }
  vi.stubGlobal('fetch', vi.fn(async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }) }))
  cleanup.push(() => { vi.unstubAllGlobals(); return tunnel.stop() })
  tunnel.url = 'https://example.trycloudflare.com'; tunnel.phase = 'ready'
  for (let i = 0; i < 3; i++) await tunnel.probe(tunnel.generation)
  expect(tunnel.phase).toBe('ready')
  expect(tunnel.warning).toContain('ECONNRESET')
  expect(failed).not.toHaveBeenCalled()
  // A new address that never answers within the allowed time is a failed start.
  tunnel.phase = 'verifying'; tunnel.verifyUntil = Date.now() - 1
  await tunnel.probe(tunnel.generation)
  expect(tunnel.phase).toBe('error')
  expect(failed).toHaveBeenCalledOnce()
})

it('loads with default preferences when the file is damaged, and refuses forwarded calls on the local route', async () => {
  const home = folder(), previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  mkdirSync(join(home, 'dsh-remote-control', 'default'), { recursive: true })
  writeFileSync(join(home, 'dsh-remote-control', 'default', 'preferences.json'), '{"autoStart": tru')
  const ctx = new Context(); let record: unknown
  const remove = ctx.provide('credentials', { modifyRecord: async (_key: unknown, update: (value: unknown) => Promise<unknown>) => { const next = await update(record); if (next !== undefined) record = next; return record } })
  const call = (headers: Record<string, string> = {}) => ctx.connection.createSharedFetchHandler('/api').fetch(new Request('http://desktop.internal' + MANAGE_PATH, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ action: 'status' }) }))
  try {
    await ctx.plugin(Connection, {}); await ctx.plugin(Plugin, {})
    await vi.waitFor(async () => expect((await call()).status).toBe(200))
    expect(await (await call()).json()).toMatchObject({ enabled: false, autoStart: false, mode: 'public', error: expect.stringContaining('偏好设置') })
    expect((await call({ [REMOTE_MARK]: '1' })).status).toBe(403)
  } finally {
    ctx.registry.delete(Plugin); ctx.registry.delete(Connection); await new Promise(resolve => setTimeout(resolve, 100)); await remove()
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous
  }
})
