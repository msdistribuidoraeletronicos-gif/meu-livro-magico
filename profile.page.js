/**
 * profile.page.js — Página /profile (Perfil do usuário)
 *
 * ✅ Rotas:
 *   GET  /profile          (UI)
 *   GET  /api/me           (JSON: usuário + profile)
 *   GET  /api/my-books     (JSON: livros gerados pelo usuário — APENAS CONCLUÍDOS)
 *   GET  /api/my-orders    (JSON: pedidos realizados pelo usuário)
 *
 * Requer:
 * - app.js deve passar { requireAuth, supabaseAdmin, supabaseAuth }
 * - requireAuth precisa setar req.user = { id, email }
 */

"use strict";

module.exports = function mountProfilePage(app, options = {}) {
  const { requireAuth, supabaseAdmin, supabaseAuth } = options;

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

      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("id, name, created_at, updated_at")
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
  // API: /api/my-books  (livros criados) — APENAS OS CONCLUÍDOS
  // ------------------------------
  app.get("/api/my-books", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");
      if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

      if (!supabaseAdmin) {
        return res.status(500).json({ ok: false, error: "supabase_client_missing" });
      }

      // 🔍 LOG para depuração (remova em produção)
      console.log(`[profile] Buscando livros do usuário ${userId} com status = 'done'`);

      const { data, error } = await supabaseAdmin
        .from("books")
        .select("id, status, step, error, theme, style, child_name, child_age, child_gender, pdf_url, updated_at, created_at")
        .eq("user_id", userId)
        .eq("status", "done")  // ✅ FILTRO: apenas livros concluídos
        .order("updated_at", { ascending: false })
        .limit(120);

      if (error) {
        console.error("[profile] Erro na consulta:", error);
        throw error;
      }

      // 🔍 LOG para ver quantos vieram
      console.log(`[profile] Encontrados ${data?.length || 0} livros com status 'done'`);

      return res.json({
        ok: true,
        items: Array.isArray(data) ? data : [],
      });
    } catch (e) {
      console.error("[profile] Erro em /api/my-books:", e);
      return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  // ------------------------------
  // API: /api/my-orders  (pedidos realizados)
  // ------------------------------
  app.get("/api/my-orders", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");
      if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

      if (!supabaseAdmin) {
        return res.status(500).json({ ok: false, error: "supabase_client_missing" });
      }

      const { data, error } = await supabaseAdmin
        .from("orders")
        .select(`
          id,
          created_at,
          status,
          order_data,
          book_id
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
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
    --violet-50:#f5f3ff;
    --pink-50:#fff1f2;
    --white:#ffffff;
    --gray-900:#111827;
    --gray-800:#1f2937;
    --gray-700:#374151;
    --gray-600:#4b5563;

    --violet-600:#7c3aed;
    --violet-700:#6d28d9;
    --pink-600:#db2777;
    --pink-700:#be185d;

    --shadow: 0 34px 120px rgba(17,24,39,.22);
    --shadow2: 0 16px 38px rgba(17,24,39,.10);
    --shadow3: 0 10px 18px rgba(17,24,39,.10);

    --r: 26px;
    --bookR: 22px;
    --pageR: 18px;

    --pad: 18px;
    --foldW: clamp(18px, 2.4vw, 30px);
  }

  *{ box-sizing:border-box; }
  html,body{ height:100%; }
  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    color: var(--gray-800);
    background: radial-gradient(1200px 520px at 18% 0%, rgba(124,58,237,.18), transparent 60%),
                radial-gradient(980px 460px at 90% 12%, rgba(219,39,119,.14), transparent 58%),
                linear-gradient(180deg, var(--violet-50), var(--white) 46%, var(--pink-50));
    min-height:100vh;
    padding-bottom: 30px;
    overflow-x:hidden;
  }
  a{ color:inherit; text-decoration:none; }
  .wrap{ max-width: 1180px; margin: 0 auto; padding: 18px 16px; }

  .top{
    display:flex; gap:12px;
    align-items:center;
    justify-content:space-between;
    flex-wrap:wrap;
    margin-bottom: 12px;
  }
  .pill{
    display:inline-flex; gap:8px; align-items:center;
    padding:10px 12px; border-radius:999px;
    background: rgba(255,255,255,.76);
    border:1px solid rgba(221,214,254,.92);
    color: rgba(109,40,217,1);
    font-weight:950;
    box-shadow: 0 14px 30px rgba(17,24,39,.08);
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
    white-space:nowrap;
  }
  .pill:hover{
    background: rgba(245,243,255,.92);
    border-color: rgba(196,181,253,.95);
    transform: translateY(-1px);
    box-shadow: 0 18px 44px rgba(17,24,39,.10);
  }
  .pillPink{
    background: rgba(219,39,119,.10);
    color:#831843;
    border-color: rgba(219,39,119,.16);
  }
  .pillDanger{
    background: rgba(239,68,68,.12);
    color:#7f1d1d;
    border:1px solid rgba(239,68,68,.22);
  }

  .btn{
    display:inline-flex; align-items:center; justify-content:center; gap:10px;
    padding: 12px 14px;
    border-radius: 999px;
    border: 1px solid rgba(221,214,254,.92);
    background: rgba(255,255,255,.72);
    color: rgba(109,40,217,1);
    font-weight:1000;
    box-shadow: 0 14px 30px rgba(17,24,39,.08);
    cursor:pointer;
    user-select:none;
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
    white-space:nowrap;
  }
  .btn:active{ transform: translateY(1px); }
  .btnPrimary{
    border:0;
    color:#fff;
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
    box-shadow: 0 18px 44px rgba(124,58,237,.20);
  }
  .btnPrimary:hover{
    background: linear-gradient(90deg, var(--violet-700), var(--pink-700));
    box-shadow: 0 22px 56px rgba(124,58,237,.24);
  }
  .btnDanger{
    color:#fff;
    background: linear-gradient(90deg, #ef4444, #f97316);
    box-shadow: 0 18px 44px rgba(239,68,68,.22);
  }
  .btnDanger:hover{
    background: linear-gradient(90deg, #dc2626, #fb923c);
    box-shadow: 0 24px 58px rgba(239,68,68,.30);
  }
  .btnOutline{
    background: rgba(255,255,255,.78);
    border: 2px solid rgba(221,214,254,.95);
  }
  .btnOutline:hover{
    background: rgba(245,243,255,.95);
    border-color: rgba(196,181,253,.95);
  }

  .head{
    background: rgba(255,255,255,.86);
    border: 1px solid rgba(17,24,39,.06);
    border-radius: 26px;
    box-shadow: 0 20px 60px rgba(17,24,39,.10);
    padding: 14px;
    margin-bottom: 14px;
    backdrop-filter: blur(2px);
  }
  .ttl{
    font-weight:1000;
    font-size: 18px;
    color: var(--gray-900);
    letter-spacing:-.2px;
    display:flex;
    gap:8px;
    align-items:center;
    flex-wrap:wrap;
  }
  .meta{
    margin-top:6px;
    color: var(--gray-600);
    font-weight:850;
    line-height:1.6;
    font-size: 13px;
  }

  .card{
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(17,24,39,.06);
    border-radius: 26px;
    box-shadow: var(--shadow2);
    overflow:hidden;
    padding: 16px;
    backdrop-filter: blur(2px);
  }

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
    background: linear-gradient(90deg, #2563eb, var(--violet-600));
    border-radius:999px;
    transition: width .35s ease;
  }

  .tabs{
    display:flex; gap:10px; flex-wrap:wrap; margin-top: 12px;
  }
  .tab{
    flex:0 0 auto;
    border:1px solid rgba(221,214,254,.92);
    background:#fff;
    border-radius:999px;
    padding:10px 12px;
    cursor:pointer;
    font-weight:1000;
    color:#374151;
    transition: transform .12s ease, filter .12s ease;
  }
  .tab:hover{filter:brightness(.99)}
  .tab:active{transform: translateY(1px)}
  .tab.active{
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
    color:#fff;
    border-color:transparent;
    box-shadow: 0 16px 34px rgba(124,58,237,.16);
  }

  .panel{display:none; margin-top: 12px;}
  .panel.active{display:block;}

  .list{
    display:grid; gap:10px; margin-top:10px;
  }
  .item{
    border:1px solid rgba(17,24,39,.06);
    border-radius:18px;
    padding:12px;
    background:#fff;
    box-shadow: var(--shadow2);
  }
  .itemTop{
    display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;
  }
  .rowBtns{
    display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;
  }

  .a{
    text-decoration:none;
    display:inline-flex; align-items:center; gap:10px;
    padding:10px 12px;
    border-radius:999px;
    border:1px solid rgba(221,214,254,.92);
    background:#fff;
    font-weight:1000;
    color:#374151;
  }
  .a:hover{filter:brightness(.98)}

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
    color: var(--gray-600);
    font-weight: 900;
    line-height: 1.5;
  }
  .modalActions{
    margin-top: 14px;
    display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;
  }

  .spin{
    width:16px; height:16px;
    border-radius:999px;
    border:2px solid rgba(255,255,255,.55);
    border-top-color: rgba(255,255,255,.0);
    display:inline-block;
    animation: sp 0.8s linear infinite;
  }
  @keyframes sp { to{ transform: rotate(360deg);} }

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

  .sentinel{
    height: 16px;
    width: 100%;
  }
  .muted{color:var(--gray-600); font-weight:800;}
  .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }

  .stars{
    position:absolute; inset:0;
    pointer-events:none;
    overflow:hidden;
    z-index:0;
  }
  .star{
    position:absolute;
    width: 18px; height: 18px;
    opacity:.45;
    animation: floatY var(--dur, 4s) ease-in-out infinite;
    will-change: transform, opacity;
    filter: drop-shadow(0 10px 10px rgba(245,158,11,.10));
  }
  .star svg{ width:100%; height:100%; display:block; }
  @keyframes floatY{
    0%{ transform: translateY(0); opacity:.18; }
    50%{ transform: translateY(-18px); opacity:.55; }
    100%{ transform: translateY(0); opacity:.18; }
  }

  .profileRow{
    display:flex; gap:12px; align-items:center;
    padding: 6px 0 12px;
    border-bottom:1px solid rgba(0,0,0,.06);
  }
  .avatar{
    width:72px; height:72px; border-radius:999px;
    background: linear-gradient(135deg, var(--violet-600), var(--pink-600));
    display:grid; place-items:center;
    color:#fff; font-weight:1000; font-size:24px;
    box-shadow: 0 16px 34px rgba(124,58,237,.22);
  }
</style>
</head>

<body>
  <!-- Estrelas flutuantes (igual ao preview) -->
  <div class="stars" id="stars"></div>

  <div class="wrap">
    <!-- Topo com pills (igual ao preview) -->
    <div class="top">
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a class="pill" href="/create">✨ Criar Livro</a>
        <a class="pill" href="/books">📚 Meus Livros</a>
        <a class="pill pillPink" href="/sales">🛒 Página Inicial</a>
        <a class="pill" href="/como-funciona">❓ Ajuda</a>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <span class="pill" style="background:transparent; border:none; box-shadow:none; padding:0;">
          <span class="mono">${email}</span>
        </span>
        <button class="btn btnOutline" id="btnTopLogout">🚪 Sair</button>
      </div>
    </div>

    <!-- Cabeçalho do perfil (igual ao .head do preview) -->
    <div class="head">
      <div>
        <div class="ttl">👤 Meu Perfil</div>
        <div class="meta" id="email">${email}</div>
        <div class="meta" style="font-size:12px; margin-top:6px;">
          ID: <span class="mono" id="uid">...</span>
        </div>
      </div>
    </div>

    <!-- Card principal com todo o conteúdo do perfil -->
    <div class="card">
      <!-- Linha do perfil com avatar e nome -->
      <div class="profileRow">
        <div class="avatar" id="avatar">🙂</div>
        <div style="min-width:0">
          <h1 id="name" style="margin:0; font-size:24px;">Seu Perfil</h1>
        </div>
      </div>

      <!-- Barra de progresso do perfil -->
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

      <!-- Abas -->
      <div class="tabs">
        <button class="tab active" data-tab="info" id="tabInfo">👤 Informações</button>
        <button class="tab" data-tab="created" id="tabCreated">📚 Livros Criados</button>
        <button class="tab" data-tab="purchases" id="tabPurchases">🧾 Compras</button>
        <button class="tab" data-tab="security" id="tabSecurity">🔐 Conta</button>
      </div>

      <!-- Painel Informações -->
      <div class="panel active" id="panel-info">
        <div class="muted" style="margin-top:10px;">
          Aqui você vê seus dados do Supabase (profiles) e mantém tudo organizado.
        </div>
        <div class="list" style="margin-top:12px;">
          <div class="item">
            <div class="itemTop">
              <h2 style="margin:0;">Dados do perfil</h2>
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

      <!-- Painel Livros Criados -->
      <div class="panel" id="panel-created">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center; margin-top:10px;">
          <div class="muted">
            Seus livros gerados e concluídos (tabela <span class="mono">books</span>).
          </div>
          <button class="btn btnPrimary" id="btnRefreshBooks" title="Atualizar lista">
            <span id="refreshIconBooks">🔄</span> Atualizar
          </button>
        </div>
        <div class="hint" id="hintBooks"></div>
        <div class="list" id="booksList" style="margin-top:12px;"></div>
        <div class="sentinel" id="sentinelBooks"></div>
      </div>

      <!-- Painel Compras -->
      <div class="panel" id="panel-purchases">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center; margin-top:10px;">
          <div class="muted">
            Pedidos realizados (tabela <span class="mono">orders</span>).
          </div>
          <button class="btn btnPrimary" id="btnRefreshOrders" title="Atualizar lista">
            <span id="refreshIconOrders">🔄</span> Atualizar
          </button>
        </div>
        <div class="hint" id="hintOrders"></div>
        <div class="list" id="ordersList" style="margin-top:12px;"></div>
        <div class="sentinel" id="sentinelOrders"></div>
      </div>

      <!-- Painel Conta -->
      <div class="panel" id="panel-security">
        <div class="muted" style="margin-top:10px;">
          Para entrar com outra conta, use “Sair” (o cookie <span class="mono">sb_token</span> será removido).
        </div>
        <div class="list" style="margin-top:12px;">
          <div class="item">
            <div class="itemTop">
              <h2 style="margin:0;">Conta</h2>
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

  <!-- Toast e Modal (idênticos ao preview) -->
  <div class="toastWrap" id="toastWrap" aria-live="polite" aria-atomic="true"></div>

  <div class="modalBackdrop" id="logoutModal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="logoutTitle">
      <h3 id="logoutTitle">Sair da conta?</h3>
      <p>
        Você será desconectado e poderá entrar com outro e-mail.
      </p>
      <div class="modalActions">
        <button class="btn btnOutline" id="btnCancelLogout">Cancelar</button>
        <button class="btn btnDanger" id="btnConfirmLogout">🚪 Confirmar saída</button>
      </div>
      <div class="hint" id="hintLogoutModal"></div>
    </div>
  </div>

<script>
  // CÓDIGO ORIGINAL DO PERFIL (preservado integralmente, apenas ajustado o link dos livros)
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

  function formatMoney(centavos){
    const n = Number(centavos||0);
    return n.toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
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
    $("panel-created").classList.toggle("active", key === "created");
    $("panel-purchases").classList.toggle("active", key === "purchases");
    $("panel-security").classList.toggle("active", key === "security");
  }

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", async () => {
      const key = btn.getAttribute("data-tab");
      setTab(key);
      if (key === "created") await loadBooks(true, "tab");
      if (key === "purchases") await loadOrders(true, "tab");
    });
  });

  function statusBadge(st){
    const s = String(st || "");
    if (s === "done") return '<span class="badge green">✅ Pronto</span>';
    if (s === "failed") return '<span class="badge red">❌ Falhou</span>';
    if (s === "generating") return '<span class="badge violet">⏳ Gerando</span>';
    return '<span class="badge">• ' + (s || "created") + '</span>';
  }

  function orderStatusBadge(st){
    const s = String(st || "");
    if (s === "pending") return '<span class="badge amber">⏳ Pendente</span>';
    if (s === "paid") return '<span class="badge green">✅ Pago</span>';
    if (s === "shipped") return '<span class="badge blue">📦 Enviado</span>';
    if (s === "delivered") return '<span class="badge violet">📬 Entregue</span>';
    if (s === "cancelled") return '<span class="badge red">❌ Cancelado</span>';
    return '<span class="badge">' + (s || "—") + '</span>';
  }

  function safe(s){ return String(s ?? ""); }

  // Curtidas (validação social) — localStorage + base determinístico
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

    // ✅ CORRIGIDO: link para /books/:id (preview com flip de páginas)
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

  function orderCard(o){
    const id = safe(o.id);
    const createdAt = fmtDateBR(o.created_at);
    const status = o.status || "pending";
    const orderData = o.order_data || {};

    const childName = orderData.childName || "—";
    const theme = orderData.theme || "—";
    const style = orderData.style || "—";
    const total = orderData.total || 0;

    const bookId = o.book_id || orderData.bookId;
    const bookLink = bookId ? ("/books/" + encodeURIComponent(bookId)) : "#";

    return \`
      <div class="item" data-order="\${id}">
        <div class="itemTop">
          <div style="min-width:0">
            <div style="font-weight:1000; font-size:16px;">
              🧾 Pedido #\${id.slice(0,8)}
            </div>
            <div class="muted" style="margin-top:6px;">
              <b>Criança:</b> \${childName}<br/>
              <b>Tema/Estilo:</b> \${theme} • \${style}<br/>
              <b>Total:</b> \${formatMoney(total)}<br/>
              <b>Data:</b> \${createdAt}
            </div>
          </div>
          \${orderStatusBadge(status)}
        </div>

        <div class="rowBtns">
          \${bookId ? \`<a class="a" href="\${bookLink}">👀 Ver livro</a>\` : ""}
          <a class="a" href="#">📄 Detalhes do pedido</a>
        </div>
      </div>
    \`;
  }

  // Toast
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

  // Logout (com confirmação)
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

  // Estrelas flutuantes (mesmo código do preview)
  (function renderStars(){
    var root = $("stars");
    if(!root) return;
    var N = 22;

    function rnd(a,b){ return a + Math.random()*(b-a); }

    var starSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.1 6.4L21 9.6l-5.4 4 2.1 6.4L12 16.2 6.3 20l2.1-6.4L3 9.6l6.9-1.2L12 2z" fill="rgba(252,211,77,.95)"/></svg>';

    for(var i=0;i<N;i++){
      var el = document.createElement("div");
      el.className = "star";
      el.style.top  = rnd(0, 100).toFixed(2) + "%";
      el.style.left = rnd(0, 100).toFixed(2) + "%";
      el.style.setProperty("--dur", rnd(3.2, 5.8).toFixed(2) + "s");
      el.style.animationDelay = rnd(0, 2.2).toFixed(2) + "s";
      el.innerHTML = starSvg;
      root.appendChild(el);
    }
  })();

  // Perfil / progresso + emblemas
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

  // Livros Criados — Infinite Scroll
  let allBooks = [];
  let shownBooks = 0;
  const PAGE = 10;
  let ioBooks = null;
  let isLoadingBooks = false;

  function detachBooksObserver(){
    try{ if (ioBooks) ioBooks.disconnect(); }catch{}
    ioBooks = null;
  }

  function attachBooksObserver(){
    detachBooksObserver();
    const sentinel = $("sentinelBooks");
    if (!sentinel) return;
    ioBooks = new IntersectionObserver((entries) => {
      const e = entries && entries[0];
      if (!e || !e.isIntersecting) return;
      renderMoreBooks();
    }, { root: null, rootMargin: "600px 0px", threshold: 0.01 });
    ioBooks.observe(sentinel);
  }

  function renderMoreBooks(){
    if (isLoadingBooks) return;
    const list = $("booksList");
    const slice = allBooks.slice(shownBooks, shownBooks + PAGE);
    if (!slice.length) return;
    isLoadingBooks = true;
    setTimeout(() => {
      list.insertAdjacentHTML("beforeend", slice.map(bookCard).join(""));
      shownBooks += slice.length;
      bindLikeButtonsForVisible();
      isLoadingBooks = false;
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
      detachBooksObserver();
      allBooks = [];
      shownBooks = 0;
      $("booksList").innerHTML = "<div class='muted'>Carregando…</div>";
    }
    const btn = $("btnRefreshBooks");
    const icon = $("refreshIconBooks");
    btn.disabled = true;
    icon.innerHTML = "<span class='spin'></span>";
    try{
      const j = await getJson("/api/my-books");
      const items = Array.isArray(j.items) ? j.items : [];
      
      // 🔍 Filtro extra no front-end para garantir (caso o servidor ainda retorne algo errado)
      const filtered = items.filter(item => item.status === 'done');
      
      allBooks = filtered;
      shownBooks = 0;
      if (!filtered.length){
        $("booksList").innerHTML = "<div class='muted'>Nenhum livro concluído ainda.</div>";
        attachBooksObserver();
        variableReward("refresh");
        return;
      }
      $("booksList").innerHTML = "";
      renderMoreBooks();
      attachBooksObserver();
      variableReward("refresh");
    }catch(e){
      $("booksList").innerHTML = "";
      setHint("hintBooks", "Falha ao carregar livros: " + String(e.message || e));
    }finally{
      btn.disabled = false;
      icon.textContent = "🔄";
    }
  }

  // Compras (Pedidos) — Infinite Scroll
  let allOrders = [];
  let shownOrders = 0;
  let ioOrders = null;
  let isLoadingOrders = false;

  function detachOrdersObserver(){
    try{ if (ioOrders) ioOrders.disconnect(); }catch{}
    ioOrders = null;
  }

  function attachOrdersObserver(){
    detachOrdersObserver();
    const sentinel = $("sentinelOrders");
    if (!sentinel) return;
    ioOrders = new IntersectionObserver((entries) => {
      const e = entries && entries[0];
      if (!e || !e.isIntersecting) return;
      renderMoreOrders();
    }, { root: null, rootMargin: "600px 0px", threshold: 0.01 });
    ioOrders.observe(sentinel);
  }

  function renderMoreOrders(){
    if (isLoadingOrders) return;
    const list = $("ordersList");
    const slice = allOrders.slice(shownOrders, shownOrders + PAGE);
    if (!slice.length) return;
    isLoadingOrders = true;
    setTimeout(() => {
      list.insertAdjacentHTML("beforeend", slice.map(orderCard).join(""));
      shownOrders += slice.length;
      isLoadingOrders = false;
      variableReward("scroll");
    }, 120);
  }

  async function loadOrders(reset, source){
    setHint("hintOrders", "");
    if (reset){
      detachOrdersObserver();
      allOrders = [];
      shownOrders = 0;
      $("ordersList").innerHTML = "<div class='muted'>Carregando…</div>";
    }
    const btn = $("btnRefreshOrders");
    const icon = $("refreshIconOrders");
    btn.disabled = true;
    icon.innerHTML = "<span class='spin'></span>";
    try{
      const j = await getJson("/api/my-orders");
      const items = Array.isArray(j.items) ? j.items : [];
      allOrders = items;
      shownOrders = 0;
      if (!items.length){
        $("ordersList").innerHTML = "<div class='muted'>Nenhum pedido encontrado.</div>";
        attachOrdersObserver();
        variableReward("refresh");
        return;
      }
      $("ordersList").innerHTML = "";
      renderMoreOrders();
      attachOrdersObserver();
      variableReward("refresh");
    }catch(e){
      $("ordersList").innerHTML = "";
      setHint("hintOrders", "Falha ao carregar pedidos: " + String(e.message || e));
    }finally{
      btn.disabled = false;
      icon.textContent = "🔄";
    }
  }

  $("btnRefreshBooks").addEventListener("click", () => loadBooks(true, "btn"));
  $("btnRefreshOrders").addEventListener("click", () => loadOrders(true, "btn"));

  // Init
  (async function init(){
    await loadMe();
  })();
</script>
</body>
</html>`);
  });
};