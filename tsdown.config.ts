import type { UserConfig } from 'tsdown'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
const host: UserConfig = {
  entry: ['lib/types/index.js', 'lib/types/tunnel-worker.js'], outDir: 'lib', format: 'esm', platform: 'node', target: 'es2024', clean: false, dts: false, fixedExtension: false,
  deps: { neverBundle: ['@deepseek-ai/cordis', '@deepseek-ai/schemastery', '@deepseek-ai/dsh-host-webserver', 'untun', 'ws', 'undici'], onlyBundle: false },
}
const client: UserConfig = {
  entry: { client: 'lib/types/client/index.js' }, outDir: 'lib', format: 'cjs', platform: 'browser', target: 'es2022', clean: false, dts: false,
  deps: { neverBundle: ['react', 'react/jsx-runtime', 'react-dom'], onlyBundle: false },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  outputOptions: {
    entryFileNames: 'client.js', banner: 'window.__ModuleLoader__.load({ id: "@copylee/dsh-remote-control", factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;', footer: 'return module.exports; } });',
  },
}
const remote: UserConfig = {
  minify: true,
  entry: { remote: 'lib/types/remote/bootstrap.js' }, outDir: 'lib', format: 'esm', platform: 'browser', target: 'es2022', clean: false, dts: false,
  deps: { onlyBundle: false, alwaysBundle: [/./] },
  define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'process.env.CORDIS_SHARED': 'undefined', 'process.versions.node': JSON.stringify('0.0.0'), 'process.execArgv': '[]' },
  alias: { 'node:module': fileURLToPath(new URL('./src/remote/node-module.ts', import.meta.url)) },
  plugins: [{
    name: 'bundled-runtime-licenses',
    generateBundle(_options, bundle) {
      const packages = new Map<string, string>()
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        for (const id of chunk.moduleIds) {
          let folder = dirname(id.split('?')[0]!)
          if (!existsSync(folder)) continue
          while (!existsSync(resolve(folder, 'package.json')) && dirname(folder) !== folder) folder = dirname(folder)
          if (!existsSync(resolve(folder, 'package.json'))) continue
          const pkg = JSON.parse(readFileSync(resolve(folder, 'package.json'), 'utf8'))
          if (!pkg.name || pkg.name === '@copylee/dsh-remote-control' || packages.has(pkg.name)) continue
          const files = readdirSync(folder).filter(name => /^(licen[sc]e|copying|notice)(\.|$)/i.test(name))
          const texts = files.map(name => `${name}\n${readFileSync(resolve(folder, name), 'utf8')}`).join('\n\n')
          if (!texts) throw new Error(`Missing bundled dependency license: ${pkg.name}`)
          packages.set(pkg.name, `${pkg.name}@${pkg.version}\n${texts}`)
        }
      }
      this.emitFile({ type: 'asset', fileName: 'LICENSES.txt', source: [...packages].sort(([a], [b]) => a.localeCompare(b)).map(([, text]) => text).join('\n\n' + '='.repeat(72) + '\n\n') })
    },
  }],
  outputOptions: { entryFileNames: 'remote.js', chunkFileNames: 'remote-[name]-[hash].js' },
}
export default [host, client, remote]
