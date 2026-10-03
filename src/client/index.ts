import * as React from 'react'
import { CSS } from './style.js'
const h = React.createElement
const ROUTE = '/api/dsh-remote-control/manage'
interface Status {
  enabled: boolean; busy: boolean; mode: 'public' | 'lan' | 'fixed'; autoStart: boolean; proxyConfigured: boolean
  phase: string; error?: string; gatewayPort: number; local: boolean; expiresAt?: number; qr?: string
  links: Array<{ base: string; url?: string }>; requests: Array<{ id: string; name: string; expiresAt: number }>
  devices: Array<{ id: string; name: string; lastSeenAt: number; online: boolean }>; fixedReason: string; lanHint: string
}
interface ClientContext {
  effect(run: () => void | (() => void), label?: string): void
  slots: { inject(name: string, setup: () => unknown): void; register(meta: Record<string, unknown>, render: (props: any) => unknown): unknown }
}
async function command(input: Record<string, unknown>): Promise<Status> {
  const transport = (globalThis as unknown as { __DSH_TRANSPORT__?: { fetch?: typeof fetch } }).__DSH_TRANSPORT__?.fetch ?? fetch
  const response = await transport(ROUTE, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `连接失败（HTTP ${response.status}）`)
  return data as Status
}
const phaseLabels: Record<string, string> = { off: '未开启', downloading: '下载连接组件', starting: '建立隧道', verifying: '验证公网连接', ready: '已开启', error: '连接失败' }
function icon(): React.ReactNode { return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('rect', { x: 7, y: 2, width: 10, height: 20, rx: 3 }), h('path', { d: 'M10 5h4M11 19h2' })) }

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
  const disabled = working || !!state?.busy
  const firstURL = state?.links[0]?.url
  const button = (label: string, action: string, fields?: Record<string, unknown>, extra = '') => h('button', { type: 'button', className: `dsrc-button ${extra}`, disabled, onClick: () => { void act(action, fields) } }, label)
  return h('div', { className: 'dsrc', 'data-dsh-plugin': 'dsh-remote-control' },
    h('header', { className: 'dsrc-head' }, h('div', null, h('div', { className: 'dsrc-eyebrow' }, 'YOUR WORK, WITH YOU'), h('h2', null, '远程控制'), h('p', { className: 'dsrc-sub' }, '离开电脑，也能接着做。扫码后在本机确认连接。')),
      h('span', { className: 'dsrc-badge', 'data-ready': state?.phase === 'ready' }, h('span', { className: 'dsrc-dot' }), phaseLabels[state?.phase ?? 'off'] ?? '读取状态')),
    h('section', { className: 'dsrc-surface' },
      h('div', { className: 'dsrc-row' }, h('h3', null, '连接方式'), h('span', { className: 'dsrc-muted' }, state?.mode === 'lan' ? '同一 Wi-Fi' : '免费临时地址')),
      h('div', { className: 'dsrc-mode', role: 'group', 'aria-label': '连接方式' },
        ...([['public', '临时公网'], ['lan', '局域网'], ['fixed', '固定入口 · 暂不可用']] as const).map(([mode, label]) => h('button', { key: mode, type: 'button', 'aria-pressed': state?.mode === mode, disabled: disabled || mode === 'fixed', title: mode === 'fixed' ? state?.fixedReason : undefined, onClick: () => { void act('preferences', { mode }) } }, label))),
      h('p', { className: 'dsrc-note' }, state?.mode === 'lan' ? state.lanHint : '无需账号或域名。临时地址可能变化，换地址后需要重新扫码。固定入口待免费服务验证通过后提供。'),
      h('div', { className: 'dsrc-actions' }, state?.enabled ? button('关闭连接', 'stop') : button('开启远程连接', 'start', {}, 'dsrc-primary'), state?.phase === 'error' ? button('重新连接', 'start', {}, 'dsrc-primary') : null),
      h('label', { className: 'dsrc-toggle' }, h('input', { type: 'checkbox', checked: state?.autoStart ?? false, disabled, onChange: (event: React.ChangeEvent<HTMLInputElement>) => { void act('preferences', { autoStart: event.target.checked }) } }), '随 DSH 启动，自动开启所选连接方式'),
      state?.mode !== 'lan' ? h('details', { className: 'dsrc-proxy' }, h('summary', null, state?.proxyConfigured ? '电脑端代理 · 已配置' : '电脑端代理（可选）'), h('div', { className: 'dsrc-input' }, h('input', { 'aria-label': '电脑端代理地址', placeholder: 'http://127.0.0.1:7890', value: proxy, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setProxy(event.target.value) }), button('保存代理', 'preferences', { proxy })), h('p', { className: 'dsrc-note' }, '留空使用已有环境代理。保存后重新连接生效，手机仍通过普通网络访问。开启穿透会下载并运行 Cloudflare 连接组件。')) : null,
    ),
    h('section', { className: 'dsrc-surface' }, h('div', { className: 'dsrc-row' }, h('h3', null, '扫码配对'), h('span', { className: 'dsrc-muted' }, expired ? '二维码已过期' : firstURL ? '5 分钟有效' : '等待连接就绪')),
      h('div', { className: 'dsrc-pair' }, h('div', { className: 'dsrc-code' }, state?.qr && !expired ? h('img', { src: state.qr, alt: '远程控制配对二维码' }) : h('div', { className: 'dsrc-placeholder' }, expired ? '点击刷新二维码' : '连接就绪后\n二维码会显示在这里')),
        h('div', { className: 'dsrc-steps' }, ...['开启连接并用手机扫码', '在本机面板确认配对请求', '进入官方界面，继续会话和审批'].map((step, i) => h('div', { className: 'dsrc-step', key: step }, h('span', { className: 'dsrc-number' }, String(i + 1).padStart(2, '0')), h('span', null, step))), h('p', { className: 'dsrc-muted' }, '配对设备与本机同权，可以管理设置、凭据和插件。'))),
      firstURL ? h('div', { className: 'dsrc-link' }, firstURL) : null,
      h('div', { className: 'dsrc-actions' }, h('button', { type: 'button', className: 'dsrc-button', disabled: !firstURL || expired, onClick: () => { if (firstURL) void copy(firstURL) } }, '复制链接'), h('button', { type: 'button', className: 'dsrc-button', disabled: !state?.enabled || disabled, onClick: () => { void act('refresh') } }, '刷新二维码')),
      state?.links && state.links.length > 1 ? h('p', { className: 'dsrc-note' }, '其他网卡地址：', ...state.links.slice(1).map(link => h('span', { key: link.base }, ' ', h('button', { type: 'button', className: 'dsrc-button', onClick: () => { if (link.url) void copy(link.url) } }, link.base)))) : null,
    ),
    state?.local && state.requests.length ? h('section', { className: 'dsrc-surface' }, h('h3', null, '等待你确认'), ...state.requests.map(request => h('div', { className: 'dsrc-device dsrc-row', key: request.id }, h('div', null, h('div', { className: 'dsrc-device-name' }, request.name), h('div', { className: 'dsrc-muted' }, '允许后授予与本机相同的权限')), h('div', { className: 'dsrc-actions' }, button('拒绝', 'reject', { id: request.id }), button('允许连接', 'approve', { id: request.id }, 'dsrc-primary'))))) : null,
    h('section', { className: 'dsrc-surface' }, h('div', { className: 'dsrc-row' }, h('h3', null, '已授权设备'), state?.devices.length ? button('撤销全部', 'revokeAll', {}, 'dsrc-danger') : null),
      state?.devices.length ? state.devices.map(device => h('div', { className: 'dsrc-device dsrc-row', key: device.id }, h('div', null, h('div', { className: 'dsrc-device-name' }, device.name, device.online ? ' · 在线' : ''), h('div', { className: 'dsrc-muted' }, '最近使用 ', new Date(device.lastSeenAt).toLocaleString('zh-CN'))), button('撤销授权', 'revoke', { id: device.id }, 'dsrc-danger'))) : h('p', { className: 'dsrc-empty' }, '还没有配对设备。扫码并确认后，设备会出现在这里。'),
      h('p', { className: 'dsrc-note' }, '设备连续 30 天未使用后过期。关闭连接会保留授权；撤销授权会切断设备的现有连接。')),
    error || state?.error ? h('div', { className: 'dsrc-error', role: 'alert' }, error || state?.error) : null,
    notice ? h('p', { className: 'dsrc-note', role: 'status' }, notice) : null,
  )
}
function SidebarEntry(): React.ReactElement {
  const [open, setOpen] = React.useState(false), dialog = React.useRef<HTMLDialogElement>(null)
  React.useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close() }, [open])
  return h(React.Fragment, null,
    h('button', { type: 'button', className: 'dsrc-entry', title: '远程控制', 'aria-label': '远程控制', onClick: () => setOpen(true) }, icon()),
    h('dialog', { className: 'dsrc-dialog', ref: dialog, onCancel: () => setOpen(false), onClick: (event: React.MouseEvent<HTMLDialogElement>) => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) setOpen(false) } } },
      h('button', { type: 'button', className: 'dsrc-close', 'aria-label': '关闭远程控制面板', onClick: () => setOpen(false) }, '×'), open ? h(RemoteControlPanel) : null))
}
export const inject = ['slots', 'connection']
export function apply(ctx: ClientContext): void {
  ctx.effect(() => { const style = document.createElement('style'); style.dataset.dshRemoteControl = 'true'; style.textContent = CSS; document.head.append(style); return () => style.remove() }, 'remote-control styles')
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'copylee-remote-control', order: 65, label: () => '远程控制' }, () => h(RemoteControlPanel)))
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'copylee-remote-control', order: 65 }, () => h(SidebarEntry)))
}
