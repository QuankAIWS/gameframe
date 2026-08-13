if (!document.querySelector('link[href="/gameframe-alerts.css"]')) {
  const marker = document.createElement("link");
  marker.href = "/gameframe-alerts.css";
  marker.dataset.gameframeAlertStyleMarker = "true";
  document.head.append(marker);
}
const style = document.createElement("style");
style.id = "gameframe-alert-styles";
style.textContent = `
.gameframe-session-badge{overflow:visible}
.gameframe-session-badge .gameframe-alerts{position:absolute;top:50%;right:calc(100% + 8px);z-index:4;transform:translateY(-50%);pointer-events:auto}
.gameframe-session-badge .gameframe-alerts-trigger{position:relative;z-index:1;display:grid;place-items:center;width:40px;height:40px;padding:0;border:1px solid rgba(174,183,255,.4);border-radius:50%;background:rgba(12,17,34,.96);color:#eef0ff;cursor:pointer}
.gameframe-alerts-trigger svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.gameframe-alerts-count{position:absolute;top:-5px;right:-5px;display:grid;min-width:19px;height:19px;place-items:center;padding:0 4px;border-radius:999px;background:#ff5f72;color:white;font-size:.64rem;font-weight:900}
.gameframe-alerts-panel{position:absolute;top:calc(100% + 12px);right:0;z-index:2;width:min(360px,calc(100vw - 24px));overflow:hidden;border:1px solid rgba(139,156,255,.32);border-radius:16px;background:rgba(10,14,28,.98);box-shadow:0 24px 60px rgba(0,0,0,.48);color:#f5f7ff;text-align:left}
.gameframe-alerts-panel[hidden]{display:none}.gameframe-alerts-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;border-bottom:1px solid rgba(160,174,255,.14)}.gameframe-alerts-heading>span{display:grid}.gameframe-alerts-heading small{color:#929ac2;font-size:.58rem}.gameframe-alerts-heading a{color:#bfc6ff;font-size:.72rem}.gameframe-alerts-list{display:grid;max-height:360px;overflow:auto}.gameframe-alert-row{display:grid;gap:9px;padding:12px 14px;border-bottom:1px solid rgba(160,174,255,.11)}.gameframe-alert-copy{display:grid;gap:3px}.gameframe-alert-copy strong{font-size:.82rem}.gameframe-alert-copy span{color:#aeb7ff;font-size:.72rem;font-weight:800}.gameframe-alert-actions{display:flex;gap:7px}
.gameframe-session-badge .gameframe-alert-action{display:inline-flex!important;padding:6px 10px;border:1px solid rgba(160,174,255,.27);border-radius:9px;background:rgba(255,255,255,.06);color:#eef0ff;font-size:.7rem;font-weight:800;cursor:pointer}.gameframe-session-badge .gameframe-alert-action.primary{background:rgba(88,101,242,.34)}.gameframe-session-badge .gameframe-alert-action:disabled{opacity:.5}.gameframe-alerts-empty,.gameframe-alerts-error{margin:0;padding:16px 14px;color:#929ac2;font-size:.78rem}.gameframe-alerts-error{color:#ff9aaa}
@media(max-width:720px){.gameframe-session-badge .gameframe-alerts-trigger{display:grid!important;width:36px;height:36px}.gameframe-alerts-panel{position:fixed;top:69px;right:8px;width:calc(100vw - 16px)}}`;
document.head.append(style);
