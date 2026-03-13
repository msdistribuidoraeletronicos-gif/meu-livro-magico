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
<meta name="description" content="Finalize sua compra de moedas por PIX com o mesmo visual do app."/>
<style>
  :root{
    --violet-50:#f5f3ff;
    --pink-50:#fff1f2;
    --white:#ffffff;
    --gray-900:#111827;
    --gray-800:#1f2937;
    --gray-700:#374151;
    --gray-600:#4b5563;
    --gray-500:#6b7280;
    --violet-600:#7c3aed;
    --violet-700:#6d28d9;
    --pink-600:#db2777;
    --pink-700:#be185d;
    --amber-500:#f59e0b;
    --amber-300:#fcd34d;
    --violet-200:#ddd6fe;
    --green-600:#16a34a;
    --green-700:#15803d;
    --red-600:#dc2626;
    --red-700:#b91c1c;
    --shadow2: 0 12px 30px rgba(17,24,39,.10);
    --r: 22px;
  }

  *{ box-sizing:border-box; }
  html,body{ height:100%; }
  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    color: var(--gray-800);
    background: linear-gradient(180deg, var(--violet-50), var(--white) 46%, var(--pink-50));
    overflow-x:hidden;
  }

  a{ color:inherit; text-decoration:none; }
  .wrap{ max-width: 1100px; margin: 0 auto; padding: 0 16px; }

  .nav{
    padding: 16px 0;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
  }

  .brand{
    display:flex;
    align-items:center;
    gap:10px;
    font-weight:1000;
    letter-spacing:-.2px;
  }

  .brand .logo{
    width:42px;height:42px;border-radius:14px;
    display:grid;place-items:center;
    background: linear-gradient(135deg, rgba(124,58,237,.14), rgba(219,39,119,.14));
    border: 1px solid rgba(124,58,237,.18);
    box-shadow: var(--shadow2);
    font-size:20px;
  }

  .navRight{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }

  .btn{
    border:0;
    cursor:pointer;
    user-select:none;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:10px;
    padding: 14px 18px;
    border-radius: 999px;
    font-weight: 900;
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease, opacity .15s ease;
    white-space:nowrap;
    font: inherit;
  }

  .btn:active{ transform: translateY(1px); }

  .btn[disabled]{
    cursor:not-allowed;
    opacity:.72;
    filter: grayscale(.08);
  }

  .btnPrimary{
    color:#fff;
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
    box-shadow: 0 18px 40px rgba(124,58,237,.20);
  }

  .btnPrimary:hover{
    background: linear-gradient(90deg, var(--violet-700), var(--pink-700));
    box-shadow: 0 18px 46px rgba(124,58,237,.26);
  }

  .btnOutline{
    color: var(--violet-700);
    background: rgba(255,255,255,.78);
    border: 2px solid rgba(221,214,254,.95);
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
  }

  .btnOutline:hover{
    background: rgba(245,243,255,.95);
    border-color: rgba(196,181,253,.95);
  }

  .btnOrder{
    border:0;
    color:#fff;
    background: linear-gradient(90deg, var(--amber-500), var(--pink-600));
    box-shadow: 0 18px 40px rgba(245,158,11,.16);
    position:relative;
    overflow:hidden;
  }

  .btnOrder:hover{
    background: linear-gradient(90deg, var(--amber-300), var(--pink-700));
    box-shadow: 0 18px 44px rgba(245,158,11,.22);
  }

  .btnOrder .shine{
    position:absolute; inset:-40px -60px;
    background: radial-gradient(120px 60px at 20% 30%, rgba(255,255,255,.35), transparent 60%);
    transform: translateX(-40%);
    animation: shine 2.4s ease-in-out infinite;
    pointer-events:none;
    opacity:.9;
  }

  @keyframes shine{
    0%{ transform: translateX(-45%); opacity:.55; }
    45%{ transform: translateX(35%); opacity:.95; }
    100%{ transform: translateX(55%); opacity:.55; }
  }

  .hero{ padding: 16px 0 26px; }

  .panel{
    background: rgba(255,255,255,.88);
    border: 1px solid rgba(17,24,39,.06);
    border-radius: 26px;
    box-shadow: var(--shadow2);
    overflow:hidden;
    position:relative;
  }

  .panel::after{
    content:"";
    position:absolute; inset:0;
    background:
      radial-gradient(900px 240px at 70% 0%, rgba(252,211,77,.18), transparent 55%),
      radial-gradient(800px 260px at 18% 0%, rgba(124,58,237,.18), transparent 60%),
      radial-gradient(700px 260px at 85% 20%, rgba(219,39,119,.14), transparent 55%);
    pointer-events:none;
  }

  .panelIn{ position:relative; z-index:1; padding: 18px; }

  .titleRow{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
  }

  .title{
    margin:0;
    font-size: 34px;
    line-height: 1.06;
    font-weight: 1000;
    letter-spacing: -1px;
    color: var(--gray-900);
  }

  .sub{
    margin: 10px 0 0;
    color: var(--gray-600);
    font-weight: 750;
    line-height: 1.65;
    font-size: 15px;
  }

  .gradText{
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600), var(--amber-500));
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent;
  }

  .topNudges{
    display:flex;
    gap:10px;
    align-items:center;
    flex-wrap:wrap;
    justify-content:flex-end;
    margin-top: 2px;
  }

  .pill{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding: 10px 12px;
    border-radius: 999px;
    background: rgba(255,255,255,.78);
    border: 1px solid rgba(221,214,254,.95);
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
    font-weight: 950;
    color: rgba(31,41,55,.92);
    font-size: 12.5px;
    white-space:nowrap;
  }

  .pill strong{ font-weight: 1000; }

  .pillTimer{
    border-color: rgba(252,211,77,.55);
    background: rgba(252,211,77,.18);
  }

  .timerValue{
    font-variant-numeric: tabular-nums;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(255,255,255,.7);
    border: 1px solid rgba(245,158,11,.20);
  }

  .pillDanger{
    background: rgba(219,39,119,.12);
    border-color: rgba(219,39,119,.22);
  }

  .pulseDot{
    width:10px;height:10px;border-radius:999px;
    background: linear-gradient(180deg, var(--amber-500), var(--pink-600));
    box-shadow: 0 0 0 0 rgba(245,158,11,.0);
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse{
    0%{ transform: scale(.9); box-shadow: 0 0 0 0 rgba(245,158,11,.0); opacity:.95; }
    45%{ transform: scale(1.05); box-shadow: 0 0 0 10px rgba(245,158,11,.10); opacity:1; }
    100%{ transform: scale(.9); box-shadow: 0 0 0 0 rgba(245,158,11,.0); opacity:.95; }
  }

  .progress{
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 18px;
    border: 1px solid rgba(221,214,254,.90);
    background: rgba(245,243,255,.60);
  }

  .steps{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    align-items:center;
    justify-content:space-between;
  }

  .step{
    display:flex; align-items:center; gap:10px;
    font-weight: 950;
    color: rgba(55,65,81,.95);
    font-size: 12.5px;
    opacity:.9;
  }

  .stepNum{
    width:28px;height:28px;border-radius:999px;
    display:grid; place-items:center;
    background: rgba(124,58,237,.12);
    border: 1px solid rgba(124,58,237,.18);
    font-weight: 1000;
    color: rgba(109,40,217,1);
  }

  .bar{
    margin-top: 10px;
    height: 10px;
    border-radius: 999px;
    background: rgba(221,214,254,.60);
    overflow:hidden;
    border: 1px solid rgba(221,214,254,.70);
  }

  .barFill{
    height:100%;
    width: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600), var(--amber-500));
  }

  .barHint{
    margin-top: 8px;
    font-weight: 850;
    color: rgba(107,114,128,.95);
    font-size: 12.5px;
    line-height: 1.5;
  }

  .grid{
    margin-top: 14px;
    display:grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }

  @media (min-width: 980px){
    .grid{ grid-template-columns: .95fr 1.05fr; }
  }

  .card{
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(17,24,39,.06);
    border-radius: 24px;
    box-shadow: var(--shadow2);
    overflow:hidden;
  }

  .cardIn{ padding: 16px; }

  .coinHero{
    border-radius: 22px;
    overflow:hidden;
    border: 1px solid rgba(17,24,39,.06);
    background:
      radial-gradient(800px 260px at 18% 0%, rgba(124,58,237,.18), transparent 60%),
      radial-gradient(700px 260px at 85% 20%, rgba(219,39,119,.14), transparent 55%),
      linear-gradient(135deg, rgba(124,58,237,.10), rgba(219,39,119,.10));
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
    min-height: 320px;
    display:grid;
    place-items:center;
    padding: 24px;
    position:relative;
  }

  .coinHeroInner{
    text-align:center;
    max-width: 420px;
  }

  .coinEmoji{
    font-size: 64px;
    line-height:1;
    margin-bottom: 12px;
  }

  .coinBig{
    font-size: 38px;
    font-weight: 1000;
    color: var(--gray-900);
    letter-spacing: -.04em;
    line-height:1.05;
  }

  .coinSub{
    margin-top: 10px;
    color: var(--gray-600);
    font-weight: 850;
    line-height:1.6;
    font-size: 14px;
  }

  .metaLine{
    margin-top: 12px;
    color: var(--gray-600);
    font-weight: 850;
    font-size: 13.5px;
    line-height: 1.55;
  }

  .metaLine b{ color: var(--gray-900); }

  .hint{
    margin-top: 10px;
    color: rgba(75,85,99,.92);
    font-weight: 800;
    line-height: 1.6;
    font-size: 13.5px;
  }

  .coinsInfoBox{
    margin-top: 14px;
    border-radius: 18px;
    border: 1px solid rgba(221,214,254,.90);
    background: linear-gradient(180deg, rgba(245,243,255,.72), rgba(255,255,255,.92));
    padding: 14px;
  }

  .coinsInfoTop{
    display:flex;
    justify-content:space-between;
    gap:10px;
    align-items:center;
    flex-wrap:wrap;
  }

  .coinsLabel{
    font-weight:1000;
    color:var(--gray-900);
    font-size:14px;
    line-height:1.2;
  }

  .coinsBalance{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:8px 10px;
    border-radius:999px;
    background:#fff;
    border:1px solid rgba(221,214,254,.95);
    font-weight:1000;
    color:var(--violet-700);
    font-size:12.5px;
    box-shadow: 0 12px 26px rgba(17,24,39,.04);
    white-space:nowrap;
  }

  .priceBox{
    border-radius: 18px;
    border: 1px solid rgba(221,214,254,.90);
    background: rgba(245,243,255,.72);
    padding: 12px;
  }

  .priceRow{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px dashed rgba(221,214,254,.85);
    font-weight: 900;
    color: rgba(75,85,99,.95);
  }

  .priceRow:last-child{ border-bottom:0; }

  .bonusRow{
    color: var(--green-700);
  }

  .total{
    font-size: 18px;
    color: rgba(109,40,217,1);
    font-weight: 1000;
  }

  .badge{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:8px;
    padding:10px 12px;
    border-radius:999px;
    font-size:12px;
    font-weight:1000;
    border:1px solid rgba(221,214,254,.95);
    background:#fff;
    text-transform:uppercase;
    letter-spacing:.04em;
    white-space:nowrap;
  }

  .statusPending{
    color:var(--amber-500);
    background: rgba(252,211,77,.16);
    border-color: rgba(245,158,11,.18);
  }

  .statusPaid{
    color:var(--green-700);
    background: rgba(22,163,74,.10);
    border-color: rgba(22,163,74,.18);
  }

  .statusError{
    color:var(--red-700);
    background: rgba(220,38,38,.10);
    border-color: rgba(220,38,38,.18);
  }

  .pixGrid{
    margin-top: 12px;
    display:grid;
    grid-template-columns: 1fr;
    gap:14px;
  }

  @media (min-width: 760px){
    .pixGrid{ grid-template-columns: 280px 1fr; }
  }

  .pixQrBox{
    display:grid;
    gap:10px;
    justify-items:center;
    padding: 14px;
    border-radius: 20px;
    border: 1px solid rgba(221,214,254,.95);
    background: rgba(245,243,255,.55);
  }

  .pixQrImageWrap{
    width: 240px;
    height: 240px;
    max-width: 100%;
    border-radius: 18px;
    background: #fff;
    border:1px solid rgba(17,24,39,.06);
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
    display:grid;
    place-items:center;
    overflow:hidden;
    padding: 10px;
  }

  .pixQrImage{
    width:100%;
    height:100%;
    object-fit:contain;
    display:none;
  }

  .pixQrFallback{
    text-align:center;
    color: var(--gray-600);
    font-weight: 850;
    line-height:1.4;
    font-size:13px;
  }

  .pixInfo{
    display:grid;
    gap:12px;
    min-width:0;
  }

  .pixStatusBox{
    border-radius: 18px;
    border: 1px solid rgba(221,214,254,.95);
    background: rgba(255,255,255,.88);
    padding: 12px;
  }

  .pixStatusTitle{
    font-size: 12.5px;
    font-weight: 950;
    color: rgba(75,85,99,.95);
  }

  .pixStatusValue{
    margin-top: 6px;
    font-size: 18px;
    font-weight: 1000;
    color: var(--gray-900);
  }

  .pixStatusHint{
    margin-top: 6px;
    color: var(--gray-600);
    font-size: 12.5px;
    font-weight: 850;
    line-height: 1.5;
  }

  .copyBox{
    display:grid;
    gap:8px;
    min-width:0;
  }

  .copyRow{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    align-items:center;
  }

  .tinyNote{
    font-size:12px;
    color: var(--gray-500);
    font-weight: 850;
    line-height:1.45;
  }

  textarea{
    width:100%;
    min-height:120px;
    border-radius:16px;
    border:1px solid rgba(221,214,254,.95);
    background: rgba(255,255,255,.78);
    color: var(--gray-800);
    padding:12px 14px;
    font:inherit;
    resize:vertical;
    outline:none;
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
  }

  #pixCode{
    min-height: 110px;
    max-height: 180px;
    overflow:auto;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .actions{
    margin-top: 12px;
    display:flex;
    gap: 10px;
    flex-wrap:wrap;
    align-items:center;
  }

  .msg{
    margin-top: 10px;
    color: rgba(75,85,99,.92);
    font-weight: 800;
    line-height: 1.6;
    font-size: 13.5px;
  }

  .toast{
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 99998;
    width: min(380px, calc(100vw - 32px));
    border-radius: 18px;
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(221,214,254,.95);
    box-shadow: 0 18px 44px rgba(17,24,39,.14);
    padding: 12px 12px;
    display:none;
    overflow:hidden;
  }

  .toast::after{
    content:"";
    position:absolute; inset:0;
    background:
      radial-gradient(320px 120px at 10% 0%, rgba(124,58,237,.14), transparent 60%),
      radial-gradient(320px 120px at 90% 20%, rgba(219,39,119,.12), transparent 60%);
    pointer-events:none;
  }

  .toastIn{ position:relative; z-index:1; display:flex; gap:10px; align-items:flex-start; }

  .toastIcon{
    width:38px;height:38px;border-radius:14px;
    display:grid;place-items:center;
    background: rgba(124,58,237,.10);
    border:1px solid rgba(124,58,237,.18);
    flex:0 0 auto;
  }

  .toastTitle{ font-weight:1000; color:#111827; font-size:13px; line-height:1.25; }
  .toastText{ margin-top:4px; font-weight:850; color:#6b7280; font-size:12.5px; line-height:1.35; }

  .toastClose{
    margin-left:auto;
    border:0;
    background: rgba(0,0,0,.04);
    border:1px solid rgba(0,0,0,.06);
    border-radius: 999px;
    padding: 8px 10px;
    cursor:pointer;
    font-weight:1000;
    color:#374151;
    flex:0 0 auto;
  }

  @media (max-width: 760px){
    .copyRow{
      flex-direction:column;
      align-items:stretch;
    }

    .copyRow .btn{
      width:100%;
      justify-content:center;
    }

    .title{
      font-size: 28px;
    }

    .coinBig{
      font-size: 32px;
    }

    .pixQrImageWrap{
      width: min(220px, 100%);
      height: min(220px, calc(100vw - 90px));
    }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="nav">
      <div class="brand">
        <div class="logo">🪙</div>
        <div>Meu Livro Mágico</div>
      </div>

      <div class="navRight">
        <a class="btn btnOutline" href="/profile">← Voltar ao perfil</a>
      </div>
    </div>
  </div>

  <section class="hero">
    <div class="wrap">
      <div class="panel">
        <div class="panelIn">

          <div class="titleRow">
            <div>
              <h1 class="title">Finalizar compra de <span class="gradText">moedas</span></h1>
              <p class="sub">
                Faça o pagamento por PIX e, após a confirmação, as moedas serão creditadas automaticamente na sua conta.
              </p>
            </div>

            <div class="topNudges">
              <div class="pill" title="Compra digital">
                <span class="pulseDot" aria-hidden="true"></span>
                <strong>Compra segura</strong> • crédito automático
              </div>
              <div id="pillTimer" class="pill pillTimer" title="Tempo estimado para pagamento do PIX">
                ⏳ Tempo: <span class="timerValue" id="timerValue">--:--</span>
              </div>
            </div>
          </div>

          <div class="progress" aria-label="Progresso da compra">
            <div class="steps">
              <div class="step"><span class="stepNum">1</span> Resumo</div>
              <div class="step"><span class="stepNum">2</span> PIX</div>
              <div class="step"><span class="stepNum">3</span> Crédito</div>
            </div>
            <div class="bar" aria-hidden="true">
              <div class="barFill"></div>
            </div>
            <div class="barHint">
              ✅ Assim que o pagamento for confirmado, suas moedas entram na conta automaticamente.
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="cardIn">
                <div class="coinHero">
                  <div class="coinHeroInner">
                    <div class="coinEmoji">🪙✨</div>
                    <div class="coinBig">${fmtCoins(credit)}</div>
                    <div class="coinSub">
                      Este é o total que será creditado na sua conta depois da aprovação do pagamento.
                    </div>
                  </div>
                </div>

                <div class="metaLine">
                  <div><b>Pedido:</b> ${esc(orderId || "-")}</div>
                  <div><b>Pacote base:</b> ${fmtCoins(pack)}</div>
                  <div><b>Bônus:</b> ${fmtCoins(bonus)}</div>
                </div>

                <div class="hint">
                  🧡 As moedas ficam vinculadas à sua conta e podem ser usadas dentro do app. <br>
                  ⚡ O crédito acontece automaticamente assim que o PIX for aprovado. <br>
                  🔒 Todo o processo é feito com confirmação segura antes da liberação.
                </div>

                <div class="coinsInfoBox">
                  <div class="coinsInfoTop">
                    <div class="coinsLabel">Resumo rápido</div>
                    <div class="coinsBalance">Total de crédito: ${fmtCoins(credit)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="cardIn">
                <div class="priceBox" aria-label="Resumo de valores">
                  <div class="priceRow">
                    <span>Pacote de moedas</span>
                    <span>${fmtCoins(pack)}</span>
                  </div>

                  <div class="priceRow bonusRow">
                    <span>Bônus promocional</span>
                    <span>+ ${fmtCoins(bonus)}</span>
                  </div>

                  <div class="priceRow">
                    <span>Preço</span>
                    <span>${moneyBR(price)}</span>
                  </div>

                  <div class="priceRow">
                    <span>Status</span>
                    <span id="statusBadge" class="badge statusPending">${esc(status)}</span>
                  </div>

                  <div class="priceRow">
                    <span class="total">Total que entra na conta</span>
                    <span class="total">${fmtCoins(credit)}</span>
                  </div>
                </div>

                <div class="pixGrid">
                  <div class="pixQrBox">
                    <div class="pixQrImageWrap">
                      <img id="pixQrImage" class="pixQrImage" alt="QR Code PIX"/>
                      <div id="pixQrFallback" class="pixQrFallback">Gerando QR Code...</div>
                    </div>

                    <div class="tinyNote">
                      O crédito das moedas acontece somente após a confirmação do pagamento.
                    </div>
                  </div>

                  <div class="pixInfo">
                    <div class="pixStatusBox">
                      <div class="pixStatusTitle">Status do pagamento</div>
                      <div class="pixStatusValue" id="pixStatusValue">Aguardando geração do PIX...</div>
                      <div class="pixStatusHint" id="statusText">
                        Assim que o QR Code for gerado, você poderá pagar pelo app do seu banco.
                      </div>
                    </div>

                    <div class="copyBox">
                      <label for="pixCode" style="font-weight:1000;">Código PIX (copia e cola)</label>
                      <textarea id="pixCode" readonly placeholder="O código PIX aparecerá aqui"></textarea>

                      <div class="copyRow">
                        <button type="button" class="btn btnOrder" id="btnCopyPix">
                          <span class="shine" aria-hidden="true"></span>
                          📋 Copiar código PIX
                        </button>
                        <button type="button" class="btn btnOutline" id="btnRefresh">🔄 Verificar pagamento</button>
                      </div>

                      <div class="tinyNote">
                        Depois de pagar, a tela verifica automaticamente. Você também pode clicar em “Verificar pagamento”.
                      </div>
                    </div>
                  </div>
                </div>

                <div class="msg" id="msg">
                  ⏳ Preparando cobrança PIX...
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </section>

  <div class="toast" id="toast" role="status" aria-live="polite" aria-atomic="true">
    <div class="toastIn">
      <div class="toastIcon">✨</div>
      <div>
        <div class="toastTitle" id="toastTitle">Aviso</div>
        <div class="toastText" id="toastText">Mensagem</div>
      </div>
      <button class="toastClose" id="toastClose" type="button">OK</button>
    </div>
  </div>

<script>
(function(){
  const ORDER_ID = ${JSON.stringify(orderId)};
  let paymentPollTimer = null;

  function $(id){ return document.getElementById(id); }

  function showToast(title, text){
    const toast = $("toast");
    const tTitle = $("toastTitle");
    const tText = $("toastText");
    const close = $("toastClose");
    if (!toast) return;

    if (tTitle) tTitle.textContent = title || "Aviso";
    if (tText) tText.textContent = text || "";

    toast.style.display = "block";

    const hide = function(){ toast.style.display = "none"; };
    if (close) close.onclick = hide;

    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(hide, 5200);
  }

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
      throw new Error(
        data?.error === "not_logged_in"
          ? "Sua sessão expirou. Faça login novamente."
          : "Acesso não autorizado."
      );
    }

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Falha na comunicação com o servidor.");
    }

    return data;
  }

  function setStatus(kind, text, hint){
    const badge = $("statusBadge");
    const st = $("statusText");
    const value = $("pixStatusValue");
    const msg = $("msg");

    if (badge){
      badge.className = "badge " + (
        kind === "paid" ? "statusPaid" :
        kind === "error" ? "statusError" :
        "statusPending"
      );
      badge.textContent = text || "";
    }

    if (value){
      value.textContent = text || "";
      value.style.color =
        kind === "paid" ? "var(--green-600)" :
        kind === "error" ? "var(--red-600)" :
        "var(--amber-500)";
    }

    if (st) st.textContent = hint || "";

    if (msg){
      msg.textContent = hint || "";
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
      showToast("PIX", "Nenhum código PIX disponível ainda.");
      return;
    }

    try{
      await navigator.clipboard.writeText(txt);
      showToast("Copiado ✅", "Código PIX copiado com sucesso.");
    }catch{
      showToast("Erro", "Não foi possível copiar o código PIX.");
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

  function getOrCreateTimerEnd(){
    const key = "mlm_coin_checkout_timer_" + ORDER_ID;
    const now = Date.now();
    const stored = Number(localStorage.getItem(key) || 0);
    if (stored && Number.isFinite(stored) && stored > now + 5000) return stored;

    const end = now + 15 * 60 * 1000;
    try { localStorage.setItem(key, String(end)); } catch(e){}
    return end;
  }

  function pad2(n){ return String(Math.max(0, n|0)).padStart(2,"0"); }

  function renderTimer(){
    const end = getOrCreateTimerEnd();
    const now = Date.now();
    const left = Math.max(0, end - now);
    const s = Math.ceil(left/1000);

    const mm = Math.floor(s/60);
    const ss = s % 60;

    const tv = $("timerValue");
    if (tv) tv.textContent = pad2(mm) + ":" + pad2(ss);

    const pill = $("pillTimer");
    if (pill){
      if (s <= 180){
        pill.classList.add("pillDanger");
      } else {
        pill.classList.remove("pillDanger");
      }
    }

    if (s <= 0){
      try { localStorage.removeItem("mlm_coin_checkout_timer_" + ORDER_ID); } catch(e){}
      if (tv) tv.textContent = "00:00";
    }
  }

  $("btnCopyPix")?.addEventListener("click", copyPix);

  $("btnRefresh")?.addEventListener("click", async function(){
    try{
      await checkStatusOnce();
    }catch(e){
      showToast("Erro", e.message || "Erro ao consultar status.");
    }
  });

  renderTimer();
  setInterval(renderTimer, 250);

  (async function init(){
    try{
      await createPix();
      startPolling();
      await checkStatusOnce();
    }catch(e){
      console.error("[checkout-coins] init error:", e);
      setStatus("error", "erro", e.message || "Falha ao abrir checkout.");
      showToast("Erro", e.message || "Falha ao abrir checkout.");
    }
  })();
})();
</script>
</body>
</html>`;
}

module.exports = { renderCheckoutCoinsHtml };