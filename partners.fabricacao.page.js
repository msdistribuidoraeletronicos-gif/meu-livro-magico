/**
 * partners.fabricacao.page.js — Parceiros (Fabricação)
 * UNIFICADO: usa as funções JWT do shared para autenticação.
 */
"use strict";

const { buildPartnersShared } = require("./partners.shared");

module.exports = function mountPartnersFabricacao(app, opts = {}) {
  const shared = buildPartnersShared(app, opts);
  const {
    isDev,
    supabase,
    layout,
    esc,
    moneyBR,
    statusLabel,
    hashPassword,
    COOKIE_SECRET,
    setPartnerCookie,            // middleware
    requirePartner,
    requirePartnerAuthForId,
    getBaseUrl,
  } = shared;

  // =========================
  // CADASTRO — somente Fabricação
  // =========================
  app.get("/parceiros/cadastro", (req, res, next) => {
    const tipo = String(req.query.tipo || "").toLowerCase();
    if (tipo !== "fabricacao") return next();

    const title = "Cadastro — Fabricação";
    const campoSegmento = `
      <label>Tipo de negócio</label>
      <select name="segmento" required>
        <option value="">Selecione…</option>
        <option value="papelaria">Papelaria</option>
        <option value="grafica">Gráfica</option>
        <option value="personalizados">Personalizados</option>
        <option value="encadernacao">Encadernação</option>
        <option value="outro">Outro</option>
      </select>
    `;

    res.type("html").send(
      layout(
        title,
        `
        <div class="card">
          <div class="h1">Cadastro de Parceiro — Fabricação 🏭</div>
          <p class="p">Preencha seus dados para criar seu perfil de parceiro.</p>
          <div style="height:14px"></div>

          <form method="POST" action="/parceiros/cadastro">
            <input type="hidden" name="tipo" value="fabricacao"/>

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

            <div class="formRow">
              <div>
                <label>Senha (para acessar seu painel)</label>
                <input type="password" name="senha" placeholder="Crie uma senha" required/>
                <div class="muted" style="margin-top:6px;">Guarde essa senha. Você vai usar no Login.</div>
              </div>
              <div>
                <label>Confirmar senha</label>
                <input type="password" name="senha2" placeholder="Repita a senha" required/>
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

  app.post("/parceiros/cadastro", async (req, res, next) => {
    const tipo = String(req.body.tipo || "").toLowerCase();
    if (tipo !== "fabricacao") return next();

    try {
      const responsavel = String(req.body.responsavel || "").trim();
      const negocio = String(req.body.negocio || "").trim();
      const whatsapp = String(req.body.whatsapp || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const cidade = String(req.body.cidade || "").trim();
      const endereco = String(req.body.endereco || "").trim();
      const cep = String(req.body.cep || "").trim();
      const obs = String(req.body.obs || "").trim();
      const segmento = String(req.body.segmento || "").trim();

      const senha = String(req.body.senha || "");
      const senha2 = String(req.body.senha2 || "");
      if (!senha || senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      if (senha !== senha2) throw new Error("As senhas não conferem.");

      const { data: exists, error: exErr } = await supabase
        .from("partners")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (exErr) console.error("[partners] check email error:", exErr);

      if (exists?.id) {
        return res.status(409).type("html").send(
          layout(
            "E-mail já cadastrado",
            `
            <div class="card">
              <div class="h1">E-mail já cadastrado</div>
              <p class="p">Esse e-mail já tem um parceiro registrado. Faça login para acessar.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/login">Ir para Login</a>
              <a class="btn btnOutline" href="/parceiros/esqueci" style="margin-left:10px;">Esqueci a senha</a>
            </div>
            `
          )
        );
      }

      const parceiroRow = {
        tipo: "fabricacao",
        responsavel,
        negocio,
        segmento: segmento || null,
        whatsapp,
        email,
        cidade,
        endereco,
        cep,
        obs: obs || null,
        password_hash: hashPassword(senha),
        comissao_venda_percent: 0,
        fabricacao_por_pedido: 20,
        entrega_por_pedido: 8,
      };

      const { data, error } = await supabase.from("partners").insert(parceiroRow).select("*").single();
      if (error) {
        console.error("[partners] INSERT partners error:", error);
        throw error;
      }

      if (!COOKIE_SECRET && !isDev) throw new Error("Defina PARTNER_COOKIE_SECRET no ambiente de produção.");

      setPartnerCookie(res, data.id); // usa JWT do shared

      res.setHeader("Cache-Control", "no-store");
      return res.redirect(303, `/parceiros/perfil/${encodeURIComponent(data.id)}`);
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] cadastro (fab) erro:", msg);

      return res.status(500).type("html").send(
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

  // =========================
  // AÇÕES DE PEDIDOS (FUNCIONAL)
  // POST /parceiros/pedido/:orderId/status  body: status=...
  // =========================
  app.post("/parceiros/pedido/:orderId/status", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const orderId = String(req.params.orderId || "").trim();
      const nextStatus = String(req.body.status || "").trim();

      const allowed = new Set(["para_aceitar", "em_fabricacao", "finalizado", "retorno", "recusado"]);
      if (!orderId) return res.status(400).json({ ok: false, error: "orderId inválido" });
      if (!allowed.has(nextStatus)) return res.status(400).json({ ok: false, error: "status inválido" });

      const { data: o, error: oErr } = await supabase
        .from("partner_orders")
        .select("id,partner_id,status")
        .eq("id", orderId)
        .single();
      if (oErr || !o) return res.status(404).json({ ok: false, error: "pedido não encontrado" });

      // Verifica autenticação e ownership com shared
      if (!requirePartnerAuthForId(req, res, o.partner_id)) {
        return res.status(401).json({ ok: false, error: "não autenticado" });
      }

      const cur = String(o.status || "");
      const can = (from, to) => {
        const map = {
          para_aceitar: new Set(["em_fabricacao", "recusado", "retorno"]),
          em_fabricacao: new Set(["finalizado", "retorno"]),
          retorno: new Set(["em_fabricacao", "finalizado"]),
          finalizado: new Set([]),
          recusado: new Set([]),
        };
        return (map[from] || new Set()).has(to);
      };

      if (!isDev && !can(cur, nextStatus)) {
        return res.status(400).json({ ok: false, error: `Transição não permitida: ${cur} → ${nextStatus}` });
      }

      const upd = await supabase
        .from("partner_orders")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (upd.error) {
        console.error("[partners] update order status error:", upd.error);
        return res.status(500).json({ ok: false, error: "Falha ao atualizar" });
      }

      return res.json({ ok: true });
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] pedido status erro:", msg);
      return res.status(500).json({ ok: false, error: "Erro interno" });
    }
  });

  // =========================
  // PERFIL — painel
  // =========================
  app.get("/parceiros/perfil/:id", requirePartner, async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const id = String(req.params.id || "").trim();
      if (!id) return res.redirect("/parceiros");

      // req.partnerId vem do middleware requirePartner
      if (String(req.partnerId) !== String(id)) {
        return res.status(403).type("html").send(
          layout(
            "Acesso negado",
            `<div class="card"><h1>403</h1><p>Você não tem permissão para acessar este perfil.</p><a href="/parceiros">Voltar</a></div>`
          )
        );
      }

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
      const pedidos_recusados = orders.filter((x) => x.status === "recusado").length;
      const caixa_total = orders.reduce((acc, x) => acc + Number(x.ganho_parceiro || 0), 0);

      const tipoNorm = String(p.tipo || "").trim().toLowerCase();
      const isFab = tipoNorm === "fabricacao";

      const title = "Perfil — Fabricação";

      const fmtWhen = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "-");
      const fmtCli = (o) => [o.cliente_nome, o.cliente_cidade].filter(Boolean).join(" • ") || "-";
      const fmtMoney = (v) => `R$ ${moneyBR(v)}`;

      // ---- Progressos “humanos” (não viciantes): completude do perfil e nível por entregas
      const profileFields = [
        ["responsavel", p.responsavel],
        ["negocio", p.negocio],
        ["segmento", p.segmento],
        ["whatsapp", p.whatsapp],
        ["email", p.email],
        ["cidade", p.cidade],
        ["endereco", p.endereco],
        ["cep", p.cep],
      ];
      const filled = profileFields.filter(([, v]) => String(v || "").trim()).length;
      const total = profileFields.length;
      const profilePct = Math.round((filled / total) * 100);

      const level = (() => {
        const n = Number(pedidos_finalizados || 0);
        if (n >= 50) return { name: "Ouro", icon: "🥇", hint: "Excelência em entregas" };
        if (n >= 15) return { name: "Prata", icon: "🥈", hint: "Boa consistência" };
        if (n >= 5) return { name: "Bronze", icon: "🥉", hint: "Primeiros resultados" };
        return { name: "Iniciante", icon: "✨", hint: "Começando agora" };
      })();

      const ordersParaAceitar = orders.filter((x) => x.status === "para_aceitar");
      const ordersEmFab = orders.filter((x) => x.status === "em_fabricacao");
      const ordersFinal = orders.filter((x) => x.status === "finalizado");
      const ordersRetorno = orders.filter((x) => x.status === "retorno");
      const ordersRecusados = orders.filter((x) => x.status === "recusado");

      // “Feed” suave (sem rolagem infinita): mostrar 50 e pronto.
      const renderOrdersTable = (list, { showActions }) => {
        if (!list || list.length === 0) {
          return `<div class="empty">
            <div class="emptyIcon">📭</div>
            <div class="emptyTitle">Nada por aqui</div>
            <div class="emptyText">Quando houver pedidos nesta etapa, eles aparecem aqui.</div>
          </div>`;
        }

        return `
          <div class="tableWrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Ganho</th>
                  ${showActions ? `<th style="width:290px;">Ações</th>` : ``}
                </tr>
              </thead>
              <tbody>
                ${list
                  .slice(0, 50)
                  .map((o) => {
                    const st = String(o.status || "");
                    const actions = showActions
                      ? `
                        <div class="rowActions">
                          ${
                            st === "para_aceitar"
                              ? `
                                <button class="btnSmall btnOk" data-action="setStatus" data-id="${esc(
                                  o.id
                                )}" data-status="em_fabricacao" type="button">✅ Aceitar</button>
                                <button class="btnSmall btnWarn" data-action="setStatus" data-id="${esc(
                                  o.id
                                )}" data-status="retorno" type="button">↩️ Retorno</button>
                                <button class="btnSmall btnBad" data-action="setStatus" data-id="${esc(
                                  o.id
                                )}" data-status="recusado" type="button">⛔ Recusar</button>
                              `
                              : st === "em_fabricacao"
                              ? `
                                <button class="btnSmall btnOk" data-action="setStatus" data-id="${esc(
                                  o.id
                                )}" data-status="finalizado" type="button">✅ Finalizar</button>
                                <button class="btnSmall btnWarn" data-action="setStatus" data-id="${esc(
                                  o.id
                                )}" data-status="retorno" type="button">↩️ Retorno</button>
                              `
                              : st === "retorno"
                              ? `
                                <button class="btnSmall btnOk" data-action="setStatus" data-id="${esc(
                                  o.id
                                )}" data-status="em_fabricacao" type="button">🏭 Voltar</button>
                                <button class="btnSmall btnOk" data-action="setStatus" data-id="${esc(
                                  o.id
                                )}" data-status="finalizado" type="button">✅ Finalizar</button>
                              `
                              : `<span class="muted">Sem ações</span>`
                          }
                        </div>
                      `
                      : ``;

                    return `
                      <tr>
                        <td>${esc(fmtWhen(o.created_at))}</td>
                        <td>${esc(fmtCli(o))}</td>
                        <td><span class="pill pill-${esc(st)}">${esc(statusLabel(st))}</span></td>
                        <td>${esc(fmtMoney(o.valor_total))}</td>
                        <td>${esc(fmtMoney(o.ganho_parceiro))}</td>
                        ${showActions ? `<td>${actions}</td>` : ``}
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="hint">Mostrando os 50 pedidos mais recentes desta seção.</div>
        `;
      };

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
                      const tipoTxt = o.tipo === "fabricacao" ? "🏭 Fabricação" : "🧲 Venda";
                      const cli = [o.cliente_nome, o.cliente_cidade].filter(Boolean).join(" • ") || "-";
                      const totalV = `R$ ${moneyBR(o.valor_total)}`;
                      const ganhoV = `R$ ${moneyBR(o.ganho_parceiro)}`;
                      const st = String(o.status || "");
                      return `
                        <tr>
                          <td>${esc(when)}</td>
                          <td>${esc(tipoTxt)}</td>
                          <td><span class="pill pill-${esc(st)}">${esc(statusLabel(o.status))}</span></td>
                          <td>${esc(cli)}</td>
                          <td>${esc(totalV)}</td>
                          <td>${esc(ganhoV)}</td>
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

      // Badges “reais”: só aparecem se houver pendência (urgência natural, sem exagero)
      const badge = (n, tone) => {
        const v = Number(n || 0);
        if (!v) return "";
        const cls = tone || "alert";
        return `<span class="badge badge-${esc(cls)}" title="${esc(String(v))}">${esc(String(v))}</span>`;
      };

      const baseMenuFab = [
        { id: "visao", label: "📌 Visão geral" },
        { id: "caixa", label: "💰 Meu caixa" },
        { id: "aceitar", label: `📥 Para aceitar ${badge(pedidos_para_aceitar, "alert")}` },
        { id: "emf", label: `🏭 Em fabricação ${badge(pedidos_em_fabricacao, "info")}` },
        { id: "retorno", label: `↩️ Retorno ${badge(pedidos_retorno, "warn")}` },
        { id: "finalizados", label: "✅ Finalizados" },
        { id: "recusados", label: "⛔ Recusados" },
        { id: "como", label: "❓ Como funciona" },
        { id: "link", label: "🔗 Gerar link" },
        { id: "historico", label: "📚 Histórico" },
      ];

      const menuItems = baseMenuFab;

      const sidebarHtml = `
        <div class="sideCard">
          <div class="sideTop">
            <div class="sideTitle">Menu</div>
            <div style="display:flex; gap:10px; align-items:center;">
              <button class="focusBtn" data-action="toggleFocus" type="button" title="Ativar/desativar modo foco">
                🧘 <span>Foco</span>
              </button>
              <button class="refreshBtn" data-action="refresh" type="button" title="Atualizar">
                <span class="spin" aria-hidden="true">⟳</span>
                <span>Atualizar</span>
              </button>
            </div>
          </div>
          <div class="lastSync muted" id="lastSync">Atualizado agora</div>

          <div class="sideNav">
            ${menuItems
              .map(
                (m, idx) => `
              <button class="navBtn ${idx === 0 ? "active" : ""}" data-tab="${esc(m.id)}" type="button">
                <span class="navLabel">${m.label}</span>
                <span class="chev">›</span>
              </button>`
              )
              .join("")}
          </div>

          <div class="sideMini">
            <div class="miniLine">
              <span class="muted">Nível</span>
              <span class="lvl">${esc(level.icon)} <b>${esc(level.name)}</b></span>
            </div>
            <div class="miniHint muted">${esc(level.hint)}</div>

            <div style="height:10px"></div>

            <div class="miniLine">
              <span class="muted">Perfil</span>
              <span class="muted"><b>${esc(String(profilePct))}%</b> completo</span>
            </div>
            <div class="bar">
              <div class="barFill" style="width:${esc(String(profilePct))}%;"></div>
            </div>
            <div class="miniHint muted">Quanto mais completo, mais fácil confirmar cidade/entrega.</div>
          </div>
        </div>
      `;

      const headerKpis = `
        <div class="kpiGrid">
          <div class="kpiCard">
            <div class="kpiTop">
              <div class="kpiTitle">Meu caixa</div>
              <div class="kpiBadge">Fabricação</div>
            </div>
            <div class="kpiValue">${fmtMoney(caixa_total)}</div>
            <div class="kpiSub">R$ 28 por pedido (20+8)</div>
          </div>

          <div class="kpiCard">
            <div class="kpiTitle">Total de pedidos</div>
            <div class="kpiValue">${orders.length}</div>
            <div class="kpiSub">Todos os pedidos do parceiro</div>
          </div>

          <div class="kpiCard kpiCardHot">
            <div class="kpiTitle">Para aceitar</div>
            <div class="kpiValue">${pedidos_para_aceitar}</div>
            <div class="kpiSub">Pendências de ação</div>
          </div>

          <div class="kpiCard">
            <div class="kpiTitle">Em fabricação</div>
            <div class="kpiValue">${pedidos_em_fabricacao}</div>
            <div class="kpiSub">Pedidos em progresso</div>
          </div>
        </div>
      `;

      const pendNow = pedidos_para_aceitar + pedidos_em_fabricacao + pedidos_retorno;
      const doneNow = pedidos_finalizados;
      const dayPct = pendNow + doneNow ? Math.round((doneNow / (pendNow + doneNow)) * 100) : 0;

      const tabVisao = `
        <div class="panel" data-panel="visao">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Visão geral</div>
              <div class="muted">Resumo do que está acontecendo agora.</div>
            </div>
            <div class="panelRight">
              <div class="softPill" title="Nível baseado em pedidos finalizados">${esc(level.icon)} ${esc(level.name)}</div>
            </div>
          </div>

          ${headerKpis}

          <div style="height:12px"></div>

          <div class="note">
            <div class="noteTop">
              <div><b>Progresso do dia</b> <span class="muted">(apenas um resumo)</span></div>
              <div class="muted"><b>${esc(String(dayPct))}%</b> concluído</div>
            </div>
            <div class="bar barBig"><div class="barFill" style="width:${esc(String(dayPct))}%;"></div></div>
            <div style="height:10px"></div>
            <div class="muted">Dica rápida: priorize “Para aceitar” e “Retorno” para manter o fluxo leve.</div>
          </div>

          <div style="height:12px"></div>

          <div class="split">
            <div class="miniCard">
              <div class="miniTitle">✅ Finalizados</div>
              <div class="miniValue">${pedidos_finalizados}</div>
              <div class="muted">Pedidos concluídos</div>
            </div>
            <div class="miniCard miniWarn">
              <div class="miniTitle">↩️ Retorno</div>
              <div class="miniValue">${pedidos_retorno}</div>
              <div class="muted">Pendências</div>
            </div>
            <div class="miniCard miniBad">
              <div class="miniTitle">⛔ Recusados</div>
              <div class="miniValue">${pedidos_recusados}</div>
              <div class="muted">Pedidos recusados</div>
            </div>
          </div>
        </div>
      `;

      const tabCaixa = `
        <div class="panel" data-panel="caixa" style="display:none;">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Meu caixa</div>
              <div class="muted">
                Você ganha R$ 28 por pedido finalizado (R$ 20 fabricação + R$ 8 entrega).
              </div>
            </div>
            <div class="panelRight">
              <div class="cashPill">${fmtMoney(caixa_total)}</div>
            </div>
          </div>
          <div class="note">
            <b>Importante:</b> este painel soma os ganhos registrados em cada pedido.
            Se quiser, depois eu adiciono “saldo disponível / a receber”.
          </div>
        </div>
      `;

      const tabAceitar = `
        <div class="panel" data-panel="aceitar" style="display:none;">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Pedidos para aceitar</div>
              <div class="muted">Aceite para iniciar a produção, ou marque como retorno/recusado.</div>
            </div>
          </div>
          ${renderOrdersTable(ordersParaAceitar, { showActions: true })}
        </div>
      `;

      const tabEmFab = `
        <div class="panel" data-panel="emf" style="display:none;">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Pedidos em fabricação</div>
              <div class="muted">Quando concluir, marque como finalizado.</div>
            </div>
          </div>
          ${renderOrdersTable(ordersEmFab, { showActions: true })}
        </div>
      `;

      const tabRetorno = `
        <div class="panel" data-panel="retorno" style="display:none;">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Pedidos com retorno</div>
              <div class="muted">Pendências para resolver: endereço, pagamento, ajuste, etc.</div>
            </div>
          </div>
          ${renderOrdersTable(ordersRetorno, { showActions: true })}
        </div>
      `;

      const tabFinalizados = `
        <div class="panel" data-panel="finalizados" style="display:none;">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Pedidos finalizados</div>
              <div class="muted">Histórico de pedidos concluídos.</div>
            </div>
          </div>
          ${renderOrdersTable(ordersFinal, { showActions: false })}
        </div>
      `;

      const tabRecusados = `
        <div class="panel" data-panel="recusados" style="display:none;">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Pedidos recusados</div>
              <div class="muted">Apenas para consulta.</div>
            </div>
          </div>
          ${renderOrdersTable(ordersRecusados, { showActions: false })}
        </div>
      `;

      const tabComo = `
        <div class="panel" data-panel="como" style="display:none;">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Como funciona</div>
              <div class="muted">Regras e fluxo do parceiro.</div>
            </div>
          </div>

          <div class="steps">
            <div class="step"><div class="n">1</div><div><b>Chega pedido</b><div class="muted">Ele entra em <b>Para aceitar</b>.</div></div></div>
            <div class="step"><div class="n">2</div><div><b>Aceita</b><div class="muted">Vai para <b>Em fabricação</b>.</div></div></div>
            <div class="step"><div class="n">3</div><div><b>Produz e entrega</b><div class="muted">Marque como <b>Finalizado</b>.</div></div></div>
            <div class="step"><div class="n">4</div><div><b>Ganho</b><div class="muted">Cada pedido finalizado rende <b>R$ 28</b> (20+8).</div></div></div>
          </div>
        </div>
      `;

      const base = getBaseUrl(req);
      const referralLink = `${base}/sales?ref=${encodeURIComponent(p.id)}`;

      const tabLink = `
        <div class="panel" data-panel="link" style="display:none;">
          <div class="panelHead">
            <div>
              <div class="panelTitle">🔗 Gerar link</div>
              <div class="muted">Gere seu link, divulgue e receba comissão automaticamente.</div>
            </div>
          </div>

          <div class="note">
            <b>Como funciona:</b>
            <div style="height:8px"></div>

            <div class="steps">
              <div class="step">
                <div class="n">1</div>
                <div>
                  <b>Gere seu link</b>
                  <div class="muted">Use o botão abaixo para copiar e compartilhar.</div>
                </div>
              </div>

              <div class="step">
                <div class="n">2</div>
                <div>
                  <b>Divulgue</b>
                  <div class="muted">Coloque em bio, stories e WhatsApp.</div>
                </div>
              </div>

              <div class="step">
                <div class="n">3</div>
                <div>
                  <b>Receba 10% de comissão</b>
                  <div class="muted">A cada pedido realizado através do seu link, você recebe <b>10%</b> do valor total do pedido.</div>
                </div>
              </div>
            </div>
          </div>

          <div style="height:12px"></div>

          <div class="card" style="padding:14px; border:1px solid rgba(255,255,255,.10); background:rgba(0,0,0,.18);">
            <div style="font-weight:1000;margin-bottom:8px;">Seu link</div>

            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <input
                id="refLink"
                value="${esc(referralLink)}"
                readonly
                style="flex:1; min-width:260px; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,.14); background:rgba(0,0,0,.25); color:#fff;"
              />
              <button class="btnSmall btnOk" type="button" data-action="copyLink">📋 Copiar</button>
              <button class="btnSmall" type="button" data-action="regenLink">⟳ Atualizar</button>
            </div>

            <div class="muted" style="margin-top:10px; font-size:12px;">
              Dica: ao divulgar, você pode dizer “use meu link para me apoiar”.
            </div>
          </div>
        </div>
      `;

      const tabHistorico = `
        <div class="panel" data-panel="historico" style="display:none;">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Histórico</div>
              <div class="muted">Todos os pedidos (últimos 50).</div>
            </div>
          </div>
          ${historicoHtml}
        </div>
      `;

      // ==================== BOTÕES DO TOPO (CORRIGIDOS) ====================
  const navLeft = `
  <button class="btn btnOutline" onclick="window.history.back()" type="button">🔙 Voltar</button>
`;

const navRight = `
  <a class="btn btnOutline" href="/sales">🏠 Início</a>
  <a class="btn btnDanger" href="/parceiros/sair">🚪 Sair</a>
`;

    return res.type("html").send(
  layout(
    title,
          `
<style>
  :root{
    --c-trust: rgba(84, 169, 255, .95);
    --c-okay:  rgba(40, 200, 120, .95);
    --c-warn:  rgba(255, 193, 7, .95);
    --c-urg:   rgba(255, 82, 82, .95);
  }

  .dashWrap{display:grid;grid-template-columns:320px 1fr;gap:18px;align-items:start}
  @media(max-width:980px){.dashWrap{grid-template-columns:1fr}.sideCard{position:relative!important}}
  .topCard{padding:18px 18px 16px 18px}
  .topTitle{font-size:22px;font-weight:1000;letter-spacing:-0.02em}
  .topSub{margin-top:6px}
  .metaRow{margin-top:10px;display:flex;flex-wrap:wrap;gap:10px}
  .chip{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10)}
  .chip b{font-weight:1000}

  .sideCard{position:sticky;top:16px}
  .sideTop{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px}
  .sideTitle{font-weight:1000}

  .refreshBtn{
    display:inline-flex;align-items:center;gap:8px;
    padding:8px 10px;border-radius:999px;
    border:1px solid rgba(255,255,255,.12);
    background:rgba(255,255,255,.06);
    color:#fff;cursor:pointer;font-weight:900;
  }
  .refreshBtn:hover{transform:translateY(-1px)}
  .refreshBtn.isLoading{opacity:.85}
  .refreshBtn.isLoading .spin{animation:spin .9s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .lastSync{font-size:12px;opacity:.85;margin-bottom:10px}

  /* Modo foco (controle do usuário) */
  .focusBtn{
    display:inline-flex; align-items:center; gap:8px;
    padding:8px 10px; border-radius:999px;
    border:1px solid rgba(255,255,255,.12);
    background:rgba(255,255,255,.06);
    color:#fff; cursor:pointer; font-weight:900;
  }
  .focusBtn:hover{ transform: translateY(-1px); }
  .focusOn .badge{ display:none !important; }
  .focusOn .toast{ animation:none !important; }
  .focusOn .navBtn:hover,
  .focusOn .btnSmall:hover,
  .focusOn .refreshBtn:hover,
  .focusOn .focusBtn:hover{ transform:none !important; }

  .sideNav{display:flex;flex-direction:column;gap:8px}
  .navBtn{
    width:100%;text-align:left;
    display:flex;justify-content:space-between;align-items:center;gap:10px;
    padding:10px 12px;border-radius:12px;
    border:1px solid rgba(255,255,255,.10);
    background:rgba(0,0,0,.18);
    color:#fff;cursor:pointer;
  }
  .navBtn:hover{transform:translateY(-1px)}
  .navBtn.active{background:linear-gradient(135deg, rgba(84,169,255,.18), rgba(255,82,173,.16));border-color:rgba(255,255,255,.18)}
  .navLabel{display:flex;align-items:center;gap:10px}
  .chev{opacity:.7;font-size:18px}

  .badge{
    margin-left:8px;
    display:inline-flex;align-items:center;justify-content:center;
    min-width:22px;height:22px;
    padding:0 8px;border-radius:999px;
    font-size:12px;font-weight:1000;
    border:1px solid rgba(255,255,255,.16);
    background:rgba(255,255,255,.08);
  }
  .badge-alert{background:rgba(255,82,82,.14);border-color:rgba(255,82,82,.24);color:#fff}
  .badge-warn{background:rgba(255,193,7,.14);border-color:rgba(255,193,7,.24);color:#fff}
  .badge-info{background:rgba(84,169,255,.14);border-color:rgba(84,169,255,.24);color:#fff}

  .sideMini{margin-top:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);border-radius:16px;padding:12px}
  .miniLine{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .miniHint{margin-top:6px;font-size:12px;opacity:.85}
  .lvl b{font-weight:1000}

  .panel{padding:16px}
  .panelHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}
  .panelTitle{font-weight:1000;font-size:16px}
  .panelRight{display:flex;gap:10px;align-items:center}
  .cashPill{padding:10px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-weight:1000}
  .softPill{padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);font-weight:1000}

  .kpiGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  @media(max-width:980px){.kpiGrid{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:520px){.kpiGrid{grid-template-columns:1fr}}
  .kpiCard{border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.18);border-radius:16px;padding:14px}
  .kpiCardHot{background:linear-gradient(135deg, rgba(255,82,82,.12), rgba(0,0,0,.18));border-color:rgba(255,82,82,.18)}
  .kpiTop{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  .kpiTitle{opacity:.9;font-weight:900}
  .kpiBadge{font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06)}
  .kpiValue{font-size:22px;font-weight:1000;letter-spacing:-0.02em}
  .kpiSub{margin-top:6px;font-size:12px;opacity:.8}

  .split{margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  @media(max-width:980px){.split{grid-template-columns:1fr}}
  .miniCard{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);border-radius:16px;padding:14px}
  .miniWarn{background:rgba(255,193,7,.10);border-color:rgba(255,193,7,.18)}
  .miniBad{background:rgba(255,82,82,.08);border-color:rgba(255,82,82,.16)}
  .miniTitle{font-weight:1000}
  .miniValue{font-size:20px;font-weight:1000;margin-top:8px}

  .note{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);border-radius:16px;padding:14px}
  .noteTop{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .hint{margin-top:10px;font-size:12px;opacity:.8}

  .bar{height:10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);overflow:hidden}
  .barBig{height:12px}
  .barFill{
    height:100%;
    width:0%;
    background:linear-gradient(90deg, rgba(84,169,255,.9), rgba(40,200,120,.85));
    border-radius:999px;
    transition:width .45s ease;
  }

  .tableWrap{overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,.10)}
  .table{width:100%;border-collapse:collapse}
  .table th,.table td{padding:12px 12px;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:middle}
  .table thead th{position:sticky;top:0;background:rgba(0,0,0,.35);backdrop-filter:blur(8px);text-align:left;font-weight:1000}
  .rowActions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}

  .btnSmall{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;border-radius:12px;padding:8px 10px;cursor:pointer;font-weight:900}
  .btnSmall:hover{transform:translateY(-1px)}
  .btnOk{background:rgba(40,200,120,.18);border-color:rgba(40,200,120,.22)}
  .btnWarn{background:rgba(255,193,7,.16);border-color:rgba(255,193,7,.20)}
  .btnBad{background:rgba(255,82,82,.14);border-color:rgba(255,82,82,.20)}
  .btnSmall:disabled{opacity:.65;cursor:not-allowed;transform:none}

  .pill{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-weight:1000;font-size:12px}
  .pill-para_aceitar{background:rgba(255,193,7,.12);border-color:rgba(255,193,7,.22)}
  .pill-em_fabricacao{background:rgba(84,169,255,.12);border-color:rgba(84,169,255,.22)}
  .pill-finalizado{background:rgba(40,200,120,.14);border-color:rgba(40,200,120,.22)}
  .pill-retorno{background:rgba(255,82,173,.12);border-color:rgba(255,82,173,.20)}
  .pill-recusado{background:rgba(255,82,82,.12);border-color:rgba(255,82,82,.20)}

  .empty{border:1px dashed rgba(255,255,255,.18);background:rgba(255,255,255,.03);border-radius:18px;padding:18px;text-align:center}
  .emptyIcon{font-size:26px}
  .emptyTitle{margin-top:6px;font-weight:1000}
  .emptyText{margin-top:6px;opacity:.85;font-size:13px}

  .steps{display:grid;gap:10px}
  .step{display:flex;gap:12px;align-items:flex-start;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);border-radius:16px;padding:14px}
  .step .n{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:1000;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}

  /* Toast */
  .toasts{position:fixed;right:14px;bottom:14px;display:grid;gap:10px;z-index:9999}
  .toast{
    width:min(360px, calc(100vw - 28px));
    border-radius:16px;
    border:1px solid rgba(255,255,255,.12);
    background:rgba(0,0,0,.55);
    backdrop-filter:blur(10px);
    padding:12px 12px;
    box-shadow:0 18px 40px rgba(0,0,0,.35);
    transform:translateY(8px);
    opacity:0;
    animation:toastIn .22s ease forwards;
  }
  @keyframes toastIn{to{transform:translateY(0);opacity:1}}
  .toastTop{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .toastTitle{font-weight:1000}
  .toastMsg{margin-top:4px;opacity:.9;font-size:13px}
  .toast.ok{border-color:rgba(40,200,120,.22)}
  .toast.warn{border-color:rgba(255,193,7,.22)}
  .toast.bad{border-color:rgba(255,82,82,.22)}
  .toast .x{border:0;background:transparent;color:#fff;opacity:.7;cursor:pointer;font-size:16px}
  .toast .x:hover{opacity:1}

  /* Flash */
  .panelHostFlash{animation:flash .45s ease}
  @keyframes flash{
    0%{box-shadow:0 0 0 rgba(0,0,0,0)}
    45%{box-shadow:0 0 0 4px rgba(84,169,255,.10)}
    100%{box-shadow:0 0 0 rgba(0,0,0,0)}
  }
</style>

<div class="card topCard">
  <div class="topTitle">Painel do Parceiro — Fabricação 🏭</div>
  <div class="topSub p"><b>${esc(p.negocio)}</b></div>
  <div class="metaRow">
    <div class="chip">📍 <b>${esc(p.cidade)}</b></div>
    <div class="chip">📞 <b>${esc(p.whatsapp)}</b></div>
    <div class="chip">🏷️ Segmento: <b>${esc(p.segmento || "-")}</b></div>
  </div>
</div>

<div class="dashWrap">
  <div>${sidebarHtml}</div>

  <div class="card panelHost" id="panelHost">
    ${tabVisao}
    ${tabCaixa}
    ${tabAceitar}
    ${tabEmFab}
    ${tabRetorno}
    ${tabFinalizados}
    ${tabRecusados}
    ${tabComo}
    ${tabLink}
    ${tabHistorico}
  </div>
</div>

<div class="toasts" id="toasts" aria-live="polite" aria-atomic="true"></div>

<script>
(function(){
  const nav = Array.from(document.querySelectorAll('[data-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-panel]'));
  const toasts = document.getElementById('toasts');
  const panelHost = document.getElementById('panelHost');
  const lastSync = document.getElementById('lastSync');

  function nowLabel(){
    try{
      const d = new Date();
      return d.toLocaleString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    }catch(e){ return 'agora'; }
  }

  function setLastSync(){
    if(lastSync) lastSync.textContent = 'Atualizado às ' + nowLabel();
  }
  setLastSync();

  function toast(type, title, msg, ms){
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = \`
      <div class="toastTop">
        <div class="toastTitle">\${title || 'Aviso'}</div>
        <button class="x" type="button" aria-label="Fechar">✕</button>
      </div>
      \${msg ? \`<div class="toastMsg">\${msg}</div>\` : ''}
    \`;
    const btn = el.querySelector('.x');
    btn.addEventListener('click', () => el.remove());
    toasts.appendChild(el);

    const ttl = typeof ms === 'number' ? ms : 2800;
    setTimeout(() => { try{ el.remove(); }catch(e){} }, ttl);
  }

  // ---- Modo foco (controle do usuário)
  const FOCUS_KEY = 'partners_focus_mode_v1';

  function getFocus(){
    try{ return localStorage.getItem(FOCUS_KEY) === '1'; }catch(e){ return false; }
  }
  function setFocus(on){
    try{ localStorage.setItem(FOCUS_KEY, on ? '1' : '0'); }catch(e){}
  }
  function applyFocus(on){
    document.documentElement.classList.toggle('focusOn', !!on);
  }
  applyFocus(getFocus());
  function getActiveTab(){
    const act = document.querySelector('.navBtn.active');
    return act ? act.getAttribute('data-tab') : 'visao';
  }

  function show(tabId, pushHash){
    nav.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
    panels.forEach(p => p.style.display = (p.getAttribute('data-panel') === tabId) ? '' : 'none');

    if(pushHash) {
      try{ history.replaceState(null, '', location.pathname + location.search + '#' + tabId); }catch(e){}
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nav.forEach(b => b.addEventListener('click', () => show(b.getAttribute('data-tab'), true)));

  const hash = (location.hash || '').replace('#','').trim();
  if(hash && panels.some(p => p.getAttribute('data-panel') === hash)) show(hash, false);

  function flashPanel(){
    if(!panelHost) return;
    panelHost.classList.remove('panelHostFlash');
    void panelHost.offsetWidth;
    panelHost.classList.add('panelHostFlash');
  }

  async function setStatus(orderId, status, btn){
    const labelMap = {
      em_fabricacao: 'Em fabricação',
      finalizado: 'Finalizado',
      retorno: 'Retorno',
      recusado: 'Recusado'
    };
    const confirmMsg = 'Confirmar: mudar status para "' + (labelMap[status] || status) + '"?';

    const ok = confirm(confirmMsg);
    if(!ok) return;

    if(btn){
      btn.disabled = true;
      btn.dataset.old = btn.textContent;
      btn.textContent = 'Salvando…';
    }

    const body = new URLSearchParams();
    body.set('status', status);

    const r = await fetch('/parceiros/pedido/' + encodeURIComponent(orderId) + '/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString()
    });

    const j = await r.json().catch(()=>null);

    if(btn){
      btn.disabled = false;
      btn.textContent = btn.dataset.old || btn.textContent;
    }

    if(!r.ok || !j || !j.ok){
      toast('bad', 'Não foi possível atualizar', (j && j.error) ? j.error : 'Tente novamente.', 3800);
      return;
    }

    flashPanel();
    setLastSync();
    toast('ok', 'Atualizado ✅', 'Status do pedido foi atualizado.', 2400);

    setTimeout(() => {
      const tab = getActiveTab();
      try{ location.replace(location.pathname + location.search + '#' + tab); }catch(e){ location.reload(); }
    }, 650);
  }

  function doRefresh(btn){
    if(btn){
      btn.classList.add('isLoading');
      btn.disabled = true;
      const label = btn.querySelector('span:nth-child(2)');
      if(label) label.textContent = 'Sincronizando…';
    }

    setLastSync();
    toast('warn', 'Sincronizando', 'Atualizando pedidos e status.', 1600);

    setTimeout(() => {
      const tab = getActiveTab();
      try{ location.replace(location.pathname + location.search + '#' + tab); }catch(e){ location.reload(); }
    }, 650);
  }

  async function doCopyLink(){
    const inp = document.getElementById('refLink');
    if(!inp) return toast('bad', 'Link não encontrado', 'Abra a aba “Gerar link” e tente novamente.', 3200);

    const val = String(inp.value || '').trim();
    if(!val) return toast('bad', 'Link vazio', 'Tente atualizar a página.', 2800);

    try{
      try{
        inp.focus();
        inp.select();
        inp.setSelectionRange(0, inp.value.length);
      }catch(e){}

      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(val);
      }else{
        document.execCommand('copy');
      }
      toast('ok', 'Copiado ✅', 'Agora é só colar e divulgar.', 2200);
    }catch(e){
      toast('warn', 'Não deu pra copiar automático', 'Selecione o link e copie manualmente.', 3600);
    }
  }

  function doRegenLink(){
    setLastSync();
    flashPanel();
    toast('ok', 'Link pronto ✅', 'Seu link está atualizado e pronto para divulgar.', 2400);
  }

  function toggleFocus(){
    const on = !getFocus();
    setFocus(on);
    applyFocus(on);
    toast('ok', on ? 'Modo foco ativado' : 'Modo foco desativado', on ? 'Badges e animações reduzidas.' : 'Badges e feedbacks visuais voltaram.', 1800);
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if(!el) return;

    const action = el.getAttribute('data-action');

    if(action === 'setStatus'){
      ev.preventDefault();
      const id = el.getAttribute('data-id');
      const st = el.getAttribute('data-status');
      if(id && st) setStatus(id, st, el);
      return;
    }

    if(action === 'refresh'){
      ev.preventDefault();
      doRefresh(el);
      return;
    }

    if(action === 'copyLink'){
      ev.preventDefault();
      doCopyLink();
      return;
    }

    if(action === 'regenLink'){
      ev.preventDefault();
      doRegenLink();
      return;
    }

    if(action === 'toggleFocus'){
      ev.preventDefault();
      toggleFocus();
      return;
    }
  });
})();
</script>
          `,
         navRight,
    navLeft
  )
);
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] perfil erro:", msg);
      return res.status(500).type("html").send(
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