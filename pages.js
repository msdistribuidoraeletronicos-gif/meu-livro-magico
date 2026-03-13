// pages.js
const fs = require("fs");
const path = require("path");
const express = require("express");
const core = require("./core");

const LANDING_HTML = path.join(__dirname, "landing.html");
const HOW_IT_WORKS_HTML = path.join(__dirname, "how-it-works.html");
const EXEMPLOS_HTML = path.join(__dirname, "exemplos.html");
const PREVIEW_HTML = path.join(__dirname, "preview.html");
const COINS_INFO_HTML = path.join(__dirname, "coins-info.html");

module.exports = function mountPages(app) {
  // Middleware para capturar referência de parceiro (cookies)
  app.use((req, res, next) => {
    if (req.query.ref) {
      res.cookie("partner_ref", req.query.ref, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      res.locals.partnerRef = req.query.ref;
    } else {
      res.locals.partnerRef = req.cookies?.partner_ref || null;
    }
    next();
  });

  // Servir arquivos estáticos de exemplos
  app.use(
    "/examples",
    express.static(path.join(__dirname, "public/examples"), {
      fallthrough: true,
    })
  );

  // ========== Páginas de parceiros (já modulares) ==========
  require("./partners.central.page.js")(app);
  require("./partners.auth.page.js")(app);
  require("./partners.fabricacao.page.js")(app);
  require("./partners.venda.page.js")(app);

  // ========== Perfil ==========
  const profileOptions = { requireAuth: core.requireAuth };
  if (core.supabaseAdmin) profileOptions.supabaseAdmin = core.supabaseAdmin;
  if (core.supabaseAuth) profileOptions.supabaseAuth = core.supabaseAuth;
  require("./profile.page.js")(app, profileOptions);

  // ========== Admin ==========
  const mountAdminPage = require("./admin.page");
  mountAdminPage(app, {
    OUT_DIR: core.OUT_DIR,
    USERS_FILE: core.USERS_FILE,
    requireAuth: core.requireAuth,
  });

  function sendHtmlFileNoCache(res, absPath) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    const html = fs.readFileSync(absPath, "utf8");
    return res.status(200).send(html);
  }

  // ========== Login ==========
  app.get("/login", async (req, res) => {
    const nextUrl = String(req.query?.next || "/create");
    const user = await core.getCurrentUser(req).catch(() => null);
    if (user) return res.redirect(nextUrl || "/create");

    res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Login — Meu Livro Mágico</title>
<style>
  :root{
    --bg1:#ede9fe; --bg2:#ffffff; --bg3:#fdf2f8;
    --text:#111827; --muted:#6b7280; --border:#e5e7eb;
    --violet:#7c3aed; --pink:#db2777;
  }
  *{box-sizing:border-box}
  body{
    margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    background: linear-gradient(to bottom, var(--bg1), var(--bg2), var(--bg3));
    min-height:100vh; display:grid; place-items:center; padding:24px;
    color:var(--text);
  }
  .card{
    width:min(520px, 100%);
    background:#fff;
    border:1px solid var(--border);
    border-radius:22px;
    box-shadow: 0 20px 50px rgba(0,0,0,.10);
    padding:18px;
  }
  h1{margin:8px 0 0; font-size:26px; font-weight:1000; text-align:center;}
  p{margin:8px 0 0; text-align:center; color:var(--muted); font-weight:800;}
  .tabs{display:flex; gap:10px; margin-top:16px;}
  .tab{
    flex:1; border:1px solid var(--border); background:#fff;
    border-radius:999px; padding:10px 12px; cursor:pointer;
    font-weight:1000; color:#374151;
  }
  .tab.active{background:linear-gradient(90deg,var(--violet),var(--pink)); color:#fff; border-color:transparent;}
  .field{margin-top:12px;}
  .label{font-weight:1000; margin:0 0 6px;}
  input{
    width:100%; border:1px solid var(--border); border-radius:14px;
    padding:12px 12px; font-size:15px; font-weight:900; outline:none;
  }
  input:focus{border-color:rgba(124,58,237,.4); box-shadow:0 0 0 4px rgba(124,58,237,.12);}
  .btn{
    width:100%; margin-top:14px;
    border:0; border-radius:999px; padding:12px 14px;
    font-weight:1000; cursor:pointer; color:#fff;
    background: linear-gradient(90deg,var(--violet),var(--pink));
    box-shadow: 0 16px 34px rgba(124,58,237,.22);
  }
  .hint{
    margin-top:12px; padding:10px 12px; border-radius:14px;
    background: rgba(219,39,119,.06);
    border: 1px solid rgba(219,39,119,.14);
    color:#7f1d1d; font-weight:900; display:none; white-space:pre-wrap;
  }
  a.link{display:block; text-align:center; margin-top:12px; color:#4c1d95; font-weight:1000; text-decoration:none;}
  a.link:hover{text-decoration:underline;}
</style>
</head>
<body>
  <div class="card">
    <h1>🔐 Entrar / Criar Conta</h1>
    <p>Para criar o livro mágico, você precisa estar logado.</p>

    <div class="tabs">
      <button class="tab active" id="tabLogin" type="button">Entrar</button>
      <button class="tab" id="tabSignup" type="button">Criar conta</button>
    </div>

    <div id="panelLogin">
      <div class="field">
        <div class="label">E-mail</div>
        <input id="loginEmail" placeholder="seu@email.com" />
      </div>
      <div class="field">
        <div class="label">Senha</div>
        <input id="loginPass" type="password" placeholder="••••••••" />
      </div>
      <button class="btn" id="btnDoLogin" type="button">Entrar</button>
    </div>

    <div id="panelSignup" style="display:none">
      <div class="field">
        <div class="label">Nome</div>
        <input id="signName" placeholder="Seu nome" />
      </div>
      <div class="field">
        <div class="label">E-mail</div>
        <input id="signEmail" placeholder="seu@email.com" />
      </div>
      <div class="field">
        <div class="label">Senha (mín. 6)</div>
        <input id="signPass" type="password" placeholder="••••••••" />
      </div>
      <button class="btn" id="btnDoSignup" type="button">Criar conta</button>
    </div>

    <div class="hint" id="hint"></div>

    <a class="link" href="/sales">← Voltar para Vendas</a>
  </div>

<script>
  const nextUrl = ${JSON.stringify(nextUrl || "/create")};

  const $ = (id) => document.getElementById(id);
  function setHint(msg){
    const el = $("hint");
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  function setTab(which){
    const isLogin = which === "login";
    $("tabLogin").classList.toggle("active", isLogin);
    $("tabSignup").classList.toggle("active", !isLogin);
    $("panelLogin").style.display = isLogin ? "block" : "none";
    $("panelSignup").style.display = isLogin ? "none" : "block";
    setHint("");
  }

  $("tabLogin").onclick = () => setTab("login");
  $("tabSignup").onclick = () => setTab("signup");

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

  $("btnDoLogin").onclick = async () => {
    setHint("");
    try{
      const email = $("loginEmail").value.trim();
      const password = $("loginPass").value;
      if (!email) return setHint("Digite o e-mail.");
      if (!password) return setHint("Digite a senha.");
      await postJson("/api/auth/login", { email, password });
      window.location.href = nextUrl || "/create";
    }catch(e){
      setHint(String(e.message || e));
    }
  };

  $("btnDoSignup").onclick = async () => {
    setHint("");
    try{
      const name = $("signName").value.trim();
      const email = $("signEmail").value.trim();
      const password = $("signPass").value;
      if (!name || name.length < 2) return setHint("Digite seu nome (mín. 2 letras).");
      if (!email) return setHint("Digite o e-mail.");
      if (!password || password.length < 6) return setHint("Senha muito curta (mín. 6).");
      await postJson("/api/auth/signup", { name, email, password });
      window.location.href = nextUrl || "/create";
    }catch(e){
      setHint(String(e.message || e));
    }
  };
</script>
</body>
</html>`);
  });

  // ========== Página de vendas (landing) ==========
  app.get("/sales", (req, res) => {
    try {
      if (fs.existsSync(LANDING_HTML)) {
        return sendHtmlFileNoCache(res, LANDING_HTML);
      }
    } catch (e) {
      console.error("[pages.js] erro ao abrir landing.html:", e);
    }

    res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Meu Livro Mágico — Vendas</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1220;color:#fff;}
  .card{max-width:820px;margin:24px;padding:24px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);}
  h1{margin:0 0 10px 0;font-size:28px;}
  p{opacity:.9;line-height:1.6;margin:0 0 14px 0;}
  a.btn{display:inline-flex;gap:10px;align-items:center;padding:12px 16px;border-radius:14px;background:#ff6b6b;color:#fff;text-decoration:none;font-weight:900;}
  .muted{opacity:.75;font-size:13px;margin-top:12px;}
</style>
</head>
<body>
  <div class="card">
    <h1>📚 Meu Livro Mágico</h1>
    <p>Gere um livro infantil personalizado com a foto da criança, história e imagens — tudo automático.</p>
    <a class="btn" href="/create">✨ Ir para o gerador</a>
    <div class="muted">Dica: crie um <code>landing.html</code> ao lado do <code>app.js</code> para personalizar.</div>
  </div>
</body>
</html>`);
  });

  // ========== Como funciona ==========
  app.get("/como-funciona", (req, res) => {
    try {
      if (fs.existsSync(HOW_IT_WORKS_HTML)) {
        return sendHtmlFileNoCache(res, HOW_IT_WORKS_HTML);
      }
    } catch (e) {
      console.error("[pages.js] erro ao abrir how-it-works.html:", e);
    }

    res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Como funciona — Meu Livro Mágico</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#ede9fe,#fff,#fdf2f8);color:#111827;}
  .card{max-width:860px;margin:24px;padding:24px;border-radius:18px;background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 20px 50px rgba(0,0,0,.10);}
  h1{margin:0 0 10px 0;font-size:28px;}
  p{opacity:.92;line-height:1.7;margin:0 0 12px 0;font-weight:700;}
  ul{margin:10px 0 0; padding-left:18px; line-height:1.7; font-weight:800;}
  a.btn{display:inline-flex;gap:10px;align-items:center;padding:12px 16px;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff;text-decoration:none;font-weight:1000;}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}
  .muted{opacity:.7;font-size:12px;margin-top:10px;font-weight:800;}
  code{background:rgba(0,0,0,.06);padding:2px 6px;border-radius:8px}
</style>
</head>
<body>
  <div class="card">
    <h1>✨ Como funciona</h1>
    <p>Você envia a foto da criança, escolhe o tema e o estilo do livro.</p>
    <ul>
      <li>1) Envie a foto</li>
      <li>2) Informe nome/idade e escolha o tema</li>
      <li>3) O sistema cria a história (texto) e gera as imagens uma por vez</li>
      <li>4) O texto é carimbado dentro do PNG e no final sai um PDF</li>
    </ul>

    <div class="row">
      <a class="btn" href="/sales">🛒 Voltar para Vendas</a>
      <a class="btn" href="/create">📚 Ir para o Gerador</a>
    </div>

    <div class="muted">
      Dica: crie um arquivo <code>how-it-works.html</code> ao lado do <code>app.js</code> para personalizar esta página.
    </div>
  </div>
</body>
</html>`);
  });

  // ========== Página explicativa das moedas ==========
  app.get("/coins-info", (req, res) => {
    try {
      if (fs.existsSync(COINS_INFO_HTML)) {
        return sendHtmlFileNoCache(res, COINS_INFO_HTML);
      }
    } catch (e) {
      console.error("[pages.js] erro ao abrir coins-info.html:", e);
    }

    return res.status(200).type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Moedas — Meu Livro Mágico</title>
<style>
  body{
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    margin:0;
    min-height:100vh;
    display:grid;
    place-items:center;
    background:linear-gradient(180deg,#ede9fe,#fff,#fdf2f8);
    color:#111827;
  }
  .card{
    max-width:860px;
    margin:24px;
    padding:24px;
    border-radius:18px;
    background:#fff;
    border:1px solid rgba(0,0,0,.08);
    box-shadow:0 20px 50px rgba(0,0,0,.10);
  }
  h1{margin:0 0 10px 0;font-size:28px;}
  p{opacity:.92;line-height:1.7;margin:0 0 12px 0;font-weight:700;}
  ul{margin:10px 0 0; padding-left:18px; line-height:1.7; font-weight:800;}
  a.btn{
    display:inline-flex;
    gap:10px;
    align-items:center;
    padding:12px 16px;
    border-radius:999px;
    background:linear-gradient(90deg,#f59e0b,#f97316);
    color:#fff;
    text-decoration:none;
    font-weight:1000;
  }
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}
  .muted{opacity:.7;font-size:12px;margin-top:10px;font-weight:800;}
  code{background:rgba(0,0,0,.06);padding:2px 6px;border-radius:8px}
</style>
</head>
<body>
  <div class="card">
    <h1>🪙 Para que servem as moedas</h1>
    <p>As moedas organizam o saldo e as recompensas da sua carteira dentro da plataforma.</p>
    <ul>
      <li>1) Você pode ganhar moedas por pedidos válidos</li>
      <li>2) Você pode receber moedas no check-in diário</li>
      <li>3) Você pode comprar pacotes de moedas</li>
      <li>4) Você acompanha tudo na sua carteira do perfil</li>
      <li>5) Pode solicitar saque do saldo disponível</li>
    </ul>

    <div class="row">
      <a class="btn" href="/profile">🪙 Ir para minha carteira</a>
      <a class="btn" href="/create">✨ Criar livro</a>
    </div>

    <div class="muted">
      Dica: crie um arquivo <code>coins-info.html</code> ao lado do <code>app.js</code> para personalizar esta página.
    </div>
  </div>
</body>
</html>`);
  });

  // ========== Exemplos ==========
  app.get("/exemplos", (req, res) => {
    try {
      if (fs.existsSync(EXEMPLOS_HTML)) {
        return sendHtmlFileNoCache(res, EXEMPLOS_HTML);
      }
    } catch (e) {
      console.error("[pages.js] erro ao abrir exemplos.html:", e);
    }

    res.status(404).type("html").send(`
      <h1>exemplos.html não encontrado</h1>
      <p>Coloque um arquivo <code>exemplos.html</code> ao lado do <code>app.js</code>.</p>
      <p><a href="/sales">Voltar</a></p>
    `);
  });

  // ========== Gerador (páginas protegidas) ==========
  app.get("/", core.requireAuth, (req, res) => renderGeneratorHtml(req, res));
  app.get("/create", core.requireAuth, (req, res) => renderGeneratorHtml(req, res));

  function renderGeneratorHtml(req, res) {
    const imageInfo =
      core.IMAGE_PROVIDER === "replicate"
        ? `Replicate: <span class="mono">${core.escapeHtml(
            core.REPLICATE_MODEL
          )}</span>`
        : `OpenAI (fallback): <span class="mono">${core.escapeHtml(
            core.IMAGE_MODEL
          )}</span>`;

    res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Meu Livro Mágico — Criar</title>
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
    --disabled:#e5e7eb;
    --disabledText:#9ca3af;
  }
  *{box-sizing:border-box}
  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    color:var(--text);
    background: linear-gradient(to bottom, var(--bg1), var(--bg2), var(--bg3));
    min-height:100vh;
    padding-bottom:110px;
  }
  .container{max-width: 980px; margin:0 auto; padding: 24px 16px;}
  .topRow{
    display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
    margin-bottom: 16px;
  }
  .topActions{display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:flex-end;}
  .pill{
    background: rgba(124,58,237,.10);
    color: #4c1d95;
    border:1px solid rgba(124,58,237,.16);
    padding:6px 10px;
    border-radius:999px;
    font-weight:900;
    text-decoration:none;
    cursor:pointer;
  }
  .pill:hover{filter:brightness(1.05)}
  .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }

  .stepper{display:flex; align-items:center; justify-content:center; gap: 10px; flex-wrap:wrap; margin: 10px 0 22px;}
  .stepItem{ display:flex; flex-direction:column; align-items:center; gap:8px; }
  .stepDot{
    width:40px; height:40px; border-radius:999px;
    display:grid; place-items:center;
    font-weight:1000; font-size:14px;
    transition: transform .2s ease;
    border: 1px solid rgba(0,0,0,.06);
  }
  .stepDot.done{ background: linear-gradient(135deg,#34d399,#10b981); color:#fff; border-color:transparent;}
  .stepDot.active{ background: linear-gradient(135deg,var(--violet),var(--pink)); color:#fff; border-color:transparent; box-shadow: 0 10px 24px rgba(124,58,237,.25); transform: scale(1.08); }
  .stepDot.todo{ background:#e5e7eb; color:#9ca3af; }
  .stepLabel{ font-size:12px; font-weight:900; color:#9ca3af; display:none; }
  @media (min-width: 640px){ .stepLabel{ display:block; } }
  .stepLabel.active{ color: var(--violet); }
  .stepLine{width: 56px; height: 6px; border-radius:999px; background:#e5e7eb;}
  @media (min-width: 768px){ .stepLine{ width: 90px; } }
  .stepLine.done{ background: linear-gradient(90deg,#34d399,#10b981); }

  .card{
    background: var(--card);
    border:1px solid var(--border);
    border-radius: 26px;
    box-shadow: var(--shadow);
    padding: 18px;
  }
  .head{text-align:center; padding: 14px 10px 6px;}
  .head h1{ margin:0; font-size: 26px; font-weight:1000; }
  .head p{ margin:8px 0 0; color: var(--muted); font-weight:800; }

  .panel{ margin-top: 12px; display:none; animation: fadeIn .18s ease; }
  .panel.active{ display:block; }
  @keyframes fadeIn{ from{opacity:0; transform: translateX(10px)} to{opacity:1; transform: translateX(0)} }

  .drop{
    border:2px dashed rgba(124,58,237,.35);
    border-radius: 18px;
    padding: 26px 16px;
    text-align:center;
    cursor:pointer;
    background: rgba(124,58,237,.04);
    box-shadow: var(--shadow2);
  }
  .drop.drag{ border-color: rgba(219,39,119,.55); background: rgba(219,39,119,.04); }
  .drop .big{ font-size: 40px; }
  .drop .t{ font-weight:1000; font-size:18px; margin-top:10px; }
  .drop .s{ color: var(--muted); font-weight:800; margin-top:6px; }

  .twoCol{
    margin-top: 16px;
    display:grid;
    grid-template-columns: 180px 1fr;
    gap: 14px;
    align-items:center;
  }
  @media (max-width: 640px){ .twoCol{ grid-template-columns:1fr; } }

  .previewWrap{ display:grid; place-items:center; }
  .previewImg{
    width:160px; height:160px; border-radius:999px;
    object-fit:cover;
    border: 6px solid rgba(250,204,21,.65);
    box-shadow: var(--shadow2);
    display:none;
    background:#fff;
  }
  .previewEmpty{
    width:160px; height:160px; border-radius:999px;
    background: rgba(0,0,0,.04);
    display:grid; place-items:center;
    font-size: 42px;
  }

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

  .field{ margin-top: 14px; }
  .label{ font-weight:1000; margin-bottom:8px; }
  .input,.select{
    width:100%;
    border:1px solid var(--border);
    border-radius: 16px;
    padding: 14px 14px;
    font-size: 16px;
    font-weight:900;
    outline:none;
    background:#fff;
  }
  .input:focus,.select:focus{ border-color: rgba(124,58,237,.4); box-shadow: 0 0 0 4px rgba(124,58,237,.12); }

  .rangeMeta{display:flex; justify-content:space-between; color: var(--muted); font-weight:900; margin-top: 8px; font-size: 12px;}

  .grid3{display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 10px;}
  @media (max-width: 900px){ .grid3{ grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 520px){ .grid3{ grid-template-columns: 1fr; } }

  .pick{
    border:1px solid var(--border);
    border-radius: 18px;
    padding: 14px;
    background:#fff;
    cursor:pointer;
    box-shadow: var(--shadow2);
    text-align:left;
    transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
  }
  .pick:active{ transform: translateY(1px); }
  .pick.active{
    border-color: rgba(124,58,237,.45);
    box-shadow: 0 16px 40px rgba(124,58,237,.18);
    outline: 3px solid rgba(124,58,237,.16);
  }
  .pick .ico{ font-size: 34px; }
  .pick .tt{ margin-top: 10px; font-weight:1000; font-size: 18px; }
  .pick .dd{ margin-top: 6px; color: var(--muted); font-weight:800; }

  .footer{
    position: fixed;
    left:0; right:0; bottom:0;
    background: rgba(255,255,255,.82);
    backdrop-filter: blur(12px);
    border-top: 1px solid rgba(0,0,0,.06);
    padding: 14px 16px;
  }
  .footerInner{
    max-width: 980px; margin:0 auto;
    display:flex; justify-content:space-between; align-items:center; gap:10px;
  }
  .btn{
    border:0; cursor:pointer;
    border-radius: 999px;
    padding: 12px 18px;
    font-weight:1000;
    display:inline-flex;
    align-items:center;
    gap:10px;
    user-select:none;
  }
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
</style>
</head>

<body>
  <div class="container">
    <div class="topRow">
      <div class="topActions">
        <a class="pill" href="/sales">🛒 Pagina Inicial</a>
        <a class="pill" href="/books">📚 Meus Livros</a>
        <a class="pill" href="/como-funciona">❓ Como funciona</a>
        <a class="pill" href="/coins-info">🪙 Para que servem as moedas</a>
        <button class="pill" id="btnReset" style="cursor:pointer" type="button">♻️ Reiniciar</button>
        <button class="pill" id="btnProfile" style="cursor:pointer" type="button">👤 Perfil</button>
        <button class="pill" id="btnLogout" style="cursor:pointer" type="button">🚪 Sair</button>
      </div>
    </div>

    <div style="text-align:center;font-weight:900;color:#6b7280;margin:10px 0 18px;">${imageInfo}</div>

    <div class="stepper" id="stepper"></div>

    <div class="card">
      <div class="head">
        <h1 id="stepTitle">Foto Mágica</h1>
        <p id="stepSub">Envie uma foto da criança</p>
      </div>

      <div class="panel active" id="panel0">
        <div class="drop" id="drop">
          <div class="big">📸</div>
          <div class="t">Clique ou arraste uma foto aqui</div>
          <div class="s">JPG/PNG até 10MB</div>
          <input type="file" accept="image/*" id="file" style="display:none"/>
        </div>

        <div class="twoCol">
          <div class="previewWrap">
            <img id="photoPreview" class="previewImg" alt="preview"/>
            <div id="photoEmpty" class="previewEmpty">🙂</div>
          </div>
          <div>
            <div class="label">Dicas</div>
            <ul style="margin:0; padding-left:18px; line-height:1.7; font-weight:900; color:#374151;">
              <li>Rosto bem iluminado</li>
              <li>Evite fundo muito poluído</li>
              <li>Evite óculos escuros</li>
              <li>✅ Texto vai dentro do PNG</li>
            </ul>
            <div id="hintPhoto" class="hint"></div>
          </div>
        </div>
      </div>

      <div class="panel" id="panel1">
        <div class="field">
          <div class="label">Nome</div>
          <input class="input" id="childName" placeholder="Ex: João, Maria..." />
        </div>

        <div class="field">
          <div class="label">Idade: <span id="ageLabel">6</span> anos</div>
          <div class="rangeRow">
            <input type="range" min="2" max="12" value="6" id="childAge" style="width:100%"/>
            <div class="rangeMeta"><span>2</span><span>12</span></div>
          </div>
        </div>

        <div class="field">
          <div class="label">Gênero do texto</div>
          <select class="select" id="childGender">
            <option value="neutral">Neutro 🌟</option>
            <option value="boy">Menino 👦</option>
            <option value="girl">Menina 👧</option>
          </select>
        </div>
      </div>

      <div class="panel" id="panel2">
        <div class="field">
          <div class="label">Tema</div>
          <div class="grid3">
            <button class="pick" data-theme="space" type="button"><div class="ico">🚀</div><div class="tt">Viagem Espacial</div><div class="dd">Explore planetas e mistérios.</div></button>
            <button class="pick" data-theme="dragon" type="button"><div class="ico">🐉</div><div class="tt">Reino dos Dragões</div><div class="dd">Mundo medieval mágico.</div></button>
            <button class="pick" data-theme="ocean" type="button"><div class="ico">🧜‍♀️</div><div class="tt">Fundo do Mar</div><div class="dd">Tesouros e amigos marinhos.</div></button>
            <button class="pick" data-theme="jungle" type="button"><div class="ico">🦁</div><div class="tt">Safari na Selva</div><div class="dd">Aventura com animais.</div></button>
            <button class="pick" data-theme="superhero" type="button"><div class="ico">🦸</div><div class="tt">Super Herói</div><div class="dd">Salvar o dia com poderes.</div></button>
            <button class="pick" data-theme="dinosaur" type="button"><div class="ico">🦕</div><div class="tt">Dinossauros</div><div class="dd">Uma jornada jurássica.</div></button>
          </div>
        </div>

        <div class="field">
          <div class="label">Estilo do livro</div>
          <div class="grid3">
            <button class="pick styleBtn" data-style="read" type="button">
              <div class="ico">📖</div><div class="tt">Livro para leitura</div><div class="dd">Ilustrações coloridas (semi-realista).</div>
            </button>
            <button class="pick styleBtn" data-style="color" type="button">
              <div class="ico">🖍️</div><div class="tt">Leitura + colorir</div><div class="dd">Preto e branco (contornos).</div>
            </button>
          </div>
        </div>

        <div class="field">
          <label style="display:flex; gap:10px; align-items:flex-start; cursor:pointer;">
            <input type="checkbox" id="consent"/>
            <div>
              <div style="font-weight:1000">Autorização</div>
              <div style="color:var(--muted); font-weight:900; margin-top:4px;">
                Confirmo que tenho autorização para usar a foto da criança para gerar este livro.
              </div>
            </div>
          </label>
        </div>

        <div id="hintGen" class="hint"></div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footerInner">
      <button class="btn" id="btnBack" style="background:transparent;color:#6b7280;font-weight:1000;" type="button">← Voltar</button>
      <button class="btn btnPrimary" id="btnNext" type="button">Próximo →</button>
    </div>
  </div>

<script>
  const steps = [
    { id: "photo",   title: "Foto Mágica",        sub: "Envie uma foto da criança" },
    { id: "profile", title: "Quem é o Herói?",    sub: "Conte-nos sobre a criança" },
    { id: "theme",   title: "Escolha a Aventura", sub: "Selecione o tema e estilo" }
  ];

  const state = {
    currentStep: Number(localStorage.getItem("currentStep") || "0"),
    bookId: localStorage.getItem("bookId") || "",
    photo: localStorage.getItem("photo") || "",
    mask: localStorage.getItem("mask") || "",
    theme: localStorage.getItem("theme") || "",
    style: localStorage.getItem("style") || "read",
    childName: localStorage.getItem("childName") || "",
    childAge: Number(localStorage.getItem("childAge") || "6"),
    childGender: localStorage.getItem("childGender") || "neutral",
    consent: localStorage.getItem("consent") === "1",
  };

  const $ = (id) => document.getElementById(id);

  document.getElementById('btnProfile')?.addEventListener('click', () => {
    window.location.href = '/profile';
  });

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/sales';
    } catch (e) {
      alert('Erro ao sair');
    }
  });

  function setHint(el, msg) {
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  function showPhoto(dataUrl) {
    const img = $("photoPreview");
    const empty = $("photoEmpty");
    if (dataUrl) {
      img.src = dataUrl;
      img.style.display = "block";
      empty.style.display = "none";
    } else {
      img.style.display = "none";
      empty.style.display = "grid";
    }
  }

  function buildStepper() {
    const root = $("stepper");
    root.innerHTML = "";

    for (let i = 0; i < steps.length; i++) {
      const item = document.createElement("div");
      item.className = "stepItem";

      const dot = document.createElement("div");
      dot.className = "stepDot " + (i < state.currentStep ? "done" : i === state.currentStep ? "active" : "todo");
      dot.textContent = i < state.currentStep ? "✓" : String(i + 1);

      const lbl = document.createElement("div");
      lbl.className = "stepLabel " + (i === state.currentStep ? "active" : "");
      lbl.textContent = steps[i].title;

      item.appendChild(dot);
      item.appendChild(lbl);
      root.appendChild(item);

      if (i !== steps.length - 1) {
        const line = document.createElement("div");
        line.className = "stepLine " + (i < state.currentStep ? "done" : "");
        root.appendChild(line);
      }
    }
  }

  function canProceedStep(step) {
    if (step === 0) return !!state.photo;
    if (step === 1) return !!(state.childName && state.childName.trim().length >= 2 && state.childAge);
    if (step === 2) return !!(state.theme && state.style && state.consent);
    return false;
  }

  function setStepUI() {
    localStorage.setItem("currentStep", String(state.currentStep));
    buildStepper();

    $("stepTitle").textContent = steps[state.currentStep].title;
    $("stepSub").textContent = steps[state.currentStep].sub;

    for (let i = 0; i < steps.length; i++) {
      $("panel" + i).classList.toggle("active", i === state.currentStep);
    }

    $("btnBack").disabled = state.currentStep === 0;

    const next = $("btnNext");
    next.textContent = (state.currentStep === 2) ? "✨ Criar Livro Mágico" : "Próximo →";
    next.disabled = !canProceedStep(state.currentStep);
  }

  function selectTheme(themeKey) {
    state.theme = themeKey || "";
    localStorage.setItem("theme", state.theme);
    document.querySelectorAll("[data-theme]").forEach(b => {
      const active = b.getAttribute("data-theme") === state.theme;
      b.classList.toggle("active", active);
    });
    setStepUI();
  }

  function selectStyle(styleKey) {
    state.style = styleKey || "read";
    localStorage.setItem("style", state.style);
    document.querySelectorAll(".styleBtn").forEach(b => {
      const active = b.getAttribute("data-style") === state.style;
      b.classList.toggle("active", active);
    });
    setStepUI();
  }

  async function ensureBook() {
    if (state.bookId) {
      try {
        const rr = await fetch("/api/status/" + encodeURIComponent(state.bookId), { method: "GET" });
        if (rr.ok) {
          const jj = await rr.json().catch(()=> ({}));
          if (jj && jj.ok) return state.bookId;
        }
        state.bookId = "";
        localStorage.removeItem("bookId");
      } catch {
        state.bookId = "";
        localStorage.removeItem("bookId");
      }
    }

    const r = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok || !j.id) throw new Error(j.error || "Falha ao criar book");

    state.bookId = j.id;
    localStorage.setItem("bookId", state.bookId);
    return state.bookId;
  }

  async function apiUploadPhotoAndMask() {
    if (!state.photo) throw new Error("Sem foto");
    if (!state.mask) throw new Error("Sem mask");

    await ensureBook();
    if (!state.bookId) throw new Error("Sem bookId");

    const r = await fetch("/api/uploadPhoto", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ id: state.bookId, photo: state.photo, mask: state.mask })
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Falha ao enviar foto/mask");
    return true;
  }

  function canGenerateWhy() {
    if (!state.photo) return "Envie a foto primeiro.";
    if (!state.mask) return "Mask não gerou. Reenvie a foto.";
    if (!state.childName || state.childName.trim().length < 2) return "Digite o nome (mínimo 2 letras).";
    if (!state.consent) return "Marque a autorização para continuar.";
    if (!state.theme) return "Selecione um tema.";
    if (!state.style) return "Selecione o estilo do livro.";
    return "";
  }

  async function goGenerate() {
    setHint($("hintGen"), "");
    const why = canGenerateWhy();
    if (why) { setHint($("hintGen"), why); return; }

    await ensureBook();
    await apiUploadPhotoAndMask();

    const r = await fetch("/api/generate", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        id: state.bookId,
        childName: state.childName.trim(),
        childAge: state.childAge,
        childGender: state.childGender,
        theme: state.theme,
        style: state.style,
        city: state.city || ""
      })
    });
    const j = await r.json().catch(()=> ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Falha ao iniciar geração");

    window.location.href = "/generate?id=" + encodeURIComponent(state.bookId);
  }

  const drop = $("drop");
  const file = $("file");

  drop.addEventListener("click", () => file.click());
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault(); drop.classList.remove("drag");
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  file.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  });

  async function handleFile(f) {
    const hintPhoto = $("hintPhoto");
    if (!f.type || !f.type.startsWith("image/")) return setHint(hintPhoto, "Envie apenas imagens (JPG/PNG).");
    if (f.size > 10 * 1024 * 1024) return setHint(hintPhoto, "Imagem muito grande. Máximo 10MB.");
    setHint(hintPhoto, "");

    const imgUrl = URL.createObjectURL(f);
    const img = new Image();

    img.onload = async () => {
      try {
        const max = 1024;
        let w = img.width, h = img.height;
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const photoPng = canvas.toDataURL("image/png");

        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = w;
        maskCanvas.height = h;
        const maskPng = maskCanvas.toDataURL("image/png");

        URL.revokeObjectURL(imgUrl);

        state.photo = photoPng;
        state.mask = maskPng;
        localStorage.setItem("photo", photoPng);
        localStorage.setItem("mask", maskPng);
        showPhoto(photoPng);

        await ensureBook();
        await apiUploadPhotoAndMask();

        setStepUI();
      } catch (err) {
        setHint(hintPhoto, String(err.message || err || "Erro ao processar/enviar foto"));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(imgUrl);
      setHint($("hintPhoto"), "Falha ao abrir a imagem.");
    };

    img.src = imgUrl;
  }

  document.querySelectorAll("[data-theme]").forEach(btn => {
    btn.addEventListener("click", () => selectTheme(btn.getAttribute("data-theme")));
  });
  document.querySelectorAll(".styleBtn").forEach(btn => {
    btn.addEventListener("click", () => selectStyle(btn.getAttribute("data-style")));
  });

  $("childName").addEventListener("input", (e) => {
    state.childName = e.target.value;
    localStorage.setItem("childName", state.childName);
    setStepUI();
  });
  $("childAge").addEventListener("input", (e) => {
    state.childAge = Number(e.target.value || "6");
    $("ageLabel").textContent = String(state.childAge);
    localStorage.setItem("childAge", String(state.childAge));
    setStepUI();
  });
  $("childGender").addEventListener("change", (e) => {
    state.childGender = e.target.value;
    localStorage.setItem("childGender", state.childGender);
  });
  $("consent").addEventListener("change", (e) => {
    state.consent = !!e.target.checked;
    localStorage.setItem("consent", state.consent ? "1" : "0");
    setStepUI();
  });

  $("btnBack").addEventListener("click", () => {
    if (state.currentStep <= 0) return;
    state.currentStep -= 1;
    setStepUI();
  });

  $("btnNext").addEventListener("click", async () => {
    if (state.currentStep === 0) {
      if (!canProceedStep(0)) return;
      state.currentStep = 1;
      setStepUI();
      return;
    }
    if (state.currentStep === 1) {
      if (!canProceedStep(1)) return;
      state.currentStep = 2;
      setStepUI();
      return;
    }
    if (state.currentStep === 2) {
      if (!canProceedStep(2)) return;
      try {
        await goGenerate();
      } catch (e) {
        setHint($("hintGen"), String(e.message || e));
      }
    }
  });

  $("btnReset").addEventListener("click", () => {
    localStorage.clear();
    location.reload();
  });

  (function init(){
    showPhoto(state.photo);
    $("childName").value = state.childName;
    $("childAge").value = String(state.childAge);
    $("ageLabel").textContent = String(state.childAge);
    $("childGender").value = state.childGender;
    $("consent").checked = state.consent;

    if (state.theme) selectTheme(state.theme);
    selectStyle(state.style || "read");

    if (state.currentStep < 0 || state.currentStep > 2) state.currentStep = 0;
    setStepUI();
  })();
</script>
</body>
</html>`);
  }

  // ========== Página de geração em andamento ==========
  app.get("/generate", core.requireAuth, async (req, res) => {
    const bookId = String(req.query?.id || "").trim();

    res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Gerando… — Meu Livro Mágico</title>
<style>
  :root{--bg1:#ede9fe;--bg2:#fff;--bg3:#fdf2f8;--text:#111827;--muted:#6b7280;--violet:#7c3aed;--pink:#db2777;--border:#e5e7eb}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:linear-gradient(180deg,var(--bg1),var(--bg2),var(--bg3));min-height:100vh;color:var(--text)}
  .wrap{max-width:980px;margin:0 auto;padding:24px 16px}
  .card{background:#fff;border:1px solid var(--border);border-radius:22px;box-shadow:0 20px 50px rgba(0,0,0,.10);padding:18px}
  .row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between}
  h1{margin:0;font-size:22px;font-weight:1000}
  .muted{color:var(--muted);font-weight:900}
  .bar{height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-top:12px}
  .bar > div{height:100%;width:0%;background:linear-gradient(90deg,var(--violet),var(--pink));transition:width .2s ease}
  .log{margin-top:12px;padding:12px;border-radius:14px;background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.14);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;white-space:pre-wrap}
  .imgs{margin-top:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  @media(max-width:860px){.imgs{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:520px){.imgs{grid-template-columns:1fr}}
  .imgCard{border:1px solid var(--border);border-radius:16px;overflow:hidden;background:#fff}
  .imgCard img{width:100%;display:block}
  .btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
  a.btn, button.btn{display:inline-flex;align-items:center;gap:10px;padding:12px 14px;border-radius:999px;text-decoration:none;font-weight:1000;border:none;cursor:pointer}
  a.primary{background:linear-gradient(90deg,var(--violet),var(--pink));color:#fff}
  a.ghost, button.ghost{background:transparent;color:#374151;border:1px solid rgba(0,0,0,.08)}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="row">
      <div>
        <h1>⏳ Gerando seu livro…</h1>
        <div class="muted" id="sub">Preparando…</div>
      </div>
      <div class="muted" id="meta">—</div>
    </div>
    <div class="bar"><div id="barFill"></div></div>
    <div class="log" id="log">Iniciando…</div>

    <div class="imgs" id="imgs"></div>

    <div class="btns">
      <button class="btn ghost" id="btnLogout" type="button">🚪 Sair</button>
      <a class="btn ghost" href="/create">← Voltar</a>
      <a class="btn ghost" href="/books">📚 Meus Livros</a>
      <a class="btn primary" id="pdfBtn" href="#" style="display:none">⬇️ Baixar PDF</a>
    </div>
  </div>
</div>

<script>
  const bookId = ${JSON.stringify(bookId || "")};

  const $ = (id) => document.getElementById(id);
  function setLog(s){ $("log").textContent = String(s||""); }
  function setSub(s){ $("sub").textContent = String(s||""); }
  function setMeta(s){ $("meta").textContent = String(s||""); }
  function setBar(p){ $("barFill").style.width = Math.max(0, Math.min(100, p)) + "%"; }

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/sales';
    } catch (e) {
      alert('Erro ao sair');
    }
  });

  function renderImages(coverUrl, images){
    const root = $("imgs");
    root.innerHTML = "";
    const items = [];
    if (coverUrl) items.push({ label: "Capa", url: coverUrl });
    (images||[]).forEach(it => { if (it && it.url) items.push({ label: "Pág. " + it.page, url: it.url }); });
    for (const it of items){
      const div = document.createElement("div");
      div.className = "imgCard";
      div.innerHTML = '<img alt="' + it.label + '" src="' + it.url + '"/>';
      root.appendChild(div);
    }
  }

  async function tick() {
    if (!bookId) {
      setLog("Sem id. Volte ao /create e gere novamente.");
      return;
    }

    try {
      const genRes = await fetch("/api/generateNext", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bookId })
      });
      const genData = await genRes.json().catch(() => ({}));

      if (genData.nextTryAt && genData.nextTryAt > Date.now()) {
        const waitMs = genData.nextTryAt - Date.now();
        setSub(\`⏳ Aguardando \${Math.round(waitMs / 1000)}s para nova tentativa...\`);
        setLog(genData.message || "Limitação de taxa. Aguardando...");
        setTimeout(tick, waitMs + 500);
        return;
      }

      const r = await fetch("/api/status/" + encodeURIComponent(bookId));
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "Falha ao ler status");

      setMeta("status=" + j.status + " • step=" + j.step);
      setSub(j.error ? ("Erro: " + j.error) : "Gerando…");
      renderImages(j.coverUrl, j.images);

      let p = 5;
      if (String(j.step || "").startsWith("story")) p = 20;
      if (String(j.step || "") === "cover") p = 35;
      if (String(j.step || "").startsWith("image_")) p = 35 + (Number(String(j.step).split("_")[1] || "0") * 6);
      if (String(j.step || "") === "pdf") p = 92;
      if (String(j.step || "") === "done" || j.status === "done") p = 100;
      setBar(p);

      if (j.status === "done" && j.pdf) {
        setSub("✅ Pronto! Abrindo o preview…");
        const pdfBtn = $("pdfBtn");
        pdfBtn.style.display = "inline-flex";
        pdfBtn.href = j.pdf;
        setLog("Finalizado. Abrindo preview do livro…");

        setTimeout(() => {
          window.location.href = "/preview?id=" + encodeURIComponent(bookId);
        }, 650);
        return;
      }

      if (j.status === "failed") {
        setSub("❌ Falhou");
        setLog(j.error || "Falhou");
        return;
      }

      setLog("Gerando próximo passo…");
      setTimeout(tick, 1400);
    } catch (e) {
      setSub("Erro");
      setLog(String(e.message || e));
      setTimeout(tick, 2500);
    }
  }

  tick();
</script>
</body>
</html>`);
  });

  // ========== Preview do livro (redireciona para o preview novo) ==========
  app.get("/preview", core.requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");
      if (!userId) {
        return res.redirect(
          "/login?next=" + encodeURIComponent(req.originalUrl || "/books")
        );
      }

      const id = String(req.query?.id || "").trim();
      if (!id) {
        return res
          .status(400)
          .type("html")
          .send("<h1>ID ausente</h1><p>Use /preview?id=...</p>");
      }

      const m = await core.loadManifestAsViewer(userId, id, req.user);
      if (!m) {
        return res.status(404).type("html").send("<h1>Livro não encontrado</h1>");
      }

      if (!core.canAccessBook(userId, m, req.user)) {
        return res.status(403).type("html").send("<h1>Forbidden</h1>");
      }

      if (m.status !== "done") {
        return res.redirect("/generate?id=" + encodeURIComponent(id));
      }

      if (fs.existsSync(PREVIEW_HTML)) {
        return sendHtmlFileNoCache(res, PREVIEW_HTML);
      }

      return res.redirect("/books/" + encodeURIComponent(id));
    } catch (e) {
      res.status(500).type("html").send(
        "<h1>Erro no preview</h1><pre>" +
          core.escapeHtml(String(e?.message || e || "Erro")) +
          "</pre>"
      );
    }
  });

  // ========== Galeria de livros (rota em módulo separado) ==========
  const mountBooksRoutes = require("./books/routes.js");
  mountBooksRoutes(app, {
    OUT_DIR: core.OUT_DIR,
    USERS_DIR: core.USERS_DIR,
    requireAuth: core.requireAuth,
    supabaseAdmin: core.supabaseAdmin,
  });
};