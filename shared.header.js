/**
 * shared.header.js
 *
 * Header/menu suspenso compartilhado para todas as páginas.
 */

"use strict";

module.exports = {
  SHARED_HEADER_CSS,
  SHARED_HEADER_JS,
  renderSharedHeader,
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeId(v, fallback) {
  const s = String(v || "").trim();
  return s || fallback;
}

function SHARED_HEADER_CSS() {
  return `
/* =========================================================
   SHARED HEADER / GLOBAL DROPDOWN MENU
   ========================================================= */
.sharedHeader{
  width:min(calc(100% - 24px), 1240px);
  margin:18px auto 0;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  flex-wrap:wrap;
}

.sharedHeaderLeft,
.sharedHeaderRight{
  display:flex;
  align-items:center;
  gap:12px;
  flex-wrap:wrap;
}

.sharedBrand{
  display:inline-flex;
  align-items:center;
  gap:12px;
  min-height:48px;
  text-decoration:none;
  color:#111827;
}

.sharedBrandMark{
  width:44px;
  height:44px;
  border-radius:15px;
  display:grid;
  place-items:center;
  background:linear-gradient(135deg, rgba(124,58,237,.14), rgba(219,39,119,.14));
  border:1px solid rgba(124,58,237,.16);
  box-shadow:0 10px 24px rgba(0,0,0,.08);
  font-size:20px;
  flex:0 0 auto;
}

.sharedBrandText{
  font-size:17px;
  line-height:1.15;
  font-weight:1000;
  letter-spacing:-.02em;
  color:#111827;
}

.sharedMenuWrap{
  position:relative;
}

.sharedMenuToggle{
  appearance:none;
  border:none;
  min-height:46px;
  padding:10px 14px;
  border-radius:14px;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  font-weight:1000;
  color:#4c1d95;
  background:rgba(255,255,255,.92);
  border:1px solid rgba(124,58,237,.14);
  box-shadow:0 8px 20px rgba(0,0,0,.06);
  transition:transform .14s ease, box-shadow .14s ease, background .14s ease, filter .14s ease;
  user-select:none;
  white-space:nowrap;
}

.sharedMenuToggle:hover{
  transform:translateY(-1px);
  box-shadow:0 12px 24px rgba(0,0,0,.08);
  filter:brightness(1.01);
}

.sharedMenuToggle:active{
  transform:translateY(1px);
}

.sharedMenuToggleCaret{
  font-size:12px;
  opacity:.8;
}

.sharedMenuPanel{
  position:absolute;
  top:calc(100% + 8px);
  right:0;
  min-width:270px;
  max-width:min(92vw, 340px);
  padding:8px;
  border-radius:18px;
  background:rgba(255,255,255,.98);
  border:1px solid rgba(226,232,240,.9);
  box-shadow:0 18px 40px rgba(15,23,42,.12);
  backdrop-filter:blur(14px);
  display:none;
  z-index:120;
}

.sharedMenuPanel.open{
  display:block;
}

.sharedMenuSection{
  display:grid;
  gap:6px;
}

.sharedMenuDivider{
  height:1px;
  margin:6px 2px;
  background:rgba(148,163,184,.18);
}

.sharedMenuItem{
  appearance:none;
  width:100%;
  border:none;
  text-align:left;
  text-decoration:none;
  min-height:42px;
  padding:10px 12px;
  border-radius:12px;
  display:flex;
  align-items:center;
  gap:10px;
  background:#fff;
  color:#1f2937;
  border:1px solid rgba(15,23,42,.05);
  box-shadow:0 4px 12px rgba(17,24,39,.03);
  font-weight:900;
  cursor:pointer;
  transition:transform .12s ease, background .12s ease, box-shadow .12s ease;
}

.sharedMenuItem:hover{
  transform:translateY(-1px);
  background:#faf8ff;
  box-shadow:0 8px 16px rgba(17,24,39,.05);
}

.sharedMenuItemIcon{
  width:26px;
  height:26px;
  border-radius:9px;
  display:grid;
  place-items:center;
  font-size:14px;
  background:linear-gradient(135deg, rgba(124,58,237,.12), rgba(236,72,153,.12));
  color:#6d28d9;
  flex:0 0 auto;
}

.sharedMenuItemDanger{
  color:#991b1b;
  background:#fff7f7;
  border-color:rgba(220,38,38,.08);
}

.sharedMenuItemDanger .sharedMenuItemIcon{
  background:linear-gradient(135deg, rgba(239,68,68,.14), rgba(249,115,22,.14));
  color:#b91c1c;
}

.sharedHeaderActions{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}

.sharedHeaderAction{
  appearance:none;
  border:none;
  min-height:46px;
  padding:10px 14px;
  border-radius:14px;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  font-weight:1000;
  white-space:nowrap;
  text-decoration:none;
  transition:transform .14s ease, box-shadow .14s ease, filter .14s ease, background .14s ease;
  user-select:none;
}

.sharedHeaderAction:hover{
  transform:translateY(-1px);
  filter:brightness(1.01);
}

.sharedHeaderAction:active{
  transform:translateY(1px);
}

.sharedHeaderAction.primary{
  color:#fff;
  background:linear-gradient(90deg,#7c3aed,#db2777);
  box-shadow:0 14px 28px rgba(124,58,237,.18);
}

.sharedHeaderAction.success{
  color:#fff;
  background:linear-gradient(90deg,#16a34a,#22c55e);
  box-shadow:0 14px 28px rgba(34,197,94,.16);
}

.sharedHeaderAction.info{
  color:#fff;
  background:linear-gradient(90deg,#2563eb,#7c3aed);
  box-shadow:0 14px 28px rgba(37,99,235,.16);
}

.sharedHeaderAction.warning{
  color:#fff;
  background:linear-gradient(90deg,#f59e0b,#f97316);
  box-shadow:0 14px 28px rgba(245,158,11,.16);
}

.sharedHeaderAction.soft{
  color:#4c1d95;
  background:rgba(255,255,255,.92);
  border:1px solid rgba(124,58,237,.14);
  box-shadow:0 8px 20px rgba(0,0,0,.06);
}

.sharedHeaderAction.danger{
  color:#fff;
  background:linear-gradient(90deg,#ef4444,#f97316);
  box-shadow:0 14px 28px rgba(239,68,68,.16);
}

.sharedHeaderEmail{
  display:inline-flex;
  align-items:center;
  min-height:40px;
  padding:9px 13px;
  border-radius:999px;
  background:rgba(255,255,255,.92);
  border:1px solid rgba(15,23,42,.06);
  box-shadow:0 8px 18px rgba(0,0,0,.04);
  color:#475569;
  font-weight:900;
  font-size:13px;
  max-width:320px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

@media (max-width: 720px){
  .sharedHeader{
    align-items:stretch;
  }

  .sharedHeaderLeft,
  .sharedHeaderRight{
    width:100%;
    justify-content:space-between;
  }

  .sharedMenuWrap{
    flex:1 1 auto;
  }

  .sharedMenuToggle{
    width:100%;
  }

  .sharedMenuPanel{
    right:auto;
    left:0;
    min-width:100%;
    max-width:100%;
  }

  .sharedHeaderActions{
    width:100%;
  }

  .sharedHeaderActions .sharedHeaderAction{
    flex:1 1 100%;
  }

  .sharedHeaderEmail{
    max-width:100%;
  }
}

@media (prefers-reduced-motion: reduce){
  .sharedMenuToggle,
  .sharedMenuItem,
  .sharedHeaderAction{
    transition:none !important;
  }
}
`;
}

function SHARED_HEADER_JS() {
  return `
(function(){
  function closeAllSharedMenus(exceptId){
    document.querySelectorAll("[data-shared-menu-panel]").forEach(function(panel){
      if (exceptId && panel.id === exceptId) return;
      panel.classList.remove("open");
    });

    document.querySelectorAll("[data-shared-menu-toggle]").forEach(function(btn){
      var controls = btn.getAttribute("aria-controls") || "";
      var expanded = exceptId && controls === exceptId ? "true" : "false";
      btn.setAttribute("aria-expanded", expanded);
    });
  }

  document.querySelectorAll("[data-shared-menu-toggle]").forEach(function(toggle){
    if (toggle.__sharedMenuBound) return;
    toggle.__sharedMenuBound = true;

    toggle.addEventListener("click", function(e){
      e.stopPropagation();
      var panelId = toggle.getAttribute("aria-controls");
      var panel = panelId ? document.getElementById(panelId) : null;
      if (!panel) return;

      var willOpen = !panel.classList.contains("open");
      closeAllSharedMenus();
      if (willOpen) {
        panel.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      } else {
        panel.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  });

  document.querySelectorAll("[data-shared-menu-panel]").forEach(function(panel){
    if (panel.__sharedMenuPanelBound) return;
    panel.__sharedMenuPanelBound = true;
    panel.addEventListener("click", function(e){
      e.stopPropagation();
    });
  });

  document.addEventListener("click", function(){
    closeAllSharedMenus();
  });

  document.addEventListener("keydown", function(e){
    if (e.key === "Escape") closeAllSharedMenus();
  });

  document.querySelectorAll("[data-shared-logout]").forEach(function(btn){
    if (btn.__sharedLogoutBound) return;
    btn.__sharedLogoutBound = true;

    btn.addEventListener("click", async function(){
      try{
        var r = await fetch("/api/auth/logout", { method: "POST" });
        var j = await r.json().catch(function(){ return {}; });
        if (!r.ok || !j.ok) throw new Error(j.error || "Falha ao sair");
        window.location.href = "/sales";
      }catch(err){
        alert("Não foi possível sair agora.");
      }
    });
  });
})();
`;
}

function renderAction(action = {}, index = 0) {
  const id = safeId(action.id, `sharedHeaderAction${index}`);
  const label = esc(action.label || "Ação");
  const kind = esc(action.kind || "soft");
  const href = String(action.href || "").trim();
  const type = String(action.type || (href ? "link" : "button")).trim();

  if (type === "link" || href) {
    return `<a class="sharedHeaderAction ${kind}" id="${esc(id)}" href="${esc(href || "#")}">${label}</a>`;
  }

  return `<button class="sharedHeaderAction ${kind}" id="${esc(id)}" type="button">${label}</button>`;
}

function renderMenuItem(item = {}, index = 0) {
  const label = esc(item.label || "Item");
  const icon = esc(item.icon || "•");
  const href = String(item.href || "").trim();
  const danger = !!item.danger;
  const id = safeId(item.id, `sharedMenuItem${index}`);
  const cls = `sharedMenuItem${danger ? " sharedMenuItemDanger" : ""}`;

  if (href) {
    return `
<a class="${cls}" href="${esc(href)}">
  <span class="sharedMenuItemIcon">${icon}</span>
  <span>${label}</span>
</a>`.trim();
  }

  return `
<button type="button" class="${cls}" id="${esc(id)}">
  <span class="sharedMenuItemIcon">${icon}</span>
  <span>${label}</span>
</button>`.trim();
}

function renderSharedHeader(opts = {}) {
  const brandText = esc(opts.brandText || "Meu Livro Mágico");
  const brandHref = esc(opts.brandHref || "/sales");
  const brandIcon = esc(opts.brandIcon || "📚");
  const email = String(opts.email || "").trim();
  const showProfile = opts.showProfile !== false;
  const showLogout = opts.showLogout !== false;
  const profileHref = esc(opts.profileHref || "/profile");
  const menuLabel = esc(opts.menuLabel || "☰ Menu");
  const menuId = safeId(opts.menuId, "sharedMenuPanel");
  const toggleId = safeId(opts.toggleId, "sharedMenuToggle");
  const menuItems = Array.isArray(opts.menuItems) ? opts.menuItems.slice() : [];
  const actions = Array.isArray(opts.actions) ? opts.actions : [];

  let itemsHtml = menuItems.map(renderMenuItem).join("\n");

  if (showProfile || showLogout) {
    if (itemsHtml) {
      itemsHtml += `\n<div class="sharedMenuDivider"></div>\n`;
    }

    if (showProfile) {
      itemsHtml += `
<a class="sharedMenuItem" href="${profileHref}">
  <span class="sharedMenuItemIcon">👤</span>
  <span>Perfil</span>
</a>`.trim();
    }

    if (showLogout) {
      if (showProfile) itemsHtml += "\n";
      itemsHtml += `
<button type="button" class="sharedMenuItem sharedMenuItemDanger" data-shared-logout="1">
  <span class="sharedMenuItemIcon">🚪</span>
  <span>Sair</span>
</button>`.trim();
    }
  }

  const actionsHtml = actions.map(renderAction).join("\n");
  const emailHtml = email
    ? `<div class="sharedHeaderEmail" title="${esc(email)}">${esc(email)}</div>`
    : "";

  return `
<div class="sharedHeader">
  <div class="sharedHeaderLeft">
    <a class="sharedBrand" href="${brandHref}">
      <div class="sharedBrandMark">${brandIcon}</div>
      <div class="sharedBrandText">${brandText}</div>
    </a>
  </div>

  <div class="sharedHeaderRight">
    ${emailHtml}
    <div class="sharedMenuWrap">
      <button
        type="button"
        class="sharedMenuToggle"
        id="${esc(toggleId)}"
        data-shared-menu-toggle="1"
        aria-expanded="false"
        aria-controls="${esc(menuId)}"
      >
        ${menuLabel}
        <span class="sharedMenuToggleCaret">▾</span>
      </button>

      <div
        class="sharedMenuPanel"
        id="${esc(menuId)}"
        data-shared-menu-panel="1"
      >
        <div class="sharedMenuSection">
          ${itemsHtml}
        </div>
      </div>
    </div>

    ${actionsHtml ? `<div class="sharedHeaderActions">${actionsHtml}</div>` : ""}
  </div>
</div>
`.trim();
}