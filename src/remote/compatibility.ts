import * as React from 'react'
import type { Host } from './common.js'

/**
 * DSH rc.2 exposes only a root renderer, not a standalone plugin-page outlet.
 * This narrowly scoped adapter gives that renderer a virtual root declaring
 * settings.section. All locale, stores, scope adapters, factories, injection,
 * registration lifetimes and error handling still come from the real registry.
 * Keep this version-sensitive bridge here; ordinary remote pages never use it.
 */
export function PluginPage({ ctx, entry }: { ctx: Host; entry: Host }): React.ReactElement {
  const tree = React.useMemo(() => {
    const registry = ctx.slots
    const renderer = registry._renderer
    const original = registry.hostFace?.()
    if (!renderer?.renderRoot || !original) throw new Error('宿主版本未提供兼容页面所需的渲染接口')
    const section = original.specOf('settings.section')
    const root = {
      options: { name: 'root', id: 'remote-plugin-container' },
      children: { 'settings.section': section },
      component: (props: Host) => props.renderSlot('settings.section', {}, { only: entry.options.id }),
    }
    const roots = [root]
    const host = new Proxy(original, { get(target, key) {
      if (key === 'entriesOf' || key === 'entriesOfSlot') return (name: string) => name === 'root' ? roots : target[key](name)
      if (key === 'isLive') return (item: Host) => item === root || target.isLive(item)
      if (key === 'storeOf') return (item: Host, scope: Host) => item === root ? undefined : target.storeOf(item, scope)
      return Reflect.get(target, key)
    } })
    return renderer.renderRoot(host, {})
  }, [ctx, entry])
  return React.createElement(React.Fragment, null, tree)
}
