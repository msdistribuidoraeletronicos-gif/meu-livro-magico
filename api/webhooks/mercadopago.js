// api/webhooks/mercadopago.js
"use strict";

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const MP_ACCESS_TOKEN = String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();

function toIsoOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapMercadoPagoStatus(rawStatus) {
  const s = String(rawStatus || "").trim().toLowerCase();

  if (!s) return "pending";

  if (["approved", "paid", "completed"].includes(s)) return "paid";
  if (["pending", "in_process", "in_mediation", "authorized"].includes(s)) return "pending";
  if (["cancelled", "canceled"].includes(s)) return "cancelled";
  if (["rejected", "failed", "refused", "denied"].includes(s)) return "failed";
  if (["expired"].includes(s)) return "expired";

  return "pending";
}

function pickFirstNonEmpty(...values) {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function extractWebhookRefs(body) {
  return {
    eventType: pickFirstNonEmpty(
      body?.type,
      body?.topic,
      body?.action
    ),
    mercadopagoPaymentId: pickFirstNonEmpty(
      body?.data?.id,
      body?.resource?.id,
      body?.id
    ),
    mercadopagoReferenceId: pickFirstNonEmpty(
      body?.data?.reference_id,
      body?.reference_id
    ),
    mercadopagoExternalReference: pickFirstNonEmpty(
      body?.data?.external_reference,
      body?.external_reference
    )
  };
}

async function findPaymentByRefs(refs) {
  const candidates = [
    refs.mercadopagoPaymentId,
    refs.mercadopagoReferenceId,
    refs.mercadopagoExternalReference
  ].filter(Boolean);

  for (const ref of candidates) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .or([
        `mercadopago_payment_id.eq.${ref}`,
        `mercadopago_reference_id.eq.${ref}`,
        `mercadopago_external_reference.eq.${ref}`
      ].join(","))
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
  }

  return null;
}

async function findCoinOrderByRefs(refs) {
  const candidates = [
    refs.mercadopagoPaymentId,
    refs.mercadopagoReferenceId,
    refs.mercadopagoExternalReference
  ].filter(Boolean);

  for (const ref of candidates) {
    const { data, error } = await supabase
      .from("coin_orders")
      .select("*")
      .or([
        `mercadopago_payment_id.eq.${ref}`,
        `mercadopago_reference_id.eq.${ref}`,
        `mercadopago_external_reference.eq.${ref}`
      ].join(","))
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
  }

  return null;
}

async function ensureUserWallet(userId) {
  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (wallet) return wallet;

  const payload = {
    user_id: userId,
    bonus_coins: 0,
    purchased_coins: 0,
    withdrawn_coins: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: inserted } = await supabase
    .from("user_wallets")
    .insert(payload)
    .select("*")
    .single();

  return inserted;
}

async function addWalletActivity(userId, payload = {}) {
  const row = {
    user_id: userId,
    type: payload.type || "buy",
    title: payload.title || "Compra de moedas",
    amount: Number(payload.amount || 0),
    meta: payload.meta || null,
    created_at: new Date().toISOString()
  };

  await supabase.from("user_wallet_activities").insert(row);
}

async function applyCoinOrderCreditIfPaid(orderId) {

  const { data: order } = await supabase
    .from("coin_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return;

  const status = String(order.status || "").toLowerCase();

  if (status !== "paid") return;

  if (order.credited_at) {
    console.log("[coin credit] já creditado");
    return;
  }

  const wallet = await ensureUserWallet(order.user_id);

  const nextPurchased =
    Number(wallet.purchased_coins || 0) +
    Number(order.credit_coins || 0);

  const nowIso = new Date().toISOString();

  const { data: mark } = await supabase
    .from("coin_orders")
    .update({
      credited_at: nowIso,
      updated_at: nowIso
    })
    .eq("id", order.id)
    .is("credited_at", null)
    .select("id")
    .maybeSingle();

  if (!mark) {
    console.log("[coin credit] corrida detectada");
    return;
  }

  await supabase
    .from("user_wallets")
    .update({
      purchased_coins: nextPurchased,
      updated_at: nowIso
    })
    .eq("user_id", order.user_id);

  await addWalletActivity(order.user_id, {
    type: "buy",
    title: "Compra de moedas aprovada",
    amount: order.credit_coins,
    meta: "Pacote " + order.pack
  });

  console.log("[coin credit] moedas creditadas:", order.credit_coins);
}

async function fetchMercadoPagoPayment(paymentId) {
  const url = "https://api.mercadopago.com/v1/payments/" + encodeURIComponent(paymentId);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + MP_ACCESS_TOKEN,
      Accept: "application/json",
      "Content-Type": "application/json"
    }
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      json?.message ||
      json?.error ||
      json?.cause?.[0]?.description ||
      "Erro ao consultar pagamento no Mercado Pago"
    );
  }

  return json;
}

module.exports = async (req, res) => {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {

    const body = req.body || {};

    const refs = extractWebhookRefs(body);

    let payment = await findPaymentByRefs(refs);

    const paymentId =
      refs.mercadopagoPaymentId ||
      payment?.mercadopago_payment_id ||
      null;

    let mpPayment = null;

    if (paymentId) {
      mpPayment = await fetchMercadoPagoPayment(paymentId);
    }

    const rawStatus = mpPayment?.status || "";

    const finalStatus = mapMercadoPagoStatus(rawStatus);

    const paidAt = toIsoOrNull(mpPayment?.date_approved);

    let resolvedExternalReference =
      mpPayment?.external_reference ||
      payment?.mercadopago_external_reference ||
      null;

    if (!payment) {
      payment = await findPaymentByRefs({
        mercadopagoExternalReference: resolvedExternalReference
      });
    }

    if (!payment) {
      console.log("[webhook] payment não encontrado");
    }

    if (payment) {

      const updatePayload = {
        status: finalStatus,
        mercadopago_status: rawStatus,
        mercadopago_payment_id: mpPayment?.id,
        mercadopago_external_reference: resolvedExternalReference,
        provider_response: mpPayment,
        updated_at: new Date().toISOString()
      };

      if (paidAt && finalStatus === "paid") {
        updatePayload.paid_at = paidAt;
        updatePayload.approved_at = paidAt;
      }

      await supabase
        .from("payments")
        .update(updatePayload)
        .eq("id", payment.id);

      console.log("[webhook] payment atualizado:", finalStatus);
    }

const coinOrder = await findCoinOrderByRefs({
  mercadopagoPaymentId: mpPayment?.id || refs.mercadopagoPaymentId || null,
  mercadopagoReferenceId: refs.mercadopagoReferenceId || null,
  mercadopagoExternalReference: resolvedExternalReference || refs.mercadopagoExternalReference || null
});
    if (coinOrder) {

      const updateCoinPayload = {
        status: finalStatus,
        mercadopago_payment_id: mpPayment?.id,
        mercadopago_status: rawStatus,
        mercadopago_external_reference: resolvedExternalReference,
        updated_at: new Date().toISOString()
      };

      if (paidAt && finalStatus === "paid") {
        updateCoinPayload.paid_at = paidAt;
        updateCoinPayload.approved_at = paidAt;
      }

      await supabase
        .from("coin_orders")
        .update(updateCoinPayload)
        .eq("id", coinOrder.id);

      console.log("[webhook] coin_order atualizada:", finalStatus);

      if (finalStatus === "paid") {
        await applyCoinOrderCreditIfPaid(coinOrder.id);
      }

    }

    return res.status(200).json({
      ok: true,
      status: finalStatus
    });

  } catch (e) {

    console.error("[webhook] erro:", e);

    return res.status(500).json({
      error: e.message
    });

  }
};