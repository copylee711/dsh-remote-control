import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const qa = join(root, '.qa'), home = process.env.DSH_QA_HOME || join(qa, 'home'), profile = join(home, 'profiles', 'web')
mkdirSync(profile, { recursive: true })
writeFileSync(join(profile, 'cordis.yml'), '[]\n')
const qaPlugin = join(root, 'scripts', 'qa-llm.mjs').replaceAll('\\', '/')
const workspace = join(qa, 'workspace'); mkdirSync(workspace, { recursive: true })
writeFileSync(join(profile, 'cordis.patch.yml'), `- id: agent-default-model\n  config:\n    provider: remote-qa\n    model: qa-model\n- id: workspace-controller\n  config:\n    documentsDirectory: '${workspace.replaceAll('\\', '/')}'\n- insert:\n    - id: remote-qa-llm\n      name: '${qaPlugin}'\n`)
writeFileSync(join(profile, 'package.json'), JSON.stringify({ name: 'dsh-profile-web', private: true, dependencies: { '@copylee/dsh-remote-control': `link:${root}` }, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@copylee/dsh-remote-control'] } } }, null, 2))
if (process.env.DSH_QA_COMPAT === '1') {
  const manifest = JSON.parse(readFileSync(join(profile, 'package.json'), 'utf8'))
  for (const name of ['dsh-computer-use', 'dsh-proxy']) {
    const directory = resolve(root, '..', name), packageName = '@copylee/' + name
    manifest.dependencies[packageName] = 'link:' + directory; manifest.dsh.profile.bundles.push(packageName)
    const target = join(profile, 'node_modules', '@copylee', name); mkdirSync(dirname(target), { recursive: true }); if (!existsSync(target)) symlinkSync(directory, target, 'junction')
  }
  writeFileSync(join(profile, 'package.json'), JSON.stringify(manifest, null, 2))
}
const link = join(profile, 'node_modules', '@copylee', 'dsh-remote-control')
mkdirSync(dirname(link), { recursive: true }); if (!existsSync(link)) symlinkSync(root, link, 'junction')
const require = createRequire(import.meta.url)
if (process.env.DSH_QA_COMPAT === '1') {
  const manifest = JSON.parse(readFileSync(join(profile, 'package.json'), 'utf8'))
  manifest.dsh.profile.bundles.push('@deepseek-ai/dsh-experimental-schedule-bundle')
  writeFileSync(join(profile, 'package.json'), JSON.stringify(manifest, null, 2))
}
const cli = join(dirname(require.resolve('@deepseek-ai/dsh/package.json')), 'lib', 'bin.js')
const child = spawn(process.execPath, [cli, '--profile', 'web', '--no-open', '--port', '0'], { cwd: root, env: { ...process.env, PATH: [dirname(process.execPath), join(qa, 'bin'), process.env.PATH || ''].join(delimiter), DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
let log = '', written = false
const logFile = join(qa, 'host.log')
const accept = data => {
  log += String(data); writeFileSync(logFile, log, { mode: 0o600 })
  const match = log.match(/http:\/\/127\.0\.0\.1:\d+\/[^\s\u001b]*/)
  if (match && !written) {
    written = true; writeFileSync(join(qa, 'connection.json'), JSON.stringify({ url: match[0], pid: child.pid }), { mode: 0o600 })
    console.log(`Isolated DSH Web ready: ${new URL(match[0]).origin} (authentication URL saved privately in .qa)`)
  }
}
child.stdout.on('data', accept); child.stderr.on('data', accept)
child.on('exit', code => { console.log(`DSH exited: ${code}`); if (!written) console.log(log.slice(-5000).replace(/([?&]token=)[^\s&]+/g, '$1[redacted]')); process.exit(code ?? 1) })
process.on('SIGINT', () => child.kill()); process.on('SIGTERM', () => child.kill())
setTimeout(() => { if (!written) console.log('DSH startup is still pending; inspect .qa/host.log for diagnostics.') }, 40000).unref()


