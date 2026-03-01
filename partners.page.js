/**
 * partners.page.js — Central de Parceiros (Supabase)
 * Rotas:
 *  - GET  /parceiros
 *  - GET  /parceiros/cadastro?tipo=fabricacao|venda
 *  - POST /parceiros/cadastro
 *  - GET  /parceiros/perfil/:id
 *
 * Persistência: Supabase (tables: public.partners, public.partner_orders)
 *
 * ENV necessário (backend):
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY   (⚠️ somente no servidor)
 */

"use strict";

const express = require("express");
const { createClient } = require("@supabase/supabase-js");

module.exports = function mountPartnersPage(app, opts = {}) {
  app.use(express.urlencoded({ extended: true }));

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[partners] ENV faltando:", {
      hasUrl: !!SUPABASE_URL,
      hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
    });
    throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env/Vercel.");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const isDev = process.env.NODE_ENV !== "production";

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function moneyBR(v) {
    const n = Number(v || 0);
    return n.toFixed(2).replace(".", ",");
  }

  function statusLabel(s) {
    const st = String(s || "").toLowerCase();
    if (st === "para_aceitar") return "📥 Para aceitar";
    if (st === "em_fabricacao") return "🏭 Em fabricação";
    if (st === "finalizado") return "✅ Finalizado";
    if (st === "retorno") return "↩️ Retorno";
    if (st === "cancelado") return "⛔ Cancelado";
    return st || "-";
  }

  function layout(title, innerHtml) {
    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)}</title>
  <meta name="description" content="Central de Parceiros do Meu Livro Mágico"/>
  <style>
    :root{
      --violet-50:#f5f3ff; --pink-50:#fff1f2; --white:#ffffff;
      --gray-900:#111827; --gray-800:#1f2937; --gray-600:#4b5563;
      --violet-600:#7c3aed; --violet-700:#6d28d9;
      --pink-600:#db2777; --pink-700:#be185d;
      --shadow2: 0 12px 30px rgba(17,24,39,.10);
      --r: 22px;
    }
    *{ box-sizing:border-box; }
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      color: var(--gray-800);
      background: linear-gradient(180deg, var(--violet-50), var(--white) 46%, var(--pink-50));
      overflow-x:hidden;
    }
    a{ color:inherit; text-decoration:none; }
    .wrap{ max-width: 1100px; margin: 0 auto; padding: 0 16px; }
    .nav{ padding: 16px 0; display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .brand{ display:flex; align-items:center; gap:10px; font-weight:1000; letter-spacing:-.2px; }
    .logo{
      width:42px;height:42px;border-radius:14px; display:grid;place-items:center;
      background: linear-gradient(135deg, rgba(124,58,237,.14), rgba(219,39,119,.14));
      border: 1px solid rgba(124,58,237,.18);
      box-shadow: var(--shadow2); font-size:20px;
    }
    .btn{
      border:0; cursor:pointer; user-select:none;
      display:inline-flex; align-items:center; justify-content:center; gap:10px;
      padding: 12px 16px; border-radius: 999px; font-weight: 900;
      transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
      white-space:nowrap;
    }
    .btn:active{ transform: translateY(1px); }
    .btnPrimary{
      color:#fff;
      background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
      box-shadow: 0 18px 40px rgba(124,58,237,.20);
    }
    .btnPrimary:hover{
      background: linear-gradient(90deg, var(--violet-700), var(--pink-700));
      box-shadow: 0 18px 46px rgba(124,58,237,.26);
    }
    .btnOutline{
      color: var(--violet-700);
      background: rgba(255,255,255,.78);
      border: 2px solid rgba(221,214,254,.95);
      box-shadow: 0 12px 26px rgba(17,24,39,.06);
    }
    .btnOutline:hover{ background: rgba(245,243,255,.95); border-color: rgba(196,181,253,.95); }
    .card{
      background:#fff;
      border: 1px solid rgba(17,24,39,.06);
      border-radius: var(--r);
      box-shadow: var(--shadow2);
      padding: 18px;
    }
    .h1{ margin: 18px 0 10px; font-size: 34px; line-height:1.08; letter-spacing:-.8px; font-weight:1000; }
    .p{ margin:0; color: var(--gray-600); font-weight: 750; line-height:1.65; }
    .grid2{ display:grid; gap:14px; grid-template-columns: 1fr; }
    @media(min-width: 860px){ .grid2{ grid-template-columns: 1fr 1fr; } }
    .opt{
      border-radius: 18px;
      border: 1px solid rgba(124,58,237,.14);
      background: linear-gradient(180deg, rgba(124,58,237,.06), rgba(219,39,119,.04));
      padding: 16px;
      box-shadow: 0 14px 28px rgba(124,58,237,.08);
    }
    .opt h3{ margin:0 0 6px; font-size: 18px; font-weight:1000; }
    .opt p{ margin:0 0 12px; color: var(--gray-600); font-weight:750; line-height:1.6; }
    .formRow{ display:grid; gap:12px; grid-template-columns: 1fr; }
    @media(min-width: 860px){ .formRow{ grid-template-columns: 1fr 1fr; } }
    label{ display:block; font-weight:900; font-size: 13px; margin: 0 0 6px; color: rgba(31,41,55,.9); }
    input, select, textarea{
      width:100%;
      padding: 12px 12px;
      border-radius: 14px;
      border: 1px solid rgba(17,24,39,.10);
      background: rgba(255,255,255,.92);
      outline: none;
      font-weight: 750;
      color: rgba(17,24,39,.88);
    }
    textarea{ min-height: 92px; resize: vertical; }
    .dash{ display:grid; gap:14px; grid-template-columns: 1fr; margin-top: 16px; }
    @media(min-width: 980px){ .dash{ grid-template-columns: 280px 1fr; } }
    .menu a{
      display:flex; gap:10px; align-items:center;
      padding: 10px 12px; border-radius: 14px;
      font-weight: 900; color: rgba(31,41,55,.92);
      border: 1px solid rgba(17,24,39,.06);
      background: rgba(255,255,255,.70);
      margin-bottom: 10px;
    }
    .menu a:hover{ background: rgba(245,243,255,.92); border-color: rgba(196,181,253,.95); }
    .kpi{ display:grid; gap:12px; grid-template-columns: 1fr; }
    @media(min-width: 860px){ .kpi{ grid-template-columns: 1fr 1fr 1fr; } }
    .kpi .box{
      border-radius: 18px; border: 1px solid rgba(17,24,39,.06);
      background: #fff; padding: 14px; box-shadow: 0 12px 26px rgba(17,24,39,.06);
    }
    .kpi .t{ font-weight: 900; color: rgba(75,85,99,.92); font-size: 12px; }
    .kpi .v{ font-weight: 1000; font-size: 20px; margin-top: 6px; }
    .muted{ color: rgba(75,85,99,.9); font-weight:750; }
    .table{ width:100%; border-collapse: collapse; }
    .table th, .table td{
      text-align:left; padding:10px 10px;
      border-bottom: 1px solid rgba(17,24,39,.08);
      font-weight:750; vertical-align:top;
    }
    .table th{ font-weight:1000; color: rgba(75,85,99,.95); font-size:12px; }
    .pill{
      display:inline-flex; padding:6px 10px; border-radius:999px;
      border:1px solid rgba(17,24,39,.10);
      background: rgba(245,243,255,.72);
      font-weight:900; font-size:12px;
    }
    .err{
      margin-top:12px; padding:12px; border-radius:14px;
      border: 1px solid rgba(220,38,38,.25);
      background: rgba(254,226,226,.55);
      font-weight:800;
      color: rgba(127,29,29,.95);
      white-space:pre-wrap;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="nav">
      <div class="brand">
        <div class="logo">🤝</div>
        <div>Parceiros • Meu Livro Mágico</div>
      </div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <a class="btn btnOutline" href="/sales">⬅️ Voltar</a>
        <a class="btn btnPrimary" href="/parceiros">Central</a>
      </div>
    </div>

    ${innerHtml}

    <div style="padding: 26px 0 34px; color: rgba(75,85,99,.9); text-align:center; font-weight:750; font-size: 13px;">
      Feito com 💜 • Parceiros Meu Livro Mágico
    </div>
  </div>
</body>
</html>`;
  }

  // GET /parceiros
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
    `
      )
    );
  });

  // GET /parceiros/cadastro?tipo=...
  app.get("/parceiros/cadastro", (req, res) => {
    const tipo = String(req.query.tipo || "").toLowerCase();
    const isFab = tipo === "fabricacao";
    const isVenda = tipo === "venda";
    if (!isFab && !isVenda) return res.redirect("/parceiros");

    const title = isFab ? "Cadastro — Fabricação" : "Cadastro — Venda";

    const campoSegmento = isFab
      ? `<label>Tipo de negócio</label>
         <select name="segmento" required>
           <option value="">Selecione…</option>
           <option value="papelaria">Papelaria</option>
           <option value="grafica">Gráfica</option>
           <option value="personalizados">Personalizados</option>
           <option value="encadernacao">Encadernação</option>
           <option value="outro">Outro</option>
         </select>`
      : `<label>Seu negócio (escreva)</label>
         <input name="segmento_texto" placeholder="Ex.: presentes, mercado, personalizados, livraria…" required/>`;

    res.type("html").send(
      layout(
        title,
        `
      <div class="card">
        <div class="h1">${isFab ? "Cadastro de Parceiro — Fabricação 🏭" : "Cadastro de Parceiro — Venda 🧲"}</div>
        <p class="p">Preencha seus dados para criar seu perfil de parceiro.</p>
        <div style="height:14px"></div>

        <form method="POST" action="/parceiros/cadastro">
          <input type="hidden" name="tipo" value="${isFab ? "fabricacao" : "venda"}"/>

          <div class="formRow">
            <div>
              <label>Nome do responsável</label>
              <input name="responsavel" placeholder="Seu nome" required/>
            </div>
            <div>
              <label>Nome do negócio</label>
              <input name="negocio" placeholder="Ex.: Gráfica do João" required/>
            </div>
          </div>

          <div style="height:12px"></div>

          <div class="formRow">
            <div>${campoSegmento}</div>
            <div>
              <label>WhatsApp</label>
              <input name="whatsapp" placeholder="(DDD) 9xxxx-xxxx" required/>
            </div>
          </div>

          <div style="height:12px"></div>

          <div class="formRow">
            <div>
              <label>E-mail</label>
              <input type="email" name="email" placeholder="seuemail@exemplo.com" required/>
            </div>
            <div>
              <label>Cidade/UF</label>
              <input name="cidade" placeholder="Ex.: Aquidauana - MS" required/>
            </div>
          </div>

          <div style="height:12px"></div>

          <div class="formRow">
            <div>
              <label>Endereço</label>
              <input name="endereco" placeholder="Rua, nº, bairro" required/>
            </div>
            <div>
              <label>CEP</label>
              <input name="cep" placeholder="00000-000" required/>
            </div>
          </div>

          <div style="height:12px"></div>

          <div>
            <label>Observações</label>
            <textarea name="obs" placeholder="Horário, referências, etc."></textarea>
          </div>

          <div style="height:16px"></div>

          <button class="btn btnPrimary" type="submit">Criar meu perfil</button>
          <a class="btn btnOutline" href="/parceiros" style="margin-left:10px;">Voltar</a>
        </form>
      </div>
    `
      )
    );
  });

  // POST /parceiros/cadastro
  app.post("/parceiros/cadastro", async (req, res) => {
    try {
      const tipo = String(req.body.tipo || "").toLowerCase();
      const isFab = tipo === "fabricacao";
      const isVenda = tipo === "venda";
      if (!isFab && !isVenda) return res.redirect("/parceiros");

      const responsavel = String(req.body.responsavel || "").trim();
      const negocio = String(req.body.negocio || "").trim();
      const whatsapp = String(req.body.whatsapp || "").trim();
      const email = String(req.body.email || "").trim();
      const cidade = String(req.body.cidade || "").trim();
      const endereco = String(req.body.endereco || "").trim();
      const cep = String(req.body.cep || "").trim();
      const obs = String(req.body.obs || "").trim();
      const segmento = isFab ? String(req.body.segmento || "").trim() : String(req.body.segmento_texto || "").trim();

      const parceiroRow = {
        tipo,
        responsavel,
        negocio,
        segmento: segmento || null,
        whatsapp,
        email,
        cidade,
        endereco,
        cep,
        obs: obs || null,

        comissao_venda_percent: isVenda ? 10 : 0,
        fabricacao_por_pedido: isFab ? 20 : 0,
        entrega_por_pedido: isFab ? 8 : 0,
      };

      const { data, error } = await supabase.from("partners").insert(parceiroRow).select("*").single();
      if (error) {
        console.error("[partners] INSERT partners error:", error);
        throw error;
      }

      return res.redirect(`/parceiros/perfil/${encodeURIComponent(data.id)}`);
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] cadastro erro:", msg);

      res.status(500).type("html").send(
        layout(
          "Erro",
          `
          <div class="card">
            <div class="h1">Ops…</div>
            <p class="p">Não foi possível criar seu perfil agora. Tente novamente.</p>
            ${isDev ? `<div class="err">DEV ERROR:\n${esc(msg)}</div>` : ``}
            <div style="height:14px"></div>
            <a class="btn btnPrimary" href="/parceiros">Voltar para Central</a>
          </div>
        `
        )
      );
    }
  });

  // GET /parceiros/perfil/:id
  app.get("/parceiros/perfil/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.redirect("/parceiros");

      const { data: p, error: pErr } = await supabase.from("partners").select("*").eq("id", id).single();
      if (pErr || !p) return res.redirect("/parceiros");

      const { data: pedidos, error: oErr } = await supabase
        .from("partner_orders")
        .select("*")
        .eq("partner_id", id)
        .order("created_at", { ascending: false });

      if (oErr) console.error("[partners] select orders error:", oErr);

      const orders = Array.isArray(pedidos) ? pedidos : [];

      const pedidos_para_aceitar = orders.filter((x) => x.status === "para_aceitar").length;
      const pedidos_em_fabricacao = orders.filter((x) => x.status === "em_fabricacao").length;
      const pedidos_finalizados = orders.filter((x) => x.status === "finalizado").length;
      const pedidos_retorno = orders.filter((x) => x.status === "retorno").length;
      const caixa_total = orders.reduce((acc, x) => acc + Number(x.ganho_parceiro || 0), 0);

      const isFab = p.tipo === "fabricacao";
      const title = isFab ? "Perfil — Fabricação" : "Perfil — Venda";

      const menuFab = `
        <a href="#caixa">💰 Meu caixa</a>
        <a href="#aceitar">📥 Pedidos para aceitar</a>
        <a href="#emf">🏭 Pedidos em fabricação</a>
        <a href="#finalizados">✅ Pedidos finalizados</a>
        <a href="#retorno">↩️ Pedidos com retorno</a>
        <a href="#como">❓ Como funciona</a>
        <a href="#historico">📚 Histórico</a>
      `;

      const menuVenda = `
        <a href="#caixa">💰 Meu caixa</a>
        <a href="#aceitar">📥 Pedidos para aceitar</a>
        <a href="#emf">🧾 Pedidos em fabricação</a>
        <a href="#finalizados">✅ Pedidos finalizados</a>
        <a href="#retorno">↩️ Pedidos com retorno</a>
        <a href="#como">❓ Como funciona</a>
        <a href="#links">🔗 Meus links</a>
        <a href="#historico">📚 Histórico</a>
      `;

      const host = req.get("host") || "seusite.com";
      const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
      const linkVenda = `${proto}://${host}/?ref=${encodeURIComponent(p.id)}`;

      const historicoHtml =
        orders.length === 0
          ? `<div class="muted">Ainda não há pedidos registrados para este parceiro.</div>`
          : `
            <div style="overflow:auto;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Ganho</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders
                    .slice(0, 50)
                    .map((o) => {
                      const when = o.created_at ? new Date(o.created_at).toLocaleString("pt-BR") : "-";
                      const tipo = o.tipo === "fabricacao" ? "🏭 Fabricação" : "🧲 Venda";
                      const cli = [o.cliente_nome, o.cliente_cidade].filter(Boolean).join(" • ") || "-";
                      const total = `R$ ${moneyBR(o.valor_total)}`;
                      const ganho = `R$ ${moneyBR(o.ganho_parceiro)}`;
                      return `
                        <tr>
                          <td>${esc(when)}</td>
                          <td>${esc(tipo)}</td>
                          <td><span class="pill">${esc(statusLabel(o.status))}</span></td>
                          <td>${esc(cli)}</td>
                          <td>${esc(total)}</td>
                          <td>${esc(ganho)}</td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
            <div style="height:10px"></div>
            <div class="muted">Mostrando os 50 pedidos mais recentes.</div>
          `;

      res.type("html").send(
        layout(
          title,
          `
      <div class="card">
        <div class="h1">${isFab ? "Painel do Parceiro — Fabricação 🏭" : "Painel do Parceiro — Venda 🧲"}</div>
        <p class="p">
          <b>${esc(p.negocio)}</b> • ${esc(p.cidade)} • ${esc(p.whatsapp)}<br/>
          Segmento: <b>${esc(p.segmento || "-")}</b>
        </p>
      </div>

      <div class="dash">
        <div class="menu">
          <div class="card">
            <div style="font-weight:1000; margin-bottom:10px;">Menu</div>
            ${isFab ? menuFab : menuVenda}
          </div>
        </div>

        <div>
          <div class="kpi">
            <div class="box" id="caixa">
              <div class="t">Meu caixa</div>
              <div class="v">R$ ${moneyBR(caixa_total)}</div>
              <div class="muted">${isFab ? "R$ 28 por pedido (20+8)" : "10% por compra via link"}</div>
            </div>
            <div class="box" id="aceitar">
              <div class="t">Para aceitar</div>
              <div class="v">${pedidos_para_aceitar}</div>
              <div class="muted">Pedidos aguardando ação</div>
            </div>
            <div class="box" id="finalizados">
              <div class="t">Finalizados</div>
              <div class="v">${pedidos_finalizados}</div>
              <div class="muted">Histórico de conclusões</div>
            </div>
          </div>

          <div style="height:14px"></div>

          <div class="kpi">
            <div class="box" id="emf">
              <div class="t">${isFab ? "Em fabricação" : "Em andamento"}</div>
              <div class="v">${pedidos_em_fabricacao}</div>
              <div class="muted">Pedidos em processamento</div>
            </div>
            <div class="box" id="retorno">
              <div class="t">Retorno</div>
              <div class="v">${pedidos_retorno}</div>
              <div class="muted">Pedidos com pendência</div>
            </div>
            <div class="box">
              <div class="t">Total de pedidos</div>
              <div class="v">${orders.length}</div>
              <div class="muted">Todos os pedidos deste parceiro</div>
            </div>
          </div>

          <div style="height:14px"></div>

          <div class="card" id="como">
            <div style="font-weight:1000; margin-bottom:8px;">Como funciona</div>
            ${
              isFab
                ? `
              <div class="muted">
                Quando um pedido for realizado na sua cidade, ele cai em <b>Pedidos para aceitar</b>.
                Você pode <b>aceitar</b> ou <b>recusar</b>. Aceitando, ele vai para <b>Pedidos em fabricação</b>.
                Ao finalizar e entregar, marque como <b>finalizado</b>. Cada pedido rende <b>R$ 28</b> (R$ 20 fabricação + R$ 8 entrega).
              </div>
            `
                : `
              <div class="muted">
                Você gera um <b>link de divulgação</b> em <b>Meus links</b>. Quando alguém compra por ele,
                você ganha <b>10%</b> do valor total. Seus ganhos aparecem em <b>Meu caixa</b>.
              </div>
            `
            }
          </div>

          ${
            isFab
              ? ""
              : `
            <div style="height:14px"></div>
            <div class="card" id="links">
              <div style="font-weight:1000; margin-bottom:8px;">Meus links</div>
              <div class="muted">Link de divulgação:</div>
              <div style="height:8px"></div>
              <input readonly value="${esc(linkVenda)}"/>
              <div style="height:10px"></div>
              <div class="muted">Dica: use esse link em bio, stories e WhatsApp.</div>
            </div>
          `
          }

          <div style="height:14px"></div>
          <div class="card" id="historico">
            <div style="font-weight:1000; margin-bottom:8px;">Histórico de pedidos</div>
            ${historicoHtml}
          </div>
        </div>
      </div>
    `
        )
      );
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] perfil erro:", msg);
      res.status(500).type("html").send(
        layout(
          "Erro",
          `
          <div class="card">
            <div class="h1">Erro ao abrir o perfil</div>
            <p class="p">Tente novamente.</p>
            ${isDev ? `<div class="err">DEV ERROR:\n${esc(msg)}</div>` : ``}
            <div style="height:14px"></div>
            <a class="btn btnPrimary" href="/parceiros">Voltar para Central</a>
          </div>
        `
        )
      );
    }
  });
};