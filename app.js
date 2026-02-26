/**
 * app.js — MONOCÓDIGO (UI + API + OpenAI + PDF)
 * ✅ SUPABASE AUTH + RLS + VERCEL-SAFE (usa /tmp + Storage)
 * ✅ Geração SEQUENCIAL (1 passo por vez via /api/generateNext)
 * ✅ Texto carimbado dentro do PNG + PDF final
 *
 * CORREÇÕES APLICADAS:
 * 1) ✅ BUG CRÍTICO: /api/generateNext usava imagePngPath sem definir -> agora define corretamente.
 * 2) ✅ VERCEL-SAFE: se edit_base.png / mask_base.png não existirem no disco, baixa do Supabase Storage usando storageKey do manifest.
 * 3) ✅ Remove duplicação acidental de sbUploadBuffer/sbPublicUrl no final do arquivo.
 * 4) ✅ /api/image: se arquivo não existir no disco, tenta buscar no Storage (quando possível).
 * 5) ✅ Pequenas correções de robustez e organização (sem mudar seu fluxo).
 */
"use strict";

let BOOT_ERROR = "";

function bootFail(where, e) {
  const msg = `[BOOT] ${where}: ${String(e?.message || e)}\n${String(e?.stack || "")}`;
  console.error(msg);
  BOOT_ERROR = msg.slice(0, 4000);
}

let fs, fsp, path, crypto, express, PDFDocument, sharp, createClient, os;

try { fs = require("fs"); } catch (e) { bootFail("require fs", e); }
try { fsp = require("fs/promises"); } catch (e) { bootFail("require fs/promises", e); }
try { path = require("path"); } catch (e) { bootFail("require path", e); }
try { crypto = require("crypto"); } catch (e) { bootFail("require crypto", e); }
try { os = require("os"); } catch (e) { bootFail("require os", e); }

try { express = require("express"); } catch (e) { bootFail("require express", e); }
try { PDFDocument = require("pdfkit"); } catch (e) { bootFail("require pdfkit", e); }
try { sharp = require("sharp"); } catch (e) { bootFail("require sharp", e); }

try {
  ({ createClient } = require("@supabase/supabase-js"));
} catch (e) {
  bootFail("require @supabase/supabase-js", e);
}

// evita crash “mudo”:
process.on("uncaughtException", (e) => bootFail("uncaughtException", e));
process.on("unhandledRejection", (e) => bootFail("unhandledRejection", e));


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

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const TEXT_MODEL = String(process.env.TEXT_MODEL || "gpt-4.1-mini").trim() || "gpt-4.1-mini";
const IMAGE_MODEL = String(process.env.IMAGE_MODEL || "dall-e-2").trim() || "dall-e-2";

const REPLICATE_API_TOKEN = String(process.env.REPLICATE_API_TOKEN || "").trim();
const REPLICATE_MODEL = String(process.env.REPLICATE_MODEL || "google/nano-banana-pro").trim();
const REPLICATE_VERSION = String(process.env.REPLICATE_VERSION || "").trim(); // opcional
const REPLICATE_RESOLUTION = String(process.env.REPLICATE_RESOLUTION || "2K").trim();
const REPLICATE_ASPECT_RATIO = String(process.env.REPLICATE_ASPECT_RATIO || "1:1").trim();
const REPLICATE_OUTPUT_FORMAT = String(process.env.REPLICATE_OUTPUT_FORMAT || "png").trim();
const REPLICATE_SAFETY = String(process.env.REPLICATE_SAFETY || "block_only_high").trim();
const REPLICATE_IMAGE_FIELD = String(process.env.REPLICATE_IMAGE_FIELD || "image").trim();
const REPLICATE_IMAGE_IS_ARRAY = String(process.env.REPLICATE_IMAGE_IS_ARRAY || "0").trim() === "1";
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
const USERS_DIR = path.join(OUT_DIR, "users");
const BOOKS_DIR = path.join(OUT_DIR, "books");

const JSON_LIMIT = "25mb";
const EDIT_MAX_SIDE = 1024;

const IMAGE_PROVIDER = REPLICATE_API_TOKEN ? "replicate" : "openai";

const LANDING_HTML = path.join(__dirname, "landing.html");
const HOW_IT_WORKS_HTML = path.join(__dirname, "how-it-works.html");
const EXEMPLOS_HTML = path.join(__dirname, "exemplos.html");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const cleanKey = (v) => String(v || "").replace(/[\r\n\t ]+/g, "").trim();

const SUPABASE_ANON_KEY = cleanKey(process.env.SUPABASE_ANON_KEY);
const SUPABASE_SERVICE_ROLE_KEY = cleanKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
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
console.log("DEBUG SUPABASE_URL ok:", !!SUPABASE_URL);
console.log("DEBUG ANON startsWith eyJ:", (SUPABASE_ANON_KEY || "").trim().startsWith("eyJ"));
console.log("DEBUG SERVICE startsWith eyJ:", (SUPABASE_SERVICE_ROLE_KEY || "").trim().startsWith("eyJ"));
console.log("DEBUG SERVICE len:", (SUPABASE_SERVICE_ROLE_KEY || "").trim().length);
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
  if (!prev) {
    res.setHeader("Set-Cookie", cookieStr);
    return;
  }
  if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, cookieStr]);
    return;
  }
  res.setHeader("Set-Cookie", [prev, cookieStr]);
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
function isHighDemandError(msg) {
  const s = String(msg || "");
  return (
    /\bE003\b/i.test(s) ||
    /high demand/i.test(s) ||
    /currently unavailable/i.test(s) ||
    /temporarily unavailable/i.test(s) ||
    /try again later/i.test(s) ||
    /\bunavailable\b/i.test(s)
  );
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
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
// ✅ Guarda a última chamada de rede (para diagnosticar "fetch failed" na Vercel)
const NET_LAST = {
  at: "",
  url: "",
  stage: "",
  note: "",
  error: "",
};
// --- Replicate pending watchdog (evita ficar preso no "processing" pra sempre) ---
const PENDING_MAX_AGE_MS = Number(process.env.PENDING_MAX_AGE_MS || (8 * 60 * 1000)); // 8 min
function pendingAgeMs(pending) {
  const t = Date.parse(String(pending?.createdAt || ""));
  if (!Number.isFinite(t)) return 0;
  return Date.now() - t;
}
function isPendingTooOld(pending) {
  return pendingAgeMs(pending) > PENDING_MAX_AGE_MS;
}
function netMark(stage, url, note = "") {
  NET_LAST.at = new Date().toISOString();
  NET_LAST.stage = String(stage || "");
  NET_LAST.url = String(url || "");
  NET_LAST.note = String(note || "");
  NET_LAST.error = "";
}

function netFail(stage, url, err) {
  NET_LAST.at = new Date().toISOString();
  NET_LAST.stage = String(stage || "");
  NET_LAST.url = String(url || "");
  NET_LAST.error = String(err?.message || err || "");
}

function formatErrFull(e) {
  const msg = String(e?.message || e || "");
  const stack = String(e?.stack || "");
  // deixa curto para caber no manifest, mas com contexto
  const base = msg || stack || "Erro";
  return base.slice(0, 1800);
}
async function fetchJson(url, { method = "GET", headers = {}, body = null, timeoutMs = 55000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  netMark(`fetchJson:${method}`, url);

  try {
    const r = await fetch(url, { method, headers, body, signal: ctrl.signal });

    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    if (!r.ok) {
      const msg = json?.detail || json?.error || text;
      const err = new Error(`HTTP ${r.status} @ ${url}: ${String(msg).slice(0, 2000)}`);
      netFail(`fetchJson:${method}`, url, err);
      throw err;
    }

    return json ?? {};
  } catch (e) {
    const msg = String(e?.message || e);
    const err = new Error(`fetch failed @ ${url} (${method}) :: ${msg}`);
    netFail(`fetchJson:${method}`, url, err);
    throw err;
  } finally {
    clearTimeout(t);
  }
}
async function downloadToBuffer(url, timeoutMs = 240000) {
  netMark("downloadToBuffer", url);

  const tries = 5; // era 3
  let lastErr = null;

  for (let attempt = 1; attempt <= tries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "MeuLivroMagico/1.0",
          "Accept": "image/*,*/*",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
      });

      if (!r.ok) {
        const text = await r.text().catch(() => "");
        const err = new Error(`download HTTP ${r.status} @ ${url} :: ${text.slice(0, 300)}`);
        netFail("downloadToBuffer", url, err);
        throw err;
      }

      const ab = await r.arrayBuffer();
      return Buffer.from(ab);
    } catch (e) {
      lastErr = e;

      const msg =
        String(e?.name || "") === "AbortError"
          ? `timeout após ${timeoutMs}ms`
          : String(e?.message || e);

      const err = new Error(`download fetch failed (try ${attempt}/${tries}) @ ${url} :: ${msg}`);
      netFail("downloadToBuffer", url, err);

      // backoff mais forte (1.2s, 2.4s, 3.6s, 4.8s...)
      if (attempt < tries) await new Promise((r) => setTimeout(r, 1200 * attempt));
    } finally {
      clearTimeout(t);
    }
  }

  throw lastErr || new Error("download falhou (sem detalhes)");
}

async function openaiFetchJson(url, bodyObj, timeoutMs = 55000) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada. Crie .env.local com OPENAI_API_KEY=...");
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  netMark("openaiFetchJson:POST", url);

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

    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}

    if (!r.ok) {
      const detail =
        parsed?.error?.message ||
        parsed?.error?.code ||
        parsed?.message ||
        parsed?.detail ||
        text;

      const err = new Error(`openai HTTP ${r.status}: ${String(detail).slice(0, 2000)}`);
      netFail("openaiFetchJson:POST", url, err);
      throw err;
    }

    if (parsed === null) {
      const err = new Error(`openai resposta não-JSON: ${text.slice(0, 2000)}`);
      netFail("openaiFetchJson:POST", url, err);
      throw err;
    }

    return parsed;
  } catch (e) {
    const msg = String(e?.message || e);
    const err = new Error(`openai fetch failed @ ${url}: ${msg}`);
    netFail("openaiFetchJson:POST", url, err);
    throw err;
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

/* -------------------- Replicate helpers -------------------- */

const replicateVersionCache = new Map(); // key: "owner/name" -> versionId

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
    throw new Error(
      `REPLICATE_MODEL inválido: "${key}". Use "owner/name" (ex: google/nano-banana-pro) ou configure REPLICATE_VERSION.`
    );
  }

  const info = await fetchJson(`https://api.replicate.com/v1/models/${parsed.owner}/${parsed.name}`, {
    method: "GET",
    timeoutMs: 60000,
    headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
  });

  const versionId = info?.latest_version?.id || info?.latest_version?.version || info?.latest_version;
  if (!versionId) {
    throw new Error(
      `Não consegui obter latest_version do modelo "${key}". Configure REPLICATE_VERSION manualmente no .env.local.`
    );
  }

  replicateVersionCache.set(key, String(versionId));
  return String(versionId);
}
async function replicateCreatePrediction({ model, input, timeoutMs = 180000 }) {
  if (!REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN não configurado (.env.local).");

  const version = await replicateGetLatestVersionId(model);

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetchJson("https://api.replicate.com/v1/predictions", {
        method: "POST",
        timeoutMs,
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version, input }),
      });
    } catch (e) {
      lastErr = e;
      // backoff: 1.2s, 2.4s
      if (attempt < 3) await sleep(1200 * attempt);
    }
  }

  throw lastErr || new Error("Replicate: falha ao criar prediction.");
}

async function replicateWaitPrediction(predictionId, { timeoutMs = 300000, pollMs = 1200 } = {}) {
  if (!REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN não configurado.");

  const started = Date.now();
  while (true) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timeout aguardando prediction do Replicate.");
    }

    const pred = await fetchJson(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      method: "GET",
        timeoutMs: 120000,
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    });

    const st = String(pred?.status || "");
    if (st === "succeeded") return pred;
    if (st === "failed" || st === "canceled") {
      throw new Error(String(pred?.error || "Prediction falhou no Replicate."));
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }
}
// ✅ Vercel-safe: NÃO espera terminar dentro do mesmo request.
// Cria um job e retorna; nas próximas chamadas, só consulta 1 vez (poll once).
async function replicateCreateImageJob({ prompt, imageDataUrl }) {
  if (!REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN não configurado (.env.local).");

  const input = {
    prompt,
    aspect_ratio: REPLICATE_ASPECT_RATIO || "1:1",
    output_format: REPLICATE_OUTPUT_FORMAT || "png",
  };

  if (REPLICATE_IMAGE_IS_ARRAY) input[REPLICATE_IMAGE_FIELD] = [imageDataUrl];
  else input[REPLICATE_IMAGE_FIELD] = imageDataUrl;

  const created = await replicateCreatePrediction({
    model: REPLICATE_MODEL || "google/nano-banana-pro",
    input,
    timeoutMs: 120000,
  });

  const pid = String(created?.id || "").trim();
  if (!pid) throw new Error("Replicate não retornou prediction id.");
  return pid;
}

async function replicatePollOnce(predictionId) {
  if (!REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN não configurado.");
  const pred = await fetchJson(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    method: "GET",
    timeoutMs: 20000,
    headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
  });
  return pred;
}
async function openaiImageEditFallback({ imagePngPath, maskPngPath, prompt, size = "1024x1024" }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada. Use .env.local.");
  if (typeof FormData === "undefined" || typeof Blob === "undefined") {
    throw new Error("Seu Node não tem FormData/Blob globais. Use Node 18+.");
  }

  const imgBuf = await fsp.readFile(imagePngPath);
  const maskBuf = maskPngPath && existsSyncSafe(maskPngPath) ? await fsp.readFile(maskPngPath) : null;

  if (maskBuf) {
    const mi = await sharp(imgBuf).metadata();
    const mm = await sharp(maskBuf).metadata();
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
      if (maskBuf) {
        form.append("mask", new Blob([maskBuf], { type: "image/png" }), path.basename(maskPngPath) || "mask.png");
      }

      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 180000); // 3 min

      try {
        netMark("openai:images:edits", "https://api.openai.com/v1/images/edits", `model=${model}`);

        const r = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: form,
          signal: ctrl.signal,
        });

        const text = await r.text();
        if (!r.ok) {
          const err = new Error(`OpenAI Images HTTP ${r.status}: ${text.slice(0, 2000)}`);
          netFail("openai:images:edits", "https://api.openai.com/v1/images/edits", err);
          throw err;
        }

        const data = JSON.parse(text);
        const outB64 = data?.data?.[0]?.b64_json;
        if (!outB64) throw new Error("Não retornou b64_json.");
        return Buffer.from(outB64, "base64");
      } catch (e) {
        const msg = String(e?.message || e);
        const err = new Error(`openai image edit fetch failed: ${msg}`);
        netFail("openai:images:edits", "https://api.openai.com/v1/images/edits", err);
        throw err;
      } finally {
        clearTimeout(t);
      }
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
/**
 * IMAGEM SEQUENCIAL (IMAGENS SEMPRE PELO REPLICATE)
 * - OpenAI: somente TEXTO
 * - Replicate: SEMPRE IMAGEM
 * - Retorna Buffer PNG
 */
async function openaiImageEditFromReference({ imagePngPath, maskPngPath, prompt, size = "1024x1024" }) {
  // 🔒 TRAVA para Replicate (não deixa cair em OpenAI Images)
  if (!REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN ausente. Imagens devem ser geradas pelo Replicate.");
  }

  // (mask não é usado pelo Replicate aqui; mantido na assinatura para não quebrar chamadas)
  const imgBuf = await fsp.readFile(imagePngPath);

    const imgDataUrl = bufferToDataUrlPng(imgBuf);

  const input = {
    prompt,

    // mantém seus ENV (se o modelo suportar)
    aspect_ratio: REPLICATE_ASPECT_RATIO || "1:1",
    resolution: REPLICATE_RESOLUTION || "2K",
    output_format: REPLICATE_OUTPUT_FORMAT || "png",
    safety_filter_level: REPLICATE_SAFETY || "block_only_high",
  };

  // ✅ campo de imagem configurável (image vs image_input etc.)
  if (REPLICATE_IMAGE_IS_ARRAY) input[REPLICATE_IMAGE_FIELD] = [imgDataUrl];
  else input[REPLICATE_IMAGE_FIELD] = imgDataUrl;

  // cria + aguarda prediction
  const created = await replicateCreatePrediction({
    model: REPLICATE_MODEL || "google/nano-banana-pro",
    input,
    timeoutMs: 120000,
  });

  const pred = await replicateWaitPrediction(created?.id, { timeoutMs: 300000, pollMs: 1200 });

  // ✅ Extrai saída em vários formatos possíveis
  let out = pred?.output;

  // 1) string URL
  if (typeof out === "string" && out.startsWith("http")) {
    const buf = await downloadToBuffer(out, 300000);
    return await sharp(buf).png().toBuffer();
  }

  // 2) dataURL base64
  if (typeof out === "string" && out.startsWith("data:")) {
    const b = dataUrlToBuffer(out);
    if (!b) throw new Error("Replicate retornou dataURL inválida.");
    return await sharp(b).png().toBuffer();
  }

  // 3) array de strings
  if (Array.isArray(out) && typeof out[0] === "string") {
    const first = out[0];

    if (first.startsWith("http")) {
      const buf = await downloadToBuffer(first, 240000);
      return await sharp(buf).png().toBuffer();
    }

    if (first.startsWith("data:")) {
      const b = dataUrlToBuffer(first);
      if (!b) throw new Error("Replicate retornou dataURL inválida (array).");
      return await sharp(b).png().toBuffer();
    }
  }

  // 4) objeto { url }
  if (out && typeof out === "object" && typeof out.url === "string") {
    const buf = await downloadToBuffer(out.url, 240000);
    return await sharp(buf).png().toBuffer();
  }

  // 5) array de objetos [{ url }]
  if (Array.isArray(out) && out[0] && typeof out[0] === "object" && typeof out[0].url === "string") {
    const buf = await downloadToBuffer(out[0].url, 240000);
    return await sharp(buf).png().toBuffer();
  }

  // nada reconhecido
  throw new Error("Replicate não retornou uma imagem válida em output. Output=" + JSON.stringify(out).slice(0, 800));
}

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
    timeoutMs: 55000,
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

function buildScenePromptFromParagraph({ paragraphText, themeKey, childName, styleKey }) {
  const th = themeDesc(themeKey);
  const name = String(childName || "").trim();
  const txt = String(paragraphText || "").trim();
  const style = String(styleKey || "read").trim();

  const base = [
    "Estou escrevendo um livro infantil e quero que você crie UMA CENA para este texto:",
    `"${txt}"`,
    "Regras IMPORTANTES:",
    "- Use a criança da imagem enviada como personagem principal.",
    "- Mantenha TODAS as características originais dela (rosto, cabelo, cor da pele, traços). Não altere identidade.",
    "- Mantenha a identidade consistente em todas as páginas (same face, same hairstyle, same skin tone).",
    `- Tema da história: ${th}.`,
    "- Composição: a criança integrada naturalmente na cena, com ação e emoção compatíveis com o texto.",
    "- NÃO escreva texto/legendas na imagem gerada (eu vou colocar o texto depois no PNG).",
    name ? `Nome da criança (apenas contexto): ${name}.` : "",
  ].filter(Boolean);

  if (style === "color") {
    base.splice(
      5,
      0,
      [
        "- Estilo: página de livro de colorir (coloring book).",
        "- Arte em PRETO E BRANCO, contornos bem definidos, traço limpo, linhas mais grossas.",
        "- SEM cores, SEM gradientes, SEM sombras, SEM pintura, SEM texturas realistas.",
        "- Fundo branco (ou bem claro), poucos detalhes no fundo (para facilitar colorir).",
        "- Visual infantil, fofo e amigável; formas simples; alta legibilidade dos contornos.",
      ].join(" ")
    );
  } else {
    base.splice(5, 0, "- Estilo: ilustração semi-realista de livro infantil, bonita, alegre, cores agradáveis, luz suave.");
  }

  return base.join(" ");
}

function buildCoverPrompt({ themeKey, childName, styleKey }) {
  const th = themeDesc(themeKey);
  const name = String(childName || "").trim();
  const style = String(styleKey || "read").trim();

  const parts = [
    "Crie uma CAPA de livro infantil.",
    "Use a criança da imagem como personagem principal e mantenha suas características originais (identidade consistente).",
    "Mantenha a identidade consistente com a foto (same face, same hairstyle, same skin tone).",
    `Tema: ${th}.`,
    "Cena de capa: alegre, mágica, positiva, com a criança em destaque no centro.",
    "NÃO escreva texto/legendas na imagem (eu vou aplicar depois).",
    name ? `Nome da criança (apenas contexto): ${name}.` : "",
  ].filter(Boolean);

  if (style === "color") {
    parts.splice(
      1,
      0,
      [
        "Estilo: CAPA em formato de livro para colorir (coloring book).",
        "Arte em PRETO E BRANCO, contornos fortes, traço limpo.",
        "SEM cores, SEM gradientes, SEM sombras, SEM pintura.",
        "Fundo branco (ou bem claro) e poucos detalhes para facilitar colorir.",
      ].join(" ")
    );
  } else {
    parts.splice(1, 0, "Estilo: ilustração semi-realista, alegre, colorida, luz suave.");
  }

  return parts.join(" ");
}

/* -------------------- Text stamping helpers -------------------- */

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
    ? `<text x="${textX}" y="${tY}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="900" fill="#0f172a">${pack.titleLines
        .map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : pack.lineGapTitle}">${escapeXml(ln)}</tspan>`)
        .join("")}</text>`
    : "";

  tY += pack.titleLines.length ? pack.titleLines.length * pack.lineGapTitle + pack.spacer : 0;

  const textSvg = pack.bodyLines.length
    ? `<text x="${textX}" y="${tY}" font-family="Helvetica, Arial, sans-serif" font-size="${textSize}" font-weight="800" fill="#0f172a">${pack.bodyLines
        .map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : pack.lineGapBody}">${escapeXml(ln)}</tspan>`)
        .join("")}</text>`
    : "";

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.25"/></filter></defs><rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}" rx="${rx}" ry="${rx}" fill="#FFFFFF" fill-opacity="0.50" filter="url(#shadow)"/>${titleSvg}${textSvg}</svg>`;

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

  const titleSvg = `<text x="${textX}" y="${tY}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="950" fill="#0f172a">${titleLines
    .map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : lineGapTitle}">${escapeXml(ln)}</tspan>`)
    .join("")}</text>`;

  tY += titleLines.length ? lineGapTitle * titleLines.length + Math.round(subSize * 0.35) : 0;

  const subSvg = subLines.length
    ? `<text x="${textX}" y="${tY}" font-family="Helvetica, Arial, sans-serif" font-size="${subSize}" font-weight="800" fill="#0f172a">${subLines
        .map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : lineGapSub}">${escapeXml(ln)}</tspan>`)
        .join("")}</text>`
    : "";

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.28"/></filter></defs><rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}" rx="${rx}" ry="${rx}" fill="#FFFFFF" fill-opacity="0.86" filter="url(#shadow)"/>${titleSvg}${subSvg}</svg>`;

  await sharp(inputPath).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(outputPath);
  return outputPath;
}

/* -------------------- PDF -------------------- */

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

/* -------------------- Book storage paths -------------------- */

function bookDirOf(_userId, bookId) {
  return path.join(BOOKS_DIR, String(bookId));
}
function manifestPathOf(_userId, bookId) {
  return path.join(bookDirOf("", bookId), "book.json");
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
    photo: { ok: false, file: "", mime: "", editBase: "", storageKey: "" },
    mask: { ok: false, file: "", editBase: "", storageKey: "" },
    pages: [],
    images: [],
    cover: { ok: false, file: "", url: "" },
    pdf: "",
    updatedAt: nowISO(),
       pending: null,
  };
}

const jobs = new Map(); // key "userId:bookId" -> { running: bool }

/* -------------------- DB mapping -------------------- */

function manifestToBookRow(userId, m) {
  return {
    id: m.id,
    user_id: userId,
    status: m.status || "created",
    step: m.step || "created",
    error: m.error || "",
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
  const { error } = await supabaseAdmin.from("profiles").upsert(
    { id: userId, name: String(name || "") },
    { onConflict: "id" }
  );
  if (error) throw error;
  return true;
}

/* -------------------- Unified persistence: disk + DB -------------------- */

async function saveManifestAll(userId, bookId, manifest, { sbUser = null } = {}) {
  await saveManifest(userId, bookId, manifest);

  let savedDb = false;

  if (sbUser) {
    try {
      await dbUpsertBookUser(sbUser, userId, manifest);
      savedDb = true;
    } catch (e) {
      console.warn("⚠️  DB upsert (user/RLS) falhou:", e?.message || e);
    }
  }

  if (!savedDb && supabaseAdmin) {
    try {
      await dbUpsertBookAdmin(userId, manifest);
      savedDb = true;
    } catch (e) {
      console.warn("⚠️  DB upsert (admin) falhou:", e?.message || e);
    }
  }

  // ✅ na Vercel, se não salvou no DB, isso vai causar o seu 404 depois.
  if ((process.env.VERCEL || process.env.VERCEL_ENV) && !savedDb) {
    throw new Error("Falha crítica: não consegui persistir o livro no DB (Supabase). Sem isso, o book some na Vercel.");
  }

  return savedDb;
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
      console.warn("⚠️  DB read (user/RLS) falhou (continuando):", String(e?.message || e));
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
      console.warn("⚠️  DB read (admin) falhou (continuando):", String(e?.message || e));
    }
  }

  return null;
}

/* -------------------- Supabase Storage helpers (Vercel-safe) -------------------- */

async function sbUploadBuffer({ pathKey, contentType, buffer }) {
  if (!supabaseAdmin) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente (precisa para upload no Storage).");
  const { data, error } = await supabaseAdmin.storage.from("books").upload(pathKey, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload falhou: ${error.message || JSON.stringify(error)}`);
  return data;
}

async function sbDownloadToBuffer(pathKey) {
  // usa admin para baixar (evita permissão). se não tiver admin, tenta anon mesmo (se bucket público).
  const client = supabaseAdmin || supabaseAnon;
  if (!client) throw new Error("Supabase não configurado para Storage.");
  const { data, error } = await client.storage.from("books").download(pathKey);
  if (error) throw error;
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

function sbPublicUrl(pathKey) {
  if (!supabaseAnon) return "";
  const { data } = supabaseAnon.storage.from("books").getPublicUrl(pathKey);
  return data?.publicUrl || "";
}
async function sbSignedUrl(pathKey, expiresSec = 60 * 10) {
  const client = supabaseAdmin; // signed URL para bucket privado precisa do admin
  if (!client) return "";
  try {
    const { data, error } = await client.storage.from("books").createSignedUrl(pathKey, expiresSec);
    if (error) return "";
    return data?.signedUrl || "";
  } catch {
    return "";
  }
}
async function ensureFileFromStorageIfMissing(localPath, storageKey) {
  if (existsSyncSafe(localPath)) return true;
  if (!storageKey) return false;
  try {
    const buf = await sbDownloadToBuffer(storageKey);
    await ensureDir(path.dirname(localPath));
    await fsp.writeFile(localPath, buf);
    return true;
  } catch (e) {
    console.warn("⚠️  Falha ao baixar do Storage:", storageKey, "-", String(e?.message || e));
    return false;
  }
}

/* -------------------- Express app -------------------- */

const app = express();
app.use(express.json({ limit: JSON_LIMIT }));
app.get("/api/boot", (req, res) => {
  res.status(BOOT_ERROR ? 500 : 200).json({
    ok: !BOOT_ERROR,
    boot_error: BOOT_ERROR || "",
    node: process.version,
    vercel: !!process.env.VERCEL,
  });
});
app.use("/examples", express.static(path.join(__dirname, "public/examples"), { fallthrough: true }));
// ✅ DEBUG: confirma se admin.page.js existe e se o Node consegue resolver/require no runtime (Vercel)
app.get("/api/debug-fs", (req, res) => {
  const p = (f) => path.join(__dirname, f);

  res.json({
    ok: true,
    VERCEL: !!process.env.VERCEL,
    __dirname,
    OUT_ROOT,
    OUT_DIR,
    tmpdir: os.tmpdir(),

    exists: {
      "app.js": fs.existsSync(p("app.js")),
      "admin.page.js": fs.existsSync(p("admin.page.js")),
      "generate.page.js": fs.existsSync(p("generate.page.js")),
      "profile.page.js": fs.existsSync(p("profile.page.js")),
      "books/index.js": fs.existsSync(p("books/index.js")),
      "landing.html": fs.existsSync(p("landing.html")),
      "how-it-works.html": fs.existsSync(p("how-it-works.html")),
      "exemplos.html": fs.existsSync(p("exemplos.html")),
    },

    resolve: {
      "admin.page.js": (() => {
        try { return require.resolve("./admin.page.js"); }
        catch (e) { return String(e?.message || e); }
      })(),
      "generate.page.js": (() => {
        try { return require.resolve("./generate.page.js"); }
        catch (e) { return String(e?.message || e); }
      })(),
      "profile.page.js": (() => {
        try { return require.resolve("./profile.page.js"); }
        catch (e) { return String(e?.message || e); }
      })(),
      "books": (() => {
        try { return require.resolve("./books"); }
        catch (e) { return String(e?.message || e); }
      })(),
    },
  });
});
// ✅ Debug: consulta um predictionId diretamente no Replicate
app.get("/api/debug-replicate/:pid", requireAuth, async (req, res) => {
  try {
    const pid = String(req.params?.pid || "").trim();
    if (!pid) return res.status(400).json({ ok: false, error: "pid ausente" });
    if (!REPLICATE_API_TOKEN) return res.status(400).json({ ok: false, error: "REPLICATE_API_TOKEN ausente" });

    const pred = await replicatePollOnce(pid);
    return res.json({ ok: true, pred });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
/* -------------------- Mount extra pages/modules -------------------- */
try {
  const mountBooks = require("./books"); // ./books/index.js
  mountBooks(app, { OUT_DIR, USERS_DIR, requireAuth });
  console.log("✅ /books ativo: módulo books/ carregado com sucesso.");
} catch (e) {
  console.warn("❌ módulo books/ NÃO carregou. /books desativado.");
  console.warn("   Motivo:", String(e?.message || e));
  console.warn("   Stack:", String(e?.stack || ""));
}

try {
  const mountGeneratePage = require("./generate.page.js");
  mountGeneratePage(app, { requireAuth });
  console.log("✅ /generate ativo: generate.page.js carregado com sucesso.");
} catch (e) {
  console.warn("❌ generate.page.js NÃO carregou. /generate desativado.");
  console.warn("   Motivo:", String(e?.message || e));
  console.warn("   Stack:", String(e?.stack || ""));
}

try {
  const mountAdminPage = require("./admin.page.js");
  mountAdminPage(app, { OUT_DIR, BOOKS_DIR, USERS_FILE: "", requireAuth });
  console.log("✅ /admin ativo: admin.page.js carregado com sucesso.");
} catch (e) {
  console.error("❌ admin.page.js NÃO carregou. /admin desativado.");
  console.error("Motivo:", String(e?.message || e));
  console.error("Stack:", String(e?.stack || ""));
  // ⚠️ opcional: descomente para não deixar deploy “passar”
  // throw e;
}

try {
  const mountProfilePage = require("./profile.page.js");
  mountProfilePage(app, { requireAuth });
  console.log("✅ /profile ativo: profile.page.js carregado com sucesso.");
} catch (e) {
  console.warn("❌ profile.page.js NÃO carregou. /profile desativado.");
  console.warn("   Motivo:", String(e?.message || e));
  console.warn("   Stack:", String(e?.stack || ""));
}

/* -------------------- Login page -------------------- */

app.get("/login", async (req, res) => {
  const nextUrl = String(req.query?.next || "/create");
  const user = await getCurrentUser(req, res).catch(() => null);
  if (user) return res.redirect(nextUrl || "/create");

  res.type("html").send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Login — Meu Livro Mágico</title><style>
:root{--bg1:#ede9fe;--bg2:#ffffff;--bg3:#fdf2f8;--text:#111827;--muted:#6b7280;--border:#e5e7eb;--violet:#7c3aed;--pink:#db2777}
*{box-sizing:border-box}body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;background:linear-gradient(to bottom,var(--bg1),var(--bg2),var(--bg3));min-height:100vh;display:grid;place-items:center;padding:24px;color:var(--text)}
.card{width:min(520px,100%);background:#fff;border:1px solid var(--border);border-radius:22px;box-shadow:0 20px 50px rgba(0,0,0,.10);padding:18px}
h1{margin:8px 0 0;font-size:26px;font-weight:1000;text-align:center}
p{margin:8px 0 0;text-align:center;color:var(--muted);font-weight:800}
.tabs{display:flex;gap:10px;margin-top:16px}
.tab{flex:1;border:1px solid var(--border);background:#fff;border-radius:999px;padding:10px 12px;cursor:pointer;font-weight:1000;color:#374151}
.tab.active{background:linear-gradient(90deg,var(--violet),var(--pink));color:#fff;border-color:transparent}
.field{margin-top:12px}.label{font-weight:1000;margin:0 0 6px}
input{width:100%;border:1px solid var(--border);border-radius:14px;padding:12px 12px;font-size:15px;font-weight:900;outline:none}
input:focus{border-color:rgba(124,58,237,.4);box-shadow:0 0 0 4px rgba(124,58,237,.12)}
.btn{width:100%;margin-top:14px;border:0;border-radius:999px;padding:12px 14px;font-weight:1000;cursor:pointer;color:#fff;background:linear-gradient(90deg,var(--violet),var(--pink));box-shadow:0 16px 34px rgba(124,58,237,.22)}
.hint{margin-top:12px;padding:10px 12px;border-radius:14px;background:rgba(219,39,119,.06);border:1px solid rgba(219,39,119,.14);color:#7f1d1d;font-weight:900;display:none;white-space:pre-wrap}
a.link{display:block;text-align:center;margin-top:12px;color:#4c1d95;font-weight:1000;text-decoration:none}
a.link:hover{text-decoration:underline}
</style></head><body>
<div class="card"><h1>🔐 Entrar / Criar Conta</h1><p>Para criar o livro mágico, você precisa estar logado.</p>
<div class="tabs"><button class="tab active" id="tabLogin">Entrar</button><button class="tab" id="tabSignup">Criar conta</button></div>
<div id="panelLogin"><div class="field"><div class="label">E-mail</div><input id="loginEmail" placeholder="seu@email.com" /></div>
<div class="field"><div class="label">Senha</div><input id="loginPass" type="password" placeholder="••••••••" /></div>
<button class="btn" id="btnDoLogin">Entrar</button></div>
<div id="panelSignup" style="display:none"><div class="field"><div class="label">Nome</div><input id="signName" placeholder="Seu nome" /></div>
<div class="field"><div class="label">E-mail</div><input id="signEmail" placeholder="seu@email.com" /></div>
<div class="field"><div class="label">Senha (mín. 6)</div><input id="signPass" type="password" placeholder="••••••••" /></div>
<button class="btn" id="btnDoSignup">Criar conta</button></div>
<div class="hint" id="hint"></div><a class="link" href="/sales">← Voltar para Vendas</a></div>
<script>
const nextUrl=${JSON.stringify(nextUrl || "/create")};
const $=(id)=>document.getElementById(id);
function setHint(msg){const el=$("hint");el.textContent=msg||"";el.style.display=msg?"block":"none";}
function setTab(which){const isLogin=which==="login";$("tabLogin").classList.toggle("active",isLogin);$("tabSignup").classList.toggle("active",!isLogin);
$("panelLogin").style.display=isLogin?"block":"none";$("panelSignup").style.display=isLogin?"none":"block";setHint("");}
$("tabLogin").onclick=()=>setTab("login");$("tabSignup").onclick=()=>setTab("signup");
async function postJson(url,body){const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})});
const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok) throw new Error(j.error||"Falha");return j;}
$("btnDoLogin").onclick=async()=>{setHint("");try{const email=$("loginEmail").value.trim();const password=$("loginPass").value;
if(!email) return setHint("Digite o e-mail.");if(!password) return setHint("Digite a senha.");
await postJson("/api/auth/login",{email,password});window.location.href=nextUrl||"/create";}catch(e){setHint(String(e.message||e));}};
$("btnDoSignup").onclick=async()=>{setHint("");try{const name=$("signName").value.trim();const email=$("signEmail").value.trim();const password=$("signPass").value;
if(!name||name.length<2) return setHint("Digite seu nome (mín. 2 letras).");if(!email) return setHint("Digite o e-mail.");
if(!password||password.length<6) return setHint("Senha muito curta (mín. 6).");
const r=await postJson("/api/auth/signup",{name,email,password});if(r.needs_email_confirm){setHint("Conta criada! Confirme seu e-mail e depois faça login.");return;}
window.location.href=nextUrl||"/create";}catch(e){setHint(String(e.message||e));}};
</script></body></html>`);
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    assertSupabaseAnon();

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || name.length < 2) return res.status(400).json({ ok: false, error: "Nome inválido." });
    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "E-mail inválido." });
    if (!password || password.length < 6) return res.status(400).json({ ok: false, error: "Senha deve ter no mínimo 6 caracteres." });

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;

    const accessToken = data?.session?.access_token || "";
    const refreshToken = data?.session?.refresh_token || "";

    const uid = data?.user?.id || "";
    if (uid && supabaseAdmin) {
      try {
        await dbInsertProfileAdmin(uid, name);
      } catch (e) {
        console.warn("⚠️  Falha ao upsert profiles (admin):", String(e?.message || e));
      }
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

/* -------------------- Sales/how-it-works/exemplos -------------------- */

app.get("/sales", (req, res) => {
  if (existsSyncSafe(LANDING_HTML)) return res.sendFile(LANDING_HTML);

  res.type("html").send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Meu Livro Mágico — Vendas</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1220;color:#fff}
.card{max-width:820px;margin:24px;padding:24px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16)}
h1{margin:0 0 10px 0;font-size:28px}p{opacity:.9;line-height:1.6;margin:0 0 14px 0}
a.btn{display:inline-flex;gap:10px;align-items:center;padding:12px 16px;border-radius:14px;background:#ff6b6b;color:#fff;text-decoration:none;font-weight:900}
.muted{opacity:.75;font-size:13px;margin-top:12px}code{background:rgba(255,255,255,.08);padding:2px 6px;border-radius:8px}
</style></head><body><div class="card"><h1>📚 Meu Livro Mágico</h1><p>Gere um livro infantil personalizado com a foto da criança, história e imagens — tudo automático.</p><a class="btn" href="/create">✨ Ir para o gerador</a><div class="muted">Dica: crie um <code>landing.html</code> ao lado do <code>app.js</code> para personalizar.</div></div></body></html>`);
});

app.get("/como-funciona", (req, res) => {
  if (existsSyncSafe(HOW_IT_WORKS_HTML)) return res.sendFile(HOW_IT_WORKS_HTML);

  res.type("html").send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Como funciona — Meu Livro Mágico</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#ede9fe,#fff,#fdf2f8);color:#111827}
.card{max-width:860px;margin:24px;padding:24px;border-radius:18px;background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 20px 50px rgba(0,0,0,.10)}
h1{margin:0 0 10px 0;font-size:28px}p{opacity:.92;line-height:1.7;margin:0 0 12px 0;font-weight:700}
ul{margin:10px 0 0;padding-left:18px;line-height:1.7;font-weight:800}
a.btn{display:inline-flex;gap:10px;align-items:center;padding:12px 16px;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff;text-decoration:none;font-weight:1000}
.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.muted{opacity:.7;font-size:12px;margin-top:10px;font-weight:800}code{background:rgba(0,0,0,.06);padding:2px 6px;border-radius:8px}
</style></head><body><div class="card"><h1>✨ Como funciona</h1><p>Você envia a foto da criança, escolhe o tema e o estilo do livro.</p>
<ul><li>1) Envie a foto</li><li>2) Informe nome/idade e escolha o tema</li><li>3) O sistema cria a história (texto) e gera as imagens uma por vez</li><li>4) O texto é carimbado dentro do PNG e no final sai um PDF</li></ul>
<div class="row"><a class="btn" href="/sales">🛒 Voltar para Vendas</a><a class="btn" href="/create">📚 Ir para o Gerador</a></div>
<div class="muted">Dica: crie um arquivo <code>how-it-works.html</code> ao lado do <code>app.js</code> para personalizar esta página.</div>
</div></body></html>`);
});

app.get("/exemplos", (req, res) => {
  if (existsSyncSafe(EXEMPLOS_HTML)) return res.sendFile(EXEMPLOS_HTML);
  return res.status(404).type("html").send(`<h1>exemplos.html não encontrado</h1><p>Coloque um arquivo <code>exemplos.html</code> ao lado do <code>app.js</code>.</p><p><a href="/sales">Voltar</a></p>`);
});

/* -------------------- Generator page (/create) -------------------- */

function renderGeneratorHtml(req, res) {
  const imageInfo =
    IMAGE_PROVIDER === "replicate"
      ? `Replicate: <span class="mono">${escapeHtml(REPLICATE_MODEL)}</span>`
      : `OpenAI (fallback): <span class="mono">${escapeHtml(IMAGE_MODEL)}</span>`;

  // ⚠️ Mantive seu HTML/JS exatamente como você enviou (só compactei a string para não explodir tamanho).
  // Se você quiser, eu posso devolver a versão “bem formatada” também.
  res.type("html").send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Meu Livro Mágico — Criar</title>
<style>
:root{--bg1:#ede9fe;--bg2:#ffffff;--bg3:#fdf2f8;--card:#ffffff;--text:#111827;--muted:#6b7280;--border:#e5e7eb;--shadow:0 20px 50px rgba(0,0,0,.10);--shadow2:0 10px 24px rgba(0,0,0,.08);--violet:#7c3aed;--pink:#db2777;--disabled:#e5e7eb;--disabledText:#9ca3af}
*{box-sizing:border-box}
body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:var(--text);background:linear-gradient(to bottom,var(--bg1),var(--bg2),var(--bg3));min-height:100vh;padding-bottom:110px}
.container{max-width:980px;margin:0 auto;padding:24px 16px}
.topRow{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.backLink{border:0;background:transparent;cursor:pointer;display:inline-flex;align-items:center;gap:10px;color:var(--muted);font-weight:800;padding:10px 12px;border-radius:12px}
.backLink:hover{color:#374151;background:rgba(0,0,0,.04)}
.topActions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:flex-end}
.pill{background:rgba(124,58,237,.10);color:#4c1d95;border:1px solid rgba(124,58,237,.16);padding:6px 10px;border-radius:999px;font-weight:900;text-decoration:none}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
.stepper{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:10px 0 22px}
.stepItem{display:flex;flex-direction:column;align-items:center;gap:8px}
.stepDot{width:40px;height:40px;border-radius:999px;display:grid;place-items:center;font-weight:1000;font-size:14px;transition:transform .2s ease;border:1px solid rgba(0,0,0,.06)}
.stepDot.done{background:linear-gradient(135deg,#34d399,#10b981);color:#fff;border-color:transparent}
.stepDot.active{background:linear-gradient(135deg,var(--violet),var(--pink));color:#fff;border-color:transparent;box-shadow:0 10px 24px rgba(124,58,237,.25);transform:scale(1.08)}
.stepDot.todo{background:#e5e7eb;color:#9ca3af}
.stepLabel{font-size:12px;font-weight:900;color:#9ca3af;display:none}
@media(min-width:640px){.stepLabel{display:block}}
.stepLabel.active{color:var(--violet)}
.stepLine{width:56px;height:6px;border-radius:999px;background:#e5e7eb}
@media(min-width:768px){.stepLine{width:90px}}
.stepLine.done{background:linear-gradient(90deg,#34d399,#10b981)}
.card{background:var(--card);border:1px solid var(--border);border-radius:26px;box-shadow:var(--shadow);padding:18px}
.head{text-align:center;padding:14px 10px 6px}
.head h1{margin:0;font-size:26px;font-weight:1000}
.head p{margin:8px 0 0;color:var(--muted);font-weight:800}
.panel{margin-top:12px;display:none;animation:fadeIn .18s ease}
.panel.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}
.drop{border:2px dashed rgba(124,58,237,.35);border-radius:18px;padding:26px 16px;text-align:center;cursor:pointer;background:rgba(124,58,237,.04);box-shadow:var(--shadow2)}
.drop.drag{border-color:rgba(219,39,119,.55);background:rgba(219,39,119,.04)}
.drop .big{font-size:40px}.drop .t{font-weight:1000;font-size:18px;margin-top:10px}.drop .s{color:var(--muted);font-weight:800;margin-top:6px}
.twoCol{margin-top:16px;display:grid;grid-template-columns:180px 1fr;gap:14px;align-items:center}
@media(max-width:640px){.twoCol{grid-template-columns:1fr}}
.previewWrap{display:grid;place-items:center}
.previewImg{width:160px;height:160px;border-radius:999px;object-fit:cover;border:6px solid rgba(250,204,21,.65);box-shadow:var(--shadow2);display:none;background:#fff}
.previewEmpty{width:160px;height:160px;border-radius:999px;background:rgba(0,0,0,.04);display:grid;place-items:center;font-size:42px}
.hint{margin-top:10px;padding:12px;border-radius:14px;background:rgba(219,39,119,.06);border:1px solid rgba(219,39,119,.14);color:#7f1d1d;font-weight:900;white-space:pre-wrap;display:none}
.field{margin-top:14px}.label{font-weight:1000;margin-bottom:8px}
.input,.select{width:100%;border:1px solid var(--border);border-radius:16px;padding:14px 14px;font-size:16px;font-weight:900;outline:none;background:#fff}
.input:focus,.select:focus{border-color:rgba(124,58,237,.4);box-shadow:0 0 0 4px rgba(124,58,237,.12)}
.rangeRow{margin-top:10px}
.rangeMeta{display:flex;justify-content:space-between;color:var(--muted);font-weight:900;margin-top:8px;font-size:12px}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:10px}
@media(max-width:900px){.grid3{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.grid3{grid-template-columns:1fr}}
.pick{border:1px solid var(--border);border-radius:18px;padding:14px;background:#fff;cursor:pointer;box-shadow:var(--shadow2);text-align:left;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
.pick:active{transform:translateY(1px)}
.pick.active{border-color:rgba(124,58,237,.45);box-shadow:0 16px 40px rgba(124,58,237,.18);outline:3px solid rgba(124,58,237,.16)}
.pick .ico{font-size:34px}.pick .tt{margin-top:10px;font-weight:1000;font-size:18px}.pick .dd{margin-top:6px;color:var(--muted);font-weight:800}
.footer{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.82);backdrop-filter:blur(12px);border-top:1px solid rgba(0,0,0,.06);padding:14px 16px}
.footerInner{max-width:980px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:10px}
.btnGroup{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
.btn{border:0;cursor:pointer;border-radius:999px;padding:12px 18px;font-weight:1000;display:inline-flex;align-items:center;gap:10px;transition:transform .12s ease,opacity .12s ease;user-select:none}
.btn:active{transform:translateY(1px)}
.btnGhost{background:transparent;color:var(--muted);border:1px solid transparent}
.btnGhost:hover{background:rgba(0,0,0,.04);color:#374151}
.btnPrimary{color:#fff;background:linear-gradient(90deg,var(--violet),var(--pink));box-shadow:0 16px 34px rgba(124,58,237,.22)}
.btnPrimary:disabled{background:var(--disabled);color:var(--disabledText);box-shadow:none;cursor:not-allowed}
.smallNote{margin-top:12px;font-size:12px;color:var(--muted);font-weight:900;text-align:center}
</style></head>
<body>
<div class="container">
  <div class="topRow">
    <button class="backLink" id="btnHome" title="Voltar">← Voltar</button>
    <div class="topActions">
      <a class="pill" href="/sales">🛒 Pagina Inicial</a>
      <a class="pill" href="/books">📚 Meus Livros</a>
      <a class="pill" href="/como-funciona">❓ Como funciona</a>
      <button class="pill" id="btnReset" style="cursor:pointer">♻️ Reiniciar</button>
      <a class="pill" href="/profile">👤 Perfil</a>
    </div>
  </div>

  <div class="smallNote">${imageInfo}</div>
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
      <div class="field"><div class="label">Nome</div><input class="input" id="childName" placeholder="Ex: João, Maria..." /></div>
      <div class="field"><div class="label">Idade: <span id="ageLabel">6</span> anos</div>
        <div class="rangeRow">
          <input type="range" min="2" max="12" value="6" id="childAge" style="width:100%"/>
          <div class="rangeMeta"><span>2</span><span>12</span></div>
        </div>
      </div>
      <div class="field"><div class="label">Gênero do texto</div>
        <select class="select" id="childGender">
          <option value="neutral">Neutro 🌟</option><option value="boy">Menino 👦</option><option value="girl">Menina 👧</option>
        </select>
      </div>
    </div>

    <div class="panel" id="panel2">
      <div class="field"><div class="label">Tema</div>
        <div class="grid3">
          <button class="pick" data-theme="space"><div class="ico">🚀</div><div class="tt">Viagem Espacial</div><div class="dd">Explore planetas e mistérios.</div></button>
          <button class="pick" data-theme="dragon"><div class="ico">🐉</div><div class="tt">Reino dos Dragões</div><div class="dd">Mundo medieval mágico.</div></button>
          <button class="pick" data-theme="ocean"><div class="ico">🧜‍♀️</div><div class="tt">Fundo do Mar</div><div class="dd">Tesouros e amigos marinhos.</div></button>
          <button class="pick" data-theme="jungle"><div class="ico">🦁</div><div class="tt">Safari na Selva</div><div class="dd">Aventura com animais.</div></button>
          <button class="pick" data-theme="superhero"><div class="ico">🦸</div><div class="tt">Super Herói</div><div class="dd">Salvar o dia com poderes.</div></button>
          <button class="pick" data-theme="dinosaur"><div class="ico">🦕</div><div class="tt">Dinossauros</div><div class="dd">Uma jornada jurássica.</div></button>
        </div>
      </div>

      <div class="field"><div class="label">Estilo do livro</div>
        <div class="grid3">
          <button class="pick styleBtn" data-style="read"><div class="ico">📖</div><div class="tt">Livro para leitura</div><div class="dd">Ilustrações coloridas (semi-realista).</div></button>
          <button class="pick styleBtn" data-style="color"><div class="ico">🖍️</div><div class="tt">Leitura + colorir</div><div class="dd">Preto e branco (contornos).</div></button>
        </div>
      </div>

      <div class="field">
        <label style="display:flex; gap:10px; align-items:flex-start; cursor:pointer;">
          <input type="checkbox" id="consent"/>
          <div>
            <div style="font-weight:1000">Autorização</div>
            <div style="color:var(--muted); font-weight:900; margin-top:4px;">Confirmo que tenho autorização para usar a foto da criança para gerar este livro.</div>
          </div>
        </label>
      </div>

      <div id="hintGen" class="hint"></div>
      <div class="smallNote">Ao criar, você será levado para a tela “Gerando…”</div>
    </div>
  </div>
</div>

<div class="footer">
  <div class="footerInner">
    <button class="btn btnGhost" id="btnBack">← Voltar</button>
    <div class="btnGroup">
      <button class="btn btnPrimary" id="btnNext">Próximo →</button>
    </div>
  </div>
</div>

<script>
const steps=[{id:"photo",title:"Foto Mágica",sub:"Envie uma foto da criança"},{id:"profile",title:"Quem é o Herói?",sub:"Conte-nos sobre a criança"},{id:"theme",title:"Escolha a Aventura",sub:"Selecione o tema e estilo"}];
const state={currentStep:Number(localStorage.getItem("currentStep")||"0"),bookId:localStorage.getItem("bookId")||"",photo:localStorage.getItem("photo")||"",mask:localStorage.getItem("mask")||"",theme:localStorage.getItem("theme")||"",style:localStorage.getItem("style")||"read",childName:localStorage.getItem("childName")||"",childAge:Number(localStorage.getItem("childAge")||"6"),childGender:localStorage.getItem("childGender")||"neutral",consent:localStorage.getItem("consent")==="1"};
const $=(id)=>document.getElementById(id);
function setHint(el,msg){el.textContent=msg||"";el.style.display=msg?"block":"none";}
function showPhoto(dataUrl){const img=$("photoPreview");const empty=$("photoEmpty");if(dataUrl){img.src=dataUrl;img.style.display="block";empty.style.display="none";}else{img.style.display="none";empty.style.display="grid";}}
function buildStepper(){const root=$("stepper");root.innerHTML="";for(let i=0;i<steps.length;i++){const item=document.createElement("div");item.className="stepItem";
const dot=document.createElement("div");dot.className="stepDot "+(i<state.currentStep?"done":i===state.currentStep?"active":"todo");dot.textContent=i<state.currentStep?"✓":String(i+1);
const lbl=document.createElement("div");lbl.className="stepLabel "+(i===state.currentStep?"active":"");lbl.textContent=steps[i].title;
item.appendChild(dot);item.appendChild(lbl);root.appendChild(item);
if(i!==steps.length-1){const line=document.createElement("div");line.className="stepLine "+(i<state.currentStep?"done":"");root.appendChild(line);}}}
function canProceedStep(step){if(step===0) return !!state.photo;if(step===1) return !!(state.childName&&state.childName.trim().length>=2&&state.childAge);if(step===2) return !!(state.theme&&state.style&&state.consent);return false;}
function setStepUI(){localStorage.setItem("currentStep",String(state.currentStep));buildStepper();
$("stepTitle").textContent=steps[state.currentStep].title;$("stepSub").textContent=steps[state.currentStep].sub;
for(let i=0;i<steps.length;i++) $("panel"+i).classList.toggle("active",i===state.currentStep);
$("btnBack").disabled=state.currentStep===0;
const next=$("btnNext");next.textContent=state.currentStep===2?"✨ Criar Livro Mágico":"Próximo →";next.disabled=!canProceedStep(state.currentStep);}
function selectTheme(themeKey){state.theme=themeKey||"";localStorage.setItem("theme",state.theme);document.querySelectorAll("[data-theme]").forEach(b=>{const active=b.getAttribute("data-theme")===state.theme;b.classList.toggle("active",active);});setStepUI();}
function selectStyle(styleKey){state.style=styleKey||"read";localStorage.setItem("style",state.style);document.querySelectorAll(".styleBtn").forEach(b=>{const active=b.getAttribute("data-style")===state.style;b.classList.toggle("active",active);});setStepUI();}
async function ensureBook(){
  if(state.bookId){
    try{
      const rr=await fetch("/api/status/"+encodeURIComponent(state.bookId),{method:"GET",headers:{"Accept":"application/json"}});
      if(rr.ok){const jj=await rr.json().catch(()=>({}));if(jj&&jj.ok) return state.bookId;}
      state.bookId="";localStorage.removeItem("bookId");
    }catch{state.bookId="";localStorage.removeItem("bookId");}
  }
  const r=await fetch("/api/create",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.ok||!j.id) throw new Error(j.error||"Falha ao criar book");
  state.bookId=j.id;localStorage.setItem("bookId",state.bookId);return state.bookId;
}
async function apiUploadPhotoAndMask(){
  if(!state.photo) throw new Error("Sem foto");
  if(!state.mask) throw new Error("Sem mask");
  await ensureBook(); if(!state.bookId) throw new Error("Sem bookId");
  const r=await fetch("/api/uploadPhoto",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:state.bookId,photo:state.photo,mask:state.mask})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.ok){
    const msg=String(j.error||"Falha ao enviar foto/mask");
    if(r.status===404&&msg.includes("book não existe")){
      state.bookId="";localStorage.removeItem("bookId");
      await ensureBook();
      const r2=await fetch("/api/uploadPhoto",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:state.bookId,photo:state.photo,mask:state.mask})});
      const j2=await r2.json().catch(()=>({}));
      if(!r2.ok||!j2.ok) throw new Error(j2.error||"Falha ao enviar foto/mask (retry)");
      return true;
    }
    throw new Error(msg);
  }
  return true;
}
function canGenerateWhy(){if(!state.photo) return "Envie a foto primeiro.";if(!state.mask) return "Mask não gerou. Reenvie a foto.";if(!state.childName||state.childName.trim().length<2) return "Digite o nome (mínimo 2 letras).";
if(!state.consent) return "Marque a autorização para continuar.";if(!state.theme) return "Selecione um tema.";if(!state.style) return "Selecione o estilo do livro.";return "";}
async function goToGenerateStep4(){
  setHint($("hintGen"),"");const why=canGenerateWhy();if(why){setHint($("hintGen"),why);return;}
  await ensureBook(); await apiUploadPhotoAndMask();
  localStorage.setItem("childName",state.childName.trim());
  localStorage.setItem("childAge",String(state.childAge));
  localStorage.setItem("childGender",state.childGender);
  localStorage.setItem("theme",state.theme);
  localStorage.setItem("style",state.style);
  localStorage.setItem("consent",state.consent?"1":"0");
  window.location.href="/generate";
}
const drop=$("drop");const file=$("file");
drop.addEventListener("click",()=>file.click());
drop.addEventListener("dragover",(e)=>{e.preventDefault();drop.classList.add("drag");});
drop.addEventListener("dragleave",()=>drop.classList.remove("drag"));
drop.addEventListener("drop",(e)=>{e.preventDefault();drop.classList.remove("drag");const f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f) handleFile(f);});
file.addEventListener("change",(e)=>{const f=e.target.files&&e.target.files[0];if(f) handleFile(f);});
async function handleFile(f){
  const hintPhoto=$("hintPhoto");
  if(!f.type||!f.type.startsWith("image/")) return setHint(hintPhoto,"Envie apenas imagens (JPG/PNG).");
  if(f.size>10*1024*1024) return setHint(hintPhoto,"Imagem muito grande. Máximo 10MB.");
  setHint(hintPhoto,"");
  const imgUrl=URL.createObjectURL(f);
  const img=new Image();
  img.onload=async()=>{
    try{
      const max=1024; let w=img.width,h=img.height;
      const scale=Math.min(1,max/Math.max(w,h));
      w=Math.max(1,Math.round(w*scale)); h=Math.max(1,Math.round(h*scale));
      const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
      const ctx=canvas.getContext("2d"); ctx.drawImage(img,0,0,w,h);
      const photoPng=canvas.toDataURL("image/png");
      const maskCanvas=document.createElement("canvas"); maskCanvas.width=w; maskCanvas.height=h;
      const maskPng=maskCanvas.toDataURL("image/png");
      URL.revokeObjectURL(imgUrl);
      state.photo=photoPng; state.mask=maskPng;
      localStorage.setItem("photo",photoPng); localStorage.setItem("mask",maskPng);
      showPhoto(photoPng);
      await ensureBook(); await apiUploadPhotoAndMask();
      setStepUI();
    }catch(err){setHint(hintPhoto,String(err.message||err||"Erro ao processar/enviar foto"));}
  };
  img.onerror=()=>{URL.revokeObjectURL(imgUrl);setHint($("hintPhoto"),"Falha ao abrir a imagem.");};
  img.src=imgUrl;
}
document.querySelectorAll("[data-theme]").forEach(btn=>btn.addEventListener("click",()=>selectTheme(btn.getAttribute("data-theme"))));
document.querySelectorAll(".styleBtn").forEach(btn=>btn.addEventListener("click",()=>selectStyle(btn.getAttribute("data-style"))));
$("childName").addEventListener("input",(e)=>{state.childName=e.target.value;localStorage.setItem("childName",state.childName);setStepUI();});
$("childAge").addEventListener("input",(e)=>{state.childAge=Number(e.target.value||"6");$("ageLabel").textContent=String(state.childAge);localStorage.setItem("childAge",String(state.childAge));setStepUI();});
$("childGender").addEventListener("change",(e)=>{state.childGender=e.target.value;localStorage.setItem("childGender",state.childGender);});
$("consent").addEventListener("change",(e)=>{state.consent=!!e.target.checked;localStorage.setItem("consent",state.consent?"1":"0");setStepUI();});
$("btnBack").addEventListener("click",()=>{if(state.currentStep<=0) return; state.currentStep-=1; setStepUI();});
$("btnNext").addEventListener("click",async()=>{
  if(state.currentStep===0){if(!canProceedStep(0)) return; state.currentStep=1; setStepUI(); return;}
  if(state.currentStep===1){if(!canProceedStep(1)) return; state.currentStep=2; setStepUI(); return;}
  if(state.currentStep===2){if(!canProceedStep(2)) return; await goToGenerateStep4();}
});
$("btnReset").addEventListener("click",()=>{localStorage.clear();location.reload();});
$("btnHome").addEventListener("click",()=>{if(state.currentStep<=0){window.location.href="/sales";return;} state.currentStep-=1; setStepUI();});
(function init(){
  showPhoto(state.photo);
  $("childName").value=state.childName;
  $("childAge").value=String(state.childAge);
  $("ageLabel").textContent=String(state.childAge);
  $("childGender").value=state.childGender;
  $("consent").checked=state.consent;
  if(state.theme) selectTheme(state.theme);
  selectStyle(state.style||"read");
  if(state.currentStep<0||state.currentStep>2) state.currentStep=0;
  setStepUI();
})();
</script></body></html>`);
}

app.get("/", requireAuth, renderGeneratorHtml);
app.get("/create", requireAuth, renderGeneratorHtml);

/* -------------------- API: create/upload/status/progress/generateNext -------------------- */

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

app.post("/api/uploadPhoto", async (req, res) => {
  try {
    const user = await requireAuthApi(req, res);
    if (!user) return;
    const photo = req.body?.photo;
    const mask = req.body?.mask;
// ✅ Aceita id por body (padrão), query (?id=) ou param (/api/generateNext/:id)
const id =
  String(req.body?.id || "").trim() ||
  String(req.query?.id || "").trim() ||
  String(req.params?.id || "").trim();

if (!id) return res.status(400).json({ ok: false, error: "id ausente" });
    if (!photo || !isDataUrl(photo)) return res.status(400).json({ ok: false, error: "photo ausente ou inválida (dataURL)" });
    if (!mask || !isDataUrl(mask)) return res.status(400).json({ ok: false, error: "mask ausente ou inválida (dataURL)" });

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

    // valida alinhamento
    const mi = await sharp(editBasePath).metadata();
    const mm = await sharp(maskBasePath).metadata();
    if ((mi?.width || 0) !== (mm?.width || 0) || (mi?.height || 0) !== (mm?.height || 0)) {
      throw new Error(`Falha ao alinhar base: image=${mi?.width}x${mi?.height}, mask=${mm?.width}x${mm?.height}`);
    }

    // ✅ upload persistente (Vercel-safe)
    const photoKey = `${user.id}/${id}/edit_base.png`;
    const maskKey = `${user.id}/${id}/mask_base.png`;

    const editBaseBuf = await fsp.readFile(editBasePath);
    const maskBaseBuf = await fsp.readFile(maskBasePath);

    await sbUploadBuffer({ pathKey: photoKey, contentType: "image/png", buffer: editBaseBuf });
    await sbUploadBuffer({ pathKey: maskKey, contentType: "image/png", buffer: maskBaseBuf });

    // guarda no manifest
    m.photo = { ok: true, file: path.basename(originalPath), mime, editBase: "edit_base.png", storageKey: photoKey };
    m.mask = { ok: true, file: "mask.png", editBase: "mask_base.png", storageKey: maskKey };

    m.updatedAt = nowISO();
    await saveManifestAll(user.id, id, m, { sbUser: req.sb });

    return res.json({ ok: true, base: { w: mi?.width, h: mi?.height }, storage: { photoKey, maskKey, photoPublic: sbPublicUrl(photoKey), maskPublic: sbPublicUrl(maskKey) } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

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
      m.status === "failed" ? "Falhou" :
      m.status === "done" ? "Livro pronto 🎉" :
      m.step?.startsWith("page_") ? "Gerando página…" :
      m.step === "cover" ? "Gerando capa…" :
      m.step === "story" ? "Criando história…" :
      m.step === "pdf" ? "Gerando PDF…" :
      "Preparando…";

    return res.json({
      ok: true,
      id: m.id,
      status: m.status,
      step: m.step,
      error: m.error || "",
      theme: m.theme || "",
      lastFetch: m.lastFetch || null,
      style: m.style || "read",
      doneSteps,
      totalSteps,
      message,
      coverUrl: m.cover?.url || "",
      images: (m.images || []).map((it) => ({ page: it.page, url: it.url || "" })),
      pdf: m.pdf || "",
      updatedAt: m.updatedAt || "",
      pending: m.pending || null,
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  }
});

/**
 * ✅ /api/generateNext — 1 passo por request
 * CORREÇÃO: define imagePngPath (antes não existia) e faz fallback do Storage quando disco não tem.
 */
/**
 * ✅ /api/generateNext — 1 passo por request (SEM lock duplicado)
 */
// ========================= FIX: /api/generateNext (1 passo por request) =========================
async function handleGenerateNext(req, res) {
  const user = await requireAuthApi(req, res);
  if (!user) return;

  const userId = String(user.id || req.user?.id || "");
  if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });

  // ✅ Aceita id por body (padrão), query (?id=) ou param (/api/generateNext/:id)
  const id =
    String(req.body?.id || "").trim() ||
    String(req.query?.id || "").trim() ||
    String(req.params?.id || "").trim();

  if (!id) return res.status(400).json({ ok: false, error: "id ausente" });

  const jobKey = `${userId}:${id}`;
  if (jobs.get(jobKey)?.running) {
    return res.status(409).json({ ok: false, error: "step já em execução (aguarde 1s e tente novamente)" });
  }
  jobs.set(jobKey, { running: true });

  const respond = async (manifest, extra = {}) => {
    // resposta no formato que sua /generate.page.js entende bem
    const totalSteps = 1 + 1 + 8 + 1; // story + cover + 8 pages + pdf
    const pagesDone = Array.isArray(manifest.images) ? manifest.images.filter((x) => x && x.url).length : 0;

    let doneSteps = 0;
    if (Array.isArray(manifest.pages) && manifest.pages.length >= 8) doneSteps += 1;
    if (manifest.cover?.ok) doneSteps += 1;
    doneSteps += Math.min(8, pagesDone);
    if (manifest.status === "done" && manifest.pdf) doneSteps += 1;

    const message =
      manifest.status === "failed" ? "Falhou" :
      manifest.status === "done" ? "Livro pronto 🎉" :
      manifest.step?.startsWith("page_") ? "Gerando página…" :
      manifest.step === "cover" ? "Gerando capa…" :
      manifest.step === "story" ? "Criando história…" :
      manifest.step === "pdf" ? "Gerando PDF…" :
      "Preparando…";

    return res.json({
      ok: true,
      id: manifest.id,
      status: manifest.status,
      step: manifest.step,
      error: manifest.error || "",
      theme: manifest.theme || "",
      style: manifest.style || "read",
      doneSteps,
      totalSteps,
      message,
      coverUrl: manifest.cover?.url || "",
      images: (manifest.images || []).map((it) => ({ page: it.page, url: it.url || "" })),
      pdf: manifest.pdf || "",
      updatedAt: manifest.updatedAt || "",
      ...extra,
    });
  };

  // Converte output do Replicate em PNG buffer (suporta string url, dataURL, array, obj{url}, etc.)
  const replicateOutputToPngBuffer = async (pred) => {
    let out = pred?.output;

    if (typeof out === "string" && out.startsWith("http")) {
      const buf = await downloadToBuffer(out, 300000);
      return await sharp(buf).png().toBuffer();
    }

    if (typeof out === "string" && out.startsWith("data:")) {
      const b = dataUrlToBuffer(out);
      if (!b) throw new Error("Replicate retornou dataURL inválida.");
      return await sharp(b).png().toBuffer();
    }

    if (Array.isArray(out) && typeof out[0] === "string") {
      const first = out[0];
      if (first.startsWith("http")) {
        const buf = await downloadToBuffer(first, 300000);
        return await sharp(buf).png().toBuffer();
      }
      if (first.startsWith("data:")) {
        const b = dataUrlToBuffer(first);
        if (!b) throw new Error("Replicate retornou dataURL inválida (array).");
        return await sharp(b).png().toBuffer();
      }
    }

    if (out && typeof out === "object" && typeof out.url === "string") {
      const buf = await downloadToBuffer(out.url, 300000);
      return await sharp(buf).png().toBuffer();
    }

    if (Array.isArray(out) && out[0] && typeof out[0] === "object" && typeof out[0].url === "string") {
      const buf = await downloadToBuffer(out[0].url, 300000);
      return await sharp(buf).png().toBuffer();
    }

    throw new Error("Replicate não retornou imagem válida. Output=" + JSON.stringify(out).slice(0, 800));
  };

  try {
    // --- carrega manifest (disk/db) ---
    let m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });
    if (!canAccessBook(userId, m, req.user)) return res.status(403).json({ ok: false, error: "forbidden" });

    // --- aplica payload do front (nome/idade/gênero/tema/estilo) ---
    const body = req.body || {};
    const childName = String(body.childName || "").trim();
    const childAge = Number(body.childAge || m.child?.age || 6);
    const childGender = String(body.childGender || m.child?.gender || "neutral");
    const theme = String(body.theme || m.theme || "space").trim();
    const style = String(body.style || m.style || "read").trim();

    if (childName) m.child = Object.assign({}, m.child, { name: childName });
    if (Number.isFinite(childAge)) m.child = Object.assign({}, m.child, { age: clamp(childAge, 2, 12) });
    if (childGender) m.child = Object.assign({}, m.child, { gender: childGender });
    if (theme) m.theme = theme;
    if (style) m.style = style;

    // status inicial
    if (!m.status || m.status === "created") m.status = "generating";
    if (!m.step || m.step === "created") m.step = "story";
    m.updatedAt = nowISO();
    await saveManifestAll(userId, id, m, { sbUser: req.sb });

    const bookDir = bookDirOf(userId, id);
    await ensureDir(bookDir);

    // --- garante bases no disco (Vercel-safe) ---
    const imagePngPath = path.join(bookDir, m.photo?.editBase || "edit_base.png");
    const maskPngPath  = path.join(bookDir, m.mask?.editBase  || "mask_base.png");

    await ensureFileFromStorageIfMissing(imagePngPath, m.photo?.storageKey || "");
    await ensureFileFromStorageIfMissing(maskPngPath,  m.mask?.storageKey  || "");

    if (!existsSyncSafe(imagePngPath)) throw new Error("edit_base.png não encontrada. Reenvie a foto.");
    if (!existsSyncSafe(maskPngPath))  throw new Error("mask_base.png não encontrada. Reenvie a foto.");

    // --- helpers de resposta (mesmo formato do /api/progress) ---
    const buildProgress = async (mm, extra = {}) => {
      const totalSteps = 1 + 1 + 8 + 1; // story + cover + 8 pages + pdf
      const pagesDone = Array.isArray(mm.images) ? mm.images.filter((x) => x && (x.url || x.storageKey)).length : 0;

      let doneSteps = 0;
      if (Array.isArray(mm.pages) && mm.pages.length >= 8) doneSteps += 1;
      if (mm.cover?.ok) doneSteps += 1;
      doneSteps += Math.min(8, pagesDone);
      if (mm.status === "done" && (mm.pdf || mm.pdfStorageKey)) doneSteps += 1;

      const message =
        mm.status === "failed" ? "Falhou" :
        mm.status === "done" ? "Livro pronto 🎉" :
        String(mm.step || "").startsWith("page_") ? "Gerando página…" :
        mm.step === "cover" ? "Gerando capa…" :
        mm.step === "story" ? "Criando história…" :
        mm.step === "pdf" ? "Gerando PDF…" :
        "Preparando…";

      const coverUrl = mm.cover?.ok ? (mm.cover?.url || "") : "";
      const images = (mm.images || []).map((it) => ({ page: it.page, url: it.url || "" }));

      return Object.assign(
        {
          ok: true,
          id: mm.id,
          status: mm.status || "created",
          step: mm.step || "created",
          error: mm.error || "",
          theme: mm.theme || "",
          style: mm.style || "read",
          doneSteps,
          totalSteps,
          message,
          coverUrl,
          images,
          pdf: mm.pdf || "",
          updatedAt: mm.updatedAt || "",
          lastFetch: mm.lastFetch || null,
        },
        extra
      );
    };

    const extractReplicateOutputUrl = (pred) => {
      const out = pred?.output;

      if (typeof out === "string" && out.startsWith("http")) return out;
      if (typeof out === "string" && out.startsWith("data:")) return out;

      if (Array.isArray(out) && typeof out[0] === "string") return out[0];

      if (out && typeof out === "object" && typeof out.url === "string") return out.url;

      if (Array.isArray(out) && out[0] && typeof out[0] === "object" && typeof out[0].url === "string") return out[0].url;

      return "";
    };

    const pngBufferFromReplicateOutput = async (urlOrData) => {
      if (!urlOrData) throw new Error("Replicate: output vazio.");
      if (String(urlOrData).startsWith("data:")) {
        const b = dataUrlToBuffer(urlOrData);
        if (!b) throw new Error("Replicate retornou dataURL inválida.");
        return await sharp(b).png().toBuffer();
      }
      if (String(urlOrData).startsWith("http")) {
        const buf = await downloadToBuffer(urlOrData, 240000);
        return await sharp(buf).png().toBuffer();
      }
      throw new Error("Replicate output não reconhecido.");
    };

    const ensureAdminForStorage = () => {
      if (!supabaseAdmin) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente (precisa para salvar imagens/pdf no Storage).");
    };

    // =========================================================
    // PASSO 1: STORY (rápido, pode fazer no mesmo request)
    // =========================================================
    m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) throw new Error("Manifest sumiu");

    if (!Array.isArray(m.pages) || m.pages.length < 8) {
      m.status = "generating";
      m.step = "story";
      m.error = "";
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
      m.step = "cover";
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      return res.json(await buildProgress(m));
    }

    // =========================================================
    // PASSO 2: COVER (Replicate job incremental: cria / poll)
    // =========================================================
    m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) throw new Error("Manifest sumiu");

    // =========================================================
// PASSO 2: COVER (Replicate job incremental: cria / poll)
// =========================================================
m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
if (!m) throw new Error("Manifest sumiu");

if (!m.cover?.ok) {
  m.status = "generating";
  m.step = "cover";
  m.error = "";
  m.updatedAt = nowISO();

  // ✅ watchdog: se pending ficou velho demais, reseta pra recriar
  if (m.pending && m.pending.kind === "cover" && isPendingTooOld(m.pending)) {
    console.warn("⚠️ pending cover muito antigo, resetando:", m.pending);
    m.pending = null;
  }

  await saveManifestAll(userId, id, m, { sbUser: req.sb });

  // se não existe job, cria
  if (!m.pending || m.pending.kind !== "cover" || !m.pending.pid) {
    ensureAdminForStorage(); // vamos precisar salvar cover_final no Storage

    const prompt = buildCoverPrompt({
      themeKey: m.theme,
      childName: m.child?.name,
      styleKey: m.style || "read",
    });

    const imgBuf = await fsp.readFile(imagePngPath);
    const imgDataUrl = bufferToDataUrlPng(imgBuf);

    const pid = await replicateCreateImageJob({ prompt, imageDataUrl: imgDataUrl });

    m.pending = { kind: "cover", pid, createdAt: nowISO() };
    m.updatedAt = nowISO();
    await saveManifestAll(userId, id, m, { sbUser: req.sb });

    return res.json(await buildProgress(m, { nextTryAt: Date.now() + 3000, pending: m.pending }));
  }

  // tem job: poll once (com auto-retry se 404)
  let pred;
  try {
    pred = await replicatePollOnce(m.pending.pid);
  } catch (e) {
    const msg = String(e?.message || e);
    // ✅ se prediction sumiu/404, reseta e recria
    if (msg.includes("HTTP 404") || msg.toLowerCase().includes("not found")) {
      console.warn("⚠️ replicate pid não encontrado, resetando pending:", m.pending?.pid);
      m.pending = null;
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });
      return res.json(await buildProgress(m, { nextTryAt: Date.now() + 1500, pending: null }));
    }
    throw e;
  }

  const st = String(pred?.status || "");

  if (st === "succeeded") {
    const outUrl = extractReplicateOutputUrl(pred);
    const coverBuf = await pngBufferFromReplicateOutput(outUrl);

    const coverBase = path.join(bookDir, "cover.png");
    await fsp.writeFile(coverBase, coverBuf);

    const coverFinal = path.join(bookDir, "cover_final.png");
    await stampCoverTextOnImage({
      inputPath: coverBase,
      outputPath: coverFinal,
      title: "Meu Livro Mágico",
      subtitle: `A aventura de ${m.child?.name || "Criança"} • ${themeLabel(m.theme)}`,
    });

    const key = `${m.ownerId || userId}/${id}/cover_final.png`;
    await sbUploadBuffer({ pathKey: key, contentType: "image/png", buffer: await fsp.readFile(coverFinal) });

    m.cover = {
      ok: true,
      file: "cover_final.png",
      url: `/api/image/${encodeURIComponent(id)}/${encodeURIComponent("cover_final.png")}`,
      storageKey: key,
    };
    m.pending = null;
    m.step = "page_1";
    m.updatedAt = nowISO();
    await saveManifestAll(userId, id, m, { sbUser: req.sb });

    return res.json(await buildProgress(m));
  }

  if (st === "failed" || st === "canceled") {
    const err = String(pred?.error || "Prediction falhou no Replicate.");
    if (isHighDemandError(err)) {
      return res.json(await buildProgress(m, { error: err, nextTryAt: Date.now() + 6000, pending: m.pending }));
    }

    m.status = "failed";
    m.step = "failed";
    m.error = err;
    m.pending = null;
    m.updatedAt = nowISO();
    await saveManifestAll(userId, id, m, { sbUser: req.sb });

    return res.json(await buildProgress(m));
  }

  // ainda processando
  return res.json(await buildProgress(m, { nextTryAt: Date.now() + 3000, pending: m.pending, replicateStatus: st }));
}

    // =========================================================
    // PASSO 3: PAGES (1 página por vez, com pending job)
    // =========================================================
    m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) throw new Error("Manifest sumiu");

    const pages = Array.isArray(m.pages) ? m.pages : [];
    const images = Array.isArray(m.images) ? m.images : [];
    const nextPage = images.length + 1;

    if (nextPage <= 8) {
      m.status = "generating";
      m.step = `page_${nextPage}`;
      m.error = "";
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      const pageObj = pages.find((p) => Number(p.page) === nextPage) || pages[nextPage - 1];
      if (!pageObj) throw new Error("Página da história não encontrada.");

      // cria job se não existir
      // =========================================================
// PASSO 3: PAGES (1 página por vez, com pending job)
// =========================================================
m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
if (!m) throw new Error("Manifest sumiu");

const pages = Array.isArray(m.pages) ? m.pages : [];
const images = Array.isArray(m.images) ? m.images : [];
const nextPage = images.length + 1;

if (nextPage <= 8) {
  m.status = "generating";
  m.step = `page_${nextPage}`;
  m.error = "";
  m.updatedAt = nowISO();

  // ✅ watchdog: se pending page ficou velho demais, reseta pra recriar
  if (m.pending && m.pending.kind === "page" && m.pending.page === nextPage && isPendingTooOld(m.pending)) {
    console.warn("⚠️ pending page muito antigo, resetando:", m.pending);
    m.pending = null;
  }

  await saveManifestAll(userId, id, m, { sbUser: req.sb });

  const pageObj = pages.find((p) => Number(p.page) === nextPage) || pages[nextPage - 1];
  if (!pageObj) throw new Error("Página da história não encontrada.");

  // cria job se não existir
  if (!m.pending || m.pending.kind !== "page" || m.pending.page !== nextPage || !m.pending.pid) {
    ensureAdminForStorage();

    const prompt = buildScenePromptFromParagraph({
      paragraphText: pageObj.text,
      themeKey: m.theme,
      childName: m.child?.name,
      styleKey: m.style || "read",
    });

    const imgBuf = await fsp.readFile(imagePngPath);
    const imgDataUrl = bufferToDataUrlPng(imgBuf);

    const pid = await replicateCreateImageJob({ prompt, imageDataUrl: imgDataUrl });

    m.pending = { kind: "page", page: nextPage, pid, createdAt: nowISO(), prompt };
    m.updatedAt = nowISO();
    await saveManifestAll(userId, id, m, { sbUser: req.sb });

    return res.json(await buildProgress(m, {
      nextTryAt: Date.now() + 3000,
      pending: m.pending
    }));
  }

  // poll job (com auto-retry se 404)
  let pred;
  try {
    pred = await replicatePollOnce(m.pending.pid);
  } catch (e) {
    const msg = String(e?.message || e);

    // ✅ se prediction sumiu/404, reseta e recria
    if (msg.includes("HTTP 404") || msg.toLowerCase().includes("not found")) {
      console.warn("⚠️ replicate pid não encontrado (page), resetando pending:", m.pending?.pid);
      m.pending = null;
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      return res.json(await buildProgress(m, {
        nextTryAt: Date.now() + 1500,
        pending: null
      }));
    }

    throw e;
  }

  const st = String(pred?.status || "");

  if (st === "succeeded") {
    const outUrl = extractReplicateOutputUrl(pred);
    const imgBuf2 = await pngBufferFromReplicateOutput(outUrl);

    const baseName = `page_${String(nextPage).padStart(2, "0")}.png`;
    const finalName = `page_${String(nextPage).padStart(2, "0")}_final.png`;

    const basePath = path.join(bookDir, baseName);
    await fsp.writeFile(basePath, imgBuf2);

    const finalPath = path.join(bookDir, finalName);
    await stampStoryTextOnImage({
      inputPath: basePath,
      outputPath: finalPath,
      title: pageObj.title,
      text: pageObj.text,
    });

    const key = `${m.ownerId || userId}/${id}/${finalName}`;
    await sbUploadBuffer({ pathKey: key, contentType: "image/png", buffer: await fsp.readFile(finalPath) });

    images.push({
      page: nextPage,
      file: finalName,
      url: `/api/image/${encodeURIComponent(id)}/${encodeURIComponent(finalName)}`,
      storageKey: key,
      prompt: m.pending.prompt || "",
    });

    m.images = images;
    m.pending = null;
    m.step = nextPage < 8 ? `page_${nextPage + 1}` : "pdf";
    m.updatedAt = nowISO();
    await saveManifestAll(userId, id, m, { sbUser: req.sb });

    return res.json(await buildProgress(m));
  }

  if (st === "failed" || st === "canceled") {
    const err = String(pred?.error || "Prediction falhou no Replicate.");
    if (isHighDemandError(err)) {
      return res.json(await buildProgress(m, {
        error: err,
        nextTryAt: Date.now() + 6000,
        pending: m.pending,
        replicateStatus: st
      }));
    }

    m.status = "failed";
    m.step = "failed";
    m.error = err;
    m.pending = null;
    m.updatedAt = nowISO();
    await saveManifestAll(userId, id, m, { sbUser: req.sb });

    return res.json(await buildProgress(m));
  }

  // ainda processando
  return res.json(await buildProgress(m, {
    nextTryAt: Date.now() + 3000,
    pending: m.pending,
    replicateStatus: st
  }));
}

      // poll job
      const pred = await replicatePollOnce(m.pending.pid);
      const st = String(pred?.status || "");

      if (st === "succeeded") {
        const outUrl = extractReplicateOutputUrl(pred);
        const imgBuf = await pngBufferFromReplicateOutput(outUrl);

        const baseName = `page_${String(nextPage).padStart(2, "0")}.png`;
        const finalName = `page_${String(nextPage).padStart(2, "0")}_final.png`;

        const basePath = path.join(bookDir, baseName);
        await fsp.writeFile(basePath, imgBuf);

        const finalPath = path.join(bookDir, finalName);
        await stampStoryTextOnImage({
          inputPath: basePath,
          outputPath: finalPath,
          title: pageObj.title,
          text: pageObj.text,
        });

        const key = `${m.ownerId || userId}/${id}/${finalName}`;
        await sbUploadBuffer({ pathKey: key, contentType: "image/png", buffer: await fsp.readFile(finalPath) });

        images.push({
          page: nextPage,
          file: finalName,
          url: `/api/image/${encodeURIComponent(id)}/${encodeURIComponent(finalName)}`,
          storageKey: key,
          prompt: m.pending.prompt || "",
        });

        m.images = images;
        m.pending = null;
        m.step = nextPage < 8 ? `page_${nextPage + 1}` : "pdf";
        m.updatedAt = nowISO();
        await saveManifestAll(userId, id, m, { sbUser: req.sb });

        return res.json(await buildProgress(m));
      }

      if (st === "failed" || st === "canceled") {
        const err = String(pred?.error || "Prediction falhou no Replicate.");
        if (isHighDemandError(err)) {
          return res.json(await buildProgress(m, { error: err, nextTryAt: Date.now() + 6000 }));
        }

        m.status = "failed";
        m.step = "failed";
        m.error = err;
        m.pending = null;
        m.updatedAt = nowISO();
        await saveManifestAll(userId, id, m, { sbUser: req.sb });

        return res.json(await buildProgress(m));
      }

      return res.json(await buildProgress(m, { nextTryAt: Date.now() + 3000 }));
    }

    // =========================================================
    // PASSO 4: PDF (gera e sobe no Storage)
    // =========================================================
    m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) throw new Error("Manifest sumiu");

    if (m.status !== "done") {
      ensureAdminForStorage();

      m.status = "generating";
      m.step = "pdf";
      m.error = "";
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      const coverPath = path.join(bookDir, "cover_final.png");
      await ensureFileFromStorageIfMissing(coverPath, m.cover?.storageKey || `${m.ownerId || userId}/${id}/cover_final.png`);

      const pagePaths = (m.images || [])
        .slice(0, 8)
        .map((it) => path.join(bookDir, it.file || ""));

      // tenta materializar páginas do storage se faltar
      for (const it of (m.images || []).slice(0, 8)) {
        const fp = path.join(bookDir, it.file || "");
        if (!existsSyncSafe(fp)) {
          const key = it.storageKey || `${m.ownerId || userId}/${id}/${it.file}`;
          await ensureFileFromStorageIfMissing(fp, key);
        }
      }

      const pdfPath = await makePdfImagesOnly({
        bookId: id,
        coverPath,
        pageImagePaths: pagePaths,
        outputDir: bookDir,
      });

      const pdfKey = `${m.ownerId || userId}/${id}/book-${id}.pdf`;
      await sbUploadBuffer({ pathKey: pdfKey, contentType: "application/pdf", buffer: await fsp.readFile(pdfPath) });

      m.status = "done";
      m.step = "done";
      m.error = "";
      m.pdf = `/download/${encodeURIComponent(id)}`;
      m.pdfStorageKey = pdfKey;
      m.updatedAt = nowISO();
      await saveManifestAll(userId, id, m, { sbUser: req.sb });

      return res.json(await buildProgress(m));
    }

    // já pronto
    return res.json(await buildProgress(m));
  } catch (e) {
    // marca erro no manifest (sem perder lock)
    try {
      let mm = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
      if (mm) {
        const errMsg = String(e?.message || e || "Erro");
        // se for high demand, não mata o livro
        if (isHighDemandError(errMsg)) {
          mm.status = "generating";
          mm.error = errMsg;
          mm.updatedAt = nowISO();
          await saveManifestAll(userId, id, mm, { sbUser: req.sb });
          return res.json(await (async () => {
            const p = await (async () => {
              const totalSteps = 11;
              return { ok: true, id: mm.id, status: mm.status, step: mm.step, error: mm.error, theme: mm.theme, style: mm.style, doneSteps: 0, totalSteps, message: "Serviço ocupado…", coverUrl: mm.cover?.url || "", images: (mm.images||[]).map(x=>({page:x.page,url:x.url||""})), pdf: mm.pdf||"", updatedAt: mm.updatedAt };
            })();
            return Object.assign(p, { nextTryAt: Date.now() + 7000 });
          })());
        }

        mm.status = "failed";
        mm.step = "failed";
        mm.error = errMsg;
        mm.updatedAt = nowISO();
        await saveManifestAll(userId, id, mm, { sbUser: req.sb });
      }
    } catch {}

    return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
  } finally {
    jobs.set(jobKey, { running: false });
  }
}
// ======================= END FIX: /api/generateNext =======================
app.post("/api/generateNext", handleGenerateNext);
app.post("/api/generateNext/:id", handleGenerateNext);
/* -------------------- runGeneration (full sequential) -------------------- */

async function runGeneration(userId, bookId) {
  const jobKey = `${userId}:${bookId}`;
  const bookDir = bookDirOf(userId, bookId);

  let m = await loadManifestAll(userId, bookId, { sbUser: null, allowAdminFallback: true });
  if (!m) {
    jobs.set(jobKey, { running: false });
    return;
  }

  const setStep = async (step, extra = {}) => {
    const mm = await loadManifestAll(userId, bookId, { sbUser: null, allowAdminFallback: true });
    if (!mm) return;
    mm.step = step;
    mm.updatedAt = nowISO();
    Object.assign(mm, extra);
    await saveManifestAll(userId, bookId, mm, { sbUser: null });
  };

  const fail = async (err) => {
    const mm = await loadManifestAll(userId, bookId, { sbUser: null, allowAdminFallback: true });
    if (!mm) return;
    mm.status = "failed";
    mm.step = "failed";
    mm.error = String(err?.message || err || "Erro");
    mm.updatedAt = nowISO();
    await saveManifestAll(userId, bookId, mm, { sbUser: null });
  };

  try {
    await ensureDir(bookDir);

    const imagePngPath = path.join(bookDir, m.photo?.editBase || "edit_base.png");
    const maskPngPath = path.join(bookDir, m.mask?.editBase || "mask_base.png");

    await ensureFileFromStorageIfMissing(imagePngPath, m.photo?.storageKey || "");
    await ensureFileFromStorageIfMissing(maskPngPath, m.mask?.storageKey || "");

    if (!existsSyncSafe(imagePngPath)) throw new Error("edit_base.png não encontrada. Reenvie a foto.");
    if (!existsSyncSafe(maskPngPath)) throw new Error("mask_base.png não encontrada. Reenvie a foto.");

    const styleKey = String(m.style || "read").trim();

    await setStep("story");
    const pages = await generateStoryTextPages({
      childName: m.child?.name,
      childAge: m.child?.age,
      childGender: m.child?.gender,
      themeKey: m.theme,
      pagesCount: 8,
    });
    await setStep("story_done", { pages });

    await setStep("cover");
    const coverPrompt = buildCoverPrompt({
      themeKey: m.theme,
      childName: m.child?.name,
      styleKey,
    });

    const coverBuf = await openaiImageEditFromReference({
      imagePngPath,
      maskPngPath,
      prompt: coverPrompt,
      size: "1024x1024",
    });

    const coverBase = path.join(bookDir, "cover.png");
    await fsp.writeFile(coverBase, coverBuf);

    const coverFinal = path.join(bookDir, "cover_final.png");
    await stampCoverTextOnImage({
      inputPath: coverBase,
      outputPath: coverFinal,
      title: "Meu Livro Mágico",
      subtitle: `A aventura de ${m.child?.name || "Criança"} • ${themeLabel(m.theme)}`,
    });

    m = await loadManifestAll(userId, bookId, { sbUser: null, allowAdminFallback: true });
    if (m) {
      m.cover = {
        ok: true,
        file: path.basename(coverFinal),
        url: `/api/image/${encodeURIComponent(bookId)}/${encodeURIComponent(path.basename(coverFinal))}`,
      };
      m.updatedAt = nowISO();
      await saveManifestAll(userId, bookId, m, { sbUser: null });
    }

    const images = [];
    for (const p of pages) {
      await setStep(`image_${p.page}`);

      const prompt = buildScenePromptFromParagraph({
        paragraphText: p.text,
        themeKey: m.theme,
        childName: m.child?.name,
        styleKey,
      });

      const imgBuf = await openaiImageEditFromReference({
        imagePngPath,
        maskPngPath,
        prompt,
        size: "1024x1024",
      });

      const basePath = path.join(bookDir, `page_${String(p.page).padStart(2, "0")}.png`);
      await fsp.writeFile(basePath, imgBuf);

      const finalPath = path.join(bookDir, `page_${String(p.page).padStart(2, "0")}_final.png`);
      await stampStoryTextOnImage({
        inputPath: basePath,
        outputPath: finalPath,
        title: p.title,
        text: p.text,
      });

      images.push({
        page: p.page,
        path: finalPath,
        prompt,
        url: `/api/image/${encodeURIComponent(bookId)}/${encodeURIComponent(path.basename(finalPath))}`,
      });

      const mm = await loadManifestAll(userId, bookId, { sbUser: null, allowAdminFallback: true });
      if (mm) {
        mm.images = images;
        mm.updatedAt = nowISO();
        await saveManifestAll(userId, bookId, mm, { sbUser: null });
      }
    }

    await setStep("images_done", { images });

    await setStep("pdf");
    const coverPath = path.join(bookDir, "cover_final.png");
    const pageImagePaths = images.map((it) => it.path);

    await makePdfImagesOnly({
      bookId,
      coverPath,
      pageImagePaths,
      outputDir: bookDir,
    });

    m = await loadManifestAll(userId, bookId, { sbUser: null, allowAdminFallback: true });
    if (!m) throw new Error("Manifest sumiu");

    m.status = "done";
    m.step = "done";
    m.error = "";
    m.pdf = `/download/${encodeURIComponent(bookId)}`;
    m.updatedAt = nowISO();
    await saveManifestAll(userId, bookId, m, { sbUser: null });
  } catch (e) {
    await fail(e);
  } finally {
    jobs.set(jobKey, { running: false });
  }
}

/* -------------------- /api/image + /download (com fallback Storage) -------------------- */
app.get("/api/debug-openai", requireAuth, async (req, res) => {
  try {
    const r = await openaiFetchJson(
      "https://api.openai.com/v1/responses",
      { model: TEXT_MODEL, input: "ping" },
      20000
    );
    return res.json({ ok: true, ping: true, output: r?.output?.[0]?.content?.[0]?.text || "" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
// ✅ Mostra a última chamada de rede capturada (pra descobrir o "fetch failed")
app.get("/api/debug-lastfetch", requireAuth, (req, res) => {
  return res.json({ ok: true, last: NET_LAST });
});
app.get("/api/debug-manifest/:id", requireAuth, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "id ausente" });

    const m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) return res.status(404).json({ ok: false, error: "book não existe" });
    if (!canAccessBook(userId, m, req.user)) return res.status(403).json({ ok: false, error: "forbidden" });

    return res.json({ ok: true, manifest: m });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
app.get("/api/debug-net", requireAuth, async (req, res) => {
  const out = { ok: true, openai: null, replicate: null, last: NET_LAST };

  // Teste OpenAI (texto)
  try {
    const r = await openaiFetchJson(
      "https://api.openai.com/v1/responses",
      { model: TEXT_MODEL, input: "ping" },
      20000
    );
    out.openai = { ok: true, sample: r?.output?.[0]?.content?.[0]?.text || "" };
  } catch (e) {
    out.openai = { ok: false, error: String(e?.message || e) };
  }

  // Teste Replicate (se tiver token)
  if (!REPLICATE_API_TOKEN) {
    out.replicate = { ok: false, error: "REPLICATE_API_TOKEN ausente" };
    out.last = NET_LAST;
    return res.json(out);
  }

  try {
    // Só um GET simples pra validar rede + token
    const r = await fetchJson("https://api.replicate.com/v1/predictions", {
      method: "GET",
      timeoutMs: 20000,
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    });
    out.replicate = { ok: true, info: "GET /predictions OK", keys: Object.keys(r || {}) };
  } catch (e) {
    out.replicate = { ok: false, error: String(e?.message || e) };
  }

  out.last = NET_LAST;
  return res.json(out);
});

app.get("/api/image/:id/:file", requireAuth, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).send("not_logged_in");

    const id = String(req.params?.id || "").trim();
    const file = String(req.params?.file || "").trim();
    if (!id || !file) return res.status(400).send("bad request");

    if (
      id.includes("..") || id.includes("/") || id.includes("\\") ||
      file.includes("..") || file.includes("/") || file.includes("\\")
    ) return res.status(400).send("bad request");

    const m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) return res.status(404).send("not found");
    if (!canAccessBook(userId, m, req.user)) return res.status(403).send("forbidden");

    const fp = path.join(bookDirOf(userId, id), file);

// ✅ Se não existe no disco, tenta baixar do Storage.
// Se falhar (Vercel / permissões), REDIRECIONA para signedUrl (não dá 404).
if (!existsSyncSafe(fp)) {
  let key = "";

  if (file === "edit_base.png") key = m.photo?.storageKey || "";
  else if (file === "mask_base.png") key = m.mask?.storageKey || "";
  else if (file === "cover_final.png") key = m.cover?.storageKey || "";

  if (!key) {
    const img = (m.images || []).find((it) => String(it?.file || "") === file);
    key = img?.storageKey || "";
  }

  if (!key) {
    const owner = m.ownerId || userId;
    key = `${owner}/${id}/${file}`;
  }

  // 1) tenta materializar no disco via download (bom quando funciona)
  if (key) {
    await ensureFileFromStorageIfMissing(fp, key);
  }

  // 2) se ainda não existe, faz redirect para SIGNED URL (à prova de Vercel)
  if (!existsSyncSafe(fp)) {
    const signed = key ? await sbSignedUrl(key, 60 * 10) : "";
    if (signed) {
      res.setHeader("Cache-Control", "no-store");
      return res.redirect(302, signed);
    }
  }
}

if (!existsSyncSafe(fp)) {
  console.warn("❌ /api/image não encontrou:", { id, file });
  return res.status(404).send("not found");
}
res.setHeader("Cache-Control", "no-store");

const ext = String(path.extname(fp) || "").toLowerCase();
if (ext === ".png") res.type("png");
else if (ext === ".jpg" || ext === ".jpeg") res.type("jpg");
else if (ext === ".webp") res.type("webp");
else res.type("application/octet-stream");

res.send(fs.readFileSync(fp));
  } catch (e) {
    res.status(500).send(String(e?.message || e || "Erro"));
  }
});

app.get("/download/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || "";
    if (!userId) return;

    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).send("id ausente");

    const m = await loadManifestAll(userId, id, { sbUser: req.sb, allowAdminFallback: true });
    if (!m) return res.status(404).send("book não existe");
    if (!canAccessBook(userId, m, req.user)) return res.status(403).send("forbidden");
    if (m.status !== "done") return res.status(409).send("PDF ainda não está pronto");

   const pdfPath = path.join(bookDirOf(userId, id), `book-${id}.pdf`);

// tenta baixar do storage se não existir local
if (!existsSyncSafe(pdfPath)) {
  const key = m.pdfStorageKey || `${m.ownerId || userId}/${id}/book-${id}.pdf`;
  await ensureFileFromStorageIfMissing(pdfPath, key);

  if (!existsSyncSafe(pdfPath)) {
    const signed = await sbSignedUrl(key, 60 * 15);
    if (signed) return res.redirect(302, signed);
    return res.status(404).send("pdf não encontrado");
  }
}

res.setHeader("Content-Type", "application/pdf");
res.setHeader("Content-Disposition", `attachment; filename="livro-${id}.pdf"`);
fs.createReadStream(pdfPath).pipe(res);
  } catch (e) {
    res.status(500).send(String(e?.message || e || "Erro"));
  }
});
app.get("/api/whoami", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    id: String(req.user?.id || ""),
    email: String(req.user?.email || ""),
  });
});
/* -------------------- Start server (local) / export (vercel) -------------------- */

(async () => {
  await ensureDir(OUT_DIR);
  await ensureDir(BOOKS_DIR);

  if (process.env.VERCEL) {
    console.log("✅ Rodando na Vercel (serverless) — exportando app");
    return;
  }

  app.listen(PORT, () => {
    console.log("===============================================");
    console.log(`📚 Meu Livro Mágico — SEQUENCIAL (Supabase Auth + RLS)`);
    console.log(`✅ http://localhost:${PORT}`);
    console.log(`🛒 Página de Vendas: http://localhost:${PORT}/sales`);
    console.log(`✨ Gerador:          http://localhost:${PORT}/create`);
    console.log(`⏳ Step 4 Gerando:   http://localhost:${PORT}/generate`);
    console.log("-----------------------------------------------");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log("❌ SUPABASE_URL / SUPABASE_ANON_KEY NÃO configurados.");
      console.log("   ➜ Configure no .env.local para login funcionar.");
    } else {
      console.log("✅ SUPABASE ANON OK");
      console.log("✅ Cookies: sb_token (access) + sb_refresh (refresh) com refresh automático");
    }

    if (supabaseAdmin) console.log("✅ SUPABASE SERVICE ROLE OK (sync background + profiles + storage)");
    else console.log("⚠️  SUPABASE_SERVICE_ROLE_KEY ausente -> uploads no Storage vão falhar.");

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
    } else {
      console.log("⚠️  REPLICATE_API_TOKEN NÃO configurado -> usando fallback OpenAI Images.");
      console.log("ℹ️  IMAGE_MODEL:", IMAGE_MODEL);
    }

    console.log("✅ Estilos: read (leitura) | color (leitura + colorir)");
    console.log("===============================================");
  });
})();

module.exports = app;