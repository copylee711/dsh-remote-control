import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const qa = resolve('.qa'), connection = JSON.parse(readFileSync(resolve(qa, 'connection.json'), 'utf8'))
const browser = await chromium.launch({ executablePath: process.env.DSH_QA_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const errors = [], results = []
const local = await browser.newContext({ viewport: { width: 1280, height: 960 } })
const desktop = await local.newPage()
let management
desktop.on('pageerror', error => errors.push(`local: ${error.message}`))
desktop.on('console', message => { if (message.type() === 'error') errors.push(`local console: ${message.text()}`) })
try {
  await desktop.goto(connection.url); await desktop.waitForTimeout(4000)
  const onboarding = desktop.getByRole('button', { name: '继续', exact: true })
  if (await onboarding.isVisible()) { await onboarding.click(); await desktop.waitForTimeout(500) }
  management = async (action, fields = {}) => desktop.evaluate(async ({ action, fields }) => {
    const response = await fetch('/api/dsh-remote-control/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...fields }) }); return { status: response.status, data: await response.json() }
  }, { action, fields })
  const initial = await management('status'); results.push({ name: 'local authenticated management', status: initial.status, enabled: initial.data.enabled })
  if (initial.status !== 200) throw new Error(`management failed: ${JSON.stringify(initial)}`)
  await desktop.getByRole('button', { name: '远程控制', exact: true }).click({ timeout: 15000 })
  await desktop.getByRole('heading', { name: '远程控制', exact: true }).waitFor()
  await desktop.screenshot({ path: resolve(qa, 'panel-desktop.png'), fullPage: true })
  const mode = process.env.DSH_QA_MODE || 'lan'
  await management('stop'); await desktop.waitForTimeout(200)
  await management('preferences', { mode, proxy: process.env.DSH_QA_PROXY || '' }); let started = await management('start')
  if (mode === 'public') {
    const deadline = Date.now() + 150000
    while (started.data.phase !== 'ready' && started.data.phase !== 'error' && Date.now() < deadline) {
      console.log('Public tunnel:', started.data.phase)
      await desktop.waitForTimeout(3000); started = await management('status')
    }
    results.push({ name: 'public tunnel validation', phase: started.data.phase, error: started.data.error })
  }
  if (!started.data.enabled || !started.data.links?.[0]?.url) throw new Error(`${mode} start failed: ${started.data.error || started.data.phase}`)
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1' })
  const mobile = await mobileContext.newPage()
  mobile.on('pageerror', error => errors.push(`mobile: ${error.message}`))
  mobile.on('console', message => { if (message.type() === 'error' && !message.text().includes('status of 403')) errors.push(`mobile console: ${message.text()}`) })
  const rejectedResources = []
  mobile.on('response', response => { if (response.status() >= 400) rejectedResources.push({ path: new URL(response.url()).pathname, status: response.status() }) })
  await mobile.goto(started.data.links[0].url)
  await mobile.getByText('等待电脑确认，请查看本机远程控制面板').waitFor()
  const waiting = await management('status'); results.push({ name: 'pair waits for local approval', pending: waiting.data.requests.length })
  await desktop.screenshot({ path: resolve(qa, 'panel-request.png'), fullPage: true })
  await management('approve', { id: waiting.data.requests[0].id })
  await mobile.waitForURL(url => url.pathname === '/', { timeout: 15000 }); await mobile.waitForTimeout(5000)
  const mobileOnboarding = mobile.getByRole('button', { name: '继续', exact: true })
  if (await mobileOnboarding.isVisible()) await mobileOnboarding.click()
  await mobile.screenshot({ path: resolve(qa, 'official-mobile.png'), fullPage: true })
  const remoteStatus = await mobile.evaluate(async () => { const response = await fetch('/api/dsh-remote-control/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'status' }) }); return { status: response.status, data: await response.json() } })
  results.push({ name: 'remote management and host grant', status: remoteStatus.status, local: remoteStatus.data.local, title: await mobile.title(), hostGrant: await mobile.evaluate(() => globalThis.__DSH_TRANSPORT__?.ownsHost) })
  const urls = [], responses = []
  const promptRequests = []
  mobile.on('request', request => { if (new URL(request.url()).pathname === '/api/session/prompt') promptRequests.push(request.postDataJSON()) })
  mobile.on('websocket', ws => urls.push(new URL(ws.url()).pathname))
  mobile.on('response', response => { if (new URL(response.url()).pathname.startsWith('/api/')) responses.push({ path: new URL(response.url()).pathname, status: response.status() }) })
  await mobile.reload(); await mobile.waitForTimeout(4000)
  results.push({ name: 'official WS mux reconnect', paths: urls, failures: responses.filter(response => response.status >= 400) })
  const editor = mobile.locator('[contenteditable="true"]').first()
  await editor.fill('验证远程消息')
  await mobile.getByRole('button', { name: '发送消息', exact: true }).click()
  await mobile.getByText('远程链路验证通过：这条回复由隔离 DSH 的本地测试模型逐段生成。', { exact: false }).first().waitFor({ timeout: 30000 })
  results.push({ name: 'real DSH session prompt and streamed local-model reply', passed: true })
  const uploadResponse = mobile.waitForResponse(response => new URL(response.url()).pathname === '/api/session/uploadFileBinary', { timeout: 15000 })
  await mobile.locator('input[type="file"]').first().setInputFiles({ name: 'remote-qa.txt', mimeType: 'text/plain', buffer: Buffer.from('真实 DSH 二进制上传验证\n') })
  const uploaded = await uploadResponse
  if (!uploaded.ok()) throw new Error(`Real upload failed: ${uploaded.status()}`)
  results.push({ name: 'real DSH binary file upload', status: uploaded.status(), response: await uploaded.json() })
  if (process.env.DSH_QA_APPROVAL === '1') {
    const executionFile = resolve(qa, 'approval-executions.jsonl')
    const executionCount = () => existsSync(executionFile) ? readFileSync(executionFile, 'utf8').trim().split('\n').filter(Boolean).length : 0
    const beforeApproval = executionCount()
    await editor.fill('验证工具审批')
    await mobile.getByRole('button', { name: '发送消息', exact: true }).click()
    await mobile.waitForTimeout(3000)
    await mobile.screenshot({ path: resolve(qa, 'approval-mobile.png'), fullPage: true })
    const approval = mobile.getByRole('button', { name: '允许一次', exact: true })
    await approval.waitFor({ timeout: 15000 }); await approval.click()
    await approval.waitFor({ state: 'hidden', timeout: 15000 }); await mobile.waitForTimeout(1500)
    await mobile.screenshot({ path: resolve(qa, 'approval-result-mobile.png'), fullPage: true })
    writeFileSync(resolve(qa, 'approval-result-text.txt'), await mobile.locator('body').innerText())
    if (executionCount() !== beforeApproval + 1) throw new Error('Approval did not execute exactly once in the Host')
    results.push({ name: 'real DSH remote one-time tool approval', passed: true, executionCount: 1 })
  }
  await mobile.screenshot({ path: resolve(qa, 'official-mobile-chat.png'), fullPage: true })
  console.log('Session route:', new URL(mobile.url()).pathname)
  results.push({ name: 'resource failures before revocation', resources: [...rejectedResources] })
  const preRevocationErrors = [...errors]
  if (preRevocationErrors.length) throw new Error('Official UI reported errors before revocation')
  await mobile.getByRole('button', { name: '设置', exact: true }).click()
  await mobile.waitForTimeout(1000)
  if (!(await mobile.locator('body').innerText()).includes('远程控制')) throw new Error('Remote settings did not load')
  results.push({ name: 'official remote settings opens with plugin section', passed: true })
  await mobile.screenshot({ path: resolve(qa, 'official-mobile-settings.png'), fullPage: true })
  const deviceId = (await mobileContext.cookies()).find(cookie => cookie.name === 'dsh_rc').value.split('.')[0]
  await management('revoke', { id: deviceId }); await mobile.waitForTimeout(300)
  const denied = await mobile.evaluate(async () => (await fetch('/api/dsh-remote-control/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'status' }) })).status)
  results.push({ name: 'revocation denies existing browser', status: denied })
  if (denied !== 403) throw new Error(`Revocation did not deny access: ${denied}`)
  await management('stop'); await mobileContext.close()
  writeFileSync(resolve(qa, 'browser-results.json'), JSON.stringify({ results, preRevocationErrors, expectedRevocationErrors: errors }, null, 2)); console.log(JSON.stringify({ results, preRevocationErrors, expectedRevocationErrors: errors }, null, 2))
} catch (error) {
  await desktop.screenshot({ path: resolve(qa, 'failure.png'), fullPage: true }).catch(() => {})
  writeFileSync(resolve(qa, 'browser-results.json'), JSON.stringify({ results, errors, failure: error.message }, null, 2)); console.log(JSON.stringify({ results, errors, failure: error.message }, null, 2)); process.exitCode = 1
} finally { if (management) { await management('stop').catch(() => {}); await desktop.waitForTimeout(300).catch(() => {}) }; await browser.close() }
