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

async function ensureUserWallet(userId) {
  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (wallet) return wallet;

  const nowIso = new Date().toISOString();

  const payload = {
    user_id: userId,
    bonus_coins: 0,
    purchased_coins: 0,
    withdrawn_coins: 0,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data: inserted, error } = await supabase
    .from("user_wallets")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return inserted;
}

async function addWalletActivity(userId, payload = {}) {
  const row = {
    user_id: userId,
    type: payload.type || "buy",
    title: payload.title || "Compra de moedas",
    amount: Number(payload.amount || 0),
    meta: payload.meta || null,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("user_wallet_activities").insert(row);
  if (error) throw error;
}

async function applyCoinOrderCreditIfPaid(orderId) {
  const { data: order, error: orderErr } = await supabase
    .from("coin_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) throw orderErr;
  if (!order) return;

  const status = String(order.status || "").toLowerCase();
  if (status !== "paid") return;

  if (order.credited_at) {
    console.log("[coin credit] já creditado");
    return;
  }

  await ensureUserWallet(order.user_id);

  const nowIso = new Date().toISOString();

  const { data: mark, error: markErr } = await supabase
    .from("coin_orders")
    .update({
      credited_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", order.id)
    .is("credited_at", null)
    .select("id")
    .maybeSingle();

  if (markErr) throw markErr;

  if (!mark) {
    console.log("[coin credit] corrida detectada");
    return;
  }

  const { data: wallet, error: walletErr } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("user_id", order.user_id)
    .maybeSingle();

  if (walletErr) throw walletErr;
  if (!wallet) throw new Error("wallet_not_found_after_ensure");

  const nextPurchased =
    Number(wallet.purchased_coins || 0) + Number(order.credit_coins || 0);

  const { error: updWalletErr } = await supabase
    .from("user_wallets")
    .update({
      purchased_coins: nextPurchased,
      updated_at: nowIso,
    })
    .eq("user_id", order.user_id);

  if (updWalletErr) throw updWalletErr;

  await addWalletActivity(order.user_id, {
    type: "buy",
    title: "Compra de moedas aprovada",
    amount: Number(order.credit_coins || 0),
    meta: "Pacote " + String(order.pack || ""),
  });

  console.log("[coin credit] moedas creditadas:", order.credit_coins);
}

async function fetchMercadoPagoPayment(paymentId) {
  if (!MP_ACCESS_TOKEN) {
    throw new Error("mercadopago_token_missing");
  }

  const url = "https://api.mercadopago.com/v1/payments/" + encodeURIComponent(paymentId);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + MP_ACCESS_TOKEN,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
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

async function reconcileCoinOrderStatus(order) {
  const paymentId = String(order?.mercadopago_payment_id || "").trim();
  if (!paymentId) return order;

  const mpPayment = await fetchMercadoPagoPayment(paymentId);

  const rawStatus = String(mpPayment?.status || "").trim().toLowerCase();
  const finalStatus = mapMercadoPagoStatus(rawStatus);
  const paidAt = toIsoOrNull(mpPayment?.date_approved);
  const nowIso = new Date().toISOString();

  const updateCoinPayload = {
    status: finalStatus,
    mercadopago_payment_id: String(mpPayment?.id || paymentId),
    mercadopago_status: rawStatus,
    mercadopago_external_reference:
      String(mpPayment?.external_reference || order?.mercadopago_external_reference || ""),
    updated_at: nowIso,
  };

  if (paidAt && finalStatus === "paid") {
    updateCoinPayload.paid_at = paidAt;
    updateCoinPayload.approved_at = paidAt;
  }

  const { error: updOrderErr } = await supabase
    .from("coin_orders")
    .update(updateCoinPayload)
    .eq("id", order.id);

  if (updOrderErr) throw updOrderErr;

  const paymentRowId = String(order?.payment_id || "").trim();
  if (paymentRowId) {
    const paymentUpdate = {
      status: finalStatus,
      mercadopago_status: rawStatus,
      mercadopago_payment_id: String(mpPayment?.id || paymentId),
      mercadopago_external_reference:
        String(mpPayment?.external_reference || order?.mercadopago_external_reference || ""),
      provider_response: mpPayment,
      updated_at: nowIso,
    };

    if (paidAt && finalStatus === "paid") {
      paymentUpdate.paid_at = paidAt;
      paymentUpdate.approved_at = paidAt;
    }

    const { error: updPayErr } = await supabase
      .from("payments")
      .update(paymentUpdate)
      .eq("id", paymentRowId);

    if (updPayErr) throw updPayErr;
  }

  if (finalStatus === "paid") {
    await applyCoinOrderCreditIfPaid(order.id);
  }

  const { data: freshOrder, error: freshErr } = await supabase
    .from("coin_orders")
    .select("*")
    .eq("id", order.id)
    .maybeSingle();

  if (freshErr) throw freshErr;
  return freshOrder || order;
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const authUserId = String(req.user?.id || "").trim();
    if (!authUserId) {
      return res.status(401).json({ ok: false, error: "not_logged_in" });
    }

    const orderId = String(req.query.orderId || "").trim();
    if (!orderId) {
      return res.status(400).json({ ok: false, error: "order_id_required" });
    }

    const { data: order, error } = await supabase
      .from("coin_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      return res.status(404).json({ ok: false, error: "coin_order_not_found" });
    }

    if (String(order.user_id || "") !== authUserId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    let finalOrder = order;
    const localStatus = String(order.status || "").toLowerCase();

    if (!order.credited_at && ["pending", "created", "processing", "authorized"].includes(localStatus)) {
      try {
        finalOrder = await reconcileCoinOrderStatus(order);
      } catch (reconcileErr) {
        console.warn("[coin-order-status] falha ao reconciliar com MP:", reconcileErr?.message || reconcileErr);
      }
    }

    return res.json({
      ok: true,
      orderId: finalOrder.id,
      status: finalOrder.status,
      credited: !!finalOrder.credited_at,
      credited_at: finalOrder.credited_at || null,
      paid_at: finalOrder.paid_at || null,
      approved_at: finalOrder.approved_at || null,
    });
  } catch (e) {
    console.error("[coin-order-status] erro:", e);

    return res.status(500).json({
      ok: false,
      error: String(e?.message || e || "Erro"),
    });
  }
};