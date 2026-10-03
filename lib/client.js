window.__ModuleLoader__.load({
	id: "@copylee/dsh-remote-control",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region lib/types/client/style.js
		const CSS = `
.dsrc-dialog,.dsrc-panel{font-family:var(--dsh-font-family,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif)}
.dsrc{--rc-ink:var(--dsw-alias-label-primary,#26302b);--rc-muted:var(--dsw-alias-label-secondary,#6b756e);--rc-line:var(--dsw-alias-border-l2,#dce2db);--rc-paper:var(--dsw-alias-background-primary,#fff);--rc-accent:#47735a;color:var(--rc-ink);font-family:inherit;max-width:880px;line-height:1.6}
.dsrc *{box-sizing:border-box}.dsrc button,.dsrc input{font:inherit}.dsrc button{cursor:pointer}.dsrc button:disabled{cursor:default;opacity:.5}.dsrc button:focus-visible,.dsrc input:focus-visible{outline:2px solid #47735a;outline-offset:3px}.dsrc h2,.dsrc h3,.dsrc p{margin:0}.dsrc-head{display:flex;justify-content:space-between;align-items:start;gap:20px;margin-bottom:24px}.dsrc-eyebrow{font-size:10px;letter-spacing:.15em;color:var(--rc-muted);margin-bottom:8px}.dsrc h2{font-size:24px;font-weight:650;letter-spacing:-.04em}.dsrc-sub{font-size:13px;color:var(--rc-muted);margin-top:6px!important}.dsrc-badge{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--rc-line);border-radius:100px;padding:5px 11px;font-size:12px;white-space:nowrap}.dsrc-dot{width:7px;height:7px;background:#9aa59d;border-radius:100%}.dsrc-badge[data-ready=true] .dsrc-dot{background:#6e9869;box-shadow:0 0 0 3px #6e986917}.dsrc-surface{border:1px solid var(--rc-line);border-radius:18px;padding:22px;margin-top:16px;background:var(--rc-paper)}.dsrc-row{display:flex;align-items:center;justify-content:space-between;gap:14px}.dsrc h3{font-size:15px;font-weight:600}.dsrc-muted{color:var(--rc-muted);font-size:12px}.dsrc-mode{display:flex;gap:8px;margin-top:16px}.dsrc-mode button{flex:1;border:1px solid var(--rc-line);background:transparent;color:var(--rc-muted);border-radius:10px;padding:10px 8px;font-size:13px}.dsrc-mode button[aria-pressed=true]{background:#47735a12;border-color:#7f9c84;color:var(--rc-ink)}.dsrc-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:16px}.dsrc-button{border:1px solid var(--rc-line);border-radius:9px;padding:8px 14px;background:transparent;color:var(--rc-ink);font-size:12px}.dsrc-primary{background:var(--rc-accent);color:white;border-color:var(--rc-accent)}.dsrc-danger{color:#b05748}.dsrc-toggle{display:flex;align-items:center;gap:8px;color:var(--rc-muted);font-size:12px;margin-top:16px}.dsrc-toggle input{accent-color:var(--rc-accent);width:16px;height:16px}.dsrc-pair{display:grid;grid-template-columns:210px 1fr;gap:28px;align-items:center;margin-top:18px}.dsrc-code{display:grid;place-items:center;aspect-ratio:1;background:#fff;border:1px solid var(--rc-line);border-radius:16px;padding:8px;overflow:hidden}.dsrc-code img{display:block;width:100%;height:100%;object-fit:contain}.dsrc-placeholder{font-size:12px;color:#79857c;padding:20px;text-align:center;line-height:1.8}.dsrc-steps{display:grid;gap:12px;font-size:13px}.dsrc-step{display:flex;align-items:start;gap:10px}.dsrc-number{font-size:11px;background:#47735a12;border:1px solid var(--rc-line);border-radius:50%;width:23px;height:23px;display:grid;place-items:center;flex-shrink:0}.dsrc-link{font-family:ui-monospace,monospace;font-size:11px;word-break:break-all;background:#7b918008;padding:10px;border:1px solid var(--rc-line);border-radius:8px;margin-top:16px}.dsrc-note{font-size:12px;margin-top:14px!important;color:var(--rc-muted)}.dsrc-error{font-size:12px;padding:12px 14px;background:#b057480b;border:1px solid #b0574835;border-radius:10px;color:#b05748;margin-top:14px;overflow-wrap:anywhere}.dsrc-device{padding:14px 0;border-top:1px solid var(--rc-line)}.dsrc-device:first-of-type{margin-top:14px}.dsrc-device-name{font-size:13px}.dsrc-empty{padding:18px 0 4px;font-size:12px;color:var(--rc-muted)}.dsrc-proxy{margin-top:18px;border-top:1px solid var(--rc-line);padding-top:14px}.dsrc-proxy summary{font-size:12px;cursor:pointer;color:var(--rc-muted)}.dsrc-input{margin-top:10px;display:flex;gap:8px}.dsrc-input input{min-width:0;flex:1;border:1px solid var(--rc-line);border-radius:8px;padding:8px 10px;color:var(--rc-ink);background:transparent;font-size:12px}.dsrc-entry{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;color:inherit;background:transparent;border-radius:8px;padding:8px;min-width:36px;min-height:36px;font:inherit;cursor:pointer}.dsrc-entry:hover{background:#80918015}.dsrc-entry svg{width:18px;height:18px}.dsrc-dialog{border:1px solid var(--dsw-alias-border-l2,#dce2db);background:var(--dsw-alias-background-primary,#fff);color:inherit;border-radius:22px;padding:28px;width:min(800px,calc(100vw - 32px));max-height:calc(100dvh - 40px);overflow:auto}.dsrc-dialog::backdrop{background:#17251bcc;backdrop-filter:blur(3px)}.dsrc-close{float:right;border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer;padding:4px 10px}.dsrc-device .dsrc-actions{margin-top:0}
.dsrc-dialog{box-sizing:border-box;font:14px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}
@media(max-width:560px){.dsrc-surface{padding:17px}.dsrc-head{gap:8px}.dsrc h2{font-size:22px}.dsrc-pair{grid-template-columns:1fr;gap:20px}.dsrc-code{width:220px;max-width:100%;justify-self:center}.dsrc-mode{gap:5px}.dsrc-mode button{font-size:12px;padding:10px 5px}.dsrc-device{flex-wrap:wrap}.dsrc-dialog{padding:18px}.dsrc button{min-height:40px}.dsrc-input input{font-size:16px}}
@media(prefers-color-scheme:dark){.dsrc{--rc-ink:var(--dsw-alias-label-primary,#e0e7df);--rc-muted:var(--dsw-alias-label-secondary,#a0aca1);--rc-line:var(--dsw-alias-border-l2,#3c493e);--rc-paper:var(--dsw-alias-background-primary,#232b24)}.dsrc-dialog{background:var(--dsw-alias-background-primary,#232b24)}}
`;
		//#endregion
		//#region lib/types/client/index.js
		const h = react.createElement;
		const ROUTE = "/api/dsh-remote-control/manage";
		async function command(input) {
			const response = await (globalThis.__DSH_TRANSPORT__?.fetch ?? fetch)(ROUTE, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(input)
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error ?? `连接失败（HTTP ${response.status}）`);
			return data;
		}
		const phaseLabels = {
			off: "未开启",
			downloading: "下载连接组件",
			starting: "建立隧道",
			verifying: "验证公网连接",
			ready: "已开启",
			error: "连接失败"
		};
		function icon() {
			return h("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				"aria-hidden": true
			}, h("rect", {
				x: 7,
				y: 2,
				width: 10,
				height: 20,
				rx: 3
			}), h("path", { d: "M10 5h4M11 19h2" }));
		}
		function RemoteControlPanel() {
			const [state, setState] = react.useState(null);
			const [error, setError] = react.useState("");
			const [working, setWorking] = react.useState(false);
			const [proxy, setProxy] = react.useState("");
			const [notice, setNotice] = react.useState("");
			const mounted = react.useRef(true), pending = react.useRef(false);
			const refresh = react.useCallback(async () => {
				if (pending.current) return;
				pending.current = true;
				try {
					const data = await command({ action: "status" });
					if (mounted.current) {
						setState(data);
						setError("");
					}
				} catch (failure) {
					if (mounted.current) setError(failure instanceof Error ? failure.message : "状态读取失败。");
				} finally {
					pending.current = false;
				}
			}, []);
			react.useEffect(() => {
				mounted.current = true;
				refresh();
				const timer = setInterval(() => {
					refresh();
				}, 2e3);
				return () => {
					mounted.current = false;
					clearInterval(timer);
				};
			}, [refresh]);
			const act = async (action, fields = {}) => {
				setWorking(true);
				setNotice("");
				try {
					const data = await command({
						action,
						...fields
					});
					if (data.links) setState(data);
					else if (action === "stop") {
						setState((previous) => previous ? {
							...previous,
							enabled: false,
							phase: "off",
							links: [],
							qr: void 0
						} : previous);
						setNotice("远程连接已关闭，设备授权保留。");
					} else {
						setNotice("操作已提交。");
						setTimeout(() => {
							refresh();
						}, 200);
					}
					setError("");
				} catch (failure) {
					setError(failure instanceof Error ? failure.message : "操作失败。");
				} finally {
					setWorking(false);
				}
			};
			const copy = async (url) => {
				try {
					await navigator.clipboard.writeText(url);
					setNotice("配对链接已复制。");
				} catch {
					setNotice("浏览器不允许自动复制，请选中下面的链接手动复制。");
				}
			};
			const expired = !!state?.expiresAt && Date.now() >= state.expiresAt;
			const disabled = working || !!state?.busy;
			const firstURL = state?.links[0]?.url;
			const button = (label, action, fields, extra = "") => h("button", {
				type: "button",
				className: `dsrc-button ${extra}`,
				disabled,
				onClick: () => {
					act(action, fields);
				}
			}, label);
			return h("div", {
				className: "dsrc",
				"data-dsh-plugin": "dsh-remote-control"
			}, h("header", { className: "dsrc-head" }, h("div", null, h("div", { className: "dsrc-eyebrow" }, "YOUR WORK, WITH YOU"), h("h2", null, "远程控制"), h("p", { className: "dsrc-sub" }, "离开电脑，也能接着做。扫码后在本机确认连接。")), h("span", {
				className: "dsrc-badge",
				"data-ready": state?.phase === "ready"
			}, h("span", { className: "dsrc-dot" }), phaseLabels[state?.phase ?? "off"] ?? "读取状态")), h("section", { className: "dsrc-surface" }, h("div", { className: "dsrc-row" }, h("h3", null, "连接方式"), h("span", { className: "dsrc-muted" }, state?.mode === "lan" ? "同一 Wi-Fi" : "免费临时地址")), h("div", {
				className: "dsrc-mode",
				role: "group",
				"aria-label": "连接方式"
			}, ...[
				["public", "临时公网"],
				["lan", "局域网"],
				["fixed", "固定入口 · 暂不可用"]
			].map(([mode, label]) => h("button", {
				key: mode,
				type: "button",
				"aria-pressed": state?.mode === mode,
				disabled: disabled || mode === "fixed",
				title: mode === "fixed" ? state?.fixedReason : void 0,
				onClick: () => {
					act("preferences", { mode });
				}
			}, label))), h("p", { className: "dsrc-note" }, state?.mode === "lan" ? state.lanHint : "无需账号或域名。临时地址可能变化，换地址后需要重新扫码。固定入口待免费服务验证通过后提供。"), h("div", { className: "dsrc-actions" }, state?.enabled ? button("关闭连接", "stop") : button("开启远程连接", "start", {}, "dsrc-primary"), state?.phase === "error" ? button("重新连接", "start", {}, "dsrc-primary") : null), h("label", { className: "dsrc-toggle" }, h("input", {
				type: "checkbox",
				checked: state?.autoStart ?? false,
				disabled,
				onChange: (event) => {
					act("preferences", { autoStart: event.target.checked });
				}
			}), "随 DSH 启动，自动开启所选连接方式"), state?.mode !== "lan" ? h("details", { className: "dsrc-proxy" }, h("summary", null, state?.proxyConfigured ? "电脑端代理 · 已配置" : "电脑端代理（可选）"), h("div", { className: "dsrc-input" }, h("input", {
				"aria-label": "电脑端代理地址",
				placeholder: "http://127.0.0.1:7890",
				value: proxy,
				onChange: (event) => setProxy(event.target.value)
			}), button("保存代理", "preferences", { proxy })), h("p", { className: "dsrc-note" }, "留空使用已有环境代理。保存后重新连接生效，手机仍通过普通网络访问。开启穿透会下载并运行 Cloudflare 连接组件。")) : null), h("section", { className: "dsrc-surface" }, h("div", { className: "dsrc-row" }, h("h3", null, "扫码配对"), h("span", { className: "dsrc-muted" }, expired ? "二维码已过期" : firstURL ? "5 分钟有效" : "等待连接就绪")), h("div", { className: "dsrc-pair" }, h("div", { className: "dsrc-code" }, state?.qr && !expired ? h("img", {
				src: state.qr,
				alt: "远程控制配对二维码"
			}) : h("div", { className: "dsrc-placeholder" }, expired ? "点击刷新二维码" : "连接就绪后\n二维码会显示在这里")), h("div", { className: "dsrc-steps" }, ...[
				"开启连接并用手机扫码",
				"在本机面板确认配对请求",
				"进入官方界面，继续会话和审批"
			].map((step, i) => h("div", {
				className: "dsrc-step",
				key: step
			}, h("span", { className: "dsrc-number" }, String(i + 1).padStart(2, "0")), h("span", null, step))), h("p", { className: "dsrc-muted" }, "配对设备与本机同权，可以管理设置、凭据和插件。"))), firstURL ? h("div", { className: "dsrc-link" }, firstURL) : null, h("div", { className: "dsrc-actions" }, h("button", {
				type: "button",
				className: "dsrc-button",
				disabled: !firstURL || expired,
				onClick: () => {
					if (firstURL) copy(firstURL);
				}
			}, "复制链接"), h("button", {
				type: "button",
				className: "dsrc-button",
				disabled: !state?.enabled || disabled,
				onClick: () => {
					act("refresh");
				}
			}, "刷新二维码")), state?.links && state.links.length > 1 ? h("p", { className: "dsrc-note" }, "其他网卡地址：", ...state.links.slice(1).map((link) => h("span", { key: link.base }, " ", h("button", {
				type: "button",
				className: "dsrc-button",
				onClick: () => {
					if (link.url) copy(link.url);
				}
			}, link.base)))) : null), state?.local && state.requests.length ? h("section", { className: "dsrc-surface" }, h("h3", null, "等待你确认"), ...state.requests.map((request) => h("div", {
				className: "dsrc-device dsrc-row",
				key: request.id
			}, h("div", null, h("div", { className: "dsrc-device-name" }, request.name), h("div", { className: "dsrc-muted" }, "允许后授予与本机相同的权限")), h("div", { className: "dsrc-actions" }, button("拒绝", "reject", { id: request.id }), button("允许连接", "approve", { id: request.id }, "dsrc-primary"))))) : null, h("section", { className: "dsrc-surface" }, h("div", { className: "dsrc-row" }, h("h3", null, "已授权设备"), state?.devices.length ? button("撤销全部", "revokeAll", {}, "dsrc-danger") : null), state?.devices.length ? state.devices.map((device) => h("div", {
				className: "dsrc-device dsrc-row",
				key: device.id
			}, h("div", null, h("div", { className: "dsrc-device-name" }, device.name, device.online ? " · 在线" : ""), h("div", { className: "dsrc-muted" }, "最近使用 ", new Date(device.lastSeenAt).toLocaleString("zh-CN"))), button("撤销授权", "revoke", { id: device.id }, "dsrc-danger"))) : h("p", { className: "dsrc-empty" }, "还没有配对设备。扫码并确认后，设备会出现在这里。"), h("p", { className: "dsrc-note" }, "设备连续 30 天未使用后过期。关闭连接会保留授权；撤销授权会切断设备的现有连接。")), error || state?.error ? h("div", {
				className: "dsrc-error",
				role: "alert"
			}, error || state?.error) : null, notice ? h("p", {
				className: "dsrc-note",
				role: "status"
			}, notice) : null);
		}
		function SidebarEntry() {
			const [open, setOpen] = react.useState(false), dialog = react.useRef(null);
			react.useEffect(() => {
				if (open) dialog.current?.showModal();
				else dialog.current?.close();
			}, [open]);
			return h(react.Fragment, null, h("button", {
				type: "button",
				className: "dsrc-entry",
				title: "远程控制",
				"aria-label": "远程控制",
				onClick: () => setOpen(true)
			}, icon()), h("dialog", {
				className: "dsrc-dialog",
				ref: dialog,
				onCancel: () => setOpen(false),
				onClick: (event) => {
					if (event.target === event.currentTarget) {
						const r = event.currentTarget.getBoundingClientRect();
						if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) setOpen(false);
					}
				}
			}, h("button", {
				type: "button",
				className: "dsrc-close",
				"aria-label": "关闭远程控制面板",
				onClick: () => setOpen(false)
			}, "×"), open ? h(RemoteControlPanel) : null));
		}
		const inject = ["slots", "connection"];
		function apply(ctx) {
			ctx.effect(() => {
				const style = document.createElement("style");
				style.dataset.dshRemoteControl = "true";
				style.textContent = CSS;
				document.head.append(style);
				return () => style.remove();
			}, "remote-control styles");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "copylee-remote-control",
				order: 65,
				label: () => "远程控制"
			}, () => h(RemoteControlPanel)));
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "copylee-remote-control",
				order: 65
			}, () => h(SidebarEntry)));
		}
		//#endregion
		exports.RemoteControlPanel = RemoteControlPanel;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
