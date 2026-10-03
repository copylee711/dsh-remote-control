/**
 * The proxy this computer is set to use, found the same way dsh-proxy finds it:
 * environment variables first, then Windows Internet Settings or macOS scutil.
 */
import { execFile } from 'node:child_process'

export interface SystemProxy { url: string; source: string }
export interface DetectionOptions {
  env?: NodeJS.ProcessEnv
  platform?: string
  run?: (file: string, args: string[]) => Promise<string>
}

function runCommand(file: string, args: string[]): Promise<string> {
  return new Promise(resolve => {
    execFile(file, args, { timeout: 3000, windowsHide: true }, (error, stdout) => resolve(error ? '' : stdout))
  })
}

/** "host:port", or the per-protocol form "http=host:port;https=host:port". */
export function pickWindowsProxy(server: string): string | undefined {
  if (!server.includes('=')) return server.trim() || undefined
  const parts = Object.fromEntries(server.split(';').map(part => part.split('=').map(x => x.trim())).filter(pair => pair.length === 2 && pair[1]))
  return parts.https ?? parts.http
}

/** An HTTP(S) proxy address without credentials, or undefined: the tunnel can use nothing else. */
export function httpProxy(value: string): string | undefined {
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) return undefined
    return url.origin
  } catch { return undefined }
}

export async function detectSystemProxy(options: DetectionOptions = {}): Promise<SystemProxy | null> {
  const env = options.env ?? process.env
  const platform = options.platform ?? process.platform
  const run = options.run ?? runCommand
  const candidates: SystemProxy[] = []
  for (const name of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) {
    if (env[name]) candidates.push({ url: env[name]!, source: `环境变量 ${name}` })
  }
  if (platform === 'win32') {
    const out = await run('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'])
    const server = out.match(/ProxyServer\s+REG_SZ\s+(.+)/i)?.[1]
    const picked = /ProxyEnable\s+REG_DWORD\s+0x0*1\b/i.test(out) && server ? pickWindowsProxy(server) : undefined
    if (picked) candidates.push({ url: picked, source: 'Windows 系统代理' })
  } else if (platform === 'darwin') {
    const out = await run('scutil', ['--proxy'])
    const field = (key: string) => out.match(new RegExp(`\\b${key}\\s*:\\s*(\\S+)`))?.[1]
    for (const kind of ['HTTPS', 'HTTP']) {
      const host = field(`${kind}Proxy`)
      if (field(`${kind}Enable`) === '1' && host) {
        candidates.push({ url: `${host.includes(':') ? `[${host}]` : host}:${field(`${kind}Port`) ?? '80'}`, source: 'macOS 系统代理' })
      }
    }
  }
  for (const candidate of candidates) {
    const url = httpProxy(candidate.url)
    if (url) return { ...candidate, url }
  }
  return null
}
