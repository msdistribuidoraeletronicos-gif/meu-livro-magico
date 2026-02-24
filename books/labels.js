

"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

function existsSyncSafe(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function readJson(file) {
  const raw = await fsp.readFile(file, "utf-8");
  return JSON.parse(raw);

}
async function writeJson(file, obj) {
  const tmp = file + ".tmp";
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2), "utf-8");
  await fsp.rename(tmp, file);
}

function nowIso() {
  return new Date().toISOString();
}

function clampInt(n, a, b) {
  n = Number(n);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, Math.trunc(n)));
}


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

function themeLabel(themeKey) {
  const map = {
    space: "Viagem Espacial",
    dragon: "Reino dos Dragões",
    ocean: "Fundo do Mar",
    jungle: "Safari na Selva",
    superhero: "Super Herói",
    dinosaur: "Dinossauros",
  };
  return map[themeKey] || String(themeKey || "Tema");
}

function styleLabel(style) {
  return style === "color" ? "Leitura + Colorir" : "Livro para leitura";
}

async function listBooks({ BOOKS_DIR, OUT_DIR }) {
  if (!existsSyncSafe(BOOKS_DIR)) return [];

  const items = await fsp.readdir(BOOKS_DIR, { withFileTypes: true });
  const ids = items.filter((d) => d.isDirectory()).map((d) => d.name);

  const out = [];
  for (const id of ids) {
    const manifestPath = path.join(BOOKS_DIR, id, "book.json");
    if (!existsSyncSafe(manifestPath)) continue;

    try {
      const m = await readJson(manifestPath);
      const pdfFsPath = path.join(OUT_DIR, `${id}.pdf`);
      const hasPdf =
        existsSyncSafe(pdfFsPath) && String(m?.status || "") === "done";
     const coverUrl =
  (m?.overrides?.coverUrl ? String(m.overrides.coverUrl) :
   (m?.cover?.url ? String(m.cover.url) :
    (m?.coverUrl ? String(m.coverUrl) : "")));
    const dirId = String(id);              
const bookId = String(m?.id || dirId); 
out.push({
  id: bookId,         
  dirId,               
  status: String(m?.status || "created"),
  step: String(m?.step || ""),
  error: String(m?.error || ""),
  theme: String(m?.theme || ""),
  themeLabel: themeLabel(m?.theme),
  style: String(m?.style || "read"),
  styleLabel: styleLabel(m?.style),
  childName: String(m?.child?.name || ""),
  updatedAt: String(m?.updatedAt || m?.createdAt || ""),
  createdAt: String(m?.createdAt || ""),
  coverUrl,
  imagesCount: Array.isArray(m?.images) ? m.images.length : 0,
  hasPdf,
  pdfUrl: hasPdf ? `/download/${encodeURIComponent(dirId)}` : "",
});

    } catch {
    
    }
  }

  out.sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
    return tb - ta;
  });

  return out;
}

async function loadBookById({ BOOKS_DIR, OUT_DIR, id }) {
  const manifestPath = path.join(BOOKS_DIR, id, "book.json");
  if (!existsSyncSafe(manifestPath)) return null;

  const m = await readJson(manifestPath);

  const pdfFsPath = path.join(OUT_DIR, `${id}.pdf`);
  const hasPdf =
    existsSyncSafe(pdfFsPath) && String(m?.status || "") === "done";
const coverUrl =
  (m?.overrides?.coverUrl ? String(m.overrides.coverUrl) :
   (m?.cover?.url ? String(m.cover.url) :
    (m?.coverUrl ? String(m.coverUrl) : "")));


 const images = Array.isArray(m?.images)
  ? m.images
      .map((it) => {
        const page = Number(it?.page || 0);
        const baseUrl = String(it?.url || "");
        const ovUrl =
          page && m?.overrides?.pagesImageUrl && m.overrides.pagesImageUrl[String(page)]
            ? String(m.overrides.pagesImageUrl[String(page)])
            : "";
        return {
          page,
          url: ovUrl || baseUrl,
        };
      })
      .filter((it) => it.url)
      .sort((a, b) => (a.page || 0) - (b.page || 0))
  : [];


  return {
    id: String(m?.id || id),
     dirId: String(id),
    status: String(m?.status || "created"),
    step: String(m?.step || ""),
    error: String(m?.error || ""),
    theme: String(m?.theme || ""),
    themeLabel: themeLabel(m?.theme),
    style: String(m?.style || "read"),
    styleLabel: styleLabel(m?.style),
    childName: String(m?.child?.name || ""),
    updatedAt: String(m?.updatedAt || m?.createdAt || ""),
    createdAt: String(m?.createdAt || ""),
    overrides: m?.overrides || {},

    coverUrl,
    images,
    hasPdf,
    pdfUrl: hasPdf ? `/download/${encodeURIComponent(id)}` : "",
  };
}

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
  /* Hero library (card principal) */
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

  .heroShelf{
    margin-top: 14px;
    display:grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  @media (max-width: 940px){
    .heroShelf{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 520px){
    .heroShelf{ grid-template-columns: 1fr; }
  }

  .miniBook{
    border-radius: 20px;
    overflow:hidden;
    border: 1px solid rgba(17,24,39,.06);
    background: rgba(255,255,255,.86);
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
    display:flex;
    flex-direction:column;
    min-height: 240px;
  }
  .miniCover{
    height: 140px;
    background: linear-gradient(135deg, rgba(124,58,237,.10), rgba(219,39,119,.10));
    display:grid;
    place-items:center;
    position:relative;
  }
  .miniCover img{ width:100%; height:100%; object-fit:cover; display:block; }
  .miniEmpty{
    width:100%;
    height:100%;
    display:grid;
    place-items:center;
    color: rgba(109,40,217,1);
    font-size: 44px;
    background:
      radial-gradient(800px 260px at 18% 0%, rgba(124,58,237,.18), transparent 60%),
      radial-gradient(700px 260px at 85% 20%, rgba(219,39,119,.14), transparent 55%),
      rgba(255,255,255,.55);
  }
  .miniBody{
    padding: 12px;
    display:flex;
    flex-direction:column;
    gap: 8px;
    flex:1;
  }
  .miniH{
    font-weight: 1000;
    color: var(--gray-900);
    letter-spacing: -.2px;
    font-size: 14px;
    line-height: 1.2;
  }
  .miniMeta{
    color: var(--gray-600);
    font-weight: 850;
    font-size: 12px;
    line-height: 1.45;
  }
  .miniBtns{
    margin-top:auto;
    display:flex;
    gap: 8px;
  }
  .miniBtn{
    flex:1;
    display:inline-flex;
    align-items:center; justify-content:center;
    padding: 10px 12px;
    border-radius: 999px;
    border: 2px solid rgba(221,214,254,.95);
    background: rgba(255,255,255,.78);
    color: rgba(109,40,217,1);
    font-weight: 1000;
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
    font-size: 13px;
  }
  .miniBtn:hover{ background: rgba(245,243,255,.95); border-color: rgba(196,181,253,.95); }
  .miniBtn.primary{
    border:0;
    color:#fff;
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
    box-shadow: 0 18px 40px rgba(124,58,237,.16);
  }
  .miniBtn.primary:hover{
    background: linear-gradient(90deg, var(--violet-700), var(--pink-700));
    box-shadow: 0 18px 44px rgba(124,58,237,.20);
  }
  .miniBtn.disabled{ opacity:.55; pointer-events:none; }

  /* Faixa horizontal (full width) - “Tudo pronto para imprimir” */
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

  @media (max-width: 940px){
    .heroGrid{ grid-template-columns: 1fr; }
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
  .h1{
    margin: 14px 0 10px;
    font-size: 34px;
    line-height: 1.06;
    font-weight: 1000;
    letter-spacing: -1px;
    color: var(--gray-900);
  }
  @media (min-width: 768px){ .h1{ font-size: 44px; } }
  .gradText{
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600), var(--amber-500));
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent;
  }
  .lead{
    margin: 0;
    max-width: 75ch;
    font-size: 16px;
    line-height: 1.65;
    color: var(--gray-600);
    font-weight: 750;
  }
  @media (min-width: 768px){ .lead{ font-size: 17px; } }

  .ctaRow{
    margin-top: 14px;
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    align-items:center;
  }

  /* Right side hero: quick stats + carousel mini */
  .side{
    display:flex;
    flex-direction:column;
    gap: 12px;
  }
  .panel{
    background: rgba(255,255,255,.85);
    border: 1px solid rgba(17,24,39,.06);
    border-radius: 26px;
    box-shadow: var(--shadow2);
    overflow:hidden;
    position:relative;
  }
  .panel::after{
    content:"";
    position:absolute; inset:0;
    background: radial-gradient(900px 240px at 70% 0%, rgba(252,211,77,.18), transparent 55%);
    pointer-events:none;
  }
  .panelIn{
    position:relative; z-index:2;
    padding: 16px;
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

  /* Sections (long scrolling) */
  .sectionWhite{
    background: #fff;
    padding: 74px 0;
    border-top: 1px solid rgba(17,24,39,.05);
  }
  .sectionSoft{
    padding: 70px 0;
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

  /* Library / controls */
  .library{
    padding: 16px 0 80px;
  }
  .libHead{
    display:flex;
    align-items:flex-end;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
    margin: 10px 0 14px;
  }
  .libTitle{
    font-weight: 1000;
    letter-spacing: -.5px;
    color: var(--gray-900);
    font-size: 24px;
    margin: 0;
  }
  .libSub{
    margin: 6px 0 0;
    color: var(--gray-600);
    font-weight: 750;
    line-height: 1.6;
    font-size: 13.5px;
    max-width: 70ch;
  }

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

  .rowBtns{
    margin-top:auto;
    display:flex;
    gap: 10px;
  }
  .aBtn{
    flex:1;
    display:inline-flex;
    align-items:center; justify-content:center;
    padding: 12px 14px;
    border-radius: 999px;
    border: 2px solid rgba(221,214,254,.95);
    background: rgba(255,255,255,.78);
    color: rgba(109,40,217,1);
    font-weight: 1000;
    box-shadow: 0 12px 26px rgba(17,24,39,.06);
  }
  .aBtn:hover{ background: rgba(245,243,255,.95); border-color: rgba(196,181,253,.95); }
  .aBtn.primary{
    border:0;
    color:#fff;
    background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
    box-shadow: 0 18px 40px rgba(124,58,237,.18);
  }
  .aBtn.primary:hover{
    background: linear-gradient(90deg, var(--violet-700), var(--pink-700));
    box-shadow: 0 18px 44px rgba(124,58,237,.24);
  }
  .aBtn.disabled{
    opacity:.55;
    pointer-events:none;
  }

  .noteLine{
    margin-top: 12px;
    color: var(--gray-600);
    font-weight: 800;
    font-size: 13px;
    line-height: 1.55;
  }

  /* Example shelf (when empty) */
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

  /* CTA section (like landing) */
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

  /* FAQ */
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

  /* Reveal (like framer motion initial->animate) */
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

.editBackdrop{
  position: absolute;
  inset: 0;
  background: rgba(17,24,39,.55);
  backdrop-filter: blur(6px);
}

.editModal{
  position: relative;
  width: min(1100px, calc(100vw - 22px));
  max-height: calc(100vh - 22px);
  overflow: auto;
  margin: 11px auto;
  background: rgba(255,255,255,.96);
  border: 1px solid rgba(17,24,39,.08);
  border-radius: 26px;
  box-shadow: 0 34px 120px rgba(17,24,39,.28);
  padding: 14px;
}

.editTop{
  display:flex;
  justify-content:space-between;
  gap:10px;
  flex-wrap:wrap;
  align-items:center;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(17,24,39,.06);
}

.editTitle{
  font-weight:1000;
  font-size: 16px;
  color: var(--gray-900);
  letter-spacing:-.2px;
}

.editControls{
  margin-top: 12px;
  display: grid;
  gap: 10px;
}
.editControls .row{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  align-items:center;
}

.editSelect{
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(221,214,254,.95);
  background: rgba(255,255,255,.90);
  font-weight: 900;
  box-shadow: var(--shadow2);
  outline:none;
}

.editBody{ margin-top: 12px; }

.editBookWrap{
  border-radius: 26px;
  border: 1px solid rgba(17,24,39,.08);
  background: linear-gradient(180deg, rgba(245,243,255,.55), rgba(255,255,255,.85), rgba(255,241,242,.45));
  padding: 12px;
}

.editFooter{
  margin-top: 12px;
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  align-items:center;
  justify-content:space-between;
  padding-top: 10px;
  border-top: 1px solid rgba(17,24,39,.06);
}

.editCounters{
  font-weight: 900;
  color: rgba(75,85,99,.9);
}

/* opcional: trava o scroll do body quando modal abrir */
body.modalOpen{
  overflow: hidden;
}

.editModal{
  position:relative;
  width: min(1100px, calc(100vw - 22px));
  max-height: calc(100vh - 22px);
  overflow:auto;
  margin: 11px auto;
  background: rgba(255,255,255,.96);
  border: 1px solid rgba(17,24,39,.08);
  border-radius: 26px;
  box-shadow: 0 34px 120px rgba(17,24,39,.28);
  padding: 14px;
}
.editTop{
  display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(17,24,39,.06);
}
.editTitle{
  font-weight:1000;
  font-size: 16px;
  color: var(--gray-900);
  letter-spacing:-.2px;
}
.editControls{
  margin-top: 12px;
  display:grid;
  gap:10px;
}
.editControls .row{
  display:flex; gap:10px; flex-wrap:wrap; align-items:center;
}
.editSelect{
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(221,214,254,.95);
  background: rgba(255,255,255,.90);
  font-weight: 900;
  box-shadow: var(--shadow2);
  outline:none;
}
.editBody{ margin-top: 12px; }
.editBookWrap{
  border-radius: 26px;
  border: 1px solid rgba(17,24,39,.08);
  background: linear-gradient(180deg, rgba(245,243,255,.55), rgba(255,255,255,.85), rgba(255,241,242,.45));
  padding: 12px;
}
.editFooter{
  margin-top: 12px;
  display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;
  padding-top: 10px;
  border-top: 1px solid rgba(17,24,39,.06);
}
.editCounters{
  font-weight: 900;
  color: rgba(75,85,99,.9);
}

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

  <!-- HERO -->
  <section class="hero">
    <div class="stars" id="stars"></div>
    <div class="wrap">
      <div class="heroGrid">
  <!-- CARD PRINCIPAL: MINHA BIBLIOTECA -->
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
            Aqui aparecem os livros do usuário logado. Clique em <b>Abrir</b> para ver as páginas e em <b>PDF</b> para baixar quando estiver <b>done</b>.
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

      <!-- MINI GRADE (carrega via JS com /api/books) -->
   <!-- MINI GRADE (carrega via JS com /api/books) -->


<!-- LISTA COMPLETA + FILTROS (AGORA NO TOPO) -->
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

  <!-- FAIXA HORIZONTAL: TUDO PRONTO PARA IMPRIMIR -->
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
</div>

        </div>
      </div>

      <!-- EMPTY STATE + EXAMPLES (aparece quando não há livros) -->
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
  </section>

  <!-- HOW TO USE (long content) -->
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

  <!-- LIBRARY -->
  

  <!-- FAQ (more scroll) -->
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

  <!-- CTA (bottom) -->
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

    var pdfBtn = b.hasPdf
      ? ('<a class="aBtn" href="' + esc(b.pdfUrl) + '">⬇️ PDF</a>')
      : ('<span class="aBtn disabled">⬇️ PDF</span>');

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
    html +=     '<div class="rowBtns">';
   html +=       '<a class="aBtn primary" href="/books/' + encodeURIComponent(b.dirId || b.id) + '">👀 Abrir</a>';

    html +=       pdfBtn;
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
 function renderBookPreviewHtml(book) {

  const safeCoverUrl =
  (book?.overrides?.coverUrl ? String(book.overrides.coverUrl) :
   (book && (book.coverUrl || book?.cover?.url) ? String(book.coverUrl || book.cover.url) : ""));


    const storyPages = Array.isArray(book?.images)
      ? book.images
          .map((it) => ({
            page: Number(it?.page || 0),
            url: String(it?.url || ""),
          }))
          .filter((it) => it.url)
          .sort((a, b) => (a.page || 0) - (b.page || 0))
      : [];

    const pages = [];
   pages.push({ kind: "blank", label: "", pageNum: null }); 
pages.push({ kind: "image", url: safeCoverUrl, label: "Capa", isCover: true, pageNum: 0 });

for (const p of storyPages) {
  pages.push({ kind: "image", url: p.url, label: `Página ${p.page}`, pageNum: Number(p.page) || null });
}

   if (pages.length % 2 !== 0) pages.push({ kind: "blank", label: "", pageNum: null });


    const errBox = book?.error ? `<div class="err">❌ Erro: ${escapeHtml(book.error)}</div>` : "";
const metaUpdated = book?.updatedAt ? fmtDateBR(book.updatedAt) : "-";

  
    const ratioNum = Number(book?.coverWidth || book?.imgWidth || 1020) || 1020;
    const ratioDen = Number(book?.coverHeight || book?.imgHeight || 797) || 797;

    const pagesJson = JSON.stringify(pages)
      .replace(/</g, "\\u003c")
      .replace(/<\/script/gi, "<\\/script");

    return `<!doctype html>
  <html lang="pt-BR">
  <head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Livro ${escapeHtml(book?.id)} — Meu Livro Mágico</title>
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

      --mat: clamp(10px, 1.1vw, 16px);

      /* dobra do miolo */
      --foldW: clamp(20px, 2.8vw, 34px);

      /* padding interno usado na .pages e sincronizado com o flip */
      --pad: 18px;
    }

    *{ box-sizing:border-box; }
    html,body{ height:100%; }
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      color: var(--gray-800);
      background: linear-gradient(180deg, var(--violet-50), var(--white) 46%, var(--pink-50));
      min-height:100vh;
      padding-bottom: 30px;
      overflow-x:hidden;
    }
    a{ color:inherit; text-decoration:none; }
    .wrap{ max-width: 1180px; margin: 0 auto; padding: 18px 16px; }

    /* Top bar */
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
      background: rgba(255,255,255,.78);
      border:2px solid rgba(221,214,254,.95);
      color: rgba(109,40,217,1);
      font-weight:900;
      box-shadow: var(--shadow2);
    }
    .pill:hover{
      background: rgba(245,243,255,.95);
      border-color: rgba(196,181,253,.95);
    }

    /* Header */
    .head{
      background: rgba(255,255,255,.92);
      border: 1px solid rgba(17,24,39,.06);
      border-radius: 26px;
      box-shadow: var(--shadow2);
      padding: 14px;
      display:flex;
      gap:12px;
      align-items:flex-start;
      justify-content:space-between;
      flex-wrap:wrap;
      margin-bottom: 14px;
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
    .actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      align-items:center;
      justify-content:flex-end;
    }
    .btn{
      display:inline-flex; align-items:center; justify-content:center;
      padding: 12px 14px;
      border-radius: 999px;
      border: 2px solid rgba(221,214,254,.95);
      background: rgba(255,255,255,.78);
      color: rgba(109,40,217,1);
      font-weight:1000;
      box-shadow: var(--shadow2);
      cursor:pointer;
      user-select:none;
    }
    .btn.primary{
      border:0;
      color:#fff;
      background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
      box-shadow: 0 18px 40px rgba(124,58,237,.18);
    }
    .btn.primary:hover{
      background: linear-gradient(90deg, var(--violet-700), var(--pink-700));
      box-shadow: 0 18px 44px rgba(124,58,237,.24);
    }
    .btn.disabled{ opacity:.55; pointer-events:none; cursor:default; }

    .err{
      margin-top: 10px;
      padding: 12px;
      border-radius: 18px;
      border: 1px solid rgba(239,68,68,.25);
      background: rgba(239,68,68,.08);
      font-weight: 900;
      color: rgba(220,38,38,1);
    }

    /* Stage */
    .stage{
      position:relative;
      width: 100%;
      display:grid;
      place-items:center;
      margin-top: 12px;
    }

    /* Palco (sem mesa/superfície, só glow) */
    .book{
      width: min(1080px, calc(100vw - 18px));
      aspect-ratio: ${ratioNum} / ${ratioDen};
      max-height: 76vh;
      min-height: 460px;
      position:relative;
    }

    .bgGlow{
      position:absolute;
      inset: -26px;
      border-radius: 44px;
      background:
        radial-gradient(900px 360px at 18% 0%, rgba(124,58,237,.22), transparent 60%),
        radial-gradient(820px 340px at 85% 20%, rgba(219,39,119,.18), transparent 55%),
        radial-gradient(700px 320px at 50% 92%, rgba(252,211,77,.14), transparent 60%);
      filter: blur(4px);
      opacity:.92;
      pointer-events:none;
    }

    .closedWrap{
      position:absolute;
      inset: 0;
      display:grid;
      place-items:center;
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

    /* ---------- LIVRO ABERTO (realista) ---------- */
    .openWrap{
      position:absolute;
      inset: 0;
      display:grid;
      place-items:center;
    }

    .spreadShell{
      position:absolute;
      inset: 0;
      border-radius: calc(var(--r) + 6px);
      overflow:hidden;
      box-shadow:
        0 30px 100px rgba(17,24,39,.22),
        0 14px 30px rgba(124,58,237,.08);
      background: rgba(255,255,255,.10);
      border: 1px solid rgba(17,24,39,.06);

      /* ✅ leve perspectiva para parecer livro físico */
      transform: translateZ(0) perspective(1800px) rotateX(2.4deg);
      transform-origin: 50% 55%;
    }

    .paperBase{
      position:absolute;
      inset: 10px;
      border-radius: var(--r);
      background:
        radial-gradient(1200px 520px at 50% 0%, rgba(255,255,255,.62), transparent 55%),
        radial-gradient(900px 420px at 15% 10%, rgba(124,58,237,.10), transparent 60%),
        radial-gradient(900px 420px at 85% 15%, rgba(219,39,119,.08), transparent 55%),
        radial-gradient(1100px 460px at 50% 92%, rgba(17,24,39,.10), transparent 64%),
        rgba(255,255,255,.52);
      box-shadow: inset 0 0 0 1px rgba(17,24,39,.06);
      pointer-events:none;
    }

    .paperGloss{
      position:absolute;
      inset: 10px;
      border-radius: var(--r);
      background:
        linear-gradient(115deg, rgba(255,255,255,.22), transparent 42%),
        radial-gradient(900px 340px at 50% 0%, rgba(255,255,255,.20), transparent 60%);
      mix-blend-mode: screen;
      opacity:.85;
      pointer-events:none;
    }

    .fold{
      position:absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: var(--foldW);
      transform: translateX(-50%);
      pointer-events:none;
      z-index:10;
      background:
        radial-gradient(26px 620px at 50% 50%, rgba(17,24,39,.22), transparent 72%),
        linear-gradient(90deg,
          rgba(255,255,255,.03),
          rgba(255,255,255,.42),
          rgba(255,255,255,.03)
        ),
        linear-gradient(90deg,
          rgba(17,24,39,.16),
          rgba(17,24,39,.02),
          rgba(17,24,39,.16)
        );
      opacity:.95;
      filter: blur(.15px);
    }

    .curveL, .curveR{
      position:absolute;
      top: 14px;
      bottom: 14px;
      width: 18%;
      pointer-events:none;
      z-index:9;
      border-radius: var(--r);
    }
    .curveL{
      left: calc(50% - 18%);
      background:
        radial-gradient(280px 620px at 100% 50%, rgba(17,24,39,.18), transparent 62%),
        radial-gradient(260px 560px at 100% 50%, rgba(255,255,255,.22), transparent 72%);
      opacity:.90;
    }
    .curveR{
      right: calc(50% - 18%);
      background:
        radial-gradient(280px 620px at 0% 50%, rgba(17,24,39,.18), transparent 62%),
        radial-gradient(260px 560px at 0% 50%, rgba(255,255,255,.22), transparent 72%);
      opacity:.90;
    }

    .edgeLeft, .edgeRight{
      position:absolute;
      top: 12px;
      bottom: 12px;
      width: 14px;
      pointer-events:none;
      z-index:9;
      opacity:.92;
    }
    .edgeLeft{
      left: 10px;
      border-radius: 18px 0 0 18px;
      background:
        repeating-linear-gradient(
          180deg,
          rgba(255,255,255,.96) 0px,
          rgba(255,255,255,.96) 3px,
          rgba(245,245,245,.96) 4px,
          rgba(255,255,255,.96) 7px
        );
      box-shadow:
        inset 8px 0 14px rgba(17,24,39,.12),
        inset 0 0 0 1px rgba(17,24,39,.06);
    }
    .edgeRight{
      right: 10px;
      border-radius: 0 18px 18px 0;
      background:
        repeating-linear-gradient(
          180deg,
          rgba(255,255,255,.96) 0px,
          rgba(255,255,255,.96) 3px,
          rgba(245,245,245,.96) 4px,
          rgba(255,255,255,.96) 7px
        );
      box-shadow:
        inset -8px 0 14px rgba(17,24,39,.12),
        inset 0 0 0 1px rgba(17,24,39,.06);
    }

    .pages{
      position:absolute;
      inset: 10px;
      border-radius: var(--r);
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap: 0px; /* ✅ sem vão */
      padding: var(--pad);
      z-index:2;
      background: rgba(255,255,255,.06);
    }

    .page{
      position:relative;
      overflow:hidden;
      border-radius: var(--pageR);

      /* ✅ papel */
      background:
        radial-gradient(900px 500px at 50% 0%, rgba(255,255,255,.85), rgba(255,255,255,.60) 55%, rgba(255,255,255,.52)),
        linear-gradient(180deg, rgba(255,255,255,.78), rgba(255,255,255,.56));

      /* ✅ bordas e volume */
      box-shadow:
        0 18px 38px rgba(17,24,39,.10),
        inset 0 0 0 1px rgba(17,24,39,.08),
        inset 0 14px 26px rgba(255,255,255,.20),
        inset 0 -18px 24px rgba(17,24,39,.08);

      transform: translateZ(0);
    }

    .page.left{
      transform-origin: right center;
      transform: perspective(1600px) rotateY(2.2deg);
    }
    .page.right{
      transform-origin: left center;
      transform: perspective(1600px) rotateY(-2.2deg);
    }

    /* brilho leve do papel */
    .page::before{
      content:"";
      position:absolute;
      inset:0;
      border-radius: var(--pageR);
      pointer-events:none;
      background:
        radial-gradient(700px 240px at 50% 0%, rgba(255,255,255,.22), transparent 60%),
        radial-gradient(700px 260px at 50% 100%, rgba(17,24,39,.10), transparent 62%);
      opacity:.75;
      z-index:2;
    }

    .page.left::after{
      content:"";
      position:absolute; inset:0;
      border-radius: var(--pageR);
      pointer-events:none;
      background: linear-gradient(90deg, rgba(17,24,39,.18), transparent 34%);
      opacity:.55;
      z-index:3;
    }
    .page.right::after{
      content:"";
      position:absolute; inset:0;
      border-radius: var(--pageR);
      pointer-events:none;
      background: linear-gradient(270deg, rgba(17,24,39,.18), transparent 34%);
      opacity:.55;
      z-index:3;
    }

  .imgFrame{
  position:absolute;
  inset: 0 !important;
  overflow:hidden;
  background: transparent;
  z-index:4;
}

.page.left .imgFrame{
  border-top:    1px solid rgba(17,24,39,.12);
  border-bottom: 1px solid rgba(17,24,39,.12);
  border-left:   1px solid rgba(17,24,39,.14);
  border-right:  0;

  border-top-left-radius: var(--pageR);
  border-bottom-left-radius: var(--pageR);
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;

  box-shadow:
    -12px 0 18px rgba(17,24,39,.12),  
    0 -10px 16px rgba(17,24,39,.06), 
    0  10px 16px rgba(17,24,39,.06);  
}

.page.right .imgFrame{
  border-top:    1px solid rgba(17,24,39,.12);
  border-bottom: 1px solid rgba(17,24,39,.12);
  border-right:  1px solid rgba(17,24,39,.14);
  border-left:   0;

  border-top-right-radius: var(--pageR);
  border-bottom-right-radius: var(--pageR);
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;

  box-shadow:
    12px 0 18px rgba(17,24,39,.12),   
    0 -10px 16px rgba(17,24,39,.06),  
    0  10px 16px rgba(17,24,39,.06); 
}
:root{ --foldW: 10px !important; }
.fold{ opacity: .55 !important; }

    .img{
  width:100%;
  height:100%;
  display:block;


  object-fit: contain;  
  object-position: center;
  background: rgba(255,255,255,.25);
  transform: translateZ(0);
  -webkit-font-smoothing: antialiased;
  image-rendering: auto;
}

    .blank{
      width:100%;
      height:100%;
      display:grid;
      place-items:center;
      color: rgba(107,114,128,.75);
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
      background: rgba(255,255,255,.82);
      border: 1px solid rgba(221,214,254,.95);
      color: rgba(75,85,99,.95);
      font-weight: 1000;
      font-size: 12px;
      box-shadow: var(--shadow2);
      z-index:20;
      backdrop-filter: blur(6px);
    }

    .hide{ display:none !important; }

    .fadeIn{
      animation: fadeIn .22s ease-out both;
    }
    @keyframes fadeIn{
      from{ opacity:0; transform: translateY(6px) scale(.992); }
      to{ opacity:1; transform: translateY(0) scale(1); }
    }

    .pageSwap{
      animation: pageSwap .24s ease-out both;
    }
    @keyframes pageSwap{
      from{ opacity:.0; transform: translateY(10px) scale(.992); filter: blur(.4px); }
      to{ opacity:1; transform: translateY(0) scale(1); filter: blur(0); }
    }

    .navBtn{
      position:absolute;
      top:50%;
      transform: translateY(-50%);
      width: 54px;
      height: 54px;
      border-radius: 999px;
      border: 2px solid rgba(221,214,254,.95);
      background: rgba(255,255,255,.78);
      box-shadow: var(--shadow2);
      display:grid;
      place-items:center;
      cursor:pointer;
      user-select:none;
      font-weight: 1000;
      color: rgba(109,40,217,1);
      z-index: 50;
      backdrop-filter: blur(6px);
    }
    .navBtn:hover{
      background: rgba(245,243,255,.95);
      border-color: rgba(196,181,253,.95);
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

    @media (max-width: 860px){
      .book{ min-height: 440px; }
      .navPrev{ left: -10px; }
      .navNext{ right: -10px; }
      .pages{ padding: 14px; }
      :root{ --pad: 14px; }
    }

    @media (max-width: 520px){
      .book{ min-height: 420px; }
      .pages{ padding: 12px; }
      :root{ --pad: 12px; }
    }
    .turnLayer{
      position:absolute;
      inset: 10px;
      z-index: 60;
      pointer-events:none;
      perspective: 1400px;
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
      background: radial-gradient(closest-side, rgba(0,0,0,.22), transparent 70%);
      filter: blur(8px);
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
        @keyframes flipPrev{
    0%   { transform: rotateY(0deg); }
    100% { transform: rotateY(180deg); }
  }

 .pages{
  gap: 0 !important;
  column-gap: 0 !important;
  grid-column-gap: 0 !important;
}

.page.left{
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  margin-right: -1px !important;
}

.page.right{
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
  margin-left: -1px !important;  
}

.page.left .imgFrame{
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}
.page.right .imgFrame{
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}

:root{
  --foldW: 10px !important;
}
.fold{
  opacity: .65 !important;  
  filter: blur(.25px) !important;
}
#editModalRoot, #textPopupRoot, #imagePopupRoot{
  position: fixed;
  inset: 0;
  z-index: 99999;

  /* ✅ isso resolve “fixo à esquerda” e “abrindo embaixo” */
  display: flex;
  justify-content: center;
  align-items: flex-start;

  padding: 12px;
}

/* fundo escuro */
.editBackdrop{
  position: absolute;
  inset: 0;
  background: rgba(17,24,39,.55);
  backdrop-filter: blur(6px);
}

/* caixa do modal */
.editModal{
  position: relative;
  z-index: 2;

  width: min(1100px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  overflow: auto;

  margin: 0; 
  background: rgba(255,255,255,.96);
  border: 1px solid rgba(17,24,39,.08);
  border-radius: 26px;
  box-shadow: 0 34px 120px rgba(17,24,39,.28);
  padding: 14px;
}

body.modalOpen{ overflow: hidden; }

  </style>
  </head>
  <body>
    <div class="wrap">
      <div class="top">
        <a class="pill" href="/books">← Voltar para Meus Livros</a>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <a class="pill" href="/create">🪄 Criar novo</a>
          <a class="pill" href="/sales">🎁 Vendas</a>
        </div>
      </div>

      <div class="head">
        <div>
          <div class="ttl">📘 ${escapeHtml(book?.id)}</div>
          <div class="meta">
            Status: <b>${escapeHtml(book?.status)}</b> • Step: ${escapeHtml(book?.step || "-")}<br/>
            Criança: <b>${escapeHtml(book?.childName || "-")}</b><br/>
            Tema: <b>${escapeHtml(book?.themeLabel || book?.theme || "-")}</b><br/>
            Estilo: <b>${escapeHtml(book?.styleLabel || book?.style || "-")}</b><br/>
            Atualizado: <b>${escapeHtml(metaUpdated)}</b>
          </div>
          ${errBox || ""}
        </div>

      <!-- actions removidas (sem PDF / sem abrir capa) -->

      </div>

      <div class="stage">
  <div class="book" id="book">
    <div class="bgGlow"></div>

    <!-- livro fechado -->
    <div class="closedWrap" id="closedWrap">
      <div class="closedBook" id="closedBook" title="Clique para abrir">
        <img class="closedCoverImg" id="closedCoverImg" alt="Capa"/>
        <div class="closedVarnish"></div>
        <div class="closedVignette"></div>
        <div class="closedPagesEdge"></div>
        <div class="closedSpine"></div>
        <div class="closedBorder"></div>
      </div>
      <div class="closedHint">Clique na capa para abrir • ESC fecha</div>
    </div>

    <!-- livro aberto -->
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

  <!-- ✅ botão pedido (abaixo do livro) -->
  <div style="margin-top:12px; display:flex; justify-content:center;">
    <button class="btn primary" id="btnEditBook" type="button">✏️ Editar livro</button>
  </div>
</div>
<!-- =========================
  ✅ MODAL: EDITAR LIVRO (RAIZ)
========================= -->
<div id="editModalRoot" class="hide" aria-hidden="true">
  <div class="editBackdrop" id="editBackdrop"></div>

  <div class="editModal" role="dialog" aria-modal="true" aria-label="Editor do livro">
    <div class="editTop">
      <div class="editTitle">✏️ Editar livro</div>
      <button class="btn" id="btnCloseEdit" type="button">✖ Fechar</button>
    </div>

    <div class="editControls" id="editControls"></div>

    <div class="editBody">
      <div class="editBookWrap" id="editBookWrap"></div>
    </div>

    <div class="editFooter">
      <div class="editCounters" id="editCounters">Texto: 0/10 • Imagem: 0/5</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
        <button class="btn" id="btnDiscardEdits" type="button">🗑️ Descartar rascunho</button>
        <button class="btn" id="btnRefreshEdits" type="button">🔄 Recarregar</button>
        <button class="btn primary" id="btnSaveEdits" type="button">💾 Salvar alterações</button>
      </div>
    </div>
  </div>
</div>

<!-- =========================
  ✅ POPUP: EDITAR TEXTO
========================= -->
<div id="textPopupRoot" class="hide" aria-hidden="true">
  <div class="editBackdrop" id="textBackdrop"></div>

  <div class="editModal" role="dialog" aria-modal="true" aria-label="Editar texto">
    <div class="editTop">
      <div class="editTitle" id="textPopupTitle">📝 Editar texto</div>
      <button class="btn" id="btnCloseText" type="button">✖ Fechar</button>
    </div>

    <div class="editBody">
      <textarea id="textArea" rows="7"
        style="width:100%; padding:14px; border-radius:16px; border:1px solid rgba(221,214,254,.95); font-weight:900; outline:none; box-shadow: var(--shadow2); resize:vertical;"
        placeholder="Digite o novo texto..."></textarea>

      <div style="margin-top:8px; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <div class="editCounters" id="textCharInfo">0 caracteres</div>
        <button class="btn primary" id="btnApplyText" type="button">✅ Adicionar ao rascunho</button>
      </div>
    </div>
  </div>
</div>

<!-- =========================
  ✅ POPUP: EDITAR IMAGEM
========================= -->
<div id="imagePopupRoot" class="hide" aria-hidden="true">
  <div class="editBackdrop" id="imageBackdrop"></div>

  <div class="editModal" role="dialog" aria-modal="true" aria-label="Editar imagem">
    <div class="editTop">
      <div class="editTitle" id="imagePopupTitle">🖼️ Editar imagem</div>
      <button class="btn" id="btnCloseImage" type="button">✖ Fechar</button>
    </div>

    <div class="editBody">
      <textarea id="imageInstr" rows="6"
        style="width:100%; padding:14px; border-radius:16px; border:1px solid rgba(221,214,254,.95); font-weight:900; outline:none; box-shadow: var(--shadow2); resize:vertical;"
        placeholder="Descreva a mudança na imagem (ex: 'trocar o fundo por...', 'remover objeto...', 'deixar mais...' )"></textarea>

      <div style="margin-top:8px; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <div class="editCounters" id="imageInstrInfo">0 caracteres</div>
        <button class="btn primary" id="btnApplyImageEdit" type="button">✅ Adicionar ao rascunho</button>
      </div>

      <div class="noteLine" id="imageEditStatus" style="margin-top:10px;"></div>
    </div>
  </div>
</div>


  <script>
  

  (function(){
    var pages = ${pagesJson};
    var spreadCount = Math.max(1, Math.ceil(pages.length / 2));
var bookId = ${JSON.stringify(book?.dirId || book?.id || "")};

    var view = "closed";
    var openSpreadIndex = 1;
    var animating = false;

    function $(id){ return document.getElementById(id); }

    function pageNumOf(item){
      var n = item && item.pageNum;
      n = (n == null ? null : Number(n));
      return Number.isFinite(n) ? n : null;
    }

    function getMaxPageNum(){
      var max = 0;
      for(var i=0;i<pages.length;i++){
        var pn = pages[i] && pages[i].pageNum;
        pn = (pn == null ? 0 : Number(pn));
        if(Number.isFinite(pn) && pn > max) max = pn;
      }
      return max || 0;
    }

    function getItemByPageNum(pn){
      pn = Number(pn || 0);
      if(!pn) return null;
      for(var i=0;i<pages.length;i++){
        var it = pages[i];
        if(!it) continue;
        var n = it.pageNum;
        n = (n == null ? null : Number(n));
        if(Number.isFinite(n) && n === pn) return it;
      }
      return null;
    }

function openPagePicker(kind){
  var maxPn = getMaxPageNum();

  var msg = "Digite o numero da pagina que voce quer editar";
  if (maxPn) msg += " (1 ate " + maxPn + ")";
  msg += ":";

  var v = window.prompt(msg, "1");
  if (v === null) return;

  var pn = Number(String(v).trim());
  if (!pn || pn < 1) {
    alert("Digite um numero valido (>= 1).");
    return;
  }
  if (maxPn && pn > maxPn) {
    alert("Pagina invalida. Maximo: " + maxPn);
    return;
  }

  if (kind === "image") {
    openImagePopup({ target: "page", pageNum: pn });
  } else {
    openTextPopup({ target: "page", pageNum: pn });
  }
}


    function bump(el, cls){
      if(!el) return;
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    }

    function getCssPxVar(name, fallback){
      try{
        var v = getComputedStyle(document.documentElement).getPropertyValue(name);
        var n = parseFloat(String(v).trim());
        return isFinite(n) ? n : fallback;
      }catch{
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

      if(view === "closed"){
        bump($("closedBook"), "fadeIn");
      }else{
        bump($("spreadShell"), "fadeIn");
      }

      render(true);
      syncClosedBookToSinglePage();
    }

    function setBtnState(){
      var prev = $("prevBtn");
      var next = $("nextBtn");

      if(animating){
        if(prev) prev.classList.add("disabled");
        if(next) next.classList.add("disabled");
        return;
      }

      if(view === "closed"){
        if(prev) prev.classList.add("disabled");
        if(next) next.classList.toggle("disabled", spreadCount <= 1);
        return;
      }

      var idx = openSpreadIndex;
      if(prev) prev.classList.toggle("disabled", idx <= 1);
      if(next) next.classList.toggle("disabled", idx >= spreadCount - 1);
    }

    function renderCoverClosed(){
      var img = $("closedCoverImg");
      if(!img) return;

      if(!pages[1] || !pages[1].url){
        img.removeAttribute("src");
        img.style.display = "none";
        return;
      }
      img.style.display = "block";
      img.src = pages[1].url;
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

      var img = document.createElement("img");
      img.className = "img";
      img.src = item.url;
      img.alt = item.label || "Página";
      root.appendChild(img);
    }

    function setLabel(el, item){
      if(!el) return;
      el.textContent = item && item.label ? item.label : "";
      el.style.display = el.textContent ? "inline-flex" : "none";
    }

    function renderDots(){
      var root = $("dots");
      if(!root) return;

      var totalDots = 1 + Math.max(0, spreadCount - 1);
      var active = (view === "closed") ? 0 : (openSpreadIndex - 1);

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
        left: pages[leftIdx] || { kind:"blank" },
        right: pages[rightIdx] || { kind:"blank" }
      };
    }

    function render(animateSwap){
      renderCoverClosed();

      if(view === "closed"){
        setBtnState();
        renderDots();

        var txt = $("progressText");
        if(txt){
          var internas = Math.max(0, spreadCount - 1);
          txt.textContent = "Capa (livro fechado) • " + internas + " folha(s) interna(s)  •  (→ para abrir)";
        }
        return;
      }

      if(animateSwap){
        bump($("pagesGrid"), "pageSwap");
      }

      var it = getSpreadItems(openSpreadIndex);

      renderSlot($("pageLeft"), it.left);
      renderSlot($("pageRight"), it.right);

      setLabel($("labelLeft"), it.left);
      setLabel($("labelRight"), it.right);

      setBtnState();
      renderDots();

      var txt2 = $("progressText");
      if(txt2){
        var internoN = openSpreadIndex;
        var internoTotal = Math.max(1, spreadCount - 1);
        txt2.textContent = "Folha interna " + internoN + " de " + internoTotal + "  •  (← → teclado / swipe)";
      }
    }

    function openBook(){
      if(spreadCount <= 1) return;
      openSpreadIndex = 1;
      setView("open");
    }

    function closeBook(){
      setView("closed");
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
      var img = document.createElement("img");
      img.className = "img";
      img.src = item.url;
      img.alt = item.label || "Página";
      frame.appendChild(img);
      return frame;
    }

    function doFlip(direction){
      if(animating) return;

      if(view === "closed"){
        openBook();
        return;
      }

      var nextIndex = openSpreadIndex + (direction === "next" ? 1 : -1);

      if(direction === "next"){
        if(openSpreadIndex >= spreadCount - 1) return;
      } else {
        if(openSpreadIndex <= 1){
          closeBook();
          return;
        }
      }

      var turnLayer = $("turnLayer");
      if(!turnLayer){
        openSpreadIndex = nextIndex;
        render(true);
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
      var backItem  = (direction === "next") ? nxt.left : nxt.right;

      faceFront.appendChild(buildFaceNode(frontItem));
      faceBack.appendChild(buildFaceNode(backItem));

      sheet.appendChild(faceFront);
      sheet.appendChild(faceBack);
      sheet.appendChild(shade);

      turnLayer.appendChild(sheet);

      var dur = 520;
      sheet.style.animation = (direction === "next" ? "flipNext" : "flipPrev") + " " + dur + "ms ease-in-out forwards";
setTimeout(function(){
  try{

    openSpreadIndex = nextIndex;

    render(true);

    animating = false;
    if(turnLayer) turnLayer.innerHTML = "";
    setBtnState();
    renderDots();
  }catch(e){}
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

    window.addEventListener("keydown", function(e){
      if(e.key === "ArrowLeft") prev();
      if(e.key === "ArrowRight") next();
      if(e.key === "Escape" && view === "open") closeBook();
    });

    window.addEventListener("resize", function(){
      syncClosedBookToSinglePage();
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

    var editDraft = {
      textEdits: [],
      imageEdits: []
    };

    function showModal(rootId, yes){
  var el = document.getElementById(rootId);
  if(!el) return;

  if (yes) {
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
  }

  document.body.classList.toggle("modalOpen", !!yes);

  if(yes){
    el.classList.remove("hide");
    el.setAttribute("aria-hidden", "false");
  }else{
    el.classList.add("hide");
    el.setAttribute("aria-hidden", "true");
  }
}


    function currentContext(){

      if(view === "closed"){
        return { view:"closed", spreadIndex:0, left:null, right:null };
      }
      var it = getSpreadItems(openSpreadIndex);
      return {
        view:"open",
        spreadIndex: openSpreadIndex,
        left: it.left,
        right: it.right
      };
    }

    function countLimits(){
      return {
        textUsed: editDraft.textEdits.length,
        textMax: 10,
        imgUsed: editDraft.imageEdits.length,
        imgMax: 5
      };
    }

    function updateCounters(){
      var c = countLimits();
      var el = $("editCounters");
      if(el){
        el.textContent =
          "Texto: " + c.textUsed + "/" + c.textMax + " • " +
          "Imagem: " + c.imgUsed + "/" + c.imgMax;
      }
    }

    function cloneBookIntoModal(){
      var wrap = $("editBookWrap");
      if(!wrap) return;

      wrap.innerHTML = "";
      var bookNode = $("book");
      if(!bookNode) return;

      var clone = bookNode.cloneNode(true);

      var allIds = clone.querySelectorAll("[id]");
      allIds.forEach(function(n){ n.removeAttribute("id"); });

      var btns = clone.querySelectorAll(".navBtn");
      btns.forEach(function(b){ b.parentNode && b.parentNode.removeChild(b); });

      wrap.appendChild(clone);

      var hint = document.createElement("div");
      hint.style.marginTop = "10px";
      hint.style.fontWeight = "900";
      hint.style.color = "rgba(75,85,99,.9)";
      hint.textContent = "O editor usa a mesma visualização do livro. Navegue no livro aqui fora e depois clique em Editar.";
      wrap.appendChild(hint);
    }

    function buildEditControls(){
      var root = $("editControls");
      if(!root) return;

      var ctx = currentContext();

      var html = '';
      html += '<div class="row">';
      html +=   '<span class="pill" style="background:rgba(124,58,237,.10); border:1px solid rgba(124,58,237,.16);">Contexto: <b>' +
                (ctx.view === "closed" ? "Capa (fechado)" : ("Livro aberto • folha " + ctx.spreadIndex)) +
              '</b></span>';
      html += '</div>';
      html += '<div class="row">';

      if(ctx.view === "closed"){
        html += '<button class="btn" id="btnEditTextCover" type="button">📝 Editar texto da capa</button>';
        html += '<button class="btn" id="btnEditImageCover" type="button">🖼️ Editar imagem da capa</button>';
      }else{
        html += '<button class="btn" id="btnPickPageText" type="button">📝 Editar texto (escolher página)</button>';
        html += '<button class="btn" id="btnEditImagePage" type="button">🖼️ Editar imagem (escolher página)</button>';
      }

      html += '</div>';

      root.innerHTML = html;

      // wire
      setTimeout(function(){
        // capa
        var bt = $("btnEditTextCover");
        if(bt) bt.addEventListener("click", function(){
          openTextPopup({ target:"cover" });
        });

        var bi = $("btnEditImageCover");
        if(bi) bi.addEventListener("click", function(){
          openImagePopup({ target:"cover" });
        });

        var btp = $("btnPickPageText");
        if(btp) btp.addEventListener("click", function(){
          if(currentContext().view !== "open") return;
          openPagePicker("text");
        });

        var bip = $("btnEditImagePage");
        if(bip) bip.addEventListener("click", function(){
          if(currentContext().view !== "open") return;
          openPagePicker("image");
        });

      }, 0);
    }


    function getSpreadItems(idx){
  var leftIdx = idx * 2;
  var rightIdx = leftIdx + 1;
  return {
    left: pages[leftIdx] || { kind:"blank", pageNum:null },
    right: pages[rightIdx] || { kind:"blank", pageNum:null }
  };
}

function pageNumOf(item){
  var n = item && item.pageNum;
  n = (n == null ? null : Number(n));
  return Number.isFinite(n) ? n : null;
}

    var textCtx = null;

    function openTextPopup(opts){
      var lim = countLimits();
      if(lim.textUsed >= lim.textMax){
        alert("Limite de texto atingido (" + lim.textMax + ").");
        return;
      }

      textCtx = opts || {};
      var title = $("textPopupTitle");
      var ta = $("textArea");
      var info = $("textCharInfo");
if (!ta) {
  console.warn("textArea não existe no DOM (popup de texto ainda não montado).");
  return;
}

      var ctx = currentContext();

  if(textCtx.target === "cover"){
  if(title) title.textContent = "📝 Editar texto da capa";
}
  else{
  var pn = Number(textCtx.pageNum || 0);
  if(title) title.textContent = "📝 Editar texto — Página " + pn;
}

      showModal("textPopupRoot", true);
      if (ta) ta.value = "Carregando...";
      if (info) info.textContent = "Carregando...";

      (async function(){
        try{
     var r = await fetch("/api/books/" + encodeURIComponent(bookId) + "/edit-state", {
  cache:"no-store",
  credentials:"include"
});
          var j = await r.json().catch(function(){ return {}; });
          var current = "";

          if(textCtx.target === "cover"){
  current = (j && j.text && j.text.cover) ? String(j.text.cover) : "";
} else {
  var pn2 = Number(textCtx.pageNum || 0);
  current = (j && j.text && j.text.pages && j.text.pages[String(pn2)] != null)
    ? String(j.text.pages[String(pn2)])
    : "";
}

          var last = "";
          for(var i=editDraft.textEdits.length-1;i>=0;i--){
            var e = editDraft.textEdits[i];
            if(textCtx.target === "cover" && e.target === "cover"){ last = e.text; break; }
            if (textCtx.target === "page" && e.target === "page") {
  var pn3 = Number(textCtx.pageNum || 0);
  if (pn3 && e.page === pn3) {
    last = e.text;
    break;
  }
}

          }
         if (ta) {
  ta.value = last || current || "";
  if (info) info.textContent = (ta.value.length) + " caracteres";
}

        }catch(e){
          if (ta) ta.value = "";
if (info) info.textContent = "—";

        }
      })();

      if (ta) {
  ta.oninput = function(){
    if(info) info.textContent = (ta.value.length) + " caracteres";
  };
}



      showModal("textPopupRoot", true);
    }

    function closeTextPopup(){
      showModal("textPopupRoot", false);
      textCtx = null;
    }

    var imageCtx = null;

    function openImagePopup(opts){
      var lim = countLimits();
      if(lim.imgUsed >= lim.imgMax){
        alert("Limite de imagens atingido (" + lim.imgMax + ").");
        return;
      }

      imageCtx = opts || {};
      var title = $("imagePopupTitle");
      var ta = $("imageInstr");
      var info = $("imageInstrInfo");
      var st = $("imageEditStatus");

      ta.value = "";
      if(st) st.textContent = "";

      if(imageCtx.target === "cover"){
        if(title) title.textContent = "🖼️ Editar imagem da capa";
      }      else{
        var pn = Number(imageCtx.pageNum || 0);
        if(title) title.textContent = "🖼️ Editar imagem — Página " + (pn || "?");
      }


      ta && ta.addEventListener("input", function(){
        if(info) info.textContent = (ta.value.length) + " caracteres";
      });
      if(info) info.textContent = "0 caracteres";

      showModal("imagePopupRoot", true);
    }

    function closeImagePopup(){
      showModal("imagePopupRoot", false);
      imageCtx = null;
    }


  async function saveAllEdits(){
  updateCounters();

  var c = countLimits();
  if (c.textUsed > c.textMax) { alert("Texto acima do limite."); return; }
  if (c.imgUsed > c.imgMax) { alert("Imagem acima do limite."); return; }

  try{
    var url = "/api/books/" + encodeURIComponent(bookId) + "/save-edits";

    var r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        textEdits: editDraft.textEdits || [],
        imageEdits: editDraft.imageEdits || [],
      })
    });

    var raw = await r.text();
    var j = {};
    try{ j = JSON.parse(raw); }catch(e){}

    if(!r.ok || !j.ok){
      alert((j && j.error) ? j.error : (raw || ("Falha ao salvar (HTTP " + r.status + ")")));
      return;
    }

    alert("✅ Alterações salvas!");

    editDraft.textEdits = [];
    editDraft.imageEdits = [];
    updateCounters();
    showModal("editModalRoot", false);

    location.reload();
  }catch(e){
    alert("Erro ao salvar: " + (e && e.message ? e.message : String(e)));
  }
}

    function discardDraft(){
      if(!confirm("Descartar TODAS as alterações não salvas?")) return;
      editDraft.textEdits = [];
      editDraft.imageEdits = [];
      updateCounters();
      alert("Rascunho descartado.");
    }

    function applyTextToDraft(){
      var ta = $("textArea");
      if(!ta) return;
      var txt = String(ta.value || "").trim();
      if(!txt){
        alert("Escreva um texto antes de salvar.");
        return;
      }

      if(textCtx && textCtx.target === "cover"){
        editDraft.textEdits.push({ target:"cover", text: txt });
      }
        else{
       var pn = Number(textCtx && textCtx.pageNum ? textCtx.pageNum : 0);
if(!pn){
  alert("Não consegui identificar o número da página.");
  return;
}
editDraft.textEdits.push({ target:"page", page: pn, text: txt });
 }

      updateCounters();
      closeTextPopup();
      alert("✅ Texto adicionado ao rascunho (salve no final).");
    }

    async function applyImageEditToDraft(){
      var ta = $("imageInstr");
      var st = $("imageEditStatus");
      if(!ta) return;
      var instr = String(ta.value || "").trim();
      if(instr.length < 6){
        alert("Descreva melhor a mudança (mínimo ~6 caracteres).");
        return;
      }

      var bookId = ${JSON.stringify(book?.dirId || book?.id)};

            var urlToEdit = "";

      if(imageCtx && imageCtx.target === "cover"){
        urlToEdit = (pages[1] && pages[1].url) ? String(pages[1].url) : "";
      }else{
        var pnPick = Number(imageCtx && imageCtx.pageNum ? imageCtx.pageNum : 0);
        var itemPick = pnPick ? getItemByPageNum(pnPick) : null;
        urlToEdit = (itemPick && itemPick.url) ? String(itemPick.url) : "";
      }

      if(!urlToEdit){
        alert("Não encontrei a imagem atual para editar (verifique o número da página).");
        return;
      }


      if(st) st.textContent = "⏳ Enviando pedido de edição…";

      try{
       var r = await fetch("/api/books/" + encodeURIComponent(bookId) + "/apply-image-edit", {
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  credentials:"include",
  body: JSON.stringify({
    target: (imageCtx && imageCtx.target) ? imageCtx.target : "page",
    page: (imageCtx && imageCtx.target === "page") ? Number(imageCtx.pageNum || 0) : null,
    instruction: instr,
    imageUrl: urlToEdit
  })
});
        var j = await r.json().catch(function(){ return {}; });
        if(!r.ok || !j.ok){
          if(st) st.textContent = "❌ Falha: " + (j.error || "erro");
          alert(j.error || "Falha ao aplicar mudança na imagem.");
          return;
        }

        editDraft.imageEdits.push({
          target: j.target || ((imageCtx && imageCtx.target) ? imageCtx.target : "page"),
                page: (j.page != null ? j.page : ((imageCtx && imageCtx.target === "page") ? Number(imageCtx.pageNum || 0) : null)),
          instruction: instr,
          newUrl: j.newUrl || ""
        });

        updateCounters();
        if(st) st.textContent = j.newUrl ? "✅ Imagem gerada e adicionada ao rascunho." : "✅ Pedido registrado no rascunho (backend pode processar).";
        alert("✅ Edição de imagem adicionada ao rascunho (salve no final).");
        closeImagePopup();
      }catch(e){
        if(st) st.textContent = "❌ Erro: " + (e && e.message ? e.message : String(e));
        alert("Erro ao aplicar edição: " + (e && e.message ? e.message : String(e)));
      }
    }

    function openEditor(){
      showModal("editModalRoot", true);
      cloneBookIntoModal();
      buildEditControls();
      updateCounters();
    }

    function closeEditor(){
      showModal("editModalRoot", false);
    }

    var eb = $("btnEditBook");
    if(eb) eb.addEventListener("click", function(){
      openEditor();
    });

    var cb1 = $("btnCloseEdit");
    if(cb1) cb1.addEventListener("click", closeEditor);

    var bb = $("editBackdrop");
    if(bb) bb.addEventListener("click", closeEditor);

    var tb = $("btnCloseText");
    if(tb) tb.addEventListener("click", closeTextPopup);
    var tbd = $("textBackdrop");
    if(tbd) tbd.addEventListener("click", closeTextPopup);

    var ib = $("btnCloseImage");
    if(ib) ib.addEventListener("click", closeImagePopup);
    var ibd = $("imageBackdrop");
    if(ibd) ibd.addEventListener("click", closeImagePopup);

    var apTxt = $("btnApplyText");
    if(apTxt) apTxt.addEventListener("click", applyTextToDraft);

    var apImg = $("btnApplyImageEdit");
    if(apImg) apImg.addEventListener("click", applyImageEditToDraft);

    var sv = $("btnSaveEdits");
    if(sv) sv.addEventListener("click", saveAllEdits);

    var dd = $("btnDiscardEdits");
    if(dd) dd.addEventListener("click", discardDraft);

    var rr = $("btnRefreshEdits");
    if(rr) rr.addEventListener("click", function(){ location.reload(); });

    var _origPrev = prev;
    var _origNext = next;
    prev = function(){ _origPrev(); if(!($("editModalRoot")||{}).classList?.contains("hide")) buildEditControls(); };
    next = function(){ _origNext(); if(!($("editModalRoot")||{}).classList?.contains("hide")) buildEditControls(); };

    setView("closed");
    syncClosedBookToSinglePage();
  })();
  </script>

  </body>
  </html>`;
  }


async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function clamp(n, a, b) {
  n = Number(n);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}

function wrapTextLines(text, maxCharsPerLine, maxLines) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";

  for (const w of words) {
    const next = cur ? (cur + " " + w) : w;
    if (next.length <= maxCharsPerLine) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);

  if (lines.length > maxLines) lines.length = maxLines;

  if (lines.length === maxLines) {
    const usedWords = lines.join(" ").split(/\s+/).length;
    if (usedWords < words.length) {
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+$/, "");
      if (!lines[maxLines - 1].endsWith("…")) lines[maxLines - 1] += "…";
    }
  }

  return lines;
}

function makeOverlaySvg({ width, height, text }) {
  const BASE_W = 1020;
  const scale = width / BASE_W;

  const inset = Math.round(14 * scale);
  const pad = Math.round(12 * scale);
  const radius = Math.round(16 * scale);

  const fontSize = Math.max(12, Math.round(14 * scale));
  const lineH = Math.round(fontSize * 1.25);

  const boxW = width - inset * 2;

  const maxLines = 5;
  const maxChars = Math.max(18, Math.round(boxW / (fontSize * 0.60)));
  const lines = wrapTextLines(text, maxChars, maxLines);

  const boxH = pad * 2 + lineH * lines.length;

  const boxX = inset;
  const boxY = height - inset - boxH;

  const textX = boxX + pad;
  const textY = boxY + pad + fontSize;

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const tspans = lines
    .map((ln, i) => {
      const dy = i === 0 ? 0 : lineH;
      return `<tspan x="${textX}" dy="${dy}">${esc(ln)}</tspan>`;
    })
    .join("");

  const strokeW = Math.max(1, Math.round(1 * scale));

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}"
        rx="${radius}" ry="${radius}"
        fill="rgb(255,255,255)" fill-opacity="0.92"
        stroke="rgb(221,214,254)" stroke-opacity="0.95"
        stroke-width="${strokeW}" />

  <text x="${textX}" y="${textY}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="900"
        fill="rgb(17,24,39)" fill-opacity="0.92">
    ${tspans}
  </text>
</svg>`;
}
function urlToFsPath({ OUT_DIR, url }) {

  const u = String(url || "");
  if (!u.startsWith("/output/")) return null;
  const rel = u.slice("/output/".length).replace(/^\/+/, "");
  return path.join(OUT_DIR, rel);
}
function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function makeBandOverlaySvg({ width, height, title, text }) {
  const W = Math.max(1, Number(width || 1024));
  const H = Math.max(1, Number(height || 1024));

  const bandH = Math.round(H * 0.28);

  const margin = Math.round(Math.max(10, W * 0.02));      // ~2% largura
  const padX = Math.round(Math.max(12, W * 0.02));
  const padY = Math.round(Math.max(10, H * 0.015));
  const rx = Math.round(Math.max(12, W * 0.02));

  const bandW = W - margin * 2;
  const bandX = margin;
  const bandY = H - margin - bandH;

  const titleSize = Math.round(Math.max(14, W * 0.030));  // ~3%
  const textSize  = Math.round(Math.max(12, W * 0.024));  // ~2.4%
  const lineH     = Math.round(textSize * 1.28);

  const textAreaW = bandW - padX * 2;

  const maxLines = 5;
  const maxCharsPerLine = Math.max(18, Math.floor(textAreaW / (textSize * 0.60)));
  const lines = wrapTextLines(text || "", maxCharsPerLine, maxLines);

  const titleY = bandY + padY + titleSize;
  const textStartY = titleY + Math.round(titleSize * 0.75);

  const titleSvg = title
    ? `<text x="${bandX + padX}" y="${titleY}"
        font-family="Arial, sans-serif"
        font-size="${titleSize}"
        font-weight="900"
        fill="rgb(17,24,39)" fill-opacity="0.92">${escapeXml(title)}</text>`
    : "";

  const textSvg = lines.length
    ? `<text x="${bandX + padX}" y="${textStartY + textSize}"
        font-family="Arial, sans-serif"
        font-size="${textSize}"
        font-weight="900"
        fill="rgb(17,24,39)" fill-opacity="0.92">
        ${lines
          .map((ln, i) => {
            const dy = i === 0 ? 0 : lineH;
            return `<tspan x="${bandX + padX}" dy="${dy}">${escapeXml(ln)}</tspan>`;
          })
          .join("")}
      </text>`
    : "";

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}"
        rx="${rx}" ry="${rx}"
        fill="#FFFFFF" fill-opacity="0.88" />
  ${titleSvg}
  ${textSvg}
</svg>`;
}
async function burnTextIntoImage({ srcFsPath, dstFsPath, title, text }) {
  const img = sharp(srcFsPath);
  const meta = await img.metadata();

  const width = Math.max(1, meta.width || 1020);
  const height = Math.max(1, meta.height || 797);

  const svg = makeBandOverlaySvg({ width, height, title: String(title || ""), text: String(text || "") });
  const overlay = Buffer.from(svg, "utf-8");

  await ensureDir(path.dirname(dstFsPath));

  await sharp(srcFsPath)
    .rotate()
    .ensureAlpha()
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(dstFsPath);

  if (!existsSyncSafe(dstFsPath)) {
    throw new Error("burnTextIntoImage: arquivo final não foi criado: " + dstFsPath);
  }

  return { width, height };
}
function pad2(n) {
  n = Number(n || 0);
  return String(n).padStart(2, "0");
}

function isFinalOrEdited(p) {
  const s = String(p || "").toLowerCase();
  return s.includes("final") || s.includes("/images/edited/") || s.includes("\\images\\edited\\");
}

function pickCoverBaseFs(bookDir) {
  const base = path.join(bookDir, "cover.png");
  return existsSyncSafe(base) ? base : null;
}

function pickPageBaseFs(bookDir, pageNum) {
  const p = pad2(pageNum);
  const base = path.join(bookDir, `page_${p}.png`);
  return existsSyncSafe(base) ? base : null;
}
function getCoverTitleFromManifest(m) {
  const t =
    (m?.overrides?.coverTitle != null ? String(m.overrides.coverTitle) : "") ||
    (m?.title != null ? String(m.title) : "") ||
    (m?.bookTitle != null ? String(m.bookTitle) : "") ||
    (m?.story?.title != null ? String(m.story.title) : "") ||
    (m?.story?.bookTitle != null ? String(m.story.bookTitle) : "") ||
    (m?.child?.name ? `A Aventura de ${String(m.child.name)}` : "");

  return String(t || "").trim();
}

function getPageTitleFromManifest(m, pageNum) {
  const pn = Number(pageNum || 0);
  if (!pn) return "";

  if (m?.overrides?.pagesTitle && typeof m.overrides.pagesTitle === "object") {
    const ov = m.overrides.pagesTitle[String(pn)];
    if (ov != null && String(ov).trim()) return String(ov).trim();
  }

  const sp = Array.isArray(m?.story?.pages) ? m.story.pages : null;
  if (sp && sp.length) {

    const row = sp[pn - 1];
    if (row && typeof row === "object") {
      const t =
        (row.title != null ? row.title : null) ??
        (row.heading != null ? row.heading : null) ??
        (row.pageTitle != null ? row.pageTitle : null);
      if (t != null && String(t).trim()) return String(t).trim();
    }
  }

  const mp = Array.isArray(m?.pages) ? m.pages : null;
  if (mp && mp.length) {
    const row = mp[pn - 1];
    if (row && typeof row === "object") {
      const t =
        (row.title != null ? row.title : null) ??
        (row.heading != null ? row.heading : null) ??
        (row.pageTitle != null ? row.pageTitle : null);
      if (t != null && String(t).trim()) return String(t).trim();
    }
  }

  return `Página ${pn}`;
}
module.exports = function mountBooksPage(
  app,
  { OUT_DIR, USERS_DIR, requireAuth } = {}
) {
  if (!app) throw new Error("mountBooksPage: app (express) é obrigatório");
  if (!OUT_DIR) throw new Error("mountBooksPage: OUT_DIR é obrigatório");
  if (!USERS_DIR) throw new Error("mountBooksPage: USERS_DIR é obrigatório");
  if (typeof requireAuth !== "function")
    throw new Error("mountBooksPage: requireAuth é obrigatório");

  function userBooksDirOf(userId) {
    return path.join(USERS_DIR, String(userId), "books");
  }

const GLOBAL_BOOKS_DIR = path.join(OUT_DIR, "books");

function resolveBookDir(userId, id) {
  const userDir = path.join(userBooksDirOf(userId), String(id));
  const globalDir = path.join(GLOBAL_BOOKS_DIR, String(id));

  if (existsSyncSafe(path.join(userDir, "book.json"))) return { dir: userDir, scope: "user" };
  if (existsSyncSafe(path.join(globalDir, "book.json"))) return { dir: globalDir, scope: "global" };

  return { dir: userDir, scope: "user" };
}

function editedBaseUrl(userId, id, scope) {
  if (scope === "global") return `/output/books/${encodeURIComponent(id)}/images/edited`;
  return `/output/users/${encodeURIComponent(userId)}/books/${encodeURIComponent(id)}/images/edited`;
}

  app.get("/books", requireAuth, (req, res) => {
    res.type("html").send(renderBooksHtml());
  });

  app.get("/api/books", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || "";
      if (!userId) {
        return res.status(401).json({ ok: false, error: "not_logged_in" });
      }

     const USER_BOOKS_DIR = userBooksDirOf(userId);
const GLOBAL_DIR = GLOBAL_BOOKS_DIR;

const userItems = await listBooks({
  BOOKS_DIR: USER_BOOKS_DIR,
  OUT_DIR: path.join(USER_BOOKS_DIR, "__unused__"),
});

const globalItems = await listBooks({
  BOOKS_DIR: GLOBAL_DIR,
  OUT_DIR: path.join(GLOBAL_DIR, "__unused__"),
});

const byDir = new Map();
for (const b of globalItems) byDir.set(String(b.dirId || b.id), b);
for (const b of userItems) byDir.set(String(b.dirId || b.id), b);

const items = Array.from(byDir.values());
      const mapped = items.map((b) => {
        const dirId = String(b.dirId || b.id);
const userPdfFsPath = path.join(USERS_DIR, userId, "books", dirId, `book-${dirId}.pdf`);

const globalPdf1 = path.join(OUT_DIR, "books", `${dirId}.pdf`);
const globalPdf2 = path.join(OUT_DIR, "books", dirId, `book-${dirId}.pdf`);

const hasPdf =
  String(b.status || "") === "done" &&
  (existsSyncSafe(userPdfFsPath) || existsSyncSafe(globalPdf1) || existsSyncSafe(globalPdf2));
        return {
          ...b,
          dirId, 
          hasPdf,
          pdfUrl: hasPdf ? `/download/${encodeURIComponent(dirId)}` : "",

          updatedAt: b.updatedAt ? fmtDateBR(b.updatedAt) : "",
          createdAt: b.createdAt ? fmtDateBR(b.createdAt) : "",
        };
      });

      res.setHeader("Cache-Control", "no-store");
      return res.json({ ok: true, count: mapped.length, books: mapped });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  app.get("/api/books/:id/edit-state", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user && req.user.id ? req.user.id : "");
      const id = String(req.params && req.params.id ? req.params.id : "").trim();
      if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });
      if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
        return res.status(400).json({ ok: false, error: "id inválido" });
      }

     const resolved = resolveBookDir(userId, id);
const manifestPath = path.join(resolved.dir, "book.json");
if (!existsSyncSafe(manifestPath)) return res.status(404).json({ ok: false, error: "book não existe" });

const m = await readJson(manifestPath);
let coverText =

  (m?.overrides?.coverText != null ? String(m.overrides.coverText) : "") ||

  (m?.cover?.text != null ? String(m.cover.text) : "") ||
  (m?.cover?.pageText != null ? String(m.cover.pageText) : "") ||
  (m?.cover?.caption != null ? String(m.cover.caption) : "") ||
  (m?.cover?.overlayText != null ? String(m.cover.overlayText) : "") ||

  (m?.coverText != null ? String(m.coverText) : "") ||
  (m?.cover_page_text != null ? String(m.cover_page_text) : "") ||

  (m?.title != null ? String(m.title) : "") ||
  (m?.bookTitle != null ? String(m.bookTitle) : "") ||
  (m?.story?.title != null ? String(m.story.title) : "") ||
  (m?.story?.bookTitle != null ? String(m.story.bookTitle) : "") ||
  "";

if (!coverText) {
  const sp = (m?.story?.pages && Array.isArray(m.story.pages)) ? m.story.pages : null;
  if (sp && sp.length) {
    const first = sp[0];
    if (typeof first === "string") coverText = first;
    else if (first && typeof first === "object") {
      const t =
        (first.text != null ? first.text : null) ??
        (first.pageText != null ? first.pageText : null) ??
        (first.content != null ? first.content : null);
      if (t != null) coverText = String(t);
    }
  }
}

coverText = String(coverText || "").trim();

      const pages = {};

      function setPageText(p, t) {
        const pn = Number(p || 0);
        if (!pn) return;
        const txt = (t == null ? "" : String(t)).trim();
        if (!txt) return;
        pages[String(pn)] = txt;
      }

      if (m?.overrides?.pagesText && typeof m.overrides.pagesText === "object") {
        for (const [k, v] of Object.entries(m.overrides.pagesText)) {
          setPageText(k, v);
        }
      }

      if (Array.isArray(m?.images)) {
        for (const it of m.images) {
          const p = Number(it?.page || 0);
          if (!p) continue;


          if (pages[String(p)]) continue;

          const t =
            (it?.text != null ? it.text : null) ??
            (it?.pageText != null ? it.pageText : null) ??
            (it?.caption != null ? it.caption : null);

          setPageText(p, t);
        }
      }

      const storyPages =
        (m?.story?.pages && Array.isArray(m.story.pages) ? m.story.pages : null) ||
        (m?.pages && Array.isArray(m.pages) ? m.pages : null) ||
        (m?.storyPages && Array.isArray(m.storyPages) ? m.storyPages : null) ||
        null;

      if (storyPages) {
        for (let i = 0; i < storyPages.length; i++) {
          const row = storyPages[i];

          if (typeof row === "string") {
            const pn = i + 1;
            if (pages[String(pn)]) continue;
            setPageText(pn, row);
            continue;
          }

          if (row && typeof row === "object") {
            const pn = Number(row.page || row.pageNum || (i + 1));
            if (!pn) continue;
            if (pages[String(pn)]) continue;

            const t =
              (row.text != null ? row.text : null) ??
              (row.pageText != null ? row.pageText : null) ??
              (row.content != null ? row.content : null);

            setPageText(pn, t);
          }
        }
      }

      return res.json({
        ok: true,
        text: {
          cover: coverText,
          pages,
        },
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });


  app.post("/api/books/:id/save-edits", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user && req.user.id ? req.user.id : "");
      const id = String(req.params && req.params.id ? req.params.id : "").trim();
      if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });
      if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
        return res.status(400).json({ ok: false, error: "id inválido" });
      }

      const textEdits = Array.isArray(req.body?.textEdits) ? req.body.textEdits : [];
      const imageEdits = Array.isArray(req.body?.imageEdits) ? req.body.imageEdits : [];

      if (textEdits.length > 10) return res.status(400).json({ ok: false, error: "limite texto = 10" });
      if (imageEdits.length > 5) return res.status(400).json({ ok: false, error: "limite imagem = 5" });

      const resolved = resolveBookDir(userId, id);
const manifestPath = path.join(resolved.dir, "book.json");
if (!existsSyncSafe(manifestPath)) return res.status(404).json({ ok: false, error: "book não existe" });

const m = await readJson(manifestPath);

const bookDir = resolved.dir;

let editedDirFs, editedDirUrl;

if (resolved.scope === "global") {

  editedDirFs  = path.join(OUT_DIR, "books", String(id), "images", "edited");
  editedDirUrl = `/output/books/${encodeURIComponent(id)}/images/edited`;
} else {

  editedDirFs  = path.join(OUT_DIR, "users", String(userId), "books", String(id), "images", "edited");
  editedDirUrl = `/output/users/${encodeURIComponent(userId)}/books/${encodeURIComponent(id)}/images/edited`;
}

      function currentCoverUrl() {
        return (m?.overrides?.coverUrl ? String(m.overrides.coverUrl) :
          (m?.cover?.url ? String(m.cover.url) :
            (m?.coverUrl ? String(m.coverUrl) : "")));
      }

      function currentPageUrl(p) {
        const key = String(p);
        if (m?.overrides?.pagesImageUrl && m.overrides.pagesImageUrl[key]) {
          return String(m.overrides.pagesImageUrl[key]);
        }
        if (Array.isArray(m?.images)) {
          const it = m.images.find(x => Number(x?.page || 0) === Number(p));
          if (it && it.url) return String(it.url);
        }
        return "";
      }

      if (!m.overrides) m.overrides = {};
      if (!m.overrides.pagesText) m.overrides.pagesText = {};
      if (!m.overrides.pagesImageUrl) m.overrides.pagesImageUrl = {};

for (const e of textEdits) {
  const target = String(e?.target || "");
  const text = String(e?.text || "").trim();
  if (!text) continue;

  if (target === "cover") {

    m.overrides.coverText = text;

    const srcUrl = currentCoverUrl();

    let srcFs = urlToFsPath({ OUT_DIR, url: srcUrl });

    if (!srcFs || !existsSyncSafe(srcFs)) {
      const fb = pickCoverBaseFs(bookDir);
      if (fb) srcFs = fb;
    }

    if (srcFs && existsSyncSafe(srcFs)) {
      const fileName = `cover-${Date.now()}.png`;
      const dstFs = path.join(editedDirFs, fileName);
     const coverTitle = getCoverTitleFromManifest(m);
await burnTextIntoImage({ srcFsPath: srcFs, dstFsPath: dstFs, title: coverTitle, text });

      m.overrides.coverUrl = `${editedDirUrl}/${encodeURIComponent(fileName)}`;
    }

    continue;
  }

  if (target === "page") {
    const p = clampInt(e?.page, 1, 9999);

    m.overrides.pagesText[String(p)] = text;

    const srcUrl = currentPageUrl(p);

    let srcFs = pickPageBaseFs(bookDir, p);

    if ((!srcFs || !existsSyncSafe(srcFs)) && srcUrl && !isFinalOrEdited(srcUrl)) {
      const byUrl = urlToFsPath({ OUT_DIR, url: srcUrl });
      if (byUrl && existsSyncSafe(byUrl) && !isFinalOrEdited(byUrl)) srcFs = byUrl;
    }

    if (!srcFs || !existsSyncSafe(srcFs)) {
      return res.status(400).json({
        ok: false,
        error: `Imagem base da página ${p} não encontrada (esperado: page_${pad2(p)}.png).`
      });
    }

    const fileName = `page-${pad2(p)}-${Date.now()}.png`;
    const dstFs = path.join(editedDirFs, fileName);
    const pageTitle = getPageTitleFromManifest(m, p);
await burnTextIntoImage({ srcFsPath: srcFs, dstFsPath: dstFs, title: pageTitle, text });

    m.overrides.pagesImageUrl[String(p)] = `${editedDirUrl}/${encodeURIComponent(fileName)}`;

    continue;
  }
}

      for (const e of imageEdits) {
        const target = String(e?.target || "");
        const newUrl = String(e?.newUrl || "").trim();
        if (!newUrl) continue;

        if (target === "cover") {
          m.overrides.coverUrl = newUrl;
        } else if (target === "page") {
          const p = clampInt(e?.page, 1, 9999);
          m.overrides.pagesImageUrl[String(p)] = newUrl;
        }
      }

      if (!Array.isArray(m.editsLog)) m.editsLog = [];
      m.editsLog.push({
        at: nowIso(),
        userId,
        textEdits: textEdits.map(x => ({ target: x?.target, page: x?.page, size: String(x?.text||"").length })),
        imageEdits: imageEdits.map(x => ({ target: x?.target, page: x?.page, hasNewUrl: !!x?.newUrl }))
      });

      m.updatedAt = nowIso();

      await writeJson(manifestPath, m);

      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  app.post("/api/books/:id/apply-image-edit", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user && req.user.id ? req.user.id : "");
      const id = String(req.params && req.params.id ? req.params.id : "").trim();
      if (!userId) return res.status(401).json({ ok: false, error: "not_logged_in" });
      if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
        return res.status(400).json({ ok: false, error: "id inválido" });
      }

      const target = String(req.body?.target || "page");
      const page = req.body?.page == null ? null : clampInt(req.body.page, 1, 9999);
      const instruction = String(req.body?.instruction || "").trim();
      const imageUrl = String(req.body?.imageUrl || "").trim();

      if (!instruction || instruction.length < 6) {
        return res.status(400).json({ ok: false, error: "instruction muito curta" });
      }
      if (!imageUrl) {
        return res.status(400).json({ ok: false, error: "imageUrl ausente" });
      }

    const resolved = resolveBookDir(userId, id);
const manifestPath = path.join(resolved.dir, "book.json");
if (!existsSyncSafe(manifestPath)) return res.status(404).json({ ok: false, error: "book não existe" });

const m = await readJson(manifestPath);
      if (!Array.isArray(m.imageEditRequests)) m.imageEditRequests = [];

      const reqId = "imgedit_" + Date.now() + "_" + Math.random().toString(16).slice(2);
      const entry = {
        id: reqId,
        at: nowIso(),
        target,
        page,
        instruction,
        imageUrl,
        status: "queued" // ou "done"
      };

      m.imageEditRequests.push(entry);
      m.updatedAt = nowIso();
      await writeJson(manifestPath, m);

  
      return res.json({
        ok: true,
        requestId: reqId,
        target,
        page,
        newUrl: ""
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e || "Erro") });
    }
  });

  // Preview
  app.get("/books/:id", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user && req.user.id ? req.user.id : "");
      if (!userId) {
        return res.redirect(
          `/login?next=${encodeURIComponent(req.originalUrl || "/books")}`
        );
      }

      const id = String(req.params && req.params.id ? req.params.id : "").trim();
      if (!id) return res.status(400).send("id ausente");

      // 🔐 evita path traversal
      if (id.includes("..") || id.includes("/") || id.includes("\\")) {
        return res.status(400).send("id inválido");
      }

      const resolved = resolveBookDir(userId, id);

const BOOKS_PARENT = path.dirname(resolved.dir);

const book = await loadBookById({
  BOOKS_DIR: BOOKS_PARENT,
  OUT_DIR: path.join(BOOKS_PARENT, "__unused__"),
  id,
});

if (!book) return res.status(404).send("book não existe");
const userPdfFs = path.join(USERS_DIR, userId, "books", id, `book-${id}.pdf`);
const globalPdf1 = path.join(OUT_DIR, "books", `${id}.pdf`);
const globalPdf2 = path.join(OUT_DIR, "books", id, `book-${id}.pdf`);

book.hasPdf =
  String(book.status || "") === "done" &&
  (existsSyncSafe(userPdfFs) || existsSyncSafe(globalPdf1) || existsSyncSafe(globalPdf2));
      book.pdfUrl = book.hasPdf ? `/download/${encodeURIComponent(id)}` : "";

      res.type("html").send(renderBookPreviewHtml(book));
    } catch (e) {
      console.error("❌ Erro /books/:id", e);
      return res.status(500).send(String(e?.message || e || "Erro"));
    }
  });
};
