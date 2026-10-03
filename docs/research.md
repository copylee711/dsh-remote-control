# 选型与宿主核实（2026-10-03）

## 宿主

以已安装桌面应用的只读 app.asar 清单与 npm SDK 核实版本为 0.2.0-rc.2。隔离 Web 验收实际使用 `@deepseek-ai/dsh@0.2.0-rc.2`，未使用旧 profile 中的 0.1.x 类型推断新版本行为。

核心 API 使用 `/api/remote.mux` WebSocket；官方插件热更新使用 `/plugins/events` SSE。桌面 Connection 同时提供可信 Fetch 路由，宿主 HTTP 服务可按需创建。文件上传实际路径是 `/api/session/uploadFileBinary`。

## 临时公网

采用 [untun](https://github.com/unjs/untun) 0.2.2，API 为 `startTunnel`、`getURL`、`close`；下载 cloudflared 后启动 Cloudflare Quick Tunnel。独立工作进程负责下载、启动和关闭，主进程负责状态、证明回环验证和监测。代理通过独立 Undici ProxyAgent 用于验证，不修改宿主全局 HTTP dispatcher。

[Cloudflare 官方说明](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)明确：Quick Tunnel 不支持 SSE、临时域名、无 SLA，并有并发请求限制。因此公网网关原样转发 WebSocket，SSE 在浏览器启动前转换为受认证的 WebSocket 载体。

[Tunnelmole 官方客户端](https://github.com/robbie-cahill/tunnelmole-client)中的 forwarded-request 实现先缓冲 HTTP 响应；客户端与中继之间有 WebSocket 不代表自动支持应用的 WebSocket/SSE。首版不引入多隧道后端，避免扩大未经真实验收的通信面。

## 固定入口

- [dsh-remote-web-ui](https://github.com/zhu1090093659/dsh-web/tree/main/packages/dsh-remote-web-ui)参考实现使用作者维护的公共中继和注册 API；没有找到明确允许第三方插件直接使用该线上服务并承诺免费固定入口的条件，未接入。
- [dsh-remote](https://github.com/mrRisega/dsh-remote/tree/main/packages/dsh-remote-web)有作者服务及自身许可条件。仅研究架构，没有复制其实现或借用服务。
- [Localtunnel](https://github.com/localtunnel/localtunnel)可请求子域名，但文档明确不保证获得所请求的名称，且大陆可达性和 DSH 实时路径未验收。
- [Tunnelmole](https://tunnelmole.com/docs/)的自定义域名服务不符合本版免账号、免费的固定入口目标。

没有候选同时通过第三方使用条件、免费固定地址、实时连接和大陆手机可达性验证。界面保留禁用的“固定入口 · 暂不可用”，不增加自建中继要求。

## 发布

根据 [npm 官方 Trusted Publisher 文档](https://docs.npmjs.com/trusted-publishers/)与 npm CLI OIDC 文档，后续发布使用 GitHub 托管 runner、Node 24、npm 11 最新版本、`id-token: write` 及 provenance。首次本地发布之后由包拥有者配置 Trusted Publisher。

## 备用公网线路（2026-10-03 实测，0.2.1）

用一个本地回显服务逐个测试，测试机在中国大陆、未经代理：

| 服务 | 结果 |
|---|---|
| localtunnel 2.0.2 | 分配到地址，但请求返回 502；浏览器访问会先看到要求输入"隧道密码"的拦截页。不采用。 |
| tunnelmole 2.4.0 | HTTP 可用；WebSocket 握手返回 200 而不是 101，不支持。DSH 的核心通信走 `/api/remote.mux` WebSocket，不采用。 |
| pinggy.io（SSH） | HTTP 与 WebSocket 可用；浏览器访问有拦截页，免费通道 60 分钟断开。不采用。 |
| localhost.run（SSH） | 免注册，用系统自带的 ssh，不下载程序；HTTP 与 WebSocket 可用，无拦截页。**速度约 20 KB/s**（600 KB 用了 28 秒，经代理访问也一样，瓶颈在电脑到该服务的 SSH 连接）。网关加了 gzip 之后，远程界面首次打开仍需约 3 分 24 秒。 |

结论：localhost.run 作为手动选择的备用线路加入，不做自动切换——它能连上，但慢到会被当成故障。Cloudflare 仍是默认。

网关对文本类响应启用 gzip 是这次测试带来的改动，对所有线路都有效：电脑的上行是每条远程连接里最窄的一段。

## 固定入口的可行做法（未实现）

固定入口指地址不变、手机不用每次重新扫码。免注册的免费服务里没有能做到的；可行的都需要用户自己的账号：

- Cloudflare 具名隧道：需要 Cloudflare 账号和一个托管在其上的域名，用隧道令牌运行已下载的 cloudflared。地址固定，WebSocket 可用。
- ngrok：免费账号附带一个固定域名，需要 authtoken；免费版对浏览器有一次性提示页。
- localhost.run：注册并登记 SSH 公钥后域名保持更久，速度问题不变。
