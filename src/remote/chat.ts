import { ask, confirmAction } from './dialog.js'
import * as React from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { useStore, useLoad, useAction, value, cacheText, cachedText, type Host } from './common.js'
import { Icon } from './icons.js'
import { chatContent, pendingInteraction } from './host.js'
const h = React.createElement
const markdownLabels = { code: { copyLabel: '复制代码', copiedLabel: '已复制' }, footnotes: '注释' }
export function Markdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return h(MarkdownText, { text, streaming, labels: markdownLabels })
}

export function Chat({ ctx, sessionId, onSession }: { ctx: Host; sessionId: string; onSession: (id: string) => void }): React.ReactElement {
  const [binding, setBinding] = React.useState<Host>(), [openError, setOpenError] = React.useState('')
  React.useEffect(() => {
    let live = true
    const ref = ctx.sessions.retain(sessionId, { source: 'controllerOperation' })
    ref.ready.then((next: Host) => { if (live) setBinding(next) }, (failure: Error) => { if (live) setOpenError(failure.message) })
    return () => { live = false; ref.release() }
  }, [ctx, sessionId])
  if (openError) return h('div', { className: 'rc-error' }, openError)
  return binding ? h(BoundChat, { ctx, binding, sessionId, onSession }) : h('div', { className: 'rc-skeleton' }, '正在读取会话…')
}
function ImageBlock({ ctx, sessionId, attachment }: { ctx: Host; sessionId: string; attachment: Host }) {
  const image = useLoad<Host>(() => ctx.uiConversation.imageUrl(sessionId, attachment) as Promise<string>, [ctx, sessionId, attachment.id])
  return image.data ? h('a', { href: image.data, target: '_blank', rel: 'noopener' }, h('img', { src: image.data, alt: '会话附件', loading: 'lazy' })) : h('span', { className: 'rc-muted' }, image.error || '加载图片…')
}
function Blocks({ ctx, sessionId, blocks, streaming = false }: { ctx: Host; sessionId: string; blocks: Host[]; streaming?: boolean }) {
  return h(React.Fragment, null, ...blocks.map((block, i) => {
    const kind = block.kind ?? block.type
    if (kind === 'text') return h(Markdown, { key: i, text: block.text ?? '', streaming })
    if (kind === 'reasoning' || kind === 'thinking') return h('details', { key: i, className: 'rc-tool-event' }, h('summary', null, '思考过程'), h(Markdown, { text: block.text || block.thinking || '' }))
    if (kind === 'image' && block.attachment) return h(ImageBlock, { key: i, ctx, sessionId, attachment: block.attachment })
    if (kind === 'tool-call') return h('details', { key: i, className: 'rc-tool-event' }, h('summary', null, block.name), h('pre', null, block.argsRaw))
    if (kind === 'file') return h('div', { key: i, className: 'rc-chip' }, block.name || block.path || '文件附件')
    return null
  }))
}
function BoundChat({ ctx, binding, sessionId, onSession }: { ctx: Host; binding: Host; sessionId: string; onSession: (id: string) => void }): React.ReactElement {
  const session = useStore(binding.session)
  const conversation = React.useMemo(() => ctx.uiConversation.binding(binding), [ctx, binding])
  const chatSource = React.useMemo(() => conversation.target('chat'), [conversation])
  const chat = useStore(chatSource)
  const statuses = useStore(ctx.uiSession.sessionStatus)
  const pending = pendingInteraction(statuses, sessionId)
  const uploads = useStore(ctx.conversation.fileUploads)
  const [draft, setDraft] = React.useState(() => cachedText(`dsrc-draft:${sessionId}`))
  const [attachments, setAttachments] = React.useState<Host[]>([]), [view, setView] = React.useState('chat')
  const [follow, setFollow] = React.useState(true), [model, setModel] = React.useState('')
  /** The sheet above the message box: thinking effort, permissions, agent, tool trace. */
  const [options, setOptions] = React.useState(false)
  const scroll = React.useRef<HTMLDivElement>(null), picker = React.useRef<HTMLInputElement>(null), input = React.useRef<HTMLTextAreaElement>(null)
  const action = useAction()
  const models = useLoad<Host>(() => ctx.remote.session.modelCatalog().then(value), [ctx])
  const permissions = useLoad<Host>(() => ctx.remote.permissionPresets.catalog().then(value), [ctx])
  const presets = useLoad<Host>(() => ctx.remote.agentPresets.list().then(value), [ctx])
  const permissionSource = React.useMemo(() => binding.session.projections.faceOf('permissions'), [binding])
  const permission = useStore(permissionSource)
  const presetSource = React.useMemo(() => binding.session.projections.faceOf('agentPreset'), [binding])
  const preset = useStore(presetSource)
  const modelSource = React.useMemo(() => binding.session.projections.faceOf('modelSelection'), [binding])
  const modelState = useStore(modelSource)
  const selection = modelState.next ?? models.data?.default
  React.useEffect(() => { if (selection?.provider && selection?.model) setModel(`${selection.provider}/${selection.model}`) }, [selection?.provider, selection?.model])
  React.useEffect(() => { cacheText(`dsrc-draft:${sessionId}`, draft) }, [draft, sessionId])
  // The message box grows with its text, up to a third of the screen.
  React.useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, Math.max(120, window.innerHeight / 3))}px`
  }, [draft])
  React.useEffect(() => { if (follow && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight }, [chat, session.pendingSubmissions, follow])
  const send = async () => {
    if (!draft.trim() && !attachments.length) return
    const result = await action.run(async () => {
      const outcome = await ctx.conversation.sendSession(binding.session, draft, attachments.map(a => a.id), 'queue')
      if (outcome?.kind === 'error') throw new Error(outcome.text || '消息提交失败，草稿已保留')
      value(outcome); setDraft(''); setAttachments([]); setFollow(true)
    }, '')
    return result
  }
  const content = chatContent(chat)
  const modelOptions = (models.data?.groups ?? []).flatMap((provider: Host) => (provider.models ?? []).map((m: Host) => ({ provider: provider.id, model: m.id ?? m.model, name: m.name ?? m.id ?? m.model, reasoning: m.reasoning })))
  const currentModel = modelOptions.find((m: Host) => `${m.provider}/${m.model}` === model)
  const trace = view === 'trace'
  const messages = content.nodes.map((node: Host) => {
    if (node.kind === 'user' || node.kind === 'steering') return h('article', { key: node.seq, className: 'rc-message user' }, h(Blocks, { ctx, sessionId, blocks: node.content }))
    if (node.kind === 'assistant') return h('article', { key: node.seq, className: 'rc-message assistant' },
      h(Blocks, { ctx, sessionId, blocks: node.blocks }),
      node.interrupted ? h('div', { className: 'rc-message-label' }, '已停止') : null)
    if (node.kind === 'tool-result') return h('details', { key: node.seq, className: 'rc-tool-event', open: trace },
      h('summary', null, `${node.call?.name || node.callId}${node.isError ? ' · 失败' : ''}`),
      h('pre', null, node.call?.argsRaw), h(Blocks, { ctx, sessionId, blocks: node.content }))
    if (node.kind === 'turn-error') return h('div', { key: node.seq, className: 'rc-error' }, node.message || node.code)
    if (trace) return h('details', { key: node.seq, className: 'rc-tool-event' }, h('summary', null, node.kind), h('pre', null, JSON.stringify(node, null, 2)))
    return null
  })
  const empty = !content.nodes.length && !content.partial && !(session.pendingSubmissions ?? []).length

  const pickModel = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const picked = modelOptions.find((m: Host) => `${m.provider}/${m.model}` === e.target.value)
    if (picked) void action.run(async () => { value(await ctx.remote.session.selectModel({ sessionId, provider: picked.provider, model: picked.model })); setModel(`${picked.provider}/${picked.model}`) }, '')
  }
  const pickPermission = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value
    if (/full|全部|完全/.test(mode) && !await confirmAction('完全权限允许修改电脑文件与设置。继续？')) return
    void action.run(() => binding.session.command(`/permission ${mode}`), '')
  }
  const sheet = h('div', { className: 'rc-sheet' },
    currentModel?.reasoning?.efforts?.length ? h('label', { className: 'rc-sheet-row' }, '思考强度',
      h('select', { 'aria-label': '思考强度', value: selection?.reasoningEffort ?? currentModel.reasoning.defaultEffort ?? '', disabled: action.busy, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => { void action.run(() => ctx.remote.session.selectModel({ sessionId, provider: currentModel.provider, model: currentModel.model, reasoningEffort: e.target.value }), '') } },
        ...currentModel.reasoning.efforts.map((effort: Host) => h('option', { key: effort.id, value: effort.id }, effort.name)))) : null,
    permissions.data?.options?.length ? h('label', { className: 'rc-sheet-row' }, '权限模式',
      h('select', { 'aria-label': '权限模式', value: permission?.currentValue ?? '', disabled: action.busy, onChange: pickPermission },
        h('option', { value: '' }, '未选择'), ...permissions.data.options.map((option: Host) => h('option', { key: option.value, value: option.value }, option.name)))) : null,
    presets.data?.presets?.length ? h('label', { className: 'rc-sheet-row', title: session.blank ? undefined : '会话开始后 Agent 配置固定' }, 'Agent',
      h('select', { 'aria-label': 'Agent 预设', value: typeof preset === 'string' ? preset : '', disabled: action.busy || !session.blank, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => { void action.run(() => ctx.remote.agentPresets.select(sessionId, e.target.value), '') } },
        h('option', { value: '' }, '默认 Agent'), ...presets.data.presets.map((option: Host) => h('option', { key: option.id, value: option.id, disabled: !!option.broken }, option.name || option.id)))) : null,
    h('label', { className: 'rc-sheet-row' }, '显示工具轨迹',
      h('input', { type: 'checkbox', checked: trace, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setView(e.target.checked ? 'trace' : 'chat') })))

  return h(React.Fragment, null,
    h('div', { className: 'rc-scroll', ref: scroll, onScroll: () => { const el = scroll.current; if (el) setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 100) } },
      h('div', { className: 'rc-chat' },
        session.hasMore ? h('button', { className: 'rc-pill rc-older', disabled: session.loadingOlder, onClick: () => { void action.run(() => binding.session.loadOlder(), '') } }, '加载更早的消息') : null,
        empty ? h('div', { className: 'rc-welcome' }, h('h1', null, '今天，我们继续做什么？'), h('p', null, '这里与你的电脑共享同一个会话。')) : null,
        ...messages,
        content.partial ? h('article', { className: 'rc-message assistant', 'aria-label': '实时回复' }, h(Blocks, { ctx, sessionId, blocks: content.partial.blocks, streaming: true })) : null,
        ...content.runningCalls.map((call: Host) => h('div', { key: call.callId, className: 'rc-tool-event rc-live' }, `${call.name} · 执行中`)),
        ...(session.pendingSubmissions ?? []).map((echo: Host) => h('article', { key: echo.requestId, className: 'rc-message user' }, echo.text, h('div', { className: 'rc-muted' }, '正在提交…'))),
        session.running && !content.partial ? h('p', { className: 'rc-thinking', role: 'status' }, '正在处理…') : null,
        trace ? h(Subtasks, { ctx, sessionId, onSession }) : null),
      !follow ? h('button', { className: 'rc-round rc-jump', 'aria-label': '回到最新消息', onClick: () => setFollow(true) }, h(Icon, { name: 'down' })) : null),
    h('div', { className: 'rc-composer-wrap' },
      pending ? h(Interaction, { key: pending.key, pending }) : null,
      action.error || session.promptError ? h('div', { className: 'rc-error', role: 'alert' }, action.error || session.promptError?.message || '消息提交失败，请检查连接。不会自动重复发送。') : null,
      options ? sheet : null,
      h('div', { className: 'rc-composer' },
        attachments.length ? h('div', { className: 'rc-attachments' }, ...attachments.map(a => h('span', { key: a.id, className: 'rc-chip' }, a.name || a.file?.name || '附件', uploads[a.id]?.phase ? ` · ${uploads[a.id].phase}` : '',
          h('button', { className: 'rc-text', 'aria-label': '移除附件', onClick: () => { ctx.conversation.releaseDraftAttachment(a.id); setAttachments(previous => previous.filter(x => x.id !== a.id)) } }, '×')))) : null,
        h('textarea', { 'aria-label': '消息', placeholder: '给 DSH 发消息', value: draft, rows: 1, ref: input,
          onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value),
          onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.nativeEvent.isComposing || event.key !== 'Enter') return
            // With a keyboard and mouse, Enter sends and Shift+Enter breaks the line. On a touch
            // keyboard Enter always breaks the line; the send button submits.
            const keyboard = matchMedia('(pointer: fine)').matches
            if (event.ctrlKey || event.metaKey || (keyboard && !event.shiftKey)) { event.preventDefault(); void send() }
          } }),
        h('div', { className: 'rc-composer-bar' },
          h('input', { type: 'file', multiple: true, hidden: true, ref: picker, onChange: (event: React.ChangeEvent<HTMLInputElement>) => { try { setAttachments(previous => [...previous, ...ctx.conversation.createDrafts(sessionId, Array.from(event.target.files || []))]) } catch (e) { action.setError(String(e)) }; event.target.value = '' } }),
          h('button', { className: 'rc-round rc-plain', 'aria-label': '上传附件', onClick: () => picker.current?.click() }, h(Icon, { name: 'plus' })),
          h('button', { className: 'rc-round rc-plain', 'aria-label': '会话选项', 'aria-expanded': options, onClick: () => setOptions(!options) }, h(Icon, { name: 'sliders' })),
          modelOptions.length ? h('select', { className: 'rc-model', 'aria-label': '会话模型', value: model, disabled: action.busy, onChange: pickModel },
            h('option', { value: '' }, '当前模型'), ...modelOptions.map((m: Host) => h('option', { key: `${m.provider}/${m.model}`, value: `${m.provider}/${m.model}` }, m.name))) : h('span', { className: 'rc-model rc-muted' }, '默认模型'),
          session.running ? h('button', { className: 'rc-round rc-stop', 'aria-label': '停止生成', onClick: () => { void action.run(() => binding.session.cancel(), '') } }, h(Icon, { name: 'stop' })) : null,
          h('button', { className: 'rc-round rc-send', 'aria-label': '发送消息', disabled: action.busy || (!draft.trim() && !attachments.length), onClick: () => { void send() } }, h(Icon, { name: 'send' }))))))
}
function Subtasks({ ctx, sessionId, onSession }: { ctx: Host; sessionId: string; onSession: (id: string) => void }) {
  const list = useStore(ctx.sessions.list)
  const children = (list.ids ?? []).filter((id: string) => list.byId[id]?.parentId === sessionId)
  return children.length ? h('section', { className: 'rc-card' }, h('h3', null, '子任务'), ...children.map((id: string) => h('button', { key: id, className: 'rc-pill', onClick: () => onSession(id) }, list.byId[id].displayTitle || id, list.byId[id].running ? ' · 执行中' : ' · 已结束'))) : null
}
function Interaction({ pending }: { pending: Host }) {
  const action = useAction(), [answers, setAnswers] = React.useState<Record<string, string>>({})
  return h('section', { className: 'rc-card rc-approval' },
    pending.kind === 'approval' ? h(React.Fragment, null, h('h3', null, '需要你的批准'), h('p', null, pending.toolName), h('p', { className: 'rc-muted' }, typeof pending.displayReason === 'string' ? pending.displayReason : pending.reason), h('div', { className: 'rc-actions' }, h('button', { disabled: action.busy || !pending.answerable, onClick: async () => { void action.run(() => pending.answer('rejected'), '') } }, '拒绝'), h('button', { className: 'rc-primary', disabled: action.busy || !pending.answerable, onClick: async () => { void action.run(() => pending.answer('allowed-once'), '') } }, '允许这一次'))) :
    Array.isArray(pending.questions) ? h(Question, { pending }) : h('p', { className: 'rc-notice' }, '会话正在等待一项这个页面还不支持的确认，请在电脑上处理。'),
    action.error ? h('p', { className: 'rc-error', role: 'alert' }, action.error) : null)
}
function Question({ pending }: { pending: Host }) {
  const state = useStore(pending), action = useAction()
  const [selected, setSelected] = React.useState<Record<string, string[]>>({}), [custom, setCustom] = React.useState<Record<string, string>>({})
  const edit = () => pending.engage?.()
  return h('div', { onFocus: () => pending.holdFocus?.(), onBlur: (e: React.FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) pending.releaseFocus?.() } },
    h('h3', null, pending.kind === 'plan-review' ? '确认方案' : '需要你的回答'),
    state.countdown?.running ? h('p', { className: 'rc-muted' }, `等待回答：${Math.ceil(state.countdown.remainingMs / 1000)} 秒`, h('button', { onClick: () => pending.takeTime() }, '我需要更多时间')) : null,
    ...pending.questions.map((q: Host) => h('fieldset', { key: q.id, className: 'rc-card', disabled: action.busy || state.closed || state.channel === 'none' }, h('legend', null, q.question), q.detail ? h(Markdown, { text: q.detail }) : null,
      ...(q.options ?? []).map((o: Host) => h('label', { key: o.label, className: 'rc-question-option' }, h('input', { type: q.multiSelect ? 'checkbox' : 'radio', name: `question-${q.id}`, checked: selected[q.id]?.includes(o.label) ?? false, onChange: () => { edit(); setSelected(previous => ({ ...previous, [q.id]: q.multiSelect ? previous[q.id]?.includes(o.label) ? (previous[q.id] ?? []).filter(s => s !== o.label) : [...(previous[q.id] ?? []), o.label] : [o.label] })); if (!q.multiSelect) setCustom(previous => ({ ...previous, [q.id]: '' })) } }), h('span', null, o.label, o.description ? h('small', { className: 'rc-muted', style: { display: 'block' } }, o.description) : null))),
      h('label', { className: 'rc-label' }, '补充回答', h('input', { 'aria-label': `回答：${q.question}`, placeholder: '也可以输入回答', value: custom[q.id] || '', onChange: (e: React.ChangeEvent<HTMLInputElement>) => { edit(); setCustom(previous => ({ ...previous, [q.id]: e.target.value })); if (!q.multiSelect) setSelected(previous => ({ ...previous, [q.id]: [] })) } })))),
    h('button', { className: 'rc-primary', disabled: action.busy || state.closed || state.channel === 'none' || pending.questions.some((q: Host) => !selected[q.id]?.length && !custom[q.id]?.trim()), onClick: () => { void action.run(() => pending.answer({ answers: pending.questions.map((q: Host) => ({ id: q.id, selected: selected[q.id] ?? [], ...(custom[q.id]?.trim() ? { custom: (custom[q.id] ?? '').trim() } : {}) })) }), '') } }, '提交回答'),
    action.error ? h('p', { className: 'rc-error' }, action.error) : null)
}




