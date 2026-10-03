import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as Connection from '@deepseek-ai/dsh-client-connection'
import * as Plugin from '../src/index.js'
import { MANAGE_PATH } from '../src/gateway.js'
import { mkdtempSync, rmSync } from 'node:fs'
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
