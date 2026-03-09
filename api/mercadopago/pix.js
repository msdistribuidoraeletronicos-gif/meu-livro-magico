// api/mercadopago/pix.js
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

function normalizePartnerRef(v) {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v || "").trim() || null;
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

function buildIdempotencyKey(payload) {
  const raw = JSON.stringify(payload || {}) + "|" + Date.now() + "|" + Math.random();
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function buildPaymentReference(bookId) {
  const rand = crypto.randomBytes(6).toString("hex");
  return `mlm_${String(bookId || "").replace(/[^a-zA-Z0-9_-]/g, "")}_${Date.now()}_${rand}`;
}

function safeMetadata(v) {
  try {
    return v ?? {};
  } catch {
    return {};
  }
}

module.exports = async (req, res) => {
  console.log("[mercadopago/pix] ===== NOVA REQUISIÇÃO =====");
  console.log("[mercadopago/pix] Método:", req.method);
  console.log("[mercadopago/pix] URL:", req.url);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    if (!MP_ACCESS_TOKEN) {
      return res.status(500).json({
        error: "MERCADOPAGO_ACCESS_TOKEN não configurado",
      });
    }

    const body = req.body || {};

    const normalized = {
      bookId: String(body.bookId || "").trim(),
      name: String(body.name || "").trim(),
      whatsapp: cleanPhone(body.whatsapp),
      email: String(body.email || "").trim().toLowerCase(),
      address: normalizeAddress(body.address),
      pack: String(body.pack || "").trim(),
      giftwrap: !!body.giftwrap,
      subtotalBeforeCoins: toMoney(body.subtotalBeforeCoins),
      usedWalletCoins: toMoney(body.usedWalletCoins),
      total: toMoney(body.total),
      obs: String(body.obs || "").trim(),
      partnerRef: normalizePartnerRef(body.partnerRef),
    };

    if (!normalized.bookId) {
      return res.status(400).json({ error: "bookId não informado" });
    }

    if (!normalized.name || normalized.name.length < 2) {
      return res.status(400).json({ error: "Nome inválido" });
    }

    if (!normalized.whatsapp || normalized.whatsapp.length < 10) {
      return res.status(400).json({ error: "WhatsApp inválido" });
    }

    if (!isValidEmail(normalized.email)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    if (!hasMinAddress(normalized.address)) {
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
      return res.status(400).json({
        error: "Os valores do checkout não conferem.",
      });
    }

    if (normalized.total <= 0) {
      return res.status(400).json({
        error: "O total do PIX precisa ser maior que zero.",
      });
    }

    const { data: book, error: bookErr } = await supabase
      .from("books")
      .select("id, user_id, child_name, theme, style")
      .eq("id", normalized.bookId)
      .maybeSingle();

    if (bookErr) {
      console.error("[mercadopago/pix] erro ao buscar livro:", bookErr);
      return res.status(500).json({ error: "Erro ao validar livro" });
    }

    if (!book) {
      return res.status(404).json({ error: "Livro não encontrado" });
    }

    const externalReference = String(book.id);
    const internalReference = buildPaymentReference(book.id);
    const nowIso = new Date().toISOString();

    const metadata = {
      source: "meu_livro_magico_checkout",
      book_id: normalized.bookId,
      user_id: book.user_id || null,
      child_name: String(book.child_name || ""),
      theme: String(book.theme || ""),
      style: String(book.style || ""),
      customer_name: normalized.name,
      customer_email: normalized.email,
      customer_whatsapp: normalized.whatsapp,
      address: normalized.address,
      pack: normalized.pack,
      giftwrap: normalized.giftwrap,
      subtotal_before_coins: normalized.subtotalBeforeCoins,
      used_wallet_coins: normalized.usedWalletCoins,
      final_total: normalized.total,
      partner_ref: normalized.partnerRef,
      obs: normalized.obs || "",
      internal_reference: internalReference,
    };

    const notificationUrl = APP_BASE_URL
      ? APP_BASE_URL.replace(/\/+$/, "") + "/api/webhooks/mercadopago"
      : undefined;

    const mpPayload = {
      transaction_amount: normalized.total,
      description: `Meu Livro Mágico - Livro ${normalized.bookId}`,
      payment_method_id: "pix",
      external_reference: externalReference,
      payer: {
        email: normalized.email,
        first_name: normalized.name,
      },
      metadata,
    };

    if (notificationUrl) {
      mpPayload.notification_url = notificationUrl;
    }

    console.log("[mercadopago/pix] criando cobrança PIX...");
    console.log("[mercadopago/pix] payload:", JSON.stringify(mpPayload, null, 2));

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": buildIdempotencyKey(mpPayload),
      },
      body: JSON.stringify(mpPayload),
    });

    const mpResult = await mpResponse.json().catch(() => ({}));

    if (!mpResponse.ok) {
      console.error("[mercadopago/pix] erro do Mercado Pago:", mpResult);
      return res.status(500).json({
        error: mpResult?.message || mpResult?.error || "Não foi possível gerar o PIX no Mercado Pago",
        details: mpResult,
      });
    }

    console.log("[mercadopago/pix] resposta mp:", JSON.stringify(mpResult, null, 2));

    const mercadopagoPaymentId = String(mpResult.id || "").trim();
    const mercadopagoStatus = String(mpResult.status || "").trim().toLowerCase();
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

    if (!mercadopagoPaymentId) {
      return res.status(500).json({
        error: "O Mercado Pago não retornou o identificador do pagamento.",
      });
    }

    if (!pixCode) {
      console.warn("[mercadopago/pix] aviso: PIX criado sem qr_code/copia e cola.");
    }

    const paymentInsert = {
      provider: "mercadopago",
      payment_method: "pix",
      status: mercadopagoStatus || "pending",

      amount: normalized.total,
      book_id: normalized.bookId,
      user_id: book.user_id || null,

      customer_name: normalized.name,
      customer_email: normalized.email,
      customer_whatsapp: normalized.whatsapp,

      mercadopago_payment_id: mercadopagoPaymentId,
      mercadopago_status: mercadopagoStatus || "pending",
      mercadopago_status_detail: mercadopagoStatusDetail || null,
      mercadopago_reference_id: internalReference,
      mercadopago_external_reference: externalReference,

      metadata: safeMetadata({
        ...metadata,
        qr_code_available: !!pixCode,
        qr_code_base64_available: !!qrCodeBase64,
        ticket_url: ticketUrl || null,
        raw_response: mpResult,
      }),

      created_at: nowIso,
      updated_at: nowIso,
      approved_at: mercadopagoStatus === "approved" ? nowIso : null,
    };

    const { data: insertedPayment, error: insertErr } = await supabase
      .from("payments")
      .insert(paymentInsert)
      .select("id")
      .single();

    if (insertErr) {
      console.error("[mercadopago/pix] erro ao salvar pagamento local:", insertErr);
      return res.status(500).json({
        error: "PIX gerado, mas houve erro ao salvar o pagamento no sistema.",
        details: insertErr.message || insertErr,
      });
    }

    console.log("[mercadopago/pix] pagamento salvo localmente:", insertedPayment?.id);

    return res.status(200).json({
      ok: true,
      provider: "mercadopago",

      id: mercadopagoPaymentId,
      paymentId: mercadopagoPaymentId,
      paymentReference: mercadopagoPaymentId,

      localPaymentId: insertedPayment?.id || null,

      status: mercadopagoStatus || "pending",
      paymentStatus: mercadopagoStatus || "pending",
      payment_status: mercadopagoStatus || "pending",

      pixCode,
      copyPaste: pixCode,
      copy_paste: pixCode,
      emv: pixCode,

      qrCodeBase64,
      qr_code_base64: qrCodeBase64,

      qrCodeUrl: ticketUrl || "",
      qr_code_url: ticketUrl || "",
    });
  } catch (e) {
    console.error("[mercadopago/pix] erro interno:", e);
    return res.status(500).json({
      error: e?.message || "Erro interno ao gerar PIX",
    });
  }
};