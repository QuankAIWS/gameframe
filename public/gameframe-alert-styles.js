const style = document.createElement("style");
style.id = "gameframe-alert-styles";
style.textContent = `
.gameframe-session-badge{overflow:visible;isolation:isolate;pointer-events:auto}
.gameframe-alerts{position:fixed;top:15px;right:calc(20px + min(258px,22vw));z-index:9005;display:grid;place-items:center;pointer-events:auto}
.gameframe-alerts-trigger{position:relative;z-index:2;display:grid;place-items:center;width:40px;min-width:40px;height:40px;padding:0;border:1px solid rgba(108,231,241,.2);border-radius:13px;background:linear-gradient(150deg,#101a20,#090e12 72%);color:#cbd7d8;box-shadow:0 10px 28px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.015);font:inherit;font-size:1rem;cursor:pointer;pointer-events:auto!important;touch-action:manipulation;transition:border-color .16s ease,background .16s ease,box-shadow .16s ease,color .16s ease,transform .16s ease}
.gameframe-alerts-trigger:hover,.gameframe-alerts-trigger:focus-visible{border-color:#6ce7f1;background:linear-gradient(150deg,#14242b,#0a1115 72%);color:#f4f8f7;box-shadow:0 0 0 3px rgba(108,231,241,.1),0 12px 32px rgba(0,0,0,.34)}
.gameframe-alerts-trigger:focus-visible{outline:2px solid #b6ef69;outline-offset:3px}
.gameframe-alerts-trigger:active{transform:translateY(1px)}
.gameframe-alerts-trigger svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.gameframe-alerts-trigger.has-alerts{border-color:rgba(238,107,196,.55)}
.gameframe-alerts-trigger.has-unread{border-color:#ee6bc4;background:radial-gradient(circle at 50% 38%,rgba(238,107,196,.26),transparent 58%),linear-gradient(150deg,#201321,#0d0d14 72%);color:#fff3fb;box-shadow:0 0 0 3px rgba(238,107,196,.12),0 0 24px rgba(238,107,196,.34),0 12px 32px rgba(0,0,0,.36)}
.gameframe-alerts-trigger.has-unread svg{fill:rgba(238,107,196,.12);filter:drop-shadow(0 0 6px rgba(238,107,196,.62))}
.gameframe-alerts-count{position:absolute;top:-6px;right:-6px;z-index:3;display:grid;min-width:20px;height:20px;place-items:center;padding:0 5px;border:2px solid #0b1115;border-radius:999px;background:#ee6bc4;color:#190b17;box-shadow:0 0 12px rgba(238,107,196,.6);font-size:.64rem;font-weight:950;line-height:1;pointer-events:none}
.gameframe-alerts-count[hidden]{display:none}
.gameframe-alerts-panel{--alerts-cyan:#6ce7f1;--alerts-lime:#b6ef69;--alerts-magenta:#ee6bc4;position:fixed;top:calc(var(--gameframe-destination-height,68px) + 9px);right:12px;z-index:9500;width:min(390px,calc(100vw - 24px));overflow:hidden;border:1px solid rgba(108,231,241,.16);border-radius:20px;background:radial-gradient(circle at 92% 4%,rgba(108,231,241,.11),transparent 30%),radial-gradient(circle at 7% 100%,rgba(182,239,105,.07),transparent 34%),linear-gradient(150deg,rgba(16,26,32,.99),rgba(9,14,18,.995) 72%);box-shadow:0 28px 80px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.025);color:#f4f8f7;text-align:left;pointer-events:auto;backdrop-filter:blur(18px)}
.gameframe-alerts-panel::before{content:"";position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,var(--alerts-cyan),var(--alerts-lime) 52%,var(--alerts-magenta));opacity:.78;pointer-events:none}
.gameframe-alerts-panel[hidden]{display:none}
.gameframe-alerts-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 14px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.018)}
.gameframe-alerts-heading>span{display:grid;gap:2px}
.gameframe-alerts-heading small{color:var(--alerts-cyan);font-size:.58rem;font-weight:900;letter-spacing:.16em}
.gameframe-alerts-heading strong{font-size:1rem;letter-spacing:-.015em}
.gameframe-alerts-heading a{display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border-radius:9px;color:#91a0a5;font-size:.68rem;font-weight:850;text-decoration:none}
.gameframe-alerts-heading a:hover,.gameframe-alerts-heading a:focus-visible{background:rgba(255,255,255,.045);color:#dce8e9;outline:none}
.gameframe-alerts-list{display:grid;max-height:380px;overflow:auto}
.gameframe-alert-row{display:grid;gap:11px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.055);background:rgba(11,16,20,.32)}
.gameframe-alert-row:last-child{border-bottom:0}
.gameframe-alert-copy{display:grid;gap:4px}
.gameframe-alert-copy strong{font-size:.84rem;color:#edf3f3}
.gameframe-alert-copy span{color:var(--alerts-magenta);font-size:.62rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.gameframe-alert-actions{display:flex;gap:8px}
.gameframe-alert-action{display:inline-flex!important;align-items:center;justify-content:center;min-height:38px;padding:0 13px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.035);color:#b9c4c6;font:inherit;font-size:.7rem;font-weight:900;cursor:pointer;pointer-events:auto;touch-action:manipulation}
.gameframe-alert-action.primary{border-color:rgba(182,239,105,.42);background:#b6ef69;color:#11170c;box-shadow:0 0 18px rgba(182,239,105,.1)}
.gameframe-alert-action:hover,.gameframe-alert-action:focus-visible{border-color:rgba(108,231,241,.44);background:rgba(108,231,241,.09);color:#e8fcfe}
.gameframe-alert-action.primary:hover,.gameframe-alert-action.primary:focus-visible{border-color:#d5ff9e;background:#c3f77f;color:#11170c}
.gameframe-alert-action:focus-visible{outline:2px solid var(--alerts-cyan);outline-offset:2px}
.gameframe-alert-action:disabled{opacity:.5;cursor:wait}
.gameframe-alerts-empty,.gameframe-alerts-error{margin:0;padding:20px 16px;color:#8d9ba0;font-size:.78rem;line-height:1.45}
.gameframe-alerts-error{padding-top:0;color:#ff9aaa}
@media(min-width:721px) and (max-width:1100px){.gameframe-alerts{right:calc(4px + 22vw)}}
@media(max-width:720px){.gameframe-alerts{top:13px;right:115px}.gameframe-alerts-trigger{width:36px;min-width:36px;height:36px}.gameframe-alerts-panel{top:calc(var(--gameframe-destination-height,62px) + 7px);right:8px;width:calc(100vw - 16px);border-radius:17px}}
@media(prefers-reduced-motion:reduce){.gameframe-alerts-trigger{transition:none}}
`;
if (!document.querySelector(`#${style.id}`)) document.head.append(style);
