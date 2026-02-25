/**
 * generate.page.js — Página /generate (Step 4)
 * ✅ Serverless-safe: usa /api/generateNext em LOOP (1 passo por chamada)
 * ✅ Robustez: credentials, redirect/login HTML, retry/backoff, não "morre" no 1º erro
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
      --bg1:#ede9fe;
      --bg2:#ffffff;
      --bg3:#fdf2f8;
      --card:#ffffff;
      --text:#111827;
      --muted:#6b7280;
      --border:#e5e7eb;
      --shadow: 0 20px 50px rgba(0,0,0,.10);
      --shadow2: 0 10px 24px rgba(0,0,0,.08);
      --violet:#7c3aed;
      --pink:#db2777;
      --good:#10b981;
      --bad:#ef4444;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      color:var(--text);
      background: linear-gradient(to bottom, var(--bg1), var(--bg2), var(--bg3));
      min-height:100vh;
      padding:24px 16px 60px;
    }
    .container{max-width: 980px; margin:0 auto;}
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
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      align-items:center;
      justify-content:flex-end;
    }
    .pill{
      background: rgba(124,58,237,.10);
      color: #4c1d95;
      border:1px solid rgba(124,58,237,.16);
      padding:7px 12px;
      border-radius:999px;
      font-weight:900;
      text-decoration:none;
      display:inline-flex;
      gap:8px;
      align-items:center;
    }
    .pillBtn{
      cursor:pointer;
      border:1px solid rgba(124,58,237,.16);
      background: rgba(124,58,237,.10);
      color:#4c1d95;
      border-radius:999px;
      padding:7px 12px;
      font-weight:900;
    }
    .pillBtn:hover{ filter:brightness(.98); }

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
    .head h1{ margin:0; font-size: 28px; font-weight:1000; }
    .head p{ margin:8px 0 0; color: var(--muted); font-weight:800; }

    .statusBox{
      margin-top:14px;
      border:1px solid var(--border);
      border-radius:18px;
      padding:14px;
      background:#fff;
      box-shadow: var(--shadow2);
    }
    .statusLine{
      font-weight:900;
      color:#0f172a;
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      align-items:center;
    }
    .dot{
      width:10px; height:10px; border-radius:999px; background:#e5e7eb;
      display:inline-block;
    }
    .dot.good{ background: var(--good); }
    .dot.bad{ background: var(--bad); }
    .dot.run{ background: linear-gradient(90deg,var(--violet),var(--pink)); }

    .barWrap{
      margin-top:10px;
      height:12px;
      border-radius:999px;
      background:#f3f4f6;
      overflow:hidden;
      border:1px solid rgba(0,0,0,.06);
    }
    .bar{
      height:100%;
      width:0%;
      background: linear-gradient(90deg,var(--violet),var(--pink));
      transition: width .25s ease;
    }
    .meta{
      margin-top:10px;
      display:flex;
      justify-content:space-between;
      gap:10px;
      flex-wrap:wrap;
      color: var(--muted);
      font-weight:900;
      font-size: 13px;
    }

    .rowBtns{
      margin-top:14px;
      display:flex;
      gap:10px;
      align-items:center;
      justify-content:flex-end;
      flex-wrap:wrap;
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
      transition: transform .12s ease, opacity .12s ease;
      user-select:none;
    }
    .btn:active{ transform: translateY(1px); }

    .btnGhost{
      background: #fff;
      color:#374151;
      border: 1px solid var(--border);
    }
    .btnGhost:hover{ background:#fafafa; }

    .btnPrimary{
      color:#fff;
      background: linear-gradient(90deg, var(--violet), var(--pink));
      box-shadow: 0 16px 34px rgba(124,58,237,.22);
    }
    .btnPrimary:disabled{
      opacity:.55;
      cursor:not-allowed;
      box-shadow:none;
    }

    .error{
      margin-top:12px;
      padding:12px;
      border-radius:14px;
      background: rgba(239,68,68,.06);
      border: 1px solid rgba(239,68,68,.18);
      color:#7f1d1d;
      font-weight:900;
      white-space:pre-wrap;
      display:none;
    }

    .preview{
      margin-top:14px;
      display:grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    @media (min-width: 860px){
      .preview{ grid-template-columns: 1fr 1fr; }
    }
    .imgCard{
      border:1px solid var(--border);
      border-radius:18px;
      overflow:hidden;
      background:#fff;
      box-shadow: var(--shadow2);
    }
    .imgCard .cap{
      padding:10px 12px;
      border-bottom:1px solid var(--border);
      font-weight:1000;
      color:#111827;
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
    }
    .imgCard img{
      display:block;
      width:100%;
      height:auto;
      background:#fff;
    }
    .small{
      color: var(--muted);
      font-weight:900;
      font-size: 12px;
    }
    a.link{
      color:#4c1d95;
      font-weight:1000;
      text-decoration:none;
    }
    a.link:hover{ text-decoration:underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="topRow">
      <button class="backLink" id="btnBackTop">← Voltar</button>
      <div class="topActions">
        <a class="pill" href="/sales">🛒 Pagina Inicial</a>
        <a class="pill" href="/books">📚 Meus Livros</a>
        <button class="pillBtn" id="btnReset">♻️ Reiniciar</button>
      </div>
    </div>

    <div class="card">
      <div class="head">
        <h1>✨ Criando Magia</h1>
        <p>Aguarde enquanto criamos o livro</p>
      </div>

      <div class="statusBox">
        <div class="statusLine">
          <span class="dot" id="dot"></span>
          <span id="statusText">Status: —</span>
        </div>

        <div class="barWrap" aria-label="Progresso">
          <div class="bar" id="bar"></div>
        </div>

        <div class="meta">
          <div id="progressText">Progresso: 0/11 • Preparando…</div>
          <div class="small" id="updatedText">—</div>
        </div>

        <div class="rowBtns">
          <button class="btn btnGhost" id="btnRefresh">🔄 Atualizar status</button>
          <button class="btn btnGhost" id="btnStop" disabled>⏸️ Parar</button>
          <button class="btn btnPrimary" id="btnStart">🚀 Iniciar geração</button>
        </div>

        <div class="error" id="errBox"></div>
      </div>

      <div class="preview" id="preview" style="display:none">
        <div class="imgCard" id="coverCard" style="display:none">
          <div class="cap">
            <div>📕 Capa</div>
            <div class="small"><a class="link" id="coverOpen" href="#" target="_blank" rel="noreferrer">Abrir</a></div>
          </div>
          <img id="coverImg" alt="Capa do livro"/>
        </div>

        <div class="imgCard" id="pdfCard" style="display:none">
          <div class="cap">
            <div>📄 PDF</div>
            <div class="small"><a class="link" id="pdfOpen" href="#" target="_blank" rel="noreferrer">Baixar</a></div>
          </div>
          <div style="padding:14px; font-weight:900; color:#111827">
            Seu livro está pronto para imprimir.
          </div>
        </div>
      </div>
    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id);

  function getLS(key, def=""){ try{ return localStorage.getItem(key) ?? def; }catch{ return def; } }

  function setErr(msg){
    const el = $("errBox");
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  function loadClientState(){
    return {
      bookId: (getLS("bookId","") || "").trim(),
      childName: (getLS("childName","") || "").trim(),
      childAge: Number(getLS("childAge","6") || "6"),
      childGender: (getLS("childGender","neutral") || "neutral"),
      theme: (getLS("theme","space") || "space"),
      style: (getLS("style","read") || "read"),
    };
  }

  let running = false;
  let loopTimer = null;
  let backoffMs = 900;

  function setRunningUI(on){
    running = !!on;
    $("btnStart").disabled = on;
    $("btnStop").disabled = !on;
    if (on) $("btnStart").textContent = "⏳ Gerando...";
    else $("btnStart").textContent = "🚀 Iniciar geração";
  }

  function setUIFromProgress(p){
    const status = String(p?.status || "created");
    const step = String(p?.step || "created");
    const style = String(p?.style || "read");

    const done = Number(p?.doneSteps ?? 0);
    const total = Number(p?.totalSteps ?? 11);
    const msg = String(p?.message || "Preparando…");
    const err = String(p?.error || "");

    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done/total)*100))) : 0;
    $("bar").style.width = pct + "%";

    $("statusText").textContent = "Status: " + status + " • step: " + step + " • style: " + style;
    $("progressText").textContent = "Progresso: " + done + "/" + total + " • " + msg;
    $("updatedText").textContent = p?.updatedAt ? ("Atualizado: " + String(p.updatedAt)) : "";

    const dot = $("dot");
    dot.className = "dot " + (status === "done" ? "good" : status === "failed" ? "bad" : "run");

    if (status === "failed" && err) setErr(err);

    // Preview básico
    const coverUrl = String(p?.coverUrl || "");
    const pdfUrl = String(p?.pdf || "");

    const hasAny = !!coverUrl || !!pdfUrl;
    $("preview").style.display = hasAny ? "grid" : "none";

    if (coverUrl){
      $("coverCard").style.display = "block";
      $("coverImg").src = coverUrl;
      $("coverOpen").href = coverUrl;
    } else {
      $("coverCard").style.display = "none";
    }

    if (status === "done" && pdfUrl){
      $("pdfCard").style.display = "block";
      $("pdfOpen").href = pdfUrl;
    } else {
      $("pdfCard").style.display = "none";
    }

    // Ajuste do botão start (se finalizou)
    if (status === "done") {
      $("btnStart").disabled = true;
      $("btnStop").disabled = true;
      $("btnStart").textContent = "✅ Finalizado";
    }
  }

  async function readJsonOrText(resp){
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    const txt = await resp.text();
    if (ct.includes("application/json")) {
      try { return { kind:"json", data: JSON.parse(txt || "{}") }; } catch { return { kind:"json", data: {} }; }
    }
    return { kind:"text", data: txt };
  }

  function looksLikeLoginHtml(text){
    const t = String(text || "").toLowerCase();
    return t.includes("<title>login") || t.includes("entrar / criar conta") || t.includes("sb_token") || t.includes("supabase");
  }

  async function getProgress(bookId){
    const r = await fetch("/api/progress/" + encodeURIComponent(bookId), {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });

    const parsed = await readJsonOrText(r);

    if (r.status === 401) throw new Error("Você não está logado (401). Faça login novamente.");
    if (parsed.kind === "text" && looksLikeLoginHtml(parsed.data)) {
      throw new Error("Sessão expirada. Você foi redirecionado para login. Abra /login e tente de novo.");
    }

    const j = parsed.kind === "json" ? parsed.data : {};
    if (!r.ok || !j.ok) throw new Error(j.error || ("Falha ao obter progresso (HTTP " + r.status + ")"));
    return j;
  }

  async function doNextStep(payload){
    const r = await fetch("/api/generateNext", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload || {})
    });

    // 409 = step já rodando, só esperar
    if (r.status === 409) {
      const parsed = await readJsonOrText(r);
      const j = parsed.kind === "json" ? parsed.data : {};
      return { ok:true, retry:true, note: j?.error || "busy" };
    }

    const parsed = await readJsonOrText(r);

    if (r.status === 401) throw new Error("Você não está logado (401). Faça login novamente.");
    if (parsed.kind === "text" && looksLikeLoginHtml(parsed.data)) {
      throw new Error("Sessão expirada. Você foi redirecionado para login. Abra /login e tente de novo.");
    }

    const j = parsed.kind === "json" ? parsed.data : null;
    if (!r.ok || !j || !j.ok) {
      const msg = (j && j.error) ? j.error : ("Falha no generateNext (HTTP " + r.status + ")");
      throw new Error(msg);
    }
    return { ok:true, data:j };
  }

  function stopLoop(userAction=false){
    if (loopTimer) clearTimeout(loopTimer);
    loopTimer = null;
    setRunningUI(false);
    backoffMs = 900;
    if (userAction) setErr("Pausado pelo usuário.");
  }

  async function loopGenerate(){
    const st = loadClientState();
    if (!st.bookId) { window.location.href = "/create"; return; }

    const payload = {
      id: st.bookId,
      childName: st.childName,
      childAge: st.childAge,
      childGender: st.childGender,
      theme: st.theme,
      style: st.style,
    };

    try{
      // 1 passo
      const r = await doNextStep(payload);

      if (!running) return; // se o usuário clicou "parar" durante await

      if (r.retry){
        // busy: só aguarda e tenta de novo, sem aumentar backoff
        const p = await getProgress(st.bookId).catch(()=>null);
        if (p) setUIFromProgress(p);
        loopTimer = setTimeout(loopGenerate, 1100);
        return;
      }

      const data = r.data;
      setUIFromProgress(data);
      setErr("");

      if (data.status === "done" || data.status === "failed"){
        stopLoop(false);
        // se done, UI já fica "Finalizado"
        return;
      }

      // reset backoff quando tudo ok
      backoffMs = 900;
      loopTimer = setTimeout(loopGenerate, 900);
    }catch(e){
      // Não mata a geração pra sempre: mostra erro e tenta novamente com backoff
      const msg = String(e?.message || e || "Erro");
      setErr(msg);

      if (!running) return;

      // aumenta backoff até 6s
      backoffMs = Math.min(6000, Math.round(backoffMs * 1.35));

      // tenta atualizar status (se der, atualiza UI)
      const st2 = loadClientState();
      const p = await getProgress(st2.bookId).catch(()=>null);
      if (p) setUIFromProgress(p);

      // se status veio failed/done, para
      if (p && (p.status === "done" || p.status === "failed")) {
        stopLoop(false);
        return;
      }

      loopTimer = setTimeout(loopGenerate, backoffMs);
    }
  }

  async function refreshUI(){
    const st = loadClientState();
    if (!st.bookId) { window.location.href = "/create"; return; }
    try{
      const p = await getProgress(st.bookId);
      setUIFromProgress(p);
      // limpa erro se não falhou
      if (p.status !== "failed") setErr("");
    }catch(e){
      setErr(String(e?.message || e || "Erro"));
    }
  }

  $("btnRefresh").onclick = () => refreshUI();

  $("btnStart").onclick = async () => {
    setErr("");
    await refreshUI();
    const st = loadClientState();
    if (!st.bookId) return;

    // não dispara se já finalizou
    const cur = await getProgress(st.bookId).catch(()=>null);
    if (cur && (cur.status === "done")) {
      setUIFromProgress(cur);
      return;
    }

    setRunningUI(true);
    loopGenerate();
  };

  $("btnStop").onclick = () => stopLoop(true);

  $("btnBackTop").onclick = () => { window.location.href = "/create"; };

  $("btnReset").onclick = () => {
    try{ localStorage.clear(); }catch{}
    window.location.href = "/create";
  };

  // init
  (async function init(){
    const st = loadClientState();
    if (!st.bookId) { window.location.href = "/create"; return; }
    await refreshUI();
    // não auto-retoma por segurança
  })();
</script>
</body>
</html>`);
  });
};