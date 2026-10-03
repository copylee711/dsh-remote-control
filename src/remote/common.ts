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
export function label(item: any, fallback = ''): string {
  if (typeof item === 'function') { try { return String(item()) } catch { return fallback } }
  if (typeof item === 'string') return item
  return item?.['zh-CN'] || item?.en || item?.['en-US'] || fallback
}
