/**
 * admin.page.js — Painel Admin (separado do app.js)
 *
 * Rotas:
 *   GET  /admin                -> Dashboard HTML
 *   GET  /api/admin/stats       -> JSON com estatísticas do app
 *   GET  /api/admin/users       -> JSON com usuários + métricas por usuário
 *
 * Segurança (simples):
 * - Se ENV ADMIN_EMAILS estiver definido (lista separada por vírgula), só esses e-mails acessam.
 * - Se não estiver definido, QUALQUER usuário logado acessa (modo dev) e aparece um aviso no painel.
 *
 * Como montar no app.js:
 *   const mountAdminPage = require("./admin.page");
 *   mountAdminPage(app, { OUT_DIR, USERS_FILE, requireAuth });
 */

"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

// --------------------
// Helpers (Node)
// --------------------
function existsSyncSafe(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function ensureDir(p) {
  try {
    await fsp.mkdir(p, { recursive: true });
  } catch {}
}

async function readJsonSafe(file, fallback) {
  try {
    if (!existsSyncSafe(file)) return fallback;
    const raw = await fsp.readFile(file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtBytes(n) {
  n = Number(n || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : i === 1 ? 1 : 2;
  return `${n.toFixed(digits)} ${units[i]}`;
}

function pad2(n) {
  n = String(n ?? "");
  return n.length === 1 ? "0" + n : n;
}

function fmtDateBR(isoLike) {
  try {
    const d = new Date(String(isoLike || ""));
    if (!Number.isFinite(d.getTime())) return String(isoLike || "-");
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(
      d.getHours()
    )}:${pad2(d.getMinutes())}`;
  } catch {
    return String(isoLike || "-");
  }
}

function getAdminEmailAllowlist() {
  let raw = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "");
  raw = raw.replace(/^["']|["']$/g, ""); // remove aspas comuns

  const clean = raw.trim();
  if (!clean) return [];

  return clean
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminUser(req) {
  const allow = getAdminEmailAllowlist();
  const email = String(req.user?.email || "").trim().toLowerCase();

  // ✅ DEV: se allowlist vazio, qualquer logado entra
  if (!allow.length) return !!email;

  return !!email && allow.includes(email);
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl || "/admin"));
  }
  if (!isAdminUser(req)) {
    return res.status(403).type("html").send("<h1>403</h1><p>Acesso negado.</p>");
  }
  next();
}

// soma tamanho de uma pasta (recursivo)
async function folderSizeBytes(root) {
  let total = 0;

  async function walk(dir) {
    let entries = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else {
        try {
          const st = await fsp.stat(p);
          total += st.size || 0;
        } catch {}
      }
    }
  }

  await walk(root);
  return total;
}

async function listBookDirs(BOOKS_DIR) {
  if (!existsSyncSafe(BOOKS_DIR)) return [];
  const entries = await fsp.readdir(BOOKS_DIR, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(BOOKS_DIR, e.name));
}

async function readManifestFromDir(bookDir) {
  const p = path.join(bookDir, "book.json");
  const m = await readJsonSafe(p, null);
  if (!m || typeof m !== "object") return null;
  return m;
}

/**
 * Calcula estatísticas globais + por usuário a partir do output/
 * - livros: output/books/<dirId>/book.json
 * - users: output/users.json (ou outro USERS_FILE)
 */
async function computeStats({ OUT_DIR, BOOKS_DIR, USERS_FILE }) {
  const users = await readJsonSafe(USERS_FILE, []);
  const usersArr = Array.isArray(users) ? users : [];

  const userMap = new Map(); // id -> user
  for (const u of usersArr) {
    if (!u || typeof u !== "object") continue;
    const id = String(u.id || "").trim();
    if (!id) continue;
    userMap.set(id, {
      id,
      name: String(u.name || ""),
      email: String(u.email || ""),
      createdAt: u.createdAt || "",
    });
  }

  const dirs = await listBookDirs(BOOKS_DIR);

  const books = [];
  const counts = {
    totalBooks: 0,
    doneBooks: 0,
    generatingBooks: 0,
    failedBooks: 0,
    createdBooks: 0,
    totalPages: 0,
    totalImages: 0,
    withPdf: 0,
    withCover: 0,
  };

  let lastUpdateISO = "";
  let lastCreateISO = "";

  for (const d of dirs) {
    const dirId = path.basename(d);

    const m = await readManifestFromDir(d);
    if (!m) continue;

    counts.totalBooks++;

    const status = String(m.status || "created");
    if (status === "done") counts.doneBooks++;
    else if (status === "generating") counts.generatingBooks++;
    else if (status === "failed") counts.failedBooks++;
    else counts.createdBooks++;

    const pagesArr = Array.isArray(m.pages) ? m.pages : [];
    const imagesArr = Array.isArray(m.images) ? m.images : [];
    counts.totalPages += pagesArr.length;
    counts.totalImages += imagesArr.length;

    if (m.pdf) counts.withPdf++;
    if (m.cover && m.cover.ok) counts.withCover++;

    const updatedAt = String(m.updatedAt || "");
    const createdAt = String(m.createdAt || "");

    if (updatedAt && (!lastUpdateISO || updatedAt > lastUpdateISO)) lastUpdateISO = updatedAt;
    if (createdAt && (!lastCreateISO || createdAt > lastCreateISO)) lastCreateISO = createdAt;

    books.push({
      id: String(m.id || dirId), // id lógico do JSON
      dirId, // ✅ id físico (nome da pasta)
      ownerId: String(m.ownerId || ""),
      status,
      step: String(m.step || ""),
      theme: String(m.theme || ""),
      style: String(m.style || ""),
      childName: String(m.child?.name || ""),
      createdAt,
      updatedAt,
      pdf: String(m.pdf || ""),
      error: String(m.error || ""),
      pagesCount: pagesArr.length,
      imagesCount: imagesArr.length,
      hasCover: !!(m.cover && m.cover.ok),
      hasPdf: !!m.pdf,
    });
  }

  // agrega por usuário
  const byUser = new Map(); // userId -> agg
  function getAgg(uid) {
    if (!byUser.has(uid)) {
      const u = userMap.get(uid) || { id: uid, name: "", email: "", createdAt: "" };
      byUser.set(uid, {
        userId: uid,
        name: String(u.name || ""),
        email: String(u.email || ""),
        userCreatedAt: String(u.createdAt || ""),
        totalBooks: 0,
        doneBooks: 0,
        generatingBooks: 0,
        failedBooks: 0,
        totalPages: 0,
        totalImages: 0,
        withPdf: 0,
        lastUpdatedAt: "",
      });
    }
    return byUser.get(uid);
  }

  for (const b of books) {
    const uid = String(b.ownerId || "");
    const agg = getAgg(uid);

    agg.totalBooks++;
    if (b.status === "done") agg.doneBooks++;
    else if (b.status === "generating") agg.generatingBooks++;
    else if (b.status === "failed") agg.failedBooks++;

    agg.totalPages += Number(b.pagesCount || 0);
    agg.totalImages += Number(b.imagesCount || 0);
    if (b.hasPdf) agg.withPdf++;

    const uAt = String(b.updatedAt || "");
    if (uAt && (!agg.lastUpdatedAt || uAt > agg.lastUpdatedAt)) agg.lastUpdatedAt = uAt;
  }

  const byUserArr = Array.from(byUser.values())
    .sort((a, b) => (b.totalBooks || 0) - (a.totalBooks || 0))
    .map((x) => ({ ...x }));

  // Vendas opcional
  const SALES_FILE = path.join(OUT_DIR, "sales.json");
  const sales = await readJsonSafe(SALES_FILE, []);
  const salesArr = Array.isArray(sales) ? sales : [];
  const soldBooks = salesArr.length;

  let revenueCents = 0;
  for (const s of salesArr) {
    const v = Number(s?.amountCents || 0);
    if (Number.isFinite(v)) revenueCents += v;
  }

  // tamanho do output
  const outSize = existsSyncSafe(OUT_DIR) ? await folderSizeBytes(OUT_DIR) : 0;

  // taxa
  const successRate = counts.totalBooks ? Math.round((counts.doneBooks / counts.totalBooks) * 100) : 0;

  return {
    ok: true,
    generatedAt: new Date().toISOString(),

    users: {
      totalUsers: usersArr.length,
      usersFile: USERS_FILE,
    },

    books: {
      ...counts,
      successRatePercent: successRate,
      lastCreatedAt: lastCreateISO,
      lastUpdatedAt: lastUpdateISO,
      booksDir: BOOKS_DIR,
    },

    sales: {
      enabled: existsSyncSafe(SALES_FILE),
      salesFile: SALES_FILE,
      soldBooks,
      revenueCents,
      revenueBRL: (revenueCents / 100).toFixed(2),
    },

    storage: {
      outDir: OUT_DIR,
      outSizeBytes: outSize,
      outSizeHuman: fmtBytes(outSize),
    },

    topUsers: byUserArr.slice(0, 50),
    recentBooks: books
      .slice()
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .slice(0, 100),
  };
}

// --------------------
// HTML (render)
// --------------------
function renderAdminHtml({ user, allowlistEnabled }) {
  const warn = allowlistEnabled
    ? ""
    : `<div class="banner warn">
        <div class="icon">⚠️</div>
        <div class="content">
          <div class="title">Modo DEV ativo</div>
          <div class="text">
            <code>ADMIN_EMAILS</code> não está definido. Qualquer usuário logado acessa <code>/admin</code>.
            <br/>
            Para restringir: defina <code>ADMIN_EMAILS=email1@email.com,email2@email.com</code> no <code>.env.local</code>.
          </div>
        </div>
      </div>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Admin — Meu Livro Mágico</title>
<style>
  :root{
    --bg0:#070A12;
    --bg1:#0B1020;
    --bg2:#0E1630;
    --panel: rgba(255,255,255,.06);
    --panel2: rgba(255,255,255,.04);
    --border: rgba(255,255,255,.08);
    --text: #EAF0FF;
    --muted:#A9B4D0;

    --blue:#60A5FA;
    --violet:#A78BFA;
    --red:#F87171;
    --amber:#FBBF24;
    --green:#34D399;

    --shadow: 0 18px 60px rgba(0,0,0,.55);
    --radius:18px;
  }

  *{box-sizing:border-box}
  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    color:var(--text);
    min-height:100vh;
    background:
      radial-gradient(900px 500px at 10% 0%, rgba(96,165,250,.15), transparent 55%),
      radial-gradient(900px 500px at 90% 10%, rgba(167,139,250,.12), transparent 60%),
      radial-gradient(700px 400px at 30% 80%, rgba(52,211,153,.06), transparent 60%),
      linear-gradient(to bottom, var(--bg0), var(--bg1) 40%, var(--bg2));
  }

  .container{max-width:1220px;margin:0 auto;padding:18px 16px 90px;}

  .topbar{
    position:sticky; top:0; z-index:20;
    background: rgba(5,8,18,.55);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .topInner{
    max-width:1220px; margin:0 auto; padding:14px 16px;
    display:flex; gap:14px; align-items:center; justify-content:space-between; flex-wrap:wrap;
  }

  .brand{display:flex;flex-direction:column;gap:3px;}
  .brand h1{margin:0;font-size:18px;font-weight:1100;letter-spacing:.2px;}
  .brand .sub{color:var(--muted);font-weight:850;font-size:12.5px}
  .brand .sub b{color:var(--text)}

  .actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}

  .btn{
    border:1px solid rgba(96,165,250,.20);
    background: rgba(96,165,250,.10);
    color: var(--text);
    padding:9px 12px;
    border-radius:999px;
    font-weight:1000;
    text-decoration:none;
    cursor:pointer;
    display:inline-flex; align-items:center; gap:8px;
    transition: transform .06s ease, filter .15s ease, background .15s ease;
    user-select:none;
  }
  .btn:hover{filter:brightness(1.08)}
  .btn:active{transform: translateY(1px)}
  .btn.ghost{
    background: rgba(255,255,255,.04);
    border-color: rgba(255,255,255,.10);
    color: var(--text);
  }
  .btn.danger{
    background: rgba(248,113,113,.10);
    border-color: rgba(248,113,113,.28);
    color: #FFD5D5;
  }
  .btn.primary{
    background: linear-gradient(135deg, rgba(96,165,250,.16), rgba(167,139,250,.14));
    border-color: rgba(167,139,250,.28);
  }

  .grid{
    display:grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap:12px;
    margin-top:14px;
  }

  .card{
    grid-column: span 3;
    background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.035));
    border:1px solid var(--border);
    border-radius:var(--radius);
    box-shadow: var(--shadow);
    padding:14px;
    overflow:hidden;
    position:relative;
  }
  .card::before{
    content:"";
    position:absolute;
    inset:-2px;
    background:
      radial-gradient(600px 120px at 20% 0%, rgba(96,165,250,.10), transparent 60%),
      radial-gradient(600px 120px at 80% 0%, rgba(167,139,250,.10), transparent 60%);
    pointer-events:none;
    opacity:.9;
  }
  .card > *{ position:relative; z-index:1; }

  .card.big{grid-column: span 6;}
  .card.full{grid-column: span 12;}

  @media (max-width: 980px){
    .card{grid-column: span 6;}
    .card.big{grid-column: span 12;}
  }
  @media (max-width: 640px){
    .card{grid-column: span 12;}
  }

  .k{color:var(--muted);font-weight:900;font-size:12px;letter-spacing:.25px;}
  .v{font-weight:1100;font-size:26px;margin-top:6px;}
  .v.small{font-size:13px;font-weight:900;margin-top:4px;color: rgba(234,240,255,.92);}

  .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;}
  .muted{color:var(--muted);}
  .right{text-align:right;}
  .nowrap{white-space:nowrap}

  .row{display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; align-items:center;}
  .chip{
    border:1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.04);
    padding:6px 10px;
    border-radius:999px;
    font-weight:900;
    font-size:12px;
    display:inline-flex; align-items:center; gap:6px;
    color: rgba(234,240,255,.92);
  }
  .dot{width:8px;height:8px;border-radius:999px;display:inline-block;}
  .dot.good{background:rgba(52,211,153,.9)}
  .dot.mid{background:rgba(167,139,250,.9)}
  .dot.bad{background:rgba(248,113,113,.9)}
  .dot.neu{background:rgba(169,180,208,.9)}

  .banner{
    margin-top:14px;
    padding:12px 12px;
    border-radius:16px;
    border: 1px solid rgba(255,255,255,.08);
    background: rgba(255,255,255,.04);
    box-shadow: 0 16px 30px rgba(0,0,0,.35);
    display:flex; gap:10px; align-items:flex-start;
  }
  .banner.warn{ border-color: rgba(251,191,36,.22); background: rgba(251,191,36,.06); }
  .banner.err{ border-color: rgba(248,113,113,.22); background: rgba(248,113,113,.06); }
  .banner .icon{
    width:36px; height:36px; border-radius:12px;
    display:flex; align-items:center; justify-content:center;
    border:1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.05);
    font-size:18px;
    flex:0 0 auto;
  }
  .banner.warn .icon{ border-color: rgba(251,191,36,.25); background: rgba(251,191,36,.10); }
  .banner.err .icon{ border-color: rgba(248,113,113,.25); background: rgba(248,113,113,.10); }
  .banner .title{font-weight:1100}
  .banner .text{margin-top:4px; color:rgba(169,180,208,.90); font-weight:850; line-height:1.5}
  .banner code{font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight:1100;}

  .splitHead{
    display:flex; align-items:flex-end; justify-content:space-between; gap:10px; flex-wrap:wrap;
    margin-top:2px;
  }
  .tools{
    display:flex; gap:8px; align-items:center; flex-wrap:wrap;
  }

  .input{
    padding:9px 12px;
    border-radius:999px;
    border:1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.04);
    color: var(--text);
    font-weight:900;
    outline:none;
    box-shadow: 0 10px 25px rgba(0,0,0,.20);
  }
  .input::placeholder{ color: rgba(169,180,208,.65); }
  .input:focus{
    border-color: rgba(96,165,250,.40);
    box-shadow: 0 0 0 4px rgba(96,165,250,.10), 0 10px 25px rgba(0,0,0,.25);
  }

  .table{
    width:100%;
    border-collapse:collapse;
    margin-top:10px;
    font-size:13px;
  }
  .table th,.table td{
    border-bottom:1px solid rgba(255,255,255,.06);
    padding:10px 8px;
    text-align:left;
    vertical-align:top;
  }
  .table th{
    font-size:12px;
    color: var(--muted);
    font-weight:1100;
    cursor:pointer;
    user-select:none;
    white-space:nowrap;
  }
  .table th:hover{color: rgba(234,240,255,.92)}
  .table tr:hover td{background: rgba(255,255,255,.02)}

  .badge{
    display:inline-flex;align-items:center;gap:8px;
    padding:6px 10px;border-radius:999px;
    font-weight:1100;font-size:12px;
    border:1px solid rgba(255,255,255,.10);
    background:rgba(255,255,255,.04);
    color: rgba(234,240,255,.92);
  }
  .bDone{background: rgba(52,211,153,.10); border-color: rgba(52,211,153,.22); color:#BFFFEA;}
  .bGen{background: rgba(167,139,250,.10); border-color: rgba(167,139,250,.22); color:#E6DDFF;}
  .bFail{background: rgba(248,113,113,.10); border-color: rgba(248,113,113,.22); color:#FFD5D5;}
  .bCr{background: rgba(169,180,208,.08); border-color: rgba(169,180,208,.16); color:#DCE5FF;}

  .pillLink{
    display:inline-flex; align-items:center; gap:8px;
    padding:7px 10px;
    border-radius:999px;
    font-weight:1000;
    border:1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.04);
    text-decoration:none;
    color: rgba(234,240,255,.92);
    white-space:nowrap;
  }
  .pillLink:hover{filter:brightness(1.08)}
  .pillLink.primary{
    border-color: rgba(167,139,250,.24);
    background: rgba(167,139,250,.10);
    color:#EFE8FF;
  }

  .footer{
    position:fixed; left:0; right:0; bottom:0;
    background: rgba(5,8,18,.62);
    backdrop-filter: blur(16px);
    border-top: 1px solid rgba(255,255,255,.06);
    padding: 10px 14px;
    z-index:30;
  }
  .footerInner{
    max-width:1220px;margin:0 auto;
    display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;
  }

  .skeleton{
    position:relative;
    overflow:hidden;
    background: rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.08);
    border-radius:14px;
    height:14px;
  }
  .skeleton::after{
    content:"";
    position:absolute; inset:-60% -40%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.30), transparent);
    transform: translateX(-40%);
    animation: shimmer 1.2s infinite;
  }
  @keyframes shimmer{ to { transform: translateX(40%); } }

  .tiny{font-size:12px}
</style>
</head>
<body>

<div class="topbar">
  <div class="topInner">
    <div class="brand">
      <h1>🛠️ Admin — Meu Livro Mágico</h1>
      <div class="sub">Logado como <b>${escapeHtml(user?.name || "Usuário")}</b> <span class="muted">(${escapeHtml(
    user?.email || ""
  )})</span></div>
    </div>
    <div class="actions">
      <a class="btn primary" href="/create">✨ Gerador</a>
      <a class="btn primary" href="/books">📚 Meus Livros</a>
      <a class="btn primary" href="/sales">🛒 Vendas</a>
      <button class="btn ghost" id="btnRefresh">🔄 Atualizar</button>
      <button class="btn danger" id="btnLogout">🚪 Sair</button>
    </div>
  </div>
</div>

<div class="container">
  ${warn}

  <div id="bannerError" class="banner err" style="display:none;">
    <div class="icon">❌</div>
    <div class="content">
      <div class="title">Falha ao carregar dados</div>
      <div class="text" id="errText">—</div>
    </div>
  </div>

  <div class="grid" id="grid">
    <div class="card">
      <div class="k">Usuários cadastrados</div>
      <div class="v" id="kUsers"><div class="skeleton" style="width:70%"></div></div>
      <div class="v small muted mono" id="kUsersFile"><div class="skeleton" style="width:100%"></div></div>
    </div>

    <div class="card">
      <div class="k">Livros (total)</div>
      <div class="v" id="kBooksTotal"><div class="skeleton" style="width:45%"></div></div>
      <div class="row">
        <span class="chip"><span class="dot good"></span>done: <b id="kBooksDone">—</b></span>
        <span class="chip"><span class="dot mid"></span>gerando: <b id="kBooksGen">—</b></span>
        <span class="chip"><span class="dot bad"></span>falhou: <b id="kBooksFail">—</b></span>
      </div>
    </div>

    <div class="card">
      <div class="k">PDFs prontos</div>
      <div class="v" id="kWithPdf"><div class="skeleton" style="width:50%"></div></div>
      <div class="v small muted">capas: <b id="kWithCover">—</b></div>
    </div>

    <div class="card">
      <div class="k">Taxa de sucesso</div>
      <div class="v" id="kSuccess"><div class="skeleton" style="width:55%"></div></div>
      <div class="v small muted">baseado em <span id="kTotalForRate">—</span> livros</div>
    </div>

    <div class="card big">
      <div class="k">Saúde do sistema</div>
      <div class="row" style="margin-top:8px">
        <span class="chip">✅ Done: <b id="hDone">—</b></span>
        <span class="chip">🟣 Gerando: <b id="hGen">—</b></span>
        <span class="chip">❌ Falhas: <b id="hFail">—</b></span>
      </div>

      <div style="margin-top:10px">
        <div class="k">Conclusão (livros finalizados)</div>
        <div style="height:10px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);overflow:hidden;margin-top:8px">
          <div id="barDone" style="height:100%;width:0%;background:linear-gradient(90deg, rgba(52,211,153,.65), rgba(96,165,250,.55));"></div>
        </div>
        <div class="v small muted" id="barText">—</div>
      </div>
    </div>

    <div class="card big">
      <div class="k">Armazenamento (output/)</div>
      <div class="v" id="kOutSize"><div class="skeleton" style="width:40%"></div></div>
      <div class="v small muted mono" id="kOutDir"><div class="skeleton" style="width:100%"></div></div>
      <div class="row">
        <span class="chip">Último livro: <b id="kLastCreated">—</b></span>
        <span class="chip">Última atualização: <b id="kLastUpdated">—</b></span>
      </div>
    </div>

    <div class="card big">
      <div class="k">Vendas (opcional via output/sales.json)</div>
      <div class="row">
        <span class="chip">Ativo: <b id="kSalesEnabled">—</b></span>
        <span class="chip">Vendidos: <b id="kSoldBooks">—</b></span>
        <span class="chip">Receita (R$): <b id="kRevenue">—</b></span>
      </div>
      <div class="v small muted mono" id="kSalesFile"><div class="skeleton" style="width:100%"></div></div>
    </div>

    <div class="card full">
      <div class="splitHead">
        <div>
          <div class="k">Top usuários (por livros)</div>
          <div class="tiny muted" id="usersHint">Clique nos títulos para ordenar</div>
        </div>
        <div class="tools">
          <input class="input" id="qUsers" placeholder="Buscar usuário (nome/e-mail)..." />
        </div>
      </div>
      <table class="table" id="tblUsers">
        <thead>
          <tr>
            <th data-sort="user">Usuário</th>
            <th class="right" data-sort="totalBooks">Livros</th>
            <th class="right" data-sort="doneBooks">Done</th>
            <th class="right" data-sort="generatingBooks">Gerando</th>
            <th class="right" data-sort="failedBooks">Falhou</th>
            <th class="right" data-sort="withPdf">PDFs</th>
            <th class="nowrap" data-sort="lastUpdatedAt">Última atividade</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>

    <div class="card full">
      <div class="splitHead">
        <div>
          <div class="k">Livros recentes</div>
          <div class="tiny muted">Ações rápidas: Abrir / Editar / PDF</div>
        </div>
        <div class="tools">
          <input class="input" id="qBooks" placeholder="Buscar livro (id/tema/criança)..." />
        </div>
      </div>

      <table class="table" id="tblBooks">
        <thead>
          <tr>
            <th data-sort="id">ID</th>
            <th data-sort="ownerId">Owner</th>
            <th data-sort="status">Status</th>
            <th data-sort="theme">Tema</th>
            <th data-sort="childName">Criança</th>
            <th class="right" data-sort="pagesCount">Páginas</th>
            <th class="right" data-sort="imagesCount">Imagens</th>
            <th class="nowrap" data-sort="updatedAt">Atualizado</th>
            <th class="right">Ações</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>

  </div>
</div>

<div class="footer">
  <div class="footerInner">
    <div class="muted tiny">Dica: defina <span class="mono">ADMIN_EMAILS</span> no <span class="mono">.env.local</span> para restringir acesso.</div>
    <div class="actions">
      <span class="chip" id="lastLoaded">Carregando…</span>
    </div>
  </div>
</div>

<script>
  const $ = (id) => document.getElementById(id);

  function esc(s){
    return String(s ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function setText(id, v){ const el=$(id); if(!el) return; el.textContent = v == null ? "—" : String(v); }

  function fmtDateBR(iso){
    try{
      const d = new Date(String(iso||""));
      if (!isFinite(d.getTime())) return String(iso||"—");
      const pad2=(n)=> (String(n).length===1 ? "0"+n : ""+n);
      return pad2(d.getDate())+"/"+pad2(d.getMonth()+1)+"/"+d.getFullYear()+" "+pad2(d.getHours())+":"+pad2(d.getMinutes());
    }catch{ return String(iso||"—"); }
  }

  function statusBadge(st){
    const s = String(st||"created");
    if (s==="done") return '<span class="badge bDone">✅ done</span>';
    if (s==="generating") return '<span class="badge bGen">🟣 generating</span>';
    if (s==="failed") return '<span class="badge bFail">❌ failed</span>';
    return '<span class="badge bCr">⚪ created</span>';
  }

  async function fetchStats(){
    const r = await fetch("/api/admin/stats", { headers: { "Accept":"application/json" }, cache:"no-store" });
    const j = await r.json().catch(()=>({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Falha ao carregar stats");
    return j;
  }

  function td(html, cls){
    const el = document.createElement("td");
    if (cls) el.className = cls;
    el.innerHTML = html;
    return el;
  }

  const state = {
    stats: null,
    usersSort: { key: "totalBooks", dir: "desc" },
    booksSort: { key: "updatedAt", dir: "desc" }
  };

  function sortArr(arr, key, dir){
    const mult = dir === "asc" ? 1 : -1;
    const get = (o) => (o && o[key] != null ? o[key] : "");
    return arr.slice().sort((a,b)=>{
      let av = get(a), bv = get(b);
      const an = Number(av), bn = Number(bv);
      const aNum = Number.isFinite(an) && String(av).trim() !== "";
      const bNum = Number.isFinite(bn) && String(bv).trim() !== "";
      if (aNum && bNum) return (an - bn) * mult;
      return String(av).localeCompare(String(bv)) * mult;
    });
  }

  function applyUsers(){
    const s = state.stats;
    if (!s) return;

    const q = String($("qUsers").value || "").trim().toLowerCase();
    let arr = (s.topUsers || []).slice();
    if (q){
      arr = arr.filter(u => {
        const name = String(u.name||"").toLowerCase();
        const email = String(u.email||"").toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }

    arr = sortArr(arr, state.usersSort.key, state.usersSort.dir);

    const tbU = $("tblUsers").querySelector("tbody");
    tbU.innerHTML = "";
    arr.forEach(u => {
      const tr = document.createElement("tr");
      const who =
        (u.name ? "<b>"+esc(u.name)+"</b> " : "<b>(sem nome)</b> ") +
        (u.email ? "<span class='muted'>("+esc(u.email)+")</span>" : "");
      tr.appendChild(td(who));
      tr.appendChild(td(String(u.totalBooks||0), "right"));
      tr.appendChild(td(String(u.doneBooks||0), "right"));
      tr.appendChild(td(String(u.generatingBooks||0), "right"));
      tr.appendChild(td(String(u.failedBooks||0), "right"));
      tr.appendChild(td(String(u.withPdf||0), "right"));
      tr.appendChild(td(u.lastUpdatedAt ? fmtDateBR(u.lastUpdatedAt) : "—", "nowrap"));
      tbU.appendChild(tr);
    });
  }

  function applyBooks(){
    const s = state.stats;
    if (!s) return;

    const q = String($("qBooks").value || "").trim().toLowerCase();
    let arr = (s.recentBooks || []).slice();
    if (q){
      arr = arr.filter(b => {
        const id = String(b.id||"").toLowerCase();
        const theme = String(b.theme||"").toLowerCase();
        const child = String(b.childName||"").toLowerCase();
        return id.includes(q) || theme.includes(q) || child.includes(q);
      });
    }

    arr = sortArr(arr, state.booksSort.key, state.booksSort.dir);

    const tbB = $("tblBooks").querySelector("tbody");
    tbB.innerHTML = "";
    arr.forEach(b => {
      const tr = document.createElement("tr");
      tr.appendChild(td("<span class='mono'>"+esc(b.id)+"</span>"));
      tr.appendChild(td(b.ownerId ? "<span class='mono'>"+esc(b.ownerId)+"</span>" : "—"));
      tr.appendChild(td(statusBadge(b.status)));
      tr.appendChild(td(esc(b.theme || "—")));
      tr.appendChild(td(esc(b.childName || "—")));
      tr.appendChild(td(String(b.pagesCount||0), "right"));
      tr.appendChild(td(String(b.imagesCount||0), "right"));
      tr.appendChild(td(b.updatedAt ? fmtDateBR(b.updatedAt) : "—", "nowrap"));

      const key = b.dirId || b.id; // ✅ SEMPRE usar pasta
      const actions = [];
      if (key) actions.push("<a class='pillLink primary' href='/books/"+encodeURIComponent(key)+"'>Abrir</a>");
      if (key) actions.push("<a class='pillLink' href='/books/"+encodeURIComponent(key)+"/edit'>Editar</a>");
      if (b.hasPdf && key) actions.push("<a class='pillLink' href='/download/"+encodeURIComponent(key)+"'>PDF</a>");

      tr.appendChild(td(actions.join(" "), "right nowrap"));
      tbB.appendChild(tr);
    });
  }

  function showError(msg){
    $("bannerError").style.display = "";
    $("errText").textContent = String(msg || "Erro");
  }
  function hideError(){
    $("bannerError").style.display = "none";
    $("errText").textContent = "";
  }

  function updateHealth(s){
    setText("hDone", s.books.doneBooks);
    setText("hGen", s.books.generatingBooks);
    setText("hFail", s.books.failedBooks);

    const total = Number(s.books.totalBooks || 0);
    const done = Number(s.books.doneBooks || 0);
    const pct = total ? Math.round((done / total) * 100) : 0;

    const bar = $("barDone");
    if (bar) bar.style.width = pct + "%";

    setText("barText", total ? (pct + "% de livros finalizados") : "Sem livros ainda");
  }

  async function render(){
    try{
      hideError();

      $("btnRefresh").disabled = true;
      $("btnRefresh").textContent = "⏳ Atualizando…";

      const s = await fetchStats();
      state.stats = s;

      setText("kUsers", s.users.totalUsers);
      setText("kUsersFile", s.users.usersFile);

      setText("kBooksTotal", s.books.totalBooks);
      setText("kBooksDone", s.books.doneBooks);
      setText("kBooksGen", s.books.generatingBooks);
      setText("kBooksFail", s.books.failedBooks);

      setText("kWithPdf", s.books.withPdf);
      setText("kWithCover", s.books.withCover);

      setText("kSuccess", (s.books.successRatePercent||0) + "%");
      setText("kTotalForRate", s.books.totalBooks);

      setText("kOutSize", s.storage.outSizeHuman);
      setText("kOutDir", s.storage.outDir);

      setText("kLastCreated", s.books.lastCreatedAt ? fmtDateBR(s.books.lastCreatedAt) : "—");
      setText("kLastUpdated", s.books.lastUpdatedAt ? fmtDateBR(s.books.lastUpdatedAt) : "—");

      setText("kSalesEnabled", s.sales.enabled ? "sim" : "não");
      setText("kSoldBooks", s.sales.soldBooks);
      setText("kRevenue", s.sales.revenueBRL);
      setText("kSalesFile", s.sales.salesFile);

      updateHealth(s);

      $("lastLoaded").textContent = "Atualizado: " + fmtDateBR(new Date().toISOString());

      applyUsers();
      applyBooks();
    }catch(e){
      showError(e && e.message ? e.message : String(e));
    }finally{
      $("btnRefresh").disabled = false;
      $("btnRefresh").textContent = "🔄 Atualizar";
    }
  }

  function hookSorting(){
    const thUsers = $("tblUsers").querySelectorAll("thead th[data-sort]");
    thUsers.forEach(th=>{
      th.addEventListener("click", ()=>{
        const key = th.getAttribute("data-sort");
        const cur = state.usersSort;
        if (cur.key === key) cur.dir = (cur.dir === "asc" ? "desc" : "asc");
        else { cur.key = key; cur.dir = "desc"; }
        applyUsers();
      });
    });

    const thBooks = $("tblBooks").querySelectorAll("thead th[data-sort]");
    thBooks.forEach(th=>{
      th.addEventListener("click", ()=>{
        const key = th.getAttribute("data-sort");
        const cur = state.booksSort;
        if (cur.key === key) cur.dir = (cur.dir === "asc" ? "desc" : "asc");
        else { cur.key = key; cur.dir = "desc"; }
        applyBooks();
      });
    });
  }

  $("qUsers").addEventListener("input", ()=> applyUsers());
  $("qBooks").addEventListener("input", ()=> applyBooks());

  $("btnLogout").onclick = async () => {
    try{ await fetch("/api/auth/logout", { method:"POST" }); }catch{}
    window.location.href = "/login";
  };

  $("btnRefresh").onclick = () => render();

  hookSorting();
  render();
</script>

</body>
</html>`;
}

// --------------------
// Mount (Express)
// --------------------
module.exports = function mountAdminPage(app, { OUT_DIR, USERS_FILE, requireAuth } = {}) {
  if (!app) throw new Error("admin.page.js: app é obrigatório");
  if (!OUT_DIR) throw new Error("admin.page.js: OUT_DIR é obrigatório");
  USERS_FILE = USERS_FILE || path.join(OUT_DIR, "users.json");
  if (typeof requireAuth !== "function") throw new Error("admin.page.js: requireAuth é obrigatório");

  // ✅ FORÇA SEMPRE: <OUT_DIR>/books (global)
  const RESOLVED_BOOKS_DIR = path.resolve(String(OUT_DIR), "books");

  ensureDir(OUT_DIR).catch(() => {});
  ensureDir(RESOLVED_BOOKS_DIR).catch(() => {});

  // HTML
  app.get("/admin", requireAuth, requireAdmin, async (req, res) => {
    try {
      const allowlistEnabled = getAdminEmailAllowlist().length > 0;
      res.type("html").send(renderAdminHtml({ user: req.user, allowlistEnabled }));
    } catch (e) {
      res.status(500).type("html").send("<h1>Erro</h1><pre>" + escapeHtml(String(e?.message || e)) + "</pre>");
    }
  });

  // JSON stats
  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await computeStats({
        OUT_DIR,
        BOOKS_DIR: RESOLVED_BOOKS_DIR,
        USERS_FILE,
      });
      return res.json(stats);
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  // JSON users + métricas
  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await computeStats({
        OUT_DIR,
        BOOKS_DIR: RESOLVED_BOOKS_DIR,
        USERS_FILE,
      });
      return res.json({
        ok: true,
        totalUsers: stats.users.totalUsers,
        topUsers: stats.topUsers,
        generatedAt: stats.generatedAt,
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  // logs
  const allow = getAdminEmailAllowlist();
  if (!allow.length) {
    console.warn("⚠️  /admin em modo DEV: defina ADMIN_EMAILS no .env.local para restringir acesso.");
  } else {
    console.log("✅ /admin restrito por ADMIN_EMAILS:", allow.join(", "));
  }
  console.log("📁 Admin lendo livros de:", RESOLVED_BOOKS_DIR);

  return true;
};