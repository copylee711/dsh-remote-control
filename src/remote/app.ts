import * as React from 'react'
import { Chat } from './chat.js'
import { Management } from './management.js'
import { useStore, useAction, value, cacheText, cachedText, Boundary, type Host } from './common.js'
import { Icon } from './icons.js'
import { DialogViewport, ask, confirmAction } from './dialog.js'
const h = React.createElement

export function App({ ctx }: { ctx: Host }): React.ReactElement {
  const sessions = useStore(ctx.sessions.list), workspaces = useStore(ctx.workspaces.list)
  const [sessionId, setSessionId] = React.useState<string>(), [workspaceId, setWorkspaceId] = React.useState('')
  const [page, setPage] = React.useState('chat'), [drawer, setDrawer] = React.useState(false), [query, setQuery] = React.useState('')
  const [archived, setArchived] = React.useState(false), [searchIds, setSearchIds] = React.useState<string[]>()
  const [theme, setTheme] = React.useState(() => cachedText('dsrc-theme') || 'system')
  const [accent, setAccent] = React.useState(() => cachedText('dsrc-accent') || 'orange')
  React.useEffect(() => { document.documentElement.dataset.rcAccent = accent; cacheText('dsrc-accent', accent) }, [accent])
  /** The settings section a drawer shortcut opens directly ('' = the category list). */
  const [start, setStart] = React.useState(''), [searching, setSearching] = React.useState(false)
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
    const apply = () => {
      const dark = theme === 'system' ? media.matches : theme === 'dark'
      document.documentElement.dataset.rcTheme = dark ? 'dark' : 'light'
      // The Host's own components (Markdown, code highlighting) read this attribute.
      document.body.toggleAttribute('data-ds-dark-theme', dark)
    }
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
    // Open the first session of the list as it is shown, not an archived one or one from another workspace.
    if (!sessionId && ids[0]) setSessionId(ids[0])
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
  const go = (next: string, section = '') => { setPage(next); setStart(section); setDrawer(false) }
  const title = page === 'chat' ? selected?.displayTitle || selected?.title || '新会话'
    : page === 'files' ? '文件与交付物'
    : page === 'session' ? '会话操作'
    : start === 'automation' ? '定时任务' : start === 'plugins' ? '插件' : '设置与管理'
  const nav = (icon: string, text: string, onClick: () => void, current = false) =>
    h('button', { className: 'rc-nav', 'aria-current': current || undefined, onClick }, h(Icon, { name: icon }), h('span', null, text))
  const round = (icon: string, name: string, onClick: () => void, extra: Record<string, unknown> = {}) =>
    h('button', { className: 'rc-round', 'aria-label': name, title: name, onClick, ...extra }, h(Icon, { name: icon }))

  const sidebar = h('aside', { className: `rc-sidebar ${drawer ? 'open' : ''}` },
    h('div', { className: 'rc-brand' },
      h('span', null, 'DSH'),
      h('div', { className: 'rc-brand-actions' },
        round('search', '搜索会话', () => { setSearching(!searching); if (searching) setQuery('') }, { 'aria-pressed': searching }),
        round('close', '关闭导航', () => setDrawer(false), { className: 'rc-round rc-drawer-close' }))),
    searching ? h('input', { className: 'rc-search', 'aria-label': '搜索会话', placeholder: '搜索会话与消息', autoFocus: true, value: query, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value) }) : null,
    h('nav', { className: 'rc-navs' },
      nav('folder', '文件与交付物', () => go('files'), page === 'files'),
      nav('clock', '定时任务', () => go('settings', 'automation'), page === 'settings' && start === 'automation'),
      nav('plug', '插件', () => go('settings', 'plugins'), page === 'settings' && start === 'plugins'),
      nav('archive', archived ? '返回最近会话' : '已归档会话', () => setArchived(!archived), archived)),
    (workspaces.items ?? []).length > 1 ? h('select', { className: 'rc-workspace', 'aria-label': '工作区', value: workspaceId, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setWorkspaceId(e.target.value) },
      ...(workspaces.items ?? []).map((w: any) => h('option', { key: w.workspaceId, value: w.workspaceId }, w.title || w.path))) : null,
    h('hr', { className: 'rc-divider' }),
    h('div', { className: 'rc-session-list' },
      ...ids.map((id: string) => h('button', { key: id, className: 'rc-session', 'aria-current': sessionId === id && page === 'chat', onClick: () => select(id) },
        sessions.byId[id]?.running ? h('span', { className: 'rc-running', 'aria-label': '执行中' }) : null,
        sessions.byId[id]?.displayTitle || sessions.byId[id]?.title || '新会话')),
      ids.length ? null : h('p', { className: 'rc-muted rc-empty' }, archived ? '没有归档会话' : query ? '没有匹配的会话' : '还没有会话')),
    h('div', { className: 'rc-sidebar-footer' },
      h('div', { className: 'rc-look' },
        h('select', { className: 'rc-theme', 'aria-label': '界面主题', value: theme, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setTheme(e.target.value) },
          h('option', { value: 'system' }, '跟随系统'), h('option', { value: 'light' }, '浅色'), h('option', { value: 'dark' }, '深色')),
        h('div', { className: 'rc-swatches', role: 'radiogroup', 'aria-label': '强调色' },
          ...([['orange', '陶土橙'], ['blue', '蓝色'], ['black', '黑色']] as const).map(([id, name]) =>
            h('button', { key: id, className: 'rc-swatch', role: 'radio', 'aria-checked': accent === id, 'aria-label': name, title: name, 'data-accent': id, onClick: () => setAccent(id) })))),
      h('div', { className: 'rc-row' },
        h('button', { className: 'rc-primary rc-new', disabled: action.busy, onClick: () => { void create() } }, h(Icon, { name: 'compose' }), '新会话'),
        round('settings', '设置与管理', () => go('settings')))))

  const header = h('header', { className: 'rc-header' },
    round('menu', '打开会话列表', () => setDrawer(true), { className: 'rc-round rc-mobile' }),
    h('span', { className: 'rc-header-title' }, title),
    page === 'chat'
      ? h(React.Fragment, null,
        round('more', '会话操作', () => setPage('session'), { disabled: !sessionId }),
        round('compose', '开始新会话', () => { void create() }, { disabled: action.busy }))
      : h('button', { className: 'rc-pill', onClick: () => setPage('chat') }, '返回会话'))

  const sessionActions = h('div', { className: 'rc-scroll' }, h('div', { className: 'rc-content' },
    h('section', { className: 'rc-list' },
      h('button', { className: 'rc-menu-row', onClick: async () => { const next = await ask('会话名称', selected?.displayTitle || ''); if (next?.trim()) void action.run(() => ctx.remote.session.rename({ sessionId, title: next.trim() }), '会话已重命名') } }, '重命名'),
      h('button', { className: 'rc-menu-row', onClick: () => { void action.run(() => selectedArchived ? ctx.workspaces.unarchiveSession(sessionId) : ctx.workspaces.archiveSession(sessionId), selectedArchived ? '已恢复' : '已归档') } }, selectedArchived ? '恢复会话' : '归档会话'),
      h('button', { className: 'rc-menu-row', onClick: () => { void action.run(async () => { const id = await ctx.sessions.fork({ sessionId }); select(id) }, '已创建分支会话') } }, '创建分支')),
    action.notice ? h('p', { className: 'rc-notice', role: 'status' }, action.notice) : null))

  return h('div', { className: 'rc-app' },
    h(DialogViewport),
    h('button', { className: `rc-backdrop ${drawer ? 'open' : ''}`, 'aria-label': '关闭会话列表', onClick: () => setDrawer(false) }),
    sidebar,
    h('main', { className: 'rc-main' },
      header,
      action.error ? h('div', { className: 'rc-error rc-banner', role: 'alert' }, action.error, h('button', { className: 'rc-text', 'aria-label': '关闭提示', onClick: () => action.setError('') }, '×')) : null,
      offline ? h('div', { className: 'rc-notice rc-banner', role: 'status' }, '连接中断，正在等待网络恢复。未完成的发送与管理操作不会自动重放。', h('button', { className: 'rc-text', onClick: () => location.reload() }, '重新连接')) : null,
      page === 'chat'
        ? action.busy ? h('div', { className: 'rc-skeleton' }, '正在创建会话…')
          : sessionId ? h(Boundary, { key: sessionId, what: '这个会话' }, h(Chat, { ctx, sessionId, onSession: select }))
            : h('div', { className: 'rc-scroll rc-welcome' }, h('h1', null, '今天，我们继续做什么？'), h('p', null, '创建会话，接着在电脑上的工作。'))
        : page === 'session' ? sessionActions
          : h(Boundary, { key: `${page}:${start}`, what: '这个页面' }, h(Management, { ctx, page, start, sessionId, onSession: select }))))
}
