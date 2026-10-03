// Helper for testing on an Android emulator or a phone over adb.
// Starts the "same Wi-Fi" connection on the isolated QA host, prints a pairing link
// for 127.0.0.1 (reach it from the device with `adb reverse tcp:<port> tcp:<port>`),
// then approves pairing requests for a while. A screenshot of the computer-side
// page is saved while a request is waiting, to check the request popup.
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
const connection = JSON.parse(readFileSync(process.env.DSH_QA_CONNECTION || '.qa/connection.json', 'utf8'))
const browser = await chromium.launch({ executablePath: process.env.DSH_QA_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const local = await browser.newPage({ viewport: { width: 1100, height: 760 } })
await local.goto(connection.url)
const manage = (action, fields = {}) => local.evaluate(async ({ action, fields }) => {
  const response = await fetch('/api/dsh-remote-control/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...fields }) })
  const data = await response.json(); if (!response.ok) throw new Error(data.error); return data
}, { action, fields })
await manage('stop'); await local.waitForTimeout(300)
await manage('preferences', { mode: 'lan' }); await manage('start')
const status = await manage('refresh')
const token = new URL(status.links[0].url).hash
const link = `http://127.0.0.1:${status.gatewayPort}/pair${token}`
writeFileSync('.qa/phone.json', JSON.stringify({ port: status.gatewayPort, link }), { mode: 0o600 })
console.log(`PORT ${status.gatewayPort}`)
const until = Date.now() + Number(process.env.DSH_QA_WAIT || 600) * 1000
let shot = false
while (Date.now() < until) {
  const waiting = await manage('requests')
  if (waiting.requests.length) {
    if (!shot) { await local.waitForTimeout(3500); await local.screenshot({ path: '.qa/phone-popup-desktop.png' }); shot = true; console.log('POPUP', await local.locator('dialog.dsrc-prompt[open]').count()) }
    for (const request of waiting.requests) { await manage('approve', { id: request.id }); console.log('APPROVED', request.name) }
  }
  await local.waitForTimeout(1000)
}
await browser.close()
