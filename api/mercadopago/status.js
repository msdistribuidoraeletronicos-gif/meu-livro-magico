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

function extractPaymentReference(req) {
  return String(
    req.query?.paymentReference ||
    req.query?.payment_reference ||
    req.query?.paymentId ||
    req.query?.payment_id ||
    req.query?.id ||
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

async function findPaymentByReference(paymentReference) {
  const ref = String(paymentReference || "").trim();
  if (!ref) return null;

  if (isUuid(ref)) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", ref)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  if (isNumericId(ref)) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("mercadopago_payment_id", ref)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) return data[0];
  }

  {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("mercadopago_reference_id", ref)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) return data[0];
  }

  {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("mercadopago_external_reference", ref)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) return data[0];
  }

  return null;
}

module.exports = async (req, res) => {
  console.log("[mercadopago/status] ===== NOVA REQUISIÇÃO =====");
  console.log("[mercadopago/status] Método:", req.method);
  console.log("[mercadopago/status] URL:", req.url);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Supabase não configurado no ambiente" });
    }

    if (!MP_ACCESS_TOKEN) {
      return res.status(500).json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" });
    }

    const paymentReference = extractPaymentReference(req);
    if (!paymentReference) {
      return res.status(400).json({ error: "paymentReference é obrigatório" });
    }

    console.log("[mercadopago/status] paymentReference:", paymentReference);

    const payment = await findPaymentByReference(paymentReference);

    if (!payment) {
      return res.status(404).json({ error: "Pagamento não encontrado" });
    }

    const currentStatus = String(payment.status || "").toLowerCase();
    const alreadyFinal = ["paid", "failed", "expired", "cancelled", "refunded"].includes(currentStatus);

    if (alreadyFinal && currentStatus === "paid") {
      return res.status(200).json({
        ok: true,
        paymentId: payment.id,
        paymentReference:
          payment.mercadopago_reference_id ||
          payment.mercadopago_external_reference ||
          payment.mercadopago_payment_id ||
          payment.id,
        status: "paid",
        providerStatus: payment.mercadopago_status || payment.status || "paid",
        paidAt: payment.paid_at || payment.approved_at || null,
        expiresAt: payment.expires_at || null,
      });
    }

    const mercadopagoPaymentId = String(payment.mercadopago_payment_id || "").trim();
    if (!mercadopagoPaymentId) {
      return res.status(400).json({
        error: "Pagamento sem mercadopago_payment_id salvo",
      });
    }

    const url = "https://api.mercadopago.com/v1/payments/" + encodeURIComponent(mercadopagoPaymentId);

    console.log("[mercadopago/status] Consultando Mercado Pago:", url);

    const mpResponse = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + MP_ACCESS_TOKEN,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const rawText = await mpResponse.text();
    let mpResult = null;

    try {
      mpResult = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      console.error("[mercadopago/status] Resposta não-JSON do Mercado Pago:", rawText);
      return res.status(502).json({
        error: "O Mercado Pago retornou uma resposta inválida",
        raw: rawText,
      });
    }

    console.log("[mercadopago/status] Resposta Mercado Pago:", JSON.stringify(mpResult, null, 2));

    if (!mpResponse.ok) {
      const message =
        mpResult?.message ||
        mpResult?.error ||
        mpResult?.cause?.[0]?.description ||
        "Erro ao consultar status no Mercado Pago";

      console.error("[mercadopago/status] Falha Mercado Pago:", mpResult);

      return res.status(400).json({
        error: message,
        details: mpResult,
      });
    }

    const rawStatus = String(mpResult?.status || "").trim().toLowerCase();
    const mappedStatus = mapMercadoPagoStatus(rawStatus);

    const paidAt = toIsoOrNull(
      mpResult?.date_approved ||
      mpResult?.date_last_updated ||
      null
    );

    const expiresAt = toIsoOrNull(
      mpResult?.date_of_expiration ||
      mpResult?.point_of_interaction?.transaction_data?.expiration_date ||
      null
    );

    const updatePayload = {
      status: mappedStatus,
      mercadopago_status: rawStatus || null,
      mercadopago_status_detail: String(mpResult?.status_detail || "").trim().toLowerCase() || null,
      provider_response: mpResult,
      updated_at: new Date().toISOString(),
    };

    if (paidAt && mappedStatus === "paid") {
      updatePayload.paid_at = paidAt;
      updatePayload.approved_at = paidAt;
    }

    if (expiresAt) {
      updatePayload.expires_at = expiresAt;
    }

    const { error: updateErr } = await supabase
      .from("payments")
      .update(updatePayload)
      .eq("id", payment.id);

    if (updateErr) {
      console.error("[mercadopago/status] Erro ao atualizar payment:", updateErr);
      return res.status(500).json({
        error: "Erro ao atualizar status do pagamento",
      });
    }

    return res.status(200).json({
      ok: true,
      paymentId: payment.id,
      paymentReference:
        payment.mercadopago_reference_id ||
        payment.mercadopago_external_reference ||
        payment.mercadopago_payment_id ||
        payment.id,
      status: mappedStatus,
      providerStatus: rawStatus || "",
      paidAt,
      expiresAt,
    });
  } catch (e) {
    console.error("[mercadopago/status] Erro interno:");
    console.error(e);
    return res.status(500).json({
      error: e?.message || "Erro interno ao consultar pagamento",
    });
  }
};