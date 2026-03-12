/**
 * profile.page.assets.js
 *
 * Assets da página /profile:
 * - CSS completo da tela
 * - JS completo da tela
 */

"use strict";

module.exports = {
  PROFILE_PAGE_CSS,
  buildProfilePageJS,
};

function PROFILE_PAGE_CSS() {
  return `
  :root{
    --bg:#f6f2ff;
    --bg2:#fffaf7;
    --card:#ffffff;
    --card-soft:#fcfbff;
    --ink:#101828;
    --muted:#667085;
    --muted-2:#475467;
    --line:rgba(15,23,42,.08);

    --violet-50:#f6f2ff;
    --violet-100:#efe6ff;
    --violet-200:#dfc7ff;
    --violet-500:#8b5cf6;
    --violet-600:#7c3aed;
    --violet-700:#6d28d9;

    --pink-50:#fff1f7;
    --pink-100:#ffe2ef;
    --pink-500:#ec4899;
    --pink-600:#db2777;

    --blue-50:#eef6ff;
    --blue-100:#d9ebff;
    --blue-500:#3b82f6;
    --blue-600:#2563eb;

    --green-50:#ecfdf3;
    --green-100:#d7f8e5;
    --green-500:#22c55e;
    --green-600:#16a34a;

    --amber-50:#fff9eb;
    --amber-100:#ffefbf;
    --amber-500:#f59e0b;
    --amber-600:#d97706;

    --red-50:#fff3f2;
    --red-100:#ffe2e0;
    --red-500:#ef4444;
    --red-600:#dc2626;

    --shadow-1:0 10px 28px rgba(17,24,39,.06);
    --shadow-2:0 18px 50px rgba(17,24,39,.10);
    --shadow-3:0 32px 90px rgba(17,24,39,.14);

    --radius-sm:12px;
    --radius-md:18px;
    --radius-lg:24px;
    --radius-xl:32px;

    --max:1240px;
  }

  *{ box-sizing:border-box; }
  html{ scroll-behavior:smooth; }
  body{
    margin:0;
    min-height:100%;
    font-family:Inter, Roboto, "Segoe UI", Arial, sans-serif;
    color:var(--ink);
    background:
      radial-gradient(1200px 520px at 0% -10%, rgba(124,58,237,.14), transparent 55%),
      radial-gradient(900px 520px at 100% 0%, rgba(236,72,153,.10), transparent 52%),
      radial-gradient(700px 300px at 50% 100%, rgba(59,130,246,.08), transparent 55%),
      linear-gradient(180deg, var(--bg) 0%, #ffffff 42%, var(--bg2) 100%);
  }

  a{ color:inherit; text-decoration:none; }
  button, input{ font:inherit; }

  .wrap{
    width:min(calc(100% - 24px), var(--max));
    margin:0 auto;
  }

  .topbar{
    position:sticky;
    top:0;
    z-index:40;
    backdrop-filter:blur(16px);
    background:rgba(255,255,255,.72);
    border-bottom:1px solid rgba(255,255,255,.8);
    box-shadow:0 12px 28px rgba(17,24,39,.05);
  }

  .topbarInner{
    width:min(calc(100% - 24px), var(--max));
    margin:0 auto;
    min-height:76px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    padding:10px 0;
    flex-wrap:wrap;
  }

  .brand{
    display:flex;
    align-items:center;
    gap:12px;
    min-width:0;
  }

  .brandMark{
    width:46px;
    height:46px;
    border-radius:15px;
    display:grid;
    place-items:center;
    color:#fff;
    background:linear-gradient(135deg, var(--violet-600), var(--pink-600));
    box-shadow:0 18px 36px rgba(124,58,237,.24);
    font-size:21px;
  }

  .brandTitle{
    margin:0;
    font-size:18px;
    line-height:1.1;
    font-weight:1000;
    letter-spacing:-.02em;
  }

  .brandSub{
    margin-top:4px;
    color:var(--muted);
    font-size:13px;
    line-height:1.5;
    font-weight:800;
  }

  .topActions{
    display:flex;
    align-items:center;
    gap:10px;
    flex-wrap:wrap;
  }

  .chip{
    display:inline-flex;
    align-items:center;
    gap:8px;
    min-height:42px;
    padding:10px 14px;
    border-radius:999px;
    background:rgba(255,255,255,.92);
    border:1px solid rgba(15,23,42,.06);
    box-shadow:var(--shadow-1);
    color:var(--muted-2);
    font-weight:800;
  }

  .btn{
    appearance:none;
    border:none;
    min-height:48px;
    padding:12px 16px;
    border-radius:15px;
    cursor:pointer;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:10px;
    font-weight:900;
    transition:transform .16s ease, box-shadow .16s ease, filter .16s ease, background .16s ease, border-color .16s ease, opacity .16s ease;
    user-select:none;
  }
  .btn:hover{
    transform:translateY(-2px);
    box-shadow:var(--shadow-2);
  }
  .btn:active{
    transform:translateY(1px) scale(.99);
  }
  .btn:disabled{
    opacity:.72;
    cursor:not-allowed;
    transform:none;
  }

  .btnPrimary{
    color:#fff;
    background:linear-gradient(90deg, var(--violet-600), var(--pink-600));
    box-shadow:0 16px 40px rgba(124,58,237,.24);
  }

  .btnSuccess{
    color:#fff;
    background:linear-gradient(90deg, #10b981, #22c55e);
    box-shadow:0 16px 40px rgba(34,197,94,.24);
  }

  .btnInfo{
    color:#fff;
    background:linear-gradient(90deg, #2563eb, #7c3aed);
    box-shadow:0 16px 40px rgba(37,99,235,.24);
  }

  .btnSoft{
    color:var(--ink);
    background:#fff;
    border:1px solid rgba(15,23,42,.08);
    box-shadow:var(--shadow-1);
  }

  .btnDanger{
    color:#fff;
    background:linear-gradient(90deg, #ef4444, #f97316);
    box-shadow:0 16px 38px rgba(239,68,68,.22);
  }

  .hero{
    padding:28px 0 20px;
  }

  .heroGrid{
    display:grid;
    grid-template-columns:1.2fr .8fr;
    gap:20px;
  }

  .heroMain,
  .heroSide{
    border-radius:var(--radius-xl);
    overflow:hidden;
    box-shadow:var(--shadow-3);
    border:1px solid rgba(255,255,255,.86);
  }

  .heroMain{
    padding:30px;
    background:
      radial-gradient(circle at top left, rgba(124,58,237,.18), transparent 30%),
      radial-gradient(circle at 100% 0%, rgba(236,72,153,.12), transparent 28%),
      linear-gradient(145deg, #ffffff 0%, #fbf8ff 55%, #fff4fb 100%);
  }

  .heroSide{
    padding:22px;
    background:
      radial-gradient(circle at top right, rgba(59,130,246,.12), transparent 28%),
      linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,255,.96));
  }

  .eyebrow{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:8px 12px;
    border-radius:999px;
    background:var(--violet-50);
    border:1px solid rgba(124,58,237,.10);
    color:#5b21b6;
    font-size:12px;
    font-weight:1000;
    text-transform:uppercase;
    letter-spacing:.06em;
  }

  .heroTitle{
    margin:18px 0 0;
    font-size:clamp(2.1rem, 4vw, 3.8rem);
    line-height:1.02;
    letter-spacing:-.045em;
    font-weight:1000;
    max-width:780px;
  }

  .heroText{
    margin-top:16px;
    max-width:720px;
    color:var(--muted-2);
    font-size:1rem;
    line-height:1.75;
    font-weight:700;
  }

  .heroActions{
    display:flex;
    gap:12px;
    flex-wrap:wrap;
    margin-top:24px;
  }

  .heroStats{
    display:grid;
    grid-template-columns:repeat(3, minmax(0, 1fr));
    gap:14px;
    margin-top:26px;
  }

  .stat{
    border-radius:22px;
    padding:18px;
    min-width:0;
    color:#fff;
    position:relative;
    overflow:hidden;
    box-shadow:0 18px 36px rgba(17,24,39,.10);
  }

  .stat::before{
    content:"";
    position:absolute;
    inset:auto -30px -30px auto;
    width:120px;
    height:120px;
    border-radius:999px;
    background:rgba(255,255,255,.10);
    filter:blur(4px);
  }

  .stat.wallet{
    background:linear-gradient(135deg, #7c3aed, #a855f7);
  }

  .stat.level{
    background:linear-gradient(135deg, #2563eb, #7c3aed);
  }

  .stat.checkin{
    background:linear-gradient(135deg, #ec4899, #f97316);
  }

  .statLabel{
    color:rgba(255,255,255,.85);
    font-size:13px;
    font-weight:900;
    line-height:1.5;
  }

  .statValue{
    margin-top:10px;
    font-size:clamp(1.45rem, 2.3vw, 2rem);
    line-height:1.05;
    letter-spacing:-.03em;
    font-weight:1000;
    color:#fff;
    word-break:break-word;
  }

  .statSub{
    margin-top:8px;
    color:rgba(255,255,255,.88);
    font-size:13px;
    line-height:1.6;
    font-weight:700;
  }

  .profileCard{
    display:grid;
    gap:18px;
  }

  .profileTop{
    display:flex;
    align-items:center;
    gap:14px;
    min-width:0;
  }

  .avatar{
    width:74px;
    height:74px;
    flex:0 0 74px;
    border-radius:22px;
    display:grid;
    place-items:center;
    background:linear-gradient(135deg, var(--violet-600), var(--pink-600));
    color:#fff;
    font-size:24px;
    font-weight:1000;
    box-shadow:0 18px 34px rgba(124,58,237,.22);
  }

  .profileName{
    margin:0;
    font-size:25px;
    line-height:1.1;
    letter-spacing:-.02em;
    font-weight:1000;
    word-break:break-word;
  }

  .profileMail{
    margin-top:8px;
    color:var(--muted);
    line-height:1.55;
    font-weight:700;
    word-break:break-all;
  }

  .badgeRow{
    display:flex;
    gap:8px;
    flex-wrap:wrap;
  }

  .badge{
    display:inline-flex;
    align-items:center;
    gap:8px;
    min-height:34px;
    padding:7px 12px;
    border-radius:999px;
    font-size:12px;
    font-weight:900;
    border:1px solid rgba(15,23,42,.06);
    background:#f8fafc;
    color:#334155;
  }

  .badge.violet{ background:var(--violet-50); color:#5b21b6; border-color:rgba(124,58,237,.14); }
  .badge.green{ background:var(--green-50); color:#166534; border-color:rgba(22,163,74,.16); }
  .badge.blue{ background:var(--blue-50); color:#1d4ed8; border-color:rgba(37,99,235,.16); }
  .badge.amber{ background:var(--amber-50); color:#92400e; border-color:rgba(217,119,6,.16); }
  .badge.red{ background:var(--red-50); color:#991b1b; border-color:rgba(220,38,38,.16); }

  .progressCard{
    background:#fff;
    border:1px solid rgba(15,23,42,.06);
    border-radius:22px;
    padding:16px;
    box-shadow:var(--shadow-1);
  }

  .progressTop{
    display:flex;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
    align-items:flex-start;
  }

  .progressTitle{
    color:var(--ink);
    font-weight:1000;
    line-height:1.45;
  }

  .progressText{
    margin-top:4px;
    color:var(--muted);
    font-size:13px;
    line-height:1.6;
    font-weight:700;
  }

  .bar{
    margin-top:12px;
    height:12px;
    width:100%;
    background:#edf2f7;
    border-radius:999px;
    overflow:hidden;
    border:1px solid rgba(15,23,42,.06);
  }

  .bar > div{
    width:0%;
    height:100%;
    border-radius:999px;
    background:linear-gradient(90deg, var(--blue-600), var(--violet-600), var(--pink-500));
    transition:width .3s ease;
  }

  .section{
    padding:10px 0 20px;
  }

  .sectionCard{
    background:rgba(255,255,255,.90);
    border:1px solid rgba(255,255,255,.92);
    border-radius:var(--radius-xl);
    box-shadow:var(--shadow-2);
    padding:24px;
  }

  .sectionHead{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:16px;
    flex-wrap:wrap;
    margin-bottom:18px;
  }

  .sectionTitle{
    margin:10px 0 0;
    font-size:clamp(1.7rem, 3vw, 2.45rem);
    line-height:1.05;
    letter-spacing:-.03em;
    font-weight:1000;
  }

  .sectionText{
    margin-top:10px;
    max-width:820px;
    color:var(--muted-2);
    line-height:1.75;
    font-weight:700;
  }

  .tabs{
    position:sticky;
    top:86px;
    z-index:30;
    padding:4px 0 16px;
  }

  .tabsInner{
    display:flex;
    gap:10px;
    overflow:auto hidden;
    padding:10px;
    border-radius:999px;
    background:rgba(255,255,255,.78);
    backdrop-filter:blur(12px);
    border:1px solid rgba(255,255,255,.9);
    box-shadow:var(--shadow-1);
    scrollbar-width:none;
  }

  .tabsInner::-webkit-scrollbar{ display:none; }

  .tab{
    border:none;
    background:#fff;
    color:#475569;
    border-radius:999px;
    min-height:44px;
    padding:10px 16px;
    box-shadow:var(--shadow-1);
    border:1px solid rgba(15,23,42,.06);
    font-weight:900;
    cursor:pointer;
    white-space:nowrap;
    transition:all .14s ease;
  }
  .tab:hover{ transform:translateY(-1px); }
  .tab.active{
    color:#fff;
    background:linear-gradient(90deg, var(--violet-600), var(--pink-600));
    border-color:transparent;
    box-shadow:0 14px 30px rgba(124,58,237,.18);
  }

  .summaryGrid{
    display:grid;
    grid-template-columns:repeat(4, minmax(0, 1fr));
    gap:14px;
  }

  .miniCard{
    border-radius:22px;
    box-shadow:var(--shadow-1);
    padding:18px;
    min-width:0;
    position:relative;
    overflow:hidden;
    border:1px solid rgba(15,23,42,.06);
  }

  .miniCard.neutral{
    background:#fff;
  }

  .miniCard.purple{
    background:linear-gradient(135deg, #7c3aed, #a855f7);
    color:#fff;
    border:none;
  }

  .miniCard.blue{
    background:linear-gradient(135deg, #2563eb, #60a5fa);
    color:#fff;
    border:none;
  }

  .miniCard.pink{
    background:linear-gradient(135deg, #db2777, #f472b6);
    color:#fff;
    border:none;
  }

  .miniCard.amber{
    background:linear-gradient(135deg, #f59e0b, #f97316);
    color:#fff;
    border:none;
  }

  .miniCard::after{
    content:"";
    position:absolute;
    right:-24px;
    bottom:-24px;
    width:100px;
    height:100px;
    border-radius:999px;
    background:rgba(255,255,255,.10);
  }

  .miniCardLabel{
    color:inherit;
    opacity:.92;
    font-size:13px;
    font-weight:900;
    line-height:1.5;
  }

  .miniCardValue{
    margin-top:10px;
    font-size:1.8rem;
    line-height:1.05;
    font-weight:1000;
    letter-spacing:-.03em;
    word-break:break-word;
    color:inherit;
  }

  .miniCardSub{
    margin-top:8px;
    color:inherit;
    opacity:.92;
    font-size:13px;
    line-height:1.65;
    font-weight:700;
  }

  .twoCols{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:16px;
    margin-top:18px;
  }

  .threeCols{
    display:grid;
    grid-template-columns:repeat(3, minmax(0, 1fr));
    gap:16px;
    margin-top:18px;
  }

  .panel{
    background:#fff;
    border:1px solid rgba(15,23,42,.06);
    border-radius:24px;
    box-shadow:var(--shadow-1);
    padding:20px;
    min-width:0;
  }

  .panel.softPurple{
    background:
      radial-gradient(circle at top left, rgba(124,58,237,.10), transparent 28%),
      linear-gradient(180deg, #ffffff, #fbf8ff);
  }

  .panel.softBlue{
    background:
      radial-gradient(circle at top left, rgba(37,99,235,.10), transparent 28%),
      linear-gradient(180deg, #ffffff, #f7fbff);
  }

  .panel.softPink{
    background:
      radial-gradient(circle at top left, rgba(219,39,119,.10), transparent 28%),
      linear-gradient(180deg, #ffffff, #fff8fc);
  }

  .panel.softGreen{
    background:
      radial-gradient(circle at top left, rgba(34,197,94,.10), transparent 28%),
      linear-gradient(180deg, #ffffff, #f8fffb);
  }

  .panelTitle{
    margin:0;
    font-size:20px;
    line-height:1.2;
    font-weight:1000;
    letter-spacing:-.02em;
  }

  .muted{
    color:var(--muted-2);
    line-height:1.75;
    font-weight:700;
  }

  .actionRow{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    margin-top:16px;
  }

  .linkBtn{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:10px;
    min-height:46px;
    padding:10px 14px;
    border-radius:15px;
    background:#fff;
    border:1px solid rgba(15,23,42,.08);
    box-shadow:var(--shadow-1);
    font-weight:900;
    transition:transform .14s ease, box-shadow .14s ease;
  }

  .linkBtn:hover{
    transform:translateY(-1px);
    box-shadow:var(--shadow-2);
  }

  .linkBtn.primaryLink{
    color:#fff;
    border:none;
    background:linear-gradient(90deg, var(--violet-600), var(--pink-600));
  }

  .linkBtn.infoLink{
    color:#fff;
    border:none;
    background:linear-gradient(90deg, #2563eb, #7c3aed);
  }

  .walletShell{
    display:grid;
    grid-template-columns:1.15fr .85fr;
    gap:16px;
  }

  .walletMain,
  .walletSide{
    min-width:0;
    border-radius:24px;
    box-shadow:var(--shadow-1);
    padding:20px;
    border:1px solid rgba(15,23,42,.06);
  }

  .walletMain{
    background:
      radial-gradient(circle at top left, rgba(124,58,237,.12), transparent 28%),
      radial-gradient(circle at top right, rgba(236,72,153,.08), transparent 22%),
      linear-gradient(180deg, #fff, #faf7ff);
  }

  .walletSide{
    background:
      radial-gradient(circle at top left, rgba(37,99,235,.10), transparent 26%),
      linear-gradient(180deg, #fff, #f7fbff);
  }

  .walletHead{
    display:flex;
    justify-content:space-between;
    gap:14px;
    flex-wrap:wrap;
    align-items:flex-start;
  }

  .walletActions{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    margin-top:18px;
  }

  .weekTrack{
    display:grid;
    grid-template-columns:repeat(7, 1fr);
    gap:10px;
    margin-top:18px;
  }

  .dayDot{
    min-height:58px;
    border-radius:18px;
    display:grid;
    place-items:center;
    background:#fff;
    border:1px solid rgba(15,23,42,.08);
    color:#475569;
    font-weight:1000;
    box-shadow:0 8px 20px rgba(17,24,39,.04);
    transition:transform .16s ease, box-shadow .16s ease, background .16s ease, color .16s ease;
  }

  .dayDot.done{
    background:linear-gradient(135deg, #7c3aed, #ec4899);
    color:#fff;
    border-color:transparent;
    box-shadow:0 16px 34px rgba(124,58,237,.22);
  }

  .dayDot.current{
    background:linear-gradient(135deg, #f59e0b, #f97316);
    color:#fff;
    border-color:transparent;
    box-shadow:0 16px 34px rgba(245,158,11,.20);
  }

  .tierGrid{
    display:grid;
    grid-template-columns:repeat(3, minmax(0, 1fr));
    gap:12px;
    margin-top:16px;
  }

  .tier{
    border-radius:18px;
    padding:16px;
    background:#fff;
    border:1px solid rgba(15,23,42,.06);
    box-shadow:var(--shadow-1);
    min-width:0;
    transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease;
  }

  .tier.current{
    color:#fff;
    border:none;
    transform:translateY(-2px);
  }

  #tier-bronze.current{
    background:linear-gradient(135deg, #b45309, #f59e0b);
    box-shadow:0 20px 38px rgba(245,158,11,.22);
  }

  #tier-prata.current{
    background:linear-gradient(135deg, #2563eb, #7c3aed);
    box-shadow:0 20px 38px rgba(37,99,235,.22);
  }

  #tier-ouro.current{
    background:linear-gradient(135deg, #db2777, #7c3aed);
    box-shadow:0 20px 38px rgba(219,39,119,.22);
  }

  .tierTitle{
    font-weight:1000;
    color:inherit;
  }

  .tierText{
    margin-top:8px;
    color:inherit;
    opacity:.94;
    font-size:13px;
    line-height:1.6;
    font-weight:700;
  }

  .resumeList{
    display:grid;
    gap:10px;
    margin-top:14px;
  }

  .resumeItem{
    display:flex;
    justify-content:space-between;
    gap:12px;
    align-items:flex-start;
    flex-wrap:wrap;
    padding:14px 16px;
    border-radius:16px;
    background:#fff;
    border:1px solid rgba(15,23,42,.06);
  }

  .resumeItem span{
    color:var(--muted);
    font-weight:800;
    line-height:1.5;
  }

  .resumeItem b{
    color:var(--ink);
    font-weight:1000;
    line-height:1.5;
    word-break:break-word;
  }

  .resumeItem.total{
    background:linear-gradient(135deg, #7c3aed, #ec4899);
    border:none;
  }

  .resumeItem.total span,
  .resumeItem.total b{
    color:#fff;
  }

  .activityList{
    display:grid;
    gap:12px;
    margin-top:16px;
  }

  .activityItem{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:14px;
    padding:14px 16px;
    border-radius:18px;
    background:#fff;
    border:1px solid rgba(15,23,42,.06);
    box-shadow:var(--shadow-1);
  }

  .activityItem strong{
    display:block;
    font-weight:1000;
    color:var(--ink);
    line-height:1.5;
  }

  .activityItem small{
    display:block;
    margin-top:4px;
    color:var(--muted);
    line-height:1.5;
    font-weight:700;
  }

  .activityValue{
    white-space:nowrap;
    font-weight:1000;
    color:var(--ink);
  }

  .empty{
    padding:18px;
    border-radius:16px;
    border:1px dashed rgba(15,23,42,.16);
    color:var(--muted);
    background:#fff;
    font-weight:800;
  }

  .listTools{
    display:flex;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
    align-items:center;
    margin-bottom:16px;
  }

  .listCount{
    color:var(--muted-2);
    font-weight:800;
    line-height:1.6;
  }

  .grid{
    display:grid;
    gap:14px;
  }

  .item{
    background:#fff;
    border:1px solid rgba(15,23,42,.06);
    border-radius:22px;
    box-shadow:var(--shadow-1);
    padding:18px;
    transition:transform .16s ease, box-shadow .16s ease;
  }

  .item:hover{
    transform:translateY(-2px);
    box-shadow:var(--shadow-2);
  }

  .item.bookItem{
    background:
      radial-gradient(circle at top right, rgba(124,58,237,.09), transparent 24%),
      linear-gradient(180deg, #fff, #fbf8ff);
  }

  .item.orderItem{
    background:
      radial-gradient(circle at top right, rgba(37,99,235,.09), transparent 24%),
      linear-gradient(180deg, #fff, #f8fbff);
  }

  .itemTop{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:14px;
    flex-wrap:wrap;
  }

  .itemTitle{
    font-size:18px;
    line-height:1.35;
    font-weight:1000;
    color:var(--ink);
    word-break:break-word;
  }

  .rowBtns{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    margin-top:16px;
  }

  .hint{
    display:none;
    margin-top:12px;
    padding:12px 14px;
    border-radius:14px;
    background:rgba(220,38,38,.08);
    border:1px solid rgba(220,38,38,.14);
    color:#991b1b;
    font-weight:800;
    white-space:pre-wrap;
  }

  .mono{
    font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size:12px;
  }

  .likeBtn{
    border:1px solid rgba(220,38,38,.18);
    background:rgba(220,38,38,.06);
    color:#991b1b;
    padding:10px 12px;
    border-radius:14px;
    font-weight:900;
    cursor:pointer;
    display:inline-flex;
    align-items:center;
    gap:8px;
    transition:transform .12s ease, filter .12s ease, background .12s ease;
  }

  .likeBtn:hover{ filter:brightness(.98); }
  .likeBtn:active{ transform:translateY(1px); }

  .likeBtn.on{
    background:rgba(220,38,38,.12);
    border-color:rgba(220,38,38,.24);
  }

  .likeCount{
    display:inline-flex;
    padding:4px 8px;
    border-radius:999px;
    background:rgba(0,0,0,.05);
    border:1px solid rgba(0,0,0,.06);
    color:var(--ink);
    font-weight:1000;
    font-size:12px;
  }

  .promoGrid{
    display:grid;
    grid-template-columns:1.1fr .9fr;
    gap:16px;
    margin-top:18px;
  }

  .promoCard{
    border-radius:24px;
    padding:22px;
    position:relative;
    overflow:hidden;
    box-shadow:var(--shadow-2);
  }

  .promoCard::after{
    content:"";
    position:absolute;
    width:180px;
    height:180px;
    border-radius:999px;
    right:-50px;
    bottom:-60px;
    background:rgba(255,255,255,.12);
  }

  .promoCard h3{
    margin:0;
    font-size:24px;
    line-height:1.15;
    letter-spacing:-.02em;
    font-weight:1000;
  }

  .promoCard p{
    margin:12px 0 0;
    font-weight:700;
    line-height:1.75;
  }

  .promoCard.share{
    color:#fff;
    background:linear-gradient(135deg, #2563eb, #7c3aed);
  }

  .promoCard.magic{
    color:#fff;
    background:linear-gradient(135deg, #db2777, #7c3aed);
  }

  .promoCard .actionRow{
    margin-top:18px;
  }

  .promoPill{
    display:inline-flex;
    align-items:center;
    gap:8px;
    min-height:36px;
    padding:8px 12px;
    border-radius:999px;
    background:rgba(255,255,255,.16);
    border:1px solid rgba(255,255,255,.18);
    color:#fff;
    font-size:12px;
    font-weight:900;
  }

  .benefitGrid{
    display:grid;
    grid-template-columns:repeat(3, minmax(0, 1fr));
    gap:16px;
    margin-top:18px;
  }

  .benefitCard{
    background:#fff;
    border:1px solid rgba(15,23,42,.06);
    border-radius:22px;
    box-shadow:var(--shadow-1);
    padding:18px;
  }

  .benefitIcon{
    width:48px;
    height:48px;
    border-radius:16px;
    display:grid;
    place-items:center;
    font-size:22px;
    margin-bottom:14px;
  }

  .benefitIcon.purple{ background:var(--violet-50); color:var(--violet-700); }
  .benefitIcon.blue{ background:var(--blue-50); color:var(--blue-600); }
  .benefitIcon.pink{ background:var(--pink-50); color:var(--pink-600); }

  .benefitTitle{
    font-size:18px;
    font-weight:1000;
    line-height:1.3;
  }

  .benefitText{
    margin-top:10px;
    color:var(--muted-2);
    font-weight:700;
    line-height:1.75;
  }

  .sentinel{
    width:100%;
    height:24px;
  }

  .modalBackdrop{
    position:fixed;
    inset:0;
    z-index:90;
    display:none;
    align-items:center;
    justify-content:center;
    padding:20px;
    background:rgba(15,23,42,.58);
    backdrop-filter:blur(6px);
  }

  .modalBackdrop.open{ display:flex; }

  .modal{
    width:min(560px, 100%);
    max-height:min(92vh, 860px);
    overflow:auto;
    background:#fff;
    border-radius:24px;
    box-shadow:0 40px 120px rgba(0,0,0,.26);
    border:1px solid rgba(255,255,255,.16);
    padding:20px;
  }

  .modal h3{
    margin:0;
    font-size:24px;
    line-height:1.2;
    letter-spacing:-.02em;
    font-weight:1000;
  }

  .modal p{
    margin:10px 0 0;
    color:var(--muted);
    line-height:1.7;
    font-weight:700;
  }

  .field{
    margin-top:14px;
  }

  .field label{
    display:block;
    margin-bottom:8px;
    color:#334155;
    font-size:13px;
    font-weight:900;
  }

  .field input{
    width:100%;
    min-height:52px;
    border-radius:14px;
    padding:12px 14px;
    border:1px solid rgba(15,23,42,.10);
    background:#fff;
    color:var(--ink);
    outline:none;
  }

  .field input:focus{
    border-color:rgba(124,58,237,.38);
    box-shadow:0 0 0 4px rgba(124,58,237,.08);
  }

  .modalActions{
    display:flex;
    justify-content:flex-end;
    gap:10px;
    flex-wrap:wrap;
    margin-top:16px;
  }

  .buyGrid{
    display:grid;
    grid-template-columns:repeat(2, minmax(0, 1fr));
    gap:12px;
    margin-top:16px;
  }

  .buyCard{
    border-radius:18px;
    background:#fff;
    border:1px solid rgba(15,23,42,.06);
    box-shadow:var(--shadow-1);
    padding:16px;
  }

  .buyCardTitle{
    font-weight:1000;
    color:var(--ink);
    line-height:1.4;
  }

  .buyCardSub{
    margin-top:8px;
    color:var(--muted);
    font-weight:700;
    line-height:1.6;
  }

  .toastWrap{
    position:fixed;
    left:50%;
    bottom:18px;
    transform:translateX(-50%);
    z-index:95;
    display:flex;
    flex-direction:column;
    gap:10px;
    pointer-events:none;
  }

  .toast{
    min-width:min(520px, calc(100vw - 28px));
    background:#111827;
    color:#fff;
    border:1px solid rgba(255,255,255,.12);
    border-radius:16px;
    box-shadow:0 24px 50px rgba(0,0,0,.24);
    padding:12px 14px;
    opacity:0;
    transform:translateY(8px);
    transition:opacity .16s ease, transform .16s ease;
  }

  .toast.show{
    opacity:1;
    transform:translateY(0);
  }

  .toastTitle{
    font-weight:1000;
    line-height:1.4;
  }

  .toastText{
    margin-top:6px;
    color:rgba(255,255,255,.88);
    font-size:13px;
    line-height:1.5;
    font-weight:700;
  }

  .spin{
    width:16px;
    height:16px;
    border:2px solid rgba(255,255,255,.55);
    border-top-color:transparent;
    border-radius:999px;
    display:inline-block;
    animation:spin .8s linear infinite;
  }

  .hidden{
    display:none !important;
  }

  @keyframes spin{
    to{ transform:rotate(360deg); }
  }

  .footerSpace{
    height:44px;
  }

  @media (max-width: 1080px){
    .heroGrid,
    .walletShell,
    .summaryGrid,
    .twoCols,
    .threeCols,
    .promoGrid,
    .benefitGrid{
      grid-template-columns:1fr 1fr;
    }

    .heroStats{
      grid-template-columns:1fr;
    }
  }

  @media (max-width: 840px){
    .heroGrid,
    .walletShell,
    .summaryGrid,
    .twoCols,
    .threeCols,
    .tierGrid,
    .buyGrid,
    .promoGrid,
    .benefitGrid{
      grid-template-columns:1fr;
    }

    .weekTrack{
      grid-template-columns:repeat(4, 1fr);
    }

    .walletActions,
    .heroActions,
    .actionRow,
    .rowBtns,
    .modalActions{
      flex-direction:column;
    }

    .walletActions .btn,
    .heroActions .btn,
    .actionRow .btn,
    .actionRow .linkBtn,
    .rowBtns .linkBtn,
    .rowBtns .btn,
    .modalActions .btn{
      width:100%;
    }
  }

  @media (max-width: 640px){
    .wrap,
    .topbarInner{
      width:min(calc(100% - 16px), var(--max));
    }

    .heroMain,
    .heroSide,
    .sectionCard{
      border-radius:24px;
      padding:20px;
    }

    .heroTitle{
      font-size:32px;
    }

    .sectionTitle{
      font-size:28px;
    }

    .profileTop{
      align-items:flex-start;
    }

    .modal{
      padding:16px;
      border-radius:20px;
    }
  }
`;
}

function buildProfilePageJS() {
  return `
  const $ = (id) => document.getElementById(id);

  const state = {
    me: null,
    walletData: null,
    books: [],
    orders: [],
    profilePct: 0,
    accountData: null,
    verifiedPassword: "",
  };

  function safe(s){ return String(s ?? ""); }

  function escHtml(s){
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setHint(id, msg){
    const el = $(id);
    if (!el) return;
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  function initialsFromEmail(email){
    const s = String(email || "").trim();
    if (!s) return "🙂";
    const left = s.split("@")[0] || s;
    const parts = left.split(/[._-]+/).filter(Boolean);
    const a = (parts[0] || left)[0] || "U";
    const b = (parts[1] || "")[0] || "";
    return (a + b).toUpperCase();
  }

  function fmtDateBR(iso){
    try{
      const d = new Date(String(iso || ""));
      if (!Number.isFinite(d.getTime())) return "—";
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return dd + "/" + mm + "/" + yy + " " + hh + ":" + mi;
    }catch{
      return "—";
    }
  }

  function formatMoney(v){
    const n = Number(v || 0);
    return n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  }

  function fmtCoins(v){
    const n = Number(v || 0);
    return n.toLocaleString("pt-BR", {
      minimumFractionDigits: n % 1 ? 2 : 0,
      maximumFractionDigits: 2
    }) + " moedas";
  }

  function normalizeText(v){
    return String(v ?? "").trim();
  }

  function onlyDigits(v){
    return String(v ?? "").replace(/\\D/g, "");
  }

  function hasPix(account){
    return !!(
      account &&
      normalizeText(account.pix_key) &&
      normalizeText(account.pix_type) &&
      normalizeText(account.pix_holder_name) &&
      normalizeText(account.pix_bank_name) &&
      normalizeText(account.pix_holder_document)
    );
  }

  function pixTypeLabel(v){
    const s = normalizeText(v).toLowerCase();
    if (s === "cpf") return "CPF";
    if (s === "cnpj") return "CNPJ";
    if (s === "email") return "E-mail";
    if (s === "telefone") return "Telefone";
    if (s === "aleatoria") return "Aleatória";
    return s || "—";
  }

  function buildAddressText(account){
    if (!account) return "—";
    const parts = [
      normalizeText(account.address_street),
      normalizeText(account.address_number),
      normalizeText(account.address_district),
      normalizeText(account.address_city),
      normalizeText(account.address_state)
    ].filter(Boolean);
    return parts.length ? parts.join(" • ") : "—";
  }

  async function getJson(url){
    const r = await fetch(url, { headers:{ "Accept":"application/json" }});
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Falha");
    return j;
  }

  async function postJson(url, body){
    const r = await fetch(url, {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Accept":"application/json"
      },
      body: JSON.stringify(body || {})
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Falha");
    return j;
  }

  function scrollToPanel(key){
    const map = {
      overview: $("panel-overview-section"),
      wallet: $("panel-wallet"),
      books: $("panel-books"),
      orders: $("panel-orders"),
      account: $("panel-account"),
    };
    const el = map[key];
    if (el) el.scrollIntoView({ behavior:"smooth", block:"start" });
  }

  function activateTab(key){
    document.querySelectorAll(".tab").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === key);
    });
  }

  function goTab(key){
    activateTab(key);
    scrollToPanel(key);
  }

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", async () => {
      const key = btn.getAttribute("data-tab");
      goTab(key);
      if (key === "wallet") await loadWallet(true);
      if (key === "books") await loadBooks(true);
      if (key === "orders") await loadOrders(true);
      if (key === "account") await loadAccount(true);
    });
  });

  function statusBadge(st){
    const s = String(st || "");
    if (s === "done") return '<span class="badge green">✅ Pronto</span>';
    if (s === "failed") return '<span class="badge red">❌ Falhou</span>';
    if (s === "generating") return '<span class="badge violet">⏳ Gerando</span>';
    return '<span class="badge">• ' + escHtml(s || "created") + '</span>';
  }

  function orderStatusBadge(st){
    const s = String(st || "");
    if (s === "pending") return '<span class="badge amber">⏳ Pendente</span>';
    if (s === "paid") return '<span class="badge green">✅ Pago</span>';
    if (s === "shipped") return '<span class="badge blue">📦 Enviado</span>';
    if (s === "delivered") return '<span class="badge violet">📬 Entregue</span>';
    if (s === "cancelled") return '<span class="badge red">❌ Cancelado</span>';
    if (s === "finalizado") return '<span class="badge green">✅ Finalizado</span>';
    return '<span class="badge">' + escHtml(s || "—") + '</span>';
  }

  const LIKE_KEY = "mlm_profile_likes_v2";

  function hash32(str){
    str = String(str || "");
    let h = 2166136261;
    for (let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function readLikes(){
    try{
      const raw = localStorage.getItem(LIKE_KEY);
      if (!raw) return {};
      const j = JSON.parse(raw);
      return (j && typeof j === "object") ? j : {};
    }catch{
      return {};
    }
  }

  function writeLikes(map){
    try{ localStorage.setItem(LIKE_KEY, JSON.stringify(map || {})); }catch{}
  }

  function baseLikeCount(id){
    return 3 + (hash32(id) % 25);
  }

  function getLikeState(id){
    const map = readLikes();
    const v = map[String(id)] || null;
    return { liked: !!(v && v.liked) };
  }

  function toggleLike(id){
    const key = String(id);
    const map = readLikes();
    const cur = map[key] || {};
    const nextLiked = !cur.liked;
    map[key] = { liked: nextLiked };
    writeLikes(map);
    return nextLiked;
  }

  function likeCountFor(id){
    const base = baseLikeCount(id);
    const st = getLikeState(id);
    return base + (st.liked ? 1 : 0);
  }

  function bookCard(b){
    const id = safe(b.id);
    const title = safe(b.child_name || "Livro");
    const theme = safe(b.theme || "");
    const style = safe(b.style || "");
    const upd = fmtDateBR(b.updated_at || b.created_at || "");
    const err = safe(b.error || "");
    const pdf = safe(b.pdf_url || "");
    const canDownload = pdf && safe(b.status) === "done";
    const openLink = "/books/" + encodeURIComponent(id);
    const downloadLink = canDownload ? ("/download/" + encodeURIComponent(id)) : "";

    const st = getLikeState(id);
    const cnt = likeCountFor(id);

    return \`
      <div class="item bookItem" data-book="\${escHtml(id)}">
        <div class="itemTop">
          <div style="min-width:0;">
            <div class="itemTitle">📘 \${escHtml(title)}</div>
            <div class="muted" style="margin-top:10px;">
              \${theme ? "<b>Tema:</b> " + escHtml(theme) + "<br/>" : ""}
              \${style ? "<b>Estilo:</b> " + escHtml(style) + "<br/>" : ""}
              <b>Atualizado:</b> \${escHtml(upd)}<br/>
              <b>ID:</b> <span class="mono">\${escHtml(id)}</span>
              \${err ? "<br/><span style='color:#991b1b; font-weight:900;'>Erro: " + escHtml(err) + "</span>" : ""}
            </div>
          </div>
          \${statusBadge(b.status)}
        </div>

        <div class="rowBtns">
          <a class="linkBtn infoLink" href="\${openLink}">👀 Abrir</a>
          \${canDownload ? \`<a class="linkBtn" href="\${downloadLink}">⬇️ Baixar PDF</a>\` : \`<span class="badge">PDF indisponível</span>\`}
          <button class="likeBtn \${st.liked ? "on" : ""}" data-like="\${escHtml(id)}">
            \${st.liked ? "❤️" : "🤍"} Curtir
            <span class="likeCount" data-likecount="\${escHtml(id)}">\${cnt}</span>
          </button>
        </div>
      </div>
    \`;
  }

  function orderCard(o){
    const id = safe(o.id);
    const createdAt = fmtDateBR(o.created_at);
    const status = safe(o.status || "pending");
    const orderData = o.order_data || {};

    const childName = safe(orderData.childName || orderData.child_name || "—");
    const theme = safe(orderData.theme || "—");
    const style = safe(orderData.style || "—");
    const total = Number(orderData.total || 0);
    const bookId = safe(o.book_id || orderData.bookId || "");
    const bookLink = bookId ? ("/books/" + encodeURIComponent(bookId)) : "#";

    return \`
      <div class="item orderItem" data-order="\${escHtml(id)}">
        <div class="itemTop">
          <div style="min-width:0;">
            <div class="itemTitle">🧾 Pedido #\${escHtml(id.slice(0, 8))}</div>
            <div class="muted" style="margin-top:10px;">
              <b>Criança:</b> \${escHtml(childName)}<br/>
              <b>Tema:</b> \${escHtml(theme)}<br/>
              <b>Estilo:</b> \${escHtml(style)}<br/>
              <b>Total:</b> \${escHtml(formatMoney(total))}<br/>
              <b>Data:</b> \${escHtml(createdAt)}
            </div>
          </div>
          \${orderStatusBadge(status)}
        </div>

        <div class="rowBtns">
          \${bookId ? \`<a class="linkBtn infoLink" href="\${bookLink}">👀 Ver livro</a>\` : ""}
        </div>
      </div>
    \`;
  }

  function activityCard(item){
    const dt = item.created_at ? fmtDateBR(item.created_at) : "—";
    const amount = Number(item.amount || 0);
    const sign = amount >= 0 ? "+" : "";
    return \`
      <div class="activityItem">
        <div>
          <strong>\${escHtml(safe(item.title || "Movimentação"))}</strong>
          \${item.meta ? \`<small>\${escHtml(safe(item.meta))}</small>\` : ""}
          <small>\${escHtml(safe(dt))}</small>
        </div>
        <div class="activityValue">\${escHtml(safe(sign + fmtCoins(amount)))}</div>
      </div>
    \`;
  }

  function showToast(title, desc, ms){
    const wrap = $("toastWrap");
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = \`
      <div>
        <div class="toastTitle">\${escHtml(title)}</div>
        <div class="toastText">\${escHtml(desc)}</div>
      </div>
    \`;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    const ttl = Math.max(1400, Math.min(4200, Number(ms || 2200)));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 240);
    }, ttl);
  }

  function openModal(id){
    const el = $(id);
    if (el) el.classList.add("open");
  }

  function closeModal(id){
    const el = $(id);
    if (el) el.classList.remove("open");
  }

  function openLogoutModal(){
    setHint("hintLogoutModal", "");
    openModal("logoutModal");
  }

  function closeLogoutModal(){
    closeModal("logoutModal");
  }

  function openWithdrawModal(){
    setHint("hintWithdraw", "");
    setHint("hintWithdrawModal", "");
    syncWithdrawModalByAccount();
    openModal("withdrawModal");
  }

  function closeWithdrawModal(){
    closeModal("withdrawModal");
  }

  function openBuyModal(){
    setHint("hintBuy", "");
    setHint("hintBuyModal", "");
    openModal("buyModal");
  }

  function closeBuyModal(){
    closeModal("buyModal");
  }

  function openVerifyPasswordModal(){
    setHint("hintVerifyPasswordModal", "");
    $("verifyPasswordInput").value = "";
    openModal("verifyPasswordModal");
    setTimeout(() => $("verifyPasswordInput") && $("verifyPasswordInput").focus(), 40);
  }

  function closeVerifyPasswordModal(){
    closeModal("verifyPasswordModal");
  }

  function openEditAccountModal(){
    setHint("hintEditAccountModal", "");
    fillEditAccountForm(state.accountData || {});
    openModal("editAccountModal");
  }

  function closeEditAccountModal(){
    closeModal("editAccountModal");
  }

  function bindBackdropClose(id, onClose){
    const el = $(id);
    if (!el) return;
    el.addEventListener("click", (e) => {
      if (e.target === el) onClose();
    });
  }

  bindBackdropClose("logoutModal", closeLogoutModal);
  bindBackdropClose("withdrawModal", closeWithdrawModal);
  bindBackdropClose("buyModal", closeBuyModal);
  bindBackdropClose("verifyPasswordModal", closeVerifyPasswordModal);
  bindBackdropClose("editAccountModal", closeEditAccountModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLogoutModal();
      closeWithdrawModal();
      closeBuyModal();
      closeVerifyPasswordModal();
      closeEditAccountModal();
    }
  });

  async function doLogout(){
    setHint("hintLogout", "");
    setHint("hintLogoutModal", "");
    try{
      const r = await fetch("/api/auth/logout", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:"{}"
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "Falha ao sair");
      window.location.href = "/login";
    }catch(e){
      const msg = String(e.message || e);
      setHint("hintLogout", msg);
      setHint("hintLogoutModal", msg);
    }
  }

  $("btnTopLogout").addEventListener("click", openLogoutModal);
  $("btnLogout").addEventListener("click", openLogoutModal);
  $("btnCancelLogout").addEventListener("click", closeLogoutModal);
  $("btnConfirmLogout").addEventListener("click", doLogout);

  function setProgress(pct){
    const v = Math.max(0, Math.min(100, Number(pct || 0)));
    state.profilePct = v;
    $("profileProgressLabel").textContent = v + "%";
    $("profileBar").style.width = v + "%";
  }

  function setBadges(progressPct, hasProfileName){
    const row = $("badgesRow");
    const badges = [];

    if (progressPct >= 40) badges.push("<span class='badge blue'>✅ Conta ativa</span>");
    if (hasProfileName) badges.push("<span class='badge green'>🏷️ Perfil identificado</span>");
    if (progressPct >= 100) badges.push("<span class='badge amber'>🏆 Perfil completo</span>");
    else if (progressPct >= 70) badges.push("<span class='badge violet'>⭐ Perfil em ótimo estado</span>");

    row.innerHTML = badges.length ? badges.join(" ") : "<span class='badge'>Complete seus dados principais</span>";
  }

  async function loadMe(){
    try{
      const me = await getJson("/api/me");
      state.me = me;

      const u = me.user || {};
      const p = me.profile || null;

      $("uid").textContent = u.id || "—";
      $("avatar").textContent = initialsFromEmail(u.email || "");

      let score = 0;
      if (u.id) score += 40;
      if (u.email) score += 30;
      if (p && p.name) score += 30;
      setProgress(score);

      const hasName = !!(p && p.name);

      if (hasName){
        $("name").textContent = p.name;
        $("profileName").textContent = p.name;
        $("profileCreated").textContent = fmtDateBR(p.created_at || "");
        $("profileUpdated").textContent = fmtDateBR(p.updated_at || "");
        $("profileBadge").textContent = "Perfil carregado";
      } else {
        $("name").textContent = "Seu Perfil";
        $("profileName").textContent = "—";
        $("profileCreated").textContent = "—";
        $("profileUpdated").textContent = "—";
        $("profileBadge").textContent = "Complete seu perfil";
      }

      setBadges(score, hasName);
    }catch(e){
      $("profileBadge").textContent = "Erro";
      setHint("hintLogout", "Falha ao carregar /api/me: " + String(e.message || e));
      setProgress(20);
      setBadges(20, false);
    }
  }

  function paintWeekTrack(streak, cycleCount){
    const dots = Array.from(document.querySelectorAll("#weekTrack .dayDot"));
    dots.forEach((el, idx) => {
      el.classList.remove("done", "current");
      const pos = idx + 1;
      if (pos <= Number(cycleCount || 0)) el.classList.add("done");
      if (pos === Number(cycleCount || 0) + 1 && Number(cycleCount || 0) < 7) el.classList.add("current");
    });
  }

  function markCurrentTier(levelKey){
    ["bronze", "prata", "ouro"].forEach(k => {
      const el = $("tier-" + k);
      if (el) el.classList.toggle("current", k === levelKey);
    });
  }

  function renderWalletSummary(data){
    state.walletData = data || null;

    const wallet = data.wallet || {};
    const level = data.level || {};
    const progress = data.levelProgress || {};
    const activities = Array.isArray(data.activities) ? data.activities : [];

    const availableCoins = Number(data.availableCoins || 0);
    const baseCoins = Number(data.baseCoins || 0);
    const bonusCoins = Number(wallet.bonus_coins || 0);
    const purchasedCoins = Number(wallet.purchased_coins || 0);
    const withdrawnCoins = Number(wallet.withdrawn_coins || 0);
    const completedOrders = Number(data.completedOrders || 0);
    const nextReward = Number(data.nextCheckinReward || 0);
    const accountHasPix = !!data.hasPixKey || hasPix(state.accountData);

    $("heroWalletBalance").textContent = fmtCoins(availableCoins);
    $("heroWalletLevel").textContent = (level.icon || "🥉") + " " + (level.name || "Bronze");
    $("heroWalletLevelSub").textContent = "Seu nível atual na carteira";
    $("heroCheckinReward").textContent = fmtCoins(nextReward);

    $("quickWalletBalance").textContent = fmtCoins(availableCoins);
    $("quickCompletedOrders").textContent = String(completedOrders);
    $("quickCheckinReward").textContent = fmtCoins(nextReward);
    $("quickLevelBadge").textContent = (level.icon || "🥉") + " " + (level.name || "Bronze");

    $("walletAvailableText").textContent = fmtCoins(availableCoins);
    $("walletOrdersText").textContent = String(completedOrders);
    $("walletCheckinText").textContent = fmtCoins(nextReward);
    $("walletCheckinPill").textContent = "Seu próximo check-in rende " + fmtCoins(nextReward);

    $("walletLevelBadge").textContent = (level.icon || "🥉") + " " + (level.name || "Bronze");
    $("walletStreakBadge").textContent = "Sequência: " + String(Number(wallet.streak_days || 0)) + " dia(s)";

    $("levelProgressPct").textContent = String(Number(progress.pct || 0)) + "%";
    $("levelProgressBar").style.width = String(Number(progress.pct || 0)) + "%";

    $("levelProgressText").textContent =
      level.key === "ouro"
        ? "Sua conta já está no nível máximo."
        : completedOrders + " / " + String(progress.nextAt || 0) + " pedidos concluídos para alcançar o nível " + String(progress.nextName || "seguinte");

    $("resumeBaseCoins").textContent = fmtCoins(baseCoins);
    $("resumeBonusCoins").textContent = fmtCoins(bonusCoins);
    $("resumePurchasedCoins").textContent = fmtCoins(purchasedCoins);
    $("resumeWithdrawnCoins").textContent = fmtCoins(withdrawnCoins);
    $("resumeAvailableCoins").textContent = fmtCoins(availableCoins);
    $("resumeLastCheckin").textContent = wallet.last_checkin_date ? fmtDateBR(wallet.last_checkin_date) : "—";
    $("resumeStreak").textContent = String(Number(wallet.streak_days || 0)) + " dia(s)";
    $("resumeCycle").textContent = String(Number(wallet.cycle_count || 0)) + " / 7";
    $("resumePixStatus").textContent = accountHasPix ? "Cadastrado" : "Não cadastrado";

    paintWeekTrack(Number(wallet.streak_days || 0), Number(wallet.cycle_count || 0));
    markCurrentTier(level.key || "bronze");

    const activityEl = $("walletActivityList");
    if (!activities.length) {
      activityEl.innerHTML = '<div class="empty">Ainda não há movimentações extras na sua carteira.</div>';
    } else {
      activityEl.innerHTML = activities.map(activityCard).join("");
    }
  }

  async function loadWallet(showToastOnSuccess){
    setHint("hintWithdraw", "");
    setHint("hintBuy", "");
    setHint("hintWithdrawModal", "");
    setHint("hintBuyModal", "");
    try{
      const data = await getJson("/api/my-wallet");
      renderWalletSummary(data);
      syncWithdrawModalByAccount();
      if (showToastOnSuccess) showToast("🪙 Carteira atualizada", "Sua carteira foi atualizada com sucesso.", 2200);
    }catch(e){
      showToast("⚠️ Carteira", "Falha ao carregar carteira: " + String(e.message || e), 3200);
    }
  }

  function renderAccountSummary(account){
    state.accountData = account || null;

    $("sessionEmailText").textContent = account?.email || "—";
    $("accountNameText").textContent = account?.name || "—";
    $("accountEmailText").textContent = account?.email || "—";
    $("accountPhoneText").textContent = account?.phone || "—";

    $("accountPixTypeText").textContent = account && hasPix(account) ? pixTypeLabel(account.pix_type) : "—";
    $("accountPixHolderText").textContent = account && hasPix(account) ? (account.pix_holder_name || "—") : "—";
    $("accountPixBankText").textContent = account && hasPix(account) ? (account.pix_bank_name || "—") : "—";

    $("accountAddressText").textContent = buildAddressText(account);
    $("accountZipText").textContent = account?.address_zip || "—";
    $("accountStateText").textContent = account?.address_state || "—";

    $("accountPixBadge").textContent = hasPix(account) ? "PIX: cadastrado" : "PIX: pendente";

    syncWithdrawModalByAccount();

    if (state.walletData) {
      renderWalletSummary(state.walletData);
    }
  }

  async function loadAccount(showToastOnSuccess){
    setHint("hintAccount", "");
    try{
      const j = await getJson("/api/my-account");
      renderAccountSummary(j.account || {});
      if (showToastOnSuccess) showToast("🔐 Conta atualizada", "Seus dados foram carregados com sucesso.", 2200);
    }catch(e){
      setHint("hintAccount", "Falha ao carregar dados da conta: " + String(e.message || e));
    }
  }

  function syncWithdrawModalByAccount(){
    const account = state.accountData || {};
    const pixExists = hasPix(account);
    const pixBlock = $("withdrawPixFields");
    const intro = $("withdrawIntroText");
    if (!pixBlock || !intro) return;

    pixBlock.classList.toggle("hidden", pixExists);

    if (pixExists) {
      intro.textContent = "Registre uma solicitação de saque da sua carteira.";
    } else {
      intro.textContent = "Antes do primeiro saque, preencha seus dados PIX obrigatórios.";
    }
  }

  function fillEditAccountForm(account){
    $("editName").value = account?.name || "";
    $("editEmail").value = account?.email || "";
    $("editPhone").value = account?.phone || "";
    $("editNewPassword").value = "";

    $("editPixType").value = account?.pix_type || "";
    $("editPixKey").value = account?.pix_key || "";
    $("editPixHolderName").value = account?.pix_holder_name || "";
    $("editPixBankName").value = account?.pix_bank_name || "";
    $("editPixHolderDocument").value = account?.pix_holder_document || "";

    $("editAddressStreet").value = account?.address_street || "";
    $("editAddressNumber").value = account?.address_number || "";
    $("editAddressDistrict").value = account?.address_district || "";
    $("editAddressCity").value = account?.address_city || "";
    $("editAddressState").value = account?.address_state || "";
    $("editAddressZip").value = account?.address_zip || "";
    $("editAddressComplement").value = account?.address_complement || "";
  }

  let allBooks = [];
  let shownBooks = 0;
  const PAGE = 10;
  let ioBooks = null;
  let isLoadingBooks = false;

  function detachBooksObserver(){
    try{ if (ioBooks) ioBooks.disconnect(); }catch{}
    ioBooks = null;
  }

  function attachBooksObserver(){
    detachBooksObserver();
    const sentinel = $("sentinelBooks");
    if (!sentinel) return;
    ioBooks = new IntersectionObserver((entries) => {
      const e = entries && entries[0];
      if (!e || !e.isIntersecting) return;
      renderMoreBooks();
    }, { root:null, rootMargin:"600px 0px", threshold:0.01 });
    ioBooks.observe(sentinel);
  }

  function renderMoreBooks(){
    if (isLoadingBooks) return;
    const list = $("booksList");
    const slice = allBooks.slice(shownBooks, shownBooks + PAGE);
    if (!slice.length) return;
    isLoadingBooks = true;
    setTimeout(() => {
      list.insertAdjacentHTML("beforeend", slice.map(bookCard).join(""));
      shownBooks += slice.length;
      bindLikeButtonsForVisible();
      isLoadingBooks = false;
    }, 120);
  }

  function bindLikeButtonsForVisible(){
    document.querySelectorAll("[data-like]").forEach(btn => {
      if (btn.__boundLike) return;
      btn.__boundLike = true;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const id = btn.getAttribute("data-like");
        const nextLiked = toggleLike(id);
        btn.classList.toggle("on", nextLiked);
        btn.innerHTML =
          (nextLiked ? "❤️" : "🤍") +
          " Curtir " +
          "<span class='likeCount' data-likecount='" + escHtml(id) + "'>" + likeCountFor(id) + "</span>";
        showToast(
          nextLiked ? "❤️ Curtido!" : "🤍 Curtida removida",
          nextLiked ? "Você marcou esse livro como favorito." : "Livro removido dos favoritos.",
          2000
        );
      });
    });
  }

  async function loadBooks(reset){
    setHint("hintBooks", "");
    if (reset){
      detachBooksObserver();
      allBooks = [];
      shownBooks = 0;
      $("booksList").innerHTML = "<div class='empty'>Carregando livros…</div>";
    }

    const btn = $("btnRefreshBooks");
    const icon = $("refreshIconBooks");
    if (btn && icon){
      btn.disabled = true;
      icon.innerHTML = "<span class='spin'></span>";
    }

    try{
      const j = await getJson("/api/my-books");
      const items = Array.isArray(j.items) ? j.items : [];
      const filtered = items.filter(item => item.status === "done");
      allBooks = filtered;
      shownBooks = 0;
      state.books = filtered;

      $("quickBooksCount").textContent = String(filtered.length);
      $("booksCountText").textContent = filtered.length
        ? filtered.length + " livro(s) carregado(s)"
        : "Nenhum livro concluído ainda.";

      if (!filtered.length){
        $("booksList").innerHTML = "<div class='empty'>Você ainda não tem livros concluídos. Quando criar o próximo, ele aparecerá aqui.</div>";
        attachBooksObserver();
        return;
      }

      $("booksList").innerHTML = "";
      renderMoreBooks();
      attachBooksObserver();
    }catch(e){
      $("booksList").innerHTML = "";
      $("quickBooksCount").textContent = "0";
      $("booksCountText").textContent = "Erro ao carregar livros";
      setHint("hintBooks", "Falha ao carregar livros: " + String(e.message || e));
    }finally{
      if (btn && icon){
        btn.disabled = false;
        icon.textContent = "🔄";
      }
    }
  }

  let allOrders = [];
  let shownOrders = 0;
  let ioOrders = null;
  let isLoadingOrders = false;

  function detachOrdersObserver(){
    try{ if (ioOrders) ioOrders.disconnect(); }catch{}
    ioOrders = null;
  }

  function attachOrdersObserver(){
    detachOrdersObserver();
    const sentinel = $("sentinelOrders");
    if (!sentinel) return;
    ioOrders = new IntersectionObserver((entries) => {
      const e = entries && entries[0];
      if (!e || !e.isIntersecting) return;
      renderMoreOrders();
    }, { root:null, rootMargin:"600px 0px", threshold:0.01 });
    ioOrders.observe(sentinel);
  }

  function renderMoreOrders(){
    if (isLoadingOrders) return;
    const list = $("ordersList");
    const slice = allOrders.slice(shownOrders, shownOrders + PAGE);
    if (!slice.length) return;
    isLoadingOrders = true;
    setTimeout(() => {
      list.insertAdjacentHTML("beforeend", slice.map(orderCard).join(""));
      shownOrders += slice.length;
      isLoadingOrders = false;
    }, 120);
  }

  async function loadOrders(reset){
    setHint("hintOrders", "");
    if (reset){
      detachOrdersObserver();
      allOrders = [];
      shownOrders = 0;
      $("ordersList").innerHTML = "<div class='empty'>Carregando pedidos…</div>";
    }

    const btn = $("btnRefreshOrders");
    const icon = $("refreshIconOrders");
    if (btn && icon){
      btn.disabled = true;
      icon.innerHTML = "<span class='spin'></span>";
    }

    try{
      const j = await getJson("/api/my-orders");
      const items = Array.isArray(j.items) ? j.items : [];
      allOrders = items;
      shownOrders = 0;
      state.orders = items;

      $("ordersCountText").textContent = items.length
        ? items.length + " pedido(s) encontrado(s)"
        : "Nenhum pedido encontrado.";

      if (!items.length){
        $("ordersList").innerHTML = "<div class='empty'>Você ainda não tem pedidos registrados nesta conta.</div>";
        attachOrdersObserver();
        return;
      }

      $("ordersList").innerHTML = "";
      renderMoreOrders();
      attachOrdersObserver();
    }catch(e){
      $("ordersList").innerHTML = "";
      $("ordersCountText").textContent = "Erro ao carregar pedidos";
      setHint("hintOrders", "Falha ao carregar pedidos: " + String(e.message || e));
    }finally{
      if (btn && icon){
        btn.disabled = false;
        icon.textContent = "🔄";
      }
    }
  }

  $("btnCloseWithdraw").addEventListener("click", closeWithdrawModal);
  $("btnCloseBuy").addEventListener("click", closeBuyModal);
  $("btnCloseVerifyPassword").addEventListener("click", closeVerifyPasswordModal);
  $("btnCloseEditAccount").addEventListener("click", closeEditAccountModal);

  $("btnBuyWallet").addEventListener("click", openBuyModal);
  $("btnWithdrawWallet").addEventListener("click", async () => {
    if (!state.accountData) await loadAccount(false);
    openWithdrawModal();
  });

  $("btnEditAccount").addEventListener("click", async () => {
    if (!state.accountData) await loadAccount(false);
    openVerifyPasswordModal();
  });

  $("btnRefreshBooks").addEventListener("click", () => loadBooks(true));
  $("btnRefreshOrders").addEventListener("click", () => loadOrders(true));
  $("btnRefreshWallet").addEventListener("click", () => loadWallet(true));

  $("btnGoWalletHero").addEventListener("click", async () => {
    goTab("wallet");
    await loadWallet(true);
  });

  $("btnGoWalletQuick").addEventListener("click", async () => {
    goTab("wallet");
    await loadWallet(true);
  });

  $("btnGoOrdersQuick").addEventListener("click", async () => {
    goTab("orders");
    await loadOrders(true);
  });

  $("btnGoBooksQuick").addEventListener("click", async () => {
    goTab("books");
    await loadBooks(true);
  });

  $("btnGoWalletFromOverview").addEventListener("click", async () => {
    goTab("wallet");
    await loadWallet(true);
  });

  $("btnScrollWallet").addEventListener("click", async () => {
    goTab("wallet");
    await loadWallet(true);
  });

  $("btnScrollBooks").addEventListener("click", async () => {
    goTab("books");
    await loadBooks(true);
  });

  $("btnScrollOrders").addEventListener("click", async () => {
    goTab("orders");
    await loadOrders(true);
  });

  $("btnScrollAccount").addEventListener("click", async () => {
    goTab("account");
    await loadAccount(true);
  });

  $("btnDailyCheckin").addEventListener("click", async () => {
    const btn = $("btnDailyCheckin");
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "<span class='spin'></span> Processando";
    try{
      const j = await postJson("/api/my-wallet/checkin", {});
      renderWalletSummary({
        ok:true,
        wallet:j.wallet,
        level:j.level,
        levelProgress:j.levelProgress,
        completedOrders:state.walletData?.completedOrders || 0,
        baseCoins:state.walletData?.baseCoins || 0,
        availableCoins:j.availableCoins,
        activities:j.activities,
        nextCheckinReward:j.nextCheckinReward,
        hasPixKey: hasPix(state.accountData)
      });
      await loadWallet(false);
      showToast("✅ Check-in realizado", "Você ganhou " + fmtCoins(j.reward) + ".", 2600);
    }catch(e){
      const msg = String(e.message || e);
      if (msg === "checkin_already_done_today") {
        showToast("🕒 Check-in", "Você já fez check-in hoje.", 2600);
      } else {
        showToast("⚠️ Check-in", "Falha ao fazer check-in: " + msg, 3200);
      }
    }finally{
      btn.disabled = false;
      btn.innerHTML = old;
    }
  });

  $("btnConfirmWithdraw").addEventListener("click", async () => {
    setHint("hintWithdraw", "");
    setHint("hintWithdrawModal", "");

    const amount = Number($("withdrawAmount").value || 0);
    const note = String($("withdrawNote").value || "").trim();
    const payload = { amount, note };

    if (!hasPix(state.accountData || {})) {
      payload.pix_type = $("withdrawPixType").value;
      payload.pix_key = $("withdrawPixKey").value;
      payload.pix_holder_name = $("withdrawPixHolderName").value;
      payload.pix_bank_name = $("withdrawPixBankName").value;
      payload.pix_holder_document = $("withdrawPixHolderDocument").value;
    }

    const btn = $("btnConfirmWithdraw");
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "<span class='spin'></span> Enviando";

    try{
      await postJson("/api/my-wallet/withdraw", payload);
      $("withdrawAmount").value = "";
      $("withdrawNote").value = "";
      $("withdrawPixType").value = "";
      $("withdrawPixKey").value = "";
      $("withdrawPixHolderName").value = "";
      $("withdrawPixBankName").value = "";
      $("withdrawPixHolderDocument").value = "";
      closeWithdrawModal();
      await loadAccount(false);
      await loadWallet(false);
      showToast("⬆️ Saque registrado", "Sua solicitação de saque foi registrada.", 2600);
    }catch(e){
      const msg = String(e.message || e);
      const map = {
        insufficient_balance: "Saldo insuficiente para esse saque.",
        invalid_amount: "Informe uma quantidade válida.",
        invalid_pix_type: "Informe um tipo de chave PIX válido.",
        pix_key_required: "Informe sua chave PIX.",
        pix_holder_name_required: "Informe o nome do titular.",
        pix_bank_name_required: "Informe a instituição da conta.",
        pix_holder_document_required: "Informe o CPF/CNPJ do titular.",
        invalid_pix_key_email: "A chave PIX do tipo e-mail está inválida.",
        invalid_pix_key_cpf: "A chave PIX do tipo CPF deve ter 11 números.",
        invalid_pix_key_cnpj: "A chave PIX do tipo CNPJ deve ter 14 números.",
        invalid_pix_key_phone: "A chave PIX do tipo telefone está inválida."
      };
      setHint("hintWithdrawModal", map[msg] || ("Falha ao sacar: " + msg));
    }finally{
      btn.disabled = false;
      btn.innerHTML = old;
    }
  });

  document.querySelectorAll(".buyPackBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      setHint("hintBuy", "");
      setHint("hintBuyModal", "");

      const pack = Number(btn.getAttribute("data-pack") || 0);
      const old = btn.innerHTML;

      btn.disabled = true;
      btn.innerHTML = "<span class='spin'></span> Abrindo checkout";

      try{
        const j = await postJson("/api/my-wallet/buy", { pack });

        if (!j.checkoutUrl) {
          throw new Error("checkout_url_missing");
        }

        closeBuyModal();
        window.location.href = j.checkoutUrl;
      }catch(e){
        setHint("hintBuyModal", "Falha ao iniciar compra: " + String(e.message || e));
      }finally{
        btn.disabled = false;
        btn.innerHTML = old;
      }
    });
  });

  $("btnConfirmVerifyPassword").addEventListener("click", async () => {
    setHint("hintVerifyPasswordModal", "");
    const password = String($("verifyPasswordInput").value || "");
    const btn = $("btnConfirmVerifyPassword");
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "<span class='spin'></span> Confirmando";
    try{
      await postJson("/api/my-account/verify-password", { password });
      state.verifiedPassword = password;
      closeVerifyPasswordModal();
      if (!state.accountData) await loadAccount(false);
      openEditAccountModal();
    }catch(e){
      const msg = String(e.message || e);
      const map = {
        password_required: "Digite sua senha atual.",
        invalid_password: "Senha incorreta.",
        supabase_auth_missing: "A validação de senha não está disponível no momento."
      };
      setHint("hintVerifyPasswordModal", map[msg] || ("Falha ao confirmar senha: " + msg));
    }finally{
      btn.disabled = false;
      btn.innerHTML = old;
    }
  });

  $("btnSaveEditAccount").addEventListener("click", async () => {
    setHint("hintEditAccountModal", "");
    const payload = {
      current_password: state.verifiedPassword || "",
      name: $("editName").value,
      email: $("editEmail").value,
      phone: $("editPhone").value,
      new_password: $("editNewPassword").value,

      pix_type: $("editPixType").value,
      pix_key: $("editPixKey").value,
      pix_holder_name: $("editPixHolderName").value,
      pix_bank_name: $("editPixBankName").value,
      pix_holder_document: $("editPixHolderDocument").value,

      address_street: $("editAddressStreet").value,
      address_number: $("editAddressNumber").value,
      address_district: $("editAddressDistrict").value,
      address_city: $("editAddressCity").value,
      address_state: $("editAddressState").value,
      address_zip: $("editAddressZip").value,
      address_complement: $("editAddressComplement").value,
    };

    const btn = $("btnSaveEditAccount");
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "<span class='spin'></span> Salvando";

    try{
      const j = await postJson("/api/my-account/update", payload);
      state.accountData = j.account || {};
      renderAccountSummary(state.accountData);
      closeEditAccountModal();
      state.verifiedPassword = "";
      await loadWallet(false);
      showToast("✅ Dados atualizados", "Suas informações foram salvas com sucesso.", 2600);
      if (j.email_changed) {
        showToast("📧 E-mail atualizado", "Seu e-mail foi alterado na conta.", 2600);
      }
      if (j.password_changed) {
        showToast("🔐 Senha atualizada", "Sua nova senha já está salva.", 2600);
      }
    }catch(e){
      const msg = String(e.message || e);
      const map = {
        current_password_required: "Confirme sua senha atual antes de salvar.",
        invalid_password: "Sua senha atual está incorreta.",
        invalid_email: "Informe um e-mail válido.",
        password_too_short: "A nova senha deve ter pelo menos 6 caracteres.",
        invalid_pix_type: "Informe um tipo de chave PIX válido.",
        pix_key_required: "Informe sua chave PIX.",
        pix_holder_name_required: "Informe o nome do titular.",
        pix_bank_name_required: "Informe a instituição da conta.",
        pix_holder_document_required: "Informe o CPF/CNPJ do titular.",
        invalid_pix_key_email: "A chave PIX do tipo e-mail está inválida.",
        invalid_pix_key_cpf: "A chave PIX do tipo CPF deve ter 11 números.",
        invalid_pix_key_cnpj: "A chave PIX do tipo CNPJ deve ter 14 números.",
        invalid_pix_key_phone: "A chave PIX do tipo telefone está inválida.",
        supabase_admin_auth_missing: "A atualização de credenciais não está disponível no momento."
      };
      setHint("hintEditAccountModal", map[msg] || ("Falha ao salvar: " + msg));
    }finally{
      btn.disabled = false;
      btn.innerHTML = old;
    }
  });

  function setupScrollSpy(){
    const sections = [
      { key:"overview", el:$("panel-overview-section") },
      { key:"wallet", el:$("panel-wallet") },
      { key:"books", el:$("panel-books") },
      { key:"orders", el:$("panel-orders") },
      { key:"account", el:$("panel-account") },
    ].filter(x => !!x.el);

    if (!sections.length) return;

    const io = new IntersectionObserver((entries) => {
      let best = null;
      for (const entry of entries){
        if (!entry.isIntersecting) continue;
        if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
      }
      if (!best) return;
      const found = sections.find(s => s.el === best.target);
      if (!found) return;
      activateTab(found.key);
    }, { root:null, threshold:[0.2, 0.35, 0.55] });

    sections.forEach(s => io.observe(s.el));
  }

  (async function init(){
    setupScrollSpy();
    await loadMe();
    await loadAccount(false);
    await loadWallet(false);
    await loadBooks(true);
    await loadOrders(true);
  })();
`;
}
