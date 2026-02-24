// api/index.js
"use strict";

const app = require("../app.js");

// Express app é uma função (req,res), então pode exportar direto.
// Mas deixo explícito pra ficar 100% compatível com @vercel/node.
module.exports = (req, res) => app(req, res);