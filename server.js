// server.js
"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");
const core = require("./core");
const mountPages = require("./pages");

const app = express();

// Middlewares comuns
app.use(express.json({ limit: core.JSON_LIMIT }));
app.use(cookieParser());

// Monta as rotas das páginas
mountPages(app);

// Monta as rotas da API (prefixo /api)
app.use("/api", core.apiRouter);

// Inicia o servidor (se não estiver em ambiente Vercel)
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, () => {
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;