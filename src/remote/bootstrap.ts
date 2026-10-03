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
import { App } from './app.js'
import { REMOTE_CSS } from './style.js'

async function boot(): Promise<void> {
  const globals = globalThis as any
  await globals.__DSH_BOOT_READY__?.promise
  const modules = globals.__ModuleLoader__.create({ boot: globals.__DSH_BOOT__, staticModules: {
    react: React, 'react/jsx-runtime': JSX, 'react-dom': ReactDOM, 'react-dom/client': ReactDOMClient,
    '@deepseek-ai/cordis': Cordis, '@deepseek-ai/dsh-client-store': Store,
    '@deepseek-ai/dsh-client-ui-slots': Slots, '@deepseek-ai/dsh-client-ui-primitives': Primitives,
    '@deepseek-ai/dsh-client-ui-dockkit': Dockkit,
  } })
  const ctx = new Cordis.Context()
  await ctx.plugin(Loader)
  ctx.loader.internal = modules
  await modules.entries.start(ctx.loader, modules.manifest)
  await ctx.loader.await()
  const style = document.createElement('style'); style.textContent = REMOTE_CSS; document.head.append(style)
  // The official renderer is registered for extension compatibility but its
  // desktop AppFrame is never mounted. Our root owns all ordinary navigation.
  ReactDOMClient.createRoot(document.getElementById('root')!).render(React.createElement(App, { ctx: ctx as any }))
  globals.__DSH_RC_CONTEXT__ = ctx
}
void boot().catch(error => {
  const root = document.getElementById('root')!
  root.replaceChildren()
  const message = document.createElement('p'); message.textContent = `远程界面加载失败：${error instanceof Error ? error.message : String(error)}`
  const retry = document.createElement('button'); retry.textContent = '重新加载'; retry.onclick = () => location.reload()
  root.append(message, retry)
})
