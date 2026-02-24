/**
 * generate.page.js — /generate (Step 4)
 * ✅ Versão por etapas (serverless-safe)
 * - Botão "Iniciar geração" chama /api/generateNext em loop
 * - "Atualizar status" chama /api/progress/:id
 *
 * Export: module.exports = (app, { requireAuth }) => void
 */
"use strict";

module.exports = function mountGeneratePage(app, { requireAuth }) {
  app.get("/generate", requireAuth, async (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Criando Magia — Meu Livro Mágico</title>
<style>
  :root{
    --bg1:#ede9fe; --bg2:#ffffff; --bg3:#fdf2f8;
    --card:#ffffff; --text:#111827; --muted:#6b7280; --border:#e5e7eb;
    --shadow: 0 20px 50px rgba(0,0,0,.10);
    --violet:#7c3aed; --pink:#db2777;
    --btnShadow: 0 16px 34px rgba(124,58,237,.22);
  }
  *{box-sizing:border-box}
  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    color:var(--text);
    background: linear-gradient(to bottom, var(--bg1), var(--bg2), var(--bg3));
    min-height:100vh;
    padding: 22px 16px 90px;
  }
  .container{max-width: 980px; margin:0 auto;}
  .topRow{
    display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
    margin-bottom: 14px;
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
  .topActions{display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:flex-end;}
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
  .head{ text-align:center; padding: 8px 10px 4px; }
  .head h1{ margin:0; font-size: 28px; font-weight:1000; }
  .head p{ margin:8px 0 0; color: var(--muted); font-weight:800; }

  .statusBox{
    margin-top: 14px;
    border:1px solid var(--border);
    border-radius: 18px;
    padding: 14px;
    background: rgba(0,0,0,.02);
  }
  .statusLine{
    font-weight:1000;
    color:#111827;
  }
  .row{
    display:flex;
    justify-content:flex-end;
    gap:10px;
    flex-wrap:wrap;
    margin-top: 12px;
  }
  .btn{
    border:0;
    cursor:pointer;
    border-radius: 999px;
    padding: 12px 16px;
    font-weight:1000;
    display:inline-flex;
    align-items:center;
    gap:10px;
    user-select:none;
  }
  .btnGhost{
    background:#fff;
    border:1px solid var(--border);
    color:#374151;
  }
  .btnPrimary{
    color:#fff;
    background: linear-gradient(90deg, var(--violet), var(--pink));
    box-shadow: var(--btnShadow);
  }
  .btn:active{ transform: translateY(1px); }

  .hint{
    margin-top:12px;
    padding:10px 12px;
    border-radius:14px;
    background: rgba(219,39,119,.06);
    border: 1px solid rgba(219,39,119,.14);
    color:#7f1d1d;
    font-weight:900;
    display:none;
    white-space:pre-wrap;
  }
  .mini{
    margin-top:10px;
    color:var(--muted);
    font-weight:900;
    font-size:12px;
  }
  .bar{
    margin-top: 10px;
    width:100%;
    height: 12px;
    background: rgba(0,0,0,.06);
    border-radius: 999px;
    overflow:hidden;
    border: 1px solid rgba(0,0,0,.06);
  }
  .bar > div{
    height:100%;
    width:0%;
    background: linear-gradient(90deg, var(--violet), var(--pink));
    border-radius: 999px;
    transition: width .2s ease;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="topRow">
      <button class="backLink" id="btnBack">← Voltar</button>
      <div class="topActions">
        <a class="pill" href="/sales">🛒 Pagina Inicial</a>
        <a class="pill" href="/books">📚 Meus Livros</a>
        <a class="pill" href="/create">♻️ Reiniciar</a>
      </div>
    </div>

    <div class="card">
      <div class="head">
        <h1>✨ Criando Magia</h1>
        <p>Aguarde enquanto criamos o livro</p>
      </div>

      <div class="statusBox">
        <div class="statusLine" id="statusLine">Status: …</div>
        <div class="bar"><div id="barFill"></div></div>
        <div class="mini" id="mini">…</div>

        <div class="row">
          <button class="btn btnGhost" id="btnRefresh">🔄 Atualizar status</button>
          <button class="btn btnPrimary" id="btnStart">🚀 Iniciar geração</button>
        </div>
      </div>

      <div class="hint" id="hint"></div>
    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id);

  const state = {
    id: localStorage.getItem("bookId") || "",
    childName: localStorage.getItem("childName") || "",
    childAge: Number(localStorage.getItem("childAge") || "6"),
    childGender: localStorage.getItem("childGender") || "neutral",
    theme: localStorage.getItem("theme") || "space",
    style: localStorage.getItem("style") || "read",
  };

  let running = false;
  let timer = null;

  function setHint(msg){
    $("hint").textContent = msg || "";
    $("hint").style.display = msg ? "block" : "none";
  }

  function pct(done, total){
    done = Number(done||0); total = Number(total||0);
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((done/total)*100)));
  }

  function renderProgress(p){
    const status = p?.status || "created";
    const step = p?.step || "created";
    const done = Number(p?.doneSteps || 0);
    const total = Number(p?.totalSteps || 10);
    $("statusLine").textContent = \`Status: \${status}  •  step: \${step}  •  style: \${p?.style || state.style}\`;
    $("barFill").style.width = pct(done, total) + "%";
    $("mini").textContent = \`Progresso: \${done}/\${total}  •  \${p?.message || ""}\`;
  }

  async function getProgress(){
    if (!state.id) {
      renderProgress({ status:"created", step:"created", doneSteps:0, totalSteps:10, message:"Sem bookId (volte e crie um livro)" });
      return null;
    }
    const r = await fetch("/api/progress/" + encodeURIComponent(state.id), { headers: {"Accept":"application/json"} });
    const j = await r.json().catch(()=> ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Falha ao ler status");
    renderProgress(j);
    if (j.status === "failed" && j.error) setHint(j.error);
    return j;
  }

  async function generateNext(){
    if (!state.id) throw new Error("Sem bookId. Volte e crie o livro.");
    const r = await fetch("/api/generateNext", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        id: state.id,
        childName: state.childName,
        childAge: state.childAge,
        childGender: state.childGender,
        theme: state.theme,
        style: state.style
      })
    });
    const j = await r.json().catch(()=> ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Falha no passo");
    renderProgress(j);
    return j;
  }

  async function loop(){
    if (running) return;
    running = true;
    setHint("");

    try{
      // sempre puxa antes
      const p0 = await getProgress().catch(()=>null);
      if (!p0) throw new Error("Não consegui ler o status.");

      // loop: 1 passo por request
      while(true){
        const p = await generateNext();
        if (p.status === "done") break;
        if (p.status === "failed") break;

        // respiro curto pra UI
        await new Promise(r => setTimeout(r, 350));
      }
    }catch(e){
      setHint(String(e.message || e));
    }finally{
      running = false;
    }
  }

  $("btnRefresh").onclick = () => getProgress().catch(e => setHint(String(e.message||e)));
  $("btnStart").onclick = () => loop();
  $("btnBack").onclick = () => { window.location.href = "/create"; };

  (async function init(){
    try{
      await getProgress();
    }catch(e){
      setHint(String(e.message || e));
    }
  })();
</script>
</body>
</html>`);
  });
};