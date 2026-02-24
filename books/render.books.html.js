// render.books.html.js
// Página "Meus Livros" (galeria) — HTML completo
// Export:
//   module.exports = { renderBooksHtml }
// (e também funciona se você der require(...) direto, via normalização no routes.js)

"use strict";

function renderBooksHtml() {
  const ratioNum = 1020;
  const ratioDen = 797;

  return `<!doctype html>

<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Meus Livros — Meu Livro Mágico</title>
<meta name="description" content="Sua biblioteca de livros gerados: veja capa, páginas e baixe o PDF. Se ainda não criou, veja exemplos, depoimentos e ideias de uso."/>
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
    --shadow: 0 22px 55px rgba(124,58,237,.18);
    --shadow2: 0 12px 30px rgba(17,24,39,.10);
    --r: 22px;
    --imgARW: ${ratioNum};
    --imgARH: ${ratioDen};
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

  /* Buttons */
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
  .btnTiny{
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 900;
  }

  /* Hero */
  .hero{
    position:relative;
    overflow:hidden;
    padding: 22px 0 36px;
  }
  .stars{
    position:absolute; inset:0;
    pointer-events:none;
    overflow:hidden;
  }
  .star{
    position:absolute;
    width: 18px; height: 18px;
    opacity:.45;
    animation: floatY var(--dur, 4s) ease-in-out infinite;
    will-change: transform, opacity;
    filter: drop-shadow(0 10px 10px rgba(245,158,11,.10));
  }
  .star svg{ width:100%; height:100%; display:block; }
  @keyframes floatY{
    0%{ transform: translateY(0); opacity:.18; }
    50%{ transform: translateY(-18px); opacity:.55; }
    100%{ transform: translateY(0); opacity:.18; }
  }

  .badge{
    display:inline-flex;
    align-items:center;
    gap:10px;
    padding: 10px 14px;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(124,58,237,.12), rgba(219,39,119,.12));
    color: rgba(109,40,217,1);
    border: 1px solid rgba(124,58,237,.16);
    font-weight: 850;
    font-size: 13px;
    box-shadow: 0 14px 28px rgba(124,58,237,.08);
  }

  .heroGrid{
    display:grid;
    grid-template-columns: 1fr;
    gap: 14px;
    align-items:stretch;
  }

  .heroLibTop{
    display:flex;
    align-items:flex-end;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
    margin-top: 10px;
  }
  .heroLibTitle{
    margin: 14px 0 6px;
    font-size: 34px;
    line-height: 1.06;
    font-weight: 1000;
    letter-spacing: -1px;
    color: var(--gray-900);
  }
  @media (min-width: 768px){ .heroLibTitle{ font-size: 44px; } }

  .heroLibSub{
    margin: 0;
    max-width: 80ch;
    font-size: 15px;
    line-height: 1.65;
    color: var(--gray-600);
    font-weight: 750;
  }

  .widePanel{
    background: rgba(255,255,255,.85);
    border: 1px solid rgba(17,24,39,.06);
    border-radius: 26px;
    box-shadow: var(--shadow2);
    overflow:hidden;
    position:relative;
  }
  .widePanel::after{
    content:"";
    position:absolute; inset:0;
    background: radial-gradient(900px 240px at 70% 0%, rgba(252,211,77,.18), transparent 55%);
    pointer-events:none;
  }
  .wideIn{
    position:relative; z-index:2;
    padding: 16px;
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap: 14px;
    flex-wrap:wrap;
  }
  .wideLeft{
    min-width: 260px;
    flex: 1 1 420px;
  }
  .wideRight{
    flex: 0 1 420px;
    min-width: 260px;
  }

  .heroCard{
    background: rgba(255,255,255,.85);
    border: 1px solid rgba(17,24,39,.06);
    border-radius: 26px;
    box-shadow: var(--shadow2);
    overflow:hidden;
    position:relative;
  }
  .heroCard::after{
    content:"";
    position:absolute; inset:0;
    background:
      radial-gradient(800px 260px at 18% 0%, rgba(124,58,237,.18), transparent 60%),
      radial-gradient(700px 260px at 85% 20%, rgba(219,39,119,.14), transparent 55%);
    pointer-events:none;
  }
  .heroIn{
    position:relative;
    z-index:2;
    padding: 18px 18px 16px;
  }

  .gradText{
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600), var(--amber-500));
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent;
  }

  .ctaRow{
    margin-top: 14px;
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    align-items:center;
  }

  .panelT{
    margin:0;
    font-weight:1000;
    letter-spacing:-.2px;
    color: var(--gray-900);
    font-size: 16px;
  }
  .panelP{
    margin: 8px 0 0;
    color: var(--gray-600);
    font-weight: 750;
    line-height: 1.6;
    font-size: 13.5px;
  }

  .stats{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
  }
  .stat{
    border-radius: 18px;
    background: rgba(245,243,255,.72);
    border: 1px solid rgba(221,214,254,.85);
    padding: 12px;
  }
  .statN{
    font-weight: 1000;
    font-size: 18px;
    color: rgba(109,40,217,1);
  }
  .statL{
    margin-top: 4px;
    font-weight: 850;
    font-size: 12px;
    color: rgba(75,85,99,.95);
    line-height: 1.35;
  }

  .quoteBox{
    margin-top: 12px;
    border-radius: 18px;
    border: 1px solid rgba(221,214,254,.85);
    background: rgba(255,255,255,.78);
    padding: 12px;
  }
  .quoteTxt{
    font-weight: 950;
    color: var(--gray-800);
    line-height: 1.55;
    font-size: 13.5px;
  }
  .quoteMeta{
    margin-top: 10px;
    font-weight: 900;
    color: rgba(75,85,99,.85);
    font-size: 12px;
    display:flex;
    justify-content:space-between;
    gap:10px;
    flex-wrap:wrap;
    align-items:center;
  }
  .dots{ display:flex; gap:6px; align-items:center; }
  .dot{
    width: 8px; height: 8px;
    border-radius: 999px;
    border:1px solid rgba(221,214,254,.95);
    background: rgba(124,58,237,.14);
  }
  .dot.on{ background: rgba(124,58,237,.70); }

  .chips{
    display:flex; gap:8px; flex-wrap:wrap;
    margin-top: 12px;
  }
  .chip{
    display:inline-flex; align-items:center; gap:8px;
    padding: 9px 12px;
    border-radius: 999px;
    border: 1px solid rgba(221,214,254,.90);
    background: rgba(245,243,255,.72);
    font-weight: 900;
    color: rgba(109,40,217,1);
    cursor:pointer;
    user-select:none;
    box-shadow: 0 10px 22px rgba(17,24,39,.04);
  }
  .chip:hover{ background: rgba(245,243,255,.90); }
  .chip:active{ transform: translateY(1px); }

  .momentNote{
    margin-top: 10px;
    color: rgba(75,85,99,.95);
    font-weight: 800;
    font-size: 13px;
    line-height: 1.55;
  }

  .sectionWhite{
    background: #fff;
    padding: 74px 0;
    border-top: 1px solid rgba(17,24,39,.05);
  }
  .sectionHead{
    text-align:center;
    margin-bottom: 38px;
  }
  .h2{
    margin:0 0 10px;
    font-size: 28px;
    font-weight: 1000;
    letter-spacing: -.4px;
    color: var(--gray-900);
  }
  @media (min-width: 768px){ .h2{ font-size: 38px; } }
  .subP{
    margin: 0 auto;
    max-width: 66ch;
    color: var(--gray-600);
    font-weight: 750;
    line-height: 1.65;
  }

  .grid3{
    display:grid;
    grid-template-columns: 1fr;
    gap: 18px;
    max-width: 980px;
    margin: 0 auto;
  }
  @media (min-width: 900px){
    .grid3{ grid-template-columns: 1fr 1fr 1fr; }
  }

  .card{
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(17,24,39,.06);
    border-radius: 24px;
    box-shadow: var(--shadow2);
    overflow:hidden;
  }
  .cardIn{
    padding: 16px;
  }
  .cardT{
    margin:0;
    font-weight: 1000;
    font-size: 18px;
    letter-spacing: -.2px;
    color: var(--gray-900);
  }
  .cardP{
    margin: 8px 0 0;
    color: var(--gray-600);
    font-weight: 750;
    line-height: 1.65;
    font-size: 14px;
  }

  .iconBox{
    width: 64px; height: 64px;
    border-radius: 20px;
    display:grid; place-items:center;
    font-size: 30px;
    color:#fff;
    box-shadow: 0 18px 40px rgba(17,24,39,.10);
    margin-bottom: 12px;
  }
  .g1{ background: linear-gradient(135deg, #7c3aed, #6d28d9); }
  .g2{ background: linear-gradient(135deg, #db2777, #e11d48); }
  .g3{ background: linear-gradient(135deg, #f59e0b, #f97316); }

  .controls{
    margin-top: 12px;
    display:grid;
    grid-template-columns: 1.3fr .8fr .8fr .8fr auto;
    gap:10px;
  }
  @media (max-width: 980px){ .controls{ grid-template-columns: 1fr 1fr; } }

  input, select, button{
    width:100%;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid rgba(221,214,254,.95);
    background: rgba(255,255,255,.78);
    color: var(--gray-800);
    font-weight: 900;
    outline:none;
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
  }
  input::placeholder{ color: rgba(107,114,128,.85); }
  select{ cursor:pointer; }
  button{
    cursor:pointer;
    border:0;
    color:#fff;
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
    box-shadow: 0 18px 40px rgba(124,58,237,.18);
  }
  button:hover{
    background: linear-gradient(90deg, var(--violet-700), var(--pink-700));
    box-shadow: 0 18px 44px rgba(124,58,237,.24);
  }

  .gridBooks{
    margin-top: 14px;
    display:grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }
  @media (max-width: 1040px){ .gridBooks{ grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px){ .gridBooks{ grid-template-columns: 1fr; } }

  .bookCard{
    border-radius: 24px;
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(17,24,39,.06);
    box-shadow: var(--shadow2);
    overflow:hidden;
    display:flex;
    flex-direction:column;
    min-height: 455px;
  }
  .cover{
    height: 250px;
    background: linear-gradient(135deg, rgba(124,58,237,.10), rgba(219,39,119,.10));
    display:grid;
    place-items:center;
    position:relative;
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

  .badges{
    position:absolute;
    left:12px; top:12px;
    display:flex; gap:8px; flex-wrap:wrap;
  }
  .pillMini{
    font-size: 12px;
    font-weight: 1000;
    padding: 7px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,.78);
    border: 1px solid rgba(221,214,254,.95);
    color: rgba(109,40,217,1);
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
  }
  .pillOk{
    border-color: rgba(16,185,129,.35);
    color: rgba(5,150,105,1);
  }
  .pillFail{
    border-color: rgba(239,68,68,.35);
    color: rgba(220,38,38,1);
  }
  .pillWork{
    border-color: rgba(245,158,11,.35);
    color: rgba(217,119,6,1);
  }

  .bookBody{
    padding: 14px 14px 16px;
    display:flex;
    flex-direction:column;
    gap: 10px;
    flex:1;
  }
  .bookH{
    font-weight: 1000;
    color: var(--gray-900);
    letter-spacing: -.2px;
    font-size: 16px;
    line-height: 1.2;
  }
  .meta{
    color: var(--gray-600);
    font-weight: 800;
    font-size: 12.5px;
    line-height: 1.55;
  }

  /* ✅ NOVO: Botões do card (retangulares, mais persuasivos, sem PDF) */
  /* ✅ Botões do card (CTA forte) */
/* ✅ Botões do card (CTA forte) */
.rowBtns{
  margin-top:auto;
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.aBtn{
  position:relative;
  width:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  padding: 12px 12px;
  border-radius: 16px;
  border: 1px solid rgba(221,214,254,.95);
  background: rgba(255,255,255,.82);
  color: rgba(109,40,217,1);
  font-weight: 1000;
  box-shadow: 0 12px 26px rgba(17,24,39,.06);
  transition: transform .15s ease, box-shadow .15s ease, filter .15s ease, background .15s ease;
  text-align:center;
  line-height:1;
  min-height: 46px;
  overflow:hidden;
}

.aBtn:hover{
  transform: translateY(-1px);
  box-shadow: 0 18px 42px rgba(17,24,39,.10);
  background: rgba(245,243,255,.92);
  border-color: rgba(196,181,253,.98);
}

.aBtn:active{
  transform: translateY(0px);
  box-shadow: 0 12px 26px rgba(17,24,39,.08);
}

/* Abrir (continua bonito e “seguro”) */
.aBtn.primary{
  border: 0;
  color: #fff;
  background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
  box-shadow: 0 18px 40px rgba(124,58,237,.22);
}
.aBtn.primary:hover{
  background: linear-gradient(90deg, var(--violet-700), var(--pink-700));
  box-shadow: 0 22px 50px rgba(124,58,237,.28);
  filter: saturate(1.08);
}
.aBtn.primary::after{
  content:"";
  position:absolute; inset:-2px;
  border-radius: 18px;
  background: radial-gradient(220px 90px at 20% 0%, rgba(255,255,255,.28), transparent 60%);
  pointer-events:none;
  opacity:.9;
}

/* ✅ Fazer pedido (CTA “quente”: urgência visual + brilho + pulso sutil) */
.aBtn.order{
  border: 0;
  color: #fff;
  background: linear-gradient(90deg, #ef4444, #f97316); /* vermelho -> laranja */
  box-shadow: 0 18px 44px rgba(239,68,68,.22);
  transform: translateZ(0);
}

.aBtn.order:hover{
  background: linear-gradient(90deg, #dc2626, #fb923c);
  box-shadow: 0 24px 58px rgba(239,68,68,.30);
  filter: saturate(1.10);
}

/* brilho no topo (tipo “botão de app”) */
.aBtn.order::before{
  content:"";
  position:absolute;
  left:-40%;
  top:-60%;
  width: 180%;
  height: 140%;
  background: radial-gradient(closest-side, rgba(255,255,255,.26), transparent 60%);
  transform: rotate(10deg);
  pointer-events:none;
  opacity:.95;
}

/* borda “glow” leve */
.aBtn.order::after{
  content:"";
  position:absolute; inset:-2px;
  border-radius: 18px;
  background: radial-gradient(200px 70px at 50% 10%, rgba(255,255,255,.18), transparent 65%);
  pointer-events:none;
}

/* chip de confiança/ação (PIX / rápido / etc.) */
.aBtn .tag{
  display:inline-flex;
  align-items:center;
  gap:6px;
  font-size: 11px;
  font-weight: 1000;
  padding: 6px 8px;
  border-radius: 999px;
  line-height: 1;
  white-space:nowrap;
}

.aBtn.order .tag{
  background: rgba(255,255,255,.18);
  border: 1px solid rgba(255,255,255,.22);
  color: rgba(255,255,255,.95);
  box-shadow: 0 12px 26px rgba(0,0,0,.12);
}

/* microtexto (ajuda MUITO na persuasão) */
.aBtn .sub{
  display:block;
  font-size: 11px;
  font-weight: 900;
  opacity: .92;
  margin-top: 2px;
  line-height: 1.05;
}

/* “pulse” bem sutil (chama o olho sem parecer spam) */
@keyframes ctaPulse{
  0%   { box-shadow: 0 18px 44px rgba(239,68,68,.20); }
  50%  { box-shadow: 0 22px 56px rgba(239,68,68,.30); }
  100% { box-shadow: 0 18px 44px rgba(239,68,68,.20); }
}
.aBtn.order{
  animation: ctaPulse 1.85s ease-in-out infinite;
}

/* acessibilidade: se o usuário não gosta de animação */
@media (prefers-reduced-motion: reduce){
  .aBtn.order{ animation: none; }
}
  .aBtn.order:hover{
    border-color: rgba(245,158,11,.55);
    background:
      radial-gradient(260px 110px at 25% 0%, rgba(252,211,77,.45), transparent 62%),
      rgba(255,255,255,.92);
    box-shadow: 0 18px 44px rgba(245,158,11,.14);
  }
  .aBtn.order .tag{
    display:inline-flex;
    align-items:center;
    gap:6px;
    font-size: 11px;
    font-weight: 1000;
    padding: 6px 8px;
    border-radius: 999px;
    background: rgba(245,158,11,.14);
    border: 1px solid rgba(245,158,11,.26);
    color: rgba(146,64,14,1);
    line-height: 1;
  }

  .noteLine{
    margin-top: 12px;
    color: var(--gray-600);
    font-weight: 800;
    font-size: 13px;
    line-height: 1.55;
  }

  .shelf{
    margin-top: 14px;
    display:grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  @media (min-width: 900px){
    .shelf{ grid-template-columns: 1.05fr .95fr; }
  }
  .exRow{
    display:flex;
    gap: 12px;
    flex-wrap:wrap;
    margin-top: 10px;
  }
  .exBook{
    flex: 1;
    min-width: 210px;
    border-radius: 22px;
    border:1px solid rgba(17,24,39,.06);
    background:
      radial-gradient(600px 200px at 20% 20%, rgba(255,255,255,.28), transparent 55%),
      linear-gradient(135deg, rgba(124,58,237,.40), rgba(219,39,119,.34));
    padding: 14px;
    box-shadow: 0 18px 40px rgba(17,24,39,.10);
    position:relative;
    overflow:hidden;
  }
  .exBook::after{
    content:"";
    position:absolute; inset:0;
    background: radial-gradient(800px 220px at 18% 0%, rgba(255,255,255,.25), transparent 60%);
    pointer-events:none;
  }
  .exT{ position:relative; z-index:1; font-weight: 1000; color: #fff; letter-spacing:-.2px; }
  .exD{ position:relative; z-index:1; margin-top: 6px; color: rgba(255,255,255,.90); font-weight: 800; font-size: 12.5px; line-height:1.45; }
  .exTag{
    position:relative; z-index:1;
    margin-top: 10px;
    display:inline-flex; gap:8px; align-items:center;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(255,255,255,.22);
    border:1px solid rgba(255,255,255,.30);
    font-weight: 1000;
    font-size: 12px;
    color:#fff;
    box-shadow: 0 12px 26px rgba(17,24,39,.10);
  }

  .cta{
    padding: 80px 0;
    background: linear-gradient(135deg, #7c3aed, #6d28d9, #db2777);
    color:#fff;
  }
  .ctaBox{
    max-width: 860px;
    margin: 0 auto;
    text-align:center;
    padding: 0 16px;
  }
  .ctaH{
    margin: 0 0 12px;
    font-size: 30px;
    font-weight: 1000;
    letter-spacing: -.4px;
  }
  @media (min-width: 768px){ .ctaH{ font-size: 40px; } }
  .ctaP{
    margin: 0 auto 22px;
    max-width: 70ch;
    color: rgba(255,255,255,.86);
    font-weight: 750;
    line-height: 1.7;
    font-size: 18px;
  }
  .btnWhite{
    background:#fff;
    color: var(--violet-700);
    box-shadow: 0 18px 40px rgba(0,0,0,.18);
  }
  .btnWhite:hover{ background: rgba(255,255,255,.92); }

  .faq{
    max-width: 980px;
    margin: 0 auto;
    display:grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .faqItem{
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(17,24,39,.06);
    border-radius: 24px;
    box-shadow: var(--shadow2);
    overflow:hidden;
  }
  .faqQ{
    width:100%;
    text-align:left;
    padding: 16px;
    background: transparent;
    border:0;
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap: 12px;
    font-weight: 1000;
    color: var(--gray-900);
    font-size: 16px;
  }
  .faqA{
    padding: 0 16px 16px;
    color: var(--gray-600);
    font-weight: 750;
    line-height: 1.7;
    font-size: 14px;
    display:none;
  }
  .faqItem.open .faqA{ display:block; }
  .chev{
    width: 34px; height: 34px;
    border-radius: 999px;
    display:grid; place-items:center;
    background: rgba(245,243,255,.80);
    border: 1px solid rgba(221,214,254,.95);
    color: rgba(109,40,217,1);
    flex: 0 0 auto;
  }
  .faqItem.open .chev{ transform: rotate(180deg); }

  .reveal{
    opacity:0;
    transform: translateY(18px);
    transition: opacity .55s ease, transform .55s ease;
  }
  .reveal.on{
    opacity:1;
    transform: translateY(0);
  }

  .hide{ display:none !important; }
</style>
</head>

<body>
  <div class="wrap">
    <div class="nav">
      <div class="brand">
        <div class="logo">📚</div>
        <div>Meu Livro Mágico</div>
      </div>
      <div class="navRight">
        <a class="btn btnOutline btnTiny" href="/sales" title="Vendas">Pagina Inicial</a>
        <a class="btn btnPrimary" href="/create" title="Criar agora">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 21l9-9" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M14 4l6 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M12 6l6 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M7 11l6 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Criar Livro
        </a>
      </div>
    </div>
  </div>

  <section class="hero">
    <div class="stars" id="stars"></div>
    <div class="wrap">
      <div class="heroGrid">
        <div class="heroCard reveal" id="h1">
          <div class="heroIn">
            <div class="badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2l1.2 4.1L17 7.2l-3.8 1.1L12 12l-1.2-3.7L7 7.2l3.8-1.1L12 2z" stroke="rgba(124,58,237,1)" stroke-width="2" stroke-linejoin="round"/>
                <path d="M19 12l.7 2.3L22 15l-2.3.7L19 18l-.7-2.3L16 15l2.3-.7L19 12z" stroke="rgba(219,39,119,1)" stroke-width="2" stroke-linejoin="round"/>
              </svg>
              <span>Sua biblioteca mágica • seus livros</span>
            </div>

            <div class="heroLibTop">
              <div>
                <h1 class="heroLibTitle">
                  Minha <span class="gradText">biblioteca</span>
                </h1>
                <p class="heroLibSub">
                  Aqui aparecem os livros do usuário logado. Clique em <b>Abrir</b> para ver as páginas.
                </p>
              </div>

              <div class="ctaRow" style="margin-top:0">
                <a class="btn btnPrimary" href="/create" title="Criar agora">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 21l9-9" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <path d="M14 4l6 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <path d="M12 6l6 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <path d="M7 11l6 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  Criar Livro
                </a>
              </div>
            </div>

            <div style="margin-top:14px;">
              <div class="controls" style="margin-top:0;">
                <input id="q" placeholder="Buscar por nome da criança, tema, estilo, status..." />
                <select id="status">
                  <option value="">Status (todos)</option>
                  <option value="done">done</option>
                  <option value="generating">generating</option>
                  <option value="failed">failed</option>
                  <option value="created">created</option>
                </select>
                <select id="style">
                  <option value="">Estilo (todos)</option>
                  <option value="read">read (leitura)</option>
                  <option value="color">color (colorir)</option>
                </select>
                <select id="theme">
                  <option value="">Tema (todos)</option>
                  <option value="space">space</option>
                  <option value="dragon">dragon</option>
                  <option value="ocean">ocean</option>
                  <option value="jungle">jungle</option>
                  <option value="superhero">superhero</option>
                  <option value="dinosaur">dinosaur</option>
                </select>
                <button id="refresh">🔄 Atualizar</button>
              </div>

              <div id="grid" class="gridBooks"></div>
              <div class="noteLine" id="note"></div>
            </div>
          </div>
        </div>

        <div class="widePanel reveal" id="h2">
          <div class="wideIn">
            <div class="wideLeft">
              <h3 class="panelT" style="font-size:18px;">✨ Momentos Mágicos</h3>
              <p class="panelP" style="font-size:14px;">
                O que torna um livro realmente especial não é só a história, mas os momentos que ele cria. Seja a leitura antes de dormir, um presente inesquecível ou uma atividade de colorir, cada livro tem o poder de transformar momentos simples em memórias mágicas. Explore ideias e inspire-se para criar experiências únicas com seus livros! ✨
              </p>

              <div class="stats" aria-label="Estatísticas rápidas">
                <div class="stat">
                  <div class="statN" id="statTotal">—</div>
                  <div class="statL">livro(s) no total</div>
                </div>
                <div class="stat">
                  <div class="statN" id="statDone">—</div>
                  <div class="statL">pronto(s) com PDF</div>
                </div>
              </div>
            </div>

            <div class="wideRight">
              <div class="quoteBox" style="margin-top:0;">
                <div class="quoteTxt" id="quoteTxt">Carregando…</div>
                <div class="quoteMeta">
                  <div id="quoteName">—</div>
                  <div class="dots" id="quoteDots"></div>
                </div>
              </div>

              <div class="chips" aria-label="Momentos mágicos" style="margin-top:12px;">
                <div class="chip" data-chip="📚 Leitura antes de dormir">📚 Antes de dormir</div>
                <div class="chip" data-chip="🎁 Presente inesquecível">🎁 Presente</div>
                <div class="chip" data-chip="🖍️ Pintar e reler">🖍️ Colorir</div>
                <div class="chip" data-chip="👨‍👩‍👧 Ler em família">👨‍👩‍👧 Família</div>
                <div class="chip" data-chip="🏫 Levar pra escola">🏫 Escola</div>
              </div>

              <div class="momentNote" id="momentNote" style="margin-top:10px;">
                Clique em um “momento” acima pra ver uma ideia de uso ✨
              </div>
            </div>
          </div>
        </div>

        <div id="emptyShelf" class="shelf hide">
          <div class="card reveal" id="e1">
            <div class="cardIn">
              <div class="iconBox g1">🪄</div>
              <h3 class="cardT">Ainda não tem livros por aqui?</h3>
              <p class="cardP">
                Sem problemas! Abaixo vão alguns <b>exemplos</b> e ideias de uso para você se inspirar.
                Quando você criar o primeiro livro, ele aparece automaticamente na sua biblioteca.
              </p>
              <div class="ctaRow">
                <a class="btn btnPrimary" href="/create">Criar meu primeiro livro</a>
                <a class="btn btnOutline" href="/sales">Ver vendas / presentes</a>
              </div>

              <div class="exRow" aria-label="Exemplos de livros">
                <div class="exBook">
                  <div class="exT">🚀 A Aventura de Maria no Espaço</div>
                  <div class="exD">Leitura (colorido) • perfeito para “boa noite” com brilho nos olhos.</div>
                  <div class="exTag">⭐ Tema: Viagem Espacial</div>
                </div>
                <div class="exBook" style="background:
                  radial-gradient(600px 200px at 20% 20%, rgba(255,255,255,.28), transparent 55%),
                  linear-gradient(135deg, rgba(16,185,129,.40), rgba(59,130,246,.34));">
                  <div class="exT">🦖 O Dia em que o João Salvou os Dinossauros</div>
                  <div class="exD">Leitura + Colorir • a criança pinta e relê a própria história.</div>
                  <div class="exTag">🖍️ Modo: Colorir</div>
                </div>
                <div class="exBook" style="background:
                  radial-gradient(600px 200px at 20% 20%, rgba(255,255,255,.28), transparent 55%),
                  linear-gradient(135deg, rgba(245,158,11,.40), rgba(249,115,22,.34));">
                  <div class="exT">🐉 O Castelo dos Dragões e o Abraço Corajoso</div>
                  <div class="exD">Ótimo para presentear: capa linda + impressão fácil + encadernação simples.</div>
                  <div class="exTag">🎁 Ideia: Presente</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card reveal" id="e2">
            <div class="cardIn">
              <div class="iconBox g2">💬</div>
              <h3 class="cardT">O que as crianças “dizem”</h3>
              <p class="cardP">
                A parte mais legal é ver a reação quando elas se enxergam como protagonista.
                Isso aqui é o tipo de frase que costuma aparecer:
              </p>
              <div class="quoteBox" style="margin-top:12px;">
                <div class="quoteTxt" id="quoteTxt2">“Eu sou eu no livro! Olha mãe!!!”</div>
                <div class="quoteMeta">
                  <div id="quoteName2">— Maria, 6 anos</div>
                  <div style="font-weight:900;color:rgba(109,40,217,1)">💜</div>
                </div>
              </div>

              <div class="ctaRow" style="margin-top:14px;">
                <a class="btn btnPrimary" href="/create">Quero ver a reação aqui em casa</a>
              </div>

              <p class="cardP" style="margin-top:10px;">
                <b>Dica extra:</b> imprima 1 cópia e deixe a criança assinar a primeira página.
                Vira uma lembrança que guardam por anos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="sectionWhite">
    <div class="wrap">
      <div class="sectionHead">
        <h2 class="h2 reveal" id="u1">Ideias de uso (para você aproveitar MUITO)</h2>
        <p class="subP reveal" id="u2">
          Não é só um “Livro”. É criar um momento: leitura, presente, escola, família… aqui vão ideias prontas.
        </p>
      </div>

      <div class="grid3">
        <div class="card reveal" id="u3">
          <div class="cardIn">
            <div class="iconBox g1">📚</div>
            <h3 class="cardT">Antes de dormir</h3>
            <p class="cardP">
              Luz baixinha, voz de personagem e a criança sendo a heroína do próprio livro.
              <b>Funciona demais</b> para criar rotina tranquila e pedir “só mais uma página” com sorriso.
              <br/><br/>
              <b>Truque:</b> deixe a criança escolher o tema do dia (espaço, dinossauro, dragão…).
            </p>
          </div>
        </div>

        <div class="card reveal" id="u4">
          <div class="cardIn">
            <div class="iconBox g2">🎁</div>
            <h3 class="cardT">Presente inesquecível</h3>
            <p class="cardP">
              Livro personalizado é aquele presente que a família guarda.
              Imprima com capa mais grossa e coloque uma dedicatória:
              <br/><br/>
              “Para lembrar que você é capaz de tudo. Com amor, …”
              <br/><br/>
              <b>Dica:</b> encadernação simples (espiral) já fica lindo.
            </p>
          </div>
        </div>

        <div class="card reveal" id="u5">
          <div class="cardIn">
            <div class="iconBox g3">🖍️</div>
            <h3 class="cardT">Modo Colorir (atividade)</h3>
            <p class="cardP">
              A criança pinta e depois relê o livro “do jeitinho dela”.
              <br/><br/>
              <b>Ideia:</b> faça um “dia do artista”: lápis de cor + adesivos + um cantinho especial.
              No final, tire foto do resultado — vira lembrança.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="sectionWhite">
    <div class="wrap">
      <div class="sectionHead">
        <h2 class="h2 reveal" id="fq1">Perguntas rápidas</h2>
        <p class="subP reveal" id="fq2">
          Tire dúvidas comuns sem precisar procurar em outro lugar.
        </p>
      </div>

      <div class="faq">
        <div class="faqItem reveal" id="fqa1">
          <button class="faqQ" type="button" data-faq="1">
            <span>Por que o botão de PDF fica desativado?</span>
            <span class="chev">⌄</span>
          </button>
          <div class="faqA">
            O PDF só aparece quando o livro está com <b>status = done</b> e o arquivo existe na pasta do livro.
            Se estiver “generating”, aguarde e clique em “Atualizar”.
          </div>
        </div>

        <div class="faqItem reveal" id="fqa2">
          <button class="faqQ" type="button" data-faq="2">
            <span>Como faço para imprimir e ficar bonito?</span>
            <span class="chev">⌄</span>
          </button>
          <div class="faqA">
            Sugestão: páginas em couchê/fotográfico (ou sulfite boa), capa em 200g,
            e encadernação simples (espiral). Se quiser “livro de presente”, uma dedicatória
            na primeira página muda tudo.
          </div>
        </div>

        <div class="faqItem reveal" id="fqa3">
          <button class="faqQ" type="button" data-faq="3">
            <span>Como ter mais “cara de livro infantil” nas imagens?</span>
            <span class="chev">⌄</span>
          </button>
          <div class="faqA">
            Foto nítida e bem iluminada + rosto visível. Evite sombras fortes e filtros.
            Quanto mais limpa a foto, mais consistente fica o personagem nas páginas.
          </div>
        </div>

        <div class="faqItem reveal" id="fqa4">
          <button class="faqQ" type="button" data-faq="4">
            <span>Posso criar vários livros com temas diferentes?</span>
            <span class="chev">⌄</span>
          </button>
          <div class="faqA">
            Sim! Muitos pais criam um tema por “fase”: dinossauros, super-herói, espaço…
            E depois guardam todos como coleção.
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="ctaBox">
      <h2 class="ctaH reveal" id="c1">Pronto para criar o próximo?</h2>
      <p class="ctaP reveal" id="c2">
        Faça mais um livro agora e aumente a coleção: um para presentear, um para guardar, um para a escola…
        <br/>A melhor parte é ver a criança dizendo: <b>“Eu tô no livro!”</b> 💜
      </p>
      <div class="reveal" id="c3">
        <a class="btn btnWhite" href="/create">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2l1.2 4.1L17 7.2l-3.8 1.1L12 12l-1.2-3.7L7 7.2l3.8-1.1L12 2z" stroke="rgba(109,40,217,1)" stroke-width="2" stroke-linejoin="round"/>
            <path d="M19 12l.7 2.3L22 15l-2.3.7L19 18l-.7-2.3L16 15l2.3-.7L19 12z" stroke="rgba(219,39,119,1)" stroke-width="2" stroke-linejoin="round"/>
          </svg>
          Criar agora
        </a>
      </div>
    </div>
  </section>

<script>
(function(){
  function esc(s){
    s = String(s == null ? "" : s);
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function $(id){ return document.getElementById(id); }

  (function renderStars(){
    var root = $("stars");
    if(!root) return;
    var N = 22;

    function rnd(a,b){ return a + Math.random()*(b-a); }

    var starSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.1 6.4L21 9.6l-5.4 4 2.1 6.4L12 16.2 6.3 20l2.1-6.4L3 9.6l6.9-1.2L12 2z" fill="rgba(252,211,77,.95)"/></svg>';

    for(var i=0;i<N;i++){
      var el = document.createElement("div");
      el.className = "star";
      el.style.top  = rnd(0, 100).toFixed(2) + "%";
      el.style.left = rnd(0, 100).toFixed(2) + "%";
      el.style.setProperty("--dur", rnd(3.2, 5.8).toFixed(2) + "s");
      el.style.animationDelay = rnd(0, 2.2).toFixed(2) + "s";
      el.innerHTML = starSvg;
      root.appendChild(el);
    }
  })();

  (function reveal(){
    var els = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    function inView(el){
      var r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.92;
    }
    function tick(){
      for(var i=0;i<els.length;i++){
        var el = els[i];
        if(el.classList.contains("on")) continue;
        if(inView(el)) el.classList.add("on");
      }
    }
    var staged = ["h1","h2","h3","l1","l2","l3","l4"];
    for(var j=0;j<staged.length;j++){
      (function(id, idx){
        var el = $(id);
        if(el) setTimeout(function(){ el.classList.add("on"); }, 90 + idx*120);
      })(staged[j], j);
    }
    window.addEventListener("scroll", tick, { passive:true });
    window.addEventListener("resize", tick);
    setTimeout(tick, 650);
  })();

  (function faq(){
    var btns = document.querySelectorAll(".faqQ[data-faq]");
    if(!btns || !btns.length) return;
    btns.forEach(function(b){
      b.addEventListener("click", function(){
        var item = b.closest(".faqItem");
        if(!item) return;
        item.classList.toggle("open");
      });
    });
  })();

  var quotes = [
    { t: "Eu sou eu no livro! Olha mãe, eu tô voando no foguete!!! 🚀✨", n: "Maria, 6 anos" },
    { t: "De novo! Lê de novo! Eu quero ver quando eu encontro o dinossauro! 🦖😄", n: "João, 5 anos" },
    { t: "Eu pintei a página toda e ficou igualzinho! Agora é meu livro! 🖍️📘", n: "Helena, 7 anos" },
    { t: "Posso levar pra escola? Eu quero mostrar pros meus amigos! 🏫💜", n: "Davi, 6 anos" },
    { t: "Eu dei pro meu primo e ele falou UAU! Foi o melhor presente! 🎁🥳", n: "Sofia, 8 anos" }
  ];

  function renderDots(active){
    var root = $("quoteDots");
    if(!root) return;
    var html = "";
    for(var i=0;i<quotes.length;i++){
      html += '<span class="dot' + (i===active ? " on" : "") + '"></span>';
    }
    root.innerHTML = html;
  }

  var qi = 0;
  function setQuote(idx){
    qi = idx;
    var q = quotes[qi] || quotes[0];
    var txt = $("quoteTxt");
    var nm = $("quoteName");
    if(txt) txt.textContent = q.t;
    if(nm) nm.textContent = "— " + q.n;
    renderDots(qi);
  }

  function nextQuote(){
    var n = qi + 1;
    if(n >= quotes.length) n = 0;
    setQuote(n);
  }

  setQuote(0);
  setInterval(nextQuote, 5200);

  var momentMap = {
    "📚 Leitura antes de dormir": "Momento perfeito: luz baixinha, carinho e a criança como protagonista. Dá vontade de ler de novo 😴✨",
    "🎁 Presente inesquecível": "Dica de presente: imprima, coloque capa mais grossa e escreva uma dedicatória na primeira página 🎁💜",
    "🖍️ Pintar e reler": "Modo colorir: a criança pinta as páginas e depois relê a história que ela mesma “finalizou” 🖍️📖",
    "👨‍👩‍👧 Ler em família": "Leitura em família: cada um faz uma voz diferente pros personagens — vira um show em casa 😂🎭",
    "🏫 Levar pra escola": "Na escola: ótimo pra atividades de leitura e pra criança se sentir confiante mostrando o próprio livro 🏫⭐"
  };

  (function wireChips(){
    var chips = document.querySelectorAll(".chip[data-chip]");
    var note = $("momentNote");
    if(!chips || !chips.length || !note) return;
    chips.forEach(function(el){
      el.addEventListener("click", function(){
        var k = el.getAttribute("data-chip") || "";
        note.textContent = momentMap[k] || "Ideia mágica: crie seu livro e experimente esse momento ✨";
      });
    });
  })();

  var all = [];

  function badge(status){
    if (status === "done") return '<span class="pillMini pillOk">✅ done</span>';
    if (status === "failed") return '<span class="pillMini pillFail">❌ failed</span>';
    if (status === "generating") return '<span class="pillMini pillWork">⚙️ generating</span>';
    return '<span class="pillMini">🕓 ' + esc(status || "created") + '</span>';
  }

  function makeCard(b){
    var cover = b.coverUrl
      ? '<img src="' + esc(b.coverUrl) + '" alt="capa"/>'
      : '<div class="emptyCover">📘</div>';

    var sub =
      (b.childName ? ('👧/👦 <b>' + esc(b.childName) + '</b> • ') : '') +
      '🎭 <b>' + esc(b.themeLabel || b.theme || '-') + '</b>' +
      ' • 🖍️ <b>' + esc(b.styleLabel || b.style || '-') + '</b>' +
      (b.imagesCount ? (' • 🖼️ <b>' + esc(b.imagesCount) + '</b> pág(s)') : '');

    var updated = b.updatedAt ? ('Atualizado: <b>' + esc(b.updatedAt) + '</b>') : '';

    var html = '';
    html += '<div class="bookCard">';
    html +=   '<div class="cover">';
    html +=     '<div class="badges">' + badge(b.status) + '</div>';
    html +=     cover;
    html +=   '</div>';
    html +=   '<div class="bookBody">';
    html +=     '<div class="bookH">' + esc(b.id) + '</div>';
    html +=     '<div class="meta">' + sub + '<br/>' + updated + '</div>';
    if (b.error){
      html +=   '<div class="meta" style="color:rgba(220,38,38,1); font-weight:900;">Erro: ' + esc(b.error) + '</div>';
    }

    // ✅ REMOVIDO: botão de PDF
    html +=     '<div class="rowBtns">';
    html +=       '<a class="aBtn primary" href="/books/' + encodeURIComponent(b.dirId || b.id) + '">👀 Abrir</a>';
    html +=       '<a class="aBtn order" href="/checkout/' + encodeURIComponent(b.dirId || b.id) + '">🛒 Fazer pedido <span class="tag">PIX</span></a>';
    html +=     '</div>';

    html +=   '</div>';
    html += '</div>';
    return html;
  }

  function showEmpty(yes){
    var shelf = $("emptyShelf");
    if(!shelf) return;
    if(yes) shelf.classList.remove("hide");
    else shelf.classList.add("hide");
  }

  function updateStats(){
    var total = all.length;
    var done = all.filter(function(x){ return (x.status || "") === "done" && x.hasPdf; }).length;
    var stTotal = $("statTotal");
    var stDone = $("statDone");
    if(stTotal) stTotal.textContent = String(total);
    if(stDone) stDone.textContent = String(done);
  }

  function applyFilters(){
    var q = ($("q").value || "").toLowerCase().trim();
    var st = $("status").value;
    var sy = $("style").value;
    var th = $("theme").value;

    var list = all.slice();

    if (st) list = list.filter(function(x){ return (x.status || "") === st; });
    if (sy) list = list.filter(function(x){ return (x.style || "") === sy; });
    if (th) list = list.filter(function(x){ return (x.theme || "") === th; });

    if (q){
      list = list.filter(function(x){
        var blob = [x.id, x.childName, x.theme, x.themeLabel, x.style, x.styleLabel, x.status].join(" ").toLowerCase();
        return blob.indexOf(q) >= 0;
      });
    }

    showEmpty(all.length === 0);

    $("grid").innerHTML = list.map(makeCard).join("");
    $("note").textContent = list.length
      ? ("Mostrando " + list.length + " de " + all.length + " livro(s).")
      : (all.length ? "Nenhum livro encontrado com esses filtros." : "Você ainda não criou nenhum livro. Use os exemplos acima e clique em “Criar meu primeiro livro”.");
  }

  async function load(){
    if($("note")) $("note").textContent = "Carregando…";
    var r = await fetch("/api/books", { cache: "no-store" });
    var j = {};
    try { j = await r.json(); } catch(e){}
    all = Array.isArray(j.books) ? j.books : [];
    updateStats();

    if($("note")) $("note").textContent = "";
    applyFilters();
  }

  if($("refresh")){
    $("refresh").addEventListener("click", function(){
      load();
    });
  }

  ["q","status","style","theme"].forEach(function(id){
    var el = $(id);
    if(!el) return;
    el.addEventListener(id === "q" ? "input" : "change", applyFilters);
  });

  load();
})();
</script>

</body>
</html>`;
}

module.exports = { renderBooksHtml };