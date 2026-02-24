"use strict";
const path = require("path");
const { fsp, existsSyncSafe, readJson, writeJson, nowIso, clampInt, fmtDateBR, urlToFsPath, pad2, isFinalOrEdited } = require("./utils");
const { themeLabel, styleLabel } = require("./labels");
function resolveBooksDir({ BOOKS_DIR, OUT_DIR }) {
  // prioridade: BOOKS_DIR explícito
  if (BOOKS_DIR) return BOOKS_DIR;
  // fallback: OUT_DIR/books
  if (OUT_DIR) return path.join(OUT_DIR, "books");
  // último caso: null
  return null;
}
async function findManifestPath({ BOOKS_DIR, id }) {
  // suporta: book.json (antigo) e book-<id>.json (novo)
  const p1 = path.join(BOOKS_DIR, id, "book.json");
  if (existsSyncSafe(p1)) return p1;

  const p2 = path.join(BOOKS_DIR, id, `book-${id}.json`);
  if (existsSyncSafe(p2)) return p2;

  // fallback: qualquer book-*.json dentro da pasta (por garantia)
  try {
    const dir = path.join(BOOKS_DIR, id);
    const files = await fsp.readdir(dir).catch(() => []);
    const pick = files.find((f) => /^book-.*\.json$/i.test(f));
    if (pick) return path.join(dir, pick);
  } catch {}

  return null;
}
function pdfCandidatesFor({ BOOKS_DIR, id }) {
  // aceita múltiplos formatos (novo e legado)
  return [
    path.join(BOOKS_DIR, id, `book-${id}.pdf`), // ✅ novo (dentro da pasta)
    path.join(BOOKS_DIR, `${id}.pdf`),          // ✅ legado (solto)
    path.join(BOOKS_DIR, id, `${id}.pdf`),      // ✅ variação (dentro da pasta)
  ];
}

function hasPdfFor({ BOOKS_DIR, id, status }) {
  if (String(status || "") !== "done") return false;
  const cands = pdfCandidatesFor({ BOOKS_DIR, id });
  return cands.some((p) => existsSyncSafe(p));
}

async function listBooks({ BOOKS_DIR, OUT_DIR }) {
  BOOKS_DIR = resolveBooksDir({ BOOKS_DIR, OUT_DIR });
  if (!BOOKS_DIR || !existsSyncSafe(BOOKS_DIR)) return [];

  const items = await fsp.readdir(BOOKS_DIR, { withFileTypes: true });
  const ids = items.filter((d) => d.isDirectory()).map((d) => d.name);

  const out = [];
  for (const id of ids) {
    const manifestPath = await findManifestPath({ BOOKS_DIR, id });
if (!manifestPath) continue;

try {
  const m = await readJson(manifestPath);

      const pdfFsPath = pdfPathFor({ BOOKS_DIR, id });
      const hasPdf = existsSyncSafe(pdfFsPath) && String(m?.status || "") === "done";

      const coverUrl =
        m?.overrides?.coverUrl
          ? String(m.overrides.coverUrl)
          : m?.cover?.url
          ? String(m.cover.url)
          : m?.coverUrl
          ? String(m.coverUrl)
          : "";

      const dirId = String(id);
      const bookId = String(m?.id || dirId);

      out.push({
        id: bookId,
        dirId,
        status: String(m?.status || "created"),
        step: String(m?.step || ""),
        error: String(m?.error || ""),
        theme: String(m?.theme || ""),
        themeLabel: themeLabel(m?.theme),
        style: String(m?.style || "read"),
        styleLabel: styleLabel(m?.style),
        childName: String(m?.child?.name || ""),
        updatedAt: String(m?.updatedAt || m?.createdAt || ""),
        createdAt: String(m?.createdAt || ""),
        coverUrl,
        imagesCount: Array.isArray(m?.images) ? m.images.length : 0,
        hasPdf,
        pdfUrl: hasPdf ? `/download/${encodeURIComponent(dirId)}` : "",
      });
    } catch {
      // ignora livro com JSON inválido
    }
  }

  out.sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
    return tb - ta;
  });

  return out;
}

async function loadBookById({ BOOKS_DIR, OUT_DIR, id }) {
  BOOKS_DIR = resolveBooksDir({ BOOKS_DIR, OUT_DIR });
  if (!BOOKS_DIR) return null;

 const manifestPath = await findManifestPath({ BOOKS_DIR, id });
if (!manifestPath) return null;

const m = await readJson(manifestPath);

  const pdfFsPath = pdfPathFor({ BOOKS_DIR, id });
  const hasPdf = existsSyncSafe(pdfFsPath) && String(m?.status || "") === "done";

  const coverUrl =
    m?.overrides?.coverUrl
      ? String(m.overrides.coverUrl)
      : m?.cover?.url
      ? String(m.cover.url)
      : m?.coverUrl
      ? String(m.coverUrl)
      : "";

  const images = Array.isArray(m?.images)
    ? m.images
        .map((it) => {
          const page = Number(it?.page || 0);
          const baseUrl = String(it?.url || "");
          const ovUrl =
            page &&
            m?.overrides?.pagesImageUrl &&
            m.overrides.pagesImageUrl[String(page)]
              ? String(m.overrides.pagesImageUrl[String(page)])
              : "";
          return { page, url: ovUrl || baseUrl };
        })
        .filter((it) => it.url)
        .sort((a, b) => (a.page || 0) - (b.page || 0))
    : [];

  return {
    id: String(m?.id || id),
    dirId: String(id),
    status: String(m?.status || "created"),
    step: String(m?.step || ""),
    error: String(m?.error || ""),
    theme: String(m?.theme || ""),
    themeLabel: themeLabel(m?.theme),
    style: String(m?.style || "read"),
    styleLabel: styleLabel(m?.style),
    childName: String(m?.child?.name || ""),
    updatedAt: String(m?.updatedAt || m?.createdAt || ""),
    createdAt: String(m?.createdAt || ""),
    overrides: m?.overrides || {},
    coverUrl,
    images,
    hasPdf,
    pdfUrl: hasPdf ? `/download/${encodeURIComponent(id)}` : "",
  };
}

module.exports = { listBooks, loadBookById };