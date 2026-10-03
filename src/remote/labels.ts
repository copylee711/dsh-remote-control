export const fields: Record<string, string> = {
  preference: '显示偏好', fontSize: '字号', defaultPreset: '默认权限模式', enabled: '启用',
  busyEnter: '生成过程中发送消息', transcriptView: '消息展示密度', performanceUsage: '性能与用量展示', linkOpening: '链接打开方式',
  apiKey: 'API 密钥', apiKeyRef: 'API 密钥引用', baseUrl: '接口地址', baseURL: '接口地址', provider: '提供商', model: '默认模型',
  reasoningEffort: '推理强度', temperature: '温度', maxTokens: '输出长度上限', timeout: '超时', timeoutMs: '超时（毫秒）',
  presets: '预设', name: '名称', title: '标题', description: '说明', prompt: '指令', systemPrompt: '系统指令',
  maxSteps: '最大执行步数', maxDepth: '最大深度', maxConcurrent: '最大并发数', history: '历史记录',
  compact: '紧凑', standard: '标准', detailed: '详细', verbose: '完整', normal: '普通', expanded: '展开',
  light: '浅色', dark: '深色', system: '跟随系统', queue: '排队发送', steer: '引导当前任务',
  'sidebar': '侧栏', 'new-tab': '新标签页', writable: '允许编辑', language: '语言', locale: '语言',
}
export const namespaces: Record<string, string> = {
  permission: '默认权限', 'ui-theme': '外观', locale: '语言', 'ui-settings': '设置入口',
  'ui-settings-general': '常规偏好', 'ui-conversation': '输入行为', 'ui-chat': '聊天显示',
  'llm-deepseek': 'DeepSeek API', 'llm-deepseek-account': 'DeepSeek 账户', 'llm-pi-ai': '其他模型提供商',
  'agent-default-model': '默认模型', 'subagent-model-selection-settings': '子任务模型',
  'agent-preset-registry': 'Agent 预设', 'agent-loop': 'Agent 执行参数', subagent: '子任务设置',
}
