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
        `id.eq.${ref}`,
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

async function fetchMercadoPagoPayment(paymentId) {
  if (!paymentId) return null;

  const url = "https://api.mercadopago.com/v1/payments/" + encodeURIComponent(paymentId);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + MP_ACCESS_TOKEN,
      Accept: "application/json",
      "Content-Type": "application/json"
    }
  });

  const rawText = await response.text();
  let json = null;

  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    return {
      ok: false,
      status: response.status,
      error: "Resposta inválida do Mercado Pago",
      raw: rawText
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error:
        json?.message ||
        json?.error ||
        json?.cause?.[0]?.description ||
        "Erro ao consultar pagamento no Mercado Pago",
      raw: json
    };
  }

  return {
    ok: true,
    raw: json
  };
}

module.exports = async (req, res) => {
  console.log("[mercadopago/webhook] ===== NOVA REQUISIÇÃO =====");
  console.log("[mercadopago/webhook] Método:", req.method);
  console.log("[mercadopago/webhook] URL:", req.url);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Supabase não configurado no ambiente" });
    }

    if (!MP_ACCESS_TOKEN) {
      return res.status(500).json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" });
    }

    const body = req.body || {};
    console.log("[mercadopago/webhook] Body recebido:", JSON.stringify(body, null, 2));

    const refs = extractWebhookRefs(body);
    console.log("[mercadopago/webhook] Refs extraídas:", refs);

    let payment = null;

    try {
      payment = await findPaymentByRefs(refs);
    } catch (findErr) {
      console.error("[mercadopago/webhook] Erro ao buscar payment:", findErr);
      return res.status(500).json({ error: "Erro ao buscar pagamento" });
    }

    if (!payment && !refs.mercadopagoPaymentId) {
      console.warn("[mercadopago/webhook] Nenhuma referência útil encontrada");
      return res.status(200).json({
        ok: true,
        ignored: true,
        message: "Webhook recebido sem referência suficiente"
      });
    }

    const paymentIdToQuery =
      refs.mercadopagoPaymentId ||
      payment?.mercadopago_payment_id ||
      "";

    let finalStatus = "pending";
    let rawProviderStatus = "";
    let paidAt = null;
    let expiresAt = null;
    let providerSnapshot = body;
    let resolvedPaymentId = refs.mercadopagoPaymentId || payment?.mercadopago_payment_id || null;
    let resolvedReferenceId = payment?.mercadopago_reference_id || null;
    let resolvedExternalReference = payment?.mercadopago_external_reference || null;

    if (paymentIdToQuery) {
      const mpPayment = await fetchMercadoPagoPayment(paymentIdToQuery);

      if (mpPayment?.ok) {
        const raw = mpPayment.raw || {};
        rawProviderStatus = String(raw.status || "").trim().toLowerCase();
        finalStatus = mapMercadoPagoStatus(rawProviderStatus);
        paidAt = toIsoOrNull(raw.date_approved || raw.date_last_updated || null);
        expiresAt = toIsoOrNull(
          raw.date_of_expiration ||
          raw?.point_of_interaction?.transaction_data?.expiration_date ||
          null
        );
        providerSnapshot = raw;
        resolvedPaymentId = String(raw.id || resolvedPaymentId || "").trim() || null;
        resolvedExternalReference = String(raw.external_reference || resolvedExternalReference || "").trim() || null;
      } else {
        console.error("[mercadopago/webhook] Falha ao consultar Mercado Pago:", mpPayment);
      }
    }

    if (!payment) {
      payment = await findPaymentByRefs({
        mercadopagoPaymentId: resolvedPaymentId,
        mercadopagoReferenceId: resolvedReferenceId,
        mercadopagoExternalReference: resolvedExternalReference
      });
    }

    if (!payment) {
      console.warn("[mercadopago/webhook] Payment não encontrado para refs:", refs);
      return res.status(200).json({
        ok: true,
        ignored: true,
        message: "Webhook recebido, mas nenhum payment correspondente foi encontrado"
      });
    }

    const updatePayload = {
      status: finalStatus,
      provider_response: providerSnapshot,
      mercadopago_payment_id: resolvedPaymentId,
      mercadopago_status: rawProviderStatus || null,
      mercadopago_external_reference: resolvedExternalReference || null,
      updated_at: new Date().toISOString(),
      metadata: {
        ...(payment.metadata || {}),
        webhook_received: true,
        webhook_received_at: new Date().toISOString(),
        webhook_event_type: refs.eventType || null
      }
    };

    if (paidAt && finalStatus === "paid") {
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
      console.error("[mercadopago/webhook] Erro ao atualizar payment:", updateErr);
      return res.status(500).json({ error: "Erro ao atualizar pagamento" });
    }

    console.log("[mercadopago/webhook] Payment atualizado com sucesso:", {
      paymentId: payment.id,
      status: finalStatus,
      providerStatus: rawProviderStatus
    });

    return res.status(200).json({
      ok: true,
      paymentId: payment.id,
      status: finalStatus,
      providerStatus: rawProviderStatus
    });
  } catch (e) {
    console.error("[mercadopago/webhook] Erro interno:");
    console.error(e);
    return res.status(500).json({
      error: e?.message || "Erro interno no webhook"
    });
  }
};