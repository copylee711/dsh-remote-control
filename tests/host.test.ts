import { expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as Connection from '@deepseek-ai/dsh-client-connection'
import * as Plugin from '../src/index.js'
import { MANAGE_PATH } from '../src/gateway.js'
import { Gateway } from '../src/gateway.js'
import { TunnelManager } from '../src/tunnel.js'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

it('creates a private HTTP adapter for a carrier-only Host and handles trusted Desktop Fetch', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'dsh-rc-host-')), previous = process.env.DSH_HOME
  process.env.DSH_HOME = folder
  const ctx = new Context()
  let record: unknown
  const removeCredentials = ctx.provide('credentials', { modifyRecord: async (_key: unknown, update: (value: unknown) => Promise<unknown>) => { const next = await update(record); if (next !== undefined) record = next; return record } })
  try {
    await ctx.plugin(Connection, {})
    expect(ctx.get('webServer')).toBeUndefined()
    await ctx.plugin(Plugin, {})
    let result: Response | undefined
    for (let attempt = 0; attempt < 100; attempt++) {
      if (ctx.get('webServer')?.port) {
        result = await ctx.connection.createSharedFetchHandler('/api').fetch(new Request('http://desktop.internal' + MANAGE_PATH, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'status' }) }))
        if (result.status === 200) break
      }
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    expect(result?.status).toBe(200)
    expect(await result!.json()).toMatchObject({ local: true, enabled: false, autoStart: false })
    expect(ctx.get('webServer')?.host).toBe('127.0.0.1')
    const port = ctx.get('webServer')!.port
    expect((await fetch(`http://127.0.0.1:${port}${MANAGE_PATH}`, { method: 'POST' })).status).toBe(401)
  } finally {
    ctx.registry.delete(Plugin); ctx.registry.delete(Connection); await new Promise(resolve => setTimeout(resolve, 30)); await removeCredentials()
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous
    rmSync(folder, { recursive: true, force: true })
  }
})

async function withHost(run: (command: (action: string, fields?: Record<string, unknown>) => Promise<any>, ctx: Context) => Promise<void>) {
  const folder = mkdtempSync(join(tmpdir(), 'dsh-rc-switch-')), previous = process.env.DSH_HOME
  process.env.DSH_HOME = folder
  const ctx = new Context(); let record: unknown
  const remove = ctx.provide('credentials', { modifyRecord: async (_key: unknown, update: (value: unknown) => Promise<unknown>) => { const next = await update(record); if (next !== undefined) record = next; return record } })
  try {
    await ctx.plugin(Connection, {}); await ctx.plugin(Plugin, {})
    const command = async (action: string, fields: Record<string, unknown> = {}) => {
      const response = await ctx.connection.createSharedFetchHandler('/api').fetch(new Request('http://desktop.internal' + MANAGE_PATH, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...fields }) }))
      const data = await response.json(); return { ...data, status: response.status }
    }
    await vi.waitFor(async () => expect((await command('status')).status).toBe(200))
    await run(command, ctx)
  } finally {
    ctx.registry.delete(Plugin); ctx.registry.delete(Connection); await new Promise(resolve => setTimeout(resolve, 100)); await remove(); vi.restoreAllMocks()
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous
    rmSync(folder, { recursive: true, force: true })
  }
}

it('keeps the running LAN entry and QR while saving a different mode or proxy', async () => withHost(async command => {
  await command('preferences', { mode: 'lan' })
  const started = await command('start')
  const selected = await command('preferences', { mode: 'public', proxy: 'http://127.0.0.1:7890', autoStart: true })
  expect(selected).toMatchObject({ enabled: true, mode: 'public', activeMode: 'lan', gatewayPort: started.gatewayPort })
  expect(selected.links).toEqual(started.links); expect(selected.qr).toBe(started.qr)
  const failed = await command('preferences', { mode: 'nonsense' })
  expect(failed.status).toBe(400)
  expect((await command('status')).links).toEqual(started.links)
}))

it('explicitly switches entries, invalidates the old entry, and can retry a failed switch', async () => withHost(async command => {
  vi.spyOn(TunnelManager.prototype, 'start').mockImplementation(async function () { this.phase = 'ready'; this.url = 'https://test.trycloudflare.com' })
  await command('preferences', { mode: 'lan' }); const lan = await command('start')
  await command('preferences', { mode: 'public' }); const publicEntry = await command('switch')
  expect(publicEntry).toMatchObject({ activeMode: 'public', phase: 'ready', mode: 'public' })
  await expect(fetch(`http://127.0.0.1:${lan.gatewayPort}/`)).rejects.toThrow()
  await command('preferences', { mode: 'lan' }); const switched = await command('switch')
  expect(switched).toMatchObject({ activeMode: 'lan', enabled: true, phase: 'ready' })
  expect(switched.links[0].url).not.toBe(lan.links[0].url)
  vi.spyOn(Gateway.prototype, 'listen').mockRejectedValueOnce(new Error('test address unavailable'))
  await command('preferences', { mode: 'public' }); expect((await command('switch')).status).toBe(400)
  expect(await command('status')).toMatchObject({ enabled: false, phase: 'error', error: 'test address unavailable' })
  expect((await command('start')).activeMode).toBe('public')
}))

it('does not resurrect an entry after closing during an asynchronous listen', async () => withHost(async command => {
  const listen = Gateway.prototype.listen
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  vi.spyOn(Gateway.prototype, 'listen').mockImplementationOnce(async function (host, port) { await gate; return listen.call(this, host, port) })
  await command('preferences', { mode: 'lan' }); const starting = command('start')
  await vi.waitFor(async () => expect((await command('status')).busy).toBe(true))
  expect((await command('start')).status).toBe(400)
  await command('stop'); await new Promise(resolve => setTimeout(resolve, 100)); release(); await starting
  expect(await command('status')).toMatchObject({ enabled: false, busy: false, phase: 'off', gatewayPort: 0, links: [] })
}))

async function remoteClient(command: (action: string, fields?: Record<string, unknown>) => Promise<any>) {
  await command('preferences', { mode: 'lan' }); const state = await command('start')
  const base = `http://127.0.0.1:${state.gatewayPort}`
  const post = (path: string, data: unknown, cookie = '') => fetch(base + path, { method: 'POST', headers: { origin: base, cookie, 'content-type': 'application/json' }, body: JSON.stringify(data) })
  const request = await (await post('/rc/pair/request', { token: new URL(state.links[0].url).hash.slice(6) })).json()
  await command('approve', { id: request.id })
  const claim = await post('/rc/pair/claim', { id: request.id, key: request.key })
  const cookie = claim.headers.get('set-cookie')!.split(';')[0]!
  return { state, base, manage: async (action: string, fields: Record<string, unknown> = {}) => { const response = await post(MANAGE_PATH, { action, ...fields }, cookie); return { status: response.status, ...await response.json() } } }
}

it('acknowledges an authorized remote switch before terminating its old entry', async () => withHost(async command => {
  vi.spyOn(TunnelManager.prototype, 'start').mockImplementation(async function () { this.phase = 'ready'; this.url = 'https://test.trycloudflare.com' })
  const remote = await remoteClient(command)
  expect((await remote.manage('approve', { id: 'anything' })).status).toBe(400)
  await remote.manage('preferences', { mode: 'public' })
  expect(await remote.manage('switch')).toMatchObject({ switching: true, mode: 'public', status: 200 })
  await vi.waitFor(async () => expect(await command('status')).toMatchObject({ activeMode: 'public', phase: 'ready' }))
  await expect(fetch(remote.base + '/')).rejects.toThrow()
  expect((await command('status')).devices).toHaveLength(1)
}))

it('cancels a remotely queued switch when the local owner closes the gateway', async () => withHost(async command => {
  const tunnelStart = vi.spyOn(TunnelManager.prototype, 'start')
  const remote = await remoteClient(command); await remote.manage('preferences', { mode: 'public' })
  expect((await remote.manage('switch')).switching).toBe(true)
  await command('stop'); await new Promise(resolve => setTimeout(resolve, 150))
  expect(await command('status')).toMatchObject({ enabled: false, busy: false, phase: 'off', links: [] })
  expect(tunnelStart).not.toHaveBeenCalled()
}))

it('rolls back unsaved preferences and preserves the live entry when atomic persistence fails', async () => withHost(async command => {
  await command('preferences', { mode: 'lan' }); const before = await command('start')
  const file = join(process.env.DSH_HOME!, 'dsh-remote-control', 'default', 'preferences.json')
  rmSync(file); mkdirSync(file)
  expect((await command('preferences', { mode: 'public' })).status).toBe(400)
  const after = await command('status')
  expect(after).toMatchObject({ mode: 'lan', activeMode: 'lan', enabled: true, gatewayPort: before.gatewayPort })
  expect(after.qr).toBe(before.qr)
}))

it('cancels unfinished startup when the plugin unloads', async () => withHost(async (command, ctx) => {
  const listen = Gateway.prototype.listen
  let release!: () => void, opened = 0
  const gate = new Promise<void>(resolve => { release = resolve })
  vi.spyOn(Gateway.prototype, 'listen').mockImplementationOnce(async function (host, port) { await gate; opened = await listen.call(this, host, port); return opened })
  await command('preferences', { mode: 'lan' }); const starting = command('start')
  await vi.waitFor(async () => expect((await command('status')).busy).toBe(true))
  ctx.registry.delete(Plugin); release(); await starting
  await expect(fetch(`http://127.0.0.1:${opened}/`)).rejects.toThrow()
}))
