/**
 * generate.page.js — Página /generate (Step 4)
 * ✅ Vercel-safe: chama /api/generateNext em LOOP (1 passo por request)
 * ✅ Usa localStorage: bookId, childName, childAge, childGender, theme, style
 *
 * mount: require("./generate.page.js")(app, { requireAuth })
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
      --bg1:#ede9fe; --bg2:#ffffff; --bg3:#fdf2f8;
      --card:#ffffff; --text:#111827; --muted:#6b7280; --border:#e5e7eb;
      --violet:#7c3aed; --pink:#db2777; --shadow:0 20px 50px rgba(0,0,0,.10);
      --shadow2:0 10px 24px rgba(0,0,0,.08);
    }
    *{box-sizing:border-box}
    body{
      margin:0; font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;
      color:var(--text);
      background:linear-gradient(to bottom,var(--bg1),var(--bg2),var(--bg3));
      min-height:100vh;
    }
    .container{max-width:980px;margin:0 auto;padding:24px 16px}
    .topRow{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
    .pill{background:rgba(124,58,237,.10);color:#4c1d95;border:1px solid rgba(124,58,237,.16);padding:8px 12px;border-radius:999px;font-weight:900;text-decoration:none;display:inline-flex;gap:8px;align-items:center}
    .pillBtn{cursor:pointer}
    .card{background:var(--card);border:1px solid var(--border);border-radius:26px;box-shadow:var(--shadow);padding:18px}
    .head{text-align:center;padding:10px}
    .head h1{margin:0;font-size:26px;font-weight:1000}
    .head p{margin:8px 0 0;color:var(--muted);font-weight:800}
    .box{
      margin-top:14px;border:1px solid var(--border);border-radius:18px;background:#fff;
      padding:14px; box-shadow:var(--shadow2);
    }
    .row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
    .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
    .muted{color:var(--muted);font-weight:900}
    .statusLine{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-weight:900}
    .dot{width:10px;height:10px;border-radius:999px;background:#9ca3af}
    .dot.run{background:linear-gradient(90deg,var(--violet),var(--pink))}
    .dot.ok{background:linear-gradient(90deg,#34d399,#10b981)}
    .dot.bad{background:#ef4444}
    .barWrap{margin-top:10px}
    .bar{height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden}
    .bar > div{height:100%;width:0%;background:linear-gradient(90deg,var(--violet),var(--pink))}
    .btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
    .btn{
      border:0;cursor:pointer;border-radius:999px;padding:12px 16px;font-weight:1000;
      display:inline-flex;align-items:center;gap:10px;
    }
    .btnGhost{background:transparent;color:var(--muted);border:1px solid rgba(0,0,0,.08)}
    .btnPrimary{color:#fff;background:linear-gradient(90deg,var(--violet),var(--pink));box-shadow:0 16px 34px rgba(124,58,237,.22)}
    .btnDanger{color:#fff;background:#111827}
    .hint{
      margin-top:12px;padding:12px;border-radius:14px;background:rgba(219,39,119,.06);
      border:1px solid rgba(219,39,119,.14);color:#7f1d1d;font-weight:900;white-space:pre-wrap;display:none
    }
    .gridPreview{margin-top:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    @media(max-width:900px){.gridPreview{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:520px){.gridPreview{grid-template-columns:1fr}}
    .thumb{border:1px solid rgba(0,0,0,.08);border-radius:16px;overflow:hidden;background:#fff}
    .thumb img{width:100%;display:block}
    .thumb .cap{padding:10px;font-weight:900;color:#374151}
  </style>
</head>
<body>
  <div class="container">
    <div class="topRow">
      <a class="pill" href="/create">← Voltar</a>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
        <a class="pill" href="/sales">🛒 Página Inicial</a>
        <a class="pill" href="/books">📚 Meus Livros</a>
        <button class="pill pillBtn" id="btnReset">♻️ Reiniciar</button>
      </div>
    </div>

    <div class="card">
      <div class="head">
        <h1>✨ Criando Magia</h1>
        <p>Aguarde enquanto criamos o livro</p>
      </div>

      <div class="box">
        <div class="row">
          <div class="statusLine">
            <span class="dot" id="dot"></span>
            <span id="line" class="mono">Status: …</span>
          </div>
          <div class="muted mono" id="updated">Atualizado: —</div>
        </div>

        <div class="barWrap">
          <div class="row">
            <div class="muted" id="progressTxt">Progresso: 0/11 · Preparando…</div>
            <div class="btns">
              <button class="btn btnGhost" id="btnRefresh">🔄 Atualizar status</button>
              <button class="btn btnDanger" id="btnStop">⏸️ Parar</button>
              <button class="btn btnPrimary" id="btnStart">🚀 Iniciar geração</button>
            </div>
          </div>
          <div class="bar"><div id="barFill"></div></div>
        </div>

        <div class="hint" id="hint"></div>

        <div class="gridPreview" id="preview" style="display:none"></div>
      </div>
    </div>
  </div>

<script>
  const $ = (id)=>document.getElementById(id);

  let running = false;
  let stopFlag = false;
  let inflight = false;

  function setHint(msg){
    const el = $("hint");
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  function getState(){
    return {
      bookId: localStorage.getItem("bookId") || "",
      childName: (localStorage.getItem("childName") || "").trim(),
      childAge: Number(localStorage.getItem("childAge") || "6"),
      childGender: localStorage.getItem("childGender") || "neutral",
      theme: localStorage.getItem("theme") || "space",
      style: localStorage.getItem("style") || "read",
    };
  }

  function uiSetDot(kind){
    const d = $("dot");
    d.className = "dot" + (kind ? " " + kind : "");
  }

  function setBar(done, total){
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done/total)*100))) : 0;
    $("barFill").style.width = pct + "%";
  }

  function renderPreview(data){
    const wrap = $("preview");
    const imgs = Array.isArray(data?.images) ? data.images.filter(x=>x && x.url) : [];
    const cover = data?.coverUrl || "";
    const pdf = data?.pdf || "";

    const cards = [];
    if (cover) {
      cards.push({ title: "Capa", url: cover });
    }
    for (const it of imgs) {
      cards.push({ title: "Página " + (it.page || "?"), url: it.url });
    }

    if (!cards.length){
      wrap.style.display = "none";
      wrap.innerHTML = "";
      return;
    }

    wrap.style.display = "grid";
    wrap.innerHTML = cards.slice(0, 6).map(c => (
      '<div class="thumb">' +
        '<img src="' + c.url + '" alt="thumb"/>' +
        '<div class="cap">' + c.title + '</div>' +
      '</div>'
    )).join("");

    if (pdf && data?.status === "done") {
      // quando pronto, mostra link
      setHint("✅ Livro pronto! Baixe o PDF em: " + location.origin + pdf);
    }
  }

  async function apiProgress(bookId){
    const r = await fetch("/api/progress/" + encodeURIComponent(bookId), { method:"GET", headers:{ "Accept":"application/json" }});
    const j = await r.json().catch(()=>({}));
    if (!r.ok || !j.ok) throw new Error(j.error || ("Falha /api/progress ("+r.status+")"));
    return j;
  }

  async function apiGenerateNext(payload){
    const r = await fetch("/api/generateNext", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify(payload || {})
    });
    const j = await r.json().catch(()=>({}));
    if (!r.ok || !j.ok) throw new Error(j.error || ("Falha /api/generateNext ("+r.status+")"));
    return j;
  }

  function applyProgressUI(p){
    const status = p?.status || "created";
    const step = p?.step || "created";
    const style = p?.style || "read";

    $("line").textContent = "Status: " + status + " · step: " + step + " · style: " + style;
    $("updated").textContent = "Atualizado: " + (p?.updatedAt || "—");

    const done = Number(p?.doneSteps || 0);
    const total = Number(p?.totalSteps || 11);
    $("progressTxt").textContent = "Progresso: " + done + "/" + total + " · " + (p?.message || "");
    setBar(done, total);

    if (status === "done") uiSetDot("ok");
    else if (status === "failed") uiSetDot("bad");
    else if (running) uiSetDot("run");
    else uiSetDot("");

    renderPreview(p);

    if (status === "failed") {
      setHint("❌ Falhou: " + (p?.error || "erro desconhecido"));
    }
  }

  async function refreshOnce(){
    const st = getState();
    if (!st.bookId) {
      setHint("Sem bookId. Volte em /create e crie um livro.");
      return null;
    }
    const p = await apiProgress(st.bookId);
    applyProgressUI(p);
    return p;
  }

  async function startLoop(){
    setHint("");
    const st = getState();

    if (!st.bookId) return setHint("Sem bookId. Volte em /create e crie um livro.");
    if (!st.childName || st.childName.length < 2) return setHint("Nome da criança ausente. Volte e preencha o nome.");
    if (!st.theme) return setHint("Tema ausente. Volte e selecione um tema.");
    if (!st.style) return setHint("Estilo ausente. Volte e selecione um estilo.");

    running = true;
    stopFlag = false;
    uiSetDot("run");

    // loop: chama generateNext e depois atualiza progress
    while (!stopFlag) {
      if (inflight) { await new Promise(r=>setTimeout(r, 600)); continue; }
      inflight = true;

      try {
        const payload = {
          id: st.bookId,
          childName: st.childName,
          childAge: st.childAge,
          childGender: st.childGender,
          theme: st.theme,
          style: st.style
        };

        const g = await apiGenerateNext(payload);
        applyProgressUI(g);

        if (g.status === "done") break;
        if (g.status === "failed") break;

        // pequena pausa pra não espancar a função
        await new Promise(r=>setTimeout(r, 900));
      } catch (e) {
        setHint("Erro no loop: " + String(e?.message || e));
        // tenta só atualizar o status e aguarda um pouco
        try { await refreshOnce(); } catch {}
        await new Promise(r=>setTimeout(r, 1500));
      } finally {
        inflight = false;
      }
    }

    running = false;
    uiSetDot("");
  }

  $("btnStart").onclick = async ()=>{
    if (running) return;
    await startLoop();
  };

  $("btnStop").onclick = ()=>{
    stopFlag = true;
    running = false;
    uiSetDot("");
  };

  $("btnRefresh").onclick = async ()=>{
    try { await refreshOnce(); } catch (e) { setHint(String(e?.message || e)); }
  };

  $("btnReset").onclick = ()=>{
    localStorage.clear();
    location.href = "/create";
  };

  (async function init(){
    try {
      await refreshOnce();
    } catch (e) {
      setHint(String(e?.message || e));
    }
  })();
</script>
</body>
</html>`);
  });
};