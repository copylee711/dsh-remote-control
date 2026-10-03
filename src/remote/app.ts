import * as React from 'react'
import { Chat } from './chat.js'
import { Management } from './management.js'
import { useStore, useAction, value, cacheText, cachedText, type Host } from './common.js'
import { Icon } from './icons.js'
import { DialogViewport, ask, confirmAction } from './dialog.js'
const h = React.createElement

export function App({ ctx }: { ctx: Host }): React.ReactElement {
  const sessions = useStore(ctx.sessions.list), workspaces = useStore(ctx.workspaces.list)
  const [sessionId, setSessionId] = React.useState<string>(), [workspaceId, setWorkspaceId] = React.useState('')
  const [page, setPage] = React.useState('chat'), [drawer, setDrawer] = React.useState(false), [query, setQuery] = React.useState('')
  const [archived, setArchived] = React.useState(false), [searchIds, setSearchIds] = React.useState<string[]>()
  const [theme, setTheme] = React.useState(() => cachedText('dsrc-theme') || 'system')
  const action = useAction()
  const [offline, setOffline] = React.useState(!navigator.onLine)
  React.useEffect(() => {
    const lost = () => setOffline(true), restored = () => setOffline(false)
    window.addEventListener('offline', lost); window.addEventListener('dsh-rc-offline', lost)
    window.addEventListener('online', restored); window.addEventListener('dsh-rc-online', restored)
    return () => { window.removeEventListener('offline', lost); window.removeEventListener('dsh-rc-offline', lost); window.removeEventListener('online', restored); window.removeEventListener('dsh-rc-online', restored) }
  }, [])
  React.useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { document.documentElement.dataset.rcTheme = theme === 'system' ? media.matches ? 'dark' : 'light' : theme }
    apply(); cacheText('dsrc-theme', theme); media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  React.useEffect(() => {
    const update = () => document.documentElement.style.setProperty('--rc-height', `${window.visualViewport?.height ?? window.innerHeight}px`)
    update(); window.visualViewport?.addEventListener('resize', update); window.addEventListener('resize', update)
    const resume = () => { if (!document.hidden) void ctx.sessions.refresh().catch(() => {}) }
    window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume)
    return () => { window.visualViewport?.removeEventListener('resize', update); window.removeEventListener('resize', update); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume) }
  }, [ctx])
  React.useEffect(() => {
    if (!workspaceId && workspaces.items?.[0]) setWorkspaceId(workspaces.items[0].workspaceId)
    if (!sessionId && sessions.ids?.[0]) setSessionId(sessions.ids[0])
  }, [sessions, workspaces, sessionId, workspaceId])
  React.useEffect(() => {
    if (!query.trim()) { setSearchIds(undefined); return }
    const controller = new AbortController()
    const timer = setTimeout(() => { void ctx.sessions.search(query, controller.signal).then((result: any) => { if (!controller.signal.aborted) setSearchIds(value(result).items.map((s: any) => s.sessionId ?? s.id)) }, () => {}) }, 350)
    return () => { clearTimeout(timer); controller.abort() }
  }, [ctx, query])
  const select = (id: string) => { setSessionId(id); setPage('chat'); setDrawer(false) }
  const create = () => { setDrawer(false); return action.run(async () => { const id = await ctx.sessions.create(workspaceId ? { workspaceId } : {}); setArchived(false); select(id) }, '新会话已创建') }
  const selected = sessions.byId?.[sessionId || '']
  const selectedArchived = !!workspaces.archivedSessionIds?.includes(sessionId)
  const workspace = workspaces.items?.find((item: Host) => item.workspaceId === workspaceId)
  const ids = (sessions.ids ?? []).filter((id: string) => (!workspace || archived || workspace.sessionIds.includes(id)) && archived === !!workspaces.archivedSessionIds?.includes(id) && (!query || (searchIds?.includes(id) || (sessions.byId[id]?.displayTitle || '').toLowerCase().includes(query.toLowerCase()))))
  return h('div', { className: 'rc-app' },
    h(DialogViewport),
    h('button', { className: `rc-backdrop ${drawer ? 'open' : ''}`, 'aria-label': '关闭会话列表', onClick: async () => setDrawer(false) }),
    h('aside', { className: `rc-sidebar ${drawer ? 'open' : ''}` },
      h('div', { className: 'rc-brand' }, 'DSH · 远程', h('button', { className: 'rc-icon rc-drawer-close', onClick: async () => setDrawer(false), 'aria-label': '关闭导航' }, h(Icon, { name: 'close' }))),
      h('button', { className: 'rc-primary', disabled: action.busy, onClick: async () => { void create() } }, '新会话'),
      h('select', { 'aria-label': '工作区', value: workspaceId, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setWorkspaceId(e.target.value) }, ...(workspaces.items ?? []).map((w: any) => h('option', { key: w.workspaceId, value: w.workspaceId }, w.title || w.path))),
      h('input', { 'aria-label': '搜索会话', placeholder: '搜索会话与消息', value: query, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value) }),
      h('div', { className: 'rc-session-list' }, ...ids.map((id: string) => h('button', { key: id, className: 'rc-session', 'aria-current': sessionId === id && page === 'chat', onClick: async () => select(id) }, sessions.byId[id]?.running ? '◌ ' : '', sessions.byId[id]?.displayTitle || sessions.byId[id]?.title || '新会话')), ids.length ? null : h('p', { className: 'rc-muted' }, archived ? '没有归档会话' : '没有匹配的会话')),
      h('div', { className: 'rc-sidebar-footer' },
        h('button', { onClick: async () => setArchived(!archived) }, archived ? '返回最近会话' : '归档会话'),
        h('button', { onClick: async () => { setPage('files'); setDrawer(false) } }, '文件与交付物'),
        h('button', { onClick: async () => { setPage('settings'); setDrawer(false) } }, '设置与管理'),
        h('select', { 'aria-label': '界面主题', value: theme, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setTheme(e.target.value) }, h('option', { value: 'system' }, '跟随系统'), h('option', { value: 'light' }, '浅色'), h('option', { value: 'dark' }, '深色')))),
    h('main', { className: 'rc-main' },
      h('header', { className: 'rc-header' }, h('button', { className: 'rc-icon rc-mobile', 'aria-label': '打开会话列表', onClick: async () => setDrawer(true) }, h(Icon, { name: 'menu' })), h('span', { className: 'rc-header-title' }, page === 'chat' ? selected?.displayTitle || '新会话' : page === 'files' ? '文件与交付物' : '设置与管理'), page !== 'chat' ? h('button', { onClick: async () => setPage('chat') }, '返回会话') : h('button', { className: 'rc-icon', 'aria-label': '会话操作', onClick: async () => setPage('session') }, h(Icon, { name: 'more' }))),
      action.error ? h('div', { className: 'rc-error', role: 'alert' }, action.error) : null,
      offline ? h('div', { className: 'rc-notice', role: 'status' }, '连接中断，正在等待网络恢复。未完成的发送与管理操作不会自动重放。', h('button', { onClick: () => location.reload() }, '重新连接')) : null,
      page === 'chat' ? action.busy ? h('div', { className: 'rc-skeleton' }, '正在创建会话…') : sessionId ? h(Chat, { key: sessionId, ctx, sessionId, onSession: select }) : h('div', { className: 'rc-scroll rc-welcome' }, h('h1', null, '今天，我们继续做什么？'), h('p', null, '创建会话，接着在电脑上的工作。')) :
      page === 'session' ? h('div', { className: 'rc-scroll' }, h('div', { className: 'rc-content rc-stack' }, h('h2', null, '会话操作'), h('button', { onClick: async () => { const title = await ask('会话名称', selected?.displayTitle || ''); if (title?.trim()) void action.run(() => ctx.remote.session.rename({ sessionId, title: title.trim() }), '会话已重命名') } }, '重命名'), h('button', { onClick: async () => { void action.run(() => selectedArchived ? ctx.workspaces.unarchiveSession(sessionId) : ctx.workspaces.archiveSession(sessionId), selectedArchived ? '已恢复' : '已归档') } }, selectedArchived ? '恢复会话' : '归档会话'), h('button', { onClick: async () => { void action.run(async () => { const id = await ctx.sessions.fork({ sessionId }); select(id) }, '已创建分支会话') } }, '创建分支'), h('button', { onClick: async () => setPage('chat') }, '返回会话'), action.notice ? h('p', { role: 'status' }, action.notice) : null)) :
      h(Management, { ctx, page, sessionId, onSession: select })))
}


