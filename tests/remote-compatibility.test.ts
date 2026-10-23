import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('../src/remote/chat.js', () => ({ Chat: () => null }))
vi.mock('../src/remote/management.js', () => ({ Management: () => null }))
import { App } from '../src/remote/app.js'
import { callRemote, missingCapabilities } from '../src/remote/host.js'

it('keeps a missing sessions/workspaces service from crashing the remote root (#1)', () => {
  const html = renderToStaticMarkup(React.createElement(App, { ctx: {} }))
  expect(html).toContain('宿主未提供')
  expect(html).toContain('sessions')
  expect(html).toContain('/?ui=native')
  expect(html).not.toContain("reading &#x27;list&#x27;")
})

it('checks service shapes without mistaking an empty list for an unavailable service', () => {
  const source = { getSnapshot: () => ({ ids: [] }), subscribe: () => () => {} }
  expect(missingCapabilities({ sessions: { list: source } }, ['sessions.list.getSnapshot', 'sessions.list.subscribe'])).toEqual([])
  expect(missingCapabilities({}, ['remote.workspaceFiles.list'])).toEqual(['remote.workspaceFiles.list'])
})

it('turns a missing optional namespace or method into an actionable error', async () => {
  await expect(callRemote({}, 'agentPresets', 'list')).rejects.toThrow('宿主未提供 agentPresets.list')
  await expect(callRemote({ remote: { workspaceFiles: {} } }, 'workspaceFiles', 'list')).rejects.toThrow('workspaceFiles.list')
})

it('preserves Remote receiver and business arguments on both supported service shapes', async () => {
  const workspaceFiles = { marker: 'ok', list(this: any, ...args: any[]) { return { marker: this.marker, args } } }
  expect(await callRemote({ remote: { workspaceFiles } }, 'workspaceFiles', 'list', 'session', '.')).toEqual({ marker: 'ok', args: ['session', '.'] })
})
