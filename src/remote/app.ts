import * as React from 'react'
import { Chat } from './chat.js'
import { Management } from './management.js'
import { useStore, useAction, value, cacheText, cachedText, Boundary, useBackClose, type Host } from './common.js'
import { Icon } from './icons.js'
import { Picker } from './picker.js'
import { command } from '../client/index.js'
import { ACCENTS, ACCENT_IDS, isAccent, type Accent } from '../accent.js'
import { DialogViewport, ask, confirmAction } from './dialog.js'
const h = React.createElement

export function App({ ctx }: { ctx: Host }): React.ReactElement {
  const sessions = useStore(ctx.sessions.list), workspaces = useStore(ctx.workspaces.list)
  const [sessionId, setSessionId] = React.useState<string>(), [workspaceId, setWorkspaceId] = React.useState('')
  const [page, setPage] = React.useState('chat'), [drawer, setDrawer] = React.useState(false), [query, setQuery] = React.useState('')
  const [archived, setArchived] = React.useState(false), [searchIds, setSearchIds] = React.useState<string[]>()
  const [theme, setTheme] = React.useState(() => cachedText('dsrc-theme') || 'system')
  // The colour is one setting for the whole plugin, kept by the Host; the cached copy only avoids a flash on load.
  const [accent, setAccent] = React.useState<Accent>(() => { const cached = cachedText('dsrc-accent'); return isAccent(cached) ? cached : 'orange' })
  React.useEffect(() => { document.documentElement.dataset.rcAccent = accent; cacheText('dsrc-accent', accent) }, [accent])
  React.useEffect(() => { void command({ action: 'status' }).then(status => { if (isAccent(status.accent)) setAccent(status.accent) }, () => {}) }, [])
  const chooseAccent = (next: Accent) => { setAccent(next); void command({ action: 'preferences', accent: next }).catch(() => {}) }
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
  // A lost connection is noticed here, not only when the next action fails: the gateway is asked
  // for a sign of life every few seconds while the page is in view.
  React.useEffect(() => {
    let failures = 0, live = true
    const probe = async () => {
      if (document.hidden) return
      try {
        const response = await fetch('/api/dsh-remote-control/manage', { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'requests' }) })
        if (!live) return
        if (response.ok) { failures = 0; setOffline(false); return }
        if (response.status === 403) return   // a revoked device gets its own full-page notice
        failures++
      } catch { failures++ }
      if (live && failures >= 2) setOffline(true)
    }
    const timer = setInterval(() => { void probe() }, 6000)
    const wake = () => { void probe() }
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake)
    return () => { live = false; clearInterval(timer); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake) }
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
    // The Host's theme service sets the same attribute from the computer's own setting; here the app's choice rules.
    const guard = new MutationObserver(() => { if (document.body.hasAttribute('data-ds-dark-theme') !== (document.documentElement.dataset.rcTheme === 'dark')) apply() })
    guard.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    return () => { media.removeEventListener('change', apply); guard.disconnect() }
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
  /** An untouched session has no title of its own yet (the Host labels it with the workspace's name). */
  const titleOf = (id: string | undefined) => { const row = sessions.byId?.[id || '']; return !row || row.blank ? '新会话' : row.displayTitle || row.title || '新会话' }
  const select = (id: string) => { setSessionId(id); setPage('chat'); setDrawer(false) }
  const create = () => {
    setDrawer(false)
    // An untouched new session is reused, as on the computer, instead of piling up another one.
    const unused = (sessions.ids ?? []).find((id: string) => sessions.byId[id]?.blank && !workspaces.archivedSessionIds?.includes(id) && (!workspace || workspace.sessionIds.includes(id)))
    if (unused) { setArchived(false); select(unused); return Promise.resolve() }
    return action.run(async () => { const id = await ctx.sessions.create(workspaceId ? { workspaceId } : {}); setArchived(false); select(id) }, '')
  }
  // Long press (or right click) on a session opens what can be done with it.
  const [menuFor, setMenuFor] = React.useState<string>()
  const press = React.useRef<{ timer?: ReturnType<typeof setTimeout>; fired: boolean }>({ fired: false })
  const hold = (id: string) => ({
    onPointerDown: () => { press.current.fired = false; clearTimeout(press.current.timer); press.current.timer = setTimeout(() => { press.current.fired = true; setMenuFor(id) }, 520) },
    onPointerUp: () => clearTimeout(press.current.timer), onPointerLeave: () => clearTimeout(press.current.timer), onPointerCancel: () => clearTimeout(press.current.timer),
    onContextMenu: (event: React.MouseEvent) => { event.preventDefault(); clearTimeout(press.current.timer); press.current.fired = true; setMenuFor(id) },
    onClick: () => { if (press.current.fired) { press.current.fired = false; return } select(id) },
  })
  const menuDialog = React.useRef<HTMLDialogElement>(null)
  React.useEffect(() => { const element = menuDialog.current; if (!element) return; if (menuFor && !element.open) element.showModal(); if (!menuFor && element.open) element.close() }, [menuFor])
  useBackClose(!!menuFor, () => setMenuFor(undefined))
  const menuArchived = !!menuFor && !!workspaces.archivedSessionIds?.includes(menuFor)
  const menuTitle = menuFor ? titleOf(menuFor) : ''
  const menuAct = (run: (id: string) => void) => () => { const id = menuFor; setMenuFor(undefined); if (id) run(id) }
  const selected = sessions.byId?.[sessionId || '']
  const selectedArchived = !!workspaces.archivedSessionIds?.includes(sessionId)
  const workspace = workspaces.items?.find((item: Host) => item.workspaceId === workspaceId)
  const ids = (sessions.ids ?? []).filter((id: string) => (!workspace || archived || workspace.sessionIds.includes(id)) && archived === !!workspaces.archivedSessionIds?.includes(id) && (!query || (searchIds?.includes(id) || (sessions.byId[id]?.displayTitle || '').toLowerCase().includes(query.toLowerCase()))))
  // Theme and accent colour, shown at the top of the settings page.
  const appearance = h('section', { className: 'rc-card rc-appearance' },
    h('h3', null, '外观'),
    h('div', { className: 'rc-sheet-row' }, '主题',
      h('div', { className: 'rc-segment', role: 'group', 'aria-label': '界面主题' },
        ...([['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']] as const).map(([id, name]) =>
          h('button', { key: id, 'aria-pressed': theme === id, onClick: () => setTheme(id) }, name)))),
    h('div', { className: 'rc-sheet-row' }, '强调色',
      h('div', { className: 'rc-swatches', role: 'radiogroup', 'aria-label': '强调色' },
        ...ACCENT_IDS.map(id =>
          h('button', { key: id, className: 'rc-swatch', role: 'radio', 'aria-checked': accent === id, 'aria-label': ACCENTS[id].name, title: ACCENTS[id].name, 'data-accent': id, onClick: () => chooseAccent(id) })))))
  useBackClose(page !== 'chat', () => setPage('chat'))
  useBackClose(drawer, () => setDrawer(false))
  const go = (next: string, section = '') => { setPage(next); setStart(section); setDrawer(false) }
  const title = page === 'chat' ? titleOf(sessionId)
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
    (workspaces.items ?? []).length ? h(Picker, { className: 'rc-workspace', label: '工作区', value: workspaceId, onChange: setWorkspaceId, more: { label: '添加或管理工作区', onSelect: () => go('settings', 'workspaces') },
      choices: (workspaces.items ?? []).map((w: any) => ({ value: w.workspaceId, label: w.title || w.path })) }) : null,
    h('hr', { className: 'rc-divider' }),
    h('div', { className: 'rc-session-list' },
      ...ids.map((id: string) => h('button', { key: id, className: 'rc-session', 'aria-current': sessionId === id && page === 'chat', ...hold(id) },
        sessions.byId[id]?.running ? h('span', { className: 'rc-running', 'aria-label': '执行中' }) : null,
        titleOf(id))),
      ids.length ? null : h('p', { className: 'rc-muted rc-empty' }, archived ? '没有归档会话' : query ? '没有匹配的会话' : '还没有会话')),
    h('div', { className: 'rc-sidebar-footer' },
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

  const sessionMenu = h('dialog', { ref: menuDialog, className: 'rc-picker-sheet', 'aria-label': '会话操作', onCancel: () => setMenuFor(undefined), onClick: (event: React.MouseEvent) => { if (event.target === event.currentTarget) setMenuFor(undefined) } },
    menuFor ? h('div', { className: 'rc-picker-body' },
      h('div', { className: 'rc-picker-title' }, menuTitle),
      h('button', { className: 'rc-picker-option', onClick: menuAct(async id => { const next = await ask('会话名称', sessions.byId?.[id]?.displayTitle || ''); if (next?.trim()) void action.run(() => ctx.remote.session.rename({ sessionId: id, title: next.trim() }), '') }) }, '重命名'),
      h('button', { className: 'rc-picker-option', onClick: menuAct(id => { void action.run(() => menuArchived ? ctx.workspaces.unarchiveSession(id) : ctx.workspaces.archiveSession(id), '') }) }, menuArchived ? '恢复到会话列表' : '归档'),
      h('button', { className: 'rc-picker-option', onClick: menuAct(id => { void action.run(async () => { const child = await ctx.sessions.fork({ sessionId: id }); select(child) }, '') }) }, '创建分支'),
      h('p', { className: 'rc-muted rc-menu-note' }, '宿主没有提供删除会话的接口；不想再看到的会话可以归档。')) : null)

  return h('div', { className: 'rc-app' },
    h(DialogViewport), sessionMenu,
    h('button', { className: `rc-backdrop ${drawer ? 'open' : ''}`, 'aria-label': '关闭会话列表', onClick: () => setDrawer(false) }),
    sidebar,
    h('main', { className: 'rc-main' },
      header,
      action.error ? h('div', { className: 'rc-error rc-banner', role: 'alert' }, action.error, h('button', { className: 'rc-text', 'aria-label': '关闭提示', onClick: () => action.setError('') }, '×')) : null,
      offline ? h('div', { className: 'rc-offline rc-banner', role: 'alert' },
        h('span', null, h('strong', null, '和电脑的连接断开了。'), location.hostname.endsWith('.trycloudflare.com')
          ? '电脑上的远程连接可能已关闭或重新开启；重新开启后地址会变，需要在电脑上重新扫码。'
          : '请确认手机和电脑在同一个 Wi‑Fi，并且电脑上的远程连接还开着。恢复后会自动重连。'),
        h('button', { className: 'rc-text', onClick: () => location.reload() }, '重试')) : null,
      page === 'chat'
        ? action.busy ? h('div', { className: 'rc-skeleton' }, '正在创建会话…')
          : sessionId ? h(Boundary, { key: sessionId, what: '这个会话' }, h(Chat, { ctx, sessionId, onSession: select }))
            : h('div', { className: 'rc-scroll rc-welcome' }, h('h1', null, '今天，我们继续做什么？'), h('p', null, '创建会话，接着在电脑上的工作。'))
        : page === 'session' ? sessionActions
          : h(Boundary, { key: `${page}:${start}`, what: '这个页面' }, h(Management, { ctx, page, start, sessionId, onSession: select, appearance }))))
}
