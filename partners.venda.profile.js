/**
 * partners.venda.profile.js
 *
 * Controller / rota do painel do parceiro venda.
 * Responsável por:
 * - validar acesso
 * - buscar dados no Supabase
 * - calcular métricas do painel
 * - delegar o HTML para a view
 */

"use strict";

const { renderVendaProfilePage } = require("./partners.venda.profile.view");

module.exports = function registerVendaProfileRoute(ctx) {
  const {
    app,
    isDev,
    supabase,
    layout,
    esc,
    moneyBR,
    statusLabel,
    requirePartner,
    getBaseUrl,

    toNum,
    fmtCoins,
    parseDateSafe,
    sameMonthYear,
    getTierByFinishedCount,
    getTierProgressInfo,
    buildAchievements,
    ensurePartnerWallet,
  } = ctx;

  app.get("/parceiros/perfil/:id", requirePartner, async (req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-store");

      const id = String(req.params.id || "").trim();
      if (!id) return res.redirect("/parceiros");

      if (String(req.partnerId) !== String(id)) {
        return res.status(403).type("html").send(
          layout(
            "Acesso negado",
            `<div class="card">
              <h1>403</h1>
              <p>Você não tem permissão para acessar este perfil.</p>
              <a href="/parceiros">Voltar</a>
            </div>`
          )
        );
      }

      // =========================
      // Parceiro
      // =========================
      const { data: p, error: pErr } = await supabase
        .from("partners")
        .select("*")
        .eq("id", id)
        .single();

      if (pErr || !p) {
        console.error("[perfil venda] erro ao buscar parceiro:", pErr);
        return res.redirect("/parceiros");
      }

      // Se não for venda, passa para a próxima rota
      if (String(p.tipo || "").toLowerCase() !== "venda") {
        return next();
      }

      // =========================
      // Pedidos
      // =========================
      const { data: pedidos, error: oErr } = await supabase
        .from("partner_orders")
        .select("*")
        .eq("partner_id", id)
        .order("created_at", { ascending: false });

      if (oErr) {
        console.error("[perfil venda] erro ao buscar pedidos:", oErr);
      }

      const orders = Array.isArray(pedidos) ? pedidos : [];

      // =========================
      // Carteira
      // =========================
      const wallet = await ensurePartnerWallet(id);

      const { data: walletActivities, error: walletActErr } = await supabase
        .from("partner_wallet_activities")
        .select("*")
        .eq("partner_id", id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (walletActErr) {
        console.error("[perfil venda] erro ao buscar atividades da carteira:", walletActErr);
      }

      // =========================
      // Métricas
      // =========================
      const pedidos_para_aceitar = orders.filter((x) => x.status === "para_aceitar").length;

      const pedidos_em_fabricacao = orders.filter(
        (x) =>
          x.status === "em_fabricacao" ||
          x.status === "pronto_entrega" ||
          x.status === "retorno"
      ).length;

      const pedidos_finalizados = orders.filter((x) => x.status === "finalizado").length;
      const pedidos_recusados = orders.filter((x) => x.status === "recusado").length;

      const caixa_total = orders
        .filter((x) => String(x.status || "") === "finalizado")
        .reduce((acc, x) => acc + Number(x.ganho_parceiro || 0), 0);

      const wallet_bonus = Number(wallet?.bonus_coins || 0);
      const wallet_purchased = Number(wallet?.purchased_coins || 0);
      const wallet_withdrawn = Number(wallet?.withdrawn_coins || 0);

      const carteira_total_disponivel =
        Number(caixa_total || 0) +
        Number(wallet_bonus || 0) +
        Number(wallet_purchased || 0) -
        Number(wallet_withdrawn || 0);

      // =========================
      // Perfil / completude
      // =========================
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
      const profilePct = total > 0 ? Math.round((filled / total) * 100) : 0;

      // =========================
      // Nível / progressão
      // =========================
      const level = getTierByFinishedCount(pedidos_finalizados);
      const levelProgress = getTierProgressInfo(pedidos_finalizados);

      // =========================
      // Métricas adicionais
      // =========================
      const totalPedidos = orders.length;
      const mediaPorPedido = pedidos_finalizados > 0 ? caixa_total / pedidos_finalizados : 0;
      const previsaoSeFinalizarPendentes =
        Number(carteira_total_disponivel || 0) + pedidos_em_fabricacao * 10;

      const now = new Date();

      const pedidosMesAtual = orders.filter((o) => {
        const d = parseDateSafe(o.created_at);
        return d && sameMonthYear(d, now);
      });

      const pedidosMesAtualFinalizados = pedidosMesAtual.filter(
        (o) => o.status === "finalizado"
      ).length;

      const pedidosMesAtualEmAberto = pedidosMesAtual.filter(
        (o) =>
          o.status === "para_aceitar" ||
          o.status === "em_fabricacao" ||
          o.status === "pronto_entrega" ||
          o.status === "retorno"
      ).length;

      const ganhoMesAtual = pedidosMesAtual
        .filter((o) => o.status === "finalizado")
        .reduce((acc, o) => acc + toNum(o.ganho_parceiro, 0), 0);

      const metaMensalFinalizados =
        level.key === "ouro" ? 40 : level.key === "prata" ? 20 : 10;

      const metaMensalPct = Math.max(
        0,
        Math.min(
          100,
          Math.round((pedidosMesAtualFinalizados / Math.max(1, metaMensalFinalizados)) * 100)
        )
      );

      const scoreOperacional = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            Math.min(40, pedidos_finalizados * 2) +
              Math.min(25, profilePct * 0.25) +
              Math.min(20, Number(wallet?.streak_days || 0) * 4) +
              Math.min(15, pedidos_em_fabricacao > 0 ? 15 : 0)
          )
        )
      );

      const achievements = buildAchievements({
        pedidos_finalizados,
        pedidos_pendentes: pedidos_para_aceitar + pedidos_em_fabricacao,
        streak_days: Number(wallet?.streak_days || 0),
        caixa_total,
      });

      // =========================
      // Link de referência
      // =========================
      const base = getBaseUrl(req);
      const referralLink = `${base}/sales?ref=${encodeURIComponent(p.id)}`;

      // =========================
      // Render
      // =========================
      const html = renderVendaProfilePage({
        p,
        orders,
        wallet,
        walletActivities: Array.isArray(walletActivities) ? walletActivities : [],

        esc,
        moneyBR,
        statusLabel,
        fmtCoins,

        now,
        pedidos_para_aceitar,
        pedidos_em_fabricacao,
        pedidos_finalizados,
        pedidos_recusados,
        caixa_total,
        wallet_bonus,
        wallet_purchased,
        wallet_withdrawn,
        carteira_total_disponivel,
        profilePct,
        level,
        levelProgress,
        totalPedidos,
        mediaPorPedido,
        previsaoSeFinalizarPendentes,
        pedidosMesAtualFinalizados,
        pedidosMesAtualEmAberto,
        ganhoMesAtual,
        metaMensalFinalizados,
        metaMensalPct,
        scoreOperacional,
        achievements,
        referralLink,
      });

      const navLeft = `
        <button class="btn btnOutline" onclick="window.history.back()" type="button">🔙 Voltar</button>
      `;

      const navRight = `
        <a class="btn btnOutline" href="/sales">🏠 Início</a>
        <a class="btn btnDanger" href="/parceiros/sair">🚪 Sair</a>
      `;

      return res.type("html").send(layout(titleSafe(titleFromPartner(p)), html, navRight, navLeft));
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] perfil venda erro:", msg, e);

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

  function titleFromPartner(partner) {
    const negocio = String(partner?.negocio || "").trim();
    return negocio ? `Perfil — ${negocio}` : "Perfil — Venda";
  }

  function titleSafe(s) {
    return String(s || "Perfil — Venda");
  }
};