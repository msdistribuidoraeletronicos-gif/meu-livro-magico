/**
 * partners.venda.profile.assets.js
 *
 * Assets do painel do parceiro venda:
 * - CSS completo da tela
 * - JS completo da tela
 */

"use strict";

module.exports = {
  VENDA_PROFILE_CSS,
  buildVendaProfileJS,
};

function VENDA_PROFILE_CSS() {
  return `
:root{
  --c-trust: rgba(84, 169, 255, .95);
  --c-okay:  rgba(40, 200, 120, .95);
  --c-warn:  rgba(255, 193, 7, .95);
  --c-urg:   rgba(255, 82, 82, .95);
}

.topCard{padding:18px 18px 16px 18px}
.topTitle{font-size:22px;font-weight:1000;letter-spacing:-0.02em}
.topSub{margin-top:6px}
.metaRow{margin-top:10px;display:flex;flex-wrap:wrap;gap:10px}
.chip{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10)}
.chip b{font-weight:1000}

.sideTop{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px}
.sideTitle{font-weight:1000}

.refreshBtn{
  display:inline-flex;align-items:center;gap:8px;
  padding:8px 10px;border-radius:999px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.06);
  color:#fff;cursor:pointer;font-weight:900;
}
.refreshBtn:hover{transform:translateY(-1px)}
.refreshBtn.isLoading{opacity:.85}
.refreshBtn.isLoading .spin{animation:spin .9s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.lastSync{font-size:12px;opacity:.85;margin-bottom:10px}

.focusBtn{
  display:inline-flex;align-items:center;gap:8px;
  padding:8px 10px;border-radius:999px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.06);
  color:#fff;cursor:pointer;font-weight:900;
}
.focusBtn:hover{transform:translateY(-1px)}
.focusOn .badge{display:none !important}
.focusOn .toast{animation:none !important}
.focusOn .navBtn:hover,
.focusOn .btnSmall:hover,
.focusOn .refreshBtn:hover,
.focusOn .focusBtn:hover{transform:none !important}

.sideNav{display:flex;flex-direction:column;gap:8px}
.navBtn{
  width:100%;text-align:left;
  display:flex;justify-content:space-between;align-items:center;gap:10px;
  padding:10px 12px;border-radius:12px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(0,0,0,.18);
  color:#fff;cursor:pointer;
}
.navBtn:hover{transform:translateY(-1px)}
.navBtn.active{background:linear-gradient(135deg, rgba(84,169,255,.18), rgba(255,82,173,.16));border-color:rgba(255,255,255,.18)}
.navLabel{display:flex;align-items:center;gap:10px}
.chev{opacity:.7;font-size:18px}

.badge{
  margin-left:8px;
  display:inline-flex;align-items:center;justify-content:center;
  min-width:22px;height:22px;
  padding:0 8px;border-radius:999px;
  font-size:12px;font-weight:1000;
  border:1px solid rgba(255,255,255,.16);
  background:rgba(255,255,255,.08);
}
.badge-alert{background:rgba(255,82,82,.14);border-color:rgba(255,82,82,.24);color:#fff;animation:pulse 1.5s infinite}
.badge-warn{background:rgba(255,193,7,.14);border-color:rgba(255,193,7,.24);color:#fff}
.badge-info{background:rgba(84,169,255,.14);border-color:rgba(84,169,255,.24);color:#fff}

.sideMini{margin-top:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);border-radius:16px;padding:12px}
.miniLine{display:flex;justify-content:space-between;align-items:center;gap:10px}
.miniHint{margin-top:6px;font-size:12px;opacity:.85}
.lvl b{font-weight:1000}

.panel{padding:16px}
.panelHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}
.panelHeadStack{align-items:center}
@media(max-width:760px){.panelHead,.panelHeadStack{flex-direction:column;align-items:flex-start}}
.panelTitle{font-weight:1000;font-size:16px}
.panelRight{display:flex;gap:10px;align-items:center}
.cashPill{padding:10px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-weight:1000}
.cashPillCoins{background:linear-gradient(135deg, rgba(255,191,0,.18), rgba(255,255,255,.06))}
.softPill{padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);font-weight:1000}

.kpiGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.kpiGridThree{grid-template-columns:repeat(3,1fr)}
@media(max-width:980px){.kpiGrid,.kpiGridThree{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.kpiGrid,.kpiGridThree{grid-template-columns:1fr}}
.kpiCard{border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.18);border-radius:18px;padding:14px}
.kpiCardHot{background:linear-gradient(135deg, rgba(255,82,82,.12), rgba(0,0,0,.18));border-color:rgba(255,82,82,.18)}
.kpiCardCoins{background:linear-gradient(135deg, rgba(255,191,0,.16), rgba(0,0,0,.18));border-color:rgba(255,191,0,.18)}
.kpiTop{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.kpiTitle{opacity:.9;font-weight:900}
.kpiBadge{font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06)}
.kpiValue{font-size:22px;font-weight:1000;letter-spacing:-0.02em}
.kpiSub{margin-top:6px;font-size:12px;opacity:.8}

.split{margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:980px){.split{grid-template-columns:1fr}}
.miniCard{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);border-radius:16px;padding:14px}
.miniWarn{background:rgba(255,193,7,.10);border-color:rgba(255,193,7,.18)}
.miniBad{background:rgba(255,82,82,.08);border-color:rgba(255,82,82,.16)}
.miniTitle{font-weight:1000}
.miniValue{font-size:20px;font-weight:1000;margin-top:8px}

.note{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);border-radius:16px;padding:14px}
.noteTop{display:flex;justify-content:space-between;align-items:center;gap:10px}
.hint{margin-top:10px;font-size:12px;opacity:.8}

.bar{height:10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);overflow:hidden}
.barBig{height:12px}
.barFill{
  height:100%;
  width:0%;
  background:linear-gradient(90deg, rgba(84,169,255,.9), rgba(40,200,120,.85));
  border-radius:999px;
  transition:width .45s ease;
}
.barFillScore{
  background:linear-gradient(90deg, rgba(255,191,0,.95), rgba(84,169,255,.88));
}

.tableTools{margin-bottom:10px}
.tableSearch{
  width:100%;
  padding:12px 14px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.05);
  color:#fff;
  outline:none;
}

.tableWrap{overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,.10)}
.table{width:100%;border-collapse:collapse}
.table th,.table td{padding:12px 12px;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:middle}
.table thead th{position:sticky;top:0;background:rgba(0,0,0,.35);backdrop-filter:blur(8px);text-align:left;font-weight:1000}

.btnSmall{
  border:2px solid transparent;
  border-radius:12px;
  padding:10px 12px;
  cursor:pointer;
  font-weight:1000;
  font-size:14px;
  line-height:1.25;
  transition:transform .12s ease, box-shadow .2s, filter .12s ease, opacity .12s ease;
  background:rgba(255,255,255,.08);
  color:#fff;
}
.btnSmall:hover{
  transform:translateY(-2px);
  box-shadow:0 10px 20px rgba(0,0,0,0.2);
  filter:brightness(1.03);
}
.btnSmall:disabled{
  opacity:.72;
  cursor:not-allowed;
  transform:none;
  filter:none;
}
.btnOk{
  background:#6366f1;
  border-color:#4f46e5;
  color:#fff;
}

.pill{
  display:inline-flex;
  align-items:center;
  padding:7px 11px;
  border-radius:999px;
  border:2px solid transparent;
  font-weight:1000;
  font-size:12px;
}
.pill-para_aceitar{
  background:#fde68a;
  border-color:#f59e0b;
  color:#3a2500;
}
.pill-em_fabricacao{
  background:#bfdbfe;
  border-color:#3b82f6;
  color:#0b2340;
}
.pill-pronto_entrega{
  background:#fed7aa;
  border-color:#f97316;
  color:#3b1a00;
}
.pill-finalizado{
  background:#bbf7d0;
  border-color:#22c55e;
  color:#0d2a16;
}
.pill-retorno{
  background:#fbcfe8;
  border-color:#ec4899;
  color:#4a1230;
}
.pill-recusado{
  background:#fecaca;
  border-color:#ef4444;
  color:#3b0a0a;
}

.empty{border:1px dashed rgba(255,255,255,.18);background:rgba(255,255,255,.03);border-radius:18px;padding:18px;text-align:center}
.emptyIcon{font-size:26px}
.emptyTitle{margin-top:6px;font-weight:1000}
.emptyText{margin-top:6px;opacity:.85;font-size:13px}

.steps{display:grid;gap:10px}
.step{display:flex;gap:12px;align-items:flex-start;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);border-radius:16px;padding:14px}
.step .n{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:1000;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}

.walletHero{
  display:grid;
  grid-template-columns:1.6fr .9fr;
  gap:14px;
}
@media(max-width:980px){.walletHero{grid-template-columns:1fr}}
.walletHeroMain{
  border:1px solid rgba(255,255,255,.10);
  background:
    radial-gradient(circle at top right, rgba(255,191,0,.10), transparent 42%),
    linear-gradient(135deg, rgba(255,255,255,.05), rgba(0,0,0,.18));
  border-radius:22px;
  padding:22px;
}
.walletLabel{font-size:13px;opacity:.82}
.walletBig{font-size:34px;font-weight:1000;letter-spacing:-0.03em;margin-top:8px}
.walletSub{margin-top:6px;opacity:.82}
.walletActions{
  margin-top:18px;
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}
.actionBig{
  min-width:170px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  padding:14px 16px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.12);
  cursor:pointer;
  font-weight:1000;
  transition:transform .14s ease, filter .14s ease;
}
.actionBig:hover{transform:translateY(-1px);filter:brightness(1.04)}
.actionPrimary{
  background:linear-gradient(135deg, rgba(255,191,0,.22), rgba(255,255,255,.08));
  color:#fff;
}
.actionSecondary{
  background:linear-gradient(135deg, rgba(84,169,255,.18), rgba(255,255,255,.06));
  color:#fff;
}
.actionGhost{
  background:rgba(255,255,255,.06);
  color:#fff;
}

.walletHeroSide{display:grid;gap:12px}
.walletMiniCard{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.04);
  border-radius:20px;
  padding:16px;
}
.walletMiniTitle{font-size:13px;opacity:.82}
.walletMiniValue{margin-top:8px;font-size:20px;font-weight:1000}
.walletMiniText{margin-top:6px;font-size:13px;opacity:.85}

.cashGrid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:14px;
}
@media(max-width:980px){.cashGrid{grid-template-columns:1fr}}

.cashCard{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.04);
  border-radius:20px;
  padding:16px;
}
.cashCardHead{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px;
  margin-bottom:14px;
}
.cashCardTitle{font-size:16px;font-weight:1000}

.checkinBox{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(0,0,0,.18);
  border-radius:18px;
  padding:16px;
}
.checkinTop{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
}
@media(max-width:760px){.checkinTop{flex-direction:column;align-items:flex-start}}
.checkinRewardLabel{font-size:13px;opacity:.82}
.checkinRewardValue{margin-top:8px;font-size:26px;font-weight:1000}
.checkinBtn{
  border:0;
  border-radius:14px;
  padding:14px 16px;
  background:linear-gradient(135deg, rgba(40,200,120,.95), rgba(84,169,255,.92));
  color:#06131f;
  font-weight:1000;
  cursor:pointer;
  box-shadow:0 14px 28px rgba(84,169,255,.18);
}
.checkinBtn:disabled{opacity:.65;cursor:not-allowed;box-shadow:none}

.weekTrack{
  display:grid;
  grid-template-columns:repeat(7,1fr);
  gap:8px;
}
.dayDot{
  height:42px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.04);
  font-weight:1000;
}
.dayDot.done{
  background:linear-gradient(135deg, rgba(255,191,0,.22), rgba(40,200,120,.16));
  border-color:rgba(255,191,0,.28);
}
.dayDot.today{
  outline:2px solid rgba(84,169,255,.40);
}

.tierBadge{
  display:inline-flex;
  align-items:center;
  gap:8px;
  border-radius:999px;
  padding:8px 12px;
  font-weight:1000;
  border:1px solid rgba(255,255,255,.12);
}
.tier-bronze{background:rgba(205,127,50,.12)}
.tier-prata{background:rgba(192,192,192,.12)}
.tier-ouro{background:rgba(255,215,0,.12)}
.tierGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
@media(max-width:760px){.tierGrid{grid-template-columns:1fr}}
.tierBox{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(0,0,0,.16);
  border-radius:16px;
  padding:14px;
}
.tierBox.isCurrent{
  box-shadow:0 0 0 2px rgba(84,169,255,.24) inset;
  border-color:rgba(84,169,255,.28);
}
.tierTitle{font-weight:1000}
.tierText{margin-top:8px;font-size:13px;opacity:.86}

.resumeList{display:grid;gap:10px}
.resumeItem{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  padding:12px 14px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(0,0,0,.15);
}
.resumeItemTotal{
  background:linear-gradient(135deg, rgba(255,191,0,.14), rgba(255,255,255,.06));
  border-color:rgba(255,191,0,.18);
}

.activityList{display:grid;gap:10px;max-height:480px;overflow:auto;padding-right:2px}
.activityItem{
  border:1px solid rgba(255,255,255,.08);
  background:rgba(0,0,0,.14);
  border-radius:14px;
  padding:12px 14px;
  display:flex;
  justify-content:space-between;
  gap:12px;
}
.activityItem strong{display:block}
.activityItem small{display:block;opacity:.75;margin-top:4px}
.activityValue{font-weight:1000}
.activityEmpty{
  border:1px dashed rgba(255,255,255,.15);
  background:rgba(255,255,255,.03);
  border-radius:14px;
  padding:16px;
  opacity:.85;
}

.achievements{display:grid;gap:10px}
.achItem{
  display:grid;
  grid-template-columns:42px 1fr;
  gap:12px;
  align-items:flex-start;
  padding:12px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(0,0,0,.16);
}
.achItem.done{
  border-color:rgba(40,200,120,.22);
  background:linear-gradient(135deg, rgba(40,200,120,.10), rgba(255,255,255,.04));
}
.achIcon{
  width:42px;height:42px;border-radius:14px;
  display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.08);
  font-size:20px;
}
.achTitle{font-weight:1000}
.achText{margin-top:4px;font-size:13px;opacity:.84}

.modalWrap{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.52);
  backdrop-filter:blur(6px);
  display:none;
  align-items:center;
  justify-content:center;
  padding:18px;
  z-index:9998;
}
.modalWrap.open{display:flex}
.modalCard{
  width:min(560px, calc(100vw - 24px));
  border-radius:22px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(10,10,18,.92);
  box-shadow:0 22px 60px rgba(0,0,0,.45);
  padding:18px;
}
.modalHead{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:10px;
  margin-bottom:14px;
}
.modalTitle{font-size:18px;font-weight:1000}
.modalClose{
  width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.05);color:#fff;cursor:pointer;font-size:16px;
}
.modalBody{display:grid;gap:12px}
.field{
  display:grid;
  gap:8px;
}
.field input, .field select{
  width:100%;
  padding:12px 14px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.05);
  color:#fff;
  outline:none;
}
.modalActions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:4px;
  flex-wrap:wrap;
}
.btnModal{
  padding:12px 16px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.06);
  color:#fff;
  cursor:pointer;
  font-weight:1000;
}
.btnModal.primary{
  background:linear-gradient(135deg, rgba(255,191,0,.20), rgba(84,169,255,.16));
}

.buyGrid{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:10px;
}
@media(max-width:760px){.buyGrid{grid-template-columns:1fr}}
.buyCard{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.04);
  border-radius:16px;
  padding:14px;
}
.buyCardTitle{font-weight:1000}
.buyCardSub{font-size:13px;opacity:.8;margin-top:6px}
.buyCard button{margin-top:12px;width:100%}

.toasts{position:fixed;right:14px;bottom:14px;display:grid;gap:10px;z-index:9999}
.toast{
  width:min(360px, calc(100vw - 28px));
  border-radius:16px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(0,0,0,.55);
  backdrop-filter:blur(10px);
  padding:12px 12px;
  box-shadow:0 18px 40px rgba(0,0,0,.35);
  transform:translateY(8px);
  opacity:0;
  animation:toastIn .22s ease forwards;
}
@keyframes toastIn{to{transform:translateY(0);opacity:1}}
.toastTop{display:flex;justify-content:space-between;align-items:center;gap:10px}
.toastTitle{font-weight:1000}
.toastMsg{margin-top:4px;opacity:.9;font-size:13px}
.toast.ok{border-color:rgba(40,200,120,.22)}
.toast.warn{border-color:rgba(255,193,7,.22)}
.toast.bad{border-color:rgba(255,82,82,.22)}
.toast .x{border:0;background:transparent;color:#fff;opacity:.7;cursor:pointer;font-size:16px}
.toast .x:hover{opacity:1}

.panelHostFlash{animation:flash .45s ease}
@keyframes flash{
  0%{box-shadow:0 0 0 rgba(0,0,0,0)}
  45%{box-shadow:0 0 0 4px rgba(84,169,255,.10)}
  100%{box-shadow:0 0 0 rgba(0,0,0,0)}
}

@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
@keyframes float { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-30px); opacity: 0; } }
@keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.pulse { animation: pulse 2s infinite; }
.float-coin {
  position: fixed;
  font-size: 20px;
  font-weight: bold;
  color: gold;
  pointer-events: none;
  animation: float 1s forwards;
  z-index: 10000;
}
tr { animation: slideIn 0.3s ease-out; }
.streak-fire { color: orange; filter: drop-shadow(0 0 5px orange); }
`;
}

function buildVendaProfileJS(opts = {}) {
  const partnerId = String(opts.partnerId || "");
  const levelKey = String(opts.levelKey || "bronze");
  const levelName = String(opts.levelName || "Bronze");
  const caixaTotal = Number(opts.caixaTotal || 0);
  const walletState = normalizeWalletState(opts.walletState || {});
  const walletActivities = Array.isArray(opts.walletActivities) ? opts.walletActivities : [];

  return `
(function(){
  const PARTNER_ID = ${JSON.stringify(partnerId)};
  const LEVEL_KEY = ${JSON.stringify(levelKey)};
  const LEVEL_NAME = ${JSON.stringify(levelName)};
  const BASE_COINS = ${JSON.stringify(caixaTotal)};

  let WALLET_STATE = ${JSON.stringify(walletState)};
  let WALLET_ACTIVITIES = ${JSON.stringify(walletActivities)};

  const tabButtons = Array.from(document.querySelectorAll('[data-tab]'));
  const navButtons = Array.from(document.querySelectorAll('.navBtn[data-tab], .navBtnClean[data-tab]'));
  const sections = Array.from(document.querySelectorAll('[id^="section-"]'));
  const toasts = document.getElementById('toasts');
  const panelHost = document.getElementById('panelHost');
  const lastSync = document.getElementById('lastSync');
  const withdrawModal = document.getElementById('withdrawModal');
  const buyCoinsModal = document.getElementById('buyCoinsModal');

  function moneyLabel(v){
    const n = Number(v || 0);
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: (n % 1 === 0 ? 0 : 2),
      maximumFractionDigits: 2
    }) + ' moedas';
  }

  function todayKey(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }

  function nowLabel(){
    try{
      const d = new Date();
      return d.toLocaleString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    }catch(e){ return 'agora'; }
  }

  function setLastSync(){
    if(lastSync) lastSync.textContent = 'Atualizado às ' + nowLabel();
  }
  setLastSync();

  function toast(type, title, msg, ms){
    if(!toasts){
      try{ alert((title || 'Aviso') + '\\n' + (msg || '')); }catch(e){}
      return;
    }

    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML =
      '<div class="toastTop">' +
        '<div class="toastTitle">' + escapeHtml(title || 'Aviso') + '</div>' +
        '<button class="x" type="button" aria-label="Fechar">✕</button>' +
      '</div>' +
      (msg ? '<div class="toastMsg">' + escapeHtml(msg) + '</div>' : '');

    const btn = el.querySelector('.x');
    if(btn){
      btn.addEventListener('click', function(){ el.remove(); });
    }
    toasts.appendChild(el);

    const ttl = typeof ms === 'number' ? ms : 2800;
    setTimeout(function(){ try{ el.remove(); }catch(e){} }, ttl);
  }

  function createFloatingCoin(amount, element) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const coin = document.createElement('div');
    coin.className = 'float-coin';
    coin.textContent = '+' + moneyLabel(amount);
    coin.style.left = (rect.left + rect.width / 2) + 'px';
    coin.style.top = rect.top + 'px';
    document.body.appendChild(coin);
    setTimeout(function(){ try{ coin.remove(); }catch(e){} }, 1000);
  }

  const FOCUS_KEY = 'partners_focus_mode_v1';

  function getFocus(){
    try{ return localStorage.getItem(FOCUS_KEY) === '1'; }catch(e){ return false; }
  }

  function setFocus(on){
    try{ localStorage.setItem(FOCUS_KEY, on ? '1' : '0'); }catch(e){}
  }

  function applyFocus(on){
    document.documentElement.classList.toggle('focusOn', !!on);
  }
  applyFocus(getFocus());

  function getActiveTab(){
    const act = document.querySelector('.navBtn.active, .navBtnClean.active');
    return act ? act.getAttribute('data-tab') : 'visao';
  }

  function show(tabId, pushHash){
    const normalizedTab = String(tabId || '').trim();
    if(!normalizedTab) return;

    navButtons.forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-tab') === normalizedTab);
    });

    sections.forEach(function(section){
      const isTarget = section.id === ('section-' + normalizedTab);
      section.style.display = isTarget ? '' : 'none';
    });

    if(pushHash){
      try{
        history.replaceState(null, '', location.pathname + location.search + '#' + normalizedTab);
      }catch(e){}
    }

    const targetSection = document.getElementById('section-' + normalizedTab);
    if(targetSection){
      try{
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }catch(e){}
    }
  }

  tabButtons.forEach(function(b){
    b.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();

      const tabId = String(b.getAttribute('data-tab') || '').trim();
      if(!tabId) return;

      show(tabId, true);
    });
  });

  const hash = (location.hash || '').replace('#','').trim();
  if(hash && document.getElementById('section-' + hash)){
    show(hash, false);
  }else{
    show('visao', false);
  }

  function flashPanel(){
    if(!panelHost) return;
    panelHost.classList.remove('panelHostFlash');
    void panelHost.offsetWidth;
    panelHost.classList.add('panelHostFlash');
  }

  function doRefresh(btn){
    if(btn){
      btn.classList.add('isLoading');
      btn.disabled = true;
      const label = btn.querySelector('span:nth-child(2)');
      if(label) label.textContent = 'Sincronizando…';
    }

    setLastSync();
    toast('warn', 'Sincronizando', 'Atualizando pedidos e carteira.', 1600);

    setTimeout(function(){
      const url = new URL(window.location.href);
      url.searchParams.set('_ui_refresh', String(Date.now()));
      url.hash = getActiveTab();
      window.location.assign(url.toString());
    }, 250);
  }

  async function doCopyLink(){
    const inp = document.getElementById('refLink');
    if(!inp){
      toast('bad', 'Link não encontrado', 'Abra a aba “Meu link” e tente novamente.', 3200);
      return;
    }

    const val = String(inp.value || '').trim();
    if(!val){
      toast('bad', 'Link vazio', 'Tente atualizar a página.', 2800);
      return;
    }

    try{
      try{
        inp.focus();
        inp.select();
        inp.setSelectionRange(0, inp.value.length);
      }catch(e){}

      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(val);
      }else{
        document.execCommand('copy');
      }

      toast('ok', 'Copiado ✅', 'Agora é só colar e divulgar.', 2200);
    }catch(e){
      toast('warn', 'Não deu pra copiar automático', 'Selecione o link e copie manualmente.', 3600);
    }
  }

  function doRegenLink(){
    setLastSync();
    flashPanel();
    toast('ok', 'Link pronto ✅', 'Seu link está atualizado e pronto para divulgar.', 2400);
  }

  function toggleFocus(){
    const on = !getFocus();
    setFocus(on);
    applyFocus(on);
    toast(
      'ok',
      on ? 'Modo foco ativado' : 'Modo foco desativado',
      on ? 'Feedbacks visuais reduzidos.' : 'Feedbacks visuais restaurados.',
      1800
    );
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getWallet(){
    return Object.assign({
      bonus_coins: 0,
      purchased_coins: 0,
      withdrawn_coins: 0,
      streak_days: 0,
      cycle_count: 0,
      last_checkin_date: ''
    }, WALLET_STATE || {});
  }

  function setWallet(next){
    WALLET_STATE = Object.assign({}, getWallet(), next || {});
  }

  function getActivities(){
    return Array.isArray(WALLET_ACTIVITIES) ? WALLET_ACTIVITIES : [];
  }

  function setActivities(list){
    WALLET_ACTIVITIES = Array.isArray(list) ? list : [];
  }

  function getAvailableCoins(wallet){
    const w = wallet || getWallet();
    return Math.max(
      0,
      Number(BASE_COINS || 0) +
      Number(w.bonus_coins || 0) +
      Number(w.purchased_coins || 0) -
      Number(w.withdrawn_coins || 0)
    );
  }

  async function reloadWalletData(){
    const r = await fetch('/parceiros/wallet/data', {
      method: 'GET',
      cache: 'no-store'
    });

    const j = await r.json().catch(function(){ return null; });
    if(!r.ok || !j || !j.ok){
      throw new Error((j && j.error) ? j.error : 'Falha ao recarregar carteira');
    }

    setWallet(j.wallet || {});
    setActivities(j.activities || []);
    updateWalletUI();
  }

  function updateWeekTrack(wallet){
    const wrap = document.getElementById('weekTrack');
    if(!wrap) return;

    const dots = Array.from(wrap.querySelectorAll('.dayDot'));
    const count = Number(wallet.cycle_count || 0);

    dots.forEach(function(dot, idx){
      dot.classList.toggle('done', idx < count);
      dot.classList.remove('today');
      if(idx === count && count < 7) dot.classList.add('today');
    });

    if(count >= 7 && dots[6]) dots[6].classList.add('today');
  }

  function updateActivityUI(){
    const box = document.getElementById('coinsActivity');
    if(!box) return;

    const items = getActivities();
    if(!items.length){
      box.innerHTML = '<div class="activityEmpty">Ainda não há movimentações extras no seu painel.</div>';
      return;
    }

    box.innerHTML = items.map(function(item){
      const dt = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-';
      const amount = Number(item.amount || 0);
      const sign = amount >= 0 ? '+' : '';

      return (
        '<div class="activityItem">' +
          '<div>' +
            '<strong>' + escapeHtml(item.title || 'Movimentação') + '</strong>' +
            (item.meta ? '<small>' + escapeHtml(item.meta) + '</small>' : '') +
            '<small>' + escapeHtml(dt) + '</small>' +
          '</div>' +
          '<div class="activityValue">' + sign + moneyLabel(amount) + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function updateWalletUI(){
    const wallet = getWallet();
    const available = getAvailableCoins(wallet);
    const bonus = Number(wallet.bonus_coins || 0);
    const purchased = Number(wallet.purchased_coins || 0);
    const withdrawn = Number(wallet.withdrawn_coins || 0);
    const currentStreak = Number(wallet.streak_days || 0);

    const nextReward = currentStreak >= 2
      ? (LEVEL_KEY === 'ouro' ? 1.35 : (LEVEL_KEY === 'prata' ? 1.15 : 1.0))
      : (LEVEL_KEY === 'ouro' ? 1.0 : (LEVEL_KEY === 'prata' ? 0.75 : 0.5));

    const map = {
      walletTotalText: available,
      walletBigText: available,
      cashPillTotal: available,
      availableCoinsText: available,
      baseCoinsText: BASE_COINS,
      bonusCoinsText: bonus + purchased,
      withdrawCoinsText: withdrawn,
      checkinRewardValue: nextReward,
      checkinRewardNow: nextReward
    };

    Object.keys(map).forEach(function(id){
      const el = document.getElementById(id);
      if(el) el.textContent = moneyLabel(map[id]);
    });

    const streakPill = document.getElementById('checkinStreakPill');
    if(streakPill){
      streakPill.textContent = 'Sequência: ' + currentStreak + ' dia(s)';
      if(currentStreak >= 3){
        streakPill.classList.add('streak-fire');
      }else{
        streakPill.classList.remove('streak-fire');
      }
    }

    const btn = document.getElementById('checkinBtn');
    if(btn){
      const already = String(wallet.last_checkin_date || '') === todayKey();
      btn.disabled = already;
      btn.textContent = already ? '✅ Check-in feito hoje' : '✅ Fazer check-in';
    }

    updateWeekTrack(wallet);
    updateActivityUI();
  }

  async function doDailyCheckin(){
    try{
      const btn = document.getElementById('checkinBtn');
      if(btn) btn.disabled = true;

      const r = await fetch('/parceiros/wallet/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: '',
        cache: 'no-store'
      });

      const j = await r.json().catch(function(){ return null; });

      if(!r.ok || !j || !j.ok){
        if(btn) btn.disabled = false;
        toast('bad', 'Check-in não realizado', (j && j.error) ? j.error : 'Tente novamente.', 3200);
        return;
      }

      setWallet(j.wallet || {});
      await reloadWalletData();
      createFloatingCoin(j.reward || 0, btn);
      toast('ok', 'Check-in confirmado ✅', 'Você recebeu ' + moneyLabel(j.reward || 0) + '.', 2600);
    }catch(err){
      console.error('[wallet-ui] erro checkin:', err);
      toast('bad', 'Erro de conexão', 'Não foi possível fazer check-in agora.', 3200);
      updateWalletUI();
    }
  }

  function openModal(modal){
    if(!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModals(){
    [withdrawModal, buyCoinsModal].forEach(function(m){
      if(!m) return;
      m.classList.remove('open');
      m.setAttribute('aria-hidden', 'true');
    });
  }

  async function doWithdraw(){
    const amountInput = document.getElementById('withdrawAmount');
    const noteInput = document.getElementById('withdrawNote');

    const amount = Number(amountInput ? amountInput.value : 0);
    const note = String(noteInput ? noteInput.value : '').trim();

    if(!Number.isFinite(amount) || amount <= 0){
      toast('bad', 'Valor inválido', 'Digite uma quantidade válida de moedas.', 3200);
      return;
    }

    try{
      const body = new URLSearchParams();
      body.set('amount', String(amount));
      body.set('note', note);

      const r = await fetch('/parceiros/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
        cache: 'no-store'
      });

      const j = await r.json().catch(function(){ return null; });

      if(!r.ok || !j || !j.ok){
        toast('bad', 'Saque não registrado', (j && j.error) ? j.error : 'Tente novamente.', 3200);
        return;
      }

      setWallet(j.wallet || {});
      await reloadWalletData();
      closeModals();

      if(amountInput) amountInput.value = '';
      if(noteInput) noteInput.value = '';

      toast('ok', 'Saque registrado', 'Sua solicitação foi salva com sucesso.', 2800);
    }catch(err){
      console.error('[wallet-ui] erro withdraw:', err);
      toast('bad', 'Erro de conexão', 'Não foi possível registrar o saque agora.', 3200);
    }
  }

  async function doBuyPack(pack){
    const amount = Number(pack || 0);
    if(!amount){
      toast('bad', 'Pacote inválido', 'Não foi possível selecionar este pacote.', 2600);
      return;
    }

    try{
      const body = new URLSearchParams();
      body.set('amount', String(amount));

      const r = await fetch('/parceiros/wallet/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
        cache: 'no-store'
      });

      const j = await r.json().catch(function(){ return null; });

      if(!r.ok || !j || !j.ok){
        toast('bad', 'Compra não registrada', (j && j.error) ? j.error : 'Tente novamente.', 3200);
        return;
      }

      setWallet(j.wallet || {});
      await reloadWalletData();
      closeModals();

      toast('ok', 'Moedas adicionadas ✅', 'Pacote de ' + moneyLabel(amount) + ' registrado no painel.', 2800);
    }catch(err){
      console.error('[wallet-ui] erro buy:', err);
      toast('bad', 'Erro de conexão', 'Não foi possível registrar a compra agora.', 3200);
    }
  }

  function openDetails(){
    show('historico', true);
    flashPanel();
    toast('ok', 'Detalhes abertos', 'Você está vendo o histórico completo.', 1800);
  }

  function setupTableFilters(){
    const searchInputs = Array.from(document.querySelectorAll('[data-table-search]'));

    searchInputs.forEach(function(input){
      input.addEventListener('input', function(){
        const root = input.closest('[data-panel]') || input.closest('.panel') || document;
        const tbody = root.querySelector('tbody');
        if(!tbody) return;

        const term = String(input.value || '').trim().toLowerCase();
        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.forEach(function(row){
          const bag = String(row.getAttribute('data-search') || '').toLowerCase();
          row.style.display = !term || bag.indexOf(term) >= 0 ? '' : 'none';
        });
      });
    });
  }

  setupTableFilters();
  updateWalletUI();

  document.addEventListener('click', function(ev){
    const actionEl = ev.target.closest('[data-action]');
    if(actionEl){
      const action = actionEl.getAttribute('data-action');

      if(action === 'refresh'){
        ev.preventDefault();
        ev.stopPropagation();
        doRefresh(actionEl);
        return;
      }

      if(action === 'copyLink'){
        ev.preventDefault();
        ev.stopPropagation();
        doCopyLink();
        return;
      }

      if(action === 'regenLink'){
        ev.preventDefault();
        ev.stopPropagation();
        doRegenLink();
        return;
      }

      if(action === 'toggleFocus'){
        ev.preventDefault();
        ev.stopPropagation();
        toggleFocus();
        return;
      }

      if(action === 'dailyCheckin'){
        ev.preventDefault();
        ev.stopPropagation();
        doDailyCheckin();
        return;
      }

      if(action === 'openWithdraw'){
        ev.preventDefault();
        ev.stopPropagation();
        openModal(withdrawModal);
        return;
      }

      if(action === 'openBuyCoins'){
        ev.preventDefault();
        ev.stopPropagation();
        openModal(buyCoinsModal);
        return;
      }

      if(action === 'openDetails'){
        ev.preventDefault();
        ev.stopPropagation();
        openDetails();
        return;
      }

      if(action === 'confirmWithdraw'){
        ev.preventDefault();
        ev.stopPropagation();
        doWithdraw();
        return;
      }

      if(action === 'buyPack'){
        ev.preventDefault();
        ev.stopPropagation();
        doBuyPack(actionEl.getAttribute('data-pack'));
        return;
      }

      if(action === 'closeModal'){
        ev.preventDefault();
        ev.stopPropagation();
        closeModals();
        return;
      }
    }

    const tabEl = ev.target.closest('[data-tab]');
    if(tabEl){
      ev.preventDefault();
      ev.stopPropagation();

      const tabId = String(tabEl.getAttribute('data-tab') || '').trim();
      if(!tabId) return;

      show(tabId, true);
      return;
    }
  });

  [withdrawModal, buyCoinsModal].forEach(function(modal){
    if(!modal) return;
    modal.addEventListener('click', function(ev){
      if(ev.target === modal) closeModals();
    });
  });

  document.addEventListener('keydown', function(ev){
    if(ev.key === 'Escape') closeModals();
  });
})();
`;
}

function normalizeWalletState(wallet) {
  return {
    bonus_coins: Number(wallet?.bonus_coins || 0),
    purchased_coins: Number(wallet?.purchased_coins || 0),
    withdrawn_coins: Number(wallet?.withdrawn_coins || 0),
    streak_days: Number(wallet?.streak_days || 0),
    cycle_count: Number(wallet?.cycle_count || 0),
    last_checkin_date: wallet?.last_checkin_date || "",
  };
}