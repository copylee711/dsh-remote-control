// Deterministic local model used only in the isolated QA profile. No network calls.
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { appendFileSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const cliRequire = createRequire(require.resolve('@deepseek-ai/dsh/package.json'))
const { LlmAdapter } = await import(pathToFileURL(cliRequire.resolve('@deepseek-ai/dsh-llm')).href)
class QAAdapter extends LlmAdapter {
  providerInfo(id) { return { id, name: 'Remote QA · local model' } }
  async listModels(provider) { return [{ provider, id: 'qa-model', name: 'Remote QA · deterministic' }] }
  async resolveModel(provider, id) { return { provider, id, name: 'Remote QA', context: { contextWindow: 65536 }, inputModalities: ['text'] } }
  async *stream(options) {
    const serialized = JSON.stringify(options)
    if (serialized.includes('验证用户问题') && !options.messages.some(message => JSON.stringify(message).includes('selected'))) {
      const args = JSON.stringify({ questions: [{ id: 'qa-choice', question: '选择两项进行验证', multi_select: true, options: [{ label: '选项甲', description: '第一个选项' }, { label: '选项乙', description: '第二个选项' }] }] })
      const block = { type: 'tool-call', id: 'qa-question-' + Date.now(), name: 'ask_user_question', arguments: args }
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'tool-call-delta', index: 0, id: block.id, name: block.name, argumentsDelta: args }
      yield { type: 'block-end', index: 0, block }; yield { type: 'finish', reason: 'tool-calls' }; return
    }
    if (serialized.includes('验证工具审批') && !serialized.includes('remote_qa_approval')) console.log('QA approval tool is not visible in model context')
    if (serialized.includes('验证工具审批') && !options.messages.some(message => JSON.stringify(message).includes('approved'))) {
      const block = { type: 'tool-call', id: 'qa-approval-' + Date.now(), name: 'remote_qa_approval', arguments: '{}' }
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'tool-call-delta', index: 0, id: block.id, name: block.name, argumentsDelta: '{}' }
      yield { type: 'block-end', index: 0, block }
      yield { type: 'finish', reason: 'tool-calls' }; return
    }
    const text = serialized.includes('验证长代码') ? `代码滚动验证：\n\n\`\`\`javascript\nconst line = '${'x'.repeat(300)}';\n\`\`\`` : '远程链路验证通过：这条回复由隔离 DSH 的本地测试模型逐段生成。'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    for (const part of serialized.includes('验证长代码') ? [text.slice(0, 80), text.slice(80, 200), text.slice(200)] : ['远程链路验证通过：', '这条回复由隔离 DSH 的', '本地测试模型逐段生成。']) {
      if (options.signal?.aborted) { yield { type: 'finish', reason: 'aborted' }; return }
      await new Promise(resolve => setTimeout(resolve, 150)); yield { type: 'text-delta', index: 0, text: part }
    }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'finish', reason: 'stop' }
  }
}
export const name = 'remote-control-qa-llm'
export const inject = ['llm', 'tools']
export function apply(ctx) {
  if (process.env.DSH_QA_DESKTOP === '1') ctx.inject(['webServer', 'connection'], ready => {
    writeFileSync(new URL('../.qa/desktop-connection.json', import.meta.url), JSON.stringify({ url: ready.connection.authenticatedUrl(`http://127.0.0.1:${ready.webServer.port}/`), pid: process.pid }), { mode: 0o600 })
  })
  ctx.llm.registerAdapter(['remote-qa'], new QAAdapter())
  ctx.tools.register({ name: 'remote_qa_approval', description: '隔离环境的审批验证工具，无外部操作', parameters: { type: 'object', properties: {}, additionalProperties: false }, output: { schema: { type: 'object', properties: { approved: { type: 'boolean' } }, required: ['approved'], additionalProperties: false }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] }, execute: async (_args, exec) => { exec.signal.throwIfAborted(); appendFileSync(new URL('../.qa/approval-executions.jsonl', import.meta.url), JSON.stringify({ approved: true, time: Date.now() }) + '\n'); return { approved: true } } })
  ctx.on('tools/pre-execute', (exec, next) => exec.name === 'remote_qa_approval' ? Promise.resolve({ kind: 'ask', reason: '验证手机远程工具审批' }) : next())
}
