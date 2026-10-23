// Real isolated Host smoke test; the update control is a browser-only stand-in.
// No update check/download/install is triggered.
import { chromium, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.DSH_QA_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(JSON.parse(readFileSync(process.env.DSH_QA_CONNECTION || '.qa/desktop-connection.json', 'utf8')).url)
  const entry = page.getByRole('button', { name: '远程控制', exact: true })
  await expect(entry).toBeVisible()
  const onboarding = page.getByRole('button', { name: '继续', exact: true })
  await onboarding.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
  if (await onboarding.isVisible()) await onboarding.click()
  expect(await entry.evaluate(node => getComputedStyle(node).position)).toBe('relative')
  await entry.click()
  await expect(page.getByRole('heading', { name: '远程控制', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '关闭远程控制面板', exact: true }).click()
  await page.evaluate(() => {
    const entry = document.querySelector('.dsrc-entry'), account = entry.closest('[class*="triggerRow"]')
    if (!account) throw new Error('Remote control must share the native account row')
    const update = document.createElement('button'); update.id = 'qa-update'; update.textContent = '↑'; update.setAttribute('aria-label', 'Desktop 更新占位')
    update.style.cssText = 'flex:none;width:36px;height:36px;background:white;border:1px solid #bbb;border-radius:8px'
    update.onclick = () => update.dataset.clicked = 'true'
    account.append(update)
  })
  for (const visible of [true, false, true]) {
    await page.locator('#qa-update').evaluate((node, visible) => node.hidden = !visible, visible)
    if (visible) {
      const a = await entry.boundingBox(), b = await page.locator('#qa-update').boundingBox()
      expect(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y).toBe(false)
      expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThan(1)
      expect(a.x + a.width).toBeLessThanOrEqual(b.x)
      await page.locator('#qa-update').click()
      await expect(page.locator('#qa-update')).toHaveAttribute('data-clicked', 'true')
    }
    await entry.click(); await expect(page.getByRole('heading', { name: '远程控制', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '关闭远程控制面板', exact: true }).click()
  }
  await page.getByRole('button', { name: '收起侧边栏', exact: true }).click()
  await expect(page.locator('.dsrc-inline-action')).toHaveCount(0)
  await expect(entry).toBeVisible()
  await page.getByRole('button', { name: '打开侧边栏', exact: true }).click()
  await expect(page.locator('.dsrc-inline-action .dsrc-entry')).toBeVisible()
  await expect(page.locator('.dsrc-entry')).toHaveCount(1)
  await page.waitForTimeout(250)
  await page.screenshot({ path: '.qa/sidebar-entry-host.png' })
  console.log('PASS real isolated Host: same-row alignment, panel controls, update visibility changes, collapse/expand and no duplicate entry')
} finally { await browser.close() }
