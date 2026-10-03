import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import { createRequire } from 'node:module'
import { homedir, networkInterfaces } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import QRCode from 'qrcode'
import { PairingService } from './pairing.js'
import { Gateway, MANAGE_PATH } from './gateway.js'
import { TunnelManager } from './tunnel.js'
import { body, isLoopback, json, sameOrigin } from './http.js'

export const name = '@copylee/dsh-remote-control'
export const inject = ['connection']
export const Config = z.object({
  gatewayPort: z.natural().max(65535).default(0).i18n({ 'zh-CN': { $description: '局域网网关端口；0 表示自动选择空闲端口。' } }),
})
export interface Config { gatewayPort?: number }
type Mode = 'public' | 'lan' | 'fixed'
interface Preferences { autoStart: boolean; mode: Mode; proxy?: string }
const mime: Record<string, string> = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }

/** Exchange the Host's launch token entirely inside the process. */
export function hostCookie(connection: Context['connection'], port: number): string {
  const base = `http://127.0.0.1:${port}/`
  const authenticated = new URL(connection.authenticatedUrl(base))
  let cookie = ''
  connection.authorizeIndex({ method: 'GET', url: authenticated.pathname + authenticated.search, headers: { host: `127.0.0.1:${port}` } }, {
    writeHead(_status, headers) { cookie = headers?.['set-cookie']?.split(';')[0] ?? '' }, end() {},
  })
  if (!cookie) throw new Error('DSH 宿主认证接口无法建立内部会话。')
  return cookie
}

export async function apply(ctx: Context, config: Config = {}): Promise<void> {
  const profile = ctx.get('profileContext') as { name?: string } | undefined
  const storage = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dsh-remote-control', String(profile?.name || process.env.DSH_PROFILE || 'default').replace(/[^a-zA-Z0-9_-]/g, '_'))
  mkdirSync(storage, { recursive: true })
  const prefsFile = join(storage, 'preferences.json')
  let preferences: Preferences = { autoStart: false, mode: 'public' }
  if (existsSync(prefsFile)) {
    const stored = JSON.parse(readFileSync(prefsFile, 'utf8')) as Preferences
    preferences = { autoStart: stored.autoStart === true, mode: ['public', 'lan', 'fixed'].includes(stored.mode) ? stored.mode : 'public', proxy: typeof stored.proxy === 'string' ? stored.proxy : undefined }
  }
  function savePreferences(): void {
    const temporary = `${prefsFile}.${randomUUID()}.tmp`
    writeFileSync(temporary, JSON.stringify(preferences), { mode: 0o600 }); renameSync(temporary, prefsFile)
  }
  let gateway: Gateway | undefined
  let tunnel: TunnelManager | undefined
  let enabled = false, busy = false, disposed = false
  let activeMode: Mode | undefined
  let generation = 0
  let error: string | undefined
  let qr: { token: string; expiresAt: number } | undefined
  const pairing = new PairingService({ file: join(storage, 'devices.json'), onRevoke: id => gateway?.revoke(id) })
  const ownedServer = !ctx.get('webServer')
  if (ownedServer) ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  let shutdown: () => Promise<void> = async () => {}
  ctx.effect(() => () => { disposed = true; return shutdown() }, 'remote-control cleanup')

  ctx.inject(['webServer'], async ready => {
    const upstreamPort = ready.webServer.port
    if (!upstreamPort) throw new Error('DSH WebServer 尚未就绪。')
    let credential = hostCookie(ready.connection, upstreamPort)
    const require = createRequire(import.meta.url)
    const distRoot = join(dirname(require.resolve('@deepseek-ai/dsh-web-frontend/package.json')), 'dist')
    const renderIndex = async () => ready.webServer.renderIndex((await readFile(join(distRoot, 'index.html'), 'utf8')).replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/, '<script type="module" src="/rc-assets/remote.js"></script><link rel="stylesheet" href="/rc-assets/style.css">').replace('<title>DeepSeek Harness</title>', '<title>DSH · 远程</title>'))
    const asset = async (pathname: string, res: ServerResponse): Promise<boolean> => {
      if (pathname.startsWith('/rc-assets/')) {
        const path = resolve(dirname(fileURLToPath(import.meta.url)), '.' + pathname.replace('/rc-assets/', '/'))
        if (!/^\/rc-assets\/[a-zA-Z0-9_.-]+\.(js|css|woff2?|ttf)$/.test(pathname)) { res.writeHead(404).end(); return true }
        try { const data = await readFile(path); res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream', 'cache-control': 'private, max-age=3600' }); res.end(data) } catch { res.writeHead(404).end() }
        return true
      }
      if (!pathname.startsWith('/assets/') && !['/favicon.svg', '/favicon-dark.svg', '/manifest.webmanifest'].includes(pathname)) return false
      const path = resolve(distRoot, `.${decodeURIComponent(pathname)}`)
      if (!path.startsWith(resolve(distRoot) + sep)) { res.writeHead(403).end(); return true }
      try { const data = await readFile(path); res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream', 'cache-control': 'private, max-age=3600' }); res.end(data) }
      catch { res.writeHead(404).end() }
      return true
    }
    const lanAddresses = () => Object.values(networkInterfaces()).flatMap(rows => rows ?? []).filter(row => row.family === 'IPv4' && !row.internal).map(row => row.address)
    const baseURLs = () => !enabled || !gateway ? [] : activeMode === 'public' ? (tunnel?.phase === 'ready' && tunnel.url ? [tunnel.url] : []) : lanAddresses().map(ip => `http://${ip}:${gateway!.port}`)
    const status = async (local: boolean) => {
      const links = baseURLs().map(base => ({ base, url: qr ? `${base}/pair#pair=${qr.token}` : undefined }))
      const active = new Set(gateway?.onlineIds() ?? [])
      return {
        enabled, busy, mode: preferences.mode, activeMode, autoStart: preferences.autoStart, proxyConfigured: !!preferences.proxy,
        phase: enabled ? activeMode === 'public' ? tunnel?.phase ?? 'starting' : 'ready' : error ? 'error' : 'off',
        error: error ?? tunnel?.error, gatewayPort: gateway?.port ?? 0, local,
        expiresAt: qr?.expiresAt, links, qr: links[0]?.url ? await QRCode.toDataURL(links[0].url, { width: 260, margin: 2, errorCorrectionLevel: 'M' }) : undefined,
        requests: local ? pairing.requests() : [], devices: pairing.list().map(device => ({ ...device, online: active.has(device.id) })),
        fixedAvailable: false, fixedReason: '尚未找到已验证、允许第三方使用的免费固定入口服务。',
        lanHint: '手机需与电脑处于同一局域网。若连接被防火墙阻断，请手动允许网关端口；插件不会修改防火墙。',
      }
    }
    const stop = async () => {
      ++generation
      enabled = false; activeMode = undefined; qr = undefined; pairing.invalidate()
      const current = gateway, currentTunnel = tunnel; gateway = undefined; tunnel = undefined
      await Promise.allSettled([currentTunnel?.stop(), current?.close()])
    }
    shutdown = stop
    const start = async () => {
      if (busy) throw new Error('连接操作正在进行，请稍后再试。')
      if (preferences.mode === 'fixed') throw new Error('固定入口暂不可用，请选择临时公网或局域网。')
      busy = true; error = undefined
      let ticket: number | undefined
      try {
        const mode = preferences.mode, proxy = preferences.proxy
        const stopping = stop(); ticket = generation
        await stopping; if (disposed || ticket !== generation) return
        credential = hostCookie(ready.connection, upstreamPort)
        const next = gateway = new Gateway({ pairing, upstreamPort, upstreamCookie: () => credential, manage, index: renderIndex, asset })
        await next.listen(mode === 'lan' ? '0.0.0.0' : '127.0.0.1', config.gatewayPort ?? 0)
        if (disposed || ticket !== generation) { await next.close(); return }
        for (const address of lanAddresses()) next.allowAuthority(`${address}:${next.port}`)
        enabled = true; activeMode = mode; qr = pairing.issue()
        if (mode === 'public') {
          const currentTunnel = tunnel = new TunnelManager(next, message => {
            if (ticket === generation && tunnel === currentTunnel) { error = message; void stop() }
          }); await currentTunnel.start(proxy)
          if (disposed || ticket !== generation) await currentTunnel.stop()
        }
      } catch (failure) { if (ticket === generation) { error = failure instanceof Error ? failure.message : '启动失败。'; await stop() }; throw failure }
      finally { busy = false }
    }
    async function manage(input: Record<string, unknown>, local: boolean): Promise<unknown> {
      switch (input.action) {
        case 'status': return status(local)
        case 'scheduleCapabilities': return { available: !!ready.get('schedule') }
        case 'scheduleCreate': {
          const service = ready.get('schedule') as { create(sessionId: string, request: unknown): Promise<unknown> } | undefined
          if (!service) throw new Error('此宿主尚未启用自动化服务。请在插件管理中启用实验性自动化插件。')
          if (typeof input.sessionId !== 'string' || !input.request || typeof input.request !== 'object') throw new Error('自动化请求格式不正确。')
          // rc.2 exposes list/update/delete over Remote but no create RPC.
          // Delegate directly to the existing Host service, retaining its validation,
          // persistence and scheduling semantics; no second task database.
          return service.create(input.sessionId, input.request)
        }
        case 'start': if (!enabled) await start(); return status(local)
        case 'switch': {
          if (busy) throw new Error('连接操作正在进行，请稍后再试。')
          if (preferences.mode === activeMode && enabled && (activeMode === 'lan' || tunnel?.phase === 'ready')) return status(local)
          if (local) { await start(); return status(local) }
          busy = true
          const ticket = generation
          setTimeout(() => { busy = false; if (!disposed && ticket === generation) void start().catch(() => {}) }, 75)
          return { switching: true, mode: preferences.mode }
        }
        case 'stop': if (local) await stop(); else { ++generation; setTimeout(() => { void stop() }, 75) }; return { stopped: true }
        case 'refresh': if (!enabled) throw new Error('请先开启远程连接。'); qr = pairing.issue(); return status(local)
        case 'approve': if (!local) throw new Error('首次配对必须在本机确认。'); pairing.approve(String(input.id)); return status(local)
        case 'reject': if (!local) throw new Error('配对请求由本机处理。'); pairing.reject(String(input.id)); return status(local)
        case 'revoke': {
          const id = String(input.id)
          // Allow the management acknowledgement to reach the revoked caller.
          setTimeout(() => { try { pairing.revoke(id) } catch { error = '撤销失败，授权文件未能保存；请在本机重试。' } }, 75)
          return { revoked: true }
        }
        case 'revokeAll': setTimeout(() => { try { pairing.revokeAll(); qr = undefined } catch { error = '撤销失败，请在本机重试。' } }, 75); return { revoked: true }
        case 'preferences': {
          if (busy) throw new Error('请等待当前连接操作完成。')
          const next = { ...preferences }
          if (typeof input.autoStart === 'boolean') next.autoStart = input.autoStart
          if (input.mode !== undefined) { if (!['public', 'lan', 'fixed'].includes(String(input.mode))) throw new Error('连接模式不正确。'); next.mode = input.mode as Mode }
          if (input.proxy !== undefined) {
            const value = String(input.proxy).trim()
            if (value) { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('代理需为不带用户名和密码的 HTTP(S) 地址。'); }
            next.proxy = value || undefined
          }
          const previous = preferences; preferences = next
          try { savePreferences() } catch (failure) { preferences = previous; throw failure }
          return status(local)
        }
        default: throw new Error('未知的远程控制操作。')
      }
    }
    const localHandler = async (req: IncomingMessage, res: ServerResponse) => {
      const rejection = ready.connection.requestRejection(req)
      if (rejection || !isLoopback(req.socket.remoteAddress) || !sameOrigin(req)) { json(res, rejection ?? 403, { error: '本机面板需要宿主认证和本机连接。' }); return }
      if (req.method !== 'POST') { json(res, 405, { error: 'POST only' }); return }
      try { json(res, 200, await manage(await body(req), true)) }
      catch (failure) { json(res, 400, { error: failure instanceof Error ? failure.message : '操作失败。' }) }
    }
    ready.effect(() => ready.webServer.register({ kind: 'exact', path: MANAGE_PATH, handler: localHandler }), 'remote-control local management')
    // Desktop's trusted IPC/Fetch carrier bypasses node:http. The outer gateway
    // handles this exact route itself and never forwards remote approval requests.
    ready.effect(() => ready.connection.fetch.register({ path: MANAGE_PATH, methods: ['POST'], requestBody: 'buffered', fetch: async request => {
      try { const input = await request.json(); return Response.json(await manage(input as Record<string, unknown>, true), { headers: { 'cache-control': 'no-store' } }) }
      catch (failure) { return Response.json({ error: failure instanceof Error ? failure.message : '操作失败。' }, { status: 400 }) }
    } }), 'remote-control Desktop management')
    if (preferences.autoStart && !disposed) await start().catch(() => {})
  })
}
