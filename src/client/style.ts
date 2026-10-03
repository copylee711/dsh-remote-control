/**
 * The remote-control panel on the computer (settings page and sidebar dialog),
 * also shown inside the remote app. Compact desktop sizes per docs/ui-spec.md;
 * touch sizes below 560px.
 */
import { accentCSS } from '../accent.js'
export const CSS = `
.dsrc{--rc-ink:var(--dsw-alias-label-primary,#292724);--rc-muted:var(--dsw-alias-label-secondary,#77736c);--rc-line:var(--dsw-alias-border-l2,#e4e0d8);--rc-paper:var(--dsw-alias-background-primary,#fff);--rc-fill:color-mix(in srgb,var(--rc-ink) 6%,transparent);--rc-accent:#D97757;--rc-accent-ink:#fff;--rc-danger:#B34337;color:var(--rc-ink);font-family:inherit;font-size:13px;line-height:1.6;max-width:760px;margin:0 auto}
.dsrc *{box-sizing:border-box}
.dsrc h2,.dsrc h3,.dsrc p{margin:0}
.dsrc h2{font-size:18px;font-weight:650}
.dsrc h3{font-size:14px;font-weight:600}
.dsrc button,.dsrc input{font:inherit;color:inherit}
.dsrc button{cursor:pointer}
.dsrc button:disabled{cursor:default;opacity:.45}
.dsrc button:focus-visible,.dsrc input:focus-visible,.dsrc summary:focus-visible{outline:2px solid var(--rc-accent);outline-offset:2px}

.dsrc-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:14px}
.dsrc-sub{font-size:12px;color:var(--rc-muted);margin-top:2px!important}
.dsrc-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:var(--rc-fill);padding:3px 10px;font-size:12px;white-space:nowrap}
.dsrc-dot{width:6px;height:6px;background:var(--rc-muted);border-radius:50%}
.dsrc-badge[data-ready=true]{background:color-mix(in srgb,var(--rc-accent) 12%,transparent);color:var(--rc-accent)}
.dsrc-badge[data-ready=true] .dsrc-dot{background:var(--rc-accent)}

.dsrc-surface{border:1px solid var(--rc-line);border-radius:12px;padding:16px;margin-top:12px;background:var(--rc-paper)}
.dsrc-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsrc-muted{color:var(--rc-muted);font-size:12px}
.dsrc-note{color:var(--rc-muted);font-size:12px;margin-top:10px!important}
.dsrc-empty{color:var(--rc-muted);padding:14px 0 4px}
.dsrc-error{color:var(--rc-danger);background:color-mix(in srgb,var(--rc-danger) 8%,transparent);border-radius:8px;padding:8px 12px;margin-top:12px;overflow-wrap:anywhere}

.dsrc-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}
.dsrc-row>.dsrc-actions{margin-top:0;flex-shrink:0}
.dsrc-button{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 12px;border:1px solid var(--rc-line);border-radius:8px;background:transparent;font-size:13px;white-space:nowrap;transition:background .12s}
.dsrc-button:hover:not(:disabled){background:var(--rc-fill)}
.dsrc-primary{background:var(--rc-accent);border-color:var(--rc-accent);color:var(--rc-accent-ink)!important;font-weight:600}
.dsrc-primary:hover:not(:disabled){background:var(--rc-accent);filter:brightness(.93)}
.dsrc-danger{border-color:transparent;color:var(--rc-danger)!important;padding:0 8px}
.dsrc-danger:hover:not(:disabled){background:color-mix(in srgb,var(--rc-danger) 10%,transparent)}

.dsrc-ways{display:grid;gap:8px;margin-top:12px}
.dsrc .dsrc-way{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;border:1px solid var(--rc-line);border-radius:10px;background:transparent;padding:10px 12px;transition:border-color .12s,background .12s}
.dsrc .dsrc-way:hover:not(:disabled){background:var(--rc-fill)}
.dsrc .dsrc-way[aria-checked=true]{border-color:var(--rc-accent);background:color-mix(in srgb,var(--rc-accent) 6%,transparent)}
.dsrc-way-mark{flex-shrink:0;width:16px;height:16px;margin-top:2px;border-radius:50%;border:1.5px solid var(--rc-muted)}
.dsrc-way[aria-checked=true] .dsrc-way-mark{border:5px solid var(--rc-accent)}
.dsrc-way-name{display:flex;align-items:center;gap:6px;font-weight:600}
.dsrc-way-text{display:block;color:var(--rc-muted);font-size:12px;margin-top:2px}
.dsrc-confirm{margin-top:10px;padding:12px;border-radius:10px;background:var(--rc-fill)}
.dsrc-confirm .dsrc-actions{margin-top:10px}
.dsrc-mode{display:inline-flex;gap:2px;margin-top:12px;padding:3px;border-radius:10px;background:var(--rc-fill);max-width:100%}
.dsrc-mode button{border:0;background:transparent;color:var(--rc-muted);border-radius:7px;height:28px;padding:0 14px;font-size:13px;white-space:nowrap}
.dsrc-mode button[aria-pressed=true]{background:var(--rc-paper);color:var(--rc-ink);font-weight:600;box-shadow:0 1px 2px #0000001f}
.dsrc-routes{margin:0 4px;vertical-align:middle}
.dsrc-routes button{height:24px;padding:0 10px;font-size:12px}
.dsrc-toggle{display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer}
.dsrc-toggle input{width:15px;height:15px;accent-color:var(--rc-accent);margin:0}
.dsrc-proxy{margin-top:12px;border-top:1px solid var(--rc-line);padding-top:10px}
.dsrc-proxy summary{cursor:pointer;color:var(--rc-muted);font-size:12px}
.dsrc-input{display:flex;gap:8px;margin-top:10px}
.dsrc-input input{flex:1;min-width:0;height:30px;border:1px solid var(--rc-line);border-radius:8px;background:transparent;padding:0 10px}
.dsrc-swatches{display:inline-flex;gap:8px;vertical-align:middle;margin:0 6px}
.dsrc .dsrc-swatch{width:18px;height:18px;padding:0;border-radius:50%;border:2px solid var(--rc-paper);background:var(--rc-swatch);box-shadow:0 0 0 1px var(--rc-line)}
.dsrc .dsrc-swatch[aria-checked=true]{box-shadow:0 0 0 2px var(--rc-ink)}

.dsrc-pair{display:grid;grid-template-columns:168px 1fr;gap:20px;align-items:center;margin-top:14px}
.dsrc-code{width:168px;aspect-ratio:1;border-radius:12px;background:#fff;display:grid;place-items:center;overflow:hidden;border:1px solid var(--rc-line)}
.dsrc-code img{width:100%;height:100%;display:block}
.dsrc-placeholder{width:100%;height:100%;display:grid;place-items:center;text-align:center;white-space:pre-line;padding:16px;font-size:12px;color:#77736c;background:repeating-linear-gradient(45deg,#f6f4ef 0 8px,#fbfaf7 8px 16px)}
.dsrc-steps{display:grid;gap:10px}
.dsrc-step{display:flex;align-items:center;gap:10px}
.dsrc-number{flex-shrink:0;width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--rc-accent) 12%,transparent);color:var(--rc-accent);font-size:11px;font-weight:600}
.dsrc-link{margin-top:12px;padding:8px 10px;border-radius:8px;background:var(--rc-fill);font:12px/1.5 ui-monospace,Consolas,monospace;overflow-wrap:anywhere;user-select:all}

.dsrc-device{padding:10px 0;border-top:1px solid var(--rc-line)}
.dsrc-row:first-child+.dsrc-device{margin-top:12px}
.dsrc-device-main{min-width:0}
.dsrc-device-name{font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dsrc-tag{font-size:11px;font-weight:400;line-height:18px;padding:0 7px;border-radius:999px;background:var(--rc-fill);color:var(--rc-muted)}
.dsrc-online{background:color-mix(in srgb,#2e9e5b 14%,transparent);color:#2e9e5b}
.dsrc-ghost{border-color:transparent;color:var(--rc-muted)!important;padding:0 8px}
.dsrc-rename{height:26px;width:220px;max-width:100%;border:1px solid var(--rc-accent);border-radius:6px;background:transparent;padding:0 8px;font-weight:600}

.dsrc-entry{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;color:inherit;background:transparent;border-radius:8px;padding:8px;min-width:36px;min-height:36px;font:inherit;cursor:pointer}
.dsrc-entry{position:relative}
/* In the wide sidebar the entry sits at the right end of the account row, not on a row of its own. */
[class*=footArea]:has(.dsrc-entry-corner){position:relative}
.dsrc-entry.dsrc-entry-corner{position:absolute;right:10px;bottom:10px;z-index:1}
.dsrc-entry:hover{background:#77736c15}
.dsrc-entry-dot{position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:50%;background:#D97757;box-shadow:0 0 0 2px var(--dsw-alias-background-primary,#fff)}
.dsrc-dialog.dsrc-prompt{width:min(400px,calc(100vw - 32px))}
.dsrc-prompt-device{font-size:15px;font-weight:600;margin-top:12px!important}
.dsrc-prompt-actions{justify-content:flex-end;margin-top:18px}
.dsrc-entry svg{width:18px;height:18px}
.dsrc-dialog{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#e4e0d8);background:var(--dsw-alias-background-primary,#fff);color:inherit;border-radius:16px;padding:22px 24px 24px;width:min(720px,calc(100vw - 32px));max-height:calc(100dvh - 48px);overflow:auto;font:13px/1.6 var(--dsh-font-family,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif);box-shadow:0 24px 80px #00000040}
.dsrc-dialog::backdrop{background:#29272480;backdrop-filter:blur(2px)}
.dsrc-close{position:sticky;top:0;float:right;z-index:1;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:inherit;font-size:18px;line-height:1;cursor:pointer;margin:-4px -6px 0 8px}
.dsrc-close:hover{background:#77736c22}

@media(max-width:560px){
.dsrc{font-size:16px}
.dsrc-pair{grid-template-columns:1fr;gap:16px}
.dsrc-code{width:200px;justify-self:center}
.dsrc-button,.dsrc-input input{height:44px;font-size:16px}
.dsrc-mode{display:flex}
.dsrc-mode button{flex:1;height:40px;padding:0 6px;font-size:14px}
.dsrc-toggle input{width:20px;height:20px}
.dsrc .dsrc-swatch{width:28px;height:28px}
.dsrc-muted,.dsrc-note,.dsrc-sub,.dsrc-proxy summary,.dsrc-way-text{font-size:14px}
.dsrc .dsrc-way{padding:14px}
.dsrc-row{flex-wrap:wrap}
.dsrc-dialog{padding:16px}
}
@media(prefers-color-scheme:dark){
.dsrc{--rc-ink:var(--dsw-alias-label-primary,#f0eee8);--rc-muted:var(--dsw-alias-label-secondary,#b5afa6);--rc-line:var(--dsw-alias-border-l2,#454039);--rc-paper:var(--dsw-alias-background-primary,#2d2b28);--rc-danger:#EF9181}
.dsrc-dialog{background:var(--dsw-alias-background-primary,#242321)}
}
${accentCSS('.dsrc', 'media')}
`
