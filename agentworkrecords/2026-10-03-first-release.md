# dsh-remote-control 首版工作记录

## 授权与范围

用户明确要求实现首版计划，交付源码、锁文件、中文 README、构建产物、实际验证及工作记录。之后明确授权直接合并主分支、推送、通过 npm whoami 确认 scope、首次本地发布，并配置后续 GitHub Actions。未借用作者公共中继服务，未更改系统防火墙。

## 实现

独立认证网关、随机配对令牌、逐设备本机批准、原子持久化授权校验值、30 天闲置过期、实时连接撤销、临时 untun 隧道、局域网监听、固定入口禁用说明、自动启动偏好、DSH 官方界面引导、SSE/WebSocket 桥接、二进制上传及手机触控适配。新增中文使用说明、选型研究、验证记录、Windows/Linux CI 与 npm Trusted Publisher 工作流。

## 验证与修正

真实 DSH Web 暴露出插件 HMR 使用 `/plugins/events` SSE，已纳入认证桥接。修正二维码批准与撤销测试对当前浏览器设备的定位，避免把旧测试设备的结果当作撤销验证。修正宿主没有 profileContext 时的可选服务读取、弹窗边界与字体、公网验证超时计时器和单独代理 dispatcher。真实会话消息、流式回复、33 字节上传、一次性工具审批及撤销通过；21 项自动测试通过。

## 边界

完整 Electron、Android/iPhone 实机、大陆手机运营商直连、固定入口与 Trusted Publisher 首次 OIDC 发布尚未验收。公网出现过验证失败和成功，不作稳定性保证。详见 docs/verification.md。

## 发布

npm whoami 已确认账号 copylee，包名 @copylee/dsh-remote-control，首版 0.1.0。实现通过功能分支快进合并到 main，提交 e5f736e 已推送。

首次本地 npm publish --access public 返回成功。公开 tarball 下载返回 HTTP 200，解包确认为 @copylee/dsh-remote-control@0.1.0，19 个文件，SHA-1 为 1a905d02298a10b7988125abc3f04f6b9eb270bf，与发布输出一致。发布后 registry 包元信息出现约 5 分钟的短暂 404，随后 npm view --prefer-online 确认 version 和 latest 均为 0.1.0。

GitHub CI 37104616369 的 ubuntu-latest 和 windows-latest 均通过类型检查、21 项测试、构建及 npm pack。发布工作流和 Trusted Publisher 字段已写入 README，OIDC 配置由用户在首次发布之后完成。

v0.1.0 标签随 main 原子推送，指向 689e336。标签发布工作流 37104961151 成功，检查后跳过已经发布的 0.1.0；对应 CI 37104961021 成功。这证明标签触发、版本检查、构建与跳过逻辑工作，不能代替首次真正的 OIDC 发布验证。隔离 QA 宿主已关闭，没有本插件的隧道工作进程残留；系统已有的 cloudflared 服务未操作。
