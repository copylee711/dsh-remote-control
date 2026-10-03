/** Runs before the official shell. No device or Host credential is embedded. */
function remoteBoot(): void {
  const globals = window as unknown as Record<string, any>
  globals.__DSH_REMOTE_CONTROL__ = true
  globals.__DSH_TRANSPORT__ = { ...globals.__DSH_TRANSPORT__, ownsHost: true }
  const originalFetch = window.fetch.bind(window)
  globals.__DSH_FILE_UPLOAD__ = { fetch: originalFetch }
  function disconnected(message: string): void {
    if (document.getElementById('dsh-rc-disconnected')) return
    const notice = document.createElement('div'); notice.id = 'dsh-rc-disconnected'; notice.setAttribute('role', 'alert')
    notice.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(255,255,255,.97);display:flex;align-items:center;justify-content:center;padding:24px;font:16px/1.7 system-ui,sans-serif;text-align:center;color:#263d32'
    const box = document.createElement('div'), text = document.createElement('p'), retry = document.createElement('button')
    text.textContent = message; retry.textContent = '重新连接'; retry.onclick = () => location.reload()
    retry.style.cssText = 'padding:12px 20px;border:0;border-radius:10px;background:#356d53;color:white;font:inherit'
    box.append(text, retry); notice.append(box); (document.body ?? document.documentElement).append(notice)
  }
  window.fetch = async (...args) => {
    const response = await originalFetch(...args)
    if (response.status === 403 && new URL(String(args[0] instanceof Request ? args[0].url : args[0]), location.href).origin === location.origin) disconnected('设备授权已失效或撤销，请重新扫码并在电脑上确认。')
    return response
  }
  const OriginalSocket = window.WebSocket
  globals.WebSocket = class extends OriginalSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols)
      this.addEventListener('close', () => {
        void originalFetch('/api/dsh-remote-control/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'status' }) }).then(response => {
          if (response.status === 403) disconnected('设备授权已撤销，远程连接已断开。请重新扫码。')
        }).catch(() => disconnected('远程连接已中断。请检查网络或在电脑上重新开启连接。'))
      })
    }
  }
  if (!crypto.randomUUID) Object.defineProperty(crypto, 'randomUUID', { value: () => '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0]! & 15 >> Number(c) / 4).toString(16)) })
  // Cloudflare Quick Tunnels do not support SSE. EventSource uses our WS carrier.
  const NativeSocket = window.WebSocket
  class RemoteEventSource extends EventTarget {
    static CONNECTING = 0; static OPEN = 1; static CLOSED = 2
    readonly CONNECTING = 0; readonly OPEN = 1; readonly CLOSED = 2
    readyState = 0; url: string; withCredentials: boolean
    onopen: ((event: Event) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    private socket?: WebSocket; private timer?: ReturnType<typeof setTimeout>
    private buffer = ''; private lastId = ''; private retry = 3000
    constructor(url: string | URL, init?: EventSourceInit) {
      super(); this.url = new URL(String(url), location.href).href; this.withCredentials = init?.withCredentials ?? false
      if (new URL(this.url).origin !== location.origin) throw new Error('远程 EventSource 仅允许同源地址。')
      this.connect()
    }
    private emit(type: string, event: Event): void {
      this.dispatchEvent(event)
      const callback = type === 'open' ? this.onopen : type === 'error' ? this.onerror : type === 'message' ? this.onmessage : undefined
      callback?.call(this, event as MessageEvent)
    }
    private connect(): void {
      if (this.readyState === 2) return
      const url = new URL('/rc/sse', location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const source = new URL(this.url); url.searchParams.set('path', source.pathname + source.search)
      if (this.lastId) url.searchParams.set('lastEventId', this.lastId)
      const socket = this.socket = new NativeSocket(url)
      socket.onmessage = event => {
        const frame = JSON.parse(event.data)
        if (frame.type === 'ready') { this.readyState = 1; this.emit('open', new Event('open')); return }
        if (frame.type === 'error') { this.close(); this.emit('error', new Event('error')); return }
        if (frame.type !== 'chunk') return
        this.buffer += frame.data
        let match: RegExpExecArray | null
        while ((match = /\r\n\r\n|\n\n|\r\r/.exec(this.buffer))) {
          const text = this.buffer.slice(0, match.index); this.buffer = this.buffer.slice(match.index + match[0].length)
          let type = 'message'; const data: string[] = []
          for (const line of text.split(/\r\n|\r|\n/)) {
            const colon = line.indexOf(':'); const field = colon < 0 ? line : line.slice(0, colon); const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
            if (field === 'data') data.push(value)
            else if (field === 'event') type = value || 'message'
            else if (field === 'id' && !value.includes('\0')) this.lastId = value
            else if (field === 'retry' && /^\d+$/.test(value)) this.retry = Math.min(30000, Math.max(500, Number(value)))
          }
          if (data.length) this.emit(type, new MessageEvent(type, { data: data.join('\n'), lastEventId: this.lastId, origin: location.origin }))
        }
      }
      socket.onerror = () => this.emit('error', new Event('error'))
      socket.onclose = () => { if (this.readyState !== 2) { this.readyState = 0; this.buffer = ''; this.timer = setTimeout(() => this.connect(), this.retry) } }
    }
    close(): void { this.readyState = 2; clearTimeout(this.timer); this.socket?.close() }
  }
  globals.EventSource = RemoteEventSource
  // The official UI retains its behavior; touch layout changes are CSS-scoped.
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.add('dsh-rc-app')
    document.addEventListener('keydown', event => {
      const editable = event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)
      if (matchMedia('(pointer:coarse) and (max-width:900px)').matches && event.key === 'Enter' && !event.isComposing && !event.ctrlKey && !event.metaKey && editable) event.stopImmediatePropagation()
    }, true)
  })
}
export const BOOT_SCRIPT = `(${remoteBoot.toString()})();`
export const MOBILE_CSS = `
html.dsh-rc-app{min-height:100%;overscroll-behavior:none}
@media(pointer:coarse) and (max-width:900px){
  .dsh-rc-app{touch-action:manipulation;--dsw-control-height:44px}
  .dsh-rc-app input,.dsh-rc-app textarea,.dsh-rc-app select{font-size:16px!important}
  .dsh-rc-app button{min-height:40px}
  .dsh-rc-app [class$="_composerSeat"]{padding-bottom:max(10px,env(safe-area-inset-bottom))!important}
  .dsh-rc-app [role="dialog"]{max-width:calc(100vw - 16px)!important;max-height:calc(100dvh - 24px)!important;overflow:auto}
  .dsh-rc-app pre{max-width:100%;overflow:auto}
  .dsh-rc-app [class$="_messageContent"]{overflow-wrap:anywhere}
  .dsh-rc-app [role="tooltip"]{display:none!important}
}
`
export function injectBoot(html: string): string {
  return html.replace(/<head(?:\s[^>]*)?>/i, match => `${match}<script>${BOOT_SCRIPT.replace(/<\/script/gi, '<\\/script')}</script><style>${MOBILE_CSS}</style>`)
}
