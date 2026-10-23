import * as React from 'react'
import * as JSX from 'react/jsx-runtime'
import * as ReactDOM from 'react-dom'
import * as ReactDOMClient from 'react-dom/client'
import * as Cordis from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import * as Store from '@deepseek-ai/dsh-client-store'
import * as Slots from '@deepseek-ai/dsh-client-ui-slots'
import * as Primitives from '@deepseek-ai/dsh-client-ui-primitives'
import * as Dockkit from '@deepseek-ai/dsh-client-ui-dockkit'
import * as Zod from 'zod'
import * as ReactVirtual from '@tanstack/react-virtual'
import { App } from './app.js'
import { Boundary } from './common.js'
import { REMOTE_CSS } from './style.js'

async function boot(): Promise<void> {
  const globals = globalThis as any
  await globals.__DSH_BOOT_READY__?.promise
  const modules = globals.__ModuleLoader__.create({ boot: globals.__DSH_BOOT__, staticModules: {
    react: React, 'react/jsx-runtime': JSX, 'react-dom': ReactDOM, 'react-dom/client': ReactDOMClient,
    '@deepseek-ai/cordis': Cordis, '@deepseek-ai/dsh-client-store': Store,
    '@deepseek-ai/dsh-client-ui-slots': Slots, '@deepseek-ai/dsh-client-ui-primitives': Primitives,
    '@deepseek-ai/dsh-client-ui-dockkit': Dockkit,
    zod: Zod, '@tanstack/react-virtual': ReactVirtual,
  } })
  const ctx = new Cordis.Context()
  await ctx.plugin(Loader)
  ctx.loader.internal = modules
  await modules.entries.start(ctx.loader, modules.manifest)
  await ctx.loader.await()
  // Loader.await settles failed/pending entries too. Never mistake settlement
  // for successful service activation (the original cause of issue #1).
  const unavailable = [...ctx.loader.entries()].filter(entry => entry.fiber?.state !== 2).map(entry => entry.options.name)
  const style = document.createElement('style'); style.textContent = REMOTE_CSS; document.head.append(style)
  // The official renderer is registered for extension compatibility but its
  // desktop AppFrame is never mounted. Our root owns all ordinary navigation.
  ReactDOMClient.createRoot(document.getElementById('root')!).render(React.createElement(Boundary, { what: '远程界面' },
    unavailable.length ? React.createElement('details', { className: 'rc-error' },
      React.createElement('summary', null, '部分宿主功能未加载，相关页面可能不可用'),
      React.createElement('p', null, unavailable.join('、')),
      React.createElement('a', { href: '/?ui=native' }, '打开原生界面')) : null,
    React.createElement(App, { ctx: ctx as any })))
  globals.__DSH_RC_CONTEXT__ = ctx
}
void boot().catch(error => {
  const root = document.getElementById('root')!
  root.replaceChildren()
  const message = document.createElement('p'); message.textContent = `远程界面加载失败：${error instanceof Error ? error.message : String(error)}`
  const retry = document.createElement('button'); retry.textContent = '重新加载'; retry.onclick = () => location.reload()
  const native = document.createElement('a'); native.href = '/?ui=native'; native.textContent = '打开原生界面'
  root.append(message, retry, native)
})
