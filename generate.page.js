/**
 * generate.page.js — Página /generate (Step 4)
 * ✅ Vercel-safe: chama /api/generateNext em LOOP (1 passo por request).
 * ✅ AUTO-START: inicia automaticamente ao abrir /generate (sem clique).
 * ✅ BACKOFF 409: se "step já em execução", espera e tenta de novo (sem travar).
 * ✅ RETRY E003 / HIGH DEMAND: trata como erro temporário e tenta novamente com backoff.
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
    .btnMini{padding:10px 12px;font-size:13px}
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

    .diag{
      margin-top:14px;
      border:1px solid rgba(0,0,0,.10);
      background:#0b1220;
      color:#e5e7eb;
      border-radius:16px;
      padding:12px;
      box-shadow: var(--shadow2);
    }
    .diag h3{margin:0 0 10px 0;font-size:14px}
    .log{
      white-space:pre-wrap;
      font-family: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
      font-size:12px;
      line-height:1.4;
      max-height:240px;
      overflow:auto;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.12);
      border-radius:12px;
      padding:10px;
    }
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
              <button class="btn btnGhost btnMini" id="btnWhoami">👤 whoami</button>
              <button class="btn btnGhost btnMini" id="btnTest">🧪 Testar 1 passo</button>
              <button class="btn btnGhost" id="btnRefresh">🔄 Atualizar status</button>
              <button class="btn btnDanger" id="btnStop">⏸️ Parar</button>
              <button class="btn btnPrimary" id="btnStart">🚀 Iniciar geração</button>
            </div>
          </div>
          <div class="bar"><div id="barFill"></div></div>
        </div>

        <div class="hint" id="hint"></div>
        <div class="gridPreview" id="preview" style="display:none"></div>

        <div class="diag">
          <h3>🧩 Diagnóstico (últimas chamadas)</h3>
          <div class="log" id="log"></div>
        </div>
      </div>
    </div>
  </div>

<script>
  const $ = (id)=>document.getElementById(id);

  let running = false;
  let stopFlag = false;
  let inflight = false;
  let autoStarted = false;

  const logs = [];
  function addLog(line){
    const ts = new Date().toISOString();
    logs.push("[" + ts + "] " + line);
    while (logs.length > 120) logs.shift();
    $("log").textContent = logs.join("\\n");
  }

  function setHint(msg){
    const el = $("hint");
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  function goLogin(){
    const next = encodeURIComponent(location.pathname + location.search);
    addLog("↪ goLogin -> /login?next=" + next);
    window.location.href = "/login?next=" + next;
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
    if (cover) cards.push({ title: "Capa", url: cover });
    for (const it of imgs) cards.push({ title: "Página " + (it.page || "?"), url: it.url });

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
      setHint("✅ Livro pronto! Baixe o PDF em: " + location.origin + pdf);
    }
  }

  async function fetchJsonLogged(url, opts){
    const o = opts || {};
    o.credentials = "include";
    o.headers = Object.assign({ "Accept":"application/json" }, o.headers || {});
    addLog("→ " + (o.method || "GET") + " " + url);

    const r = await fetch(url, o);

    // ✅ Se o backend redirecionar (ex.: para /login)
    if (r.redirected) {
      addLog("↪ redirected to: " + r.url);
      window.location.href = r.url;
      return { status: r.status, ok: false, json: { ok:false, error:"redirected" }, raw: "" };
    }

    // ✅ Se não está logado
    if (r.status === 401) {
      addLog("↪ 401 not_logged_in");
      goLogin();
      return { status: 401, ok: false, json: { ok:false, error:"not_logged_in" }, raw: "" };
    }

    const ct = String(r.headers.get("content-type") || "");
    const text = await r.text();

    let j = {};
    if (ct.includes("application/json")) {
      try { j = JSON.parse(text || "{}"); } catch { j = {}; }
    } else {
      j = { ok:false, error: "non_json_response" };
    }

    addLog("← HTTP " + r.status + " " + url + " | ct: " + ct + " | body: " + (text ? text.slice(0, 700) : "(vazio)"));
    return { status: r.status, ok: r.ok, json: j, raw: text };
  }

  function isHighDemandError(msg){
    const s = String(msg || "");
    return /high demand/i.test(s) || /unavailable/i.test(s) || /\\(E003\\)/i.test(s);
  }

  async function apiProgress(bookId){
    const r = await fetchJsonLogged("/api/progress/" + encodeURIComponent(bookId), { method:"GET" });
    if (!r.ok) throw new Error((r.json && r.json.error) ? r.json.error : ("HTTP " + r.status));
    if (!r.json.ok) throw new Error(r.json.error || "Falha /api/progress");
    return r.json;
  }

  async function apiWhoami(){
    const r = await fetchJsonLogged("/api/whoami", { method:"GET" });
    if (!r.ok) throw new Error((r.json && r.json.error) ? r.json.error : ("HTTP " + r.status));
    if (!r.json.ok) throw new Error(r.json.error || "Falha /api/whoami");
    return r.json;
  }

  async function apiGenerateNext(payload){
    const r = await fetchJsonLogged("/api/generateNext", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload || {})
    });

    // ✅ se não logado/redirected, PARA de vez (não fica em loop infinito)
    if (r.status === 401 || (r.json && r.json.error === "not_logged_in") || (r.json && r.json.error === "redirected")) {
      throw new Error("not_logged_in");
    }

    if (r.status === 409) {
      return { ok:false, _busy:true, error:(r.json && r.json.error) ? r.json.error : "busy" };
    }

    if (!r.ok) {
      const err = (r.json && (r.json.error || r.json.message)) ? (r.json.error || r.json.message) : ("HTTP " + r.status);
      throw new Error(err);
    }

    if (!r.json || !r.json.ok) {
      throw new Error((r.json && r.json.error) ? r.json.error : "Falha /api/generateNext");
    }

    return r.json;
  }

  function applyProgressUI(p){
    const status = p?.status || "created";
    const step = p?.step || "created";
    const style = p?.style || p?.book?.style || "read";

    $("line").textContent = "Status: " + status + " | step: " + step + " | style: " + style;
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
      const err = p?.error || "erro desconhecido";
      if (isHighDemandError(err)) {
        setHint("⏳ Serviço ocupado (E003). Vou tentar novamente automaticamente…\\n" + err);
      } else {
        setHint("❌ Falhou: " + err);
      }
    }
  }

  async function refreshOnce(){
    const st = getState();
    if (!st.bookId) {
      setHint("Sem bookId. Volte em /create e crie um livro.");
      addLog("⚠️ sem bookId no localStorage");
      return null;
    }

    try {
      const p = await apiProgress(st.bookId);
      applyProgressUI(p);
      return p;
    } catch (e) {
      const msg = String(e?.message || e);

      if (msg === "not_logged_in") {
        setHint("⚠️ Sua sessão expirou. Fazendo login novamente…");
        goLogin();
        return null;
      }

      if (/book não existe/i.test(msg)) {
        stopFlag = true;
        running = false;
        uiSetDot("bad");
        setHint(
          "❌ Este bookId não existe no banco (ou não está acessível por RLS).\\n" +
          "Clique em Reiniciar e crie o livro novamente."
        );
        addLog("🛑 PARANDO: " + msg);
        return null;
      }

      throw e;
    }
  }

  function buildPayload(){
    const st = getState();
    return {
      id: st.bookId,
      childName: st.childName,
      childAge: st.childAge,
      childGender: st.childGender,
      theme: st.theme,
      style: st.style
    };
  }

  async function testOneStep(){
    setHint("");
    const st = getState();
    addLog("STATE: " + JSON.stringify(st));

    if (!st.bookId) return setHint("Sem bookId. Volte em /create e crie um livro.");
    if (!st.childName || st.childName.length < 2) return setHint("Nome da criança ausente. Volte e preencha o nome.");
    if (!st.theme) return setHint("Tema ausente. Volte e selecione um tema.");
    if (!st.style) return setHint("Estilo ausente. Volte e selecione um estilo.");

    const g = await apiGenerateNext(buildPayload());
    applyProgressUI(g);
  }

  async function startLoop(){
    setHint("");
    const st = getState();
    addLog("START LOOP | STATE: " + JSON.stringify(st));

    if (!st.bookId) return setHint("Sem bookId. Volte em /create e crie um livro.");
    if (!st.childName || st.childName.length < 2) return setHint("Nome da criança ausente. Volte e preencha o nome.");
    if (!st.theme) return setHint("Tema ausente. Volte e selecione um tema.");
    if (!st.style) return setHint("Estilo ausente. Volte e selecione um estilo.");

    running = true;
    stopFlag = false;
    uiSetDot("run");

    try {
      $("btnStart").textContent = "⏳ Gerando…";
      $("btnStart").disabled = true;
    } catch {}

    let busyBackoffMs = 900;
    let demandBackoffMs = 2500;

    while (!stopFlag) {
      if (inflight) { await new Promise(r=>setTimeout(r, 250)); continue; }
      inflight = true;

      try {
        const g = await apiGenerateNext(buildPayload());

        if (g && g._busy) {
          addLog("⏳ busy (409) — aguardando " + busyBackoffMs + "ms");
          await new Promise(r=>setTimeout(r, busyBackoffMs));
          busyBackoffMs = Math.min(2500, Math.round(busyBackoffMs * 1.25));
          continue;
        }

        // ✅ (normal)
        busyBackoffMs = 900;
        applyProgressUI(g);

        // ✅ se falhou por HIGH DEMAND, não para
        if (g.status === "failed" && isHighDemandError(g.error || g.message || "")) {
          addLog("⏳ HIGH DEMAND (E003) — aguardando " + demandBackoffMs + "ms e tentando novamente");
          await new Promise(r=>setTimeout(r, demandBackoffMs));
          demandBackoffMs = Math.min(15000, Math.round(demandBackoffMs * 1.35));
          continue;
        }

        demandBackoffMs = 2500;

        if (g.status === "done") break;
        if (g.status === "failed") break;

        await new Promise(r=>setTimeout(r, 900));
      } catch (e) {
        const msg = String(e?.message || e);
        addLog("❌ ERRO: " + msg);

        if (msg === "not_logged_in") {
          stopFlag = true;
          running = false;
          uiSetDot("");
          setHint("⚠️ Sua sessão expirou. Fazendo login novamente…");
          goLogin();
          return;
        }

        if (/book não existe/i.test(msg)) {
          stopFlag = true;
          running = false;
          uiSetDot("bad");
          setHint(
            "❌ Este bookId não existe no banco (ou não está acessível por RLS).\\n" +
            "Clique em Reiniciar e crie o livro novamente."
          );
          try { $("btnStart").textContent = "🚀 Iniciar geração"; $("btnStart").disabled = false; } catch {}
          return;
        }

        // ✅ erro temporário do provider (E003 / high demand)
        if (isHighDemandError(msg)) {
          setHint("⏳ Serviço ocupado (E003). Tentando novamente em instantes…\\n" + msg);
          addLog("⏳ HIGH DEMAND — aguardando " + demandBackoffMs + "ms");
          await new Promise(r=>setTimeout(r, demandBackoffMs));
          demandBackoffMs = Math.min(15000, Math.round(demandBackoffMs * 1.35));
          continue;
        }

        // fallback: tenta atualizar status e continua
        try { await refreshOnce(); } catch {}
        await new Promise(r=>setTimeout(r, 1400));
      } finally {
        inflight = false;
      }
    }

    running = false;
    uiSetDot("");

    try {
      $("btnStart").textContent = "🚀 Iniciar geração";
      $("btnStart").disabled = false;
    } catch {}
  }

  $("btnStart").onclick = async ()=>{ if (!running) await startLoop(); };

  $("btnStop").onclick = ()=>{
    stopFlag = true;
    running = false;
    uiSetDot("");
    addLog("STOP clicado");
    try {
      $("btnStart").textContent = "🚀 Iniciar geração";
      $("btnStart").disabled = false;
    } catch {}
  };

  $("btnRefresh").onclick = async ()=>{
    try { await refreshOnce(); }
    catch (e) { setHint(String(e?.message || e)); addLog("❌ " + String(e?.message||e)); }
  };

  $("btnWhoami").onclick = async ()=>{
    try {
      setHint("");
      const w = await apiWhoami();
      setHint("✅ Logado: " + (w.email || w.id));
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg === "not_logged_in") { setHint("⚠️ Sessão expirou. Redirecionando…"); goLogin(); return; }
      setHint("❌ whoami: " + msg);
    }
  };

  $("btnTest").onclick = async ()=>{
    try { await testOneStep(); }
    catch (e) {
      const msg = String(e?.message || e);
      if (msg === "not_logged_in") { setHint("⚠️ Sessão expirou. Redirecionando…"); goLogin(); return; }
      setHint(msg); addLog("❌ " + msg);
    }
  };

  $("btnReset").onclick = ()=>{
    localStorage.clear();
    location.href = "/create";
  };

  async function autoStartIfPossible(){
    if (autoStarted) return;
    autoStarted = true;

    await new Promise(r=>setTimeout(r, 300));

    let p = null;
    try { p = await refreshOnce(); } catch {}
    if (p && p.status === "done") return;
    if (p && p.status === "failed" && !isHighDemandError(p.error || "")) return;

    if (!running) {
      addLog("AUTO-START: iniciando geração automaticamente");
      startLoop();
    }
  }

  (async function init(){
    addLog("INIT /generate");
    try { await refreshOnce(); } catch (e) { addLog("⚠️ " + String(e?.message||e)); }
    autoStartIfPossible();
  })();
</script>
</body>
</html>`);
  });
};