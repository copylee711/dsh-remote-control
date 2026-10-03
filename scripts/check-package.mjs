import { readFileSync, existsSync } from 'node:fs'
const manifest = JSON.parse(readFileSync(process.argv[2] || '.qa/pack-manifest.json', 'utf8'))[0]
const paths = new Set(manifest.files.map(file => file.path))
for (const path of ['lib/index.js', 'lib/client.js', 'lib/tunnel-worker.js', 'lib/remote.js', 'lib/style.css', 'lib/LICENSES.txt', 'lib/types/index.d.ts', 'cordis.patch.yml', 'README.md', 'docs/ui-spec.md', 'docs/features.md', 'docs/verification.md']) {
  if (!paths.has(path)) throw new Error(`Missing package file: ${path}`)
}
for (const path of paths) if (/^(\.qa|scripts|tests|node_modules)\//.test(path) || /\.npmrc$/.test(path)) throw new Error(`Private or development file packaged: ${path}`)
const source = readFileSync('lib/remote.js', 'utf8')
const chunks = new Set([...source.matchAll(/["']\.\/(remote-[^"']+\.js)["']/g)].map(match => match[1]))
for (const chunk of chunks) if (!paths.has(`lib/${chunk}`) || !existsSync(`lib/${chunk}`)) throw new Error(`Missing remote chunk: ${chunk}`)
const expected = JSON.parse(readFileSync('package.json', 'utf8'))
if (manifest.name !== expected.name || manifest.version !== expected.version) throw new Error('Unexpected package identity')
console.log(`Package verified: ${manifest.filename}; ${paths.size} files, ${chunks.size} lazy chunks; private QA files excluded`)
