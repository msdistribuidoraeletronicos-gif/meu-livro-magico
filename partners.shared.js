/**
 * partners.shared.js — Helpers compartilhados (Supabase + Auth + Layout + Reset + Email)
 * UNIFICADO: agora usa JWT com cookie 'partner_token' (path='/') para todas as autenticações.
 *
 * ✅ ALTERAÇÃO pedida:
 * - O layout agora aceita um "slot" à esquerda do brand:
 *     layout(title, innerHtml, navRightHtml, navLeftHtml)
 *   Assim você consegue colocar o botão "Voltar" ao lado esquerdo de "🤝 Parceiros • Meu Livro Mágico".
 *
 * - Mantém compatibilidade: se você continuar chamando layout(title, innerHtml, navRightHtml),
 *   funciona igual (navLeft fica vazio).
 */
"use strict";

const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

// ===== Email (Brevo API) =====
const SibApiV3Sdk = require("sib-api-v3-sdk");

function buildPartnersShared(app, opts = {}) {
  app.use(express.urlencoded({ extended: true }));
  app.set("trust proxy", 1);

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

  const BREVO_API_KEY = String(process.env.BREVO_API_KEY || "").trim();
  const PARTNER_RESET_FROM = String(process.env.PARTNER_RESET_FROM || "").trim();
  const PARTNER_RESET_FROM_NAME = String(process.env.PARTNER_RESET_FROM_NAME || "Meu Livro Mágico").trim();

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
        sender: { email: PARTNER_RESET_FROM, name: PARTNER_RESET_FROM_NAME },
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
  // JWT Cookie (unificado)
  // =========================
  const COOKIE_NAME = "partner_token";
  const COOKIE_SECRET = process.env.PARTNER_COOKIE_SECRET || (isDev ? "dev-secret-change-me" : "");

  // Define se o cookie deve ser Secure com base em variável de ambiente
  const COOKIE_SECURE =
    process.env.COOKIE_SECURE === "true"
      ? true
      : process.env.COOKIE_SECURE === "false"
      ? false
      : process.env.NODE_ENV === "production";

  function setPartnerCookie(res, partnerId) {
    console.log("[setPartnerCookie] COOKIE_SECURE =", COOKIE_SECURE);
    if (!COOKIE_SECRET && !isDev) {
      throw new Error("Defina PARTNER_COOKIE_SECRET no ambiente de produção.");
    }
    const token = jwt.sign({ id: partnerId }, COOKIE_SECRET, { expiresIn: "30d" });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
      path: "/",
    });
  }

  function clearPartnerCookie(res) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
  }

  // Função para obter o ID do parceiro a partir do token no cookie (sem redirecionar)
  function getPartnerIdFromToken(req) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return null;
    try {
      const decoded = jwt.verify(token, COOKIE_SECRET);
      return decoded.id;
    } catch {
      return null;
    }
  }

  // Middleware para proteger rotas de parceiro (redireciona para login se não autenticado)
  function requirePartner(req, res, next) {
    console.log(`[requirePartner] URL: ${req.method} ${req.originalUrl}`);
    console.log("[requirePartner] Cookies recebidos:", req.cookies);
    const token = req.cookies?.[COOKIE_NAME];
    console.log("[requirePartner] Token encontrado:", token ? "sim" : "não");
    if (!token) {
      const redirectUrl = `/parceiros/login?next=${encodeURIComponent(req.originalUrl)}`;
      console.log(`[requirePartner] Redirecionando para login: token ausente -> ${redirectUrl}`);
      return res.redirect(redirectUrl);
    }
    try {
      const decoded = jwt.verify(token, COOKIE_SECRET);
      console.log("[requirePartner] Token válido para ID:", decoded.id);
      req.partnerId = decoded.id;
      next();
    } catch (err) {
      const redirectUrl = `/parceiros/login?next=${encodeURIComponent(req.originalUrl)}`;
      console.log(`[requirePartner] Token inválido: ${err.message} -> redirecionando para ${redirectUrl}`);
      return res.redirect(redirectUrl);
    }
  }

  // Função para verificar se o parceiro logado é o mesmo do ID (para rotas que exigem ownership)
  function requirePartnerAuthForId(req, res, partnerId) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return false;
    try {
      const decoded = jwt.verify(token, COOKIE_SECRET);
      if (String(decoded.id) === String(partnerId)) return true;
    } catch {}
    return false;
  }

  // =========================
  // Reset token (Esqueci senha)
  // =========================
  function sha256Hex(s) {
    return crypto.createHash("sha256").update(String(s)).digest("hex");
  }

  function genResetToken() {
    return crypto.randomBytes(32).toString("base64url");
  }

  function normalizePhoneBR(whats) {
    const digits = String(whats || "").replace(/\D+/g, "");
    if (!digits) return "";
    if (digits.startsWith("55") && digits.length >= 12) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return digits;
  }

  function getBaseUrl(req) {
    const fixed = String(process.env.PUBLIC_BASE_URL || "").trim();
    if (fixed) return fixed.replace(/\/+$/, "");

    const vercelUrl = String(process.env.VERCEL_URL || "").trim();
    if (vercelUrl) return `https://${vercelUrl}`.replace(/\/+$/, "");

    const xfProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const proto = xfProto || req.protocol || "https";

    const xfHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
    const host = xfHost || req.get("host") || "seusite.com";

    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  // =========================
  // Layout (ajustado: navLeft + navRight)
  // =========================
  function layout(title, innerHtml, navRightHtml, navLeftHtml) {
    const right = navRightHtml
      ? navRightHtml
      : `
        <a class="btn btnOutline" href="/sales">⬅️ Voltar</a>
        <a class="btn btnPrimary" href="/parceiros">Central</a>
      `;

    const left = navLeftHtml ? navLeftHtml : ``;

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

    .nav{
      padding: 16px 0;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
    }

    /* ✅ novo: lado esquerdo (Voltar + Brand) */
    .navLeft{
      display:flex;
      align-items:center;
      gap:12px;
      min-width: 0;
    }

    .brand{
      display:flex;
      align-items:center;
      gap:10px;
      font-weight:1000;
      letter-spacing:-.2px;
      min-width: 0;
    }
    .brandText{
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .logo{
      width:42px;height:42px;border-radius:14px; display:grid;place-items:center;
      background: linear-gradient(135deg, rgba(124,58,237,.14), rgba(219,39,119,.14));
      border: 1px solid rgba(124,58,237,.18);
      box-shadow: var(--shadow2); font-size:20px;
      flex: 0 0 auto;
    }

    .navRight{
      display:flex;
      gap:10px;
      align-items:center;
      flex-wrap:wrap;
      justify-content:flex-end;
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
      <div class="navLeft">
        ${left}
        <div class="brand">
          <div class="logo">🤝</div>
          <div class="brandText">Parceiros • Meu Livro Mágico</div>
        </div>
      </div>

      <div class="navRight">
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

  return {
    isDev,
    supabase,

    // email/reset
    sendResetEmail,
    sha256Hex,
    genResetToken,
    getBaseUrl,

    // util
    esc,
    moneyBR,
    statusLabel,
    normalizePhoneBR,

    // auth/cookies (unificado)
    COOKIE_NAME,
    COOKIE_SECRET,
    setPartnerCookie,
    clearPartnerCookie,
    getPartnerIdFromToken, // NOVA FUNÇÃO
    requirePartner,
    requirePartnerAuthForId,
    verifyPassword,
    hashPassword,

    // ui
    layout,
  };
}

module.exports = { buildPartnersShared };