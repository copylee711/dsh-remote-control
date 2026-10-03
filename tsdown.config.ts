import type { UserConfig } from 'tsdown'
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
export default [host, client]
