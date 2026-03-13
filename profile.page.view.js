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
</style>
</head>
<body>
  <header class="topbar">
    <div class="topbarInner">
      <div class="brand">
        <div class="brandMark">📖</div>
        <div>
          <h1 class="brandTitle">Meu Livro Mágico</h1>
          <div class="brandSub">Sua conta, seus livros e seus momentos especiais em um só lugar</div>
        </div>
      </div>

      <div class="topActions">
        <span class="chip">
          <span class="mono">${email}</span>
        </span>

        <a class="btn btnSoft" href="/sales" id="btnGoHome">🏠 Início</a>
        <button class="btn btnSoft" id="btnTopLogout">🚪 Sair</button>
      </div>
    </div>
  </header>

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
              <button class="btn btnInfo" id="btnWithdrawWallet">⬆️ Sacar moedas</button>
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
    <div class="modal buyModalWide buyModalSales" role="dialog" aria-modal="true" aria-labelledby="buyTitle">
      <div class="buyModalShell">
        <div class="buyHero">
          <div class="buyHeroGlow buyHeroGlow1"></div>
          <div class="buyHeroGlow buyHeroGlow2"></div>

          <div class="buyHeroTop">
            <div class="buyHeroContent">
              <div class="buyEyebrow">🪙 Recarregue sua carteira</div>
              <h3 id="buyTitle">Escolha seu pacote e continue criando histórias sem parar</h3>
              <p class="buyHeroText">
                Ganhe mais saldo, aproveite o bônus do seu nível e escolha a opção com melhor vantagem para você.
              </p>

              <div class="buyTrustRow">
                <span class="buyTrustPill">✨ Liberação rápida</span>
                <span class="buyTrustPill">🔒 Pagamento seguro</span>
                <span class="buyTrustPill">🎁 Bônus do seu nível</span>
              </div>
            </div>

            <div class="buyLevelBox">
              <div class="buyLevelLabel">Seu nível atual</div>
              <div class="buyLevelValue" id="buyCurrentLevelText">—</div>
              <div class="buyLevelSub">
                bônus de compra:
                <strong id="buyBonusPercentText">—</strong>
              </div>
              <div class="buyLevelBadge" id="buyLevelBadgeModal">Nível atual: —</div>
            </div>
          </div>

          <div class="buyInfoStrip">
            <div class="buyInfoItem">
              <span class="buyInfoLabel">Para testar</span>
              <strong>Essencial</strong>
            </div>
            <div class="buyInfoItem buyInfoFeatured">
              <span class="buyInfoLabel">Mais escolhido</span>
              <strong>Pacote Pro</strong>
            </div>
            <div class="buyInfoItem">
              <span class="buyInfoLabel">Maior saldo</span>
              <strong>Master</strong>
            </div>
          </div>
        </div>

        <div class="buyGrid buyGridEnhanced">
          <div class="buyCard buyCardLite">
            <div class="buyCardHead">
              <div class="buyTag">Entrada</div>
              <div class="buyMiniBadge">Ideal para começar</div>
            </div>

            <div class="buyCardTitle">Pacote Essencial</div>
            <div class="buyCardSub">10 moedas</div>
            <div class="buyCardBonus" id="bonus-pack-10">+ bônus do seu nível</div>

            <div class="buyCardPrice">
              <span class="buyPriceNow">R$ 10</span>
            </div>

            <div class="buyCardTotal" id="total-pack-10">Você recebe — moedas</div>

            <ul class="buyFeatureList">
              <li>Entrada mais leve</li>
              <li>Compra rápida</li>
              <li>Bom para testar</li>
            </ul>

            <div class="buyCardFooter">
              <button class="btn btnSoft buyPackBtn" data-pack="10">Escolher Essencial</button>
            </div>
          </div>

          <div class="buyCard buyCardFeatured">
            <div class="buyRibbon">⭐ Melhor escolha</div>

            <div class="buyCardHead">
              <div class="buyTag buyTagHot">Mais popular</div>
              <div class="buyMiniBadge buyMiniBadgeHot">Mais vantagem</div>
            </div>

            <div class="buyCardTitle">Pacote Pro</div>
            <div class="buyCardSub">25 moedas</div>
            <div class="buyCardBonus" id="bonus-pack-25">+ bônus do seu nível</div>

            <div class="buyCardPrice">
              <span class="buyPriceOld">R$ 30</span>
              <span class="buyPriceNow">R$ 25</span>
            </div>

            <div class="buyCardTotal buyCardTotalFeatured" id="total-pack-25">Você recebe — moedas</div>

            <ul class="buyFeatureList">
              <li>Melhor equilíbrio entre valor e custo</li>
              <li>Mais saldo por compra</li>
              <li>Ideal para quem cria com frequência</li>
            </ul>

            <div class="buyCardFooter">
              <button class="btn btnPrimary buyPackBtn" data-pack="25">Quero o Pro</button>
            </div>
          </div>

          <div class="buyCard buyCardStrong">
            <div class="buyCardHead">
              <div class="buyTag">Avançado</div>
              <div class="buyMiniBadge">Uso recorrente</div>
            </div>

            <div class="buyCardTitle">Pacote Turbo</div>
            <div class="buyCardSub">50 moedas</div>
            <div class="buyCardBonus" id="bonus-pack-50">+ bônus do seu nível</div>

            <div class="buyCardPrice">
              <span class="buyPriceOld">R$ 60</span>
              <span class="buyPriceNow">R$ 50</span>
            </div>

            <div class="buyCardTotal" id="total-pack-50">Você recebe — moedas</div>

            <ul class="buyFeatureList">
              <li>Mais autonomia na conta</li>
              <li>Excelente para uso contínuo</li>
              <li>Percepção forte de economia</li>
            </ul>

            <div class="buyCardFooter">
              <button class="btn btnInfo buyPackBtn" data-pack="50">Escolher Turbo</button>
            </div>
          </div>

          <div class="buyCard buyCardDark">
            <div class="buyCardHead">
              <div class="buyTag">Máximo</div>
              <div class="buyMiniBadge">Maior saldo</div>
            </div>

            <div class="buyCardTitle">Pacote Master</div>
            <div class="buyCardSub">100 moedas</div>
            <div class="buyCardBonus" id="bonus-pack-100">+ bônus do seu nível</div>

            <div class="buyCardPrice">
              <span class="buyPriceOld">R$ 120</span>
              <span class="buyPriceNow">R$ 100</span>
            </div>

            <div class="buyCardTotal" id="total-pack-100">Você recebe — moedas</div>

            <ul class="buyFeatureList">
              <li>Saldo para uso intenso</li>
              <li>Maior aproveitamento do bônus</li>
              <li>Menos interrupções para recarregar</li>
            </ul>

            <div class="buyCardFooter">
              <button class="btn btnSuccess buyPackBtn" data-pack="100">Quero o Master</button>
            </div>
          </div>
        </div>

        <div class="buyFooterNote">
          <div class="buyFooterText">
            O total mostrado em cada pacote já considera o bônus do seu nível atual.
          </div>
        </div>

        <div class="hint" id="hintBuyModal"></div>

        <div class="modalActions buyModalActions">
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
${pageJs}
</script>
</body>
</html>`;
}