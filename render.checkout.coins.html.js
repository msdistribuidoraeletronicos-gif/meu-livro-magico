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
<meta name="description" content="Finalize sua compra de moedas por PIX com o mesmo visual do Meu Livro Mágico."/>
<style>
  :root{
    --violet-50:#f5f3ff;
    --pink-50:#fff1f2;
    --white:#ffffff;

    --gray-950:#030712;
    --gray-900:#111827;
    --gray-850:#172033;
    --gray-800:#1f2937;
    --gray-700:#374151;
    --gray-600:#4b5563;
    --gray-500:#6b7280;
    --gray-400:#9ca3af;

    --violet-200:#ddd6fe;
    --violet-400:#a78bfa;
    --violet-500:#8b5cf6;
    --violet-600:#7c3aed;
    --violet-700:#6d28d9;

    --pink-500:#ec4899;
    --pink-600:#db2777;
    --pink-700:#be185d;

    --amber-300:#fcd34d;
    --amber-400:#fbbf24;
    --amber-500:#f59e0b;

    --green-500:#22c55e;
    --green-600:#16a34a;
    --green-700:#15803d;

    --red-500:#ef4444;
    --red-600:#dc2626;
    --red-700:#b91c1c;

    --blue-500:#3b82f6;
    --blue-600:#2563eb;

    --shadow2: 0 12px 30px rgba(17,24,39,.10);
    --shadow3: 0 18px 44px rgba(17,24,39,.18);
    --r: 22px;

    color-scheme: dark;
  }

  *{ box-sizing:border-box; }
  html,body{ height:100%; }

  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    color: #e5e7eb;
    background:
      radial-gradient(900px 260px at 8% 0%, rgba(124,58,237,.20), transparent 55%),
      radial-gradient(760px 280px at 95% 5%, rgba(219,39,119,.14), transparent 55%),
      radial-gradient(700px 260px at 50% 100%, rgba(59,130,246,.10), transparent 55%),
      linear-gradient(180deg, #0b1020, #0f172a 42%, #0a1020);
    overflow-x:hidden;
  }

  a{ color:inherit; text-decoration:none; }
  button, input, textarea{ font:inherit; }

  .wrap{
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 16px;
  }

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
    color:#fff;
  }

  .brand .logo{
    width:42px;height:42px;border-radius:14px;
    display:grid;place-items:center;
    background: linear-gradient(135deg, rgba(124,58,237,.24), rgba(219,39,119,.20));
    border: 1px solid rgba(167,139,250,.26);
    box-shadow: 0 16px 32px rgba(0,0,0,.22);
    font-size:20px;
  }

  .navRight{
    display:flex;
    gap:10px;
    align-items:center;
    flex-wrap:wrap;
  }

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
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease, opacity .15s ease, border-color .15s ease;
    white-space:nowrap;
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
    color: #ddd6fe;
    background: rgba(17,24,39,.58);
    border: 1px solid rgba(167,139,250,.22);
    box-shadow: 0 12px 26px rgba(0,0,0,.18);
  }
  .btnOutline:hover{
    background: rgba(31,41,55,.72);
    border-color: rgba(196,181,253,.34);
  }

  .hero{
    padding: 10px 0 28px;
  }

  .panel{
    background: rgba(11,16,32,.86);
    border: 1px solid rgba(255,255,255,.06);
    border-radius: 28px;
    box-shadow: 0 30px 80px rgba(0,0,0,.28);
    overflow:hidden;
    position:relative;
    backdrop-filter: blur(10px);
  }

  .panel::after{
    content:"";
    position:absolute; inset:0;
    background:
      radial-gradient(900px 240px at 78% 0%, rgba(252,211,77,.10), transparent 55%),
      radial-gradient(800px 260px at 18% 0%, rgba(124,58,237,.16), transparent 60%),
      radial-gradient(700px 260px at 85% 20%, rgba(219,39,119,.12), transparent 55%);
    pointer-events:none;
  }

  .panelIn{
    position:relative;
    z-index:1;
    padding: 18px;
  }

  .titleRow{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
  }

  .title{
    margin:0;
    font-size: 36px;
    line-height: 1.04;
    font-weight: 1000;
    letter-spacing: -1px;
    color: #fff;
  }

  .gradText{
    background: linear-gradient(90deg, var(--violet-400), var(--pink-500), var(--amber-400));
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent;
  }

  .sub{
    margin: 10px 0 0;
    color: #cbd5e1;
    font-weight: 750;
    line-height: 1.65;
    font-size: 15px;
    max-width: 760px;
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
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(167,139,250,.20);
    box-shadow: 0 12px 26px rgba(0,0,0,.16);
    font-weight: 950;
    color: rgba(255,255,255,.92);
    font-size: 12.5px;
    white-space:nowrap;
  }
  .pill strong{ font-weight:1000; }

  .pillSuccess{
    border-color: rgba(34,197,94,.24);
    background: rgba(34,197,94,.10);
    color: #dcfce7;
  }

  .pillTimer{
    border-color: rgba(251,191,36,.28);
    background: rgba(251,191,36,.12);
  }

  .timerValue{
    font-variant-numeric: tabular-nums;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(245,158,11,.18);
  }

  .pillDanger{
    background: rgba(239,68,68,.12);
    border-color: rgba(239,68,68,.24);
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
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 18px;
    border: 1px solid rgba(167,139,250,.18);
    background: rgba(255,255,255,.04);
  }

  .steps{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    align-items:center;
    justify-content:space-between;
  }

  .step{
    display:flex;
    align-items:center;
    gap:10px;
    font-weight:950;
    color: rgba(255,255,255,.90);
    font-size: 12.5px;
    opacity:.95;
  }

  .stepNum{
    width:28px;height:28px;border-radius:999px;
    display:grid; place-items:center;
    background: rgba(124,58,237,.14);
    border: 1px solid rgba(167,139,250,.22);
    font-weight: 1000;
    color: #ddd6fe;
  }

  .bar{
    margin-top: 10px;
    height: 10px;
    border-radius: 999px;
    background: rgba(255,255,255,.06);
    overflow:hidden;
    border: 1px solid rgba(255,255,255,.06);
  }

  .barFill{
    height:100%;
    width: 15%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--blue-500), var(--violet-600), var(--pink-600), var(--amber-500));
    transition: width .18s ease;
  }

  .barHint{
    margin-top: 8px;
    font-weight: 850;
    color: #cbd5e1;
    font-size: 12.5px;
    line-height: 1.5;
  }

  .grid{
    margin-top: 16px;
    display:grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }

  @media (min-width: 980px){
    .grid{ grid-template-columns: .92fr 1.08fr; }
  }

  .card{
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.06);
    border-radius: 24px;
    box-shadow: 0 20px 46px rgba(0,0,0,.18);
    overflow:hidden;
    backdrop-filter: blur(8px);
  }

  .cardIn{ padding: 16px; }

  .walletHero{
    border-radius: 22px;
    overflow:hidden;
    border: 1px solid rgba(255,255,255,.06);
    background:
      radial-gradient(700px 200px at 10% 0%, rgba(59,130,246,.16), transparent 55%),
      radial-gradient(700px 220px at 90% 0%, rgba(124,58,237,.24), transparent 60%),
      linear-gradient(135deg, rgba(17,24,39,.88), rgba(31,41,55,.92));
    box-shadow: 0 12px 26px rgba(0,0,0,.18);
    min-height: 320px;
    padding: 22px;
    display:flex;
    flex-direction:column;
    justify-content:space-between;
    gap:16px;
    position:relative;
  }

  .walletHero::after{
    content:"";
    position:absolute;
    inset:0;
    background:
      radial-gradient(440px 140px at 50% 100%, rgba(219,39,119,.08), transparent 60%);
    pointer-events:none;
  }

  .walletHeroTop,
  .walletHeroBottom{
    position:relative;
    z-index:1;
  }

  .walletMini{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding: 8px 12px;
    border-radius:999px;
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.10);
    color: #e5e7eb;
    font-weight:1000;
    font-size:12.5px;
  }

  .walletBig{
    font-size: 40px;
    line-height: 1.02;
    font-weight: 1000;
    color:#fff;
    letter-spacing:-1px;
    margin-top:10px;
  }

  .walletSub{
    margin-top:10px;
    color:#cbd5e1;
    font-weight:800;
    line-height:1.65;
    font-size:14px;
    max-width: 520px;
  }

  .walletStats{
    display:grid;
    grid-template-columns:1fr;
    gap:10px;
  }

  .miniStat{
    display:flex;
    justify-content:space-between;
    gap:10px;
    align-items:center;
    padding: 12px 14px;
    border-radius:18px;
    background: rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.08);
  }

  .miniStatLabel{
    color:#cbd5e1;
    font-weight:850;
    font-size:12.5px;
  }

  .miniStatValue{
    color:#fff;
    font-weight:1000;
    font-size:14px;
  }

  .metaLine{
    margin-top: 12px;
    color: #cbd5e1;
    font-weight: 850;
    font-size: 13.5px;
    line-height: 1.55;
  }

  .metaLine b{ color:#fff; }

  .hint{
    margin-top: 12px;
    color: #cbd5e1;
    font-weight: 800;
    line-height: 1.65;
    font-size: 13.5px;
  }

  .statusPanel{
    display:grid;
    gap:12px;
  }

  .statusBadgeWrap{
    display:flex;
    align-items:center;
    gap:10px;
    flex-wrap:wrap;
  }

  .badge{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding: 10px 12px;
    border-radius:999px;
    font-size:12px;
    font-weight:1000;
    border:1px solid rgba(255,255,255,.08);
    background: rgba(255,255,255,.06);
    text-transform:uppercase;
    letter-spacing:.04em;
  }

  .statusPending{
    color:#fde68a;
    border-color: rgba(251,191,36,.24);
    background: rgba(251,191,36,.10);
  }

  .statusPaid{
    color:#dcfce7;
    border-color: rgba(34,197,94,.24);
    background: rgba(34,197,94,.10);
  }

  .statusError{
    color:#fecaca;
    border-color: rgba(239,68,68,.24);
    background: rgba(239,68,68,.10);
  }

  .summaryBox{
    border-radius: 18px;
    border: 1px solid rgba(167,139,250,.18);
    background: rgba(255,255,255,.04);
    padding: 12px;
  }

  .priceRow{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px dashed rgba(255,255,255,.10);
    font-weight: 900;
    color: #dbe4f0;
  }

  .priceRow:last-child{ border-bottom:0; }

  .rowStrong{
    color:#fff;
  }

  .bonusRow{
    color:#86efac;
  }

  .total{
    font-size: 19px;
    color: #ddd6fe;
    font-weight: 1000;
  }

  .mutedSmall{
    font-weight: 850;
    color: #94a3b8;
    font-size: 12.5px;
  }

  .pixGrid{
    margin-top: 14px;
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
    border: 1px solid rgba(167,139,250,.18);
    background: rgba(255,255,255,.04);
  }

  .pixQrImageWrap{
    width: 240px;
    height: 240px;
    max-width: 100%;
    border-radius: 18px;
    background: #fff;
    border:1px solid rgba(17,24,39,.06);
    box-shadow: 0 12px 26px rgba(0,0,0,.22);
    display:grid;
    place-items:center;
    overflow:hidden;
    padding: 10px;
    position:relative;
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

  .skeleton{
    position:relative;
    overflow:hidden;
    background: linear-gradient(90deg, rgba(226,232,240,.92), rgba(241,245,249,.98), rgba(226,232,240,.92));
  }

  .skeleton::after{
    content:"";
    position:absolute;
    inset:0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.66), transparent);
    animation: shimmer 1.15s infinite;
  }

  @keyframes shimmer{
    100%{ transform: translateX(100%); }
  }

  .pixInfo{
    display:grid;
    gap:12px;
    min-width:0;
  }

  .pixStatusBox{
    border-radius: 18px;
    border: 1px solid rgba(167,139,250,.18);
    background: rgba(255,255,255,.04);
    padding: 12px;
  }

  .pixStatusTitle{
    font-size: 12.5px;
    font-weight: 950;
    color: #cbd5e1;
  }

  .pixStatusValue{
    margin-top: 6px;
    font-size: 18px;
    font-weight: 1000;
    color: #fff;
  }

  .pixStatusHint{
    margin-top: 6px;
    color: #cbd5e1;
    font-size: 12.5px;
    font-weight: 850;
    line-height: 1.55;
  }

  .pixStatusPending{ color: #fcd34d; }
  .pixStatusPaid{ color: #4ade80; }
  .pixStatusError{ color: #f87171; }

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
    color: #94a3b8;
    font-weight: 850;
    line-height:1.45;
  }

  textarea{
    width:100%;
    min-height:120px;
    border-radius:16px;
    border:1px solid rgba(167,139,250,.18);
    background: rgba(15,23,42,.72);
    color:#e5e7eb;
    padding:12px 14px;
    resize:vertical;
    outline:none;
    box-shadow: 0 12px 26px rgba(0,0,0,.16);
  }

  textarea::placeholder{ color:#94a3b8; }

  .actions{
    margin-top: 12px;
    display:flex;
    gap: 10px;
    flex-wrap:wrap;
    align-items:center;
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

  .toast{
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 99998;
    width: min(380px, calc(100vw - 32px));
    border-radius: 18px;
    background: rgba(15,23,42,.94);
    border: 1px solid rgba(167,139,250,.20);
    box-shadow: 0 18px 44px rgba(0,0,0,.26);
    padding: 12px 12px;
    display:none;
    overflow:hidden;
    backdrop-filter: blur(10px);
  }

  .toast::after{
    content:"";
    position:absolute; inset:0;
    background:
      radial-gradient(320px 120px at 10% 0%, rgba(124,58,237,.14), transparent 60%),
      radial-gradient(320px 120px at 90% 20%, rgba(219,39,119,.12), transparent 60%);
    pointer-events:none;
  }

  .toastIn{
    position:relative;
    z-index:1;
    display:flex;
    gap:10px;
    align-items:flex-start;
  }

  .toastIcon{
    width:38px;height:38px;border-radius:14px;
    display:grid;place-items:center;
    background: rgba(124,58,237,.12);
    border:1px solid rgba(124,58,237,.20);
    flex:0 0 auto;
  }

  .toastTitle{
    font-weight:1000;
    color:#fff;
    font-size:13px;
    line-height:1.25;
  }

  .toastText{
    margin-top:4px;
    font-weight:850;
    color:#cbd5e1;
    font-size:12.5px;
    line-height:1.35;
  }

  .toastClose{
    margin-left:auto;
    border:0;
    background: rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.08);
    border-radius: 999px;
    padding: 8px 10px;
    cursor:pointer;
    font-weight:1000;
    color:#e5e7eb;
    flex:0 0 auto;
  }

  .emptyState{
    margin-top: 10px;
    padding: 14px;
    border-radius: 18px;
    border: 1px dashed rgba(167,139,250,.18);
    background: rgba(255,255,255,.03);
    color:#cbd5e1;
    line-height:1.6;
    font-weight:850;
  }

  @media (max-width: 760px){
    .title{
      font-size: 30px;
    }

    .panelIn{
      padding: 14px;
    }

    .walletBig{
      font-size: 34px;
    }

    .pixGrid{
      grid-template-columns: 1fr;
      gap:12px;
    }

    .pixQrBox{
      padding: 12px;
    }

    .pixQrImageWrap{
      width: min(220px, 100%);
      height: min(220px, calc(100vw - 90px));
    }

    .copyRow{
      flex-direction:column;
      align-items:stretch;
    }

    .copyRow .btn{
      width:100%;
      justify-content:center;
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
                Confira o pacote escolhido, gere o PIX e aguarde a confirmação. Assim que o pagamento for aprovado,
                as moedas entram automaticamente na sua conta.
              </p>
            </div>

            <div class="topNudges">
              <div class="pill pillSuccess">
                <span>🔒</span>
                <strong>Ambiente seguro</strong>
              </div>

              <div id="pillTimer" class="pill pillTimer" title="Tempo recomendado para concluir o PIX">
                ⏳ Janela ativa: <span class="timerValue" id="timerValue">--:--</span>
              </div>
            </div>
          </div>

          <div class="progress" aria-label="Progresso do checkout">
            <div class="steps">
              <div class="step"><span class="stepNum">1</span> Revisar</div>
              <div class="step"><span class="stepNum">2</span> Gerar PIX</div>
              <div class="step"><span class="stepNum">3</span> Confirmar</div>
            </div>

            <div class="bar" aria-hidden="true">
              <div class="barFill" id="barFill"></div>
            </div>

            <div class="barHint" id="barHint">
              ✅ Seu pedido já está pronto. Agora basta <b>gerar o PIX</b> e concluir o pagamento.
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="cardIn">

                <div class="walletHero">
                  <div class="walletHeroTop">
                    <div class="walletMini">🪙 Compra de moedas</div>
                    <div class="walletBig">${fmtCoins(credit)}</div>
                    <div class="walletSub">
                      Esse é o total que será creditado na sua conta após a aprovação do pagamento,
                      já considerando o pacote e o bônus.
                    </div>
                  </div>

                  <div class="walletHeroBottom">
                    <div class="walletStats">
                      <div class="miniStat">
                        <div class="miniStatLabel">Pacote base</div>
                        <div class="miniStatValue">${fmtCoins(pack)}</div>
                      </div>

                      <div class="miniStat">
                        <div class="miniStatLabel">Bônus promocional</div>
                        <div class="miniStatValue">${fmtCoins(bonus)}</div>
                      </div>

                      <div class="miniStat">
                        <div class="miniStatLabel">Valor do pagamento</div>
                        <div class="miniStatValue">${moneyBR(price)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="metaLine">
                  <div><b>Pedido:</b> ${esc(orderId)}</div>
                  <div><b>Status inicial:</b> ${esc(status)}</div>
                </div>

                <div class="hint">
                  💜 As moedas são creditadas somente depois da confirmação do pagamento.<br/>
                  ⚡ Assim que o PIX for aprovado, este checkout atualiza sozinho.<br/>
                  🎯 Você poderá usar as moedas no app sem precisar fazer nada manualmente.
                </div>
              </div>
            </div>

            <div class="card">
              <div class="cardIn">

                <div class="statusPanel">
                  <div class="statusBadgeWrap">
                    <div id="statusBadge" class="badge statusPending">${esc(status)}</div>
                    <div class="pill">
                      <span class="pulseDot" aria-hidden="true"></span>
                      <strong>Pedido ativo</strong> • aguardando ação
                    </div>
                  </div>
                </div>

                <div class="summaryBox" aria-label="Resumo da compra" style="margin-top:14px;">
                  <div class="priceRow">
                    <span>Pacote</span>
                    <span class="rowStrong">${fmtCoins(pack)}</span>
                  </div>

                  <div class="priceRow bonusRow">
                    <span>Bônus</span>
                    <span>+ ${fmtCoins(bonus)}</span>
                  </div>

                  <div class="priceRow">
                    <span>Preço</span>
                    <span>${moneyBR(price)}</span>
                  </div>

                  <div class="priceRow">
                    <span class="total">Total que entra na conta</span>
                    <span class="total">${fmtCoins(credit)}</span>
                  </div>

                  <div class="mutedSmall" style="margin-top:8px;">
                    🔒 O crédito só é liberado quando o pagamento for confirmado.
                  </div>
                </div>

                <div class="pixGrid">
                  <div class="pixQrBox">
                    <div class="pixQrImageWrap">
                      <img id="pixQrImage" class="pixQrImage" alt="QR Code PIX"/>
                      <div id="pixQrFallback" class="pixQrFallback skeleton" style="width:100%;height:100%;border-radius:12px;display:grid;place-items:center;">
                        Gerando QR Code...
                      </div>
                    </div>

                    <div class="tinyNote">
                      Escaneie com o app do seu banco ou use o código copia e cola.
                    </div>
                  </div>

                  <div class="pixInfo">
                    <div class="pixStatusBox">
                      <div class="pixStatusTitle">Status do pagamento</div>
                      <div class="pixStatusValue pixStatusPending" id="pixStatusValue">Preparando cobrança PIX...</div>
                      <div class="pixStatusHint" id="statusText">
                        Assim que o pagamento for confirmado, as moedas serão liberadas automaticamente.
                      </div>
                    </div>

                    <div class="copyBox">
                      <label for="pixCode" style="font-weight:1000; color:#fff;">Código PIX</label>
                      <textarea id="pixCode" readonly placeholder="O código PIX aparecerá aqui"></textarea>

                      <div class="copyRow">
                        <button type="button" class="btn btnOrder" id="btnCopyPix">
                          <span class="shine" aria-hidden="true"></span>
                          📋 Copiar código PIX
                        </button>

                        <button type="button" class="btn btnOutline" id="btnRefresh">
                          🔄 Verificar pagamento
                        </button>
                      </div>

                      <div class="tinyNote">
                        Depois que você pagar, a tela verifica automaticamente. Você também pode clicar em
                        <b>“Verificar pagamento”</b>.
                      </div>
                    </div>
                  </div>
                </div>

                <div class="actions">
                  <button class="btn btnPrimary" id="btnGeneratePix" type="button">✅ Gerar PIX agora</button>
                  <a class="btn btnOutline" href="/profile">Voltar</a>
                </div>

                <div class="emptyState" id="emptyState">
                  Ainda não geramos sua cobrança PIX. Clique em <b>“Gerar PIX agora”</b> para continuar.
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
        <div class="toastTitle" id="toastTitle">Tudo certo</div>
        <div class="toastText" id="toastText">Seu checkout está pronto para o pagamento.</div>
      </div>
      <button class="toastClose" id="toastClose" type="button">OK</button>
    </div>
  </div>

<script>
(function(){
  const ORDER_ID = ${JSON.stringify(orderId)};
  const TIMER_KEY = "mlm_coin_checkout_timer_" + ORDER_ID;

  let paymentPollTimer = null;
  let isCreatingPix = false;
  let isCheckingStatus = false;
  let hasPixGenerated = false;

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

  function showToast(title, text){
    const toast = $("toast");
    const tTitle = $("toastTitle");
    const tText = $("toastText");
    const close = $("toastClose");
    if (!toast) return;

    if (tTitle) tTitle.textContent = title || "Aviso";
    if (tText) tText.textContent = text || "";

    toast.style.display = "block";

    const hide = ()=>{ toast.style.display = "none"; };
    if (close) close.onclick = hide;

    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(hide, 5200);
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

  function setProgress(pct, text){
    const bar = $("barFill");
    const hint = $("barHint");
    if (bar) bar.style.width = Math.max(10, Math.min(100, Number(pct || 0))) + "%";
    if (hint && text) hint.innerHTML = text;
  }

  function setStatus(kind, text, hint){
    const badge = $("statusBadge");
    const st = $("statusText");
    const pv = $("pixStatusValue");
    const emptyState = $("emptyState");

    if (badge){
      badge.className = "badge " + (
        kind === "paid" ? "statusPaid" :
        kind === "error" ? "statusError" :
        "statusPending"
      );
      badge.textContent = text || "";
    }

    if (pv){
      pv.classList.remove("pixStatusPending", "pixStatusPaid", "pixStatusError");
      if (kind === "paid") pv.classList.add("pixStatusPaid");
      else if (kind === "error") pv.classList.add("pixStatusError");
      else pv.classList.add("pixStatusPending");
      pv.textContent = text || "";
    }

    if (st) st.textContent = hint || "";

    if (emptyState) {
      if (hasPixGenerated) {
        emptyState.style.display = "none";
      } else {
        emptyState.style.display = "block";
      }
    }
  }

  function stopPolling(){
    if (paymentPollTimer){
      clearInterval(paymentPollTimer);
      paymentPollTimer = null;
    }
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

  function setGeneratePixBusy(isBusy){
    const btn = $("btnGeneratePix");
    if (!btn) return;
    btn.disabled = !!isBusy;
    btn.textContent = isBusy ? "⏳ Gerando PIX..." : "✅ Gerar PIX agora";
  }

  function setRefreshBusy(isBusy){
    const btn = $("btnRefresh");
    if (!btn) return;
    btn.disabled = !!isBusy;
  }

  function getOrCreateTimerEnd(){
    const now = Date.now();
    const stored = Number(localStorage.getItem(TIMER_KEY) || 0);
    if (stored && Number.isFinite(stored) && stored > now + 5000) return stored;

    const end = now + 15 * 60 * 1000;
    try { localStorage.setItem(TIMER_KEY, String(end)); } catch(e){}
    return end;
  }

  function pad2(n){ return String(Math.max(0, n|0)).padStart(2,"0"); }

  function renderTimer(){
    const end = getOrCreateTimerEnd();
    const now = Date.now();
    const left = Math.max(0, end - now);
    const s = Math.ceil(left / 1000);

    const mm = Math.floor(s / 60);
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
      try { localStorage.removeItem(TIMER_KEY); } catch(e){}
      if (tv) tv.textContent = "00:00";
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

    const qrCodeBase64 = String(
      data?.qrCodeBase64 ||
      data?.qr_code_base64 ||
      data?.qrCodeImageBase64 ||
      ""
    ).trim();

    const qrCodeUrl = String(
      data?.qrCodeUrl ||
      data?.qr_code_url ||
      data?.qrCodeImageUrl ||
      ""
    ).trim();

    const code = String(
      data?.pixCode ||
      data?.copyPaste ||
      data?.copy_paste ||
      data?.emv ||
      ""
    ).trim();

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
      qrFallback.classList.remove("skeleton");
      qrFallback.style.display = "grid";
      qrFallback.textContent = "QR Code não disponível no momento.";
    }
  }

  function resetPixLoadingVisual(){
    const qrImg = $("pixQrImage");
    const qrFallback = $("pixQrFallback");
    const pixCode = $("pixCode");

    if (qrImg){
      qrImg.style.display = "none";
      qrImg.removeAttribute("src");
    }

    if (qrFallback){
      qrFallback.style.display = "grid";
      qrFallback.classList.add("skeleton");
      qrFallback.textContent = "Gerando QR Code...";
    }

    if (pixCode) pixCode.value = "";
  }

  async function createPix(){
    if (isCreatingPix) return;
    isCreatingPix = true;

    try {
      resetPixLoadingVisual();
      setGeneratePixBusy(true);
      setProgress(66, "⏳ Cobrança em criação. Em instantes você poderá pagar por <b>PIX</b>.");
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

      hasPixGenerated = true;
      renderPixData(result);

      const normalized = normalizeStatus(result.status);

      if (normalized === "paid") {
        setProgress(100, "✅ Pagamento já confirmado. Liberando suas <b>moedas</b>.");
        setStatus("paid", statusLabel("paid"), "Pagamento já aprovado. Verificando crédito das moedas...");
        showToast("Pagamento encontrado ✅", "Seu pagamento já aparece como aprovado.");
        return;
      }

      setProgress(80, "✅ PIX gerado. Agora é só <b>pagar</b> para concluir.");
      setStatus(
        "pending",
        statusLabel(result.status || "pending"),
        "PIX gerado. Faça o pagamento e esta tela irá atualizar automaticamente."
      );
      showToast("PIX gerado ✅", "Agora é só pagar pelo aplicativo do seu banco.");
    } finally {
      isCreatingPix = false;
      setGeneratePixBusy(false);
    }
  }

  async function checkStatusOnce(){
    if (isCheckingStatus) return;
    isCheckingStatus = true;

    try {
      setRefreshBusy(true);

      const response = await fetch("/api/coin-orders/" + encodeURIComponent(ORDER_ID) + "/status", {
        method: "GET",
        headers: { "Accept":"application/json" },
        credentials: "same-origin"
      });

      const result = await readJsonOrThrow(response);

      const status = normalizeStatus(result.status);
      const credited = !!result.credited;

      if (status === "paid") {
        hasPixGenerated = true;

        if (credited) {
          setProgress(100, "🎉 Tudo certo. Suas <b>moedas já foram creditadas</b>.");
          setStatus(
            "paid",
            "pago",
            "Pagamento aprovado e moedas creditadas com sucesso. Redirecionando..."
          );
          stopPolling();
          showToast("Moedas liberadas 🎉", "Pagamento confirmado e saldo atualizado.");
          setTimeout(function(){
            window.location.href = "/profile";
          }, 1800);
          return;
        }

        setProgress(94, "✅ Pagamento confirmado. Falta só a <b>liberação final das moedas</b>.");
        setStatus(
          "pending",
          "aprovado",
          "Pagamento aprovado. Aguardando liberação final das moedas..."
        );
        return;
      }

      if (status === "expired" || status === "cancelled" || status === "failed") {
        setProgress(80, "⚠️ O pagamento não foi concluído. Gere um <b>novo PIX</b> para continuar.");
        setStatus(
          "error",
          statusLabel(status),
          "O pagamento não foi aprovado. Gere um novo PIX se quiser continuar."
        );
        stopPolling();
        showToast("Pagamento não aprovado", "Você pode gerar um novo PIX para tentar novamente.");
        return;
      }

      if (hasPixGenerated) {
        setProgress(82, "👀 Estamos acompanhando a confirmação do seu <b>PIX</b> em tempo real.");
      } else {
        setProgress(33, "✅ Pedido revisado. Falta <b>gerar o PIX</b> para continuar.");
      }

      setStatus(
        "pending",
        statusLabel(status || "pending"),
        hasPixGenerated
          ? "Aguardando confirmação do PIX..."
          : "Seu pedido está pronto. Gere o PIX para continuar."
      );
    } finally {
      isCheckingStatus = false;
      setRefreshBusy(false);
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

  $("btnGeneratePix")?.addEventListener("click", async function(){
    try{
      await createPix();
      startPolling();
      await checkStatusOnce();
    }catch(e){
      console.error("[checkout-coins] create pix error:", e);
      setProgress(33, "⚠️ Houve um problema ao gerar o PIX. Tente novamente.");
      setStatus("error", "erro", e.message || "Falha ao gerar PIX.");
      showToast("Erro", e.message || "Falha ao gerar PIX.");
    }
  });

  setInterval(renderTimer, 250);

  (async function init(){
    try{
      renderTimer();
      setProgress(33, "✅ Pedido revisado. Falta <b>gerar o PIX</b> para continuar.");
      setStatus("pending", statusLabel(${JSON.stringify(status)}), "Seu pedido está pronto. Gere o PIX para continuar.");
      showToast("Checkout pronto ✅", "Revise os dados e gere o PIX para finalizar a compra.");
      await checkStatusOnce();
    }catch(e){
      console.error("[checkout-coins] init error:", e);
      setProgress(33, "⚠️ Não foi possível carregar o status agora.");
      setStatus("error", "erro", e.message || "Falha ao abrir checkout.");
    }
  })();
})();
</script>
</body>
</html>`;
}

module.exports = { renderCheckoutCoinsHtml };