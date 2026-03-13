// books/routes.js
// Rotas do módulo /books (galeria + preview + editor + checkout)

"use strict";

const path = require("path");

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

function tryRequireAbs(absPath) {
  try {
    const resolved = require.resolve(absPath);
    console.log(`[books/routes] require.resolve OK: ${absPath} -> ${resolved}`);

    const mod = require(absPath);
    console.log(`[books/routes] módulo carregado com sucesso: ${absPath}`);
    console.log(
      `[books/routes] exports de ${absPath}:`,
      mod && typeof mod === "object" ? Object.keys(mod) : typeof mod
    );

    return mod;
  } catch (err) {
    console.error(`[books/routes] Falha ao carregar módulo ${absPath}`);
    console.error("[books/routes] message:", err?.message || err);
    console.error("[books/routes] code:", err?.code || "");
    console.error("[books/routes] stack:", err?.stack || err);
    return null;
  }
}

function normalizeEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "").trim()
  );
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
  const email = normalizeEmail(req?.user?.email || "");
  if (!email) return false;

  const allow = getAdminAllowlist();
  if (!allow.length) return false;

  return allow.includes(email);
}

function getPartnerRefFromReq(req) {
  const q = String(req?.query?.ref || "").trim();
  if (q) return q;

  const c = String(req?.cookies?.partner_ref || "").trim();
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

function inferManifest(row) {
  return row?.manifest && typeof row.manifest === "object"
    ? row.manifest
    : parseJsonSafe(row?.manifest, {});
}

function inferCoverUrl(row) {
  const manifest = inferManifest(row);
  return String(
    row?.cover_url ||
      row?.capa_url ||
      row?.coverUrl ||
      row?.capa ||
      manifest?.cover?.url ||
      ""
  );
}

function inferPdfUrl(row) {
  const manifest = inferManifest(row);
  return String(
    row?.pdf_url ||
      row?.arquivo_pdf ||
      row?.pdf ||
      manifest?.pdf ||
      ""
  );
}

function inferPages(row) {
  const manifest = inferManifest(row);
  const a =
    row?.pages ??
    row?.paginas ??
    row?.pages_json ??
    row?.paginas_json ??
    manifest?.pages ??
    [];

  return Array.isArray(a) ? a : parseJsonSafe(a, []);
}

function inferImages(row) {
  const manifest = inferManifest(row);
  const a =
    row?.images ??
    row?.imagens ??
    row?.images_json ??
    row?.imagens_json ??
    manifest?.images ??
    [];

  return Array.isArray(a) ? a : parseJsonSafe(a, []);
}

function inferChild(row) {
  const manifest = inferManifest(row);

  const raw =
    row?.child ??
    row?.crianca ??
    row?.child_json ??
    row?.crianca_json ??
    manifest?.child ??
    null;

  const parsed = raw && typeof raw === "object" ? raw : parseJsonSafe(raw, null);

  return {
    name: String(
      row?.child_name ||
        row?.nome_da_crianca ||
        parsed?.name ||
        parsed?.nome ||
        ""
    ),
    age: Number(
      row?.child_age ||
        row?.idade_da_crianca ||
        parsed?.age ||
        parsed?.idade ||
        0
    ),
    gender: String(
      row?.child_gender ||
        row?.genero_da_crianca ||
        row?.gênero_da_crianca ||
        parsed?.gender ||
        parsed?.genero ||
        parsed?.gênero ||
        "neutral"
    ),
  };
}

function toListItem(row) {
  const manifest = inferManifest(row);
  const pages = inferPages(row);
  const images = inferImages(row);
  const child = inferChild(row);
  const pdfUrl = inferPdfUrl(row);

  return {
    id: String(row?.id || manifest?.id || ""),
    bookId: String(row?.id || manifest?.id || ""),
    dirId: String(row?.id || manifest?.id || ""),

    ownerId: String(
      row?.user_id || row?.owner_id || manifest?.ownerId || ""
    ),
    status: String(row?.status || manifest?.status || "created"),
    step: String(row?.step || manifest?.step || ""),
    error: String(row?.error || manifest?.error || ""),

    theme: String(row?.theme || row?.tema || manifest?.theme || ""),
    themeLabel: String(row?.theme || row?.tema || manifest?.theme || ""),
    style: String(row?.style || row?.estilo || manifest?.style || "read"),
    styleLabel: String(row?.style || row?.estilo || manifest?.style || "read"),

    child,
    childName: String(child.name || ""),

    pagesCount: Number(row?.total_paginas || pages.length || 0),
    imagesCount: Number(row?.total_imagens || images.length || 0),

    coverUrl: inferCoverUrl(row),
    hasPdf: !!pdfUrl,
    pdfUrl,

    createdAt: toIso(row?.created_at || row?.createdAt || manifest?.createdAt),
    updatedAt: toIso(
      row?.updated_at ||
        row?.updatedAt ||
        manifest?.updatedAt ||
        row?.created_at ||
        manifest?.createdAt
    ),
  };
}

async function listBooksForRequest(supabaseAdmin, req) {
  const uid = String(req?.user?.id || "").trim();
  const email = normalizeEmail(req?.user?.email || "");

  console.log("[listBooksForRequest] req.user =", req?.user || null);
  console.log("[listBooksForRequest] uid =", uid);
  console.log("[listBooksForRequest] email =", email);
  console.log("[listBooksForRequest] isAdmin =", isAdmin(req));

  if (!supabaseAdmin) {
    throw new Error("Supabase Admin não configurado no servidor.");
  }

  if (isAdmin(req)) {
    const { data, error, status, statusText } = await supabaseAdmin
      .from("books")
      .select("*");

    if (error) {
      console.error("[listBooksForRequest] erro do Supabase:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        status,
        statusText,
      });
      throw new Error("Erro ao consultar livros no Supabase: " + error.message);
    }

    console.log(
      "[listBooksForRequest] rows (admin) =",
      Array.isArray(data) ? data.length : 0
    );

    const list = Array.isArray(data) ? data.map(toListItem) : [];
    list.sort((a, b) =>
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
    );
    return list;
  }

  if (!uid) {
    throw new Error("Usuário autenticado sem id em req.user.id");
  }

  let result = await supabaseAdmin.from("books").select("*").eq("user_id", uid);

  if (result.error) {
    console.error("[listBooksForRequest] erro user_id:", {
      message: result.error.message,
      details: result.error.details,
      hint: result.error.hint,
      code: result.error.code,
    });
    throw new Error("Erro ao consultar livros no Supabase: " + result.error.message);
  }

  let data = Array.isArray(result.data) ? result.data : [];

  if (!data.length) {
    const resultOwner = await supabaseAdmin
      .from("books")
      .select("*")
      .eq("owner_id", uid);

    if (resultOwner.error) {
      console.error("[listBooksForRequest] erro owner_id:", {
        message: resultOwner.error.message,
        details: resultOwner.error.details,
        hint: resultOwner.error.hint,
        code: resultOwner.error.code,
      });
      throw new Error(
        "Erro ao consultar livros no Supabase (owner_id): " +
          resultOwner.error.message
      );
    }

    data = Array.isArray(resultOwner.data) ? resultOwner.data : [];
  }

  console.log("[listBooksForRequest] rows =", data.length);

  const list = data.map(toListItem);
  list.sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  );
  return list;
}

async function loadBookForRequest(supabaseAdmin, req, bookId) {
  const uid = String(req?.user?.id || "").trim();
  const id = String(bookId || "").trim();

  if (!id) return null;

  if (!supabaseAdmin) {
    throw new Error("Supabase Admin não configurado no servidor.");
  }

  console.log("[loadBookForRequest] req.user =", req?.user || null);
  console.log("[loadBookForRequest] uid =", uid);
  console.log("[loadBookForRequest] bookId =", id);
  console.log("[loadBookForRequest] isAdmin =", isAdmin(req));

  let data = null;
  let error = null;

  if (isAdmin(req)) {
    const result = await supabaseAdmin
      .from("books")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    data = result.data;
    error = result.error;
  } else {
    if (!uid) {
      throw new Error("Usuário autenticado sem id em req.user.id");
    }

    let result = await supabaseAdmin
      .from("books")
      .select("*")
      .eq("id", id)
      .eq("user_id", uid)
      .maybeSingle();

    data = result.data;
    error = result.error;

    if (!data && !error) {
      const resultOwner = await supabaseAdmin
        .from("books")
        .select("*")
        .eq("id", id)
        .eq("owner_id", uid)
        .maybeSingle();

      data = resultOwner.data;
      error = resultOwner.error;
    }
  }

  if (error) {
    console.error("[loadBookForRequest] erro do Supabase:", error);
    throw new Error("Erro ao carregar livro no Supabase: " + error.message);
  }

  if (!data) return null;

  const manifest = inferManifest(data);
  const child = inferChild(data);
  const pages = inferPages(data);
  const images = inferImages(data);

  return {
    ...manifest,
    ...data,

    id: String(data.id || manifest.id || ""),
    bookId: String(data.id || manifest.id || ""),
    dirId: String(data.id || manifest.id || ""),
    folderId: String(data.id || manifest.id || ""),
    ownerId: String(data.user_id || data.owner_id || manifest.ownerId || ""),

    status: String(data.status || manifest.status || "created"),
    step: String(data.step || manifest.step || ""),
    error: String(data.error || manifest.error || ""),

    theme: String(data.theme || manifest.theme || ""),
    style: String(data.style || manifest.style || "read"),

    child,
    pages,
    images,

    coverUrl: inferCoverUrl(data),
    pdf: inferPdfUrl(data),
    pdfUrl: inferPdfUrl(data),

    createdAt: toIso(data.created_at || manifest.createdAt),
    updatedAt: toIso(
      data.updated_at ||
        manifest.updatedAt ||
        data.created_at ||
        manifest.createdAt
    ),
  };
}

async function loadCoinOrderForRequest(supabaseAdmin, req, orderId) {
  const uid = String(req?.user?.id || "").trim();
  const id = String(orderId || "").trim();

  if (!id) return null;

  if (!supabaseAdmin) {
    throw new Error("Supabase Admin não configurado no servidor.");
  }

  console.log("[loadCoinOrderForRequest] req.user =", req?.user || null);
  console.log("[loadCoinOrderForRequest] uid =", uid);
  console.log("[loadCoinOrderForRequest] orderId =", id);
  console.log("[loadCoinOrderForRequest] isAdmin =", isAdmin(req));

  let data = null;
  let error = null;

  if (isAdmin(req)) {
    const result = await supabaseAdmin
      .from("coin_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    data = result.data;
    error = result.error;
  } else {
    if (!uid) {
      throw new Error("Usuário autenticado sem id em req.user.id");
    }

    const result = await supabaseAdmin
      .from("coin_orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", uid)
      .maybeSingle();

    data = result.data;
    error = result.error;
  }

  if (error) {
    console.error("[loadCoinOrderForRequest] erro do Supabase:", error);
    throw new Error("Erro ao carregar pedido de moedas no Supabase: " + error.message);
  }

  if (!data) return null;

  return {
    ...data,
    id: String(data.id || ""),
    orderId: String(data.id || ""),
    user_id: String(data.user_id || ""),
    pack: Number(data.pack || 0),
    price_amount: Number(data.price_amount || 0),
    bonus_coins: Number(data.bonus_coins || 0),
    credit_coins: Number(
      data.credit_coins || (Number(data.pack || 0) + Number(data.bonus_coins || 0))
    ),
    status: String(data.status || "pending"),
    created_at: data.created_at || null,
    updated_at: data.updated_at || null,
  };
}

function fallbackBooksHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Meus Livros</title>
</head>
<body style="font-family:Arial,sans-serif;padding:24px">
  <h1>Meus Livros</h1>
  <p>O renderer principal não foi carregado.</p>
  <p><a href="/sales">Ir para página inicial</a></p>
</body>
</html>`;
}

function fallbackPreviewHtml(book) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Preview do Livro</title>
</head>
<body style="font-family:Arial,sans-serif;padding:24px">
  <h1>Preview do Livro</h1>
  <pre>${escapeHtmlJson(book)}</pre>
</body>
</html>`;
}

function fallbackEditorHtml(book) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Editor do Livro</title>
</head>
<body style="font-family:Arial,sans-serif;padding:24px">
  <h1>Editor do Livro</h1>
  <pre>${escapeHtmlJson(book)}</pre>
</body>
</html>`;
}

function fallbackCheckoutHtml(book) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Checkout</title>
</head>
<body style="font-family:Arial,sans-serif;padding:24px">
  <h1>Checkout</h1>
  <p>Livro: <b>${escapeHtmlText(book?.id || "")}</b></p>
  <p><a href="/books">Voltar</a></p>
</body>
</html>`;
}

function fallbackCoinsCheckoutHtml(data) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Checkout de Moedas</title>
</head>
<body style="font-family:Arial,sans-serif;padding:24px">
  <h1>Checkout de moedas</h1>
  <p>Pedido: <b>${escapeHtmlText(data?.orderId || data?.id || "")}</b></p>
  <p>Pacote: <b>${escapeHtmlText(String(data?.pack || 0))}</b></p>
  <p>Preço: <b>${escapeHtmlText(String(data?.price_amount || 0))}</b></p>
  <p><a href="/profile">Voltar</a></p>
</body>
</html>`;
}

function escapeHtmlText(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlJson(v) {
  return escapeHtmlText(JSON.stringify(v || {}, null, 2));
}

module.exports = function mountRoutes(app, opts = {}) {
  const OUT_DIR = String(opts.OUT_DIR || process.cwd());
  const requireAuth = opts.requireAuth;
  const supabaseAdmin = opts.supabaseAdmin || null;

  if (!app) throw new Error("books/routes.js: app é obrigatório");
  if (typeof requireAuth !== "function") {
    throw new Error("books/routes.js: requireAuth é obrigatório");
  }

  const booksRendererPath = path.join(__dirname, "render.books.html.js");
  const previewRendererPath = path.join(__dirname, "render.preview.html.js");
  const editorRendererPath = path.join(__dirname, "render.editor.html.js");
  const checkoutRendererPath = path.join(__dirname, "render.checkout.html.js");

  // checkout de moedas fica na raiz do projeto
  const checkoutCoinsRendererPath = path.join(
    __dirname,
    "..",
    "render.checkout.coins.html.js"
  );

  const booksRendererMod = tryRequireAbs(booksRendererPath);
  const previewRendererMod = tryRequireAbs(previewRendererPath);
  const editorRendererMod = tryRequireAbs(editorRendererPath);
  const checkoutRendererMod = tryRequireAbs(checkoutRendererPath);
  const checkoutCoinsRendererMod = tryRequireAbs(checkoutCoinsRendererPath);

  console.log(
    "[books/routes] exports render.books.html.js =",
    booksRendererMod && typeof booksRendererMod === "object"
      ? Object.keys(booksRendererMod)
      : typeof booksRendererMod
  );

  const renderBooksHtml =
    pickFn(booksRendererMod, [
      "renderBooksHtml",
      "renderBooksGalleryHtml",
      "renderBooksPageHtml",
    ]) || (() => fallbackBooksHtml());

  const renderBookPreviewHtml =
    pickFn(previewRendererMod, [
      "renderBookPreviewHtml",
      "renderPreviewHtml",
      "renderPreview",
    ]) || ((book) => fallbackPreviewHtml(book));

  const renderBookEditorHtml =
    pickFn(editorRendererMod, [
      "renderBookEditorHtml",
      "renderEditorHtml",
      "renderEditor",
    ]) || ((book) => fallbackEditorHtml(book));

  const renderCheckoutHtml =
    pickFn(checkoutRendererMod, [
      "renderCheckoutHtml",
      "renderCheckoutPageHtml",
    ]) || ((book) => fallbackCheckoutHtml(book));

  const renderCheckoutCoinsHtml =
    pickFn(checkoutCoinsRendererMod, [
      "renderCheckoutCoinsHtml",
      "renderCoinCheckoutHtml",
      "renderCoinsCheckoutHtml",
      "renderCheckoutPageHtml",
    ]) || ((data) => fallbackCoinsCheckoutHtml(data));

  console.log("✅ books/routes.js montado com Supabase.");
  console.log("[books/routes] __dirname =", __dirname);
  console.log("[books/routes] OUT_DIR =", OUT_DIR);
  console.log("[books/routes] supabaseAdmin =", !!supabaseAdmin);
  console.log("[books/routes] renderBooksHtml =", typeof renderBooksHtml === "function");
  console.log(
    "[books/routes] renderBookPreviewHtml =",
    typeof renderBookPreviewHtml === "function"
  );
  console.log(
    "[books/routes] renderBookEditorHtml =",
    typeof renderBookEditorHtml === "function"
  );
  console.log(
    "[books/routes] renderCheckoutHtml =",
    typeof renderCheckoutHtml === "function"
  );
  console.log(
    "[books/routes] renderCheckoutCoinsHtml =",
    typeof renderCheckoutCoinsHtml === "function"
  );

  app.get("/api/books", requireAuth, async (req, res) => {
    try {
      console.log("==== /api/books ====");
      console.log("[api/books] user =", req.user);
      console.log("[api/books] isAdmin =", isAdmin(req));
      console.log("[api/books] supabaseAdmin =", !!supabaseAdmin);

      if (!supabaseAdmin) {
        return res.status(500).json({
          ok: false,
          error: "Supabase Admin não configurado no servidor",
        });
      }

      const books = await listBooksForRequest(supabaseAdmin, req);

      console.log("[api/books] encontrados =", books.length);

      return res.json({
        ok: true,
        books,
        isAdmin: isAdmin(req),
      });
    } catch (e) {
      console.error("ERRO /api/books:");
      console.error(e && e.stack ? e.stack : e);

      return res.status(500).json({
        ok: false,
        error: String(e?.message || e || "Erro"),
      });
    }
  });

  app.get("/books", requireAuth, async (req, res) => {
    try {
      const html = renderBooksHtml({
        user: req.user || null,
        books: [],
        OUT_DIR,
        isAdmin: isAdmin(req),
      });

      return res.type("html").send(html);
    } catch (e) {
      console.error("ERRO /books:");
      console.error(e && e.stack ? e.stack : e);

      return res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${escapeHtmlText(
            String(e?.message || e || "Erro")
          )}</pre></body></html>`
        );
    }
  });

  app.get("/preview", requireAuth, async (req, res) => {
    try {
      const bookId = String(req.query?.id || "").trim();
      if (!bookId) {
        return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");
      }

      if (!isUuid(bookId)) {
        return res
          .status(400)
          .type("html")
          .send("<h1>400</h1><p>ID do livro inválido</p>");
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .type("html")
          .send("<h1>500</h1><p>Supabase Admin não configurado</p>");
      }

      const book = await loadBookForRequest(supabaseAdmin, req, bookId);

      if (!book) {
        return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");
      }

      const html = renderBookPreviewHtml(book);
      return res.type("html").send(html);
    } catch (e) {
      console.error("ERRO /preview:");
      console.error(e && e.stack ? e.stack : e);

      return res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${escapeHtmlText(
            String(e?.message || e || "Erro")
          )}</pre></body></html>`
        );
    }
  });

  app.get("/books/:id", requireAuth, async (req, res) => {
    try {
      const bookId = String(req.params?.id || "").trim();
      if (!bookId) {
        return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");
      }

      if (!isUuid(bookId)) {
        return res
          .status(400)
          .type("html")
          .send("<h1>400</h1><p>ID do livro inválido</p>");
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .type("html")
          .send("<h1>500</h1><p>Supabase Admin não configurado</p>");
      }

      const book = await loadBookForRequest(supabaseAdmin, req, bookId);

      if (!book) {
        return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");
      }

      const html = renderBookPreviewHtml(book);
      return res.type("html").send(html);
    } catch (e) {
      console.error("ERRO /books/:id:");
      console.error(e && e.stack ? e.stack : e);

      return res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${escapeHtmlText(
            String(e?.message || e || "Erro")
          )}</pre></body></html>`
        );
    }
  });

  app.get("/books/:id/edit", requireAuth, async (req, res) => {
    try {
      const bookId = String(req.params?.id || "").trim();
      if (!bookId) {
        return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");
      }

      if (!isUuid(bookId)) {
        return res
          .status(400)
          .type("html")
          .send("<h1>400</h1><p>ID do livro inválido</p>");
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .type("html")
          .send("<h1>500</h1><p>Supabase Admin não configurado</p>");
      }

      const book = await loadBookForRequest(supabaseAdmin, req, bookId);

      if (!book) {
        return res.status(404).type("html").send("<h1>404</h1><p>Livro não encontrado</p>");
      }

      const html = renderBookEditorHtml(book);
      return res.type("html").send(html);
    } catch (e) {
      console.error("ERRO /books/:id/edit:");
      console.error(e && e.stack ? e.stack : e);

      return res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${escapeHtmlText(
            String(e?.message || e || "Erro")
          )}</pre></body></html>`
        );
    }
  });

  // IMPORTANTE: esta rota precisa vir antes de /checkout/:id
  app.get("/checkout/coins", requireAuth, async (req, res) => {
    try {
      const orderId = String(req.query?.order || "").trim();

      if (!orderId) {
        return res
          .status(400)
          .type("html")
          .send("<h1>400</h1><p>order ausente</p>");
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .type("html")
          .send("<h1>500</h1><p>Supabase Admin não configurado</p>");
      }

      const order = await loadCoinOrderForRequest(supabaseAdmin, req, orderId);

      if (!order) {
        return res
          .status(404)
          .type("html")
          .send("<h1>404</h1><p>Pedido de moedas não encontrado</p>");
      }

      const html = renderCheckoutCoinsHtml(order);
      return res.type("html").send(html);
    } catch (e) {
      console.error("ERRO /checkout/coins:");
      console.error(e && e.stack ? e.stack : e);

      return res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${escapeHtmlText(
            String(e?.message || e || "Erro")
          )}</pre></body></html>`
        );
    }
  });

  app.get("/checkout/:id", requireAuth, async (req, res) => {
    try {
      const bookId = String(req.params?.id || "").trim();
      if (!bookId) {
        return res.status(400).type("html").send("<h1>400</h1><p>id ausente</p>");
      }

      if (!isUuid(bookId)) {
        return res
          .status(400)
          .type("html")
          .send("<h1>400</h1><p>ID do livro inválido</p>");
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .type("html")
          .send("<h1>500</h1><p>Supabase Admin não configurado</p>");
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
      console.error("ERRO /checkout/:id:");
      console.error(e && e.stack ? e.stack : e);

      return res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html><body><h1>Erro</h1><pre>${escapeHtmlText(
            String(e?.message || e || "Erro")
          )}</pre></body></html>`
        );
    }
  });

  return true;
};