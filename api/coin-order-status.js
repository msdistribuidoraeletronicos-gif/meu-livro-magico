"use strict";

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
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

    return res.json({
      ok: true,
      orderId: order.id,
      status: order.status,
      credited: !!order.credited_at,
      credited_at: order.credited_at || null,
      paid_at: order.paid_at || null,
      approved_at: order.approved_at || null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e || "Erro"),
    });
  }
};