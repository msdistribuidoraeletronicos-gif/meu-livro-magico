/**
 * profile.page.js — Página /profile (Perfil do usuário)
 *
 * ✅ Rotas:
 *   GET  /profile
 *   GET  /api/me
 *   GET  /api/my-books
 *   GET  /api/my-orders
 *
 *   GET  /api/my-wallet
 *   POST /api/my-wallet/checkin
 *   POST /api/my-wallet/withdraw
 *   POST /api/my-wallet/buy
 *
 *   GET  /api/my-account
 *   POST /api/my-account/verify-password
 *   POST /api/my-account/update
 *
 * Requer:
 * - app.js deve passar { requireAuth, supabaseAdmin, supabaseAuth }
 * - requireAuth precisa setar req.user = { id, email }
 *
 * Tabelas esperadas:
 * - profiles
 * - books
 * - orders
 * - user_wallets
 * - user_wallet_activities
 */

"use strict";

const SibApiV3Sdk = require("sib-api-v3-sdk");
const { renderProfilePage } = require("./profile.page.view");
const {
  PROFILE_PAGE_CSS,
  buildProfilePageJS,
} = require("./profile.page.assets");

module.exports = function mountProfilePage(app, options = {}) {
  const { requireAuth, supabaseAdmin, supabaseAuth } = options;

  if (!app) throw new Error("mountProfilePage: app ausente");
  if (typeof requireAuth !== "function") {
    throw new Error("mountProfilePage: requireAuth ausente");
  }

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

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(v, min, max) {
    const n = Number(v || 0);
    if (n < min) return min;
    if (n > max) return max;
    return n;
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

  function normalizeUF(v) {
    return safeTrim(v, 2).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  }

  function normalizeCep(v) {
    return onlyDigits(v).slice(0, 8);
  }

  function normalizePhone(v) {
    return onlyDigits(v).slice(0, 20);
  }

  function startOfDayLocal(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function ymdLocal(d = new Date()) {
    const x = new Date(d);
    const yyyy = x.getFullYear();
    const mm = String(x.getMonth() + 1).padStart(2, "0");
    const dd = String(x.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function daysDiff(a, b) {
    const aa = startOfDayLocal(a).getTime();
    const bb = startOfDayLocal(b).getTime();
    return Math.round((aa - bb) / 86400000);
  }

  function fmtCoins(v) {
    const n = toNum(v, 0);
    return `${n.toLocaleString("pt-BR", {
      minimumFractionDigits: n % 1 ? 2 : 0,
      maximumFractionDigits: 2,
    })} moedas`;
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
      return {
        ok: false,
        error: "Brevo não configurado. Defina BREVO_API_KEY.",
      };
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

      return { ok: true, id: response?.messageId || null };
    } catch (err) {
      const msg = err?.response?.body?.message || err?.message || String(err);
      return { ok: false, error: msg };
    }
  }

  function getUserLevelByOrders(completedOrders) {
    const total = toNum(completedOrders, 0);

    if (total >= 20) {
      return {
        key: "ouro",
        name: "Ouro",
        icon: "🥇",
        buyBonusPct: 0.12,
        checkinBase: 1.0,
        checkinBoost: 1.35,
      };
    }

    if (total >= 8) {
      return {
        key: "prata",
        name: "Prata",
        icon: "🥈",
        buyBonusPct: 0.08,
        checkinBase: 0.75,
        checkinBoost: 1.15,
      };
    }

    return {
      key: "bronze",
      name: "Bronze",
      icon: "🥉",
      buyBonusPct: 0.05,
      checkinBase: 0.5,
      checkinBoost: 1.0,
    };
  }

  function getUserLevelProgress(completedOrders) {
    const total = toNum(completedOrders, 0);

    if (total >= 20) {
      return {
        pct: 100,
        nextAt: 20,
        nextName: "Nível máximo",
      };
    }

    if (total >= 8) {
      const base = 8;
      const nextAt = 20;
      const pct = Math.round(((total - base) / (nextAt - base)) * 100);
      return {
        pct: clamp(pct, 0, 100),
        nextAt,
        nextName: "Ouro",
      };
    }

    const nextAt = 8;
    const pct = Math.round((total / nextAt) * 100);
    return {
      pct: clamp(pct, 0, 100),
      nextAt,
      nextName: "Prata",
    };
  }

  function normalizeProfileRow(row = {}) {
    return {
      id: safeTrim(row.id || "", 120),
      name: safeTrim(row.name || row.full_name || row.nome || "", 180),
      email: normalizeEmail(row.email || ""),
      phone: normalizePhone(row.phone || row.telefone || row.whatsapp || ""),
      pix_key: safeTrim(
        row.pix_key ||
          row.pixKey ||
          row.chave_pix ||
          row.chavePix ||
          row.pix ||
          row.pix_email ||
          row.pixEmail ||
          row.pix_phone ||
          row.pixPhone ||
          row.pix_document ||
          row.pixDocument ||
          "",
        180
      ),
      pix_type: normalizePixType(
        row.pix_type || row.pixType || row.tipo_pix || row.tipoPix || ""
      ),
      pix_holder_name: safeTrim(
        row.pix_holder_name || row.pixHolderName || row.nome_titular || "",
        180
      ),
      pix_bank_name: safeTrim(
        row.pix_bank_name ||
          row.pixBankName ||
          row.instituicao_conta ||
          row.banco ||
          "",
        180
      ),
      pix_holder_document: onlyDigits(
        row.pix_holder_document ||
          row.pixHolderDocument ||
          row.cpf_titular ||
          row.documento_titular ||
          ""
      ).slice(0, 20),

      address_street: safeTrim(
        row.address_street || row.rua || row.street || "",
        180
      ),
      address_number: safeTrim(
        row.address_number || row.numero || row.number || "",
        40
      ),
      address_district: safeTrim(
        row.address_district || row.bairro || row.district || "",
        120
      ),
      address_city: safeTrim(
        row.address_city || row.cidade || row.city || "",
        120
      ),
      address_state: normalizeUF(
        row.address_state || row.uf || row.state || ""
      ),
      address_zip: normalizeCep(row.address_zip || row.cep || row.zip || ""),
      address_complement: safeTrim(
        row.address_complement || row.complemento || row.comp || "",
        180
      ),

      created_at: row.created_at || "",
      updated_at: row.updated_at || "",
    };
  }

  function getProfilePixInfo(profile = {}) {
    const p = normalizeProfileRow(profile);

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

  function buildProfileUpdatePayloadFromInput(input = {}, fallback = {}) {
    const current = normalizeProfileRow(fallback);

    return {
      name: safeTrim(input.name ?? current.name, 180),
      email: normalizeEmail(input.email ?? current.email),
      phone: normalizePhone(input.phone ?? current.phone),

      pix_key: safeTrim(input.pix_key ?? current.pix_key, 180),
      pix_type: normalizePixType(input.pix_type ?? current.pix_type),
      pix_holder_name: safeTrim(
        input.pix_holder_name ?? current.pix_holder_name,
        180
      ),
      pix_bank_name: safeTrim(
        input.pix_bank_name ?? current.pix_bank_name,
        180
      ),
      pix_holder_document: onlyDigits(
        input.pix_holder_document ?? current.pix_holder_document
      ).slice(0, 20),

      address_street: safeTrim(
        input.address_street ?? current.address_street,
        180
      ),
      address_number: safeTrim(
        input.address_number ?? current.address_number,
        40
      ),
      address_district: safeTrim(
        input.address_district ?? current.address_district,
        120
      ),
      address_city: safeTrim(
        input.address_city ?? current.address_city,
        120
      ),
      address_state: normalizeUF(input.address_state ?? current.address_state),
      address_zip: normalizeCep(input.address_zip ?? current.address_zip),
      address_complement: safeTrim(
        input.address_complement ?? current.address_complement,
        180
      ),
      updated_at: new Date().toISOString(),
    };
  }

  function validatePixFields(data = {}) {
    const key = safeTrim(data.pix_key, 180);
    const type = normalizePixType(data.pix_type);
    const holderName = safeTrim(data.pix_holder_name, 180);
    const bankName = safeTrim(data.pix_bank_name, 180);
    const holderDocument = onlyDigits(data.pix_holder_document).slice(0, 20);

    if (!isValidPixType(type)) {
      return { ok: false, error: "invalid_pix_type" };
    }

    if (!key) {
      return { ok: false, error: "pix_key_required" };
    }

    if (!holderName) {
      return { ok: false, error: "pix_holder_name_required" };
    }

    if (!bankName) {
      return { ok: false, error: "pix_bank_name_required" };
    }

    if (!holderDocument) {
      return { ok: false, error: "pix_holder_document_required" };
    }

    if (type === "email" && !isValidEmail(key)) {
      return { ok: false, error: "invalid_pix_key_email" };
    }

    if (type === "cpf" && onlyDigits(key).length !== 11) {
      return { ok: false, error: "invalid_pix_key_cpf" };
    }

    if (type === "cnpj" && onlyDigits(key).length !== 14) {
      return { ok: false, error: "invalid_pix_key_cnpj" };
    }

    if (type === "telefone") {
      const phone = onlyDigits(key);
      if (phone.length < 10 || phone.length > 13) {
        return { ok: false, error: "invalid_pix_key_phone" };
      }
    }

    return {
      ok: true,
      data: {
        pix_key: key,
        pix_type: type,
        pix_holder_name: holderName,
        pix_bank_name: bankName,
        pix_holder_document: holderDocument,
      },
    };
  }

  async function getProfileByUserId(userId) {
    if (!supabaseAdmin) throw new Error("supabase_client_missing");

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function upsertUserProfile(userId, payload = {}) {
    if (!supabaseAdmin) throw new Error("supabase_client_missing");

    const row = {
      id: userId,
      ...payload,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function countCompletedUserOrders(userId) {
    if (!supabaseAdmin) return 0;

    const paidStatuses = ["paid", "shipped", "delivered", "finalizado", "done"];

    const { count, error } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", paidStatuses);

    if (error) return 0;
    return Number(count || 0);
  }

  async function ensureUserWallet(userId) {
    if (!supabaseAdmin) throw new Error("supabase_client_missing");

    const { data: existing, error: findErr } = await supabaseAdmin
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (findErr) throw findErr;
    if (existing) return existing;

    const payload = {
      user_id: userId,
      bonus_coins: 0,
      purchased_coins: 0,
      withdrawn_coins: 0,
      streak_days: 0,
      cycle_count: 0,
      last_checkin_date: null,
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("user_wallets")
      .insert(payload)
      .select("*")
      .single();

    if (insertErr) throw insertErr;
    return inserted;
  }

  async function addWalletActivity(userId, payload = {}) {
    if (!supabaseAdmin) throw new Error("supabase_client_missing");

    const row = {
      user_id: userId,
      type: String(payload.type || "info"),
      title: String(payload.title || "Movimentação"),
      amount: toNum(payload.amount, 0),
      meta: payload.meta != null ? String(payload.meta) : null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("user_wallet_activities")
      .insert(row);

    if (error) throw error;
  }

  async function getWalletBaseCoinsFromOrders(userId) {
    if (!supabaseAdmin) return 0;

    const paidStatuses = ["paid", "shipped", "delivered", "finalizado", "done"];

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("status, order_data")
      .eq("user_id", userId)
      .in("status", paidStatuses)
      .limit(500);

    if (error) throw error;

    let total = 0;
    for (const row of data || []) {
      const od = row?.order_data || {};
      total += toNum(od.wallet_bonus_coins, 0);
    }
    return total;
  }

  async function getMyWalletSummary(userId) {
    if (!supabaseAdmin) throw new Error("supabase_client_missing");

    const wallet = await ensureUserWallet(userId);
    const completedOrders = await countCompletedUserOrders(userId);
    const level = getUserLevelByOrders(completedOrders);
    const progress = getUserLevelProgress(completedOrders);
    const baseCoins = await getWalletBaseCoinsFromOrders(userId);

    const bonus = toNum(wallet.bonus_coins, 0);
    const purchased = toNum(wallet.purchased_coins, 0);
    const withdrawn = toNum(wallet.withdrawn_coins, 0);

    const available = Math.max(0, baseCoins + bonus + purchased - withdrawn);

    const { data: activities, error: actErr } = await supabaseAdmin
      .from("user_wallet_activities")
      .select("id, type, title, amount, meta, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (actErr) throw actErr;

    return {
      wallet,
      baseCoins,
      completedOrders,
      level,
      progress,
      available,
      activities: Array.isArray(activities) ? activities : [],
    };
  }

  async function verifyCurrentPassword(email, password) {
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = String(password || "");

    if (!cleanEmail || !cleanPassword) {
      return { ok: false, error: "email_or_password_missing" };
    }

    if (!supabaseAuth || !supabaseAuth.auth?.signInWithPassword) {
      return { ok: false, error: "supabase_auth_missing" };
    }

    try {
      const { error } = await supabaseAuth.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        return { ok: false, error: "invalid_password" };
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || "invalid_password" };
    }
  }

  async function updateAuthIdentity(userId, changes = {}) {
    if (!supabaseAdmin?.auth?.admin?.updateUserById) {
      return { ok: false, error: "supabase_admin_auth_missing" };
    }

    const authPayload = {};

    if (changes.email) {
      authPayload.email = normalizeEmail(changes.email);
      authPayload.email_confirm = true;
    }

    if (changes.password) {
      authPayload.password = String(changes.password || "");
    }

    if (!Object.keys(authPayload).length) {
      return { ok: true, skipped: true };
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      authPayload
    );

    if (error) {
      return { ok: false, error: error.message || "auth_update_failed" };
    }

    return { ok: true, data };
  }

  async function getUserFullAdminData(userId, sessionEmail, requestedAmount, note) {
    if (!supabaseAdmin) throw new Error("supabase_client_missing");

    const [profileRes, walletSummary, booksRes, ordersRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      getMyWalletSummary(userId),
      supabaseAdmin
        .from("books")
        .select(
          "id,status,child_name,theme,style,created_at,updated_at",
          { count: "exact" }
        )
        .eq("user_id", userId)
        .limit(10),
      supabaseAdmin
        .from("orders")
        .select("id,status,order_data,created_at,book_id", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const profile = profileRes?.data || null;
    const wallet = walletSummary?.wallet || {};
    const level = walletSummary?.level || {};
    const progress = walletSummary?.progress || {};
    const recentOrders = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
    const recentBooks = Array.isArray(booksRes?.data) ? booksRes.data : [];
    const totalOrders = Number(ordersRes?.count || 0);
    const totalBooks = Number(booksRes?.count || 0);
    const pix = getProfilePixInfo(profile || {});
    const normalizedProfile = normalizeProfileRow(profile || {});

    return {
      userId,
      email: String(sessionEmail || profile?.email || "").trim(),
      name:
        String(profile?.name || profile?.full_name || profile?.nome || "").trim() ||
        "Não informado",
      requestedAmount: toNum(requestedAmount, 0),
      requestedAmountFormatted: fmtCoins(requestedAmount),
      note: String(note || "").trim(),
      pixKey: pix.key || "Não informado",
      pixType: pix.type || "Não informado",
      pixHolderName: pix.holderName || "Não informado",
      pixBankName: pix.bankName || "Não informado",
      pixHolderDocument: pix.holderDocument || "Não informado",

      walletAvailable: toNum(walletSummary?.available, 0),
      walletAvailableFormatted: fmtCoins(walletSummary?.available || 0),
      baseCoins: toNum(walletSummary?.baseCoins, 0),
      baseCoinsFormatted: fmtCoins(walletSummary?.baseCoins || 0),
      bonusCoins: toNum(wallet?.bonus_coins, 0),
      bonusCoinsFormatted: fmtCoins(wallet?.bonus_coins || 0),
      purchasedCoins: toNum(wallet?.purchased_coins, 0),
      purchasedCoinsFormatted: fmtCoins(wallet?.purchased_coins || 0),
      withdrawnCoins: toNum(wallet?.withdrawn_coins, 0),
      withdrawnCoinsFormatted: fmtCoins(wallet?.withdrawn_coins || 0),

      streakDays: toNum(wallet?.streak_days, 0),
      cycleCount: toNum(wallet?.cycle_count, 0),
      lastCheckinDate: wallet?.last_checkin_date || "",
      completedOrders: toNum(walletSummary?.completedOrders, 0),
      totalOrders,
      totalBooks,

      levelName: String(level?.name || "Bronze"),
      levelIcon: String(level?.icon || "🥉"),
      levelKey: String(level?.key || "bronze"),
      nextLevelName: String(progress?.nextName || "Nível máximo"),
      nextLevelAt: toNum(progress?.nextAt, 0),
      levelPct: toNum(progress?.pct, 0),

      profileCreatedAt: profile?.created_at || "",
      profileUpdatedAt: profile?.updated_at || "",
      profileRaw: profile || {},
      recentOrders,
      recentBooks,
      generatedAt: new Date().toISOString(),

      phone: normalizedProfile.phone,
      addressStreet: normalizedProfile.address_street,
      addressNumber: normalizedProfile.address_number,
      addressDistrict: normalizedProfile.address_district,
      addressCity: normalizedProfile.address_city,
      addressState: normalizedProfile.address_state,
      addressZip: normalizedProfile.address_zip,
      addressComplement: normalizedProfile.address_complement,
    };
  }

  function buildWithdrawAdminEmail(data) {
    const subject = `[SAQUE] ${data.name} solicitou ${data.requestedAmountFormatted}`;

    const recentOrdersHtml = (data.recentOrders || []).length
      ? `
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-size:14px;">
          <thead>
            <tr>
              <th align="left">Pedido</th>
              <th align="left">Status</th>
              <th align="left">Data</th>
              <th align="left">Livro</th>
            </tr>
          </thead>
          <tbody>
            ${(data.recentOrders || [])
              .map((o) => {
                return `
                  <tr>
                    <td>${escapeHtml(String(o.id || ""))}</td>
                    <td>${escapeHtml(String(o.status || ""))}</td>
                    <td>${escapeHtml(String(o.created_at || ""))}</td>
                    <td>${escapeHtml(String(o.book_id || ""))}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      `
      : `<div>Nenhum pedido recente encontrado.</div>`;

    const recentBooksHtml = (data.recentBooks || []).length
      ? `
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-size:14px;">
          <thead>
            <tr>
              <th align="left">Livro</th>
              <th align="left">Status</th>
              <th align="left">Criança</th>
              <th align="left">Tema</th>
            </tr>
          </thead>
          <tbody>
            ${(data.recentBooks || [])
              .map((b) => {
                return `
                  <tr>
                    <td>${escapeHtml(String(b.id || ""))}</td>
                    <td>${escapeHtml(String(b.status || ""))}</td>
                    <td>${escapeHtml(String(b.child_name || ""))}</td>
                    <td>${escapeHtml(String(b.theme || ""))}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      `
      : `<div>Nenhum livro recente encontrado.</div>`;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif; color:#111; line-height:1.6; font-size:14px;">
        <h2 style="margin:0 0 14px;">Solicitação de saque de moedas</h2>

        <p>Um usuário solicitou saque na plataforma.</p>

        <h3>Dados principais</h3>
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-size:14px;">
          <tbody>
            <tr><td><b>Nome</b></td><td>${escapeHtml(data.name)}</td></tr>
            <tr><td><b>E-mail</b></td><td>${escapeHtml(data.email)}</td></tr>
            <tr><td><b>User ID</b></td><td>${escapeHtml(data.userId)}</td></tr>
            <tr><td><b>Valor solicitado</b></td><td>${escapeHtml(data.requestedAmountFormatted)}</td></tr>
            <tr><td><b>Saldo disponível</b></td><td>${escapeHtml(data.walletAvailableFormatted)}</td></tr>
            <tr><td><b>Chave PIX</b></td><td>${escapeHtml(data.pixKey)}</td></tr>
            <tr><td><b>Tipo da chave PIX</b></td><td>${escapeHtml(data.pixType)}</td></tr>
            <tr><td><b>Titular</b></td><td>${escapeHtml(data.pixHolderName)}</td></tr>
            <tr><td><b>Instituição</b></td><td>${escapeHtml(data.pixBankName)}</td></tr>
            <tr><td><b>Documento do titular</b></td><td>${escapeHtml(data.pixHolderDocument)}</td></tr>
            <tr><td><b>Telefone</b></td><td>${escapeHtml(data.phone || "—")}</td></tr>
            <tr><td><b>Endereço</b></td><td>${escapeHtml(
              [
                data.addressStreet,
                data.addressNumber,
                data.addressDistrict,
                data.addressCity,
                data.addressState,
                data.addressZip,
                data.addressComplement,
              ]
                .filter(Boolean)
                .join(" | ") || "—"
            )}</td></tr>
            <tr><td><b>Observação</b></td><td>${escapeHtml(data.note || "—")}</td></tr>
            <tr><td><b>Gerado em</b></td><td>${escapeHtml(data.generatedAt)}</td></tr>
          </tbody>
        </table>

        <h3 style="margin-top:20px;">Carteira</h3>
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-size:14px;">
          <tbody>
            <tr><td><b>Moedas vindas de pedidos</b></td><td>${escapeHtml(data.baseCoinsFormatted)}</td></tr>
            <tr><td><b>Moedas extras</b></td><td>${escapeHtml(data.bonusCoinsFormatted)}</td></tr>
            <tr><td><b>Moedas adicionadas</b></td><td>${escapeHtml(data.purchasedCoinsFormatted)}</td></tr>
            <tr><td><b>Moedas já sacadas</b></td><td>${escapeHtml(data.withdrawnCoinsFormatted)}</td></tr>
            <tr><td><b>Saldo disponível atual</b></td><td>${escapeHtml(data.walletAvailableFormatted)}</td></tr>
          </tbody>
        </table>

        <h3 style="margin-top:20px;">Atividade da conta</h3>
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-size:14px;">
          <tbody>
            <tr><td><b>Nível atual</b></td><td>${escapeHtml(data.levelIcon + " " + data.levelName)}</td></tr>
            <tr><td><b>Progresso do nível</b></td><td>${escapeHtml(String(data.levelPct) + "%")}</td></tr>
            <tr><td><b>Próximo nível</b></td><td>${escapeHtml(data.nextLevelName)}</td></tr>
            <tr><td><b>Meta do próximo nível</b></td><td>${escapeHtml(String(data.nextLevelAt))}</td></tr>
            <tr><td><b>Pedidos concluídos</b></td><td>${escapeHtml(String(data.completedOrders))}</td></tr>
            <tr><td><b>Total de pedidos</b></td><td>${escapeHtml(String(data.totalOrders))}</td></tr>
            <tr><td><b>Total de livros</b></td><td>${escapeHtml(String(data.totalBooks))}</td></tr>
            <tr><td><b>Sequência de check-in</b></td><td>${escapeHtml(String(data.streakDays) + " dia(s)")}</td></tr>
            <tr><td><b>Ciclo atual</b></td><td>${escapeHtml(String(data.cycleCount) + " / 7")}</td></tr>
            <tr><td><b>Último check-in</b></td><td>${escapeHtml(data.lastCheckinDate || "—")}</td></tr>
          </tbody>
        </table>

        <h3 style="margin-top:20px;">Últimos pedidos</h3>
        ${recentOrdersHtml}

        <h3 style="margin-top:20px;">Últimos livros</h3>
        ${recentBooksHtml}

        <h3 style="margin-top:20px;">Perfil bruto</h3>
        <pre style="white-space:pre-wrap; word-break:break-word; background:#f8fafc; border:1px solid #e5e7eb; padding:12px; border-radius:8px;">${escapeHtml(
          JSON.stringify(data.profileRaw || {}, null, 2)
        )}</pre>
      </div>
    `;

    const text = [
      "Solicitação de saque de moedas",
      "",
      `Nome: ${data.name}`,
      `E-mail: ${data.email}`,
      `User ID: ${data.userId}`,
      `Valor solicitado: ${data.requestedAmountFormatted}`,
      `Saldo disponível: ${data.walletAvailableFormatted}`,
      `Chave PIX: ${data.pixKey}`,
      `Tipo PIX: ${data.pixType}`,
      `Titular PIX: ${data.pixHolderName}`,
      `Instituição: ${data.pixBankName}`,
      `Documento titular: ${data.pixHolderDocument}`,
      `Telefone: ${data.phone || "—"}`,
      `Endereço: ${
        [
          data.addressStreet,
          data.addressNumber,
          data.addressDistrict,
          data.addressCity,
          data.addressState,
          data.addressZip,
          data.addressComplement,
        ]
          .filter(Boolean)
          .join(" | ") || "—"
      }`,
      `Observação: ${data.note || "—"}`,
      "",
      `Nível: ${data.levelIcon} ${data.levelName}`,
      `Progresso do nível: ${data.levelPct}%`,
      `Pedidos concluídos: ${data.completedOrders}`,
      `Total de pedidos: ${data.totalOrders}`,
      `Total de livros: ${data.totalBooks}`,
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

  app.get("/api/me", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");
      const email = String(req.user?.email || "");

      if (!userId) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

      let profile = null;

      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("id, name, created_at, updated_at")
          .eq("id", userId)
          .maybeSingle();

        if (!error && data) profile = data;
      }

      return res.json({
        ok: true,
        user: { id: userId, email },
        profile,
        server_time: new Date().toISOString(),
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  app.get("/api/my-books", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");

      if (!userId) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .json({ ok: false, error: "supabase_client_missing" });
      }

      const { data, error } = await supabaseAdmin
        .from("books")
        .select(
          "id, status, step, error, theme, style, child_name, child_age, child_gender, pdf_url, updated_at, created_at"
        )
        .eq("user_id", userId)
        .eq("status", "done")
        .order("updated_at", { ascending: false })
        .limit(120);

      if (error) throw error;

      return res.json({
        ok: true,
        items: Array.isArray(data) ? data : [],
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  app.get("/api/my-orders", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");

      if (!userId) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .json({ ok: false, error: "supabase_client_missing" });
      }

      const { data, error } = await supabaseAdmin
        .from("orders")
        .select(`
          id,
          created_at,
          status,
          order_data,
          book_id
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(120);

      if (error) throw error;

      return res.json({
        ok: true,
        items: Array.isArray(data) ? data : [],
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  app.get("/api/my-wallet", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");

      if (!userId) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .json({ ok: false, error: "supabase_client_missing" });
      }

      const summary = await getMyWalletSummary(userId);
      const profile = await getProfileByUserId(userId);
      const pix = getProfilePixInfo(profile || {});

      return res.json({
        ok: true,
        wallet: summary.wallet,
        level: summary.level,
        levelProgress: summary.progress,
        completedOrders: summary.completedOrders,
        baseCoins: summary.baseCoins,
        availableCoins: summary.available,
        activities: summary.activities,
        hasPixKey: pix.isComplete,
        pixSummary: {
          hasPixKey: pix.isComplete,
          pix_type: pix.type || "",
          pix_key_masked: pix.key
            ? pix.type === "email"
              ? pix.key.replace(/^(.{2}).*(@.*)$/, "$1***$2")
              : pix.key.slice(0, 4) + "***"
            : "",
          pix_holder_name: pix.holderName || "",
          pix_bank_name: pix.bankName || "",
          pix_holder_document_masked: pix.holderDocument
            ? pix.holderDocument.slice(0, 3) + "***"
            : "",
        },
        nextCheckinReward:
          Number(summary.wallet?.streak_days || 0) >= 3
            ? summary.level.checkinBoost
            : summary.level.checkinBase,
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  app.post("/api/my-wallet/checkin", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");

      if (!userId) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .json({ ok: false, error: "supabase_client_missing" });
      }

      const wallet = await ensureUserWallet(userId);
      const completedOrders = await countCompletedUserOrders(userId);
      const level = getUserLevelByOrders(completedOrders);

      const today = ymdLocal(new Date());
      const last = wallet?.last_checkin_date
        ? ymdLocal(new Date(wallet.last_checkin_date))
        : null;

      if (last === today) {
        return res
          .status(400)
          .json({ ok: false, error: "checkin_already_done_today" });
      }

      let streak = toNum(wallet?.streak_days, 0);

      if (last) {
        const diff = daysDiff(new Date(today), new Date(last));
        if (diff === 1) streak += 1;
        else streak = 1;
      } else {
        streak = 1;
      }

      let cycleCount = toNum(wallet?.cycle_count, 0);
      cycleCount += 1;

      const reward = streak >= 3 ? level.checkinBoost : level.checkinBase;

      let nextCycleCount = cycleCount;
      let nextStreak = streak;

      if (cycleCount >= 7) {
        nextCycleCount = 0;
        nextStreak = 0;
      }

      const nextBonus = toNum(wallet?.bonus_coins, 0) + reward;

      const { data: updated, error: updErr } = await supabaseAdmin
        .from("user_wallets")
        .update({
          bonus_coins: nextBonus,
          streak_days: nextStreak,
          cycle_count: nextCycleCount,
          last_checkin_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (updErr) throw updErr;

      await addWalletActivity(userId, {
        type: "checkin",
        title: "Check-in diário",
        amount: reward,
        meta: `Recompensa diária do usuário (${level.name})`,
      });

      const summary = await getMyWalletSummary(userId);

      return res.json({
        ok: true,
        reward,
        wallet: updated,
        availableCoins: summary.available,
        level: summary.level,
        levelProgress: summary.progress,
        activities: summary.activities,
        nextCheckinReward:
          Number(updated?.streak_days || 0) >= 3
            ? summary.level.checkinBoost
            : summary.level.checkinBase,
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  app.post("/api/my-wallet/withdraw", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");
      const userEmail = String(req.user?.email || "");

      if (!userId) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .json({ ok: false, error: "supabase_client_missing" });
      }

      const amount = clamp(toNum(req.body?.amount, 0), 0, 9999999);
      const note = String(req.body?.note || "").trim();

      if (amount <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_amount" });
      }

      const summaryBefore = await getMyWalletSummary(userId);
      if (amount > summaryBefore.available) {
        return res
          .status(400)
          .json({ ok: false, error: "insufficient_balance" });
      }

      const currentProfile = await getProfileByUserId(userId);
      const currentPix = getProfilePixInfo(currentProfile || {});

      if (!currentPix.isComplete) {
        const pixCheck = validatePixFields({
          pix_key: req.body?.pix_key,
          pix_type: req.body?.pix_type,
          pix_holder_name: req.body?.pix_holder_name,
          pix_bank_name: req.body?.pix_bank_name,
          pix_holder_document: req.body?.pix_holder_document,
        });

        if (!pixCheck.ok) {
          return res.status(400).json({ ok: false, error: pixCheck.error });
        }

        const mergedProfilePayload = buildProfileUpdatePayloadFromInput(
          {
            pix_key: pixCheck.data.pix_key,
            pix_type: pixCheck.data.pix_type,
            pix_holder_name: pixCheck.data.pix_holder_name,
            pix_bank_name: pixCheck.data.pix_bank_name,
            pix_holder_document: pixCheck.data.pix_holder_document,
          },
          currentProfile || {}
        );

        await upsertUserProfile(userId, mergedProfilePayload);
      }

      const wallet = await ensureUserWallet(userId);
      const nextWithdrawn = toNum(wallet.withdrawn_coins, 0) + amount;

      const { data: updated, error: updErr } = await supabaseAdmin
        .from("user_wallets")
        .update({
          withdrawn_coins: nextWithdrawn,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (updErr) throw updErr;

      await addWalletActivity(userId, {
        type: "withdraw",
        title: "Solicitação de saque",
        amount: -amount,
        meta: note || "Saque solicitado pelo usuário",
      });

      try {
        const adminData = await getUserFullAdminData(
          userId,
          userEmail,
          amount,
          note
        );
        const mailPayload = buildWithdrawAdminEmail(adminData);
        const mailResult = await sendAdminEmail(mailPayload);

        if (!mailResult?.ok) {
          console.error(
            "[profile] falha ao enviar email de saque para admin:",
            mailResult?.error || mailResult
          );
        } else {
          console.log(
            "[profile] email de saque enviado para admins:",
            parseAdminEmails().join(", ")
          );
        }
      } catch (mailErr) {
        console.error(
          "[profile] erro ao preparar/enviar email de saque:",
          mailErr?.message || mailErr
        );
      }

      const summary = await getMyWalletSummary(userId);
      const profileAfter = await getProfileByUserId(userId);
      const pixAfter = getProfilePixInfo(profileAfter || {});

      return res.json({
        ok: true,
        wallet: updated,
        availableCoins: summary.available,
        activities: summary.activities,
        hasPixKey: pixAfter.isComplete,
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  app.post("/api/my-wallet/buy", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");
      const userEmail = String(req.user?.email || "").trim().toLowerCase();

      if (!userId) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .json({ ok: false, error: "supabase_client_missing" });
      }

      const pack = clamp(toNum(req.body?.pack, 0), 0, 9999999);
      const allowed = [10, 25, 50, 100];

      if (!allowed.includes(pack)) {
        return res
          .status(400)
          .json({ ok: false, error: "invalid_pack_option" });
      }

      const completedOrders = await countCompletedUserOrders(userId);
      const level = getUserLevelByOrders(completedOrders);

      const bonus = Number((pack * level.buyBonusPct).toFixed(2));
      const credit = Number((pack + bonus).toFixed(2));
      const price = Number(pack.toFixed ? pack.toFixed(2) : pack);

      const externalReference = `coin_${userId}_${pack}_${Date.now()}`;

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("coin_orders")
        .insert({
          user_id: userId,
          pack,
          price_amount: price,
          bonus_coins: bonus,
          credit_coins: credit,
          currency: "BRL",
          status: "pending",
          customer_email: userEmail || null,
          metadata: {
            source: "profile_wallet_buy",
            level_key: level.key,
            level_name: level.name,
            buy_bonus_pct: level.buyBonusPct,
            created_from: "/profile",
          },
          mercadopago_external_reference: externalReference,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      return res.json({
        ok: true,
        orderId: inserted.id,
        checkoutUrl: "/checkout/coins?order=" + encodeURIComponent(inserted.id),
      });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: String(e?.message || e || "Erro"),
      });
    }
  });

  app.get("/api/my-account", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");
      const sessionEmail = normalizeEmail(req.user?.email || "");

      if (!userId) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .json({ ok: false, error: "supabase_client_missing" });
      }

      const rawProfile = await getProfileByUserId(userId);
      const profile = normalizeProfileRow({
        ...(rawProfile || {}),
        email: sessionEmail || rawProfile?.email || "",
      });
      const pix = getProfilePixInfo(profile);

      return res.json({
        ok: true,
        account: {
          id: userId,
          email: sessionEmail || profile.email || "",
          name: profile.name || "",
          phone: profile.phone || "",
          pix_key: profile.pix_key || "",
          pix_type: profile.pix_type || "",
          pix_holder_name: profile.pix_holder_name || "",
          pix_bank_name: profile.pix_bank_name || "",
          pix_holder_document: profile.pix_holder_document || "",
          address_street: profile.address_street || "",
          address_number: profile.address_number || "",
          address_district: profile.address_district || "",
          address_city: profile.address_city || "",
          address_state: profile.address_state || "",
          address_zip: profile.address_zip || "",
          address_complement: profile.address_complement || "",
          has_pix_key: pix.isComplete,
          created_at: profile.created_at || "",
          updated_at: profile.updated_at || "",
        },
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  app.post("/api/my-account/verify-password", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");
      const email = normalizeEmail(req.user?.email || "");
      const password = String(req.body?.password || "");

      if (!userId) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

      if (!password) {
        return res.status(400).json({ ok: false, error: "password_required" });
      }

      const verified = await verifyCurrentPassword(email, password);
      if (!verified.ok) {
        return res.status(400).json({ ok: false, error: verified.error });
      }

      return res.json({ ok: true });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  app.post("/api/my-account/update", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "");
      const sessionEmail = normalizeEmail(req.user?.email || "");
      const currentPassword = String(req.body?.current_password || "");
      const nextPassword = String(req.body?.new_password || "");
      const nextEmail = normalizeEmail(req.body?.email || sessionEmail);

      if (!userId) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

      if (!supabaseAdmin) {
        return res
          .status(500)
          .json({ ok: false, error: "supabase_client_missing" });
      }

      if (!currentPassword) {
        return res
          .status(400)
          .json({ ok: false, error: "current_password_required" });
      }

      const verified = await verifyCurrentPassword(sessionEmail, currentPassword);
      if (!verified.ok) {
        return res.status(400).json({ ok: false, error: verified.error });
      }

      if (!isValidEmail(nextEmail)) {
        return res.status(400).json({ ok: false, error: "invalid_email" });
      }

      if (nextPassword && String(nextPassword).length < 6) {
        return res
          .status(400)
          .json({ ok: false, error: "password_too_short" });
      }

      const currentProfile = await getProfileByUserId(userId);
      const profilePayload = buildProfileUpdatePayloadFromInput(
        {
          name: req.body?.name,
          email: nextEmail,
          phone: req.body?.phone,

          pix_key: req.body?.pix_key,
          pix_type: req.body?.pix_type,
          pix_holder_name: req.body?.pix_holder_name,
          pix_bank_name: req.body?.pix_bank_name,
          pix_holder_document: req.body?.pix_holder_document,

          address_street: req.body?.address_street,
          address_number: req.body?.address_number,
          address_district: req.body?.address_district,
          address_city: req.body?.address_city,
          address_state: req.body?.address_state,
          address_zip: req.body?.address_zip,
          address_complement: req.body?.address_complement,
        },
        currentProfile || {}
      );

      const hasAnyPixField =
        !!profilePayload.pix_key ||
        !!profilePayload.pix_type ||
        !!profilePayload.pix_holder_name ||
        !!profilePayload.pix_bank_name ||
        !!profilePayload.pix_holder_document;

      if (hasAnyPixField) {
        const pixCheck = validatePixFields(profilePayload);
        if (!pixCheck.ok) {
          return res.status(400).json({ ok: false, error: pixCheck.error });
        }

        profilePayload.pix_key = pixCheck.data.pix_key;
        profilePayload.pix_type = pixCheck.data.pix_type;
        profilePayload.pix_holder_name = pixCheck.data.pix_holder_name;
        profilePayload.pix_bank_name = pixCheck.data.pix_bank_name;
        profilePayload.pix_holder_document = pixCheck.data.pix_holder_document;
      }

      const authResult = await updateAuthIdentity(userId, {
        email: nextEmail !== sessionEmail ? nextEmail : "",
        password: nextPassword || "",
      });

      if (!authResult.ok) {
        return res.status(400).json({ ok: false, error: authResult.error });
      }

      const savedProfile = await upsertUserProfile(userId, profilePayload);
      const normalized = normalizeProfileRow(savedProfile || {});
      const pix = getProfilePixInfo(normalized);

      return res.json({
        ok: true,
        account: {
          id: userId,
          email: nextEmail,
          name: normalized.name || "",
          phone: normalized.phone || "",
          pix_key: normalized.pix_key || "",
          pix_type: normalized.pix_type || "",
          pix_holder_name: normalized.pix_holder_name || "",
          pix_bank_name: normalized.pix_bank_name || "",
          pix_holder_document: normalized.pix_holder_document || "",
          address_street: normalized.address_street || "",
          address_number: normalized.address_number || "",
          address_district: normalized.address_district || "",
          address_city: normalized.address_city || "",
          address_state: normalized.address_state || "",
          address_zip: normalized.address_zip || "",
          address_complement: normalized.address_complement || "",
          has_pix_key: pix.isComplete,
          created_at: normalized.created_at || "",
          updated_at: normalized.updated_at || "",
        },
        email_changed: nextEmail !== sessionEmail,
        password_changed: !!nextPassword,
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  app.get("/profile", requireAuth, async (req, res) => {
    try {
      const email = escapeHtml(req.user?.email || "");

      const html = renderProfilePage({
        email,
        pageCss: PROFILE_PAGE_CSS(),
        pageJs: buildProfilePageJS(),
      });

      res.type("html").send(html);
    } catch (e) {
      res
        .status(500)
        .type("html")
        .send(
          `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Erro</title></head><body><pre>${escapeHtml(
            String(e?.message || e || "Erro ao renderizar /profile")
          )}</pre></body></html>`
        );
    }
  });
};