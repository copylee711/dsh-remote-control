# 0.2.0 功能与宿主接口对应

远程普通页面由本插件实现，业务和持久化由当前 DSH 提供。本机继续使用官方主界面。以下清单描述实现覆盖，实际验证范围另见 verification.md。

| 页面／功能 | 宿主接口或服务 | 验证与限制 |
|---|---|---|
| 配对、授权、设备、模式切换 | 原认证网关、PairingService、manage | 安全与切换行为自动测试；首次批准仅本机 |
| 会话列表、新建、搜索、分支 | Connection、sessions、remote.session | 新建、同步、发送、重命名、归档恢复通过真实隔离宿主；搜索／分支已实现 |
| 工作区 | workspaces、workspace Remote | 读取及创建、重命名、移除；移除不删除电脑文件 |
| 模型与思考强度 | session.modelCatalog/selectModel、modelSelection projection | 模型选择已实测；思考强度仅显示模型实际提供的选项 |
| Agent 与权限 | agentPresets.list/select、permissions projection、permission command | 会话前选择 Agent，权限使用宿主目录；预设本身由宿主／插件定义 |
| 消息、Markdown、代码、图片 | uiConversation 的 chat target / SDK MarkdownText / imageUrl | 不复制日志折叠、Agent 或模型请求业务；流式回复通过 |
| 附件与停止 | conversation.createDrafts/sendSession、Session.cancel | 二进制附件上传通过；提交失败保留草稿 |
| “+”菜单与斜杠指令 | commands.list、Session.command | 目标、计划、反馈、压缩、导出及会话的其他指令；结果作为会话里的指令节点显示；权限、模型两行打开本页自己的选择器 |
| 工具审批 | uiSession pendingInteraction 的 approval carrier | 真实审批服务，测试工具仅执行一次 |
| 用户问题与方案审核 | SDK PendingQuestion carrier | 单选、多选、自由回答、方案 Markdown；多选真实闭环通过；沿用宿主倒计时与答复渠道 |
| 工具轨迹与子任务 | chat folded nodes、sessions lineage | 工具参数、结果、错误、思考、历史；子会话可切换查看 |
| 通用、模型、Agent、技能目录及其他配置 | settings.describe/mutate | 统一递归表单；复杂结构使用带校验的 JSON 编辑；保留 expectedRevision 冲突控制 |
| 凭据 | credentials.set/unset | 只写电脑，秘密不回显、不缓存；测试凭据写入与清空通过 |
| 插件与安装任务 | pluginManager.inspect/installBundle/waitForInstall/cancelInstall/setBundleEnabled/removeBundle | 实测本地无依赖测试插件安装、停用、启用、卸载；刷新查询原任务 ID，不重复安装 |
| 自动化 | schedule.catalog/update/delete/history；网关委托 schedule.create | rc.2 缺少 create Remote，适配只调用宿主原有 service；每日任务创建、读取、删除通过；需要启用官方自动化服务 |
| 技能 | skills.list({sessionId})、技能相关 settings namespace | 元数据清单与目录配置；通过 /技能名 调用；未暴露的技能文件编辑不伪装为可用能力 |
| 费用 | sessions 的 cost/usage/token projections | 只展示实际投影，不推算提供商账单；宿主未提供时明确说明 |
| 文件 | workspaceFiles.list/read/readBytes | 浏览、文本／图片／PDF 预览、下载；文本分页／文件上限明确提示；上传在聊天输入区 |
| 原生打开 | session.canOpenWorkspacePath/openWorkspacePath | 明确作用于电脑；未启用时禁用，不冒充手机本地应用 |
| 第三方自定义设置 | settings.section + Slots renderer compatibility adapter | computer-use、proxy 容器通过；保留插件服务、作用域及样式；不保证任意插件、未来 SDK 均兼容 |

宿主的原生窗口、语音设备、账户浏览器登录、系统文件选择器等能力不会在手机上假装成原生电脑操作。可描述的配置由表单提供；没有浏览器 Remote 能力的功能在“其他宿主功能”中说明，避免用占位按钮冒充实现。

浏览器独立打包 React，加载宿主 client manifest 提供的 SDK 服务；官方桌面 AppFrame 从不在普通远程页面挂载。自定义插件兼容适配集中在 src/remote/compatibility.ts，使用 rc.2 的内部 Slots renderRoot/hostFace。升级 SDK 时应先回归此边界。
