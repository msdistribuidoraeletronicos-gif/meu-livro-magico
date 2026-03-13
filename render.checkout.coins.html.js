"use strict";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function moneyBR(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtCoins(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }) + " moedas";
}

function renderCheckoutCoinsHtml(order = {}) {
  const orderId = String(order.id || "");
  const pack = Number(order.pack || 0);
  const price = Number(order.price_amount || 0);
  const bonus = Number(order.bonus_coins || 0);
  const credit = Number(order.credit_coins || 0);
  const status = String(order.status || "pending");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Checkout de Moedas — Meu Livro Mágico</title>
<style>
  :root{
    --violet:#7c3aed;
    --pink:#db2777;
    --bg:#f8f5ff;
    --card:#ffffff;
    --line:rgba(15,23,42,.08);
    --ink:#111827;
    --muted:#6b7280;
    --green:#16a34a;
    --amber:#d97706;
    --red:#dc2626;
    --shadow:0 18px 46px rgba(17,24,39,.10);
    --r:24px;
  }
  *{box-sizing:border-box}
  body{
    margin:0;
    font-family:Inter,system-ui,Arial,sans-serif;
    background:linear-gradient(180deg,#f6f2ff,#fff);
    color:var(--ink);
  }
  .wrap{
    max-width:980px;
    margin:0 auto;
    padding:18px;
  }
  .top{
    display:flex;
    justify-content:space-between;
    gap:12px;
    align-items:center;
    flex-wrap:wrap;
  }
  .brand{
    font-weight:1000;
    font-size:20px;
  }
  .btn{
    border:0;
    border-radius:999px;
    padding:12px 16px;
    font-weight:900;
    cursor:pointer;
    text-decoration:none;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:8px;
  }
  .btnPrimary{
    color:#fff;
    background:linear-gradient(90deg,var(--violet),var(--pink));
    box-shadow:var(--shadow);
  }
  .btnSoft{
    color:var(--ink);
    background:#fff;
    border:1px solid var(--line);
  }
  .hero{
    margin-top:18px;
    background:linear-gradient(135deg,#fff,#fbf7ff);
    border:1px solid var(--line);
    border-radius:32px;
    box-shadow:var(--shadow);
    padding:24px;
  }
  .hero h1{
    margin:0;
    font-size:38px;
    line-height:1.05;
    letter-spacing:-.03em;
  }
  .sub{
    margin-top:12px;
    color:var(--muted);
    font-weight:700;
    line-height:1.7;
  }
  .grid{
    margin-top:18px;
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:16px;
  }
  .card{
    background:#fff;
    border:1px solid var(--line);
    border-radius:24px;
    box-shadow:var(--shadow);
    padding:18px;
  }
  .title{
    margin:0;
    font-size:22px;
    font-weight:1000;
  }
  .row{
    display:flex;
    justify-content:space-between;
    gap:10px;
    padding:10px 0;
    border-bottom:1px dashed rgba(15,23,42,.10);
    font-weight:800;
  }
  .row:last-child{border-bottom:0}
  .row.total{
    font-size:18px;
    font-weight:1000;
    color:var(--violet);
  }
  .badge{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:8px 12px;
    border-radius:999px;
    font-size:12px;
    font-weight:1000;
    border:1px solid var(--line);
    background:#fff;
    text-transform:uppercase;
  }
  .statusPending{ color:var(--amber); }
  .statusPaid{ color:var(--green); }
  .statusError{ color:var(--red); }
  .pixBox{
    display:grid;
    gap:14px;
  }
  .qrWrap{
    width:240px;
    height:240px;
    max-width:100%;
    border-radius:18px;
    border:1px solid var(--line);
    display:grid;
    place-items:center;
    background:#fff;
    overflow:hidden;
  }
  .qrWrap img{
    width:100%;
    height:100%;
    object-fit:contain;
    display:none;
  }
  textarea{
    width:100%;
    min-height:120px;
    border-radius:16px;
    border:1px solid var(--line);
    padding:12px;
    font:inherit;
    resize:vertical;
  }
  .hint{
    color:var(--muted);
    line-height:1.7;
    font-weight:700;
    font-size:14px;
  }
  .actions{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    margin-top:12px;
  }
  @media (max-width: 820px){
    .grid{grid-template-columns:1fr}
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">🪙 Meu Livro Mágico</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a class="btn btnSoft" href="/profile">← Voltar ao perfil</a>
      </div>
    </div>

    <div class="hero">
      <h1>Checkout de moedas</h1>
      <div class="sub">
        Finalize sua compra por PIX. As moedas só entram na sua conta depois da confirmação do pagamento.
      </div>

      <div class="grid">
        <div class="card">
          <h2 class="title">Resumo da compra</h2>

          <div class="row">
            <span>Pedido</span>
            <span>${esc(orderId)}</span>
          </div>
          <div class="row">
            <span>Pacote</span>
            <span>${fmtCoins(pack)}</span>
          </div>
          <div class="row">
            <span>Preço</span>
            <span>${moneyBR(price)}</span>
          </div>
          <div class="row">
            <span>Bônus</span>
            <span>${fmtCoins(bonus)}</span>
          </div>
          <div class="row total">
            <span>Total que entra na conta</span>
            <span>${fmtCoins(credit)}</span>
          </div>
          <div class="row">
            <span>Status</span>
            <span id="statusBadge" class="badge statusPending">${esc(status)}</span>
          </div>
        </div>

        <div class="card">
          <h2 class="title">Pagamento PIX</h2>

          <div class="pixBox">
            <div class="qrWrap">
              <img id="pixQrImage" alt="QR Code PIX"/>
              <div id="pixQrFallback" class="hint">Gerando QR Code...</div>
            </div>

            <div>
              <label for="pixCode" style="font-weight:1000;">Código PIX</label>
              <textarea id="pixCode" readonly placeholder="O código PIX aparecerá aqui"></textarea>
            </div>

            <div class="actions">
              <button type="button" class="btn btnPrimary" id="btnCopyPix">📋 Copiar código PIX</button>
              <button type="button" class="btn btnSoft" id="btnRefresh">🔄 Verificar pagamento</button>
            </div>

            <div class="hint" id="statusText">
              Aguardando geração do PIX...
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

<script>
(function(){
  const ORDER_ID = ${JSON.stringify(orderId)};
  let paymentPollTimer = null;

  function $(id){ return document.getElementById(id); }

  function normalizeStatus(s){
    s = String(s || "").trim().toLowerCase();
    if (!s) return "pending";
    if (["approved", "paid", "completed"].includes(s)) return "paid";
    if (["pending", "in_process", "in_mediation", "authorized", "created", "processing"].includes(s)) return "pending";
    if (["cancelled", "canceled"].includes(s)) return "cancelled";
    if (["rejected", "failed", "refused", "denied"].includes(s)) return "failed";
    if (["expired"].includes(s)) return "expired";
    return s;
  }

  function statusLabel(s){
    const v = normalizeStatus(s);
    if (v === "paid") return "pago";
    if (v === "pending") return "pendente";
    if (v === "cancelled") return "cancelado";
    if (v === "failed") return "falhou";
    if (v === "expired") return "expirado";
    return v || "pendente";
  }

  async function readJsonOrThrow(response){
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    let data = null;

    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => ({}));
    } else {
      const text = await response.text().catch(() => "");
      if (response.status === 401) {
        throw new Error("Sua sessão expirou. Faça login novamente.");
      }
      throw new Error(text || "Resposta inválida do servidor.");
    }

    if (response.status === 401) {
      throw new Error(data?.error === "not_logged_in"
        ? "Sua sessão expirou. Faça login novamente."
        : "Acesso não autorizado.");
    }

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Falha na comunicação com o servidor.");
    }

    return data;
  }

  function setStatus(kind, text, hint){
    const badge = $("statusBadge");
    const st = $("statusText");

    if (badge){
      badge.className = "badge " + (
        kind === "paid" ? "statusPaid" :
        kind === "error" ? "statusError" :
        "statusPending"
      );
      badge.textContent = text || "";
    }

    if (st) {
      st.textContent = hint || "";
    }
  }

  function stopPolling(){
    if (paymentPollTimer){
      clearInterval(paymentPollTimer);
      paymentPollTimer = null;
    }
  }

  async function copyPix(){
    const txt = $("pixCode")?.value || "";
    if (!txt) {
      alert("Nenhum código PIX disponível ainda.");
      return;
    }

    try{
      await navigator.clipboard.writeText(txt);
      alert("Código PIX copiado.");
    }catch{
      alert("Não foi possível copiar o código PIX.");
    }
  }

  function renderPixData(data){
    const qrImg = $("pixQrImage");
    const qrFallback = $("pixQrFallback");
    const pixCode = $("pixCode");

    const qrCodeBase64 = String(data?.qrCodeBase64 || data?.qr_code_base64 || "").trim();
    const qrCodeUrl = String(data?.qrCodeUrl || data?.qr_code_url || "").trim();
    const code = String(data?.pixCode || data?.copyPaste || data?.copy_paste || "").trim();

    if (pixCode) pixCode.value = code || "";

    if (!qrImg) return;

    qrImg.style.display = "none";
    qrImg.removeAttribute("src");

    if (qrCodeBase64){
      qrImg.src = qrCodeBase64.startsWith("data:")
        ? qrCodeBase64
        : ("data:image/png;base64," + qrCodeBase64);
      qrImg.style.display = "block";
      if (qrFallback) qrFallback.style.display = "none";
      return;
    }

    if (qrCodeUrl){
      qrImg.src = qrCodeUrl;
      qrImg.style.display = "block";
      if (qrFallback) qrFallback.style.display = "none";
      return;
    }

    if (qrFallback){
      qrFallback.style.display = "block";
      qrFallback.textContent = "QR Code não disponível no momento.";
    }
  }

  async function createPix(){
    setStatus("pending", statusLabel("pending"), "Gerando cobrança PIX...");

    const response = await fetch("/api/coin-orders/" + encodeURIComponent(ORDER_ID) + "/pix", {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "Accept":"application/json"
      },
      credentials: "same-origin"
    });

    const result = await readJsonOrThrow(response);

    renderPixData(result);

    const normalized = normalizeStatus(result.status);
    if (normalized === "paid") {
      setStatus("paid", statusLabel("paid"), "Pagamento já aprovado. Verificando crédito das moedas...");
      return;
    }

    setStatus(
      "pending",
      statusLabel(result.status || "pending"),
      "PIX gerado. Faça o pagamento e esta tela irá atualizar automaticamente."
    );
  }

  async function checkStatusOnce(){
    const response = await fetch("/api/coin-orders/" + encodeURIComponent(ORDER_ID) + "/status", {
      method: "GET",
      headers: { "Accept":"application/json" },
      credentials: "same-origin"
    });

    const result = await readJsonOrThrow(response);

    const status = normalizeStatus(result.status);
    const credited = !!result.credited;

    if (status === "paid") {
      if (credited) {
        setStatus(
          "paid",
          "pago",
          "Pagamento aprovado e moedas creditadas com sucesso. Redirecionando..."
        );
        stopPolling();
        setTimeout(function(){
          window.location.href = "/profile";
        }, 1800);
        return;
      }

      setStatus(
        "pending",
        "aprovado",
        "Pagamento aprovado. Aguardando liberação final das moedas..."
      );
      return;
    }

    if (status === "expired" || status === "cancelled" || status === "failed") {
      setStatus(
        "error",
        statusLabel(status),
        "O pagamento não foi aprovado. Gere um novo PIX se quiser continuar."
      );
      stopPolling();
      return;
    }

    setStatus(
      "pending",
      statusLabel(status || "pending"),
      "Aguardando confirmação do PIX..."
    );
  }

  function startPolling(){
    stopPolling();
    paymentPollTimer = setInterval(async function(){
      try{
        await checkStatusOnce();
      }catch(e){
        console.error(e);
      }
    }, 3000);
  }

  $("btnCopyPix")?.addEventListener("click", copyPix);
  $("btnRefresh")?.addEventListener("click", async function(){
    try{
      await checkStatusOnce();
    }catch(e){
      alert(e.message || "Erro ao consultar status.");
    }
  });

  (async function init(){
    try{
      await createPix();
      startPolling();
      await checkStatusOnce();
    }catch(e){
      console.error("[checkout-coins] init error:", e);
      setStatus("error", "erro", e.message || "Falha ao abrir checkout.");
    }
  })();
})();
</script>
</body>
</html>`;
}

module.exports = { renderCheckoutCoinsHtml };