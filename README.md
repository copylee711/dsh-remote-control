# DSH Remote Control

通过扫码和本机确认，把手机浏览器连接到自己的 DeepSeek Harness。0.2.0 提供独立的暖色远程界面，适配手机、平板与电脑，并保留免费临时公网隧道、局域网直连和设备授权管理。本机桌面应用与 dsh web 的原有主界面保持原样。

包名：`@copylee/dsh-remote-control`。需要 DSH **0.2.0-rc.2 或更新的兼容版本**，Node.js **22.19+ 或 24+**。不支持旧版 0.1.x 宿主。

## 安装与使用

在 DSH 插件管理页添加 `@copylee/dsh-remote-control`，应用变更。`dsh web` 与桌面应用使用各自的 profile，需分别安装。点击左侧栏底部的“远程控制”，也可以从设置中的“远程控制”打开面板。

1. 首次默认关闭。选择“临时公网”或“局域网”，点击开启。
2. 临时公网首次需要下载 cloudflared，依次显示下载、启动、验证状态。只有公网回环检查成功才展示可用链接。
3. 手机扫码或打开复制的配对链接，进入等待页；在电脑面板中批准该设备。
4. 批准后进入独立远程界面，可使用会话、审批、文件、设置和插件管理。
5. “关闭连接”断开所有访问并保留设备授权；“撤销”立即断开对应设备并使其凭据失效。

二维码有效期 5 分钟。刷新会使旧二维码和旧待批准请求失效。设备连续 30 天不使用后失效；浏览器 cookie 和服务端授权均有过期限制。临时公网域名变化后需要重新扫码、本机批准，因为浏览器不会把旧域名的授权交给新域名。最多保存 32 台设备，同时最多等待 16 个配对请求。

已批准设备与本机同权，包括凭据、插件、设备授权管理和关闭远程连接。**新设备的首次批准只能从本机完成**。请只批准自己信任的设备。公网 HTTPS 在 Cloudflare 边缘终止；本插件不提供端到端加密。局域网模式使用 HTTP，应在可信网络中使用。

## 连接模式

| 模式 | 行为 |
| --- | --- |
| 临时公网 | untun 0.2.2 / Cloudflare Quick Tunnel，无需账号和域名，地址临时分配 |
| 局域网 | 独立网关监听局域网，手机与电脑同一网络，不改变 DSH 原始监听配置 |
| 固定入口 | 暂不可用；尚未验证允许第三方使用的免费固定入口服务 |

“随 DSH 启动”按 profile 保存，默认关闭。点击模式按钮只保存选择，保持当前连接、地址和二维码。面板分别显示“当前连接”与“待切换”；只有明确点击“切换到局域网／临时公网”才断开旧入口、作废旧二维码及待批准请求，并建立新入口。切换失败保持关闭并报告原因，可再次开启；已批准设备记录保留。远程设备发起切换时先收到提示，再断开访问。网关端口默认为自动分配，也可以在宿主插件配置中设置 `gatewayPort`。

公网启动失败时可重试或改用局域网。面板可配置电脑端 HTTP(S) 代理地址，例如 `http://127.0.0.1:7890`；不接受包含用户名或密码的代理 URL。该设置传给下载与 Node HTTP 检查进程，**不能保证 cloudflared 到 Cloudflare 边缘的连接也通过 HTTP 代理**。大陆手机直连仍取决于当地网络，不能把分配到域名视作手机可用。

局域网连接失败时，先检查手机与电脑的网络、路由器客户端隔离/VPN 和面板显示的 IP 与端口。Windows 防火墙可能阻止网关端口：在“Windows Defender 防火墙（高级安全）→ 入站规则”中手动允许面板端口的 TCP 入站，建议限制为专用网络及本地子网。插件不会更改系统防火墙；固定端口更适合维护手动规则。

## 数据与传输

授权与偏好保存到 `$DSH_HOME/dsh-remote-control/<profile>/`；未设置 DSH_HOME 时使用 `~/.dsh`。设备文件只保存随机秘密的 SHA-256 校验值、设备名称和时间信息，采用临时文件与原子替换。面板及日志不显示设备秘密。

公网隧道指向独立认证网关。批准前只可打开配对页，无法读取宿主资源或数据。网关在内部换取宿主凭据，替换上游认证，不把原始宿主凭据交给手机。停止或撤销会取消在途 HTTP、WebSocket 和 SSE 连接。

DSH 核心通信使用 `/api/remote.mux` WebSocket，直接通过认证网关转发。官方插件热更新使用 `/plugins/events` SSE；因为 [Quick Tunnels 不支持 SSE](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)，远程引导在客户端 SDK 启动前把 EventSource 转为 WebSocket，支持事件顺序、Last-Event-ID、重连和取消。文件上传保留二进制流，不转换为 JSON。

独立界面参照 Claude / ChatGPT 手机客户端的形态，提供浅色、深色和跟随系统主题，以及可切换的强调色（陶土橙、蓝色、黑色）；强调色在电脑面板、配对页和手机界面之间共用。窄屏为顶部导航、会话抽屉、底部输入区和单栏设置；宽屏使用会话列表与内容双栏。输入处理动态视口和安全区，手机 Enter 换行，发送按钮提交，中文输入法组合期间不提交；查看历史时不会强制跳回最新消息。

- 会话：新建、搜索、重命名、归档与恢复、分支，选择工作区、模型、思考强度、Agent 和权限模式；Markdown、代码、图片、附件、停止生成、审批、单选／多选问题、方案确认、工具轨迹及子任务查看。
- 管理：根据宿主配置描述生成表单，保留配置版本冲突检查；凭据写入、插件安装与日志、停用／启用／卸载、每日自动化创建与任务管理、技能清单与目录配置、会话费用投影、工作区与远程设备管理。没有启用的能力会明确提示。
- 文件：浏览工作区、文本与图片预览、PDF 浏览器预览、二进制下载；聊天输入区上传附件。“在电脑上打开”只调用宿主原生应用能力，未启用时禁用。
- 恢复：文字草稿按会话保存，后台／断网后由宿主 SDK 恢复订阅并重新读取状态，不自动重放发送、审批或安装。安装任务 ID 可在刷新后查询原任务。凭据不进入浏览器持久化缓存。

第三方自定义设置页使用专门的兼容容器：复用 SDK 的服务、扩展注册、作用域与渲染上下文，修复窄屏布局。常规页面不嵌入整套官方界面。当前兼容适配基于 DSH 0.2.0-rc.2 的 Slots renderer，依赖一个集中维护的内部渲染接口；宿主升级改变它时，兼容页面会报告不可用。computer-use、proxy 已在隔离宿主检查，不能推定所有第三方页面均兼容。

共享视觉规格位于工作区 `D:\AI\dsh_plugins\DSH-PLUGIN-UI-SPEC.md`，仓库交付副本见 [UI 规格](docs/ui-spec.md)。实际功能与验收边界见 [功能对应清单](docs/features.md) 和 [验证记录](docs/verification.md)。

## 开发与验证

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm test
pnpm build
npm pack --dry-run
```

`pnpm qa:host` 启动独立的真实 DSH Web profile，配置与会话都在忽略的 `.qa/` 目录中，不操作日常 DSH。`pnpm qa:browser` 使用本机 Chrome 检查配对、独立界面、会话管理、实时传输、设置与撤销。QA 专用模型只在隔离 profile 中提供确定性回复，不发送外部模型请求。手机尺寸 Chromium 模拟不能替代 Android Chrome 和 iPhone Safari 实机验收。

## npm 发布

GitHub CI 检查 Windows 与 Linux。首次发布使用本地已登录 npm 账号。后续推送与 package.json 版本一致的 `v*` 标签，触发 `.github/workflows/publish.yml`；手动触发也可用，已发布版本自动跳过。

首次发布后在 npm 包设置中添加 **GitHub Actions Trusted Publisher**：

| 字段 | 值 |
| --- | --- |
| Organization or user | `copylee711` |
| Repository | `dsh-remote-control` |
| Workflow filename | `publish.yml` |
| Environment | 留空（工作流未配置 environment） |

工作流使用 GitHub 托管 runner、`id-token: write`、最新版 npm 和 `npm publish --provenance`，不需要 NPM_TOKEN。参见 [npm 官方文档](https://docs.npmjs.com/trusted-publishers/)。本次已按包拥有者提供的 Trusted Publisher 配置执行后续发布；发布结果以 GitHub Actions 和 npm 实际包内容为准。

实现参考：[官方 GUI 复用插件](https://github.com/zhu1090093659/dsh-web/tree/main/packages/dsh-remote-web-ui)、[DSH Remote](https://github.com/mrRisega/dsh-remote/tree/main/packages/dsh-remote-web)、[untun](https://github.com/unjs/untun)。本项目独立实现，没有接入作者的公共中继服务。
