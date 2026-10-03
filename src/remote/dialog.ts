import * as React from 'react'
import { useBackClose } from './common.js'
const h = React.createElement
interface Request { text: string; initial?: string; resolve: (answer: string | null) => void }
let request: Request | undefined
const listeners = new Set<() => void>()
function publish() { listeners.forEach(listener => listener()) }
function open(text: string, initial?: string): Promise<string | null> {
  if (request) return Promise.resolve(null)
  return new Promise(resolve => { request = { text, initial, resolve }; publish() })
}
export function ask(text: string, initial = '') { return open(text, initial) }
export async function confirmAction(text: string) { return (await open(text)) !== null }
export function DialogViewport() {
  const current = React.useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => request)
  const ref = React.useRef<HTMLDialogElement>(null), [text, setText] = React.useState('')
  useBackClose(!!current, () => answer(null))
  const answer = (result: string | null) => { const previous = request; request = undefined; publish(); previous?.resolve(result) }
  React.useEffect(() => {
    if (current) { setText(current.initial ?? ''); ref.current?.showModal() } else ref.current?.close()
  }, [current])
  return h('dialog', { ref, className: 'rc-dialog', 'aria-labelledby': 'rc-dialog-title', onCancel: () => answer(null) },
    h('form', { onSubmit: (event: React.FormEvent) => { event.preventDefault(); answer(current?.initial === undefined ? '' : text) } },
      h('h2', { id: 'rc-dialog-title' }, current?.initial === undefined ? '确认操作' : '编辑'), h('p', { className: 'rc-dialog-message' }, current?.text),
      current?.initial !== undefined ? h('input', { 'aria-label': current?.text, value: text, autoFocus: true, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setText(event.target.value) }) : null,
      h('div', { className: 'rc-actions' }, h('button', { type: 'button', onClick: () => answer(null) }, '取消'), h('button', { type: 'submit', className: 'rc-primary' }, '确认'))))
}
