/**
 * partners.page.js — Central de Parceiros (Supabase)
 * Rotas:
 *  - GET  /parceiros
 *  - GET  /parceiros/cadastro?tipo=fabricacao|venda
 *  - POST /parceiros/cadastro
 *  - GET  /parceiros/login
 *  - POST /parceiros/login
 *  - GET  /parceiros/sair
 *  - GET  /parceiros/esqueci
 *  - POST /parceiros/esqueci
 *  - GET  /parceiros/redefinir?token=...
 *  - POST /parceiros/redefinir
 *  - GET  /parceiros/perfil/:id
 *
 * Persistência: Supabase (tables: public.partners, public.partner_orders)
 *
 * ENV necessário (backend):
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY   (⚠️ somente no servidor)
 *  - PARTNER_COOKIE_SECRET       (assinar cookie; obrigatório em produção)
 */

"use strict";

const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

module.exports = function mountPartnersPage(app, opts = {}) {
  app.use(express.urlencoded({ extended: true }));
    // ✅ Vercel/Proxy: garante que Express respeite x-forwarded-proto/host
  // (importante para evitar comportamento estranho com cookies/redirects)
  app.set("trust proxy", 1);

  // ✅ Anti-loop de trailing slash:
  // Se a Vercel (ou config) adicionar "/" no final, a gente remove 1 vez e pronto.
  /** 
   app.use((req, res, next) => {
    if (req.path.length > 1 && req.path.endsWith("/")) {
      const qs = req.url.slice(req.path.length); // preserva "?..."
      return res.redirect(308, req.path.slice(0, -1) + qs);
    }
    next();
  });*/
const isDev = process.env.NODE_ENV !== "production";
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[partners] ENV faltando:", {
      hasUrl: !!SUPABASE_URL,
      hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
    });
    throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env/Vercel.");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

// ===== Email (Gmail SMTP via Nodemailer) =====
// ===== Email (Brevo API) =====
const SibApiV3Sdk = require("sib-api-v3-sdk");

const BREVO_API_KEY = String(process.env.BREVO_API_KEY || "").trim();
const PARTNER_RESET_FROM = String(process.env.PARTNER_RESET_FROM || "").trim();
const PARTNER_RESET_FROM_NAME = String(
  process.env.PARTNER_RESET_FROM_NAME || "Meu Livro Mágico"
).trim();

let brevoClient = null;

if (BREVO_API_KEY) {
  const client = SibApiV3Sdk.ApiClient.instance;
  const apiKey = client.authentications["api-key"];
  apiKey.apiKey = BREVO_API_KEY;

  brevoClient = new SibApiV3Sdk.TransactionalEmailsApi();
}

async function sendResetEmail(toEmail, resetUrl) {
  if (!brevoClient) {
    const msg = "Brevo não configurado. Defina BREVO_API_KEY.";
    console.warn("[partners] " + msg);
    return { ok: false, error: msg };
  }

  const html = `
    <div style="font-family:Arial,sans-serif; line-height:1.6;">
      <h2>Redefinir sua senha</h2>
      <p>Clique no botão abaixo para criar uma nova senha:</p>
      <p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 16px;border-radius:10px;
                  background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;">
          Redefinir senha
        </a>
      </p>
      <p>Ou copie o link:</p>
      <p>${resetUrl}</p>
      <p>Esse link expira em 30 minutos.</p>
    </div>
  `;

  try {
    const response = await brevoClient.sendTransacEmail({
      sender: {
        email: PARTNER_RESET_FROM,
        name: PARTNER_RESET_FROM_NAME,
      },
      to: [{ email: toEmail }],
      subject: "Redefinição de senha — Parceiros (Meu Livro Mágico)",
      htmlContent: html,
    });

    console.log("[partners] email enviado (Brevo):", response.messageId);

    return { ok: true, id: response.messageId };
  } catch (err) {
    const msg = err?.response?.body?.message || err?.message || String(err);
    console.error("[partners] brevo error:", msg);
    return { ok: false, error: msg };
  }
}
  // =========================
  // Helpers
  // =========================
  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function moneyBR(v) {
    const n = Number(v || 0);
    return n.toFixed(2).replace(".", ",");
  }

  function statusLabel(s) {
    const st = String(s || "").toLowerCase();
    if (st === "para_aceitar") return "📥 Para aceitar";
    if (st === "em_fabricacao") return "🏭 Em fabricação";
    if (st === "finalizado") return "✅ Finalizado";
    if (st === "retorno") return "↩️ Retorno";
    if (st === "cancelado") return "⛔ Cancelado";
    return st || "-";
  }

  // =========================
  // Password hashing (PBKDF2)
  // =========================
  // Formato: pbkdf2$sha256$210000$saltBase64$hashBase64
  const PBKDF2_ITER = 210000;
  const PBKDF2_KEYLEN = 32;
  const PBKDF2_DIGEST = "sha256";

  function hashPassword(plain) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(String(plain), salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST);
    return `pbkdf2$${PBKDF2_DIGEST}$${PBKDF2_ITER}$${salt.toString("base64")}$${hash.toString("base64")}`;
  }

  function safeEqualBuf(a, b) {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  }

  function verifyPassword(plain, stored) {
    try {
      const parts = String(stored || "").split("$");
      if (parts.length !== 5) return false;
      const [kind, digest, iterStr, saltB64, hashB64] = parts;
      if (kind !== "pbkdf2") return false;

      const iter = Number(iterStr);
      if (!Number.isFinite(iter) || iter < 10000) return false;

      const salt = Buffer.from(saltB64, "base64");
      const expected = Buffer.from(hashB64, "base64");

      const got = crypto.pbkdf2Sync(String(plain), salt, iter, expected.length, digest);
      return safeEqualBuf(got, expected);
    } catch {
      return false;
    }
  }

  // =========================
  // Cookie session (simples, assinado)
  // =========================
  const COOKIE_NAME = "mlm_partner";
  const COOKIE_SECRET = process.env.PARTNER_COOKIE_SECRET || (isDev ? "dev-secret-change-me" : "");

  function hmacId(id) {
    if (!COOKIE_SECRET) return "";
    return crypto.createHmac("sha256", COOKIE_SECRET).update(String(id)).digest("hex");
  }

  function makeCookieValue(id) {
    const sig = hmacId(id);
    return `${id}.${sig}`;
  }

  function parseCookies(req) {
    const raw = req.headers.cookie || "";
    const out = {};
    raw.split(";").forEach((p) => {
      const idx = p.indexOf("=");
      if (idx === -1) return;
      const k = p.slice(0, idx).trim();
      const v = p.slice(idx + 1).trim();
      if (!k) return;
      out[k] = decodeURIComponent(v);
    });
    return out;
  }

  function setCookie(res, name, value, { maxAgeSec = 60 * 60 * 24 * 30 } = {}) {
    const parts = [
      `${name}=${encodeURIComponent(value)}`,
      `Path=/`,
      `Max-Age=${Math.max(0, Number(maxAgeSec) || 0)}`,
      `HttpOnly`,
      `SameSite=Lax`,
    ];
    if (!isDev) parts.push("Secure");
    res.setHeader("Set-Cookie", parts.join("; "));
  }

  function clearCookie(res, name) {
    const parts = [`${name}=`, `Path=/`, `Max-Age=0`, `HttpOnly`, `SameSite=Lax`];
    if (!isDev) parts.push("Secure");
    res.setHeader("Set-Cookie", parts.join("; "));
  }

  function getPartnerIdFromCookie(req) {
    const cookies = parseCookies(req);
    const v = cookies[COOKIE_NAME];
    if (!v) return null;
    const [id, sig] = String(v).split(".");
    if (!id || !sig) return null;
    if (!COOKIE_SECRET) return null;
    if (hmacId(id) !== sig) return null;
    return id;
  }

  function requirePartnerAuthForId(req, res, partnerId) {
    const loggedId = getPartnerIdFromCookie(req);
    if (loggedId && String(loggedId) === String(partnerId)) return true;
    const next = encodeURIComponent(String(partnerId));
    res.redirect(`/parceiros/login?next=${next}`);
    return false;
  }

  // =========================
  // Reset token (Esqueci senha)
  // =========================
  function sha256Hex(s) {
    return crypto.createHash("sha256").update(String(s)).digest("hex");
  }

  function genResetToken() {
    // token forte (URL-safe)
    const raw = crypto.randomBytes(32).toString("base64url");
    return raw;
  }

  function normalizePhoneBR(whats) {
    // tenta extrair só dígitos e montar no padrão 55DDDNXXXXXXXX
    const digits = String(whats || "").replace(/\D+/g, "");
    if (!digits) return "";
    // se já começa com 55 e tem tamanho adequado, retorna
    if (digits.startsWith("55") && digits.length >= 12) return digits;
    // se tem 10 ou 11 dígitos (DDD + número), prefixa 55
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    // fallback
    return digits;
  }

 function getBaseUrl(req) {
  // Preferível: base fixa em produção (evita host errado atrás de proxy)
  const fixed = String(process.env.PUBLIC_BASE_URL || "").trim();
  if (fixed) return fixed.replace(/\/+$/, "");

  const xfProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = xfProto || req.protocol || "https";

  const xfHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const host = xfHost || req.get("host") || "seusite.com";

  return `${proto}://${host}`;
}

  // =========================
  // Layout
  // =========================
  function layout(title, innerHtml, navRightHtml) {
    const right = navRightHtml
      ? navRightHtml
      : `
        <a class="btn btnOutline" href="/sales">⬅️ Voltar</a>
        <a class="btn btnPrimary" href="/parceiros">Central</a>
      `;

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)}</title>
  <meta name="description" content="Central de Parceiros do Meu Livro Mágico"/>
  <style>
    :root{
      --violet-50:#f5f3ff; --pink-50:#fff1f2; --white:#ffffff;
      --gray-900:#111827; --gray-800:#1f2937; --gray-600:#4b5563;
      --violet-600:#7c3aed; --violet-700:#6d28d9;
      --pink-600:#db2777; --pink-700:#be185d;
      --shadow2: 0 12px 30px rgba(17,24,39,.10);
      --r: 22px;
    }
    *{ box-sizing:border-box; }
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      color: var(--gray-800);
      background: linear-gradient(180deg, var(--violet-50), var(--white) 46%, var(--pink-50));
      overflow-x:hidden;
    }
    a{ color:inherit; text-decoration:none; }
    .wrap{ max-width: 1100px; margin: 0 auto; padding: 0 16px; }
    .nav{ padding: 16px 0; display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .brand{ display:flex; align-items:center; gap:10px; font-weight:1000; letter-spacing:-.2px; }
    .logo{
      width:42px;height:42px;border-radius:14px; display:grid;place-items:center;
      background: linear-gradient(135deg, rgba(124,58,237,.14), rgba(219,39,119,.14));
      border: 1px solid rgba(124,58,237,.18);
      box-shadow: var(--shadow2); font-size:20px;
    }
    .btn{
      border:0; cursor:pointer; user-select:none;
      display:inline-flex; align-items:center; justify-content:center; gap:10px;
      padding: 12px 16px; border-radius: 999px; font-weight: 900;
      transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
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
    .btnOutline:hover{ background: rgba(245,243,255,.95); border-color: rgba(196,181,253,.95); }

    .btnDanger{
      color: rgba(127,29,29,.95);
      background: rgba(254,226,226,.65);
      border: 2px solid rgba(220,38,38,.20);
      box-shadow: 0 12px 26px rgba(17,24,39,.06);
    }
    .btnDanger:hover{ background: rgba(254,202,202,.75); border-color: rgba(220,38,38,.28); }

    .card{
      background:#fff;
      border: 1px solid rgba(17,24,39,.06);
      border-radius: var(--r);
      box-shadow: var(--shadow2);
      padding: 18px;
    }
    .h1{ margin: 18px 0 10px; font-size: 34px; line-height:1.08; letter-spacing:-.8px; font-weight:1000; }
    .p{ margin:0; color: var(--gray-600); font-weight: 750; line-height:1.65; }
    .grid2{ display:grid; gap:14px; grid-template-columns: 1fr; }
    @media(min-width: 860px){ .grid2{ grid-template-columns: 1fr 1fr; } }
    .opt{
      border-radius: 18px;
      border: 1px solid rgba(124,58,237,.14);
      background: linear-gradient(180deg, rgba(124,58,237,.06), rgba(219,39,119,.04));
      padding: 16px;
      box-shadow: 0 14px 28px rgba(124,58,237,.08);
    }
    .opt h3{ margin:0 0 6px; font-size: 18px; font-weight:1000; }
    .opt p{ margin:0 0 12px; color: var(--gray-600); font-weight:750; line-height:1.6; }
    .formRow{ display:grid; gap:12px; grid-template-columns: 1fr; }
    @media(min-width: 860px){ .formRow{ grid-template-columns: 1fr 1fr; } }
    label{ display:block; font-weight:900; font-size: 13px; margin: 0 0 6px; color: rgba(31,41,55,.9); }
    input, select, textarea{
      width:100%;
      padding: 12px 12px;
      border-radius: 14px;
      border: 1px solid rgba(17,24,39,.10);
      background: rgba(255,255,255,.92);
      outline: none;
      font-weight: 750;
      color: rgba(17,24,39,.88);
    }
    textarea{ min-height: 92px; resize: vertical; }
    .dash{ display:grid; gap:14px; grid-template-columns: 1fr; margin-top: 16px; }
    @media(min-width: 980px){ .dash{ grid-template-columns: 280px 1fr; } }
    .menu a{
      display:flex; gap:10px; align-items:center;
      padding: 10px 12px; border-radius: 14px;
      font-weight: 900; color: rgba(31,41,55,.92);
      border: 1px solid rgba(17,24,39,.06);
      background: rgba(255,255,255,.70);
      margin-bottom: 10px;
    }
    .menu a:hover{ background: rgba(245,243,255,.92); border-color: rgba(196,181,253,.95); }
    .kpi{ display:grid; gap:12px; grid-template-columns: 1fr; }
    @media(min-width: 860px){ .kpi{ grid-template-columns: 1fr 1fr 1fr; } }
    .kpi .box{
      border-radius: 18px; border: 1px solid rgba(17,24,39,.06);
      background: #fff; padding: 14px; box-shadow: 0 12px 26px rgba(17,24,39,.06);
    }
    .kpi .t{ font-weight: 900; color: rgba(75,85,99,.92); font-size: 12px; }
    .kpi .v{ font-weight: 1000; font-size: 20px; margin-top: 6px; }
    .muted{ color: rgba(75,85,99,.9); font-weight:750; }
    .table{ width:100%; border-collapse: collapse; }
    .table th, .table td{
      text-align:left; padding:10px 10px;
      border-bottom: 1px solid rgba(17,24,39,.08);
      font-weight:750; vertical-align:top;
    }
    .table th{ font-weight:1000; color: rgba(75,85,99,.95); font-size:12px; }
    .pill{
      display:inline-flex; padding:6px 10px; border-radius:999px;
      border:1px solid rgba(17,24,39,.10);
      background: rgba(245,243,255,.72);
      font-weight:900; font-size:12px;
    }
    .err{
      margin-top:12px; padding:12px; border-radius:14px;
      border: 1px solid rgba(220,38,38,.25);
      background: rgba(254,226,226,.55);
      font-weight:800;
      color: rgba(127,29,29,.95);
      white-space:pre-wrap;
    }
    .ok{
      margin-top:12px; padding:12px; border-radius:14px;
      border: 1px solid rgba(16,185,129,.25);
      background: rgba(209,250,229,.55);
      font-weight:800;
      color: rgba(6,95,70,.95);
      white-space:pre-wrap;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="nav">
      <div class="brand">
        <div class="logo">🤝</div>
        <div>Parceiros • Meu Livro Mágico</div>
      </div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        ${right}
      </div>
    </div>

    ${innerHtml}

    <div style="padding: 26px 0 34px; color: rgba(75,85,99,.9); text-align:center; font-weight:750; font-size: 13px;">
      Feito com 💜 • Parceiros Meu Livro Mágico
    </div>
  </div>
</body>
</html>`;
  }

  // =========================
  // GET /parceiros  (Seja Parceiro) — botão "Login"
  // =========================
  app.get("/parceiros", (req, res) => {
    res.type("html").send(
      layout(
        "Seja Parceiro",
        `
      <div class="card">
        <div class="h1">Seja Parceiro 🤝</div>
        <p class="p">Escolha como você quer ganhar com o Meu Livro Mágico: <b>Fabricando</b> os livros na sua cidade ou <b>Vendendo</b> com seu link de divulgação.</p>
        <div style="height:14px"></div>

        <div class="grid2">
          <div class="opt">
            <h3>🏭 Fabricação</h3>
            <p>Receba pedidos da sua cidade, aceite/recuse, produza e entregue. <b>R$ 28 por pedido</b> (R$ 20 fabricação + R$ 8 entrega).</p>
            <a class="btn btnPrimary" href="/parceiros/cadastro?tipo=fabricacao">Quero Fabricar</a>
          </div>

          <div class="opt">
            <h3>🧲 Venda</h3>
            <p>Gere seu link, divulgue e ganhe <b>10%</b> do valor total de cada compra feita pelo seu link.</p>
            <a class="btn btnPrimary" href="/parceiros/cadastro?tipo=venda">Quero Vender</a>
          </div>
        </div>
      </div>
    `,
        `
        <a class="btn btnOutline" href="/sales">⬅️ Voltar</a>
        <a class="btn btnPrimary" href="/parceiros/login">🔐 Login</a>
      `
      )
    );
  });

  // =========================
  // GET /parceiros/login
  // =========================
  app.get("/parceiros/login", (req, res) => {
    const next = String(req.query.next || "").trim(); // id do parceiro
    res.type("html").send(
      layout(
        "Login — Parceiros",
        `
      <div class="card">
        <div class="h1">Login do Parceiro 🔐</div>
        <p class="p">Entre com seu <b>e-mail</b> e <b>senha</b> para acessar seu painel.</p>
        <div style="height:14px"></div>

        <form method="POST" action="/parceiros/login">
          <input type="hidden" name="next" value="${esc(next)}"/>

          <div class="formRow">
            <div>
              <label>E-mail</label>
              <input type="email" name="email" placeholder="seuemail@exemplo.com" required/>
            </div>
            <div>
              <label>Senha</label>
              <input type="password" name="senha" placeholder="Sua senha" required/>
            </div>
          </div>

          <div style="height:16px"></div>

          <button class="btn btnPrimary" type="submit">Entrar</button>
          <a class="btn btnOutline" href="/parceiros" style="margin-left:10px;">Voltar</a>
        </form>

        <div style="height:12px"></div>
        <div class="muted">
          <a href="/parceiros/esqueci" style="text-decoration:underline; font-weight:900;">Esqueci minha senha</a>
        </div>
      </div>
    `
      )
    );
  });
// Paliativo: se algum lugar fizer POST por engano, redireciona pro GET
app.post("/parceiros/perfil/:id", (req, res) => {
  const id = String(req.params.id || "").trim();
  return res.redirect(`/parceiros/perfil/${encodeURIComponent(id)}`);
});


// (extra) se algum POST vier sem :id, manda pra central
app.post("/parceiros/perfil", (req, res) => {
  return res.redirect(303, "/parceiros");
});
  // =========================
  // POST /parceiros/login
  // =========================
  app.post("/parceiros/login", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const senha = String(req.body.senha || "");
      const next = String(req.body.next || "").trim();

      if (!email || !senha) throw new Error("Informe e-mail e senha.");

      const { data: p, error } = await supabase
        .from("partners")
        .select("id,email,password_hash,negocio")
        .eq("email", email)
        .single();

      if (error || !p) {
        return res.status(401).type("html").send(
          layout(
            "Login",
            `
            <div class="card">
              <div class="h1">Não encontrado</div>
              <p class="p">Não achamos parceiro com esse e-mail.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/login">Tentar novamente</a>
              <a class="btn btnOutline" href="/parceiros/esqueci" style="margin-left:10px;">Esqueci a senha</a>
            </div>
          `
          )
        );
      }

      if (!p.password_hash) {
        return res.status(401).type("html").send(
          layout(
            "Login",
            `
            <div class="card">
              <div class="h1">Senha não configurada</div>
              <p class="p">Esse parceiro ainda não tem senha cadastrada.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/esqueci">Criar nova senha</a>
              <a class="btn btnOutline" href="/parceiros" style="margin-left:10px;">Voltar</a>
            </div>
          `
          )
        );
      }

      const ok = verifyPassword(senha, p.password_hash);
      if (!ok) {
        return res.status(401).type("html").send(
          layout(
            "Login",
            `
            <div class="card">
              <div class="h1">Senha inválida</div>
              <p class="p">Confira sua senha e tente novamente.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/login">Tentar novamente</a>
              <a class="btn btnOutline" href="/parceiros/esqueci" style="margin-left:10px;">Esqueci a senha</a>
            </div>
          `
          )
        );
      }

      if (!COOKIE_SECRET && !isDev) throw new Error("Defina PARTNER_COOKIE_SECRET no ambiente de produção.");

      setCookie(res, COOKIE_NAME, makeCookieValue(p.id), { maxAgeSec: 60 * 60 * 24 * 30 });

      const targetId = next || p.id;
      return res.redirect(`/parceiros/perfil/${encodeURIComponent(targetId)}`);
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] login erro:", msg);

      res.status(500).type("html").send(
        layout(
          "Erro",
          `
          <div class="card">
            <div class="h1">Ops…</div>
            <p class="p">Não foi possível fazer login agora. Tente novamente.</p>
            ${isDev ? `<div class="err">DEV ERROR:\n${esc(msg)}</div>` : ``}
            <div style="height:14px"></div>
            <a class="btn btnPrimary" href="/parceiros/login">Voltar para Login</a>
          </div>
        `
        )
      );
    }
  });

  // =========================
  // GET /parceiros/sair (Logout)
  // =========================
  app.get("/parceiros/sair", (req, res) => {
    clearCookie(res, COOKIE_NAME);
    res.type("html").send(
      layout(
        "Saiu",
        `
        <div class="card">
          <div class="h1">Você saiu ✅</div>
          <p class="p">Sua sessão foi encerrada com segurança.</p>
          <div style="height:14px"></div>
          <a class="btn btnPrimary" href="/parceiros/login">Fazer login</a>
          <a class="btn btnOutline" href="/parceiros" style="margin-left:10px;">Voltar</a>
        </div>
      `
      )
    );
  });

  // =========================
  // GET /parceiros/esqueci
  // =========================
  app.get("/parceiros/esqueci", (req, res) => {
    res.type("html").send(
      layout(
        "Esqueci minha senha",
        `
      <div class="card">
        <div class="h1">Esqueci minha senha 🔁</div>
        <p class="p">Informe seu e-mail. Vamos gerar um <b>link de redefinição</b>.</p>
        <div style="height:14px"></div>

        <form method="POST" action="/parceiros/esqueci">
          <div class="formRow">
            <div>
              <label>E-mail</label>
              <input type="email" name="email" placeholder="seuemail@exemplo.com" required/>
            </div>
            <div style="display:flex; align-items:end; gap:10px;">
              <button class="btn btnPrimary" type="submit">Gerar link</button>
              <a class="btn btnOutline" href="/parceiros/login">Voltar</a>
            </div>
          </div>
        </form>

        <div style="height:12px"></div>
        <div class="muted">Dica: o link expira em 30 minutos.</div>
      </div>
    `
      )
    );
  });

app.post("/parceiros/esqueci", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) throw new Error("Informe um e-mail.");

    // Busca parceiro
    const { data: p, error } = await supabase
      .from("partners")
      .select("id,email")
      .eq("email", email)
      .single();

    // ✅ Sempre responde igual (segurança)
    // Só gera token e tenta enviar se achou parceiro
    if (!error && p?.id) {
      const token = genResetToken();
      const tokenHash = sha256Hex(token);
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const up = await supabase
        .from("partners")
        .update({ reset_token_hash: tokenHash, reset_token_expires: expires })
        .eq("id", p.id);

      if (up.error) {
        console.error("[partners] reset token update error:", up.error);
        // não expõe pro usuário
      } else {
        const resetUrl = `${getBaseUrl(req)}/parceiros/redefinir?token=${encodeURIComponent(token)}`;

        // tenta enviar e-mail (não expõe erro na UI)
        const mail = await sendResetEmail(email, resetUrl);
        if (!mail?.ok) {
          console.error("[partners] sendResetEmail failed:", mail?.error || mail);
        }
      }
    }

    // ✅ UI limpa (sem diagnósticos, sem WhatsApp)
    return res.type("html").send(
      layout(
        "Recuperação de senha",
        `
        <div class="card">
          <div class="h1">Pronto ✅</div>
          <p class="p">
            Enviamos um <b>link de recuperação de senha</b> para sua caixa de entrada.
          </p>
          <div style="height:10px"></div>
          <div class="muted">Verifique também o <b>spam/lixo eletrônico</b>. O link expira em 30 minutos.</div>

          <div style="height:16px"></div>
          <a class="btn btnPrimary" href="/parceiros/login">Voltar para Login</a>
        </div>
        `
      )
    );
  } catch (e) {
    const msg = e?.message || String(e);
    console.error("[partners] esqueci erro:", msg);

    return res.status(500).type("html").send(
      layout(
        "Erro",
        `
        <div class="card">
          <div class="h1">Ops…</div>
          <p class="p">Não foi possível processar a recuperação agora. Tente novamente.</p>
          <div style="height:14px"></div>
          <a class="btn btnPrimary" href="/parceiros/esqueci">Tentar novamente</a>
        </div>
        `
      )
    );
  }
});

  // =========================
  // GET /parceiros/redefinir?token=...
  // =========================
  app.get("/parceiros/redefinir", (req, res) => {
    const token = String(req.query.token || "").trim();
    if (!token) return res.redirect("/parceiros/esqueci");

    res.type("html").send(
      layout(
        "Redefinir senha",
        `
      <div class="card">
        <div class="h1">Redefinir senha 🔐</div>
        <p class="p">Crie uma nova senha para acessar seu painel.</p>

        <div style="height:14px"></div>

        <form method="POST" action="/parceiros/redefinir">
          <input type="hidden" name="token" value="${esc(token)}"/>

          <div class="formRow">
            <div>
              <label>Nova senha</label>
              <input type="password" name="senha" placeholder="Nova senha" required/>
              <div class="muted" style="margin-top:6px;">Mínimo recomendado: 6+ caracteres.</div>
            </div>
            <div>
              <label>Confirmar nova senha</label>
              <input type="password" name="senha2" placeholder="Repita a nova senha" required/>
            </div>
          </div>

          <div style="height:16px"></div>

          <button class="btn btnPrimary" type="submit">Salvar nova senha</button>
          <a class="btn btnOutline" href="/parceiros/login" style="margin-left:10px;">Voltar</a>
        </form>
      </div>
    `
      )
    );
  });

  // =========================
  // POST /parceiros/redefinir
  // =========================
  app.post("/parceiros/redefinir", async (req, res) => {
    try {
      const token = String(req.body.token || "").trim();
      const senha = String(req.body.senha || "");
      const senha2 = String(req.body.senha2 || "");

      if (!token) throw new Error("Token inválido.");
      if (!senha || senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      if (senha !== senha2) throw new Error("As senhas não conferem.");

      const tokenHash = sha256Hex(token);

      const { data: p, error } = await supabase
        .from("partners")
        .select("id,reset_token_hash,reset_token_expires")
        .eq("reset_token_hash", tokenHash)
        .single();

      if (error || !p) {
        return res.status(400).type("html").send(
          layout(
            "Link inválido",
            `
            <div class="card">
              <div class="h1">Link inválido</div>
              <p class="p">Esse link não é válido ou já foi usado.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/esqueci">Gerar novo link</a>
            </div>
          `
          )
        );
      }

      const exp = p.reset_token_expires ? new Date(p.reset_token_expires).getTime() : 0;
      if (!exp || Date.now() > exp) {
        return res.status(400).type("html").send(
          layout(
            "Link expirado",
            `
            <div class="card">
              <div class="h1">Link expirado ⏳</div>
              <p class="p">Esse link expirou. Gere um novo link para redefinir sua senha.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/esqueci">Gerar novo link</a>
            </div>
          `
          )
        );
      }

      const upd = await supabase
        .from("partners")
        .update({
          password_hash: hashPassword(senha),
          reset_token_hash: null,
          reset_token_expires: null,
        })
        .eq("id", p.id);

      if (upd.error) {
        console.error("[partners] redefinir update error:", upd.error);
        throw new Error("Não foi possível salvar a nova senha.");
      }

    // Se não existir segredo em produção, NÃO falha a redefinição.
// Apenas pede para o usuário fazer login (sem auto-login por cookie).
if (!COOKIE_SECRET && !isDev) {
  return res.type("html").send(
    layout(
      "Senha redefinida",
      `
      <div class="card">
        <div class="h1">Senha redefinida ✅</div>
        <p class="p">Sua senha foi atualizada com sucesso. Agora faça login para entrar no painel.</p>
        <div style="height:14px"></div>
        <a class="btn btnPrimary" href="/parceiros/login">Ir para Login</a>
      </div>
      `
    )
  );
}

setCookie(res, COOKIE_NAME, makeCookieValue(p.id), { maxAgeSec: 60 * 60 * 24 * 30 });
return res.redirect(`/parceiros/perfil/${encodeURIComponent(p.id)}`);
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] redefinir erro:", msg);
      res.status(500).type("html").send(
        layout(
          "Erro",
          `
          <div class="card">
            <div class="h1">Ops…</div>
            <p class="p">Não foi possível redefinir sua senha agora. Tente novamente.</p>
            ${isDev ? `<div class="err">DEV ERROR:\n${esc(msg)}</div>` : ``}
            <div style="height:14px"></div>
            <a class="btn btnPrimary" href="/parceiros/esqueci">Gerar novo link</a>
          </div>
        `
        )
      );
    }
  });

  // =========================
  // GET /parceiros/cadastro?tipo=...
  // =========================
  app.get("/parceiros/cadastro", (req, res) => {
    const tipo = String(req.query.tipo || "").toLowerCase();
    const isFab = tipo === "fabricacao";
    const isVenda = tipo === "venda";
    if (!isFab && !isVenda) return res.redirect("/parceiros");

    const title = isFab ? "Cadastro — Fabricação" : "Cadastro — Venda";

    const campoSegmento = isFab
      ? `<label>Tipo de negócio</label>
         <select name="segmento" required>
           <option value="">Selecione…</option>
           <option value="papelaria">Papelaria</option>
           <option value="grafica">Gráfica</option>
           <option value="personalizados">Personalizados</option>
           <option value="encadernacao">Encadernação</option>
           <option value="outro">Outro</option>
         </select>`
      : `<label>Seu negócio (escreva)</label>
         <input name="segmento_texto" placeholder="Ex.: presentes, mercado, personalizados, livraria…" required/>`;

    res.type("html").send(
      layout(
        title,
        `
      <div class="card">
        <div class="h1">${isFab ? "Cadastro de Parceiro — Fabricação 🏭" : "Cadastro de Parceiro — Venda 🧲"}</div>
        <p class="p">Preencha seus dados para criar seu perfil de parceiro.</p>
        <div style="height:14px"></div>

        <form method="POST" action="/parceiros/cadastro">
          <input type="hidden" name="tipo" value="${isFab ? "fabricacao" : "venda"}"/>

          <div class="formRow">
            <div>
              <label>Nome do responsável</label>
              <input name="responsavel" placeholder="Seu nome" required/>
            </div>
            <div>
              <label>Nome do negócio</label>
              <input name="negocio" placeholder="Ex.: Gráfica do João" required/>
            </div>
          </div>

          <div style="height:12px"></div>

          <div class="formRow">
            <div>${campoSegmento}</div>
            <div>
              <label>WhatsApp</label>
              <input name="whatsapp" placeholder="(DDD) 9xxxx-xxxx" required/>
            </div>
          </div>

          <div style="height:12px"></div>

          <div class="formRow">
            <div>
              <label>E-mail</label>
              <input type="email" name="email" placeholder="seuemail@exemplo.com" required/>
            </div>
            <div>
              <label>Cidade/UF</label>
              <input name="cidade" placeholder="Ex.: Aquidauana - MS" required/>
            </div>
          </div>

          <div style="height:12px"></div>

          <div class="formRow">
            <div>
              <label>Endereço</label>
              <input name="endereco" placeholder="Rua, nº, bairro" required/>
            </div>
            <div>
              <label>CEP</label>
              <input name="cep" placeholder="00000-000" required/>
            </div>
          </div>

          <div style="height:12px"></div>

          <div class="formRow">
            <div>
              <label>Senha (para acessar seu painel)</label>
              <input type="password" name="senha" placeholder="Crie uma senha" required/>
              <div class="muted" style="margin-top:6px;">Guarde essa senha. Você vai usar no Login.</div>
            </div>
            <div>
              <label>Confirmar senha</label>
              <input type="password" name="senha2" placeholder="Repita a senha" required/>
            </div>
          </div>

          <div style="height:12px"></div>

          <div>
            <label>Observações</label>
            <textarea name="obs" placeholder="Horário, referências, etc."></textarea>
          </div>

          <div style="height:16px"></div>

          <button class="btn btnPrimary" type="submit">Criar meu perfil</button>
          <a class="btn btnOutline" href="/parceiros" style="margin-left:10px;">Voltar</a>
        </form>
      </div>
    `
      )
    );
  });

  // =========================
  // POST /parceiros/cadastro
  // =========================
  app.post("/parceiros/cadastro", async (req, res) => {
    try {
      const tipo = String(req.body.tipo || "").toLowerCase();
      const isFab = tipo === "fabricacao";
      const isVenda = tipo === "venda";
      if (!isFab && !isVenda) return res.redirect("/parceiros");

      const responsavel = String(req.body.responsavel || "").trim();
      const negocio = String(req.body.negocio || "").trim();
      const whatsapp = String(req.body.whatsapp || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const cidade = String(req.body.cidade || "").trim();
      const endereco = String(req.body.endereco || "").trim();
      const cep = String(req.body.cep || "").trim();
      const obs = String(req.body.obs || "").trim();
      const segmento = isFab ? String(req.body.segmento || "").trim() : String(req.body.segmento_texto || "").trim();

      const senha = String(req.body.senha || "");
      const senha2 = String(req.body.senha2 || "");
      if (!senha || senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      if (senha !== senha2) throw new Error("As senhas não conferem.");

      const { data: exists, error: exErr } = await supabase
        .from("partners")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (exErr) console.error("[partners] check email error:", exErr);
      if (exists?.id) {
        return res.status(409).type("html").send(
          layout(
            "E-mail já cadastrado",
            `
            <div class="card">
              <div class="h1">E-mail já cadastrado</div>
              <p class="p">Esse e-mail já tem um parceiro registrado. Faça login para acessar.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/login">Ir para Login</a>
              <a class="btn btnOutline" href="/parceiros/esqueci" style="margin-left:10px;">Esqueci a senha</a>
            </div>
          `
          )
        );
      }

      const parceiroRow = {
        tipo,
        responsavel,
        negocio,
        segmento: segmento || null,
        whatsapp,
        email,
        cidade,
        endereco,
        cep,
        obs: obs || null,

        password_hash: hashPassword(senha),

        comissao_venda_percent: isVenda ? 10 : 0,
        fabricacao_por_pedido: isFab ? 20 : 0,
        entrega_por_pedido: isFab ? 8 : 0,
      };

      const { data, error } = await supabase.from("partners").insert(parceiroRow).select("*").single();
      if (error) {
        console.error("[partners] INSERT partners error:", error);
        throw error;
      }

      if (!COOKIE_SECRET && !isDev) throw new Error("Defina PARTNER_COOKIE_SECRET no ambiente de produção.");
      setCookie(res, COOKIE_NAME, makeCookieValue(data.id), { maxAgeSec: 60 * 60 * 24 * 30 });

      return res.redirect(`/parceiros/perfil/${encodeURIComponent(data.id)}`);
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] cadastro erro:", msg);

      res.status(500).type("html").send(
        layout(
          "Erro",
          `
          <div class="card">
            <div class="h1">Ops…</div>
            <p class="p">Não foi possível criar seu perfil agora. Tente novamente.</p>
            ${isDev ? `<div class="err">DEV ERROR:\n${esc(msg)}</div>` : ``}
            <div style="height:14px"></div>
            <a class="btn btnPrimary" href="/parceiros">Voltar para Central</a>
          </div>
        `
        )
      );
    }
  });

  // =========================
  // GET /parceiros/perfil/:id (PROTEGIDO) + botão Sair
  // =========================
  app.get("/parceiros/perfil/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.redirect("/parceiros");

      if (!requirePartnerAuthForId(req, res, id)) return;

      const { data: p, error: pErr } = await supabase.from("partners").select("*").eq("id", id).single();
      if (pErr || !p) return res.redirect("/parceiros");

      const { data: pedidos, error: oErr } = await supabase
        .from("partner_orders")
        .select("*")
        .eq("partner_id", id)
        .order("created_at", { ascending: false });

      if (oErr) console.error("[partners] select orders error:", oErr);

      const orders = Array.isArray(pedidos) ? pedidos : [];

      const pedidos_para_aceitar = orders.filter((x) => x.status === "para_aceitar").length;
      const pedidos_em_fabricacao = orders.filter((x) => x.status === "em_fabricacao").length;
      const pedidos_finalizados = orders.filter((x) => x.status === "finalizado").length;
      const pedidos_retorno = orders.filter((x) => x.status === "retorno").length;
      const caixa_total = orders.reduce((acc, x) => acc + Number(x.ganho_parceiro || 0), 0);

      const isFab = p.tipo === "fabricacao";
      const title = isFab ? "Perfil — Fabricação" : "Perfil — Venda";

      const menuFab = `
        <a href="#caixa">💰 Meu caixa</a>
        <a href="#aceitar">📥 Pedidos para aceitar</a>
        <a href="#emf">🏭 Pedidos em fabricação</a>
        <a href="#finalizados">✅ Pedidos finalizados</a>
        <a href="#retorno">↩️ Pedidos com retorno</a>
        <a href="#como">❓ Como funciona</a>
        <a href="#historico">📚 Histórico</a>
      `;

      const menuVenda = `
        <a href="#caixa">💰 Meu caixa</a>
        <a href="#aceitar">📥 Pedidos para aceitar</a>
        <a href="#emf">🧾 Pedidos em fabricação</a>
        <a href="#finalizados">✅ Pedidos finalizados</a>
        <a href="#retorno">↩️ Pedidos com retorno</a>
        <a href="#como">❓ Como funciona</a>
        <a href="#links">🔗 Meus links</a>
        <a href="#historico">📚 Histórico</a>
      `;

      const host = req.get("host") || "seusite.com";
      const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
      const linkVenda = `${proto}://${host}/?ref=${encodeURIComponent(p.id)}`;

      const historicoHtml =
        orders.length === 0
          ? `<div class="muted">Ainda não há pedidos registrados para este parceiro.</div>`
          : `
            <div style="overflow:auto;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Ganho</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders
                    .slice(0, 50)
                    .map((o) => {
                      const when = o.created_at ? new Date(o.created_at).toLocaleString("pt-BR") : "-";
                      const tipo = o.tipo === "fabricacao" ? "🏭 Fabricação" : "🧲 Venda";
                      const cli = [o.cliente_nome, o.cliente_cidade].filter(Boolean).join(" • ") || "-";
                      const total = `R$ ${moneyBR(o.valor_total)}`;
                      const ganho = `R$ ${moneyBR(o.ganho_parceiro)}`;
                      return `
                        <tr>
                          <td>${esc(when)}</td>
                          <td>${esc(tipo)}</td>
                          <td><span class="pill">${esc(statusLabel(o.status))}</span></td>
                          <td>${esc(cli)}</td>
                          <td>${esc(total)}</td>
                          <td>${esc(ganho)}</td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
            <div style="height:10px"></div>
            <div class="muted">Mostrando os 50 pedidos mais recentes.</div>
          `;

      res.type("html").send(
        layout(
          title,
          `
      <div class="card">
        <div class="h1">${isFab ? "Painel do Parceiro — Fabricação 🏭" : "Painel do Parceiro — Venda 🧲"}</div>
        <p class="p">
          <b>${esc(p.negocio)}</b> • ${esc(p.cidade)} • ${esc(p.whatsapp)}<br/>
          Segmento: <b>${esc(p.segmento || "-")}</b>
        </p>
      </div>

      <div class="dash">
        <div class="menu">
          <div class="card">
            <div style="font-weight:1000; margin-bottom:10px;">Menu</div>
            ${isFab ? menuFab : menuVenda}
          </div>
        </div>

        <div>
          <div class="kpi">
            <div class="box" id="caixa">
              <div class="t">Meu caixa</div>
              <div class="v">R$ ${moneyBR(caixa_total)}</div>
              <div class="muted">${isFab ? "R$ 28 por pedido (20+8)" : "10% por compra via link"}</div>
            </div>
            <div class="box" id="aceitar">
              <div class="t">Para aceitar</div>
              <div class="v">${pedidos_para_aceitar}</div>
              <div class="muted">Pedidos aguardando ação</div>
            </div>
            <div class="box" id="finalizados">
              <div class="t">Finalizados</div>
              <div class="v">${pedidos_finalizados}</div>
              <div class="muted">Histórico de conclusões</div>
            </div>
          </div>

          <div style="height:14px"></div>

          <div class="kpi">
            <div class="box" id="emf">
              <div class="t">${isFab ? "Em fabricação" : "Em andamento"}</div>
              <div class="v">${pedidos_em_fabricacao}</div>
              <div class="muted">Pedidos em processamento</div>
            </div>
            <div class="box" id="retorno">
              <div class="t">Retorno</div>
              <div class="v">${pedidos_retorno}</div>
              <div class="muted">Pedidos com pendência</div>
            </div>
            <div class="box">
              <div class="t">Total de pedidos</div>
              <div class="v">${orders.length}</div>
              <div class="muted">Todos os pedidos deste parceiro</div>
            </div>
          </div>

          <div style="height:14px"></div>

          <div class="card" id="como">
            <div style="font-weight:1000; margin-bottom:8px;">Como funciona</div>
            ${
              isFab
                ? `
              <div class="muted">
                Quando um pedido for realizado na sua cidade, ele cai em <b>Pedidos para aceitar</b>.
                Você pode <b>aceitar</b> ou <b>recusar</b>. Aceitando, ele vai para <b>Pedidos em fabricação</b>.
                Ao finalizar e entregar, marque como <b>finalizado</b>. Cada pedido rende <b>R$ 28</b> (R$ 20 fabricação + R$ 8 entrega).
              </div>
            `
                : `
              <div class="muted">
                Você gera um <b>link de divulgação</b> em <b>Meus links</b>. Quando alguém compra por ele,
                você ganha <b>10%</b> do valor total. Seus ganhos aparecem em <b>Meu caixa</b>.
              </div>
            `
            }
          </div>

          ${
            isFab
              ? ""
              : `
            <div style="height:14px"></div>
            <div class="card" id="links">
              <div style="font-weight:1000; margin-bottom:8px;">Meus links</div>
              <div class="muted">Link de divulgação:</div>
              <div style="height:8px"></div>
              <input readonly value="${esc(linkVenda)}"/>
              <div style="height:10px"></div>
              <div class="muted">Dica: use esse link em bio, stories e WhatsApp.</div>
            </div>
          `
          }

          <div style="height:14px"></div>
          <div class="card" id="historico">
            <div style="font-weight:1000; margin-bottom:8px;">Histórico de pedidos</div>
            ${historicoHtml}
          </div>
        </div>
      </div>
    `,
          `
        <a class="btn btnOutline" href="/parceiros">🏠 Início</a>
        <a class="btn btnDanger" href="/parceiros/sair">🚪 Sair</a>
      `
        )
      );
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] perfil erro:", msg);
      res.status(500).type("html").send(
        layout(
          "Erro",
          `
          <div class="card">
            <div class="h1">Erro ao abrir o perfil</div>
            <p class="p">Tente novamente.</p>
            ${isDev ? `<div class="err">DEV ERROR:\n${esc(msg)}</div>` : ``}
            <div style="height:14px"></div>
            <a class="btn btnPrimary" href="/parceiros">Voltar para Central</a>
          </div>
        `
        )
      );
    }
  });
};