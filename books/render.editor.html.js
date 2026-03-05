// render.editor.html.js
// Página /books/:id/edit — Layout unificado (editor por página usando /api/editPageText e /api/regeneratePage)
//
// ✅ Não depende do preview e NÃO usa redirect/auto-open.
//
// Requer API no app.js:
//   POST /api/editPageText
//     body: { id: "<dirId|id>", page: <number>, text: "<novo texto>" }
//   POST /api/regeneratePage  (NOVO)
//     body: { id: "<dirId|id>", page: <number>, text: "<texto atual>" }
//
// Export:
//   module.exports = { renderBookEditorHtml }

"use strict";

function escapeHtml(s) {
  s = String(s == null ? "" : s);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pad2(n) {
  n = String(n == null ? "" : n);
  return n.length === 1 ? "0" + n : n;
}

function fmtDateBR(isoLike) {
  try {
    const d = new Date(String(isoLike || ""));
    if (!Number.isFinite(d.getTime())) return String(isoLike || "-");
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(
      d.getMinutes()
    )}`;
  } catch {
    return String(isoLike || "-");
  }
}

function safeJsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/<\/script/gi, "<\\/script");
}

function normalizeImages(book) {
  const arr = Array.isArray(book?.images) ? book.images : [];
  return arr
    .map((it) => ({
      page: Number(it?.page || 0),
      url: String(it?.url || ""),
    }))
    .filter((x) => x.page > 0 && x.url)
    .sort((a, b) => a.page - b.page);
}

function normalizeTexts(book, pageCount) {
  const pages = Array.isArray(book?.pages) ? book.pages : [];
  const overrides = book?.overrides || {};
  const ovText = overrides?.pagesText || overrides?.pages || null;

  const map = new Map();

  // 1) book.pages[].text
  for (const p of pages) {
    const n = Number(p?.page || p?.index || 0);
    const t = p?.text != null ? String(p.text) : "";
    if (n > 0 && t) map.set(n, t);
  }

  // 2) overrides.pagesText (array ou objeto)
  if (Array.isArray(ovText)) {
    ovText.forEach((v, i) => {
      if (v && typeof v === "object") {
        const n = Number(v.page || 0);
        const t = v.text != null ? String(v.text) : "";
        if (n > 0) map.set(n, t);
      } else {
        const n = i + 1;
        const t = v != null ? String(v) : "";
        if (t) map.set(n, t);
      }
    });
  } else if (ovText && typeof ovText === "object") {
    for (const k of Object.keys(ovText)) {
      const n = Number(k);
      const t = ovText[k] != null ? String(ovText[k]) : "";
      if (n > 0 && t) map.set(n, t);
    }
  }

  const out = [];
  for (let p = 1; p <= pageCount; p++) {
    out.push({ page: p, text: map.get(p) || "" });
  }
  return out;
}

function renderBookEditorHtml(book) {
  const id = String(book?.dirId || book?.id || "");
  const images = normalizeImages(book);

  const pagesLenFromPages = Array.isArray(book?.pages) ? book.pages.length : 0;
  const pageCount = Math.max(1, Number(book?.pagesCount || 0) || pagesLenFromPages || images.length || 1);

  const texts = normalizeTexts(book, pageCount);

  const coverUrl =
    book?.overrides?.coverUrl
      ? String(book.overrides.coverUrl)
      : book?.coverUrl
      ? String(book.coverUrl)
      : book?.cover?.url
      ? String(book.cover.url)
      : "";

  const metaUpdated = book?.updatedAt ? fmtDateBR(book.updatedAt) : "-";
  const errBox = book?.error ? `<div class="banner err">❌ ${escapeHtml(book.error)}</div>` : "";

  const data = {
    id,
    status: String(book?.status || ""),
    theme: String(book?.themeLabel || book?.theme || ""),
    childName: String(book?.childName || book?.child?.name || ""),
    updatedAt: String(book?.updatedAt || ""),
    coverUrl,
    pageCount,
    images,
    texts,
  };

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Editar Livro ${escapeHtml(book?.id || id)} — Meu Livro Mágico</title>
<style>
  /* ===== ESTILOS UNIFICADOS (mesmo do layout de referência) ===== */
  :root{
    --violet-50:#f5f3ff;
    --pink-50:#fff1f2;
    --white:#ffffff;
    --gray-900:#111827;
    --gray-800:#1f2937;
    --gray-700:#374151;
    --gray-600:#4b5563;
    --gray-500:#6b7280;
    --violet-600:#7c3aed;
    --violet-700:#6d28d9;
    --pink-600:#db2777;
    --pink-700:#be185d;
    --amber-500:#f59e0b;
    --amber-300:#fcd34d;
    --violet-200:#ddd6fe;
    --shadow: 0 22px 55px rgba(124,58,237,.18);
    --shadow2: 0 12px 30px rgba(17,24,39,.10);
    --r: 22px;

    --good:#10b981;
    --bad:#ef4444;
  }

  *{ box-sizing:border-box; }
  html,body{ height:100%; }
  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    color: var(--gray-800);
    background: linear-gradient(180deg, var(--violet-50), var(--white) 46%, var(--pink-50));
    overflow-x:hidden;
    min-height:100vh;
    padding-bottom:90px;
  }

  a{ color:inherit; text-decoration:none; }
  .wrap{ max-width: 1100px; margin: 0 auto; padding: 18px 16px; }

  /* Nav */
  .nav{
    padding: 16px 0;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
  }
  .brand{
    display:flex;
    align-items:center;
    gap:10px;
    font-weight:1000;
    letter-spacing:-.2px;
  }
  .brand .logo{
    width:42px;height:42px;border-radius:14px;
    display:grid;place-items:center;
    background: linear-gradient(135deg, rgba(124,58,237,.14), rgba(219,39,119,.14));
    border: 1px solid rgba(124,58,237,.18);
    box-shadow: var(--shadow2);
    font-size:20px;
  }
  .navRight{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }

  /* Buttons / Pills */
  .btn{
    border:0;
    cursor:pointer;
    user-select:none;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:10px;
    padding: 14px 18px;
    border-radius: 999px;
    font-weight: 900;
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease, opacity .15s ease;
    white-space:nowrap;
  }
  .btn:active{ transform: translateY(1px); }
  .btnPrimary{
    color:#fff;
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
    box-shadow: 0 18px 40px rgba(124,58,237,.20);
  }
  .btnPrimary:hover{
    background: linear-gradient(90deg, var(--violet-700), var(--pink-700));
    box-shadow: 0 18px 46px rgba(124,58,237,.26);
  }
  .btnOutline{
    color: var(--violet-700);
    background: rgba(255,255,255,.78);
    border: 2px solid rgba(221,214,254,.95);
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
  }
  .btnOutline:hover{
    background: rgba(245,243,255,.95);
    border-color: rgba(196,181,253,.95);
  }
  .btnTiny{
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 900;
  }

  .pill{
    display:inline-flex; gap:8px; align-items:center;
    padding:10px 12px; border-radius:999px;
    background: rgba(255,255,255,.76);
    border:1px solid rgba(221,214,254,.92);
    color: rgba(109,40,217,1);
    font-weight:950;
    box-shadow: 0 14px 30px rgba(17,24,39,.08);
    cursor:pointer;
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
    text-decoration:none;
    white-space:nowrap;
  }
  .pill:hover{
    background: rgba(245,243,255,.92);
    border-color: rgba(196,181,253,.95);
    transform: translateY(-1px);
    box-shadow: 0 18px 44px rgba(17,24,39,.10);
  }
  .pill.ghost{
    background:#fff;
    border-color: var(--gray-200);
    color:#6d28d9;
  }

  .card{
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(17,24,39,.06);
    border-radius: 24px;
    box-shadow: var(--shadow2);
    overflow:hidden;
  }
  .cardIn{
    padding: 16px;
  }

  .banner{
    margin-top:12px;
    padding:12px 12px;
    border-radius:16px;
    border: 1px solid rgba(0,0,0,.08);
    background: rgba(255,255,255,.70);
    box-shadow: var(--shadow2);
    font-weight:900;
  }
  .banner.err{ border-color: rgba(239,68,68,.22); background: rgba(239,68,68,.06); color:#7f1d1d; }
  .banner.ok{ border-color: rgba(16,185,129,.22); background: rgba(16,185,129,.08); color:#065f46; }
  .banner.info{ border-color: rgba(124,58,237,.18); background: rgba(124,58,237,.06); color:#4c1d95; }

  .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;}

  /* ===== ESTILOS ESPECÍFICOS DO EDITOR ===== */
  .container{max-width: 1100px; margin:0 auto; padding: 18px 16px;}
  .topRow{
    display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
    margin-bottom: 12px;
  }
  .head{
    display:flex; gap:14px; flex-wrap:wrap; align-items:flex-start; justify-content:space-between;
  }
  .ttl{margin:0;font-size:18px;font-weight:1100}
  .meta{margin-top:6px;color:var(--gray-600);font-weight:850;font-size:13px;line-height:1.35}
  .actions{display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:flex-end;}

  .grid{
    margin-top:14px;
    display:grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 12px;
  }
  .pageCard{
    grid-column: span 12;
    border:1px solid rgba(17,24,39,.06);
    border-radius: 18px;
    background:#fff;
    box-shadow: var(--shadow2);
    overflow:hidden;
  }
  .pageHead{
    display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;
    padding:12px 12px;
    border-bottom:1px solid rgba(17,24,39,.06);
    background: rgba(0,0,0,.02);
  }
  .pageHead .left{display:flex; align-items:center; gap:10px; flex-wrap:wrap;}
  .badge{
    display:inline-flex; align-items:center; gap:8px;
    padding:6px 10px; border-radius:999px;
    border:1px solid rgba(0,0,0,.08);
    background: #fff;
    font-weight:1000; font-size:12px;
  }
  .badge.p{ color:#6d28d9; }
  .badge.s{ color:#374151; }
  .hint{
    font-weight:900;
    font-size:12px;
    color: var(--gray-500);
    margin-left: 8px;
  }
  .hint.ok{ color:#065f46; }
  .hint.bad{ color:#7f1d1d; }

  .pageBody{
    padding:12px;
    display:grid;
    grid-template-columns: 420px 1fr;
    gap: 12px;
    align-items:start;
  }
  @media (max-width: 980px){
    .pageBody{ grid-template-columns: 1fr; }
  }

  .imgBox{
    border:1px solid rgba(17,24,39,.06);
    border-radius: 16px;
    background:#fff;
    overflow:hidden;
  }
  .imgBox .imgFrame{
    position:relative;
    width:100%;
    aspect-ratio: 4 / 5;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    background:#fff;
  }
  .imgBox .imgBg{
    position:absolute;
    inset:-16px;
    width:calc(100% + 32px);
    height:calc(100% + 32px);
    object-fit:cover;
    filter: blur(16px) saturate(1.1);
    opacity:.55;
  }
  .imgBox .imgFg{
    position:relative;
    max-width:100%;
    max-height:100%;
    object-fit:contain;
    display:block;
  }
  .imgBox .imgFoot{
    padding:10px 10px;
    border-top:1px solid rgba(17,24,39,.06);
    color: var(--gray-500);
    font-weight:850;
    font-size:12px;
    display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;
  }

  textarea{
    width:100%;
    min-height: 220px;
    resize: vertical;
    border:1px solid rgba(221,214,254,.95);
    border-radius: 16px;
    padding:12px;
    font: inherit;
    font-weight:850;
    outline:none;
    box-shadow: 0 10px 24px rgba(17,24,39,.06);
  }
  textarea:focus{
    border-color: rgba(124,58,237,.35);
    box-shadow: 0 0 0 4px rgba(124,58,237,.10), 0 10px 24px rgba(17,24,39,.08);
  }

  .rowBtn{display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; margin-top:10px;}
  .btnGhost{
    background:#fff;
    color:#6d28d9;
    border:1px solid rgba(221,214,254,.95);
  }
  .btnPrimary:disabled, .btnGhost:disabled{ opacity:.55; cursor:not-allowed; box-shadow:none; }
  .muted{color:var(--gray-500)}
</style>
</head>
<body>
<div class="wrap">
  <!-- Navbar igual ao dos outros -->
  <div class="nav">
    <div class="brand">
      <div class="logo">📚</div>
      <div>Meu Livro Mágico</div>
    </div>
    <div class="navRight">
      <a class="pill" href="/sales" title="Vendas">🛒 Pagina Inicial</a>
      <a class="btn btnPrimary" href="/create" title="Criar agora">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 21l9-9" stroke="white" stroke-width="2" stroke-linecap="round"/>
          <path d="M14 4l6 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
          <path d="M12 6l6 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
          <path d="M7 11l6 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Criar Livro
      </a>
      <button class="btn btnOutline" id="btnLogout">🚪 Sair</button>
    </div>
  </div>

  <!-- Conteúdo do editor -->
  <div class="topRow">
    <a class="pill ghost" href="/books/${encodeURIComponent(id)}">← Voltar pro preview</a>
    <div class="actions">
      <a class="pill" href="/books">📚 Meus Livros</a>
      <a class="pill" href="/create">✨ Criar novo</a>
    </div>
  </div>

  <div class="card">
    <div class="head">
      <div>
        <h1 class="ttl">✏️ Editar livro: ${escapeHtml(book?.id || id)}</h1>
        <div class="meta">
          Status: <b>${escapeHtml(book?.status || "-")}</b> •
          Tema: <b>${escapeHtml(book?.themeLabel || book?.theme || "-")}</b> •
          Criança: <b>${escapeHtml(book?.childName || book?.child?.name || "-")}</b> •
          Atualizado: <b>${escapeHtml(metaUpdated)}</b>
          <div class="muted mono" style="margin-top:4px">id: ${escapeHtml(id)}</div>
        </div>
      </div>

      <div class="actions">
        <button class="pill" id="btnSaveAll">💾 Salvar tudo</button>
        <a class="pill" href="/books/${encodeURIComponent(id)}">👁️ Ver preview</a>
      </div>
    </div>

    ${errBox}

    <div class="banner info" id="msgInfo">
      Dica: edite o texto e clique em <b>Salvar</b> na página, ou <b>Salvar tudo</b> no topo. Para gerar uma nova imagem, use <b>Refazer cena</b>.
    </div>
    <div class="banner ok" id="msgOk" style="display:none;"></div>
    <div class="banner err" id="msgErr" style="display:none;"></div>

    <div class="grid" id="gridPages"></div>
  </div>
</div>

<script>
(function(){
  const DATA = ${safeJsonForScript(data)};
  const $ = (id) => document.getElementById(id);

  // Logout
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/sales';
    } catch (e) {
      alert('Erro ao sair');
    }
  });

  function showOk(msg){
    const el = $("msgOk");
    el.textContent = msg || "Salvo.";
    el.style.display = "";
    $("msgErr").style.display = "none";
  }
  function showErr(msg){
    const el = $("msgErr");
    el.textContent = msg || "Erro.";
    el.style.display = "";
    $("msgOk").style.display = "none";
  }

  function qs(root, sel){ return root ? root.querySelector(sel) : null; }
  function qsa(root, sel){ return root ? Array.from(root.querySelectorAll(sel)) : []; }

  function findImageUrl(page){
    const it = (DATA.images || []).find(x => Number(x.page) === Number(page));
    return it && it.url ? String(it.url) : "";
  }

  function getText(page){
    const it = (DATA.texts || []).find(x => Number(x.page) === Number(page));
    return it && it.text != null ? String(it.text) : "";
  }

  function normalizeTextInput(s){
    return String(s || "").trim().replace(/\\s+/g, " ");
  }

  async function postJson(url, body){
    const r = await fetch(url, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body || {})
    });
    const j = await r.json().catch(()=> ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Falha");
    return j;
  }

  function setPageHint(page, msg, ok){
    const el = document.querySelector("[data-hint='"+page+"']");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.remove("ok","bad");
    if (msg) el.classList.add(ok ? "ok" : "bad");
  }

  // NOVO: desabilita/habilita os botões da página (Salvar e Refazer)
  function setPageControlsDisabled(page, disabled, savingLabel){
    const btnsSave = document.querySelectorAll("button[data-save='"+page+"']");
    const btnsRegen = document.querySelectorAll("button[data-regen='"+page+"']");
    btnsSave.forEach(b=>{
      b.disabled = !!disabled;
      if (savingLabel && disabled) b.textContent = savingLabel;
      if (!disabled) b.textContent = "💾 Salvar";
    });
    btnsRegen.forEach(b=>{
      b.disabled = !!disabled;
      if (savingLabel && disabled) b.textContent = "⏳ Refazendo…";
      if (!disabled) b.textContent = "🔄 Refazer cena";
    });
  }

  function updatePageImage(page, newUrl, rev){
    const card = document.querySelector(".pageCard[data-page-card='"+page+"']");
    if (!card) return;

    const bg = qs(card, "img.imgBg");
    const fg = qs(card, "img.imgFg");
    if (!bg && !fg) return;

    const base = String(newUrl || (fg ? fg.getAttribute("data-base-url") : "") || "");
    if (!base) return;

    const v = (rev != null && String(rev)) ? String(rev) : String(Date.now());
    const sep = base.includes("?") ? "&" : "?";
    const busted = base + sep + "v=" + encodeURIComponent(v);

    if (bg) bg.src = busted;
    if (fg) fg.src = busted;

    const a = qs(card, "a[data-open-image='1']");
    if (a) a.href = base;
  }

  async function savePage(page){
    const card = document.querySelector(".pageCard[data-page-card='"+page+"']");
    if (!card) return { ok:false, error:"Card não encontrado" };

    const ta = qs(card, "textarea[data-page='"+page+"']");
    if (!ta) return { ok:false, error:"Textarea não encontrada" };

    const raw = String(ta.value || "");
    const text = normalizeTextInput(raw);

    setPageControlsDisabled(page, true, "⏳ Salvando…");
    setPageHint(page, "Salvando…", true);

    try{
      const j = await postJson("/api/editPageText", {
        id: DATA.id,
        page: Number(page),
        text
      });

      if (j && j.url){
        updatePageImage(page, String(j.url), j.rev);
      }

      setPageHint(page, "Pronto ✅", true);
      return { ok:true, j };
    }catch(e){
      const msg = (e && e.message) ? e.message : String(e);
      setPageHint(page, msg, false);
      return { ok:false, error: msg };
    }finally{
      setPageControlsDisabled(page, false);
    }
  }

  // NOVO: regenerar imagem da página
  async function regeneratePage(page){
    const card = document.querySelector(".pageCard[data-page-card='"+page+"']");
    if (!card) return { ok:false, error:"Card não encontrado" };

    const ta = qs(card, "textarea[data-page='"+page+"']");
    if (!ta) return { ok:false, error:"Textarea não encontrada" };

    const raw = String(ta.value || "");
    const text = normalizeTextInput(raw);

    setPageControlsDisabled(page, true, "⏳ Refazendo…");
    setPageHint(page, "Gerando nova imagem…", true);

    try{
      const j = await postJson("/api/regeneratePage", {
        id: DATA.id,
        page: Number(page),
        text
      });

      if (j && j.url){
        updatePageImage(page, String(j.url), j.rev || Date.now());
      }

      setPageHint(page, "Imagem atualizada ✅", true);
      return { ok:true, j };
    }catch(e){
      const msg = (e && e.message) ? e.message : String(e);
      setPageHint(page, msg, false);
      return { ok:false, error: msg };
    }finally{
      setPageControlsDisabled(page, false);
    }
  }

  async function saveAll(){
    const pages = Array.from(document.querySelectorAll("textarea[data-page]"))
      .map(el => Number(el.getAttribute("data-page")))
      .filter(n => Number.isFinite(n) && n > 0);

    const btn = $("btnSaveAll");
    btn.disabled = true;
    btn.textContent = "⏳ Salvando tudo…";

    let okCount = 0;
    const errors = [];

    try{
      for (const p of pages){
        const r = await savePage(p);
        if (r && r.ok) okCount++;
        else errors.push({ page: p, error: r && r.error ? r.error : "Erro" });
      }

      if (errors.length){
        showErr("❌ Algumas páginas falharam: " + errors.map(x => ("p"+x.page+": "+x.error)).join(" • "));
      }else{
        showOk("✅ Todas as páginas foram salvas (" + okCount + ").");
      }
    }finally{
      btn.disabled = false;
      btn.textContent = "💾 Salvar tudo";
    }
  }

  function makePageCard(page){
    const url = findImageUrl(page);
    const text = getText(page);

    const card = document.createElement("div");
    card.className = "pageCard";
    card.setAttribute("data-page-card", String(page));

    const head = document.createElement("div");
    head.className = "pageHead";

    const left = document.createElement("div");
    left.className = "left";

    const badgeP = document.createElement("span");
    badgeP.className = "badge p";
    badgeP.textContent = "Página " + page;

    const badgeS = document.createElement("span");
    badgeS.className = "badge s";
    badgeS.textContent = url ? "🖼️ imagem OK" : "⚠️ sem imagem";

    const hint = document.createElement("span");
    hint.className = "hint";
    hint.setAttribute("data-hint", String(page));
    hint.textContent = "";

    left.appendChild(badgeP);
    left.appendChild(badgeS);
    left.appendChild(hint);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "8px";

    // Botão Refazer (NOVO)
    const btnRegen = document.createElement("button");
    btnRegen.className = "btn btnOutline btnTiny"; // estilo outline pequeno
    btnRegen.textContent = "🔄 Refazer cena";
    btnRegen.setAttribute("data-regen", String(page));
    btnRegen.onclick = () => regeneratePage(page);

    // Botão Salvar
    const btnSave = document.createElement("button");
    btnSave.className = "btn btnPrimary btnTiny";
    btnSave.textContent = "💾 Salvar";
    btnSave.setAttribute("data-save", String(page));
    btnSave.onclick = () => savePage(page);

    right.appendChild(btnRegen);
    right.appendChild(btnSave);

    head.appendChild(left);
    head.appendChild(right);

    const body = document.createElement("div");
    body.className = "pageBody";

    const imgBox = document.createElement("div");
    imgBox.className = "imgBox";
    const frame = document.createElement("div");
    frame.className = "imgFrame";

    if (url){
      const bg = document.createElement("img");
      bg.className = "imgBg";
      bg.src = url;

      const fg = document.createElement("img");
      fg.className = "imgFg";
      fg.src = url;
      fg.setAttribute("data-base-url", url);

      frame.appendChild(bg);
      frame.appendChild(fg);
    }else{
      const d = document.createElement("div");
      d.className = "muted";
      d.style.fontWeight = "900";
      d.textContent = "Sem imagem para esta página.";
      frame.appendChild(d);
    }

    const foot = document.createElement("div");
    foot.className = "imgFoot";

    const leftFoot = document.createElement("span");
    leftFoot.className = "mono";
    leftFoot.textContent = "page: " + page;

    foot.appendChild(leftFoot);

    if (url){
      const a = document.createElement("a");
      a.className = "mono";
      a.href = url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = "abrir imagem";
      a.setAttribute("data-open-image", "1");
      foot.appendChild(a);
    }

    imgBox.appendChild(frame);
    imgBox.appendChild(foot);

    const boxRight = document.createElement("div");

    const ta = document.createElement("textarea");
    ta.value = text || "";
    ta.setAttribute("data-page", String(page));
    ta.placeholder = "Digite o texto da página " + page + "…";

    const row = document.createElement("div");
    row.className = "rowBtn";

    const btnSave2 = document.createElement("button");
    btnSave2.className = "btn btnGhost";
    btnSave2.textContent = "💾 Salvar";
    btnSave2.setAttribute("data-save", String(page));
    btnSave2.onclick = () => savePage(page);

    row.appendChild(btnSave2);

    boxRight.appendChild(ta);
    boxRight.appendChild(row);

    body.appendChild(imgBox);
    body.appendChild(boxRight);

    card.appendChild(head);
    card.appendChild(body);

    return card;
  }

  function render(){
    const grid = $("gridPages");
    grid.innerHTML = "";

    const n = Number(DATA.pageCount || 1);
    for (let p=1; p<=n; p++){
      grid.appendChild(makePageCard(p));
    }

    $("btnSaveAll").onclick = saveAll;
  }

  render();
})();
</script>

</body>
</html>`;
}

module.exports = { renderBookEditorHtml };