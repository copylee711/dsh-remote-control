/**
 * The remote app's look: a chat client in the manner of the Claude and ChatGPT
 * phone apps. Round floating controls, a drawer of plain rows, a pill-shaped
 * message box. Colours follow docs/ui-spec.md.
 */
export const REMOTE_CSS = `
:root{--rc-bg:#faf9f5;--rc-paper:#fffefa;--rc-ink:#292724;--rc-muted:#77736c;--rc-line:#e4e0d8;--rc-accent:#d97757;--rc-accent-ink:#fff;--rc-soft:#f0ede6;--rc-danger:#b34337;--rc-shadow:0 1px 2px #2927240a,0 6px 24px #29272412;color-scheme:light}
:root[data-rc-theme=dark]{--rc-bg:#242321;--rc-paper:#2d2b28;--rc-ink:#f0eee8;--rc-muted:#b5afa6;--rc-line:#454039;--rc-soft:#37332e;--rc-danger:#ef9181;--rc-shadow:0 1px 2px #0003,0 6px 24px #0000004d;color-scheme:dark}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}
body{background:var(--rc-bg);color:var(--rc-ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}
button,input,textarea,select{font:inherit;color:inherit}
h1,h2,h3,p{margin:0}
h1{font-size:24px;line-height:1.35}
h2{font-size:22px;font-weight:650}
h3{font-size:16px}
a{color:var(--rc-accent)}
svg{width:22px;height:22px;flex-shrink:0}
pre{white-space:pre;overflow:auto;max-width:100%;padding:14px;background:var(--rc-soft);border-radius:14px;font-size:13px}
code{font-family:ui-monospace,Consolas,monospace}
img{max-width:100%;border-radius:14px}
hr{border:0;border-top:1px solid var(--rc-line);margin:0}

/* Controls */
button{cursor:pointer;border:0;border-radius:999px;background:var(--rc-soft);padding:10px 18px;min-height:44px;transition:background .15s,transform .1s}
button:hover{background:var(--rc-line)}
button:active{transform:scale(.97)}
button:disabled{opacity:.45;cursor:default;transform:none}
button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid var(--rc-accent);outline-offset:2px}
input,textarea,select{min-width:0;width:100%;border:1px solid var(--rc-line);border-radius:14px;background:var(--rc-paper);padding:11px 14px;font-size:16px}
input[type=checkbox],input[type=radio]{width:22px;height:22px;padding:0;accent-color:var(--rc-accent);flex-shrink:0}
.rc-primary{background:var(--rc-accent);color:var(--rc-accent-ink);font-weight:600}
.rc-primary:hover,.rc-send:hover{background:#c86748}
.rc-danger{color:var(--rc-danger)}
.rc-pill{background:var(--rc-paper);box-shadow:var(--rc-shadow)}
.rc-text{background:transparent;min-height:0;padding:4px 10px}
.rc-round{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;min-height:44px;padding:0;flex-shrink:0;background:var(--rc-paper);box-shadow:var(--rc-shadow)}
.rc-round.rc-plain{background:transparent;box-shadow:none}
.rc-round.rc-plain:hover{background:var(--rc-soft)}
.rc-round[aria-pressed=true],.rc-round[aria-expanded=true]{background:var(--rc-soft)}
.rc-small{font-size:14px}
.rc-muted{color:var(--rc-muted);font-size:14px}

/* Frame */
.rc-app{--dsw-alias-label-primary:var(--rc-ink);--dsw-alias-label-secondary:var(--rc-muted);--dsw-alias-border-l2:var(--rc-line);--dsw-alias-background-primary:var(--rc-paper);--dsw-alias-border-l1:var(--rc-line);--dsw-alias-label-tertiary:var(--rc-muted);--dsw-alias-label-caption:var(--rc-muted);--dsw-alias-markdown-code-block:var(--rc-soft);--dsw-alias-markdown-code-block-banner:var(--rc-soft);--dsw-alias-markdown-inline-code:var(--rc-soft);font:16px/1.65 "Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",system-ui,sans-serif;display:flex;height:100dvh;height:var(--rc-height,100dvh);width:100%;overflow:hidden}
.rc-main{flex:1;min-width:0;display:flex;flex-direction:column;position:relative}
.rc-header{flex-shrink:0;display:flex;align-items:center;gap:10px;padding:10px 20px;padding-top:max(10px,env(safe-area-inset-top))}
.rc-header-title{flex:1;min-width:0;text-align:center;font-weight:600;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-mobile{display:none}
.rc-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px 24px 24px;position:relative}
.rc-content{max-width:760px;margin:auto;width:100%;min-width:0}
.rc-banner{margin:4px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px}

/* Drawer */
.rc-sidebar{width:300px;flex-shrink:0;background:var(--rc-soft);display:flex;flex-direction:column;padding:16px 14px;padding-top:max(16px,env(safe-area-inset-top));gap:8px;position:relative}
.rc-brand{display:flex;justify-content:space-between;align-items:center;font-size:26px;font-weight:700;letter-spacing:-.02em;padding:4px 10px 10px}
.rc-brand-actions{display:flex;gap:8px}
.rc-drawer-close{display:none}
.rc-search{margin-bottom:4px;border-radius:999px;padding-left:18px}
.rc-navs{display:grid;gap:2px}
.rc-nav{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:transparent;border-radius:14px;padding:11px 12px;font-size:17px;font-weight:600}
.rc-nav svg{width:24px;height:24px}
.rc-nav[aria-current=true],.rc-session[aria-current=true]{background:var(--rc-line)}
.rc-workspace{border:0;background:transparent;color:var(--rc-muted);font-size:14px;padding:6px 12px}
.rc-divider{margin:8px 10px}
.rc-session-list{flex:1;overflow:auto;padding-bottom:76px}
.rc-session{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:transparent;border-radius:14px;padding:11px 12px;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-running{width:8px;height:8px;border-radius:50%;background:var(--rc-accent);flex-shrink:0;animation:rc-pulse 1.4s ease-in-out infinite}
.rc-empty{padding:12px}
.rc-sidebar-footer{position:absolute;left:14px;right:14px;bottom:max(14px,env(safe-area-inset-bottom));display:flex;align-items:center;gap:8px}
.rc-new{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;box-shadow:var(--rc-shadow)}
.rc-new svg{width:20px;height:20px}
.rc-theme{flex:1;min-width:0;border:0;border-radius:999px;background:var(--rc-paper);box-shadow:var(--rc-shadow);font-size:14px;padding:11px 12px;text-align:center}
.rc-backdrop{display:none}

/* Conversation */
.rc-chat{max-width:760px;margin:auto;display:grid;gap:22px}
.rc-welcome{padding:22vh 0 6vh;text-align:center}
.rc-welcome h1{font-family:Georgia,'Times New Roman','Songti SC','Noto Serif CJK SC',SimSun,serif;font-size:30px;font-weight:500;letter-spacing:-.01em}
.rc-welcome p{color:var(--rc-muted);margin-top:12px}
.rc-older{justify-self:center;font-size:14px}
.rc-message{min-width:0;overflow-wrap:anywhere}
.rc-message.user{background:var(--rc-soft);padding:12px 18px;border-radius:22px;border-bottom-right-radius:8px;justify-self:end;max-width:86%}
.rc-message.assistant{width:100%}
.rc-message-label{font-size:13px;color:var(--rc-muted);margin-top:6px}
.rc-message p+p{margin-top:12px}
.rc-message>div,.rc-message p,.rc-message li{font-size:16px;line-height:1.75}
.rc-message a{overflow-wrap:anywhere}
.rc-chat svg{max-width:24px}
.rc-tool-event{justify-self:start;max-width:100%;min-width:0;border-radius:16px;background:var(--rc-soft);padding:8px 14px;color:var(--rc-muted);font-size:14px}
.rc-tool-event summary{cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-tool-event[open] summary{margin-bottom:8px}
.rc-tool-event pre{background:var(--rc-paper)}
.rc-thinking,.rc-live{color:var(--rc-muted);font-size:14px;animation:rc-pulse 1.4s ease-in-out infinite}
.rc-skeleton{color:var(--rc-muted);text-align:center;padding:40px}
.rc-jump{position:sticky;bottom:6px;display:flex;margin:0 auto}
@keyframes rc-pulse{50%{opacity:.4}}

/* Message box */
.rc-composer-wrap{padding:6px 20px max(14px,env(safe-area-inset-bottom));flex-shrink:0}
.rc-composer-wrap>*{max-width:760px;margin-left:auto;margin-right:auto}
.rc-composer{border:1px solid var(--rc-line);border-radius:28px;background:var(--rc-paper);padding:8px 10px;box-shadow:var(--rc-shadow)}
.rc-composer textarea{display:block;border:0;background:transparent;resize:none;outline:none;padding:8px 10px 4px;min-height:40px;line-height:1.5;border-radius:0}
.rc-composer-bar{display:flex;gap:4px;align-items:center}
.rc-composer-bar .rc-round{width:40px;height:40px;min-height:40px}
.rc-model{min-width:0;width:auto;max-width:56%;margin-right:auto;border:0;border-radius:999px;background:var(--rc-soft);font-size:14px;padding:9px 14px;text-overflow:ellipsis}
.rc-send{background:var(--rc-accent);color:var(--rc-accent-ink);box-shadow:none}
.rc-stop{background:var(--rc-ink);color:var(--rc-bg);box-shadow:none}
.rc-stop:hover{background:var(--rc-ink);opacity:.85}
.rc-attachments{display:flex;gap:8px;flex-wrap:wrap;padding:4px 6px 0}
.rc-chip{display:inline-flex;align-items:center;gap:4px;font-size:13px;border-radius:12px;background:var(--rc-soft);padding:4px 10px;overflow-wrap:anywhere}
.rc-sheet{border:1px solid var(--rc-line);border-radius:22px;background:var(--rc-paper);box-shadow:var(--rc-shadow);padding:6px 16px;margin-bottom:8px}
.rc-sheet-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:52px;font-size:15px}
.rc-sheet-row+.rc-sheet-row{border-top:1px solid var(--rc-line)}
.rc-sheet-row select{width:auto;max-width:60%;border:0;background:transparent;color:var(--rc-muted);text-align:right;padding:6px 0}

/* Pages */
.rc-card{padding:18px;border-radius:22px;background:var(--rc-paper);box-shadow:var(--rc-shadow);margin:14px 0;min-width:0}
.rc-card .rc-card{box-shadow:none;border:1px solid var(--rc-line)}
.rc-card h3{margin-bottom:12px}
.rc-list{border-radius:22px;background:var(--rc-paper);box-shadow:var(--rc-shadow);margin:14px 0;overflow:hidden}
.rc-menu-row{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;background:transparent;border-radius:0;padding:16px 18px;font-size:16px}
.rc-menu-row+.rc-menu-row{border-top:1px solid var(--rc-line)}
.rc-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.rc-stack{display:grid;gap:12px}
.rc-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.rc-label{display:grid;gap:6px;min-width:0;margin:14px 0;font-size:15px}
.rc-field-row{display:flex;align-items:start;justify-content:space-between;gap:14px}
.rc-error{color:var(--rc-danger);padding:10px 16px;border:1px solid var(--rc-danger);border-radius:16px;margin-top:10px;margin-bottom:10px;overflow-wrap:anywhere}
.rc-notice{color:var(--rc-muted);padding:10px 16px;border-radius:16px;background:var(--rc-soft);margin-top:10px;margin-bottom:10px;overflow-wrap:anywhere}
.rc-approval{border:1px solid var(--rc-accent)}
.rc-path{font-family:ui-monospace,monospace;overflow-wrap:anywhere;font-size:13px}
.rc-compat{min-width:0;overflow-x:auto}
.rc-compat>*{max-width:100%}
.rc-compat input:not([type=checkbox]),.rc-compat textarea{font-size:16px}
.rc-question-option{display:flex;align-items:center;gap:12px;min-height:44px;margin:8px 0}
fieldset.rc-card{border:1px solid var(--rc-line);box-shadow:none}
.rc-dialog{background:var(--rc-paper);color:var(--rc-ink);border:0;border-radius:26px;box-shadow:var(--rc-shadow);padding:24px;width:min(440px,calc(100vw - 32px));max-height:80dvh;overflow:auto}
.rc-dialog::backdrop{background:#29272488}
.rc-dialog-message{margin:14px 0;overflow-wrap:anywhere}
.rc-dialog .rc-actions{justify-content:flex-end;margin-top:20px}
.rc-app [hidden]{display:none!important}
.rc-app .dsrc{font-family:inherit}
.rc-app .dsrc input,.rc-app .dsrc button{min-height:44px}
.rc-app .dsrc .dsrc-mode{flex-wrap:wrap}

@media(max-width:767px){
.rc-sidebar{position:fixed;inset:0 auto 0 0;z-index:30;width:min(340px,82vw);background:var(--rc-bg);transform:translateX(-100%);transition:transform .22s cubic-bezier(.2,.8,.2,1);box-shadow:none}
.rc-sidebar.open{transform:translateX(0);box-shadow:0 0 60px #0003}
.rc-backdrop.open{display:block;position:fixed;inset:0;background:#0006;z-index:29;border-radius:0;min-height:0;padding:0}
.rc-mobile,.rc-drawer-close{display:inline-flex}
.rc-header{padding:8px 14px;padding-top:max(8px,env(safe-area-inset-top))}
.rc-scroll{padding:8px 16px 20px}
.rc-banner{margin:4px 14px}
.rc-composer-wrap{padding:6px 12px max(12px,env(safe-area-inset-bottom))}
.rc-small{font-size:15px}
.rc-welcome h1{font-size:26px}
.rc-card{padding:16px}
.rc-field-row{flex-direction:column}
.rc-field-row>*{width:100%}
.rc-compat [style*="grid-template-columns"]{grid-template-columns:1fr!important}
.rc-compat [style*="min-width"]{min-width:0!important}
}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`
