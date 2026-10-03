// Launch a second real Electron shell with its own profile and user-data lock.
// Existing Desktop sessions and settings are never copied into this profile.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, symlinkSync, createWriteStream } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
const root = resolve('.'), qa = join(root, '.qa'), home = join(qa, 'home-desktop'), profile = join(home, 'profiles/desktop')
const executable = process.env.DSH_QA_DESKTOP_APP || 'D:/dev/DeepSeek Harness/DeepSeek Harness.exe'
if (!existsSync(executable)) throw new Error('Set DSH_QA_DESKTOP_APP to your installed Desktop executable')
mkdirSync(profile, { recursive: true })
const bundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-experimental-schedule-bundle']
const dependencies = {}
for (const name of ['dsh-remote-control', 'dsh-computer-use', 'dsh-proxy']) {
  const directory = resolve(root, '..', name), packageName = '@copylee/' + name
  if (!existsSync(directory)) continue
  dependencies[packageName] = 'link:' + directory; bundles.push(packageName)
  const link = join(profile, 'node_modules/@copylee', name); mkdirSync(dirname(link), { recursive: true })
  if (!existsSync(link)) symlinkSync(directory, link, 'junction')
}
writeFileSync(join(profile, 'package.json'), JSON.stringify({ name: 'dsh-profile-desktop-qa', private: true, dependencies, dsh: { profile: { bundles } } }, null, 2))
writeFileSync(join(profile, 'cordis.yml'), '[]\n')
const workspace = join(qa, 'workspace'); mkdirSync(workspace, { recursive: true })
writeFileSync(join(profile, 'cordis.patch.yml'), `- id: webserver\n  config:\n    host: 127.0.0.1\n    port: 0\n- id: agent-default-model\n  config:\n    provider: remote-qa\n    model: qa-model\n- id: workspace-controller\n  config:\n    documentsDirectory: '${workspace.replaceAll('\\', '/')}'\n- insert:\n    - id: remote-qa-llm\n      name: '${join(root, 'scripts/qa-llm.mjs').replaceAll('\\', '/')}'\n`)
const child = spawn(executable, [`--user-data-dir=${join(qa, 'electron')}`], { env: { ...process.env, DSH_HOME: home, DSH_QA_DESKTOP: '1', DSH_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
child.stdout.pipe(createWriteStream(join(qa, 'desktop.stdout.log'))); child.stderr.pipe(createWriteStream(join(qa, 'desktop.stderr.log')))
writeFileSync(join(qa, 'desktop-shell.pid'), String(child.pid))
console.log(`Isolated Electron shell PID ${child.pid}; authenticated URL is saved privately in .qa/desktop-connection.json`)
child.on('exit', code => { console.log(`Isolated Electron shell exited: ${code}`); process.exitCode = code ?? 1 })
