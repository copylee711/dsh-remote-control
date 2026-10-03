import { accentCSS } from '../accent.js'
/**
 * The remote app's look: a chat client in the manner of the Claude and ChatGPT
 * phone apps. Round floating controls, a drawer of plain rows, a pill-shaped
 * message box. Colours follow docs/ui-spec.md.
 */
export const REMOTE_CSS = `
:root{--rc-accent-hover:#c86748;--rc-bg:#faf9f5;--rc-paper:#fffefa;--rc-ink:#292724;--rc-muted:#77736c;--rc-line:#e4e0d8;--rc-accent:#d97757;--rc-accent-ink:#fff;--rc-soft:#f0ede6;--rc-danger:#b34337;--rc-shadow:0 1px 2px #2927240a,0 6px 24px #29272412;color-scheme:light}
:root[data-rc-theme=dark]{--rc-bg:#242321;--rc-paper:#2d2b28;--rc-ink:#f0eee8;--rc-muted:#b5afa6;--rc-line:#454039;--rc-soft:#37332e;--rc-danger:#ef9181;--rc-shadow:0 1px 2px #0003,0 6px 24px #0000004d;color-scheme:dark}
${accentCSS(':root', ':root[data-rc-theme=dark]')}
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
/* Plain output blocks of the app itself. Markdown code is styled by the Host's component, through the tokens below. */
.rc-tool-event>pre,.rc-card pre,.rc-content pre{white-space:pre;overflow:auto;max-width:100%;padding:12px 14px;background:var(--rc-soft);border-radius:12px;font:13px/1.6 var(--rc-mono)}
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
.rc-primary:hover,.rc-send:hover{background:var(--rc-accent-hover)}
.rc-danger{color:var(--rc-danger)}
.rc-pill{background:var(--rc-paper);box-shadow:var(--rc-shadow)}
.rc-text{background:transparent;min-height:0;padding:4px 10px;white-space:nowrap;flex-shrink:0}
.rc-round{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;min-height:44px;padding:0;flex-shrink:0;background:var(--rc-paper);box-shadow:var(--rc-shadow)}
.rc-round.rc-plain{background:transparent;box-shadow:none}
.rc-round.rc-plain:hover{background:var(--rc-soft)}
.rc-round[aria-pressed=true],.rc-round[aria-expanded=true]{background:var(--rc-soft)}
.rc-small{font-size:14px}
.rc-muted{color:var(--rc-muted);font-size:14px}

/* Frame */
.rc-app{--rc-mono:ui-monospace,"SF Mono","Cascadia Code","Roboto Mono",Menlo,Consolas,"Liberation Mono",monospace;--rc-sans:"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",system-ui,sans-serif;
--ds-font-family-code:var(--rc-mono);--dsw-font-markdown-code-font-family:var(--rc-mono);--dsw-font-family:var(--rc-sans);
--dsw-font-markdown-base:16px/1.75 var(--rc-sans);--dsw-font-markdown-base-strong:600 16px/1.75 var(--rc-sans);
--dsw-font-markdown-h1:650 22px/1.4 var(--rc-sans);--dsw-font-markdown-h2:650 19px/1.45 var(--rc-sans);--dsw-font-markdown-h3:600 17px/1.5 var(--rc-sans);--dsw-font-markdown-h4:600 16px/1.5 var(--rc-sans);
--dsw-font-markdown-code:.88em/1.5 var(--rc-mono);--dsw-font-markdown-code-block:13.5px/1.65 var(--rc-mono);
--dsw-font-markdown-table:14px/1.6 var(--rc-sans);--dsw-font-markdown-table-head:600 14px/1.6 var(--rc-sans);--dsw-font-xs-13:13px/1.5 var(--rc-sans);
--dsw-radius-sm:6px;--dsw-radius-md:10px;--dsw-radius-lg:14px;--dsw-radius-panel:20px;
--dsw-alias-bg-base:var(--rc-bg);--dsw-alias-bg-layer-1:var(--rc-paper);--dsw-alias-bg-layer-2:var(--rc-soft);--dsw-alias-border-l3:var(--rc-line);--dsw-alias-border-l4:var(--rc-line);--dsw-alias-link:var(--rc-accent);--dsw-alias-label-dimmed:var(--rc-muted);
--dsw-alias-label-primary:var(--rc-ink);--dsw-alias-label-secondary:var(--rc-muted);--dsw-alias-border-l2:var(--rc-line);--dsw-alias-background-primary:var(--rc-paper);--dsw-alias-border-l1:var(--rc-line);--dsw-alias-label-tertiary:var(--rc-muted);--dsw-alias-label-caption:var(--rc-muted);--dsw-alias-markdown-code-block:var(--rc-soft);--dsw-alias-markdown-code-block-banner:var(--rc-soft);--dsw-alias-markdown-inline-code:var(--rc-soft);font:16px/1.65 var(--rc-sans);display:flex;height:100dvh;height:var(--rc-height,100dvh);width:100%;overflow:hidden}
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
.rc-workspace{background:transparent;color:var(--rc-muted);font-size:14px;padding:6px 12px;min-height:36px;justify-content:space-between;border-radius:14px}
.rc-divider{margin:8px 10px}
.rc-session-list{flex:1;overflow:auto;padding-bottom:76px}
.rc-session{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:transparent;border-radius:14px;padding:11px 12px;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-running{width:8px;height:8px;border-radius:50%;background:var(--rc-accent);flex-shrink:0;animation:rc-pulse 1.4s ease-in-out infinite}
.rc-empty{padding:12px}
.rc-sidebar-footer{position:absolute;left:14px;right:14px;bottom:max(14px,env(safe-area-inset-bottom))}
.rc-swatches{display:flex;gap:10px}
.rc-swatch{width:32px;height:32px;min-height:32px;padding:0;border:3px solid var(--rc-paper);background:#d97757}
.rc-swatch:hover{background:#d97757}
.rc-swatch[data-accent=blue],.rc-swatch[data-accent=blue]:hover{background:#3d63e6}
.rc-swatch[data-accent=black],.rc-swatch[data-accent=black]:hover{background:#1f1e1d}
:root[data-rc-theme=dark] .rc-swatch[data-accent=black]{background:#f0eee8}
.rc-swatch[aria-checked=true]{box-shadow:0 0 0 2px var(--rc-ink)}
.rc-new{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;box-shadow:var(--rc-shadow)}
.rc-new svg{width:20px;height:20px}
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
/* The Host's Markdown component brings its own buttons (copy code); they are not app buttons. */
.rc-message button{min-height:0;padding:2px 8px;border-radius:6px;background:transparent;font-size:12px;color:var(--rc-muted)}
.rc-message button:hover{background:var(--rc-line)}
.rc-message code{letter-spacing:0;font-variant-ligatures:none}
.rc-message :not(pre)>code{padding:.1em .38em;border-radius:6px}
.rc-message pre{letter-spacing:0;tab-size:2}
.rc-message [class*=_banner]:not([class*=_bannerWrap]){padding:8px 14px 2px}
.rc-message [class*=_block] pre{padding:6px 14px 14px}
.rc-message [class*=_tableScroll]{max-width:100%;overflow-x:auto;margin:14px 0;border:1px solid var(--rc-line);border-radius:14px;background:var(--rc-paper)}
.rc-message table{width:max-content;min-width:100%;max-width:none;border-collapse:collapse;border-spacing:0;font-size:14px;line-height:1.6;margin:0}
.rc-message th,.rc-message td{border:0;border-bottom:1px solid var(--rc-line);padding:9px 14px;text-align:left;vertical-align:top;max-width:17em;min-width:4.5em;overflow-wrap:anywhere;word-break:normal;font-size:14px;line-height:1.6}
.rc-message th{background:var(--rc-soft);font-weight:600;white-space:nowrap}
.rc-message tbody tr:last-child td{border-bottom:0}
.rc-message :is(th,td)[align=center]{text-align:center}
.rc-message :is(th,td)[align=right]{text-align:right}
.rc-message blockquote{margin:0;padding-left:14px;border-left:3px solid var(--rc-line);color:var(--rc-muted)}
.rc-message ul,.rc-message ol{padding-left:1.4em}
.rc-message hr{margin:18px 0}
.rc-chat svg{max-width:24px}
.rc-steps{justify-self:start;max-width:100%;min-width:0;color:var(--rc-muted);font-size:14px}
.rc-steps>summary{display:inline-flex;align-items:center;gap:8px;max-width:100%;cursor:pointer;list-style:none;padding:6px 12px;border-radius:999px;background:var(--rc-soft)}
.rc-steps>summary::-webkit-details-marker{display:none}
.rc-steps>summary::after{content:'›';transition:transform .15s}
.rc-steps[open]>summary::after{transform:rotate(90deg)}
.rc-steps-count{font-weight:600;color:var(--rc-ink);white-space:nowrap}
.rc-steps-names{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-steps>.rc-tool-event{display:block;margin:8px 0 0 10px;background:transparent;border-left:2px solid var(--rc-line);border-radius:0;padding:2px 0 2px 12px}
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
.rc-model{min-width:0;max-width:60%;margin-right:auto;min-height:40px;font-size:14px;padding:8px 12px 8px 14px}
.rc-send{background:var(--rc-accent);color:var(--rc-accent-ink);box-shadow:none}
.rc-stop{background:var(--rc-ink);color:var(--rc-bg);box-shadow:none}
.rc-stop:hover{background:var(--rc-ink);opacity:.85}
.rc-attachments{display:flex;gap:8px;flex-wrap:wrap;padding:4px 6px 0}
.rc-chip{display:inline-flex;align-items:center;gap:4px;font-size:13px;border-radius:12px;background:var(--rc-soft);padding:4px 10px;overflow-wrap:anywhere}
.rc-sheet{border:1px solid var(--rc-line);border-radius:22px;background:var(--rc-paper);box-shadow:var(--rc-shadow);padding:6px 16px;margin-bottom:8px}
.rc-sheet-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:52px;font-size:15px}
.rc-sheet-row+.rc-sheet-row{border-top:1px solid var(--rc-line)}
.rc-sheet-pick{background:transparent;color:var(--rc-muted);max-width:62%;padding:6px 0 6px 8px;min-height:40px}
.rc-sheet-pick:hover{background:transparent}
.rc-appearance .rc-sheet-row{font-size:16px}
.rc-segment{display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:var(--rc-soft)}
.rc-segment button{background:transparent;min-height:36px;padding:6px 14px;font-size:14px;color:var(--rc-muted)}
.rc-segment button[aria-pressed=true]{background:var(--rc-paper);color:var(--rc-ink);font-weight:600;box-shadow:0 1px 2px #0000001f}

/* Choice lists */
.rc-picker{display:inline-flex;align-items:center;gap:6px;min-width:0;text-align:left}
.rc-picker svg{width:16px;height:16px;opacity:.6}
.rc-picker-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-label>.rc-picker{width:100%;justify-content:space-between;border:1px solid var(--rc-line);border-radius:14px;background:var(--rc-paper);padding:11px 14px}
.rc-picker-sheet{border:0;padding:0;margin:auto auto 0;width:100%;max-width:560px;max-height:min(72dvh,640px);border-radius:26px 26px 0 0;background:var(--rc-paper);color:var(--rc-ink);box-shadow:var(--rc-shadow);overflow:hidden}
.rc-picker-sheet[open]{display:flex;animation:rc-rise .2s cubic-bezier(.2,.8,.2,1)}
.rc-picker-sheet::backdrop{background:#29272480}
.rc-picker-body{display:flex;flex-direction:column;min-height:0;width:100%;padding:10px 10px max(12px,env(safe-area-inset-bottom))}
.rc-picker-title{text-align:center;font-weight:600;padding:8px 0 10px}
.rc-picker-list{overflow:auto;overscroll-behavior:contain}
.rc-picker-group{padding:14px 14px 4px;font-size:13px;color:var(--rc-muted)}
.rc-picker-option{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;background:transparent;border-radius:14px;padding:12px 14px;min-height:48px;font-size:16px}
.rc-picker-option[aria-selected=true]{background:var(--rc-soft);font-weight:600}
.rc-picker-option svg{color:var(--rc-accent)}
.rc-picker-label{min-width:0;overflow-wrap:anywhere}
.rc-picker-label small{display:block;font-size:13px;font-weight:400;color:var(--rc-muted)}
@keyframes rc-rise{from{transform:translateY(24px);opacity:0}}
@media(min-width:768px){.rc-picker-sheet{margin:auto;border-radius:24px}}

/* Pages */
.rc-card{padding:18px;border-radius:22px;background:var(--rc-paper);box-shadow:var(--rc-shadow);margin:14px 0;min-width:0}
.rc-card .rc-card{box-shadow:none;border:1px solid var(--rc-line)}
.rc-card h3{margin-bottom:12px}
.rc-list{border-radius:22px;background:var(--rc-paper);box-shadow:var(--rc-shadow);margin:14px 0;overflow:hidden}
.rc-menu-row{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;background:transparent;border-radius:0;padding:16px 18px;font-size:16px}
.rc-menu-row+.rc-menu-row{border-top:1px solid var(--rc-line)}
.rc-crumbs{display:flex;align-items:center;gap:6px}
.rc-crumbs .rc-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
.rc-file{display:flex;align-items:center;gap:6px;padding-right:10px}
.rc-file+.rc-file{border-top:1px solid var(--rc-line)}
.rc-file>svg{color:var(--rc-muted);margin-right:6px}
.rc-file-main{flex:1;min-width:0;display:flex;align-items:center;gap:12px;text-align:left;background:transparent;border-radius:0;padding:14px 8px 14px 18px}
.rc-file-main svg{color:var(--rc-muted)}
.rc-file-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-preview{max-height:86dvh}
.rc-preview-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 4px 8px 12px;font-weight:600}
.rc-preview-body{overflow:auto;min-height:120px;padding:0 6px;text-align:center}
.rc-preview-body pre{text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px 14px;background:var(--rc-soft);border-radius:12px;font:13px/1.6 var(--rc-mono)}
.rc-preview-body img{max-height:62dvh;object-fit:contain}
.rc-preview-actions{justify-content:flex-end;padding:10px 6px 0}
.rc-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.rc-stack{display:grid;gap:12px}
.rc-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.rc-label{display:grid;gap:6px;min-width:0;margin:14px 0;font-size:15px}
.rc-field-row{display:flex;align-items:start;justify-content:space-between;gap:14px}
.rc-error{color:var(--rc-danger);padding:10px 16px;border:1px solid var(--rc-danger);border-radius:16px;margin-top:10px;margin-bottom:10px;overflow-wrap:anywhere}
.rc-offline{color:var(--rc-danger);background:color-mix(in srgb,var(--rc-danger) 9%,var(--rc-paper));border:1px solid var(--rc-danger);border-radius:16px;padding:10px 14px;font-size:14px;line-height:1.6}
.rc-offline strong{display:block;font-size:15px}
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
.rc-app .dsrc,.rc-app .dsrc[data-rc-accent]{--rc-accent:inherit;--rc-accent-ink:inherit}
.rc-app .dsrc .dsrc-button,.rc-app .dsrc-input input{min-height:44px;border-radius:12px}
.rc-app .dsrc button{box-shadow:none}
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
