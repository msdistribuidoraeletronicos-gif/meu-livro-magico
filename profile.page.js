/**
 * profile.page.js — Página /profile (Perfil do usuário)
 *
 * ✅ Rotas:
 *   GET  /profile          (UI)
 *   GET  /api/me           (JSON: usuário + profile)
 *   GET  /api/my-books     (JSON: livros do usuário = "compras" via RLS)
 *
 * Requer:
 * - app.js deve passar { requireAuth }
 * - requireAuth precisa setar:
 *    req.user = { id, email }
 *    req.sb = supabaseUserClient(token) (RLS ON)
 */

"use strict";

module.exports = function mountProfilePage(app, { requireAuth }) {
  if (!app) throw new Error("mountProfilePage: app ausente");
  if (typeof requireAuth !== "function") throw new Error("mountProfilePage: requireAuth ausente");

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ------------------------------
  // API: /api/me
  // ------------------------------
  app.get("/api/me", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");
      const email = String(req.user?.email || "");
      if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

      let profile = null;

      if (req.sb) {
        const { data, error } = await req.sb
          .from("profiles")
          .select("id,name,created_at,updated_at")
          .eq("id", userId)
          .maybeSingle();

        if (!error && data) profile = data;
      }

      return res.json({
        ok: true,
        user: { id: userId, email },
        profile,
        server_time: new Date().toISOString(),
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  // ------------------------------
  // API: /api/my-books  (suas "compras")
  // ------------------------------
  app.get("/api/my-books", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");
      if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });
      if (!req.sb) return res.status(500).json({ ok: false, error: "supabase_client_missing" });

      const { data, error } = await req.sb
        .from("books")
        .select("id,status,step,error,theme,style,child_name,child_age,child_gender,pdf_url,updated_at,created_at")
        .order("updated_at", { ascending: false })
        .limit(120);

      if (error) throw error;

      return res.json({
        ok: true,
        items: Array.isArray(data) ? data : [],
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  // ------------------------------
  // UI: /profile
  // ------------------------------
  app.get("/profile", requireAuth, async (req, res) => {
    const email = escapeHtml(req.user?.email || "");

    res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Perfil — Meu Livro Mágico</title>
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

    /* Confiança / Calmaria (azul) */
    --blue:#2563eb;
    --blue2:#1d4ed8;

    /* Seu tema atual */
    --violet:#7c3aed;
    --pink:#db2777;

    --green:#10b981;

    /* Urgência / alerta (vermelho) */
    --red:#ef4444;
    --orange:#f97316;

    --ring: rgba(37,99,235,.15);

    /* Vibração (gamificação / destaque) */
    --amber:#f59e0b;
    --amber2:#fbbf24;
  }

  *{box-sizing:border-box}
  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    color:var(--text);
    background: linear-gradient(to bottom, var(--bg1), var(--bg2), var(--bg3));
    min-height:100vh;
    padding-bottom:70px;
  }

  .container{max-width: 980px; margin:0 auto; padding: 24px 16px;}

  .topRow{
    display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
    margin-bottom: 14px;
  }

  .leftActions{display:flex; gap:10px; flex-wrap:wrap; align-items:center;}
  .rightActions{display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:flex-end;}

  .pill{
    background: rgba(124,58,237,.10);
    color: #4c1d95;
    border:1px solid rgba(124,58,237,.16);
    padding:8px 12px;
    border-radius:999px;
    font-weight:1000;
    text-decoration:none;
    display:inline-flex; gap:10px; align-items:center;
    transition: transform .12s ease, filter .12s ease;
    position:relative;
  }
  .pill:hover{filter:brightness(.98)}
  .pill:active{transform: translateY(1px)}

  .pillBlue{
    background: rgba(37,99,235,.10);
    color: #1e3a8a;
    border:1px solid rgba(37,99,235,.18);
  }

  .pillPink{
    background: rgba(219,39,119,.10);
    color:#831843;
    border-color: rgba(219,39,119,.16);
  }

  /* Botão Sair (urgência) — topo */
  .pillDanger{
    background: rgba(239,68,68,.12);
    color:#7f1d1d;
    border:1px solid rgba(239,68,68,.22);
  }
  .pillDanger strong{font-weight:1100}

  .grid{
    display:grid;
    grid-template-columns: 1fr;
    gap:14px;
    align-items:start;
  }

  .card{
    background: var(--card);
    border:1px solid var(--border);
    border-radius: 26px;
    box-shadow: var(--shadow);
    padding: 16px;
    position:relative;
    overflow:hidden;
  }

  .title{
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    margin-bottom:10px;
  }

  h1{margin:0; font-size:22px; font-weight:1000;}
  h2{margin:0; font-size:16px; font-weight:1000; color:#374151;}
  .muted{color:var(--muted); font-weight:800;}
  .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }

  .avatar{
    width:72px; height:72px; border-radius:999px;
    background: linear-gradient(135deg, var(--violet), var(--pink));
    display:grid; place-items:center;
    color:#fff; font-weight:1000; font-size:24px;
    box-shadow: 0 16px 34px rgba(124,58,237,.22);
  }

  .profileRow{
    display:flex; gap:12px; align-items:center;
    padding: 6px 0 12px;
    border-bottom:1px solid rgba(0,0,0,.06);
  }

  /* Progresso (gamificação) */
  .progressBox{
    margin-top:12px;
    border:1px solid rgba(37,99,235,.12);
    background: rgba(37,99,235,.06);
    border-radius:18px;
    padding:12px;
  }
  .progressTop{
    display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;
  }
  .bar{
    margin-top:10px;
    height:12px;
    background: rgba(0,0,0,.06);
    border-radius:999px;
    overflow:hidden;
    border:1px solid rgba(0,0,0,.06);
  }
  .bar > div{
    height:100%;
    width: 20%;
    background: linear-gradient(90deg, var(--blue), var(--violet));
    border-radius:999px;
    transition: width .35s ease;
  }

  .btn{
    border:0; cursor:pointer;
    border-radius: 999px;
    padding: 12px 14px;
    font-weight:1000;
    display:inline-flex; align-items:center; gap:10px;
    user-select:none;
    transition: transform .12s ease, filter .12s ease, opacity .12s ease;
  }
  .btn:active{ transform: translateY(1px); }

  /* Confiança (azul): atualizar, ações seguras */
  .btnBlue{
    color:#fff;
    background: linear-gradient(90deg, var(--blue), var(--blue2));
    box-shadow: 0 16px 34px rgba(37,99,235,.18);
  }
  .btnBlue:focus{ outline: 4px solid var(--ring); outline-offset: 2px; }

  /* Urgência (vermelho) para sair */
  .btnDanger{
    color:#fff;
    background: linear-gradient(90deg, var(--red), var(--orange));
    box-shadow: 0 16px 34px rgba(239,68,68,.18);
  }

  .btnGhost{
    background: rgba(0,0,0,.04);
    color:#374151;
    border:1px solid rgba(0,0,0,.06);
  }

  .tabs{display:flex; gap:10px; flex-wrap:wrap; margin-top: 12px;}
  .tab{
    flex:0 0 auto;
    border:1px solid var(--border);
    background:#fff;
    border-radius:999px;
    padding:10px 12px;
    cursor:pointer;
    font-weight:1000;
    color:#374151;
    transition: transform .12s ease, filter .12s ease;
    position:relative;
  }
  .tab:hover{filter:brightness(.99)}
  .tab:active{transform: translateY(1px)}
  .tab.active{
    background: linear-gradient(90deg,var(--violet),var(--pink));
    color:#fff;
    border-color:transparent;
    box-shadow: 0 16px 34px rgba(124,58,237,.16);
  }

  .panel{display:none; margin-top: 12px;}
  .panel.active{display:block;}

  .list{display:grid; gap:10px; margin-top:10px;}
  .item{
    border:1px solid rgba(0,0,0,.08);
    border-radius:18px;
    padding:12px;
    background:#fff;
    box-shadow: var(--shadow2);
  }
  .itemTop{display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;}

  .badge{
    display:inline-flex; align-items:center; gap:8px;
    padding:6px 10px; border-radius:999px;
    font-weight:1000; font-size:12px;
    border:1px solid rgba(0,0,0,.08);
    background: rgba(0,0,0,.03);
    color:#374151;
  }
  .badge.green{ background: rgba(16,185,129,.10); border-color: rgba(16,185,129,.18); color:#065f46;}
  .badge.red{ background: rgba(239,68,68,.10); border-color: rgba(239,68,68,.18); color:#7f1d1d;}
  .badge.violet{ background: rgba(124,58,237,.10); border-color: rgba(124,58,237,.18); color:#4c1d95;}
  .badge.blue{ background: rgba(37,99,235,.10); border-color: rgba(37,99,235,.18); color:#1e3a8a;}
  .badge.amber{ background: rgba(245,158,11,.12); border-color: rgba(245,158,11,.20); color:#92400e;}

  .rowBtns{display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;}

  a.a{
    text-decoration:none;
    display:inline-flex; align-items:center; gap:10px;
    padding:10px 12px;
    border-radius:999px;
    border:1px solid rgba(0,0,0,.08);
    background:#fff;
    font-weight:1000;
    color:#374151;
  }
  a.a:hover{filter:brightness(.98)}

  /* Botão de curtida (validação social) */
  .likeBtn{
    border:1px solid rgba(239,68,68,.22);
    background: rgba(239,68,68,.08);
    color:#7f1d1d;
    padding:10px 12px;
    border-radius:999px;
    font-weight:1100;
    cursor:pointer;
    display:inline-flex;
    align-items:center;
    gap:8px;
    user-select:none;
    transition: transform .12s ease, filter .12s ease;
  }
  .likeBtn:hover{filter:brightness(.98)}
  .likeBtn:active{transform: translateY(1px)}
  .likeBtn.on{
    background: rgba(239,68,68,.14);
    border-color: rgba(239,68,68,.30);
  }
  .likeCount{
    display:inline-flex;
    padding:4px 8px;
    border-radius:999px;
    background: rgba(0,0,0,.06);
    border:1px solid rgba(0,0,0,.06);
    color:#111827;
    font-weight:1100;
    font-size:12px;
  }

  .hint{
    margin-top:10px;
    padding:12px;
    border-radius: 14px;
    background: rgba(239,68,68,.08);
    border: 1px solid rgba(239,68,68,.16);
    color:#7f1d1d;
    font-weight:900;
    white-space:pre-wrap;
    display:none;
  }

  /* Modal confirmação */
  .modalBackdrop{
    position:fixed; inset:0;
    background: rgba(17,24,39,.55);
    display:none;
    align-items:center; justify-content:center;
    padding: 18px;
    z-index: 50;
  }
  .modalBackdrop.open{display:flex;}
  .modal{
    width:min(520px, 100%);
    background:#fff;
    border:1px solid rgba(255,255,255,.12);
    border-radius: 22px;
    box-shadow: 0 30px 70px rgba(0,0,0,.25);
    padding: 16px;
  }
  .modal h3{
    margin: 0;
    font-size: 18px;
    font-weight: 1000;
  }
  .modal p{
    margin: 10px 0 0;
    color: var(--muted);
    font-weight: 900;
    line-height: 1.5;
  }
  .modalActions{
    margin-top: 14px;
    display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;
  }

  /* Loading micro feedback */
  .spin{
    width:16px; height:16px;
    border-radius:999px;
    border:2px solid rgba(255,255,255,.55);
    border-top-color: rgba(255,255,255,.0);
    display:inline-block;
    animation: sp 0.8s linear infinite;
  }
  @keyframes sp { to{ transform: rotate(360deg);} }

  /* Toast */
  .toastWrap{
    position:fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    z-index: 60;
    display:flex;
    flex-direction:column;
    gap:10px;
    pointer-events:none;
  }
  .toast{
    pointer-events:none;
    min-width: min(560px, calc(100vw - 26px));
    background: #111827;
    color:#fff;
    border:1px solid rgba(255,255,255,.12);
    border-radius: 16px;
    padding: 12px 12px;
    box-shadow: 0 20px 50px rgba(0,0,0,.25);
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:10px;
    opacity:0;
    transform: translateY(8px);
    transition: opacity .18s ease, transform .18s ease;
  }
  .toast.show{
    opacity:1;
    transform: translateY(0);
  }
  .toastTitle{
    font-weight:1000;
    display:flex;
    align-items:center;
    gap:10px;
  }
  .toastText{
    margin-top:6px;
    color: rgba(255,255,255,.88);
    font-weight:900;
    line-height:1.35;
    font-size:13px;
  }

  /* Sentinel (infinite scroll) */
  .sentinel{
    height: 16px;
    width: 100%;
  }
</style>
</head>

<body>
  <div class="container">
    <div class="topRow">
      <div class="leftActions">
        <a class="pill" href="/create">✨ Criar Livro</a>
        <a class="pill" href="/books">📚 Meus Livros</a>
        <a class="pill pillPink" href="/sales">🛒 Página Inicial</a>
        <a class="pill pillBlue" href="/como-funciona">❓ Ajuda</a>
      </div>

      <div class="rightActions">
        <div class="muted">Logado como: <span class="mono">${email}</span></div>
        <button class="pill pillDanger" id="btnTopLogout" title="Sair para entrar com outra conta">
          🚪 <strong>Sair</strong>
        </button>
      </div>
    </div>

    <div class="grid">
      <!-- Card (perfil) -->
      <div class="card">
        <div class="profileRow">
          <div class="avatar" id="avatar">🙂</div>
          <div style="min-width:0">
            <h1 id="name">Seu Perfil</h1>
            <div class="muted" id="email">${email}</div>
            <div class="muted" style="font-size:12px; margin-top:6px;">
              ID: <span class="mono" id="uid">...</span>
            </div>
          </div>
        </div>

        <div class="progressBox">
          <div class="progressTop">
            <div>
              <div style="font-weight:1000;">✅ Completar perfil</div>
              <div class="muted" style="font-size:12px;">Quanto mais completo, mais organizado fica seu histórico.</div>
            </div>
            <span class="badge blue" id="profileProgressLabel">—%</span>
          </div>
          <div class="bar"><div id="profileBar"></div></div>
        </div>

        <div class="tabs">
          <button class="tab active" data-tab="info" id="tabInfo">👤 Informações</button>
          <button class="tab" data-tab="purchases" id="tabPurchases">🧾 Compras</button>
          <button class="tab" data-tab="security" id="tabSecurity">🔐 Conta</button>
        </div>

        <div class="panel active" id="panel-info">
          <div class="muted" style="margin-top:10px;">
            Aqui você vê seus dados do Supabase (profiles) e mantém tudo organizado.
          </div>

          <div class="list" style="margin-top:12px;">
            <div class="item">
              <div class="itemTop">
                <h2>Dados do perfil</h2>
                <span class="badge violet" id="profileBadge">Carregando…</span>
              </div>
              <div class="muted" style="margin-top:8px;">
                Nome: <b id="profileName">—</b><br/>
                Criado em: <b id="profileCreated">—</b><br/>
                Atualizado em: <b id="profileUpdated">—</b>
              </div>
              <div class="rowBtns" id="badgesRow" style="margin-top:12px;"></div>
            </div>
          </div>

          <div class="rowBtns">
            <a class="a" href="/books">📚 Ir para Meus Livros</a>
            <a class="a" href="/create">✨ Criar novo livro</a>
          </div>
        </div>

        <div class="panel" id="panel-purchases">
          <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center; margin-top:10px;">
            <div class="muted">
              “Compras” aqui = seus livros gerados (tabela <span class="mono">books</span>) via RLS.
            </div>
            <button class="btn btnBlue" id="btnRefreshBooks" title="Atualizar lista">
              <span id="refreshIcon">🔄</span> Atualizar
            </button>
          </div>

          <div class="hint" id="hintBooks"></div>

          <!-- ✅ Infinite Scroll: cards um embaixo do outro, sem botão "Carregar mais" -->
          <div class="list" id="booksList" style="margin-top:12px;"></div>
          <div class="sentinel" id="sentinel"></div>
        </div>

        <div class="panel" id="panel-security">
          <div class="muted" style="margin-top:10px;">
            Para entrar com outra conta, use “Sair” (o cookie <span class="mono">sb_token</span> será removido).
          </div>

          <div class="list" style="margin-top:12px;">
            <div class="item">
              <div class="itemTop">
                <h2>Conta</h2>
                <span class="badge" id="sessionBadge">Sessão ativa</span>
              </div>

              <div class="rowBtns" style="margin-top:12px;">
                <button class="btn btnDanger" id="btnLogout">🚪 Sair da conta</button>
                <a class="a" href="/login">🔐 Ir para Login</a>
              </div>
            </div>
          </div>

          <div class="hint" id="hintLogout"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="toastWrap" id="toastWrap" aria-live="polite" aria-atomic="true"></div>

  <div class="modalBackdrop" id="logoutModal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="logoutTitle">
      <h3 id="logoutTitle">Sair da conta?</h3>
      <p>
        Você será desconectado e poderá entrar com outro e-mail.
      </p>
      <div class="modalActions">
        <button class="btn btnGhost" id="btnCancelLogout">Cancelar</button>
        <button class="btn btnDanger" id="btnConfirmLogout">🚪 Confirmar saída</button>
      </div>
      <div class="hint" id="hintLogoutModal"></div>
    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id);

  function setHint(id, msg){
    const el = $(id);
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  function initialsFromEmail(email){
    const s = String(email || "").trim();
    if (!s) return "🙂";
    const left = s.split("@")[0] || s;
    const parts = left.split(/[._-]+/).filter(Boolean);
    const a = (parts[0] || left)[0] || "U";
    const b = (parts[1] || "")[0] || "";
    return (a + b).toUpperCase();
  }

  function fmtDateBR(iso){
    try{
      const d = new Date(String(iso||""));
      if (!Number.isFinite(d.getTime())) return "";
      const dd = String(d.getDate()).padStart(2,"0");
      const mm = String(d.getMonth()+1).padStart(2,"0");
      const yy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2,"0");
      const mi = String(d.getMinutes()).padStart(2,"0");
      return dd + "/" + mm + "/" + yy + " " + hh + ":" + mi;
    }catch{ return ""; }
  }

  async function getJson(url){
    const r = await fetch(url, { headers: { "Accept":"application/json" }});
    const j = await r.json().catch(()=> ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Falha");
    return j;
  }

  function setTab(key){
    document.querySelectorAll(".tab").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === key);
    });
    $("panel-info").classList.toggle("active", key === "info");
    $("panel-purchases").classList.toggle("active", key === "purchases");
    $("panel-security").classList.toggle("active", key === "security");
  }

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", async () => {
      const key = btn.getAttribute("data-tab");
      setTab(key);
      if (key === "purchases") await loadBooks(true, "tab");
    });
  });

  function statusBadge(st){
    const s = String(st || "");
    if (s === "done") return '<span class="badge green">✅ Pronto</span>';
    if (s === "failed") return '<span class="badge red">❌ Falhou</span>';
    if (s === "generating") return '<span class="badge violet">⏳ Gerando</span>';
    return '<span class="badge">• ' + (s || "created") + '</span>';
  }

  function safe(s){ return String(s ?? ""); }

  // ------------------------------
  // Curtidas (validação social) — localStorage + base determinístico
  // ------------------------------
  const LIKE_KEY = "mlm_profile_likes_v1";

  function hash32(str){
    str = String(str||"");
    let h = 2166136261;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function readLikes(){
    try{
      const raw = localStorage.getItem(LIKE_KEY);
      if (!raw) return {};
      const j = JSON.parse(raw);
      return (j && typeof j === "object") ? j : {};
    }catch{
      return {};
    }
  }

  function writeLikes(map){
    try{ localStorage.setItem(LIKE_KEY, JSON.stringify(map || {})); }catch{}
  }

  function baseLikeCount(id){
    const h = hash32(id);
    return 3 + (h % 25);
  }

  function getLikeState(id){
    const map = readLikes();
    const v = map[String(id)] || null;
    const liked = !!(v && v.liked);
    return { liked };
  }

  function toggleLike(id){
    const key = String(id);
    const map = readLikes();
    const cur = map[key] || {};
    const nextLiked = !cur.liked;
    map[key] = { liked: nextLiked };
    writeLikes(map);
    return nextLiked;
  }

  function likeCountFor(id){
    const base = baseLikeCount(id);
    const st = getLikeState(id);
    return base + (st.liked ? 1 : 0);
  }

  function bookCard(b){
    const id = safe(b.id);
    const title = safe(b.child_name || "Criança");
    const theme = safe(b.theme || "");
    const style = safe(b.style || "");
    const upd = fmtDateBR(b.updated_at || b.created_at || "");
    const err = safe(b.error || "");
    const pdf = safe(b.pdf_url || "");
    const canDownload = pdf && safe(b.status) === "done";

    const openLink = "/books/" + encodeURIComponent(id);
    const downloadLink = canDownload ? ("/download/" + encodeURIComponent(id)) : "";

    const st = getLikeState(id);
    const cnt = likeCountFor(id);

    return \`
      <div class="item" data-book="\${id}">
        <div class="itemTop">
          <div style="min-width:0">
            <div style="font-weight:1000; font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              📘 Livro: \${title} \${theme ? "• " + theme : ""} \${style ? "• " + style : ""}
            </div>
            <div class="muted" style="margin-top:6px;">
              Atualizado: <b>\${upd || "—"}</b><br/>
              ID: <span class="mono">\${id}</span>
              \${err ? "<br/><span style='color:#7f1d1d; font-weight:1000;'>Erro: " + err + "</span>" : ""}
            </div>
          </div>
          \${statusBadge(b.status)}
        </div>

        <div class="rowBtns">
          <a class="a" href="\${openLink}">👀 Abrir</a>
          \${canDownload ? \`<a class="a" href="\${downloadLink}">⬇️ Baixar PDF</a>\` : \`<span class="badge">PDF indisponível</span>\`}

          <button class="likeBtn \${st.liked ? "on" : ""}" data-like="\${id}" title="Curtir este livro">
            \${st.liked ? "❤️" : "🤍"} Curtir <span class="likeCount" data-likecount="\${id}">\${cnt}</span>
          </button>
        </div>
      </div>
    \`;
  }

  // ------------------------------
  // Toast
  // ------------------------------
  const rewardLines = [
    { t: "✨ Atualizado", d: "Tudo certo por aqui. Seu perfil está sincronizado." },
    { t: "📚 Biblioteca pronta", d: "Seus livros foram carregados. Continue rolando para ver mais." },
    { t: "✅ Boa!", d: "Mais um passo concluído. Seu progresso está ficando top." },
    { t: "🧠 Achado", d: "Você pode curtir seus livros para marcar os favoritos." },
  ];

  function showToast(title, desc, ms){
    const wrap = $("toastWrap");
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = \`
      <div style="min-width:0">
        <div class="toastTitle">\${title}</div>
        <div class="toastText">\${desc}</div>
      </div>
      <div class="mono" style="opacity:.75">agora</div>
    \`;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    const ttl = Math.max(1400, Math.min(4200, Number(ms || 2200)));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 240);
    }, ttl);
  }

  function variableReward(kind){
    const chance = kind === "refresh" ? 0.70 : 0.45;
    if (Math.random() > chance) return;
    const pick = rewardLines[Math.floor(Math.random() * rewardLines.length)];
    showToast(pick.t, pick.d, 2200 + Math.floor(Math.random() * 1200));
  }

  // ------------------------------
  // Logout (com confirmação)
  // ------------------------------
  function openLogoutModal(){
    setHint("hintLogoutModal", "");
    $("logoutModal").classList.add("open");
  }
  function closeLogoutModal(){
    $("logoutModal").classList.remove("open");
  }

  async function doLogout(){
    setHint("hintLogout", "");
    setHint("hintLogoutModal", "");
    try{
      const r = await fetch("/api/auth/logout", {
        method:"POST",
        headers: { "Content-Type":"application/json" },
        body:"{}"
      });
      const j = await r.json().catch(()=> ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "Falha ao sair");
      window.location.href = "/login";
    }catch(e){
      const msg = String(e.message || e);
      setHint("hintLogout", msg);
      setHint("hintLogoutModal", msg);
    }
  }

  $("btnTopLogout").addEventListener("click", openLogoutModal);
  $("btnLogout").addEventListener("click", openLogoutModal);

  $("btnCancelLogout").addEventListener("click", closeLogoutModal);
  $("logoutModal").addEventListener("click", (e) => {
    if (e.target === $("logoutModal")) closeLogoutModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLogoutModal();
  });
  $("btnConfirmLogout").addEventListener("click", doLogout);

  // ------------------------------
  // Perfil / progresso + emblemas
  // ------------------------------
  function setProgress(pct){
    const v = Math.max(0, Math.min(100, Number(pct || 0)));
    $("profileProgressLabel").textContent = v + "%";
    $("profileBar").style.width = v + "%";
  }

  function setBadges(progressPct, hasProfileName){
    const row = $("badgesRow");
    const badges = [];

    if (progressPct >= 40) badges.push("<span class='badge blue'>✅ Conta ok</span>");
    if (progressPct >= 70) badges.push("<span class='badge violet'>⭐ Perfil quase lá</span>");
    if (hasProfileName) badges.push("<span class='badge green'>🏷️ Nome definido</span>");
    if (progressPct >= 100) badges.push("<span class='badge amber'>🏆 Perfil completo</span>");

    row.innerHTML = badges.length ? badges.join(" ") : "<span class='muted'>Complete mais um passo para ganhar emblemas.</span>";
  }

  async function loadMe(){
    try{
      const me = await getJson("/api/me");
      const u = me.user || {};
      const p = me.profile || null;

      $("uid").textContent = u.id || "—";
      $("avatar").textContent = initialsFromEmail(u.email || "");

      let score = 0;
      if (u.id) score += 40;
      if (u.email) score += 30;
      if (p && p.name) score += 30;
      setProgress(score);

      const hasName = !!(p && p.name);

      if (hasName){
        $("name").textContent = p.name;
        $("profileName").textContent = p.name;
        $("profileCreated").textContent = fmtDateBR(p.created_at || "") || "—";
        $("profileUpdated").textContent = fmtDateBR(p.updated_at || "") || "—";
        $("profileBadge").textContent = "profiles OK";
      } else {
        $("name").textContent = "Seu Perfil";
        $("profileName").textContent = "—";
        $("profileCreated").textContent = "—";
        $("profileUpdated").textContent = "—";
        $("profileBadge").textContent = "sem profile";
      }

      setBadges(score, hasName);
      variableReward("me");
    }catch(e){
      $("profileBadge").textContent = "erro";
      setHint("hintLogout", "Falha ao carregar /api/me: " + String(e.message || e));
      setProgress(20);
      setBadges(20, false);
    }
  }

  // ------------------------------
  // Compras — Infinite Scroll (rolagem infinita)
  // ------------------------------
  let allBooks = [];
  let shown = 0;
  const PAGE = 10;
  let io = null;
  let isLoading = false;

  function detachObserver(){
    try{
      if (io) io.disconnect();
    }catch{}
    io = null;
  }

  function attachObserver(){
    detachObserver();
    const sentinel = $("sentinel");
    if (!sentinel) return;

    io = new IntersectionObserver((entries) => {
      const e = entries && entries[0];
      if (!e || !e.isIntersecting) return;
      renderMore();
    }, { root: null, rootMargin: "600px 0px", threshold: 0.01 });

    io.observe(sentinel);
  }

  function renderMore(){
    if (isLoading) return;
    const list = $("booksList");
    const slice = allBooks.slice(shown, shown + PAGE);
    if (!slice.length) return;

    isLoading = true;
    setTimeout(() => {
      list.insertAdjacentHTML("beforeend", slice.map(bookCard).join(""));
      shown += slice.length;
      bindLikeButtonsForVisible();
      isLoading = false;
      variableReward("scroll");
    }, 120);
  }

  function bindLikeButtonsForVisible(){
    document.querySelectorAll("[data-like]").forEach(btn => {
      if (btn.__boundLike) return;
      btn.__boundLike = true;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const id = btn.getAttribute("data-like");
        const nextLiked = toggleLike(id);

        btn.classList.toggle("on", nextLiked);
        btn.innerHTML = (nextLiked ? "❤️" : "🤍") +
          " Curtir " +
          "<span class='likeCount' data-likecount='" + id + "'>" + likeCountFor(id) + "</span>";

        showToast(nextLiked ? "❤️ Curtido!" : "🤍 Removido", nextLiked ? "Você marcou como favorito." : "Ok, desmarcado.", 2000);
        variableReward("like");
      });
    });
  }

  async function loadBooks(reset, source){
    setHint("hintBooks", "");

    if (reset){
      detachObserver();
      allBooks = [];
      shown = 0;
      $("booksList").innerHTML = "<div class='muted'>Carregando…</div>";
    }

    const btn = $("btnRefreshBooks");
    const icon = $("refreshIcon");
    btn.disabled = true;
    icon.innerHTML = "<span class='spin'></span>";

    try{
      const j = await getJson("/api/my-books");
      const items = Array.isArray(j.items) ? j.items : [];

      allBooks = items;
      shown = 0;

      if (!items.length){
        $("booksList").innerHTML = "<div class='muted'>Nenhum livro encontrado ainda.</div>";
        attachObserver();
        variableReward("refresh");
        return;
      }

      $("booksList").innerHTML = "";
      renderMore();
      attachObserver();

      variableReward("refresh");
    }catch(e){
      $("booksList").innerHTML = "";
      setHint("hintBooks", "Falha ao carregar livros: " + String(e.message || e));
    }finally{
      btn.disabled = false;
      icon.textContent = "🔄";
    }
  }

  $("btnRefreshBooks").addEventListener("click", () => loadBooks(true, "btn"));

  // ------------------------------
  // Init
  // ------------------------------
  (async function init(){
    await loadMe();
  })();
</script>
</body>
</html>`);
  });
};