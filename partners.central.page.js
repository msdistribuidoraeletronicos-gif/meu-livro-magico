/**
 * partners.central.page.js — Central "Seja Parceiro"
 * Rotas:
 *  - GET /parceiros
 */
"use strict";

const { buildPartnersShared } = require("./partners.shared");

module.exports = function mountPartnersCentral(app, opts = {}) {
  const shared = buildPartnersShared(app, opts);
  const { layout } = shared;

  app.get("/parceiros", (req, res) => {
    res.type("html").send(
      layout(
        "Seja Parceiro",
        `
        <div class="card">
          <div class="h1">Seja Parceiro 🤝</div>
          <p class="p">Escolha como você quer ganhar com o Meu Livro Mágico: <b>Fabricando</b> os livros na sua cidade ou <b>Vendendo</b> com seu link de divulgação.</p>
          <div style="height:14px"></div>

          <div class="grid2">
            <div class="opt">
              <h3>🏭 Fabricação</h3>
              <p>Receba pedidos da sua cidade, aceite/recuse, produza e entregue. <b>R$ 28 por pedido</b> (R$ 20 fabricação + R$ 8 entrega).</p>
              <a class="btn btnPrimary" href="/parceiros/cadastro?tipo=fabricacao">Quero Fabricar</a>
            </div>

            <div class="opt">
              <h3>🧲 Venda</h3>
              <p>Gere seu link, divulgue e ganhe <b>10%</b> do valor total de cada compra feita pelo seu link.</p>
              <a class="btn btnPrimary" href="/parceiros/cadastro?tipo=venda">Quero Vender</a>
            </div>
          </div>
        </div>
        `,
        `
        <a class="btn btnOutline" href="/sales">⬅️ Voltar</a>
        <a class="btn btnPrimary" href="/parceiros/login">🔐 Sou Parceiro</a>
        `
      )
    );
  });
};