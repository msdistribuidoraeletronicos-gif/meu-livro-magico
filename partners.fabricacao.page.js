/**
 * partners.fabricacao.page.js — Parceiros (Fabricação)
 * ARQUIVO PRINCIPAL / ORQUESTRADOR
 *
 * Responsável por:
 * - montar shared uma única vez
 * - declarar helpers compartilhados
 * - registrar rotas operacionais
 * - registrar rota de perfil/painel
 *
 * Dependências esperadas no mesmo diretório:
 * - ./partners.shared
 * - ./partners.fabricacao.routes
 * - ./partners.fabricacao.profile
 */

"use strict";

const { buildPartnersShared } = require("./partners.shared");
const registerFabricacaoRoutes = require("./partners.fabricacao.routes");
const registerFabricacaoProfileRoute = require("./partners.fabricacao.profile");

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
    setPartnerCookie,
    requirePartner,
    requirePartnerAuthForId,
    getBaseUrl,
  } = shared;

  // =========================
  // Helpers base
  // =========================
  function toNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function fmtCoins(v) {
    const n = toNum(v, 0);
    return (
      n.toLocaleString("pt-BR", {
        minimumFractionDigits: n % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }) + " moedas"
    );
  }

  function parseDateSafe(v) {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  }

  function sameMonthYear(a, b) {
    if (!a || !b) return false;
    return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  }

  function getTodayDateISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function getYesterdayDateISO() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // =========================
  // Helpers de moedas / nível
  // =========================
  function getTierByFinishedCount(n) {
    const total = Number(n || 0);

    if (total >= 50) {
      return {
        key: "ouro",
        name: "Ouro",
        icon: "🥇",
        hint: "Alta performance e consistência",
        commission: 32,
        checkinBase: 1.0,
        checkinBoost: 1.35,
      };
    }

    if (total >= 15) {
      return {
        key: "prata",
        name: "Prata",
        icon: "🥈",
        hint: "Ótimo ritmo de entregas",
        commission: 30,
        checkinBase: 0.75,
        checkinBoost: 1.15,
      };
    }

    return {
      key: "bronze",
      name: "Bronze",
      icon: "🥉",
      hint: "Evoluindo no programa",
      commission: 28,
      checkinBase: 0.5,
      checkinBoost: 1.0,
    };
  }

  function getTierProgressInfo(finishedCount) {
    const n = Number(finishedCount || 0);
    const tier = getTierByFinishedCount(n);

    if (tier.key === "bronze") {
      const current = Math.max(0, n);
      const nextAt = 15;
      const pct = Math.max(0, Math.min(100, Math.round((current / nextAt) * 100)));
      return {
        current,
        nextAt,
        nextName: "Prata",
        pct,
      };
    }

    if (tier.key === "prata") {
      const base = 15;
      const current = Math.max(0, n - base);
      const totalNeeded = 50 - base;
      const pct = Math.max(0, Math.min(100, Math.round((current / totalNeeded) * 100)));
      return {
        current: n,
        nextAt: 50,
        nextName: "Ouro",
        pct,
      };
    }

    return {
      current: n,
      nextAt: n,
      nextName: "Máximo",
      pct: 100,
    };
  }

  function buildAchievements(summary) {
    const items = [];

    const totalFinished = toNum(summary.pedidos_finalizados, 0);
    const streakDays = toNum(summary.streak_days, 0);
    const caixaTotal = toNum(summary.caixa_total, 0);
    const refusals = toNum(summary.pedidos_recusados, 0);
    const emFab = toNum(summary.pedidos_em_fabricacao, 0);

    items.push({
      icon: "🚀",
      title: "Primeiras entregas",
      done: totalFinished >= 1,
      text: totalFinished >= 1 ? "Você já concluiu pedidos no painel." : "Finalize seu 1º pedido.",
    });

    items.push({
      icon: "📦",
      title: "Ritmo constante",
      done: totalFinished >= 10,
      text:
        totalFinished >= 10
          ? "Você já passou de 10 pedidos concluídos."
          : `Faltam ${Math.max(0, 10 - totalFinished)} pedidos finalizados.`,
    });

    items.push({
      icon: "🔥",
      title: "Disciplina diária",
      done: streakDays >= 3,
      text:
        streakDays >= 3
          ? "Você já ativou a faixa melhorada do check-in."
          : `Faltam ${Math.max(0, 3 - streakDays)} dia(s) para bônus melhorado.`,
    });

    items.push({
      icon: "🪙",
      title: "Caixa forte",
      done: caixaTotal >= 100,
      text:
        caixaTotal >= 100
          ? "Seu histórico já passou de 100 moedas em ganhos."
          : `Faltam ${fmtCoins(Math.max(0, 100 - caixaTotal))}.`,
    });

    items.push({
      icon: "🎯",
      title: "Baixa recusa",
      done: totalFinished >= 5 && refusals <= 2,
      text:
        totalFinished >= 5 && refusals <= 2
          ? "Boa taxa de aceitação no painel."
          : "Mantenha boa qualidade de aceite e conclusão.",
    });

    items.push({
      icon: "🏭",
      title: "Operação ativa",
      done: emFab >= 1,
      text: emFab >= 1 ? "Você tem produção em andamento." : "Aceite pedidos para movimentar a operação.",
    });

    return items;
  }

  async function ensurePartnerWallet(partnerId) {
    const { data: found, error: foundErr } = await supabase
      .from("partner_wallets")
      .select("*")
      .eq("partner_id", partnerId)
      .maybeSingle();

    if (foundErr) {
      console.error("[wallet] erro ao buscar carteira:", foundErr);
      throw foundErr;
    }

    if (found) return found;

    const { data: created, error: createErr } = await supabase
      .from("partner_wallets")
      .insert({
        partner_id: partnerId,
        bonus_coins: 0,
        purchased_coins: 0,
        withdrawn_coins: 0,
        streak_days: 0,
        cycle_count: 0,
        last_checkin_date: null,
      })
      .select("*")
      .single();

    if (createErr) {
      console.error("[wallet] erro ao criar carteira:", createErr);
      throw createErr;
    }

    return created;
  }

  async function addWalletActivity(partnerId, walletId, type, title, amount, meta) {
    const row = {
      partner_id: partnerId,
      wallet_id: walletId || null,
      type: String(type || "info"),
      title: String(title || "Movimentação"),
      amount: toNum(amount, 0),
      meta: meta ? String(meta) : null,
    };

    const { error } = await supabase.from("partner_wallet_activities").insert(row);
    if (error) {
      console.error("[wallet] erro ao gravar atividade:", error);
      throw error;
    }
  }

  // =========================
  // Contexto compartilhado
  // =========================
  const ctx = {
    app,
    opts,
    shared,

    isDev,
    supabase,
    layout,
    esc,
    moneyBR,
    statusLabel,
    hashPassword,
    COOKIE_SECRET,
    setPartnerCookie,
    requirePartner,
    requirePartnerAuthForId,
    getBaseUrl,

    toNum,
    fmtCoins,
    parseDateSafe,
    sameMonthYear,
    getTodayDateISO,
    getYesterdayDateISO,

    getTierByFinishedCount,
    getTierProgressInfo,
    buildAchievements,
    ensurePartnerWallet,
    addWalletActivity,
  };

  // =========================
  // Registro das partes
  // =========================
  registerFabricacaoRoutes(ctx);
  registerFabricacaoProfileRoute(ctx);
};