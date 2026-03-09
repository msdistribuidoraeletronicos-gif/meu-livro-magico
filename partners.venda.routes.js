/**
 * partners.venda.routes.js — Parceiros (Venda)
 * Rotas operacionais:
 * - cadastro
 * - wallet / check-in / compra / saque / dados da carteira
 *
 * ✅ CORRIGIDO:
 * - saque agora usa o mesmo fluxo completo do parceiro de fabricação
 * - primeiro saque exige cadastro PIX completo
 * - próximos saques reutilizam PIX já salvo
 * - validação completa de chave PIX por tipo
 * - retorna pixState em /parceiros/wallet/data
 * - envia e-mail administrativo da solicitação de saque
 * - saldo calculado de forma detalhada e consistente
 */

"use strict";

const SibApiV3Sdk = require("sib-api-v3-sdk");

module.exports = function registerVendaRoutes(ctx) {
  const {
    app,
    isDev,
    supabase,
    layout,
    esc,
    hashPassword,
    COOKIE_SECRET,
    setPartnerCookie,
    requirePartner,

    ensurePartnerWallet,
    addWalletActivity,
    getTodayDateISO,
    getYesterdayDateISO,
    getTierByFinishedCount,
  } = ctx;

  // =====================================================
  // Brevo / Email admin
  // =====================================================
  const BREVO_API_KEY = String(process.env.BREVO_API_KEY || "").trim();
  const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || "").trim();
  const WITHDRAW_FROM_EMAIL = String(
    process.env.WITHDRAW_FROM_EMAIL ||
      process.env.PARTNER_RESET_FROM ||
      process.env.EMAIL_FROM ||
      ""
  ).trim();
  const WITHDRAW_FROM_NAME = String(
    process.env.WITHDRAW_FROM_NAME ||
      process.env.PARTNER_RESET_FROM_NAME ||
      "Meu Livro Mágico"
  ).trim();

  let brevoClient = null;
  if (BREVO_API_KEY) {
    const client = SibApiV3Sdk.ApiClient.instance;
    const apiKey = client.authentications["api-key"];
    apiKey.apiKey = BREVO_API_KEY;
    brevoClient = new SibApiV3Sdk.TransactionalEmailsApi();
  }

  // =====================================================
  // Helpers gerais
  // =====================================================
  function toNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeTrim(v, max = 300) {
    return String(v == null ? "" : v).trim().slice(0, max);
  }

  function onlyDigits(v) {
    return String(v == null ? "" : v).replace(/\D/g, "");
  }

  function normalizeEmail(v) {
    return safeTrim(v, 180).toLowerCase();
  }

  function isValidEmail(v) {
    const s = normalizeEmail(v);
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  }

  function isDigitsOnly(v) {
    return /^\d+$/.test(String(v == null ? "" : v));
  }

  function isValidCPF(value) {
    const cpf = onlyDigits(value);

    if (!/^\d{11}$/.test(cpf)) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += Number(cpf.charAt(i)) * (10 - i);
    }

    let firstCheck = (sum * 10) % 11;
    if (firstCheck === 10) firstCheck = 0;
    if (firstCheck !== Number(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += Number(cpf.charAt(i)) * (11 - i);
    }

    let secondCheck = (sum * 10) % 11;
    if (secondCheck === 10) secondCheck = 0;
    if (secondCheck !== Number(cpf.charAt(10))) return false;

    return true;
  }

  function isValidCNPJ(value) {
    const cnpj = onlyDigits(value);

    if (!/^\d{14}$/.test(cnpj)) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    const calcCheckDigit = (base, weights) => {
      let sum = 0;
      for (let i = 0; i < weights.length; i++) {
        sum += Number(base.charAt(i)) * weights[i];
      }
      const mod = sum % 11;
      return mod < 2 ? 0 : 11 - mod;
    };

    const base12 = cnpj.slice(0, 12);
    const digit1 = calcCheckDigit(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const base13 = base12 + String(digit1);
    const digit2 = calcCheckDigit(base13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

    return cnpj === base12 + String(digit1) + String(digit2);
  }

  function isValidPixPhone(value) {
    const phone = onlyDigits(value);

    if (!/^\d{10,13}$/.test(phone)) return false;
    if (!isDigitsOnly(phone)) return false;

    return true;
  }

  function validatePixKeyByType(type, key) {
    const rawKey = String(key == null ? "" : key).trim();
    const digits = onlyDigits(rawKey);

    if (type === "cpf") {
      if (!isDigitsOnly(rawKey)) {
        return { ok: false, error: "invalid_pix_key_cpf_non_digits" };
      }
      if (digits.length !== 11) {
        return { ok: false, error: "invalid_pix_key_cpf_length" };
      }
      if (!isValidCPF(digits)) {
        return { ok: false, error: "invalid_pix_key_cpf" };
      }
      return { ok: true, normalized: digits };
    }

    if (type === "cnpj") {
      if (!isDigitsOnly(rawKey)) {
        return { ok: false, error: "invalid_pix_key_cnpj_non_digits" };
      }
      if (digits.length !== 14) {
        return { ok: false, error: "invalid_pix_key_cnpj_length" };
      }
      if (!isValidCNPJ(digits)) {
        return { ok: false, error: "invalid_pix_key_cnpj" };
      }
      return { ok: true, normalized: digits };
    }

    if (type === "telefone") {
      if (!isDigitsOnly(rawKey)) {
        return { ok: false, error: "invalid_pix_key_phone_non_digits" };
      }
      if (!isValidPixPhone(rawKey)) {
        return { ok: false, error: "invalid_pix_key_phone" };
      }
      return { ok: true, normalized: digits };
    }

    if (type === "email") {
      if (!isValidEmail(rawKey)) {
        return { ok: false, error: "invalid_pix_key_email" };
      }
      return { ok: true, normalized: normalizeEmail(rawKey) };
    }

    if (type === "aleatoria") {
      if (!rawKey) {
        return { ok: false, error: "pix_key_required" };
      }
      return { ok: true, normalized: rawKey };
    }

    return { ok: false, error: "invalid_pix_type" };
  }

  function normalizePixType(v) {
    const raw = safeTrim(v, 40).toLowerCase();
    const map = {
      cpf: "cpf",
      cnpj: "cnpj",
      email: "email",
      telefone: "telefone",
      phone: "telefone",
      celular: "telefone",
      aleatoria: "aleatoria",
      aleatório: "aleatoria",
      random: "aleatoria",
    };
    return map[raw] || raw;
  }

  function isValidPixType(v) {
    return ["cpf", "cnpj", "email", "telefone", "aleatoria"].includes(
      normalizePixType(v)
    );
  }

  function normalizePhone(v) {
    return onlyDigits(v).slice(0, 20);
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

  function parseAdminEmails() {
    return String(ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function sendAdminEmail({ subject, html, text }) {
    const admins = parseAdminEmails();

    if (!admins.length) {
      return { ok: false, error: "ADMIN_EMAILS não configurado" };
    }

    if (!brevoClient) {
      return { ok: false, error: "BREVO_API_KEY não configurado" };
    }

    if (!WITHDRAW_FROM_EMAIL) {
      return {
        ok: false,
        error:
          "WITHDRAW_FROM_EMAIL/PARTNER_RESET_FROM/EMAIL_FROM não configurado",
      };
    }

    try {
      const response = await brevoClient.sendTransacEmail({
        sender: {
          email: WITHDRAW_FROM_EMAIL,
          name: WITHDRAW_FROM_NAME,
        },
        to: admins.map((email) => ({ email })),
        subject: String(subject || "Notificação"),
        htmlContent: String(html || ""),
        textContent: String(text || ""),
      });

      return {
        ok: true,
        id: response?.messageId || null,
      };
    } catch (err) {
      const msg = err?.response?.body?.message || err?.message || String(err);
      return { ok: false, error: msg };
    }
  }

  function normalizePartnerRow(row = {}) {
    return {
      id: safeTrim(row.id || "", 120),
      tipo: safeTrim(row.tipo || "", 40),
      responsavel: safeTrim(row.responsavel || "", 180),
      negocio: safeTrim(row.negocio || "", 180),
      segmento: safeTrim(row.segmento || "", 120),
      whatsapp: normalizePhone(row.whatsapp || ""),
      email: normalizeEmail(row.email || ""),
      cidade: safeTrim(row.cidade || "", 120),
      endereco: safeTrim(row.endereco || "", 220),
      cep: onlyDigits(row.cep || "").slice(0, 8),
      obs: safeTrim(row.obs || "", 400),

      pix_key: safeTrim(row.pix_key || "", 180),
      pix_type: normalizePixType(row.pix_type || ""),
      pix_holder_name: safeTrim(row.pix_holder_name || "", 180),
      pix_bank_name: safeTrim(row.pix_bank_name || "", 180),
      pix_holder_document: onlyDigits(row.pix_holder_document || "").slice(0, 20),

      created_at: row.created_at || "",
      updated_at: row.updated_at || "",
    };
  }

  function getPartnerPixInfo(partner = {}) {
    const p = normalizePartnerRow(partner);
    return {
      key: p.pix_key,
      type: p.pix_type,
      holderName: p.pix_holder_name,
      bankName: p.pix_bank_name,
      holderDocument: p.pix_holder_document,
      isComplete:
        !!p.pix_key &&
        !!p.pix_type &&
        !!p.pix_holder_name &&
        !!p.pix_bank_name &&
        !!p.pix_holder_document,
    };
  }

  function validatePixFields(data = {}) {
    const type = normalizePixType(data.pix_type);
    const rawKey = safeTrim(data.pix_key, 180);
    const holderName = safeTrim(data.pix_holder_name, 180);
    const bankName = safeTrim(data.pix_bank_name, 180);
    const holderDocumentRaw = safeTrim(data.pix_holder_document, 40);
    const holderDocument = onlyDigits(holderDocumentRaw).slice(0, 20);

    if (!isValidPixType(type)) {
      return { ok: false, error: "invalid_pix_type" };
    }

    if (!rawKey) {
      return { ok: false, error: "pix_key_required" };
    }

    if (!holderName) {
      return { ok: false, error: "pix_holder_name_required" };
    }

    if (!bankName) {
      return { ok: false, error: "pix_bank_name_required" };
    }

    if (!holderDocumentRaw) {
      return { ok: false, error: "pix_holder_document_required" };
    }

    if (!isDigitsOnly(holderDocumentRaw)) {
      return { ok: false, error: "invalid_holder_document_cpf_non_digits" };
    }

    if (holderDocument.length !== 11) {
      return { ok: false, error: "invalid_holder_document_cpf_length" };
    }

    if (!isValidCPF(holderDocument)) {
      return { ok: false, error: "invalid_holder_document_cpf" };
    }

    const pixCheck = validatePixKeyByType(type, rawKey);
    if (!pixCheck.ok) {
      return pixCheck;
    }

    return {
      ok: true,
      data: {
        pix_key: pixCheck.normalized,
        pix_type: type,
        pix_holder_name: holderName,
        pix_bank_name: bankName,
        pix_holder_document: holderDocument,
      },
    };
  }

  async function getPartnerById(partnerId) {
    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .eq("id", partnerId)
      .single();

    if (error) throw error;
    return data || null;
  }

  async function getVendaPartnerOr403(partnerId) {
    const partner = await getPartnerById(partnerId);
    if (!partner || String(partner.tipo || "").toLowerCase() !== "venda") {
      return null;
    }
    return partner;
  }

  async function updatePartnerPix(partnerId, payload = {}) {
    const type = normalizePixType(payload.pix_type || "");
    const keyCheck = validatePixKeyByType(type, payload.pix_key || "");

    if (!keyCheck.ok) {
      throw new Error(keyCheck.error || "invalid_pix_key");
    }

    const holderDocument = onlyDigits(payload.pix_holder_document || "").slice(0, 20);

    const row = {
      pix_key: keyCheck.normalized,
      pix_type: type,
      pix_holder_name: safeTrim(payload.pix_holder_name || "", 180),
      pix_bank_name: safeTrim(payload.pix_bank_name || "", 180),
      pix_holder_document: holderDocument,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("partners")
      .update(row)
      .eq("id", partnerId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function getVendaWalletSummary(partnerId) {
    const wallet = await ensurePartnerWallet(partnerId);

    const { data: finalizados, error: finalErr } = await supabase
      .from("partner_orders")
      .select("ganho_parceiro, status")
      .eq("partner_id", partnerId)
      .eq("status", "finalizado");

    if (finalErr) throw finalErr;

    const { data: activities, error: actErr } = await supabase
      .from("partner_wallet_activities")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (actErr) throw actErr;

    const baseCoins = (finalizados || []).reduce(
      (acc, row) => acc + Number(row.ganho_parceiro || 0),
      0
    );

    const available =
      Number(baseCoins || 0) +
      Number(wallet.bonus_coins || 0) +
      Number(wallet.purchased_coins || 0) -
      Number(wallet.withdrawn_coins || 0);

    return {
      wallet,
      baseCoins,
      available: Math.max(0, available),
      activities: Array.isArray(activities) ? activities : [],
    };
  }

  async function getPartnerFullAdminData(partnerId, requestedAmount, note) {
    const [partner, walletSummary, ordersRes] = await Promise.all([
      getPartnerById(partnerId),
      getVendaWalletSummary(partnerId),
      supabase
        .from("partner_orders")
        .select(
          "id, order_id, status, ganho_parceiro, created_at, cliente_nome, cliente_cidade, valor_total",
          { count: "exact" }
        )
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const normalized = normalizePartnerRow(partner || {});
    const pix = getPartnerPixInfo(normalized);
    const wallet = walletSummary.wallet || {};

    const { count: finalizadosCount, error: countErr } = await supabase
      .from("partner_orders")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId)
      .eq("status", "finalizado");

    if (countErr) {
      console.error("[wallet] erro ao contar finalizados para email:", countErr);
    }

    const tier = getTierByFinishedCount(Number(finalizadosCount || 0));

    return {
      partnerId,
      tipo: normalized.tipo || "venda",
      responsavel: normalized.responsavel || "Não informado",
      negocio: normalized.negocio || "Não informado",
      segmento: normalized.segmento || "Não informado",
      whatsapp: normalized.whatsapp || "Não informado",
      email: normalized.email || "Não informado",
      cidade: normalized.cidade || "Não informado",
      endereco: normalized.endereco || "Não informado",
      cep: normalized.cep || "Não informado",
      obs: normalized.obs || "",

      requestedAmount: toNum(requestedAmount, 0),
      requestedAmountFormatted: fmtCoins(requestedAmount),
      note: String(note || "").trim(),

      pixKey: pix.key || "Não informado",
      pixType: pix.type || "Não informado",
      pixHolderName: pix.holderName || "Não informado",
      pixBankName: pix.bankName || "Não informado",
      pixHolderDocument: pix.holderDocument || "Não informado",

      walletAvailable: toNum(walletSummary.available, 0),
      walletAvailableFormatted: fmtCoins(walletSummary.available || 0),
      baseCoins: toNum(walletSummary.baseCoins, 0),
      baseCoinsFormatted: fmtCoins(walletSummary.baseCoins || 0),
      bonusCoins: toNum(wallet.bonus_coins, 0),
      bonusCoinsFormatted: fmtCoins(wallet.bonus_coins || 0),
      purchasedCoins: toNum(wallet.purchased_coins, 0),
      purchasedCoinsFormatted: fmtCoins(wallet.purchased_coins || 0),
      withdrawnCoins: toNum(wallet.withdrawn_coins, 0),
      withdrawnCoinsFormatted: fmtCoins(wallet.withdrawn_coins || 0),

      streakDays: toNum(wallet.streak_days, 0),
      cycleCount: toNum(wallet.cycle_count, 0),
      lastCheckinDate: wallet.last_checkin_date || "",
      totalOrders: Number(ordersRes?.count || 0),
      completedOrders: Number(finalizadosCount || 0),

      tierName: String(tier?.name || "Bronze"),
      tierIcon: String(tier?.icon || "🥉"),
      tierKey: String(tier?.key || "bronze"),
      commission: 10,
      commissionFormatted: "10%",

      recentOrders: Array.isArray(ordersRes?.data) ? ordersRes.data : [],
      partnerRaw: partner || {},
      generatedAt: new Date().toISOString(),
    };
  }

  function buildWithdrawAdminEmail(data) {
    const subject = `[SAQUE PARCEIRO VENDA] ${data.negocio} solicitou ${data.requestedAmountFormatted}`;

    const recentOrdersHtml = (data.recentOrders || []).length
      ? `
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-size:14px;">
          <thead>
            <tr>
              <th align="left">ID</th>
              <th align="left">Pedido base</th>
              <th align="left">Cliente</th>
              <th align="left">Cidade</th>
              <th align="left">Status</th>
              <th align="left">Ganho</th>
              <th align="left">Data</th>
            </tr>
          </thead>
          <tbody>
            ${(data.recentOrders || [])
              .map((o) => {
                return `
                  <tr>
                    <td>${esc(String(o.id || ""))}</td>
                    <td>${esc(String(o.order_id || ""))}</td>
                    <td>${esc(String(o.cliente_nome || ""))}</td>
                    <td>${esc(String(o.cliente_cidade || ""))}</td>
                    <td>${esc(String(o.status || ""))}</td>
                    <td>${esc(fmtCoins(o.ganho_parceiro || 0))}</td>
                    <td>${esc(String(o.created_at || ""))}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      `
      : `<div>Nenhum pedido recente encontrado.</div>`;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif; color:#111; line-height:1.6; font-size:14px;">
        <h2 style="margin:0 0 14px;">Solicitação de saque — Parceiro Venda</h2>

        <p>Um parceiro de venda solicitou saque no painel.</p>

        <h3>Dados do parceiro</h3>
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-size:14px;">
          <tbody>
            <tr><td><b>Partner ID</b></td><td>${esc(data.partnerId)}</td></tr>
            <tr><td><b>Tipo</b></td><td>${esc(data.tipo)}</td></tr>
            <tr><td><b>Responsável</b></td><td>${esc(data.responsavel)}</td></tr>
            <tr><td><b>Negócio</b></td><td>${esc(data.negocio)}</td></tr>
            <tr><td><b>Segmento</b></td><td>${esc(data.segmento)}</td></tr>
            <tr><td><b>E-mail</b></td><td>${esc(data.email)}</td></tr>
            <tr><td><b>WhatsApp</b></td><td>${esc(data.whatsapp)}</td></tr>
            <tr><td><b>Cidade</b></td><td>${esc(data.cidade)}</td></tr>
            <tr><td><b>Endereço</b></td><td>${esc(data.endereco)}</td></tr>
            <tr><td><b>CEP</b></td><td>${esc(data.cep)}</td></tr>
            <tr><td><b>Observações</b></td><td>${esc(data.obs || "—")}</td></tr>
          </tbody>
        </table>

        <h3 style="margin-top:20px;">Solicitação</h3>
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-size:14px;">
          <tbody>
            <tr><td><b>Valor solicitado</b></td><td>${esc(data.requestedAmountFormatted)}</td></tr>
            <tr><td><b>Saldo disponível</b></td><td>${esc(data.walletAvailableFormatted)}</td></tr>
            <tr><td><b>Observação</b></td><td>${esc(data.note || "—")}</td></tr>
            <tr><td><b>Gerado em</b></td><td>${esc(data.generatedAt)}</td></tr>
          </tbody>
        </table>

        <h3 style="margin-top:20px;">Dados PIX</h3>
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-size:14px;">
          <tbody>
            <tr><td><b>Chave PIX</b></td><td>${esc(data.pixKey)}</td></tr>
            <tr><td><b>Tipo da chave</b></td><td>${esc(data.pixType)}</td></tr>
            <tr><td><b>Nome do titular</b></td><td>${esc(data.pixHolderName)}</td></tr>
            <tr><td><b>Instituição</b></td><td>${esc(data.pixBankName)}</td></tr>
            <tr><td><b>Documento do titular</b></td><td>${esc(data.pixHolderDocument)}</td></tr>
          </tbody>
        </table>

        <h3 style="margin-top:20px;">Carteira</h3>
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-size:14px;">
          <tbody>
            <tr><td><b>Moedas de pedidos</b></td><td>${esc(data.baseCoinsFormatted)}</td></tr>
            <tr><td><b>Bônus</b></td><td>${esc(data.bonusCoinsFormatted)}</td></tr>
            <tr><td><b>Compradas</b></td><td>${esc(data.purchasedCoinsFormatted)}</td></tr>
            <tr><td><b>Saques acumulados</b></td><td>${esc(data.withdrawnCoinsFormatted)}</td></tr>
            <tr><td><b>Disponível atual</b></td><td>${esc(data.walletAvailableFormatted)}</td></tr>
          </tbody>
        </table>

        <h3 style="margin-top:20px;">Nível e atividade</h3>
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-size:14px;">
          <tbody>
            <tr><td><b>Nível atual</b></td><td>${esc(data.tierIcon + " " + data.tierName)}</td></tr>
            <tr><td><b>Comissão atual</b></td><td>${esc(data.commissionFormatted)}</td></tr>
            <tr><td><b>Pedidos finalizados</b></td><td>${esc(String(data.completedOrders))}</td></tr>
            <tr><td><b>Total de pedidos</b></td><td>${esc(String(data.totalOrders))}</td></tr>
            <tr><td><b>Sequência de check-in</b></td><td>${esc(String(data.streakDays) + " dia(s)")}</td></tr>
            <tr><td><b>Ciclo atual</b></td><td>${esc(String(data.cycleCount) + " / 7")}</td></tr>
            <tr><td><b>Último check-in</b></td><td>${esc(data.lastCheckinDate || "—")}</td></tr>
          </tbody>
        </table>

        <h3 style="margin-top:20px;">Pedidos recentes</h3>
        ${recentOrdersHtml}

        <h3 style="margin-top:20px;">Parceiro bruto</h3>
        <pre style="white-space:pre-wrap; word-break:break-word; background:#f8fafc; border:1px solid #e5e7eb; padding:12px; border-radius:8px;">${esc(
          JSON.stringify(data.partnerRaw || {}, null, 2)
        )}</pre>
      </div>
    `;

    const text = [
      "Solicitação de saque — Parceiro Venda",
      "",
      `Partner ID: ${data.partnerId}`,
      `Responsável: ${data.responsavel}`,
      `Negócio: ${data.negocio}`,
      `Segmento: ${data.segmento}`,
      `E-mail: ${data.email}`,
      `WhatsApp: ${data.whatsapp}`,
      `Cidade: ${data.cidade}`,
      `Endereço: ${data.endereco}`,
      `CEP: ${data.cep}`,
      "",
      `Valor solicitado: ${data.requestedAmountFormatted}`,
      `Saldo disponível: ${data.walletAvailableFormatted}`,
      `Observação: ${data.note || "—"}`,
      "",
      `PIX chave: ${data.pixKey}`,
      `PIX tipo: ${data.pixType}`,
      `PIX titular: ${data.pixHolderName}`,
      `PIX banco: ${data.pixBankName}`,
      `PIX documento: ${data.pixHolderDocument}`,
      "",
      `Nível: ${data.tierIcon} ${data.tierName}`,
      `Comissão: ${data.commissionFormatted}`,
      `Pedidos finalizados: ${data.completedOrders}`,
      `Total pedidos: ${data.totalOrders}`,
      `Sequência check-in: ${data.streakDays} dia(s)`,
      `Ciclo: ${data.cycleCount}/7`,
      `Último check-in: ${data.lastCheckinDate || "—"}`,
      "",
      `Base coins: ${data.baseCoinsFormatted}`,
      `Bonus coins: ${data.bonusCoinsFormatted}`,
      `Purchased coins: ${data.purchasedCoinsFormatted}`,
      `Withdrawn coins: ${data.withdrawnCoinsFormatted}`,
      "",
      `Gerado em: ${data.generatedAt}`,
    ].join("\n");

    return { subject, html, text };
  }

  // =========================
  // CADASTRO — somente Venda
  // =========================
  app.get("/parceiros/cadastro", (req, res, next) => {
    const tipo = String(req.query.tipo || "").toLowerCase();
    if (tipo !== "venda") return next();

    const title = "Cadastro — Venda";

    const campoSegmento = `
      <label>Seu negócio (escreva)</label>
      <input name="segmento_texto" placeholder="Ex.: presentes, mercado, personalizados, livraria…" required/>
      <div class="muted" style="margin-top:6px;">Isso ajuda a entender seu público e sugerir melhores formas de divulgação.</div>
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

  .wrap{max-width:980px;margin:0 auto}
  .hero{
    border:1px solid rgba(255,255,255,.10);
    background:linear-gradient(135deg, rgba(84,169,255,.12), rgba(255,82,173,.10));
    border-radius:18px;
    padding:16px;
    margin-bottom:14px;
  }
  .heroTop{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .heroTitle{font-weight:1000;font-size:20px;letter-spacing:-0.02em}
  .heroSub{margin-top:6px;opacity:.9}
  .heroBadge{
    padding:8px 10px;border-radius:999px;
    border:1px solid rgba(255,255,255,.14);
    background:rgba(255,255,255,.06);
    font-weight:1000;font-size:12px;
  }

  .bar{height:10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);overflow:hidden}
  .barFill{
    height:100%;
    width:0%;
    background:linear-gradient(90deg, rgba(84,169,255,.9), rgba(40,200,120,.85));
    border-radius:999px;
    transition:width .25s ease;
  }
  .progressRow{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px}
  .progressText{font-size:12px;opacity:.85}

  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:860px){.grid2{grid-template-columns:1fr}}
  .miniCard{
    border:1px solid rgba(255,255,255,.10);
    background:rgba(0,0,0,.16);
    border-radius:16px;
    padding:12px;
  }
  .miniTitle{font-weight:1000;margin-bottom:6px}
  .miniLine{display:flex;gap:10px;align-items:flex-start}
  .miniLine .dot{margin-top:6px;width:8px;height:8px;border-radius:99px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.16)}
  .miniLine b{font-weight:1000}

  .inlineHint{
    margin-top:10px;
    border-radius:14px;
    padding:12px;
    border:1px solid rgba(255,255,255,.10);
    background:rgba(255,255,255,.04);
  }
  .inlineHint b{font-weight:1000}

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
    animation:toastIn .20s ease forwards;
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

  .btnPrimary.soft{box-shadow:0 0 0 0 rgba(0,0,0,0)}
  .btnPrimary.soft:hover{transform:translateY(-1px)}
</style>

<div class="wrap">

  <div class="hero">
    <div class="heroTop">
      <div>
        <div class="heroTitle">Parceiro — Venda 🧲</div>
        <div class="heroSub p">
          Você ganha <b>10%</b> em cada compra feita pelo seu link. Seu painel mostra histórico e ganhos.
        </div>
      </div>
      <div class="heroBadge">Cadastro rápido • 1 minuto</div>
    </div>

    <div class="progressRow">
      <div style="flex:1">
        <div class="bar"><div class="barFill" id="barFill"></div></div>
      </div>
      <div class="progressText" id="progressText">0% completo</div>
    </div>
  </div>

  <div class="grid2">
    <div class="miniCard">
      <div class="miniTitle">Como você ganha</div>
      <div class="miniLine"><span class="dot"></span><div>Seu link rastreia a compra automaticamente.</div></div>
      <div class="miniLine"><span class="dot"></span><div>Você recebe <b>10%</b> do total de cada compra pelo link.</div></div>
      <div class="miniLine"><span class="dot"></span><div>Seus ganhos aparecem no painel em <b>Meu caixa</b>.</div></div>
    </div>

    <div class="miniCard">
      <div class="miniTitle">Dicas rápidas</div>
      <div class="miniLine"><span class="dot"></span><div>Coloque o link na <b>bio</b> do Instagram.</div></div>
      <div class="miniLine"><span class="dot"></span><div>Use em status do WhatsApp e stories.</div></div>
      <div class="miniLine"><span class="dot"></span><div>Envie para clientes que compram presentes.</div></div>
    </div>
  </div>

  <div style="height:14px"></div>

  <div class="card">
    <div class="h1">Cadastro de Parceiro — Venda 🧲</div>
    <p class="p">Preencha seus dados para criar seu perfil de parceiro.</p>
    <div style="height:14px"></div>

    <form method="POST" action="/parceiros/cadastro" id="cadForm" novalidate>
      <input type="hidden" name="tipo" value="venda"/>

      <div class="formRow">
        <div>
          <label>Nome do responsável</label>
          <input name="responsavel" placeholder="Seu nome" required/>
        </div>
        <div>
          <label>Nome do negócio</label>
          <input name="negocio" placeholder="Ex.: Loja da Maria" required/>
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
          <input type="password" name="senha" placeholder="Crie uma senha" minlength="6" required/>
          <div class="muted" style="margin-top:6px;">Mínimo recomendado: 6+ caracteres.</div>
        </div>
        <div>
          <label>Confirmar senha</label>
          <input type="password" name="senha2" placeholder="Repita a senha" minlength="6" required/>
        </div>
      </div>

      <div class="inlineHint">
        <b>Confirmação:</b> ao salvar, você já entra no painel e consegue copiar seu link de divulgação.
      </div>

      <div style="height:12px"></div>

      <div>
        <label>Observações</label>
        <textarea name="obs" placeholder="Horário, referências, etc."></textarea>
      </div>

      <div style="height:16px"></div>

      <button class="btn btnPrimary soft" type="submit" id="submitBtn">Criar meu perfil</button>
      <a class="btn btnOutline" href="/parceiros" style="margin-left:10px;">Voltar</a>
    </form>
  </div>

</div>

<div class="toasts" id="toasts" aria-live="polite" aria-atomic="true"></div>

<script>
(function(){
  const form = document.getElementById('cadForm');
  const bar = document.getElementById('barFill');
  const text = document.getElementById('progressText');
  const submitBtn = document.getElementById('submitBtn');
  const toasts = document.getElementById('toasts');

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function toast(type, title, msg, ms){
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML =
      '<div class="toastTop">' +
        '<div class="toastTitle">' + esc(title || 'Aviso') + '</div>' +
        '<button class="x" type="button" aria-label="Fechar">✕</button>' +
      '</div>' +
      (msg ? '<div class="toastMsg">' + esc(msg) + '</div>' : '');
    el.querySelector('.x').addEventListener('click', () => el.remove());
    toasts.appendChild(el);
    setTimeout(() => { try{ el.remove(); }catch(e){} }, (typeof ms==='number'?ms:2600));
  }

  const requiredNames = [
    'responsavel','negocio','segmento_texto','whatsapp','email','cidade','endereco','cep','senha','senha2'
  ];

  function calcProgress(){
    let filled = 0;
    for(const n of requiredNames){
      const inp = form.querySelector('[name="'+n+'"]');
      if(!inp) continue;
      const v = String(inp.value || '').trim();
      if(v) filled++;
    }
    const pct = Math.round((filled / requiredNames.length) * 100);
    if(bar) bar.style.width = pct + '%';
    if(text) text.textContent = pct + '% completo';
  }

  function validateSoft(){
    const senha = String(form.querySelector('[name="senha"]').value || '');
    const senha2 = String(form.querySelector('[name="senha2"]').value || '');
    if(senha.length && senha.length < 6){
      toast('warn','Senha curta','Use pelo menos 6 caracteres.', 3200);
      return false;
    }
    if(senha && senha2 && senha !== senha2){
      toast('bad','Senhas não conferem','Confira a confirmação da senha.', 3400);
      return false;
    }
    return true;
  }

  form.addEventListener('input', calcProgress);
  form.addEventListener('change', calcProgress);
  calcProgress();

  form.addEventListener('submit', (ev) => {
    if(!validateSoft()){
      ev.preventDefault();
      return;
    }
    submitBtn.disabled = true;
    submitBtn.dataset.old = submitBtn.textContent;
    submitBtn.textContent = 'Criando…';
  });
})();
</script>
        `
      )
    );
  });

  app.post("/parceiros/cadastro", async (req, res, next) => {
    const tipo = String(req.body.tipo || "").toLowerCase();
    if (tipo !== "venda") return next();

    try {
      const responsavel = String(req.body.responsavel || "").trim();
      const negocio = String(req.body.negocio || "").trim();
      const whatsapp = String(req.body.whatsapp || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const cidade = String(req.body.cidade || "").trim();
      const endereco = String(req.body.endereco || "").trim();
      const cep = String(req.body.cep || "").replace(/\D/g, "");
      const obs = String(req.body.obs || "").trim();
      const segmento = String(req.body.segmento_texto || "").trim();

      const senha = String(req.body.senha || "");
      const senha2 = String(req.body.senha2 || "");

      if (!senha || senha.length < 6) {
        throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      }

      if (senha !== senha2) {
        throw new Error("As senhas não conferem.");
      }

      if (!/^\d{8}$/.test(cep)) {
        throw new Error("CEP inválido. Digite 8 números (ex: 00000-000).");
      }

      const { data: exists, error: exErr } = await supabase
        .from("partners")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (exErr) {
        console.error("[partners] check email error:", exErr);
      }

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
        tipo: "venda",
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
        comissao_venda_percent: 10,
        fabricacao_por_pedido: 0,
        entrega_por_pedido: 0,
        cep_inicio: null,
        cep_fim: null,
      };

      const { data, error } = await supabase
        .from("partners")
        .insert(parceiroRow)
        .select("*")
        .single();

      if (error) {
        console.error("[partners] INSERT partners error:", error);
        throw error;
      }

      await ensurePartnerWallet(data.id);

      if (!COOKIE_SECRET && !isDev) {
        throw new Error("Defina PARTNER_COOKIE_SECRET no ambiente de produção.");
      }

      setPartnerCookie(res, data.id);

      res.setHeader("Cache-Control", "no-store");
      return res.redirect(303, `/parceiros/perfil/${encodeURIComponent(data.id)}`);
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] cadastro (venda) erro:", msg);

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
  // WALLET / CHECK-IN
  // =========================
  app.post("/parceiros/wallet/checkin", requirePartner, async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");

      const partnerId = String(req.partnerId || "").trim();
      if (!partnerId) {
        return res.status(401).json({ ok: false, error: "não autenticado" });
      }

      const partner = await getVendaPartnerOr403(partnerId);
      if (!partner) {
        return res.status(403).json({ ok: false, error: "acesso inválido" });
      }

      const { count: finalizadosCount, error: countErr } = await supabase
        .from("partner_orders")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", partnerId)
        .eq("status", "finalizado");

      if (countErr) {
        console.error("[wallet] erro ao contar finalizados:", countErr);
        return res.status(500).json({ ok: false, error: "Falha ao calcular nível" });
      }

      const level = getTierByFinishedCount(Number(finalizadosCount || 0));
      const wallet = await ensurePartnerWallet(partnerId);

      const today = getTodayDateISO();
      const yesterday = getYesterdayDateISO();

      if (String(wallet.last_checkin_date || "") === today) {
        return res.status(409).json({
          ok: false,
          error: "Check-in já realizado hoje.",
        });
      }

      let streakDays = 1;
      let cycleCount = 1;

      if (String(wallet.last_checkin_date || "") === yesterday) {
        streakDays = Number(wallet.streak_days || 0) + 1;
        cycleCount = Number(wallet.cycle_count || 0) + 1;
      }

      const reward =
        streakDays >= 3
          ? Number(level.checkinBoost || 0)
          : Number(level.checkinBase || 0);

      let nextStreakDays = streakDays;
      let nextCycleCount = cycleCount;

      if (cycleCount >= 7) {
        nextStreakDays = 0;
        nextCycleCount = 0;
      }

      const newBonus = Number(wallet.bonus_coins || 0) + reward;

      const { data: updated, error: updErr } = await supabase
        .from("partner_wallets")
        .update({
          bonus_coins: newBonus,
          streak_days: nextStreakDays,
          cycle_count: nextCycleCount,
          last_checkin_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq("partner_id", partnerId)
        .select("*")
        .single();

      if (updErr) {
        console.error("[wallet] erro ao atualizar check-in:", updErr);
        return res.status(500).json({ ok: false, error: updErr.message || "Falha no check-in" });
      }

      await addWalletActivity(
        partnerId,
        updated.id,
        "checkin",
        "Check-in diário",
        reward,
        `Recompensa diária no nível ${level.name}`
      );

      return res.json({
        ok: true,
        reward,
        wallet: updated,
        level: {
          key: level.key,
          name: level.name,
          icon: level.icon,
        },
      });
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[wallet] checkin erro:", msg, e);
      return res.status(500).json({ ok: false, error: msg || "Erro interno" });
    }
  });

  // =========================
  // WALLET / SAQUE
  // =========================
  app.post("/parceiros/wallet/withdraw", requirePartner, async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");

      const partnerId = String(req.partnerId || "").trim();
      if (!partnerId) {
        return res.status(401).json({ ok: false, error: "não autenticado" });
      }

      const amount = Number(req.body.amount || 0);
      const note = safeTrim(req.body.note || "", 500);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_amount" });
      }

      const partner = await getVendaPartnerOr403(partnerId);
      if (!partner) {
        return res.status(403).json({ ok: false, error: "acesso inválido" });
      }

      const currentPix = getPartnerPixInfo(partner);

      if (!currentPix.isComplete) {
        const pixValidation = validatePixFields(req.body || {});
        if (!pixValidation.ok) {
          return res.status(400).json({ ok: false, error: pixValidation.error });
        }

        try {
          const updatedPartner = await updatePartnerPix(partnerId, pixValidation.data);

          return continueWithdraw({
            partner: updatedPartner,
            pixSavedNow: pixValidation.data,
          });
        } catch (pixErr) {
          console.error("[withdraw-venda] erro salvando pix:", pixErr);
          return res.status(500).json({ ok: false, error: "pix_save_failed" });
        }
      }

      return continueWithdraw({
        partner,
        pixSavedNow: null,
      });

      async function continueWithdraw({ partner, pixSavedNow }) {
        const walletSummary = await getVendaWalletSummary(partnerId);
        const wallet = walletSummary.wallet || {};
        const available = Number(walletSummary.available || 0);

        console.log("[withdraw-venda] saldo real calculado:", {
          partnerId,
          amount,
          available,
          baseCoins: Number(walletSummary.baseCoins || 0),
          bonusCoins: Number(wallet.bonus_coins || 0),
          purchasedCoins: Number(wallet.purchased_coins || 0),
          withdrawnCoins: Number(wallet.withdrawn_coins || 0),
        });

        if (amount > available) {
          return res.status(400).json({
            ok: false,
            error: "insufficient_balance",
            debug: {
              amount,
              available,
              baseCoins: Number(walletSummary.baseCoins || 0),
              bonusCoins: Number(wallet.bonus_coins || 0),
              purchasedCoins: Number(wallet.purchased_coins || 0),
              withdrawnCoins: Number(wallet.withdrawn_coins || 0),
            },
          });
        }

        const currentWithdrawn = Number(wallet.withdrawn_coins || 0);
        const nextWithdrawn = currentWithdrawn + amount;

        const { data: updatedWallet, error: updateWalletErr } = await supabase
          .from("partner_wallets")
          .update({
            withdrawn_coins: nextWithdrawn,
            updated_at: new Date().toISOString(),
          })
          .eq("partner_id", partnerId)
          .select("*")
          .single();

        if (updateWalletErr) {
          console.error("[withdraw-venda] erro atualizando wallet:", updateWalletErr);
          return res.status(500).json({ ok: false, error: "wallet_update_failed" });
        }

        try {
          await addWalletActivity(
            partnerId,
            updatedWallet.id,
            "withdraw",
            "Solicitação de saque",
            -amount,
            note || "Solicitação de saque via painel"
          );
        } catch (actErr) {
          console.error("[withdraw-venda] erro ao registrar atividade:", actErr);
        }

        let adminEmailStatus = null;
        try {
          const fullData = await getPartnerFullAdminData(partnerId, amount, note);
          const emailPayload = buildWithdrawAdminEmail(fullData);
          adminEmailStatus = await sendAdminEmail(emailPayload);

          if (!adminEmailStatus?.ok) {
            console.error("[withdraw-venda] falha ao enviar email admin:", adminEmailStatus);
          }
        } catch (mailErr) {
          console.error("[withdraw-venda] erro montando/enviando email admin:", mailErr);
          adminEmailStatus = {
            ok: false,
            error: mailErr?.message || String(mailErr),
          };
        }

        return res.json({
          ok: true,
          wallet: updatedWallet,
          availableCoins: Math.max(0, available - amount),
          pix: pixSavedNow
            ? {
                pix_key: pixSavedNow.pix_key || "",
                pix_type: pixSavedNow.pix_type || "",
                pix_holder_name: pixSavedNow.pix_holder_name || "",
                pix_bank_name: pixSavedNow.pix_bank_name || "",
                pix_holder_document: pixSavedNow.pix_holder_document || "",
              }
            : {
                pix_key: partner.pix_key || "",
                pix_type: partner.pix_type || "",
                pix_holder_name: partner.pix_holder_name || "",
                pix_bank_name: partner.pix_bank_name || "",
                pix_holder_document: partner.pix_holder_document || "",
              },
          adminEmail: adminEmailStatus,
        });
      }
    } catch (e) {
      console.error("[withdraw-venda] erro interno:", e);
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  // =========================
  // WALLET / COMPRA
  // =========================
  app.post("/parceiros/wallet/buy", requirePartner, async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");

      const partnerId = String(req.partnerId || "").trim();
      if (!partnerId) {
        return res.status(401).json({ ok: false, error: "não autenticado" });
      }

      const partner = await getVendaPartnerOr403(partnerId);
      if (!partner) {
        return res.status(403).json({ ok: false, error: "acesso inválido" });
      }

      const amount = Number(req.body.amount || 0);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ ok: false, error: "Pacote inválido." });
      }

      const allowed = new Set([10, 25, 50, 100]);
      if (!allowed.has(amount)) {
        return res.status(400).json({ ok: false, error: "Pacote não permitido." });
      }

      const wallet = await ensurePartnerWallet(partnerId);
      const newPurchased = Number(wallet.purchased_coins || 0) + amount;

      const { data: updated, error: updErr } = await supabase
        .from("partner_wallets")
        .update({
          purchased_coins: newPurchased,
          updated_at: new Date().toISOString(),
        })
        .eq("partner_id", partnerId)
        .select("*")
        .single();

      if (updErr) {
        console.error("[wallet] erro ao comprar moedas:", updErr);
        return res.status(500).json({
          ok: false,
          error: updErr.message || "Falha ao registrar compra",
        });
      }

      await addWalletActivity(
        partnerId,
        updated.id,
        "buy",
        "Compra de moedas",
        amount,
        `Pacote de ${amount} moedas`
      );

      return res.json({
        ok: true,
        wallet: updated,
      });
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[wallet] buy erro:", msg, e);
      return res.status(500).json({ ok: false, error: msg || "Erro interno" });
    }
  });

  // =========================
  // WALLET / DADOS
  // =========================
  app.get("/parceiros/wallet/data", requirePartner, async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");

      const partnerId = String(req.partnerId || "").trim();
      if (!partnerId) {
        return res.status(401).json({ ok: false, error: "não autenticado" });
      }

      const partner = await getVendaPartnerOr403(partnerId);
      if (!partner) {
        return res.status(403).json({ ok: false, error: "acesso inválido" });
      }

      const walletSummary = await getVendaWalletSummary(partnerId);
      const pix = getPartnerPixInfo(partner || {});

      return res.json({
        ok: true,
        wallet: walletSummary.wallet,
        activities: walletSummary.activities || [],
        availableCoins: walletSummary.available,
        baseCoins: walletSummary.baseCoins,
        pixState: {
          has_pix_key: pix.isComplete,
          pix_key: pix.key || "",
          pix_type: pix.type || "",
          pix_holder_name: pix.holderName || "",
          pix_bank_name: pix.bankName || "",
          pix_holder_document: pix.holderDocument || "",
        },
      });
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[wallet] data erro:", msg, e);
      return res.status(500).json({ ok: false, error: msg || "Erro interno" });
    }
  });
};