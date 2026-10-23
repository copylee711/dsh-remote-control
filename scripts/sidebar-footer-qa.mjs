// Geometry regression for the remote entry sharing the Desktop footer.
// Uses the production component/CSS and the official 0.2.1-rc.2 sidebar CSS.
import { chromium, expect } from '@playwright/test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { apply } from '../lib/types/client/index.js'
import { CSS } from '../lib/types/client/style.js'
import { mountInlineSidebarAction } from '../lib/types/client/sidebar-action.js'
const require = createRequire(import.meta.url)
mkdirSync('.qa', { recursive: true })
// Sidebar is a transitive dependency of the real DSH test runtime.
const webRequire = createRequire(require.resolve('@deepseek-ai/dsh/package.json'))
const appRequire = createRequire(webRequire.resolve('@deepseek-ai/dsh-web-app/package.json'))
const source = readFileSync(appRequire.resolve('@deepseek-ai/dsh-client-ui-sidebar/client'), 'utf8')
const officialCSS = JSON.parse(source.match(/const css = ("(?:[^"\\]|\\.)*");/)[1])
const sidebarClass = key => source.match(new RegExp(`"${key}": "([^"]+)"`))[1]
const settingsSource = readFileSync(appRequire.resolve('@deepseek-ai/dsh-client-ui-settings-general/client'), 'utf8')
const settingsCSS = [...settingsSource.matchAll(/const css(?:\$\d+)? = ("(?:[^"\\]|\\.)*");/g)].map(match => JSON.parse(match[1])).join('\n')
const triggerRowClass = settingsSource.match(/"triggerRow": "([^"]+)"/)[1]
let renderEntry
apply({ effect() {}, slots: { inject(_name, setup) { setup() }, register(meta, render) { if (meta.name === 'sidebar.footer.action') renderEntry = render } } })
const browser = await chromium.launch({ executablePath: process.env.DSH_QA_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const checks = []
try {
  const page = await browser.newPage()
  for (const wide of [true, false]) {
    for (const width of wide ? [260, 320] : [56]) {
      await page.evaluate(() => globalThis.qaFooterCleanup?.())
      await page.setContent(`<style>${officialCSS}\n${settingsCSS}\n${CSS}
        body{margin:0;font:14px system-ui} #fixture{width:${width}px;height:240px;display:flex;flex-direction:column;justify-content:flex-end;background:#f8f9fa}
        #account{height:56px;box-sizing:border-box;width:100%;margin:0}
        #launcher{flex:1;min-width:0;border:0;background:transparent;text-align:left;height:36px}
        #update{flex:none;width:36px;height:36px;border:0;border-radius:8px}
        #update[hidden]{display:none} .fixture-collapsed #account{padding:0;justify-content:center}
        </style><div id="fixture" class="${wide ? '' : `${sidebarClass('collapsed')} fixture-collapsed`}">
          <div class="${sidebarClass('footArea')}">
            <div class="${sidebarClass('footerActions')}"><div>${renderToStaticMarkup(renderEntry({ wide }))}</div></div>
            <div class="${sidebarClass('settingsArea')}"><div id="account" class="${triggerRowClass}"><button id="launcher">${wide ? 'Copy' : '···'}</button><button id="update" aria-label="Desktop 更新" hidden>↑</button></div></div>
          </div></div>`)
      if (wide) await page.evaluate(fn => {
        const mount = (0, eval)(`(${fn})`), anchor = document.querySelector('.dsrc-entry-anchor'), button = document.querySelector('.dsrc-entry')
        globalThis.qaFooterCleanup = mount(anchor, target => (target ?? anchor).append(button))
      }, mountInlineSidebarAction.toString())
      for (const visible of [false, true, false, true]) {
        await page.locator('#update').evaluate((node, visible) => { node.hidden = !visible }, visible)
        const remote = await page.getByRole('button', { name: '远程控制', exact: true }).boundingBox()
        expect(remote.width).toBeGreaterThanOrEqual(36)
        expect(remote.x).toBeGreaterThanOrEqual(0)
        expect(remote.x + remote.width).toBeLessThanOrEqual(width)
        if (visible) {
          const update = await page.locator('#update').boundingBox()
          const intersects = remote.x < update.x + update.width && remote.x + remote.width > update.x && remote.y < update.y + update.height && remote.y + remote.height > update.y
          expect(intersects, `remote entry must not cover Desktop update (${wide ? 'wide' : 'collapsed'}, ${width}px)`).toBe(false)
          if (wide) {
            expect(Math.abs(remote.y + remote.height / 2 - update.y - update.height / 2)).toBeLessThan(1)
            expect(remote.x + remote.width).toBeLessThanOrEqual(update.x)
          }
          expect(await page.locator('.dsrc-entry').evaluate(node => getComputedStyle(node).position)).toBe('relative')
          for (const control of ['.dsrc-entry', '#update']) expect(await page.locator(control).evaluate(node => {
            const box = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
          })).toBe(true)
        }
        checks.push({ wide, width, updateVisible: visible })
      }
      await page.getByRole('button', { name: '远程控制', exact: true }).focus()
      await expect(page.getByRole('button', { name: '远程控制', exact: true })).toBeFocused()
      await page.screenshot({ path: `.qa/sidebar-footer-${wide ? width : 'collapsed'}.png` })
    }
  }
  console.log(`PASS ${checks.length} footer layout states; production entry remains in flow and both controls are reachable`)
} finally {
  await browser.close()
  writeFileSync('.qa/sidebar-footer-results.json', JSON.stringify(checks, null, 2))
}
