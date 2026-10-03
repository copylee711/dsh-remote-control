import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, request } from 'node:http'
import { once } from 'node:events'
import { WebSocket, WebSocketServer } from 'ws'
import { Gateway, MANAGE_PATH, safePath } from '../src/gateway.js'
import { PairingService } from '../src/pairing.js'
const cleanup: Array<() => Promise<unknown> | void> = []
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn() })
async function fixture() {
  const folder = mkdtempSync(join(tmpdir(), 'dsh-rc-gateway-')); cleanup.push(() => rmSync(folder, { recursive: true, force: true }))
  let gateway: Gateway; let calls = 0
  const pairing = new PairingService({ file: join(folder, 'devices.json'), onRevoke: id => gateway.revoke(id) })
  const upstream = createServer((req, res) => {
    calls++
    if (req.url?.startsWith('/api/sse')) { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('id: 1\ndata: 第一条\n\n'); const timer = setInterval(() => res.write('event: tick\ndata: second\n\n'), 50); res.once('close', () => clearInterval(timer)); return }
    if (req.url === '/api/hold') { res.writeHead(200); res.write('start'); return }
    if (req.url === '/api/upload') { let size = 0; req.on('data', chunk => size += chunk.length); req.on('end', () => res.end(JSON.stringify({ size }))); return }
    res.setHeader('set-cookie', 'host-secret=should-never-reach-client'); res.end(JSON.stringify({ cookie: req.headers.cookie, origin: req.headers.origin }))
  })
  const wss = new WebSocketServer({ server: upstream }); wss.on('connection', ws => ws.on('message', (data, binary) => ws.send(data, { binary })))
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve))
  cleanup.push(async () => { for (const client of wss.clients) client.terminate(); wss.close(); upstream.closeAllConnections(); await new Promise<void>(resolve => upstream.close(() => resolve())) })
  const port = (upstream.address() as { port: number }).port
  gateway = new Gateway({ pairing, upstreamPort: port, upstreamCookie: () => 'host-private=secret', manage: async (input, local) => { if (input.action === 'approve' && !local) throw new Error('本机确认'); return { local } }, index: async () => '<html><head></head><body>official shell</body></html>' })
  await gateway.listen('127.0.0.1'); cleanup.push(() => gateway.close())
  const base = `http://127.0.0.1:${gateway.port}`
  const claim = pairing.request(pairing.issue().token, 'Android'); pairing.approve(claim.id)
  const credential = pairing.claim(claim.id, claim.key).credential!
  return { base, pairing, gateway, credential, calls: () => calls, cookie: `dsh_rc=${credential}` }
}
describe('gateway admission and transport', () => {
  it('refuses unauthenticated requests without reaching the Host', async () => {
    const f = await fixture(); const response = await fetch(`${f.base}/api/secrets`)
    expect(response.status).toBe(403); expect(f.calls()).toBe(0)
  })
  it('rejects Host spoofing and cross-origin requests', async () => {
    const f = await fixture()
    const spoofed = await new Promise<number | undefined>(resolve => {
      const req = request(`${f.base}/api/x`, { headers: { cookie: f.cookie, host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode) }); req.end()
    })
    expect(spoofed).toBe(403)
    expect((await fetch(`${f.base}/api/x`, { headers: { cookie: f.cookie, origin: 'https://evil.example' } })).status).toBe(403)
    expect(f.calls()).toBe(0)
  })
  it('never forwards device cookies or returns Host cookies', async () => {
    const f = await fixture(); const response = await fetch(`${f.base}/api/data`, { headers: { cookie: f.cookie, 'x-forwarded-host': 'evil.example' } })
    const data = await response.json()
    expect(data.cookie).toBe('host-private=secret'); expect(data.cookie).not.toContain(f.credential)
    expect(response.headers.get('set-cookie')).not.toContain('host-secret')
  })
  it('serves a gated official shell with boot hooks before scripts', async () => {
    const f = await fixture(), response = await fetch(f.base, { headers: { cookie: f.cookie } }), html = await response.text()
    expect(html).toContain('__DSH_TRANSPORT__'); expect(html).toContain('official shell'); expect(html).not.toContain(f.credential)
  })
  it('refuses remote approvals including encoded management paths', async () => {
    const f = await fixture()
    for (const path of [MANAGE_PATH, '/api/%64sh-remote-control/manage']) {
      expect((await fetch(f.base + path, { method: 'POST', headers: { cookie: f.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) })).status).toBe(400)
    }
    expect(f.calls()).toBe(0)
  })
  it('streams binary uploads without JSON conversion', async () => {
    const f = await fixture(), data = new Uint8Array(262144).fill(251)
    const response = await fetch(`${f.base}/api/upload`, { method: 'POST', headers: { cookie: f.cookie }, body: data })
    expect(await response.json()).toEqual({ size: data.length })
  })
  it('forwards WS text and binary, then closes both legs on revocation', async () => {
    const f = await fixture(), ws = new WebSocket(f.base.replace('http:', 'ws:') + '/api/remote.mux', { headers: { cookie: f.cookie, origin: f.base } })
    await once(ws, 'open'); ws.send('hello'); expect(String((await once(ws, 'message'))[0])).toBe('hello')
    const bytes = Buffer.from([0, 128, 255]); ws.send(bytes); expect((await once(ws, 'message'))[0]).toEqual(bytes)
    const closed = once(ws, 'close'); f.pairing.revoke(f.pairing.list()[0]!.id); await closed
    expect((await fetch(`${f.base}/api/data`, { headers: { cookie: f.cookie } })).status).toBe(403)
  })
  it('rejects unpaired WS before opening upstream', async () => {
    const f = await fixture(), ws = new WebSocket(f.base.replace('http:', 'ws:') + '/api/remote.mux')
    ws.on('error', () => {}); const [, response] = await once(ws, 'unexpected-response'); expect(response.statusCode).toBe(403); ws.terminate()
  })
  it('bridges non-ending SSE incrementally over WS and cancels on revoke', async () => {
    const f = await fixture(), ws = new WebSocket(f.base.replace('http:', 'ws:') + '/rc/sse?path=%2Fapi%2Fsse', { headers: { cookie: f.cookie, origin: f.base } })
    const frames: Array<{ type: string; data?: string }> = []; ws.on('message', data => frames.push(JSON.parse(String(data))))
    await once(ws, 'open'); await new Promise(resolve => setTimeout(resolve, 150))
    expect(frames.some(frame => frame.type === 'ready')).toBe(true)
    expect(frames.some(frame => frame.data?.includes('第一条'))).toBe(true)
    const closed = once(ws, 'close'); f.pairing.revokeAll(); await closed
  })
  it('admits the official plugin SSE path through the authenticated bridge', async () => {
    const f = await fixture(), ws = new WebSocket(f.base.replace('http:', 'ws:') + '/rc/sse?path=%2Fplugins%2Fevents', { headers: { cookie: f.cookie, origin: f.base } })
    const frames: Array<{ type: string }> = []; ws.on('message', data => frames.push(JSON.parse(String(data))))
    await once(ws, 'open'); await new Promise(resolve => setTimeout(resolve, 100))
    // This mock endpoint returns non-SSE, so the bridge must reach it then reject it.
    expect(f.calls()).toBe(1); expect(frames.some(frame => frame.type === 'error')).toBe(true)
  })
  it('destroys in-flight HTTP and WS when stopping, while keeping authorization', async () => {
    const f = await fixture(), controller = new AbortController()
    const response = await fetch(`${f.base}/api/hold`, { headers: { cookie: f.cookie }, signal: controller.signal })
    const completion = response.text(); const failed = completion.catch(() => 'closed')
    await f.gateway.close(); expect(await failed).toBe('closed'); expect(f.pairing.authenticate(f.credential)).toBeDefined()
  })
  it('requires proof for health checks', async () => {
    const f = await fixture()
    expect((await fetch(f.base + '/rc/health')).status).toBe(404)
    expect(f.gateway.verifyHealth(await (await fetch(f.gateway.healthURL(f.base))).json())).toBe(true)
  })
})
it('rejects traversal and malformed paths', () => {
  for (const path of ['//evil', '/a/../b', '/a/%2e%2e/b', '/a/%252e%252e/b', '/a%5cb', '/%00', '/%xx']) expect(safePath(path)).toBe(false)
  expect(safePath('/api/session/uploadFileBinary?name=a%20b')).toBe(true)
})
