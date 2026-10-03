import { createRequire } from "node:module";
import z from "@deepseek-ai/schemastery";
import WebServer from "@deepseek-ai/dsh-host-webserver";
import { homedir, networkInterfaces } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { createServer, request } from "node:http";
import { StringDecoder } from "node:string_decoder";
import { WebSocket, WebSocketServer } from "ws";
import { execFile, fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ProxyAgent, fetch as fetch$1 } from "undici";
//#region lib/types/pairing.js
const random = () => randomBytes(32).toString("base64url");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const matches = (value, expected) => {
	const a = Buffer.from(hash(value), "hex"), b = Buffer.from(expected, "hex");
	return a.length === b.length && timingSafeEqual(a, b);
};
/** Only hashes of device secrets reach disk. Pending claims live in memory. */
var PairingService = class {
	options;
	devices = /* @__PURE__ */ new Map();
	pending = /* @__PURE__ */ new Map();
	token;
	now;
	idleMs;
	constructor(options) {
		this.options = options;
		this.now = options.now ?? Date.now;
		this.idleMs = options.idleMs ?? 2592e6;
		if (existsSync(options.file)) {
			const input = JSON.parse(readFileSync(options.file, "utf8"));
			if (!input || typeof input !== "object" || !("devices" in input) || !Array.isArray(input.devices)) throw new Error("设备授权文件格式不正确，请备份后修复；不会忽略损坏的授权记录。");
			for (const row of input.devices) {
				if (!row || typeof row.id !== "string" || typeof row.name !== "string" || !/^[a-f0-9]{64}$/.test(row.hash) || !Number.isFinite(row.lastSeenAt) || !Number.isFinite(row.createdAt)) throw new Error("设备授权记录损坏。");
				this.devices.set(row.id, row);
			}
			this.expire();
		}
	}
	save() {
		mkdirSync(dirname(this.options.file), { recursive: true });
		const temporary = `${this.options.file}.${randomUUID()}.tmp`;
		writeFileSync(temporary, JSON.stringify({
			version: 1,
			devices: [...this.devices.values()]
		}), { mode: 384 });
		renameSync(temporary, this.options.file);
	}
	expire() {
		const expired = [...this.devices.values()].filter((d) => this.now() - d.lastSeenAt >= this.idleMs);
		if (expired.length) {
			for (const device of expired) this.devices.delete(device.id);
			this.save();
			for (const device of expired) this.options.onRevoke?.(device.id);
		}
		for (const [id, claim] of this.pending) if (this.now() >= claim.expiresAt) this.pending.delete(id);
	}
	issue() {
		const token = random(), expiresAt = this.now() + 3e5;
		this.token = {
			hash: hash(token),
			expiresAt
		};
		this.pending.clear();
		return {
			token,
			expiresAt
		};
	}
	invalidate() {
		this.token = void 0;
		this.pending.clear();
	}
	request(token, userAgent) {
		this.expire();
		if (!this.token || this.now() >= this.token.expiresAt || !matches(token, this.token.hash)) throw new Error("二维码已过期或已刷新，请重新扫码。");
		if (this.pending.size >= 16) throw new Error("等待配对的设备过多，请稍后再试。");
		const id = randomUUID(), key = random(), expiresAt = Math.min(this.now() + 3e5, this.token.expiresAt);
		const name = /iPhone|iPad/.test(userAgent) ? "iPhone / iPad" : /Android/.test(userAgent) ? "Android 手机" : /Windows/.test(userAgent) ? "Windows 浏览器" : "远程浏览器";
		this.pending.set(id, {
			id,
			name,
			expiresAt,
			keyHash: hash(key),
			state: "pending"
		});
		return {
			id,
			key,
			expiresAt
		};
	}
	requests() {
		this.expire();
		return [...this.pending.values()].filter((p) => p.state === "pending").map(({ id, name, expiresAt }) => ({
			id,
			name,
			expiresAt
		}));
	}
	approve(id) {
		this.expire();
		const claim = this.pending.get(id);
		if (!claim || claim.state !== "pending") throw new Error("配对请求已失效。");
		if (this.devices.size >= 32) throw new Error("最多保存 32 台设备，请先撤销不再使用的设备。");
		const deviceId = randomUUID(), secret = random();
		const device = {
			id: deviceId,
			name: claim.name,
			hash: hash(secret),
			createdAt: this.now(),
			lastSeenAt: this.now()
		};
		this.devices.set(deviceId, device);
		try {
			this.save();
		} catch (error) {
			this.devices.delete(deviceId);
			throw error;
		}
		claim.state = "approved";
		claim.credential = `${deviceId}.${secret}`;
	}
	reject(id) {
		const claim = this.pending.get(id);
		if (claim?.state === "pending") claim.state = "rejected";
	}
	claim(id, key) {
		this.expire();
		const claim = this.pending.get(id);
		if (!claim || !matches(key, claim.keyHash)) throw new Error("配对请求已失效。");
		const result = {
			state: claim.state,
			credential: claim.credential
		};
		if (claim.state !== "pending") this.pending.delete(id);
		return result;
	}
	authenticate(credential) {
		this.expire();
		if (!credential || credential.length > 128) return void 0;
		const [id, secret, extra] = credential.split(".");
		if (!id || !secret || extra) return void 0;
		const device = this.devices.get(id);
		if (!device || !matches(secret, device.hash)) return void 0;
		if (this.now() - device.lastSeenAt >= 6e4) {
			const previous = device.lastSeenAt;
			device.lastSeenAt = this.now();
			try {
				this.save();
			} catch (error) {
				device.lastSeenAt = previous;
				throw error;
			}
		}
		return device;
	}
	list() {
		this.expire();
		return [...this.devices.values()].map(({ hash: _hash, ...device }) => device);
	}
	revoke(id) {
		const previous = this.devices.get(id);
		if (!previous) return;
		this.devices.delete(id);
		try {
			this.save();
		} catch (error) {
			this.devices.set(id, previous);
			throw error;
		}
		this.options.onRevoke?.(id);
		for (const [key, claim] of this.pending) if (claim.credential?.startsWith(`${id}.`)) this.pending.delete(key);
	}
	revokeAll() {
		for (const id of [...this.devices.keys()]) this.revoke(id);
		this.invalidate();
	}
};
//#endregion
//#region lib/types/http.js
function json(res, status, value) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"referrer-policy": "no-referrer",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(value));
}
async function body(req, limit = 16384) {
	let size = 0;
	const chunks = [];
	for await (const chunk of req) {
		size += chunk.length;
		if (size > limit) throw new Error("请求过大。");
		chunks.push(Buffer.from(chunk));
	}
	const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("请求格式不正确。");
	return value;
}
function isLoopback(value) {
	return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}
function cookie(req, name = "dsh_rc") {
	return req.headers.cookie?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`))?.slice(name.length + 1);
}
function sameOrigin(req) {
	if (!req.headers.origin) return req.headers["sec-fetch-site"] !== "cross-site";
	try {
		return new URL(req.headers.origin).host === req.headers.host;
	} catch {
		return false;
	}
}
//#endregion
//#region lib/types/pages.js
const css = `:root{color-scheme:light dark;font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;background:#f6f5f1;color:#252925}*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px}.card{background:#fff;border:1px solid #dedfd7;border-radius:22px;padding:32px;max-width:440px;width:100%;box-shadow:0 16px 60px #2535200b}.eyebrow{color:#607153;font-size:12px;letter-spacing:.12em}h1{font-size:26px;letter-spacing:-.04em;margin:20px 0 12px}p{font-size:15px;line-height:1.8;color:#687064}button{background:#315a40;border:0;color:white;border-radius:12px;padding:14px 18px;font:inherit;width:100%;cursor:pointer}.status{display:flex;align-items:center;gap:10px;margin:24px 0;color:#315a40;font-size:14px}.dot{width:9px;height:9px;border-radius:50%;background:#75965e}small{color:#80877a;line-height:1.7;display:block} @media(prefers-color-scheme:dark){:root{background:#181c18;color:#e8ede4}.card{background:#222822;border-color:#3a4238}p,small{color:#a7b29f}.status{color:#aac79d}}`;
function pairingPage() {
	return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>连接 DeepSeek Harness</title><style>${css}</style></head><body><main class="card"><span class="eyebrow">DSH · REMOTE CONTROL</span><h1>连接你的电脑</h1><p>在电脑上确认这次配对后，你就可以在这里继续使用 DeepSeek Harness。</p><div class="status"><span class="dot"></span><span id="state">正在发送配对请求…</span></div><small>授权后，这台设备与本机拥有相同的操作权限。你可以随时在远程控制面板撤销设备。</small><button id="enter" hidden>进入 DeepSeek Harness</button></main><script>
  (async()=>{const state=document.getElementById('state');const enter=document.getElementById('enter');
  try{const token=new URLSearchParams(location.hash.slice(1)).get('pair');history.replaceState(null,'','/pair');
    if(!token){const health=await fetch('/api/dsh-remote-control/manage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'status'})});if(health.ok){location.replace('/');return}throw Error('请在电脑上开启远程控制并扫描新的二维码。')}
    const request=await fetch('/rc/pair/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});const claim=await request.json();if(!request.ok)throw Error(claim.error||'配对请求失败');
    state.textContent='等待电脑确认，请查看本机远程控制面板';
    while(Date.now()<claim.expiresAt){await new Promise(r=>setTimeout(r,1500));const response=await fetch('/rc/pair/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:claim.id,key:claim.key})});const result=await response.json();if(!response.ok)throw Error(result.error||'请求已失效');if(result.state==='rejected')throw Error('电脑已拒绝本次配对。');if(result.state==='approved'){state.textContent='已连接，正在打开官方界面…';location.replace('/');return}}
    throw Error('配对请求已过期，请重新扫码。')
  }catch(error){state.textContent=error.message;enter.hidden=false;enter.textContent='重新检查连接';enter.onclick=()=>location.reload()}})();
  <\/script></body></html>`;
}
function deniedPage() {
	return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>设备尚未授权</title><style>${css}</style></head><body><main class="card"><span class="eyebrow">DSH · REMOTE CONTROL</span><h1>需要重新连接</h1><p>这台设备尚未配对，授权已过期，或已被撤销。请在电脑上打开远程控制面板，扫描新的二维码并确认配对。</p><small>关闭远程连接会保留设备授权；临时公网地址变化后，需要重新扫码。</small></main></body></html>`;
}
//#endregion
//#region lib/types/boot.js
/** Runs before the official shell. No device or Host credential is embedded. */
function remoteBoot() {
	const globals = window;
	globals.__DSH_REMOTE_CONTROL__ = true;
	globals.__DSH_TRANSPORT__ = {
		...globals.__DSH_TRANSPORT__,
		ownsHost: true
	};
	const originalFetch = window.fetch.bind(window);
	globals.__DSH_FILE_UPLOAD__ = { fetch: originalFetch };
	function disconnected(message) {
		if (document.getElementById("dsh-rc-disconnected")) return;
		const notice = document.createElement("div");
		notice.id = "dsh-rc-disconnected";
		notice.setAttribute("role", "alert");
		notice.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(255,255,255,.97);display:flex;align-items:center;justify-content:center;padding:24px;font:16px/1.7 system-ui,sans-serif;text-align:center;color:#263d32";
		const box = document.createElement("div"), text = document.createElement("p"), retry = document.createElement("button");
		text.textContent = message;
		retry.textContent = "重新连接";
		retry.onclick = () => location.reload();
		retry.style.cssText = "padding:12px 20px;border:0;border-radius:10px;background:#356d53;color:white;font:inherit";
		box.append(text, retry);
		notice.append(box);
		(document.body ?? document.documentElement).append(notice);
	}
	window.fetch = async (...args) => {
		const response = await originalFetch(...args);
		if (response.status === 403 && new URL(String(args[0] instanceof Request ? args[0].url : args[0]), location.href).origin === location.origin) disconnected("设备授权已失效或撤销，请重新扫码并在电脑上确认。");
		return response;
	};
	const OriginalSocket = window.WebSocket;
	globals.WebSocket = class extends OriginalSocket {
		constructor(url, protocols) {
			super(url, protocols);
			this.addEventListener("close", () => {
				originalFetch("/api/dsh-remote-control/manage", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ action: "status" })
				}).then((response) => {
					if (response.status === 403) disconnected("设备授权已撤销，远程连接已断开。请重新扫码。");
				}).catch(() => disconnected("远程连接已中断。请检查网络或在电脑上重新开启连接。"));
			});
		}
	};
	if (!crypto.randomUUID) Object.defineProperty(crypto, "randomUUID", { value: () => "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)) });
	const NativeSocket = window.WebSocket;
	class RemoteEventSource extends EventTarget {
		static CONNECTING = 0;
		static OPEN = 1;
		static CLOSED = 2;
		CONNECTING = 0;
		OPEN = 1;
		CLOSED = 2;
		readyState = 0;
		url;
		withCredentials;
		onopen = null;
		onmessage = null;
		onerror = null;
		socket;
		timer;
		buffer = "";
		lastId = "";
		retry = 3e3;
		constructor(url, init) {
			super();
			this.url = new URL(String(url), location.href).href;
			this.withCredentials = init?.withCredentials ?? false;
			if (new URL(this.url).origin !== location.origin) throw new Error("远程 EventSource 仅允许同源地址。");
			this.connect();
		}
		emit(type, event) {
			this.dispatchEvent(event);
			(type === "open" ? this.onopen : type === "error" ? this.onerror : type === "message" ? this.onmessage : void 0)?.call(this, event);
		}
		connect() {
			if (this.readyState === 2) return;
			const url = new URL("/rc/sse", location.href);
			url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
			const source = new URL(this.url);
			url.searchParams.set("path", source.pathname + source.search);
			if (this.lastId) url.searchParams.set("lastEventId", this.lastId);
			const socket = this.socket = new NativeSocket(url);
			socket.onmessage = (event) => {
				const frame = JSON.parse(event.data);
				if (frame.type === "ready") {
					this.readyState = 1;
					this.emit("open", new Event("open"));
					return;
				}
				if (frame.type === "error") {
					this.close();
					this.emit("error", new Event("error"));
					return;
				}
				if (frame.type !== "chunk") return;
				this.buffer += frame.data;
				let match;
				while (match = /\r\n\r\n|\n\n|\r\r/.exec(this.buffer)) {
					const text = this.buffer.slice(0, match.index);
					this.buffer = this.buffer.slice(match.index + match[0].length);
					let type = "message";
					const data = [];
					for (const line of text.split(/\r\n|\r|\n/)) {
						const colon = line.indexOf(":");
						const field = colon < 0 ? line : line.slice(0, colon);
						const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
						if (field === "data") data.push(value);
						else if (field === "event") type = value || "message";
						else if (field === "id" && !value.includes("\0")) this.lastId = value;
						else if (field === "retry" && /^\d+$/.test(value)) this.retry = Math.min(3e4, Math.max(500, Number(value)));
					}
					if (data.length) this.emit(type, new MessageEvent(type, {
						data: data.join("\n"),
						lastEventId: this.lastId,
						origin: location.origin
					}));
				}
			};
			socket.onerror = () => this.emit("error", new Event("error"));
			socket.onclose = () => {
				if (this.readyState !== 2) {
					this.readyState = 0;
					this.buffer = "";
					this.timer = setTimeout(() => this.connect(), this.retry);
				}
			};
		}
		close() {
			this.readyState = 2;
			clearTimeout(this.timer);
			this.socket?.close();
		}
	}
	globals.EventSource = RemoteEventSource;
	document.addEventListener("DOMContentLoaded", () => {
		document.documentElement.classList.add("dsh-rc-app");
		document.addEventListener("keydown", (event) => {
			const editable = event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLElement && event.target.isContentEditable;
			if (matchMedia("(pointer:coarse) and (max-width:900px)").matches && event.key === "Enter" && !event.isComposing && !event.ctrlKey && !event.metaKey && editable) event.stopImmediatePropagation();
		}, true);
	});
}
const BOOT_SCRIPT = `(${remoteBoot.toString()})();`;
const MOBILE_CSS = `
html.dsh-rc-app{min-height:100%;overscroll-behavior:none}
@media(pointer:coarse) and (max-width:900px){
  .dsh-rc-app{touch-action:manipulation;--dsw-control-height:44px}
  .dsh-rc-app input,.dsh-rc-app textarea,.dsh-rc-app select{font-size:16px!important}
  .dsh-rc-app button{min-height:40px}
  .dsh-rc-app [class$="_composerSeat"]{padding-bottom:max(10px,env(safe-area-inset-bottom))!important}
  .dsh-rc-app [role="dialog"]{max-width:calc(100vw - 16px)!important;max-height:calc(100dvh - 24px)!important;overflow:auto}
  .dsh-rc-app pre{max-width:100%;overflow:auto}
  .dsh-rc-app [class$="_messageContent"]{overflow-wrap:anywhere}
  .dsh-rc-app [role="tooltip"]{display:none!important}
}
`;
function injectBoot(html) {
	return html.replace(/<head(?:\s[^>]*)?>/i, (match) => `${match}<script>${BOOT_SCRIPT.replace(/<\/script/gi, "<\\/script")}<\/script><style>${MOBILE_CSS}</style>`);
}
//#endregion
//#region lib/types/gateway.js
const MANAGE_PATH = "/api/dsh-remote-control/manage";
function safePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || /[\x00-\x1f\\]/.test(path)) return false;
	try {
		let decoded = path.split("?")[0];
		for (let i = 0; i < 3; i++) {
			const next = decodeURIComponent(decoded);
			if (next === decoded) break;
			decoded = next;
		}
		return !decoded.startsWith("//") && !decoded.includes("\\") && !/[\x00-\x1f]/.test(decoded) && !decoded.split("/").some((part) => part === ".." || part === ".");
	} catch {
		return false;
	}
}
/** Authenticates every remote request before the privileged loopback leg. */
var Gateway = class {
	options;
	server;
	sockets = /* @__PURE__ */ new Set();
	active = /* @__PURE__ */ new Map();
	wss = new WebSocketServer({
		noServer: true,
		maxPayload: 33554432,
		perMessageDeflate: false
	});
	rates = /* @__PURE__ */ new Map();
	authorities = /* @__PURE__ */ new Set();
	proof = randomBytes(24).toString("hex");
	port = 0;
	constructor(options) {
		this.options = options;
	}
	allowAuthority(authority) {
		this.authorities.add(authority.toLowerCase());
	}
	disallowAuthority(authority) {
		this.authorities.delete(authority.toLowerCase());
	}
	validHost(req) {
		return !!req.headers.host && this.authorities.has(req.headers.host.toLowerCase());
	}
	async listen(host, port = 0) {
		if (this.server) throw new Error("远程网关已启动。");
		const server = this.server = createServer((req, res) => {
			this.handle(req, res).catch(() => {
				if (!res.headersSent) json(res, 500, { error: "请求处理失败，请在本机查看状态。" });
				else res.destroy();
			});
		});
		server.on("connection", (socket) => {
			this.sockets.add(socket);
			socket.on("error", () => {});
			socket.once("close", () => this.sockets.delete(socket));
		});
		server.on("upgrade", (req, socket, head) => {
			socket.on("error", () => {});
			this.upgrade(req, socket, head).catch(() => socket.destroy());
		});
		await new Promise((resolve, reject) => {
			server.once("error", reject);
			server.listen(port, host, () => {
				server.off("error", reject);
				resolve();
			});
		});
		const address = server.address();
		if (!address || typeof address === "string") throw new Error("无法读取网关端口。");
		this.port = address.port;
		this.allowAuthority(`127.0.0.1:${this.port}`);
		this.allowAuthority(`localhost:${this.port}`);
		return this.port;
	}
	healthURL(base) {
		return `${base}/rc/health?proof=${this.proof}`;
	}
	verifyHealth(value) {
		return !!value && typeof value === "object" && "proof" in value && value.proof === this.proof;
	}
	track(deviceId, cancel) {
		let set = this.active.get(deviceId);
		if (!set) this.active.set(deviceId, set = /* @__PURE__ */ new Set());
		set.add(cancel);
		return () => {
			set.delete(cancel);
			if (!set.size) this.active.delete(deviceId);
		};
	}
	onlineIds() {
		return [...this.active.keys()];
	}
	revoke(id) {
		for (const cancel of [...this.active.get(id) ?? []]) cancel();
		this.active.delete(id);
	}
	device(req) {
		return this.options.pairing.authenticate(cookie(req));
	}
	cookieHeader(req, credential) {
		return `dsh_rc=${credential}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${req.headers["x-forwarded-proto"] === "https" ? "; Secure" : ""}`;
	}
	rate(req) {
		const claim = req.url?.startsWith("/rc/pair/claim") === true;
		const key = `${req.socket.remoteAddress ?? "unknown"}:${claim ? "claim" : "request"}`, now = Date.now();
		if (this.rates.size > 1024) {
			for (const [ip, row] of this.rates) if (row.until < now) this.rates.delete(ip);
		}
		let row = this.rates.get(key);
		if (!row || row.until < now) this.rates.set(key, row = {
			count: 0,
			until: now + 6e4
		});
		return ++row.count <= (claim ? 1e3 : 120);
	}
	async handle(req, res) {
		if (!safePath(req.url ?? "/") || !this.validHost(req)) {
			json(res, 403, { error: "不受信任的访问地址。" });
			return;
		}
		const url = new URL(req.url ?? "/", "http://gateway.invalid");
		if (url.pathname === "/rc/health") {
			if (url.searchParams.get("proof") !== this.proof) {
				json(res, 404, { error: "not found" });
				return;
			}
			json(res, 200, { proof: this.proof });
			return;
		}
		if (url.pathname === "/pair" && req.method === "GET") {
			res.writeHead(200, {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
				"referrer-policy": "no-referrer",
				"x-frame-options": "DENY"
			});
			res.end(pairingPage());
			return;
		}
		if (url.pathname === "/rc/pair/request" || url.pathname === "/rc/pair/claim") {
			if (req.method !== "POST" || !sameOrigin(req)) {
				json(res, 403, { error: "需要同源 POST 请求。" });
				return;
			}
			if (!this.rate(req)) {
				json(res, 429, { error: "请求过于频繁，请稍后再试。" });
				return;
			}
			try {
				const input = await body(req);
				if (url.pathname.endsWith("/request")) json(res, 200, this.options.pairing.request(String(input.token ?? ""), req.headers["user-agent"] ?? ""));
				else {
					const result = this.options.pairing.claim(String(input.id ?? ""), String(input.key ?? ""));
					if (result.credential) res.setHeader("set-cookie", this.cookieHeader(req, result.credential));
					json(res, 200, { state: result.state });
				}
			} catch (error) {
				json(res, 400, { error: error instanceof Error ? error.message : "配对失败。" });
			}
			return;
		}
		const device = this.device(req);
		if (!device) {
			if (req.headers.accept?.includes("text/html") && req.method === "GET") {
				res.writeHead(403, {
					"content-type": "text/html; charset=utf-8",
					"cache-control": "no-store"
				});
				res.end(deniedPage());
			} else json(res, 403, {
				error: "设备尚未配对或授权已撤销。",
				code: "unpaired"
			});
			req.resume();
			return;
		}
		if (!sameOrigin(req)) {
			json(res, 403, { error: "拒绝跨站请求。" });
			return;
		}
		res.setHeader("set-cookie", this.cookieHeader(req, cookie(req)));
		const untrack = this.track(device.id, () => {
			req.destroy();
			res.destroy();
		});
		res.once("close", untrack);
		if (decodeURIComponent(url.pathname) === "/api/dsh-remote-control/manage") {
			if (req.method !== "POST") {
				json(res, 405, { error: "POST only" });
				return;
			}
			try {
				json(res, 200, await this.options.manage(await body(req), false));
			} catch (error) {
				json(res, 400, { error: error instanceof Error ? error.message : "操作失败。" });
			}
			return;
		}
		if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html") && this.options.index) {
			const html = injectBoot(await this.options.index());
			res.writeHead(200, {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
				"referrer-policy": "no-referrer"
			});
			res.end(html);
			return;
		}
		if ((req.method === "GET" || req.method === "HEAD") && this.options.asset && await this.options.asset(url.pathname, res)) return;
		this.proxy(req, res, device.id);
	}
	headers(req) {
		const headers = {};
		const blocked = /* @__PURE__ */ new Set([
			"host",
			"cookie",
			"authorization",
			"origin",
			"referer",
			"connection",
			"upgrade",
			"accept-encoding",
			"forwarded",
			"sec-fetch-site",
			"sec-websocket-key",
			"sec-websocket-version",
			"sec-websocket-extensions",
			"sec-websocket-protocol"
		]);
		for (const [name, value] of Object.entries(req.headers)) if (value !== void 0 && !blocked.has(name) && !name.startsWith("x-forwarded") && !name.startsWith("x-dsh")) headers[name] = value;
		const host = `127.0.0.1:${this.options.upstreamPort}`;
		return {
			...headers,
			host,
			cookie: this.options.upstreamCookie(),
			origin: `http://${host}`,
			"sec-fetch-site": "same-origin",
			"accept-encoding": "identity"
		};
	}
	proxy(req, res, deviceId) {
		let upstream;
		upstream = request({
			hostname: "127.0.0.1",
			port: this.options.upstreamPort,
			path: req.url,
			method: req.method,
			headers: this.headers(req)
		}, (incoming) => {
			const headers = { ...incoming.headers };
			delete headers["set-cookie"];
			delete headers["connection"];
			delete headers["transfer-encoding"];
			if (headers.location) try {
				const target = new URL(headers.location, `http://127.0.0.1:${this.options.upstreamPort}`);
				if (target.host === `127.0.0.1:${this.options.upstreamPort}`) headers.location = target.pathname + target.search;
			} catch {
				delete headers.location;
			}
			res.writeHead(incoming.statusCode ?? 502, headers);
			incoming.pipe(res);
			res.once("close", () => incoming.destroy());
		});
		const untrack = this.track(deviceId, () => upstream.destroy());
		upstream.once("close", untrack);
		upstream.on("error", () => {
			if (!res.headersSent) json(res, 502, { error: "DSH 宿主连接失败。" });
			else res.destroy();
		});
		upstream.setTimeout(12e4, () => upstream.destroy());
		req.once("aborted", () => upstream.destroy());
		res.once("close", () => upstream.destroy());
		req.pipe(upstream);
	}
	async upgrade(req, socket, head) {
		const device = this.device(req);
		if (!device || !this.validHost(req) || !sameOrigin(req) || !safePath(req.url ?? "/")) {
			socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
			return;
		}
		const url = new URL(req.url ?? "/", "http://gateway.invalid");
		if (url.pathname === "/rc/sse") {
			const target = url.searchParams.get("path") ?? "";
			if (!safePath(target) || target.startsWith("/rc/") || decodeURIComponent(target.split("?")[0]) === "/api/dsh-remote-control/manage") {
				socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
				return;
			}
			this.wss.handleUpgrade(req, socket, head, (ws) => this.sse(req, ws, target, url.searchParams.get("lastEventId") ?? "", device.id));
			return;
		}
		const headers = this.headers(req);
		delete headers["sec-websocket-protocol"];
		const protocols = req.headers["sec-websocket-protocol"]?.split(",").map((p) => p.trim()) ?? [];
		const upstream = new WebSocket(`ws://127.0.0.1:${this.options.upstreamPort}${url.pathname}${url.search}`, protocols, {
			headers,
			maxPayload: 33554432,
			perMessageDeflate: false
		});
		const release = this.track(device.id, () => {
			upstream.terminate();
			socket.destroy();
		});
		socket.once("close", () => {
			upstream.terminate();
			release();
		});
		upstream.on("error", () => socket.destroy());
		upstream.once("open", () => {
			if (socket.destroyed) {
				upstream.terminate();
				return;
			}
			this.wss.handleUpgrade(req, socket, head, (ws) => {
				let alive = true;
				const heartbeat = setInterval(() => {
					if (!alive || !this.device(req)) {
						ws.terminate();
						upstream.terminate();
						return;
					}
					alive = false;
					ws.ping();
				}, 3e4);
				heartbeat.unref();
				ws.on("pong", () => {
					alive = true;
				});
				const send = (destination, data, binary) => {
					if (destination.readyState !== WebSocket.OPEN || destination.bufferedAmount > 8388608) {
						ws.terminate();
						upstream.terminate();
						return;
					}
					destination.send(data, { binary });
				};
				ws.on("message", (data, binary) => send(upstream, data, binary));
				upstream.on("message", (data, binary) => send(ws, data, binary));
				ws.on("error", () => upstream.terminate());
				ws.once("close", () => {
					clearInterval(heartbeat);
					upstream.terminate();
					release();
				});
				upstream.once("close", (code, reason) => {
					if (ws.readyState === WebSocket.OPEN) ws.close(code === 1006 ? 1011 : code, reason);
				});
			});
		});
	}
	sse(req, ws, path, lastId, deviceId) {
		const headers = this.headers(req);
		headers.accept = "text/event-stream";
		if (lastId && lastId.length < 4096 && !/[\r\n]/.test(lastId)) headers["last-event-id"] = lastId;
		const decoder = new StringDecoder("utf8");
		const upstream = request({
			hostname: "127.0.0.1",
			port: this.options.upstreamPort,
			path,
			headers
		}, (response) => {
			if (response.statusCode !== 200 || !response.headers["content-type"]?.includes("text/event-stream")) {
				ws.send(JSON.stringify({ type: "error" }));
				response.destroy();
				ws.close();
				return;
			}
			ws.send(JSON.stringify({ type: "ready" }));
			response.on("data", (chunk) => {
				if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 1048576) {
					upstream.destroy();
					ws.terminate();
					return;
				}
				ws.send(JSON.stringify({
					type: "chunk",
					data: decoder.write(chunk)
				}));
			});
			response.once("end", () => {
				const tail = decoder.end();
				if (tail && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({
					type: "chunk",
					data: tail
				}));
				ws.close();
			});
			response.once("error", () => ws.terminate());
			ws.once("close", () => response.destroy());
		});
		const release = this.track(deviceId, () => {
			upstream.destroy();
			ws.terminate();
		});
		let alive = true;
		ws.on("pong", () => {
			alive = true;
		});
		const ping = setInterval(() => {
			if (!alive || !this.device(req)) {
				upstream.destroy();
				ws.terminate();
				return;
			}
			alive = false;
			if (ws.readyState === WebSocket.OPEN) ws.ping();
		}, 3e4);
		ping.unref();
		ws.once("close", () => {
			clearInterval(ping);
			upstream.destroy();
			release();
		});
		ws.on("error", () => upstream.destroy());
		upstream.on("error", () => ws.close(1011, "Host unavailable"));
		upstream.end();
	}
	async close() {
		for (const id of [...this.active.keys()]) this.revoke(id);
		for (const socket of this.sockets) socket.destroy();
		for (const socket of this.wss.clients) socket.terminate();
		const server = this.server;
		this.server = void 0;
		if (server) await new Promise((resolve) => server.close(() => resolve()));
		this.port = 0;
		this.authorities.clear();
	}
};
//#endregion
//#region lib/types/tunnel.js
var TunnelManager = class {
	gateway;
	phase = "off";
	url;
	error;
	child;
	generation = 0;
	timer;
	monitor;
	failures = 0;
	checking = false;
	lastFailure = "";
	proxy;
	constructor(gateway) {
		this.gateway = gateway;
	}
	async start(proxy) {
		await this.stop();
		this.proxy = proxy ? new ProxyAgent(proxy) : void 0;
		const generation = ++this.generation;
		this.phase = "starting";
		this.error = void 0;
		const env = {
			...process.env,
			ELECTRON_RUN_AS_NODE: "1",
			NODE_USE_ENV_PROXY: "1",
			DSH_RC_TUNNEL_PORT: String(this.gateway.port)
		};
		if (proxy) Object.assign(env, {
			HTTPS_PROXY: proxy,
			HTTP_PROXY: proxy
		});
		const child = this.child = fork(fileURLToPath(new URL("./tunnel-worker.js", import.meta.url)), [], {
			env,
			windowsHide: true,
			stdio: [
				"ignore",
				"pipe",
				"pipe",
				"ipc"
			],
			execArgv: []
		});
		child.stdout?.resume();
		child.stderr?.resume();
		this.timer = setTimeout(() => {
			if (generation === this.generation) this.fail("隧道启动超过 120 秒；请检查网络或配置电脑端代理后重试。");
		}, 12e4);
		this.timer.unref();
		child.on("message", (value) => {
			if (generation !== this.generation || !value || typeof value !== "object" || !("phase" in value)) return;
			const message = value;
			if (message.phase === "downloading" || message.phase === "starting") this.phase = message.phase;
			if (message.phase === "error") this.fail(message.error ?? "隧道启动失败。");
			if (message.phase === "url" && message.url) {
				let url;
				try {
					url = new URL(message.url);
					if (url.protocol !== "https:" || !url.hostname.endsWith(".trycloudflare.com") || url.username || url.password || url.port || url.pathname !== "/") throw new Error();
				} catch {
					this.fail("untun 返回的公网地址不符合预期。");
					return;
				}
				clearTimeout(this.timer);
				this.url = url.origin;
				this.gateway.allowAuthority(url.host);
				this.phase = "verifying";
				this.probe(generation);
			}
		});
		child.on("error", () => {
			if (generation === this.generation) this.fail("无法启动隧道工作进程。");
		});
		child.on("exit", () => {
			if (generation === this.generation && this.phase !== "off" && this.phase !== "error") this.fail("隧道进程已退出，请重新开启。");
		});
	}
	async probe(generation) {
		if (!this.url || this.checking) return;
		this.checking = true;
		let healthy = false;
		try {
			const init = {
				signal: AbortSignal.timeout(1e4),
				redirect: "error"
			};
			const response = this.proxy ? await fetch$1(this.gateway.healthURL(this.url), {
				...init,
				dispatcher: this.proxy
			}) : await fetch(this.gateway.healthURL(this.url), init);
			healthy = response.ok && this.gateway.verifyHealth(await response.json());
			if (!healthy) this.lastFailure = response.ok ? "网关验证信息不匹配" : `HTTP ${response.status}`;
		} catch (failure) {
			const code = failure.cause?.code;
			this.lastFailure = code && /^[A-Z_0-9]+$/.test(code) ? code : failure.name === "TimeoutError" ? "请求超时" : "网络请求失败";
		} finally {
			this.checking = false;
		}
		if (generation !== this.generation) return;
		if (healthy) {
			this.failures = 0;
			this.phase = "ready";
			clearTimeout(this.timer);
			if (!this.monitor) {
				this.monitor = setInterval(() => {
					this.probe(generation);
				}, 3e4);
				this.monitor.unref();
			}
		} else if (++this.failures >= 3) this.fail(`公网地址未通过连通性检查（${this.lastFailure}）；域名分配不代表可用。请重试，或切换局域网连接。`);
		else {
			this.timer = setTimeout(() => {
				this.probe(generation);
			}, 3e3);
			this.timer.unref();
		}
	}
	fail(message) {
		this.phase = "error";
		this.error = message;
		if (this.url) this.gateway.disallowAuthority(new URL(this.url).host);
		this.url = void 0;
		++this.generation;
		clearTimeout(this.timer);
		clearInterval(this.monitor);
		this.monitor = void 0;
		const child = this.child;
		this.child = void 0;
		this.proxy?.destroy();
		this.proxy = void 0;
		this.closeChild(child);
	}
	async closeChild(child) {
		if (!child || child.exitCode !== null || child.signalCode !== null) return;
		await new Promise((resolve) => {
			const timer = setTimeout(() => {
				if (process.platform === "win32" && child.pid) execFile("taskkill", [
					"/PID",
					String(child.pid),
					"/T",
					"/F"
				], { windowsHide: true }, () => resolve());
				else {
					child.kill("SIGKILL");
					resolve();
				}
			}, 3e3);
			child.once("exit", () => {
				clearTimeout(timer);
				resolve();
			});
			if (child.connected) child.send("stop", () => {});
		});
	}
	async stop() {
		++this.generation;
		clearTimeout(this.timer);
		clearInterval(this.monitor);
		this.monitor = void 0;
		if (this.url) this.gateway.disallowAuthority(new URL(this.url).host);
		const child = this.child;
		this.child = void 0;
		this.url = void 0;
		this.phase = "off";
		this.failures = 0;
		const proxy = this.proxy;
		this.proxy = void 0;
		await Promise.all([this.closeChild(child), proxy?.destroy()]);
	}
};
//#endregion
//#region lib/types/index.js
const name = "@copylee/dsh-remote-control";
const inject = ["connection"];
const Config = z.object({ gatewayPort: z.natural().max(65535).default(0).i18n({ "zh-CN": { $description: "局域网网关端口；0 表示自动选择空闲端口。" } }) });
const mime = {
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".woff2": "font/woff2",
	".webmanifest": "application/manifest+json"
};
/** Exchange the Host's launch token entirely inside the process. */
function hostCookie(connection, port) {
	const base = `http://127.0.0.1:${port}/`;
	const authenticated = new URL(connection.authenticatedUrl(base));
	let cookie = "";
	connection.authorizeIndex({
		method: "GET",
		url: authenticated.pathname + authenticated.search,
		headers: { host: `127.0.0.1:${port}` }
	}, {
		writeHead(_status, headers) {
			cookie = headers?.["set-cookie"]?.split(";")[0] ?? "";
		},
		end() {}
	});
	if (!cookie) throw new Error("DSH 宿主认证接口无法建立内部会话。");
	return cookie;
}
async function apply(ctx, config = {}) {
	const profile = ctx.get("profileContext");
	const storage = join(process.env.DSH_HOME || join(homedir(), ".dsh"), "dsh-remote-control", String(profile?.name || process.env.DSH_PROFILE || "default").replace(/[^a-zA-Z0-9_-]/g, "_"));
	mkdirSync(storage, { recursive: true });
	const prefsFile = join(storage, "preferences.json");
	let preferences = {
		autoStart: false,
		mode: "public"
	};
	if (existsSync(prefsFile)) {
		const stored = JSON.parse(readFileSync(prefsFile, "utf8"));
		preferences = {
			autoStart: stored.autoStart === true,
			mode: [
				"public",
				"lan",
				"fixed"
			].includes(stored.mode) ? stored.mode : "public",
			proxy: typeof stored.proxy === "string" ? stored.proxy : void 0
		};
	}
	function savePreferences() {
		const temporary = `${prefsFile}.${randomUUID()}.tmp`;
		writeFileSync(temporary, JSON.stringify(preferences), { mode: 384 });
		renameSync(temporary, prefsFile);
	}
	let gateway;
	let tunnel;
	let enabled = false, busy = false, disposed = false;
	let error;
	let qr;
	const pairing = new PairingService({
		file: join(storage, "devices.json"),
		onRevoke: (id) => gateway?.revoke(id)
	});
	if (!ctx.get("webServer")) ctx.plugin(WebServer, {
		host: "127.0.0.1",
		port: 0
	});
	let shutdown = async () => {};
	ctx.effect(() => () => {
		disposed = true;
		return shutdown();
	}, "remote-control cleanup");
	ctx.inject(["webServer"], async (ready) => {
		const upstreamPort = ready.webServer.port;
		if (!upstreamPort) throw new Error("DSH WebServer 尚未就绪。");
		let credential = hostCookie(ready.connection, upstreamPort);
		const require = createRequire(import.meta.url);
		const distRoot = join(dirname(require.resolve("@deepseek-ai/dsh-web-frontend/package.json")), "dist");
		const renderIndex = async () => ready.webServer.renderIndex(await readFile(join(distRoot, "index.html"), "utf8"));
		const asset = async (pathname, res) => {
			if (!pathname.startsWith("/assets/") && ![
				"/favicon.svg",
				"/favicon-dark.svg",
				"/manifest.webmanifest"
			].includes(pathname)) return false;
			const path = resolve(distRoot, `.${decodeURIComponent(pathname)}`);
			if (!path.startsWith(resolve(distRoot) + sep)) {
				res.writeHead(403).end();
				return true;
			}
			try {
				const data = await readFile(path);
				res.writeHead(200, {
					"content-type": mime[extname(path)] ?? "application/octet-stream",
					"cache-control": "private, max-age=3600"
				});
				res.end(data);
			} catch {
				res.writeHead(404).end();
			}
			return true;
		};
		const lanAddresses = () => Object.values(networkInterfaces()).flatMap((rows) => rows ?? []).filter((row) => row.family === "IPv4" && !row.internal).map((row) => row.address);
		const baseURLs = () => !enabled || !gateway ? [] : preferences.mode === "public" ? tunnel?.phase === "ready" && tunnel.url ? [tunnel.url] : [] : lanAddresses().map((ip) => `http://${ip}:${gateway.port}`);
		const status = async (local) => {
			const links = baseURLs().map((base) => ({
				base,
				url: qr ? `${base}/pair#pair=${qr.token}` : void 0
			}));
			const active = new Set(gateway?.onlineIds() ?? []);
			return {
				enabled,
				busy,
				mode: preferences.mode,
				autoStart: preferences.autoStart,
				proxyConfigured: !!preferences.proxy,
				phase: enabled ? preferences.mode === "public" ? tunnel?.phase ?? "starting" : "ready" : "off",
				error: error ?? tunnel?.error,
				gatewayPort: gateway?.port ?? 0,
				local,
				expiresAt: qr?.expiresAt,
				links,
				qr: links[0]?.url ? await QRCode.toDataURL(links[0].url, {
					width: 260,
					margin: 2,
					errorCorrectionLevel: "M"
				}) : void 0,
				requests: local ? pairing.requests() : [],
				devices: pairing.list().map((device) => ({
					...device,
					online: active.has(device.id)
				})),
				fixedAvailable: false,
				fixedReason: "尚未找到已验证、允许第三方使用的免费固定入口服务。",
				lanHint: "手机需与电脑处于同一局域网。若连接被防火墙阻断，请手动允许网关端口；插件不会修改防火墙。"
			};
		};
		const stop = async () => {
			enabled = false;
			qr = void 0;
			pairing.invalidate();
			const current = gateway;
			gateway = void 0;
			await Promise.allSettled([tunnel?.stop(), current?.close()]);
			tunnel = void 0;
		};
		shutdown = stop;
		const start = async () => {
			if (busy) throw new Error("连接操作正在进行，请稍后再试。");
			if (preferences.mode === "fixed") throw new Error("固定入口暂不可用，请选择临时公网或局域网。");
			busy = true;
			error = void 0;
			try {
				await stop();
				if (disposed) return;
				credential = hostCookie(ready.connection, upstreamPort);
				const next = gateway = new Gateway({
					pairing,
					upstreamPort,
					upstreamCookie: () => credential,
					manage,
					index: renderIndex,
					asset
				});
				await next.listen(preferences.mode === "lan" ? "0.0.0.0" : "127.0.0.1", config.gatewayPort ?? 0);
				if (disposed) {
					await stop();
					return;
				}
				for (const address of lanAddresses()) next.allowAuthority(`${address}:${next.port}`);
				enabled = true;
				qr = pairing.issue();
				if (preferences.mode === "public") {
					tunnel = new TunnelManager(next);
					await tunnel.start(preferences.proxy);
				}
			} catch (failure) {
				error = failure instanceof Error ? failure.message : "启动失败。";
				await stop();
				throw failure;
			} finally {
				busy = false;
			}
		};
		async function manage(input, local) {
			switch (input.action) {
				case "status": return status(local);
				case "start":
					await start();
					return status(local);
				case "stop":
					setTimeout(() => {
						stop();
					}, 75);
					return { stopped: true };
				case "refresh":
					if (!enabled) throw new Error("请先开启远程连接。");
					qr = pairing.issue();
					return status(local);
				case "approve":
					if (!local) throw new Error("首次配对必须在本机确认。");
					pairing.approve(String(input.id));
					return status(local);
				case "reject":
					if (!local) throw new Error("配对请求由本机处理。");
					pairing.reject(String(input.id));
					return status(local);
				case "revoke": {
					const id = String(input.id);
					setTimeout(() => {
						try {
							pairing.revoke(id);
						} catch {
							error = "撤销失败，授权文件未能保存；请在本机重试。";
						}
					}, 75);
					return { revoked: true };
				}
				case "revokeAll":
					setTimeout(() => {
						try {
							pairing.revokeAll();
							qr = void 0;
						} catch {
							error = "撤销失败，请在本机重试。";
						}
					}, 75);
					return { revoked: true };
				case "preferences": {
					if (busy) throw new Error("请等待当前连接操作完成。");
					const next = { ...preferences };
					if (typeof input.autoStart === "boolean") next.autoStart = input.autoStart;
					if (input.mode !== void 0) {
						if (![
							"public",
							"lan",
							"fixed"
						].includes(String(input.mode))) throw new Error("连接模式不正确。");
						next.mode = input.mode;
					}
					if (input.proxy !== void 0) {
						const value = String(input.proxy).trim();
						if (value) {
							const url = new URL(value);
							if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("代理需为不带用户名和密码的 HTTP(S) 地址。");
						}
						next.proxy = value || void 0;
					}
					if (next.mode !== preferences.mode && enabled) await stop();
					const previous = preferences;
					preferences = next;
					try {
						savePreferences();
					} catch (failure) {
						preferences = previous;
						throw failure;
					}
					return status(local);
				}
				default: throw new Error("未知的远程控制操作。");
			}
		}
		const localHandler = async (req, res) => {
			const rejection = ready.connection.requestRejection(req);
			if (rejection || !isLoopback(req.socket.remoteAddress) || !sameOrigin(req)) {
				json(res, rejection ?? 403, { error: "本机面板需要宿主认证和本机连接。" });
				return;
			}
			if (req.method !== "POST") {
				json(res, 405, { error: "POST only" });
				return;
			}
			try {
				json(res, 200, await manage(await body(req), true));
			} catch (failure) {
				json(res, 400, { error: failure instanceof Error ? failure.message : "操作失败。" });
			}
		};
		ready.effect(() => ready.webServer.register({
			kind: "exact",
			path: MANAGE_PATH,
			handler: localHandler
		}), "remote-control local management");
		ready.effect(() => ready.connection.fetch.register({
			path: MANAGE_PATH,
			methods: ["POST"],
			requestBody: "buffered",
			fetch: async (request) => {
				try {
					const input = await request.json();
					return Response.json(await manage(input, true), { headers: { "cache-control": "no-store" } });
				} catch (failure) {
					return Response.json({ error: failure instanceof Error ? failure.message : "操作失败。" }, { status: 400 });
				}
			}
		}), "remote-control Desktop management");
		if (preferences.autoStart && !disposed) await start().catch(() => {});
	});
}
//#endregion
export { Config, apply, hostCookie, inject, name };
