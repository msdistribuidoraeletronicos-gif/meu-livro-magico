// books/routes.js
// Rotas do módulo /books (galeria + preview + editor + checkout)
//
// ✅ NÃO cria servidor, NÃO faz app.listen, NÃO cria express()
// ✅ Só registra rotas no "app" recebido
//
// Estrutura REAL (conforme seu core.js):
//   OUT_DIR/books/<USER_ID>/<BOOK_ID>/book.json
//
// Rotas:
//   GET  /books            -> HTML galeria
//   GET  /api/books        -> JSON lista (do usuário logado; admin vê tudo)
//   GET  /books/:id        -> HTML preview
//   GET  /books/:id/edit   -> HTML editor
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

  // DEV: se allowlist não estiver definida, qualquer logado é “admin” (só para /books)
  if (!allow.length) return true;

  return allow.includes(email);
}

function canAccessManifest(req, manifest) {
  if (!manifest || typeof manifest !== "object") return false;
  if (isAdmin(req)) return true;

  const uid = String(req.user?.id || "");
  return !!uid && String(manifest.ownerId || "") === uid;
}

// Pasta raiz dos livros (igual core.js)
function booksRootDirOf(OUT_DIR) {
  return path.join(String(OUT_DIR), "books");
}

// Caminho do manifest (igual core.js, com userId/bookId)
function manifestPathOf(BOOKS_ROOT_DIR, ownerId, bookId) {
  return path.join(BOOKS_ROOT_DIR, String(ownerId), String(bookId), "book.json");
}

// Lista owners (pastas dentro OUT_DIR/books)
async function listOwnerFolders(BOOKS_ROOT_DIR) {
  if (!existsSyncSafe(BOOKS_ROOT_DIR)) return [];
  const entries = await fsp.readdir(BOOKS_ROOT_DIR, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

// Lista books de um owner (pastas dentro OUT_DIR/books/<ownerId>)
async function listBookFoldersForOwner(BOOKS_ROOT_DIR, ownerId) {
  const ownerDir = path.join(BOOKS_ROOT_DIR, String(ownerId));
  if (!existsSyncSafe(ownerDir)) return [];

  const entries = await fsp.readdir(ownerDir, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

// Carrega manifest por ownerId + bookId
async function loadManifestByOwnerAndBook(BOOKS_ROOT_DIR, ownerId, bookId) {
  const mPath = manifestPathOf(BOOKS_ROOT_DIR, ownerId, bookId);
  const m = await readJsonSafe(mPath, null);
  if (!m || typeof m !== "object") return null;

  const out = { ...m };

  // Normalizações úteis pra UI
  out.ownerId = String(out.ownerId || ownerId || "");
  out.id = String(out.id || bookId || "");
  out.bookId = String(bookId || out.id || "");
  out.dirId = String(bookId || out.id || ""); // compat com seus templates
  out.theme = String(out.theme || "");
  out.style = String(out.style || "read");
  out.createdAt = out.createdAt || "";
  out.updatedAt = out.updatedAt || "";
  out.pages = Array.isArray(out.pages) ? out.pages : [];
  out.images = Array.isArray(out.images) ? out.images : [];
  out.child =
    out.child && typeof out.child === "object"
      ? out.child
      : { name: "", age: 0, gender: "neutral" };

  // URLs padrão (compatível com seu core.js)
  // Atenção: no seu core.js, /api/image/:id/:file usa ":id" como bookId (pasta do livro).
  // Se admin abrir livro de outro usuário, seu /api/image pode ter limitações (isso é do core.js).
  if (out.cover && out.cover.ok && out.cover.file) {
    out.coverUrl =
      out.cover.url ||
      `/api/image/${encodeURIComponent(out.bookId)}/${encodeURIComponent(out.cover.file)}`;
  } else {
    out.coverUrl = "";
  }

  out.hasPdf = !!out.pdf;
  out.pdfUrl = out.pdf ? String(out.pdf) : "";

  return out;
}

// Busca manifest por bookId para request:
// - primeiro tenta dentro do user logado
// - se admin e não achou, varre todos owners
async function loadManifestForRequest(BOOKS_ROOT_DIR, req, bookId) {
  const uid = String(req.user?.id || "").trim();
  const bid = String(bookId || "").trim();
  if (!bid) return null;

  // 1) tenta no próprio user
  if (uid) {
    const m = await loadManifestByOwnerAndBook(BOOKS_ROOT_DIR, uid, bid);
    if (m) return m;
  }

  // 2) se admin, varre tudo
  if (isAdmin(req)) {
    const owners = await listOwnerFolders(BOOKS_ROOT_DIR);
    for (const ownerId of owners) {
      const m = await loadManifestByOwnerAndBook(BOOKS_ROOT_DIR, ownerId, bid);
      if (m) return m;
    }
  }

  return null;
}

// Lista livros do usuário (ou todos se admin)
async function listBooksForRequest(BOOKS_ROOT_DIR, req) {
  const out = [];
  const uid = String(req.user?.id || "").trim();

  if (!uid) return out;

  if (!isAdmin(req)) {
    // Usuário normal: só seus livros
    const bookIds = await listBookFoldersForOwner(BOOKS_ROOT_DIR, uid);

    for (const bookId of bookIds) {
      const m = await loadManifestByOwnerAndBook(BOOKS_ROOT_DIR, uid, bookId);
      if (!m) continue;
      if (!canAccessManifest(req, m)) continue;

      out.push(toListItem(m));
    }
  } else {
    // Admin: todos
    const owners = await listOwnerFolders(BOOKS_ROOT_DIR);

    for (const ownerId of owners) {
      const bookIds = await listBookFoldersForOwner(BOOKS_ROOT_DIR, ownerId);

      for (const bookId of bookIds) {
        const m = await loadManifestByOwnerAndBook(BOOKS_ROOT_DIR, ownerId, bookId);
        if (!m) continue;
        if (!canAccessManifest(req, m)) continue;

        out.push(toListItem(m));
      }
    }
  }

  // mais recente primeiro
  out.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  return out;
}

function toListItem(m) {
  return {
    // ids
    id: String(m.id || m.bookId || ""),
    bookId: String(m.bookId || m.id || ""),
    dirId: String(m.bookId || m.id || ""), // compat com UI

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
  };
}

function getPartnerRefFromReq(req) {
  // 1) query ?ref=
  const q = String(req.query?.ref || "").trim();
  if (q) return q;

  // 2) cookie partner_ref
  const c = String(req.cookies?.partner_ref || "").trim();
  if (c) return c;

  return null;
}

// --------------------
// Mount principal
// --------------------
module.exports = function mountRoutes(app, opts = {}) {
  const { OUT_DIR, requireAuth } = opts;

  if (!app) throw new Error("books/routes.js: app é obrigatório");
  if (!OUT_DIR) throw new Error("books/routes.js: OUT_DIR é obrigatório");
  if (typeof requireAuth !== "function")
    throw new Error("books/routes.js: requireAuth é obrigatório (middleware)");

  // ✅ ROOT dos livros conforme core.js
  const BOOKS_ROOT_DIR = opts.BOOKS_DIR || booksRootDirOf(OUT_DIR);

  // Renderers (com tolerância de export)
  const booksRendererMod = require("./render.books.html");
  const previewRendererMod = require("./render.preview.html");
  const editorRendererMod = require("./render.editor.html");
  const checkoutRendererMod = require("./render.checkout.html");

  const renderBooksHtml = pickFn(booksRendererMod, [
    "renderBooksHtml",
    "renderBooksGalleryHtml",
    "renderBooksPageHtml",
  ]);

  const renderBookPreviewHtml = pickFn(previewRendererMod, ["renderBookPreviewHtml"]);
  const renderBookEditorHtml = pickFn(editorRendererMod, ["renderBookEditorHtml"]);
  const renderCheckoutHtml = pickFn(checkoutRendererMod, ["renderCheckoutHtml"]);

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

  if (!renderCheckoutHtml) {
    throw new Error(
      "books/routes.js: render.checkout.html.js precisa exportar { renderCheckoutHtml } (ou exportar a função direto)"
    );
  }

  // --------------------
  // GET /api/books (JSON)
  // --------------------
  app.get("/api/books", requireAuth, async (req, res) => {
    try {
      const list = await listBooksForRequest(BOOKS_ROOT_DIR, req);

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
      const list = await listBooksForRequest(BOOKS_ROOT_DIR, req);

      const html = renderBooksHtml({
        user: req.user || null,
        books: list,
        OUT_DIR: String(OUT_DIR),
        BOOKS_DIR: String(BOOKS_ROOT_DIR),
        isAdmin: isAdmin(req),
      });

      res.type("html").send(html);
    } catch (e) {
      res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${String(
            e?.message || e || "Erro"
          )}</pre></body></html>`
        );
    }
  });

  // --------------------
  // GET /books/:id (HTML preview)
  // --------------------
  app.get("/books/:id", requireAuth, async (req, res) => {
    try {
      const bookId = String(req.params?.id || "").trim();
      if (!bookId) return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");

      const manifest = await loadManifestForRequest(BOOKS_ROOT_DIR, req, bookId);
      if (!manifest)
        return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");

      if (!canAccessManifest(req, manifest)) {
        return res.status(403).type("html").send("<h1>403</h1><p>Acesso negado</p>");
      }

      const bookForUi = {
        ...manifest,
        id: String(manifest.id || bookId),
        bookId: String(bookId),
        dirId: String(bookId),
        folderId: String(bookId),
      };

      const html = renderBookPreviewHtml(bookForUi);
      res.type("html").send(html);
    } catch (e) {
      res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${String(
            e?.message || e || "Erro"
          )}</pre></body></html>`
        );
    }
  });

  // --------------------
  // GET /books/:id/edit (HTML editor)
  // --------------------
  app.get("/books/:id/edit", requireAuth, async (req, res) => {
    try {
      const bookId = String(req.params?.id || "").trim();
      if (!bookId) return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");

      const manifest = await loadManifestForRequest(BOOKS_ROOT_DIR, req, bookId);
      if (!manifest)
        return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");

      if (!canAccessManifest(req, manifest)) {
        return res.status(403).type("html").send("<h1>403</h1><p>Acesso negado</p>");
      }

      const bookForUi = {
        ...manifest,
        id: String(manifest.id || bookId),
        bookId: String(bookId),
        dirId: String(bookId),
        folderId: String(bookId),
      };

      const html = renderBookEditorHtml(bookForUi);
      res.type("html").send(html);
    } catch (e) {
      res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${String(
            e?.message || e || "Erro"
          )}</pre></body></html>`
        );
    }
  });

  // --------------------
  // GET /checkout/:id (HTML checkout)
  // --------------------
  app.get("/checkout/:id", requireAuth, async (req, res) => {
    try {
      const bookId = String(req.params?.id || "").trim();
      if (!bookId) return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");

      const manifest = await loadManifestForRequest(BOOKS_ROOT_DIR, req, bookId);
      if (!manifest)
        return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");

      if (!canAccessManifest(req, manifest)) {
        return res.status(403).type("html").send("<h1>403</h1><p>Acesso negado</p>");
      }

      const bookForUi = {
        ...manifest,
        id: String(manifest.id || bookId),
        bookId: String(bookId),
        dirId: String(bookId),
        folderId: String(bookId),
      };

      const partnerRef = getPartnerRefFromReq(req);

      const html = renderCheckoutHtml(bookForUi, {
        basePrice: 39.9,
        printPrice: 29.9,
        bindPrice: 19.9,
        wrapPrice: 15,
        partnerRef,
      });

      res.type("html").send(html);
    } catch (e) {
      res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${String(
            e?.message || e || "Erro"
          )}</pre></body></html>`
        );
    }
  });

  console.log("✅ books/routes.js montado.");
  console.log("📁 BOOKS_ROOT_DIR =", BOOKS_ROOT_DIR);

  return true;
};