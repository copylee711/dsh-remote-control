import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IDLE_MS, PairingService } from '../src/pairing.js'
const folders: string[] = []
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }) })
function fixture(onRevoke?: (id: string) => void) {
  const folder = mkdtempSync(join(tmpdir(), 'dsh-rc-pair-')); folders.push(folder)
  let now = 1000000
  const file = join(folder, 'devices.json'), service = new PairingService({ file, now: () => now, onRevoke })
  return { service, file, advance: (ms: number) => { now += ms }, now: () => now }
}
function approved(service: PairingService) {
  const qr = service.issue(), claim = service.request(qr.token, 'Android')
  service.approve(claim.id)
  return service.claim(claim.id, claim.key).credential!
}
describe('pairing admission and durable revocation', () => {
  it('requires local approval and an independent claim key', () => {
    const { service } = fixture(), qr = service.issue(), one = service.request(qr.token, 'Android'), two = service.request(qr.token, 'iPhone')
    expect(service.claim(one.id, one.key)).toEqual({ state: 'pending', credential: undefined })
    expect(() => service.claim(one.id, two.key)).toThrow()
    service.approve(one.id)
    const credential = service.claim(one.id, one.key).credential!
    expect(service.authenticate(credential)?.name).toBe('Android 手机')
    expect(service.claim(two.id, two.key).state).toBe('pending')
    expect(() => service.claim(one.id, one.key)).toThrow()
  })
  it('invalidates old QR and pending requests on refresh, and expires tokens', () => {
    const { service, advance } = fixture(), qr = service.issue(), request = service.request(qr.token, '')
    service.issue()
    expect(() => service.request(qr.token, '')).toThrow()
    expect(() => service.approve(request.id)).toThrow()
    const fresh = service.issue(); advance(300001)
    expect(() => service.request(fresh.token, '')).toThrow()
  })
  it('rejects requests without granting a credential', () => {
    const { service } = fixture(), claim = service.request(service.issue().token, '')
    service.reject(claim.id)
    expect(service.claim(claim.id, claim.key)).toEqual({ state: 'rejected', credential: undefined })
    expect(service.list()).toEqual([])
  })
  it('persists only hashes and remembers devices across a restart', () => {
    const { service, file, now } = fixture(), credential = approved(service)
    expect(readFileSync(file, 'utf8')).not.toContain(credential.split('.')[1])
    const restarted = new PairingService({ file, now })
    expect(restarted.authenticate(credential)).toBeDefined()
    restarted.revoke(restarted.list()[0]!.id)
    expect(new PairingService({ file, now }).authenticate(credential)).toBeUndefined()
  })
  it('keeps authorization on stop but not on revoke-all', () => {
    const { service } = fixture(), credential = approved(service)
    service.invalidate(); expect(service.authenticate(credential)).toBeDefined()
    service.revokeAll(); expect(service.authenticate(credential)).toBeUndefined()
  })
  it('expires idle devices and notifies active carriers', () => {
    const revoked: string[] = [], { service, advance } = fixture(id => revoked.push(id)), credential = approved(service)
    advance(IDLE_MS - 1000); expect(service.authenticate(credential)).toBeDefined()
    advance(IDLE_MS + 1); expect(service.authenticate(credential)).toBeUndefined()
    expect(revoked).toHaveLength(1)
  })
  it('cannot recover an approved credential after its device is revoked', () => {
    const { service } = fixture(), claim = service.request(service.issue().token, '')
    service.approve(claim.id); service.revoke(service.list()[0]!.id)
    expect(() => service.claim(claim.id, claim.key)).toThrow()
  })
})
