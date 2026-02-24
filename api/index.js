// api/index.js
"use strict";

/**
 * Entry point da Vercel Function.
 * Importa o Express app do arquivo raiz (app.js) e exporta direto.
 */
const app = require("../app.js");

module.exports = app;