import { ask, confirmAction } from './dialog.js'
import * as React from 'react'
import { RemoteControlPanel, command } from '../client/index.js'
import { useLoad, useAction, useStore, value, label, Boundary, type Host } from './common.js'
import { Files } from './files.js'
import { Picker } from './picker.js'
import { PluginPage } from './compatibility.js'
import { fields, namespaces } from './labels.js'
const h = React.createElement
const KEEP_VALUE = Symbol('leave-secret-unchanged')
const categories: Array<[string, string, RegExp]> = [
  ['general', '通用设置', /^(ui-theme|locale|ui-settings-general|ui-chat|ui-conversation|permission)$/],
  ['models', '模型与凭据', /^(llm|agent-default-model|subagent-model)/],
  ['agents', 'Agent 配置', /^(agent-preset|agent-loop|subagent$)/],
  ['skills', '技能', /skill/], ['cost', '费用', /cost|usage|billing/],
  ['automation', '自动化', /automation|cron|schedule/], ['advanced', '其他宿主功能', /./],
]
/** A namespace belongs to the first category that claims it; the last one takes what is left. */
const categoryOf = (ns: string) => categories.find(([, , pattern]) => pattern.test(ns))?.[0]
const SELF = '@copylee/dsh-remote-control'
const builtIn = new Set(['general', 'models', 'plugins', 'agent-presets', 'skills', 'cost', 'archive', 'schedule', 'copylee-remote-control'])
export function Management({ ctx, page, start = '', sessionId, onSession, appearance }: { ctx: Host; page: string; start?: string; sessionId?: string; onSession: (id: string) => void; appearance?: React.ReactNode }) {
  const [section, setSection] = React.useState(start)
  const description = useLoad<Host>(() => ctx.remote.settings.describe().then(value), [ctx])
  const revision = React.useSyncExternalStore((cb: () => void) => ctx.slots.subscribe('settings.section', cb), () => ctx.slots.getVersion('settings.section'))
  const compatible = React.useMemo(() => ctx.slots.entriesOfSlot('settings.section').filter((entry: Host) => !builtIn.has(entry.options.id)), [ctx, revision])
  const selected = compatible.find((entry: Host) => `compat:${entry.options.id}` === section)
  if (page === 'files') return h(Files, { ctx, sessionId })
  return h('div', { className: 'rc-scroll' }, h('div', { className: 'rc-content' },
    section ? h('button', { onClick: async () => setSection(''), className: 'rc-pill rc-small' }, '‹ 返回设置分类') : null,
    description.error ? h('div', { className: 'rc-error' }, description.error, h('button', { onClick: description.reload }, '重试')) : null,
    !section ? h(React.Fragment, null, appearance, h('p', { className: 'rc-muted' }, '以下修改作用于正在连接的电脑。'), h('section', { className: 'rc-list' },
      ...categories.map(([id, title]) => h('button', { key: id, className: 'rc-menu-row', onClick: async () => setSection(id) }, title, h('span', null, '›'))),
      h('button', { className: 'rc-menu-row', onClick: async () => setSection('plugins') }, '插件与安装任务', h('span', null, '›')),
      h('button', { className: 'rc-menu-row', onClick: async () => setSection('remote') }, '远程连接与设备', h('span', null, '›')),
      h('button', { className: 'rc-menu-row', onClick: async () => setSection('workspaces') }, '工作区', h('span', null, '›')),
      ...compatible.map((entry: Host) => h('button', { key: entry.options.id, className: 'rc-menu-row', onClick: async () => setSection(`compat:${entry.options.id}`) }, label(entry.options.label, entry.options.id), h('span', { className: 'rc-muted' }, '插件页面 ›'))))) :
    section === 'remote' ? h(RemoteControlPanel) : section === 'plugins' ? h(Plugins, { ctx }) : section === 'workspaces' ? h(Workspaces, { ctx }) : selected ? h(Compatibility, { key: section, entry: selected, ctx }) :
    h(React.Fragment, null, h('h2', { style: { marginTop: 20 } }, categories.find(([id]) => id === section)?.[1]),
      section === 'models' ? h(Credentials, { ctx }) : null,
      section === 'skills' ? h(Skills, { ctx, sessionId }) : null,
      section === 'automation' ? h(Automations, { ctx, sessionId }) : null,
      section === 'cost' ? h(Cost, { ctx, sessionId }) : null,
      section === 'advanced' ? h('p', { className: 'rc-notice' }, '这里列出宿主公开的其他配置。原生窗口、账户浏览器登录和电脑音频设备等操作需要在电脑上完成；未公开远程接口的能力不会显示操作按钮。') : null,
      ...(description.data?.namespaces ?? []).filter((ns: Host) => categoryOf(ns.ns) === section).map((ns: Host) => h(NamespaceForm, { key: `${ns.ns}:${ns.revision}`, ctx, namespace: ns, writable: description.data?.writable, onSaved: description.reload })),
      !description.data ? h('p', { className: 'rc-muted' }, '正在读取设置…') : null,
      description.data && !(description.data.namespaces ?? []).some((ns: Host) => categoryOf(ns.ns) === section) ? h('p', { className: 'rc-notice' }, '此宿主没有公开该分类的配置描述；可用能力在上方单独列出。') : null)))
}
function schemaOf(namespace: Host, ref: Host): Host { return typeof ref === 'number' ? namespace.schema.refs[ref] : ref }
function fieldLabel(schema: Host, key: string): string { return label(schema.meta?.i18n?.['zh-CN']?.$label ?? schema.meta?.label, fields[key] ?? key) }
function SchemaField({ namespace, refId, path, current, change }: { namespace: Host; refId: Host; path: string[]; current: Host; change: (path: string[], v: Host) => void }): React.ReactElement {
  const schema = schemaOf(namespace, refId) || {}, name = fieldLabel(schema, path.at(-1) || namespace.ns)
  const description = label(schema.meta?.i18n?.['zh-CN']?.$description ?? schema.meta?.description)
  if (schema.type === 'object' && schema.dict) return h('div', { className: path.length ? 'rc-card' : 'rc-stack' }, path.length ? h('h3', null, name) : null, ...Object.entries(schema.dict).map(([key, id]) => h(SchemaField, { key, namespace, refId: id, path: [...path, key], current: current?.[key], change })))
  if (!path.length) return h('p', { className: 'rc-muted' }, '该配置描述没有可编辑字段。')
  // Host-redacted secrets are never prefilled or persisted by this browser.
  const secret = schema.meta?.secret || schema.meta?.role === 'secret' || namespace.secrets?.some((item: Host) => JSON.stringify(item.path ?? item) === JSON.stringify(path))
  const props = { 'aria-label': name, disabled: schema.meta?.disabled === true }
  let input: React.ReactNode
  if (schema.type === 'boolean') input = h('input', { ...props, type: 'checkbox', checked: !!current, onChange: (e: React.ChangeEvent<HTMLInputElement>) => change(path, e.target.checked) })
  else if (schema.type === 'union' && schema.list?.every((r: Host) => schemaOf(namespace, r)?.type === 'const')) {
    const options = schema.list.map((r: Host) => schemaOf(namespace, r))
    input = h(Picker, { label: name, value: String(current ?? ''), disabled: props.disabled, placeholder: current === undefined || current === '' ? '未设置' : String(current),
      choices: options.map((s: Host) => ({ value: String(s.value), label: fieldLabel(s, String(s.value)) })),
      onChange: (next: string) => change(path, options.find((s: Host) => String(s.value) === next)?.value) })
  }
  else if (schema.type === 'number' || schema.type === 'natural' || schema.type === 'integer') input = h('input', { ...props, type: 'number', value: current ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement>) => change(path, e.target.value === '' ? undefined : Number(e.target.value)) })
  else if (schema.type === 'string') input = secret ? h(SecretField, { name, onChange: (v: string) => change(path, v || KEEP_VALUE) }) : h('input', { ...props, type: 'text', autoComplete: 'off', value: current ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement>) => change(path, e.target.value) })
  else input = h(JsonField, { name, current, onChange: (v: Host) => change(path, v) })
  return h(schema.type === 'union' ? 'div' : 'label', { className: 'rc-label' }, h('span', null, name), input, description ? h('span', { className: 'rc-muted' }, description) : null)
}
function SecretField({ name, onChange }: { name: string; onChange: (v: string) => void }) {
  const [text, setText] = React.useState('')
  return h('input', { 'aria-label': name, type: 'password', autoComplete: 'new-password', value: text, placeholder: '输入新值以更新，留空不改', onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setText(e.target.value); onChange(e.target.value) } })
}
function JsonField({ name, current, onChange }: { name: string; current: Host; onChange: (v: Host) => void }) {
  const [text, setText] = React.useState(() => JSON.stringify(current ?? null, null, 2)), [invalid, setInvalid] = React.useState(false)
  return h(React.Fragment, null, h('textarea', { 'aria-label': name, rows: 4, value: text, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => { setText(e.target.value); try { onChange(JSON.parse(e.target.value)); setInvalid(false); e.target.setCustomValidity('') } catch { setInvalid(true); e.target.setCustomValidity('请输入有效 JSON') } } }), invalid ? h('span', { className: 'rc-danger' }, '请输入有效 JSON；无效草稿不能保存。') : null)
}
function NamespaceForm({ ctx, namespace, writable, onSaved }: { ctx: Host; namespace: Host; writable: boolean; onSaved: () => void }) {
  const [draft, setDraft] = React.useState<Host>(() => structuredClone(namespace.value)), [changes, setChanges] = React.useState<Record<string, Host>>({})
  const action = useAction()
  const change = (path: string[], v: Host) => { if (v === KEEP_VALUE) { setChanges(previous => { const next = { ...previous }; delete next[JSON.stringify(path)]; return next }); return }; setChanges(previous => ({ ...previous, [JSON.stringify(path)]: v })); setDraft((previous: Host) => { const next = structuredClone(previous ?? {}); let owner = next; path.slice(0, -1).forEach(key => { owner[key] ??= {}; owner = owner[key] }); owner[path.at(-1)!] = v; return next }) }
  return h('section', { className: 'rc-card', 'data-namespace': namespace.ns }, h('h3', null, namespaces[namespace.ns] ?? namespace.ns), h(SchemaField, { namespace, refId: namespace.schema?.uid, path: [], current: draft, change }),
    h('div', { className: 'rc-actions' }, h('button', { className: 'rc-primary', disabled: !writable || action.busy || !Object.keys(changes).length, onClick: async (event: React.MouseEvent<HTMLButtonElement>) => { const invalid = event.currentTarget.closest('section')?.querySelector<HTMLTextAreaElement>(':invalid'); if (invalid) { invalid.reportValidity(); action.setError('请输入有效 JSON 后再保存'); return }; void action.run(async () => { const ops = Object.entries(changes).map(([path, v]) => v === undefined ? { op: 'unset', path: JSON.parse(path) } : { op: 'set', path: JSON.parse(path), value: v }); const result = value(await ctx.remote.settings.mutate(namespace.ns, ops, namespace.revision)); onSaved(); return result }, namespace.applies === 'restart' ? '已保存，宿主需要重启后生效' : '已保存') } }, '保存'), namespace.applies === 'restart' ? h('span', { className: 'rc-muted' }, '修改需要宿主重启') : null), action.error ? h('p', { className: 'rc-error', role: 'alert' }, action.error, '。如配置已被其他设备修改，请返回分类重新读取后再编辑。') : null, action.notice ? h('p', { role: 'status' }, action.notice) : null)
}
function Credentials({ ctx }: { ctx: Host }) {
  const [ref, setRef] = React.useState(''), [secret, setSecret] = React.useState(''), action = useAction()
  return h('section', { className: 'rc-card' }, h('h3', null, '凭据管理'), h('p', { className: 'rc-muted' }, '凭据只写入电脑的凭据存储；当前页面不会显示已有密钥。'), h('label', { className: 'rc-label' }, '凭据引用', h('input', { value: ref, autoComplete: 'off', placeholder: '例如 DEEPSEEK_API_KEY', onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRef(e.target.value) })), h('label', { className: 'rc-label' }, '新密钥', h('input', { type: 'password', autoComplete: 'new-password', value: secret, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSecret(e.target.value) })), h('div', { className: 'rc-actions' }, h('button', { className: 'rc-primary', disabled: action.busy || !ref.trim() || !secret, onClick: async () => { void action.run(async () => { if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref.trim())) throw new Error('凭据引用只能使用英文字母、数字和下划线，且不能以数字开头'); const result = value(await ctx.remote.credentials.set(ref.trim(), secret)); setSecret(''); return result }, '凭据已保存') } }, '保存凭据'), h('button', { className: 'rc-danger', disabled: action.busy || !ref.trim(), onClick: async () => { if (await confirmAction(`删除电脑上的凭据 ${ref}？`)) void action.run(() => ctx.remote.credentials.unset(ref.trim()), '凭据已删除') } }, '删除凭据')), action.error ? h('p', { className: 'rc-error' }, action.error) : null, action.notice ? h('p', { role: 'status' }, action.notice) : null)
}
function Plugins({ ctx }: { ctx: Host }) {
  const bundles = useLoad<Host>(() => ctx.remote.pluginManager.listBundles().then(value), [ctx]), action = useAction(), [spec, setSpec] = React.useState(''), [log, setLog] = React.useState(''), [requestId, setRequestId] = React.useState('')
  React.useEffect(() => { const saved = sessionStorage.getItem('dsrc-install-request'); if (!saved) return; setRequestId(saved); void action.run(async () => { try { const result = value(await ctx.remote.pluginManager.waitForInstall(saved)); if (result?.error) throw new Error(result.error.diagnostic || '安装失败'); bundles.reload(); return result } finally { sessionStorage.removeItem('dsrc-install-request'); setRequestId('') } }, '安装任务状态已重新读取') }, [ctx])
  React.useEffect(() => ctx.remote.$on('plugin-manager/install-log', (chunk: Host) => { setLog(previous => (previous + chunk.text).slice(-30000)) }), [ctx])
  return h(React.Fragment, null, h('h2', { style: { marginTop: 20 } }, '插件与安装任务'), h('section', { className: 'rc-card' }, h('label', { className: 'rc-label' }, '安装插件', h('input', { placeholder: '@scope/package 或安装地址', value: spec, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSpec(e.target.value) })), h('button', { className: 'rc-primary', disabled: action.busy || !spec.trim(), onClick: async () => { void action.run(async () => { const inspection = value(await ctx.remote.pluginManager.inspect(spec.trim(), {})); if (inspection.status === 'refused') throw new Error(inspection.reason); if (!await confirmAction(`在电脑上安装并启用 ${inspection.name || spec}？`)) return; const id = crypto.randomUUID(); setRequestId(id); sessionStorage.setItem('dsrc-install-request', id); setLog(''); const result = value(await ctx.remote.pluginManager.installBundle(spec.trim(), { requestId: id })); bundles.reload(); setRequestId(''); sessionStorage.removeItem('dsrc-install-request'); if (result.application === 'failed' || result.error) throw new Error(result.packageResult?.output || result.error?.diagnostic || '安装失败'); action.setNotice('安装任务已完成'); return result }, '') } }, action.busy ? '正在执行…' : '检查并安装'), requestId ? h('button', { onClick: async () => { void ctx.remote.pluginManager.cancelInstall(requestId).then(value).catch((e: Error) => action.setError(e.message)) } }, '取消安装') : null, log ? h('pre', { 'aria-label': '安装日志' }, log) : null),
    action.error || bundles.error ? h('p', { className: 'rc-error' }, action.error || bundles.error) : null, action.notice ? h('p', { className: 'rc-notice', role: 'status' }, action.notice) : null,
    ...(bundles.data ?? []).map((bundle: Host) => h('section', { key: bundle.name, className: 'rc-card' }, h('h3', null, label(bundle.meta?.title, bundle.name)), h('p', { className: 'rc-muted' }, bundle.name, ' ', bundle.version), h('p', null, label(bundle.meta?.description, bundle.description)), h('div', { className: 'rc-actions' }, h('button', { disabled: action.busy || !!bundle.readOnlyReason, onClick: async () => { if (bundle.name === SELF && bundle.enabled && !await confirmAction('停用远程控制插件会立即断开这台设备，之后只能在电脑上重新启用。继续？')) return; void action.run(async () => { const result = value(await ctx.remote.pluginManager.setBundleEnabled(bundle.name, !bundle.enabled)); if (result.error) throw new Error(result.error.diagnostic || result.error.code); bundles.reload(); return result }) } }, bundle.enabled ? '停用' : '启用'), bundle.removable ? h('button', { className: 'rc-danger', disabled: action.busy, onClick: async () => { if (await confirmAction(bundle.name === SELF ? '卸载远程控制插件会立即断开这台设备，之后只能在电脑上重新安装。继续？' : `卸载 ${bundle.name}？`)) void action.run(async () => { const result = value(await ctx.remote.pluginManager.removeBundle(bundle.name)); if (result.error) throw new Error(result.error.diagnostic || result.error.code); bundles.reload(); return result }, '插件已卸载') } }, '卸载') : null))))
}
function Workspaces({ ctx }: { ctx: Host }) {
  const workspaces = useStore(ctx.workspaces.list), action = useAction(), [path, setPath] = React.useState('')
  return h(React.Fragment, null, h('h2', null, '工作区'), h('section', { className: 'rc-card' }, h('label', { className: 'rc-label' }, '电脑上的文件夹路径', h('input', { value: path, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPath(e.target.value) })), h('button', { disabled: action.busy || !path.trim(), onClick: async () => { void action.run(() => ctx.workspaces.create({ path: path.trim() }), '工作区已添加') } }, '添加工作区')), ...(workspaces.items ?? []).map((workspace: Host) => h('section', { key: workspace.workspaceId, className: 'rc-card' }, h('h3', null, workspace.title), h('p', { className: 'rc-path' }, workspace.path), h('div', { className: 'rc-actions' }, h('button', { disabled: action.busy, onClick: async () => { const title = await ask('工作区名称', workspace.title); if (title?.trim()) void action.run(() => ctx.workspaces.rename(workspace.workspaceId, title.trim())) } }, '重命名'), h('button', { disabled: action.busy, onClick: async () => { if (await confirmAction('从工作区列表移除？电脑上的文件仍保留。')) void action.run(() => ctx.workspaces.delete(workspace.workspaceId), '已移除') } }, '移除')))), action.error ? h('p', { className: 'rc-error' }, action.error) : null, action.notice ? h('p', { role: 'status' }, action.notice) : null)
}
function Compatibility({ ctx, entry }: { ctx: Host; entry: Host }) {
  return h('section', { className: 'rc-compat' }, h('p', { className: 'rc-notice' }, '插件兼容页面 · 操作作用于电脑'), h(Boundary, { what: '这个插件页面' }, h(PluginPage, { ctx, entry })))
}
function Skills({ ctx, sessionId }: { ctx: Host; sessionId?: string }) {
  const list = useLoad<Host>(async () => sessionId ? value(await ctx.remote.skills.list({ sessionId })) : undefined, [ctx, sessionId])
  return h('section', { className: 'rc-card' }, h('h3', null, '当前会话的技能'), list.error ? h('p', { className: 'rc-notice' }, list.error) : !sessionId ? h('p', { className: 'rc-muted' }, '需要选择会话') : !list.data ? h('p', { className: 'rc-muted' }, '正在读取技能…') : list.data.skills?.length ? list.data.skills.map((skill: Host) => h('article', { key: skill.name, className: 'rc-card' }, h('h3', null, '/' + skill.name), h('p', null, skill.description), skill.whenToUse ? h('p', { className: 'rc-muted' }, skill.whenToUse) : null, skill.path ? h('p', { className: 'rc-path' }, skill.path) : null)) : h('p', { className: 'rc-muted' }, '该会话当前没有可调用的技能。可在下方配置技能目录，再从会话消息中使用 /技能名称。'))
}
function Automations({ ctx, sessionId }: { ctx: Host; sessionId?: string }) {
  const capability = useLoad<Host>(() => command({ action: 'scheduleCapabilities' }), [ctx])
  const [history, setHistory] = React.useState<Host>()
  const list = useLoad<Host>(async () => { if (!ctx.remote.schedule) return undefined; return value(await ctx.remote.schedule.catalog()) }, [ctx])
  const action = useAction(), [title, setTitle] = React.useState(''), [instruction, setInstruction] = React.useState(''), [time, setTime] = React.useState('09:00')
  return h(React.Fragment, null, capability.data && !capability.data.available ? h('p', { className: 'rc-notice' }, '此宿主尚未启用自动化服务；请在电脑上启用官方自动化插件后重试。') : null, history ? h('section', { className: 'rc-card' }, h('h3', null, '任务执行记录'), history.records?.length ? history.records.map((record: Host, i: number) => h('p', { key: i }, JSON.stringify(record))) : h('p', { className: 'rc-muted' }, '暂无保存的执行记录'), h('button', { onClick: () => setHistory(undefined) }, '收起记录')) : null, h('section', { className: 'rc-card' }, h('h3', null, '新建每日任务'), h('label', { className: 'rc-label' }, '任务名称', h('input', { value: title, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value) })), h('label', { className: 'rc-label' }, '指令', h('textarea', { rows: 3, value: instruction, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setInstruction(e.target.value) })), h('label', { className: 'rc-label' }, '本地时间', h('input', { type: 'time', value: time, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTime(e.target.value) })), h('button', { className: 'rc-primary', disabled: action.busy || !capability.data?.available || !sessionId || !title.trim() || !instruction.trim(), onClick: async () => { void action.run(async () => { const result = value(await command({ action: 'scheduleCreate', sessionId, request: { title: title.trim(), prompt: instruction.trim(), daily: { time: time.length === 5 ? `${time}:00` : time, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone } } })); list.reload(); setTitle(''); setInstruction(''); return result }, '任务已创建') } }, '创建每日任务')),
    list.error || action.error ? h('p', { className: 'rc-error' }, list.error || action.error) : null, action.notice ? h('p', { className: 'rc-notice', role: 'status' }, action.notice) : null,
    ...(list.data ?? []).map((entry: Host) => { const { sessionId: ownerSession, status: taskStatus, lastDelivery, ...record } = entry; return h('section', { key: record.id, className: 'rc-card' }, h('h3', null, record.title || record.id), h('p', null, record.prompt), h('p', { className: 'rc-muted' }, record.kind, ' · ', record.scheduledAt ? new Date(record.scheduledAt).toLocaleString() : '', ' · ', record.timeZone), h('div', { className: 'rc-actions' }, h('button', { disabled: action.busy, onClick: async () => { const edited = await ask('修改任务指令', record.prompt); if (edited?.trim()) void action.run(async () => { const result = value(await ctx.remote.schedule.update({ sessionId: entry.sessionId, id: record.id, expected: record, prompt: edited.trim() })); if (!result.updated) throw new Error(result.code || '任务已被其他设备修改，请刷新'); list.reload(); return result }) } }, '编辑指令'), h('button', { disabled: action.busy, onClick: () => { void action.run(async () => { const result = value(await ctx.remote.schedule.history({ sessionId: ownerSession, id: record.id, limit: 20 })); if (result.code) throw new Error(result.code); setHistory(result); return result }, '') } }, '执行记录'), h('button', { className: 'rc-danger', disabled: action.busy, onClick: async () => { if (await confirmAction('删除这个自动化任务？')) void action.run(async () => { const result = value(await ctx.remote.schedule.delete({ sessionId: entry.sessionId, id: record.id })); list.reload(); return result }, '任务已删除') } }, '删除'))) }))
}
function Cost({ ctx, sessionId }: { ctx: Host; sessionId?: string }) {
  const list = useStore(ctx.sessions.list)
  const projections = list.byId?.[sessionId || '']?.projectionValues
  const usage = Object.fromEntries(Object.entries(projections ?? {}).filter(([key]) => /cost|usage|token/i.test(key)))
  const names: Record<string, string> = { tokenUsage: 'Token 用量', uncachedInputTokens: '未缓存输入', outputTokens: '输出', cacheReadTokens: '缓存读取', cacheWriteTokens: '缓存写入' }
  const render = (data: Host, prefix = ''): React.ReactNode[] => Object.entries(data ?? {}).flatMap(([key, amount]) => typeof amount === 'object' && amount !== null ? render(amount, `${prefix}${names[key] ?? key} · `) : [h('div', { key: prefix + key, className: 'rc-row', style: { padding: '8px 0' } }, h('span', null, prefix + (names[key] ?? key)), h('span', null, typeof amount === 'number' ? amount.toLocaleString() : String(amount ?? '—')))])
  return h('section', { className: 'rc-card' }, h('h3', null, '当前会话费用与用量'), Object.keys(usage).length ? render(usage) : h('p', { className: 'rc-muted' }, '当前宿主没有提供该会话的费用投影。模型计费以提供商账户为准。'))
}







