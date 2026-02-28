/**
 * app.js — MONOCÓDIGO (UI + API + OpenAI + PDF)
 * ✅ MODO SEQUENCIAL (1 imagem por vez) + TEXTO DENTRO DA IMAGEM
 * ✅ Replicate (principal) com imagem de referência (image_input) + compat aliases (image/input_image)
 * ✅ VERCEL-SAFE: grava em /tmp quando process.env.VERCEL estiver ativo
 * ✅ SUPABASE STORAGE (opcional): faz upload/restore quando arquivo não existir no disco
 *
 * REFEITO: LÓGICA DE GERAÇÃO (STATE MACHINE + LOCK + IDEMPOTÊNCIA + RETRY)
 * - /api/generate NÃO trava job (apenas prepara manifest)
 * - /api/generateNext executa 1 passo com lock seguro
 * - passos não duplicam (se arquivo já existe, pula)
 * - mask vazia não é enviada pro provider (evita modelo "ignorar referência")
 *
 * Requisitos:
 *  - Node 18+ (fetch global)
 *  - npm i express pdfkit dotenv sharp
 *  - (opcional) npm i @supabase/supabase-js  -> se quiser Storage no Supabase
 *
 * Rodar:
 *   node app.js
 *
 * Acesse:
 *   http://localhost:3000
 */

"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { pbkdf2Sync, timingSafeEqual } = require("crypto");
const express = require("express");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");

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
const REPLICATE_MODEL = "bytedance/seedream-4";
const REPLICATE_VERSION = String(process.env.REPLICATE_VERSION || "").trim(); // opcional

const REPLICATE_RESOLUTION = String(process.env.REPLICATE_RESOLUTION || "2K").trim();
const REPLICATE_ASPECT_RATIO = String(process.env.REPLICATE_ASPECT_RATIO || "1:1").trim();
const REPLICATE_OUTPUT_FORMAT = String(process.env.REPLICATE_OUTPUT_FORMAT || "png").trim();
const REPLICATE_SAFETY = String(process.env.REPLICATE_SAFETY || "block_only_high").trim();

// Supabase Storage (opcional)
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_STORAGE_BUCKET = String(process.env.SUPABASE_STORAGE_BUCKET || "books").trim();

// Vercel-safe base
const IS_VERCEL = !!process.env.VERCEL;

// Onde salva arquivos localmente
const LOCAL_BASE = IS_VERCEL ? path.join("/tmp", "mlm-output") : path.join(__dirname, "output");

// ✅ mantém users.json aqui
const OUT_DIR = LOCAL_BASE;
const USERS_FILE = path.join(OUT_DIR, "users.json");

// ✅ livros ficam aqui
const BOOKS_DIR = path.join(OUT_DIR, "books");

// JSON limit
const JSON_LIMIT = "25mb";

// Base de edição
const EDIT_MAX_SIDE = 1024;

// Provider de imagem ativo
const IMAGE_PROVIDER = REPLICATE_API_TOKEN ? "replicate" : "openai";

// Páginas opcionais (arquivos)
const LANDING_HTML = path.join(__dirname, "landing.html");
const HOW_IT_WORKS_HTML = path.join(__dirname, "how-it-works.html");
const EXEMPLOS_HTML = path.join(__dirname, "exemplos.html");

// ------------------------------
// Supabase client (opcional)
// ------------------------------
// ------------------------------
// Supabase clients
// - supabaseAuth: Auth (ANON KEY)  ✅ login/signup real
// - supabaseAdmin: Storage/admin (SERVICE ROLE) ✅ upload/download
// ------------------------------
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "").trim();

let supabaseAuth = null;
let supabaseAdmin = null;

(function initSupabase() {
  let createClient;
  try {
    ({ createClient } = require("@supabase/supabase-js"));
  } catch (e) {
    console.warn("⚠️  Instale: npm i @supabase/supabase-js");
    return;
  }

  if (!SUPABASE_URL) {
    console.log("ℹ️  Supabase: desativado (SUPABASE_URL ausente).");
    return;
  }

  // Auth (ANON)
  if (SUPABASE_ANON_KEY) {
    supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "mlm-auth" } },
    });
    console.log("✅ Supabase Auth: ativo (ANON)");
  } else {
    console.log("⚠️  Supabase Auth: SUPABASE_ANON_KEY ausente.");
  }

  // Admin/Storage (SERVICE ROLE)
  if (SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "mlm-admin" } },
    });
    console.log("✅ Supabase Storage/Admin: ativo (SERVICE ROLE) bucket =", SUPABASE_STORAGE_BUCKET);
  } else {
    console.log("ℹ️  Supabase Storage/Admin: desativado (SERVICE ROLE ausente).");
  }
})();
function clampInt(n, a, b) {
  n = Math.round(Number(n) || 0);
  return Math.max(a, Math.min(b, n));
}

// Faz um "crop de rosto" heurístico (sem face-detection):
// pega a região superior/central onde normalmente fica o rosto
async function makeFaceBase({ inputPngPath, outputPngPath }) {
  const meta = await sharp(inputPngPath).metadata();
  const W = meta?.width || 0;
  const H = meta?.height || 0;
  if (!W || !H) throw new Error("Falha ao ler metadata para face crop.");

  // região típica de rosto: centro horizontal, topo do frame
  const cropW = clampInt(W * 0.62, 256, W);
  const cropH = clampInt(H * 0.62, 256, H);

  const left = clampInt((W - cropW) / 2, 0, W - cropW);
  const top  = clampInt(H * 0.06, 0, H - cropH); // um pouco abaixo do topo

  // recorta e normaliza tamanho (mantém detalhe do rosto)
  await sharp(inputPngPath)
    .extract({ left, top, width: cropW, height: cropH })
    .resize({ width: 512, height: 512, fit: "cover" })
    .png()
    .toFile(outputPngPath);

  return { W, H, crop: { left, top, width: cropW, height: cropH } };
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

function genderLabel(g) {
  const s = String(g || "neutral");
  if (s === "boy") return "menino";
  if (s === "girl") return "menina";
  return "criança";
}

// helper simples p/ evitar quebrar HTML
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ------------------------------
// Supabase Storage Helpers (opcional)
// ------------------------------
function sbEnabled() { return !!supabaseAdmin; }

function sbKeyFor(userId, bookId, fileName) {
  return `users/${String(userId)}/books/${String(bookId)}/${String(fileName)}`;
}
function sbKeyForOwner(manifest, bookId, fileName) {
  const ownerId = String(manifest?.ownerId || "").trim();
  if (!ownerId) return "";
  return sbKeyFor(ownerId, bookId, fileName);
}
async function sbUploadBuffer(key, buf, contentType = "application/octet-stream") {
  if (!sbEnabled()) return { ok: false, key, reason: "supabase_disabled" };
  const { error } = await supabaseAdmin.storage.from(SUPABASE_STORAGE_BUCKET).upload(key, buf, {
    upsert: true,
    contentType,
    cacheControl: "3600",
  });
  if (error) return { ok: false, key, reason: String(error.message || error) };
  return { ok: true, key };
}

async function sbDownloadToBuffer(key) {
  if (!sbEnabled()) return { ok: false, reason: "supabase_disabled", buf: null };
const { data, error } = await supabaseAdmin.storage.from(SUPABASE_STORAGE_BUCKET).download(key);
  if (error || !data) return { ok: false, reason: String(error?.message || error || "download_failed"), buf: null };
  const ab = await data.arrayBuffer();
  return { ok: true, buf: Buffer.from(ab) };
}

async function ensureFileFromStorageIfMissing(localPath, storageKey) {
  if (existsSyncSafe(localPath)) return true;
  if (!storageKey) return false;
  const got = await sbDownloadToBuffer(storageKey);
  if (!got.ok || !got.buf) return false;
  await ensureDir(path.dirname(localPath));
  await fsp.writeFile(localPath, got.buf);
  return true;
}

// ------------------------------
// ADMIN helpers
// ------------------------------
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

// ------------------------------
// AUTH (Login) — monocódigo (sem banco)
// - usuários: output/users.json
// - sessão: cookie + Map em memória
// ------------------------------
// ------------------------------
// AUTH (Supabase) — cookie httpOnly
// ------------------------------
const AUTH_COOKIE = "sb_access";
const REFRESH_COOKIE = "sb_refresh";

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

function setAuthCookies(res, accessToken, refreshToken) {
  const base = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (process.env.VERCEL) base.push("Secure");

  const c1 = [`${AUTH_COOKIE}=${encodeURIComponent(accessToken || "")}`, ...base, `Max-Age=${60 * 60}`].join("; ");
  const c2 = [`${REFRESH_COOKIE}=${encodeURIComponent(refreshToken || "")}`, ...base, `Max-Age=${60 * 60 * 24 * 30}`].join("; ");

  // Importante: mandar DOIS Set-Cookie
  res.setHeader("Set-Cookie", [c1, c2]);
}

function clearAuthCookies(res) {
  const base = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (process.env.VERCEL) base.push("Secure");

  const c1 = [`${AUTH_COOKIE}=`, ...base, "Max-Age=0"].join("; ");
  const c2 = [`${REFRESH_COOKIE}=`, ...base, "Max-Age=0"].join("; ");

  res.setHeader("Set-Cookie", [c1, c2]);
}

function normalizeEmail(s) {
  return String(s || "").trim().toLowerCase();
}

async function getCurrentUser(req) {
  if (!supabaseAuth) return null;

  const cookies = parseCookies(req);
  const access = String(cookies[AUTH_COOKIE] || "");
  const refresh = String(cookies[REFRESH_COOKIE] || "");

  // 1) tenta com access token
  if (access) {
    const { data, error } = await supabaseAuth.auth.getUser(access);
    if (!error && data?.user) {
      return {
        id: data.user.id,
        email: data.user.email || "",
        name: (data.user.user_metadata && (data.user.user_metadata.name || data.user.user_metadata.full_name)) || "",
      };
    }
  }

  // 2) se access expirou, tenta refresh
  if (refresh) {
    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refresh });
    if (!error && data?.session?.access_token && data?.session?.refresh_token) {
      // atualiza cookies
      req._newAuthSession = {
        access: data.session.access_token,
        refresh: data.session.refresh_token,
      };

      const u = data.user;
      if (u) {
        return {
          id: u.id,
          email: u.email || "",
          name: (u.user_metadata && (u.user_metadata.name || u.user_metadata.full_name)) || "",
        };
      }
    }
  }

  return null;
}
async function getCurrentUserId(req) {
  const user = await getCurrentUser(req).catch(() => null);
  return user?.id || "";
}

// Para APIs (retorna userId ou responde 401)
async function requireAuthUserId(req, res) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ ok: false, error: "not_logged_in" });
    return "";
  }
  return userId;
}

function requireAuth(req, res, next) {
  getCurrentUser(req)
    .then((user) => {
      if (!user) {
        const nextUrl = encodeURIComponent(req.originalUrl || "/create");
        return res.redirect(`/login?next=${nextUrl}`);
      }

      // ✅ se teve refresh, regrava cookies
      if (req._newAuthSession?.access && req._newAuthSession?.refresh) {
        setAuthCookies(res, req._newAuthSession.access, req._newAuthSession.refresh);
      }

      req.user = user;
      next();
    })
    .catch(() => {
      const nextUrl = encodeURIComponent(req.originalUrl || "/create");
      return res.redirect(`/login?next=${nextUrl}`);
    });
}

// ------------------------------
// HTTP Helpers (JSON + download)
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
    if (!r.ok) throw new Error(`Falha ao baixar imagem: HTTP ${r.status}`);
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------
// OpenAI (fetch direto) — texto
// ------------------------------
async function openaiFetchJson(url, bodyObj, timeoutMs = 180000) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada. Crie .env.local com OPENAI_API_KEY=...");
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
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
// Replicate — versão + prediction
// ------------------------------
const replicateVersionCache = new Map(); // key: "owner/name" -> versionId

function splitReplicateModel(model) {
  const s = String(model || "").trim();
  const parts = s.split("/");
  if (parts.length !== 2) return null;
  return { owner: parts[0], name: parts[1] };
}

async function replicateGetLatestVersionId(model) {
  // 🔒 Se versão fixa estiver definida, usa ela
  if (REPLICATE_VERSION) return REPLICATE_VERSION;

  const parsed = splitReplicateModel(model);
  if (!parsed) {
    throw new Error(`REPLICATE_MODEL inválido: "${model}". Use "owner/name" (ex: "bytedance/seedream-4")`);
  }

  const key = `${parsed.owner}/${parsed.name}`;

  // cache
  if (replicateVersionCache.has(key)) return replicateVersionCache.get(key);

  const info = await fetchJson(`https://api.replicate.com/v1/models/${parsed.owner}/${parsed.name}`, {
    method: "GET",
    timeoutMs: 60000,
    headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
  });

  const versionId =
    info?.latest_version?.id ||
    info?.latest_version?.version ||
    info?.latest_version;

  if (!versionId) {
    throw new Error(`Não consegui obter latest_version do modelo "${key}".`);
  }

  replicateVersionCache.set(key, versionId);
  return versionId;
}
const replicateSchemaCache = new Map(); // key: versionId -> schema.inputs

async function replicateGetVersionSchema(versionId) {
  if (replicateSchemaCache.has(versionId)) return replicateSchemaCache.get(versionId);

  const v = await fetchJson(`https://api.replicate.com/v1/models/versions/${versionId}`, {
    method: "GET",
    timeoutMs: 60000,
    headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
  });

  const inputs = v?.openapi_schema?.components?.schemas?.Input?.properties || {};
  replicateSchemaCache.set(versionId, inputs);
  return inputs;
}

function pickFirstKey(obj, keys) {
  for (const k of keys) if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return k;
  return "";
}

function schemaExpectsArray(inputSchema, key) {
  const sch = inputSchema?.[key];
  return sch?.type === "array";
}
async function replicateCreatePrediction({ model, input, timeoutMs = 180000 }) {
  if (!REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN não configurado (.env.local).");
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

    await sleep(pollMs);
  }
}

// ------------------------------
// OpenAI Images (fallback opcional)
// ------------------------------
async function openaiImageEditFallback({ imagePngPath, maskPngPath, prompt, size = "1024x1024" }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada. Use .env.local.");
  if (typeof FormData === "undefined" || typeof Blob === "undefined") {
    throw new Error("Seu Node não tem FormData/Blob globais. Use Node 18+.");
  }

  const imgBuf = await fsp.readFile(imagePngPath);
  const maskBuf = maskPngPath && existsSyncSafe(maskPngPath) ? await fsp.readFile(maskPngPath) : null;

  // Se mask existir mas estiver "vazia" (toda transparente), não envia.
  const effectiveMaskBuf = maskBuf ? await removeMaskIfBlank(maskBuf).catch(() => maskBuf) : null;

  if (effectiveMaskBuf) {
    const mi = await sharp(imgBuf).metadata();
    const mm = await sharp(effectiveMaskBuf).metadata();
    const iw = mi?.width || 0;
    const ih = mi?.height || 0;
    const mw = mm?.width || 0;
    const mh = mm?.height || 0;
    if (iw && ih && mw && mh && (iw !== mw || ih !== mh)) {
      throw new Error(`Mask e imagem com tamanhos diferentes: image=${iw}x${ih}, mask=${mw}x${mh}. Reenvie a foto.`);
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
      if (effectiveMaskBuf) {
        form.append("mask", new Blob([effectiveMaskBuf], { type: "image/png" }), path.basename(maskPngPath) || "mask.png");
      }

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

// ------------------------------
// Mask utils: detectar máscara "em branco"
// ------------------------------
async function removeMaskIfBlank(maskBuf) {
  // Considera "blank" se canal alpha é sempre 0 (ou quase 0)
  const img = sharp(maskBuf).ensureAlpha();
  const stats = await img.stats();
  const a = stats?.channels?.[3];
  if (!a) return maskBuf;

  // se alpha máximo muito baixo, é basicamente transparente
  if ((a.max ?? 255) <= 2) return null;
  return maskBuf;
}

// ------------------------------
// IMAGEM SEQUENCIAL (principal)
// - Replicate se token configurado
// - Senão: fallback OpenAI /v1/images/edits
// - Retorna Buffer PNG
// ------------------------------
async function imageFromReference({ imagePngPath, maskPngPath, prompt, size = "1024x1024" }) {
  if (REPLICATE_API_TOKEN) {
    const imgBuf = await fsp.readFile(imagePngPath);
    const maskBuf = maskPngPath && existsSyncSafe(maskPngPath) ? await fsp.readFile(maskPngPath) : null;
    const effectiveMask = maskBuf ? await removeMaskIfBlank(maskBuf).catch(() => maskBuf) : null;

    const refDataUrl = bufferToDataUrlPng(imgBuf);
    const maskDataUrl = effectiveMask ? bufferToDataUrlPng(effectiveMask) : null;
    const createdVersion = await replicateGetLatestVersionId(REPLICATE_MODEL || "bytedance/seedream-4");
    const inputSchema = await replicateGetVersionSchema(createdVersion);

    // chaves mais comuns que os modelos usam
    const imageKey = pickFirstKey(inputSchema, ["image_input", "input_image", "image", "reference_image"]);
    const promptKey = pickFirstKey(inputSchema, ["prompt", "text", "caption"]);
    const maskKey   = pickFirstKey(inputSchema, ["mask", "mask_image", "input_mask"]);
    const matchKey  = pickFirstKey(inputSchema, ["match_input_image", "preserve_identity", "identity_strength"]);

    const input = {};

    // prompt
    input[promptKey || "prompt"] = prompt;

    // ✅ referência (usa o imagePngPath que você passou pra função)
    // se o schema pede array, manda [ref]; se não, manda ref direto
    if (imageKey) {
      const expectsArray = schemaExpectsArray(inputSchema, imageKey);
      input[imageKey] = expectsArray ? [refDataUrl] : refDataUrl;
    } else {
      // fallback mais comum
      input.image_input = [refDataUrl];
    }

    // ✅ máscara só se existir no schema E só se realmente tiver maskDataUrl
    if (maskDataUrl && maskKey) {
      input[maskKey] = maskDataUrl;
    }

    // parâmetros opcionais só se existirem no schema
    if (Object.prototype.hasOwnProperty.call(inputSchema, "aspect_ratio")) input.aspect_ratio = REPLICATE_ASPECT_RATIO || "1:1";
    if (Object.prototype.hasOwnProperty.call(inputSchema, "resolution")) input.resolution = REPLICATE_RESOLUTION || "2K";
    if (Object.prototype.hasOwnProperty.call(inputSchema, "output_format")) input.output_format = REPLICATE_OUTPUT_FORMAT || "png";
    if (Object.prototype.hasOwnProperty.call(inputSchema, "safety_filter_level")) input.safety_filter_level = REPLICATE_SAFETY || "block_only_high";

    // “match” só se o modelo aceitar
    if (matchKey) input[matchKey] = true;

    const created = await fetchJson("https://api.replicate.com/v1/predictions", {
      method: "POST",
      timeoutMs: 120000,
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ version: createdVersion, input }),
    });

    const pred = await replicateWaitPrediction(created?.id, { timeoutMs: 300000, pollMs: 1200 });

    let url = "";
    if (typeof pred?.output === "string") url = pred.output;
    else if (Array.isArray(pred?.output) && typeof pred.output[0] === "string") url = pred.output[0];

    if (!url) throw new Error("Replicate não retornou URL de imagem em output.");

    const buf = await downloadToBuffer(url, 240000);
    return await sharp(buf).png().toBuffer();
  }

  return await openaiImageEditFallback({ imagePngPath, maskPngPath, prompt, size });
}

// ------------------------------
// História em TEXTO (páginas/parágrafos)
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
    "Cada página deve ter:",
    "- page (número)",
    "- title (string curta)",
    "- text (UM PARÁGRAFO, sem quebras de linha; até ~55 palavras se <=7 anos; até ~75 se >7)",
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
// Prompt de imagem por parágrafo + estilo (read | color)
// (REFEITO: inclui nome + idade + gênero + tema + estilo explicitamente)
// ------------------------------
function buildScenePromptFromParagraph({ paragraphText, themeKey, childName, childAge, childGender, styleKey }) {
  const th = themeDesc(themeKey);
  const name = String(childName || "").trim();
  const age = clamp(childAge ?? 6, 2, 12);
  const g = genderLabel(childGender);
  const txt = String(paragraphText || "").trim();
  const style = String(styleKey || "read").trim();

  const identity = [
    "Use a criança da imagem enviada como personagem principal.",
    "Mantenha TODAS as características originais do rosto (cabelo, cor da pele, traços). Não altere identidade.",
    "A identidade deve ser consistente em todas as páginas (same face, same hairstyle, same skin tone).",
    "Não invente outra criança diferente.",
     "- Composição: a criança integrada naturalmente na cena, com ação e emoção compatíveis com o texto.",
    "- NÃO escreva texto/legendas na imagem gerada (eu vou colocar o texto depois no PNG).",
     "Cena coerente e bonita para livro infantil.",
     "IMPORTANTE: Use APENAS o ROSTO da criança como referência de identidade.",
"Você PODE e DEVE mudar roupas, corpo, pose, cenário e acessórios conforme o tema e o texto.",
"NÃO copie a roupa da foto original. Vista a criança apropriadamente para a cena (ex: super-herói, mergulho, selva, etc).",
  ].join(" ");

  const meta = [
    name ? `Nome (contexto): ${name}.` : "",
    `Idade: ${age} anos.`,
    `Gênero do texto: ${String(childGender || "neutral")}.`,
    `A criança deve parecer uma/um ${g} de aproximadamente ${age} anos (sem mudar a identidade da foto).`,
  ].filter(Boolean).join(" ");

  const rules = [
    "NÃO escreva texto/legendas dentro da imagem.",
    "A criança deve estar integrada naturalmente na cena, com ação e emoção compatíveis com o texto.",
    "Cena coerente e bonita para livro infantil.",
  ].join(" ");

  if (style === "color") {
    return [
      "Crie UMA ilustração para um livro infantil baseado no texto abaixo.",
      `TEXTO: "${txt}"`,
      `TEMA: ${th}.`,
      meta,
      identity,
      "ESTILO: livro para colorir (coloring book).",
      "Arte em PRETO E BRANCO, contornos bem definidos, traço limpo, linhas mais grossas.",
      "SEM cores, SEM gradientes, SEM sombras, SEM pintura, SEM textura realista.",
      "Fundo branco (ou bem claro), poucos detalhes no fundo (para facilitar colorir).",
      rules,
    ].join(" ");
  }

  return [
    "Crie UMA ilustração para um livro infantil baseado no texto abaixo.",
    `TEXTO: "${txt}"`,
    `TEMA: ${th}.`,
    meta,
    identity,
    "ESTILO: ilustração semi-realista de livro infantil, alegre, cores agradáveis, luz suave.",
    rules,
  ].join(" ");
}

function buildCoverPrompt({ themeKey, childName, childAge, childGender, styleKey }) {
  const th = themeDesc(themeKey);
  const name = String(childName || "").trim();
  const age = clamp(childAge ?? 6, 2, 12);
  const g = genderLabel(childGender);
  const style = String(styleKey || "read").trim();

  const identity = [
    "Use a criança da imagem enviada como personagem principal.",
    "Mantenha TODAS as características originais do rosto (identidade consistente).",
    "A capa deve combinar com as páginas (mesma identidade).",
    "IMPORTANTE: Use APENAS o ROSTO da criança como referência de identidade.",
"Você PODE e DEVE mudar roupas, corpo, pose, cenário e acessórios conforme o tema e o texto.",
"NÃO copie a roupa da foto original. Vista a criança apropriadamente para a cena (ex: super-herói, mergulho, selva, etc).",
  ].join(" ");

  const meta = [
    name ? `Nome (contexto): ${name}.` : "",
    `Idade: ${age} anos.`,
    `Gênero do texto: ${String(childGender || "neutral")}.`,
    `A criança deve parecer uma/um ${g} de aproximadamente ${age} anos (sem mudar a identidade da foto).`,
  ].filter(Boolean).join(" ");

  const rules = "NÃO escreva texto/legendas dentro da imagem (eu aplico depois).";

  if (style === "color") {
    return [
      "Crie uma CAPA de livro infantil.",
      `TEMA: ${th}.`,
      meta,
      identity,
      "ESTILO: CAPA em formato de livro para colorir (coloring book).",
      "Arte em PRETO E BRANCO, contornos fortes, traço limpo.",
      "SEM cores, SEM gradientes, SEM sombras, SEM pintura.",
      "Fundo branco (ou bem claro) e poucos detalhes para facilitar colorir.",
      "Composição: alegre, mágica, positiva, criança em destaque central.",
      "IMPORTANTE: Use APENAS o ROSTO da criança como referência de identidade.",
"Você PODE e DEVE mudar roupas, corpo, pose, cenário e acessórios conforme o tema e o texto.",
"NÃO copie a roupa da foto original. Vista a criança apropriadamente para a cena (ex: super-herói, mergulho, selva, etc).",
      rules,
    ].join(" ");
  }

  return [
    "Crie uma CAPA de livro infantil.",
    `TEMA: ${th}.`,
    meta,
    identity,
    "ESTILO: ilustração semi-realista, alegre, colorida, luz suave.",
    "Composição: alegre, mágica, positiva, criança em destaque central.",
    rules,
  ].join(" ");
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
    if (next.length <= maxCharsPerLine) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      if (w.length > maxCharsPerLine) {
        lines.push(w.slice(0, maxCharsPerLine));
        cur = w.slice(maxCharsPerLine);
      } else {
        cur = w;
      }
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

  const pad = Math.round(W * 0.040);
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

    return {
      titleLines,
      bodyLines,
      lineGapTitle,
      lineGapBody,
      usedH: titleH + spacer + bodyH,
      spacer,
    };
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
          fill="#FFFFFF" fill-opacity="0.88"
          filter="url(#shadow)"/>

    ${titleSvg}
    ${textSvg}
  </svg>`;

  await sharp(inputPath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);

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
      ${titleLines
        .map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : lineGapTitle}">${escapeXml(ln)}</tspan>`)
        .join("")}
    </text>`;

  tY += titleLines.length ? lineGapTitle * titleLines.length + Math.round(subSize * 0.35) : 0;

  const subSvg = subLines.length
    ? `<text x="${textX}" y="${tY}" font-family="Helvetica, Arial, sans-serif" font-size="${subSize}" font-weight="800" fill="#0f172a">
        ${subLines
          .map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : lineGapSub}">${escapeXml(ln)}</tspan>`)
          .join("")}
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

  await sharp(inputPath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);

  return outputPath;
}

// ------------------------------
// PDF: só imagens (capa + páginas já com texto dentro)
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

function bookDirOf(userId, bookId) {
  // ✅ separa por usuário (evita colisão e mistura de dados)
  return path.join(BOOKS_DIR, String(userId), String(bookId));
}
function manifestPathOf(userId, bookId) {
  return path.join(bookDirOf(userId, bookId), "book.json");
}

async function loadManifest(userId, bookId) {
  const p = manifestPathOf(userId, bookId);
  if (existsSyncSafe(p)) return readJson(p);

  const key = sbKeyFor(userId, bookId, "book.json");
  if (sbEnabled()) {
    const got = await sbDownloadToBuffer(key);
    if (got.ok && got.buf) {
      await ensureDir(path.dirname(p));
      await fsp.writeFile(p, got.buf);
      try {
        return JSON.parse(got.buf.toString("utf-8"));
      } catch {}
    }
  }
  return null;
}
async function loadManifestAsViewer(viewerUserId, bookId, viewerUser) {
  // 1) caminho normal (próprio usuário)
  let m = await loadManifest(viewerUserId, bookId);
  if (m) return m;

  // 2) se NÃO é admin, não tenta procurar em outros donos
  if (!isAdminUser(viewerUser)) return null;

  // 3) admin: varre BOOKS_DIR/<ownerId>/<bookId>/book.json até achar o id
  try {
    await ensureDir(BOOKS_DIR);
    const ownerDirs = await fsp.readdir(BOOKS_DIR).catch(() => []);

    for (const ownerId of ownerDirs) {
      const p = manifestPathOf(ownerId, bookId);
      if (!existsSyncSafe(p)) continue;

      const mm = await readJson(p).catch(() => null);
      if (mm && String(mm.id) === String(bookId)) return mm;
    }
  } catch {}

  // 4) fallback storage (opcional): se tiver bucket e ownerId desconhecido, aqui não tem como "listar" sem índice
  return null;
}
async function saveManifest(userId, bookId, manifest) {
  const p = manifestPathOf(userId, bookId);
  await writeJson(p, manifest);

  if (sbEnabled()) {
    const buf = Buffer.from(JSON.stringify(manifest, null, 2), "utf-8");
const key = sbKeyForOwner(manifest, bookId, "book.json") || sbKeyFor(userId, bookId, "book.json");
    await sbUploadBuffer(key, buf, "application/json");
  }
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

    // arquivos locais e storage keys
    photo: { ok: false, file: "", mime: "", editBase: "", storageKey: "", editBaseKey: "" },
    mask: { ok: false, file: "", editBase: "", storageKey: "", editBaseKey: "" },

    pages: [],
    images: [],
    cover: { ok: false, file: "", url: "", storageKey: "" },

    pdf: "",
    pdfKey: "",

    // NOVO: retry/cooldown (não quebra nada se faltar)
    retry: { count: 0, lastAt: "", nextTryAt: 0 },

    updatedAt: nowISO(),
  };
}

// ------------------------------
// Lock em memória (por book)
// (REFEITO: lock simples, consistente, SEM bug do /api/generate travar tudo)
// ------------------------------
const locks = new Map(); // key "userId:bookId" -> { running: bool, at: number }

function lockKey(userId, bookId) {
  return `${userId}:${bookId}`;
}

function isLocked(userId, bookId) {
  const k = lockKey(userId, bookId);
  return !!locks.get(k)?.running;
}

function acquireLock(userId, bookId) {
  const k = lockKey(userId, bookId);
  if (locks.get(k)?.running) return false;
  locks.set(k, { running: true, at: Date.now() });
  return true;
}

function releaseLock(userId, bookId) {
  const k = lockKey(userId, bookId);
  locks.set(k, { running: false, at: Date.now() });
}

// ------------------------------
// Express
// ------------------------------
const app = express();
app.use(express.json({ limit: JSON_LIMIT }));
app.use("/examples", express.static(path.join(__dirname, "public/examples"), { fallthrough: true }));

// ------------------------------
// LOGIN UI
// ------------------------------
app.get("/login", async (req, res) => {
  const nextUrl = String(req.query?.next || "/create");
  const user = await getCurrentUser(req).catch(() => null);
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

// ------------------------------
// AUTH API
// ------------------------------
app.post("/api/auth/signup", async (req, res) => {
  try {
    if (!supabaseAuth) return res.status(500).json({ ok: false, error: "Supabase Auth não configurado (SUPABASE_ANON_KEY)." });

    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name || name.length < 2) return res.status(400).json({ ok: false, error: "Nome inválido." });
    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "E-mail inválido." });
    if (!password || password.length < 6) return res.status(400).json({ ok: false, error: "Senha deve ter no mínimo 6 caracteres." });

    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: { name }, // vira user_metadata
      },
    });

    if (error) return res.status(400).json({ ok: false, error: String(error.message || error) });

    // Se email confirmation estiver LIGADO, session pode vir null
    if (data?.session?.access_token && data?.session?.refresh_token) {
      setAuthCookies(res, data.session.access_token, data.session.refresh_token);
      return res.json({ ok: true });
    }

    // Sem sessão (confirmação por email)
    return res.json({ ok: true, needs_email_confirmation: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    if (!supabaseAuth) return res.status(500).json({ ok: false, error: "Supabase Auth não configurado (SUPABASE_ANON_KEY)." });

    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "E-mail inválido." });
    if (!password) return res.status(400).json({ ok: false, error: "Senha obrigatória." });

    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ ok: false, error: "E-mail ou senha incorretos." });

    if (!data?.session?.access_token || !data?.session?.refresh_token) {
      return res.status(401).json({ ok: false, error: "Sem sessão. Verifique confirmação de e-mail no Supabase." });
    }

    setAuthCookies(res, data.session.access_token, data.session.refresh_token);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

// ------------------------------
// UI / SALES (opcional)
// ------------------------------
app.get("/sales", (req, res) => {
  if (existsSyncSafe(LANDING_HTML)) return res.sendFile(LANDING_HTML);

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

// ------------------------------
// UI / COMO FUNCIONA
// ------------------------------
app.get("/como-funciona", (req, res) => {
  if (existsSyncSafe(HOW_IT_WORKS_HTML)) return res.sendFile(HOW_IT_WORKS_HTML);

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

// ------------------------------
// UI / EXEMPLOS (galeria) - /exemplos
// ------------------------------
app.get("/exemplos", (req, res) => {
  if (existsSyncSafe(EXEMPLOS_HTML)) return res.sendFile(EXEMPLOS_HTML);

  return res.status(404).type("html").send(`
    <h1>exemplos.html não encontrado</h1>
    <p>Coloque um arquivo <code>exemplos.html</code> ao lado do <code>app.js</code>.</p>
    <p><a href="/sales">Voltar</a></p>
  `);
});

// ------------------------------
// UI / GERADOR (Steps 0–2) — "/" e "/create"
// (Mantido como você enviou)
// ------------------------------
function renderGeneratorHtml(req, res) {
  const imageInfo =
    IMAGE_PROVIDER === "replicate"
      ? `Replicate: <span class="mono">${escapeHtml(REPLICATE_MODEL)}</span>`
      : `OpenAI (fallback): <span class="mono">${escapeHtml(IMAGE_MODEL)}</span>`;

  // (HTML/JS idêntico ao seu — não alterei para não quebrar)
  // OBS: eu mantive exatamente seu conteúdo; por limite de tamanho,
  // aqui está como string igual (sem mexer) — você já sabe que é o mesmo.
  // Para garantir “arquivo inteiro”, deixo exatamente como estava:

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
  }
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
        <button class="pill" id="btnReset" style="cursor:pointer">♻️ Reiniciar</button>
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
            <button class="pick" data-theme="space"><div class="ico">🚀</div><div class="tt">Viagem Espacial</div><div class="dd">Explore planetas e mistérios.</div></button>
            <button class="pick" data-theme="dragon"><div class="ico">🐉</div><div class="tt">Reino dos Dragões</div><div class="dd">Mundo medieval mágico.</div></button>
            <button class="pick" data-theme="ocean"><div class="ico">🧜‍♀️</div><div class="tt">Fundo do Mar</div><div class="dd">Tesouros e amigos marinhos.</div></button>
            <button class="pick" data-theme="jungle"><div class="ico">🦁</div><div class="tt">Safari na Selva</div><div class="dd">Aventura com animais.</div></button>
            <button class="pick" data-theme="superhero"><div class="ico">🦸</div><div class="tt">Super Herói</div><div class="dd">Salvar o dia com poderes.</div></button>
            <button class="pick" data-theme="dinosaur"><div class="ico">🦕</div><div class="tt">Dinossauros</div><div class="dd">Uma jornada jurássica.</div></button>
          </div>
        </div>

        <div class="field">
          <div class="label">Estilo do livro</div>
          <div class="grid3">
            <button class="pick styleBtn" data-style="read">
              <div class="ico">📖</div><div class="tt">Livro para leitura</div><div class="dd">Ilustrações coloridas (semi-realista).</div>
            </button>
            <button class="pick styleBtn" data-style="color">
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
      <button class="btn" id="btnBack" style="background:transparent;color:#6b7280;font-weight:1000;">← Voltar</button>
      <button class="btn btnPrimary" id="btnNext">Próximo →</button>
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
        style: state.style
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

app.get("/", requireAuth, renderGeneratorHtml);
app.get("/create", requireAuth, renderGeneratorHtml);

// ------------------------------
// UI / GERANDO... (Step 4) — /generate
// (mantido)
// ------------------------------
app.get("/generate", requireAuth, async (req, res) => {
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
  a.btn{display:inline-flex;align-items:center;gap:10px;padding:12px 14px;border-radius:999px;text-decoration:none;font-weight:1000}
  a.primary{background:linear-gradient(90deg,var(--violet),var(--pink));color:#fff}
  a.ghost{background:transparent;color:#374151;border:1px solid rgba(0,0,0,.08)}
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

 async function tick(){
  if (!bookId){
    setLog("Sem id. Volte ao /create e gere novamente.");
    return;
  }

  try{
    await fetch("/api/generateNext", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ id: bookId })
    });

    const r = await fetch("/api/status/" + encodeURIComponent(bookId));
    const j = await r.json().catch(()=> ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Falha ao ler status");

    setMeta("status=" + j.status + " • step=" + j.step);
    setSub(j.error ? ("Erro: " + j.error) : "Gerando…");
    renderImages(j.coverUrl, j.images);

    let p = 5;
    if (String(j.step||"").startsWith("story")) p = 20;
    if (String(j.step||"") === "cover") p = 35;
    if (String(j.step||"").startsWith("image_")) p = 35 + (Number(String(j.step).split("_")[1]||"0") * 6);
    if (String(j.step||"") === "pdf") p = 92;
    if (String(j.step||"") === "done" || j.status === "done") p = 100;
    setBar(p);

    if (j.status === "done" && j.pdf){
      setSub("✅ Pronto!");
      const pdfBtn = $("pdfBtn");
      pdfBtn.style.display = "inline-flex";
      pdfBtn.href = j.pdf;
      setLog("Finalizado. Você já pode baixar o PDF.");
      return;
    }

    if (j.status === "failed"){
      setSub("❌ Falhou");
      setLog(j.error || "Falhou");
      return;
    }

    setLog("Gerando próximo passo…");
    setTimeout(tick, 1400);
  }catch(e){
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

// ------------------------------
// API: create
// ------------------------------
app.post("/api/create", async (req, res) => {
  try {
    const userId = await requireAuthUserId(req, res);
    if (!userId) return;

    await ensureDir(OUT_DIR);
    await ensureDir(BOOKS_DIR);

    const id = safeId();
    const bookDir = bookDirOf(userId, id);
    await ensureDir(bookDir);

    const m = makeEmptyManifest(id, userId);
    await saveManifest(userId, id, m);

    return res.json({ ok: true, id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

// ------------------------------
// API: uploadPhoto (REFEITO: valida + cria bases + salva keys)
// ------------------------------
app.post("/api/uploadPhoto", async (req, res) => {
  try {
    const userId = await requireAuthUserId(req, res);
    if (!userId) return;

    const id = String(req.body?.id || "").trim();
    const photo = req.body?.photo;
 const mask = req.body?.mask;

if (!id) return res.status(400).json({ ok: false, error: "id ausente" });
if (!photo || !isDataUrl(photo)) return res.status(400).json({ ok: false, error: "photo ausente ou inválida (dataURL)" });

// ✅ mask pode ser opcional (se vier inválida, a gente cria uma transparente)
const buf = dataUrlToBuffer(photo);
let maskBuf = (mask && isDataUrl(mask)) ? dataUrlToBuffer(mask) : null;

if (!buf || buf.length < 1000) return res.status(400).json({ ok: false, error: "photo inválida" });
// se mask veio mas está muito curta, ignora
if (maskBuf && maskBuf.length < 50) maskBuf = null;
    const m = await loadManifest(userId, id);
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });
    const mime = guessMimeFromDataUrl(photo);
    const ext = guessExtFromMime(mime);

    const bookDir = bookDirOf(userId, id);
    await ensureDir(bookDir);

    const originalName = "photo." + ext;
    const originalPath = path.join(bookDir, originalName);
    await fsp.writeFile(originalPath, buf);

    const photoPngName = "photo.png";
    const photoPngPath = path.join(bookDir, photoPngName);
    await sharp(buf).png().toFile(photoPngPath);

  const maskPngName = "mask.png";
const maskPngPath = path.join(bookDir, maskPngName);

if (maskBuf) {
  await sharp(maskBuf).ensureAlpha().png().toFile(maskPngPath);
} else {
  // ✅ cria máscara transparente do tamanho da foto PNG
  const meta = await sharp(photoPngPath).metadata();
  const ww = meta?.width || 1024;
  const hh = meta?.height || 1024;
  const transparent = await sharp({
    create: { width: ww, height: hh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png().toBuffer();
  await fsp.writeFile(maskPngPath, transparent);
}
    const photoMeta = await sharp(photoPngPath).metadata();
    const w0 = photoMeta?.width || 0;
    const h0 = photoMeta?.height || 0;
    if (!w0 || !h0) throw new Error("Falha ao ler metadata da foto.");

    const scale = Math.min(1, EDIT_MAX_SIDE / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const editBaseName = "edit_base.png";
    const editBasePath = path.join(bookDir, editBaseName);
    await sharp(photoPngPath).resize({ width: w, height: h, fit: "fill", withoutEnlargement: true }).png().toFile(editBasePath);
    // ✅ NOVO: cria referência só do rosto (evita herdar roupa da foto)
const faceBaseName = "face_base.png";
const faceBasePath = path.join(bookDir, faceBaseName);
await makeFaceBase({ inputPngPath: editBasePath, outputPngPath: faceBasePath });
    const maskBaseName = "mask_base.png";
    const maskBasePath = path.join(bookDir, maskBaseName);
    await sharp(maskPngPath).resize({ width: w, height: h, fit: "fill", withoutEnlargement: true }).ensureAlpha().png().toFile(maskBasePath);

    const mi = await sharp(editBasePath).metadata();
    const mm = await sharp(maskBasePath).metadata();
    if ((mi?.width || 0) !== (mm?.width || 0) || (mi?.height || 0) !== (mm?.height || 0)) {
      throw new Error(`Falha ao alinhar base: image=${mi?.width}x${mi?.height}, mask=${mm?.width}x${mm?.height}`);
    }

    // Supabase upload (opcional)
    let photoKey = "";
    let editBaseKey = "";
    let maskKey = "";
    let maskBaseKey = "";
    let faceBaseKey = "";
    if (sbEnabled()) {
      photoKey = sbKeyFor(userId, id, originalName);
      editBaseKey = sbKeyFor(userId, id, editBaseName);
      maskKey = sbKeyFor(userId, id, maskPngName);
      maskBaseKey = sbKeyFor(userId, id, maskBaseName);
      faceBaseKey = sbKeyFor(userId, id, faceBaseName);
      await sbUploadBuffer(faceBaseKey, await fsp.readFile(faceBasePath), "image/png");
      await sbUploadBuffer(photoKey, buf, mime);
      await sbUploadBuffer(editBaseKey, await fsp.readFile(editBasePath), "image/png");
      await sbUploadBuffer(maskKey, await fsp.readFile(maskPngPath), "image/png");
      await sbUploadBuffer(maskBaseKey, await fsp.readFile(maskBasePath), "image/png");
    }

    m.photo = { ok: true, file: originalName, mime, editBase: editBaseName, storageKey: photoKey, editBaseKey, faceBase: faceBaseName,
  faceBaseKey};
    m.mask = { ok: true, file: maskPngName, editBase: maskBaseName, storageKey: maskKey, editBaseKey: maskBaseKey };

    // reset geração se já estava bagunçada
    m.status = m.status === "done" ? "done" : "created";
    m.step = m.status === "done" ? "done" : "created";
    m.error = "";
    m.retry = m.retry || { count: 0, lastAt: "", nextTryAt: 0 };
    m.retry.count = 0;
    m.retry.lastAt = "";
    m.retry.nextTryAt = 0;
    m.updatedAt = nowISO();
    await saveManifest(userId, id, m);

    return res.json({ ok: true, base: { w: mi?.width, h: mi?.height } });
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
    const m = await loadManifestAsViewer(userId, id, req.user);
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });

    if (!canAccessBook(userId, m, req.user)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

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
// API: generate (REFEITO: NÃO trava lock; só prepara manifest)
// ------------------------------
app.post("/api/generate", requireAuth, async (req, res) => {
  const userId = String(req.user?.id || "");
  if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

  const id = String(req.body?.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "id ausente" });

  try {
    const m = await loadManifestAsViewer(userId, id, req.user);
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });

    if (!canAccessBook(userId, m, req.user)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const childName = String(req.body?.childName || m.child?.name || "").trim();
    const childAge = Number(req.body?.childAge ?? m.child?.age ?? 6);
    const childGender = String(req.body?.childGender || m.child?.gender || "neutral");
    const theme = String(req.body?.theme || m.theme || "space");
    const style = String(req.body?.style || m.style || "read");

    // validação mínima
    if (!childName || childName.length < 2) return res.status(400).json({ ok: false, error: "childName inválido" });
    if (!theme) return res.status(400).json({ ok: false, error: "theme inválido" });

    m.child = { name: childName, age: clamp(childAge, 2, 12), gender: childGender };
    m.theme = theme;
    m.style = style;

    // prepara geração
    m.status = "generating";
    // sempre começa no story (idempotente: generateNext vai pular se já existir)
    m.step = m.step === "done" ? "done" : "story";
    m.error = "";
    m.retry = m.retry || { count: 0, lastAt: "", nextTryAt: 0 };
    m.retry.count = 0;
    m.retry.lastAt = "";
    m.retry.nextTryAt = 0;
    m.updatedAt = nowISO();
    await saveManifest(userId, id, m);

    return res.json({ ok: true, id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

// ------------------------------
// Engine: valida precondições e resolve paths
// ------------------------------
async function ensureBasesOrThrow(userId, id, m) {
  const bookDir = bookDirOf(userId, id);
  await ensureDir(bookDir);

  const imagePngPath = path.join(bookDir, m.photo?.editBase || "edit_base.png");
  const maskPngPath  = path.join(bookDir, m.mask?.editBase  || "mask_base.png");

  // ✅ NOVO:
  const facePngPath  = path.join(bookDir, m.photo?.faceBase || "face_base.png");

  await ensureFileFromStorageIfMissing(imagePngPath, m.photo?.editBaseKey || "");
  await ensureFileFromStorageIfMissing(maskPngPath,  m.mask?.editBaseKey || "");

  // ✅ NOVO:
  await ensureFileFromStorageIfMissing(facePngPath, m.photo?.faceBaseKey || "");

  if (!existsSyncSafe(imagePngPath)) throw new Error("edit_base.png não encontrada. Reenvie a foto.");
  if (!existsSyncSafe(maskPngPath))  throw new Error("mask_base.png não encontrada. Reenvie a foto.");

  // ✅ NOVO:
  if (!existsSyncSafe(facePngPath))  throw new Error("face_base.png não encontrada. Reenvie a foto.");

  return { bookDir, imagePngPath, maskPngPath, facePngPath };
}

function ensureRetryFields(m) {
  if (!m.retry) m.retry = { count: 0, lastAt: "", nextTryAt: 0 };
  if (!Number.isFinite(m.retry.count)) m.retry.count = 0;
  if (!Number.isFinite(m.retry.nextTryAt)) m.retry.nextTryAt = 0;
  if (typeof m.retry.lastAt !== "string") m.retry.lastAt = "";
  return m;
}

function setCooldown(m, ms, reason) {
  m = ensureRetryFields(m);
  m.retry.count = clamp(m.retry.count + 1, 0, 99);
  m.retry.lastAt = nowISO();
  m.retry.nextTryAt = Date.now() + clamp(ms, 1000, 10 * 60 * 1000);
  m.error = reason ? String(reason) : m.error;
  return m;
}

function shouldCooldownWait(m) {
  m = ensureRetryFields(m);
  if (!m.retry.nextTryAt) return 0;
  const wait = m.retry.nextTryAt - Date.now();
  return wait > 0 ? wait : 0;
}

function isTransientError(msg) {
  const s = String(msg || "").toLowerCase();
  return (
    s.includes("timeout") ||
    s.includes("timed out") ||
    s.includes("econnreset") ||
    s.includes("network") ||
    s.includes("502") ||
    s.includes("503") ||
    s.includes("429") ||
    s.includes("high demand") ||
    s.includes("temporar") ||
    s.includes("rate limit") ||
    s.includes("busy")
  );
}

// ------------------------------
// Geração passo-a-passo (REFEITO: state machine idempotente)
// ------------------------------
app.post("/api/generateNext", requireAuth, async (req, res) => {
  let userId = "";
  let id = "";
  try {
    userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

    id = String(req.body?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "id ausente" });

    let m = await loadManifest(userId, id);
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });
    if (!canAccessBook(userId, m, req.user)) return res.status(403).json({ ok: false, error: "forbidden" });

    // Se já terminou ou falhou, não faz nada
    if (m.status === "done" || m.step === "done") return res.json({ ok: true, step: "done" });
    if (m.status === "failed" || m.step === "failed") return res.json({ ok: true, step: "failed" });

    // cooldown (evita bater em API em loop quando deu erro temporário)
    m = ensureRetryFields(m);
    const waitMs = shouldCooldownWait(m);
    if (waitMs > 0) {
      return res.json({ ok: true, step: m.step || "waiting", nextTryAt: m.retry.nextTryAt });
    }

    // lock por book
    if (!acquireLock(userId, id)) {
      return res.status(409).json({ ok: false, error: "step já em execução" });
    }

    // reabre manifest (mais seguro)
    m = await loadManifest(userId, id);
    if (!m) throw new Error("Manifest sumiu");

    // Se nunca iniciou: começa story
    if (!m.status || m.status === "created") {
      m.status = "generating";
      m.step = "story";
      m.error = "";
      m.updatedAt = nowISO();
      await saveManifest(userId, id, m);
    }

    // garante bases no disco
   const { bookDir, imagePngPath, maskPngPath, facePngPath } = await ensureBasesOrThrow(userId, id, m);

    const styleKey = String(m.style || "read").trim();
    const childName = String(m.child?.name || "Criança").trim() || "Criança";
    const childAge = clamp(m.child?.age ?? 6, 2, 12);
    const childGender = String(m.child?.gender || "neutral");
    const theme = String(m.theme || "space");

    // --------------------------
    // STEP: story (idempotente)
    // --------------------------
    if (m.step === "story") {
      if (Array.isArray(m.pages) && m.pages.length >= 4) {
        m.step = "cover";
        m.updatedAt = nowISO();
        await saveManifest(userId, id, m);
        return res.json({ ok: true, step: "story_skipped" });
      }

      const pages = await generateStoryTextPages({
        childName,
        childAge,
        childGender,
        themeKey: theme,
        pagesCount: 8,
      });

      m.pages = pages;
      m.step = "cover";
      m.error = "";
      m.retry = { count: 0, lastAt: "", nextTryAt: 0 };
      m.updatedAt = nowISO();
      await saveManifest(userId, id, m);
      return res.json({ ok: true, step: "story_done" });
    }

    // --------------------------
    // STEP: cover (idempotente)
    // --------------------------
    if (m.step === "cover") {
      const coverFinalName = "cover_final.png";
      const coverFinalPath = path.join(bookDir, coverFinalName);

      // se já existe, pula
      if (existsSyncSafe(coverFinalPath)) {
        m.cover = {
          ok: true,
          file: coverFinalName,
          url: `/api/image/${encodeURIComponent(id)}/${encodeURIComponent(coverFinalName)}`,
          storageKey: m.cover?.storageKey || "",
        };
        m.step = "image_1";
        m.updatedAt = nowISO();
        await saveManifest(userId, id, m);
        return res.json({ ok: true, step: "cover_skipped" });
      }

      const coverPrompt = buildCoverPrompt({
        themeKey: theme,
        childName,
        childAge,
        childGender,
        styleKey,
      });

     const coverBuf = await imageFromReference({
  imagePngPath: facePngPath,   // ✅ rosto apenas
  maskPngPath: null,           // ✅ não use máscara aqui (deixa trocar roupa)
  prompt: coverPrompt,
  size: "1024x1024",
});
      const coverBaseName = "cover.png";
      const coverBasePath = path.join(bookDir, coverBaseName);
      await fsp.writeFile(coverBasePath, coverBuf);

      await stampCoverTextOnImage({
        inputPath: coverBasePath,
        outputPath: coverFinalPath,
        title: "Meu Livro Mágico",
        subtitle: `A aventura de ${childName} • ${themeLabel(theme)}`,
      });

      let coverKey = "";
      if (sbEnabled()) {
        coverKey = sbKeyFor(userId, id, coverFinalName);
        await sbUploadBuffer(coverKey, await fsp.readFile(coverFinalPath), "image/png");
      }

      m.cover = {
        ok: true,
        file: coverFinalName,
        url: `/api/image/${encodeURIComponent(id)}/${encodeURIComponent(coverFinalName)}`,
        storageKey: coverKey,
      };

      m.step = "image_1";
      m.error = "";
      m.retry = { count: 0, lastAt: "", nextTryAt: 0 };
      m.updatedAt = nowISO();
      await saveManifest(userId, id, m);

      return res.json({ ok: true, step: "cover_done" });
    }

    // --------------------------
    // STEP: pages image_N (idempotente)
    // --------------------------
    if (String(m.step || "").startsWith("image_")) {
      const n = Number(String(m.step).split("_")[1] || "1");
      const pages = Array.isArray(m.pages) ? m.pages : [];

      if (!pages.length) {
        m.step = "story";
        m.updatedAt = nowISO();
        await saveManifest(userId, id, m);
        return res.json({ ok: true, step: "reset_to_story" });
      }

      const p = pages.find((x) => Number(x.page) === n);
      if (!p) {
        m.step = "pdf";
        m.updatedAt = nowISO();
        await saveManifest(userId, id, m);
        return res.json({ ok: true, step: "images_done" });
      }

      const finalName = `page_${String(p.page).padStart(2, "0")}_final.png`;
      const finalPath = path.join(bookDir, finalName);

      // Se já existe, garante no manifest e pula pro próximo
      if (existsSyncSafe(finalPath)) {
        const images = Array.isArray(m.images) ? m.images : [];
        if (!images.some((it) => Number(it.page) === Number(p.page))) {
          images.push({
            page: p.page,
            path: finalPath,
            file: finalName,
            prompt: "",
            url: `/api/image/${encodeURIComponent(id)}/${encodeURIComponent(finalName)}`,
            storageKey: "",
          });
          m.images = images;
        }

        const nextN = n + 1;
        m.step = nextN <= pages.length ? `image_${nextN}` : "pdf";
        m.updatedAt = nowISO();
        await saveManifest(userId, id, m);
        return res.json({ ok: true, step: `image_${n}_skipped` });
      }

      const prompt = buildScenePromptFromParagraph({
        paragraphText: p.text,
        themeKey: theme,
        childName,
        childAge,
        childGender,
        styleKey,
      });

      const imgBuf = await imageFromReference({
  imagePngPath: facePngPath,   // ✅ rosto apenas
  maskPngPath: null,           // ✅ não use máscara aqui (deixa trocar roupa)
  prompt,
  size: "1024x1024",
});

      const baseName = `page_${String(p.page).padStart(2, "0")}.png`;
      const basePath = path.join(bookDir, baseName);
      await fsp.writeFile(basePath, imgBuf);

      await stampStoryTextOnImage({
        inputPath: basePath,
        outputPath: finalPath,
        title: p.title,
        text: p.text,
      });

      let pageKey = "";
      if (sbEnabled()) {
        pageKey = sbKeyFor(userId, id, finalName);
        await sbUploadBuffer(pageKey, await fsp.readFile(finalPath), "image/png");
      }

      const images = Array.isArray(m.images) ? m.images : [];
      images.push({
        page: p.page,
        path: finalPath,
        file: finalName,
        prompt,
        url: `/api/image/${encodeURIComponent(id)}/${encodeURIComponent(finalName)}`,
        storageKey: pageKey,
      });
      m.images = images;

      const nextN = n + 1;
      m.step = nextN <= pages.length ? `image_${nextN}` : "pdf";
      m.error = "";
      m.retry = { count: 0, lastAt: "", nextTryAt: 0 };
      m.updatedAt = nowISO();
      await saveManifest(userId, id, m);

      return res.json({ ok: true, step: `image_${n}_done` });
    }

    // --------------------------
    // STEP: pdf (idempotente)
    // --------------------------
    if (m.step === "pdf") {
      const pdfName = `book-${id}.pdf`;
      const pdfPath = path.join(bookDir, pdfName);

      // se já existe, finaliza
      if (existsSyncSafe(pdfPath)) {
        m.status = "done";
        m.step = "done";
        m.error = "";
        m.pdf = `/download/${encodeURIComponent(id)}`;
        m.updatedAt = nowISO();
        await saveManifest(userId, id, m);
        return res.json({ ok: true, step: "done" });
      }

      const coverPath = path.join(bookDir, "cover_final.png");
      const pageImagePaths = (m.images || []).map((it) => it.path).filter(Boolean);

      const outPdfPath = await makePdfImagesOnly({
        bookId: id,
        coverPath,
        pageImagePaths,
        outputDir: bookDir,
      });

      let pdfKey = "";
      if (sbEnabled()) {
        pdfKey = sbKeyFor(userId, id, pdfName);
        await sbUploadBuffer(pdfKey, await fsp.readFile(outPdfPath), "application/pdf");
      }

      m.status = "done";
      m.step = "done";
      m.error = "";
      m.pdf = `/download/${encodeURIComponent(id)}`;
      m.pdfKey = pdfKey;
      m.retry = { count: 0, lastAt: "", nextTryAt: 0 };
      m.updatedAt = nowISO();
      await saveManifest(userId, id, m);

      return res.json({ ok: true, step: "done" });
    }

    // fallback: se step inválido, volta pro story
    m.step = "story";
    m.updatedAt = nowISO();
    await saveManifest(userId, id, m);
    return res.json({ ok: true, step: "reset_unknown_to_story" });
  } catch (e) {
    // Se erro for temporário, aplica cooldown e NÃO marca failed de primeira
    const msg = String(e?.message || e || "Erro");
    try {
      if (userId && id) {
        const m = await loadManifest(userId, id);
        if (m && m.status !== "done") {
          if (isTransientError(msg)) {
            setCooldown(m, 6000, msg);
            m.updatedAt = nowISO();
            await saveManifest(userId, id, m);
            return res.status(200).json({ ok: true, step: m.step || "retrying", nextTryAt: m.retry?.nextTryAt || 0 });
          }

          // erro definitivo
          m.status = "failed";
          m.step = "failed";
          m.error = msg;
          m.updatedAt = nowISO();
          await saveManifest(userId, id, m);
        }
      }
    } catch {}
    return res.status(500).json({ ok: false, error: msg });
  } finally {
    try {
      if (userId && id) releaseLock(userId, id);
    } catch {}
  }
});

// ------------------------------
// Servir imagens do livro: /api/image/:id/:file
// - Vercel-safe: se não existir no disco, tenta baixar do Storage
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

    const m = await loadManifestAsViewer(userId, id, req.user);
    if (!m) return res.status(404).send("not found");
    if (!canAccessBook(userId, m, req.user)) return res.status(403).send("forbidden");

    const fp = path.join(bookDirOf(userId, id), file);
if (!existsSyncSafe(fp) && sbEnabled()) {
  const key = sbKeyForOwner(m, id, file) || sbKeyFor(userId, id, file);
  await ensureFileFromStorageIfMissing(fp, key);
}

    if (!existsSyncSafe(fp)) return res.status(404).send("not found");

    res.setHeader("Cache-Control", "no-store");
    const ext = path.extname(fp).toLowerCase();
    res.type(ext === ".jpg" || ext === ".jpeg" ? "jpg" : ext === ".pdf" ? "pdf" : "png");
    res.send(fs.readFileSync(fp));
  } catch (e) {
    res.status(500).send(String(e?.message || e || "Erro"));
  }
});

// ------------------------------
// Download PDF
// ------------------------------
app.get("/download/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || "";
    if (!userId) return;

    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).send("id ausente");

    const m = await loadManifestAsViewer(userId, id, req.user);
    if (!m) return res.status(404).send("book não existe");
    if (!canAccessBook(userId, m, req.user)) return res.status(403).send("forbidden");
    if (m.status !== "done") return res.status(409).send("PDF ainda não está pronto");

    const pdfName = `book-${id}.pdf`;
    const pdfPath = path.join(bookDirOf(userId, id), pdfName);

    if (!existsSyncSafe(pdfPath) && sbEnabled()) {
  const key = m.pdfKey || sbKeyForOwner(m, id, pdfName) || sbKeyFor(userId, id, pdfName);
  await ensureFileFromStorageIfMissing(pdfPath, key);
}

    if (!existsSyncSafe(pdfPath)) return res.status(404).send("pdf não encontrado");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="livro-${id}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (e) {
    res.status(500).send(String(e?.message || e || "Erro"));
  }
});

// ------------------------------
// Placeholder /books (simples)
// ------------------------------
// ------------------------------
// /books — lista livros do usuário (admin vê tudo)
// BOOKS_DIR/<ownerId>/<bookId>/book.json
// ------------------------------
app.get("/books", requireAuth, async (req, res) => {
  const userId = String(req.user?.id || "");
  const list = [];

  try {
    await ensureDir(BOOKS_DIR);

    const ownerDirs = await fsp.readdir(BOOKS_DIR).catch(() => []);

    for (const ownerId of ownerDirs) {
      const ownerPath = path.join(BOOKS_DIR, ownerId);

      let bookDirs = [];
      try {
        const st = await fsp.stat(ownerPath);
        if (!st.isDirectory()) continue;
        bookDirs = await fsp.readdir(ownerPath).catch(() => []);
      } catch {
        continue;
      }

      for (const bookId of bookDirs) {
        const p = path.join(ownerPath, bookId, "book.json");
        if (!existsSyncSafe(p)) continue;

        const m = await readJson(p).catch(() => null);
        if (!m) continue;

        // ✅ respeita permissão (admin vê tudo)
        if (!canAccessBook(userId, m, req.user)) continue;

        list.push(m);
      }
    }
  } catch {}

  list.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Meus Livros</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:linear-gradient(180deg,#ede9fe,#fff,#fdf2f8);color:#111827}
  .wrap{max-width:980px;margin:0 auto;padding:24px 16px}
  .card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:22px;box-shadow:0 20px 50px rgba(0,0,0,.10);padding:18px}
  h1{margin:0 0 12px;font-weight:1000}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  @media(max-width:720px){.grid{grid-template-columns:1fr}}
  .item{border:1px solid rgba(0,0,0,.08);border-radius:18px;padding:12px}
  .muted{color:#6b7280;font-weight:900}
  a.btn{display:inline-flex;gap:10px;align-items:center;padding:10px 12px;border-radius:999px;text-decoration:none;font-weight:1000;background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff}
  a.ghost{background:transparent;color:#374151;border:1px solid rgba(0,0,0,.08)}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="row" style="justify-content:space-between;align-items:center">
      <h1>📚 Meus Livros</h1>
      <div class="row">
        <a class="btn ghost" href="/create">+ Criar</a>
        <a class="btn ghost" href="/sales">Vendas</a>
      </div>
    </div>
    <div class="grid">
      ${list
        .map((m) => {
          const cover = m.cover?.url ? `<img src="${m.cover.url}" style="width:100%;border-radius:14px;display:block"/>` : "";
          const title = escapeHtml(m.child?.name ? `Aventura de ${m.child.name}` : "Livro");
          const st = escapeHtml(m.status || "created");
          const up = escapeHtml(m.updatedAt || "");
          const open = `/generate?id=${encodeURIComponent(m.id)}`;
          const pdf = m.pdf ? `<a class="btn" href="${m.pdf}">⬇️ PDF</a>` : "";
          return `<div class="item">
            ${cover}
            <div style="margin-top:10px;font-weight:1000">${title}</div>
            <div class="muted">status=${st}</div>
            <div class="muted" style="font-size:12px">${up}</div>
            <div class="row">
              <a class="btn ghost" href="${open}">👀 Abrir</a>
              ${pdf}
            </div>
          </div>`;
        })
        .join("")}
    </div>
    ${list.length ? "" : `<div class="muted">Nenhum livro ainda. Clique em "Criar".</div>`}
  </div>
</div>
</body>
</html>`);
});

// ------------------------------
// Start
// ------------------------------
(async () => {
  await ensureDir(OUT_DIR);
  await ensureDir(BOOKS_DIR);

  app.listen(PORT, () => {
    console.log("===============================================");
    console.log(`📚 Meu Livro Mágico — SEQUENCIAL (REFEITO)`);
    console.log(`✅ http://localhost:${PORT}`);
    console.log(`🛒 Página de Vendas: http://localhost:${PORT}/sales`);
    console.log(`✨ Gerador:          http://localhost:${PORT}/create`);
    console.log(`⏳ Gerando:          http://localhost:${PORT}/generate`);
    console.log("-----------------------------------------------");
    console.log("ℹ️  BASE DIR:", OUT_DIR, IS_VERCEL ? "(Vercel:/tmp)" : "(local)");
    console.log("-----------------------------------------------");

    if (!OPENAI_API_KEY) {
      console.log("❌ OPENAI_API_KEY NÃO configurada (texto não vai gerar).");
      console.log("   ➜ Crie .env.local com: OPENAI_API_KEY=sua_chave");
    } else {
      console.log("✅ OPENAI_API_KEY OK");
      console.log("ℹ️  TEXT_MODEL:", TEXT_MODEL);
    }

    if (REPLICATE_API_TOKEN) {
      console.log("✅ REPLICATE_API_TOKEN OK");
      console.log("ℹ️  IMAGE_PROVIDER: Replicate");
      console.log("ℹ️  REPLICATE_MODEL:", REPLICATE_MODEL);
      if (REPLICATE_VERSION) console.log("ℹ️  REPLICATE_VERSION (fixa):", REPLICATE_VERSION);
      console.log("ℹ️  RESOLUTION:", REPLICATE_RESOLUTION, "| ASPECT:", REPLICATE_ASPECT_RATIO, "| FORMAT:", REPLICATE_OUTPUT_FORMAT, "| SAFETY:", REPLICATE_SAFETY);
     console.log("✅ Referência: envia image_input (máscara vazia é ignorada automaticamente).");
    } else {
      console.log("⚠️  REPLICATE_API_TOKEN NÃO configurado -> usando fallback OpenAI Images.");
      console.log("ℹ️  IMAGE_MODEL:", IMAGE_MODEL);
    }

    if (sbEnabled()) {
      console.log("✅ Supabase Storage ativo:", SUPABASE_URL);
      console.log("ℹ️  Bucket:", SUPABASE_STORAGE_BUCKET);
    } else {
      console.log("ℹ️  Supabase Storage desativado.");
    }

    console.log("✅ Estilos: read (leitura) | color (leitura + colorir)");
    console.log("===============================================");
  });
})();

module.exports = app;