/**
 * Browser stand-in for `node:fs`, `node:fs/promises`, `node:path` and `node:url`.
 * cordis-plugin-loader >= 1.1 imports them at module scope but only calls them on
 * its Node-side paths (scope lookup, `.cordis` helper files), which the remote
 * browser never takes. Any call fails loudly instead of the whole bundle failing
 * to load on an unresolvable bare `node:` import.
 */
const unavailable: Record<string, unknown> = new Proxy({}, {
  get: (_target, key) => typeof key === 'symbol' ? undefined : (..._args: unknown[]) => {
    throw new Error(`The remote browser cannot use Node API: ${String(key)}`)
  },
})
export default unavailable
