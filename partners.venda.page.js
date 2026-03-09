/**
 * partners.venda.page.js — Parceiros (Venda)
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
 * - ./partners.venda.routes
 * - ./partners.venda.profile
 */

"use strict";

const { buildPartnersShared } = require("./partners.shared");
const registerVendaRoutes = require("./partners.venda.routes");
const registerVendaProfileRoute = require("./partners.venda.profile");

module.exports = function mountPartnersVenda(app, opts = {}) {
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
        hint: "Alta conversão e excelente constância",
        commissionPercent: 10,
        checkinBase: 1.0,
        checkinBoost: 1.35,
      };
    }

    if (total >= 15) {
      return {
        key: "prata",
        name: "Prata",
        icon: "🥈",
        hint: "Bom ritmo de vendas",
        commissionPercent: 10,
        checkinBase: 0.75,
        checkinBoost: 1.15,
      };
    }

    return {
      key: "bronze",
      name: "Bronze",
      icon: "🥉",
      hint: "Construindo sua base de vendas",
      commissionPercent: 10,
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
    const pendentes = toNum(summary.pedidos_pendentes, 0);

    items.push({
      icon: "🚀",
      title: "Primeira venda",
      done: totalFinished >= 1,
      text: totalFinished >= 1 ? "Você já concluiu vendas no painel." : "Finalize sua 1ª venda.",
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
          ? "Você ativou a recompensa melhorada do check-in."
          : `Faltam ${Math.max(0, 3 - streakDays)} dia(s) para bônus melhorado.`,
    });

    items.push({
      icon: "🪙",
      title: "Caixa crescente",
      done: caixaTotal >= 100,
      text:
        caixaTotal >= 100
          ? "Seu histórico já passou de 100 moedas."
          : `Faltam ${fmtCoins(Math.max(0, 100 - caixaTotal))}.`,
    });

    items.push({
      icon: "📈",
      title: "Operação ativa",
      done: pendentes >= 1,
      text:
        pendentes >= 1
          ? "Você tem pedidos ativos no painel."
          : "Divulgue seu link para gerar novos pedidos.",
    });

    items.push({
      icon: "🏆",
      title: "Vendedor em evolução",
      done: totalFinished >= 15,
      text:
        totalFinished >= 15
          ? "Você atingiu um bom nível de constância."
          : "Continue divulgando para subir de nível.",
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
  registerVendaRoutes(ctx);
  registerVendaProfileRoute(ctx);
};