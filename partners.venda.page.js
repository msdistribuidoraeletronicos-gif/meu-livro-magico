/**
 * partners.venda.page.js — Parceiros (Venda)
 * UNIFICADO: usa as funções JWT do shared para autenticação.
 */
"use strict";

const { buildPartnersShared } = require("./partners.shared");

module.exports = function mountPartnersVenda(app, opts = {}) {
  const shared = buildPartnersShared(app, opts);
  const {
    isDev,
    supabase,
    layout,
    esc,
    moneyBR,
    statusLabel,
    hashPassword,
    COOKIE_SECRET,
    setPartnerCookie,
    requirePartner,
    requirePartnerAuthForId,
    getBaseUrl,
  } = shared;

  // =========================
  // CADASTRO — somente Venda
  // =========================
  app.get("/parceiros/cadastro", (req, res, next) => {
    const tipo = String(req.query.tipo || "").toLowerCase();
    if (tipo !== "venda") return next();

    const title = "Cadastro — Venda";

    const campoSegmento = `
      <label>Seu negócio (escreva)</label>
      <input name="segmento_texto" placeholder="Ex.: presentes, mercado, personalizados, livraria…" required/>
      <div class="muted" style="margin-top:6px;">Isso ajuda a entender seu público e sugerir melhores formas de divulgação.</div>
    `;

    return res.type("html").send(
      layout(
        title,
        `
<style>
  :root{
    --c-trust: rgba(84, 169, 255, .95);  /* azul = confiança */
    --c-okay:  rgba(40, 200, 120, .95);  /* verde = ação */
    --c-warn:  rgba(255, 193, 7, .95);   /* atenção */
    --c-urg:   rgba(255, 82, 82, .95);   /* urgência (uso pontual) */
  }

  .wrap{max-width:980px;margin:0 auto}
  .hero{
    border:1px solid rgba(255,255,255,.10);
    background:linear-gradient(135deg, rgba(84,169,255,.12), rgba(255,82,173,.10));
    border-radius:18px;
    padding:16px;
    margin-bottom:14px;
  }
  .heroTop{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .heroTitle{font-weight:1000;font-size:20px;letter-spacing:-0.02em}
  .heroSub{margin-top:6px;opacity:.9}
  .heroBadge{
    padding:8px 10px;border-radius:999px;
    border:1px solid rgba(255,255,255,.14);
    background:rgba(255,255,255,.06);
    font-weight:1000;font-size:12px;
  }

  .bar{height:10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);overflow:hidden}
  .barFill{
    height:100%;
    width:0%;
    background:linear-gradient(90deg, rgba(84,169,255,.9), rgba(40,200,120,.85));
    border-radius:999px;
    transition:width .25s ease;
  }
  .progressRow{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px}
  .progressText{font-size:12px;opacity:.85}

  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:860px){.grid2{grid-template-columns:1fr}}
  .miniCard{
    border:1px solid rgba(255,255,255,.10);
    background:rgba(0,0,0,.16);
    border-radius:16px;
    padding:12px;
  }
  .miniTitle{font-weight:1000;margin-bottom:6px}
  .miniLine{display:flex;gap:10px;align-items:flex-start}
  .miniLine .dot{margin-top:6px;width:8px;height:8px;border-radius:99px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.16)}
  .miniLine b{font-weight:1000}

  .inlineHint{
    margin-top:10px;
    border-radius:14px;
    padding:12px;
    border:1px solid rgba(255,255,255,.10);
    background:rgba(255,255,255,.04);
  }
  .inlineHint b{font-weight:1000}

  /* Toast (feedback imediato e limpo) */
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
    animation:toastIn .20s ease forwards;
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

  .btnPrimary.soft{box-shadow:0 0 0 0 rgba(0,0,0,0)}
  .btnPrimary.soft:hover{transform:translateY(-1px)}
</style>

<div class="wrap">

  <div class="hero">
    <div class="heroTop">
      <div>
        <div class="heroTitle">Parceiro — Venda 🧲</div>
        <div class="heroSub p">
          Você ganha <b>10%</b> em cada compra feita pelo seu link. Seu painel mostra histórico e ganhos.
        </div>
      </div>
      <div class="heroBadge">Cadastro rápido • 1 minuto</div>
    </div>

    <div class="progressRow">
      <div style="flex:1">
        <div class="bar"><div class="barFill" id="barFill"></div></div>
      </div>
      <div class="progressText" id="progressText">0% completo</div>
    </div>
  </div>

  <div class="grid2">
    <div class="miniCard">
      <div class="miniTitle">Como você ganha</div>
      <div class="miniLine"><span class="dot"></span><div>Seu link rastreia a compra automaticamente.</div></div>
      <div class="miniLine"><span class="dot"></span><div>Você recebe <b>10%</b> do total de cada compra pelo link.</div></div>
      <div class="miniLine"><span class="dot"></span><div>Seus ganhos aparecem no painel em <b>Meu caixa</b>.</div></div>
    </div>

    <div class="miniCard">
      <div class="miniTitle">Dicas rápidas (opcional)</div>
      <div class="miniLine"><span class="dot"></span><div>Coloque o link na <b>bio</b> do Instagram.</div></div>
      <div class="miniLine"><span class="dot"></span><div>Use em status do WhatsApp e stories.</div></div>
      <div class="miniLine"><span class="dot"></span><div>Envie para clientes que compram presentes.</div></div>
    </div>
  </div>

  <div style="height:14px"></div>

  <div class="card">
    <div class="h1">Cadastro de Parceiro — Venda 🧲</div>
    <p class="p">Preencha seus dados para criar seu perfil de parceiro.</p>
    <div style="height:14px"></div>

    <form method="POST" action="/parceiros/cadastro" id="cadForm" novalidate>
      <input type="hidden" name="tipo" value="venda"/>

      <div class="formRow">
        <div>
          <label>Nome do responsável</label>
          <input name="responsavel" placeholder="Seu nome" required/>
        </div>
        <div>
          <label>Nome do negócio</label>
          <input name="negocio" placeholder="Ex.: Loja da Maria" required/>
        </div>
      </div>

      <div style="height:12px"></div>

      <div class="formRow">
        <div>${campoSegmento}</div>
        <div>
          <label>WhatsApp</label>
          <input name="whatsapp" placeholder="(DDD) 9xxxx-xxxx" required/>
        </div>
      </div>

      <div style="height:12px"></div>

      <div class="formRow">
        <div>
          <label>E-mail</label>
          <input type="email" name="email" placeholder="seuemail@exemplo.com" required/>
        </div>
        <div>
          <label>Cidade/UF</label>
          <input name="cidade" placeholder="Ex.: Aquidauana - MS" required/>
        </div>
      </div>

      <div style="height:12px"></div>

      <div class="formRow">
        <div>
          <label>Endereço</label>
          <input name="endereco" placeholder="Rua, nº, bairro" required/>
        </div>
        <div>
          <label>CEP</label>
          <input name="cep" placeholder="00000-000" required/>
        </div>
      </div>

      <div style="height:12px"></div>

      <div class="formRow">
        <div>
          <label>Senha (para acessar seu painel)</label>
          <input type="password" name="senha" placeholder="Crie uma senha" minlength="6" required/>
          <div class="muted" style="margin-top:6px;">Mínimo recomendado: 6+ caracteres.</div>
        </div>
        <div>
          <label>Confirmar senha</label>
          <input type="password" name="senha2" placeholder="Repita a senha" minlength="6" required/>
        </div>
      </div>

      <div class="inlineHint">
        <b>Confirmação:</b> ao salvar, você já entra no painel e consegue copiar seu link de divulgação.
      </div>

      <div style="height:12px"></div>

      <div>
        <label>Observações</label>
        <textarea name="obs" placeholder="Horário, referências, etc."></textarea>
      </div>

      <div style="height:16px"></div>

      <button class="btn btnPrimary soft" type="submit" id="submitBtn">Criar meu perfil</button>
      <a class="btn btnOutline" href="/parceiros" style="margin-left:10px;">Voltar</a>
    </form>
  </div>

</div>

<div class="toasts" id="toasts" aria-live="polite" aria-atomic="true"></div>

<script>
(function(){
  const form = document.getElementById('cadForm');
  const bar = document.getElementById('barFill');
  const text = document.getElementById('progressText');
  const submitBtn = document.getElementById('submitBtn');
  const toasts = document.getElementById('toasts');

  function toast(type, title, msg, ms){
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = \`
      <div class="toastTop">
        <div class="toastTitle">\${title || 'Aviso'}</div>
        <button class="x" type="button" aria-label="Fechar">✕</button>
      </div>
      \${msg ? \`<div class="toastMsg">\${msg}</div>\` : ''}
    \`;
    el.querySelector('.x').addEventListener('click', () => el.remove());
    toasts.appendChild(el);
    setTimeout(() => { try{ el.remove(); }catch(e){} }, (typeof ms==='number'?ms:2600));
  }

  const requiredNames = [
    'responsavel','negocio','segmento_texto','whatsapp','email','cidade','endereco','cep','senha','senha2'
  ];

  function calcProgress(){
    let filled = 0;
    for(const n of requiredNames){
      const inp = form.querySelector('[name="'+n+'"]');
      if(!inp) continue;
      const v = String(inp.value || '').trim();
      if(v) filled++;
    }
    const pct = Math.round((filled / requiredNames.length) * 100);
    if(bar) bar.style.width = pct + '%';
    if(text) text.textContent = pct + '% completo';
  }

  function validateSoft(){
    const senha = String(form.querySelector('[name="senha"]').value || '');
    const senha2 = String(form.querySelector('[name="senha2"]').value || '');
    if(senha.length && senha.length < 6){
      toast('warn','Senha curta','Use pelo menos 6 caracteres.', 3200);
      return false;
    }
    if(senha && senha2 && senha !== senha2){
      toast('bad','Senhas não conferem','Confira a confirmação da senha.', 3400);
      return false;
    }
    return true;
  }

  form.addEventListener('input', calcProgress);
  form.addEventListener('change', calcProgress);
  calcProgress();

  form.addEventListener('submit', (ev) => {
    if(!validateSoft()){
      ev.preventDefault();
      return;
    }
    submitBtn.disabled = true;
    submitBtn.dataset.old = submitBtn.textContent;
    submitBtn.textContent = 'Criando…';
  });

})();
</script>
      `
      )
    );
  });

  app.post("/parceiros/cadastro", async (req, res, next) => {
    const tipo = String(req.body.tipo || "").toLowerCase();
    if (tipo !== "venda") return next();

    try {
      const responsavel = String(req.body.responsavel || "").trim();
      const negocio = String(req.body.negocio || "").trim();
      const whatsapp = String(req.body.whatsapp || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const cidade = String(req.body.cidade || "").trim();
      const endereco = String(req.body.endereco || "").trim();
      const cep = String(req.body.cep || "").trim();
      const obs = String(req.body.obs || "").trim();
      const segmento = String(req.body.segmento_texto || "").trim();

      const senha = String(req.body.senha || "");
      const senha2 = String(req.body.senha2 || "");
      if (!senha || senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      if (senha !== senha2) throw new Error("As senhas não conferem.");

      const { data: exists, error: exErr } = await supabase.from("partners").select("id").eq("email", email).maybeSingle();
      if (exErr) console.error("[partners] check email error:", exErr);

      if (exists?.id) {
        return res.status(409).type("html").send(
          layout(
            "E-mail já cadastrado",
            `
            <div class="card">
              <div class="h1">E-mail já cadastrado</div>
              <p class="p">Esse e-mail já tem um parceiro registrado. Faça login para acessar.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/login">Ir para Login</a>
              <a class="btn btnOutline" href="/parceiros/esqueci" style="margin-left:10px;">Esqueci a senha</a>
            </div>
          `
          )
        );
      }

      const parceiroRow = {
        tipo: "venda",
        responsavel,
        negocio,
        segmento: segmento || null,
        whatsapp,
        email,
        cidade,
        endereco,
        cep,
        obs: obs || null,

        password_hash: hashPassword(senha),

        comissao_venda_percent: 10,
        fabricacao_por_pedido: 0,
        entrega_por_pedido: 0,
      };

      const { data, error } = await supabase.from("partners").insert(parceiroRow).select("*").single();
      if (error) {
        console.error("[partners] INSERT partners error:", error);
        throw error;
      }

      if (!COOKIE_SECRET && !isDev) throw new Error("Defina PARTNER_COOKIE_SECRET no ambiente de produção.");

      setPartnerCookie(res, data.id); // JWT unificado

      res.setHeader("Cache-Control", "no-store");
      return res.redirect(303, `/parceiros/perfil/${encodeURIComponent(data.id)}`);
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] cadastro (venda) erro:", msg);

      return res.status(500).type("html").send(
        layout(
          "Erro",
          `
          <div class="card">
            <div class="h1">Ops…</div>
            <p class="p">Não foi possível criar seu perfil agora. Tente novamente.</p>
            ${isDev ? `<div class="err">DEV ERROR:\n${esc(msg)}</div>` : ``}
            <div style="height:14px"></div>
            <a class="btn btnPrimary" href="/parceiros">Voltar para Central</a>
          </div>
        `
        )
      );
    }
  });

  // =========================
  // PERFIL — painel (Venda)
  // =========================
  app.get("/parceiros/perfil/:id", requirePartner, async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const id = String(req.params.id || "").trim();
      if (!id) return res.redirect("/parceiros");

      // Verifica permissão
      if (String(req.partnerId) !== String(id)) {
        return res.status(403).type("html").send(
          layout(
            "Acesso negado",
            `<div class="card"><h1>403</h1><p>Você não tem permissão para acessar este perfil.</p><a href="/parceiros">Voltar</a></div>`
          )
        );
      }

      const { data: p, error: pErr } = await supabase.from("partners").select("*").eq("id", id).single();
      if (pErr || !p) return res.redirect("/parceiros");

      // Busca pedidos deste parceiro (todos os pedidos onde partner_id = id)
      const { data: pedidos, error: oErr } = await supabase
        .from("partner_orders")
        .select("*")
        .eq("partner_id", id)
        .order("created_at", { ascending: false });

      if (oErr) console.error("[partners] select orders error:", oErr);

      const orders = Array.isArray(pedidos) ? pedidos : [];

      // Contadores (pode-se filtrar por tipo de pedido se existir campo tipo)
      const pedidos_para_aceitar = orders.filter((x) => x.status === "para_aceitar").length;
      const pedidos_em_fabricacao = orders.filter((x) => x.status === "em_fabricacao").length;
      const pedidos_finalizados = orders.filter((x) => x.status === "finalizado").length;
      const pedidos_retorno = orders.filter((x) => x.status === "retorno").length;
      const pedidos_recusados = orders.filter((x) => x.status === "recusado").length;
      const caixa_total = orders.reduce((acc, x) => acc + Number(x.ganho_parceiro || 0), 0);

      const title = "Perfil — Venda";

      const fmtWhen = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "-");
      const fmtCli = (o) => [o.cliente_nome, o.cliente_cidade].filter(Boolean).join(" • ") || "-";
      const fmtMoney = (v) => `R$ ${moneyBR(v)}`;

      // Completude do perfil
      const profileFields = [
        ["responsavel", p.responsavel],
        ["negocio", p.negocio],
        ["segmento", p.segmento],
        ["whatsapp", p.whatsapp],
        ["email", p.email],
        ["cidade", p.cidade],
        ["endereco", p.endereco],
        ["cep", p.cep],
      ];
      const filled = profileFields.filter(([, v]) => String(v || "").trim()).length;
      const total = profileFields.length;
      const profilePct = Math.round((filled / total) * 100);

      // Nível baseado em pedidos finalizados
      const level = (() => {
        const n = Number(pedidos_finalizados || 0);
        if (n >= 30) return { name: "Ouro", icon: "🥇", hint: "Top vendedor" };
        if (n >= 10) return { name: "Prata", icon: "🥈", hint: "Bom desempenho" };
        if (n >= 3) return { name: "Bronze", icon: "🥉", hint: "Primeiras vendas" };
        return { name: "Iniciante", icon: "✨", hint: "Começando agora" };
      })();

      // Menu para vendedor (simplificado)
      const menuItems = [
        { id: "visao", label: "📌 Visão geral" },
        { id: "caixa", label: "💰 Meu caixa" },
        { id: "pedidos", label: "📦 Meus pedidos" },
        { id: "link", label: "🔗 Gerar link" },
        { id: "como", label: "❓ Como funciona" },
      ];

      const sidebarHtml = `
        <div class="sideCard">
          <div class="sideTop">
            <div class="sideTitle">Menu</div>
            <div style="display:flex; gap:10px; align-items:center;">
              <button class="focusBtn" data-action="toggleFocus" type="button" title="Ativar/desativar modo foco">🧘 <span>Foco</span></button>
              <button class="refreshBtn" data-action="refresh" type="button" title="Atualizar"><span class="spin">⟳</span> <span>Atualizar</span></button>
            </div>
          </div>
          <div class="lastSync muted" id="lastSync">Atualizado agora</div>

          <div class="sideNav">
            ${menuItems.map((m, idx) => `
              <button class="navBtn ${idx === 0 ? "active" : ""}" data-tab="${esc(m.id)}" type="button">
                <span class="navLabel">${m.label}</span>
                <span class="chev">›</span>
              </button>`).join("")}
          </div>

          <div class="sideMini">
            <div class="miniLine">
              <span class="muted">Nível</span>
              <span class="lvl">${esc(level.icon)} <b>${esc(level.name)}</b></span>
            </div>
            <div class="miniHint muted">${esc(level.hint)}</div>
            <div style="height:10px"></div>
            <div class="miniLine">
              <span class="muted">Perfil</span>
              <span class="muted"><b>${esc(String(profilePct))}%</b> completo</span>
            </div>
            <div class="bar"><div class="barFill" style="width:${esc(String(profilePct))}%;"></div></div>
          </div>
        </div>
      `;

      const headerKpis = `
        <div class="kpiGrid">
          <div class="kpiCard">
            <div class="kpiTop"><div class="kpiTitle">Meu caixa</div><div class="kpiBadge">Vendas</div></div>
            <div class="kpiValue">${fmtMoney(caixa_total)}</div>
            <div class="kpiSub">Comissão de 10% por pedido</div>
          </div>
          <div class="kpiCard">
            <div class="kpiTitle">Total de pedidos</div>
            <div class="kpiValue">${orders.length}</div>
            <div class="kpiSub">Todos os pedidos</div>
          </div>
          <div class="kpiCard kpiCardHot">
            <div class="kpiTitle">Pendentes</div>
            <div class="kpiValue">${pedidos_para_aceitar + pedidos_em_fabricacao + pedidos_retorno}</div>
            <div class="kpiSub">Pedidos em andamento</div>
          </div>
          <div class="kpiCard">
            <div class="kpiTitle">Finalizados</div>
            <div class="kpiValue">${pedidos_finalizados}</div>
            <div class="kpiSub">Concluídos</div>
          </div>
        </div>
      `;

      const tabVisao = `
        <div class="panel" data-panel="visao">
          <div class="panelHead"><div><div class="panelTitle">Visão geral</div><div class="muted">Resumo das suas vendas.</div></div></div>
          ${headerKpis}
          <div style="height:12px"></div>
          <div class="note"><b>Comissão:</b> você ganha 10% sobre cada pedido realizado através do seu link.</div>
        </div>
      `;

      const tabCaixa = `
        <div class="panel" data-panel="caixa" style="display:none;">
          <div class="panelHead"><div><div class="panelTitle">Meu caixa</div><div class="muted">Ganhos totais</div></div><div class="panelRight"><div class="cashPill">${fmtMoney(caixa_total)}</div></div></div>
          <div class="note">Este valor é a soma das comissões de todos os pedidos.</div>
        </div>
      `;

      const tabPedidos = `
        <div class="panel" data-panel="pedidos" style="display:none;">
          <div class="panelHead"><div><div class="panelTitle">Meus pedidos</div><div class="muted">Histórico de pedidos (últimos 50)</div></div></div>
          ${orders.length === 0 ? '<div class="muted">Nenhum pedido ainda.</div>' : `
            <div class="tableWrap">
              <table class="table">
                <thead><tr><th>Quando</th><th>Cliente</th><th>Status</th><th>Total</th><th>Ganho</th></tr></thead>
                <tbody>
                  ${orders.slice(0,50).map(o => `
                    <tr>
                      <td>${esc(fmtWhen(o.created_at))}</td>
                      <td>${esc(fmtCli(o))}</td>
                      <td><span class="pill pill-${esc(o.status)}">${esc(statusLabel(o.status))}</span></td>
                      <td>${fmtMoney(o.valor_total)}</td>
                      <td>${fmtMoney(o.ganho_parceiro)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
        </div>
      `;

      const base = getBaseUrl(req);
      const referralLink = `${base}/sales?ref=${encodeURIComponent(p.id)}`;

      const tabLink = `
        <div class="panel" data-panel="link" style="display:none;">
          <div class="panelHead"><div><div class="panelTitle">🔗 Gerar link</div><div class="muted">Divulgue e ganhe 10%</div></div></div>
          <div class="card" style="padding:14px;">
            <div style="font-weight:1000;margin-bottom:8px;">Seu link</div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <input id="refLink" value="${esc(referralLink)}" readonly style="flex:1; min-width:260px; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,.14); background:rgba(0,0,0,.25); color:#fff;"/>
              <button class="btnSmall btnOk" type="button" data-action="copyLink">📋 Copiar</button>
              <button class="btnSmall" type="button" data-action="regenLink">⟳ Atualizar</button>
            </div>
          </div>
        </div>
      `;

      const tabComo = `
        <div class="panel" data-panel="como" style="display:none;">
          <div class="panelHead"><div><div class="panelTitle">Como funciona</div></div></div>
          <div class="steps">
            <div class="step"><div class="n">1</div><div><b>Compartilhe seu link</b><div class="muted">Nas redes sociais ou WhatsApp.</div></div></div>
            <div class="step"><div class="n">2</div><div><b>Cliente compra</b><div class="muted">O sistema identifica que foi você.</div></div></div>
            <div class="step"><div class="n">3</div><div><b>Você ganha 10%</b><div class="muted">Comissão sobre o valor total.</div></div></div>
          </div>
        </div>
      `;

      // Botões do topo: Voltar à esquerda, Início e Sair à direita
     const navLeft = `
  <button class="btn btnOutline" onclick="window.history.back()" type="button">🔙 Voltar</button>
`;

const navRight = `
  <a class="btn btnOutline" href="/sales">🏠 Início</a>
  <a class="btn btnDanger" href="/parceiros/sair">🚪 Sair</a>
`;
      return res.type("html").send(
        layout(
          title,
          `
<style>
  /* (mesmo estilo de fabricação, mas pode simplificar) */
  :root{--c-trust: rgba(84,169,255,.95);--c-okay:rgba(40,200,120,.95);--c-warn:rgba(255,193,7,.95);--c-urg:rgba(255,82,82,.95);}
  .dashWrap{display:grid;grid-template-columns:320px 1fr;gap:18px;align-items:start}
  @media(max-width:980px){.dashWrap{grid-template-columns:1fr}}
  .topCard{padding:18px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.10);border-radius:18px;margin-bottom:14px}
  .topTitle{font-size:22px;font-weight:1000}
  .metaRow{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
  .chip{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10)}
  .sideCard{position:sticky;top:16px}
  .sideTop{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
  .refreshBtn,.focusBtn{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;font-weight:900}
  .refreshBtn:hover,.focusBtn:hover{transform:translateY(-1px)}
  .sideNav{display:flex;flex-direction:column;gap:8px}
  .navBtn{width:100%;text-align:left;display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.18);color:#fff;cursor:pointer}
  .navBtn.active{background:linear-gradient(135deg, rgba(84,169,255,.18), rgba(255,82,173,.16));border-color:rgba(255,255,255,.18)}
  .sideMini{margin-top:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);border-radius:16px;padding:12px}
  .miniLine{display:flex;justify-content:space-between;align-items:center}
  .bar{height:10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);overflow:hidden;margin-top:6px}
  .barFill{height:100%;background:linear-gradient(90deg, rgba(84,169,255,.9), rgba(40,200,120,.85));border-radius:999px;transition:width .45s ease}
  .panel{padding:16px}
  .panelHead{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
  .panelTitle{font-weight:1000;font-size:16px}
  .kpiGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  @media(max-width:980px){.kpiGrid{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:520px){.kpiGrid{grid-template-columns:1fr}}
  .kpiCard{border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.18);border-radius:16px;padding:14px}
  .kpiCardHot{background:linear-gradient(135deg, rgba(255,82,82,.12), rgba(0,0,0,.18));border-color:rgba(255,82,82,.18)}
  .kpiTitle{opacity:.9;font-weight:900}
  .kpiValue{font-size:22px;font-weight:1000}
  .kpiSub{font-size:12px;opacity:.8;margin-top:6px}
  .tableWrap{overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,.10)}
  .table{width:100%;border-collapse:collapse}
  .table th,.table td{padding:12px;border-bottom:1px solid rgba(255,255,255,.08)}
  .pill{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-weight:1000;font-size:12px}
  .pill-para_aceitar{background:rgba(255,193,7,.12);border-color:rgba(255,193,7,.22)}
  .pill-em_fabricacao{background:rgba(84,169,255,.12);border-color:rgba(84,169,255,.22)}
  .pill-finalizado{background:rgba(40,200,120,.14);border-color:rgba(40,200,120,.22)}
  .pill-retorno{background:rgba(255,82,173,.12);border-color:rgba(255,82,173,.20)}
  .pill-recusado{background:rgba(255,82,82,.12);border-color:rgba(255,82,82,.20)}
  .steps{display:grid;gap:10px}
  .step{display:flex;gap:12px;align-items:flex-start;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);border-radius:16px;padding:14px}
  .step .n{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:1000;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
  .toasts{position:fixed;right:14px;bottom:14px;display:grid;gap:10px;z-index:9999}
  .toast{width:min(360px, calc(100vw - 28px));border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.55);backdrop-filter:blur(10px);padding:12px;box-shadow:0 18px 40px rgba(0,0,0,.35);transform:translateY(8px);opacity:0;animation:toastIn .22s ease forwards}
  @keyframes toastIn{to{transform:translateY(0);opacity:1}}
  .toast .x{border:0;background:transparent;color:#fff;opacity:.7;cursor:pointer}
  .panelHostFlash{animation:flash .45s ease}
  @keyframes flash{45%{box-shadow:0 0 0 4px rgba(84,169,255,.10)}}
</style>

<div class="card topCard">
  <div class="topTitle">Painel do Parceiro — Venda 🧲</div>
  <div class="topSub p"><b>${esc(p.negocio)}</b></div>
  <div class="metaRow">
    <div class="chip">📍 <b>${esc(p.cidade)}</b></div>
    <div class="chip">📞 <b>${esc(p.whatsapp)}</b></div>
    <div class="chip">🏷️ Segmento: <b>${esc(p.segmento || "-")}</b></div>
  </div>
</div>

<div class="dashWrap">
  <div>${sidebarHtml}</div>
  <div class="card panelHost" id="panelHost">
    ${tabVisao}
    ${tabCaixa}
    ${tabPedidos}
    ${tabLink}
    ${tabComo}
  </div>
</div>

<div class="toasts" id="toasts"></div>

<script>
(function(){
  const nav = Array.from(document.querySelectorAll('[data-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-panel]'));
  const toasts = document.getElementById('toasts');
  const panelHost = document.getElementById('panelHost');
  const lastSync = document.getElementById('lastSync');

  function nowLabel(){ try{ return new Date().toLocaleString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return 'agora'; }}
  function setLastSync(){ if(lastSync) lastSync.textContent = 'Atualizado às ' + nowLabel(); }
  setLastSync();

  function toast(type, title, msg, ms){
    const el = document.createElement('div');
    el.className = 'toast ' + (type||'');
    el.innerHTML = \`<div class="toastTop"><div class="toastTitle">\${title||'Aviso'}</div><button class="x">✕</button></div>\${msg?'<div class="toastMsg">'+msg+'</div>':''}\`;
    el.querySelector('.x').addEventListener('click',()=>el.remove());
    toasts.appendChild(el);
    setTimeout(()=>{ try{el.remove()}catch(e){} }, ms||2800);
  }

  const FOCUS_KEY='partners_focus_mode_v1';
  function getFocus(){ try{ return localStorage.getItem(FOCUS_KEY)==='1'; }catch(e){ return false; }}
  function setFocus(on){ try{ localStorage.setItem(FOCUS_KEY, on?'1':'0'); }catch(e){}}
  function applyFocus(on){ document.documentElement.classList.toggle('focusOn',!!on); }
  applyFocus(getFocus());
  function getActiveTab(){ const act = document.querySelector('.navBtn.active'); return act?act.getAttribute('data-tab'):'visao'; }

  function show(tabId, pushHash){
    nav.forEach(b=>b.classList.toggle('active',b.getAttribute('data-tab')===tabId));
    panels.forEach(p=>p.style.display = (p.getAttribute('data-panel')===tabId)?'':'none');
    if(pushHash) try{ history.replaceState(null,'',location.pathname+location.search+'#'+tabId); }catch(e){}
    window.scrollTo({top:0,behavior:'smooth'});
  }

  nav.forEach(b=>b.addEventListener('click',()=>show(b.getAttribute('data-tab'),true)));
  const hash = (location.hash||'').replace('#','').trim();
  if(hash && panels.some(p=>p.getAttribute('data-panel')===hash)) show(hash,false);

  function flashPanel(){ if(!panelHost) return; panelHost.classList.remove('panelHostFlash'); void panelHost.offsetWidth; panelHost.classList.add('panelHostFlash'); }

  async function doCopyLink(){
    const inp = document.getElementById('refLink');
    if(!inp) return toast('bad','Link não encontrado','Abra a aba “Gerar link”.',3200);
    const val = String(inp.value||'').trim();
    if(!val) return toast('bad','Link vazio','Tente atualizar.',2800);
    try{
      inp.focus(); inp.select(); inp.setSelectionRange(0,inp.value.length);
      if(navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(val);
      else document.execCommand('copy');
      toast('ok','Copiado ✅','Agora é só divulgar.',2200);
    }catch(e){ toast('warn','Não deu pra copiar','Selecione e copie manualmente.',3600); }
  }

  function doRegenLink(){ setLastSync(); flashPanel(); toast('ok','Link pronto','Seu link está atualizado.',2400); }
  function doRefresh(btn){
    if(btn){ btn.classList.add('isLoading'); btn.disabled=true; const label=btn.querySelector('span:nth-child(2)'); if(label) label.textContent='Sincronizando…'; }
    setLastSync(); toast('warn','Sincronizando','Atualizando dados...',1600);
    setTimeout(()=>{ const tab=getActiveTab(); try{ location.replace(location.pathname+location.search+'#'+tab); }catch(e){ location.reload(); } },650);
  }
  function toggleFocus(){ const on=!getFocus(); setFocus(on); applyFocus(on); toast('ok',on?'Modo foco ativado':'Modo foco desativado',on?'Badges e animações reduzidas.':'Badges voltaram.',1800); }

  document.addEventListener('click',(ev)=>{
    const el=ev.target.closest('[data-action]'); if(!el) return;
    const action=el.getAttribute('data-action');
    if(action==='refresh'){ ev.preventDefault(); doRefresh(el); }
    else if(action==='copyLink'){ ev.preventDefault(); doCopyLink(); }
    else if(action==='regenLink'){ ev.preventDefault(); doRegenLink(); }
    else if(action==='toggleFocus'){ ev.preventDefault(); toggleFocus(); }
  });
})();
</script>
          `,
          navRight, navLeft)
      );
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] perfil venda erro:", msg);
      return res.status(500).type("html").send(
        layout(
          "Erro",
          `<div class="card"><h1>Erro</h1><p>Tente novamente.</p>${isDev?`<div class="err">${esc(msg)}</div>`:''}<a class="btn btnPrimary" href="/parceiros">Voltar</a></div>`
        )
      );
    }
  });
};