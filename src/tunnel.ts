import { fork, spawn, execFile } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { Gateway } from './gateway.js'
import { fetch as tunnelFetch, ProxyAgent } from 'undici'

/** How long a new public address may take to answer before the start counts as failed. */
const VERIFY_MS = 60_000

/**
 * The services that can give this computer a temporary public address.
 * - cloudflare: Cloudflare Quick Tunnel through untun; downloads cloudflared on first use.
 * - ssh: localhost.run through the system's own `ssh`; nothing to download, no account.
 */
export type Route = 'cloudflare' | 'ssh'
export const ROUTES: Record<Route, { name: string; suffix: string }> = {
  cloudflare: { name: 'Cloudflare', suffix: '.trycloudflare.com' },
  ssh: { name: 'localhost.run', suffix: '.lhr.life' },
}
export const ROUTE_IDS = Object.keys(ROUTES) as Route[]
/** A host under one of these names exists only while its tunnel is open. */
export function isTemporaryHost(host: string | undefined): boolean {
  const name = host?.toLowerCase().split(':')[0]
  return !!name && ROUTE_IDS.some(route => name.endsWith(ROUTES[route].suffix))
}

export type TunnelPhase = 'off' | 'downloading' | 'starting' | 'verifying' | 'ready' | 'error'
export class TunnelManager {
  phase: TunnelPhase = 'off'
  url?: string
  error?: string
  /** The service in use, or being tried. */
  route?: Route
  /** The address stopped answering this computer's own check; phones may still reach it. */
  warning?: string
  /** Why the service in use is not the first choice. */
  note?: string
  private verifyUntil = 0
  private child?: ChildProcess
  private generation = 0
  private timer?: ReturnType<typeof setTimeout>
  private monitor?: ReturnType<typeof setInterval>
  private failures = 0
  private checking = false
  private lastFailure = ''
  private proxy?: ProxyAgent
  private proxyAddress?: string
  /** Services still to try if the current one does not come up. */
  private remaining: Route[] = []
  private everReady = false
  private knownHosts = ''
  constructor(private readonly gateway: Gateway, private readonly onFailure?: (message: string) => void) {}

  /** Open a public address, trying `routes` in order until one answers. */
  async start(proxy?: string, routes: Route[] = ['cloudflare'], knownHosts = ''): Promise<void> {
    await this.stop()
    this.proxyAddress = proxy
    this.proxy = proxy ? new ProxyAgent(proxy) : undefined
    this.knownHosts = knownHosts
    this.remaining = [...routes]
    this.error = undefined; this.warning = undefined; this.note = undefined; this.everReady = false
    this.launch(++this.generation)
  }

  private launch(generation: number): void {
    const route = this.route = this.remaining.shift() ?? 'cloudflare'
    this.phase = 'starting'; this.failures = 0
    this.timer = setTimeout(() => { if (generation === this.generation) this.fail('开启超过 120 秒仍未完成；请检查电脑的网络，或给电脑设置网络代理后重试。') }, 120000); this.timer.unref()
    const child = this.child = route === 'ssh' ? this.launchSsh(generation) : this.launchCloudflare(generation)
    child.on('error', (failure: NodeJS.ErrnoException) => {
      if (generation !== this.generation) return
      this.fail(route === 'ssh' && failure.code === 'ENOENT' ? '这台电脑没有 ssh 命令，无法使用 localhost.run 线路。Windows 可在“可选功能”里添加 OpenSSH 客户端。' : '无法启动连接组件。')
    })
    child.on('exit', () => { if (generation === this.generation && this.phase !== 'off' && this.phase !== 'error') this.fail('连接组件已退出，请重新开启。') })
  }

  private launchCloudflare(generation: number): ChildProcess {
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_USE_ENV_PROXY: '1', DSH_RC_TUNNEL_PORT: String(this.gateway.port) }
    if (this.proxyAddress) Object.assign(env, { HTTPS_PROXY: this.proxyAddress, HTTP_PROXY: this.proxyAddress })
    const child = fork(fileURLToPath(new URL('./tunnel-worker.js', import.meta.url)), [], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: [] })
    // Drain package logging without exposing URLs/credentials in Host logs.
    child.stdout?.resume(); child.stderr?.resume()
    child.on('message', value => {
      if (generation !== this.generation || !value || typeof value !== 'object' || !('phase' in value)) return
      const message = value as { phase: string; url?: string; error?: string }
      if (message.phase === 'downloading' || message.phase === 'starting') this.phase = message.phase
      if (message.phase === 'error') this.fail(message.error ?? '连接通道启动失败。')
      if (message.phase === 'url' && message.url) this.accept(message.url, generation)
    })
    return child
  }

  private launchSsh(generation: number): ChildProcess {
    // Remote forwarding only: the service can reach this one local port and nothing else.
    // The service's host key is remembered on first use, in a file of this plugin's own.
    const options = ['StrictHostKeyChecking=accept-new', 'ServerAliveInterval=30', 'ServerAliveCountMax=3', 'ExitOnForwardFailure=yes', 'BatchMode=yes']
    if (this.knownHosts) options.push(`UserKnownHostsFile="${this.knownHosts}"`)
    const child = spawn('ssh', ['-T', ...options.flatMap(option => ['-o', option]), '-R', `80:127.0.0.1:${this.gateway.port}`, 'nokey@localhost.run'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let text = ''
    const read = (chunk: Buffer) => {
      if (generation !== this.generation) return
      text += chunk.toString('utf8')
      // The service announces the address in its greeting, and again whenever it assigns a new one.
      // The greeting (a QR code drawn in text) is far longer than the address, so search before trimming.
      const found = [...text.matchAll(/https:\/\/([a-z0-9-]+\.lhr\.life)\b/g)].at(-1)
      text = text.slice(-200)
      if (found && this.url !== `https://${found[1]}`) this.accept(`https://${found[1]}`, generation)
    }
    child.stdout?.on('data', read); child.stderr?.on('data', read)
    return child
  }

  /** A service reported an address: check that it is one of its own, then that it reaches the gateway. */
  private accept(address: string, generation: number): void {
    const suffix = ROUTES[this.route ?? 'cloudflare'].suffix
    let url: URL
    try { url = new URL(address); if (url.protocol !== 'https:' || !url.hostname.endsWith(suffix) || url.username || url.password || url.port || url.pathname !== '/') throw new Error() }
    catch { this.fail('连接服务返回的地址不符合预期，请重试。'); return }
    clearTimeout(this.timer)
    if (this.url) this.gateway.disallowAuthority(new URL(this.url).host)
    this.url = url.origin; this.gateway.allowAuthority(url.host)
    this.phase = 'verifying'; this.verifyUntil = Date.now() + VERIFY_MS
    void this.probe(generation)
  }

  private async probe(generation: number): Promise<void> {
    if (!this.url || this.checking) return
    this.checking = true
    let healthy = false
    try {
      const init = { signal: AbortSignal.timeout(10000), redirect: 'error' as const }
      const response = this.proxy
        ? await tunnelFetch(this.gateway.healthURL(this.url), { ...init, dispatcher: this.proxy })
        : await fetch(this.gateway.healthURL(this.url), init)
      healthy = response.ok && this.gateway.verifyHealth(await response.json())
      if (!healthy) this.lastFailure = response.ok ? '网关验证信息不匹配' : `HTTP ${response.status}`
    } catch (failure) {
      const code = (failure as { cause?: { code?: string }; name?: string }).cause?.code
      this.lastFailure = code && /^[A-Z_0-9]+$/.test(code) ? code : (failure as Error).name === 'TimeoutError' ? '请求超时' : '网络请求失败'
    }
    finally { this.checking = false }
    if (generation !== this.generation) return
    if (healthy) {
      this.failures = 0; this.phase = 'ready'; this.everReady = true; this.warning = undefined; clearTimeout(this.timer)
      if (!this.monitor) { this.monitor = setInterval(() => { void this.probe(generation) }, 30000); this.monitor.unref() }
    } else if (this.phase === 'ready') {
      // This check leaves from the computer, whose route to the address can fail while phones still
      // get through. Only the tunnel process exiting ends a verified connection.
      if (++this.failures >= 3) this.warning = `这台电脑暂时访问不到自己的远程地址（${this.lastFailure}）。手机可能仍可使用；如果手机也连不上，请重新连接。`
    } else if (Date.now() >= this.verifyUntil) this.fail(`远程地址没有连通（${this.lastFailure}）；请重试、给电脑设置网络代理，或改用“同一 Wi‑Fi”。`)
    else { this.timer = setTimeout(() => { void this.probe(generation) }, 3000); this.timer.unref() }
  }

  private fail(message: string): void {
    if (this.url) this.gateway.disallowAuthority(new URL(this.url).host)
    this.url = undefined
    const generation = ++this.generation
    clearTimeout(this.timer); clearInterval(this.monitor); this.monitor = undefined
    const child = this.child; this.child = undefined
    void this.closeChild(child)
    // A service that never came up gives way to the next one; one that was working and then died does not,
    // because its address is what the phones are using.
    if (!this.everReady && this.remaining.length) {
      this.note = `${ROUTES[this.route ?? 'cloudflare'].name} 线路没有连通，已改用 ${ROUTES[this.remaining[0]!].name}。`
      this.launch(generation)
      return
    }
    this.phase = 'error'; this.error = message; this.warning = undefined
    void this.proxy?.destroy(); this.proxy = undefined
    this.onFailure?.(message)
  }

  private async closeChild(child: ChildProcess | undefined): Promise<void> {
    if (!child || child.exitCode !== null || child.signalCode !== null) return
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        // Terminate only this plugin's owned process tree, including cloudflared.
        if (process.platform === 'win32' && child.pid) execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => resolve())
        else { child.kill('SIGKILL'); resolve() }
      }, 3000)
      child.once('exit', () => { clearTimeout(timer); resolve() })
      // The worker closes its tunnel when asked; a plain process is simply ended.
      if (child.connected) child.send('stop', () => {}); else child.kill()
    })
  }

  async stop(): Promise<void> {
    ++this.generation; clearTimeout(this.timer); clearInterval(this.monitor); this.monitor = undefined
    if (this.url) this.gateway.disallowAuthority(new URL(this.url).host)
    const child = this.child; this.child = undefined; this.url = undefined; this.phase = 'off'; this.failures = 0; this.warning = undefined
    this.remaining = []; this.route = undefined
    const proxy = this.proxy; this.proxy = undefined
    await Promise.all([this.closeChild(child), proxy?.destroy()])
  }
}
