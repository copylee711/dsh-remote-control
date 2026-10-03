import { expect, it } from 'vitest'
import { detectSystemProxy, httpProxy, pickWindowsProxy } from '../src/system-proxy.js'

it('finds the proxy the computer is set to use, and only one the tunnel can use', async () => {
  const registry = 'HKEY_CURRENT_USER\\...\n    ProxyEnable    REG_DWORD    0x1\n    ProxyServer    REG_SZ    http=127.0.0.1:7892;https=127.0.0.1:7893\n'
  expect(await detectSystemProxy({ env: {}, platform: 'win32', run: async () => registry })).toEqual({ url: 'http://127.0.0.1:7893', source: 'Windows 系统代理' })
  expect(await detectSystemProxy({ env: {}, platform: 'win32', run: async () => registry.replace('0x1', '0x0') })).toBeNull()
  expect(await detectSystemProxy({ env: { HTTPS_PROXY: 'http://10.0.0.2:8080' }, platform: 'linux', run: async () => '' })).toMatchObject({ url: 'http://10.0.0.2:8080' })
  // SOCKS and addresses with credentials are passed over.
  expect(await detectSystemProxy({ env: { ALL_PROXY: 'socks5://127.0.0.1:1080' }, platform: 'linux', run: async () => '' })).toBeNull()
  expect(httpProxy('http://user:secret@127.0.0.1:8080')).toBeUndefined()
  expect(httpProxy('127.0.0.1:7890')).toBe('http://127.0.0.1:7890')
  expect(pickWindowsProxy('127.0.0.1:7890')).toBe('127.0.0.1:7890')
})
