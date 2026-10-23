/**
 * The few places where the remote app reads structures that the Host's client
 * SDK does not promise to keep (rc.2 internals). Each accessor checks what it
 * reads, so a Host update that moves one of them turns that feature off with a
 * message instead of breaking the page.
 */
import type { Host } from './common.js'
import * as React from 'react'

/** Check capabilities before mounting a feature's hooks. */
export function missingCapabilities(ctx: Host, paths: string[]): string[] {
  return paths.filter(path => {
    try {
      let current = ctx
      for (const key of path.split('.')) current = current?.[key]
      return typeof current !== 'function'
    } catch { return true }
  })
}
export function CapabilityNotice({ missing }: { missing: string[] }): React.ReactElement {
  return React.createElement('section', { className: 'rc-error', role: 'alert' },
    React.createElement('p', null, `宿主未提供当前功能所需的服务：${missing.join('、')}。请检查 DSH 版本及相关插件是否启用。其他页面仍可使用。`),
    React.createElement('button', { onClick: () => location.reload() }, '重新加载'), ' ',
    React.createElement('a', { href: '/?ui=native' }, '打开原生界面'))
}
/** Resolve namespaces at call time so disabled/removed optional Host services fail locally. */
export async function callRemote(ctx: Host, namespace: string, method: string, ...args: Host[]): Promise<Host> {
  const service = ctx.remote?.[namespace]
  if (typeof service?.[method] !== 'function') throw new Error(`宿主未提供 ${namespace}.${method}，请检查 DSH 版本及相关插件是否启用，或打开原生界面。`)
  return service[method](...args)
}

export interface ChatContent { nodes: Host[]; partial: { blocks: Host[] } | null; runningCalls: Host[] }
const EMPTY_CHAT: ChatContent = { nodes: [], partial: null, runningCalls: [] }

/** The folded conversation of a chat target (`legacy` projection in rc.2). */
export function chatContent(chat: Host): ChatContent {
  const content = chat?.legacy
  if (!content || !Array.isArray(content.nodes)) return EMPTY_CHAT
  return {
    nodes: content.nodes,
    partial: content.partial && Array.isArray(content.partial.blocks) ? content.partial : null,
    runningCalls: Array.isArray(content.runningCalls) ? content.runningCalls : [],
  }
}

/** The approval or question a session is waiting on, if any. */
export function pendingInteraction(statuses: Host, sessionId: string): Host | undefined {
  return typeof statuses?.get === 'function' ? statuses.get(sessionId)?.pendingInteraction ?? undefined : undefined
}

/** What the plugin-page container needs from the Slots registry; undefined when this Host does not have it. */
export function slotRenderer(ctx: Host): { renderRoot: (host: Host, props: Host) => Host; face: Host } | undefined {
  const registry = ctx?.slots
  const renderer = registry?._renderer
  const face = typeof registry?.hostFace === 'function' ? registry.hostFace() : undefined
  if (typeof renderer?.renderRoot !== 'function' || typeof face?.specOf !== 'function') return undefined
  return { renderRoot: (host, props) => renderer.renderRoot(host, props), face }
}
