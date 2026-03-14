// render.checkout.html.js
// Página de Checkout — HTML completo
// Export:
//   module.exports = { renderCheckoutHtml }

"use strict";

const {
  SHARED_HEADER_CSS,
  SHARED_HEADER_JS,
  renderSharedHeader,
} = require("./shared.header");

function esc(s) {
  s = String(s == null ? "" : s);
  return s
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

function renderCheckoutHtml(book, opts = {}) {
  const basePrice = Number(opts.basePrice || 39.9);
  const printPrice = Number(opts.printPrice || 29.9);
  const bindPrice = Number(opts.bindPrice || 19.9);
  const wrapPrice = Number(opts.wrapPrice || 15);

  const dirId = String(book?.dirId || book?.folderId || book?.id || "").trim();
  const id = String(book?.id || dirId || "").trim();

  const childName = book?.childName || book?.child?.name || "";
  const theme = book?.themeLabel || book?.theme || "";
  const style = book?.styleLabel || book?.style || "";

  const coverUrl = String(book?.coverUrl || "").trim();
  const partnerRef = opts.partnerRef ? JSON.stringify(opts.partnerRef) : "null";

  const sharedHeaderHtml = renderSharedHeader({
    brandText: "Meu Livro Mágico",
    brandHref: "/sales",
    brandIcon: "🛒",
    menuLabel: "☰ Menu",
    menuId: "checkoutSharedMenuPanel",
    toggleId: "checkoutSharedMenuToggle",
    showProfile: true,
    showLogout: true,
    profileHref: "/profile",
    menuItems: [
      { label: "Página Inicial", href: "/sales", icon: "🏠" },
      { label: "Criar Livro", href: "/create", icon: "✨" },
      { label: "Meus Livros", href: "/books", icon: "📚" },
      { label: "Como funciona", href: "/como-funciona", icon: "❓" },
      { label: "Para que servem as moedas", href: "/coins-info", icon: "🪙" },
      { label: "Parceiros", href: "/parceiros", icon: "🤝" },
    ],
    actions: [
      { id: "checkoutBackBooksBtn", label: "📚 Meus Livros", kind: "soft", href: "/books" },
      { id: "checkoutViewBookBtn", label: "👀 Ver Livro", kind: "primary", href: "/books/" + encodeURIComponent(dirId) },
    ],
  });

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Checkout — Meu Livro Mágico</title>
<meta name="description" content="Finalize seu pedido do livro personalizado com o mesmo visual do app."/>
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

  ${SHARED_HEADER_CSS()}

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
    width: 10%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600), var(--amber-500));
    transition: width .18s ease;
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

  .cover{
    border-radius: 22px;
    overflow:hidden;
    border: 1px solid rgba(17,24,39,.06);
    background: linear-gradient(135deg, rgba(124,58,237,.10), rgba(219,39,119,.10));
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
    height: 320px;
    display:grid;
    place-items:center;
  }
  .cover img{ width:100%; height:100%; object-fit:cover; display:block; }
  .emptyCover{
    width:100%;
    height:100%;
    display:grid;
    place-items:center;
    color: rgba(109,40,217,1);
    font-size: 52px;
    background:
      radial-gradient(800px 260px at 18% 0%, rgba(124,58,237,.18), transparent 60%),
      radial-gradient(700px 260px at 85% 20%, rgba(219,39,119,.14), transparent 55%),
      rgba(255,255,255,.55);
  }

  .metaLine{
    margin-top: 12px;
    color: var(--gray-600);
    font-weight: 850;
    font-size: 13.5px;
    line-height: 1.55;
  }
  .metaLine b{ color: var(--gray-900); }

  .opts{ display:grid; gap: 10px; margin-top: 12px; }
  .row{ display:flex; gap: 10px; flex-wrap:wrap; }
  .field{
    flex:1 1 220px;
    display:flex;
    flex-direction:column;
    gap: 6px;
  }
  label{
    font-weight: 950;
    color: rgba(75,85,99,.95);
    font-size: 12.5px;
  }
  input, select, textarea{
    width:100%;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid rgba(221,214,254,.95);
    background: rgba(255,255,255,.78);
    color: var(--gray-800);
    font-weight: 900;
    outline:none;
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
    transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
  }
  textarea{ min-height: 92px; resize: vertical; font-weight: 800; }

  .fieldError input, .fieldError textarea, .fieldError select{
    border-color: rgba(219,39,119,.35);
    box-shadow: 0 18px 34px rgba(219,39,119,.10);
  }
  .miniHelp{
    font-weight: 850;
    color: rgba(107,114,128,.95);
    font-size: 12.5px;
    line-height: 1.4;
  }
  .miniHelp strong{ color: rgba(109,40,217,1); font-weight: 1000; }

  .checkLine{
    display:flex;
    align-items:flex-start;
    gap:10px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid rgba(221,214,254,.95);
    background: rgba(255,255,255,.78);
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
  }
  .checkLine input[type="checkbox"]{
    width: 18px; height: 18px;
    margin: 2px 0 0;
    box-shadow:none;
    accent-color: var(--pink-600);
  }
  .checkText{
    font-weight: 950;
    color: rgba(31,41,55,.92);
    line-height: 1.3;
  }
  .checkSub{
    margin-top: 4px;
    font-weight: 850;
    color: rgba(75,85,99,.88);
    font-size: 12.5px;
    line-height: 1.4;
  }

  .coinsBox{
    border-radius: 18px;
    border: 1px solid rgba(221,214,254,.90);
    background: linear-gradient(180deg, rgba(245,243,255,.72), rgba(255,255,255,.92));
    padding: 12px 14px;
  }

  .coinsCompact{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
  }

  .coinsCompactLeft{
    display:flex;
    align-items:center;
    gap:10px;
    min-width:0;
  }

  .coinsCheck{
    width:18px;
    height:18px;
    margin:0;
    accent-color: var(--pink-600);
    box-shadow:none;
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

  .coinsDiscountPreview{
    margin-top:8px;
    color:var(--green-700);
    font-weight:1000;
    font-size:12.5px;
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
    padding: 8px 0;
    border-bottom: 1px dashed rgba(221,214,254,.85);
    font-weight: 900;
    color: rgba(75,85,99,.95);
  }
  .priceRow:last-child{ border-bottom:0; }
  .discountRow{
    color: var(--green-700);
  }
  .total{
    font-size: 18px;
    color: rgba(109,40,217,1);
    font-weight: 1000;
  }
  .mutedSmall{
    font-weight: 850;
    color: rgba(107,114,128,.95);
    font-size: 12.5px;
  }

  .actions{
    margin-top: 12px;
    display:flex;
    gap: 10px;
    flex-wrap:wrap;
    align-items:center;
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
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease, opacity .15s ease;
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

  .hint{
    margin-top: 10px;
    color: rgba(75,85,99,.92);
    font-weight: 800;
    line-height: 1.6;
    font-size: 13.5px;
  }
  .warn{ color:#7f1d1d; }

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

  .modal{
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: grid;
    place-items: center;
    padding: 18px;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .modalBackdrop{
    position:absolute;
    inset:0;
    background: rgba(17,24,39,.55);
    backdrop-filter: blur(6px);
  }
  .modalCard{
    position:relative;
    width: min(560px, 100%);
    max-width: 100%;
    max-height: calc(100dvh - 36px);
    border-radius: 24px;
    background: #fff;
    border: 1px solid rgba(229,231,235,.9);
    box-shadow: 0 30px 80px rgba(0,0,0,.20);
    padding: 18px 16px 14px;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    animation: popIn .18s ease-out;
  }
  .modalCardWide{
    width: min(680px, 100%);
  }
  @keyframes popIn{
    from{ transform: translateY(6px) scale(.98); opacity: .0; }
    to{ transform: translateY(0) scale(1); opacity: 1; }
  }
  .modalTop{
    display:flex;
    gap:12px;
    align-items:flex-start;
  }
  .modalIcon{
    width:46px;height:46px;
    display:grid;place-items:center;
    border-radius:16px;
    background: rgba(124,58,237,.10);
    border:1px solid rgba(124,58,237,.18);
    font-size:22px;
    flex:0 0 auto;
  }
  .modalTitle{
    font-weight:1000;
    font-size:18px;
    color:#111827;
    line-height:1.2;
  }
  .modalSub{
    margin-top:6px;
    font-weight:900;
    color:#6b7280;
    line-height:1.45;
    font-size:13px;
  }
  .modalBtns{
    margin-top: 14px;
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    justify-content:flex-end;
    align-items:center;
  }
  .mBtn{
    border:0; cursor:pointer;
    border-radius:999px;
    padding:12px 14px;
    font-weight:1000;
    text-decoration:none;
    display:inline-flex; align-items:center; gap:10px;
  }
  .mBtnPrimary{
    color:#fff;
    background: linear-gradient(90deg,#7c3aed,#db2777);
    box-shadow: 0 16px 34px rgba(124,58,237,.22);
  }
  .mBtnSuccess{
    color:#fff;
    background: linear-gradient(90deg, var(--green-600), var(--green-700));
    box-shadow: 0 16px 34px rgba(22,163,74,.22);
  }
  .mBtnDanger{
    color:#fff;
    background: linear-gradient(90deg, var(--red-600), var(--red-700));
    box-shadow: 0 16px 34px rgba(220,38,38,.22);
  }
  .mBtnGhost{
    background: rgba(0,0,0,.04);
    color:#374151;
    border:1px solid rgba(0,0,0,.06);
  }

  .confettiWrap{ position:absolute; inset:0; pointer-events:none; overflow:hidden; }
  .confetti{
    position:absolute;
    top:-12px;
    width:10px;height:14px;
    border-radius:4px;
    opacity:.95;
    animation: fall 1.2s linear forwards;
  }
  @keyframes fall{
    to{ transform: translateY(620px) rotate(420deg); opacity: 1; }
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
  .pixStatusPending{ color: var(--amber-500); }
  .pixStatusPaid{ color: var(--green-600); }
  .pixStatusError{ color: var(--red-600); }

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

  #pixCodeText{
    min-height: 90px;
    max-height: 180px;
    overflow:auto;
    word-break: break-all;
    white-space: pre-wrap;
  }

  @media (max-width: 760px){
    .modal{
      padding: 10px;
      place-items: start center;
    }

    .modalCard{
      margin: 10px 0;
      max-height: calc(100dvh - 20px);
      border-radius: 20px;
      padding: 14px 12px 12px;
    }

    .modalTop{
      gap:10px;
    }

    .modalIcon{
      width:40px;
      height:40px;
      border-radius:14px;
      font-size:20px;
    }

    .modalTitle{
      font-size:16px;
    }

    .modalSub{
      font-size:12.5px;
      line-height:1.4;
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

    .modalBtns{
      justify-content:stretch;
    }

    .modalBtns .mBtn{
      width:100%;
      justify-content:center;
    }

    .copyRow{
      flex-direction:column;
      align-items:stretch;
    }

    .copyRow .mBtn{
      width:100%;
      justify-content:center;
    }
  }
</style>
</head>

<body>
  <div class="wrap">
    ${sharedHeaderHtml}
  </div>

  <section class="hero">
    <div class="wrap">
      <div class="panel">
        <div class="panelIn">

          <div class="titleRow">
            <div>
              <h1 class="title">Finalizar <span class="gradText">pedido</span></h1>
              <p class="sub">
                Confira os dados do livro e preencha as informações do pedido. Você pode ajustar opções como impressão, encadernação, usar moedas da sua conta e pagar por PIX antes de concluir.
              </p>
            </div>

            <div class="topNudges">
              <div class="pill" title="Etapa final">
                <span class="pulseDot" aria-hidden="true"></span>
                <strong>Quase lá</strong> • falta pouco
              </div>
              <div id="pillTimer" class="pill pillTimer" title="Reserva local do seu checkout (salvo neste dispositivo)">
                ⏳ Reserva: <span class="timerValue" id="timerValue">--:--</span>
              </div>
            </div>
          </div>

          <div class="progress" aria-label="Progresso do checkout">
            <div class="steps">
              <div class="step"><span class="stepNum">1</span> Dados</div>
              <div class="step"><span class="stepNum">2</span> Endereço</div>
              <div class="step"><span class="stepNum">3</span> Pagar</div>
            </div>
            <div class="bar" aria-hidden="true">
              <div class="barFill" id="barFill"></div>
            </div>
            <div class="barHint" id="barHint">
              ✅ Suas informações ficam <b>salvas aqui</b> enquanto você preenche (se você sair, não perde).
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="cardIn">
                <div class="cover">
                  ${
                    coverUrl
                      ? `<img src="${esc(coverUrl)}" alt="Capa do livro"/>`
                      : `<div class="emptyCover">📘</div>`
                  }
                </div>

                <div class="metaLine" style="margin-top:12px;">
                  <div><b>ID:</b> ${esc(id)}</div>
                  <div><b>Criança:</b> ${esc(childName || "-")}</div>
                  <div><b>Tema:</b> ${esc(theme || "-")} • <b>Estilo:</b> ${esc(style || "-")}</div>
                </div>

                <div class="hint">
                  🧡 Um jeitinho mágico de mostrar para seu pequeno que ele é especial — com histórias criadas especialmente para ele. <br>
                  🐉 Aventuras personalizadas que fazem eles se sentirem parte da história — não só como leitora, mas como heroína ou herói.<br>
                  🌈 Um livro feito para emocionar hoje e virar lembrança para a vida toda.
                </div>
              </div>
            </div>

            <div class="card">
              <div class="cardIn">
                <div class="opts">
                  <div class="row">
                    <div class="field" id="field-name">
                      <label>Seu nome</label>
                      <input id="name" placeholder="Ex: Lila" autocomplete="name" />
                      <div class="miniHelp">Para identificar o pedido e confirmar os detalhes com você.</div>
                    </div>
                    <div class="field" id="field-whats">
                      <label>WhatsApp</label>
                      <input id="whats" placeholder="Ex: (67) 99999-9999" autocomplete="tel" />
                      <div class="miniHelp">Você recebe atualizações do pedido por aqui.</div>
                    </div>
                  </div>

                  <div class="row">
                    <div class="field" id="field-email">
                      <label>Email</label>
                      <input id="email" type="email" placeholder="Ex: seuemail@gmail.com" autocomplete="email" />
                      <div class="miniHelp">Confirmação de pagamento e acompanhamento do pedido.</div>
                    </div>
                  </div>

                  <div class="row">
                    <div class="field" id="field-cep">
                      <label>CEP</label>
                      <input id="cep" placeholder="Ex: 79200-000" inputmode="numeric" />
                    </div>
                    <div class="field" id="field-uf">
                      <label>UF</label>
                      <input id="uf" placeholder="Ex: MS" maxlength="2" />
                    </div>
                  </div>

                  <div class="row">
                    <div class="field" style="flex: 2 1 320px;" id="field-street">
                      <label>Rua / Avenida</label>
                      <input id="street" placeholder="Ex: Rua Sete de Setembro" autocomplete="address-line1" />
                    </div>
                    <div class="field" style="flex: 1 1 140px;" id="field-number">
                      <label>Número</label>
                      <input id="number" placeholder="Ex: 123" autocomplete="address-line2" />
                    </div>
                  </div>

                  <div class="row">
                    <div class="field" id="field-comp">
                      <label>Complemento</label>
                      <input id="comp" placeholder="Ex: Apto 2 / Casa fundos" />
                    </div>
                    <div class="field" id="field-district">
                      <label>Bairro</label>
                      <input id="district" placeholder="Ex: Centro" />
                    </div>
                  </div>

                  <div class="row">
                    <div class="field" id="field-city">
                      <label>Cidade</label>
                      <input id="city" placeholder="Ex: Aquidauana" />
                    </div>
                    <div class="field" id="field-ref">
                      <label>Ponto de referência</label>
                      <input id="ref" placeholder="Ex: Próximo ao mercado X" />
                    </div>
                  </div>

                  <div class="row">
                    <div class="field">
                      <label>Opções do pedido</label>
                      <select id="pack">
                        <option value="impresso" data-add="${printPrice}">Livro Comum (+ ${moneyBR(printPrice)})</option>
                        <option value="impresso_enc" data-add="${printPrice + bindPrice}">Livro Espiral (Mola) (+ ${moneyBR(printPrice + bindPrice)})</option>
                      </select>
                      <div class="miniHelp">Escolha como você quer receber. Você vê o total atualizado na hora.</div>
                    </div>
                    <div class="field">
                      <label>Forma de pagamento</label>
                      <select id="pay" disabled>
                        <option value="pix" selected>PIX</option>
                      </select>
                      <div class="miniHelp"><strong>PIX</strong> via Mercado Pago.</div>
                    </div>
                  </div>

                  <div class="field" id="field-obs">
                    <label>Observações</label>
                    <textarea id="obs" placeholder="Ex: Queria que ficasse o mais delicado possível🧡."></textarea>
                    <div class="miniHelp">Se quiser, diga detalhes de entrega, horário, ou qualquer cuidado especial.</div>
                  </div>

                  <div class="field">
                    <label>Extras</label>
                    <div class="checkLine">
                      <input id="giftwrap" type="checkbox" />
                      <div>
                        <div class="checkText">🎁🌟 Incluir embrulho especial ✨</div>
                        <div class="checkSub">Adiciona + ${moneyBR(wrapPrice)} ao total (opcional).</div>
                      </div>
                    </div>
                  </div>

                  <div class="coinsBox" aria-label="Usar moedas da conta">
                    <div class="coinsCompact">
                      <label class="coinsCompactLeft" for="useCoins" style="cursor:pointer;">
                        <input id="useCoins" class="coinsCheck" type="checkbox" />
                        <span class="coinsLabel">🪙 Usar moedas</span>
                      </label>

                      <div class="coinsBalance" id="walletBadge">Saldo: carregando...</div>
                    </div>

                    <div class="coinsDiscountPreview" id="coinsDiscountPreview">
                      Desconto: ${moneyBR(0)}
                    </div>
                  </div>

                  <div class="priceBox" aria-label="Resumo de valores">
                    <div class="priceRow">
                      <span>Livro</span>
                      <span id="pBook">${moneyBR(basePrice)}</span>
                    </div>

                    <div class="priceRow" id="wrapRow" style="display:none;">
                      <span>Embrulho especial</span>
                      <span id="pWrap">${moneyBR(0)}</span>
                    </div>

                    <div class="priceRow discountRow" id="coinsRow" style="display:none;">
                      <span>Desconto com moedas</span>
                      <span id="pCoinsDiscount">- ${moneyBR(0)}</span>
                    </div>

                    <div class="priceRow">
                      <span class="total">Total</span>
                      <span class="total" id="pTotal">${moneyBR(basePrice)}</span>
                    </div>
                    <div class="mutedSmall" style="margin-top:8px;">
                      🔒 Você está no controle: revise tudo antes de gerar o PIX.
                    </div>
                  </div>

                  <div class="actions">
                    <button class="btn btnOrder" id="btnSend" type="button">
                      <span class="shine" aria-hidden="true"></span>
                      ✅ Gerar PIX e pagar
                    </button>
                    <a class="btn btnOutline" href="/books/${encodeURIComponent(dirId)}">Voltar</a>
                  </div>

                  <div class="hint" id="msg"></div>
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
        <div class="toastTitle" id="toastTitle">Quase pronto!</div>
        <div class="toastText" id="toastText">Se você sair agora, seus dados continuam salvos aqui.</div>
      </div>
      <button class="toastClose" id="toastClose" type="button">OK</button>
    </div>
  </div>

  <div id="successModal" class="modal" style="display:none" aria-hidden="true">
    <div class="modalBackdrop"></div>

    <div class="modalCard" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modalTop">
        <div class="modalIcon">🎉</div>
        <div>
          <div id="modalTitle" class="modalTitle">Pedido realizado com sucesso!</div>

          <div class="modalSub" id="modalSub">
            Parabéns por adquirir o <b>Meu Livro Mágico</b> ✨<br/>
            Seu pequeno vai se sentir o protagonista dessa aventura!
          </div>

          <div class="modalSub" id="modalProcess" style="margin-top:10px;">
            Seu pedido será processado e, assim que sair para a entrega, você será notificado pelo email <b id="modalEmail">-</b>.
          </div>
        </div>
      </div>

      <div class="modalBtns">
        <button type="button" class="mBtn mBtnPrimary" id="modalOk">Perfeito ✅</button>
        <a class="mBtn mBtnGhost" href="/books">Voltar para Meus Livros</a>
      </div>

      <div id="confettiWrap" class="confettiWrap" aria-hidden="true"></div>
    </div>
  </div>

  <div id="pixModal" class="modal" style="display:none" aria-hidden="true">
    <div class="modalBackdrop"></div>

    <div class="modalCard modalCardWide" role="dialog" aria-modal="true" aria-labelledby="pixModalTitle">
      <div class="modalTop">
        <div class="modalIcon">💳</div>
        <div style="width:100%; min-width:0;">
          <div id="pixModalTitle" class="modalTitle">Pagamento via PIX</div>
          <div class="modalSub" id="pixModalSub">
            Escaneie o QR Code abaixo com o app do seu banco ou copie o código PIX.
          </div>

          <div class="pixGrid">
            <div class="pixQrBox">
              <div class="pixQrImageWrap">
                <img id="pixQrImage" class="pixQrImage" src="" alt="QR Code PIX" />
                <div id="pixQrFallback" class="pixQrFallback">Gerando QR Code...</div>
              </div>
              <div class="tinyNote">
                O pedido só será concluído depois da confirmação do pagamento.
              </div>
            </div>

            <div class="pixInfo">
              <div class="pixStatusBox">
                <div class="pixStatusTitle">Status do pagamento</div>
                <div class="pixStatusValue pixStatusPending" id="pixStatusValue">Aguardando pagamento...</div>
                <div class="pixStatusHint" id="pixStatusHint">
                  Assim que o PIX for confirmado, seu pedido será finalizado automaticamente.
                </div>
              </div>

              <div class="priceBox">
                <div class="priceRow">
                  <span>Livro</span>
                  <span id="pixBookValue">${moneyBR(basePrice)}</span>
                </div>
                <div class="priceRow" id="pixWrapRow" style="display:none;">
                  <span>Embrulho especial</span>
                  <span id="pixWrapValue">${moneyBR(0)}</span>
                </div>
                <div class="priceRow discountRow" id="pixCoinsRow" style="display:none;">
                  <span>Desconto com moedas</span>
                  <span id="pixCoinsValue">- ${moneyBR(0)}</span>
                </div>
                <div class="priceRow">
                  <span class="total">Total para pagar</span>
                  <span class="total" id="pixTotalValue">${moneyBR(basePrice)}</span>
                </div>
              </div>

              <div class="copyBox">
                <label for="pixCodeText">Código PIX (copia e cola)</label>
                <textarea id="pixCodeText" readonly placeholder="O código PIX aparecerá aqui"></textarea>
                <div class="copyRow">
                  <button type="button" class="mBtn mBtnPrimary" id="btnCopyPix">📋 Copiar código PIX</button>
                  <button type="button" class="mBtn mBtnGhost" id="btnRefreshPixStatus">🔄 Verificar pagamento</button>
                </div>
                <div class="tinyNote">
                  Depois de pagar, a tela verifica automaticamente. Se quiser, você também pode clicar em “Verificar pagamento”.
                </div>
              </div>
            </div>
          </div>

          <div class="modalBtns">
            <button type="button" class="mBtn mBtnGhost" id="btnClosePixModal">Fechar</button>
          </div>
        </div>
      </div>
    </div>
  </div>

<script>
${SHARED_HEADER_JS()}
</script>

<script>
(function(){
  const BOOK_ID = ${JSON.stringify(String(id || ""))};
  const BASE = ${JSON.stringify(basePrice)};
  const WRAP = ${JSON.stringify(wrapPrice)};
  const PARTNER_REF = ${partnerRef};

  const $ = (id) => document.getElementById(id);

  let submitted = false;
  let currentPaymentRef = "";
  let pendingCheckoutPayload = null;
  let paymentPollTimer = null;
  let isCreatingPix = false;
  let isCheckingPayment = false;

  const walletState = {
    loaded: false,
    availableCoins: 0
  };

  const DRAFT_KEY = "mlm_checkout_draft_" + BOOK_ID;
  const TIMER_KEY = "mlm_checkout_timer_" + BOOK_ID;

  function money(v){
    try { return Number(v||0).toLocaleString("pt-BR", {style:"currency", currency:"BRL"}); }
    catch(e){ return "R$ " + (Number(v||0).toFixed(2)); }
  }

  function fmtCoins(v){
    const n = Number(v || 0);
    return n.toLocaleString("pt-BR", {
      minimumFractionDigits: n % 1 ? 2 : 0,
      maximumFractionDigits: 2
    }) + " moedas";
  }

  function getWalletCoinsToUse(preDiscountTotal){
    const useCoins = !!($("useCoins") && $("useCoins").checked);
    if (!useCoins) return 0;
    const available = Number(walletState.availableCoins || 0);
    const total = Number(preDiscountTotal || 0);
    return Math.max(0, Math.min(available, total));
  }

  function calc(){
    const opt = $("pack");
    const sel = opt.options[opt.selectedIndex];
    const packAdd = Number(sel.getAttribute("data-add") || 0);

    const bookValue = Number(BASE) + packAdd;
    const wrapChecked = !!($("giftwrap") && $("giftwrap").checked);
    const wrapValue = wrapChecked ? Number(WRAP) : 0;

    const subtotalBeforeCoins = bookValue + wrapValue;
    const walletCoinsUsed = getWalletCoinsToUse(subtotalBeforeCoins);
    const total = Math.max(0, subtotalBeforeCoins - walletCoinsUsed);

    $("pBook").textContent = money(bookValue);
    $("pTotal").textContent = money(total);

    const wrapRow = $("wrapRow");
    const pWrap = $("pWrap");
    if (wrapRow && pWrap){
      if (wrapChecked){
        wrapRow.style.display = "flex";
        pWrap.textContent = money(wrapValue);
      } else {
        wrapRow.style.display = "none";
        pWrap.textContent = money(0);
      }
    }

    const coinsRow = $("coinsRow");
    const pCoinsDiscount = $("pCoinsDiscount");
    const coinsDiscountPreview = $("coinsDiscountPreview");
    if (coinsDiscountPreview) {
      coinsDiscountPreview.textContent = "Desconto: " + money(walletCoinsUsed);
    }
    if (coinsRow && pCoinsDiscount) {
      if (walletCoinsUsed > 0) {
        coinsRow.style.display = "flex";
        pCoinsDiscount.textContent = "- " + money(walletCoinsUsed);
      } else {
        coinsRow.style.display = "none";
        pCoinsDiscount.textContent = "- " + money(0);
      }
    }

    const pixBookValue = $("pixBookValue");
    const pixWrapRow = $("pixWrapRow");
    const pixWrapValue = $("pixWrapValue");
    const pixCoinsRow = $("pixCoinsRow");
    const pixCoinsValue = $("pixCoinsValue");
    const pixTotalValue = $("pixTotalValue");

    if (pixBookValue) pixBookValue.textContent = money(bookValue);
    if (pixTotalValue) pixTotalValue.textContent = money(total);

    if (pixWrapRow && pixWrapValue) {
      if (wrapChecked) {
        pixWrapRow.style.display = "flex";
        pixWrapValue.textContent = money(wrapValue);
      } else {
        pixWrapRow.style.display = "none";
        pixWrapValue.textContent = money(0);
      }
    }

    if (pixCoinsRow && pixCoinsValue) {
      if (walletCoinsUsed > 0) {
        pixCoinsRow.style.display = "flex";
        pixCoinsValue.textContent = "- " + money(walletCoinsUsed);
      } else {
        pixCoinsRow.style.display = "none";
        pixCoinsValue.textContent = "- " + money(0);
      }
    }

    return {
      packAdd,
      bookValue,
      wrapChecked,
      wrapValue,
      subtotalBeforeCoins,
      walletCoinsUsed,
      total,
      packLabel: sel.textContent
    };
  }

  function safeParseJSON(s){
    try { return JSON.parse(String(s||"")); } catch(e){ return null; }
  }

  function getDraft(){
    const raw = localStorage.getItem(DRAFT_KEY);
    const obj = safeParseJSON(raw);
    return (obj && typeof obj === "object") ? obj : null;
  }

  function setDraft(data){
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data || {})); } catch(e){}
  }

  function collectDraft(){
    return {
      name: ($("name").value||""),
      whats: ($("whats").value||""),
      email: ($("email").value||""),
      cep: ($("cep").value||""),
      uf: ($("uf").value||""),
      street: ($("street").value||""),
      number: ($("number").value||""),
      comp: ($("comp").value||""),
      district: ($("district").value||""),
      city: ($("city").value||""),
      ref: ($("ref").value||""),
      obs: ($("obs").value||""),
      pack: ($("pack").value||""),
      giftwrap: !!($("giftwrap") && $("giftwrap").checked),
      useCoins: !!($("useCoins") && $("useCoins").checked),
      ts: Date.now()
    };
  }

  function applyDraft(d){
    if (!d) return;
    if (typeof d.name === "string") $("name").value = d.name;
    if (typeof d.whats === "string") $("whats").value = d.whats;
    if (typeof d.email === "string") $("email").value = d.email;
    if (typeof d.cep === "string") $("cep").value = d.cep;
    if (typeof d.uf === "string") $("uf").value = d.uf;
    if (typeof d.street === "string") $("street").value = d.street;
    if (typeof d.number === "string") $("number").value = d.number;
    if (typeof d.comp === "string") $("comp").value = d.comp;
    if (typeof d.district === "string") $("district").value = d.district;
    if (typeof d.city === "string") $("city").value = d.city;
    if (typeof d.ref === "string") $("ref").value = d.ref;
    if (typeof d.obs === "string") $("obs").value = d.obs;

    if (typeof d.pack === "string" && $("pack")){
      const pack = $("pack");
      const ok = Array.from(pack.options).some(o => o.value === d.pack);
      if (ok) pack.value = d.pack;
    }
    if ($("giftwrap")) $("giftwrap").checked = !!d.giftwrap;
    if ($("useCoins")) $("useCoins").checked = !!d.useCoins;
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

  function cleanPhone(s){
    return String(s||"").replace(/\\D+/g,"");
  }

  function cleanCep(s){
    return String(s||"").replace(/\\D+/g,"").slice(0,8);
  }

  function normUF(s){
    return String(s||"").trim().toUpperCase().replace(/[^A-Z]/g,"").slice(0,2);
  }

  function isValidEmail(email){
    const s = String(email||"").trim();
    if (!s) return false;
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(s);
  }

  function escHtml(s){
    return String(s ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function updateWalletUi(){
    const badge = $("walletBadge");
    const useCoins = $("useCoins");

    if (!walletState.loaded) {
      if (badge) badge.textContent = "Saldo: carregando...";
      if (useCoins) {
        useCoins.disabled = true;
        useCoins.checked = false;
      }
      calc();
      return;
    }

    const available = Number(walletState.availableCoins || 0);

    if (badge) badge.textContent = "Saldo: " + fmtCoins(available);

    if (available > 0) {
      if (useCoins) useCoins.disabled = false;
    } else {
      if (badge) badge.textContent = "Saldo: 0 moedas";
      if (useCoins) {
        useCoins.disabled = true;
        useCoins.checked = false;
      }
    }

    calc();
  }

  async function loadMyWallet(){
    try {
      const response = await fetch("/api/my-wallet", {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "wallet_load_failed");
      }

      walletState.loaded = true;
      walletState.availableCoins = Number(result.availableCoins || 0);
      updateWalletUi();
    } catch (e) {
      walletState.loaded = true;
      walletState.availableCoins = 0;
      updateWalletUi();
    }
  }

  function showSuccessModal(customerName, customerEmail, orderId){
    const modal = $("successModal");
    const okBtn = $("modalOk");
    const confettiWrap = $("confettiWrap");
    const modalSub = $("modalSub");
    const modalEmail = $("modalEmail");

    const nm = String(customerName || "").trim();
    const em = String(customerEmail || "").trim();

    const safeName = escHtml(nm);

    if (modalSub){
      modalSub.innerHTML =
        (safeName ? ("Parabéns, <b>" + safeName + "</b>! ") : "Parabéns! ") +
        "Você acabou de adquirir o <b>Meu Livro Mágico</b> ✨<br/>Seu pequeno vai se sentir o protagonista dessa aventura!" +
        (orderId ? "<br/>Nº do pedido: <b>" + escHtml(orderId) + "</b>" : "");
    }
    if (modalEmail) modalEmail.textContent = em || "-";

    modal.style.display = "grid";
    modal.setAttribute("aria-hidden", "false");

    if (confettiWrap){
      confettiWrap.innerHTML = "";
      const n = 38;
      for (let i=0;i<n;i++){
        const d = document.createElement("div");
        d.className = "confetti";
        const hue = Math.floor(Math.random()*360);
        d.style.background = "hsl(" + hue + " 90% 60%)";
        d.style.left = (Math.random()*100) + "%";
        d.style.animationDelay = (Math.random()*0.15) + "s";
        d.style.width = (8 + Math.random()*8) + "px";
        d.style.height = (10 + Math.random()*10) + "px";
        confettiWrap.appendChild(d);
      }
    }

    function closeAndGoProfile(){
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      window.location.href = "/profile";
    }

    function closeOnly(){
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }

    if (okBtn) okBtn.onclick = closeAndGoProfile;

    const backdrop = modal.querySelector(".modalBackdrop");
    if (backdrop) backdrop.onclick = closeOnly;

    const onKey = (e)=>{
      if (e.key === "Escape") {
        closeOnly();
        window.removeEventListener("keydown", onKey);
      }
    };
    window.addEventListener("keydown", onKey);

    setTimeout(()=> okBtn && okBtn.focus(), 50);
  }

  function openPixModal(){
    const modal = $("pixModal");
    if (!modal) return;
    modal.style.display = "grid";
    modal.setAttribute("aria-hidden", "false");
  }

  function closePixModal(){
    const modal = $("pixModal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  function stopPaymentPolling(){
    if (paymentPollTimer){
      clearInterval(paymentPollTimer);
      paymentPollTimer = null;
    }
  }

  function setButtonBusy(isBusy){
    const btn = $("btnSend");
    if (!btn) return;
    btn.disabled = !!isBusy;
    btn.innerHTML = isBusy
      ? "⏳ Gerando PIX..."
      : '<span class="shine" aria-hidden="true"></span>✅ Gerar PIX e pagar';
  }

  function setPixStatus(kind, text, hint){
    const statusEl = $("pixStatusValue");
    const hintEl = $("pixStatusHint");
    if (!statusEl) return;

    statusEl.classList.remove("pixStatusPending", "pixStatusPaid", "pixStatusError");

    if (kind === "paid") statusEl.classList.add("pixStatusPaid");
    else if (kind === "error") statusEl.classList.add("pixStatusError");
    else statusEl.classList.add("pixStatusPending");

    statusEl.textContent = text || "";
    if (hintEl) hintEl.textContent = hint || "";
  }

  function renderPixData(data, totalData){
    const qrImg = $("pixQrImage");
    const qrFallback = $("pixQrFallback");
    const pixCodeText = $("pixCodeText");

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

    const pixCode = String(
      data?.pixCode ||
      data?.pix_code ||
      data?.copyPaste ||
      data?.copy_paste ||
      data?.emv ||
      ""
    ).trim();

    if (qrImg) {
      qrImg.style.display = "none";
      qrImg.removeAttribute("src");

      if (qrCodeBase64) {
        qrImg.src = qrCodeBase64.startsWith("data:")
          ? qrCodeBase64
          : ("data:image/png;base64," + qrCodeBase64);
        qrImg.style.display = "block";
        if (qrFallback) qrFallback.style.display = "none";
      } else if (qrCodeUrl) {
        qrImg.src = qrCodeUrl;
        qrImg.style.display = "block";
        if (qrFallback) qrFallback.style.display = "none";
      } else {
        if (qrFallback) {
          qrFallback.style.display = "block";
          qrFallback.textContent = "QR Code não disponível no momento.";
        }
      }
    }

    if (pixCodeText) pixCodeText.value = pixCode || "";
    if (totalData) {
      calc();
    }

    setPixStatus(
      "pending",
      "Aguardando pagamento...",
      "Assim que o PIX for confirmado, seu pedido será finalizado automaticamente."
    );
  }

  async function copyPixCode(){
    const txt = $("pixCodeText")?.value || "";
    if (!txt) {
      showToast("PIX", "Código PIX ainda não disponível.");
      return;
    }
    try {
      await navigator.clipboard.writeText(txt);
      showToast("Copiado ✅", "O código PIX foi copiado.");
    } catch (e) {
      showToast("Erro", "Não foi possível copiar o código PIX.");
    }
  }

  async function finalizeOrderAfterPayment(){
    if (!pendingCheckoutPayload) {
      throw new Error("Dados do pedido não encontrados.");
    }

    const checkoutPayload = {
      ...pendingCheckoutPayload,
      paymentReference: currentPaymentRef
    };

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkoutPayload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Erro ao finalizar pedido");
    }

    submitted = true;
    stopPaymentPolling();
    try { localStorage.removeItem(TIMER_KEY); } catch(e){}
    try { localStorage.removeItem(DRAFT_KEY); } catch(e){}

    $("msg").textContent = "✅ Pagamento confirmado e pedido enviado com sucesso!";
    closePixModal();
    showSuccessModal(
      pendingCheckoutPayload.name,
      pendingCheckoutPayload.email,
      result.orderId
    );
  }

  async function checkPaymentStatusOnce(){
    if (!currentPaymentRef || isCheckingPayment) return;
    isCheckingPayment = true;

    try {
      const response = await fetch("/api/mercadopago/status?paymentReference=" + encodeURIComponent(currentPaymentRef), {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erro ao consultar pagamento");
      }

      const status = String(
        result.status ||
        result.paymentStatus ||
        result.payment_status ||
        ""
      ).trim().toLowerCase();

      if (status === "paid" || status === "approved" || status === "completed") {
        setPixStatus(
          "paid",
          "Pagamento aprovado ✅",
          "Pagamento confirmado. Finalizando seu pedido..."
        );
        stopPaymentPolling();
        await finalizeOrderAfterPayment();
        return;
      }

      if (status === "expired" || status === "cancelled" || status === "canceled" || status === "failed") {
        setPixStatus(
          "error",
          "PIX expirado ou cancelado ❌",
          "Feche este popup e gere um novo PIX para continuar."
        );
        stopPaymentPolling();
        return;
      }

      setPixStatus(
        "pending",
        "Aguardando pagamento...",
        "Ainda não recebemos a confirmação do PIX. Assim que confirmar, o pedido será concluído."
      );
    } finally {
      isCheckingPayment = false;
    }
  }

  function startPaymentPolling(){
    stopPaymentPolling();
    paymentPollTimer = setInterval(async () => {
      try {
        await checkPaymentStatusOnce();
      } catch (e) {
        console.error("[checkout] erro ao consultar status do pagamento:", e);
      }
    }, 3000);
  }

  function getOrCreateTimerEnd(){
    const now = Date.now();
    const stored = Number(localStorage.getItem(TIMER_KEY) || 0);
    if (stored && Number.isFinite(stored) && stored > now + 5*1000) return stored;

    const end = now + 15 * 60 * 1000;
    try { localStorage.setItem(TIMER_KEY, String(end)); } catch(e){}
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
      try { localStorage.removeItem(TIMER_KEY); } catch(e){}
      if (tv) tv.textContent = "00:00";
    }
  }

  function buildAddress(){
    const cep = cleanCep(($("cep").value||""));
    const uf = normUF(($("uf").value||""));
    const street = ($("street").value||"").trim();
    const number = ($("number").value||"").trim();
    const comp = ($("comp").value||"").trim();
    const district = ($("district").value||"").trim();
    const city = ($("city").value||"").trim();
    const ref = ($("ref").value||"").trim();

    const line1 = [
      street ? street : "",
      number ? ("nº " + number) : "",
      comp ? ("(" + comp + ")") : ""
    ].filter(Boolean).join(", ");

    const line2 = [
      district ? district : "",
      (city || uf) ? ([city, uf].filter(Boolean).join("/")) : "",
      cep ? ("CEP " + (cep.length === 8 ? (cep.slice(0,5) + "-" + cep.slice(5)) : cep)) : ""
    ].filter(Boolean).join(" — ");

    return { cep, uf, street, number, comp, district, city, ref, line1, line2 };
  }

  function hasMinAddress(a){
    return !!(a && a.street && a.number && a.district && a.city && a.uf && a.cep && String(a.cep).length === 8);
  }

  function computeProgress(){
    const draft = collectDraft();
    const fields = [
      ["name", String(draft.name||"").trim().length > 1],
      ["whats", cleanPhone(draft.whats).length >= 10],
      ["email", isValidEmail(draft.email)],
      ["cep", cleanCep(draft.cep).length === 8],
      ["uf", normUF(draft.uf).length === 2],
      ["street", String(draft.street||"").trim().length > 2],
      ["number", String(draft.number||"").trim().length > 0],
      ["district", String(draft.district||"").trim().length > 1],
      ["city", String(draft.city||"").trim().length > 1]
    ];
    const done = fields.filter(([,ok])=>!!ok).length;
    const total = fields.length;
    const pct = Math.max(10, Math.min(100, Math.round((done/total)*100)));
    return { done, total, pct };
  }

  function renderProgress(){
    const p = computeProgress();
    const bar = $("barFill");
    if (bar) bar.style.width = p.pct + "%";

    const hint = $("barHint");
    if (hint){
      if (p.pct >= 95){
        hint.innerHTML = "✅ Tudo pronto. Só <b>gerar o PIX</b> e pagar.";
      } else if (p.pct >= 70){
        hint.innerHTML = "✨ Está ficando pronto. Falta pouco para <b>confirmar</b>.";
      } else {
        hint.innerHTML = "✅ Suas informações ficam <b>salvas aqui</b> enquanto você preenche (se você sair, não perde).";
      }
    }
  }

  function setErr(fieldId, on){
    const el = document.getElementById("field-" + fieldId);
    if (!el) return;
    if (on) el.classList.add("fieldError");
    else el.classList.remove("fieldError");
  }

  function clearAllErr(){
    ["name","whats","email","cep","uf","street","number","district","city","obs"].forEach(id => setErr(id,false));
  }

  function saveAndUpdate(){
    setDraft(collectDraft());
    calc();
    renderProgress();
  }

  async function createPixCharge(payload){
    const response = await fetch("/api/mercadopago/pix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível gerar o PIX");
    }
    return result;
  }

  function buildPayloadFromForm(){
    const name = ($("name").value||"").trim();
    const whatsClean = cleanPhone($("whats").value);
    const email = ($("email").value||"").trim();
    const obs = ($("obs").value||"").trim();
    const v = calc();
    const addr = buildAddress();

    let ok = true;

    if(!name){
      ok = false;
      setErr("name", true);
    }
    if(!whatsClean || whatsClean.length < 10){
      ok = false;
      setErr("whats", true);
    }
    if(!isValidEmail(email)){
      ok = false;
      setErr("email", true);
    }
    if(!cleanCep(($("cep").value||"")) || cleanCep(($("cep").value||"")).length !== 8){
      ok = false;
      setErr("cep", true);
    }
    if(!normUF(($("uf").value||"")) || normUF(($("uf").value||"")).length !== 2){
      ok = false;
      setErr("uf", true);
    }
    if(!String(($("street").value||"")).trim()){
      ok = false;
      setErr("street", true);
    }
    if(!String(($("number").value||"")).trim()){
      ok = false;
      setErr("number", true);
    }
    if(!String(($("district").value||"")).trim()){
      ok = false;
      setErr("district", true);
    }
    if(!String(($("city").value||"")).trim()){
      ok = false;
      setErr("city", true);
    }

    if(!ok){
      $("msg").textContent = "⚠️ Revise os campos marcados para continuar.";
      showToast("Quase ✅", "Falta só completar os campos marcados.");
      try { $("msg").scrollIntoView({behavior:"smooth", block:"center"}); } catch(e){}
      return null;
    }

    if(!hasMinAddress(addr)){
      $("msg").textContent = "⚠️ Preencha o endereço completo (Rua, Nº, Bairro, Cidade, UF e CEP).";
      showToast("Endereço incompleto", "Complete Rua, Nº, Bairro, Cidade, UF e CEP para continuar.");
      return null;
    }

    return {
      payload: {
        bookId: BOOK_ID,
        name,
        whatsapp: whatsClean,
        email,
        address: {
          cep: addr.cep,
          uf: addr.uf,
          street: addr.street,
          number: addr.number,
          comp: addr.comp,
          district: addr.district,
          city: addr.city,
          ref: addr.ref,
        },
        pack: $("pack").value,
        giftwrap: v.wrapChecked,
        subtotalBeforeCoins: v.subtotalBeforeCoins,
        usedWalletCoins: v.walletCoinsUsed,
        total: v.total,
        obs,
        partnerRef: PARTNER_REF,
      },
      calcData: v
    };
  }

  function resetPixModalVisual(){
    const qrImg = $("pixQrImage");
    const qrFallback = $("pixQrFallback");
    const codeText = $("pixCodeText");

    if (qrImg) {
      qrImg.style.display = "none";
      qrImg.removeAttribute("src");
    }
    if (qrFallback) {
      qrFallback.style.display = "block";
      qrFallback.textContent = "Gerando QR Code...";
    }
    if (codeText) codeText.value = "";
    setPixStatus(
      "pending",
      "Gerando cobrança PIX...",
      "Estamos criando sua cobrança no Mercado Pago."
    );
  }

  $("pack").addEventListener("change", ()=>{ saveAndUpdate(); });
  const gw = $("giftwrap");
  if (gw) gw.addEventListener("change", ()=>{ saveAndUpdate(); });

  const useCoinsEl = $("useCoins");
  if (useCoinsEl) {
    useCoinsEl.addEventListener("change", ()=>{ saveAndUpdate(); });
  }

  const autos = ["name","whats","email","cep","uf","street","number","comp","district","city","ref","obs"];
  autos.forEach(id=>{
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", ()=>{ saveAndUpdate(); });
    el.addEventListener("blur", saveAndUpdate);
  });

  const cepEl = $("cep");
  if (cepEl){
    cepEl.addEventListener("input", ()=>{ cepEl.value = cleanCep(cepEl.value); });
  }

  const ufEl = $("uf");
  if (ufEl){
    ufEl.addEventListener("input", ()=>{ ufEl.value = normUF(ufEl.value); });
  }

  const whatsEl = $("whats");
  if (whatsEl){
    whatsEl.addEventListener("input", ()=>{ whatsEl.value = String(whatsEl.value || "").replace(/[^\\d()\\-\\s+]/g, ""); });
  }

  const existingDraft = getDraft();
  if (existingDraft){
    applyDraft(existingDraft);
    showToast("Você voltou ✅", "Seus dados estavam salvos aqui. É só terminar e pagar.");
  } else {
    setTimeout(()=>{
      showToast("Tudo certo ✅", "Enquanto você preenche, salvamos aqui neste dispositivo para você não perder nada.");
    }, 700);
  }

  updateWalletUi();
  calc();
  renderProgress();
  renderTimer();
  setInterval(renderTimer, 250);
  loadMyWallet();

  $("btnCopyPix")?.addEventListener("click", copyPixCode);
  $("btnRefreshPixStatus")?.addEventListener("click", async () => {
    try {
      await checkPaymentStatusOnce();
    } catch (e) {
      showToast("Erro", e.message || "Falha ao consultar pagamento.");
    }
  });

  $("btnClosePixModal")?.addEventListener("click", () => {
    closePixModal();
  });

  $("pixModal")?.querySelector(".modalBackdrop")?.addEventListener("click", () => {
    closePixModal();
  });

  window.addEventListener("beforeunload", function(e){
    if (submitted) return;
    const d = collectDraft();
    const touched = Object.keys(d).some(k=>{
      if (k === "ts") return false;
      if (k === "giftwrap") return !!d.giftwrap;
      if (k === "useCoins") return !!d.useCoins;
      if (k === "pack") return String(d.pack||"") !== "";
      return String(d[k]||"").trim().length > 0;
    });
    if (!touched) return;

    e.preventDefault();
    e.returnValue = "";
  });

  $("btnSend").addEventListener("click", async function(){
    if (isCreatingPix) return;

    clearAllErr();

    const built = buildPayloadFromForm();
    if (!built) return;

    const payload = built.payload;

    try {
      isCreatingPix = true;
      setButtonBusy(true);
      stopPaymentPolling();
      resetPixModalVisual();
      openPixModal();

      $("msg").textContent = "⏳ Gerando PIX...";
      pendingCheckoutPayload = payload;

      const pix = await createPixCharge(payload);

      currentPaymentRef = String(
        pix.paymentReference ||
        pix.payment_reference ||
        pix.reference ||
        pix.checkoutReference ||
        pix.checkout_reference ||
        ""
      ).trim();

      const mercadoPagoPaymentId = String(
        pix.paymentId ||
        pix.payment_id ||
        pix.mercadopagoPaymentId ||
        pix.mercadopago_payment_id ||
        pix.id ||
        ""
      ).trim();

      if (!currentPaymentRef) {
        throw new Error(
          "A cobrança PIX foi criada, mas o backend não retornou paymentReference interno."
        );
      }

      console.log("[checkout] paymentReference:", currentPaymentRef);
      console.log("[checkout] mercadopagoPaymentId:", mercadoPagoPaymentId);

      renderPixData(pix, built.calcData);

      $("msg").textContent = "✅ PIX gerado. Faça o pagamento para concluir o pedido.";
      startPaymentPolling();

      try {
        await checkPaymentStatusOnce();
      } catch (e) {
        console.error(e);
      }
    } catch (e) {
      stopPaymentPolling();
      closePixModal();
      $("msg").textContent = "❌ Erro: " + e.message;
      showToast("Erro", "Falha ao gerar PIX: " + e.message);
    } finally {
      isCreatingPix = false;
      setButtonBusy(false);
    }
  });
})();
</script>

</body>
</html>`;
}

module.exports = { renderCheckoutHtml };