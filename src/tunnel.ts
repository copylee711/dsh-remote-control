import { fork, execFile } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { Gateway } from './gateway.js'
import { fetch as tunnelFetch, ProxyAgent } from 'undici'

export type TunnelPhase = 'off' | 'downloading' | 'starting' | 'verifying' | 'ready' | 'error'
export class TunnelManager {
  phase: TunnelPhase = 'off'
  url?: string
  error?: string
  private child?: ChildProcess
  private generation = 0
  private timer?: ReturnType<typeof setTimeout>
  private monitor?: ReturnType<typeof setInterval>
  private failures = 0
  private checking = false
  private lastFailure = ''
  private proxy?: ProxyAgent
  constructor(private readonly gateway: Gateway, private readonly onFailure?: (message: string) => void) {}
  async start(proxy?: string): Promise<void> {
    await this.stop()
    this.proxy = proxy ? new ProxyAgent(proxy) : undefined
    const generation = ++this.generation
    this.phase = 'starting'; this.error = undefined
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_USE_ENV_PROXY: '1', DSH_RC_TUNNEL_PORT: String(this.gateway.port) }
    if (proxy) { Object.assign(env, { HTTPS_PROXY: proxy, HTTP_PROXY: proxy }); }
    const child = this.child = fork(fileURLToPath(new URL('./tunnel-worker.js', import.meta.url)), [], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: [] })
    // Drain package logging without exposing URLs/credentials in Host logs.
    child.stdout?.resume(); child.stderr?.resume()
    this.timer = setTimeout(() => { if (generation === this.generation) this.fail('隧道启动超过 120 秒；请检查网络或配置电脑端代理后重试。') }, 120000); this.timer.unref()
    child.on('message', value => {
      if (generation !== this.generation || !value || typeof value !== 'object' || !('phase' in value)) return
      const message = value as { phase: string; url?: string; error?: string }
      if (message.phase === 'downloading' || message.phase === 'starting') this.phase = message.phase
      if (message.phase === 'error') this.fail(message.error ?? '隧道启动失败。')
      if (message.phase === 'url' && message.url) {
        let url: URL
        try { url = new URL(message.url); if (url.protocol !== 'https:' || !url.hostname.endsWith('.trycloudflare.com') || url.username || url.password || url.port || url.pathname !== '/') throw new Error() }
        catch { this.fail('untun 返回的公网地址不符合预期。'); return }
        clearTimeout(this.timer)
        this.url = url.origin; this.gateway.allowAuthority(url.host); this.phase = 'verifying'
        void this.probe(generation)
      }
    })
    child.on('error', () => { if (generation === this.generation) this.fail('无法启动隧道工作进程。') })
    child.on('exit', () => { if (generation === this.generation && this.phase !== 'off' && this.phase !== 'error') this.fail('隧道进程已退出，请重新开启。') })
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
      this.failures = 0; this.phase = 'ready'; clearTimeout(this.timer)
      if (!this.monitor) { this.monitor = setInterval(() => { void this.probe(generation) }, 30000); this.monitor.unref() }
    } else if (++this.failures >= 3) this.fail(`公网地址未通过连通性检查（${this.lastFailure}）；域名分配不代表可用。请重试，或切换局域网连接。`)
    else { this.timer = setTimeout(() => { void this.probe(generation) }, 3000); this.timer.unref() }
  }
  private fail(message: string): void {
    this.phase = 'error'; this.error = message
    if (this.url) this.gateway.disallowAuthority(new URL(this.url).host)
    this.url = undefined
    ++this.generation; clearTimeout(this.timer); clearInterval(this.monitor); this.monitor = undefined
    const child = this.child; this.child = undefined
    void this.proxy?.destroy(); this.proxy = undefined
    void this.closeChild(child)
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
      if (child.connected) child.send('stop', () => {})
    })
  }
  async stop(): Promise<void> {
    ++this.generation; clearTimeout(this.timer); clearInterval(this.monitor); this.monitor = undefined
    if (this.url) this.gateway.disallowAuthority(new URL(this.url).host)
    const child = this.child; this.child = undefined; this.url = undefined; this.phase = 'off'; this.failures = 0
    const proxy = this.proxy; this.proxy = undefined
    await Promise.all([this.closeChild(child), proxy?.destroy()])
  }
}
