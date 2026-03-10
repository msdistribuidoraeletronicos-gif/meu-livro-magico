// books/routes.js
// Rotas do módulo /books (galeria + preview + editor + checkout)
//
// ✅ Agora consulta os livros no SUPABASE
// ✅ Usuário comum vê somente os próprios livros
// ✅ Admin pode ver todos
// ✅ Preview / editor / checkout também validam acesso no banco
//
// Requer em opts:
//   - requireAuth
//   - supabaseAdmin   (service role, backend)
//   - OUT_DIR         (ainda usado por outras telas se necessário)

"use strict";

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

  // Em produção, o ideal é SEMPRE configurar ADMIN_EMAILS
  if (!allow.length) return false;

  return allow.includes(email);
}

function getPartnerRefFromReq(req) {
  const q = String(req.query?.ref || "").trim();
  if (q) return q;

  const c = String(req.cookies?.partner_ref || "").trim();
  if (c) return c;

  return null;
}

function parseJsonSafe(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function toIso(v) {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toISOString();
  } catch {
    return String(v);
  }
}

function inferCoverUrl(row) {
  return String(
    row.cover_url ||
      row.capa_url ||
      row.coverUrl ||
      row.capa ||
      ""
  );
}

function inferPdfUrl(row) {
  return String(
    row.pdf_url ||
      row.arquivo_pdf ||
      row.pdf ||
      ""
  );
}

function inferPages(row) {
  const a =
    row.pages ??
    row.paginas ??
    row.pages_json ??
    row.paginas_json ??
    [];
  return Array.isArray(a) ? a : parseJsonSafe(a, []);
}

function inferImages(row) {
  const a =
    row.images ??
    row.imagens ??
    row.images_json ??
    row.imagens_json ??
    [];
  return Array.isArray(a) ? a : parseJsonSafe(a, []);
}

function inferChild(row) {
  const raw =
    row.child ??
    row.crianca ??
    row.child_json ??
    row.crianca_json ??
    null;

  const parsed = raw && typeof raw === "object" ? raw : parseJsonSafe(raw, null);

  return {
    name: String(
      row.nome_da_crianca ||
        parsed?.name ||
        parsed?.nome ||
        ""
    ),
    age: Number(
      row.idade_da_crianca ||
        parsed?.age ||
        parsed?.idade ||
        0
    ),
    gender: String(
      row.genero_da_crianca ||
        row.gênero_da_crianca ||
        parsed?.gender ||
        parsed?.genero ||
        parsed?.gênero ||
        "neutral"
    ),
  };
}

function toListItem(row) {
  const pages = inferPages(row);
  const images = inferImages(row);
  const child = inferChild(row);
  const pdfUrl = inferPdfUrl(row);

  return {
    id: String(row.id || ""),
    bookId: String(row.id || ""),
    dirId: String(row.id || ""),

    ownerId: String(row.user_id || row.owner_id || ""),
    status: String(row.status || "created"),
    step: String(row.step || ""),
    error: String(row.error || ""),

    theme: String(row.tema || row.theme || ""),
    themeLabel: String(row.tema || row.theme || ""),
    style: String(row.estilo || row.style || "read"),
    styleLabel: String(row.estilo || row.style || "read"),

    child,
    childName: String(child.name || ""),

    pagesCount: Number(row.total_paginas || pages.length || 0),
    imagesCount: Number(row.total_imagens || images.length || 0),

    coverUrl: inferCoverUrl(row),
    hasPdf: !!pdfUrl,
    pdfUrl,

    createdAt: toIso(row.created_at || row.createdAt),
    updatedAt: toIso(row.updated_at || row.updatedAt || row.created_at || row.createdAt),
  };
}

async function listBooksForRequest(supabaseAdmin, req) {
  const uid = String(req.user?.id || "").trim();
  if (!uid) return [];

  let query = supabaseAdmin
    .from("books")
    .select("*");

  if (!isAdmin(req)) {
    query = query.eq("user_id", uid);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Erro ao consultar livros no Supabase: " + error.message);
  }

  const list = Array.isArray(data) ? data.map((row) => ({
    id: String(row.id || ""),
    bookId: String(row.id || ""),
    dirId: String(row.id || ""),

    ownerId: String(row.user_id || ""),
    status: String(row.status || "created"),
    step: String(row.step || ""),
    error: String(row.error || ""),

    theme: String(row.theme || ""),
    themeLabel: String(row.theme || ""),
    style: String(row.style || "read"),
    styleLabel: String(row.style || "read"),

    child: {
      name: String(row.child_name || ""),
      age: Number(row.child_age || 0),
      gender: String(row.child_gender || "neutral"),
    },
    childName: String(row.child_name || ""),

    pagesCount: Array.isArray(row.manifest?.pages) ? row.manifest.pages.length : 0,
    imagesCount: Array.isArray(row.images) ? row.images.length : 0,

    coverUrl: String(row.cover_url || ""),
    hasPdf: !!row.pdf_url,
    pdfUrl: String(row.pdf_url || ""),

    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || row.created_at || ""),
  })) : [];

  list.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return list;
}

async function loadBookForRequest(supabaseAdmin, req, bookId) {
  const uid = String(req.user?.id || "").trim();
  const id = String(bookId || "").trim();

  if (!uid || !id) return null;

  let query = supabaseAdmin
    .from("books")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!isAdmin(req)) {
    query = query.eq("user_id", uid);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Erro ao carregar livro no Supabase: " + error.message);
  }

  if (!data) return null;

  const manifest = data.manifest && typeof data.manifest === "object" ? data.manifest : {};

  return {
    ...manifest,
    ...data,

    id: String(data.id || ""),
    bookId: String(data.id || ""),
    dirId: String(data.id || ""),
    folderId: String(data.id || ""),
    ownerId: String(data.user_id || ""),

    theme: String(data.theme || ""),
    style: String(data.style || "read"),

    child: {
      name: String(data.child_name || ""),
      age: Number(data.child_age || 0),
      gender: String(data.child_gender || "neutral"),
    },

    pages: Array.isArray(manifest.pages) ? manifest.pages : [],
    images: Array.isArray(data.images) ? data.images : [],

    coverUrl: String(data.cover_url || ""),
    pdf: String(data.pdf_url || ""),
    pdfUrl: String(data.pdf_url || ""),

    createdAt: String(data.created_at || ""),
    updatedAt: String(data.updated_at || data.created_at || ""),
  };
}
module.exports = function mountRoutes(app, opts = {}) {
  const { OUT_DIR, requireAuth, supabaseAdmin } = opts;

  if (!app) throw new Error("books/routes.js: app é obrigatório");
  if (!OUT_DIR) throw new Error("books/routes.js: OUT_DIR é obrigatório");
  if (typeof requireAuth !== "function") {
    throw new Error("books/routes.js: requireAuth é obrigatório");
  }
  if (!supabaseAdmin) {
    throw new Error("books/routes.js: supabaseAdmin é obrigatório");
  }

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
      "books/routes.js: render.books.html.js precisa exportar uma função"
    );
  }

  if (!renderBookPreviewHtml) {
    throw new Error(
      "books/routes.js: render.preview.html.js precisa exportar { renderBookPreviewHtml }"
    );
  }

  if (!renderBookEditorHtml) {
    throw new Error(
      "books/routes.js: render.editor.html.js precisa exportar { renderBookEditorHtml }"
    );
  }

  if (!renderCheckoutHtml) {
    throw new Error(
      "books/routes.js: render.checkout.html.js precisa exportar { renderCheckoutHtml }"
    );
  }

  // --------------------
  // GET /api/books
  // --------------------
  app.get("/api/books", requireAuth, async (req, res) => {
    try {
      const books = await listBooksForRequest(supabaseAdmin, req);

      return res.json({
        ok: true,
        books,
        isAdmin: isAdmin(req),
      });
    } catch (e) {
      console.error("ERRO /api/books:", e);
      return res.status(500).json({
        ok: false,
        error: String(e?.message || e || "Erro"),
      });
    }
  });

  // --------------------
  // GET /books
  // --------------------
  app.get("/books", requireAuth, async (req, res) => {
    try {
      const list = await listBooksForRequest(supabaseAdmin, req);

      const html = renderBooksHtml({
        user: req.user || null,
        books: list,
        OUT_DIR: String(OUT_DIR),
        isAdmin: isAdmin(req),
      });

      return res.type("html").send(html);
    } catch (e) {
      console.error("ERRO /books:", e);
      return res
        .status(500)
        .type("html")
        .send(`<!doctype html><html><body><h1>Erro</h1><pre>${String(e?.message || e || "Erro")}</pre></body></html>`);
    }
  });

  // --------------------
  // GET /books/:id
  // --------------------
  app.get("/books/:id", requireAuth, async (req, res) => {
    try {
      const bookId = String(req.params?.id || "").trim();
      if (!bookId) {
        return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");
      }

      const book = await loadBookForRequest(supabaseAdmin, req, bookId);

      if (!book) {
        return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");
      }

      const html = renderBookPreviewHtml(book);
      return res.type("html").send(html);
    } catch (e) {
      console.error("ERRO /books/:id:", e);
      return res
        .status(500)
        .type("html")
        .send(`<!doctype html><html><body><h1>Erro</h1><pre>${String(e?.message || e || "Erro")}</pre></body></html>`);
    }
  });

  // --------------------
  // GET /books/:id/edit
  // --------------------
  app.get("/books/:id/edit", requireAuth, async (req, res) => {
    try {
      const bookId = String(req.params?.id || "").trim();
      if (!bookId) {
        return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");
      }

      const book = await loadBookForRequest(supabaseAdmin, req, bookId);

      if (!book) {
        return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");
      }

      const html = renderBookEditorHtml(book);
      return res.type("html").send(html);
    } catch (e) {
      console.error("ERRO /books/:id/edit:", e);
      return res
        .status(500)
        .type("html")
        .send(`<!doctype html><html><body><h1>Erro</h1><pre>${String(e?.message || e || "Erro")}</pre></body></html>`);
    }
  });

  // --------------------
  // GET /checkout/:id
  // --------------------
  app.get("/checkout/:id", requireAuth, async (req, res) => {
    try {
      const bookId = String(req.params?.id || "").trim();
      if (!bookId) {
        return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");
      }

      const book = await loadBookForRequest(supabaseAdmin, req, bookId);

      if (!book) {
        return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");
      }

      const partnerRef = getPartnerRefFromReq(req);

      const html = renderCheckoutHtml(book, {
        basePrice: 39.9,
        printPrice: 29.9,
        bindPrice: 19.9,
        wrapPrice: 15,
        partnerRef,
      });

      return res.type("html").send(html);
    } catch (e) {
      console.error("ERRO /checkout/:id:", e);
      return res
        .status(500)
        .type("html")
        .send(`<!doctype html><html><body><h1>Erro</h1><pre>${String(e?.message || e || "Erro")}</pre></body></html>`);
    }
  });

  console.log("✅ books/routes.js montado com Supabase.");
  return true;
};