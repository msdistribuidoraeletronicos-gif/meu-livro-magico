// api/checkout.js
"use strict";

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function cleanDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

function cleanPhone(s) {
  return cleanDigits(s);
}

function cleanCep(s) {
  return cleanDigits(s).slice(0, 8);
}

function normUF(s) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
}

function isValidEmail(email) {
  const s = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function toMoney(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function safeJsonStringify(v) {
  try {
    return JSON.stringify(v ?? {});
  } catch {
    return "{}";
  }
}

function normalizePartnerRef(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  try {
    return JSON.stringify(v);
  } catch {
    return String(v || "").trim();
  }
}

function normalizeAddress(address) {
  const a = address || {};
  return {
    cep: cleanCep(a.cep),
    uf: normUF(a.uf),
    street: String(a.street || "").trim(),
    number: String(a.number || "").trim(),
    comp: String(a.comp || "").trim(),
    district: String(a.district || "").trim(),
    city: String(a.city || "").trim(),
    ref: String(a.ref || "").trim(),
  };
}

function hasMinAddress(address) {
  if (!address || typeof address !== "object") return false;
  return !!(
    String(address.street || "").trim() &&
    String(address.number || "").trim() &&
    String(address.district || "").trim() &&
    String(address.city || "").trim() &&
    normUF(address.uf).length === 2 &&
    cleanCep(address.cep).length === 8
  );
}

function getPaymentReference(payload) {
  return String(
    payload.paymentReference ||
      payload.payment_reference ||
      payload.paymentId ||
      payload.payment_id ||
      payload.mercadopagoPaymentId ||
      payload.mercadopago_payment_id ||
      payload.mercadopagoReferenceId ||
      payload.mercadopago_reference_id ||
      payload.pagbankReferenceId ||
      payload.pagbank_reference_id ||
      payload.pagbankOrderId ||
      payload.pagbank_order_id ||
      payload.pagbankChargeId ||
      payload.pagbank_charge_id ||
      ""
  ).trim();
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "").trim()
  );
}

function isNumericId(v) {
  return /^\d+$/.test(String(v || "").trim());
}

async function findLatestByField(table, field, value) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq(field, value)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function findSingleByField(table, field, value) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq(field, value)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function findPaymentByReference(paymentReference) {
  const ref = String(paymentReference || "").trim();
  if (!ref) return null;

  let payment = null;

  payment = await findLatestByField("payments", "mercadopago_reference_id", ref);
  if (payment) return payment;

  payment = await findLatestByField("payments", "mercadopago_external_reference", ref);
  if (payment) return payment;

  payment = await findLatestByField("payments", "pagbank_reference_id", ref);
  if (payment) return payment;

  payment = await findLatestByField("payments", "pagbank_order_id", ref);
  if (payment) return payment;

  payment = await findLatestByField("payments", "pagbank_charge_id", ref);
  if (payment) return payment;

  if (isNumericId(ref)) {
    payment = await findLatestByField("payments", "mercadopago_payment_id", ref);
    if (payment) return payment;
  }

  if (isUuid(ref)) {
    payment = await findSingleByField("payments", "id", ref);
    if (payment) return payment;
  }

  return null;
}

function isPaidStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  return ["paid", "approved", "completed"].includes(s);
}

async function rollbackOrderAndPartnerOrders(orderId) {
  if (!orderId) return;

  try {
    await supabase.from("partner_orders").delete().eq("order_id", String(orderId));
  } catch (e) {
    console.error("[checkout] Falha ao remover partner_orders no rollback:", e);
  }

  try {
    await supabase.from("orders").delete().eq("id", orderId);
  } catch (e) {
    console.error("[checkout] Falha ao remover order no rollback:", e);
  }
}

async function ensureUserWallet(userId) {
  const { data: existing, error: findErr } = await supabase
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("user_wallets")
    .insert(payload)
    .select("*")
    .single();

  if (insertErr) throw insertErr;
  return inserted;
}

async function getWalletBaseCoinsFromOrders(userId) {
  const paidStatuses = ["paid", "shipped", "delivered", "finalizado", "done"];

  const { data, error } = await supabase
    .from("orders")
    .select("status, order_data")
    .eq("user_id", userId)
    .in("status", paidStatuses)
    .limit(1000);

  if (error) throw error;

  let total = 0;
  for (const row of data || []) {
    const od = row?.order_data || {};
    total += toMoney(od.wallet_bonus_coins || 0);
  }

  return toMoney(total);
}

async function getUserWalletAvailableCoins(userId) {
  const wallet = await ensureUserWallet(userId);
  const baseCoins = await getWalletBaseCoinsFromOrders(userId);

  const available = toMoney(
    baseCoins +
      toMoney(wallet.bonus_coins) +
      toMoney(wallet.purchased_coins) -
      toMoney(wallet.withdrawn_coins)
  );

  return {
    wallet,
    baseCoins,
    available: Math.max(0, available),
  };
}

async function addWalletActivity(userId, payload = {}) {
  const row = {
    user_id: userId,
    type: String(payload.type || "adjustment"),
    title: String(payload.title || "Movimentação"),
    amount: toMoney(payload.amount || 0),
    meta: payload.meta != null ? String(payload.meta) : null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_wallet_activities")
    .insert(row)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

async function consumeWalletCoins(userId, amount, context = {}) {
  const amt = toMoney(amount);
  if (!userId || amt <= 0) return null;

  const snapshot = await getUserWalletAvailableCoins(userId);
  if (snapshot.available < amt) {
    throw new Error("Saldo de moedas insuficiente para concluir este pedido.");
  }

  const previousWithdrawn = toMoney(snapshot.wallet.withdrawn_coins || 0);
  const nextWithdrawn = toMoney(previousWithdrawn + amt);
  const nowIso = new Date().toISOString();

  const { data: updatedWallet, error: updErr } = await supabase
    .from("user_wallets")
    .update({
      withdrawn_coins: nextWithdrawn,
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (updErr) throw updErr;

  const activity = await addWalletActivity(userId, {
    type: "adjustment",
    title: "Uso de moedas no checkout",
    amount: -amt,
    meta:
      context?.orderId
        ? `Pedido ${context.orderId}`
        : context?.bookId
        ? `Livro ${context.bookId}`
        : "Desconto aplicado na compra",
  });

  return {
    userId,
    previousWithdrawn,
    updatedWallet,
    activityId: activity?.id || null,
  };
}

async function rollbackWalletConsumption(change) {
  if (!change || !change.userId) return;

  try {
    await supabase
      .from("user_wallets")
      .update({
        withdrawn_coins: toMoney(change.previousWithdrawn || 0),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", change.userId);
  } catch (e) {
    console.error("[checkout] Falha ao restaurar carteira no rollback:", e);
  }

  if (change.activityId) {
    try {
      await supabase.from("user_wallet_activities").delete().eq("id", change.activityId);
    } catch (e) {
      console.error("[checkout] Falha ao remover activity da carteira no rollback:", e);
    }
  }
}

module.exports = async (req, res) => {
  console.log("[checkout] ========= NOVA REQUISIÇÃO =========");
  console.log("[checkout] Método:", req.method);
  console.log("[checkout] URL:", req.url);
  console.log("[checkout] Body recebido:", JSON.stringify(req.body, null, 2));

  if (req.method !== "POST") {
    console.log("[checkout] Método não permitido, retornando 405");
    return res.status(405).json({ error: "Método não permitido" });
  }

  let mainOrderId = null;
  let walletConsumption = null;

  try {
    const payload = req.body || {};

    const {
      bookId,
      name,
      whatsapp,
      email,
      address,
      pack,
      giftwrap,
      total,
      subtotalBeforeCoins,
      usedWalletCoins,
      obs,
      partnerRef,
    } = payload;

    const paymentReference = getPaymentReference(payload);

    const normalized = {
      bookId: String(bookId || "").trim(),
      name: String(name || "").trim(),
      whatsapp: cleanPhone(whatsapp),
      email: String(email || "").trim().toLowerCase(),
      address: normalizeAddress(address),
      pack: String(pack || "").trim(),
      giftwrap: !!giftwrap,
      subtotalBeforeCoins: toMoney(subtotalBeforeCoins),
      usedWalletCoins: toMoney(usedWalletCoins),
      total: toMoney(total),
      obs: String(obs || "").trim(),
      partnerRef: normalizePartnerRef(partnerRef),
      paymentReference,
    };

    if (
      !normalized.bookId ||
      !normalized.name ||
      !normalized.whatsapp ||
      !normalized.email ||
      !normalized.address
    ) {
      console.log("[checkout] Dados incompletos:", normalized);
      return res.status(400).json({ error: "Dados incompletos" });
    }

    if (normalized.name.length < 2) {
      return res.status(400).json({ error: "Nome inválido" });
    }

    if (normalized.whatsapp.length < 10) {
      return res.status(400).json({ error: "WhatsApp inválido" });
    }

    if (!isValidEmail(normalized.email)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    if (!hasMinAddress(normalized.address)) {
      console.log("[checkout] Endereço inválido:", normalized.address);
      return res.status(400).json({
        error: "Endereço incompleto. Preencha CEP, Rua, Número, Bairro, Cidade e UF.",
      });
    }

    if (!normalized.pack) {
      return res.status(400).json({ error: "Opção do pedido não informada" });
    }

    if (normalized.subtotalBeforeCoins < 0) {
      return res.status(400).json({ error: "Subtotal inválido" });
    }

    if (normalized.usedWalletCoins < 0) {
      return res.status(400).json({ error: "Uso de moedas inválido" });
    }

    if (normalized.total < 0) {
      return res.status(400).json({ error: "Total inválido" });
    }

    const expectedTotal = toMoney(normalized.subtotalBeforeCoins - normalized.usedWalletCoins);
    if (expectedTotal !== normalized.total) {
      console.log("[checkout] Divergência subtotal/moedas/total:", {
        subtotalBeforeCoins: normalized.subtotalBeforeCoins,
        usedWalletCoins: normalized.usedWalletCoins,
        total: normalized.total,
        expectedTotal,
      });
      return res.status(400).json({
        error: "Os valores do checkout não conferem.",
      });
    }

    if (!normalized.paymentReference) {
      return res.status(400).json({
        error: "Pagamento não informado. Gere e pague o PIX antes de finalizar o pedido.",
      });
    }

    console.log("[checkout] Dados básicos validados com sucesso");

    const { data: book, error: bookErr } = await supabase
      .from("books")
      .select("id, user_id, child_name, theme, style")
      .eq("id", normalized.bookId)
      .maybeSingle();

    if (bookErr) {
      console.error("[checkout] Erro ao buscar livro:", bookErr);
      return res.status(500).json({ error: "Erro ao validar livro" });
    }

    if (!book) {
      console.log("[checkout] Livro não encontrado:", normalized.bookId);
      return res.status(404).json({ error: "Livro não encontrado" });
    }

    if (normalized.usedWalletCoins > 0) {
      if (!book.user_id) {
        return res.status(400).json({
          error: "Este livro não possui usuário vinculado para uso de moedas.",
        });
      }

      const walletSummary = await getUserWalletAvailableCoins(book.user_id);
      if (walletSummary.available < normalized.usedWalletCoins) {
        return res.status(400).json({
          error: "Saldo de moedas insuficiente para concluir esta compra.",
        });
      }
    }

    console.log("[checkout] Validando pagamento:", normalized.paymentReference);

    let payment = null;
    try {
      payment = await findPaymentByReference(normalized.paymentReference);
    } catch (paymentErr) {
      console.error("[checkout] Erro ao buscar pagamento:", paymentErr);
      return res.status(500).json({ error: "Erro ao validar pagamento" });
    }

    if (!payment) {
      console.log("[checkout] Pagamento não encontrado");
      return res.status(400).json({
        error: "Pagamento não localizado. Gere o PIX novamente e conclua o pagamento.",
      });
    }

    const paymentStatus = String(payment.status || "").toLowerCase();
    const providerStatus = String(
      payment.mercadopago_status || payment.pagbank_status || ""
    ).toLowerCase();

    if (!isPaidStatus(paymentStatus) && !isPaidStatus(providerStatus)) {
      console.log("[checkout] Pagamento ainda não confirmado:", {
        paymentStatus,
        providerStatus,
      });
      return res.status(400).json({
        error: "Pagamento ainda não foi confirmado.",
      });
    }

    if (payment.consumed_at) {
      console.log("[checkout] Pagamento já consumido:", payment.id);
      return res.status(400).json({
        error: "Este pagamento já foi utilizado para criar um pedido.",
      });
    }

    if (String(payment.book_id || "") !== normalized.bookId) {
      console.log("[checkout] Pagamento não pertence ao livro informado");
      return res.status(400).json({
        error: "O pagamento informado não pertence a este livro.",
      });
    }

    const paymentAmount = toMoney(payment.amount);
    if (paymentAmount !== normalized.total) {
      console.log("[checkout] Divergência de valor:", {
        pagamento: paymentAmount,
        pedido: normalized.total,
      });
      return res.status(400).json({
        error: "O valor do pagamento é diferente do valor do pedido.",
      });
    }

    const paymentMeta = payment.metadata || {};
    const paymentUsedWalletCoins = toMoney(paymentMeta.used_wallet_coins || 0);
    if (paymentUsedWalletCoins !== normalized.usedWalletCoins) {
      console.log("[checkout] Divergência de moedas entre payments e checkout:", {
        paymentUsedWalletCoins,
        checkoutUsedWalletCoins: normalized.usedWalletCoins,
      });
      return res.status(400).json({
        error: "As moedas informadas no pagamento não conferem com o checkout.",
      });
    }

    if (payment.customer_email) {
      const pEmail = String(payment.customer_email || "").trim().toLowerCase();
      if (pEmail && pEmail !== normalized.email) {
        console.log("[checkout] Email do pagamento diferente do pedido:", {
          paymentEmail: pEmail,
          checkoutEmail: normalized.email,
        });
        return res.status(400).json({
          error: "O email do pagamento não confere com o email informado.",
        });
      }
    }

    const { data: existingOrder, error: existingOrderErr } = await supabase
      .from("orders")
      .select("id, status")
      .eq("payment_id", payment.id)
      .maybeSingle();

    if (existingOrderErr && existingOrderErr.code !== "PGRST116") {
      console.error("[checkout] Erro ao verificar pedido existente:", existingOrderErr);
      return res.status(500).json({ error: "Erro ao validar pedido existente" });
    }

    if (existingOrder) {
      console.log("[checkout] Já existe pedido para este pagamento:", existingOrder.id);
      return res.status(200).json({
        ok: true,
        orderId: existingOrder.id,
        reused: true,
        status: existingOrder.status,
        message: "Pedido já existia para este pagamento",
      });
    }

    const nowIso = new Date().toISOString();

    const resolvedPaymentReference =
      payment.mercadopago_reference_id ||
      payment.mercadopago_external_reference ||
      payment.mercadopago_payment_id ||
      payment.pagbank_reference_id ||
      payment.pagbank_charge_id ||
      payment.pagbank_order_id ||
      normalized.paymentReference;

    const orderData = {
      childName: book.child_name || "",
      theme: book.theme || "",
      style: book.style || "",

      customer_name: normalized.name,
      customer_whatsapp: normalized.whatsapp,
      customer_email: normalized.email,
      customer_address: normalized.address,

      pack: normalized.pack,
      giftwrap: normalized.giftwrap,
      subtotalBeforeCoins: normalized.subtotalBeforeCoins,
      usedWalletCoins: normalized.usedWalletCoins,
      total: normalized.total,
      wallet_bonus_coins: 0,
      obs: normalized.obs,
      partner_ref: normalized.partnerRef || null,

      paymentProvider: payment.provider || "mercadopago",
      paymentMethod: payment.payment_method || "pix",
      paymentReference: resolvedPaymentReference,
    };

    console.log("[checkout] Inserindo pedido principal...");
    console.log("[checkout] orderInsert preview:", JSON.stringify({
      book_id: normalized.bookId,
      user_id: book.user_id || null,
      payment_id: payment.id,
      total: normalized.total,
      status: "para_aceitar",
      payment_provider: payment.provider || "mercadopago",
      payment_method: payment.payment_method || "pix",
      payment_status: paymentStatus || providerStatus || "paid",
      payment_reference: resolvedPaymentReference,
      order_data: orderData,
    }, null, 2));

    const orderInsert = {
      book_id: normalized.bookId,
      user_id: book.user_id || null,
      partner_id: null,

      order_data: orderData,
      status: "para_aceitar",
      created_at: nowIso,
      updated_at: nowIso,

      payment_id: payment.id,
      payment_provider: payment.provider || "mercadopago",
      payment_method: payment.payment_method || "pix",
      payment_status: paymentStatus || providerStatus || "paid",
      payment_reference: resolvedPaymentReference,
      total: normalized.total,
    };

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert(orderInsert)
      .select("id")
      .single();

    if (orderErr) {
      console.error("[checkout] Erro ao inserir pedido principal:");
      console.error(JSON.stringify(orderErr, null, 2));
      return res.status(500).json({
        error: "Erro ao salvar pedido",
        details: {
          message: orderErr.message || null,
          code: orderErr.code || null,
          hint: orderErr.hint || null,
          details: orderErr.details || null,
        },
      });
    }

    mainOrderId = order.id;
    console.log("[checkout] Pedido principal inserido com ID:", mainOrderId);

    if (normalized.usedWalletCoins > 0 && book.user_id) {
      walletConsumption = await consumeWalletCoins(book.user_id, normalized.usedWalletCoins, {
        orderId: mainOrderId,
        bookId: normalized.bookId,
      });
      console.log("[checkout] Moedas consumidas:", normalized.usedWalletCoins);
    }

    const cepCliente = normalized.address.cep;
    console.log("[checkout] Buscando parceiros de fabricação com CEP exato:", cepCliente);

    const { data: partners, error: pErr } = await supabase
      .from("partners")
      .select("id, fabricacao_por_pedido, entrega_por_pedido, cidade, cep")
      .eq("tipo", "fabricacao")
      .eq("cep", cepCliente);

    if (pErr) {
      console.error("[checkout] Erro ao buscar parceiros:", pErr);

      if (walletConsumption) await rollbackWalletConsumption(walletConsumption);
      await rollbackOrderAndPartnerOrders(mainOrderId);

      return res.status(500).json({
        error: "Erro ao buscar parceiros para o pedido",
      });
    }

    console.log("[checkout] Parceiros encontrados:", partners ? partners.length : 0);

    if (partners && partners.length > 0) {
      const partnerOrders = partners.map((p) => ({
        partner_id: p.id,
        tipo: "fabricacao",
        book_id: normalized.bookId || null,
        cliente_nome: normalized.name || null,
        cliente_cidade: normalized.address.city || null,
        cliente_endereco: safeJsonStringify(normalized.address || {}),
        valor_total: Number(normalized.total || 0),
        ganho_parceiro: 0,
        status: "para_aceitar",
        order_id: String(mainOrderId),
        created_at: nowIso,
        updated_at: nowIso,
      }));

      const { data: insData, error: insErr } = await supabase
        .from("partner_orders")
        .insert(partnerOrders)
        .select("id, partner_id, status");

      if (insErr) {
        console.error("[checkout] Erro ao criar pedidos para parceiros:");
        console.error(JSON.stringify(insErr, null, 2));

        if (walletConsumption) await rollbackWalletConsumption(walletConsumption);
        await rollbackOrderAndPartnerOrders(mainOrderId);

        return res.status(500).json({
          error: "Erro ao criar pedidos para parceiros",
          details: insErr.message || insErr,
        });
      }

      console.log("[checkout] Pedidos para parceiros criados com sucesso:", insData);
    } else {
      console.log("[checkout] Nenhum parceiro de fabricação encontrado para o CEP exato:", cepCliente);
      console.log("[checkout] Dica: confirme se partners.cep está salvo como 8 dígitos (ex: 00000000).");
    }

    console.log("[checkout] Marcando pagamento como consumido...");

    const { data: consumedPayment, error: consumeErr } = await supabase
      .from("payments")
      .update({
        order_id: mainOrderId,
        consumed_at: nowIso,
        updated_at: nowIso,
        metadata: {
          ...(payment.metadata || {}),
          checkout_finalized: true,
          checkout_finalized_at: nowIso,
          used_wallet_coins: normalized.usedWalletCoins,
          subtotal_before_coins: normalized.subtotalBeforeCoins,
          final_total: normalized.total,
        },
      })
      .eq("id", payment.id)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle();

    if (consumeErr) {
      console.error("[checkout] Erro ao marcar pagamento como consumido:", consumeErr);

      if (walletConsumption) await rollbackWalletConsumption(walletConsumption);
      await rollbackOrderAndPartnerOrders(mainOrderId);

      return res.status(500).json({
        error: "Erro ao finalizar o pagamento no checkout",
      });
    }

    if (!consumedPayment) {
      console.error("[checkout] Pagamento não pôde ser consumido (talvez já usado)");

      if (walletConsumption) await rollbackWalletConsumption(walletConsumption);
      await rollbackOrderAndPartnerOrders(mainOrderId);

      return res.status(400).json({
        error: "Este pagamento já foi utilizado ou não pôde ser finalizado.",
      });
    }

    console.log("[checkout] Resposta de sucesso enviada para o cliente");
    return res.status(201).json({
      ok: true,
      orderId: mainOrderId,
      message: "Pedido realizado com sucesso",
    });
  } catch (e) {
    console.error("[checkout] Erro interno no checkout. Stack trace:");
    console.error(e);

    if (walletConsumption) {
      await rollbackWalletConsumption(walletConsumption);
    }

    if (mainOrderId) {
      await rollbackOrderAndPartnerOrders(mainOrderId);
    }

    return res.status(500).json({
      error: e?.message || "Erro interno no servidor",
    });
  }
};