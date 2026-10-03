import { ask, confirmAction } from './dialog.js'
import * as React from 'react'
import { useLoad, useAction, value, type Host } from './common.js'
const h = React.createElement
export function Files({ ctx, sessionId }: { ctx: Host; sessionId?: string }) {
  const [path, setPath] = React.useState(''), [preview, setPreview] = React.useState(''), [selected, setSelected] = React.useState('')
  const [media, setMedia] = React.useState<{ url: string; pdf: boolean }>(), [partial, setPartial] = React.useState(false)
  React.useEffect(() => () => { if (media) URL.revokeObjectURL(media.url) }, [media])
  const show = async (file: string) => {
    setSelected(file); setPreview(''); setMedia(undefined); setPartial(false)
    const types: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf' }
    const mime = types[file.split('.').at(-1)?.toLowerCase() || '']
    if (mime) {
      const result = value(await ctx.remote.workspaceFiles.readBytes(sessionId, file, {}))
      if (!result.eof) throw new Error('文件超过宿主预览上限，请在电脑上打开。')
      setMedia({ url: URL.createObjectURL(new Blob([new Uint8Array(result.data)], { type: mime })), pdf: mime === 'application/pdf' })
    } else { const result = value(await ctx.remote.workspaceFiles.read(sessionId, file, {})); setPreview(result.text); setPartial(!result.eof) }
  }
  const list = useLoad<Host>(async () => sessionId ? value(await ctx.remote.workspaceFiles.list(sessionId, path || '.')) : undefined, [ctx, sessionId, path]), action = useAction()
  const nativeOpen = useLoad<boolean>(() => ctx.remote.session.canOpenWorkspacePath().then(value), [ctx])
  /** Go to a folder; a preview belongs to the folder it was opened from. */
  const open = (folder: string) => { setPath(folder); setSelected(''); setPreview(''); setMedia(undefined); setPartial(false) }
  const download = async (file: string) => {
    const result = value(await ctx.remote.workspaceFiles.readBytes(sessionId, file, {}))
    if (!result.eof) throw new Error('文件超过宿主本次读取上限，下载未完成。请在电脑上取回完整文件。')
    const data = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data)
    const url = URL.createObjectURL(new Blob([data])), anchor = document.createElement('a')
    anchor.href = url; anchor.download = file.split(/[\\/]/).at(-1) || 'download'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
  return h('div', { className: 'rc-scroll' }, h('div', { className: 'rc-content' }, h('h2', null, '文件与交付物'), h('p', { className: 'rc-muted' }, '当前会话工作区。附件上传使用聊天输入区的 ＋ 按钮。'),
    h('div', { className: 'rc-actions' }, path ? h('button', { onClick: async () => open(path.split('/').slice(0, -1).join('/')) }, '‹ 上一级') : null, h('span', { className: 'rc-path' }, '/' + path), h('button', { onClick: list.reload }, '刷新')),
    list.error || action.error ? h('p', { className: 'rc-error', role: 'alert' }, list.error || action.error) : null,
    !sessionId ? h('p', { className: 'rc-notice' }, '请先选择或创建会话。') : null,
    ...(list.data?.entries ?? []).map((entry: Host) => { const file = [path, entry.name].filter(Boolean).join('/'); return h('div', { key: entry.name, className: 'rc-card' }, h('div', { className: 'rc-row' }, h('span', { className: 'rc-path' }, entry.type === 'directory' ? '▱ ' : '', entry.name), h('div', { className: 'rc-actions' }, entry.type === 'directory' ? h('button', { onClick: async () => open(file) }, '打开文件夹') : entry.type === 'file' ? h(React.Fragment, null, h('button', { disabled: action.busy, onClick: async () => { void action.run(async () => { await show(file); }, '') } }, '预览'), h('button', { disabled: action.busy, onClick: async () => { void action.run(() => download(file), '') } }, '下载')) : null))) }),
    list.data?.truncated ? h('p', { className: 'rc-notice' }, '目录条目超过宿主返回上限；请打开子目录缩小范围。') : null,
    selected ? h('section', { className: 'rc-card' }, h('h3', null, selected), media ? media.pdf ? h('a', { href: media.url, target: '_blank', rel: 'noopener' }, '在浏览器中预览 PDF') : h('img', { src: media.url, alt: selected }) : h('pre', null, preview), partial ? h('p', { className: 'rc-notice' }, '这里只显示宿主允许读取的首段内容；下载可取回上限内的完整文件。') : null, h('button', { disabled: !nativeOpen.data, title: nativeOpen.data ? '作用于电脑原生应用' : '此宿主没有启用原生打开能力', onClick: async () => { if (await confirmAction('将在电脑原生应用中打开，文件不会在手机打开。继续？')) void action.run(() => ctx.remote.session.openWorkspacePath({ sessionId, path: selected }), '已在电脑上打开') } }, '在电脑上打开')) : null))
}


