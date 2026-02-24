/**
 * app.js — MONOCÓDIGO (UI + API + OpenAI + PDF)
 * MODO SEQUENCIAL (1 imagem por vez) + TEXTO DENTRO DA IMAGEM
 *
 * ✅ ESTA VERSÃO (SUPABASE AUTH + RLS + VERCEL-SAFE):
 * - ✅ Login/Cadastro via Supabase Auth (JWT em cookie)
 * - ✅ Rotas do usuário usam ANON KEY + Bearer JWT (RLS ON)
 * - ✅ Vercel-safe: tudo que precisa persistir vai para Supabase Storage (bucket "books")
 * - ✅ /api/generateNext NÃO depende de arquivo local existir entre requisições
 * - ✅ /api/image busca primeiro no disco, senão baixa do Storage
 * - ✅ Geração sequencial: story -> cover -> pages -> pdf
 *
 * Requisitos:
 *  - Node 18+
 *  - npm i express pdfkit dotenv sharp @supabase/supabase-js
 *
 * .env.local:
 *   PORT=3000
 *   OPENAI_API_KEY=...
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY=...
 *   SUPABASE_SERVICE_ROLE_KEY=...  (RECOMENDADO/NECESSÁRIO p/ Storage upload)
 *   ADMIN_EMAILS=email1@x.com,email2@y.com
 *   COOKIE_SECURE=1
 *   (Opcional Replicate)
 *   REPLICATE_API_TOKEN=...
 *   REPLICATE_MODEL=google/nano-banana-pro
 *   REPLICATE_VERSION=... (opcional)
 *
 * IMPORTANTE:
 * - Crie o bucket Supabase Storage: "books"
 * - Se bucket for privado: adapte para Signed URLs (aqui assume público p/ simplicidade)
 */

"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const express = require("express");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");
const { createClient } = require("@supabase/supabase-js");

// ------------------------------
// dotenv: .env.local (prioridade) e .env (fallback)
// ------------------------------
(function loadEnv() {
  let dotenv = null;
  try {
    dotenv = require("dotenv");
  } catch {
    console.warn("⚠️  dotenv NÃO está instalado. Rode: npm i dotenv");
    return;
  }

  const candidates = [
    path.join(__dirname, ".env.local"),
    path.join(__dirname, ".env"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
  ];

  const loaded = [];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const r = dotenv.config({ path: p, override: true });
      if (!r.error) loaded.push(p);
      else console.warn("⚠️  Falha ao ler:", p, "-", String(r.error?.message || r.error));
    }
  }

  if (loaded.length) console.log("✅ dotenv carregou:", loaded.join(" | "));
  else console.log("ℹ️  Nenhum .env/.env.local encontrado em:", __dirname, "ou", process.cwd());
  console.log("DEBUG app.js ADMIN_EMAILS =", JSON.stringify(process.env.ADMIN_EMAILS || ""));
})();

// ------------------------------
// Config
// ------------------------------
const PORT = Number(process.env.PORT || 3000);

// OpenAI (texto)
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const TEXT_MODEL = String(process.env.TEXT_MODEL || "gpt-4.1-mini").trim() || "gpt-4.1-mini";

// OpenAI (imagem fallback opcional)
const IMAGE_MODEL = String(process.env.IMAGE_MODEL || "dall-e-2").trim() || "dall-e-2";

// Replicate (imagem principal)
const REPLICATE_API_TOKEN = String(process.env.REPLICATE_API_TOKEN || "").trim();
const REPLICATE_MODEL = String(process.env.REPLICATE_MODEL || "google/nano-banana-pro").trim();
const REPLICATE_VERSION = String(process.env.REPLICATE_VERSION || "").trim(); // opcional
const REPLICATE_RESOLUTION = String(process.env.REPLICATE_RESOLUTION || "2K").trim();
const REPLICATE_ASPECT_RATIO = String(process.env.REPLICATE_ASPECT_RATIO || "1:1").trim();
const REPLICATE_OUTPUT_FORMAT = String(process.env.REPLICATE_OUTPUT_FORMAT || "png").trim();
const REPLICATE_SAFETY = String(process.env.REPLICATE_SAFETY || "block_only_high").trim();

const IMAGE_PROVIDER = REPLICATE_API_TOKEN ? "replicate" : "openai";

// ✅ Vercel: /var/task read-only, só /tmp é gravável
function pickWritableRoot() {
  const tmpRoot = path.join(os.tmpdir(), "meu-livro-magico");
  const serverless =
    !!process.env.VERCEL ||
    !!process.env.VERCEL_ENV ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.LAMBDA_TASK_ROOT ||
    String(__dirname || "").startsWith("/var/task");

  if (serverless) return tmpRoot;

  try {
    const testDir = path.join(__dirname, ".fs_write_test");
    fs.mkdirSync(testDir, { recursive: true });
    fs.rmdirSync(testDir);
    return __dirname;
  } catch {
    return tmpRoot;
  }
}

const OUT_ROOT = pickWritableRoot();
const OUT_DIR = path.join(OUT_ROOT, "output");
const BOOKS_DIR = path.join(OUT_DIR, "books");
const JSON_LIMIT = "25mb";

// Base de edição (mantém performance e garante match image/mask)
const EDIT_MAX_SIDE = 1024;

// Páginas opcionais (arquivos)
const LANDING_HTML = path.join(__dirname, "landing.html");
const HOW_IT_WORKS_HTML = path.join(__dirname, "how-it-works.html");
const EXEMPLOS_HTML = path.join(__dirname, "exemplos.html");

// ------------------------------
// Supabase Auth + RLS (ANON + JWT)
// ------------------------------
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

// ✅ Cookies: access + refresh
const SB_ACCESS_COOKIE = "sb_token"; // access_token
const SB_REFRESH_COOKIE = "sb_refresh"; // refresh_token

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("❌ SUPABASE_URL / SUPABASE_ANON_KEY não configurados. Auth/RLS NÃO vai funcionar.");
}

const supabaseAnon =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    : null;

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

function supabaseUserClient(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function assertSupabaseAnon() {
  if (!supabaseAnon) throw new Error("Supabase ANON não configurado. Configure SUPABASE_URL e SUPABASE_ANON_KEY.");
}

// ------------------------------
// Cookies
// ------------------------------
function parseCookies(req) {
  const header = String(req.headers.cookie || "");
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) return;
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function pushSetCookie(res, cookieStr) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) return res.setHeader("Set-Cookie", cookieStr);
  if (Array.isArray(prev)) return res.setHeader("Set-Cookie", [...prev, cookieStr]);
  return res.setHeader("Set-Cookie", [prev, cookieStr]);
}

function setCookie(res, name, value, { maxAgeSec = 60 * 60 * 24 * 30 } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];

  const secureOn = String(process.env.COOKIE_SECURE || "").trim() === "1" || !!process.env.VERCEL;
  if (secureOn) parts.push("Secure");

  pushSetCookie(res, parts.join("; "));
}

function clearCookie(res, name) {
  const parts = [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  const secureOn = String(process.env.COOKIE_SECURE || "").trim() === "1" || !!process.env.VERCEL;
  if (secureOn) parts.push("Secure");
  pushSetCookie(res, parts.join("; "));
}

function getUserTokens(req) {
  const cookies = parseCookies(req);
  const access = String(cookies[SB_ACCESS_COOKIE] || "");
  const refresh = String(cookies[SB_REFRESH_COOKIE] || "");
  return { access, refresh };
}

function setUserTokens(res, { access, refresh }) {
  if (access) setCookie(res, SB_ACCESS_COOKIE, access, { maxAgeSec: 60 * 60 * 24 * 30 });
  if (refresh) setCookie(res, SB_REFRESH_COOKIE, refresh, { maxAgeSec: 60 * 60 * 24 * 30 });
}

function clearUserTokens(res) {
  clearCookie(res, SB_ACCESS_COOKIE);
  clearCookie(res, SB_REFRESH_COOKIE);
}

// ------------------------------
// Auth helpers
// ------------------------------
async function refreshAccessTokenIfNeeded(req, res) {
  try {
    assertSupabaseAnon();
    const { refresh } = getUserTokens(req);
    if (!refresh) return null;

    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refresh });
    if (error || !data?.session?.access_token) return null;

    const access = data.session.access_token;
    const newRefresh = data.session.refresh_token || refresh;

    if (res) setUserTokens(res, { access, refresh: newRefresh });
    return { access, refresh: newRefresh };
  } catch {
    return null;
  }
}

async function getCurrentUser(req, resForCookieUpdate = null) {
  try {
    const { access } = getUserTokens(req);
    if (!access) return null;

    let sb = supabaseUserClient(access);
    if (!sb) return null;

    let { data, error } = await sb.auth.getUser();

    if (error || !data?.user) {
      const refreshed = await refreshAccessTokenIfNeeded(req, resForCookieUpdate);
      if (!refreshed?.access) return null;

      sb = supabaseUserClient(refreshed.access);
      if (!sb) return null;

      const r2 = await sb.auth.getUser();
      data = r2?.data;
      error = r2?.error;
      if (error || !data?.user) return null;
    }

    const u = data.user;
    return { id: u.id, email: u.email || "", sb };
  } catch {
    return null;
  }
}

function isAdminUser(user) {
  const list = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const email = String(user?.email || "").trim().toLowerCase();
  return !!email && list.includes(email);
}

function canAccessBook(userId, manifest, reqUser) {
  if (isAdminUser(reqUser)) return true;
  return !!manifest && String(manifest.ownerId || "") === String(userId || "");
}

function requireAuth(req, res, next) {
  getCurrentUser(req, res)
    .then((user) => {
      if (!user) {
        const nextUrl = encodeURIComponent(req.originalUrl || "/create");
        return res.redirect(`/login?next=${nextUrl}`);
      }
      req.user = { id: user.id, email: user.email };
      req.sb = user.sb; // client com RLS ativo
      next();
    })
    .catch(() => {
      const nextUrl = encodeURIComponent(req.originalUrl || "/create");
      return res.redirect(`/login?next=${nextUrl}`);
    });
}

async function requireAuthApi(req, res) {
  const u = await getCurrentUser(req, res);
  if (!u) {
    res.status(401).json({ ok: false, error: "not_logged_in" });
    return null;
  }
  req.user = { id: u.id, email: u.email };
  req.sb = u.sb;
  return req.user;
}

// ------------------------------
// Helpers: FS
// ------------------------------
async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function writeJson(file, obj) {
  await ensureDir(path.dirname(file));
  await fsp.writeFile(file, JSON.stringify(obj, null, 2), "utf-8");
}

async function readJson(file) {
  const raw = await fsp.readFile(file, "utf-8");
  return JSON.parse(raw);
}

function existsSyncSafe(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function safeId() {
  return crypto.randomUUID();
}

function nowISO() {
  return new Date().toISOString();
}

// ------------------------------
// Helpers: DataURL
// ------------------------------
function isDataUrl(s) {
  return typeof s === "string" && s.startsWith("data:") && s.includes("base64,");
}

function dataUrlToBuffer(dataUrl) {
  if (!isDataUrl(dataUrl)) return null;
  const base64 = dataUrl.split("base64,", 2)[1];
  if (!base64) return null;
  return Buffer.from(base64, "base64");
}

function guessMimeFromDataUrl(dataUrl) {
  if (!isDataUrl(dataUrl)) return "image/png";
  const head = dataUrl.slice(0, 64).toLowerCase();
  if (head.includes("image/jpeg") || head.includes("image/jpg")) return "image/jpeg";
  if (head.includes("image/webp")) return "image/webp";
  if (head.includes("image/png")) return "image/png";
  return "image/png";
}

function guessExtFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("png")) return "png";
  return "png";
}

function bufferToDataUrlPng(buf) {
  return `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
}

function clamp(n, a, b) {
  n = Number(n);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}

function themeLabel(themeKey) {
  const map = {
    space: "Viagem Espacial",
    dragon: "Reino dos Dragões",
    ocean: "Fundo do Mar",
    jungle: "Safari na Selva",
    superhero: "Super Herói",
    dinosaur: "Terra dos Dinossauros",
  };
  return map[themeKey] || String(themeKey || "Tema");
}

function themeDesc(themeKey) {
  const map = {
    space: "aventura espacial (planetas, foguetes, estrelas, nebulosas coloridas)",
    dragon: "fantasia medieval com dragões amigáveis, castelos e vilas mágicas",
    ocean: "fundo do mar com corais, peixes coloridos, tesouros e amigos marinhos",
    jungle: "selva/safari com animais, natureza e trilhas divertidas",
    superhero: "super-herói em uma cidade alegre, missão do bem, capa e símbolos",
    dinosaur: "terra dos dinossauros (jurássico amigável), trilhas e descobertas",
  };
  return map[themeKey] || String(themeKey || "aventura divertida");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ------------------------------
// HTTP Helpers
// ------------------------------
async function fetchJson(url, { method = "GET", headers = {}, body = null, timeoutMs = 180000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method, headers, body, signal: ctrl.signal });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}

    if (!r.ok) {
      const msg = json?.detail || json?.error || text;
      throw new Error(`HTTP ${r.status}: ${String(msg).slice(0, 2000)}`);
    }
    return json ?? {};
  } finally {
    clearTimeout(t);
  }
}

async function downloadToBuffer(url, timeoutMs = 180000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`Falha ao baixar: HTTP ${r.status}`);
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------
// Supabase Storage (VERCEL-SAFE)
// ------------------------------
const STORAGE_BUCKET = String(process.env.SUPABASE_BUCKET || "books").trim() || "books";

function storageKeyFor(userId, bookId, filename) {
  return `${String(userId)}/${String(bookId)}/${String(filename)}`;
}
async function sbDownloadToLocal({ pathKey, localPath }) {
  if (!supabaseAnon) throw new Error("Supabase ANON não configurado.");
  const { data, error } = await supabaseAnon.storage.from(STORAGE_BUCKET).download(pathKey);
  if (error) throw error;
  const ab = await data.arrayBuffer();
  await ensureDir(path.dirname(localPath));
  await fsp.writeFile(localPath, Buffer.from(ab));
  return localPath;
}

async function ensureLocalFromStorage(localPath, storageKey) {
  if (existsSyncSafe(localPath)) return localPath;
  if (!storageKey) throw new Error("storageKey ausente (reenvie a foto).");
  return await sbDownloadToLocal({ pathKey: storageKey, localPath });
}

async function uploadLocalFileToStorage({ userId, bookId, localPath, filename, contentType }) {
  const buf = await fsp.readFile(localPath);
  const key = storageKeyFor(userId, bookId, filename);
  await sbUploadBuffer({ pathKey: key, contentType, buffer: buf });
  return { key, url: sbPublicUrl(key) };
}
function assertSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente. Necessário para upload no Supabase Storage.");
  }
}

async function sbUploadBuffer({ pathKey, contentType, buffer }) {
  assertSupabaseAdmin();

  const { error } = await supabaseAdmin
    .storage
    .from(STORAGE_BUCKET)
    .upload(pathKey, buffer, {
      contentType: contentType || "application/octet-stream",
      upsert: true,
      cacheControl: "3600",
    });

  if (error) throw error;
  return true;
}

function sbPublicUrl(pathKey) {
  if (!supabaseAnon) throw new Error("Supabase ANON não configurado.");
  const { data } = supabaseAnon.storage.from(STORAGE_BUCKET).getPublicUrl(pathKey);
  return data?.publicUrl || "";
}
// ------------------------------
// OpenAI (texto)
// ------------------------------
async function openaiFetchJson(url, bodyObj, timeoutMs = 180000) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada.");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
      signal: ctrl.signal,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${text.slice(0, 2000)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

function isModelAccessError(msg) {
  const s = String(msg || "");
  return (
    s.includes("model_not_found") ||
    s.includes("does not have access") ||
    s.includes("You do not have access") ||
    s.includes('"code":"model_not_found"') ||
    s.includes('"param":"model"')
  );
}

async function openaiResponsesWithFallback({ models, input, jsonObject = true, timeoutMs = 180000 }) {
  let lastErr = null;
  for (const model of models) {
    try {
      const body = { model, input };
      if (jsonObject) body.text = { format: { type: "json_object" } };
      return await openaiFetchJson("https://api.openai.com/v1/responses", body, timeoutMs);
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e || "");
      if (isModelAccessError(msg)) continue;
      throw e;
    }
  }
  throw lastErr || new Error("Falha ao chamar Responses com fallback.");
}

// ------------------------------
// Replicate — imagem (principal)
// ------------------------------
const replicateVersionCache = new Map(); // "owner/name" -> versionId

function splitReplicateModel(model) {
  const s = String(model || "").trim();
  const parts = s.split("/");
  if (parts.length !== 2) return null;
  return { owner: parts[0], name: parts[1] };
}

async function replicateGetLatestVersionId(model) {
  if (REPLICATE_VERSION) return REPLICATE_VERSION;

  const key = String(model || "").trim();
  if (!key) throw new Error("REPLICATE_MODEL vazio.");
  if (replicateVersionCache.has(key)) return replicateVersionCache.get(key);

  const parsed = splitReplicateModel(key);
  if (!parsed) throw new Error(`REPLICATE_MODEL inválido: "${key}". Use "owner/name".`);

  const info = await fetchJson(`https://api.replicate.com/v1/models/${parsed.owner}/${parsed.name}`, {
    method: "GET",
    timeoutMs: 60000,
    headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
  });

  const versionId = info?.latest_version?.id || info?.latest_version?.version || info?.latest_version;
  if (!versionId) throw new Error(`Não consegui obter latest_version do modelo "${key}". Configure REPLICATE_VERSION.`);

  replicateVersionCache.set(key, String(versionId));
  return String(versionId);
}

async function replicateCreatePrediction({ model, input, timeoutMs = 180000 }) {
  if (!REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN não configurado.");
  const version = await replicateGetLatestVersionId(model);

  return await fetchJson("https://api.replicate.com/v1/predictions", {
    method: "POST",
    timeoutMs,
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ version, input }),
  });
}

async function replicateWaitPrediction(predictionId, { timeoutMs = 300000, pollMs = 1200 } = {}) {
  if (!REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN não configurado.");

  const started = Date.now();
  while (true) {
    if (Date.now() - started > timeoutMs) throw new Error("Timeout aguardando prediction do Replicate.");

    const pred = await fetchJson(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      method: "GET",
      timeoutMs: 60000,
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    });

    const st = String(pred?.status || "");
    if (st === "succeeded") return pred;
    if (st === "failed" || st === "canceled") throw new Error(String(pred?.error || "Prediction falhou no Replicate."));
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

// ------------------------------
// OpenAI Images (fallback opcional)
// ------------------------------
async function openaiImageEditFallback({ imagePngPath, maskPngPath, prompt, size = "1024x1024" }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada.");
  if (typeof FormData === "undefined" || typeof Blob === "undefined") throw new Error("Node precisa ser 18+.");

  const imgBuf = await fsp.readFile(imagePngPath);
  const maskBuf = maskPngPath && existsSyncSafe(maskPngPath) ? await fsp.readFile(maskPngPath) : null;

  if (maskBuf) {
    const mi = await sharp(imgBuf).metadata();
    const mm = await sharp(maskBuf).metadata();
    if ((mi?.width || 0) !== (mm?.width || 0) || (mi?.height || 0) !== (mm?.height || 0)) {
      throw new Error(`Mask e imagem com tamanhos diferentes: image=${mi?.width}x${mi?.height}, mask=${mm?.width}x${mm?.height}`);
    }
  }

  const modelsTry = [IMAGE_MODEL, "dall-e-2"].filter(Boolean);

  let lastErr = null;
  for (const model of modelsTry) {
    try {
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", prompt);
      form.append("size", size);
      form.append("response_format", "b64_json");
      form.append("n", "1");

      form.append("image", new Blob([imgBuf], { type: "image/png" }), path.basename(imagePngPath) || "image.png");
      if (maskBuf) form.append("mask", new Blob([maskBuf], { type: "image/png" }), path.basename(maskPngPath) || "mask.png");

      const r = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: form,
      });

      const text = await r.text();
      if (!r.ok) throw new Error(`OpenAI Images HTTP ${r.status}: ${text.slice(0, 2000)}`);

      const data = JSON.parse(text);
      const outB64 = data?.data?.[0]?.b64_json;
      if (!outB64) throw new Error("Não retornou b64_json.");
      return Buffer.from(outB64, "base64");
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e || "");
      if (isModelAccessError(msg)) continue;
      throw e;
    }
  }

  throw lastErr || new Error("Falha ao gerar imagem (OpenAI fallback).");
}

/**
 * IMAGEM SEQUENCIAL (principal)
 * - Replicate se token configurado
 * - Senão: fallback OpenAI /v1/images/edits
 * - Retorna Buffer PNG
 */
async function openaiImageEditFromReference({ imagePngPath, maskPngPath, prompt, size = "1024x1024" }) {
  if (REPLICATE_API_TOKEN) {
    const imgBuf = await fsp.readFile(imagePngPath);
    const input = {
      prompt,
      image_input: [bufferToDataUrlPng(imgBuf)],
      aspect_ratio: REPLICATE_ASPECT_RATIO || "1:1",
      resolution: REPLICATE_RESOLUTION || "2K",
      output_format: REPLICATE_OUTPUT_FORMAT || "png",
      safety_filter_level: REPLICATE_SAFETY || "block_only_high",
    };

    const created = await replicateCreatePrediction({
      model: REPLICATE_MODEL || "google/nano-banana-pro",
      input,
      timeoutMs: 120000,
    });

    const pred = await replicateWaitPrediction(created?.id, { timeoutMs: 300000, pollMs: 1200 });

    let url = "";
    if (typeof pred?.output === "string") url = pred.output;
    else if (Array.isArray(pred?.output) && typeof pred.output[0] === "string") url = pred.output[0];
    if (!url) throw new Error("Replicate não retornou URL de imagem.");

    const buf = await downloadToBuffer(url, 240000);
    return await sharp(buf).png().toBuffer();
  }

  return await openaiImageEditFallback({ imagePngPath, maskPngPath, prompt, size });
}

// ------------------------------
// História em TEXTO
// ------------------------------
async function generateStoryTextPages({ childName, childAge, childGender, themeKey, pagesCount }) {
  const theme_key = String(themeKey || "space");
  const age = clamp(childAge, 2, 12);
  const gender = String(childGender || "neutral");
  const name = String(childName || "Criança").trim() || "Criança";
  const pages = clamp(pagesCount || 8, 4, 12);

  const system = [
    "Você é um escritor de livros infantis.",
    "Crie uma história curta e positiva, apropriada para a idade.",
    "Retorne em PÁGINAS (cada página = 1 parágrafo).",
    "Cada página deve ter: page (número), title (string curta), text (UM PARÁGRAFO, sem quebras de linha).",
    "Limite aproximado: até ~55 palavras se <=7 anos; até ~75 se >7.",
    "Regras:",
    "- O nome da criança deve aparecer no texto e ser o protagonista.",
    "- Linguagem simples, divertida e mágica, com uma pequena lição.",
    'Responda SOMENTE JSON válido no formato: {"pages":[...]}',
  ].join("\n");

  const userObj = {
    child: { name, age, gender },
    theme: theme_key,
    theme_desc: themeDesc(theme_key),
    requirements: {
      pages,
      max_words_per_page: age <= 7 ? 55 : 75,
      must_include_child_name_in_text: true,
      one_paragraph_per_page: true,
    },
  };

  const data = await openaiResponsesWithFallback({
    models: [TEXT_MODEL, "gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"],
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(userObj) },
    ],
    jsonObject: true,
    timeoutMs: 150000,
  });

  const content = data?.output?.[0]?.content?.[0]?.text ?? null;
  if (!content) throw new Error("OpenAI retornou resposta sem JSON de história.");

  let obj;
  try {
    obj = JSON.parse(content);
  } catch {
    throw new Error("Falha ao interpretar JSON da história.");
  }

  const out = Array.isArray(obj?.pages) ? obj.pages : null;
  if (!out || out.length < 1) throw new Error("História inválida: pages vazio.");

  const norm = out.slice(0, pages).map((p, i) => {
    const page = clamp(p?.page ?? i + 1, 1, 999);
    const title = String(p?.title ?? `Página ${page}`).trim() || `Página ${page}`;
    const text = String(p?.text ?? "").trim().replace(/\s+/g, " ");
    return { page, title, text };
  });

  norm.sort((a, b) => a.page - b.page);
  for (let i = 0; i < norm.length; i++) norm[i].page = i + 1;
  return norm;
}

// ------------------------------
// Prompts de imagem
// ------------------------------
function buildScenePromptFromParagraph({ paragraphText, themeKey, childName, styleKey }) {
  const th = themeDesc(themeKey);
  const name = String(childName || "").trim();
  const txt = String(paragraphText || "").trim();
  const style = String(styleKey || "read").trim();

  const base = [
    "Crie UMA CENA para este texto:",
    `"${txt}"`,
    "Regras IMPORTANTES:",
    "- Use a criança da imagem enviada como personagem principal.",
    "- Mantenha TODAS as características originais dela (rosto, cabelo, cor da pele, traços). Não altere identidade.",
    "- Mantenha a identidade consistente em todas as páginas (same face, same hairstyle, same skin tone).",
    `- Tema da história: ${th}.`,
    "- Composição: criança integrada naturalmente na cena, com ação e emoção compatíveis com o texto.",
    "- NÃO escreva texto/legendas na imagem gerada (eu vou colocar o texto depois no PNG).",
    name ? `Nome (contexto): ${name}.` : "",
  ].filter(Boolean);

  if (style === "color") {
    base.splice(
      5,
      0,
      [
        "- Estilo: página de livro de colorir (coloring book).",
        "- PRETO E BRANCO, contornos bem definidos, traço limpo, linhas mais grossas.",
        "- SEM cores, SEM gradientes, SEM sombras, SEM pintura, SEM texturas realistas.",
        "- Fundo branco (ou bem claro), poucos detalhes no fundo.",
      ].join(" ")
    );
  } else {
    base.splice(5, 0, "- Estilo: ilustração semi-realista infantil, alegre, cores agradáveis, luz suave.");
  }

  return base.join(" ");
}

function buildCoverPrompt({ themeKey, childName, styleKey }) {
  const th = themeDesc(themeKey);
  const name = String(childName || "").trim();
  const style = String(styleKey || "read").trim();

  const parts = [
    "Crie uma CAPA de livro infantil.",
    "Use a criança da imagem como personagem principal e mantenha suas características originais.",
    "Mantenha identidade consistente com a foto (same face, same hairstyle, same skin tone).",
    `Tema: ${th}.`,
    "Cena de capa: alegre, mágica, positiva, com a criança em destaque no centro.",
    "NÃO escreva texto/legendas na imagem (eu vou aplicar depois).",
    name ? `Nome (contexto): ${name}.` : "",
  ].filter(Boolean);

  if (style === "color") {
    parts.splice(
      1,
      0,
      [
        "Estilo: CAPA para colorir (coloring book).",
        "PRETO E BRANCO, contornos fortes, traço limpo.",
        "SEM cores, SEM gradientes, SEM sombras, SEM pintura.",
        "Fundo branco (ou bem claro) e poucos detalhes.",
      ].join(" ")
    );
  } else {
    parts.splice(1, 0, "Estilo: ilustração semi-realista, alegre, colorida, luz suave.");
  }

  return parts.join(" ");
}

// ------------------------------
// Texto DENTRO do PNG (Sharp + SVG overlay)
// ------------------------------
function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapLines(text, maxCharsPerLine) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (next.length <= maxCharsPerLine) cur = next;
    else {
      if (cur) lines.push(cur);
      if (w.length > maxCharsPerLine) {
        lines.push(w.slice(0, maxCharsPerLine));
        cur = w.slice(maxCharsPerLine);
      } else cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

async function stampStoryTextOnImage({ inputPath, outputPath, title, text }) {
  const img = sharp(inputPath);
  const meta = await img.metadata();
  const W = Math.max(1, meta.width || 1024);
  const H = Math.max(1, meta.height || 1024);

  const pad = Math.round(W * 0.04);
  const bandH = Math.round(H * 0.32);
  const rx = Math.round(Math.min(W, H) * 0.03);

  const bandX = pad;
  const bandY = H - bandH - pad;
  const bandW = W - pad * 2;

  const innerPadX = Math.round(bandW * 0.045);
  const textX = bandX + innerPadX;

  const titleTxt = String(title || "").trim();
  const bodyTxt = String(text || "").trim().replace(/\s+/g, " ");

  let titleSize = Math.max(34, Math.min(76, Math.round(H * 0.064)));
  let textSize = Math.max(30, Math.min(60, Math.round(H * 0.052)));

  const TITLE_MIN = 28;
  const TEXT_MIN = 20;

  const topPadY = Math.round(bandH * 0.18);
  const botPadY = Math.round(bandH * 0.16);
  const usableH = Math.max(1, bandH - topPadY - botPadY);

  const usableW = Math.max(1, bandW - innerPadX * 2);

  function estimateCharsPerLine(fontPx) {
    const avgCharW = fontPx * 0.56;
    return Math.max(18, Math.floor(usableW / avgCharW));
  }

  function buildLines(ts, bs) {
    const titleChars = Math.max(18, Math.floor(estimateCharsPerLine(ts) * 0.82));
    const bodyChars = estimateCharsPerLine(bs);

    const titleLines = titleTxt ? wrapLines(titleTxt, titleChars) : [];
    const bodyLines = bodyTxt ? wrapLines(bodyTxt, bodyChars) : [];

    const lineGapTitle = Math.round(ts * 1.15);
    const lineGapBody = Math.round(bs * 1.28);

    const titleH = titleLines.length ? titleLines.length * lineGapTitle : 0;
    const spacer = titleLines.length ? Math.round(bs * 0.55) : 0;
    const bodyH = bodyLines.length ? bodyLines.length * lineGapBody : 0;

    return { titleLines, bodyLines, lineGapTitle, lineGapBody, usedH: titleH + spacer + bodyH, spacer };
  }

  let pack = buildLines(titleSize, textSize);
  let guard = 0;
  while (pack.usedH > usableH && guard < 60) {
    guard++;
    if (textSize > TEXT_MIN) textSize -= 1;
    else if (titleSize > TITLE_MIN) titleSize -= 1;
    else break;
    pack = buildLines(titleSize, textSize);
  }

  let tY = bandY + topPadY;

  const titleSvg = pack.titleLines.length
    ? `<text x="${textX}" y="${tY}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="900" fill="#0f172a">
        ${pack.titleLines
          .map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : pack.lineGapTitle}">${escapeXml(ln)}</tspan>`)
          .join("")}
      </text>`
    : "";

  tY += pack.titleLines.length ? pack.titleLines.length * pack.lineGapTitle + pack.spacer : 0;

  const textSvg = pack.bodyLines.length
    ? `<text x="${textX}" y="${tY}" font-family="Helvetica, Arial, sans-serif" font-size="${textSize}" font-weight="800" fill="#0f172a">
        ${pack.bodyLines
          .map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : pack.lineGapBody}">${escapeXml(ln)}</tspan>`)
          .join("")}
      </text>`
    : "";

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.25"/>
      </filter>
    </defs>

    <rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}"
          rx="${rx}" ry="${rx}"
          fill="#FFFFFF" fill-opacity="0.50"
          filter="url(#shadow)"/>

    ${titleSvg}
    ${textSvg}
  </svg>`;

  await sharp(inputPath).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(outputPath);
  return outputPath;
}

async function stampCoverTextOnImage({ inputPath, outputPath, title, subtitle }) {
  const img = sharp(inputPath);
  const meta = await img.metadata();

  const W = Math.max(1, meta.width || 1024);
  const H = Math.max(1, meta.height || 1024);

  const pad = Math.round(W * 0.06);
  const bandH = Math.round(H * 0.22);
  const rx = Math.round(Math.min(W, H) * 0.035);

  const titleSize = Math.max(34, Math.min(78, Math.round(H * 0.07)));
  const subSize = Math.max(22, Math.min(48, Math.round(H * 0.043)));

  const maxChars = Math.max(18, Math.min(46, Math.round(W / 26)));
  const titleLines = wrapLines(title, Math.max(18, Math.min(34, Math.round(maxChars * 0.85)))).slice(0, 2);
  const subLines = wrapLines(subtitle, maxChars).slice(0, 2);

  const bandX = pad;
  const bandY = pad;
  const bandW = W - pad * 2;

  const textX = bandX + Math.round(bandW * 0.06);
  let tY = bandY + Math.round(bandH * 0.48);

  const lineGapTitle = Math.round(titleSize * 1.15);
  const lineGapSub = Math.round(subSize * 1.25);

  const titleSvg = `<text x="${textX}" y="${tY}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="950" fill="#0f172a">
      ${titleLines.map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : lineGapTitle}">${escapeXml(ln)}</tspan>`).join("")}
    </text>`;

  tY += titleLines.length ? lineGapTitle * titleLines.length + Math.round(subSize * 0.35) : 0;

  const subSvg = subLines.length
    ? `<text x="${textX}" y="${tY}" font-family="Helvetica, Arial, sans-serif" font-size="${subSize}" font-weight="800" fill="#0f172a">
        ${subLines.map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : lineGapSub}">${escapeXml(ln)}</tspan>`).join("")}
      </text>`
    : "";

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.28"/>
      </filter>
    </defs>

    <rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}"
          rx="${rx}" ry="${rx}"
          fill="#FFFFFF" fill-opacity="0.86"
          filter="url(#shadow)"/>

    ${titleSvg}
    ${subSvg}
  </svg>`;

  await sharp(inputPath).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(outputPath);
  return outputPath;
}

// ------------------------------
// PDF: só imagens
// ------------------------------
async function makePdfImagesOnly({ bookId, coverPath, pageImagePaths, outputDir }) {
  await ensureDir(outputDir);
  const pdfPath = path.join(outputDir, `book-${bookId}.pdf`);
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  const A4_W = doc.page.width;
  const A4_H = doc.page.height;

  const all = [];
  if (coverPath && existsSyncSafe(coverPath)) all.push(coverPath);
  for (const p of pageImagePaths || []) if (p && existsSyncSafe(p)) all.push(p);

  for (let i = 0; i < all.length; i++) {
    const imgPath = all[i];
    doc.rect(0, 0, A4_W, A4_H).fill("#FFFFFF");
    try {
      doc.image(imgPath, 0, 0, { fit: [A4_W, A4_H], align: "center", valign: "center" });
    } catch {}
    if (i !== all.length - 1) doc.addPage();
  }

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return pdfPath;
}

// ------------------------------
// Manifest (disco)
// ------------------------------
function bookDirOf(userId, bookId) {
  return path.join(BOOKS_DIR, String(userId), String(bookId));
}
function manifestPathOf(userId, bookId) {
  return path.join(bookDirOf(userId, bookId), "book.json");
}

async function loadManifest(userId, bookId) {
  const p = manifestPathOf(userId, bookId);
  if (!existsSyncSafe(p)) return null;
  return readJson(p);
}
async function saveManifest(userId, bookId, manifest) {
  await writeJson(manifestPathOf(userId, bookId), manifest);
}

function makeEmptyManifest(id, ownerId) {
  return {
    id,
    ownerId: String(ownerId || ""),
    createdAt: nowISO(),
    status: "created", // created | generating | done | failed
    step: "created",
    error: "",
    theme: "",
    style: "read", // read | color
    child: { name: "", age: 6, gender: "neutral" },

    photo: { ok: false, file: "", mime: "", editBase: "", storageKey: "", url: "" },
    mask: { ok: false, file: "", editBase: "", storageKey: "", url: "" },

    pages: [],
    images: [],

    cover: { ok: false, file: "", storageKey: "", url: "" },
    pdf: "",
    pdf_storageKey: "",
    updatedAt: nowISO(),
  };
}

// ------------------------------
// Jobs em memória
// ------------------------------
const jobs = new Map(); // "userId:bookId" -> { running: bool }

// ------------------------------
// DB: books/profiles
// ------------------------------
function manifestToBookRow(userId, m) {
  return {
    id: m.id,
    user_id: userId,

    status: m.status || "created",
    step: m.step || "created",
    error: m.error || "",

    theme: m.theme || "",
    style: m.style || "read",

    child: m.child || {},
    child_name: String(m.child?.name || ""),
    child_age: Number(m.child?.age ?? 6),
    child_gender: String(m.child?.gender || "neutral"),

    cover: m.cover || {},
    pages: Array.isArray(m.pages) ? m.pages : [],
    images: Array.isArray(m.images) ? m.images : [],

    photo: m.photo || {},
    mask: m.mask || {},

    pdf: m.pdf || "",
    pdf_url: m.pdf || "",

    manifest: m,

    updated_at: new Date().toISOString(),
  };
}

function bookRowToManifest(row) {
  const m = row?.manifest && typeof row.manifest === "object" ? row.manifest : {};
  m.id = m.id || row?.id;
  m.ownerId = m.ownerId || row?.user_id;

  m.status = m.status || row?.status || "created";
  m.step = m.step || row?.step || "created";
  m.error = m.error || row?.error || "";

  m.theme = m.theme || row?.theme || "";
  m.style = m.style || row?.style || "read";

  if (!m.child || typeof m.child !== "object") m.child = {};
  m.child.name = m.child.name || row?.child_name || "";
  m.child.age = Number(m.child.age ?? row?.child_age ?? 6);
  m.child.gender = m.child.gender || row?.child_gender || "neutral";

  m.cover = m.cover || row?.cover || {};
  m.pages = Array.isArray(m.pages) ? m.pages : Array.isArray(row?.pages) ? row.pages : [];
  m.images = Array.isArray(m.images) ? m.images : Array.isArray(row?.images) ? row.images : [];

  m.photo = m.photo || row?.photo || {};
  m.mask = m.mask || row?.mask || {};
  m.pdf = m.pdf || row?.pdf || row?.pdf_url || "";

  m.updatedAt = m.updatedAt || row?.updated_at || new Date().toISOString();
  m.createdAt = m.createdAt || row?.created_at || new Date().toISOString();
  return m;
}

async function dbGetBookUser(sbUser, bookId) {
  const { data, error } = await sbUser.from("books").select("*").eq("id", bookId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function dbUpsertBookUser(sbUser, userId, manifest) {
  const row = manifestToBookRow(userId, manifest);
  const { error } = await sbUser.from("books").upsert(row, { onConflict: "id" });
  if (error) throw error;
  return true;
}

async function dbUpsertBookAdmin(userId, manifest) {
  if (!supabaseAdmin) return false;
  const row = manifestToBookRow(userId, manifest);
  const { error } = await supabaseAdmin.from("books").upsert(row, { onConflict: "id" });
  if (error) throw error;
  return true;
}

async function dbInsertProfileAdmin(userId, name) {
  if (!supabaseAdmin) return false;
  const { error } = await supabaseAdmin.from("profiles").upsert({ id: userId, name: String(name || "") }, { onConflict: "id" });
  if (error) throw error;
  return true;
}

// ✅ Persistência unificada: disco + DB
async function saveManifestAll(userId, bookId, manifest, { sbUser = null } = {}) {
  await saveManifest(userId, bookId, manifest);

  if (sbUser) {
    try {
      await dbUpsertBookUser(sbUser, userId, manifest);
      return true;
    } catch (e) {
      console.warn("⚠️  DB upsert (user/RLS) falhou (continuando):", String(e?.message || e));
    }
  }

  if (supabaseAdmin) {
    try {
      await dbUpsertBookAdmin(userId, manifest);
      return true;
    } catch (e) {
      console.warn("⚠️  DB upsert (admin) falhou (continuando só com disco):", String(e?.message || e));
    }
  }

  return false;
}

async function loadManifestAll(userId, bookId, { sbUser = null, allowAdminFallback = true } = {}) {
  const disk = await loadManifest(userId, bookId);
  if (disk) return disk;

  if (sbUser) {
    try {
      const row = await dbGetBookUser(sbUser, bookId);
      if (row) {
        const m = bookRowToManifest(row);
        await saveManifest(userId, bookId, m).catch(() => {});
        return m;
      }
    } catch (e) {
      console.warn("⚠️  DB read (user/RLS) falhou:", String(e?.message || e));
    }
  }

  if (allowAdminFallback && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.from("books").select("*").eq("id", bookId).maybeSingle();
      if (error) throw error;
      if (data) {
        const m = bookRowToManifest(data);
        await saveManifest(userId, bookId, m).catch(() => {});
        return m;
      }
    } catch (e) {
      console.warn("⚠️  DB read (admin) falhou:", String(e?.message || e));
    }
  }

  return null;
}

// ------------------------------
// Express
// ------------------------------
const app = express();
app.use(express.json({ limit: JSON_LIMIT }));
app.use("/examples", express.static(path.join(__dirname, "public/examples"), { fallthrough: true }));

app.get("/api/debug-fs", (req, res) => {
  res.json({
    ok: true,
    VERCEL: !!process.env.VERCEL,
    __dirname,
    OUT_ROOT,
    OUT_DIR,
    tmpdir: os.tmpdir(),
    STORAGE_BUCKET,
    hasServiceRole: !!supabaseAdmin,
  });
});

// ------------------------------
// LOGIN UI (mantive simples e funcional)
// ------------------------------
app.get("/login", async (req, res) => {
  const nextUrl = String(req.query?.next || "/create");
  const user = await getCurrentUser(req, res).catch(() => null);
  if (user) return res.redirect(nextUrl || "/create");

  res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Login — Meu Livro Mágico</title>
<style>
  :root{--bg1:#ede9fe;--bg2:#fff;--bg3:#fdf2f8;--text:#111827;--muted:#6b7280;--border:#e5e7eb;--violet:#7c3aed;--pink:#db2777;}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:linear-gradient(to bottom,var(--bg1),var(--bg2),var(--bg3));min-height:100vh;display:grid;place-items:center;padding:24px;color:var(--text);}
  .card{width:min(520px,100%);background:#fff;border:1px solid var(--border);border-radius:22px;box-shadow:0 20px 50px rgba(0,0,0,.10);padding:18px;}
  h1{margin:8px 0 0;font-size:26px;font-weight:1000;text-align:center;}
  p{margin:8px 0 0;text-align:center;color:var(--muted);font-weight:800;}
  .tabs{display:flex;gap:10px;margin-top:16px;}
  .tab{flex:1;border:1px solid var(--border);background:#fff;border-radius:999px;padding:10px 12px;cursor:pointer;font-weight:1000;color:#374151;}
  .tab.active{background:linear-gradient(90deg,var(--violet),var(--pink));color:#fff;border-color:transparent;}
  .field{margin-top:12px;}
  .label{font-weight:1000;margin:0 0 6px;}
  input{width:100%;border:1px solid var(--border);border-radius:14px;padding:12px 12px;font-size:15px;font-weight:900;outline:none;}
  input:focus{border-color:rgba(124,58,237,.4);box-shadow:0 0 0 4px rgba(124,58,237,.12);}
  .btn{width:100%;margin-top:14px;border:0;border-radius:999px;padding:12px 14px;font-weight:1000;cursor:pointer;color:#fff;background:linear-gradient(90deg,var(--violet),var(--pink));box-shadow:0 16px 34px rgba(124,58,237,.22);}
  .hint{margin-top:12px;padding:10px 12px;border-radius:14px;background:rgba(219,39,119,.06);border:1px solid rgba(219,39,119,.14);color:#7f1d1d;font-weight:900;display:none;white-space:pre-wrap;}
  a.link{display:block;text-align:center;margin-top:12px;color:#4c1d95;font-weight:1000;text-decoration:none;}
  a.link:hover{text-decoration:underline;}
</style>
</head>
<body>
  <div class="card">
    <h1>🔐 Entrar / Criar Conta</h1>
    <p>Para criar o livro mágico, você precisa estar logado.</p>

    <div class="tabs">
      <button class="tab active" id="tabLogin">Entrar</button>
      <button class="tab" id="tabSignup">Criar conta</button>
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
      <button class="btn" id="btnDoLogin">Entrar</button>
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
      <button class="btn" id="btnDoSignup">Criar conta</button>
    </div>

    <div class="hint" id="hint"></div>

    <a class="link" href="/sales">← Voltar</a>
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
    const r = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body||{}) });
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
    }catch(e){ setHint(String(e.message || e)); }
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
      const r = await postJson("/api/auth/signup", { name, email, password });
      if (r.needs_email_confirm) {
        setHint("Conta criada! Confirme seu e-mail e depois faça login.");
        return;
      }
      window.location.href = nextUrl || "/create";
    }catch(e){ setHint(String(e.message || e)); }
  };
</script>
</body>
</html>`);
});

// ------------------------------
// AUTH API
// ------------------------------
app.post("/api/auth/signup", async (req, res) => {
  try {
    assertSupabaseAnon();

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || name.length < 2) return res.status(400).json({ ok: false, error: "Nome inválido." });
    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "E-mail inválido." });
    if (!password || password.length < 6) return res.status(400).json({ ok: false, error: "Senha deve ter no mínimo 6 caracteres." });

    const { data, error } = await supabaseAnon.auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw error;

    const accessToken = data?.session?.access_token || "";
    const refreshToken = data?.session?.refresh_token || "";

    const uid = data?.user?.id || "";
    if (uid && supabaseAdmin) {
      try { await dbInsertProfileAdmin(uid, name); }
      catch (e) { console.warn("⚠️  Falha ao upsert profiles:", String(e?.message || e)); }
    }

    if (accessToken) {
      setUserTokens(res, { access: accessToken, refresh: refreshToken });
      return res.json({ ok: true, needs_email_confirm: false });
    }

    return res.json({ ok: true, needs_email_confirm: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    assertSupabaseAnon();

    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "E-mail inválido." });
    if (!password) return res.status(400).json({ ok: false, error: "Senha obrigatória." });

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ ok: false, error: "E-mail ou senha incorretos." });

    const accessToken = data?.session?.access_token || "";
    const refreshToken = data?.session?.refresh_token || "";
    if (!accessToken) return res.status(500).json({ ok: false, error: "Falha ao obter token." });

    setUserTokens(res, { access: accessToken, refresh: refreshToken });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    clearUserTokens(res);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

// ------------------------------
// UI / SALES
// ------------------------------
app.get("/sales", (req, res) => {
  if (existsSyncSafe(LANDING_HTML)) return res.sendFile(LANDING_HTML);
  res.type("html").send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Meu Livro Mágico</title></head>
<body style="font-family:system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1220;color:#fff;">
  <div style="max-width:820px;margin:24px;padding:24px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);">
    <h1 style="margin:0 0 10px 0;font-size:28px;">📚 Meu Livro Mágico</h1>
    <p style="opacity:.9;line-height:1.6;margin:0 0 14px 0;">Gere um livro infantil personalizado com foto, história e imagens.</p>
    <a href="/create" style="display:inline-flex;gap:10px;align-items:center;padding:12px 16px;border-radius:14px;background:#ff6b6b;color:#fff;text-decoration:none;font-weight:900;">✨ Ir para o gerador</a>
  </div>
</body></html>`);
});

app.get("/como-funciona", (req, res) => {
  if (existsSyncSafe(HOW_IT_WORKS_HTML)) return res.sendFile(HOW_IT_WORKS_HTML);
  res.type("html").send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Como funciona</title></head>
<body style="font-family:system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#ede9fe,#fff,#fdf2f8);color:#111827;">
  <div style="max-width:860px;margin:24px;padding:24px;border-radius:18px;background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 20px 50px rgba(0,0,0,.10);">
    <h1 style="margin:0 0 10px 0;font-size:28px;">✨ Como funciona</h1>
    <ol style="line-height:1.7;font-weight:800;">
      <li>Envie a foto</li>
      <li>Escolha tema e estilo</li>
      <li>Geramos história + imagens</li>
      <li>Geramos PDF</li>
    </ol>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
      <a href="/sales" style="padding:12px 16px;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff;text-decoration:none;font-weight:1000;">🛒 Voltar</a>
      <a href="/create" style="padding:12px 16px;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff;text-decoration:none;font-weight:1000;">📚 Gerador</a>
    </div>
  </div>
</body></html>`);
});

app.get("/exemplos", (req, res) => {
  if (existsSyncSafe(EXEMPLOS_HTML)) return res.sendFile(EXEMPLOS_HTML);
  return res.status(404).type("html").send(`<h1>exemplos.html não encontrado</h1><p>Coloque um arquivo <code>exemplos.html</code> ao lado do <code>app.js</code>.</p>`);
});

// ------------------------------
// UI / GERADOR (mantive simples: você pode colar seu HTML completo aqui se quiser)
// ------------------------------
function renderGeneratorHtml(req, res) {
  res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Criar — Meu Livro Mágico</title>
<style>
  :root{--bg1:#ede9fe;--bg2:#fff;--bg3:#fdf2f8;--text:#111827;--muted:#6b7280;--border:#e5e7eb;--violet:#7c3aed;--pink:#db2777;}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:linear-gradient(to bottom,var(--bg1),var(--bg2),var(--bg3));min-height:100vh;color:var(--text);padding:24px;}
  .card{max-width:720px;margin:0 auto;background:#fff;border:1px solid var(--border);border-radius:22px;box-shadow:0 20px 50px rgba(0,0,0,.10);padding:18px;}
  h1{margin:0;font-size:24px;font-weight:1000;}
  p{margin:8px 0 0;color:var(--muted);font-weight:800;}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}
  .btn{border:0;border-radius:999px;padding:12px 16px;font-weight:1000;cursor:pointer;color:#fff;background:linear-gradient(90deg,var(--violet),var(--pink));}
  .ghost{background:transparent;color:#4c1d95;border:1px solid rgba(124,58,237,.25);}
  input,select{width:100%;padding:12px;border:1px solid var(--border);border-radius:14px;font-weight:900;}
  .field{margin-top:12px;}
  .hint{margin-top:12px;padding:10px 12px;border-radius:14px;background:rgba(219,39,119,.06);border:1px solid rgba(219,39,119,.14);color:#7f1d1d;font-weight:900;display:none;white-space:pre-wrap;}
</style>
</head>
<body>
<div class="card">
  <h1>📚 Criar livro</h1>
  <p>Versão Vercel-safe: imagens e PDF persistem no Supabase Storage.</p>

  <div class="field"><div style="font-weight:1000;margin-bottom:6px;">Foto (PNG/JPG)</div><input id="file" type="file" accept="image/*"/></div>
  <div class="field"><div style="font-weight:1000;margin-bottom:6px;">Nome</div><input id="childName" placeholder="Ex: Enzo"/></div>
  <div class="field"><div style="font-weight:1000;margin-bottom:6px;">Idade</div><input id="childAge" type="number" min="2" max="12" value="6"/></div>
  <div class="field"><div style="font-weight:1000;margin-bottom:6px;">Gênero</div>
    <select id="childGender"><option value="neutral">Neutro</option><option value="boy">Menino</option><option value="girl">Menina</option></select>
  </div>
  <div class="field"><div style="font-weight:1000;margin-bottom:6px;">Tema</div>
    <select id="theme"><option value="space">Espaço</option><option value="dragon">Dragões</option><option value="ocean">Mar</option><option value="jungle">Selva</option><option value="superhero">Super-herói</option><option value="dinosaur">Dinossauro</option></select>
  </div>
  <div class="field"><div style="font-weight:1000;margin-bottom:6px;">Estilo</div>
    <select id="style"><option value="read">Leitura</option><option value="color">Leitura + Colorir</option></select>
  </div>

  <div class="row">
    <button class="btn" id="btnCreate">1) Criar Book</button>
    <button class="btn ghost" id="btnGenerate">2) Ir para /generate</button>
    <a class="btn ghost" href="/books">📚 Meus Livros</a>
    <button class="btn ghost" id="btnLogout">Sair</button>
  </div>

  <div class="hint" id="hint"></div>
</div>

<script>
  const $ = (id)=>document.getElementById(id);
  const hint = $("hint");
  function setHint(msg){ hint.textContent=msg||""; hint.style.display=msg?"block":"none"; }

  async function postJson(url, body){
    const r = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body||{}) });
    const j = await r.json().catch(()=> ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Falha");
    return j;
  }

  function fileToDataURL(file){
    return new Promise((resolve,reject)=>{
      const fr = new FileReader();
      fr.onload = ()=> resolve(fr.result);
      fr.onerror = ()=> reject(new Error("Falha ao ler arquivo"));
      fr.readAsDataURL(file);
    });
  }

  let bookId = localStorage.getItem("bookId") || "";

  $("btnCreate").onclick = async ()=>{
    setHint("");
    try{
      const r = await postJson("/api/create", {});
      bookId = r.id;
      localStorage.setItem("bookId", bookId);
      setHint("Book criado: " + bookId);
    }catch(e){ setHint(String(e.message||e)); }
  };

  $("btnGenerate").onclick = async ()=>{
    setHint("");
    try{
      if (!bookId) throw new Error("Crie o book primeiro.");
      const f = $("file").files && $("file").files[0];
      if (!f) throw new Error("Selecione uma foto.");
      const photo = await fileToDataURL(f);

      // cria mask vazia (igual tamanho depois o servidor alinha)
      const img = new Image();
      const url = URL.createObjectURL(f);
      await new Promise((ok,err)=>{ img.onload=ok; img.onerror=()=>err(new Error("Falha ao abrir imagem")); img.src=url; });
      URL.revokeObjectURL(url);
      const c = document.createElement("canvas"); c.width = Math.min(img.width,1024); c.height = Math.min(img.height,1024);
      const ctx = c.getContext("2d"); ctx.drawImage(img,0,0,c.width,c.height);
      const photoPng = c.toDataURL("image/png");
      const m = document.createElement("canvas"); m.width=c.width; m.height=c.height;
      const maskPng = m.toDataURL("image/png");

      await postJson("/api/uploadPhoto", { id: bookId, photo: photoPng, mask: maskPng });

      localStorage.setItem("childName", $("childName").value||"");
      localStorage.setItem("childAge", $("childAge").value||"6");
      localStorage.setItem("childGender", $("childGender").value||"neutral");
      localStorage.setItem("theme", $("theme").value||"space");
      localStorage.setItem("style", $("style").value||"read");
      window.location.href = "/generate";
    }catch(e){ setHint(String(e.message||e)); }
  };

  $("btnLogout").onclick = async ()=>{
    await fetch("/api/auth/logout", { method:"POST" }).catch(()=>{});
    localStorage.clear();
    window.location.href="/sales";
  };
</script>
</body></html>`);
}

app.get("/", requireAuth, renderGeneratorHtml);
app.get("/create", requireAuth, renderGeneratorHtml);

// ------------------------------
// (Opcional) /books e /generate como módulos externos (se existirem)
// ------------------------------
try {
  const mountBooks = require(path.join(__dirname, "books"));
  mountBooks(app, { OUT_DIR, requireAuth });
  console.log("✅ /books ativo: módulo books/ carregado.");
} catch {
  // ok
}

try {
  const mountGeneratePage = require(path.join(__dirname, "generate.page.js"));
  mountGeneratePage(app, { requireAuth });
  console.log("✅ /generate ativo: generate.page.js carregado.");
} catch {
  // ok
}
// ------------------------------
// ✅ /admin (Painel Admin)
// ------------------------------
const USERS_FILE = path.join(OUT_DIR, "users.json");

// ------------------------------
// ✅ /admin (Painel Admin) — Vercel-safe path
// ------------------------------
const USERS_FILE = path.join(OUT_DIR, "users.json");

try {
  const candidates = [
    path.join(__dirname, "admin.page.js"),                 // mesma pasta do app.js
    path.join(process.cwd(), "admin.page.js"),             // raiz do projeto
    path.join(process.cwd(), "api", "admin.page.js"),      // /api (comum na Vercel)
  ];

  const adminPath = candidates.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  if (!adminPath) {
    throw new Error(
      "admin.page.js não encontrado. Procurei em:\n" + candidates.join("\n")
    );
  }

  console.log("✅ admin.page.js encontrado em:", adminPath);

  const mountAdminPage = require(adminPath);
  mountAdminPage(app, { OUT_DIR, USERS_FILE, requireAuth });

  console.log("✅ /admin ativo!");
} catch (e) {
  console.warn("⚠️  /admin NÃO carregou:", String(e?.message || e));
}
// ------------------------------
// API: create
// ------------------------------
app.post("/api/create", async (req, res) => {
  try {
    const user = await requireAuthApi(req, res);
    if (!user) return;

    await ensureDir(OUT_DIR);
    await ensureDir(BOOKS_DIR);

    const id = safeId();
    const bookDir = bookDirOf(user.id, id);
    await ensureDir(bookDir);

    const m = makeEmptyManifest(id, user.id);
    m.ownerId = String(user.id || "");

    await saveManifestAll(user.id, id, m, { sbUser: req.sb });
    return res.json({ ok: true, id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

// ------------------------------
// API: uploadPhoto (✅ agora faz upload persistente do edit_base e mask_base)
// ------------------------------
app.post("/api/uploadPhoto", async (req, res) => {
  try {
    const user = await requireAuthApi(req, res);
    if (!user) return;

    const id = String(req.body?.id || "").trim();
    const photo = req.body?.photo;
    const mask = req.body?.mask;

    if (!id) return res.status(400).json({ ok: false, error: "id ausente" });
    if (!photo || !isDataUrl(photo)) return res.status(400).json({ ok: false, error: "photo inválida (dataURL)" });
    if (!mask || !isDataUrl(mask)) return res.status(400).json({ ok: false, error: "mask inválida (dataURL)" });

    const m = await loadManifestAll(user.id, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });
    if (!canAccessBook(user.id, m, req.user)) return res.status(403).json({ ok: false, error: "forbidden" });

    const buf = dataUrlToBuffer(photo);
    const maskBuf = dataUrlToBuffer(mask);
    if (!buf || buf.length < 1000) return res.status(400).json({ ok: false, error: "photo inválida" });
    if (!maskBuf || maskBuf.length < 100) return res.status(400).json({ ok: false, error: "mask inválida" });

    const mime = guessMimeFromDataUrl(photo);
    const ext = guessExtFromMime(mime);

    const bookDir = bookDirOf(user.id, id);
    await ensureDir(bookDir);

    const originalPath = path.join(bookDir, "photo." + ext);
    await fsp.writeFile(originalPath, buf);

    const photoPngPath = path.join(bookDir, "photo.png");
    await sharp(buf).png().toFile(photoPngPath);

    const maskPngPath = path.join(bookDir, "mask.png");
    await sharp(maskBuf).ensureAlpha().png().toFile(maskPngPath);

    const photoMeta = await sharp(photoPngPath).metadata();
    const w0 = photoMeta?.width || 0;
    const h0 = photoMeta?.height || 0;
    if (!w0 || !h0) throw new Error("Falha ao ler metadata da foto.");

    const scale = Math.min(1, EDIT_MAX_SIDE / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const editBasePath = path.join(bookDir, "edit_base.png");
    await sharp(photoPngPath).resize({ width: w, height: h, fit: "fill", withoutEnlargement: true }).png().toFile(editBasePath);

    const maskBasePath = path.join(bookDir, "mask_base.png");
    await sharp(maskPngPath).resize({ width: w, height: h, fit: "fill", withoutEnlargement: true }).ensureAlpha().png().toFile(maskBasePath);

    const mi = await sharp(editBasePath).metadata();
    const mm = await sharp(maskBasePath).metadata();
    if ((mi?.width || 0) !== (mm?.width || 0) || (mi?.height || 0) !== (mm?.height || 0)) {
      throw new Error(`Falha ao alinhar base: image=${mi?.width}x${mi?.height}, mask=${mm?.width}x${mm?.height}`);
    }

    // ✅ Upload persistente no Storage (Vercel-safe)
    const upPhoto = await uploadLocalFileToStorage({
      userId: user.id,
      bookId: id,
      localPath: editBasePath,
      filename: "edit_base.png",
      contentType: "image/png",
    });

    const upMask = await uploadLocalFileToStorage({
      userId: user.id,
      bookId: id,
      localPath: maskBasePath,
      filename: "mask_base.png",
      contentType: "image/png",
    });

    m.photo = { ok: true, file: path.basename(originalPath), mime, editBase: "edit_base.png", storageKey: upPhoto.key, url: upPhoto.url };
    m.mask = { ok: true, file: "mask.png", editBase: "mask_base.png", storageKey: upMask.key, url: upMask.url };
    m.updatedAt = nowISO();

    await saveManifestAll(user.id, id, m, { sbUser: req.sb });

    return res.json({ ok: true, base: { w: mi?.width, h: mi?.height }, photoUrl: upPhoto.url, maskUrl: upMask.url });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

// ------------------------------
// API: status
// ------------------------------
app.get("/api/status/:id", requireAuth, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

    const id = String(req.params?.id || "").trim();
    const m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });

    if (!canAccessBook(userId, m, req.user)) return res.status(403).json({ ok: false, error: "forbidden" });

    const images = (m.images || []).map((it) => ({ page: it.page, url: it.url || "" }));
    const coverUrl = m.cover?.ok ? (m.cover?.url || "") : "";

    return res.json({
      ok: true,
      id: m.id,
      status: m.status,
      step: m.step,
      error: m.error,
      theme: m.theme || "",
      style: m.style || "read",
      coverUrl,
      images,
      pdf: m.pdf || "",
      updatedAt: m.updatedAt,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

// ------------------------------
// ✅ PROGRESS (usado pelo /generate)
// ------------------------------
app.get("/api/progress/:id", requireAuth, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "id ausente" });

    const m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });
    if (!canAccessBook(userId, m, req.user)) return res.status(403).json({ ok: false, error: "forbidden" });

    const totalSteps = 1 + 1 + 8 + 1;
    const pagesDone = Array.isArray(m.images) ? m.images.filter((x) => x && x.url).length : 0;

    let doneSteps = 0;
    if (Array.isArray(m.pages) && m.pages.length >= 8) doneSteps += 1;
    if (m.cover?.ok) doneSteps += 1;
    doneSteps += Math.min(8, pagesDone);
    if (m.status === "done" && m.pdf) doneSteps += 1;

    const message =
      m.status === "failed"
        ? "Falhou"
        : m.status === "done"
          ? "Livro pronto 🎉"
          : m.step?.startsWith("page_")
            ? "Gerando página…"
            : m.step === "cover"
              ? "Gerando capa…"
              : m.step === "story"
                ? "Criando história…"
                : m.step === "pdf"
                  ? "Gerando PDF…"
                  : "Preparando…";

    return res.json({
      ok: true,
      id: m.id,
      status: m.status,
      step: m.step,
      error: m.error || "",
      theme: m.theme || "",
      style: m.style || "read",
      doneSteps,
      totalSteps,
      message,
      coverUrl: m.cover?.url || "",
      images: (m.images || []).map((it) => ({ page: it.page, url: it.url || "" })),
      pdf: m.pdf || "",
      updatedAt: m.updatedAt || "",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

// ------------------------------
// ✅ Motor por etapas (VERCEL-SAFE)
// POST /api/generateNext
// ------------------------------
app.post("/api/generateNext", requireAuth, async (req, res) => {
  const userId = String(req.user?.id || "");
  if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

  const id = String(req.body?.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "id ausente" });

  const jobKey = `${userId}:${id}`;
  if (jobs.get(jobKey)?.running) return res.status(409).json({ ok: false, error: "step já em execução (aguarde e tente novamente)" });
  jobs.set(jobKey, { running: true });

  try {
    let m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });
    if (!canAccessBook(userId, m, req.user)) return res.status(403).json({ ok: false, error: "forbidden" });

    if (m.status === "done") {
      return res.json({
        ok: true,
        id,
        status: m.status,
        step: m.step,
        style: m.style,
        doneSteps: 11,
        totalSteps: 11,
        message: "Livro pronto 🎉",
        coverUrl: m.cover?.url || "",
        images: (m.images || []).map((it) => ({ page: it.page, url: it.url || "" })),
        pdf: m.pdf || "",
      });
    }
    if (m.status === "failed") {
      return res.json({ ok: true, id, status: m.status, step: m.step, message: "Falhou", error: m.error || "" });
    }

    // aplica configs idempotente
    const childName = String(req.body?.childName || m.child?.name || "").trim();
    const childAge = Number(req.body?.childAge ?? m.child?.age ?? 6);
    const childGender = String(req.body?.childGender || m.child?.gender || "neutral");
    const theme = String(req.body?.theme || m.theme || "space");
    const style = String(req.body?.style || m.style || "read");

    m.child = { name: childName, age: clamp(childAge, 2, 12), gender: childGender };
    m.theme = theme;
    m.style = style;

    if (m.status === "created") m.status = "generating";
    if (!m.step || m.step === "created") m.step = "starting";
    m.error = "";
    m.updatedAt = nowISO();

    const bookDir = bookDirOf(userId, id);
    await ensureDir(bookDir);

    // ✅ garante que edit_base/mask_base existem localmente (baixa do Storage se sumiu)
   // ✅ garante que edit_base/mask_base existem localmente (baixa do Storage se sumiu)
const imagePngPath = path.join(bookDir, m.photo?.editBase || "edit_base.png");
const maskPngPath  = path.join(bookDir, m.mask?.editBase  || "mask_base.png");

// primeiro tenta garantir local (puxa do Storage se necessário)
await ensureLocalFromStorage(imagePngPath, m.photo?.storageKey);
await ensureLocalFromStorage(maskPngPath,  m.mask?.storageKey);

// depois valida
if (!existsSyncSafe(imagePngPath)) throw new Error("edit_base.png não encontrada. Reenvie a foto.");
if (!existsSyncSafe(maskPngPath))  throw new Error("mask_base.png não encontrada. Reenvie a foto.");
    const totalSteps = 1 + 1 + 8 + 1;

    function buildProgress(mm, msg) {
      const pagesDone = Array.isArray(mm.images) ? mm.images.filter((x) => x && x.url).length : 0;
      let doneSteps = 0;
      if (Array.isArray(mm.pages) && mm.pages.length >= 8) doneSteps += 1;
      if (mm.cover?.ok) doneSteps += 1;
      doneSteps += Math.min(8, pagesDone);
      if (mm.status === "done" && mm.pdf) doneSteps += 1;

      return {
        ok: true,
        id,
        status: mm.status,
        step: mm.step,
        style: mm.style || "read",
        doneSteps,
        totalSteps,
        message: msg || "",
        coverUrl: mm.cover?.url || "",
        images: (mm.images || []).map((it) => ({ page: it.page, url: it.url || "" })),
        pdf: mm.pdf || "",
        error: mm.error || "",
      };
    }

    await saveManifestAll(userId, id, m, { sbUser: req.sb });

    // 1) STORY
    const needStory = !(Array.isArray(m.pages) && m.pages.length >= 8);
    if (needStory) {
      m.step = "story";
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      const pages = await generateStoryTextPages({
        childName: m.child?.name,
        childAge: m.child?.age,
        childGender: m.child?.gender,
        themeKey: m.theme,
        pagesCount: 8,
      });

      m.pages = pages;
      m.step = "story_done";
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });
      return res.json(buildProgress(m, "História criada ✅"));
    }

    // 2) COVER
    const coverFinalPath = path.join(bookDir, "cover_final.png");
    const needCover = !(m.cover?.ok && existsSyncSafe(coverFinalPath) && m.cover?.storageKey && m.cover?.url);
    if (needCover) {
      m.step = "cover";
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      const coverPrompt = buildCoverPrompt({ themeKey: m.theme, childName: m.child?.name, styleKey: m.style });
      const coverBuf = await openaiImageEditFromReference({ imagePngPath, maskPngPath, prompt: coverPrompt, size: "1024x1024" });

      const coverBase = path.join(bookDir, "cover.png");
      await fsp.writeFile(coverBase, coverBuf);

      await stampCoverTextOnImage({
        inputPath: coverBase,
        outputPath: coverFinalPath,
        title: "Meu Livro Mágico",
        subtitle: `A aventura de ${m.child?.name || "Criança"} • ${themeLabel(m.theme)}`,
      });

      // ✅ upload cover_final.png
      const up = await uploadLocalFileToStorage({
        userId,
        bookId: id,
        localPath: coverFinalPath,
        filename: "cover_final.png",
        contentType: "image/png",
      });

      m.cover = { ok: true, file: "cover_final.png", storageKey: up.key, url: up.url };
      m.step = "cover_done";
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      return res.json(buildProgress(m, "Capa pronta ✅"));
    }

    // 3) NEXT PAGE (1 por request)
    const imagesArr = Array.isArray(m.images) ? m.images.slice() : [];
    const hasPage = (n) => imagesArr.some((it) => Number(it?.page || 0) === n && it.url && it.storageKey);

    let nextPage = 0;
    for (let p = 1; p <= 8; p++) {
      if (!hasPage(p)) { nextPage = p; break; }
    }

    if (nextPage) {
      m.step = `page_${nextPage}`;
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      const pageObj = (m.pages || []).find((x) => Number(x?.page || 0) === nextPage) || {};
      const title = String(pageObj.title || `Página ${nextPage}`).trim();
      const text = String(pageObj.text || "").trim();

      const prompt = buildScenePromptFromParagraph({
        paragraphText: text,
        themeKey: m.theme,
        childName: m.child?.name,
        styleKey: m.style,
      });

      const imgBuf = await openaiImageEditFromReference({ imagePngPath, maskPngPath, prompt, size: "1024x1024" });

      const pageKey = String(nextPage).padStart(2, "0");
      const baseName = `page_${pageKey}.png`;
      const finalName = `page_${pageKey}_final.png`;

      const basePath = path.join(bookDir, baseName);
      await fsp.writeFile(basePath, imgBuf);

      const finalPath = path.join(bookDir, finalName);
      await stampStoryTextOnImage({ inputPath: basePath, outputPath: finalPath, title, text });

      // ✅ upload final PNG
      const up = await uploadLocalFileToStorage({
        userId,
        bookId: id,
        localPath: finalPath,
        filename: finalName,
        contentType: "image/png",
      });

      const idx = imagesArr.findIndex((it) => Number(it?.page || 0) === nextPage);
      const entry = { page: nextPage, path: finalPath, prompt, file: finalName, storageKey: up.key, url: up.url };
      if (idx >= 0) imagesArr[idx] = { ...imagesArr[idx], ...entry };
      else imagesArr.push(entry);

      imagesArr.sort((a, b) => Number(a.page || 0) - Number(b.page || 0));
      m.images = imagesArr;
      m.step = `page_${nextPage}_done`;
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      return res.json(buildProgress(m, `Página ${nextPage}/8 pronta ✅`));
    }

    // 4) PDF
    const haveAllPages = (m.images || []).filter((it) => it && it.url && it.storageKey).length >= 8;
    if (haveAllPages) {
      m.step = "pdf";
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      // garante cover local (se sumiu)
      const coverLocal = path.join(bookDir, "cover_final.png");
      if (!existsSyncSafe(coverLocal) && m.cover?.storageKey) {
        await ensureLocalFromStorage(coverLocal, m.cover.storageKey);
      }

      // garante páginas locais (se sumiram)
      const pageImagePaths = (m.images || [])
        .slice()
        .sort((a, b) => Number(a.page || 0) - Number(b.page || 0))
        .map((it) => {
          const pLocal = path.join(bookDir, String(it.file || ""));
          return { local: pLocal, key: it.storageKey, file: it.file };
        });

      for (const it of pageImagePaths) {
        if (!existsSyncSafe(it.local) && it.key) await ensureLocalFromStorage(it.local, it.key);
      }

      const pathsOnly = pageImagePaths.map((x) => x.local).filter((p) => p && existsSyncSafe(p));

      const pdfPath = await makePdfImagesOnly({
        bookId: id,
        coverPath: existsSyncSafe(coverLocal) ? coverLocal : "",
        pageImagePaths: pathsOnly,
        outputDir: bookDir,
      });

      // ✅ upload pdf
      const pdfName = `book-${id}.pdf`;
      const upPdf = await uploadLocalFileToStorage({
        userId,
        bookId: id,
        localPath: pdfPath,
        filename: pdfName,
        contentType: "application/pdf",
      });

      m.status = "done";
      m.step = "done";
      m.pdf_storageKey = upPdf.key;
      m.pdf = upPdf.url; // ✅ link direto persistente
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      return res.json(buildProgress(m, "PDF pronto 🎉"));
    }

    m.step = "waiting";
    m.updatedAt = nowISO();
    await saveManifestAll(userId, id, m, { sbUser: req.sb });
    return res.json(buildProgress(m, "Aguardando…"));
  } catch (e) {
    try {
      const m2 = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
      if (m2) {
        m2.status = "failed";
        m2.step = "failed";
        m2.error = String(e?.message || e || "Erro");
        m2.updatedAt = nowISO();
        await saveManifestAll(userId, id, m2, { sbUser: req.sb });
      }
    } catch {}
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  } finally {
    jobs.set(jobKey, { running: false });
  }
});

// ------------------------------
// /api/image/:id/:file
// ✅ serve do disco; se não tiver, baixa do Storage e serve
// ------------------------------
app.get("/api/image/:id/:file", requireAuth, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).send("not_logged_in");

    const id = String(req.params?.id || "").trim();
    const file = String(req.params?.file || "").trim();
    if (!id || !file) return res.status(400).send("bad request");

    if (id.includes("..") || id.includes("/") || id.includes("\\") || file.includes("..") || file.includes("/") || file.includes("\\")) {
      return res.status(400).send("bad request");
    }

    const m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) return res.status(404).send("not found");
    if (!canAccessBook(userId, m, req.user)) return res.status(403).send("forbidden");

    const fp = path.join(bookDirOf(userId, id), file);

    // se não existe local, tenta baixar do Storage
    if (!existsSyncSafe(fp)) {
      const key = storageKeyFor(userId, id, file);
      await sbDownloadToLocal({ pathKey: key, localPath: fp });
    }

    if (!existsSyncSafe(fp)) return res.status(404).send("not found");

    res.setHeader("Cache-Control", "no-store");
    res.type("png").send(fs.readFileSync(fp));
  } catch (e) {
    res.status(500).send(String(e?.message || e || "Erro"));
  }
});

// ------------------------------
// Download PDF
// ✅ agora redireciona para URL do Storage (persistente)
// ------------------------------
app.get("/download/:id", requireAuth, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).send("not_logged_in");

    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).send("id ausente");

    const m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) return res.status(404).send("book não existe");
    if (!canAccessBook(userId, m, req.user)) return res.status(403).send("forbidden");
    if (m.status !== "done") return res.status(409).send("PDF ainda não está pronto");

    // ✅ se m.pdf já é URL público, redireciona
    const pdfUrl = String(m.pdf || "").trim();
    if (pdfUrl.startsWith("http://") || pdfUrl.startsWith("https://")) {
      return res.redirect(pdfUrl);
    }

    // fallback: tenta local + storageKey
    const pdfName = `book-${id}.pdf`;
    const localPdf = path.join(bookDirOf(userId, id), pdfName);
    if (!existsSyncSafe(localPdf) && m.pdf_storageKey) {
      await sbDownloadToLocal({ pathKey: m.pdf_storageKey, localPath: localPdf });
    }
    if (!existsSyncSafe(localPdf)) return res.status(404).send("pdf não encontrado");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="livro-${id}.pdf"`);
    fs.createReadStream(localPdf).pipe(res);
  } catch (e) {
    res.status(500).send(String(e?.message || e || "Erro"));
  }
});

// ------------------------------
// Start (local) + export (Vercel)
// ------------------------------
(async () => {
  await ensureDir(OUT_DIR);
  await ensureDir(BOOKS_DIR);

  if (process.env.VERCEL) {
    console.log("✅ Rodando na Vercel (serverless)");
    return;
  }

  app.listen(PORT, () => {
    console.log("===============================================");
    console.log(`📚 Meu Livro Mágico — Vercel-safe + Supabase Auth/RLS`);
    console.log(`✅ http://localhost:${PORT}`);
    console.log(`🛒 /sales | ✨ /create | ⏳ /generate`);
    console.log(`Bucket Storage: ${STORAGE_BUCKET}`);
    console.log(`Service role: ${supabaseAdmin ? "OK" : "AUSENTE (necessário p/ upload no Storage)"}`);
    console.log("===============================================");
  });
})();

// ✅ necessário para Vercel (@vercel/node)
module.exports = app;