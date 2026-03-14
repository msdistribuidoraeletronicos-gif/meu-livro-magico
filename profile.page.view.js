/**
 * profile.page.view.js
 *
 * View da página /profile.
 * Responsável por montar o HTML completo da tela
 * usando o CSS e o JS vindos do arquivo de assets.
 */

"use strict";

module.exports = {
  renderProfilePage,
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderProfilePage(data = {}) {
  const email = esc(data.email || "");
  const pageCss = String(data.pageCss || "");
  const pageJs = String(data.pageJs || "");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Perfil — Meu Livro Mágico</title>
<style>
${pageCss}

/* =========================================================
   MENU PADRÃO COMPARTILHADO
   ========================================================= */
.sharedHeader{
  width:min(calc(100% - 24px), 1240px);
  margin:18px auto 0;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  flex-wrap:wrap;
  position:relative;
  z-index:60;
}

.sharedHeaderLeft,
.sharedHeaderRight{
  display:flex;
  align-items:center;
  gap:12px;
  flex-wrap:wrap;
}

.sharedBrand{
  display:inline-flex;
  align-items:center;
  gap:12px;
  min-height:48px;
  text-decoration:none;
  color:#111827;
}

.sharedBrandMark{
  width:44px;
  height:44px;
  border-radius:15px;
  display:grid;
  place-items:center;
  background:linear-gradient(135deg, rgba(124,58,237,.14), rgba(219,39,119,.14));
  border:1px solid rgba(124,58,237,.16);
  box-shadow:0 10px 24px rgba(0,0,0,.08);
  font-size:20px;
  flex:0 0 auto;
}

.sharedBrandText{
  font-size:17px;
  line-height:1.15;
  font-weight:1000;
  letter-spacing:-.02em;
  color:#111827;
}

.sharedMenuWrap{
  position:relative;
}

.sharedMenuToggle{
  appearance:none;
  border:none;
  min-height:46px;
  padding:10px 14px;
  border-radius:14px;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  font-weight:1000;
  color:#4c1d95;
  background:rgba(255,255,255,.92);
  border:1px solid rgba(124,58,237,.14);
  box-shadow:0 8px 20px rgba(0,0,0,.06);
  transition:transform .14s ease, box-shadow .14s ease, background .14s ease, filter .14s ease;
  user-select:none;
  white-space:nowrap;
}

.sharedMenuToggle:hover{
  transform:translateY(-1px);
  box-shadow:0 12px 24px rgba(0,0,0,.08);
  filter:brightness(1.01);
}

.sharedMenuToggle:active{
  transform:translateY(1px);
}

.sharedMenuToggleCaret{
  font-size:12px;
  opacity:.8;
}

.sharedMenuPanel{
  position:absolute;
  top:calc(100% + 8px);
  right:0;
  min-width:270px;
  max-width:min(92vw, 340px);
  padding:8px;
  border-radius:18px;
  background:rgba(255,255,255,.98);
  border:1px solid rgba(226,232,240,.9);
  box-shadow:0 18px 40px rgba(15,23,42,.12);
  backdrop-filter:blur(14px);
  display:none;
  z-index:120;
}

.sharedMenuPanel.open{
  display:block;
}

.sharedMenuSection{
  display:grid;
  gap:6px;
}

.sharedMenuDivider{
  height:1px;
  margin:6px 2px;
  background:rgba(148,163,184,.18);
}

.sharedMenuItem{
  appearance:none;
  width:100%;
  border:none;
  text-align:left;
  text-decoration:none;
  min-height:42px;
  padding:10px 12px;
  border-radius:12px;
  display:flex;
  align-items:center;
  gap:10px;
  background:#fff;
  color:#1f2937;
  border:1px solid rgba(15,23,42,.05);
  box-shadow:0 4px 12px rgba(17,24,39,.03);
  font-weight:900;
  cursor:pointer;
  transition:transform .12s ease, background .12s ease, box-shadow .12s ease;
}

.sharedMenuItem:hover{
  transform:translateY(-1px);
  background:#faf8ff;
  box-shadow:0 8px 16px rgba(17,24,39,.05);
}

.sharedMenuItemIcon{
  width:26px;
  height:26px;
  border-radius:9px;
  display:grid;
  place-items:center;
  font-size:14px;
  background:linear-gradient(135deg, rgba(124,58,237,.12), rgba(236,72,153,.12));
  color:#6d28d9;
  flex:0 0 auto;
}

.sharedMenuItemDanger{
  color:#991b1b;
  background:#fff7f7;
  border-color:rgba(220,38,38,.08);
}

.sharedMenuItemDanger .sharedMenuItemIcon{
  background:linear-gradient(135deg, rgba(239,68,68,.14), rgba(249,115,22,.14));
  color:#b91c1c;
}

.sharedHeaderActions{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}

.sharedHeaderAction{
  appearance:none;
  border:none;
  min-height:46px;
  padding:10px 14px;
  border-radius:14px;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  font-weight:1000;
  white-space:nowrap;
  text-decoration:none;
  transition:transform .14s ease, box-shadow .14s ease, filter .14s ease, background .14s ease;
  user-select:none;
}

.sharedHeaderAction:hover{
  transform:translateY(-1px);
  filter:brightness(1.01);
}

.sharedHeaderAction:active{
  transform:translateY(1px);
}

.sharedHeaderAction.primary{
  color:#fff;
  background:linear-gradient(90deg,#7c3aed,#db2777);
  box-shadow:0 14px 28px rgba(124,58,237,.18);
}

.sharedHeaderAction.soft{
  color:#4c1d95;
  background:rgba(255,255,255,.92);
  border:1px solid rgba(124,58,237,.14);
  box-shadow:0 8px 20px rgba(0,0,0,.06);
}

.sharedHeaderEmail{
  display:inline-flex;
  align-items:center;
  min-height:40px;
  padding:9px 13px;
  border-radius:999px;
  background:rgba(255,255,255,.92);
  border:1px solid rgba(15,23,42,.06);
  box-shadow:0 8px 18px rgba(0,0,0,.04);
  color:#475569;
  font-weight:900;
  font-size:13px;
  max-width:320px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.profilePageShell{
  padding-top:8px;
}

@media (max-width: 720px){
  .sharedHeader{
    align-items:stretch;
  }

  .sharedHeaderLeft,
  .sharedHeaderRight{
    width:100%;
    justify-content:space-between;
  }

  .sharedMenuWrap{
    flex:1 1 auto;
  }

  .sharedMenuToggle{
    width:100%;
  }

  .sharedMenuPanel{
    right:auto;
    left:0;
    min-width:100%;
    max-width:100%;
  }

  .sharedHeaderActions{
    width:100%;
  }

  .sharedHeaderActions .sharedHeaderAction{
    flex:1 1 100%;
  }

  .sharedHeaderEmail{
    max-width:100%;
  }
}
</style>
</head>
<body>
  <!-- MENU PADRÃO -->
  <div class="sharedHeader">
    <div class="sharedHeaderLeft">
      <a class="sharedBrand" href="/sales">
        <div class="sharedBrandMark">📚</div>
        <div class="sharedBrandText">Meu Livro Mágico</div>
      </a>
    </div>

    <div class="sharedHeaderRight">
      <div class="sharedHeaderEmail" title="${email}">${email}</div>

      <div class="sharedMenuWrap">
        <button
          type="button"
          class="sharedMenuToggle"
          id="sharedMenuToggle"
          data-shared-menu-toggle="1"
          aria-expanded="false"
          aria-controls="sharedMenuPanel"
        >
          ☰ Menu
          <span class="sharedMenuToggleCaret">▾</span>
        </button>

        <div
          class="sharedMenuPanel"
          id="sharedMenuPanel"
          data-shared-menu-panel="1"
        >
          <div class="sharedMenuSection">
            <a class="sharedMenuItem" href="/sales">
              <span class="sharedMenuItemIcon">🏠</span>
              <span>Início</span>
            </a>

            <a class="sharedMenuItem" href="/create">
              <span class="sharedMenuItemIcon">✨</span>
              <span>Criar livro</span>
            </a>

            <a class="sharedMenuItem" href="/books">
              <span class="sharedMenuItemIcon">📚</span>
              <span>Meus Livros</span>
            </a>

            <a class="sharedMenuItem" href="/coins-info">
              <span class="sharedMenuItemIcon">🪙</span>
              <span>Moedas</span>
            </a>

            <a class="sharedMenuItem" href="/parceiros">
              <span class="sharedMenuItemIcon">🤝</span>
              <span>Parceiros</span>
            </a>

            <div class="sharedMenuDivider"></div>

            <a class="sharedMenuItem" href="/profile">
              <span class="sharedMenuItemIcon">👤</span>
              <span>Perfil</span>
            </a>

            <button type="button" class="sharedMenuItem sharedMenuItemDanger" id="menuLogoutBtn">
              <span class="sharedMenuItemIcon">🚪</span>
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>

      <div class="sharedHeaderActions">
        <a class="sharedHeaderAction soft" href="/books">📚 Meus Livros</a>
        <a class="sharedHeaderAction primary" href="/create">✨ Criar Livro</a>
      </div>
    </div>
  </div>

  <div class="profilePageShell">
    <main class="wrap">
      <section class="hero" id="panel-overview">
        <div class="heroGrid">
          <div class="heroMain">
            <div class="eyebrow">✨ Minha área</div>
            <h2 class="heroTitle">Seu espaço para acompanhar sua conta, seus livros e sua carteira</h2>
            <div class="heroText">
              Veja seus livros, seus pedidos, seu saldo e faça seu check-in diário logo ao entrar.
            </div>

            <div class="heroActions">
              <button class="btn btnPrimary" id="btnGoWalletHero">🪙 Abrir carteira</button>
              <a class="btn btnSuccess" href="/create">✨ Criar novo livro mágico</a>
              <a class="btn btnSoft" href="/books">📚 Ver minha biblioteca</a>
              <a class="btn btnCoinsHelp" href="/coins-info">❓ Para que servem as moedas</a>
            </div>

            <div class="heroStats">
              <div class="stat wallet">
                <div class="statLabel">Saldo disponível</div>
                <div class="statValue" id="heroWalletBalance">—</div>
                <div class="statSub">Seu saldo atual na conta.</div>
              </div>

              <div class="stat level">
                <div class="statLabel">Nível da conta</div>
                <div class="statValue" id="heroWalletLevel">—</div>
                <div class="statSub" id="heroWalletLevelSub">—</div>
              </div>

              <div class="stat checkin">
                <div class="statLabel">Próximo check-in</div>
                <div class="statValue" id="heroCheckinReward">—</div>
                <div class="statSub">Faça o check-in diário para receber sua recompensa.</div>
              </div>
            </div>
          </div>

          <aside class="heroSide">
            <div class="profileCard">
              <div class="profileTop">
                <div class="avatar" id="avatar">🙂</div>
                <div style="min-width:0;">
                  <h3 class="profileName" id="name">Seu Perfil</h3>
                  <div class="profileMail" id="email">${email}</div>
                  <div class="profileMail" style="font-size:12px; margin-top:6px;">
                    ID: <span class="mono" id="uid">...</span>
                  </div>
                </div>
              </div>

              <div class="badgeRow" id="badgesRow"></div>

              <div class="progressCard">
                <div class="progressTop">
                  <div>
                    <div class="progressTitle">Conta</div>
                    <div class="progressText">Veja aqui o andamento do seu perfil.</div>
                  </div>
                  <span class="badge blue" id="profileProgressLabel">—%</span>
                </div>
                <div class="bar"><div id="profileBar"></div></div>
              </div>

              <div class="actionRow">
                <button class="btn btnInfo" id="btnGoWalletQuick">🪙 Carteira</button>
                <button class="btn btnSoft" id="btnGoOrdersQuick">🧾 Pedidos</button>
                <button class="btn btnSoft" id="btnGoBooksQuick">📚 Livros</button>
              </div>

              <div class="helpCoinsCard">
                <div class="helpCoinsEyebrow">🪙 Carteira</div>
                <h3 class="helpCoinsTitle">Ainda com dúvida sobre as moedas?</h3>
                <p class="helpCoinsText">
                  Veja uma explicação simples sobre como ganhar, comprar, acompanhar e sacar seu saldo.
                </p>
                <a class="helpCoinsBtn" href="/coins-info">Ver explicação das moedas</a>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="section" id="panel-wallet">
        <div class="sectionCard">
          <div class="sectionHead">
            <div>
              <div class="eyebrow">Carteira</div>
              <h2 class="sectionTitle">Use sua carteira para acompanhar saldo, check-in e movimentações da conta</h2>
              <div class="sectionText">
                Faça seu check-in diário, acompanhe seu saldo e veja suas movimentações em um só lugar.
              </div>
            </div>
            <div class="badgeRow">
              <span class="badge amber" id="walletLevelBadge">—</span>
              <span class="badge violet" id="walletStreakBadge">Sequência: 0</span>
            </div>
          </div>

          <div class="walletInfoBanner">
            <div class="walletInfoBannerText">
              <strong>Não entendeu ainda como as moedas funcionam?</strong>
              <span>Abra a página explicativa e veja para que servem, como obter e como acompanhar seu saldo.</span>
            </div>
            <a class="walletInfoBannerBtn" href="/coins-info">❓ Para que servem as moedas</a>
          </div>

          <div class="walletShell">
            <div class="walletMain">
              <div class="walletHead">
                <div>
                  <h3 class="panelTitle" style="margin:0;">Check-in diário</h3>
                  <div class="muted" style="margin-top:10px;">
                    Entre todos os dias para acompanhar sua sequência e receber sua recompensa.
                  </div>
                </div>

                <div class="badgeRow">
                  <span class="badge blue" id="levelProgressPct">—%</span>
                </div>
              </div>

              <div class="walletActions">
                <button class="btn btnSuccess" id="btnDailyCheckin">✅ Fazer check-in</button>
                <button class="btn btnPrimary" id="btnBuyWallet">➕ Comprar moedas</button>
                <button class="btn btnSoft" id="btnRefreshWallet">🔄 Atualizar</button>
              </div>

              <div class="weekTrack" id="weekTrack">
                <div class="dayDot">1</div>
                <div class="dayDot">2</div>
                <div class="dayDot">3</div>
                <div class="dayDot">4</div>
                <div class="dayDot">5</div>
                <div class="dayDot">6</div>
                <div class="dayDot">7</div>
              </div>

              <div class="tierGrid">
                <div class="tier" id="tier-bronze">
                  <div class="tierTitle">🥉 Bronze</div>
                  <div class="tierText">Check-in: 0,50 → 1,00</div>
                  <div class="tierText">Bônus de compra: 5%</div>
                </div>

                <div class="tier" id="tier-prata">
                  <div class="tierTitle">🥈 Prata</div>
                  <div class="tierText">Check-in: 0,75 → 1,15</div>
                  <div class="tierText">Bônus de compra: 8%</div>
                </div>

                <div class="tier" id="tier-ouro">
                  <div class="tierTitle">🥇 Ouro</div>
                  <div class="tierText">Check-in: 1,00 → 1,35</div>
                  <div class="tierText">Bônus de compra: 12%</div>
                </div>
              </div>

              <div class="progressCard" style="margin-top:16px;">
                <div class="progressTop">
                  <div>
                    <div class="progressTitle">Progresso do seu nível</div>
                    <div class="progressText" id="levelProgressText">—</div>
                  </div>
                </div>
                <div class="bar"><div id="levelProgressBar"></div></div>
              </div>
            </div>

            <div class="walletSide">
              <div class="summaryGrid" style="grid-template-columns:1fr; gap:14px;">
                <div class="miniCard purple">
                  <div class="miniCardLabel">Saldo disponível</div>
                  <div class="miniCardValue" id="walletAvailableText">—</div>
                  <div class="miniCardSub">Seu saldo atual.</div>
                </div>

                <div class="miniCard blue">
                  <div class="miniCardLabel">Pedidos válidos</div>
                  <div class="miniCardValue" id="walletOrdersText">—</div>
                  <div class="miniCardSub">Pedidos concluídos que contam para seu nível.</div>
                </div>

                <div class="miniCard pink">
                  <div class="miniCardLabel">Próximo check-in</div>
                  <div class="miniCardValue" id="walletCheckinText">—</div>
                  <div class="miniCardSub" id="walletCheckinPill">Recompensa diária</div>
                </div>
              </div>
            </div>
          </div>

          <div class="threeCols">
            <div class="panel softPurple">
              <h3 class="panelTitle">Resumo da carteira</h3>
              <div class="resumeList">
                <div class="resumeItem">
                  <span>Moedas vindas de pedidos</span>
                  <b id="resumeBaseCoins">—</b>
                </div>
                <div class="resumeItem">
                  <span>Moedas extras de check-in</span>
                  <b id="resumeBonusCoins">—</b>
                </div>
                <div class="resumeItem">
                  <span>Moedas adicionadas</span>
                  <b id="resumePurchasedCoins">—</b>
                </div>
                <div class="resumeItem">
                  <span>Saques registrados</span>
                  <b id="resumeWithdrawnCoins">—</b>
                </div>
                <div class="resumeItem total">
                  <span>Disponível agora</span>
                  <b id="resumeAvailableCoins">—</b>
                </div>
              </div>
            </div>

            <div class="panel softBlue">
              <h3 class="panelTitle">Seu ritmo atual</h3>
              <div class="resumeList">
                <div class="resumeItem">
                  <span>Último check-in</span>
                  <b id="resumeLastCheckin">—</b>
                </div>
                <div class="resumeItem">
                  <span>Sequência atual</span>
                  <b id="resumeStreak">—</b>
                </div>
                <div class="resumeItem">
                  <span>Ciclo atual</span>
                  <b id="resumeCycle">—</b>
                </div>
                <div class="resumeItem">
                  <span>PIX cadastrado</span>
                  <b id="resumePixStatus">—</b>
                </div>
              </div>
            </div>

            <div class="panel softPink">
              <h3 class="panelTitle">Ações rápidas</h3>
              <div class="muted" style="margin-top:12px;">
                Use sua carteira para acompanhar saldo, fazer check-in e acessar suas movimentações.
              </div>
              <div class="actionRow">
                <a class="linkBtn primaryLink" href="/create">✨ Criar novo livro</a>
                <a class="linkBtn infoLink" href="/parceiros">🔗 Conhecer parceiros</a>
                <a class="linkBtn coinsInfoLink" href="/coins-info">❓ Entender moedas</a>
              </div>
            </div>
          </div>

          <div class="panel" style="margin-top:18px;">
            <h3 class="panelTitle">Atividade recente</h3>
            <div class="activityList" id="walletActivityList"></div>
          </div>

          <div class="hint" id="hintWithdraw"></div>
          <div class="hint" id="hintBuy"></div>
        </div>
      </section>

      <section class="tabs">
        <div class="tabsInner">
          <button class="tab active" data-tab="overview">Visão geral</button>
          <button class="tab" data-tab="wallet">Carteira</button>
          <button class="tab" data-tab="books">Livros</button>
          <button class="tab" data-tab="orders">Pedidos</button>
          <button class="tab" data-tab="account">Conta</button>
        </div>
      </section>

      <section class="section" id="panel-overview-section">
        <div class="sectionCard">
          <div class="sectionHead">
            <div>
              <div class="eyebrow">Resumo</div>
              <h2 class="sectionTitle">Informações essenciais</h2>
              <div class="sectionText">
                Veja rapidamente os principais dados da sua conta.
              </div>
            </div>
            <div class="badgeRow">
              <span class="badge violet" id="profileBadge">Carregando…</span>
              <span class="badge blue" id="quickLevelBadge">—</span>
            </div>
          </div>

          <div class="summaryGrid">
            <div class="miniCard purple">
              <div class="miniCardLabel">Saldo disponível</div>
              <div class="miniCardValue" id="quickWalletBalance">—</div>
              <div class="miniCardSub">Seu saldo atual na conta.</div>
            </div>

            <div class="miniCard blue">
              <div class="miniCardLabel">Pedidos concluídos</div>
              <div class="miniCardValue" id="quickCompletedOrders">—</div>
              <div class="miniCardSub">Pedidos que contam para seu nível.</div>
            </div>

            <div class="miniCard pink">
              <div class="miniCardLabel">Próximo check-in</div>
              <div class="miniCardValue" id="quickCheckinReward">—</div>
              <div class="miniCardSub">Veja quanto você recebe no próximo check-in.</div>
            </div>

            <div class="miniCard amber">
              <div class="miniCardLabel">Livros na sua biblioteca</div>
              <div class="miniCardValue" id="quickBooksCount">—</div>
              <div class="miniCardSub">Quantidade de livros concluídos.</div>
            </div>
          </div>

          <div class="promoGrid">
            <div class="promoCard share">
              <span class="promoPill">🚀 Parceiros</span>
              <h3>Conheça formas de divulgar</h3>
              <p>
                Acesse a área de parceiros e veja as possibilidades disponíveis dentro da plataforma.
              </p>
              <div class="actionRow">
                <a class="linkBtn primaryLink" href="/parceiros">🔗 Ir para parceiros</a>
              </div>
            </div>

            <div class="promoCard magic">
              <span class="promoPill">💖 Novas histórias</span>
              <h3>Crie mais momentos especiais</h3>
              <p>
                Continue criando livros personalizados e guardando novas histórias na sua biblioteca.
              </p>
              <div class="actionRow">
                <a class="linkBtn primaryLink" href="/create">✨ Criar novo livro</a>
              </div>
            </div>
          </div>

          <div class="benefitGrid">
            <div class="benefitCard">
              <div class="benefitIcon purple">🎁</div>
              <div class="benefitTitle">Nível da conta</div>
              <div class="benefitText">
                Acompanhe seu nível e veja suas recompensas atuais.
              </div>
            </div>

            <div class="benefitCard">
              <div class="benefitIcon blue">📚</div>
              <div class="benefitTitle">Biblioteca</div>
              <div class="benefitText">
                Consulte seus livros finalizados sempre que quiser.
              </div>
            </div>

            <div class="benefitCard">
              <div class="benefitIcon pink">🌟</div>
              <div class="benefitTitle">Check-in diário</div>
              <div class="benefitText">
                Faça seu check-in e acompanhe sua sequência de dias.
              </div>
            </div>
          </div>

          <div class="twoCols">
            <div class="panel softPurple">
              <h3 class="panelTitle">Seu perfil</h3>
              <div class="muted" style="margin-top:12px;">
                Nome: <b id="profileName">—</b><br/>
                Criado em: <b id="profileCreated">—</b><br/>
                Atualizado em: <b id="profileUpdated">—</b>
              </div>

              <div class="actionRow">
                <button class="btn btnPrimary" id="btnGoWalletFromOverview">🪙 Ver carteira</button>
                <a class="linkBtn infoLink" href="/books">📚 Ir para meus livros</a>
              </div>
            </div>

            <div class="panel softBlue">
              <h3 class="panelTitle">Acesso rápido</h3>
              <div class="muted" style="margin-top:12px;">
                Entre direto nas áreas principais da sua conta.
              </div>

              <div class="actionRow">
                <button class="btn btnSoft" id="btnScrollWallet">🪙 Carteira</button>
                <button class="btn btnSoft" id="btnScrollBooks">📚 Livros</button>
                <button class="btn btnSoft" id="btnScrollOrders">🧾 Pedidos</button>
                <button class="btn btnSoft" id="btnScrollAccount">🔐 Conta</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="panel-books">
        <div class="sectionCard">
          <div class="sectionHead">
            <div>
              <div class="eyebrow">Livros</div>
              <h2 class="sectionTitle">Sua biblioteca de histórias especiais</h2>
              <div class="sectionText">
                Aqui ficam seus livros concluídos.
              </div>
            </div>

            <div class="actionRow" style="margin-top:0;">
              <a class="linkBtn primaryLink" href="/create">✨ Criar novo livro mágico</a>
              <button class="btn btnPrimary" id="btnRefreshBooks"><span id="refreshIconBooks">🔄</span> Atualizar</button>
            </div>
          </div>

          <div class="listTools">
            <div class="listCount" id="booksCountText">Carregando livros…</div>
          </div>

          <div class="hint" id="hintBooks"></div>
          <div class="grid" id="booksList"></div>
          <div class="sentinel" id="sentinelBooks"></div>
        </div>
      </section>

      <section class="section" id="panel-orders">
        <div class="sectionCard">
          <div class="sectionHead">
            <div>
              <div class="eyebrow">Pedidos</div>
              <h2 class="sectionTitle">Seus pedidos</h2>
              <div class="sectionText">
                Veja o histórico e o andamento dos seus pedidos.
              </div>
            </div>

            <div class="actionRow" style="margin-top:0;">
              <button class="btn btnPrimary" id="btnRefreshOrders"><span id="refreshIconOrders">🔄</span> Atualizar</button>
            </div>
          </div>

          <div class="listTools">
            <div class="listCount" id="ordersCountText">Carregando pedidos…</div>
          </div>

          <div class="hint" id="hintOrders"></div>
          <div class="grid" id="ordersList"></div>
          <div class="sentinel" id="sentinelOrders"></div>
        </div>
      </section>

      <section class="section" id="panel-account">
        <div class="sectionCard">
          <div class="sectionHead">
            <div>
              <div class="eyebrow">Conta</div>
              <h2 class="sectionTitle">Sua sessão e seus dados de acesso</h2>
              <div class="sectionText">
                Veja os dados principais da sua sessão atual, edite suas informações e finalize o acesso quando quiser.
              </div>
            </div>

            <div class="badgeRow">
              <span class="badge green" id="sessionBadge">Sessão ativa</span>
              <span class="badge blue" id="accountPixBadge">PIX: —</span>
            </div>
          </div>

          <div class="twoCols">
            <div class="panel softGreen">
              <h3 class="panelTitle">Sessão atual</h3>
              <div class="muted" style="margin-top:12px;">
                E-mail ativo: <b class="mono" id="sessionEmailText">${email}</b><br/>
                Estado da sessão: <b>Ativa</b><br/>
                Área atual: <b>Perfil</b>
              </div>

              <div class="actionRow">
                <button class="btn btnPrimary" id="btnEditAccount">✏️ Editar dados</button>
              </div>
            </div>

            <div class="panel softPink">
              <h3 class="panelTitle">Ações da conta</h3>
              <div class="muted" style="margin-top:12px;">
                Quando quiser entrar com outra conta, basta encerrar a sessão atual e acessar novamente.
              </div>

              <div class="actionRow">
                <button class="btn btnDanger" id="btnLogout">🚪 Sair da conta</button>
                <a class="linkBtn" href="/login">🔐 Ir para login</a>
              </div>
            </div>
          </div>

          <div class="threeCols">
            <div class="panel softPurple">
              <h3 class="panelTitle">Dados principais</h3>
              <div class="resumeList">
                <div class="resumeItem">
                  <span>Nome</span>
                  <b id="accountNameText">—</b>
                </div>
                <div class="resumeItem">
                  <span>E-mail</span>
                  <b id="accountEmailText">—</b>
                </div>
                <div class="resumeItem">
                  <span>Telefone</span>
                  <b id="accountPhoneText">—</b>
                </div>
              </div>
            </div>

            <div class="panel softBlue">
              <h3 class="panelTitle">PIX cadastrado</h3>
              <div class="resumeList">
                <div class="resumeItem">
                  <span>Tipo</span>
                  <b id="accountPixTypeText">—</b>
                </div>
                <div class="resumeItem">
                  <span>Titular</span>
                  <b id="accountPixHolderText">—</b>
                </div>
                <div class="resumeItem">
                  <span>Instituição</span>
                  <b id="accountPixBankText">—</b>
                </div>
              </div>
            </div>

            <div class="panel softGreen">
              <h3 class="panelTitle">Endereço</h3>
              <div class="resumeList">
                <div class="resumeItem">
                  <span>Resumo</span>
                  <b id="accountAddressText">—</b>
                </div>
                <div class="resumeItem">
                  <span>CEP</span>
                  <b id="accountZipText">—</b>
                </div>
                <div class="resumeItem">
                  <span>UF</span>
                  <b id="accountStateText">—</b>
                </div>
              </div>
            </div>
          </div>

          <div class="hint" id="hintLogout"></div>
          <div class="hint" id="hintAccount"></div>
        </div>
      </section>

      <div class="footerSpace"></div>
    </main>
  </div>

  <div class="toastWrap" id="toastWrap" aria-live="polite" aria-atomic="true"></div>

  <div class="modalBackdrop" id="logoutModal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="logoutTitle">
      <h3 id="logoutTitle">Sair da conta?</h3>
      <p>Você será desconectado e poderá entrar novamente quando quiser.</p>
      <div class="modalActions">
        <button class="btn btnSoft" id="btnCancelLogout">Cancelar</button>
        <button class="btn btnDanger" id="btnConfirmLogout">🚪 Confirmar saída</button>
      </div>
      <div class="hint" id="hintLogoutModal"></div>
    </div>
  </div>

  <div class="modalBackdrop" id="withdrawModal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="withdrawTitle">
      <h3 id="withdrawTitle">Sacar moedas</h3>
      <p id="withdrawIntroText">Registre uma solicitação de saque da sua carteira.</p>

      <div class="field">
        <label for="withdrawAmount">Quantidade de moedas</label>
        <input id="withdrawAmount" type="number" min="0.01" step="0.01" placeholder="Ex.: 20" />
      </div>

      <div id="withdrawPixFields">
        <div class="field">
          <label for="withdrawPixType">Tipo de chave PIX</label>
          <input id="withdrawPixType" type="text" placeholder="cpf, cnpj, email, telefone ou aleatoria" />
        </div>

        <div class="field">
          <label for="withdrawPixKey">Chave PIX</label>
          <input id="withdrawPixKey" type="text" placeholder="Informe sua chave PIX" />
        </div>

        <div class="field">
          <label for="withdrawPixHolderName">Nome do titular</label>
          <input id="withdrawPixHolderName" type="text" placeholder="Nome completo do titular" />
        </div>

        <div class="field">
          <label for="withdrawPixBankName">Instituição da conta</label>
          <input id="withdrawPixBankName" type="text" placeholder="Ex.: Nubank, Caixa, Banco do Brasil" />
        </div>

        <div class="field">
          <label for="withdrawPixHolderDocument">CPF/CNPJ do titular</label>
          <input id="withdrawPixHolderDocument" type="text" placeholder="Somente números" />
        </div>
      </div>

      <div class="field">
        <label for="withdrawNote">Observação</label>
        <input id="withdrawNote" type="text" placeholder="Ex.: saque do saldo acumulado" />
      </div>

      <div class="hint" id="hintWithdrawModal"></div>

      <div class="modalActions">
        <button class="btn btnSoft" id="btnCloseWithdraw">Cancelar</button>
        <button class="btn btnPrimary" id="btnConfirmWithdraw">Confirmar saque</button>
      </div>
    </div>
  </div>

  <div class="modalBackdrop" id="buyModal">
    <div class="buyPopup" role="dialog" aria-modal="true" aria-labelledby="buyTitle">
      <div class="buyPopupScroll">
        <div class="buyPopupHero">
          <div class="buyPopupHeroGlow buyPopupHeroGlowA"></div>
          <div class="buyPopupHeroGlow buyPopupHeroGlowB"></div>

          <div class="buyPopupTop">
            <div class="buyPopupIntro">
              <div class="buyPopupEyebrow">🪙 Recarregue sua carteira</div>
              <h3 id="buyTitle">Escolha o pacote ideal e continue criando sem parar</h3>
              <p class="buyPopupDesc">
                Mais saldo, mais liberdade e bônus extra de acordo com o seu nível atual.
              </p>

              <div class="buyPopupTrust">
                <span>✨ Liberação rápida</span>
                <span>🔒 Pagamento seguro</span>
                <span>🎁 Bônus no pacote</span>
              </div>
            </div>

            <div class="buyPopupLevel">
              <div class="buyPopupLevelMini">Seu nível</div>
              <div class="buyPopupLevelName" id="buyCurrentLevelText">—</div>
              <div class="buyPopupLevelBonus">
                Bônus de compra:
                <strong id="buyBonusPercentText">—</strong>
              </div>
              <div class="buyPopupLevelBadge" id="buyLevelBadgeModal">Nível atual: —</div>
            </div>
          </div>

          <div class="buyPopupHighlights">
            <div class="buyPopupHighlight">
              <small>Entrada</small>
              <strong>Essencial</strong>
            </div>
            <div class="buyPopupHighlight buyPopupHighlightHot">
              <small>Mais escolhido</small>
              <strong>Pacote Pro</strong>
            </div>
            <div class="buyPopupHighlight">
              <small>Maior saldo</small>
              <strong>Master</strong>
            </div>
          </div>
        </div>

        <div class="buyPopupGrid">
          <div class="buyOption buyOptionEssencial">
            <div class="buyOptionTop">
              <span class="buyOptionTag">Entrada</span>
              <span class="buyOptionMini">Ideal para começar</span>
            </div>

            <div class="buyOptionTitle">Pacote Essencial</div>
            <div class="buyOptionCoins">10 moedas</div>
            <div class="buyOptionBonus" id="bonus-pack-10">+ bônus do seu nível</div>

            <div class="buyOptionPrice">
              <strong>R$ 10</strong>
            </div>

            <div class="buyOptionTotal" id="total-pack-10">Você recebe — moedas</div>

            <ul class="buyOptionList">
              <li>Entrada mais leve</li>
              <li>Compra rápida</li>
              <li>Bom para testar</li>
            </ul>

            <button class="buyOptionBtn buyOptionBtnSoft buyPackBtn" data-pack="10">
              Escolher Essencial
            </button>
          </div>

          <div class="buyOption buyOptionFeatured">
            <div class="buyOptionRibbon">⭐ Melhor escolha</div>

            <div class="buyOptionTop">
              <span class="buyOptionTag buyOptionTagHot">Mais popular</span>
              <span class="buyOptionMini buyOptionMiniHot">Melhor custo-benefício</span>
            </div>

            <div class="buyOptionTitle">Pacote Pro</div>
            <div class="buyOptionCoins">25 moedas</div>
            <div class="buyOptionBonus" id="bonus-pack-25">+ bônus do seu nível</div>

            <div class="buyOptionPrice">
              <span class="buyOptionOld">R$ 30</span>
              <strong>R$ 25</strong>
            </div>

            <div class="buyOptionTotal buyOptionTotalFeatured" id="total-pack-25">
              Você recebe — moedas
            </div>

            <ul class="buyOptionList">
              <li>Melhor equilíbrio entre valor e custo</li>
              <li>Mais saldo por compra</li>
              <li>Ideal para uso frequente</li>
            </ul>

            <button class="buyOptionBtn buyOptionBtnPrimary buyPackBtn" data-pack="25">
              Quero o Pro
            </button>
          </div>

          <div class="buyOption buyOptionTurbo">
            <div class="buyOptionTop">
              <span class="buyOptionTag">Avançado</span>
              <span class="buyOptionMini">Uso recorrente</span>
            </div>

            <div class="buyOptionTitle">Pacote Turbo</div>
            <div class="buyOptionCoins">50 moedas</div>
            <div class="buyOptionBonus" id="bonus-pack-50">+ bônus do seu nível</div>

            <div class="buyOptionPrice">
              <span class="buyOptionOld">R$ 60</span>
              <strong>R$ 50</strong>
            </div>

            <div class="buyOptionTotal" id="total-pack-50">Você recebe — moedas</div>

            <ul class="buyOptionList">
              <li>Mais autonomia</li>
              <li>Ótimo para uso contínuo</li>
              <li>Maior percepção de economia</li>
            </ul>

            <button class="buyOptionBtn buyOptionBtnInfo buyPackBtn" data-pack="50">
              Escolher Turbo
            </button>
          </div>

          <div class="buyOption buyOptionMaster">
            <div class="buyOptionTop">
              <span class="buyOptionTag">Máximo</span>
              <span class="buyOptionMini">Maior saldo</span>
            </div>

            <div class="buyOptionTitle">Pacote Master</div>
            <div class="buyOptionCoins">100 moedas</div>
            <div class="buyOptionBonus" id="bonus-pack-100">+ bônus do seu nível</div>

            <div class="buyOptionPrice">
              <span class="buyOptionOld">R$ 120</span>
              <strong>R$ 100</strong>
            </div>

            <div class="buyOptionTotal" id="total-pack-100">Você recebe — moedas</div>

            <ul class="buyOptionList">
              <li>Maior volume de saldo</li>
              <li>Máximo aproveitamento do bônus</li>
              <li>Menos interrupções para recarga</li>
            </ul>

            <button class="buyOptionBtn buyOptionBtnSuccess buyPackBtn" data-pack="100">
              Quero o Master
            </button>
          </div>
        </div>

        <div class="buyPopupFooter">
          <div class="buyPopupFooterText">
            O total exibido em cada pacote já considera o bônus do seu nível atual.
          </div>
        </div>

        <div class="hint" id="hintBuyModal"></div>

        <div class="buyPopupActions">
          <button class="btn btnSoft" id="btnCloseBuy">Fechar</button>
        </div>
      </div>
    </div>
  </div>

  <div class="modalBackdrop" id="verifyPasswordModal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="verifyPasswordTitle">
      <h3 id="verifyPasswordTitle">Confirmar identidade</h3>
      <p>Para editar seus dados, confirme sua senha atual.</p>

      <div class="field">
        <label for="verifyPasswordInput">Senha atual</label>
        <input id="verifyPasswordInput" type="password" placeholder="Digite sua senha atual" />
      </div>

      <div class="hint" id="hintVerifyPasswordModal"></div>

      <div class="modalActions">
        <button class="btn btnSoft" id="btnCloseVerifyPassword">Cancelar</button>
        <button class="btn btnPrimary" id="btnConfirmVerifyPassword">Confirmar</button>
      </div>
    </div>
  </div>

  <div class="modalBackdrop" id="editAccountModal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="editAccountTitle">
      <h3 id="editAccountTitle">Editar dados da conta</h3>
      <p>Atualize suas informações principais, PIX, endereço e senha.</p>

      <div class="field">
        <label for="editName">Nome</label>
        <input id="editName" type="text" placeholder="Seu nome completo" />
      </div>

      <div class="field">
        <label for="editEmail">E-mail</label>
        <input id="editEmail" type="email" placeholder="Seu melhor e-mail" />
      </div>

      <div class="field">
        <label for="editPhone">Telefone</label>
        <input id="editPhone" type="text" placeholder="Ex.: 67999999999" />
      </div>

      <div class="field">
        <label for="editNewPassword">Nova senha</label>
        <input id="editNewPassword" type="password" placeholder="Preencha somente se quiser trocar a senha" />
      </div>

      <div class="field">
        <label for="editPixType">Tipo de chave PIX</label>
        <input id="editPixType" type="text" placeholder="cpf, cnpj, email, telefone ou aleatoria" />
      </div>

      <div class="field">
        <label for="editPixKey">Chave PIX</label>
        <input id="editPixKey" type="text" placeholder="Informe sua chave PIX" />
      </div>

      <div class="field">
        <label for="editPixHolderName">Nome do titular</label>
        <input id="editPixHolderName" type="text" placeholder="Nome completo do titular" />
      </div>

      <div class="field">
        <label for="editPixBankName">Instituição da conta</label>
        <input id="editPixBankName" type="text" placeholder="Ex.: Nubank, Caixa, Banco do Brasil" />
      </div>

      <div class="field">
        <label for="editPixHolderDocument">CPF/CNPJ do titular</label>
        <input id="editPixHolderDocument" type="text" placeholder="Somente números" />
      </div>

      <div class="field">
        <label for="editAddressStreet">Rua</label>
        <input id="editAddressStreet" type="text" placeholder="Rua / Avenida" />
      </div>

      <div class="field">
        <label for="editAddressNumber">Número</label>
        <input id="editAddressNumber" type="text" placeholder="Número" />
      </div>

      <div class="field">
        <label for="editAddressDistrict">Bairro</label>
        <input id="editAddressDistrict" type="text" placeholder="Bairro" />
      </div>

      <div class="field">
        <label for="editAddressCity">Cidade</label>
        <input id="editAddressCity" type="text" placeholder="Cidade" />
      </div>

      <div class="field">
        <label for="editAddressState">UF</label>
        <input id="editAddressState" type="text" placeholder="UF" />
      </div>

      <div class="field">
        <label for="editAddressZip">CEP</label>
        <input id="editAddressZip" type="text" placeholder="CEP" />
      </div>

      <div class="field">
        <label for="editAddressComplement">Complemento</label>
        <input id="editAddressComplement" type="text" placeholder="Complemento" />
      </div>

      <div class="hint" id="hintEditAccountModal"></div>

      <div class="modalActions">
        <button class="btn btnSoft" id="btnCloseEditAccount">Cancelar</button>
        <button class="btn btnPrimary" id="btnSaveEditAccount">Salvar alterações</button>
      </div>
    </div>
  </div>

<script>
(function(){
  function closeAllSharedMenus(exceptId){
    document.querySelectorAll("[data-shared-menu-panel]").forEach(function(panel){
      if (exceptId && panel.id === exceptId) return;
      panel.classList.remove("open");
    });

    document.querySelectorAll("[data-shared-menu-toggle]").forEach(function(btn){
      var controls = btn.getAttribute("aria-controls") || "";
      var expanded = exceptId && controls === exceptId ? "true" : "false";
      btn.setAttribute("aria-expanded", expanded);
    });
  }

  document.querySelectorAll("[data-shared-menu-toggle]").forEach(function(toggle){
    if (toggle.__sharedMenuBound) return;
    toggle.__sharedMenuBound = true;

    toggle.addEventListener("click", function(e){
      e.stopPropagation();
      var panelId = toggle.getAttribute("aria-controls");
      var panel = panelId ? document.getElementById(panelId) : null;
      if (!panel) return;

      var willOpen = !panel.classList.contains("open");
      closeAllSharedMenus();
      if (willOpen) {
        panel.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      } else {
        panel.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  });

  document.querySelectorAll("[data-shared-menu-panel]").forEach(function(panel){
    if (panel.__sharedMenuPanelBound) return;
    panel.__sharedMenuPanelBound = true;
    panel.addEventListener("click", function(e){
      e.stopPropagation();
    });
  });

  document.addEventListener("click", function(){
    closeAllSharedMenus();
  });

  document.addEventListener("keydown", function(e){
    if (e.key === "Escape") closeAllSharedMenus();
  });

  var menuLogoutBtn = document.getElementById("menuLogoutBtn");
  if (menuLogoutBtn) {
    menuLogoutBtn.addEventListener("click", function(){
      var btn = document.getElementById("btnLogout");
      if (btn) btn.click();
      closeAllSharedMenus();
    });
  }
})();
${pageJs}
</script>
</body>
</html>`;
}