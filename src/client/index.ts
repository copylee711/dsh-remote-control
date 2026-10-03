import * as React from 'react'
import { CSS } from './style.js'
import { ACCENTS, ACCENT_IDS, type Accent } from '../accent.js'
const h = React.createElement
const ROUTE = '/api/dsh-remote-control/manage'
interface Status {
  enabled: boolean; busy: boolean; mode: 'public' | 'lan' | 'fixed'; activeMode?: 'public' | 'lan' | 'fixed'; autoStart: boolean; proxyConfigured: boolean; accent?: Accent
  phase: string; error?: string; warning?: string; gatewayPort: number; local: boolean; expiresAt?: number; qr?: string
  links: Array<{ base: string; url?: string }>; requests: Array<{ id: string; name: string; expiresAt: number }>
  devices: Array<{ id: string; name: string; createdAt: number; lastSeenAt: number; online: boolean; via?: 'lan' | 'public' }>; fixedReason: string; lanHint: string
}
interface ClientContext {
  effect(run: () => void | (() => void), label?: string): void
  slots: { inject(name: string, setup: () => unknown): void; register(meta: Record<string, unknown>, render: (props: any) => unknown): unknown }
}
export async function command(input: Record<string, unknown>): Promise<Status> {
  const transport = (globalThis as unknown as { __DSH_TRANSPORT__?: { fetch?: typeof fetch } }).__DSH_TRANSPORT__?.fetch ?? fetch
  const response = await transport(ROUTE, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `连接失败（HTTP ${response.status}）`)
  return data as Status
}
type Way = 'public' | 'lan'
/** The two ways a phone reaches the computer, in words that need no networking knowledge. */
const WAYS: Array<{ mode: Way; name: string; text: string }> = [
  { mode: 'lan', name: '同一 Wi‑Fi', text: '手机和电脑连着同一个 Wi‑Fi 或路由器时使用。速度最快，数据不经过外部服务器。' },
  { mode: 'public', name: '任意网络', text: '手机用流量或别处的 Wi‑Fi 也能连。通过 Cloudflare 的免费通道转发，每次开启都会换一个新地址，需要重新扫码。' },
]
const wayName = (mode: string | undefined) => WAYS.find(way => way.mode === mode)?.name ?? ''
const phaseLabels: Record<string, string> = { off: '未开启', downloading: '正在下载连接组件', starting: '正在建立连接', verifying: '正在检查能否访问', ready: '已开启', error: '连接失败' }
function icon(): React.ReactNode { return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('rect', { x: 7, y: 2, width: 10, height: 20, rx: 3 }), h('path', { d: 'M10 5h4M11 19h2' })) }

const when = (time: number) => new Date(time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** One authorized device: where it paired, when it was used, a name the user can change. */
function DeviceRow({ device, disabled, act }: { device: Status['devices'][number]; disabled: boolean; act: (action: string, fields?: Record<string, unknown>) => Promise<void> }): React.ReactElement {
  const [name, setName] = React.useState<string | null>(null)
  const save = () => { const next = name?.trim(); setName(null); if (next && next !== device.name) void act('rename', { id: device.id, name: next }) }
  return h('div', { className: 'dsrc-device dsrc-row' },
    h('div', { className: 'dsrc-device-main' },
      name === null
        ? h('div', { className: 'dsrc-device-name' }, device.name,
          device.via ? h('span', { className: 'dsrc-tag' }, wayName(device.via)) : null,
          device.online ? h('span', { className: 'dsrc-tag dsrc-online' }, '在线') : null)
        : h('input', { className: 'dsrc-rename', 'aria-label': '设备名称', autoFocus: true, maxLength: 40, value: name, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value), onBlur: save, onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter') save(); if (event.key === 'Escape') setName(null) } }),
      h('div', { className: 'dsrc-muted' }, `配对于 ${when(device.createdAt)} · 最近使用 ${when(device.lastSeenAt)}`)),
    h('div', { className: 'dsrc-actions' },
      h('button', { type: 'button', className: 'dsrc-button dsrc-ghost', disabled, onClick: () => setName(device.name) }, '重命名'),
      h('button', { type: 'button', className: 'dsrc-button dsrc-danger', disabled, onClick: () => { void act('revoke', { id: device.id }) } }, '撤销授权')))
}

export function RemoteControlPanel(): React.ReactElement {
  const [state, setState] = React.useState<Status | null>(null)
  const [error, setError] = React.useState('')
  const [working, setWorking] = React.useState(false)
  const [proxy, setProxy] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const mounted = React.useRef(true), pending = React.useRef(false)
  const refresh = React.useCallback(async () => {
    if (pending.current) return
    pending.current = true
    try { const data = await command({ action: 'status' }); if (mounted.current) { setState(data); setError('') } }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : '状态读取失败。') }
    finally { pending.current = false }
  }, [])
  React.useEffect(() => {
    mounted.current = true; void refresh(); const timer = setInterval(() => { void refresh() }, 2000)
    return () => { mounted.current = false; clearInterval(timer) }
  }, [refresh])
  const act = async (action: string, fields: Record<string, unknown> = {}) => {
    setWorking(true); setNotice('')
    try {
      const data = await command({ action, ...fields })
      if (data.links) setState(data)
      else if (action === 'switch') { setNotice('已提交切换，当前访问即将断开。请使用新入口重新连接。') }
      else if (action === 'stop') { setState(previous => previous ? { ...previous, enabled: false, phase: 'off', links: [], qr: undefined } : previous); setNotice('远程连接已关闭，设备授权保留。') }
      else { setNotice('操作已提交。'); setTimeout(() => { void refresh() }, 200) }
      setError('')
    } catch (failure) { setError(failure instanceof Error ? failure.message : '操作失败。') }
    finally { setWorking(false) }
  }
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setNotice('配对链接已复制。') }
    catch { setNotice('浏览器不允许自动复制，请选中下面的链接手动复制。') }
  }
  const expired = !!state?.expiresAt && Date.now() >= state.expiresAt
  // The code is a one-time ticket for pairing a new device, valid for five minutes; devices already
  // paired do not depend on it. While the panel is open it is renewed, unless a device is mid-pairing.
  const renewing = React.useRef(false)
  React.useEffect(() => {
    if (!state?.enabled || !expired || state.busy || renewing.current || (state.local && state.requests.length)) return
    renewing.current = true
    void command({ action: 'refresh' }).then(setState, () => {}).finally(() => { renewing.current = false })
  }, [state, expired])
  /** The way the user asked to change to while connected, awaiting their confirmation. */
  const [asking, setAsking] = React.useState<Way | null>(null)
  // While connected, the option shown as chosen is the one in use; nothing changes until confirmed.
  const shown = state?.enabled ? state.activeMode : state?.mode
  const choose = (mode: Way) => {
    if (!state?.enabled) { void act('preferences', { mode }); return }
    setAsking(mode === state.activeMode ? null : mode)
  }
  const change = async (mode: Way) => { setAsking(null); await act('preferences', { mode }); await act('switch') }
  const disabled = working || !!state?.busy
  const firstURL = state?.links[0]?.url
  const button = (label: string, action: string, fields?: Record<string, unknown>, extra = '') => h('button', { type: 'button', className: `dsrc-button ${extra}`, disabled, onClick: () => { void act(action, fields) } }, label)
  return h('div', { className: 'dsrc', 'data-dsh-plugin': 'dsh-remote-control', 'data-rc-accent': state?.accent ?? 'orange' },
    h('header', { className: 'dsrc-head' }, h('div', null, h('h2', null, '远程控制'), h('p', { className: 'dsrc-sub' }, '扫码后在本机确认连接，继续会话与审批。')),
      h('span', { className: 'dsrc-badge', 'data-ready': state?.phase === 'ready' }, h('span', { className: 'dsrc-dot' }), phaseLabels[state?.phase ?? 'off'] ?? '读取状态')),
    h('section', { className: 'dsrc-surface' },
      h('h3', null, '连接方式'),
      h('div', { className: 'dsrc-ways', role: 'radiogroup', 'aria-label': '连接方式' },
        ...WAYS.map(way => h('button', { key: way.mode, type: 'button', role: 'radio', className: 'dsrc-way', 'aria-checked': shown === way.mode, disabled, onClick: () => choose(way.mode) },
          h('span', { className: 'dsrc-way-mark' }),
          h('span', null, h('span', { className: 'dsrc-way-name' }, way.name, state?.enabled && state.activeMode === way.mode ? h('span', { className: 'dsrc-tag' }, '正在使用') : null),
            h('span', { className: 'dsrc-way-text' }, way.text))))),
      asking ? h('div', { className: 'dsrc-confirm', role: 'alertdialog', 'aria-label': '更换连接方式' },
        h('p', null, `改用“${wayName(asking)}”？已经连上的手机会断开，需要重新扫码。`),
        h('div', { className: 'dsrc-actions' },
          h('button', { type: 'button', className: 'dsrc-button', disabled, onClick: () => setAsking(null) }, '保持不变'),
          h('button', { type: 'button', className: 'dsrc-button dsrc-primary', disabled, onClick: () => { void change(asking) } }, '更换并重新连接'))) : null,
      shown === 'lan' && state?.enabled ? h('p', { className: 'dsrc-note' }, '连不上时，检查手机和电脑是否在同一个 Wi‑Fi，以及电脑防火墙是否拦截了这个程序。') : null,
      h('div', { className: 'dsrc-actions' }, state?.enabled ? button('关闭远程连接', 'stop') : button('开启远程连接', 'start', {}, 'dsrc-primary')),
      h('label', { className: 'dsrc-toggle' }, h('input', { type: 'checkbox', checked: state?.autoStart ?? false, disabled, onChange: (event: React.ChangeEvent<HTMLInputElement>) => { void act('preferences', { autoStart: event.target.checked }) } }), '随 DSH 启动，自动开启所选连接方式'),
      h('div', { className: 'dsrc-note' }, '强调色　', h('span', { className: 'dsrc-swatches', role: 'radiogroup', 'aria-label': '强调色' },
        ...ACCENT_IDS.map(id => h('button', { key: id, type: 'button', className: 'dsrc-swatch', role: 'radio', 'aria-checked': (state?.accent ?? 'orange') === id, 'aria-label': ACCENTS[id].name, title: ACCENTS[id].name, style: { '--rc-swatch': ACCENTS[id].light.accent } as React.CSSProperties, onClick: () => { void act('preferences', { accent: id }) } }))),
        '　电脑面板、配对页和手机界面共用'),
      shown !== 'lan' ? h('details', { className: 'dsrc-proxy' }, h('summary', null, state?.proxyConfigured ? '电脑的网络代理 · 已设置' : '开启失败？给电脑设置网络代理（可选）'), h('div', { className: 'dsrc-input' }, h('input', { 'aria-label': '电脑端代理地址', placeholder: 'http://127.0.0.1:7890', value: proxy, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setProxy(event.target.value) }), button('保存代理', 'preferences', { proxy })), h('p', { className: 'dsrc-note' }, '“任意网络”需要这台电脑能访问 Cloudflare。电脑平时靠代理软件上网的话，把代理地址填在这里；留空则使用系统已有的设置。保存后重新开启生效。手机不需要代理。首次开启会下载 Cloudflare 的连接组件。')) : null,
    ),
    h('section', { className: 'dsrc-surface' }, h('div', { className: 'dsrc-row' }, h('h3', null, '扫码配对'), h('span', { className: 'dsrc-muted' }, expired ? '正在更新二维码' : firstURL ? '只用于添加新设备 · 自动更新' : '等待连接就绪')),
      h('div', { className: 'dsrc-pair' }, h('div', { className: 'dsrc-code' }, state?.qr && !expired ? h('img', { src: state.qr, alt: '远程控制配对二维码' }) : h('div', { className: 'dsrc-placeholder' }, expired ? '点击刷新二维码' : '连接就绪后\n二维码会显示在这里')),
        h('div', { className: 'dsrc-steps' }, ...['开启连接并用手机扫码', '在本机面板确认配对请求', '进入远程界面，继续会话和审批'].map((step, i) => h('div', { className: 'dsrc-step', key: step }, h('span', { className: 'dsrc-number' }, String(i + 1).padStart(2, '0')), h('span', null, step))), h('p', { className: 'dsrc-muted' }, '配对后的设备与本机同权，可以管理设置、凭据和插件。二维码只在添加新设备时用一次，已连上的手机不受它影响。'))),
      firstURL ? h('div', { className: 'dsrc-link' }, firstURL) : null,
      h('div', { className: 'dsrc-actions' }, h('button', { type: 'button', className: 'dsrc-button', disabled: !firstURL || expired, onClick: () => { if (firstURL) void copy(firstURL) } }, '复制链接'), h('button', { type: 'button', className: 'dsrc-button', disabled: !state?.enabled || disabled, onClick: () => { void act('refresh') } }, '刷新二维码')),
      state?.links && state.links.length > 1 ? h('p', { className: 'dsrc-note' }, '其他网卡地址：', ...state.links.slice(1).map(link => h('span', { key: link.base }, ' ', h('button', { type: 'button', className: 'dsrc-button', onClick: () => { if (link.url) void copy(link.url) } }, link.base)))) : null,
    ),
    state?.local && state.requests.length ? h('section', { className: 'dsrc-surface' }, h('h3', null, '等待你确认'), ...state.requests.map(request => h('div', { className: 'dsrc-device dsrc-row', key: request.id }, h('div', null, h('div', { className: 'dsrc-device-name' }, request.name), h('div', { className: 'dsrc-muted' }, '允许后授予与本机相同的权限')), h('div', { className: 'dsrc-actions' }, button('拒绝', 'reject', { id: request.id }), button('允许连接', 'approve', { id: request.id }, 'dsrc-primary'))))) : null,
    h('section', { className: 'dsrc-surface' }, h('div', { className: 'dsrc-row' }, h('h3', null, '已授权设备'), state?.devices.length ? button('撤销全部', 'revokeAll', {}, 'dsrc-danger') : null),
      state?.devices.length ? state.devices.map(device => h(DeviceRow, { key: device.id, device, disabled, act })) : h('p', { className: 'dsrc-empty' }, '还没有配对设备。扫码并确认后，设备会出现在这里。'),
      h('p', { className: 'dsrc-note' }, '同一台手机用两种方式各连过一次，会有两条记录。“同一 Wi‑Fi”的授权 30 天不用后过期；“任意网络”的地址每次开启都会变，关闭连接后对应的记录自动清除。')),
    error || state?.error ? h('div', { className: 'dsrc-error', role: 'alert' }, error || state?.error) : null,
    state?.warning ? h('p', { className: 'dsrc-note', role: 'status' }, state.warning) : null,
    notice ? h('p', { className: 'dsrc-note', role: 'status' }, notice) : null,
  )
}
interface Waiting { enabled: boolean; accent?: Accent; requests: Array<{ id: string; name: string; expiresAt: number }> }

/** Pairing requests pop up on the computer as they arrive, so they are not missed while the panel is closed. */
function PairingPrompt({ waiting, onDone }: { waiting: Waiting; onDone: () => void }): React.ReactElement | null {
  const dialog = React.useRef<HTMLDialogElement>(null)
  const [working, setWorking] = React.useState(false), [error, setError] = React.useState('')
  const request = waiting.requests[0]
  React.useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (request && !element.open) element.showModal()
    if (!request && element.open) element.close()
  }, [request?.id])
  const answer = async (action: 'approve' | 'reject') => {
    if (!request) return
    setWorking(true); setError('')
    try { await command({ action, id: request.id }) } catch (failure) { setError(failure instanceof Error ? failure.message : '操作失败。') }
    finally { setWorking(false); onDone() }
  }
  return h('dialog', { className: 'dsrc-dialog dsrc-prompt', ref: dialog, onCancel: (event: React.SyntheticEvent) => event.preventDefault() },
    request ? h('div', { className: 'dsrc', 'data-rc-accent': waiting.accent ?? 'orange' },
      h('h2', null, '新的配对请求'),
      h('p', { className: 'dsrc-prompt-device' }, request.name),
      h('p', { className: 'dsrc-note' }, '这台设备扫描了远程控制二维码。允许后，它与本机拥有相同的权限，可以管理设置、凭据和插件。不是你本人操作请拒绝。'),
      waiting.requests.length > 1 ? h('p', { className: 'dsrc-note' }, `还有 ${waiting.requests.length - 1} 个请求在等待。`) : null,
      error ? h('div', { className: 'dsrc-error', role: 'alert' }, error) : null,
      h('div', { className: 'dsrc-actions dsrc-prompt-actions' },
        h('button', { type: 'button', className: 'dsrc-button', disabled: working, onClick: () => { void answer('reject') } }, '拒绝'),
        h('button', { type: 'button', className: 'dsrc-button dsrc-primary', disabled: working, autoFocus: true, onClick: () => { void answer('approve') } }, '允许连接'))) : null)
}
function SidebarEntry({ wide }: { wide?: boolean }): React.ReactElement {
  const [open, setOpen] = React.useState(false), dialog = React.useRef<HTMLDialogElement>(null)
  const [waiting, setWaiting] = React.useState<Waiting>({ enabled: false, requests: [] })
  React.useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close() }, [open])
  const check = React.useCallback(async () => {
    try { setWaiting(await command({ action: 'requests' }) as unknown as Waiting) } catch { /* the Host is restarting: ask again on the next tick */ }
  }, [])
  React.useEffect(() => { void check(); const timer = setInterval(() => { void check() }, 2500); return () => clearInterval(timer) }, [check])
  const pending = waiting.requests.length > 0
  return h(React.Fragment, null,
    h('button', { type: 'button', className: wide ? 'dsrc-entry dsrc-entry-corner' : 'dsrc-entry', title: pending ? '远程控制 · 有配对请求' : '远程控制', 'aria-label': '远程控制', onClick: () => setOpen(true) }, icon(), pending ? h('span', { className: 'dsrc-entry-dot' }) : null),
    h('dialog', { className: 'dsrc-dialog', ref: dialog, onCancel: () => setOpen(false), onClick: (event: React.MouseEvent<HTMLDialogElement>) => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) setOpen(false) } } },
      h('button', { type: 'button', className: 'dsrc-close', 'aria-label': '关闭远程控制面板', onClick: () => setOpen(false) }, '×'), open ? h(RemoteControlPanel) : null),
    h(PairingPrompt, { waiting, onDone: () => { void check() } }))
}
export const inject = ['slots', 'connection']
export function apply(ctx: ClientContext): void {
  ctx.effect(() => { const style = document.createElement('style'); style.dataset.dshRemoteControl = 'true'; style.textContent = CSS; document.head.append(style); return () => style.remove() }, 'remote-control styles')
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'copylee-remote-control', order: 65, label: () => '远程控制' }, () => h(RemoteControlPanel)))
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'copylee-remote-control', order: 65 }, (props: { wide?: boolean }) => h(SidebarEntry, { wide: props?.wide })))
}

