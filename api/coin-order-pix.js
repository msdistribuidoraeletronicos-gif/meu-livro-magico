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

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
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

    if (order.credited_at) {
      return res.status(400).json({ ok: false, error: "coin_order_already_credited" });
    }

    if (String(order.status || "").toLowerCase() === "paid") {
      return res.status(400).json({ ok: false, error: "coin_order_already_paid" });
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
    const mercadopagoStatus = String(mpResult.status || "pending").trim().toLowerCase();
    const mercadopagoStatusDetail = String(mpResult.status_detail || "").trim().toLowerCase();

    const qrCodeBase64 = String(
      mpResult?.point_of_interaction?.transaction_data?.qr_code_base64 || ""
    ).trim();

    const pixCode = String(
      mpResult?.point_of_interaction?.transaction_data?.qr_code || ""
    ).trim();

    const ticketUrl = String(
      mpResult?.point_of_interaction?.transaction_data?.ticket_url || ""
    ).trim();

    const nowIso = new Date().toISOString();

    const paymentInsert = {
      provider: "mercadopago",
      payment_method: "pix",
      status: mercadopagoStatus === "approved" ? "paid" : "pending",

      amount: Number(order.price_amount || 0),
      book_id: null,
      user_id: order.user_id,

      customer_name: order.customer_name || null,
      customer_email: order.customer_email || null,
      customer_whatsapp: order.customer_whatsapp || null,

      mercadopago_payment_id: mercadopagoPaymentId,
      mercadopago_status: mercadopagoStatus,
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
      created_at: nowIso,
      updated_at: nowIso,
      approved_at: mercadopagoStatus === "approved" ? nowIso : null,
      paid_at: mercadopagoStatus === "approved" ? nowIso : null,
    };

    const { data: insertedPayment, error: payErr } = await supabase
      .from("payments")
      .insert(paymentInsert)
      .select("id")
      .single();

    if (payErr) throw payErr;

    const { error: updOrderErr } = await supabase
      .from("coin_orders")
      .update({
        status: mercadopagoStatus === "approved" ? "paid" : "pending",
        payment_provider: "mercadopago",
        payment_method: "pix",
        payment_id: insertedPayment.id,
        mercadopago_payment_id: mercadopagoPaymentId,
        mercadopago_status: mercadopagoStatus,
        mercadopago_reference_id: externalReference,
        mercadopago_external_reference: externalReference,
        metadata: {
          ...(order.metadata || {}),
          checkout_started: true,
          checkout_started_at: nowIso,
        },
        updated_at: nowIso,
        approved_at: mercadopagoStatus === "approved" ? nowIso : null,
        paid_at: mercadopagoStatus === "approved" ? nowIso : null,
      })
      .eq("id", order.id);

    if (updOrderErr) throw updOrderErr;

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
      status: mercadopagoStatus === "approved" ? "paid" : "pending",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e || "Erro"),
    });
  }
};