import { ask, confirmAction } from './dialog.js'
import * as React from 'react'
import { useLoad, useAction, value, useBackClose, type Host } from './common.js'
import { Icon } from './icons.js'

/** File bytes as the Host hands them over: a typed array, a plain array, a Node Buffer in JSON form, or base64 text. */
function bytes(data: unknown): Uint8Array<ArrayBuffer> {
  if (data instanceof Uint8Array) return new Uint8Array(data)
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (typeof data === 'string') return Uint8Array.from(atob(data), char => char.charCodeAt(0))
  if (Array.isArray(data)) return new Uint8Array(data)
  const inner = (data as { data?: unknown } | null)?.data
  if (Array.isArray(inner)) return new Uint8Array(inner)
  if (data && typeof data === 'object') return new Uint8Array(Object.values(data as Record<string, number>))
  throw new Error('宿主返回的文件内容格式无法识别。')
}
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
      setMedia({ url: URL.createObjectURL(new Blob([bytes(result.data)], { type: mime })), pdf: mime === 'application/pdf' })
    } else { const result = value(await ctx.remote.workspaceFiles.read(sessionId, file, {})); setPreview(result.text); setPartial(!result.eof) }
  }
  const list = useLoad<Host>(async () => sessionId ? value(await ctx.remote.workspaceFiles.list(sessionId, path || '.')) : undefined, [ctx, sessionId, path]), action = useAction()
  const nativeOpen = useLoad<boolean>(() => ctx.remote.session.canOpenWorkspacePath().then(value), [ctx])
  /** Go to a folder; a preview belongs to the folder it was opened from. */
  const open = (folder: string) => { setPath(folder); setSelected(''); setPreview(''); setMedia(undefined); setPartial(false) }
  const download = async (file: string) => {
    const result = value(await ctx.remote.workspaceFiles.readBytes(sessionId, file, {}))
    if (!result.eof) throw new Error('文件超过宿主本次读取上限，下载未完成。请在电脑上取回完整文件。')
    const data = bytes(result.data)
    const url = URL.createObjectURL(new Blob([data])), anchor = document.createElement('a')
    anchor.href = url; anchor.download = file.split(/[\\/]/).at(-1) || 'download'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
  const dialog = React.useRef<HTMLDialogElement>(null)
  React.useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (selected && !element.open) element.showModal()
    if (!selected && element.open) element.close()
  }, [selected])
  const close = () => { setSelected(''); setPreview(''); setMedia(undefined); setPartial(false) }
  useBackClose(!!selected, close)
  const name = (file: string) => file.split(/[\\/]/).at(-1) || file
  const entries: Host[] = [...(list.data?.entries ?? [])].sort((x: Host, y: Host) => Number(y.type === 'directory') - Number(x.type === 'directory') || String(x.name).localeCompare(String(y.name)))
  return h('div', { className: 'rc-scroll' }, h('div', { className: 'rc-content' },
    h('div', { className: 'rc-crumbs' },
      h('button', { className: 'rc-round rc-plain', 'aria-label': '上一级', disabled: !path, onClick: () => open(path.split('/').slice(0, -1).join('/')) }, h(Icon, { name: 'back' })),
      h('span', { className: 'rc-path' }, '/' + path),
      h('button', { className: 'rc-round rc-plain', 'aria-label': '刷新', onClick: list.reload }, h(Icon, { name: 'refresh' }))),
    list.error || action.error ? h('p', { className: 'rc-error', role: 'alert' }, list.error || action.error) : null,
    !sessionId ? h('p', { className: 'rc-notice' }, '请先选择或创建会话。') : null,
    entries.length ? h('section', { className: 'rc-list' }, ...entries.map((entry: Host) => {
      const file = [path, entry.name].filter(Boolean).join('/'), folder = entry.type === 'directory'
      return h('div', { key: entry.name, className: 'rc-file' },
        h('button', { className: 'rc-file-main', disabled: action.busy || (!folder && entry.type !== 'file'), 'aria-label': folder ? `打开文件夹 ${entry.name}` : `预览 ${entry.name}`,
          onClick: () => { if (folder) open(file); else void action.run(() => show(file), '') } },
          h(Icon, { name: folder ? 'folder' : 'file' }), h('span', { className: 'rc-file-name' }, entry.name)),
        folder ? h(Icon, { name: 'chevron' }) : entry.type === 'file' ? h('button', { className: 'rc-round rc-plain', 'aria-label': `下载 ${entry.name}`, title: '下载', disabled: action.busy, onClick: () => { void action.run(() => download(file), '') } }, h(Icon, { name: 'down' })) : null)
    })) : list.data ? h('p', { className: 'rc-muted rc-empty' }, '这个文件夹是空的。') : null,
    list.data?.truncated ? h('p', { className: 'rc-notice' }, '目录条目超过宿主返回上限；请打开子目录缩小范围。') : null,
    h('p', { className: 'rc-muted' }, '这里是当前会话的工作区。给会话发文件用聊天输入框的 ＋。'),
    h('dialog', { ref: dialog, className: 'rc-picker-sheet rc-preview', 'aria-label': '文件预览', onCancel: close, onClick: (event: React.MouseEvent) => { if (event.target === event.currentTarget) close() } },
      selected ? h('div', { className: 'rc-picker-body' },
        h('div', { className: 'rc-preview-head' }, h('span', { className: 'rc-file-name' }, name(selected)), h('button', { className: 'rc-round rc-plain', 'aria-label': '关闭预览', onClick: close }, h(Icon, { name: 'close' }))),
        h('div', { className: 'rc-preview-body' },
          media ? media.pdf ? h('a', { href: media.url, target: '_blank', rel: 'noopener' }, '在浏览器中打开这份 PDF') : h('img', { src: media.url, alt: name(selected) })
            : preview ? h('pre', null, preview) : h('p', { className: 'rc-muted' }, action.error || '正在读取…'),
          partial ? h('p', { className: 'rc-notice' }, '只显示了开头一部分；下载可以取回完整文件。') : null),
        h('div', { className: 'rc-actions rc-preview-actions' },
          h('button', { disabled: action.busy, onClick: () => { void action.run(() => download(selected), '') } }, '下载'),
          h('button', { disabled: !nativeOpen.data, title: nativeOpen.data ? undefined : '这台电脑没有启用这个功能', onClick: async () => { if (await confirmAction('会在电脑上用对应的程序打开这个文件，手机上不会打开。继续？')) void action.run(() => ctx.remote.session.openWorkspacePath({ sessionId, path: selected }), '已在电脑上打开') } }, '在电脑上打开'))) : null)))
}
