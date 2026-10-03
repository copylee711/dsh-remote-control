// A dependency-free plugin used only for isolated Host package-manager QA.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
const folder = resolve('.qa/install-fixture')
mkdirSync(folder, { recursive: true })
writeFileSync(folder + '/package.json', JSON.stringify({ name: '@copylee/remote-control-qa-fixture', version: '1.0.0', type: 'module', main: 'index.js', dsh: { engines: { dsh: '>=0.2.0-rc.2' }, bundle: { patch: './cordis.patch.yml' } } }, null, 2))
writeFileSync(folder + '/index.js', 'export const name = "remote-control-qa-fixture"; export function apply(ctx) { ctx.provide("remoteControlQaFixture", { qa: true }) }\n')
writeFileSync(folder + '/cordis.patch.yml', '- insert:\n    - id: remote-control-qa-fixture\n      name: "@copylee/remote-control-qa-fixture"\n')
console.log('Created dependency-free isolated QA fixture')
if (process.env.DSH_QA_PNPM_CJS) {
  const bin = resolve('.qa/bin'); mkdirSync(bin, { recursive: true })
  writeFileSync(bin + '/pnpm.cmd', `@echo off\r\nset "PATH=${dirname(process.execPath)};%PATH%"\r\n"${process.execPath}" "${process.env.DSH_QA_PNPM_CJS}" %*\r\n`)
  console.log('Created isolated pnpm launcher')
}
