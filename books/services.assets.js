// services.assets.js
"use strict";

const sharp = require("sharp");
const PDFDocument = require("pdfkit");
const {
  fs,
  fsp,
  path,
  existsSyncSafe,
  safeJoin,
  readJson,
  writeJson,
  nowIso,
} = require("./utils");

/**
 * Estrutura REAL do seu livro:
 * output/users/<uid>/books/<bookId>/
 *   photo.png
 *   edit_base.png
 *   cover_final.png
 *   page_01.png
 *   page_01_final.png
 *   edited/
 *     cover.png
 *     page_01.png
 *   book-<id>.pdf
 *   book.json
 *
 * ✅ Edição: SEMPRE usar a imagem "limpa" (page_01.png) como base.
 * ✅ Rascunho: gerar em /edited/
 * ✅ PDF final: montar usando /edited/ quando existir, senão usa base/final.
 */

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------
function findExistingFile(candidates) {
  for (const p of candidates) {
    if (p && existsSyncSafe(p)) return p;
  }
  return "";
}

function pad2(n) {
  n = Number(n || 0);
  if (!Number.isFinite(n) || n < 0) return "00";
  return String(n).padStart(2, "0");
}

/**
 * ✅ Base "limpa" (sem texto).
 * - Capa: tenta cover.png / capa.png / edit_base.png / cover_final.png (fallback)
 * - Páginas: page_01.png etc (fallback para final se livro antigo)
 */
function findBaseImagePath(bookDir, pageNum) {
  const pn = Number(pageNum || 0);

  if (pn === 0) {
    const coverCandidates = [
      path.join(bookDir, "cover.png"),
      path.join(bookDir, "capa.png"),
      path.join(bookDir, "edit_base.png"), // muito comum no seu layout
      path.join(bookDir, "cover_base.png"),
      path.join(bookDir, "capa_base.png"),
      // fallback (pode estar com texto, mas é melhor do que nada)
      path.join(bookDir, "cover_final.png"),
      path.join(bookDir, "capa_final.png"),
      // fallback extremo
      path.join(bookDir, "page_01.png"),
      path.join(bookDir, "page_01_final.png"),
    ];
    return findExistingFile(coverCandidates);
  }

  const pp = pad2(pn);

  const candidates = [
    // ✅ preferir sempre a limpa na raiz
    path.join(bookDir, `page_${pp}.png`),
    path.join(bookDir, `page-${pp}.png`),
    path.join(bookDir, `p${pp}.png`),

    // fallback: se não existir limpa (livros antigos), usa a final
    path.join(bookDir, `page_${pp}_final.png`),
    path.join(bookDir, `page_${pp}.final.png`),
    path.join(bookDir, `page_${pp}_final.PNG`),

    // fallback “sem zero”
    path.join(bookDir, `page_${pn}.png`),
    path.join(bookDir, `page_${pn}_final.png`),
  ];

  return findExistingFile(candidates);
}

/**
 * ✅ Final "com texto" (legado/compat).
 * Não usamos como base preferida de edição.
 */
function findFinalImagePath(bookDir, pageNum) {
  const pn = Number(pageNum || 0);

  if (pn === 0) {
    const coverFinalCandidates = [
      path.join(bookDir, "cover_final.png"),
      path.join(bookDir, "cover.png"),
      path.join(bookDir, "capa_final.png"),
      path.join(bookDir, "capa.png"),
    ];
    return findExistingFile(coverFinalCandidates);
  }

  const pp = pad2(pn);
  const candidates = [
    path.join(bookDir, `page_${pp}_final.png`),
    path.join(bookDir, `page_${pp}.final.png`),
    path.join(bookDir, `page_${pn}_final.png`),
  ];
  return findExistingFile(candidates);
}

/**
 * Renderiza o card branco + texto em cima da imagem base.
 */
async function renderTextCardPng({ basePngPath, outPngPath, text, title }) {
  const img = sharp(basePngPath);
  const meta = await img.metadata();
  const W = Math.max(1, meta.width || 1020);
  const H = Math.max(1, meta.height || 797);

  const pad = Math.round(W * 0.055);
  const cardW = W - pad * 2;
  const cardH = Math.round(H * 0.28);
  const cardX = pad;
  const cardY = H - pad - cardH;

  const safeTitle = String(title || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const safeText = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const titleSize = Math.max(24, Math.round(W * 0.040));
  const fontBase = Math.max(18, Math.round(W * 0.028));
  const lineH = Math.round(fontBase * 1.25);

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="sh" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="rgba(17,24,39,.25)"/>
    </filter>
  </defs>

  <rect x="${cardX}" y="${cardY}" rx="22" ry="22"
        width="${cardW}" height="${cardH}"
        fill="rgba(255,255,255,0.96)"
        stroke="rgba(221,214,254,0.95)"
        stroke-width="2"
        filter="url(#sh)" />

  <text x="${cardX + Math.round(pad * 0.55)}"
        y="${cardY + Math.round(pad * 0.55)}"
        font-family="Segoe UI, Arial, sans-serif"
        font-weight="900"
        font-size="${titleSize}"
        fill="#111827">${safeTitle}</text>

  <foreignObject x="${cardX + Math.round(pad * 0.55)}"
                 y="${cardY + Math.round(pad * 0.55) + Math.round(titleSize * 0.8)}"
                 width="${cardW - Math.round(pad * 1.1)}"
                 height="${cardH - Math.round(pad * 0.9)}">
    <div xmlns="http://www.w3.org/1999/xhtml"
         style="
           font-family: Segoe UI, Arial, sans-serif;
           font-weight: 800;
           font-size: ${fontBase}px;
           line-height: ${lineH}px;
           color: #111827;
           word-wrap: break-word;
           overflow: hidden;
           display: -webkit-box;
           -webkit-line-clamp: 5;
           -webkit-box-orient: vertical;
         ">
      ${safeText}
    </div>
  </foreignObject>
</svg>`;

  await fsp.mkdir(path.dirname(outPngPath), { recursive: true });
  await img.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(outPngPath);
}

/**
 * Copia PNG base para /edited/ (usado quando texto está vazio/remoção)
 */
async function copyPng(src, dst) {
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  await sharp(src).png().toFile(dst);
}

/**
 * Monta PDF usando PNGs já prontos
 */
async function buildPdfFromPngs({ pngPaths, outPdfPath }) {
  await fsp.mkdir(path.dirname(outPdfPath), { recursive: true });

  const doc = new PDFDocument({ autoFirstPage: false });
  const stream = fs.createWriteStream(outPdfPath);
  doc.pipe(stream);

  for (const p of pngPaths) {
    if (!p || !existsSyncSafe(p)) continue;
    const meta = await sharp(p).metadata();
    const W = meta.width || 1020;
    const H = meta.height || 797;

    doc.addPage({ size: [W, H] });
    doc.image(p, 0, 0, { width: W, height: H });
  }

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

function collectAllPageNumbers(manifest) {
  const set = new Set();

  // imagens
  if (Array.isArray(manifest?.images)) {
    for (const it of manifest.images) {
      const p = Number(it?.page || 0);
      if (p > 0) set.add(p);
    }
  }

  // textos editados
  if (manifest?.overrides?.pagesText && typeof manifest.overrides.pagesText === "object") {
    for (const k of Object.keys(manifest.overrides.pagesText)) {
      const p = Number(k || 0);
      if (p > 0) set.add(p);
    }
  }

  return Array.from(set).sort((a, b) => a - b);
}

// -----------------------------------------------------
// ✅ PRINCIPAL: aplica overrides => gera /edited/ e PDF
// -----------------------------------------------------
async function applyEditsToBookAssets({ USERS_DIR, userId, bookId }) {
  const uid = String(userId || "");
  const id = String(bookId || "");
  if (!uid) throw new Error("applyEditsToBookAssets: userId ausente");
  if (!id) throw new Error("applyEditsToBookAssets: bookId ausente");

  const bookDir = path.join(USERS_DIR, uid, "books", id);
  const manifestPath = path.join(bookDir, "book.json");
  if (!existsSyncSafe(manifestPath)) throw new Error("book.json não existe: " + manifestPath);

  const m = await readJson(manifestPath);
  if (!m.overrides) m.overrides = {};
  if (!m.overrides.pagesText) m.overrides.pagesText = {};
  if (!m.overrides.pagesImageUrl) m.overrides.pagesImageUrl = {};

  const editedDir = path.join(bookDir, "edited");
  await fsp.mkdir(editedDir, { recursive: true });

  // -------------------
  // CAPA
  // -------------------
  const coverBase = findBaseImagePath(bookDir, 0);
  const coverOut = path.join(editedDir, "cover.png");
  const coverText = (m.overrides.coverText == null ? "" : String(m.overrides.coverText)).trim();

  if (coverBase) {
    if (coverText) {
      await renderTextCardPng({
        basePngPath: coverBase,
        outPngPath: coverOut,
        title: String(m?.id || "Capa"),
        text: coverText,
      });
      m.overrides.coverUrl = `/books/${encodeURIComponent(id)}/asset/edited/cover.png`;
    } else {
      // se não tem texto, garante uma capa "limpa" no edited (pra sumir texto antigo)
      await copyPng(coverBase, coverOut);
      // opcional: só aponta para edited se já existia coverUrl antes
      if (m.overrides.coverUrl) {
        m.overrides.coverUrl = `/books/${encodeURIComponent(id)}/asset/edited/cover.png`;
      }
    }
  }

  // -------------------
  // PÁGINAS
  // -------------------
  const pagesText =
    m.overrides.pagesText && typeof m.overrides.pagesText === "object" ? m.overrides.pagesText : {};

  const pageNums = collectAllPageNumbers(m);

  for (const pn of pageNums) {
    const pp = pad2(pn);
    const outName = `page_${pp}.png`;
    const outPath = path.join(editedDir, outName);

    const base = findBaseImagePath(bookDir, pn);
    if (!base) continue; // não quebra tudo por uma página faltando

    const txt = (pagesText[String(pn)] == null ? "" : String(pagesText[String(pn)])).trim();

    if (txt) {
      await renderTextCardPng({
        basePngPath: base,
        outPngPath: outPath,
        title: `Página ${pn}`,
        text: txt,
      });
      m.overrides.pagesImageUrl[String(pn)] = `/books/${encodeURIComponent(id)}/asset/edited/${outName}`;
    } else {
      // sem texto: se já tinha override de imagem, troca por base limpa
      if (m.overrides.pagesImageUrl && m.overrides.pagesImageUrl[String(pn)]) {
        await copyPng(base, outPath);
        m.overrides.pagesImageUrl[String(pn)] = `/books/${encodeURIComponent(id)}/asset/edited/${outName}`;
      }
    }
  }

  // -------------------
  // PDF (cover + pages)
  // -------------------
  const pdfOut = path.join(bookDir, `book-${id}.pdf`);

  const pngList = [];

  // capa do PDF: preferir edited/cover.png se existe, senão final/base
  if (existsSyncSafe(coverOut)) pngList.push(coverOut);
  else {
    const cf = findFinalImagePath(bookDir, 0) || findBaseImagePath(bookDir, 0);
    if (cf) pngList.push(cf);
  }

  for (const pn of pageNums) {
    const pp = pad2(pn);
    const editedP = path.join(editedDir, `page_${pp}.png`);
    if (existsSyncSafe(editedP)) {
      pngList.push(editedP);
      continue;
    }
    const fallback = findFinalImagePath(bookDir, pn) || findBaseImagePath(bookDir, pn);
    if (fallback) pngList.push(fallback);
  }

  if (pngList.length) {
    await buildPdfFromPngs({ pngPaths: pngList, outPdfPath: pdfOut });
  }

  m.updatedAt = nowIso();
  await writeJson(manifestPath, m);

  return { ok: true };
}

// -----------------------------------------------------
// Exports
// -----------------------------------------------------
module.exports = {
  applyEditsToBookAssets,
  findBaseImagePath,
  findFinalImagePath,
  renderTextCardPng,
  buildPdfFromPngs,
};
