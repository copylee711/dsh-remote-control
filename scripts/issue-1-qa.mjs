// Regression for #1 against an isolated real DSH Host. No external model calls.
import { chromium, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.DSH_QA_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const results = [], errors = []
const local = await browser.newPage()
await local.goto(JSON.parse(readFileSync(process.env.DSH_QA_CONNECTION || '.qa/connection.json', 'utf8')).url)
const manage = (action, fields = {}) => local.evaluate(async ({ action, fields }) => {
  const response = await fetch('/api/dsh-remote-control/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...fields }) })
  const data = await response.json(); if (!response.ok) throw new Error(data.error); return data
}, { action, fields })
const check = name => { results.push(name); console.log('PASS', name) }
try {
  await manage('stop'); await manage('preferences', { mode: 'lan', ui: 'custom' }); const status = await manage('start')
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message))
  expect((await context.request.get(status.links[0].base + '/?ui=native')).status()).toBe(403)
  check('native UI requires the same device pairing as custom UI')
  await page.goto(status.links[0].url)
  await page.getByText('等待电脑确认，请查看本机远程控制面板').waitFor()
  await manage('approve', { id: (await manage('status')).requests[0].id })
  await page.waitForURL(url => url.pathname === '/')
  await expect(page.locator('.rc-app')).toBeVisible()
  expect(await page.evaluate(() => ['sessions', 'workspaces', 'remote', 'uiConversation', 'conversation'].every(name => !!globalThis.__DSH_RC_CONTEXT__.get(name)))).toBe(true)
  expect(await page.evaluate(() => [...globalThis.__DSH_RC_CONTEXT__.loader.entries()].filter(entry => entry.fiber?.state !== 2).map(entry => entry.options.name))).toEqual([])
  await expect(page.locator('body')).not.toContainText("reading 'list'")
  check('all rc.2 client modules activate; sessions and workspace services reach the root')

  await page.getByRole('button', { name: '打开会话列表', exact: true }).click()
  await page.getByRole('button', { name: '设置与管理', exact: true }).click()
  await page.getByRole('button', { name: /^远程连接与设备/ }).click()
  const group = page.getByRole('group', { name: '手机界面', exact: true })
  await group.getByRole('button', { name: '原生界面', exact: true }).click()
  await expect.poll(async () => (await manage('status')).ui).toBe('native')
  await page.reload()
  await expect(page.locator('.rc-app')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '返回自定义界面', exact: true })).toBeVisible()
  // Official boot removes its loading layer only after the official renderer mounts.
  await expect(page.locator('[data-dsh-boot]')).toHaveCount(0, { timeout: 30000 })
  expect(await page.locator('#root').innerText()).not.toBe('')
  await page.screenshot({ path: '.qa/issue-1-native.png' })
  check('settings save native default; refresh mounts the official renderer without re-pairing')
  await page.getByRole('link', { name: '返回自定义界面', exact: true }).click()
  await expect(page.locator('.rc-app')).toBeVisible()
  expect((await manage('status')).ui).toBe('native')
  check('explicit custom URL overrides the native default without changing the saved preference')

  expect(await page.evaluate(() => {
    const impl = globalThis.__DSH_RC_CONTEXT__.reflect._getImpl('remote.agentPresets')
    if (!impl) return false
    impl.value = undefined; return true
  })).toBe(true)
  await page.getByRole('button', { name: '开始新会话', exact: true }).click()
  await page.getByRole('button', { name: '打开会话列表', exact: true }).click()
  await page.getByRole('button', { name: '文件与交付物', exact: true }).click()
  await page.getByRole('button', { name: '返回会话', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('agentPresets.list')
  await expect(page.getByRole('textbox', { name: '消息', exact: true })).toBeVisible()
  check('missing optional agentPresets is reported locally while the composer remains usable')
  await page.reload(); await expect(page.locator('.rc-app')).toBeVisible()

  // Fault injection stays within this isolated browser Context. Remove just the
  // generated namespace, retaining all other real Host/client services.
  expect(await page.evaluate(() => {
    const ctx = globalThis.__DSH_RC_CONTEXT__, impl = ctx.reflect._getImpl('remote.workspaceFiles')
    if (!impl) return false
    impl.value = undefined; return true
  })).toBe(true)
  await page.getByRole('button', { name: '打开会话列表', exact: true }).click()
  await page.getByRole('button', { name: '文件与交付物', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('remote.workspaceFiles.list')
  await expect(page.getByRole('link', { name: '打开原生界面', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '返回会话', exact: true })).toBeVisible()
  await page.waitForTimeout(350) // let the drawer closing transition finish before visual QA
  await page.screenshot({ path: '.qa/issue-1-missing-service.png' })
  check('missing workspaceFiles shows a feature-level notice and leaves navigation and native fallback usable')
  await page.getByRole('link', { name: '打开原生界面', exact: true }).click()
  await expect(page.locator('[data-dsh-boot]')).toHaveCount(0, { timeout: 30000 })
  await expect(page.getByRole('link', { name: '返回自定义界面', exact: true })).toBeVisible()
  check('fallback from a missing-service notice reaches the native UI')
  await manage('preferences', { ui: 'custom' })
  await page.goto(status.links[0].base + '/')
  await expect(page.locator('.rc-app')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '.qa/issue-1-custom.png' })
  expect(errors).toEqual([])
} catch (error) {
  process.exitCode = 1; console.error(error)
} finally {
  await manage('preferences', { ui: 'custom' }).catch(() => {})
  await manage('stop').catch(() => {}); await browser.close()
  writeFileSync(process.env.DSH_QA_ISSUE_RESULTS || '.qa/issue-1-results.json', JSON.stringify({ passed: !process.exitCode, results, errors }, null, 2))
}
