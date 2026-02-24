/**
 * generate.page.js — Página separada do STEP 4 (Gerando…)
 *
 * Rota:
 *   GET /generate  -> página de status/poll/preview (step 4)
 *
 * Depende das mesmas APIs:
 *   POST /api/generate
 *   GET  /api/status/:id
 *
 * Usa localStorage:
 *   bookId, childName, childAge, childGender, theme, style, consent
 */

"use strict";

module.exports = function mountGeneratePage(app, { requireAuth }) {
  app.get("/generate", requireAuth, (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Meu Livro Mágico — Gerando</title>
  <style>
    :root{
      --bg1:#ede9fe; --bg2:#ffffff; --bg3:#fdf2f8;
      --card:#ffffff; --text:#111827; --muted:#6b7280; --border:#e5e7eb;
      --shadow: 0 20px 50px rgba(0,0,0,.10);
      --shadow2: 0 10px 24px rgba(0,0,0,.08);
      --violet:#7c3aed; --pink:#db2777;
      --disabled:#e5e7eb; --disabledText:#9ca3af;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      color:var(--text);
      background: linear-gradient(to bottom, var(--bg1), var(--bg2), var(--bg3));
      min-height:100vh;
      padding-bottom:90px;
    }
    .container{max-width: 980px; margin:0 auto; padding: 24px 16px;}
    .topRow{
      display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
      margin-bottom: 16px;
    }
    .backLink{
      border:0; background:transparent; cursor:pointer;
      display:inline-flex; align-items:center; gap:10px;
      color: var(--muted);
      font-weight:800;
      padding:10px 12px;
      border-radius:12px;
    }
    .backLink:hover{ color:#374151; background:rgba(0,0,0,.04); }
    .topActions{
      display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:flex-end;
    }
    .pill{
      background: rgba(124,58,237,.10);
      color: #4c1d95;
      border:1px solid rgba(124,58,237,.16);
      padding:6px 10px;
      border-radius:999px;
      font-weight:900;
      text-decoration:none;
    }

    .card{
      background: var(--card);
      border:1px solid var(--border);
      border-radius: 26px;
      box-shadow: var(--shadow);
      padding: 18px;
    }
    .head{
      text-align:center;
      padding: 14px 10px 6px;
    }
    .head h1{ margin:0; font-size: 26px; font-weight:1000; }
    .head p{ margin:8px 0 0; color: var(--muted); font-weight:800; }

    .progressBox{
      border:1px solid var(--border);
      border-radius: 18px;
      padding: 14px;
      background:#fff;
      box-shadow: var(--shadow2);
    }
    .statusLine{ font-weight:1000; }
    .statusMono{ margin-top:8px; color: var(--muted); font-weight:900; font-size: 12px; white-space:pre-wrap; }

    .rowBtn{
      margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;
    }
    .btn{
      border:0; cursor:pointer;
      border-radius: 999px;
      padding: 12px 18px;
      font-weight:1000;
      display:inline-flex; align-items:center; gap:10px;
      transition: transform .12s ease, opacity .12s ease;
      user-select:none;
    }
    .btn:active{ transform: translateY(1px); }
    .btnGhost{
      background: transparent;
      color: var(--muted);
      border: 1px solid rgba(0,0,0,.08);
    }
    .btnGhost:hover{ background: rgba(0,0,0,.04); color:#374151; }

    .btnPrimary{
      color:#fff;
      background: linear-gradient(90deg, var(--violet), var(--pink));
      box-shadow: 0 16px 34px rgba(124,58,237,.22);
    }
    .btnPrimary:disabled{
      background: var(--disabled);
      color: var(--disabledText);
      box-shadow:none;
      cursor:not-allowed;
    }

    .gallery{
      margin-top:14px;
      display:grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }
    .imgCard{
      border-radius: 18px;
      overflow:hidden;
      border:1px solid var(--border);
      box-shadow: var(--shadow2);
      background:#fff;
    }
    .imgCard img{ width:100%; height: 360px; object-fit:cover; display:block; background:#fff; }
    .hint{
      margin-top:10px;
      padding:12px;
      border-radius: 14px;
      background: rgba(219,39,119,.06);
      border: 1px solid rgba(219,39,119,.14);
      color:#7f1d1d;
      font-weight:900;
      white-space:pre-wrap;
      display:none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="topRow">
      <button class="backLink" id="btnBackCreate">← Voltar</button>
      <div class="topActions">
        <a class="pill" href="/sales">🛒 Pagina Inicial</a>
        <a class="pill" href="/books">📚 Meus Livros</a>
        <button class="pill" id="btnReset" style="cursor:pointer">♻️ Reiniciar</button>
      </div>
    </div>

    <div class="card">
      <div class="head">
        <h1>✨ Criando Magia</h1>
        <p>Aguarde enquanto criamos o livro</p>
      </div>

      <div class="progressBox">
        <div class="statusLine" id="statusLine">Aguardando…</div>
        <div class="statusMono" id="statusMono"></div>

        <div class="hint" id="hint"></div>

        <div class="rowBtn">
          <button class="btn btnGhost" id="btnPoll">🔄 Atualizar status</button>
          <button class="btn btnPrimary" id="btnStart">🚀 Iniciar geração</button>
        </div>

        <div id="pagesWrap" style="display:none;">
          <div style="margin-top:14px; font-weight:1000;">Preview (imagens)</div>
          <div class="gallery" id="gallery"></div>
        </div>
      </div>
    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id);

  const state = {
    bookId: localStorage.getItem("bookId") || "",
    theme: localStorage.getItem("theme") || "",
    style: localStorage.getItem("style") || "read",
    childName: localStorage.getItem("childName") || "",
    childAge: Number(localStorage.getItem("childAge") || "6"),
    childGender: localStorage.getItem("childGender") || "neutral",
    consent: localStorage.getItem("consent") === "1",
  };

  function setHint(msg){
    const el = $("hint");
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  function setStatus(line, mono){
    $("statusLine").textContent = line || "";
    $("statusMono").textContent = mono || "";
  }

  function canGenerateWhy() {
    if (!state.bookId) return "Sem bookId. Volte e crie um livro primeiro.";
    if (!state.childName || state.childName.trim().length < 2) return "Nome inválido (mínimo 2 letras).";
    if (!state.consent) return "Marque a autorização no passo anterior.";
    if (!state.theme) return "Tema ausente.";
    if (!state.style) return "Estilo ausente.";
    return "";
  }

  async function startGenerate(){
    setHint("");
    const why = canGenerateWhy();
    if (why) { setHint(why); return; }

    $("btnStart").disabled = true;
    setStatus("🚀 Iniciando geração (sequencial)…", "");

    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        id: state.bookId,
        child: { name: state.childName.trim(), age: state.childAge, gender: state.childGender },
        theme: state.theme,
        style: state.style || "read"
      })
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      setHint(j.error || "Falha ao iniciar geração.");
      setStatus("❌ Falha", "");
      $("btnStart").disabled = false;
      return;
    }

    await pollStatus(false);
    for (let i = 0; i < 900; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const done = await pollStatus(false);
      if (done) break;
    }
  }

  async function pollStatus(showHints){
    if (!state.bookId) return false;
    const r = await fetch("/api/status/" + encodeURIComponent(state.bookId));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (showHints) setHint("Erro ao ler status.");
      return false;
    }

    const extra = j.style ? (" • style: " + j.style) : "";
    const line = "Status: " + (j.status || "…") + " • step: " + (j.step || "…") + extra;
    const mono = j.error ? ("Erro: " + j.error) : "";
    setStatus(line, mono);

    if (j.coverUrl || (j.images && j.images.length)) {
      renderGallery(j.coverUrl || "", j.images || []);
    }

    if (j.status === "done" || j.status === "failed") {
      if (j.status === "failed") {
        $("btnStart").disabled = false;
        return true;
      }
      // ✅ use o id REAL que o backend retorna (id da pasta)
// prioridade: j.dirId (novo) -> j.id (se for o da pasta) -> state.bookId (fallback)
const finishedId = (j && (j.dirId || j.folderId || j.id)) ? String(j.dirId || j.folderId || j.id) : String(state.bookId);

setStatus("✅ Livro pronto! Abrindo seu livro…", "");
try { localStorage.setItem("lastBookId", finishedId); } catch {}
window.location.href = "/books/" + encodeURIComponent(finishedId);
return true;

    }

    return false;
  }

  function renderGallery(coverUrl, images){
    const gallery = $("gallery");
    gallery.innerHTML = "";

    const list = [];
    if (coverUrl) list.push({ url: coverUrl });
    (images || []).forEach(it => { if (it && it.url) list.push({ url: it.url }); });

    list.forEach(item => {
      const card = document.createElement("div");
      card.className = "imgCard";

      const a = document.createElement("a");
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noreferrer";

      const img = document.createElement("img");
      img.src = item.url;
      img.alt = "page";
      a.appendChild(img);

      card.appendChild(a);
      gallery.appendChild(card);
    });

    $("pagesWrap").style.display = list.length ? "block" : "none";
  }

  $("btnPoll").addEventListener("click", () => pollStatus(true));
  $("btnStart").addEventListener("click", startGenerate);

  $("btnBackCreate").addEventListener("click", () => {
    // volta pro /create e deixa o usuário ajustar
    window.location.href = "/create";
  });

  $("btnReset").addEventListener("click", () => {
    localStorage.clear();
    location.href = "/create";
  });

  // init
  (function init(){
    // Se já tiver bookId, tenta mostrar status.
    if (!state.bookId) {
      setHint("Sem bookId. Volte e comece um livro no /create.");
      $("btnStart").disabled = false;
      return;
    }
    pollStatus(false);
  })();
</script>
</body>
</html>`);
  });
};
