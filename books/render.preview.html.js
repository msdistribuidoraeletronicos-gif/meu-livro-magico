/**
 * render.preview.html.js
 * Preview (/books/:id) com livro FECHADO (capa realista) + ABERTO (spread realista).
 *
 * ✅ Mantém o layout "livro" (miolo/papel/curva/flip).
 * ✅ PADRÃO NOVO:
 *   - Ao entrar na página, começa FECHADO (mostra capa).
 *   - Botão "Abrir" mostra a capa (FECHADO).
 *   - Ao apertar "Próximo (→)" quando FECHADO: abre e mostra páginas 1/2.
 * ✅ Botão Fechar / ESC volta para o FECHADO e reseta para a 1ª folha.
 * ✅ Próximo/Anterior sem erro.
 *
 * ✅ IMPORTANTE:
 * - A CAPA aparece APENAS no livro FECHADO.
 * - Ao ABRIR, começa direto nas PÁGINAS (página 1 / 2 / ...).
 *
 * ✅ AJUSTE (NÍTIDO / SEM EMBAÇADO) — IGUAL AO /exemplos:
 * - Remove BG borrado (imgBg) completamente.
 * - Remove filtros/blur/backdrop-filter que podem suavizar a imagem (Safari/Chrome).
 * - Remove transforms 3D nas páginas (rotateY/perspective) e no spreadShell que podem causar “softening”.
 * - Mantém visual do livro com sombras/gradientes (sem blur).
 *
 * ✅ CORREÇÃO (capa branca):
 * - .closedBook pode colapsar (0x0) com filhos absolutos.
 * - FECHADO é dimensionado via JS:
 *   syncClosedBookToSinglePage() calcula o tamanho de 1 página dentro do palco.
 *
 * ✅ AJUSTE PEDIDO (NOVO):
 * - Botão ← NÃO desativa na 1ª folha quando ABERTO.
 * - Se apertar ← na 1ª folha (páginas 1/2), ele volta pra CAPA (mesma função do Fechar).
 *
 * Export:
 *   module.exports = { renderBookPreviewHtml }
 */
"use strict";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDateBR(iso) {
  const d = new Date(String(iso || ""));
  if (!Number.isFinite(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return dd + "/" + mm + "/" + yy + " " + hh + ":" + mi;
}

function renderBookPreviewHtml(book) {
  const id = String(book?.dirId || book?.id || "");

  const safeCoverUrl =
    book?.overrides?.coverUrl
      ? String(book.overrides.coverUrl)
      : book?.coverUrl
      ? String(book.coverUrl)
      : book?.cover?.url
      ? String(book.cover.url)
      : "";

  const storyPages = Array.isArray(book?.images)
    ? book.images
        .map((it) => ({
          page: Number(it?.page || 0),
          url: String(it?.url || ""),
        }))
        .filter((it) => it.url)
        .sort((a, b) => (a.page || 0) - (b.page || 0))
    : [];

  // ✅ Páginas do livro ABERTO: SOMENTE páginas da história (sem capa).
  // Spread 0: [página 1, página 2]
  const pages = [];
  for (const p of storyPages) {
    pages.push({
      kind: "image",
      url: p.url,
      label: `Página ${p.page}`,
      pageNum: Number(p.page) || null,
    });
  }
  // completa par
  if (pages.length % 2 !== 0) pages.push({ kind: "blank", label: "", pageNum: null });

  const errBox = book?.error ? `<div class="err">❌ Erro: ${escapeHtml(book.error)}</div>` : "";
  const metaUpdated = book?.updatedAt ? fmtDateBR(book.updatedAt) : "-";

  // ratio do "palco" (se tiver no JSON do livro); senão default do seu layout
  const ratioNum = Number(book?.coverWidth || book?.imgWidth || 1020) || 1020;
  const ratioDen = Number(book?.coverHeight || book?.imgHeight || 797) || 797;

  const pagesJson = JSON.stringify(pages)
    .replace(/</g, "\\u003c")
    .replace(/<\/script/gi, "<\\/script");

  const safeCoverJson = JSON.stringify(String(safeCoverUrl || ""))
    .replace(/</g, "\\u003c")
    .replace(/<\/script/gi, "<\\/script");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Livro ${escapeHtml(book?.id || id)} — Meu Livro Mágico</title>
<style>
  :root{
    --violet-50:#f5f3ff;
    --pink-50:#fff1f2;
    --white:#ffffff;
    --gray-900:#111827;
    --gray-800:#1f2937;
    --gray-700:#374151;
    --gray-600:#4b5563;

    --violet-600:#7c3aed;
    --violet-700:#6d28d9;
    --pink-600:#db2777;
    --pink-700:#be185d;

    --shadow: 0 34px 120px rgba(17,24,39,.22);
    --shadow2: 0 16px 38px rgba(17,24,39,.10);
    --shadow3: 0 10px 18px rgba(17,24,39,.10);

    --r: 26px;
    --bookR: 22px;
    --pageR: 18px;

    --pad: 18px;
    --foldW: clamp(18px, 2.4vw, 30px);
  }

  *{ box-sizing:border-box; }
  html,body{ height:100%; }
  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    color: var(--gray-800);
    background: radial-gradient(1200px 520px at 18% 0%, rgba(124,58,237,.18), transparent 60%),
                radial-gradient(980px 460px at 90% 12%, rgba(219,39,119,.14), transparent 58%),
                linear-gradient(180deg, var(--violet-50), var(--white) 46%, var(--pink-50));
    min-height:100vh;
    padding-bottom: 30px;
    overflow-x:hidden;
  }
  a{ color:inherit; text-decoration:none; }
  .wrap{ max-width: 1180px; margin: 0 auto; padding: 18px 16px; }

  .top{
    display:flex; gap:12px;
    align-items:center;
    justify-content:space-between;
    flex-wrap:wrap;
    margin-bottom: 12px;
  }
  .pill{
    display:inline-flex; gap:8px; align-items:center;
    padding:10px 12px; border-radius:999px;
    background: rgba(255,255,255,.76);
    border:1px solid rgba(221,214,254,.92);
    color: rgba(109,40,217,1);
    font-weight:950;
    box-shadow: 0 14px 30px rgba(17,24,39,.08);
    /* ✅ sem backdrop-filter (evita suavização) */
  }
  .pill:hover{
    background: rgba(245,243,255,.92);
    border-color: rgba(196,181,253,.95);
  }

  .head{
    background: rgba(255,255,255,.86);
    border: 1px solid rgba(17,24,39,.06);
    border-radius: 26px;
    box-shadow: 0 20px 60px rgba(17,24,39,.10);
    padding: 14px;
    display:flex;
    gap:12px;
    align-items:flex-start;
    justify-content:space-between;
    flex-wrap:wrap;
    margin-bottom: 14px;
    /* ✅ sem backdrop-filter */
  }
  .ttl{
    font-weight:1000;
    font-size: 18px;
    color: var(--gray-900);
    letter-spacing:-.2px;
    display:flex;
    gap:8px;
    align-items:center;
    flex-wrap:wrap;
  }
  .meta{
    margin-top:6px;
    color: var(--gray-600);
    font-weight:850;
    line-height:1.6;
    font-size: 13px;
  }
  .err{
    margin-top: 10px;
    padding: 12px;
    border-radius: 18px;
    border: 1px solid rgba(239,68,68,.25);
    background: rgba(239,68,68,.08);
    font-weight: 900;
    color: rgba(220,38,38,1);
  }

  .btn{
    display:inline-flex; align-items:center; justify-content:center;
    padding: 12px 14px;
    border-radius: 999px;
    border: 1px solid rgba(221,214,254,.92);
    background: rgba(255,255,255,.72);
    color: rgba(109,40,217,1);
    font-weight:1000;
    box-shadow: 0 14px 30px rgba(17,24,39,.08);
    cursor:pointer;
    user-select:none;
    /* ✅ sem backdrop-filter */
  }
  .btn.primary{
    border:0;
    color:#fff;
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
    box-shadow: 0 18px 44px rgba(124,58,237,.20);
  }
  .btn.primary:hover{
    background: linear-gradient(90deg, var(--violet-700), var(--pink-700));
    box-shadow: 0 22px 56px rgba(124,58,237,.24);
  }

  .stage{
    position:relative;
    width: 100%;
    display:grid;
    place-items:center;
    margin-top: 14px;
  }

  /* ====== PALCO ====== */
  .book{
    width: min(1080px, calc(100vw - 18px));
    aspect-ratio: ${ratioNum} / ${ratioDen};
    max-height: 78vh;
    min-height: 460px;
    position:relative;
    transform: translateZ(0);
  }

  .bgGlow{
    position:absolute;
    inset: -34px;
    border-radius: 52px;
    background:
      radial-gradient(900px 360px at 18% 0%, rgba(124,58,237,.22), transparent 60%),
      radial-gradient(820px 340px at 85% 20%, rgba(219,39,119,.18), transparent 55%),
      radial-gradient(700px 320px at 50% 92%, rgba(252,211,77,.14), transparent 60%),
      radial-gradient(1200px 700px at 50% 50%, rgba(17,24,39,.10), transparent 70%);
    /* ✅ sem blur aqui (só glow, mas blur pode “lavar” em alguns devices) */
    opacity:.94;
    pointer-events:none;
  }

  /* ======= FECHADO ======= */
  .closedWrap{
    position:absolute;
    inset: 0;
    display:grid;
    place-items:center;
    z-index: 40;
  }

  .closedBook{
    width: auto;
    height: auto;
    aspect-ratio: ${ratioNum} / ${ratioDen};
    position:relative;
    border-radius: var(--bookR);
    box-shadow: var(--shadow);
    overflow:hidden;
    transform: translateY(-4px);
    cursor:pointer;
    isolation:isolate;
    background: #fff;
  }

  .closedBook:hover{
    transform: translateY(-6px) scale(1.005);
    box-shadow: 0 40px 140px rgba(17,24,39,.26);
  }

  .closedCoverImg{
    position:absolute;
    inset: 0;
    width:100%;
    height:100%;
    object-fit: cover;
    display:block;
    transform: translateZ(0);
    /* ✅ sem filtros (mais nítido) */
  }

  .closedVarnish{
    position:absolute;
    inset:-45%;
    background: linear-gradient(110deg, transparent 38%, rgba(255,255,255,.25) 48%, transparent 62%);
    transform: translateX(-30%) rotate(8deg);
    opacity:.85;
    pointer-events:none;
    mix-blend-mode: screen;
    z-index:3;
  }

  .closedVignette{
    position:absolute;
    inset:0;
    background:
      radial-gradient(1100px 540px at 50% 15%, rgba(255,255,255,.22), transparent 55%),
      radial-gradient(900px 520px at 50% 95%, rgba(17,24,39,.22), transparent 62%);
    opacity:.45;
    pointer-events:none;
    z-index:2;
  }

  .closedSpine{
    position:absolute;
    top:0; bottom:0;
    right:0;
    width: 26px;
    background:
      linear-gradient(180deg, rgba(17,24,39,.28), rgba(17,24,39,.08), rgba(17,24,39,.24));
    opacity:.65;
    z-index:4;
    pointer-events:none;
  }

  .closedPagesEdge{
    position:absolute;
    top: 10px;
    right: 26px;
    bottom: 10px;
    width: 18px;
    border-radius: 12px;
    background:
      repeating-linear-gradient(
        180deg,
        rgba(255,255,255,.96) 0px,
        rgba(255,255,255,.96) 3px,
        rgba(243,243,243,.96) 4px,
        rgba(255,255,255,.96) 7px
      );
    box-shadow:
      inset 0 0 0 1px rgba(17,24,39,.08),
      inset -10px 0 14px rgba(17,24,39,.10);
    z-index:4;
    pointer-events:none;
  }

  .closedBorder{
    position:absolute;
    inset:0;
    border-radius: var(--bookR);
    box-shadow: inset 0 0 0 1px rgba(17,24,39,.10);
    z-index:5;
    pointer-events:none;
  }

  .closedHint{
    margin-top: 12px;
    font-weight: 950;
    color: rgba(75,85,99,.88);
    font-size: 13px;
    text-align:center;
    user-select:none;
  }

  /* ======= ABERTO ======= */
  .openWrap{
    position:absolute;
    inset: 0;
    display:grid;
    place-items:center;
    z-index: 30;
  }

  .spreadShell{
    position:absolute;
    inset: 0;
    border-radius: calc(var(--r) + 10px);
    overflow:hidden;

    box-shadow:
      0 70px 180px rgba(17,24,39,.30),
      0 26px 54px rgba(17,24,39,.18),
      0 10px 20px rgba(124,58,237,.10);

    background: rgba(255,255,255,.10);
    border: 1px solid rgba(17,24,39,.06);

    /* ✅ remove 3D/perspective para evitar “softening” */
    transform: none;
    transform-origin: 50% 60%;
  }

  .spreadShell::before{
    content:"";
    position:absolute;
    inset: 10px;
    border-radius: var(--r);
    pointer-events:none;
    box-shadow:
      inset 0 0 0 1px rgba(17,24,39,.07),
      inset 0 24px 50px rgba(255,255,255,.14),
      inset 0 -28px 60px rgba(0,0,0,.14);
    z-index:1;
  }

  /* ✅ remove texture overlay (pode “lavar”) */
  .spreadShell::after{ content:none; }

  .paperBase{
    position:absolute;
    inset: 10px;
    border-radius: var(--r);
    background:
      radial-gradient(1200px 520px at 50% 0%, rgba(255,255,255,.70), transparent 56%),
      radial-gradient(900px 420px at 15% 10%, rgba(124,58,237,.10), transparent 60%),
      radial-gradient(900px 420px at 85% 15%, rgba(219,39,119,.08), transparent 55%),
      radial-gradient(1100px 460px at 50% 92%, rgba(17,24,39,.12), transparent 64%),
      rgba(255,255,255,.56);
    box-shadow: inset 0 0 0 1px rgba(17,24,39,.06);
    pointer-events:none;
    z-index:0;
  }

  .paperGloss{
    position:absolute;
    inset: 10px;
    border-radius: var(--r);
    background:
      linear-gradient(115deg, rgba(255,255,255,.24), transparent 45%),
      radial-gradient(900px 360px at 50% 0%, rgba(255,255,255,.20), transparent 62%);
    mix-blend-mode: screen;
    opacity:.82;
    pointer-events:none;
    z-index:3;
  }

  .fold{
    position:absolute;
    top: 10px; bottom: 10px;
    left: 50%;
    width: var(--foldW);
    transform: translateX(-50%);
    pointer-events:none;
    z-index: 40;
    background:
      radial-gradient(28px 720px at 50% 50%, rgba(0,0,0,.26), transparent 72%),
      linear-gradient(90deg, rgba(255,255,255,.02), rgba(255,255,255,.44), rgba(255,255,255,.02)),
      linear-gradient(90deg, rgba(0,0,0,.18), rgba(0,0,0,.02), rgba(0,0,0,.18));
    opacity:.76;
    /* ✅ sem blur */
  }
  .fold::after{
    content:"";
    position:absolute;
    top: 0; bottom: 0;
    left: 50%;
    width: 2px;
    transform: translateX(-50%);
    background: linear-gradient(180deg, transparent, rgba(0,0,0,.10), transparent);
    opacity:.55;
  }

  .curveL, .curveR{
    position:absolute;
    top: 14px;
    bottom: 14px;
    width: 19%;
    pointer-events:none;
    z-index: 30;
    border-radius: var(--r);
  }
  .curveL{
    left: calc(50% - 19%);
    background:
      radial-gradient(320px 720px at 100% 50%, rgba(0,0,0,.22), transparent 62%),
      radial-gradient(300px 640px at 100% 50%, rgba(255,255,255,.24), transparent 72%);
    opacity:.86;
  }
  .curveR{
    right: calc(50% - 19%);
    background:
      radial-gradient(320px 720px at 0% 50%, rgba(0,0,0,.22), transparent 62%),
      radial-gradient(300px 640px at 0% 50%, rgba(255,255,255,.24), transparent 72%);
    opacity:.86;
  }

  .edgeLeft, .edgeRight{
    position:absolute;
    top: 12px;
    bottom: 12px;
    width: 16px;
    pointer-events:none;
    z-index: 35;
    opacity:.95;
  }
  .edgeLeft{
    left: 10px;
    border-radius: 18px 0 0 18px;
    background:
      repeating-linear-gradient(
        180deg,
        rgba(255,255,255,.98) 0px,
        rgba(255,255,255,.98) 3px,
        rgba(243,243,243,.98) 4px,
        rgba(255,255,255,.98) 7px
      );
    box-shadow:
      inset 9px 0 16px rgba(0,0,0,.16),
      inset 0 0 0 1px rgba(17,24,39,.06);
  }
  .edgeRight{
    right: 10px;
    border-radius: 0 18px 18px 0;
    background:
      repeating-linear-gradient(
        180deg,
        rgba(255,255,255,.98) 0px,
        rgba(255,255,255,.98) 3px,
        rgba(243,243,243,.98) 4px,
        rgba(255,255,255,.98) 7px
      );
    box-shadow:
      inset -9px 0 16px rgba(0,0,0,.16),
      inset 0 0 0 1px rgba(17,24,39,.06);
  }

  .pages{
    position:absolute;
    inset: 10px;
    border-radius: var(--r);
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap: 0px;
    padding: var(--pad);
    z-index: 20;
    background: transparent;
  }

  .page{
    position:relative;
    overflow:hidden;
    border-radius: var(--pageR);
    background:
      radial-gradient(1100px 600px at 50% 0%, rgba(255,255,255,.90), rgba(255,255,255,.66) 55%, rgba(255,255,255,.58)),
      linear-gradient(180deg, rgba(255,255,255,.80), rgba(255,255,255,.60));
    box-shadow:
      0 24px 60px rgba(17,24,39,.14),
      0 10px 24px rgba(17,24,39,.10),
      inset 0 0 0 1px rgba(17,24,39,.08),
      inset 0 18px 32px rgba(255,255,255,.18),
      inset 0 -22px 28px rgba(17,24,39,.10);
    transform: none; /* ✅ sem 3D */
  }

  .page.left{
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .page.right{
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  /* ✅ remove overlays/texture da página (pode suavizar/lavar) */
  .page::before{ content:none; }
  .page.left::after{ content:none; }
  .page.right::after{ content:none; }

  .imgFrame{
    position:absolute;
    inset:0;
    overflow:hidden;
    z-index:4;
    display:flex;
    align-items:center;
    justify-content:center;
    background: transparent;
  }

  /* ✅ removido COMPLETAMENTE o BG borrado (.imgBg) */

  .imgFg{
    position: relative;
    z-index: 2;
    display:block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    /* ✅ sem drop-shadow via filter (pode reduzir nitidez) */
  }

  .blank{
    width:100%;
    height:100%;
    display:grid;
    place-items:center;
    color: rgba(107,114,128,.70);
    font-weight: 900;
    font-size: 14px;
    border-radius: calc(var(--pageR) - 6px);
    background:
      repeating-linear-gradient(
        135deg,
        rgba(245,243,255,.85) 0px,
        rgba(245,243,255,.85) 12px,
        rgba(255,255,255,.85) 12px,
        rgba(255,255,255,.85) 24px
      );
    box-shadow: inset 0 0 0 1px rgba(17,24,39,.06);
  }

  .pageLabel{
    position:absolute;
    left: 14px;
    bottom: 12px;
    padding: 8px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,.78);
    border: 1px solid rgba(221,214,254,.90);
    color: rgba(75,85,99,.95);
    font-weight: 1000;
    font-size: 12px;
    box-shadow: 0 18px 44px rgba(17,24,39,.10);
    z-index:30;
    /* ✅ sem backdrop-filter */
  }

  .hide{ display:none !important; }

  .navBtn{
    position:absolute;
    top:50%;
    transform: translateY(-50%);
    width: 56px;
    height: 56px;
    border-radius: 999px;
    border: 1px solid rgba(221,214,254,.92);
    background: rgba(255,255,255,.72);
    box-shadow: 0 18px 50px rgba(17,24,39,.12);
    display:grid;
    place-items:center;
    cursor:pointer;
    user-select:none;
    font-weight: 1000;
    color: rgba(109,40,217,1);
    z-index: 200;
    /* ✅ sem backdrop-filter */
  }
  .navBtn:hover{
    background: rgba(245,243,255,.92);
    border-color: rgba(196,181,253,.95);
    transform: translateY(-50%) scale(1.02);
  }
  .navBtn:active{ transform: translateY(-50%) scale(.98); }
  .navPrev{ left: -18px; }
  .navNext{ right: -18px; }
  .navBtn.disabled{ opacity:.45; pointer-events:none; }

  .progress{
    margin-top: 12px;
    display:flex;
    gap:10px;
    align-items:center;
    justify-content:center;
    flex-wrap:wrap;
    color: var(--gray-600);
    font-weight: 900;
    font-size: 13px;
    user-select:none;
  }
  .dots{
    display:flex;
    gap:6px;
    align-items:center;
  }
  .dot{
    width: 9px; height: 9px;
    border-radius: 999px;
    border: 1px solid rgba(221,214,254,.95);
    background: rgba(124,58,237,.14);
  }
  .dot.on{ background: rgba(124,58,237,.75); }

  .turnLayer{
    position:absolute;
    inset: 10px;
    z-index: 120;
    pointer-events:none;
    perspective: 1500px;
    border-radius: var(--r);
  }
  .turnSheet{
    position:absolute;
    top: var(--pad);
    bottom: var(--pad);
    width: calc(50% - var(--pad));
    border-radius: var(--pageR);
    transform-style: preserve-3d;
    overflow: visible;
  }
  .turnSheet.right{
    left: 50%;
    transform-origin: left center;
  }
  .turnSheet.left{
    left: var(--pad);
    transform-origin: right center;
  }

  .turnFace{
    position:absolute;
    inset:0;
    border-radius: var(--pageR);
    overflow:hidden;
    background: transparent;
    backface-visibility: hidden;
  }
  .turnFace.back{
    transform: rotateY(180deg);
  }

  .turnShade{
    position:absolute;
    inset:-1px;
    border-radius: calc(var(--pageR) + 2px);
    pointer-events:none;
    background:
      radial-gradient(closest-side, rgba(0,0,0,.26), transparent 70%),
      linear-gradient(90deg, rgba(0,0,0,.16), transparent 40%, rgba(0,0,0,.12));
    /* ✅ sem blur */
    opacity:0;
    transition: opacity .18s ease;
  }
  .turnSheet.flipping .turnShade{ opacity:.95; }

  @keyframes flipNext{
    0%   { transform: rotateY(0deg); }
    100% { transform: rotateY(-180deg); }
  }
  @keyframes flipPrev{
    0%   { transform: rotateY(0deg); }
    100% { transform: rotateY(180deg); }
  }

  @media (max-width: 860px){
    .book{ min-height: 440px; }
    .navPrev{ left: -10px; }
    .navNext{ right: -10px; }
    :root{ --pad: 14px; }
  }
  @media (max-width: 520px){
    .book{ min-height: 420px; }
    :root{ --pad: 12px; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <a class="pill" href="/books">← Voltar</a>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a class="pill" href="/create">🪄 Criar novo</a>
        <a class="pill" href="/books/${encodeURIComponent(id)}/edit">✏️ Editar livro</a>
      </div>
    </div>

    <div class="head">
      <div>
        <div class="ttl">📘 ${escapeHtml(book?.id || id)}</div>
        <div class="meta">
          Status: <b>${escapeHtml(book?.status || "-")}</b> •
          Tema: <b>${escapeHtml(book?.themeLabel || book?.theme || "-")}</b> •
          Criança: <b>${escapeHtml(book?.childName || "-")}</b> •
          Atualizado: <b>${escapeHtml(metaUpdated)}</b>
        </div>
        ${errBox || ""}
      </div>
    </div>

    <div class="stage">
      <div class="book" id="book">
        <div class="bgGlow"></div>

        <!-- FECHADO -->
        <div class="closedWrap" id="closedWrap">
          <div class="closedBook" id="closedBook" title="Clique para abrir">
            <img class="closedCoverImg" id="closedCoverImg" alt="Capa"/>
            <div class="closedVarnish"></div>
            <div class="closedVignette"></div>
            <div class="closedPagesEdge"></div>
            <div class="closedSpine"></div>
            <div class="closedBorder"></div>
          </div>
          <div class="closedHint">Clique na capa para abrir • (→ para abrir) • ESC fecha</div>
        </div>

        <!-- ABERTO -->
        <div class="openWrap hide" id="openWrap">
          <div class="spreadShell" id="spreadShell">
            <div class="paperBase"></div>
            <div class="paperGloss"></div>

            <div class="pages" id="pagesGrid">
              <div class="page left">
                <div class="imgFrame" id="pageLeft"></div>
                <div class="pageLabel" id="labelLeft"></div>
              </div>
              <div class="page right">
                <div class="imgFrame" id="pageRight"></div>
                <div class="pageLabel" id="labelRight"></div>
              </div>
            </div>

            <div class="fold"></div>
            <div class="curveL"></div>
            <div class="curveR"></div>
            <div class="edgeLeft"></div>
            <div class="edgeRight"></div>

            <div class="turnLayer" id="turnLayer"></div>
          </div>
        </div>

        <button class="navBtn navPrev" id="prevBtn" type="button">←</button>
        <button class="navBtn navNext" id="nextBtn" type="button">→</button>
      </div>

      <div class="progress">
        <span id="progressText"></span>
        <span class="dots" id="dots"></span>
      </div>
    </div>
  </div>

<script>
(function(){
  var pages = ${pagesJson};
  var spreadCount = Math.max(1, Math.ceil((pages && pages.length ? pages.length : 0) / 2));

  // ✅ PADRÃO: começa FECHADO (capa)
  var view = "closed";
  var openSpreadIndex = 0;
  var animating = false;

  var coverUrl = ${safeCoverJson};

  function $(id){ return document.getElementById(id); }

  function getCssPxVar(name, fallback){
    try{
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      var n = parseFloat(String(v).trim());
      return isFinite(n) ? n : fallback;
    }catch(e){
      return fallback;
    }
  }

  function syncClosedBookToSinglePage(){
    var bookEl = $("book");
    var closedEl = $("closedBook");
    if(!bookEl || !closedEl) return;

    var W = bookEl.clientWidth || 0;
    var H = bookEl.clientHeight || 0;
    if(W <= 0 || H <= 0) return;

    var inset = 10;
    var pad = getCssPxVar("--pad", 18);

    var innerW = Math.max(0, W - inset*2 - pad*2);
    var innerH = Math.max(0, H - inset*2 - pad*2);

    var pageW = Math.max(0, innerW / 2);
    var pageH = Math.max(0, innerH);

    closedEl.style.width = pageW.toFixed(2) + "px";
    closedEl.style.height = pageH.toFixed(2) + "px";
  }

  function setView(nextView){
    view = nextView;

    var closed = $("closedWrap");
    var open = $("openWrap");

    if(closed) closed.classList.toggle("hide", view !== "closed");
    if(open) open.classList.toggle("hide", view !== "open");

    setBtnState();
    render();

    if(view === "closed"){
      setTimeout(syncClosedBookToSinglePage, 0);
    }
  }

  function setBtnState(){
    var prev = $("prevBtn");
    var next = $("nextBtn");

    if(animating){
      if(prev) prev.classList.add("disabled");
      if(next) next.classList.add("disabled");
      return;
    }

    // ✅ no FECHADO: não tem anterior, mas tem próximo (para abrir)
    if(view === "closed"){
      if(prev) prev.classList.add("disabled");
      if(next) next.classList.remove("disabled");
      return;
    }

    // ✅ AJUSTE PEDIDO:
    // - Quando ABERTO, o botão ← NUNCA desativa.
    if(prev) prev.classList.remove("disabled");

    // próximo desativa só no fim
    if(next) next.classList.toggle("disabled", openSpreadIndex >= spreadCount - 1);
  }

  function renderCoverClosed(){
    var img = $("closedCoverImg");
    if(!img) return;

    if(!coverUrl){
      img.removeAttribute("src");
      img.style.display = "none";
      return;
    }

    img.style.display = "block";
    if(img.getAttribute("src") !== coverUrl){
      img.src = coverUrl;
    }
  }

  function renderSlot(root, item){
    if(!root) return;
    root.innerHTML = "";

    if(!item || item.kind === "blank" || !item.url){
      var d = document.createElement("div");
      d.className = "blank";
      d.textContent = "";
      root.appendChild(d);
      return;
    }

    // ✅ SOMENTE FG (sem BG borrado)
    var fg = document.createElement("img");
    fg.className = "imgFg";
    fg.src = item.url;
    fg.alt = item.label || "Página";

    root.appendChild(fg);
  }

  function setLabel(el, item){
    if(!el) return;
    el.textContent = item && item.label ? item.label : "";
    el.style.display = el.textContent ? "inline-flex" : "none";
  }

  function renderDots(){
    var root = $("dots");
    if(!root) return;

    var totalDots = spreadCount;
    var active = (view === "closed") ? 0 : openSpreadIndex;

    var html = "";
    for(var i=0;i<totalDots;i++){
      html += '<span class="dot' + (i===active ? ' on' : '') + '"></span>';
    }
    root.innerHTML = html;
  }

  function getSpreadItems(idx){
    var leftIdx = idx * 2;
    var rightIdx = leftIdx + 1;
    return {
      left: (pages && pages[leftIdx]) ? pages[leftIdx] : { kind:"blank", label:"", pageNum:null },
      right: (pages && pages[rightIdx]) ? pages[rightIdx] : { kind:"blank", label:"", pageNum:null }
    };
  }

  function render(){
    renderCoverClosed();
    setBtnState();
    renderDots();

    var txt = $("progressText");
    if(view === "closed"){
      if(txt) txt.textContent = "Livro fechado • (→ para abrir)";
      return;
    }

    var it = getSpreadItems(openSpreadIndex);
    renderSlot($("pageLeft"), it.left);
    renderSlot($("pageRight"), it.right);
    setLabel($("labelLeft"), it.left);
    setLabel($("labelRight"), it.right);

    if(txt){
      txt.textContent = "Folha " + (openSpreadIndex + 1) + " de " + spreadCount + " • (← → teclado / swipe / botões)";
    }
  }

  function showCover(){
    animating = false;
    openSpreadIndex = 0;
    setView("closed");
  }

  function openBook(){
    openSpreadIndex = Math.max(0, Math.min(openSpreadIndex, spreadCount - 1));
    setView("open");
  }

  function closeBook(){
    showCover();
  }

  function buildFaceNode(item){
    var frame = document.createElement("div");
    frame.className = "imgFrame";

    if(!item || item.kind === "blank" || !item.url){
      var d = document.createElement("div");
      d.className = "blank";
      d.textContent = "";
      frame.appendChild(d);
      return frame;
    }

    // ✅ SOMENTE FG (sem BG borrado)
    var fg = document.createElement("img");
    fg.className = "imgFg";
    fg.src = item.url;
    fg.alt = item.label || "Página";

    frame.appendChild(fg);
    return frame;
  }

  function doFlip(direction){
    if(animating) return;

    // ✅ se está FECHADO e manda "next": abre
    if(view === "closed"){
      if(direction === "next") openBook();
      return;
    }

    // ✅ AJUSTE PEDIDO:
    // Se estiver ABERTO e o usuário apertar ← na primeira folha,
    // ao invés de "desativar", volta para a capa.
    if(direction !== "next" && openSpreadIndex <= 0){
      closeBook();
      return;
    }

    var nextIndex = openSpreadIndex + (direction === "next" ? 1 : -1);

    if(direction === "next"){
      if(openSpreadIndex >= spreadCount - 1) return;
    } else {
      if(openSpreadIndex <= 0){
        closeBook();
        return;
      }
    }

    var turnLayer = $("turnLayer");
    if(!turnLayer){
      openSpreadIndex = nextIndex;
      render();
      return;
    }

    animating = true;
    setBtnState();
    turnLayer.innerHTML = "";

    var cur = getSpreadItems(openSpreadIndex);
    var nxt = getSpreadItems(nextIndex);

    var sheet = document.createElement("div");
    sheet.className = "turnSheet " + (direction === "next" ? "right" : "left") + " flipping";

    var shade = document.createElement("div");
    shade.className = "turnShade";

    var faceFront = document.createElement("div");
    faceFront.className = "turnFace front";

    var faceBack = document.createElement("div");
    faceBack.className = "turnFace back";

    var frontItem = (direction === "next") ? cur.right : cur.left;
    var backItem  = (direction === "next") ? nxt.left  : nxt.right;

    faceFront.appendChild(buildFaceNode(frontItem));
    faceBack.appendChild(buildFaceNode(backItem));

    sheet.appendChild(faceFront);
    sheet.appendChild(faceBack);
    sheet.appendChild(shade);
    turnLayer.appendChild(sheet);

    var dur = 520;
    sheet.style.animation =
      (direction === "next" ? "flipNext" : "flipPrev") + " " + dur + "ms ease-in-out forwards";

    setTimeout(function(){
      openSpreadIndex = nextIndex;
      render();

      animating = false;
      if(turnLayer) turnLayer.innerHTML = "";
      setBtnState();
      renderDots();
    }, dur + 20);
  }

  function prev(){ doFlip("prev"); }
  function next(){ doFlip("next"); }

  var prevBtn = $("prevBtn");
  var nextBtn = $("nextBtn");
  if(prevBtn) prevBtn.addEventListener("click", prev);
  if(nextBtn) nextBtn.addEventListener("click", next);

  var cb = $("closedBook");
  if(cb) cb.addEventListener("click", openBook);

  var bOpen = $("btnOpen");
  if(bOpen) bOpen.addEventListener("click", showCover);

  window.addEventListener("keydown", function(e){
    if(e.key === "ArrowLeft") prev();
    if(e.key === "ArrowRight") next();
    if(e.key === "Escape") closeBook();
  });

  window.addEventListener("resize", function(){
    if(view === "closed") syncClosedBookToSinglePage();
  });

  (function swipe(){
    var el = $("book");
    if(!el) return;
    var x0 = 0, y0 = 0, t0 = 0;

    el.addEventListener("touchstart", function(e){
      var t = e.touches && e.touches[0];
      if(!t) return;
      x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
    }, { passive:true });

    el.addEventListener("touchend", function(e){
      var t = e.changedTouches && e.changedTouches[0];
      if(!t) return;
      var dx = t.clientX - x0;
      var dy = t.clientY - y0;
      var dt = Date.now() - t0;

      if(dt > 900) return;
      if(Math.abs(dx) < 55) return;
      if(Math.abs(dy) > 90) return;

      if(dx > 0) prev(); else next();
    }, { passive:true });
  })();

  // ✅ Inicial: FECHADO
  setView("closed");
  setTimeout(syncClosedBookToSinglePage, 0);
})();
</script>
</body>
</html>`;
}

module.exports = { renderBookPreviewHtml };