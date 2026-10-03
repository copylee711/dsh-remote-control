import * as React from 'react'

/** The runtime host publishes extensible Cordis services; keep that boundary in one type. */
export type Host = any
const temporaryDrafts = new Map<string, string>()
export function cachedText(key: string): string {
  try { return localStorage.getItem(key) ?? temporaryDrafts.get(key) ?? '' } catch { return temporaryDrafts.get(key) ?? '' }
}
export function cacheText(key: string, text: string): void {
  if (text) temporaryDrafts.set(key, text); else temporaryDrafts.delete(key)
  try { if (text) localStorage.setItem(key, text); else localStorage.removeItem(key) } catch { /* Restricted storage keeps this page's draft in memory. */ }
}
export function value<T = any>(result: any): T {
  if (result?.ok === false) throw new Error(result.error?.message || result.error?.code || '宿主拒绝了操作')
  return result?.ok === true ? result.value : result
}
const EMPTY = Object.freeze({})
export function useStore<T = any>(source?: any): T {
  const subscribe = React.useCallback((notify: () => void) => source?.subscribe(notify) ?? (() => {}), [source])
  const snapshot = React.useCallback(() => source?.getSnapshot() ?? EMPTY, [source])
  return React.useSyncExternalStore(subscribe, snapshot, snapshot)
}
export function useLoad<T>(load: () => Promise<T>, dependencies: React.DependencyList) {
  const [data, setData] = React.useState<T>(), [error, setError] = React.useState(''), [revision, setRevision] = React.useState(0)
  React.useEffect(() => {
    let live = true; setError('')
    load().then(result => { if (live) setData(result) }, failure => { if (live) setError(String(failure.message || failure)) })
    return () => { live = false }
  }, [...dependencies, revision])
  return { data, error, reload: () => setRevision(n => n + 1) }
}
export function useAction() {
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(''), [notice, setNotice] = React.useState('')
  const locked = React.useRef(false)
  async function run(operation: () => Promise<unknown>, success = '已保存') {
    if (locked.current) return
    locked.current = true; setBusy(true); setError(''); setNotice('')
    try { const result = value(await operation()); if (success) setNotice(success); return result }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { locked.current = false; setBusy(false) }
  }
  return { busy, error, notice, run, setError, setNotice }
}
/**
 * The phone's back button closes what is open (a sheet, the drawer, a page) instead of
 * leaving the app. Each history entry carries a depth; a layer that opens makes sure an
 * entry exists at its depth, and going back closes every layer deeper than the entry
 * reached. Closing a layer on screen leaves its entry in place to be reused, so no
 * history call ever has to be undone.
 */
const layers: Array<{ close: () => void }> = []
const depth = () => Number((history.state as { rcLayer?: number } | null)?.rcLayer ?? 0)
if (typeof window !== 'undefined') window.addEventListener('popstate', () => {
  const reached = depth()
  let closed = false
  while (layers.length > reached) { layers.pop()!.close(); closed = true }
  // Nothing was open at this depth: these are spare entries, step over all of them at once.
  if (!closed && reached > layers.length) history.go(layers.length - reached)
})
export function useBackClose(open: boolean, close: () => void): void {
  const latest = React.useRef(close); latest.current = close
  React.useEffect(() => {
    if (!open) return
    const layer = { close: () => latest.current() }
    layers.push(layer)
    if (depth() < layers.length) history.pushState({ rcLayer: layers.length }, '')
    return () => { const index = layers.indexOf(layer); if (index >= 0) layers.splice(index, 1) }
  }, [open])
}

/** Keeps a rendering failure inside one part of the page, with a way back. */
export class Boundary extends React.Component<{ children?: React.ReactNode; what?: string }, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(error: unknown) { return { error: error instanceof Error ? error.message : String(error) } }
  render() {
    if (!this.state.error) return this.props.children
    return React.createElement('div', { className: 'rc-error', role: 'alert' },
      `${this.props.what ?? '这部分内容'}暂时无法显示：${this.state.error}`,
      React.createElement('button', { onClick: () => this.setState({ error: '' }) }, '重试'),
      React.createElement('button', { onClick: () => location.reload() }, '重新加载'))
  }
}
export function label(item: any, fallback = ''): string {
  if (typeof item === 'function') { try { return String(item()) } catch { return fallback } }
  if (typeof item === 'string') return item
  return item?.['zh-CN'] || item?.en || item?.['en-US'] || fallback
}
