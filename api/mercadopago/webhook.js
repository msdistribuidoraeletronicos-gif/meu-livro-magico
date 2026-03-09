// api/pagbank/webhook.js
"use strict";

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function toIsoOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapPagBankStatus(rawStatus) {
  const s = String(rawStatus || "").trim().toUpperCase();

  if (!s) return "pending";

  if (["PAID", "APPROVED", "COMPLETED"].includes(s)) return "paid";
  if (["DECLINED", "FAILED", "DENIED"].includes(s)) return "failed";
  if (["CANCELED", "CANCELLED"].includes(s)) return "cancelled";
  if (["EXPIRED"].includes(s)) return "expired";
  if (["WAITING", "PENDING", "IN_ANALYSIS"].includes(s)) return "pending";

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
  const charge0 = Array.isArray(body?.charges) ? body.charges[0] : null;
  const notif0 = Array.isArray(body?.notifications) ? body.notifications[0] : null;
  const order0 = body?.order || null;
  const data0 = body?.data || null;

  return {
    eventType: pickFirstNonEmpty(
      body?.type,
      body?.event,
      body?.event_type,
      body?.notificationType,
      notif0?.type
    ),
    pagbankOrderId: pickFirstNonEmpty(
      body?.id,
      body?.order_id,
      body?.orderId,
      body?.resource?.id,
      body?.resource?.order_id,
      order0?.id,
      data0?.id
    ),
    pagbankChargeId: pickFirstNonEmpty(
      body?.charge_id,
      body?.chargeId,
      charge0?.id,
      data0?.charge_id,
      data0?.chargeId
    ),
    pagbankReferenceId: pickFirstNonEmpty(
      body?.reference_id,
      body?.referenceId,
      order0?.reference_id,
      data0?.reference_id,
      data0?.referenceId
    ),
    rawStatus: pickFirstNonEmpty(
      body?.status,
      charge0?.status,
      order0?.status,
      data0?.status
    ),
    paidAt: toIsoOrNull(
      body?.paid_at ||
      charge0?.paid_at ||
      charge0?.payment_response?.paid_at ||
      charge0?.last_transaction?.paid_at ||
      charge0?.last_transaction?.transaction_date ||
      order0?.paid_at ||
      data0?.paid_at
    ),
    expiresAt: toIsoOrNull(
      body?.expires_at ||
      charge0?.payment_response?.expiration_date ||
      charge0?.payment_response?.expires_at ||
      charge0?.payment_method?.pix?.expiration_date ||
      charge0?.payment_method?.pix?.expires_at ||
      order0?.expires_at ||
      data0?.expires_at
    )
  };
}

async function findPaymentByRefs(refs) {
  const candidates = [
    refs.pagbankOrderId,
    refs.pagbankChargeId,
    refs.pagbankReferenceId
  ].filter(Boolean);

  for (const ref of candidates) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .or([
        `id.eq.${ref}`,
        `pagbank_order_id.eq.${ref}`,
        `pagbank_charge_id.eq.${ref}`,
        `pagbank_reference_id.eq.${ref}`
      ].join(","))
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
  }

  return null;
}

async function fetchPagBankOrder(orderId, token, apiBase) {
  if (!orderId) return null;

  const url = apiBase.replace(/\/$/, "") + "/orders/" + encodeURIComponent(orderId);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/json",
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
      error: "Resposta inválida do PagBank",
      raw: rawText
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error:
        json?.error_messages?.[0]?.description ||
        json?.message ||
        json?.error ||
        "Erro ao consultar pedido no PagBank",
      raw: json
    };
  }

  return {
    ok: true,
    raw: json
  };
}

function extractStatusFromPagBankOrder(pgResult) {
  const charge0 = Array.isArray(pgResult?.charges) ? pgResult.charges[0] : null;

  const rawStatus = pickFirstNonEmpty(
    charge0?.status,
    pgResult?.status
  );

  const paidAt = toIsoOrNull(
    charge0?.paid_at ||
    charge0?.payment_response?.paid_at ||
    charge0?.last_transaction?.paid_at ||
    charge0?.last_transaction?.transaction_date ||
    pgResult?.paid_at
  );

  const expiresAt = toIsoOrNull(
    charge0?.payment_response?.expiration_date ||
    charge0?.payment_response?.expires_at ||
    charge0?.payment_method?.pix?.expiration_date ||
    charge0?.payment_method?.pix?.expires_at ||
    pgResult?.expires_at
  );

  return {
    rawStatus,
    mappedStatus: mapPagBankStatus(rawStatus),
    paidAt,
    expiresAt,
    pagbankOrderId: pickFirstNonEmpty(pgResult?.id, pgResult?.order_id),
    pagbankChargeId: pickFirstNonEmpty(charge0?.id, charge0?.charge_id),
    pagbankReferenceId: pickFirstNonEmpty(pgResult?.reference_id, pgResult?.referenceId)
  };
}

module.exports = async (req, res) => {
  console.log("[pagbank/webhook] ===== NOVA REQUISIÇÃO =====");
  console.log("[pagbank/webhook] Método:", req.method);
  console.log("[pagbank/webhook] URL:", req.url);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const PAGBANK_TOKEN = String(process.env.PAGBANK_TOKEN || "").trim();
    const PAGBANK_API_BASE = String(process.env.PAGBANK_API_BASE || "https://api.pagseguro.com").trim();

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Supabase não configurado no ambiente" });
    }

    if (!PAGBANK_TOKEN) {
      return res.status(500).json({ error: "PAGBANK_TOKEN não configurado" });
    }

    const body = req.body || {};
    console.log("[pagbank/webhook] Body recebido:", JSON.stringify(body, null, 2));

    const refs = extractWebhookRefs(body);
    console.log("[pagbank/webhook] Refs extraídas:", refs);

    let payment = null;

    try {
      payment = await findPaymentByRefs(refs);
    } catch (findErr) {
      console.error("[pagbank/webhook] Erro ao buscar payment:", findErr);
      return res.status(500).json({ error: "Erro ao buscar pagamento" });
    }

    if (!payment) {
      console.warn("[pagbank/webhook] Payment não encontrado para refs:", refs);
      return res.status(200).json({
        ok: true,
        ignored: true,
        message: "Webhook recebido, mas nenhum payment correspondente foi encontrado"
      });
    }

    const orderIdToQuery =
      refs.pagbankOrderId ||
      payment.pagbank_order_id ||
      "";

    let finalStatus = mapPagBankStatus(refs.rawStatus);
    let rawProviderStatus = refs.rawStatus || "";
    let paidAt = refs.paidAt || null;
    let expiresAt = refs.expiresAt || null;
    let providerSnapshot = body;
    let resolvedOrderId = refs.pagbankOrderId || payment.pagbank_order_id || null;
    let resolvedChargeId = refs.pagbankChargeId || payment.pagbank_charge_id || null;
    let resolvedReferenceId = refs.pagbankReferenceId || payment.pagbank_reference_id || null;

    if (orderIdToQuery) {
      const pgOrder = await fetchPagBankOrder(orderIdToQuery, PAGBANK_TOKEN, PAGBANK_API_BASE);

      if (pgOrder?.ok) {
        const extracted = extractStatusFromPagBankOrder(pgOrder.raw);

        finalStatus = extracted.mappedStatus;
        rawProviderStatus = extracted.rawStatus || rawProviderStatus;
        paidAt = extracted.paidAt || paidAt;
        expiresAt = extracted.expiresAt || expiresAt;
        providerSnapshot = pgOrder.raw;
        resolvedOrderId = extracted.pagbankOrderId || resolvedOrderId;
        resolvedChargeId = extracted.pagbankChargeId || resolvedChargeId;
        resolvedReferenceId = extracted.pagbankReferenceId || resolvedReferenceId;
      } else {
        console.error("[pagbank/webhook] Falha ao consultar PagBank:", pgOrder);
      }
    }

    const updatePayload = {
      status: finalStatus,
      provider_response: providerSnapshot,
      pagbank_order_id: resolvedOrderId,
      pagbank_charge_id: resolvedChargeId,
      pagbank_reference_id: resolvedReferenceId,
      updated_at: new Date().toISOString(),
      metadata: {
        ...(payment.metadata || {}),
        webhook_received: true,
        webhook_received_at: new Date().toISOString(),
        webhook_event_type: refs.eventType || null
      }
    };

    if (paidAt) updatePayload.paid_at = paidAt;
    if (expiresAt) updatePayload.expires_at = expiresAt;

    const { error: updateErr } = await supabase
      .from("payments")
      .update(updatePayload)
      .eq("id", payment.id);

    if (updateErr) {
      console.error("[pagbank/webhook] Erro ao atualizar payment:", updateErr);
      return res.status(500).json({ error: "Erro ao atualizar pagamento" });
    }

    console.log("[pagbank/webhook] Payment atualizado com sucesso:", {
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
    console.error("[pagbank/webhook] Erro interno:");
    console.error(e);
    return res.status(500).json({
      error: e?.message || "Erro interno no webhook"
    });
  }
};