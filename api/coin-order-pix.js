"use strict";

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const MP_ACCESS_TOKEN = String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
const APP_BASE_URL = String(process.env.APP_BASE_URL || "").trim();

function readJsonSafe(response) {
  return response.json().catch(() => ({}));
}

function getNotificationUrl() {
  if (!APP_BASE_URL) return undefined;
  return APP_BASE_URL.replace(/\/+$/, "") + "/api/webhooks/mercadopago";
}

function buildReference(orderId) {
  const rand = crypto.randomBytes(6).toString("hex");
  return "coin_" + String(orderId) + "_" + Date.now() + "_" + rand;
}

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
    meta: {
      source: "coin_order",
      order_id: order.id,
      pack: Number(order.pack || 0),
      bonus_coins: Number(order.bonus_coins || 0),
      credit_coins: Number(order.credit_coins || 0),
    },
  });

  console.log("[coin credit] moedas creditadas:", order.credit_coins);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const authUserId = String(req.user?.id || "").trim();
    if (!authUserId) {
      return res.status(401).json({ ok: false, error: "not_logged_in" });
    }

    const orderId = String(req.query.orderId || req.body?.orderId || "").trim();
    if (!orderId) {
      return res.status(400).json({ ok: false, error: "order_id_required" });
    }

    if (!MP_ACCESS_TOKEN) {
      return res.status(500).json({ ok: false, error: "mercadopago_token_missing" });
    }

    const { data: order, error: orderErr } = await supabase
      .from("coin_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) {
      return res.status(404).json({ ok: false, error: "coin_order_not_found" });
    }

    if (String(order.user_id || "") !== authUserId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    if (order.credited_at) {
      return res.status(400).json({ ok: false, error: "coin_order_already_credited" });
    }

    if (String(order.status || "").toLowerCase() === "paid") {
      await applyCoinOrderCreditIfPaid(order.id);

      return res.json({
        ok: true,
        reused: true,
        orderId: order.id,
        paymentReference:
          order.mercadopago_external_reference ||
          order.mercadopago_reference_id ||
          "",
        payment_reference:
          order.mercadopago_external_reference ||
          order.mercadopago_reference_id ||
          "",
        paymentId: order.mercadopago_payment_id || "",
        payment_id: order.mercadopago_payment_id || "",
        qrCodeBase64: "",
        qr_code_base64: "",
        qrCodeUrl: "",
        qr_code_url: "",
        pixCode: "",
        copyPaste: "",
        copy_paste: "",
        status: "paid",
      });
    }

    const existingPaymentId = String(order.payment_id || "").trim();
    if (existingPaymentId) {
      const { data: existingPayment, error: existingPaymentErr } = await supabase
        .from("payments")
        .select("*")
        .eq("id", existingPaymentId)
        .maybeSingle();

      if (existingPaymentErr) throw existingPaymentErr;

      if (existingPayment) {
        const existingStatus = String(existingPayment.status || "").toLowerCase();
        const existingMpStatus = String(existingPayment.mercadopago_status || "").toLowerCase();

        if (
          ["pending"].includes(existingStatus) ||
          ["pending", "in_process", "authorized", "in_mediation"].includes(existingMpStatus)
        ) {
          return res.json({
            ok: true,
            reused: true,
            orderId: order.id,
            paymentReference:
              existingPayment.mercadopago_external_reference ||
              existingPayment.mercadopago_reference_id ||
              "",
            payment_reference:
              existingPayment.mercadopago_external_reference ||
              existingPayment.mercadopago_reference_id ||
              "",
            paymentId: existingPayment.mercadopago_payment_id || "",
            payment_id: existingPayment.mercadopago_payment_id || "",
            qrCodeBase64:
              existingPayment?.metadata?.raw_response?.point_of_interaction?.transaction_data?.qr_code_base64 ||
              "",
            qr_code_base64:
              existingPayment?.metadata?.raw_response?.point_of_interaction?.transaction_data?.qr_code_base64 ||
              "",
            qrCodeUrl:
              existingPayment?.metadata?.raw_response?.point_of_interaction?.transaction_data?.ticket_url || "",
            qr_code_url:
              existingPayment?.metadata?.raw_response?.point_of_interaction?.transaction_data?.ticket_url || "",
            pixCode:
              existingPayment?.metadata?.raw_response?.point_of_interaction?.transaction_data?.qr_code || "",
            copyPaste:
              existingPayment?.metadata?.raw_response?.point_of_interaction?.transaction_data?.qr_code || "",
            copy_paste:
              existingPayment?.metadata?.raw_response?.point_of_interaction?.transaction_data?.qr_code || "",
            status: existingStatus || "pending",
          });
        }
      }
    }

    const externalReference =
      String(order.mercadopago_external_reference || "").trim() || buildReference(order.id);

    const metadata = {
      source: "coin_order_checkout",
      type: "coin_order",
      coin_order_id: order.id,
      user_id: order.user_id,
      pack: Number(order.pack || 0),
      bonus_coins: Number(order.bonus_coins || 0),
      credit_coins: Number(order.credit_coins || 0),
    };

    const mpPayload = {
      transaction_amount: Number(Number(order.price_amount || 0).toFixed(2)),
      description: "Compra de moedas - Meu Livro Mágico",
      payment_method_id: "pix",
      external_reference: externalReference,
      payer: {
        email: String(order.customer_email || "cliente@meulivromagico.com"),
        first_name: "Cliente",
        last_name: "Meu Livro Mágico",
      },
      metadata,
    };

    const notificationUrl = getNotificationUrl();
    if (notificationUrl) {
      mpPayload.notification_url = notificationUrl;
    }

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + MP_ACCESS_TOKEN,
        "Content-Type": "application/json",
        "X-Idempotency-Key": "coin_pix_" + order.id,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpResult = await readJsonSafe(mpResponse);

    if (!mpResponse.ok) {
      return res.status(mpResponse.status || 500).json({
        ok: false,
        error:
          mpResult?.message ||
          mpResult?.error ||
          mpResult?.cause?.[0]?.description ||
          "mp_pix_create_failed",
        details: mpResult,
      });
    }

    const mercadopagoPaymentId = String(mpResult.id || "").trim();
    const rawMpStatus = String(mpResult.status || "pending").trim().toLowerCase();
    const appStatus = mapMercadoPagoStatus(rawMpStatus);
    const mercadopagoStatusDetail = String(mpResult.status_detail || "").trim().toLowerCase();
    const approvedAt = toIsoOrNull(mpResult?.date_approved);
    const nowIso = new Date().toISOString();

    const qrCodeBase64 = String(
      mpResult?.point_of_interaction?.transaction_data?.qr_code_base64 || ""
    ).trim();

    const pixCode = String(
      mpResult?.point_of_interaction?.transaction_data?.qr_code || ""
    ).trim();

    const ticketUrl = String(
      mpResult?.point_of_interaction?.transaction_data?.ticket_url || ""
    ).trim();

    const paymentPayload = {
      provider: "mercadopago",
      payment_method: "pix",
      status: appStatus,
      amount: Number(order.price_amount || 0),

      // ✅ compra de moedas não depende de livro
      book_id: null,
      user_id: order.user_id,

      // ✅ campos de classificação
      purpose: "coin_purchase",
      reference_type: "user",

      customer_name: order.customer_name || null,
      customer_email: order.customer_email || null,
      customer_whatsapp: order.customer_whatsapp || null,

      mercadopago_payment_id: mercadopagoPaymentId,
      mercadopago_status: rawMpStatus,
      mercadopago_status_detail: mercadopagoStatusDetail || null,
      mercadopago_reference_id: externalReference,
      mercadopago_external_reference: externalReference,
      metadata: {
        ...metadata,
        raw_response: mpResult,
        qr_code_available: !!pixCode,
        qr_code_base64_available: !!qrCodeBase64,
        ticket_url: ticketUrl || null,
      },
      updated_at: nowIso,
      approved_at: appStatus === "paid" ? approvedAt || nowIso : null,
      paid_at: appStatus === "paid" ? approvedAt || nowIso : null,
    };

    const { data: existingPaymentByMpId, error: existingByMpErr } = await supabase
      .from("payments")
      .select("id")
      .eq("mercadopago_payment_id", mercadopagoPaymentId)
      .maybeSingle();

    if (existingByMpErr) throw existingByMpErr;

    let paymentRowId = "";

    if (existingPaymentByMpId?.id) {
      const { error: updPaymentErr } = await supabase
        .from("payments")
        .update(paymentPayload)
        .eq("id", existingPaymentByMpId.id);

      if (updPaymentErr) throw updPaymentErr;

      paymentRowId = String(existingPaymentByMpId.id || "");
    } else {
      const { data: insertedPayment, error: payErr } = await supabase
        .from("payments")
        .insert({
          ...paymentPayload,
          created_at: nowIso,
        })
        .select("id")
        .single();

      if (payErr) throw payErr;

      paymentRowId = String(insertedPayment.id || "");
    }

    const { error: updOrderErr } = await supabase
      .from("coin_orders")
      .update({
        status: appStatus,
        payment_provider: "mercadopago",
        payment_method: "pix",
        payment_id: paymentRowId || null,
        mercadopago_payment_id: mercadopagoPaymentId,
        mercadopago_status: rawMpStatus,
        mercadopago_reference_id: externalReference,
        mercadopago_external_reference: externalReference,
        metadata: {
          ...(order.metadata || {}),
          checkout_started: true,
          checkout_started_at: nowIso,
        },
        updated_at: nowIso,
        approved_at: appStatus === "paid" ? approvedAt || nowIso : null,
        paid_at: appStatus === "paid" ? approvedAt || nowIso : null,
      })
      .eq("id", order.id);

    if (updOrderErr) throw updOrderErr;

    if (appStatus === "paid") {
      await applyCoinOrderCreditIfPaid(order.id);
    }

    return res.json({
      ok: true,
      orderId: order.id,
      paymentReference: externalReference,
      payment_reference: externalReference,
      paymentId: mercadopagoPaymentId,
      payment_id: mercadopagoPaymentId,
      qrCodeBase64: qrCodeBase64,
      qr_code_base64: qrCodeBase64,
      qrCodeUrl: ticketUrl,
      qr_code_url: ticketUrl,
      pixCode: pixCode,
      copyPaste: pixCode,
      copy_paste: pixCode,
      status: appStatus,
    });
  } catch (e) {
    console.error("[coin-order-pix] erro:", e);

    return res.status(500).json({
      ok: false,
      error: String(e?.message || e || "Erro"),
    });
  }
};