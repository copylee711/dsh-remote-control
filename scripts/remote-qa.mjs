// Real DSH runtime and APIs, isolated profile, deterministic QA model. No user data.
import { chromium, expect } from '@playwright/test'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const connection = JSON.parse(readFileSync(process.env.DSH_QA_CONNECTION || '.qa/connection.json', 'utf8'))
const browser = await chromium.launch({ executablePath: process.env.DSH_QA_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, ...(process.env.DSH_QA_PROXY ? { proxy: { server: process.env.DSH_QA_PROXY, bypass: '127.0.0.1,localhost,192.168.*' } } : {}) })
const results = [], errors = [], interruptedRequests = []
let deliberateDisconnect = false
const local = await browser.newPage()
await local.goto(connection.url)
const manage = (action, fields = {}) => local.evaluate(async ({ action, fields }) => {
  const response = await fetch('/api/dsh-remote-control/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...fields }) })
  const data = await response.json(); if (!response.ok) throw new Error(data.error); return data
}, { action, fields })
const check = (name, details = {}) => { results.push({ name, passed: true, ...details }); console.log('PASS', name) }
try {
  await manage('stop'); await local.waitForTimeout(200); await manage('preferences', { mode: process.env.DSH_QA_MODE || 'lan', proxy: process.env.DSH_QA_PROXY || '' }); await manage('start')
  await expect.poll(async () => { const state = await manage('status'); if (state.phase === 'error') throw new Error(state.error); return state.phase }, { timeout: 140000, intervals: [1000] }).toBe('ready')
  const initial = await manage('status')
  const changed = await manage('preferences', { mode: initial.activeMode === 'lan' ? 'public' : 'lan' })
  expect(changed.activeMode).toBe(initial.activeMode); expect(changed.gatewayPort).toBe(initial.gatewayPort); expect(changed.links).toEqual(initial.links); expect(changed.qr).toBe(initial.qr)
  await manage('preferences', { mode: initial.activeMode }); check('mode selection preserves live gateway and QR')
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage(); page.setDefaultTimeout(20000)
  page.on('pageerror', e => errors.push(e.message))
  page.on('response', response => { if (response.status() >= 500) (deliberateDisconnect ? interruptedRequests : errors).push(`${new URL(response.url()).pathname}: HTTP ${response.status()}`) })
  expect((await context.request.get(initial.links[0].base + '/api/remote.mux')).status()).toBe(403)
  await page.goto(initial.links[0].url)
  await page.getByText('等待电脑确认，请查看本机远程控制面板').waitFor()
  expect((await context.request.get(initial.links[0].base + '/')).status()).toBe(403)
  const requests = (await manage('status')).requests
  await manage('approve', { id: requests.at(-1).id }); await page.waitForURL(url => url.pathname === '/')
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor(); check('unauthorized gate, waiting page, local approval, standalone app boot')
  const send = async text => { await page.getByRole('textbox', { name: '消息', exact: true }).fill(text); await page.getByRole('button', { name: '发送消息', exact: true }).click() }
  // New session keeps tool tests independent of earlier approval history.
  await page.getByRole('button', { name: '打开会话列表', exact: true }).click()
  await page.getByRole('button', { name: '新会话', exact: true }).click()
  await send('独立远程界面聊天验证')
  await page.getByText('远程链路验证通过：这条回复由隔离 DSH 的本地测试模型逐段生成。', { exact: true }).waitFor()
  check('create, submit and live response through real DSH session services')
  await page.getByRole('combobox', { name: '会话模型' }).selectOption('remote-qa/qa-model'); check('model selector commits host selection')
  const before = existsSync('.qa/approval-executions.jsonl') ? readFileSync('.qa/approval-executions.jsonl', 'utf8').trim().split('\n').length : 0
  await send('验证工具审批')
  await page.getByRole('button', { name: '允许这一次', exact: true }).waitFor()
  await page.getByRole('button', { name: '允许这一次', exact: true }).click()
  await expect(page.getByRole('button', { name: '允许这一次', exact: true })).toHaveCount(0)
  await expect.poll(() => readFileSync('.qa/approval-executions.jsonl', 'utf8').trim().split('\n').length).toBe(before + 1)
  check('tool approval reaches host once')
  await page.locator('input[type=file]').setInputFiles({ name: 'remote-qa.txt', mimeType: 'text/plain', buffer: Buffer.from('独立远程上传验证') })
  await send('这条消息附带文件')
  await expect(page.getByRole('button', { name: '停止生成', exact: true })).toHaveCount(0, { timeout: 15000 })
  check('binary attachment upload and prompt admission')
  await page.getByRole('button', { name: '打开会话列表', exact: true }).click(); await page.getByRole('button', { name: '新会话', exact: true }).click()
  await send('验证用户问题')
  await page.getByRole('checkbox', { name: /选项甲/ }).check(); await page.getByRole('checkbox', { name: /选项乙/ }).check()
  await page.getByRole('button', { name: '提交回答', exact: true }).click()
  await expect(page.getByRole('button', { name: '提交回答', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '停止生成', exact: true })).toHaveCount(0, { timeout: 15000 })
  check('host user question accepts a multi-select answer')
  await page.getByRole('button', { name: '会话操作', exact: true }).click(); await page.getByRole('button', { name: '重命名', exact: true }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('QA 重命名会话'); await page.getByRole('button', { name: '确认', exact: true }).click()
  await page.getByText('会话已重命名', { exact: true }).waitFor()
  await page.getByRole('main').getByRole('button', { name: '归档会话', exact: true }).click(); await page.getByText('已归档', { exact: true }).waitFor()
  await page.getByRole('button', { name: '打开会话列表', exact: true }).click(); await page.getByRole('complementary').getByRole('button', { name: '归档会话', exact: true }).click()
  await page.getByRole('button', { name: 'QA 重命名会话', exact: true }).click(); await page.getByRole('button', { name: '会话操作', exact: true }).click()
  await page.getByRole('button', { name: '恢复会话', exact: true }).click(); await page.getByText('已恢复', { exact: true }).waitFor(); await page.getByRole('button', { name: '返回会话', exact: true }).first().click()
  check('rename, archive and restore through host services')
  deliberateDisconnect = true
  await context.setOffline(true); await page.waitForTimeout(1000); expect(await page.locator('#dsh-rc-disconnected').count()).toBe(0); await context.setOffline(false)
  await expect.poll(() => page.evaluate(async () => { try { return (await globalThis.__DSH_RC_CONTEXT__.remote.session.modelCatalog()).ok } catch { return false } }), { timeout: 20000 }).toBe(true)
  await page.waitForTimeout(1000); deliberateDisconnect = false
  const replies = await page.locator('.rc-message.assistant').count(); await send('恢复网络后的消息')
  await expect.poll(() => page.locator('.rc-message.assistant').count(), { timeout: 15000 }).toBeGreaterThan(replies)
  await expect(page.getByRole('button', { name: '停止生成', exact: true })).toHaveCount(0)
  check('network loss restores live APIs and prompt admission without replay')
  await send('验证长代码'); await expect(page.locator('.rc-chat pre').last()).toContainText('x'.repeat(100))
  for (const width of [360, 390, 430]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: `.qa/v020-chat-${width}.png` }) }
  await page.setViewportSize({ width: 390, height: 844 }); check('long Markdown code stays inside mobile scrolling viewport')
  const input = page.getByRole('textbox', { name: '消息', exact: true }); await input.fill('中文组合输入验证')
  const messagesBeforeComposition = await page.locator('.rc-message.user').count()
  await input.dispatchEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true }); await page.waitForTimeout(200)
  expect(await page.locator('.rc-message.user').count()).toBe(messagesBeforeComposition)
  await input.press('Enter'); await expect(input).toHaveValue('中文组合输入验证\n'); await input.fill(''); check('IME composition does not submit; Enter inserts newline')
  writeFileSync('.qa/workspace/deepseek-harness/default-workspace/remote-qa-preview.txt', '文件预览与下载内容验证')
  await page.getByRole('button', { name: '打开会话列表', exact: true }).click(); await page.getByRole('button', { name: '文件与交付物', exact: true }).click()
  const fileCard = page.locator('.rc-card').filter({ hasText: 'remote-qa-preview.txt' })
  await fileCard.first().getByRole('button', { name: '预览', exact: true }).click(); await page.getByText('文件预览与下载内容验证', { exact: true }).waitFor()
  const downloaded = page.waitForEvent('download'); await fileCard.first().getByRole('button', { name: '下载', exact: true }).click(); const file = await downloaded
  expect(readFileSync(await file.path(), 'utf8')).toBe('文件预览与下载内容验证'); check('workspace file list, text preview and binary download content')
  await page.getByRole('button', { name: '返回会话', exact: true }).click()
  const openSettings = async () => { await page.getByRole('button', { name: '打开会话列表', exact: true }).click(); await page.getByRole('button', { name: '设置与管理', exact: true }).click() }
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor(); await page.waitForTimeout(400); await page.screenshot({ path: '.qa/v020-chat.png' })
  await openSettings(); await page.getByRole('button', { name: /^通用设置/ }).click()
  await page.locator('[data-namespace=ui-theme]').waitFor()
  const themeCard = page.locator('[data-namespace=ui-theme]')
  await themeCard.getByRole('combobox').selectOption('light'); await themeCard.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForTimeout(500); check('schema settings form writes with expected revision')
  await page.screenshot({ path: '.qa/v020-settings.png' })
  await page.getByRole('button', { name: '‹ 返回设置分类', exact: true }).click(); await page.getByRole('button', { name: /^模型与凭据/ }).click()
  await page.getByRole('textbox', { name: '凭据引用', exact: true }).fill('REMOTE_CONTROL_QA_ONLY')
  await page.getByLabel('新密钥', { exact: true }).fill('qa-only-non-production-secret')
  await page.getByRole('button', { name: '保存凭据', exact: true }).click(); await page.getByText('凭据已保存', { exact: true }).waitFor()
  expect(await page.getByLabel('新密钥', { exact: true }).inputValue()).toBe('')
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('qa-only-non-production-secret')
  check('credential write clears secret and keeps it out of persistent browser storage')
  await page.getByRole('button', { name: '‹ 返回设置分类', exact: true }).click()
  await page.getByRole('button', { name: /^插件与安装任务/ }).click(); await page.getByText('@copylee/dsh-remote-control', { exact: false }).first().waitFor(); check('plugin inventory')
  if (process.env.DSH_QA_INSTALL === '1') {
    await page.getByRole('textbox', { name: '安装插件', exact: true }).fill(new URL('../.qa/install-fixture', import.meta.url).pathname.replace(/^\//, '').replaceAll('/', '\\'))
    await page.getByRole('button', { name: '检查并安装', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click()
    await page.waitForFunction(() => document.body.textContent.includes('安装任务已完成') || document.querySelector('.rc-error'), undefined, { timeout: 120000 })
    if (await page.locator('.rc-error').count()) throw new Error(await page.locator('.rc-error').first().innerText())
    await page.getByText('安装任务已完成', { exact: true }).waitFor()
    const fixture = page.locator('section.rc-card').filter({ has: page.getByRole('heading', { name: '@copylee/remote-control-qa-fixture', exact: true }) })
    await fixture.getByRole('button', { name: '停用', exact: true }).click(); await fixture.getByRole('button', { name: '启用', exact: true }).waitFor()
    await fixture.getByRole('button', { name: '启用', exact: true }).click(); await fixture.getByRole('button', { name: '停用', exact: true }).waitFor()
    await fixture.getByRole('button', { name: '卸载', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click(); await expect(fixture).toHaveCount(0, { timeout: 120000 })
    check('isolated local plugin install, disable, enable and removal')
  }
  await page.getByRole('button', { name: '‹ 返回设置分类', exact: true }).click()
  for (const title of ['电脑控制', '网络代理']) {
    const entry = page.getByRole('button', { name: new RegExp(title) })
    if (!(await entry.count())) { results.push({ name: `compat ${title}`, passed: false, reason: 'not loaded in QA profile' }); continue }
    await entry.click(); await page.waitForTimeout(700)
    expect(await page.locator('.rc-compat').innerText()).not.toContain('暂时无法')
    await page.screenshot({ path: `.qa/v020-compat-${title === '电脑控制' ? 'computer' : 'proxy'}.png` })
    check(`custom plugin compatibility: ${title}`)
    await page.getByRole('button', { name: '‹ 返回设置分类', exact: true }).click()
  }
  await page.getByRole('button', { name: /^自动化/ }).click(); await page.waitForTimeout(500)
  const count = await page.evaluate(async () => (await globalThis.__DSH_RC_CONTEXT__.remote.schedule.catalog()).value.length)
  await page.getByRole('textbox', { name: '任务名称', exact: true }).fill('remote-control QA 每日任务')
  await page.getByRole('textbox', { name: '指令', exact: true }).fill('隔离环境测试任务')
  await page.getByRole('button', { name: '创建每日任务', exact: true }).click(); await page.getByText('任务已创建', { exact: true }).waitFor()
  await expect.poll(() => page.evaluate(async () => (await globalThis.__DSH_RC_CONTEXT__.remote.schedule.catalog()).value.length)).toBe(count + 1)
  const task = page.locator('section.rc-card').filter({ has: page.getByRole('heading', { name: 'remote-control QA 每日任务', exact: true }) })
  await task.getByRole('button', { name: '编辑指令', exact: true }).click(); await page.getByRole('dialog').getByRole('textbox').fill('隔离环境修改后的任务'); await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click()
  await task.getByText('隔离环境修改后的任务', { exact: true }).waitFor()
  await task.getByRole('button', { name: '执行记录', exact: true }).click(); await page.getByText('暂无保存的执行记录', { exact: true }).waitFor()
  await task.getByRole('button', { name: '删除', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click(); await expect(task).toHaveCount(0)
  check('automation create, catalog, update, history and delete on isolated host')
  for (const width of [360, 390, 430, 844]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `.qa/v020-${width}.png` }); check(`viewport ${width} no document overflow`)
  }
  await page.getByRole('button', { name: '返回会话', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  const composer = page.getByRole('textbox', { name: '消息', exact: true })
  await composer.fill('草稿恢复验证'); await page.reload(); await expect(composer).toHaveValue('草稿恢复验证'); check('draft survives reload without replaying prompt')
  await page.getByRole('button', { name: '打开会话列表', exact: true }).click(); await page.getByRole('combobox', { name: '界面主题' }).selectOption('dark'); await page.getByRole('button', { name: '关闭导航' }).click(); await page.screenshot({ path: '.qa/v020-dark.png' }); check('dark theme')
  const granted = (await manage('status')).devices.find(device => device.online)
  deliberateDisconnect = true
  await manage('revoke', { id: granted.id }); await page.waitForTimeout(300)
  expect((await context.request.get(initial.links[0].base + '/api/remote.mux')).status()).toBe(403); check('revocation blocks further host reads')
  expect(errors).toEqual([])
} catch (error) {
  const failingPage = browser.contexts().flatMap(c => c.pages()).at(-1); if (failingPage) { await failingPage.screenshot({ path: '.qa/v020-failure.png' }); console.error((await failingPage.locator('.rc-error').allTextContents()).join(' | ')) }; results.push({ name: 'QA failure', passed: false, reason: error.message }); console.error(error.message); process.exitCode = 1
} finally {
  await manage('stop').catch(() => {}); await browser.close()
  writeFileSync(process.env.DSH_QA_RESULTS || '.qa/v020-results.json', JSON.stringify({ host: process.env.DSH_QA_LABEL || 'real isolated DSH web rc.2; deterministic QA model', results, errors, interruptedRequests }, null, 2))
}



