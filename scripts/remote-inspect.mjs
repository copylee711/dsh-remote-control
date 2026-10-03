import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const connection = JSON.parse(readFileSync('.qa/connection.json', 'utf8'))
const page = await browser.newPage()
await page.goto(connection.url)
const manage = (action, fields = {}) => page.evaluate(async ({ action, fields }) => (await fetch('/api/dsh-remote-control/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...fields }) })).json(), { action, fields })
await manage('stop'); await page.waitForTimeout(150)
await manage('preferences', { mode: 'lan' })
const status = await manage('start')
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const mobile = await context.newPage()
const errors = []
mobile.on('pageerror', error => errors.push(error.message))
mobile.on('response', response => { if (response.status() >= 400) errors.push(new URL(response.url()).pathname + ' HTTP ' + response.status()) }); mobile.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
await mobile.goto(status.links[0].url)
await mobile.getByText('等待电脑确认，请查看本机远程控制面板').waitFor()
await manage('approve', { id: (await manage('status')).requests[0].id })
await mobile.waitForURL(url => url.pathname === '/')
await mobile.waitForTimeout(4000); await mobile.getByRole('textbox', { name: '消息', exact: true }).fill('独立界面聊天验证'); await mobile.getByRole('button', { name: '发送消息', exact: true }).click(); await mobile.waitForTimeout(4000); await mobile.screenshot({ path: '.qa/v020-chat.png' }); await mobile.getByRole('button', { name: '打开会话列表', exact: true }).click(); await mobile.getByRole('button', { name: '设置与管理', exact: true }).click(); await mobile.getByRole('button', { name: /^通用设置/ }).click(); await mobile.waitForTimeout(1500); await mobile.screenshot({ path: '.qa/v020-settings.png' })
console.log(JSON.stringify({ text: (await mobile.locator('body').innerText()).slice(0,1200), errors }, null, 2))
if (await mobile.evaluate(() => !!globalThis.__DSH_RC_CONTEXT__)) {
  const info = await mobile.evaluate(async () => {
    const valueDummy = r => r.ok ? r.value : r; const ctx = globalThis.__DSH_RC_CONTEXT__
    const settings = await ctx.remote.settings.describe()
    const id = ctx.sessions.list.getSnapshot().ids[0]; const ref = ctx.sessions.retain(id, { source: "controllerOperation" }); const binding = await ref.ready; const view = ctx.uiConversation.binding(binding); const targets = ctx.uiConversation.views.entries().map(e => e.target); targets.forEach(t => view.activate(t)); const data = { remoteNames: Array.from(ctx.remote.namespaces.keys?.() ?? []), catalog: valueDummy(await ctx.remote.session.modelCatalog()), list: ctx.sessions.list.getSnapshot(), workspaces: ctx.workspaces.list.getSnapshot(), targets, targetData: Object.fromEntries(targets.map(t => [t, view.target(t).getSnapshot()])), session: binding.session.getSnapshot(), projections: binding.session.projections, remotes: Object.keys(ctx.remote.namespaces), slots: ctx.slots.snapshot() }; ref.release(); return data
  })
  writeFileSync('.qa/remote-inspect.json', JSON.stringify(info, null, 2))
  console.log('Host service snapshot saved privately')
}
await manage('stop')
await browser.close()




