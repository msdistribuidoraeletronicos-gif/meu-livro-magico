// render.checkout.html.js
// Página de Checkout — HTML completo
// Export:
//   module.exports = { renderCheckoutHtml }

"use strict";

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
  const basePrice = Number(opts.basePrice || 39.9); // preço base editável
  const printPrice = Number(opts.printPrice || 29.9); // adicional impressão
  const bindPrice = Number(opts.bindPrice || 19.9); // adicional encadernação
  const wrapPrice = Number(opts.wrapPrice || 15); // ✅ adicional embrulho especial

  // ✅ NO SEU SISTEMA ATUAL:
  // Rotas /books/:id, /download/:id, /api/image/:id/:file usam o ID da PASTA (dirId/folderId).
  const dirId = String(book?.dirId || book?.folderId || book?.id || "").trim();

  // ✅ id exibido/lógico (pode ser diferente do dirId)
  const id = String(book?.id || dirId || "").trim();

  const childName = book?.childName || book?.child?.name || "";
  const theme = book?.themeLabel || book?.theme || "";
  const style = book?.styleLabel || book?.style || "";

  const coverUrl = String(book?.coverUrl || "").trim();

  // ✅ Recebe partnerRef das opções
  const partnerRef = opts.partnerRef ? JSON.stringify(opts.partnerRef) : "null";

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
  }
  .btn:active{ transform: translateY(1px); }
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
    border-radius: 24px;
    background: #fff;
    border: 1px solid rgba(229,231,235,.9);
    box-shadow: 0 30px 80px rgba(0,0,0,.20);
    padding: 18px 16px 14px;
    overflow: hidden;
    animation: popIn .18s ease-out;
  }
  @keyframes popIn{
    from{ transform: translateY(6px) scale(.98); opacity: .0; }
    to{ transform: translateY(0) scale(1); opacity: 1; }
  }
  .modalTop{ display:flex; gap:12px; align-items:flex-start; }
  .modalIcon{
    width:46px;height:46px;
    display:grid;place-items:center;
    border-radius:16px;
    background: rgba(124,58,237,.10);
    border:1px solid rgba(124,58,237,.18);
    font-size:22px;
    flex:0 0 auto;
  }
  .modalTitle{ font-weight:1000; font-size:18px; color:#111827; line-height:1.2; }
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
</style>
</head>

<body>
  <div class="wrap">
    <div class="nav">
      <div class="brand">
        <div class="logo">🛒</div>
        <div>Meu Livro Mágico</div>
      </div>
      <div class="navRight">
        <a class="btn btnOutline" href="/books">← Voltar para Meus Livros</a>
        <a class="btn btnPrimary" href="/books/${encodeURIComponent(dirId)}">👀 Ver o livro</a>
        <!-- ✅ Botão Sair -->
        <button class="btn btnOutline" id="btnLogout">🚪 Sair</button>
      </div>
    </div>
  </div>

  <section class="hero">
    <div class="wrap">
      <div class="panel">
        <div class="panelIn">

          <div class="titleRow">
            <div>
              <h1 class="title">Finalizar <span class="gradText">pedido</span></h1>
              <p class="sub">
                Confira os dados do livro e preencha as informações do pedido. Você pode ajustar opções como impressão e encadernação.
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
              <div class="step"><span class="stepNum">3</span> Confirmar</div>
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
                      <div class="miniHelp">Você recebe atualizações do pedido por aqui (sem spam).</div>
                    </div>
                  </div>

                  <div class="row">
                    <div class="field" id="field-email">
                      <label>Email</label>
                      <input id="email" type="email" placeholder="Ex: seuemail@gmail.com" autocomplete="email" />
                      <div class="miniHelp">Confirmação e acompanhamento do pedido.</div>
                    </div>
                  </div>

                  <!-- ✅ ENDEREÇO COMPLETO -->
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
                      <div class="miniHelp"><strong>PIX</strong> confirmado — rápido e sem complicação.</div>
                    </div>
                  </div>

                  <div class="field" id="field-obs">
                    <label>Observações</label>
                    <textarea id="obs" placeholder="Ex: Queria que ficasse o mais delicado possível🧡."></textarea>
                    <div class="miniHelp">Se quiser, diga detalhes de entrega, horário, ou qualquer cuidado especial.</div>
                  </div>

                  <!-- ✅ EMBRULHO ESPECIAL (opcional) -->
                  <div class="field">
                    <label>Extras</label>
                    <div class="checkLine">
                      <input id="giftwrap" type="checkbox" />
                      <div>
                        <div class="checkText">🎁🌟Incluir embrulho especial ✨</div>
                        <div class="checkSub">Adiciona + ${moneyBR(wrapPrice)} ao total (opcional).</div>
                      </div>
                    </div>
                  </div>

                  <!-- ✅ RESUMO -->
                  <div class="priceBox" aria-label="Resumo de valores">
                    <div class="priceRow">
                      <span>Livro</span>
                      <span id="pBook">${moneyBR(basePrice)}</span>
                    </div>

                    <div class="priceRow" id="wrapRow" style="display:none;">
                      <span>Embrulho especial</span>
                      <span id="pWrap">${moneyBR(0)}</span>
                    </div>

                    <div class="priceRow">
                      <span class="total">Total</span>
                      <span class="total" id="pTotal">${moneyBR(basePrice)}</span>
                    </div>
                    <div class="mutedSmall" style="margin-top:8px;">
                      🔒 Você está no controle: revise tudo antes de enviar.
                    </div>
                  </div>

                  <div class="actions">
                    <button class="btn btnOrder" id="btnSend" type="button">
                      <span class="shine" aria-hidden="true"></span>
                      ✅ Enviar pedido
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

  <!-- ✅ TOAST (notificação interna) -->
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

  <!-- ✅ POPUP (confete + email) -->
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

<script>
(function(){
  const BOOK_ID = ${JSON.stringify(String(id || ""))};
  const BASE = ${JSON.stringify(basePrice)};
  const WRAP = ${JSON.stringify(wrapPrice)};

  // ✅ Constante do partnerRef
  const PARTNER_REF = ${partnerRef};

  const $ = (id) => document.getElementById(id);

  // ✅ Logout
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/sales';
    } catch (e) {
      alert('Erro ao sair');
    }
  });

  const DRAFT_KEY = "mlm_checkout_draft_" + BOOK_ID;
  const TIMER_KEY = "mlm_checkout_timer_" + BOOK_ID;

  function money(v){
    try { return Number(v||0).toLocaleString("pt-BR", {style:"currency", currency:"BRL"}); }
    catch(e){ return "R$ " + (Number(v||0).toFixed(2)); }
  }

  // ✅ calcula: livro = base + pack ; embrulho = (checkbox) ; total = livro + embrulho
  function calc(){
    const opt = $("pack");
    const sel = opt.options[opt.selectedIndex];
    const packAdd = Number(sel.getAttribute("data-add") || 0);

    const bookValue = Number(BASE) + packAdd;

    const wrapChecked = !!($("giftwrap") && $("giftwrap").checked);
    const wrapValue = wrapChecked ? Number(WRAP) : 0;

    const total = bookValue + wrapValue;

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

    return {
      packAdd,
      bookValue,
      wrapChecked,
      wrapValue,
      total,
      packLabel: sel.textContent
    };
  }

  // ✅ “Efeito de dotação”: salvar rascunho local enquanto preenche
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
      // timestamp (útil se você quiser expirar no futuro)
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

    // some sozinho depois de um tempo
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

  function showSuccessModal(customerName, customerEmail, orderId){
    const modal = document.getElementById("successModal");
    const okBtn = document.getElementById("modalOk");
    const confettiWrap = document.getElementById("confettiWrap");
    const modalSub = document.getElementById("modalSub");
    const modalEmail = document.getElementById("modalEmail");

    const nm = String(customerName || "").trim();
    const em = String(customerEmail || "").trim();

    const safeName = escHtml(nm);
    const safeEmail = escHtml(em);

    if (modalSub){
      modalSub.innerHTML =
        (safeName ? ("Parabéns, <b>" + safeName + "</b>! ") : "Parabéns! ") +
        "Você acabou de adquirir o <b>Meu Livro Mágico</b> ✨<br/>Seu pequeno vai se sentir o protagonista dessa aventura!" +
        (orderId ? "<br/>Nº do pedido: <b>" + escHtml(orderId) + "</b>" : "");
    }
    if (modalEmail) modalEmail.textContent = safeEmail || "-";

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

    function close(){
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }

    okBtn.onclick = close;

    const backdrop = modal.querySelector(".modalBackdrop");
    if (backdrop) backdrop.onclick = close;

    const onKey = (e)=>{ if (e.key === "Escape") { close(); window.removeEventListener("keydown", onKey); } };
    window.addEventListener("keydown", onKey);

    setTimeout(()=> okBtn && okBtn.focus(), 50);
  }

  // ✅ inputs: pequenos formatadores
  const cepEl = $("cep");
  if (cepEl){
    cepEl.addEventListener("input", ()=>{ cepEl.value = cleanCep(cepEl.value); });
  }
  const ufEl = $("uf");
  if (ufEl){
    ufEl.addEventListener("input", ()=>{ ufEl.value = normUF(ufEl.value); });
  }

  function buildAddress(){
    const cep = cleanCep(($("cep").value||""));
    const uf = normUF(($("uf").value||""));
    const street = ($("street").value||"").trim();
    const num = ($("number").value||"").trim();
    const comp = ($("comp").value||"").trim();
    const district = ($("district").value||"").trim();
    const city = ($("city").value||"").trim();
    const ref = ($("ref").value||"").trim();

    const line1 = [
      street ? street : "",
      num ? ("nº " + num) : "",
      comp ? ("(" + comp + ")") : ""
    ].filter(Boolean).join(", ");

    const line2 = [
      district ? district : "",
      (city || uf) ? ([city, uf].filter(Boolean).join("/") ) : "",
      cep ? ("CEP " + (cep.length === 8 ? (cep.slice(0,5) + "-" + cep.slice(5)) : cep)) : ""
    ].filter(Boolean).join(" — ");

    return { cep, uf, street, num, comp, district, city, ref, line1, line2 };
  }

  function hasMinAddress(a){
    return !!(a.street && a.num && a.district && a.city && a.uf);
  }

  // ✅ Progresso do formulário (clareza + “controle”)
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
        hint.innerHTML = "✅ Tudo pronto. Só <b>enviar o pedido</b>.";
      } else if (p.pct >= 70){
        hint.innerHTML = "✨ Está ficando pronto. Falta pouco para <b>confirmar</b>.";
      } else {
        hint.innerHTML = "✅ Suas informações ficam <b>salvas aqui</b> enquanto você preenche (se você sair, não perde).";
      }
    }
  }

  // ✅ Timer “urgência” local (ética): reserva deste checkout no dispositivo
  function getOrCreateTimerEnd(){
    const now = Date.now();
    const stored = Number(localStorage.getItem(TIMER_KEY) || 0);
    if (stored && Number.isFinite(stored) && stored > now + 5*1000) return stored;

    // 15 minutos por padrão
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
      // quando faltar pouco, destaca mais (sem trocar paleta)
      if (s <= 180){
        pill.classList.add("pillDanger");
      } else {
        pill.classList.remove("pillDanger");
      }
    }

    if (s <= 0){
      // “expira” só para reforçar; mantém rascunho salvo
      try { localStorage.removeItem(TIMER_KEY); } catch(e){}
      if (tv) tv.textContent = "00:00";
    }
  }

  // ✅ validação visual
  function setErr(fieldId, on){
    const el = document.getElementById("field-" + fieldId);
    if (!el) return;
    if (on) el.classList.add("fieldError");
    else el.classList.remove("fieldError");
  }

  function clearAllErr(){
    ["name","whats","email","cep","uf","street","number","district","city","obs"].forEach(id => setErr(id,false));
  }

  // ✅ Bind calcula + progress
  $("pack").addEventListener("change", ()=>{ calc(); saveAndUpdate(); });
  const gw = $("giftwrap");
  if (gw) gw.addEventListener("change", ()=>{ calc(); saveAndUpdate(); });

  function saveAndUpdate(){
    setDraft(collectDraft());
    renderProgress();
  }

  // ✅ auto-save em todos inputs
  const autos = ["name","whats","email","cep","uf","street","number","comp","district","city","ref","obs"];
  autos.forEach(id=>{
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", ()=>{
      // micro “notificação”: quando já começou a preencher, reforça que está salvo
      saveAndUpdate();
    });
    el.addEventListener("blur", saveAndUpdate);
  });

  // ✅ Restaurar draft
  const existingDraft = getDraft();
  if (existingDraft){
    applyDraft(existingDraft);
    showToast("Você voltou ✅", "Seus dados estavam salvos aqui. É só terminar e enviar.");
  } else {
    // primeira entrada: micro “notificação” educativa
    setTimeout(()=>{
      showToast("Tudo certo ✅", "Enquanto você preenche, salvamos aqui neste dispositivo para você não perder nada.");
    }, 700);
  }

  // ✅ Inicial
  calc();
  renderProgress();
  renderTimer();
  setInterval(renderTimer, 250);

  // ✅ aviso ao tentar sair (FOMO “ético”: não perder trabalho)
  let submitted = false;
  window.addEventListener("beforeunload", function(e){
    if (submitted) return;
    const d = collectDraft();
    const touched = Object.keys(d).some(k=>{
      if (k === "ts") return false;
      if (k === "giftwrap") return !!d.giftwrap;
      if (k === "pack") return String(d.pack||"") !== "";
      return String(d[k]||"").trim().length > 0;
    });
    if (!touched) return;

    // mensagem é controlada pelo browser
    e.preventDefault();
    e.returnValue = "";
  });

  function buildOrderText(args){
    const {
      name, email, whatsClean, addrText, v, payLabel, obs
    } = args;

    const giftLine = v.wrapChecked
      ? ("🎁 Embrulho especial: SIM (" + money(v.wrapValue) + ")\\n")
      : ("🎁 Embrulho especial: NÃO\\n");

    const text =
      "🛒 *Pedido — Meu Livro Mágico*\\n" +
      "📘 Livro ID: " + BOOK_ID + "\\n" +
      (${JSON.stringify(childName || "")} ? ("👧/👦 Criança: " + ${JSON.stringify(childName || "")} + "\\n") : "") +
      (${JSON.stringify(theme || "")} ? ("🎭 Tema: " + ${JSON.stringify(theme || "")} + "\\n") : "") +
      (${JSON.stringify(style || "")} ? ("🖍️ Estilo: " + ${JSON.stringify(style || "")} + "\\n") : "") +
      "\\n" +
      "👤 Nome: " + name + "\\n" +
      "📧 Email: " + email + "\\n" +
      "📱 WhatsApp: " + whatsClean + "\\n" +
      addrText +
      "\\n" +
      "🧾 Opção: " + v.packLabel + "\\n" +
      giftLine +
      "💳 Pagamento: " + payLabel + "\\n" +
      "💰 Total: " + money(v.total) + "\\n" +
      (obs ? ("📝 Obs: " + obs + "\\n") : "");

    return text;
  }

  // ✅ NOVO: lógica do botão Enviar (usando fetch para /api/checkout)
  $("btnSend").addEventListener("click", async function(){
    clearAllErr();

    const name = ($("name").value||"").trim();
    const whatsClean = cleanPhone($("whats").value);
    const email = ($("email").value||"").trim();

    const payLabel = "PIX";

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
      $("msg").textContent = "⚠️ Revise os campos marcados para enviar o pedido.";
      showToast("Quase ✅", "Falta só completar os campos marcados para enviar.");
      // rola para o topo da área do formulário
      try { $("msg").scrollIntoView({behavior:"smooth", block:"center"}); } catch(e){}
      return;
    }

    if(!hasMinAddress(addr)){
      $("msg").textContent = "⚠️ Preencha o endereço completo (Rua, Nº, Bairro, Cidade e UF).";
      showToast("Endereço incompleto", "Complete Rua, Nº, Bairro, Cidade e UF para continuar.");
      return;
    }

    const addrText =
      "📍 Endereço:\\n" +
      (addr.line1 ? ("- " + addr.line1 + "\\n") : "") +
      (addr.line2 ? ("- " + addr.line2 + "\\n") : "") +
      (addr.ref ? ("- Referência: " + addr.ref + "\\n") : "");

    // Monta payload para a API
    const payload = {
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
      total: v.total,
      obs,
      partnerRef: PARTNER_REF,
    };

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao processar pedido');

      // ✅ marca como “enviado” (não travar o beforeunload)
      submitted = true;

      // ✅ mantém rascunho (útil) mas reseta timer de “reserva” para não ficar piscando
      try { localStorage.removeItem(TIMER_KEY); } catch(e){}

      $("msg").textContent = "✅ Pedido enviado com sucesso!";
      showSuccessModal(name, email, result.orderId);
    } catch (e) {
      showToast('Erro', 'Falha ao enviar pedido: ' + e.message);
      $("msg").textContent = "❌ Erro: " + e.message;
    }
  });
})();
</script>

</body>
</html>`;
}

module.exports = { renderCheckoutHtml };