import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { startTunnel } from "untun";
//#region lib/types/tunnel-worker.js
let tunnel;
let cancelled = false;
const send = (value) => {
	if (process.connected) process.send?.(value);
};
async function stop() {
	cancelled = true;
	try {
		await tunnel?.close();
	} finally {
		if (tunnel) process.exit(0);
	}
}
process.on("message", (message) => {
	if (message === "stop") stop();
});
process.on("disconnect", () => {
	stop();
});
try {
	const port = Number(process.env.DSH_RC_TUNNEL_PORT);
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("网关端口不正确。");
	const version = process.env.CLOUDFLARED_VERSION || "2026.7.2";
	send({ phase: existsSync(join(tmpdir(), "node-untun", `cloudflared.${version}${process.platform === "win32" ? ".exe" : ""}`)) ? "starting" : "downloading" });
	tunnel = await startTunnel({
		url: `http://127.0.0.1:${port}`,
		acceptCloudflareNotice: true,
		extraArgs: ["--no-autoupdate"]
	});
	if (!tunnel) throw new Error("untun 未能启动。");
	if (cancelled) await stop();
	else {
		send({ phase: "starting" });
		const url = await tunnel.getURL();
		if (!cancelled) send({
			phase: "url",
			url
		});
	}
} catch {
	send({
		phase: "error",
		error: "untun 启动失败，请检查下载网络、代理和 Cloudflare 可达性。"
	});
	await tunnel?.close().catch(() => {});
	process.exit(1);
}
//#endregion
export {};
