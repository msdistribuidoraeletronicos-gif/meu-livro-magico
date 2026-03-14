// core.js
"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");
const cookieParser = require("cookie-parser");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config(); // fallback

// ------------------------------
// Configurações e constantes
// ------------------------------
const PORT = Number(process.env.PORT || 3000);

const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const TEXT_MODEL = String(process.env.TEXT_MODEL || "gpt-4.1-mini").trim() || "gpt-4.1-mini";
const IMAGE_MODEL = String(process.env.IMAGE_MODEL || "dall-e-2").trim() || "dall-e-2";

const REPLICATE_API_TOKEN = String(process.env.REPLICATE_API_TOKEN || "").trim();
const REPLICATE_MODEL = String(process.env.REPLICATE_MODEL || "google/nano-banana-pro").trim();
const REPLICATE_VERSION = String(process.env.REPLICATE_VERSION || "").trim();
const REPLICATE_RESOLUTION = String(process.env.REPLICATE_RESOLUTION || "2K").trim();
const REPLICATE_ASPECT_RATIO = String(process.env.REPLICATE_ASPECT_RATIO || "1:1").trim();
const REPLICATE_OUTPUT_FORMAT = String(process.env.REPLICATE_OUTPUT_FORMAT || "png").trim();
const REPLICATE_SAFETY = String(process.env.REPLICATE_SAFETY || "block_only_high").trim();

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_STORAGE_BUCKET = String(process.env.SUPABASE_STORAGE_BUCKET || "books").trim();
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "").trim();

const IS_VERCEL = !!process.env.VERCEL;
const LOCAL_BASE = IS_VERCEL ? path.join("/tmp", "mlm-output") : path.join(__dirname, "output");
const OUT_DIR = LOCAL_BASE;
const USERS_DIR = OUT_DIR;
const USERS_FILE = path.join(USERS_DIR, "users.json");
const BOOKS_DIR = path.join(OUT_DIR, "books");

const JSON_LIMIT = "25mb";
const EDIT_MAX_SIDE = 1024;

const IMAGE_PROVIDER = REPLICATE_API_TOKEN ? "replicate" : "openai";

const AUTH_COOKIE = "sb_access";
const REFRESH_COOKIE = "sb_refresh";

// ------------------------------
// Helpers de arquivo
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

async function readJsonSafe(file, fallback = null) {
  try {
    return JSON.parse(await fsp.readFile(file, "utf-8"));
  } catch {
    return fallback;
  }
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
// DataURL helpers
// ------------------------------
function isDataUrl(s) {
  return typeof s === "string" && s.startsWith("data:") && s.includes("base64,");
}

function dataUrlToBuffer(dataUrl) {
  if (!isDataUrl(dataUrl)) return null;
  const base64 = dataUrl.split("base64,", 2)[1];
  return base64 ? Buffer.from(base64, "base64") : null;
}

function guessMimeFromDataUrl(dataUrl) {
  if (!isDataUrl(dataUrl)) return "image/png";
  const head = dataUrl.slice(0, 64).toLowerCase();
  if (head.includes("jpeg") || head.includes("jpg")) return "image/jpeg";
  if (head.includes("webp")) return "image/webp";
  return "image/png";
}

function guessExtFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  return "png";
}

function bufferToDataUrlPng(buf) {
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function clamp(n, a, b) {
  n = Number(n);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}

// ------------------------------
// Funções de tema / label
// ------------------------------
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

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ------------------------------
// Supabase (opcional)
// ------------------------------
let supabaseAuth = null;
let supabaseAdmin = null;

try {
  const { createClient } = require("@supabase/supabase-js");
  if (SUPABASE_URL) {
    if (SUPABASE_ANON_KEY) {
      supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { "X-Client-Info": "mlm-auth" } },
      });
      console.log("✅ Supabase Auth client inicializado.");
    }
    if (SUPABASE_SERVICE_ROLE_KEY) {
      supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { "X-Client-Info": "mlm-admin" } },
      });
      console.log("✅ Supabase Admin client inicializado (service role).");
    }
  }
} catch (err) {
  console.warn("⚠️ @supabase/supabase-js não instalado ou erro na inicialização:", err.message);
}

function sbEnabled() {
  const enabled = !!supabaseAdmin;
  if (!enabled) {
    console.warn("⚠️ sbEnabled: Supabase Admin não disponível (service role key ausente ou inválida).");
  }
  return enabled;
}

function sbKeyFor(userId, bookId, fileName) {
  return `users/${String(userId)}/books/${String(bookId)}/${String(fileName)}`;
}

function sbKeyForOwner(manifest, bookId, fileName) {
  const ownerId = String(manifest?.ownerId || "").trim();
  return ownerId ? sbKeyFor(ownerId, bookId, fileName) : "";
}

async function sbUploadBuffer(key, buf, contentType = "application/octet-stream") {
  if (!sbEnabled()) {
    console.log(`[sbUploadBuffer] Supabase desabilitado. Não enviando: ${key}`);
    return { ok: false, key, reason: "supabase_disabled" };
  }
  try {
    console.log(`[sbUploadBuffer] Iniciando upload para: ${key} (tamanho: ${buf.length} bytes)`);
    const { error } = await supabaseAdmin.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(key, buf, { upsert: true, contentType, cacheControl: "3600" });

    if (error) {
      console.error(`[sbUploadBuffer] ERRO no upload para ${key}:`, error.message);
      return { ok: false, key, reason: String(error.message || error) };
    }

    console.log(`[sbUploadBuffer] Upload concluído com sucesso: ${key}`);
    return { ok: true, key };
  } catch (err) {
    console.error(`[sbUploadBuffer] Exceção no upload para ${key}:`, err.message);
    return { ok: false, key, reason: err.message };
  }
}

async function sbDownloadToBuffer(key) {
  if (!sbEnabled()) {
    console.log(`[sbDownloadToBuffer] Supabase desabilitado. Não baixando: ${key}`);
    return { ok: false, reason: "supabase_disabled", buf: null };
  }
  try {
    console.log(`[sbDownloadToBuffer] Baixando: ${key}`);
    const { data, error } = await supabaseAdmin.storage.from(SUPABASE_STORAGE_BUCKET).download(key);

    if (error || !data) {
      console.error(`[sbDownloadToBuffer] ERRO ao baixar ${key}:`, error?.message || error);
      return { ok: false, reason: String(error?.message || error || "download_failed"), buf: null };
    }

    const ab = await data.arrayBuffer();
    console.log(`[sbDownloadToBuffer] Download concluído: ${key} (${ab.byteLength} bytes)`);
    return { ok: true, buf: Buffer.from(ab) };
  } catch (err) {
    console.error(`[sbDownloadToBuffer] Exceção ao baixar ${key}:`, err.message);
    return { ok: false, reason: err.message, buf: null };
  }
}

async function ensureFileFromStorageIfMissing(localPath, storageKey) {
  if (existsSyncSafe(localPath)) return true;
  if (!storageKey) return false;

  const got = await sbDownloadToBuffer(storageKey);
  if (!got.ok || !got.buf) return false;

  await ensureDir(path.dirname(localPath));
  await fsp.writeFile(localPath, got.buf);
  console.log(`[ensureFileFromStorageIfMissing] Arquivo restaurado do storage: ${localPath}`);
  return true;
}

// ------------------------------
// Sync da tabela books no Supabase
// ------------------------------
async function syncBookRowToSupabase(manifest) {
  if (!sbEnabled()) {
    console.warn("Supabase Admin não disponível.");
    return { ok: false };
  }

  if (!manifest || !manifest.id) {
    console.warn("Manifest inválido.");
    return { ok: false };
  }

  try {

    const row = {
      id: manifest.id,
      user_id: manifest.ownerId || null,

      child_name: manifest.child?.name || "",
      child_age: manifest.child?.age || 6,
      child_gender: manifest.child?.gender || "neutral",

      theme: manifest.theme || "space",
      style: manifest.style || "read",

      status: manifest.status || "created",
      step: manifest.step || "created",

      message: manifest.message || "",
      error: manifest.error || "",

      done_steps: manifest.done_steps || 0,
      total_steps: manifest.total_steps || 11,

      cover_url: manifest.cover?.url || "",
      pdf_url: manifest.pdf || "",

      images: manifest.images || [],

      manifest: manifest,

      created_at: manifest.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),

      city: manifest.order?.city || "",
      partner_id: manifest.partner?.id || null,

      meta: manifest.meta || {}
    };

    const { data, error } = await supabaseAdmin
      .from("books")
      .upsert(row, { onConflict: "id" })
      .select("id")
      .single();

    if (error) {
      console.error("Erro ao salvar livro no Supabase:", error);
      return { ok: false, error };
    }

    console.log("Livro sincronizado com Supabase:", data.id);

    return { ok: true, data };

  } catch (err) {

    console.error("Falha ao sincronizar livro:", err);

    return { ok: false, error: err };
  }
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

function canAccessBook(viewerUserId, manifest, reqUser) {
  if (isAdminUser(reqUser)) return true;
  return !!manifest && String(manifest.ownerId || "") === String(viewerUserId || "");
}

// ------------------------------
// AUTH (cookies)
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

function setAuthCookies(res, accessToken, refreshToken) {
  const base = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (process.env.VERCEL) base.push("Secure");

  const c1 = [`${AUTH_COOKIE}=${encodeURIComponent(accessToken || "")}`, ...base, `Max-Age=${60 * 60}`].join("; ");
  const c2 = [`${REFRESH_COOKIE}=${encodeURIComponent(refreshToken || "")}`, ...base, `Max-Age=${60 * 60 * 24 * 30}`].join("; ");

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

  if (refresh) {
    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refresh });
    if (!error && data?.session?.access_token && data?.session?.refresh_token) {
      req._newAuthSession = { access: data.session.access_token, refresh: data.session.refresh_token };
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

      if (req._newAuthSession?.access && req._newAuthSession?.refresh) {
        setAuthCookies(res, req._newAuthSession.access, req._newAuthSession.refresh);
      }

      req.user = user;
      return next();
    })
    .catch(() => {
      const nextUrl = encodeURIComponent(req.originalUrl || "/create");
      return res.redirect(`/login?next=${nextUrl}`);
    });
}

function requireApiAuth(req, res, next) {
  getCurrentUser(req)
    .then((user) => {
      if (!user) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

      if (req._newAuthSession?.access && req._newAuthSession?.refresh) {
        setAuthCookies(res, req._newAuthSession.access, req._newAuthSession.refresh);
      }

      req.user = user;
      return next();
    })
    .catch(() => {
      return res.status(401).json({ ok: false, error: "not_logged_in" });
    });
}
// ------------------------------
// HTTP helpers
// ------------------------------
async function fetchJson(
  url,
  { method = "GET", headers = {}, body = null, timeoutMs = 180000 } = {}
) {
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
// OpenAI (texto)
// ------------------------------
async function openaiFetchJson(url, bodyObj, timeoutMs = 180000) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada.");

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
// Replicate
// ------------------------------
const replicateVersionCache = new Map();

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
  if (!parsed) {
    throw new Error(`REPLICATE_MODEL inválido: "${key}". Use "owner/name" ou configure REPLICATE_VERSION.`);
  }

  const info = await fetchJson(`https://api.replicate.com/v1/models/${parsed.owner}/${parsed.name}`, {
    method: "GET",
    timeoutMs: 60000,
    headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
  });

  const versionId = info?.latest_version?.id || info?.latest_version?.version || info?.latest_version;
  if (!versionId) {
    throw new Error(`Não consegui obter latest_version do modelo "${key}". Configure REPLICATE_VERSION manualmente.`);
  }

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
    if (st === "failed" || st === "canceled") {
      throw new Error(String(pred?.error || "Prediction falhou no Replicate."));
    }

    await sleep(pollMs);
  }
}

// ------------------------------
// OpenAI Image (fallback)
// ------------------------------
async function openaiImageEditFallback({ imagePngPath, maskPngPath, prompt, size = "1024x1024" }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada.");
  if (typeof FormData === "undefined") throw new Error("Node 18+ necessário para FormData.");

  const imgBuf = await fsp.readFile(imagePngPath);
  const maskBuf = maskPngPath && existsSyncSafe(maskPngPath) ? await fsp.readFile(maskPngPath) : null;
  const effectiveMaskBuf = maskBuf ? await removeMaskIfBlank(maskBuf).catch(() => maskBuf) : null;

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
// Mask utils
// ------------------------------
async function removeMaskIfBlank(maskBuf) {
  const img = sharp(maskBuf).ensureAlpha();
  const stats = await img.stats();
  const a = stats?.channels?.[3];
  if (!a) return maskBuf;
  if ((a.max ?? 255) <= 2) return null;
  return maskBuf;
}

// ------------------------------
// Imagem principal (agora com seed)
// ------------------------------
async function imageFromReference({ imagePngPath, maskPngPath, prompt, size = "1024x1024", seed = null }) {
  if (REPLICATE_API_TOKEN) {
    const imgBuf = await fsp.readFile(imagePngPath);
    const maskBuf = maskPngPath && existsSyncSafe(maskPngPath) ? await fsp.readFile(maskPngPath) : null;
    const effectiveMask = maskBuf ? await removeMaskIfBlank(maskBuf).catch(() => maskBuf) : null;

    const refDataUrl = bufferToDataUrlPng(imgBuf);
    const maskDataUrl = effectiveMask ? bufferToDataUrlPng(effectiveMask) : null;

    const input = {
      prompt,
      image_input: [refDataUrl],
      image: refDataUrl,
      input_image: refDataUrl,
      aspect_ratio: REPLICATE_ASPECT_RATIO,
      resolution: REPLICATE_RESOLUTION,
      output_format: REPLICATE_OUTPUT_FORMAT,
      safety_filter_level: REPLICATE_SAFETY,
      match_input_image: false,
    };

    if (maskDataUrl) {
      input.mask = maskDataUrl;
      input.mask_image = maskDataUrl;
    }

    if (seed !== null && Number.isInteger(seed)) {
      input.seed = seed;
    }

    const created = await replicateCreatePrediction({
      model: REPLICATE_MODEL,
      input,
      timeoutMs: 120000,
    });

    const pred = await replicateWaitPrediction(created?.id, {
      timeoutMs: 300000,
      pollMs: 1200,
    });

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
// Geração de texto (história)
// ------------------------------
async function generateStoryTextPages({ childName, childAge, childGender, themeKey, pagesCount }) {
  const theme_key = String(themeKey || "space");
  const age = clamp(childAge, 2, 12);
  const gender = String(childGender || "neutral");
  const name = String(childName || "Criança").trim() || "Criança";
  const pages = clamp(pagesCount || 8, 4, 12);

  const system =
    'Você é um escritor de livros infantis.\n' +
    "Crie uma história curta e positiva, apropriada para a idade.\n" +
    "Retorne em PÁGINAS (cada página = 1 parágrafo).\n" +
    "Cada página deve ter:\n" +
    "- page (número)\n" +
    "- title (string curta)\n" +
    "- text (UM PARÁGRAFO, sem quebras de linha; até ~55 palavras se <=7 anos; até ~75 se >7)\n" +
    "Regras:\n" +
    "- O nome da criança deve aparecer no texto e ser o protagonista.\n" +
    "- Linguagem simples, divertida e mágica, com uma pequena lição.\n" +
    'Responda SOMENTE JSON válido no formato: {"pages":[...]}';

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
// Prompts MELHORADOS com ênfase na consistência da criança
// ------------------------------
function buildScenePromptFromParagraph({ paragraphText, themeKey, childName, childAge, childGender, styleKey }) {
  const th = themeDesc(themeKey);
  const name = String(childName || "").trim();
  const age = clamp(childAge ?? 6, 2, 12);
  const genderRaw = String(childGender || "neutral");
  const g = genderLabel(genderRaw);
  const txt = String(paragraphText || "").trim();
  const style = String(styleKey || "read").trim();

  const identityRules = `INSTRUÇÕES CRÍTICAS - IDENTIDADE DA CRIANÇA:
- A criança na foto de referência é ${name ? `${name}, ` : ""}um(a) ${g} de ${age} anos.
- quero que coloque essa criança na cena. Não invente outra criança.
- Mantenha os mesmos traços faciais, cor de pele, cabelo e olhos.
- Você PODE mudar a roupa, o corpo (ex: em pé, sentado), o penteado (desde que não descaracterize) e o cenário para combinar com a cena.
- A pose deve ser natural e dinâmica, condizente com a ação do texto.
- Integre a criança na cena de forma natural, com expressoes faciais que condizem com a cena.
- NÃO copie a pose ou a roupa da foto de referência. A criança deve estar integrada à nova cena.
- É obrigatório que a criança pareça ter ${age} anos e seja reconhecível como a mesma pessoa da foto.`;

  const sceneRules = `CENA:
- Tema: ${th}
- Ação descrita no texto: "${txt}"
- A criança deve estar realizando a ação ou presente na cena de forma natural.
- Ilustração alegre e adequada para livro infantil.`;

  const styleRule = style === "color"
    ? "ESTILO: Livro para colorir em preto e branco (preto e branco, contornos fortes, fundo branco, sem cores apenas preto e branco)."
    : "ESTILO: Ilustração semi-realista de livro infantil, colorida, luz suave.";

  return `${identityRules}

${sceneRules}

${styleRule}

IMPORTANTE: Não escreva textos ou legendas na imagem.`;
}

function buildCoverPrompt({ themeKey, childName, childAge, childGender, styleKey }) {
  const th = themeDesc(themeKey);
  const name = String(childName || "").trim();
  const age = clamp(childAge ?? 6, 2, 12);
  const genderRaw = String(childGender || "neutral");
  const g = genderLabel(genderRaw);
  const style = String(styleKey || "read").trim();

  const identityRules = `INSTRUÇÕES CRÍTICAS - IDENTIDADE DA CRIANÇA:
- A criança na foto de referência é ${name ? `${name}, ` : ""}um(a) ${g} de ${age} anos.
- Use EXATAMENTE o ROSTO dessa criança. Não invente outra criança.
- Mantenha os mesmos traços faciais, cor de pele, cabelo e olhos.
- Você PODE mudar a roupa, o corpo e o cenário para uma pose de capa (ex: olhando para o horizonte, segurando um objeto do tema).
- A pose deve ser adequada para a capa de um livro infantil.
- NÃO copie a pose ou a roupa da foto de referência.
- É obrigatório que a criança pareça ter ${age} anos e seja reconhecível como a mesma pessoa da foto.`;

  const coverRules = `CAPA DE LIVRO INFANTIL:
- Tema: ${th}
- Composição: criança em destaque central + elementos do tema ao redor.
- Visual mágico, alegre e positivo.`;

  const styleRule = style === "color"
    ? "ESTILO: Capa em preto e branco (coloring book), contornos fortes, fundo branco."
    : "ESTILO: Ilustração semi-realista, colorida, luz suave.";

  return `${identityRules}

${coverRules}

${styleRule}

IMPORTANTE: Não escreva textos ou legendas na imagem (o sistema adicionará o título depois).`;
}

// ------------------------------
// Fontes e texto nas imagens
// ------------------------------
let _opentype = null;
let _fontRegular = null;
let _fontBold = null;

function wrapLines(text, maxCharsPerLine) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const lines = [];
  let cur = "";

  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
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

async function loadFontsOnce() {
  if (_fontRegular && _fontBold) return { regular: _fontRegular, bold: _fontBold };

  if (!_opentype) {
    try {
      _opentype = require("opentype.js");
    } catch {
      throw new Error("Falta dependência opentype.js. Rode: npm i opentype.js");
    }
  }

  const candidates = [
    path.join(__dirname, "fonts"),
    path.join(__dirname, "fonts", "fonts"),
    path.join(process.cwd(), "fonts"),
    path.join(process.cwd(), "fonts", "fonts"),
  ];

  let regPath = "";
  let boldPath = "";

  for (const dir of candidates) {
    const rp = path.join(dir, "DejaVuSans.ttf");
    const bp = path.join(dir, "DejaVuSans-Bold.ttf");
    if (fs.existsSync(rp) && fs.existsSync(bp)) {
      regPath = rp;
      boldPath = bp;
      break;
    }
  }

  if (!regPath || !boldPath) {
    throw new Error(`Fonte não encontrada. Esperado: DejaVuSans.ttf e DejaVuSans-Bold.ttf em ${candidates.join(" ou ")}`);
  }

  _fontRegular = await new Promise((resolve, reject) => {
    _opentype.load(regPath, (err, font) => (err ? reject(err) : resolve(font)));
  });

  _fontBold = await new Promise((resolve, reject) => {
    _opentype.load(boldPath, (err, font) => (err ? reject(err) : resolve(font)));
  });

  return { regular: _fontRegular, bold: _fontBold };
}

function makeTextPath({ font, text, x, yBaseline, fontSize, fill }) {
  const t = String(text || "");
  if (!t.trim()) return "";
  const p = font.getPath(t, x, yBaseline, fontSize);
  const d = p.toPathData(2);
  return `<path d="${d}" fill="${fill}"/>`;
}

async function stampStoryTextOnImage({ inputPath, outputPath, title, text }) {
  const img = sharp(inputPath);
  const meta = await img.metadata();

  const W = Math.max(1, meta.width || 1024);
  const H = Math.max(1, meta.height || 1024);

  const pad = Math.round(W * 0.04);
  const bandH = Math.round(H * 0.22);
  const rx = Math.round(Math.min(W, H) * 0.03);

  const bandX = pad;
  const bandY = pad;
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

  while (pack.usedH > usableH && guard < 80) {
    guard++;
    if (textSize > TEXT_MIN) textSize -= 1;
    else if (titleSize > TITLE_MIN) titleSize -= 1;
    else break;
    pack = buildLines(titleSize, textSize);
  }

  const { bold } = await loadFontsOnce();

  let yTop = bandY + topPadY;
  const fill = "#0f172a";
  let paths = "";

  if (pack.titleLines.length) {
    for (let i = 0; i < pack.titleLines.length; i++) {
      const yLineTop = yTop + i * pack.lineGapTitle;
      const yBaseline = yLineTop + titleSize;
      paths += makeTextPath({
        font: bold,
        text: pack.titleLines[i],
        x: textX,
        yBaseline,
        fontSize: titleSize,
        fill,
      }) + "\n";
    }
    yTop += pack.titleLines.length * pack.lineGapTitle + pack.spacer;
  }

  if (pack.bodyLines.length) {
    for (let i = 0; i < pack.bodyLines.length; i++) {
      const yLineTop = yTop + i * pack.lineGapBody;
      const yBaseline = yLineTop + textSize;
      paths += makeTextPath({
        font: bold,
        text: pack.bodyLines[i],
        x: textX,
        yBaseline,
        fontSize: textSize,
        fill,
      }) + "\n";
    }
  }

  const shadowDy = Math.round(H * 0.01);
  const shadowOpacity = 0.18;

  const svg =
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="${bandX}" y="${bandY + shadowDy}" width="${bandW}" height="${bandH}" rx="${rx}" ry="${rx}" fill="#000000" fill-opacity="${shadowOpacity}"/>` +
    `<rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}" rx="${rx}" ry="${rx}" fill="#FFFFFF" fill-opacity="0.90"/>` +
    `${paths}</svg>`;

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
  const titleLines = wrapLines(String(title || ""), Math.max(18, Math.min(34, Math.round(maxChars * 0.85)))).slice(0, 2);
  const subLines = wrapLines(String(subtitle || ""), maxChars).slice(0, 2);

  const bandX = pad;
  const bandY = pad;
  const bandW = W - pad * 2;

  const textX = bandX + Math.round(bandW * 0.06);
  const topPadY = Math.round(bandH * 0.22);

  let yTop = bandY + topPadY;

  const lineGapTitle = Math.round(titleSize * 1.15);
  const lineGapSub = Math.round(subSize * 1.25);

  const { bold } = await loadFontsOnce();
  const fill = "#0f172a";

  let paths = "";

  for (let i = 0; i < titleLines.length; i++) {
    const yLineTop = yTop + i * lineGapTitle;
    const yBaseline = yLineTop + titleSize;
    paths += makeTextPath({
      font: bold,
      text: titleLines[i],
      x: textX,
      yBaseline,
      fontSize: titleSize,
      fill,
    }) + "\n";
  }

  if (titleLines.length) yTop += titleLines.length * lineGapTitle + Math.round(subSize * 0.35);

  for (let i = 0; i < subLines.length; i++) {
    const yLineTop = yTop + i * lineGapSub;
    const yBaseline = yLineTop + subSize;
    paths += makeTextPath({
      font: bold,
      text: subLines[i],
      x: textX,
      yBaseline,
      fontSize: subSize,
      fill,
    }) + "\n";
  }

  const shadowDy = Math.round(H * 0.01);
  const shadowOpacity = 0.18;

  const svg =
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="${bandX}" y="${bandY + shadowDy}" width="${bandW}" height="${bandH}" rx="${rx}" ry="${rx}" fill="#000000" fill-opacity="${shadowOpacity}"/>` +
    `<rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}" rx="${rx}" ry="${rx}" fill="#FFFFFF" fill-opacity="0.88"/>` +
    `${paths}</svg>`;

  await sharp(inputPath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);

  return outputPath;
}

// ------------------------------
// PDF
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
  for (const p of pageImagePaths || []) {
    if (p && existsSyncSafe(p)) all.push(p);
  }

  for (let i = 0; i < all.length; i++) {
    doc.rect(0, 0, A4_W, A4_H).fill("#FFFFFF");
    try {
      doc.image(all[i], 0, 0, { fit: [A4_W, A4_H], align: "center", valign: "center" });
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
// Manifest (book.json)
// ------------------------------
function bookDirOf(userId, bookId) {
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
  let m = await loadManifest(viewerUserId, bookId);
  if (m) return m;
  if (!isAdminUser(viewerUser)) return null;

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

  return null;
}

async function saveManifest(userId, bookId, manifest) {
  const p = manifestPathOf(userId, bookId);
  await writeJson(p, manifest);

  if (sbEnabled()) {
    const buf = Buffer.from(JSON.stringify(manifest, null, 2), "utf-8");
    const key = sbKeyForOwner(manifest, bookId, "book.json") || sbKeyFor(userId, bookId, "book.json");
    const result = await sbUploadBuffer(key, buf, "application/json");

    if (result.ok) {
      console.log(`[saveManifest] Manifesto enviado com sucesso para ${key}`);
    } else {
      console.error(`[saveManifest] Falha ao enviar manifesto para ${key}: ${result.reason}`);
    }
  }

  const syncResult = await syncBookRowToSupabase(manifest);
if (!syncResult.ok) {
  console.error("[saveManifest] Falha ao sincronizar livro na tabela books:", syncResult.error);
}
  console.log("SALVANDO LIVRO NO SUPABASE:", manifest.id);
}

function makeEmptyManifest(id, ownerId) {
  return {
    id,
    ownerId: String(ownerId || ""),
    createdAt: nowISO(),
    status: "created",
    step: "created",
    error: "",
    theme: "",
    style: "read",
    child: { name: "", age: 6, gender: "neutral" },
    order: { city: "", createdAt: nowISO() },
    partner: { id: "", name: "", city: "", type: "manufacturing", assignedAt: "", rule: "" },
    photo: { ok: false, file: "", mime: "", editBase: "", storageKey: "", editBaseKey: "" },
    mask: { ok: false, file: "", editBase: "", storageKey: "", editBaseKey: "" },
    pages: [],
    images: [],
    cover: { ok: false, file: "", url: "", storageKey: "" },
    pdf: "",
    pdfKey: "",
    retry: { count: 0, lastAt: "", nextTryAt: 0 },
    updatedAt: nowISO(),
  };
}

// ------------------------------
// Parceiros
// ------------------------------
function loadPartnersList() {
  const raw = String(process.env.PARTNERS_JSON || "").trim();
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch {}
  }

  return [
    { id: "p1", name: "Parceiro 01", city: "Aquidauana", type: "manufacturing" },
    { id: "p2", name: "Parceiro 02", city: "Anastácio", type: "manufacturing" },
  ];
}

const PARTNERS = loadPartnersList();
const PARTNER_API_TOKEN = String(process.env.PARTNER_API_TOKEN || "").trim();

function normCity(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function chooseManufacturingPartnerByCity(city) {
  const list = Array.isArray(PARTNERS)
    ? PARTNERS.filter((p) => String(p?.type || "manufacturing") === "manufacturing")
    : [];

  if (!list.length) return null;

  const target = normCity(city);
  if (target) {
    const same = list.find((p) => normCity(p.city) === target);
    if (same) return same;
  }

  return list[0];
}

function ensureOrderFields(m) {
  if (!m.order) m.order = { city: "", createdAt: "" };
  if (typeof m.order.city !== "string") m.order.city = "";
  if (typeof m.order.createdAt !== "string") m.order.createdAt = "";
  return m;
}

function ensurePartnerFields(m) {
  if (!m.partner) {
    m.partner = { id: "", name: "", city: "", type: "manufacturing", assignedAt: "", rule: "" };
  }
  return m;
}

function assignPartnerIfMissing(m) {
  m = ensureOrderFields(m);
  m = ensurePartnerFields(m);

  if (m.partner?.id) return m;

  const p = chooseManufacturingPartnerByCity(m.order?.city || "");
  if (!p) return m;

  const matched = normCity(p.city) && normCity(p.city) === normCity(m.order?.city || "");
  m.partner = {
    id: String(p.id || ""),
    name: String(p.name || ""),
    city: String(p.city || ""),
    type: String(p.type || "manufacturing"),
    assignedAt: nowISO(),
    rule: matched ? "city_match" : "fallback_first",
  };

  return m;
}

function requirePartnerToken(req, res) {
  if (!PARTNER_API_TOKEN) return true;

  const header = String(req.headers.authorization || "");
  const q = String(req.query?.token || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : q.trim();

  if (!token || token !== PARTNER_API_TOKEN) {
    res.status(401).json({ ok: false, error: "invalid_partner_token" });
    return false;
  }

  return true;
}

// ------------------------------
// Lock em memória
// ------------------------------
const locks = new Map();

function lockKey(userId, bookId) {
  return `${userId}:${bookId}`;
}

function isLocked(userId, bookId) {
  return !!locks.get(lockKey(userId, bookId))?.running;
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
// Engine: ensureBasesOrThrow e retry
// ------------------------------
async function ensureBasesOrThrow(userId, id, m) {
  const bookDir = bookDirOf(userId, id);
  await ensureDir(bookDir);

  const editBaseName = String(m.photo?.editBase || "edit_base.png");
  const maskBaseName = String(m.mask?.editBase || "mask_base.png");

  const imagePngPath = path.join(bookDir, editBaseName);
  const maskPngPath = path.join(bookDir, maskBaseName);

  await ensureFileFromStorageIfMissing(imagePngPath, String(m.photo?.editBaseKey || ""));
  await ensureFileFromStorageIfMissing(maskPngPath, String(m.mask?.editBaseKey || ""));

  if (!existsSyncSafe(imagePngPath) || !existsSyncSafe(maskPngPath)) {
    const photoPngName = "photo.png";
    const maskPngName = "mask.png";
    const photoPngPath = path.join(bookDir, photoPngName);
    const maskFullPath = path.join(bookDir, maskPngName);

    if (!existsSyncSafe(photoPngPath)) {
      const k1 = sbKeyForOwner(m, id, photoPngName) || sbKeyFor(userId, id, photoPngName);
      await ensureFileFromStorageIfMissing(photoPngPath, k1);

      if (!existsSyncSafe(photoPngPath) && m.photo?.file) {
        const origName = String(m.photo.file);
        const origPath = path.join(bookDir, origName);
        const kOrig = String(m.photo.storageKey || sbKeyForOwner(m, id, origName) || sbKeyFor(userId, id, origName));
        await ensureFileFromStorageIfMissing(origPath, kOrig);
        if (existsSyncSafe(origPath)) {
          await sharp(origPath).png().toFile(photoPngPath);
        }
      }
    }

    if (!existsSyncSafe(maskFullPath)) {
      const k2 = sbKeyForOwner(m, id, maskPngName) || sbKeyFor(userId, id, maskPngName);
      await ensureFileFromStorageIfMissing(maskFullPath, k2);
    }

    if (!existsSyncSafe(maskFullPath) && existsSyncSafe(photoPngPath)) {
      const meta = await sharp(photoPngPath).metadata();
      const ww = meta?.width || 1024;
      const hh = meta?.height || 1024;

      const transparent = await sharp({
        create: {
          width: ww,
          height: hh,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      }).png().toBuffer();

      await fsp.writeFile(maskFullPath, transparent);
    }

    if (existsSyncSafe(photoPngPath) && existsSyncSafe(maskFullPath)) {
      const meta = await sharp(photoPngPath).metadata();
      const w0 = meta?.width || 0;
      const h0 = meta?.height || 0;

      if (w0 && h0) {
        const scale = Math.min(1, EDIT_MAX_SIDE / Math.max(w0, h0));
        const w = Math.max(1, Math.round(w0 * scale));
        const h = Math.max(1, Math.round(h0 * scale));

        await sharp(photoPngPath)
          .resize({ width: w, height: h, fit: "fill", withoutEnlargement: true })
          .png()
          .toFile(imagePngPath);

        await sharp(maskFullPath)
          .resize({ width: w, height: h, fit: "fill", withoutEnlargement: true })
          .ensureAlpha()
          .png()
          .toFile(maskPngPath);

        const mi = await sharp(imagePngPath).metadata();
        const mm = await sharp(maskPngPath).metadata();

        if ((mi?.width || 0) !== (mm?.width || 0) || (mi?.height || 0) !== (mm?.height || 0)) {
          throw new Error(`Falha ao reconstruir base: image=${mi?.width}x${mi?.height}, mask=${mm?.width}x${mm?.height}`);
        }
      }
    }
  }

  if (!existsSyncSafe(imagePngPath)) throw new Error("edit_base.png não encontrada. Reenvie a foto.");
  if (!existsSyncSafe(maskPngPath)) throw new Error("mask_base.png não encontrada. Reenvie a foto.");

  return { bookDir, imagePngPath, maskPngPath };
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

const mercadopagoPixApi = require("./api/mercadopago/pix");
const mercadopagoStatusApi = require("./api/mercadopago/status");
const mercadopagoWebhookApi = require("./api/webhooks/mercadopago");
const checkoutApi = require("./api/checkout");
const coinOrderPixApi = require("./api/coin-order-pix");
const coinOrderStatusApi = require("./api/coin-order-status");
// ------------------------------
// API Router
// ------------------------------
const apiRouter = express.Router();
apiRouter.use(express.json({ limit: JSON_LIMIT }));

// ✅ IMPORTANTE: sem isso, req.cookies fica undefined
apiRouter.use(cookieParser());
apiRouter.all("/mercadopago/pix", (req, res) => mercadopagoPixApi(req, res));
apiRouter.all("/mercadopago/status", (req, res) => mercadopagoStatusApi(req, res));
apiRouter.post("/webhooks/mercadopago", (req, res) => mercadopagoWebhookApi(req, res));
apiRouter.all("/checkout", (req, res) => checkoutApi(req, res));

// Middleware de parceiro ref (para todas as rotas, mas só usado em algumas)
apiRouter.use((req, res, next) => {
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

// Rotas de parceiros (API)
apiRouter.get("/partners", async (req, res) => {
  try {
    const list = (Array.isArray(PARTNERS) ? PARTNERS : []).map((p) => ({
      id: String(p.id || ""),
      name: String(p.name || ""),
      city: String(p.city || ""),
      type: String(p.type || "manufacturing"),
    }));

    return res.json({ ok: true, partners: list });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});
apiRouter.post("/coin-orders/:id/pix", requireApiAuth, (req, res) => {
  req.query.orderId = String(req.params?.id || "").trim();
  return coinOrderPixApi(req, res);
});

apiRouter.get("/coin-orders/:id/status", requireApiAuth, (req, res) => {
  req.query.orderId = String(req.params?.id || "").trim();
  return coinOrderStatusApi(req, res);
});

apiRouter.get("/partner/orders", async (req, res) => {
  try {
    if (!requirePartnerToken(req, res)) return;

    const partnerId = String(req.query?.partnerId || "").trim();
    if (!partnerId) return res.status(400).json({ ok: false, error: "partnerId_required" });

    await ensureDir(BOOKS_DIR);
    const owners = await fsp.readdir(BOOKS_DIR).catch(() => []);

    const out = [];
    for (const ownerId of owners) {
      const ownerDir = path.join(BOOKS_DIR, String(ownerId));
      const st = await fsp.stat(ownerDir).catch(() => null);
      if (!st || !st.isDirectory()) continue;

      const bookIds = await fsp.readdir(ownerDir).catch(() => []);
      for (const bookId of bookIds) {
        const p = manifestPathOf(ownerId, bookId);
        const m = await readJsonSafe(p, null);
        if (!m) continue;
        if (String(m.status) !== "done") continue;

        ensureOrderFields(m);
        ensurePartnerFields(m);

        if (String(m.partner?.id || "") !== partnerId) continue;

        out.push({
          id: String(m.id || bookId),
          ownerId: String(m.ownerId || ownerId),
          city: String(m.order?.city || ""),
          partner: m.partner,
          child: m.child || {},
          theme: String(m.theme || ""),
          style: String(m.style || "read"),
          pdf: String(m.pdf || ""),
          coverUrl: m.cover?.ok && m.cover?.url ? m.cover.url : "",
          updatedAt: String(m.updatedAt || ""),
          createdAt: String(m.createdAt || ""),
        });
      }
    }

    out.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return res.json({ ok: true, orders: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

apiRouter.get("/admin/partner-orders", requireAuth, async (req, res) => {
  try {
    if (!isAdminUser(req.user)) return res.status(403).json({ ok: false, error: "admin_only" });

    await ensureDir(BOOKS_DIR);
    const owners = await fsp.readdir(BOOKS_DIR).catch(() => []);

    const out = [];
    for (const ownerId of owners) {
      const ownerDir = path.join(BOOKS_DIR, String(ownerId));
      const st = await fsp.stat(ownerDir).catch(() => null);
      if (!st || !st.isDirectory()) continue;

      const bookIds = await fsp.readdir(ownerDir).catch(() => []);
      for (const bookId of bookIds) {
        const p = manifestPathOf(ownerId, bookId);
        const m = await readJsonSafe(p, null);
        if (!m) continue;

        ensureOrderFields(m);
        ensurePartnerFields(m);

        if (String(m.status) === "done" && !m.partner?.id) {
          const mm = assignPartnerIfMissing(m);
          mm.updatedAt = nowISO();
          await saveManifest(String(mm.ownerId || ownerId), String(mm.id || bookId), mm).catch(() => {});
          out.push({
            id: String(mm.id || bookId),
            ownerId: String(mm.ownerId || ownerId),
            status: String(mm.status || ""),
            city: String(mm.order?.city || ""),
            partner: mm.partner,
            child: mm.child || {},
            theme: String(mm.theme || ""),
            style: String(mm.style || "read"),
            pdf: String(mm.pdf || ""),
            coverUrl: mm.cover?.ok && mm.cover?.url ? mm.cover.url : "",
            updatedAt: String(mm.updatedAt || ""),
            createdAt: String(mm.createdAt || ""),
          });
          continue;
        }

        out.push({
          id: String(m.id || bookId),
          ownerId: String(m.ownerId || ownerId),
          status: String(m.status || ""),
          city: String(m.order?.city || ""),
          partner: m.partner,
          child: m.child || {},
          theme: String(m.theme || ""),
          style: String(m.style || "read"),
          pdf: String(m.pdf || ""),
          coverUrl: m.cover?.ok && m.cover?.url ? m.cover.url : "",
          updatedAt: String(m.updatedAt || ""),
          createdAt: String(m.createdAt || ""),
        });
      }
    }

    out.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return res.json({ ok: true, orders: out, partners: PARTNERS });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});


apiRouter.get("/partner/sales", async (req, res) => {
  if (!requirePartnerToken(req, res)) return;
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase não configurado" });

  const partnerId = String(req.query?.partnerId || "").trim();
  if (!partnerId) return res.status(400).json({ error: "partnerId required" });

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar pedidos" });
  }

  res.json({ ok: true, orders: data });
});

// Auth
apiRouter.post("/auth/signup", async (req, res) => {
  try {
    if (!supabaseAuth) {
      return res.status(500).json({
        ok: false,
        error: "Supabase Auth não configurado (SUPABASE_ANON_KEY).",
      });
    }

    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name || name.length < 2) return res.status(400).json({ ok: false, error: "Nome inválido." });
    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "E-mail inválido." });
    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, error: "Senha deve ter no mínimo 6 caracteres." });
    }

    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) return res.status(400).json({ ok: false, error: String(error.message || error) });

    if (data?.session?.access_token && data?.session?.refresh_token) {
      setAuthCookies(res, data.session.access_token, data.session.refresh_token);
      return res.json({ ok: true });
    }

    return res.json({ ok: true, needs_email_confirmation: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

apiRouter.post("/auth/login", async (req, res) => {
  try {
    if (!supabaseAuth) {
      return res.status(500).json({
        ok: false,
        error: "Supabase Auth não configurado (SUPABASE_ANON_KEY).",
      });
    }

    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "E-mail inválido." });
    if (!password) return res.status(400).json({ ok: false, error: "Senha obrigatória." });

    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ ok: false, error: "E-mail ou senha incorretos." });

    if (!data?.session?.access_token || !data?.session?.refresh_token) {
      return res.status(401).json({
        ok: false,
        error: "Sem sessão. Verifique confirmação de e-mail no Supabase.",
      });
    }

    setAuthCookies(res, data.session.access_token, data.session.refresh_token);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

apiRouter.post("/auth/logout", async (req, res) => {
  try {
    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

// Criação de livro
apiRouter.post("/create", async (req, res) => {
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

// Upload de foto
apiRouter.post("/uploadPhoto", async (req, res) => {
  try {
    const userId = await requireAuthUserId(req, res);
    if (!userId) return;

    const id = String(req.body?.id || "").trim();
    const photo = req.body?.photo;
    const mask = req.body?.mask;

    if (!id) return res.status(400).json({ ok: false, error: "id ausente" });
    if (!photo || !isDataUrl(photo)) {
      return res.status(400).json({ ok: false, error: "photo ausente ou inválida (dataURL)" });
    }

    const buf = dataUrlToBuffer(photo);
    let maskBuf = mask && isDataUrl(mask) ? dataUrlToBuffer(mask) : null;

    if (!buf || buf.length < 1000) return res.status(400).json({ ok: false, error: "photo inválida" });
    if (maskBuf && maskBuf.length < 50) maskBuf = null;

    const m = await loadManifest(userId, id);
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });

    const mime = guessMimeFromDataUrl(photo);
    const ext = guessExtFromMime(mime);

    const bookDir = bookDirOf(userId, id);
    await ensureDir(bookDir);

    const originalName = `photo.${ext}`;
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
      const meta = await sharp(photoPngPath).metadata();
      const ww = meta?.width || 1024;
      const hh = meta?.height || 1024;

      const transparent = await sharp({
        create: {
          width: ww,
          height: hh,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
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
    await sharp(photoPngPath)
      .resize({ width: w, height: h, fit: "fill", withoutEnlargement: true })
      .png()
      .toFile(editBasePath);

    const maskBaseName = "mask_base.png";
    const maskBasePath = path.join(bookDir, maskBaseName);
    await sharp(maskPngPath)
      .resize({ width: w, height: h, fit: "fill", withoutEnlargement: true })
      .ensureAlpha()
      .png()
      .toFile(maskBasePath);

    const mi = await sharp(editBasePath).metadata();
    const mm = await sharp(maskBasePath).metadata();
    if ((mi?.width || 0) !== (mm?.width || 0) || (mi?.height || 0) !== (mm?.height || 0)) {
      throw new Error(`Falha ao alinhar base: image=${mi?.width}x${mi?.height}, mask=${mm?.width}x${mm?.height}`);
    }

    let photoKey = "";
    let editBaseKey = "";
    let maskKey = "";
    let maskBaseKey = "";

    if (sbEnabled()) {
      photoKey = sbKeyFor(userId, id, originalName);
      editBaseKey = sbKeyFor(userId, id, editBaseName);
      maskKey = sbKeyFor(userId, id, maskPngName);
      maskBaseKey = sbKeyFor(userId, id, maskBaseName);

      let result;
      result = await sbUploadBuffer(photoKey, buf, mime);
      if (!result.ok) console.error(`[uploadPhoto] Falha no upload de photo: ${result.reason}`);

      result = await sbUploadBuffer(editBaseKey, await fsp.readFile(editBasePath), "image/png");
      if (!result.ok) console.error(`[uploadPhoto] Falha no upload de editBase: ${result.reason}`);

      result = await sbUploadBuffer(maskKey, await fsp.readFile(maskPngPath), "image/png");
      if (!result.ok) console.error(`[uploadPhoto] Falha no upload de mask: ${result.reason}`);

      result = await sbUploadBuffer(maskBaseKey, await fsp.readFile(maskBasePath), "image/png");
      if (!result.ok) console.error(`[uploadPhoto] Falha no upload de maskBase: ${result.reason}`);
    }

    m.photo = {
      ok: true,
      file: originalName,
      mime,
      editBase: editBaseName,
      storageKey: photoKey,
      editBaseKey,
    };

    m.mask = {
      ok: true,
      file: maskPngName,
      editBase: maskBaseName,
      storageKey: maskKey,
      editBaseKey: maskBaseKey,
    };

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

// Status
apiRouter.get("/status/:id", requireApiAuth, async (req, res) => {
  try {
    const viewerId = String(req.user?.id || "");
    if (!viewerId) return res.status(401).json({ ok: false, error: "not_logged_in" });

    const id = String(req.params?.id || "").trim();
    const m = await loadManifestAsViewer(viewerId, id, req.user);

    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });
    if (!canAccessBook(viewerId, m, req.user)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const images = (m.images || []).map((it) => ({ page: it.page, url: it.url || "" }));
    const coverUrl = m.cover?.ok ? m.cover?.url || "" : "";

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

// Generate (inicia)
apiRouter.post("/generate", requireApiAuth, async (req, res) => {
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
    const city = String(req.body?.city || m.order?.city || "").trim();

    if (!childName || childName.length < 2) {
      return res.status(400).json({ ok: false, error: "childName inválido" });
    }
    if (!theme) return res.status(400).json({ ok: false, error: "theme inválido" });

    m.child = { name: childName, age: clamp(childAge, 2, 12), gender: childGender };
    m.theme = theme;
    m.style = style;

    m.order = m.order || { city: "", createdAt: "" };
    if (city) m.order.city = city;

    m.status = "generating";
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

// ---------------------------------------
// ✅ GenerateNext (passo) — CORRIGIDO
// ---------------------------------------
apiRouter.post("/generateNext", requireApiAuth, async (req, res) => {
  let userId = "";
  let id = "";

  try {
    userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

    id = String(req.body?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "id ausente" });

    let m = await loadManifest(userId, id);
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });

    if (!canAccessBook(userId, m, req.user)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
  if (m.status === "done" || m.step === "done") {
  return res.json({
    ok: true,
    step: "done",
    status: "done",
    finished: true
  });
}
    if (m.status === "failed" || m.step === "failed") return res.json({ ok: true, step: "failed" });

    m = ensureRetryFields(m);
    const waitMs = shouldCooldownWait(m);
    if (waitMs > 0) {
      return res.json({ ok: true, step: m.step || "waiting", nextTryAt: m.retry.nextTryAt });
    }

    if (!acquireLock(userId, id)) {
      return res.status(409).json({ ok: false, error: "step já em execução" });
    }

    // Recarrega após lock
    m = await loadManifest(userId, id);
    if (!m) throw new Error("Manifest sumiu");

    if (!m.status || m.status === "created") {
      m.status = "generating";
      m.step = "story";
      m.error = "";
      m.updatedAt = nowISO();
      await saveManifest(userId, id, m);
    }

    const { bookDir, imagePngPath, maskPngPath } = await ensureBasesOrThrow(userId, id, m);

    const styleKey = String(m.style || "read").trim();
    const childName = String(m.child?.name || "Criança").trim() || "Criança";
    const childAge = clamp(m.child?.age ?? 6, 2, 12);
    const childGender = String(m.child?.gender || "neutral");
    const theme = String(m.theme || "space");

    // Gerar um seed fixo para este livro
    const seed = parseInt(crypto.createHash("md5").update(id).digest("hex").slice(0, 8), 16);

    // STORY
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

    // COVER
    if (m.step === "cover") {
      const coverBaseName = "cover.png";
      const coverBasePath = path.join(bookDir, coverBaseName);

      const coverFinalName = "cover_final.png";
      const coverFinalPath = path.join(bookDir, coverFinalName);

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
        imagePngPath,
        maskPngPath,
        prompt: coverPrompt,
        size: "1024x1024",
        seed,
      });

      await fsp.writeFile(coverBasePath, coverBuf);

      await stampCoverTextOnImage({
        inputPath: coverBasePath,
        outputPath: coverFinalPath,
        title: "Meu Livro Mágico",
        subtitle: `A aventura de ${childName} • ${themeLabel(theme)}`,
      });

      try {
        await fsp.unlink(coverBasePath);
      } catch {}

      let coverKey = "";
      if (sbEnabled()) {
        coverKey = sbKeyFor(userId, id, coverFinalName);
        const uploadResult = await sbUploadBuffer(coverKey, await fsp.readFile(coverFinalPath), "image/png");
        if (!uploadResult.ok) {
          console.error(`[generateNext] Falha no upload da capa: ${uploadResult.reason}`);
          m.error = `Upload da capa falhou: ${uploadResult.reason}`;
        } else {
          console.log(`[generateNext] Capa enviada com sucesso: ${coverKey}`);
        }
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

    // IMAGES
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

      const baseName = `page_${String(p.page).padStart(2, "0")}.png`;
      const basePath = path.join(bookDir, baseName);

      const finalName = `page_${String(p.page).padStart(2, "0")}_final.png`;
      const finalPath = path.join(bookDir, finalName);

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
        imagePngPath,
        maskPngPath,
        prompt,
        size: "1024x1024",
        seed,
      });

      await fsp.writeFile(basePath, imgBuf);

      await stampStoryTextOnImage({
        inputPath: basePath,
        outputPath: finalPath,
        title: p.title,
        text: p.text,
      });

      try {
        await fsp.unlink(basePath);
      } catch {}

      let pageKey = "";
      if (sbEnabled()) {
        pageKey = sbKeyFor(userId, id, finalName);
        const uploadResult = await sbUploadBuffer(pageKey, await fsp.readFile(finalPath), "image/png");
        if (!uploadResult.ok) {
          console.error(`[generateNext] Falha no upload da página ${p.page}: ${uploadResult.reason}`);
          m.error = `Upload da página ${p.page} falhou: ${uploadResult.reason}`;
        } else {
          console.log(`[generateNext] Página ${p.page} enviada com sucesso: ${pageKey}`);
        }
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

    // PDF
    if (m.step === "pdf") {
      const pdfName = `book-${id}.pdf`;
      const pdfPath = path.join(bookDir, pdfName);

      if (existsSyncSafe(pdfPath)) {
        m.status = "done";
        m.step = "done";
        m.error = "";
        m.pdf = `/api/download/${encodeURIComponent(id)}`;
        m.updatedAt = nowISO();

        m = ensureOrderFields(m);
        m = assignPartnerIfMissing(m);

        await saveManifest(userId, id, m);
        return res.json({ ok: true, step: "done" });
      }

      const coverFinalName = "cover_final.png";
      const coverFinalPath = path.join(bookDir, coverFinalName);

      if (!existsSyncSafe(coverFinalPath) && sbEnabled()) {
        const key = m.cover?.storageKey || sbKeyForOwner(m, id, coverFinalName) || sbKeyFor(userId, id, coverFinalName);
        await ensureFileFromStorageIfMissing(coverFinalPath, key);
      }

      if (Array.isArray(m.images) && sbEnabled()) {
        for (const it of m.images) {
          const file = String(it?.file || "");
          const localPath = it?.path ? String(it.path) : path.join(bookDir, file);
          const key = String(it?.storageKey || "");
          if (file && localPath && !existsSyncSafe(localPath)) {
            const fallbackKey = key || sbKeyForOwner(m, id, file) || sbKeyFor(userId, id, file);
            await ensureFileFromStorageIfMissing(localPath, fallbackKey);
          }
        }
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
        const uploadResult = await sbUploadBuffer(pdfKey, await fsp.readFile(outPdfPath), "application/pdf");
        if (!uploadResult.ok) {
          console.error(`[generateNext] Falha no upload do PDF: ${uploadResult.reason}`);
          m.error = `Upload do PDF falhou: ${uploadResult.reason}`;
        } else {
          console.log(`[generateNext] PDF enviado com sucesso: ${pdfKey}`);
        }
      }

      m.status = "done";
      m.step = "done";
      m.error = "";
      m.pdf = `/api/download/${encodeURIComponent(id)}`;
      m.pdfKey = pdfKey;
      m.retry = { count: 0, lastAt: "", nextTryAt: 0 };
      m.updatedAt = nowISO();

      m = ensureOrderFields(m);
      m = assignPartnerIfMissing(m);

      await saveManifest(userId, id, m);
      return res.json({ ok: true, step: "done" });
    }

    // fallback
    m.step = "story";
    m.updatedAt = nowISO();
    await saveManifest(userId, id, m);
    return res.json({ ok: true, step: "reset_unknown_to_story" });
  } catch (e) {
    const msg = String(e?.message || e || "Erro");
    console.warn(`[generateNext] Erro no livro ${id}:`, msg);

    try {
      if (userId && id) {
        const m = await loadManifest(userId, id);
        if (m && m.status !== "done") {
          let cooldownMs = 6000;
          if (msg.includes("rate limit") || msg.includes("429") || msg.includes("Request was throttled")) {
            cooldownMs = 30000;
          }

          if (isTransientError(msg)) {
            setCooldown(m, cooldownMs, msg);
            m.updatedAt = nowISO();
            await saveManifest(userId, id, m);
            return res.status(200).json({
              ok: true,
              step: m.step || "retrying",
              nextTryAt: m.retry?.nextTryAt || 0,
              message: "Limitação de taxa. Tentaremos novamente em alguns segundos.",
            });
          }

          m.status = "failed";
          m.step = "failed";
          m.error = msg;
          m.updatedAt = nowISO();
          await saveManifest(userId, id, m);
        }
      }
    } catch (innerErr) {
      console.error("[generateNext] Erro ao tratar falha:", innerErr);
    }

    return res.status(500).json({ ok: false, error: msg });
  } finally {
    try {
      if (userId && id) releaseLock(userId, id);
    } catch {}
  }
});

// ---------------------------------------
// ✅ Regenerar imagem de uma página (NOVO)
// ---------------------------------------
apiRouter.post("/regeneratePage", requireApiAuth, async (req, res) => {
  let userId = "";
  let id = "";
  let page = 0;
  let textInput = "";

  try {
    userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

    id = String(req.body?.id || "").trim();
    page = Number(req.body?.page);
    textInput = String(req.body?.text || "").trim();

    if (!id || !Number.isFinite(page) || page < 1) {
      return res.status(400).json({ ok: false, error: "id ou page inválidos" });
    }

    let m = await loadManifest(userId, id);
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });
    if (!canAccessBook(userId, m, req.user)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    if (!acquireLock(userId, id)) {
      return res.status(409).json({ ok: false, error: "operação já em andamento" });
    }

    m = await loadManifest(userId, id);
    if (!m) throw new Error("Manifest sumiu");

    const pages = Array.isArray(m.pages) ? m.pages : [];
    const pageData = pages.find((p) => Number(p.page) === page);
    if (!pageData) {
      return res.status(404).json({ ok: false, error: "página não encontrada no manifesto" });
    }

    const pageText = textInput || String(pageData.text || "").trim();
    if (!pageText) {
      return res.status(400).json({ ok: false, error: "texto da página está vazio" });
    }

    const { imagePngPath, maskPngPath } = await ensureBasesOrThrow(userId, id, m);

    const styleKey = String(m.style || "read").trim();
    const childName = String(m.child?.name || "Criança").trim() || "Criança";
    const childAge = clamp(m.child?.age ?? 6, 2, 12);
    const childGender = String(m.child?.gender || "neutral");
    const theme = String(m.theme || "space");

    const prompt = buildScenePromptFromParagraph({
      paragraphText: pageText,
      themeKey: theme,
      childName,
      childAge,
      childGender,
      styleKey,
    });

    const imgBuf = await imageFromReference({
      imagePngPath,
      maskPngPath,
      prompt,
      size: "1024x1024",
      seed: null,
    });

    const bookDir = bookDirOf(userId, id);
    const pageNumberPadded = String(page).padStart(2, "0");
    const baseName = `page_${pageNumberPadded}.png`;
    const basePath = path.join(bookDir, baseName);
    const finalName = `page_${pageNumberPadded}_final.png`;
    const finalPath = path.join(bookDir, finalName);

    await fsp.writeFile(basePath, imgBuf);

    await stampStoryTextOnImage({
      inputPath: basePath,
      outputPath: finalPath,
      title: pageData.title || `Página ${page}`,
      text: pageText,
    });

    try {
      await fsp.unlink(basePath);
    } catch {}

    let storageKey = "";
    if (sbEnabled()) {
      storageKey = sbKeyFor(userId, id, finalName);
      const uploadResult = await sbUploadBuffer(storageKey, await fsp.readFile(finalPath), "image/png");
      if (!uploadResult.ok) {
        console.error(`[regeneratePage] Falha no upload da página ${page}: ${uploadResult.reason}`);
      }
    }

    const images = Array.isArray(m.images) ? m.images : [];
    const idx = images.findIndex((img) => Number(img.page) === page);
    const newUrl = `/api/image/${encodeURIComponent(id)}/${encodeURIComponent(finalName)}`;

    if (idx >= 0) {
      images[idx].url = newUrl;
      images[idx].storageKey = storageKey;
      images[idx].path = finalPath;
      images[idx].file = finalName;
    } else {
      images.push({
        page,
        path: finalPath,
        file: finalName,
        prompt,
        url: newUrl,
        storageKey,
      });
    }

    m.images = images;
    m.retry = { count: 0, lastAt: "", nextTryAt: 0 };
    m.updatedAt = nowISO();

    await saveManifest(userId, id, m);

    const bustedUrl = `${newUrl}?v=${Date.now()}`;
    return res.json({ ok: true, url: bustedUrl, rev: Date.now() });
  } catch (e) {
    const msg = String(e?.message || e || "Erro");
    console.error(`[regeneratePage] Erro: ${msg}`);

    if (userId && id) {
      try {
        const m = await loadManifest(userId, id);
        if (m && isTransientError(msg)) {
          setCooldown(m, 6000, msg);
          m.updatedAt = nowISO();
          await saveManifest(userId, id, m);
          return res.status(200).json({
            ok: true,
            wait: true,
            nextTryAt: m.retry?.nextTryAt || 0,
            message: "Limitação de taxa. Tentaremos novamente em alguns segundos.",
          });
        }
      } catch {}
    }

    return res.status(500).json({ ok: false, error: msg });
  } finally {
    try {
      if (userId && id) releaseLock(userId, id);
    } catch {}
  }
});

// ---------------------------------------
// ✅ Editar texto de uma página
// ---------------------------------------
apiRouter.post("/editPageText", requireApiAuth, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

    const id = String(req.body?.id || "").trim();
    const page = Number(req.body?.page);
    const text = String(req.body?.text || "").trim();

    if (!id || !Number.isFinite(page) || page < 1) {
      return res.status(400).json({ ok: false, error: "id ou page inválidos" });
    }

    const m = await loadManifest(userId, id);
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });
    if (!canAccessBook(userId, m, req.user)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    if (!m.overrides) m.overrides = {};
    if (!m.overrides.pagesText) m.overrides.pagesText = {};

    m.overrides.pagesText[String(page)] = text;
    m.updatedAt = nowISO();

    await saveManifest(userId, id, m);

    const images = Array.isArray(m.images) ? m.images : [];
    const img = images.find((im) => Number(im.page) === page);
    const url = img?.url ? String(img.url) : "";

    return res.json({ ok: true, url, rev: Date.now() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

// Servir imagens
apiRouter.get("/image/:id/:file", requireApiAuth, async (req, res) => {
  try {
    const viewerId = String(req.user?.id || "");
    if (!viewerId) return res.status(401).send("not_logged_in");

    const id = String(req.params?.id || "").trim();
    const file = String(req.params?.file || "").trim();

    if (!id || !file) return res.status(400).send("bad request");
    if (
      id.includes("..") ||
      id.includes("/") ||
      id.includes("\\") ||
      file.includes("..") ||
      file.includes("/") ||
      file.includes("\\")
    ) {
      return res.status(400).send("bad request");
    }

    const m = await loadManifestAsViewer(viewerId, id, req.user);
    if (!m) return res.status(404).send("not found");
    if (!canAccessBook(viewerId, m, req.user)) return res.status(403).send("forbidden");

    const ownerId = String(m.ownerId || viewerId);
    const fp = path.join(bookDirOf(ownerId, id), file);

    if (!existsSyncSafe(fp) && sbEnabled()) {
      const key = sbKeyForOwner(m, id, file) || sbKeyFor(ownerId, id, file);
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

// Download PDF (no /api)
apiRouter.get("/download/:id", requireApiAuth, async (req, res) => {
  try {
    const viewerId = String(req.user?.id || "");
    if (!viewerId) return res.status(401).send("not_logged_in");

    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).send("id ausente");

    const m = await loadManifestAsViewer(viewerId, id, req.user);
    if (!m) return res.status(404).send("book não existe");
    if (!canAccessBook(viewerId, m, req.user)) return res.status(403).send("forbidden");
    if (m.status !== "done") return res.status(409).send("PDF ainda não está pronto");

    const ownerId = String(m.ownerId || viewerId);
    const pdfName = `book-${id}.pdf`;
    const pdfPath = path.join(bookDirOf(ownerId, id), pdfName);

    if (!existsSyncSafe(pdfPath) && sbEnabled()) {
      const key = m.pdfKey || sbKeyForOwner(m, id, pdfName) || sbKeyFor(ownerId, id, pdfName);
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
// Exportações
// ------------------------------
module.exports = {
  apiRouter,

  // Funções e constantes necessárias para as páginas
  requireAuth,
  requireApiAuth,
  getCurrentUser,
  getCurrentUserId,
  isAdminUser,
  canAccessBook,
  loadManifestAsViewer,
  escapeHtml,

  IMAGE_PROVIDER,
  REPLICATE_MODEL,
  IMAGE_MODEL,

  themeLabel,
  ensureDir,
  BOOKS_DIR,

  // Outras que possam ser úteis
  supabaseAdmin,
  supabaseAuth,

  setAuthCookies,
  clearAuthCookies,
  parseCookies,
  normalizeEmail,

  // Para os submódulos de parceiros
  requirePartnerToken,
  PARTNERS,
  PARTNER_API_TOKEN,

  // Para o módulo admin / gerais
  OUT_DIR,
  USERS_DIR,
  USERS_FILE,
  JSON_LIMIT,
};