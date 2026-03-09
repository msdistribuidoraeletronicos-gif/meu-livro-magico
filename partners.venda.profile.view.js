/**
 * partners.venda.profile.view.js
 *
 * View do painel do parceiro venda.
 * Responsável por montar o HTML completo da tela.
 *
 * Depende de:
 * - ./partners.venda.profile.assets
 *
 * ✅ CORRIGIDO:
 * - modal de saque agora usa o mesmo fluxo do fabricação
 * - primeiro saque pede PIX completo
 * - próximos saques mostram apenas valor + observação
 * - envia pixState para o JS
 */

"use strict";

const {
  VENDA_PROFILE_CSS,
  buildVendaProfileJS,
} = require("./partners.venda.profile.assets");

module.exports = {
  renderVendaProfilePage,
};

function renderVendaProfilePage(data = {}) {
  const {
    p,
    orders = [],
    wallet = {},
    walletActivities = [],

    esc,
    moneyBR,
    statusLabel,
    fmtCoins,

    now = new Date(),
    pedidos_para_aceitar = 0,
    pedidos_em_fabricacao = 0,
    pedidos_finalizados = 0,
    pedidos_recusados = 0,
    caixa_total = 0,
    wallet_bonus = 0,
    wallet_purchased = 0,
    wallet_withdrawn = 0,
    carteira_total_disponivel = 0,
    profilePct = 0,
    level = {},
    levelProgress = {},
    totalPedidos = 0,
    mediaPorPedido = 0,
    previsaoSeFinalizarPendentes = 0,
    pedidosMesAtualFinalizados = 0,
    pedidosMesAtualEmAberto = 0,
    ganhoMesAtual = 0,
    metaMensalFinalizados = 10,
    metaMensalPct = 0,
    scoreOperacional = 0,
    achievements = [],
    referralLink = "",
  } = data;

  const fmtWhen = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "-");
  const fmtCli = (o) => [o.cliente_nome, o.cliente_cidade].filter(Boolean).join(" • ") || "-";

  const statusLabelLocal = (st) => {
    const s = String(st || "");
    if (s === "para_aceitar") return "Para aceitar";
    if (s === "em_fabricacao") return "Em andamento";
    if (s === "pronto_entrega") return "Pronto";
    if (s === "finalizado") return "Finalizado";
    if (s === "retorno") return "Retorno";
    if (s === "recusado") return "Recusado";
    return statusLabel ? statusLabel(s) : s;
  };

  const sectionLead = (small, title, desc, extra = "") => `
    <div class="sectionLead">
      <div class="sectionLeadText">
        <div class="sectionEyebrow">${small}</div>
        <h2 class="sectionTitle">${title}</h2>
        <div class="sectionDesc">${desc}</div>
      </div>
      ${extra ? `<div class="sectionLeadExtra">${extra}</div>` : ``}
    </div>
  `;

  const renderOrdersTable = (list) => {
    if (!list || list.length === 0) {
      return `
        <div class="empty">
          <div class="emptyIcon">📭</div>
          <div class="emptyTitle">Nenhum pedido ainda</div>
          <div class="emptyText">Quando houver pedidos vinculados ao seu link, eles aparecem aqui.</div>
        </div>
      `;
    }

    return `
      <div class="tableTools">
        <input class="tableSearch" data-table-search placeholder="Buscar cliente, cidade ou status..." />
      </div>

      <div class="tableWrap">
        <table class="table tableReadable">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Total</th>
              <th>Ganho</th>
            </tr>
          </thead>
          <tbody>
            ${list
              .slice(0, 50)
              .map((o) => {
                const st = String(o.status || "");
                const ganhoExibido = st === "finalizado" ? Number(o.ganho_parceiro || 0) : 0;
                const totalExibido = o.valor_total != null ? moneyBR(o.valor_total) : "-";
                const rowText = [
                  fmtWhen(o.created_at),
                  fmtCli(o),
                  statusLabelLocal(st),
                  totalExibido,
                  fmtCoins(ganhoExibido),
                ]
                  .join(" ")
                  .toLowerCase();

                return `
                  <tr data-search="${esc(rowText)}">
                    <td>${esc(fmtWhen(o.created_at))}</td>
                    <td>${esc(fmtCli(o))}</td>
                    <td><span class="pill pill-${esc(st)}">${esc(statusLabelLocal(st))}</span></td>
                    <td>${esc(String(totalExibido))}</td>
                    <td>${esc(fmtCoins(ganhoExibido))}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="hint">Mostrando os 50 pedidos mais recentes.</div>
    `;
  };

  const menuItems = [
    { id: "visao", label: "📌 Visão geral" },
    { id: "caixa", label: "🪙 Meu caixa" },
    { id: "pedidos", label: "📦 Meus pedidos" },
    { id: "link", label: "🔗 Meu link" },
    { id: "historico", label: "📚 Histórico" },
    { id: "como", label: "❓ Como funciona" },
  ];

  const dayPct =
    totalPedidos > 0
      ? Math.round((Number(pedidos_finalizados || 0) / Number(totalPedidos || 1)) * 100)
      : 0;

  const sidebarHtml = `
    <div class="sideCardClean">
      <div class="sideTop">
        <div class="sideTitleWrap">
          <div class="sideTitle">Menu</div>
          <div class="lastSync muted" id="lastSync">Atualizado agora</div>
        </div>

        <div class="sideTopActions">
          <button class="focusBtn" data-action="toggleFocus" type="button" title="Ativar/desativar modo foco">
            🧘 <span>Foco</span>
          </button>
          <button class="refreshBtn" data-action="refresh" type="button" title="Atualizar">
            <span class="spin" aria-hidden="true">⟳</span>
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      <div class="sideNav sideNavClean">
        ${menuItems
          .map(
            (m, idx) => `
          <button class="navBtn navBtnClean ${idx === 0 ? "active" : ""}" data-tab="${esc(m.id)}" type="button">
            <span class="navLabel">${m.label}</span>
            <span class="chev">›</span>
          </button>`
          )
          .join("")}
      </div>

      <div class="sideInfoBox">
        <div class="miniLine">
          <span class="muted">Nível</span>
          <span class="lvl">${esc(level.icon || "🥉")} <b>${esc(level.name || "Bronze")}</b></span>
        </div>
        <div class="miniHint muted">${esc(level.hint || "Evoluindo no programa")}</div>

        <div style="height:12px"></div>

        <div class="miniLine">
          <span class="muted">Comissão</span>
          <span><b>10%</b></span>
        </div>
        <div class="miniHint muted">Percentual por pedido vinculado ao seu link.</div>

        <div style="height:12px"></div>

        <div class="miniLine">
          <span class="muted">Perfil</span>
          <span><b>${esc(String(profilePct))}% completo</b></span>
        </div>
        <div class="bar">
          <div class="barFill" style="width:${esc(String(profilePct))}%;"></div>
        </div>

        <div style="height:12px"></div>

        <div class="miniLine">
          <span class="muted">Score operacional</span>
          <span><b>${esc(String(scoreOperacional))}%</b></span>
        </div>
        <div class="bar">
          <div class="barFill barFillScore" style="width:${esc(String(scoreOperacional))}%;"></div>
        </div>

        <div style="height:12px"></div>

        <div class="miniLine">
          <span class="muted">Check-in</span>
          <span><b>${esc(String(Number(wallet?.streak_days || 0)))} dia(s)</b></span>
        </div>
        <div class="miniHint muted">Sua sequência atual fica salva no painel.</div>
      </div>
    </div>
  `;

  const topHero = `
    <section class="heroClean">
      <div class="heroLeft">
        <div class="heroTag">Painel do parceiro</div>
        <h1 class="heroTitle">Bem-vindo ao seu painel de vendas</h1>
        <p class="heroText">
          Acompanhe seus pedidos, suas moedas, sua evolução e seu link de divulgação em um só lugar.
        </p>

        <div class="heroButtons">
          <button class="heroBtn heroBtnPrimary" type="button" data-tab="pedidos">Ver pedidos</button>
          <button class="heroBtn heroBtnSecondary" type="button" data-tab="caixa">Abrir meu caixa</button>
          <button class="heroBtn heroBtnGhost" type="button" data-tab="link">Meu link</button>
        </div>
      </div>

      <div class="heroRight">
        <div class="heroStatCard">
          <div class="heroStatLabel">Saldo disponível</div>
          <div class="heroStatValue" id="walletTotalText">${esc(fmtCoins(carteira_total_disponivel))}</div>
        </div>

        <div class="heroMiniStats">
          <div class="heroMiniStat">
            <span>📦</span>
            <div>
              <b>${esc(String(totalPedidos))}</b>
              <small>Total de pedidos</small>
            </div>
          </div>

          <div class="heroMiniStat">
            <span>✅</span>
            <div>
              <b>${esc(String(pedidos_finalizados))}</b>
              <small>Finalizados</small>
            </div>
          </div>

          <div class="heroMiniStat">
            <span>${esc(level.icon || "🥉")}</span>
            <div>
              <b>${esc(level.name || "Bronze")}</b>
              <small>Nível atual</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  const resumaoTopo = `
    <section class="wideSection">
      ${sectionLead(
        "Resumo",
        "Seu painel em um olhar",
        "Veja rapidamente o que está acontecendo no momento."
      )}

      <div class="panel widePanel">
        <div class="topSummaryGrid">
          <div class="topSummaryCard">
            <div class="topSummaryLabel">Pedidos</div>
            <div class="topSummaryValue">${esc(String(totalPedidos))}</div>
          </div>

          <div class="topSummaryCard">
            <div class="topSummaryLabel">Finalizados</div>
            <div class="topSummaryValue">${esc(String(pedidos_finalizados))}</div>
          </div>

          <div class="topSummaryCard">
            <div class="topSummaryLabel">Ganhos</div>
            <div class="topSummaryValue">${esc(fmtCoins(caixa_total))}</div>
          </div>

          <div class="topSummaryCard">
            <div class="topSummaryLabel">Check-ins</div>
            <div class="topSummaryValue">${esc(String(Number(wallet?.streak_days || 0)))}</div>
          </div>
        </div>

        <div style="height:16px"></div>

        <div class="note noteReadable">
          <div class="noteTop">
            <div><b>Andamento atual</b></div>
            <div class="muted"><b>${esc(String(dayPct))}%</b></div>
          </div>
          <div class="bar barBig"><div class="barFill" style="width:${esc(String(dayPct))}%;"></div></div>
        </div>
      </div>
    </section>
  `;

  const tabVisao = `
    <section class="wideSection" id="section-visao">
      ${sectionLead(
        "Visão geral",
        "Seu desempenho",
        "Acompanhe seus principais números e o desempenho do mês.",
        `<div class="leadPill">${esc(level.icon || "🥉")} ${esc(level.name || "Bronze")}</div>`
      )}

      <div class="panel widePanel" data-panel="visao">
        <div class="cashCard">
          <div class="cashCardHead">
            <div>
              <div class="cashCardTitle">Check-in diário</div>
              <div class="muted">Ganhe moedas ao entrar todos os dias.</div>
            </div>
            <div class="softPill" id="checkinStreakPill">Sequência: ${esc(
              String(Number(wallet?.streak_days || 0))
            )} dia(s)</div>
          </div>

          <div class="checkinBox">
            <div class="checkinTop">
              <div>
                <div class="checkinRewardLabel">Próxima recompensa</div>
                <div class="checkinRewardValue" id="checkinRewardValue">${esc(fmtCoins(level.checkinBase || 0))}</div>
              </div>

              <button class="checkinBtn" type="button" id="checkinBtn" data-action="dailyCheckin">
                ✅ Fazer check-in
              </button>
            </div>

            <div style="height:10px"></div>

            <div class="weekTrack" id="weekTrack">
              <div class="dayDot">1</div>
              <div class="dayDot">2</div>
              <div class="dayDot">3</div>
              <div class="dayDot">4</div>
              <div class="dayDot">5</div>
              <div class="dayDot">6</div>
              <div class="dayDot">7</div>
            </div>

            <div class="muted" style="margin-top:10px;">
              Após 3 check-ins consecutivos, sua recompensa sobe. Ao completar 7 check-ins, o ciclo reinicia.
            </div>
          </div>
        </div>

        <div style="height:16px"></div>

        <div class="kpiGrid">
          <div class="kpiCard kpiCardCoins">
            <div class="kpiTop">
              <div class="kpiTitle">Carteira</div>
              <div class="kpiBadge">Moedas</div>
            </div>
            <div class="kpiValue" id="walletBigText">${esc(fmtCoins(carteira_total_disponivel))}</div>
            <div class="kpiSub">Saldo total do painel</div>
          </div>

          <div class="kpiCard">
            <div class="kpiTitle">Seu nível</div>
            <div class="kpiValue">${esc(level.icon || "🥉")} ${esc(level.name || "Bronze")}</div>
            <div class="kpiSub">Comissão fixa: 10% por pedido</div>
          </div>

          <div class="kpiCard">
            <div class="kpiTitle">Pedidos</div>
            <div class="kpiValue">${esc(String(totalPedidos))}</div>
            <div class="kpiSub">Todos os pedidos vinculados a você</div>
          </div>

          <div class="kpiCard kpiCardHot">
            <div class="kpiTitle">Finalizados</div>
            <div class="kpiValue">${esc(String(pedidos_finalizados))}</div>
            <div class="kpiSub">Pedidos concluídos</div>
          </div>
        </div>

        <div style="height:16px"></div>

        <div class="note noteReadable">
          <div class="noteTop">
            <div><b>Progresso operacional</b></div>
            <div class="muted"><b>${esc(String(dayPct))}% concluído</b></div>
          </div>
          <div class="bar barBig"><div class="barFill" style="width:${esc(String(dayPct))}%;"></div></div>
          <div style="height:8px"></div>
          <div class="muted">Quanto mais pedidos finalizados, mais forte fica sua evolução no painel.</div>
        </div>

        <div style="height:16px"></div>

        <div class="split">
          <div class="miniCard">
            <div class="miniTitle">🪙 Carteira disponível</div>
            <div class="miniValue">${esc(fmtCoins(carteira_total_disponivel))}</div>
            <div class="muted">Pedidos + bônus + compras - saques</div>
          </div>

          <div class="miniCard miniWarn">
            <div class="miniTitle">📈 Previsão</div>
            <div class="miniValue">${esc(fmtCoins(previsaoSeFinalizarPendentes))}</div>
            <div class="muted">Se os pedidos em andamento forem concluídos</div>
          </div>

          <div class="miniCard">
            <div class="miniTitle">⭐ Média por pedido</div>
            <div class="miniValue">${esc(fmtCoins(mediaPorPedido))}</div>
            <div class="muted">Média das moedas por pedido finalizado</div>
          </div>
        </div>

        <div style="height:16px"></div>

        <div class="cashGrid">
          <div class="cashCard">
            <div class="cashCardHead">
              <div>
                <div class="cashCardTitle">Resumo do mês</div>
                <div class="muted">Desempenho no mês atual.</div>
              </div>
              <div class="softPill">${esc(
                now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
              )}</div>
            </div>

            <div class="resumeList">
              <div class="resumeItem">
                <span>Finalizados no mês</span>
                <b>${esc(String(pedidosMesAtualFinalizados))}</b>
              </div>
              <div class="resumeItem">
                <span>Em aberto no mês</span>
                <b>${esc(String(pedidosMesAtualEmAberto))}</b>
              </div>
              <div class="resumeItem">
                <span>Ganhos do mês</span>
                <b>${esc(fmtCoins(ganhoMesAtual))}</b>
              </div>
              <div class="resumeItem resumeItemTotal">
                <span>Meta mensal</span>
                <b>${esc(String(pedidosMesAtualFinalizados))} / ${esc(
    String(metaMensalFinalizados)
  )} pedidos</b>
              </div>
            </div>

            <div style="height:12px"></div>

            <div class="note noteReadable">
              <div class="noteTop">
                <div><b>Avanço da meta mensal</b></div>
                <div class="muted"><b>${esc(String(metaMensalPct))}%</b></div>
              </div>
              <div class="bar barBig"><div class="barFill" style="width:${esc(
                String(metaMensalPct)
              )}%;"></div></div>
            </div>
          </div>

          <div class="cashCard">
            <div class="cashCardHead">
              <div>
                <div class="cashCardTitle">Conquistas</div>
                <div class="muted">Sua evolução no painel.</div>
              </div>
            </div>

            <div class="achievements">
              ${achievements
                .map(
                  (a) => `
                <div class="achItem ${a.done ? "done" : ""}">
                  <div class="achIcon">${esc(a.icon)}</div>
                  <div>
                    <div class="achTitle">${esc(a.title)}</div>
                    <div class="achText">${esc(a.text)}</div>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  const tabCaixa = `
    <section class="wideSection" id="section-caixa">
      ${sectionLead(
        "Caixa",
        "Meu caixa",
        "Veja seu saldo, faça check-in e acompanhe sua carteira.",
        `<div class="leadPill">${esc(fmtCoins(carteira_total_disponivel))}</div>`
      )}

      <div class="panel widePanel" data-panel="caixa">
        <div class="panelHead panelHeadStack">
          <div>
            <div class="panelTitle">Meu caixa</div>
            <div class="muted">
              Seu saldo é formado pelas moedas liberadas nos pedidos finalizados,
              somadas aos bônus de check-in e compras registradas no painel.
            </div>
          </div>
          <div class="panelRight">
            <div class="cashPill cashPillCoins" id="cashPillTotal">${esc(fmtCoins(carteira_total_disponivel))}</div>
          </div>
        </div>

        <div class="walletHero walletHeroReadable">
          <div class="walletHeroMain">
            <div class="walletLabel">Saldo disponível</div>
            <div class="walletBig" id="availableCoinsText">${esc(fmtCoins(carteira_total_disponivel))}</div>
            <div class="walletSub">Painel de moedas do parceiro</div>

            <div class="walletActions">
              <button class="actionBig actionPrimary" type="button" data-action="openWithdraw">
                <span>🪙</span>
                <span>Sacar Moedas</span>
              </button>

              <button class="actionBig actionSecondary" type="button" data-action="openBuyCoins">
                <span>➕</span>
                <span>Comprar Moedas</span>
              </button>

              <button class="actionBig actionGhost" type="button" data-action="openDetails">
                <span>📊</span>
                <span>Ver Detalhes</span>
              </button>
            </div>
          </div>

          <div class="walletHeroSide">
            <div class="walletMiniCard">
              <div class="walletMiniTitle">Nível atual</div>
              <div class="walletMiniValue">${esc(level.icon || "🥉")} ${esc(level.name || "Bronze")}</div>
              <div class="walletMiniText">Comissão do parceiro: <b>10%</b> por pedido</div>
            </div>

            <div class="walletMiniCard">
              <div class="walletMiniTitle">Check-in diário</div>
              <div class="walletMiniValue" id="checkinRewardNow">${esc(fmtCoins(level.checkinBase || 0))}</div>
              <div class="walletMiniText">Recompensa atual do seu próximo check-in</div>
            </div>
          </div>
        </div>

        <div style="height:16px"></div>

        <div class="kpiGrid">
          <div class="kpiCard">
            <div class="kpiTitle">Pedidos que geraram moedas</div>
            <div class="kpiValue">${esc(String(pedidos_finalizados))}</div>
            <div class="kpiSub">Somente pedidos concluídos</div>
          </div>

          <div class="kpiCard">
            <div class="kpiTitle">Ganhos liberados</div>
            <div class="kpiValue" id="baseCoinsText">${esc(fmtCoins(caixa_total))}</div>
            <div class="kpiSub">Moedas já registradas nos pedidos</div>
          </div>

          <div class="kpiCard">
            <div class="kpiTitle">Bônus + compras</div>
            <div class="kpiValue" id="bonusCoinsText">${esc(fmtCoins(wallet_bonus + wallet_purchased))}</div>
            <div class="kpiSub">Check-ins e compras manuais</div>
          </div>

          <div class="kpiCard">
            <div class="kpiTitle">Solicitações de saque</div>
            <div class="kpiValue" id="withdrawCoinsText">${esc(fmtCoins(wallet_withdrawn))}</div>
            <div class="kpiSub">Total solicitado</div>
          </div>
        </div>

        <div style="height:16px"></div>

        <div class="cashCard">
          <div class="cashCardHead">
            <div>
              <div class="cashCardTitle">Nível e progressão</div>
              <div class="muted">Seu nível melhora a recompensa do check-in.</div>
            </div>
            <div class="tierBadge tier-${esc(level.key || "bronze")}">${esc(level.icon || "🥉")} ${esc(
    level.name || "Bronze"
  )}</div>
          </div>

          <div class="tierGrid">
            <div class="tierBox tier-bronze ${level.key === "bronze" ? "isCurrent" : ""}">
              <div class="tierTitle">🥉 Bronze</div>
              <div class="tierText">Check-in: 0,50 → 1,00</div>
              <div class="tierText">Comissão: 10%</div>
            </div>

            <div class="tierBox tier-prata ${level.key === "prata" ? "isCurrent" : ""}">
              <div class="tierTitle">🥈 Prata</div>
              <div class="tierText">Check-in: 0,75 → 1,15</div>
              <div class="tierText">Comissão: 10%</div>
            </div>

            <div class="tierBox tier-ouro ${level.key === "ouro" ? "isCurrent" : ""}">
              <div class="tierTitle">🥇 Ouro</div>
              <div class="tierText">Check-in: 1,00 → 1,35</div>
              <div class="tierText">Comissão: 10%</div>
            </div>
          </div>

          <div style="height:12px"></div>

          <div class="note noteReadable">
            <div class="noteTop">
              <div><b>Progressão atual</b></div>
              <div class="muted">
                ${
                  level.key === "ouro"
                    ? `Nível máximo`
                    : `${pedidos_finalizados} / ${levelProgress.nextAt} finalizados para ${levelProgress.nextName}`
                }
              </div>
            </div>
            <div class="bar barBig">
              <div class="barFill" style="width:${esc(String(levelProgress.pct || 0))}%;"></div>
            </div>
          </div>
        </div>

        <div style="height:16px"></div>

        <div class="cashGrid">
          <div class="cashCard">
            <div class="cashCardHead">
              <div>
                <div class="cashCardTitle">Resumo da carteira</div>
                <div class="muted">Visão simples e transparente do saldo.</div>
              </div>
            </div>

            <div class="resumeList">
              <div class="resumeItem">
                <span>Moedas liberadas por pedidos</span>
                <b>${esc(fmtCoins(caixa_total))}</b>
              </div>
              <div class="resumeItem">
                <span>Bônus + compras</span>
                <b>${esc(fmtCoins(wallet_bonus + wallet_purchased))}</b>
              </div>
              <div class="resumeItem">
                <span>Solicitações de saque</span>
                <b>${esc(fmtCoins(wallet_withdrawn))}</b>
              </div>
              <div class="resumeItem resumeItemTotal">
                <span>Disponível no painel</span>
                <b>${esc(fmtCoins(carteira_total_disponivel))}</b>
              </div>
            </div>
          </div>

          <div class="cashCard">
            <div class="cashCardHead">
              <div>
                <div class="cashCardTitle">Atividade recente</div>
                <div class="muted">Últimos movimentos do seu painel de moedas.</div>
              </div>
            </div>

            <div id="coinsActivity" class="activityList">
              ${
                Array.isArray(walletActivities) && walletActivities.length
                  ? walletActivities
                      .map((item) => {
                        const dt = item.created_at
                          ? new Date(item.created_at).toLocaleString("pt-BR")
                          : "-";
                        const amount = Number(item.amount || 0);
                        const sign = amount >= 0 ? "+" : "";
                        return `
                          <div class="activityItem">
                            <div>
                              <strong>${esc(item.title || "Movimentação")}</strong>
                              ${item.meta ? `<small>${esc(item.meta)}</small>` : ``}
                              <small>${esc(dt)}</small>
                            </div>
                            <div class="activityValue">${esc(sign + fmtCoins(amount))}</div>
                          </div>
                        `;
                      })
                      .join("")
                  : `<div class="activityEmpty">Ainda não há movimentações extras no seu painel.</div>`
              }
            </div>
          </div>
        </div>

        <div style="height:16px"></div>

        <div class="cashCard">
          <div class="cashCardHead">
            <div>
              <div class="cashCardTitle">Dica rápida</div>
              <div class="muted">Seus saques pedem PIX apenas no primeiro cadastro.</div>
            </div>
          </div>

          <div class="steps">
            <div class="step">
              <div class="n">1</div>
              <div>
                <b>Primeiro saque</b>
                <div class="muted">Se ainda não houver PIX salvo, o sistema pede os dados no modal.</div>
              </div>
            </div>

            <div class="step">
              <div class="n">2</div>
              <div>
                <b>Próximos saques</b>
                <div class="muted">Se já houver PIX cadastrado, o modal mostra apenas valor e observação.</div>
              </div>
            </div>

            <div class="step">
              <div class="n">3</div>
              <div>
                <b>Notificação</b>
                <div class="muted">A solicitação é registrada no painel e enviada ao admin por e-mail.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  const tabPedidos = `
    <section class="wideSection" id="section-pedidos">
      ${sectionLead(
        "Pedidos",
        "Meus pedidos",
        "Consulte seus pedidos mais recentes em um só lugar.",
        `<div class="leadPill">${esc(String(totalPedidos))} pedidos</div>`
      )}

      <div class="panel widePanel" data-panel="pedidos">
        ${renderOrdersTable(orders)}
      </div>
    </section>
  `;

  const tabLink = `
    <section class="wideSection" id="section-link">
      ${sectionLead(
        "Divulgação",
        "Seu link",
        "Compartilhe seu link e receba comissão automaticamente.",
        `<div class="leadPill">10% por pedido</div>`
      )}

      <div class="panel widePanel" data-panel="link">
        <div class="note noteReadable">
          <b>Como funciona:</b>
          <div style="height:10px"></div>

          <div class="steps">
            <div class="step">
              <div class="n">1</div>
              <div>
                <b>Copie seu link</b>
                <div class="muted">Use os botões abaixo para copiar e compartilhar.</div>
              </div>
            </div>

            <div class="step">
              <div class="n">2</div>
              <div>
                <b>Divulgue</b>
                <div class="muted">Use em bio, stories e WhatsApp.</div>
              </div>
            </div>

            <div class="step">
              <div class="n">3</div>
              <div>
                <b>Receba comissão</b>
                <div class="muted">A cada pedido realizado pelo seu link, a comissão entra automaticamente.</div>
              </div>
            </div>
          </div>
        </div>

        <div style="height:16px"></div>

        <div class="linkCard">
          <div class="linkCardTitle">Seu link pessoal</div>

          <div class="linkInputWrap">
            <input id="refLink" class="linkInput" value="${esc(referralLink)}" readonly />
          </div>

          <div class="linkButtons">
            <button class="btnSmall btnOk" type="button" data-action="copyLink">📋 Copiar</button>
            <button class="btnSmall" type="button" data-action="regenLink">⟳ Atualizar</button>
          </div>

          <div class="muted" style="margin-top:10px; font-size:12px;">
            Dica: você pode divulgar esse link nas suas redes e no WhatsApp.
          </div>
        </div>
      </div>
    </section>
  `;

  const tabHistorico = `
    <section class="wideSection" id="section-historico">
      ${sectionLead(
        "Histórico",
        "Movimentações da carteira",
        "Veja suas movimentações recentes do painel de moedas."
      )}

      <div class="panel widePanel" data-panel="historico">
        <div class="activityList">
          ${
            Array.isArray(walletActivities) && walletActivities.length
              ? walletActivities
                  .map((item) => {
                    const dt = item.created_at
                      ? new Date(item.created_at).toLocaleString("pt-BR")
                      : "-";
                    const amount = Number(item.amount || 0);
                    const sign = amount >= 0 ? "+" : "";
                    return `
                      <div class="activityItem">
                        <div>
                          <strong>${esc(item.title || "Movimentação")}</strong>
                          ${item.meta ? `<small>${esc(item.meta)}</small>` : ``}
                          <small>${esc(dt)}</small>
                        </div>
                        <div class="activityValue">${esc(sign + fmtCoins(amount))}</div>
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="activityEmpty">Ainda não há movimentações extras no seu painel.</div>`
          }
        </div>
      </div>
    </section>
  `;

  const tabComo = `
    <section class="wideSection" id="section-como">
      ${sectionLead(
        "Ajuda",
        "Como funciona",
        "Veja o fluxo básico do parceiro dentro do painel."
      )}

      <div class="panel widePanel" data-panel="como">
        <div class="steps">
          <div class="step">
            <div class="n">1</div>
            <div>
              <b>Copie seu link</b>
              <div class="muted">Use o link do painel para divulgar.</div>
            </div>
          </div>

          <div class="step">
            <div class="n">2</div>
            <div>
              <b>Cliente compra</b>
              <div class="muted">O sistema identifica a venda vinculada ao seu parceiro.</div>
            </div>
          </div>

          <div class="step">
            <div class="n">3</div>
            <div>
              <b>Pedido aparece no painel</b>
              <div class="muted">Você acompanha o histórico e o status do pedido.</div>
            </div>
          </div>

          <div class="step">
            <div class="n">4</div>
            <div>
              <b>Comissão é registrada</b>
              <div class="muted">Quando o pedido finaliza, seu ganho entra no caixa.</div>
            </div>
          </div>

          <div class="step">
            <div class="n">5</div>
            <div>
              <b>Você acompanha tudo</b>
              <div class="muted">Use check-in, carteira e histórico para acompanhar sua evolução.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  const extraLayoutCss = `
    :root{
      --appBg:#f5f2f8;
      --textStrong:#16233b;
      --textSoft:#5f6b7d;
      --cardBg:#ffffff;
      --cardBorder:rgba(98, 76, 165, .10);
      --heroA:#6f5bff;
      --heroB:#f5a524;
      --softLilac:#f2ecff;
      --softBlue:#edf6ff;
      --softGold:#fff7e7;
      --shadowMain:0 16px 40px rgba(25, 35, 70, .10);
    }

html,
body{
  height:auto;
  min-height:100%;
}

body{
  background:var(--appBg);
  overflow-x:hidden;
  overflow-y:auto;
}

.pageFlow{
  display:flex;
  flex-direction:column;
  gap:22px;
}

.layoutGrid{
  display:grid;
  grid-template-columns:300px minmax(0, 1fr);
  gap:20px;
  align-items:start;
}

.sidebarCol{
  min-width:0;
  position:relative;
  align-self:start;
  height:max-content;
  position:-webkit-sticky;
  position:sticky;
  top:18px;
  max-height:calc(100vh - 36px);
}

.sideCardClean{
  width:100%;
  max-height:calc(100vh - 36px);
  overflow:auto;
  border-radius:24px;
  background:#fff;
  border:1px solid var(--cardBorder);
  box-shadow:var(--shadowMain);
  padding:16px;
  box-sizing:border-box;
}

.sideNavClean{
  display:flex;
  flex-direction:column;
  gap:10px;
  overflow:visible;
  padding-right:0;
  flex:none;
}

.sideInfoBox{
  margin-top:16px;
  padding:16px;
  border-radius:18px;
  background:#faf8fd;
  border:1px solid rgba(22,35,59,.06);
  color:var(--textStrong);
  flex:0 0 auto;
}

.topCard{
  position:relative;
  overflow:hidden;
  margin:0 0 20px;
  padding:22px 22px 20px;
  border-radius:28px;
  border:1px solid var(--cardBorder);
  background:
    radial-gradient(circle at top left, rgba(111,91,255,.10), transparent 24%),
    radial-gradient(circle at top right, rgba(245,165,36,.10), transparent 20%),
    #fff;
  box-shadow:var(--shadowMain);
}

.topTitle{
  color:var(--textStrong);
  font-size:22px;
  line-height:1.1;
  font-weight:1000;
  margin:0 0 8px;
}

.topSub{
  color:var(--textSoft);
  font-size:16px;
  margin-bottom:12px;
}

.metaRow{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}

.metaRow .chip{
  background:#fff;
  color:var(--textStrong);
  border:1px solid rgba(22,35,59,.08);
  box-shadow:none;
}

.heroClean{
  display:grid;
  grid-template-columns:minmax(0, 1.2fr) minmax(320px, .8fr);
  gap:18px;
  align-items:stretch;
  padding:26px;
  border-radius:28px;
  border:1px solid var(--cardBorder);
  background:
    radial-gradient(circle at 0% 0%, rgba(111,91,255,.12), transparent 26%),
    radial-gradient(circle at 100% 0%, rgba(245,165,36,.10), transparent 20%),
    linear-gradient(135deg, #ffffff 0%, #faf7ff 100%);
  box-shadow:var(--shadowMain);
}

.heroTag{
  display:inline-flex;
  width:max-content;
  padding:8px 12px;
  border-radius:999px;
  font-size:12px;
  font-weight:900;
  color:#5b46db;
  background:#efeaff;
  border:1px solid rgba(111,91,255,.14);
  margin-bottom:12px;
}

.heroTitle{
  margin:0 0 10px;
  color:var(--textStrong);
  font-size:clamp(28px, 4vw, 42px);
  line-height:1.05;
  letter-spacing:-.03em;
  font-weight:1000;
}

.heroText{
  margin:0;
  max-width:760px;
  color:var(--textSoft);
  line-height:1.65;
  font-size:15px;
}

.heroButtons{
  display:flex;
  flex-wrap:wrap;
  gap:12px;
  margin-top:18px;
}

.heroBtn{
  appearance:none;
  -webkit-appearance:none;
  border:1px solid rgba(22,35,59,.10);
  border-radius:16px;
  padding:14px 18px;
  min-height:50px;
  font-weight:900;
  font-size:14px;
  line-height:1;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  text-decoration:none;
  transition:transform .18s ease, box-shadow .18s ease, background .18s ease;
}

.heroBtn:hover{
  transform:translateY(-2px);
  box-shadow:0 10px 22px rgba(25,35,70,.10);
}

.heroBtnPrimary{
  background:linear-gradient(180deg, #705bff, #5b46db);
  color:#fff;
  border-color:transparent;
  box-shadow:0 10px 22px rgba(91,70,219,.18);
}

.heroBtnSecondary{
  background:linear-gradient(180deg, #ffd98b, #f4b53f);
  color:#3b2a00;
  border-color:transparent;
  box-shadow:0 10px 22px rgba(244,181,63,.18);
}

.heroBtnGhost{
  background:#fff;
  color:var(--textStrong);
  border:1px solid rgba(22,35,59,.10);
}

.heroRight{
  display:flex;
  flex-direction:column;
  gap:14px;
  justify-content:space-between;
}

.heroStatCard{
  padding:20px;
  border-radius:24px;
  background:linear-gradient(135deg, #fff7e8 0%, #ffffff 100%);
  border:1px solid rgba(244,181,63,.25);
}

.heroStatLabel{
  color:var(--textSoft);
  font-size:13px;
  margin-bottom:8px;
}

.heroStatValue{
  color:var(--textStrong);
  font-size:34px;
  line-height:1;
  font-weight:1000;
}

.heroMiniStats{
  display:grid;
  grid-template-columns:1fr;
  gap:12px;
}

.heroMiniStat{
  display:flex;
  gap:12px;
  align-items:center;
  padding:14px 16px;
  border-radius:18px;
  background:#fff;
  border:1px solid rgba(22,35,59,.08);
}

.heroMiniStat span{
  font-size:20px;
}

.heroMiniStat b{
  display:block;
  color:var(--textStrong);
  font-size:18px;
  line-height:1.1;
}

.heroMiniStat small{
  display:block;
  color:var(--textSoft);
  font-size:12px;
  margin-top:2px;
}

.sideTop{
  display:flex;
  flex-direction:column;
  gap:12px;
  margin-bottom:14px;
}

.sideTitle{
  font-size:22px;
  font-weight:1000;
  color:var(--textStrong);
  line-height:1.1;
}

.sideTopActions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

.sideTopActions button{
  border-radius:14px;
  border:1px solid rgba(22,35,59,.08);
  background:#fff;
  color:var(--textStrong);
}

.navBtnClean{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  width:100%;
  padding:15px 16px;
  border-radius:16px;
  background:#f7f7fb;
  border:1px solid rgba(22,35,59,.06);
  color:var(--textStrong);
  transition:all .18s ease;
  text-align:left;
}

.navBtnClean .chev{
  flex:0 0 auto;
  color:#7b8698;
  font-size:18px;
  line-height:1;
}

.navBtnClean .badge{
  margin-left:8px;
}

.navBtnClean:hover,
.navBtnClean.active{
  background:linear-gradient(135deg, #eef3ff 0%, #f7ebff 100%);
  border-color:rgba(111,91,255,.18);
}

.navBtnClean .navLabel{
  font-weight:800;
  color:var(--textStrong);
}

.sideInfoBox .miniLine{
  color:var(--textStrong);
  font-weight:700;
}

.sideInfoBox .miniHint{
  color:var(--textSoft);
  font-size:13px;
  line-height:1.45;
}

.wideSection{
  width:100%;
}

.sectionLead{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:16px;
  margin-bottom:14px;
  width:100%;
}

.sectionLeadText{
  min-width:0;
  flex:1;
}

.sectionEyebrow{
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:.14em;
  font-weight:900;
  color:#8a93a3;
  margin-bottom:8px;
}

.sectionTitle{
  margin:0;
  color:var(--textStrong);
  font-size:clamp(24px, 3vw, 36px);
  line-height:1.08;
  letter-spacing:-.03em;
  font-weight:1000;
  word-break:break-word;
}

.sectionDesc{
  margin-top:8px;
  color:var(--textSoft);
  line-height:1.6;
  font-size:14px;
  max-width:760px;
}

.leadPill{
  width:max-content;
  max-width:100%;
  white-space:nowrap;
  padding:10px 14px;
  border-radius:999px;
  background:#fff;
  border:1px solid rgba(22,35,59,.08);
  color:var(--textStrong);
  font-weight:900;
}

.widePanel{
  width:100%;
  box-sizing:border-box;
  display:block !important;
  padding:20px;
  border-radius:26px;
  background:#fff !important;
  border:1px solid var(--cardBorder);
  box-shadow:var(--shadowMain);
  overflow:hidden;
}

.topSummaryGrid{
  display:grid;
  grid-template-columns:repeat(4, minmax(0, 1fr));
  gap:14px;
}

.topSummaryCard{
  padding:18px;
  border-radius:20px;
  background:#faf8fd;
  border:1px solid rgba(22,35,59,.06);
}

.topSummaryLabel{
  color:var(--textSoft);
  font-size:13px;
  margin-bottom:8px;
}

.topSummaryValue{
  color:var(--textStrong);
  font-size:30px;
  line-height:1;
  font-weight:1000;
}

.noteReadable{
  background:#f8fbff;
  border:1px solid rgba(74,144,226,.12);
  color:var(--textStrong);
}

.noteReadable .muted{
  color:var(--textSoft) !important;
}

.panelHead .muted,
.cashCard .muted,
.miniCard .muted,
.resumeItem span,
.walletSub,
.walletLabel,
.walletMiniText,
.walletMiniTitle,
.tableReadable td,
.tableReadable th,
.hint{
  color:var(--textSoft);
}

.panelTitle,
.cashCardTitle,
.miniTitle,
.walletBig,
.walletMiniValue,
.resumeItem b,
.kpiValue,
.kpiTitle,
.miniValue,
.achTitle,
.activityValue,
.tableReadable td,
.tableReadable th,
.emptyTitle{
  color:var(--textStrong);
}

.walletHeroReadable{
  background:
    radial-gradient(circle at top left, rgba(111,91,255,.08), transparent 24%),
    radial-gradient(circle at top right, rgba(245,165,36,.08), transparent 18%),
    linear-gradient(135deg, #faf8ff 0%, #ffffff 100%);
  border:1px solid rgba(111,91,255,.10);
  border-radius:24px;
  padding:20px;
}

.walletHeroReadable .actionBig{
  min-height:52px;
  border-radius:16px;
  font-weight:900;
  border:1px solid rgba(22,35,59,.08);
}

.walletHeroReadable .actionPrimary{
  background:linear-gradient(180deg, #705bff, #5b46db);
  color:#fff;
  border:none;
}

.walletHeroReadable .actionSecondary{
  background:linear-gradient(180deg, #dff0ff, #cfe8ff);
  color:#1e3a5f;
}

.walletHeroReadable .actionGhost{
  background:#fff;
  color:var(--textStrong);
}

.walletMiniCard{
  background:#fff;
  border:1px solid rgba(22,35,59,.08);
  box-shadow:none;
}

.kpiCard,
.miniCard,
.cashCard,
.buyCard,
.activityItem,
.resumeItem,
.step,
.empty{
  background:#faf8fd;
  border:1px solid rgba(22,35,59,.06);
  color:var(--textStrong);
}

.kpiCardHot{
  background:#fff7f7;
  border-color:rgba(226,93,93,.18);
}

.kpiCardCoins{
  background:#fff9ee;
  border-color:rgba(244,181,63,.20);
}

.miniWarn{
  background:#fffaf0;
  border-color:rgba(244,181,63,.20);
}

.miniBad{
  background:#fff5f5;
  border-color:rgba(224,90,90,.18);
}

.softPill,
.cashPill,
.tierBadge,
.kpiBadge{
  color:var(--textStrong);
  background:#fff;
  border:1px solid rgba(22,35,59,.08);
}

.tableReadable{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  min-width:760px;
}

.tableReadable thead th{
  background:#f3f5fa;
  color:var(--textStrong);
  font-weight:900;
  border-bottom:1px solid rgba(22,35,59,.08);
}

.tableReadable tbody tr{
  background:#fff;
}

.tableReadable tbody tr:nth-child(even){
  background:#fafbfe;
}

.tableReadable td{
  border-bottom:1px solid rgba(22,35,59,.06);
  vertical-align:top;
  font-weight:600;
}

.tableReadable tr:last-child td{
  border-bottom:0;
}

.tableWrap{
  width:100%;
  overflow:auto;
  border-radius:18px;
  border:1px solid rgba(22,35,59,.06);
}

.tableSearch{
  width:100%;
  max-width:420px;
  background:#fff;
  color:var(--textStrong);
  border:1px solid rgba(22,35,59,.10);
}

.tableSearch::placeholder,
.linkInput::placeholder{
  color:#8a93a3;
}

.empty{
  padding:36px 20px;
  text-align:center;
  border-radius:22px;
}

.emptyText{
  color:var(--textSoft);
  margin-top:6px;
}

.linkCard{
  background:#faf8fd;
  border:1px solid rgba(22,35,59,.06);
  border-radius:22px;
  padding:18px;
}

.linkCardTitle{
  color:var(--textStrong);
  font-size:18px;
  font-weight:1000;
  margin-bottom:12px;
}

.linkInput{
  width:100%;
  min-height:54px;
  padding:14px 16px;
  border-radius:16px;
  border:1px solid rgba(22,35,59,.10);
  background:#fff;
  color:var(--textStrong);
  outline:none;
}

.linkButtons{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  margin-top:12px;
}

.hint{
  margin-top:10px;
  font-size:13px;
}

.modalCard{
  background:#fff;
  color:var(--textStrong);
  border:1px solid rgba(22,35,59,.08);
}

.modalCard input,
.modalCard select{
  background:#fff;
  color:var(--textStrong);
  border:1px solid rgba(22,35,59,.10);
}

.modalCard input::placeholder{
  color:#8a93a3;
}

.btnModal{
  background:#fff;
  color:var(--textStrong);
  border:1px solid rgba(22,35,59,.10);
}

.btnModal.primary{
  background:linear-gradient(180deg, #705bff, #5b46db);
  color:#fff;
  border:none;
}

.achItem{
  background:#faf8fd;
  border:1px solid rgba(22,35,59,.06);
}

.achItem.done{
  background:#eefcf4;
  border-color:rgba(67, 160, 91, .18);
}

.activityItem{
  background:#faf8fd;
  border:1px solid rgba(22,35,59,.06);
}

.activityItem small{
  color:var(--textSoft);
}

.pill{
  font-weight:900;
}

.btnSmall{
  border-radius:12px;
  padding:10px 12px;
  font-weight:900;
  border:1px solid rgba(22,35,59,.10);
  background:#fff;
  color:var(--textStrong);
}

@media (max-width: 1180px){
  .layoutGrid{
    grid-template-columns:1fr;
  }

  .sideCardClean{
    position:static;
    max-height:none;
  }

  .heroClean{
    grid-template-columns:1fr;
  }
}

@media (max-width: 900px){
  .topSummaryGrid,
  .kpiGrid,
  .split,
  .cashGrid{
    grid-template-columns:1fr !important;
  }

  .sectionLead{
    flex-direction:column;
    align-items:flex-start;
  }

  .heroButtons{
    flex-direction:column;
  }

  .heroBtn{
    width:100%;
  }
}

@media (max-width: 640px){
  .topTitle{
    font-size:20px;
  }

  .heroClean{
    padding:18px;
    border-radius:22px;
  }

  .widePanel{
    padding:16px;
    border-radius:20px;
  }

  .sideCardClean{
    padding:14px;
  }

  .leadPill{
    white-space:normal;
  }
}
  `;

  return `
    <style>${VENDA_PROFILE_CSS()}${extraLayoutCss}</style>

    <div class="pageFlow">
      <div class="layoutGrid">
        <div class="sidebarCol">
          ${sidebarHtml}
        </div>

        <div class="contentCol">
          <div class="contentFlow" id="panelHost">
            <div class="card topCard">
              <div class="topTitle">Painel do Parceiro — Venda 🧲</div>
              <div class="topSub p"><b>${esc(p.negocio || "-")}</b></div>
              <div class="metaRow">
                <div class="chip">📍 <b>${esc(p.cidade || "-")}</b></div>
                <div class="chip">📞 <b>${esc(p.whatsapp || "-")}</b></div>
                <div class="chip">🏷️ Segmento: <b>${esc(p.segmento || "-")}</b></div>
                <div class="chip">📮 CEP: <b>${esc(String(p.cep || "-"))}</b></div>
              </div>
            </div>

            ${topHero}
            ${resumaoTopo}
            ${tabVisao}
            ${tabCaixa}
            ${tabPedidos}
            ${tabLink}
            ${tabHistorico}
            ${tabComo}
          </div>
        </div>
      </div>
    </div>

    <div class="modalWrap" id="withdrawModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHead">
          <div>
            <div class="modalTitle">Sacar Moedas</div>
            <div class="muted" id="withdrawIntroText">Registre sua solicitação de saque do painel.</div>
          </div>
          <button class="modalClose" type="button" data-action="closeModal">✕</button>
        </div>

        <div class="modalBody">
          <div class="field">
            <label>Quantidade de moedas</label>
            <input id="withdrawAmount" type="number" min="1" step="0.01" placeholder="Ex.: 20" />
          </div>

          <div id="withdrawPixFields">
            <div class="field">
              <label>Tipo de chave PIX</label>
              <select id="withdrawPixType">
                <option value="">Selecione</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Aleatória</option>
              </select>
            </div>

            <div class="field">
              <label>Chave PIX</label>
              <input id="withdrawPixKey" type="text" placeholder="Informe sua chave PIX" />
            </div>

            <div class="field">
              <label>Nome do titular</label>
              <input id="withdrawPixHolderName" type="text" placeholder="Nome completo do titular" />
            </div>

            <div class="field">
              <label>Instituição da conta</label>
              <input id="withdrawPixBankName" type="text" placeholder="Ex.: Nubank, Caixa, Banco do Brasil" />
            </div>

            <div class="field">
              <label>CPF/CNPJ do titular</label>
              <input id="withdrawPixHolderDocument" type="text" placeholder="Somente números" />
            </div>
          </div>

          <div class="field">
            <label>Observação</label>
            <input id="withdrawNote" type="text" placeholder="Ex.: saque da semana" />
          </div>

          <div id="withdrawHint" class="muted" style="display:none;color:#b91c1c;"></div>

          <div class="modalActions">
            <button class="btnModal" type="button" data-action="closeModal">Cancelar</button>
            <button class="btnModal primary" type="button" data-action="confirmWithdraw">Confirmar saque</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modalWrap" id="buyCoinsModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHead">
          <div>
            <div class="modalTitle">Comprar Moedas</div>
            <div class="muted">Escolha um pacote para registrar no painel.</div>
          </div>
          <button class="modalClose" type="button" data-action="closeModal">✕</button>
        </div>
        <div class="modalBody">
          <div class="buyGrid">
            <div class="buyCard">
              <div class="buyCardTitle">Pacote Essencial</div>
              <div class="buyCardSub">10 moedas</div>
              <button class="btnModal primary" type="button" data-action="buyPack" data-pack="10">Selecionar</button>
            </div>
            <div class="buyCard">
              <div class="buyCardTitle">Pacote Pro</div>
              <div class="buyCardSub">25 moedas</div>
              <button class="btnModal primary" type="button" data-action="buyPack" data-pack="25">Selecionar</button>
            </div>
            <div class="buyCard">
              <div class="buyCardTitle">Pacote Turbo</div>
              <div class="buyCardSub">50 moedas</div>
              <button class="btnModal primary" type="button" data-action="buyPack" data-pack="50">Selecionar</button>
            </div>
            <div class="buyCard">
              <div class="buyCardTitle">Pacote Master</div>
              <div class="buyCardSub">100 moedas</div>
              <button class="btnModal primary" type="button" data-action="buyPack" data-pack="100">Selecionar</button>
            </div>
          </div>
          <div class="modalActions">
            <button class="btnModal" type="button" data-action="closeModal">Fechar</button>
          </div>
        </div>
      </div>
    </div>

    <div class="toasts" id="toasts" aria-live="polite" aria-atomic="true"></div>

    <script>
      ${buildVendaProfileJS({
        partnerId: p.id,
        levelKey: level.key,
        levelName: level.name,
        caixaTotal: caixa_total,
        walletState: {
          bonus_coins: Number(wallet?.bonus_coins || 0),
          purchased_coins: Number(wallet?.purchased_coins || 0),
          withdrawn_coins: Number(wallet?.withdrawn_coins || 0),
          streak_days: Number(wallet?.streak_days || 0),
          cycle_count: Number(wallet?.cycle_count || 0),
          last_checkin_date: wallet?.last_checkin_date || "",
        },
        walletActivities,
        pixState: {
          pix_key: p?.pix_key || "",
          pix_type: p?.pix_type || "",
          pix_holder_name: p?.pix_holder_name || "",
          pix_bank_name: p?.pix_bank_name || "",
          pix_holder_document: p?.pix_holder_document || "",
        },
      })}
    </script>
  `;
}