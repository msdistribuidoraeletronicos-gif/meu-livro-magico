/**
 * generate.page.js — Página /generate
 *
 * ✅ Compatível com o core.js atual
 * ✅ Usa /api/create, /api/generate, /api/generateNext, /api/status/:id
 * ✅ Auto-start
 * ✅ Evita loop infinito
 * ✅ Respeita nextTryAt
 * ✅ Trata 409 step já em execução
 * ✅ Redireciona ao preview apenas 1 vez
 * ✅ Cria book automaticamente se necessário
 */

"use strict";

module.exports = function mountGeneratePage(app, { requireAuth }) {
  app.get("/generate", requireAuth, (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Gerando… — Meu Livro Mágico</title>
<style>
  :root{
    --bg1:#ede9fe;
    --bg2:#fff;
    --bg3:#fdf2f8;
    --text:#111827;
    --muted:#6b7280;
    --violet:#7c3aed;
    --pink:#db2777;
    --border:#e5e7eb;
    --shadow:0 20px 50px rgba(0,0,0,.10);
    --shadow2:0 12px 30px rgba(17,24,39,.08);
    --ok:#10b981;
    --bad:#ef4444;
    --warn:#f59e0b;
  }

  *{box-sizing:border-box}
  html,body{min-height:100%}

  body{
    margin:0;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    background:linear-gradient(180deg,var(--bg1),var(--bg2),var(--bg3));
    min-height:100vh;
    color:var(--text);
  }

  a{color:inherit;text-decoration:none}

  .wrap{
    max-width:980px;
    margin:0 auto;
    padding:24px 16px;
  }

  .sharedHeader{
    width:min(calc(100% - 24px), 1240px);
    margin:18px auto 0;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:14px;
    flex-wrap:wrap;
    position:relative;
    z-index:50;
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

  .sharedHeaderAction.soft{
    color:#4c1d95;
    background:rgba(255,255,255,.92);
    border:1px solid rgba(124,58,237,.14);
    box-shadow:0 8px 20px rgba(0,0,0,.06);
  }

  .card{
    background:#fff;
    border:1px solid var(--border);
    border-radius:22px;
    box-shadow:var(--shadow);
    padding:18px;
  }

  .row{
    display:flex;
    gap:12px;
    flex-wrap:wrap;
    align-items:center;
    justify-content:space-between;
  }

  h1{
    margin:0;
    font-size:22px;
    font-weight:1000;
  }

  .muted{
    color:var(--muted);
    font-weight:900;
  }

  .statusPill{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:8px 12px;
    border-radius:999px;
    font-weight:1000;
    font-size:13px;
    border:1px solid rgba(0,0,0,.08);
    background:#fff;
  }

  .statusDot{
    width:10px;
    height:10px;
    border-radius:999px;
    background:#9ca3af;
  }

  .statusDot.run{ background:linear-gradient(90deg,var(--violet),var(--pink)); }
  .statusDot.ok{ background:var(--ok); }
  .statusDot.bad{ background:var(--bad); }
  .statusDot.warn{ background:var(--warn); }

  .hint{
    margin-top:12px;
    padding:12px 14px;
    border-radius:14px;
    background:rgba(124,58,237,.06);
    border:1px solid rgba(124,58,237,.14);
    color:#4c1d95;
    font-weight:900;
    white-space:pre-wrap;
    display:none;
  }

  .bar{
    height:12px;
    background:#e5e7eb;
    border-radius:999px;
    overflow:hidden;
    margin-top:12px;
  }

  .bar > div{
    height:100%;
    width:0%;
    background:linear-gradient(90deg,var(--violet),var(--pink));
    transition:width .2s ease;
  }

  .progressMeta{
    margin-top:10px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    flex-wrap:wrap;
    font-size:13px;
    color:#4b5563;
    font-weight:900;
  }

  .diag{
    margin-top:14px;
    border:1px solid rgba(0,0,0,.08);
    border-radius:18px;
    overflow:hidden;
    background:#0f172a;
    box-shadow:var(--shadow2);
  }

  .diagHead{
    padding:12px 14px;
    font-weight:1000;
    color:#fff;
    border-bottom:1px solid rgba(255,255,255,.08);
  }

  .log{
    padding:12px;
    color:#e5e7eb;
    font-family:ui-monospace,Menlo,Consolas,monospace;
    font-size:12px;
    white-space:pre-wrap;
    max-height:260px;
    overflow:auto;
    line-height:1.45;
  }

  .imgs{
    margin-top:14px;
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:10px;
  }

  .imgCard{
    border:1px solid var(--border);
    border-radius:16px;
    overflow:hidden;
    background:#fff;
    box-shadow:0 8px 24px rgba(17,24,39,.05);
  }

  .imgCard img{
    width:100%;
    display:block;
    aspect-ratio:1/1;
    object-fit:cover;
    background:#f8fafc;
  }

  .imgCap{
    padding:10px;
    font-weight:900;
    color:#374151;
    font-size:13px;
  }

  .btns{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    margin-top:14px;
  }

  .btn{
    appearance:none;
    border:none;
    cursor:pointer;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:10px;
    padding:12px 14px;
    border-radius:999px;
    text-decoration:none;
    font-weight:1000;
    font-size:14px;
    line-height:1;
    transition:transform .14s ease, box-shadow .14s ease, filter .14s ease, background .14s ease;
  }

  .btn:hover{
    transform:translateY(-1px);
    filter:brightness(1.01);
  }

  .btn:active{
    transform:translateY(1px);
  }

  .primary{
    background:linear-gradient(90deg,var(--violet),var(--pink));
    color:#fff;
    box-shadow:0 14px 28px rgba(124,58,237,.18);
  }

  .ghost{
    background:transparent;
    color:#374151;
    border:1px solid rgba(0,0,0,.08);
  }

  .dark{
    background:#111827;
    color:#fff;
  }

  @media(max-width:860px){
    .imgs{grid-template-columns:repeat(2,minmax(0,1fr))}
  }

  @media(max-width:720px){
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
  }

  @media(max-width:520px){
    .imgs{grid-template-columns:1fr}
    .btns > *{flex:1 1 100%}
  }

  @media (prefers-reduced-motion: reduce){
    .sharedMenuToggle,
    .sharedMenuItem,
    .sharedHeaderAction,
    .btn,
    .bar > div{
      transition:none !important;
    }
  }
</style>
</head>
<body>

<div class="sharedHeader">
  <div class="sharedHeaderLeft">
    <a class="sharedBrand" href="/sales">
      <div class="sharedBrandMark">📚</div>
      <div class="sharedBrandText">Meu Livro Mágico</div>
    </a>
  </div>

  <div class="sharedHeaderRight">
    <div class="sharedMenuWrap">
      <button
        type="button"
        class="sharedMenuToggle"
        id="sharedMenuToggle"
        data-shared-menu-toggle="1"
        aria-expanded="false"
        aria-controls="sharedMenuPanel"
      >
        ☰ Menu
        <span class="sharedMenuToggleCaret">▾</span>
      </button>

      <div
        class="sharedMenuPanel"
        id="sharedMenuPanel"
        data-shared-menu-panel="1"
      >
        <div class="sharedMenuSection">
          <a class="sharedMenuItem" href="/sales">
            <span class="sharedMenuItemIcon">🏠</span>
            <span>Início</span>
          </a>

          <a class="sharedMenuItem" href="/como-funciona">
            <span class="sharedMenuItemIcon">✨</span>
            <span>Como funciona</span>
          </a>

          <a class="sharedMenuItem" href="/exemplos">
            <span class="sharedMenuItemIcon">📖</span>
            <span>Exemplos</span>
          </a>

          <a class="sharedMenuItem" href="/create">
            <span class="sharedMenuItemIcon">🪄</span>
            <span>Criar livro</span>
          </a>

          <a class="sharedMenuItem" href="/books">
            <span class="sharedMenuItemIcon">📚</span>
            <span>Meus Livros</span>
          </a>

          <div class="sharedMenuDivider"></div>

          <a class="sharedMenuItem" href="/profile">
            <span class="sharedMenuItemIcon">👤</span>
            <span>Perfil</span>
          </a>

          <button type="button" class="sharedMenuItem sharedMenuItemDanger" id="menuLogoutBtn">
            <span class="sharedMenuItemIcon">🚪</span>
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>

    <div class="sharedHeaderActions">
      <a class="sharedHeaderAction soft" href="/books">📚 Meus Livros</a>
      <a class="sharedHeaderAction primary" href="/create">✨ Criar Livro</a>
    </div>
  </div>
</div>

<div class="wrap">
  <div class="card">
    <div class="row">
      <div>
        <h1>⏳ Gerando seu livro…</h1>
        <div class="muted" id="sub">Preparando…</div>
      </div>

      <div class="row" style="justify-content:flex-end">
        <div class="statusPill">
          <span class="statusDot" id="statusDot"></span>
          <span id="statusText">Aguardando</span>
        </div>
        <div class="muted" id="meta">—</div>
      </div>
    </div>

    <div class="hint" id="hint"></div>

    <div class="bar"><div id="barFill"></div></div>

    <div class="progressMeta">
      <div id="progressText">Progresso: iniciando…</div>
      <div id="updatedText">Atualizado: —</div>
    </div>

    <div class="diag">
      <div class="diagHead">🧩 Diagnóstico</div>
      <div class="log" id="log">Iniciando…</div>
    </div>

    <div class="imgs" id="imgs"></div>

    <div class="btns">
      <button class="btn ghost" id="btnRefresh" type="button">🔄 Atualizar</button>
      <button class="btn dark" id="btnStop" type="button">⏸️ Parar</button>
      <button class="btn ghost" id="btnLogout" type="button">🚪 Sair</button>
      <a class="btn ghost" href="/create">← Voltar</a>
      <a class="btn ghost" href="/books">📚 Meus Livros</a>
      <a class="btn primary" id="previewBtn" href="#" style="display:none">📖 Abrir preview</a>
      <a class="btn primary" id="pdfBtn" href="#" style="display:none">⬇️ Baixar PDF</a>
    </div>
  </div>
</div>

<script>
  const $ = (id) => document.getElementById(id);

  let running = false;
  let stopFlag = false;
  let inflight = false;
  let previewRedirected = false;
  let preparedGenerate = false;
  let loopStarted = false;

  const logs = [];

  function addLog(line){
    const ts = new Date().toISOString();
    logs.push("[" + ts + "] " + String(line || ""));
    while (logs.length > 150) logs.shift();
    $("log").textContent = logs.join("\\n");
    $("log").scrollTop = $("log").scrollHeight;
  }

  function setHint(msg){
    const el = $("hint");
    const text = String(msg || "").trim();
    el.textContent = text;
    el.style.display = text ? "block" : "none";
  }

  function setSub(text){
    $("sub").textContent = String(text || "");
  }

  function setMeta(text){
    $("meta").textContent = String(text || "");
  }

  function setProgressText(text){
    $("progressText").textContent = String(text || "");
  }

  function setUpdatedText(text){
    $("updatedText").textContent = String(text || "");
  }

  function setBar(pct){
    const n = Math.max(0, Math.min(100, Number(pct || 0)));
    $("barFill").style.width = n + "%";
  }

  function setStatus(kind, text){
    const dot = $("statusDot");
    dot.className = "statusDot" + (kind ? " " + kind : "");
    $("statusText").textContent = String(text || "");
  }

  function goLogin(){
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = "/login?next=" + next;
  }

  function sleep(ms){
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getQueryBookId(){
    try {
      const qs = new URLSearchParams(location.search || "");
      return String(qs.get("id") || qs.get("bookId") || "").trim();
    } catch {
      return "";
    }
  }

  function getState(){
    return {
      bookId: String(localStorage.getItem("bookId") || "").trim(),
      childName: String(localStorage.getItem("childName") || "").trim(),
      childAge: Number(localStorage.getItem("childAge") || "6"),
      childGender: String(localStorage.getItem("childGender") || "neutral").trim() || "neutral",
      theme: String(localStorage.getItem("theme") || "space").trim() || "space",
      style: String(localStorage.getItem("style") || "read").trim() || "read",
      city: String(localStorage.getItem("city") || "").trim()
    };
  }

  function persistBookId(id){
    const v = String(id || "").trim();
    if (!v) return;
    try { localStorage.setItem("bookId", v); } catch {}
  }

  function clearPreviewFlags(bookId){
    try {
      sessionStorage.removeItem("preview_redirected_" + String(bookId || ""));
    } catch {}
  }

  function markPreviewRedirected(bookId){
    try {
      sessionStorage.setItem("preview_redirected_" + String(bookId || ""), "1");
    } catch {}
  }

  function wasPreviewRedirected(bookId){
    try {
      return sessionStorage.getItem("preview_redirected_" + String(bookId || "")) === "1";
    } catch {
      return false;
    }
  }

  function computeProgressFromStep(step, status){
    const s = String(step || "");
    const st = String(status || "");

    if (st === "done" || s === "done") return 100;
    if (st === "failed" || s === "failed") return 100;
    if (s === "created") return 5;
    if (s === "story") return 15;
    if (s === "cover") return 28;
    if (/^image_\\d+$/.test(s)) {
      const n = Number(s.split("_")[1] || "1");
      return Math.min(90, 30 + (n * 7));
    }
    if (s === "pdf") return 95;
    return 8;
  }

  function renderImages(coverUrl, images){
    const root = $("imgs");
    root.innerHTML = "";

    const items = [];
    if (coverUrl) items.push({ label: "Capa", url: coverUrl });

    (Array.isArray(images) ? images : []).forEach((it) => {
      if (it && it.url) {
        items.push({
          label: "Pág. " + String(it.page || "?"),
          url: String(it.url)
        });
      }
    });

    items.slice(0, 9).forEach((it) => {
      const div = document.createElement("div");
      div.className = "imgCard";
      div.innerHTML =
        '<img alt="' + escapeHtml(it.label) + '" src="' + escapeHtml(it.url) + '" />' +
        '<div class="imgCap">' + escapeHtml(it.label) + '</div>';
      root.appendChild(div);
    });
  }

  function escapeHtml(s){
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function fetchTextJson(url, opts){
    const options = Object.assign({}, opts || {});
    options.credentials = "include";
    options.headers = Object.assign(
      { "Accept": "application/json" },
      options.headers || {}
    );

    addLog("→ " + (options.method || "GET") + " " + url);

    const r = await fetch(url, options);
    const text = await r.text();
    let json = null;

    try {
      json = JSON.parse(text || "{}");
    } catch {
      json = null;
    }

    addLog("← HTTP " + r.status + " " + url + " | " + (text ? text.slice(0, 500) : "(vazio)"));

    if (r.status === 401) {
      throw new Error("not_logged_in");
    }

    return { response: r, text, json };
  }

  async function apiCreate(){
    const result = await fetchTextJson("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    const r = result.response;
    const j = result.json || {};

    if (!r.ok || !j.ok || !j.id) {
      throw new Error(j.error || "Falha ao criar livro");
    }

    return j;
  }

  async function apiGenerate(payload){
    const result = await fetchTextJson("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });

    const r = result.response;
    const j = result.json || {};

    if (!r.ok || !j.ok) {
      throw new Error(j.error || "Falha ao iniciar geração");
    }

    return j;
  }

  async function apiGenerateNext(payload){
    const result = await fetchTextJson("/api/generateNext", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });

    const r = result.response;
    const j = result.json || {};

    if (r.status === 409) {
      return { ok: false, busy: true, error: j.error || "step já em execução" };
    }

    if (!r.ok) {
      throw new Error(j.error || "Falha em /api/generateNext");
    }

    if (!j.ok) {
      throw new Error(j.error || "Falha em /api/generateNext");
    }

    return j;
  }

  async function apiStatus(bookId){
    const result = await fetchTextJson("/api/status/" + encodeURIComponent(bookId), {
      method: "GET"
    });

    const r = result.response;
    const j = result.json || {};

    if (!r.ok || !j.ok) {
      throw new Error(j.error || "Falha ao consultar status");
    }

    return j;
  }

  async function doLogout(){
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    } catch {}
    location.href = "/sales";
  }

  function isTransientBusyMessage(msg){
    const s = String(msg || "").toLowerCase();
    return (
      s.includes("step já em execução") ||
      s.includes("busy") ||
      s.includes("high demand") ||
      s.includes("unavailable") ||
      s.includes("temporar") ||
      s.includes("rate limit") ||
      s.includes("429")
    );
  }

  function statusMessageFor(data){
    const status = String(data && data.status || "");
    const step = String(data && data.step || "");
    const error = String(data && data.error || "");

    if (status === "done") return "✅ Livro pronto";
    if (status === "failed") return "❌ Falha na geração";
    if (step === "story") return "Escrevendo a história…";
    if (step === "cover") return "Criando a capa…";
    if (/^image_\\d+$/.test(step)) {
      const n = Number(step.split("_")[1] || "1");
      return "Criando a imagem da página " + n + "…";
    }
    if (step === "pdf") return "Montando o PDF…";
    if (error) return error;
    return "Preparando geração…";
  }

  function applyStatusToUI(data){
    const status = String(data && data.status || "created");
    const step = String(data && data.step || "created");
    const error = String(data && data.error || "");
    const updatedAt = String(data && data.updatedAt || "");

    setMeta("status=" + status + " • step=" + step);
    setSub(statusMessageFor(data));
    setProgressText("Progresso: " + computeProgressFromStep(step, status) + "% • etapa: " + step);
    setUpdatedText("Atualizado: " + (updatedAt || "—"));
    setBar(computeProgressFromStep(step, status));

    if (status === "done") {
      setStatus("ok", "Concluído");
    } else if (status === "failed") {
      setStatus("bad", "Falhou");
    } else if (running) {
      setStatus("run", "Gerando");
    } else {
      setStatus("", "Aguardando");
    }

    renderImages(data.coverUrl || "", data.images || []);

    const pdfBtn = $("pdfBtn");
    const previewBtn = $("previewBtn");

    if (status === "done") {
      if (data.pdf) {
        pdfBtn.style.display = "inline-flex";
        pdfBtn.href = data.pdf;
      }
      previewBtn.style.display = "inline-flex";
      previewBtn.href = "/preview?id=" + encodeURIComponent(String(data.id || getState().bookId || ""));
    } else {
      pdfBtn.style.display = "none";
      previewBtn.style.display = "none";
    }

    if (status === "failed") {
      setHint(error ? ("❌ " + error) : "❌ A geração falhou.");
    }
  }

  function buildGeneratePayload(bookId){
    const st = getState();
    return {
      id: String(bookId || st.bookId || "").trim(),
      childName: st.childName,
      childAge: Number.isFinite(st.childAge) ? st.childAge : 6,
      childGender: st.childGender || "neutral",
      theme: st.theme || "space",
      style: st.style || "read",
      city: st.city || ""
    };
  }

  async function ensureBookId(){
    const qsId = getQueryBookId();
    if (qsId) {
      persistBookId(qsId);
      return qsId;
    }

    const st = getState();
    if (st.bookId) return st.bookId;

    addLog("bookId ausente — criando livro automaticamente");
    setHint("✨ Criando seu livro automaticamente…");

    const created = await apiCreate();
    persistBookId(created.id);
    clearPreviewFlags(created.id);

    addLog("Livro criado: " + created.id);
    setHint("✅ Livro criado. Iniciando geração…");
    return created.id;
  }

  async function ensureGeneratePrepared(bookId){
    if (preparedGenerate) return;

    const payload = buildGeneratePayload(bookId);

    if (!payload.childName || payload.childName.length < 2) {
      setHint("⚠️ Nome da criança ausente. Volte em /create e preencha os dados.");
      throw new Error("childName inválido");
    }

    if (!payload.theme) {
      setHint("⚠️ Tema ausente. Volte em /create e escolha um tema.");
      throw new Error("theme inválido");
    }

    if (!payload.style) {
      setHint("⚠️ Estilo ausente. Volte em /create e escolha um estilo.");
      throw new Error("style inválido");
    }

    addLog("Chamando /api/generate para preparar o livro");
    await apiGenerate(payload);
    preparedGenerate = true;
    addLog("/api/generate OK");
  }

  async function refreshStatus(){
    const bookId = await ensureBookId();
    const status = await apiStatus(bookId);
    applyStatusToUI(status);
    return status;
  }

  async function maybeRedirectToPreview(bookId, statusData){
    if (!statusData || String(statusData.status || "") !== "done") return;
    if (previewRedirected) return;
    if (wasPreviewRedirected(bookId)) return;

    previewRedirected = true;
    markPreviewRedirected(bookId);

    setHint("✅ Livro pronto! Abrindo o preview…");
    addLog("Livro concluído — redirecionando para /preview");

    await sleep(900);

    if (!stopFlag) {
      location.href = "/preview?id=" + encodeURIComponent(bookId);
    }
  }

  async function startLoop(){
    if (loopStarted || running) return;

    loopStarted = true;
    running = true;
    stopFlag = false;
    previewRedirected = false;
    setStatus("run", "Gerando");
    setHint("");

    const startedAt = Date.now();
    const HARD_LIMIT_MS = 12 * 60 * 1000;

    try {
      const bookId = await ensureBookId();
      clearPreviewFlags(bookId);

      await ensureGeneratePrepared(bookId);

      let statusData = null;

      try {
        statusData = await apiStatus(bookId);
        applyStatusToUI(statusData);

        if (String(statusData.status || "") === "done") {
          running = false;
          setStatus("ok", "Concluído");
          await maybeRedirectToPreview(bookId, statusData);
          return;
        }

        if (String(statusData.status || "") === "failed") {
          running = false;
          setStatus("bad", "Falhou");
          return;
        }
      } catch (e) {
        addLog("Falha ao ler status inicial: " + String(e && e.message || e));
      }

      let busyBackoffMs = 1200;
      let softBackoffMs = 1800;

      while (!stopFlag) {
        if (Date.now() - startedAt > HARD_LIMIT_MS) {
          setHint("⏳ A geração demorou demais e foi interrompida na tela. Você pode atualizar ou abrir novamente mais tarde em Meus Livros.");
          addLog("HARD LIMIT atingido");
          setStatus("warn", "Tempo excedido");
          break;
        }

        if (inflight) {
          await sleep(250);
          continue;
        }

        inflight = true;

        try {
          const g = await apiGenerateNext({ id: bookId });

          if (g && g.busy) {
            addLog("Passo já em execução — aguardando " + busyBackoffMs + "ms");
            await sleep(busyBackoffMs);
            busyBackoffMs = Math.min(4000, Math.round(busyBackoffMs * 1.25));
            continue;
          }

          busyBackoffMs = 1200;

          const nextTryAt = Number(g && g.nextTryAt || 0);
          if (nextTryAt && nextTryAt > Date.now()) {
            const waitMs = Math.max(400, nextTryAt - Date.now());
            addLog("Cooldown do backend detectado — aguardando " + waitMs + "ms");
            await sleep(waitMs);
          } else {
            await sleep(700);
          }

          statusData = await apiStatus(bookId);
          applyStatusToUI(statusData);

          if (String(statusData.status || "") === "done") {
            addLog("Status final: done");
            setStatus("ok", "Concluído");
            await maybeRedirectToPreview(bookId, statusData);
            break;
          }

          if (String(statusData.status || "") === "failed") {
            addLog("Status final: failed");
            setStatus("bad", "Falhou");
            break;
          }

          await sleep(800);
        } catch (e) {
          const msg = String(e && e.message || e || "Erro");
          addLog("Erro no loop: " + msg);

          if (msg === "not_logged_in") {
            setHint("⚠️ Sua sessão expirou. Fazendo login novamente…");
            goLogin();
            return;
          }

          if (/book não existe/i.test(msg)) {
            setHint("❌ Este livro não foi encontrado. Volte para /create e gere novamente.");
            setStatus("bad", "Livro não encontrado");
            break;
          }

          if (isTransientBusyMessage(msg)) {
            addLog("Erro temporário — aguardando " + softBackoffMs + "ms");
            await sleep(softBackoffMs);
            softBackoffMs = Math.min(12000, Math.round(softBackoffMs * 1.35));
            continue;
          }

          try {
            statusData = await apiStatus(bookId);
            applyStatusToUI(statusData);

            if (String(statusData.status || "") === "done") {
              setStatus("ok", "Concluído");
              await maybeRedirectToPreview(bookId, statusData);
              break;
            }

            if (String(statusData.status || "") === "failed") {
              setStatus("bad", "Falhou");
              break;
            }
          } catch {}

          await sleep(2200);
        } finally {
          inflight = false;
        }
      }
    } catch (e) {
      const msg = String(e && e.message || e || "Erro");
      addLog("Falha ao iniciar: " + msg);

      if (msg === "not_logged_in") {
        setHint("⚠️ Sua sessão expirou. Fazendo login novamente…");
        goLogin();
        return;
      }

      setHint("❌ " + msg);
      setStatus("bad", "Erro");
    } finally {
      running = false;
      loopStarted = false;

      if (!previewRedirected) {
        const st = getState();
        try {
          const finalStatus = st.bookId ? await apiStatus(st.bookId) : null;
          if (finalStatus) {
            applyStatusToUI(finalStatus);
            if (String(finalStatus.status || "") === "done") {
              setStatus("ok", "Concluído");
            } else if (String(finalStatus.status || "") === "failed") {
              setStatus("bad", "Falhou");
            } else if (stopFlag) {
              setStatus("", "Pausado");
            }
          }
        } catch {}
      }
    }
  }

  function stopLoop(){
    stopFlag = true;
    running = false;
    setStatus("", "Pausado");
    addLog("Geração pausada pelo usuário");
    setHint("⏸️ A tela foi pausada. O backend pode terminar o passo atual se ele já tiver começado.");
  }

  (function bindSharedMenu(){
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
  })();

  $("btnLogout").addEventListener("click", doLogout);
  $("menuLogoutBtn").addEventListener("click", doLogout);

  $("btnRefresh").addEventListener("click", async function(){
    try {
      setHint("");
      const status = await refreshStatus();
      addLog("Status atualizado manualmente");
      if (status && String(status.status || "") === "done") {
        await maybeRedirectToPreview(String(status.id || getState().bookId || ""), status);
      }
    } catch (e) {
      const msg = String(e && e.message || e || "Erro");
      addLog("Falha no refresh: " + msg);
      if (msg === "not_logged_in") {
        goLogin();
        return;
      }
      setHint("❌ " + msg);
    }
  });

  $("btnStop").addEventListener("click", stopLoop);

  (async function init(){
    addLog("INIT /generate");

    try {
      const queryId = getQueryBookId();
      if (queryId) {
        persistBookId(queryId);
        addLog("bookId capturado da URL: " + queryId);
      }

      const st = getState();
      if (st.bookId) {
        clearPreviewFlags(st.bookId);
      }

      try {
        const status = await refreshStatus();
        if (status && String(status.status || "") === "done") {
          addLog("Livro já estava pronto");
          await maybeRedirectToPreview(String(status.id || st.bookId || ""), status);
          return;
        }

        if (status && String(status.status || "") === "failed") {
          addLog("Livro está com status failed");
          return;
        }
      } catch (e) {
        addLog("Status inicial indisponível: " + String(e && e.message || e));
      }

      startLoop();
    } catch (e) {
      const msg = String(e && e.message || e || "Erro");
      addLog("Erro no init: " + msg);
      if (msg === "not_logged_in") {
        goLogin();
        return;
      }
      setHint("❌ " + msg);
      setStatus("bad", "Erro");
    }
  })();
</script>
</body>
</html>`);
  });
};