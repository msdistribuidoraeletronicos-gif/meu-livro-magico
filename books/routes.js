// books/routes.js
// Rotas do módulo /books (galeria + preview + editor)
//
// ✅ NÃO cria servidor, NÃO faz app.listen, NÃO cria express()
// ✅ Só registra rotas no "app" recebido
//
// Espera receber do index.js:
//   mountRoutes(app, { OUT_DIR, USERS_DIR, requireAuth })
//
// Estrutura de storage (conforme seu app.js):
//   OUT_DIR/books/<BOOK_FOLDER_ID>/book.json
//
// Rotas:
//   GET  /books            -> HTML galeria
//   GET  /api/books        -> JSON lista (do usuário logado; admin vê tudo)
//   GET  /books/:id        -> HTML preview (layout 1)
//   GET  /books/:id/edit   -> HTML editor (layout 2)
//   GET  /checkout/:id     -> HTML checkout (com opção de partnerRef)

"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

// --------------------
// Helpers robustos
// --------------------
function existsSyncSafe(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function readJsonSafe(file, fallback = null) {
  try {
    const raw = await fsp.readFile(file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function pickFn(mod, names = []) {
  if (typeof mod === "function") return mod;
  if (mod && typeof mod === "object") {
    for (const n of names) {
      if (typeof mod[n] === "function") return mod[n];
    }
    if (typeof mod.default === "function") return mod.default;
  }
  return null;
}

function normalizeEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function getAdminAllowlist() {
  // aceita ADMIN_EMAILS ou ADMIN_EMAIL
  let raw = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "");
  raw = raw.replace(/^["']|["']$/g, "");
  const clean = raw.trim();
  if (!clean) return [];
  return clean
    .split(",")
    .map((x) => normalizeEmail(x))
    .filter(Boolean);
}

function isAdmin(req) {
  const email = normalizeEmail(req.user?.email || "");
  if (!email) return false;

  const allow = getAdminAllowlist();
  // modo DEV: se allowlist não estiver definida, qualquer logado é “admin” para efeitos do /books
  if (!allow.length) return true;

  return allow.includes(email);
}

function canAccessManifest(req, manifest) {
  if (!manifest || typeof manifest !== "object") return false;
  if (isAdmin(req)) return true;
  const uid = String(req.user?.id || "");
  return !!uid && String(manifest.ownerId || "") === uid;
}

function bookDirsOf(OUT_DIR) {
  return path.join(String(OUT_DIR), "books");
}

function manifestPathFromDir(BOOKS_DIR, dirId) {
  return path.join(BOOKS_DIR, String(dirId), "book.json");
}

// Lista diretórios de livros (pastas dentro OUT_DIR/books)
async function listBookFolders(BOOKS_DIR) {
  if (!existsSyncSafe(BOOKS_DIR)) return [];
  const entries = await fsp.readdir(BOOKS_DIR, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

// Carrega manifest pelo folder id (dirId)
async function loadManifestByDirId(BOOKS_DIR, dirId) {
  const mPath = manifestPathFromDir(BOOKS_DIR, dirId);
  const m = await readJsonSafe(mPath, null);
  if (!m || typeof m !== "object") return null;

  // Normaliza alguns campos úteis para UI
  const out = { ...m };
  out.dirId = String(dirId); // ✅ id físico (nome da pasta)
  out.id = String(out.id || dirId); // id lógico (do JSON) ou fallback
  out.ownerId = String(out.ownerId || "");
  out.theme = String(out.theme || "");
  out.style = String(out.style || "read");
  out.createdAt = out.createdAt || "";
  out.updatedAt = out.updatedAt || "";
  out.pages = Array.isArray(out.pages) ? out.pages : [];
  out.images = Array.isArray(out.images) ? out.images : [];
  out.child = out.child && typeof out.child === "object" ? out.child : { name: "", age: 0, gender: "neutral" };

  // URLs padrão (compatível com seu app.js)
  if (out.cover && out.cover.ok && out.cover.file) {
    out.coverUrl = out.cover.url || `/api/image/${encodeURIComponent(out.dirId)}/${encodeURIComponent(out.cover.file)}`;
  } else {
    out.coverUrl = "";
  }

  out.hasPdf = !!out.pdf;
  out.pdfUrl = out.pdf ? String(out.pdf) : "";

  return out;
}

// Lista livros do usuário (ou todos se admin)
async function listBooksForRequest(BOOKS_DIR, req) {
  const folderIds = await listBookFolders(BOOKS_DIR);

  const out = [];
  for (const dirId of folderIds) {
    const m = await loadManifestByDirId(BOOKS_DIR, dirId);
    if (!m) continue;
    if (!canAccessManifest(req, m)) continue;

    out.push({
      // ids
      id: String(m.id || dirId),
      dirId: String(m.dirId || dirId),

      // metadados
      ownerId: String(m.ownerId || ""),
      status: String(m.status || "created"),
      step: String(m.step || ""),
      error: String(m.error || ""),
      theme: String(m.theme || ""),
      style: String(m.style || "read"),
      child: m.child || { name: "", age: 0, gender: "neutral" },

      // contagens e links
      pagesCount: Array.isArray(m.pages) ? m.pages.length : 0,
      imagesCount: Array.isArray(m.images) ? m.images.length : 0,
      coverUrl: String(m.coverUrl || ""),
      hasPdf: !!m.pdf,
      pdfUrl: String(m.pdfUrl || ""),

      // datas
      createdAt: String(m.createdAt || ""),
      updatedAt: String(m.updatedAt || ""),
    });
  }

  // mais recente primeiro
  out.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  return out;
}

// --------------------
// Mount principal
// --------------------
module.exports = function mountRoutes(app, { OUT_DIR, USERS_DIR, requireAuth } = {}) {
  if (!app) throw new Error("books/routes.js: app é obrigatório");
  if (!OUT_DIR) throw new Error("books/routes.js: OUT_DIR é obrigatório");
  if (!USERS_DIR) throw new Error("books/routes.js: USERS_DIR é obrigatório");
  if (typeof requireAuth !== "function") throw new Error("books/routes.js: requireAuth é obrigatório (middleware)");

  const BOOKS_DIR = bookDirsOf(OUT_DIR);

  // Renderers (com tolerância de export)
  const booksRendererMod = require("./render.books.html");
  const previewRendererMod = require("./render.preview.html");
  const editorRendererMod = require("./render.editor.html");
const checkoutRendererMod = require("./render.checkout.html");
  const renderBooksHtml = pickFn(booksRendererMod, ["renderBooksHtml", "renderBooksGalleryHtml", "renderBooksPageHtml"]);
  const renderBookPreviewHtml = pickFn(previewRendererMod, ["renderBookPreviewHtml"]);
  const renderBookEditorHtml = pickFn(editorRendererMod, ["renderBookEditorHtml"]);
const renderCheckoutHtml = pickFn(checkoutRendererMod, ["renderCheckoutHtml"]);
if (!renderCheckoutHtml) {
  throw new Error(
    "books/routes.js: render.checkout.html.js precisa exportar { renderCheckoutHtml } (ou exportar a função direto)"
  );
}
  if (!renderBooksHtml) {
    throw new Error(
      "books/routes.js: render.books.html.js precisa exportar uma função (ex: module.exports = { renderBooksGalleryHtml })"
    );
  }
  if (!renderBookPreviewHtml) {
    throw new Error(
      "books/routes.js: render.preview.html.js precisa exportar { renderBookPreviewHtml } (ou exportar a função direto)"
    );
  }
  if (!renderBookEditorHtml) {
    throw new Error(
      "books/routes.js: render.editor.html.js precisa exportar { renderBookEditorHtml } (ou exportar a função direto)"
    );
  }

  // --------------------
  // GET /api/books (JSON)
  // --------------------
  app.get("/api/books", requireAuth, async (req, res) => {
    try {
      const list = await listBooksForRequest(BOOKS_DIR, req);

      return res.json({
        ok: true,
        books: list,
        isAdmin: isAdmin(req),
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  // --------------------
  // GET /books (HTML galeria)
  // --------------------
  app.get("/books", requireAuth, async (req, res) => {
    try {
      const list = await listBooksForRequest(BOOKS_DIR, req);

      // O renderer da galeria costuma querer a lista (e opcionalmente o user)
      const html = renderBooksHtml({
        user: req.user || null,
        books: list,
        // passa dirs úteis caso seu renderer use
        OUT_DIR: String(OUT_DIR),
        USERS_DIR: String(USERS_DIR),
        BOOKS_DIR: String(BOOKS_DIR),
        isAdmin: isAdmin(req),
      });

      res.type("html").send(html);
    } catch (e) {
      res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${String(e?.message || e || "Erro")}</pre></body></html>`
        );
    }
  });

  // --------------------
  // GET /books/:id (HTML preview)
  // --------------------
  app.get("/books/:id", requireAuth, async (req, res) => {
    try {
      const dirId = String(req.params?.id || "").trim();
      if (!dirId) return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");

      const manifest = await loadManifestByDirId(BOOKS_DIR, dirId);
      if (!manifest) return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");

      if (!canAccessManifest(req, manifest)) {
        return res.status(403).type("html").send("<h1>403</h1><p>Acesso negado</p>");
      }

      // ✅ importante: manter o id da pasta para as rotas /api/image e /download funcionarem
      // Seu app.js usa /download/:id e /api/image/:id/:file, onde :id é o folder id.
      const bookForUi = {
        ...manifest,
        id: String(manifest.id || dirId),
        dirId: String(dirId),
        folderId: String(dirId), // compat extra
      };

      const html = renderBookPreviewHtml(bookForUi);
      res.type("html").send(html);
    } catch (e) {
      res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${String(e?.message || e || "Erro")}</pre></body></html>`
        );
    }
  });
// --------------------
// GET /checkout/:id (HTML checkout)
// --------------------
app.get("/checkout/:id", requireAuth, async (req, res) => {
  try {
    const dirId = String(req.params?.id || "").trim();
    if (!dirId) return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");

    const manifest = await loadManifestByDirId(BOOKS_DIR, dirId);
    if (!manifest) return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");

    if (!canAccessManifest(req, manifest)) {
      return res.status(403).type("html").send("<h1>403</h1><p>Acesso negado</p>");
    }

    const bookForUi = {
      ...manifest,
      id: String(manifest.id || dirId), // id lógico (se existir)
      dirId: String(dirId),            // ✅ id real (pasta)
      folderId: String(dirId),
    };

    // ✅ Obtém partnerRef do res.locals (definido pelo middleware no app.js)
    const partnerRef = res.locals?.partnerRef || null;

    const html = renderCheckoutHtml(bookForUi, {
      basePrice: 39.9,
      printPrice: 29.9,
      bindPrice: 19.9,
      wrapPrice: 15,
      partnerRef, // <-- adicionado
    });

    res.type("html").send(html);
  } catch (e) {
    res
      .status(500)
      .type("html")
      .send(
        `<!doctype html><html><body><h1>Erro</h1><pre>${String(e?.message || e || "Erro")}</pre></body></html>`
      );
  }
});
  // --------------------
  // GET /books/:id/edit (HTML editor)
  // --------------------
  app.get("/books/:id/edit", requireAuth, async (req, res) => {
    try {
      const dirId = String(req.params?.id || "").trim();
      if (!dirId) return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");

      const manifest = await loadManifestByDirId(BOOKS_DIR, dirId);
      if (!manifest) return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");

      if (!canAccessManifest(req, manifest)) {
        return res.status(403).type("html").send("<h1>403</h1><p>Acesso negado</p>");
      }

      const bookForUi = {
        ...manifest,
        id: String(manifest.id || dirId),
        dirId: String(dirId),
        folderId: String(dirId),
      };

      const html = renderBookEditorHtml(bookForUi);
      res.type("html").send(html);
    } catch (e) {
      res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${String(e?.message || e || "Erro")}</pre></body></html>`
        );
    }
  });

  // Log útil (não quebra nada)
  console.log("✅ books/routes.js montado.");
  console.log("📁 BOOKS_DIR =", BOOKS_DIR);

  return true;
};