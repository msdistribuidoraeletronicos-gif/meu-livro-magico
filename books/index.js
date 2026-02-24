// books/index.js
// Módulo: monta as rotas do /books no app principal
// ✅ NÃO cria servidor, NÃO faz app.listen, NÃO cria express()
// ✅ Só recebe o "app" e pluga as rotas do módulo
//
// Uso no app.js:
//   const mountBooks = require("./books"); // ./books/index.js
//   mountBooks(app, { OUT_DIR, USERS_DIR, requireAuth });
//
// Estrutura esperada:
//   books/
//     index.js
//     routes.js
//     repo.js (opcional)
//     render.books.html.js
//     render.preview.html.js
//     render.editor.html.js
//
// Obs: este arquivo é "blindado" para não quebrar import/export.
// - funciona com routes.js exportando função direto: module.exports = function(app, ctx){...}
// - ou exportando objeto: module.exports = { mountRoutes } ou { routes } etc.

"use strict";

const path = require("path");

function pickFn(mod) {
  if (typeof mod === "function") return mod;

  // tenta nomes comuns
  if (mod && typeof mod.mountRoutes === "function") return mod.mountRoutes;
  if (mod && typeof mod.mount === "function") return mod.mount;
  if (mod && typeof mod.routes === "function") return mod.routes;
  if (mod && typeof mod.default === "function") return mod.default;

  return null;
}

function must(v, name) {
  if (!v) throw new Error(`books/index.js: ${name} é obrigatório`);
  return v;
}

function isFn(v) {
  return typeof v === "function";
}

/**
 * mountBooks(app, { OUT_DIR, USERS_DIR, requireAuth })
 */
function mountBooks(app, opts = {}) {
  must(app, "app");

  const OUT_DIR = must(opts.OUT_DIR, "OUT_DIR");
  const USERS_DIR = must(opts.USERS_DIR, "USERS_DIR");

  const requireAuth = opts.requireAuth;
  if (!isFn(requireAuth)) {
    throw new Error("books/index.js: requireAuth precisa ser uma função (middleware).");
  }

  // Carrega routes.js com tolerância a export diferente
  let routesMod;
  try {
    routesMod = require(path.join(__dirname, "routes.js"));
  } catch (e) {
    // fallback: require("./routes") caso alguém renomeie extensão
    routesMod = require("./routes");
  }

  const mountRoutes = pickFn(routesMod);
  if (!mountRoutes) {
    const keys = routesMod && typeof routesMod === "object" ? Object.keys(routesMod).join(", ") : "";
    throw new Error(
      `books/index.js: routes.js não exporta uma função. ` +
        `Esperado: module.exports = function(...) ou module.exports = { mountRoutes }. ` +
        (keys ? `Exports encontrados: ${keys}` : "")
    );
  }

  // Contexto único passado para o módulo de rotas
  const ctx = {
    OUT_DIR,
    USERS_DIR,
    requireAuth,
  };

  // Monta efetivamente as rotas
  // ✅ O routes.js deve cadastrar:
  //   GET  /books
  //   GET  /api/books
  //   GET  /books/:id
  //   GET  /books/:id/edit
  // (ou o que você implementar lá)
  return mountRoutes(app, ctx);
}

// export principal (compatível com: const mountBooks = require("./books"))
module.exports = mountBooks;

// export nomeado (compatível com: const { mountBooks } = require("./books"))
module.exports.mountBooks = mountBooks;