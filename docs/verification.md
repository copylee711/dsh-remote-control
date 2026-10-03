# 首版验证记录

日期：2026-10-03。Windows，Node 24.21.0，pnpm 10.28.0，DSH SDK/CLI 0.2.0-rc.2。

## 已完成

- 类型检查、构建、21 项自动测试（3 个测试文件）通过。
- 配对行为：未批准、错误领取密钥、拒绝、5 分钟过期、刷新失效、并发独立请求、持久化、30 天失效、撤销、停止保留授权。
- 网关行为：Host/Origin 校验、未授权请求不触达宿主、认证秘密隔离、编码管理路径不能绕过本机批准限制、二进制上传、WebSocket 文本/二进制、SSE 流式桥接、撤销及关闭取消在途请求。
- 桌面适配的 SDK 测试：真实 Cordis/Connection/WebServer SDK，无初始 WebServer，可信 Fetch 载体正常处理本机管理，动态 HTTP 服务只监听 loopback，未认证 HTTP 请求拒绝。凭据提供器使用隔离的内存实现；这不是完整 Electron 应用验收。
- 真实 `dsh web` 使用独立 `.qa` home/profile/workspace，不修改日常宿主配置，不向真实模型供应商发送请求。官方界面加载、等待本机批准、批准后会话、消息发送、确定性本地模型流式回复、工具审批、二进制上传、WebSocket 重连及撤销通过。
- 工具审批由真实 DSH 审批服务处理；在远程官方界面点击“允许一次”，宿主专用测试工具执行计数增加且仅增加 1。
- 文件通过真实 `/api/session/uploadFileBinary` 上传 33 字节 UTF-8 文件，返回 HTTP 200、接收凭证和正确字节数。
- 公网曾完成：untun/cloudflared 下载、域名分配、网关证明回环、官方界面、批准、消息/流式回复、上传、WebSocket/SSE 桥接、撤销。网络也出现失败，界面报告验证失败而不展示可用二维码。公网结果仅代表当前电脑网络，不代表大陆手机运营商网络。
- 最终构建后的公网重测报告 `ECONNRESET`，未通过可用验证；同一构建的局域网闭环通过。此前一次公网成功不能代表首版在当前网络上稳定可用。
- npm 包检查包含宿主、客户端、隧道工作进程、声明文件与 cordis.patch；不包含 `.qa` 私有认证 URL、源码测试模型、设备凭据或 node_modules。

浏览器使用本机 Chrome 的 Playwright headless 模式，390×844、触控、iPhone UA，并检查 1280×960 的控制面板。**这是 Chromium 手机尺寸模拟，不是 iPhone Safari 实机。**

## 尚未完成的真实验收

- 完整 Electron 桌面应用的端到端闭环。宿主 SDK 载体测试不能替代它。
- Android Chrome、iPhone Safari 的真实扫码、软键盘、横竖屏、后台挂起及网络切换。
- 中国大陆手机关闭代理后的运营商网络直连。
- 远程凭据修改、插件安装/卸载和修改设置的完整实机流程；权限设计与官方 API 均保留，但没有操作日常配置进行破坏性验收。
- 在机器重启、强制终止整个宿主及操作系统注销时的进程回收。
- 固定入口服务：未找到满足条件且已验收的公共服务。
- 首次发布后 Trusted Publisher 的 OIDC 发布：需包拥有者配置，当前流程仅能验证工作流检查与已发布版本跳过。

## 重现

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm test
pnpm build
npm pack --dry-run
pnpm qa:host
# 另一个终端
pnpm qa:browser
# 检查真实工具审批
# PowerShell: $env:DSH_QA_APPROVAL='1'; pnpm qa:browser
# 公网: $env:DSH_QA_MODE='public'; pnpm qa:browser
```

QA 的认证 URL、日志、截图和原始结果保存在忽略的 `.qa/` 目录。请不要把其中的 connection.json 或宿主日志提交到仓库。测试模型和审批工具只用于隔离 profile，未打入 npm 包。
