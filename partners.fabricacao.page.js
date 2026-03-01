/**
 * partners.fabricacao.page.js — Parceiros (Fabricação)
 * Mantém URLs originais.
 */
"use strict";

const { buildPartnersShared } = require("./partners.shared");

module.exports = function mountPartnersFabricacao(app, opts = {}) {
  const shared = buildPartnersShared(app, opts);
  const {
    isDev,
    supabase,
    layout,
    esc,
    moneyBR,
    statusLabel,
    verifyPassword,
    hashPassword,
    COOKIE_SECRET,
    COOKIE_NAME,
    makeCookieValue,
    setCookie,
    clearCookie,
    requirePartnerAuthForId,
    genResetToken,
    sha256Hex,
    getBaseUrl,
    sendResetEmail,
  } = shared;

  // =========================
  // GET /parceiros  (Central) — igual
  // =========================
  app.get("/parceiros", (req, res) => {
    res.type("html").send(
      layout(
        "Seja Parceiro",
        `
        <div class="card">
          <div class="h1">Seja Parceiro 🤝</div>
          <p class="p">Escolha como você quer ganhar com o Meu Livro Mágico: <b>Fabricando</b> os livros na sua cidade ou <b>Vendendo</b> com seu link de divulgação.</p>
          <div style="height:14px"></div>

          <div class="grid2">
            <div class="opt">
              <h3>🏭 Fabricação</h3>
              <p>Receba pedidos da sua cidade, aceite/recuse, produza e entregue. <b>R$ 28 por pedido</b> (R$ 20 fabricação + R$ 8 entrega).</p>
              <a class="btn btnPrimary" href="/parceiros/cadastro?tipo=fabricacao">Quero Fabricar</a>
            </div>

            <div class="opt">
              <h3>🧲 Venda</h3>
              <p>Gere seu link, divulgue e ganhe <b>10%</b> do valor total de cada compra feita pelo seu link.</p>
              <a class="btn btnPrimary" href="/parceiros/cadastro?tipo=venda">Quero Vender</a>
            </div>
          </div>
        </div>
      `,
        `
        <a class="btn btnOutline" href="/sales">⬅️ Voltar</a>
        <a class="btn btnPrimary" href="/parceiros/login">🔐 Login</a>
      `
      )
    );
  });

  // =========================
  // Login/Logout/Reset — compartilhado (igual)
  // =========================
  app.get("/parceiros/login", (req, res) => {
    const next = String(req.query.next || "").trim();
    res.type("html").send(
      layout(
        "Login — Parceiros",
        `
        <div class="card">
          <div class="h1">Login do Parceiro 🔐</div>
          <p class="p">Entre com seu <b>e-mail</b> e <b>senha</b> para acessar seu painel.</p>
          <div style="height:14px"></div>

          <form method="POST" action="/parceiros/login">
            <input type="hidden" name="next" value="${esc(next)}"/>

            <div class="formRow">
              <div>
                <label>E-mail</label>
                <input type="email" name="email" placeholder="seuemail@exemplo.com" required/>
              </div>
              <div>
                <label>Senha</label>
                <input type="password" name="senha" placeholder="Sua senha" required/>
              </div>
            </div>

            <div style="height:16px"></div>

            <button class="btn btnPrimary" type="submit">Entrar</button>
            <a class="btn btnOutline" href="/parceiros" style="margin-left:10px;">Voltar</a>
          </form>

          <div style="height:12px"></div>
          <div class="muted">
            <a href="/parceiros/esqueci" style="text-decoration:underline; font-weight:900;">Esqueci minha senha</a>
          </div>
        </div>
      `
      )
    );
  });

  app.post("/parceiros/perfil/:id", (req, res) => {
    const id = String(req.params.id || "").trim();
    return res.redirect(`/parceiros/perfil/${encodeURIComponent(id)}`);
  });
  app.post("/parceiros/perfil", (req, res) => res.redirect(303, "/parceiros"));

  app.post("/parceiros/login", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const senha = String(req.body.senha || "");
      const next = String(req.body.next || "").trim();

      if (!email || !senha) throw new Error("Informe e-mail e senha.");

      const { data: p, error } = await supabase
        .from("partners")
        .select("id,email,password_hash,negocio,tipo")
        .eq("email", email)
        .single();

      if (error || !p) {
        return res.status(401).type("html").send(
          layout(
            "Login",
            `
            <div class="card">
              <div class="h1">Não encontrado</div>
              <p class="p">Não achamos parceiro com esse e-mail.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/login">Tentar novamente</a>
              <a class="btn btnOutline" href="/parceiros/esqueci" style="margin-left:10px;">Esqueci a senha</a>
            </div>
          `
          )
        );
      }

      if (!p.password_hash) {
        return res.status(401).type("html").send(
          layout(
            "Login",
            `
            <div class="card">
              <div class="h1">Senha não configurada</div>
              <p class="p">Esse parceiro ainda não tem senha cadastrada.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/esqueci">Criar nova senha</a>
              <a class="btn btnOutline" href="/parceiros" style="margin-left:10px;">Voltar</a>
            </div>
          `
          )
        );
      }

      const ok = verifyPassword(senha, p.password_hash);
      if (!ok) {
        return res.status(401).type("html").send(
          layout(
            "Login",
            `
            <div class="card">
              <div class="h1">Senha inválida</div>
              <p class="p">Confira sua senha e tente novamente.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/login">Tentar novamente</a>
              <a class="btn btnOutline" href="/parceiros/esqueci" style="margin-left:10px;">Esqueci a senha</a>
            </div>
          `
          )
        );
      }

      if (!COOKIE_SECRET && !isDev) throw new Error("Defina PARTNER_COOKIE_SECRET no ambiente de produção.");

      setCookie(req, res, COOKIE_NAME, makeCookieValue(p.id), { maxAgeSec: 60 * 60 * 24 * 30 });

      const targetId = next || p.id;
      res.setHeader("Cache-Control", "no-store");
      return res.redirect(303, `/parceiros/perfil/${encodeURIComponent(targetId)}`);
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] login erro:", msg);

      res.status(500).type("html").send(
        layout(
          "Erro",
          `
          <div class="card">
            <div class="h1">Ops…</div>
            <p class="p">Não foi possível fazer login agora. Tente novamente.</p>
            ${isDev ? `<div class="err">DEV ERROR:\n${esc(msg)}</div>` : ``}
            <div style="height:14px"></div>
            <a class="btn btnPrimary" href="/parceiros/login">Voltar para Login</a>
          </div>
        `
        )
      );
    }
  });

  app.get("/parceiros/sair", (req, res) => {
    clearCookie(req, res, COOKIE_NAME);
    res.type("html").send(
      layout(
        "Saiu",
        `
        <div class="card">
          <div class="h1">Você saiu ✅</div>
          <p class="p">Sua sessão foi encerrada com segurança.</p>
          <div style="height:14px"></div>
          <a class="btn btnPrimary" href="/parceiros/login">Fazer login</a>
          <a class="btn btnOutline" href="/parceiros" style="margin-left:10px;">Voltar</a>
        </div>
      `
      )
    );
  });

  app.get("/parceiros/esqueci", (req, res) => {
    res.type("html").send(
      layout(
        "Esqueci minha senha",
        `
        <div class="card">
          <div class="h1">Esqueci minha senha 🔁</div>
          <p class="p">Informe seu e-mail. Vamos gerar um <b>link de redefinição</b>.</p>
          <div style="height:14px"></div>

          <form method="POST" action="/parceiros/esqueci">
            <div class="formRow">
              <div>
                <label>E-mail</label>
                <input type="email" name="email" placeholder="seuemail@exemplo.com" required/>
              </div>
              <div style="display:flex; align-items:end; gap:10px;">
                <button class="btn btnPrimary" type="submit">Gerar link</button>
                <a class="btn btnOutline" href="/parceiros/login">Voltar</a>
              </div>
            </div>
          </form>

          <div style="height:12px"></div>
          <div class="muted">Dica: o link expira em 30 minutos.</div>
        </div>
      `
      )
    );
  });

  app.post("/parceiros/esqueci", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      if (!email) throw new Error("Informe um e-mail.");

      const { data: p, error } = await supabase.from("partners").select("id,email").eq("email", email).single();

      if (!error && p?.id) {
        const token = genResetToken();
        const tokenHash = sha256Hex(token);
        const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        const up = await supabase
          .from("partners")
          .update({ reset_token_hash: tokenHash, reset_token_expires: expires })
          .eq("id", p.id);

        if (up.error) {
          console.error("[partners] reset token update error:", up.error);
        } else {
          const resetUrl = `${getBaseUrl(req)}/parceiros/redefinir?token=${encodeURIComponent(token)}`;
          const mail = await sendResetEmail(email, resetUrl);
          if (!mail?.ok) console.error("[partners] sendResetEmail failed:", mail?.error || mail);
        }
      }

      return res.type("html").send(
        layout(
          "Recuperação de senha",
          `
          <div class="card">
            <div class="h1">Pronto ✅</div>
            <p class="p">Enviamos um <b>link de recuperação de senha</b> para sua caixa de entrada.</p>
            <div style="height:10px"></div>
            <div class="muted">Verifique também o <b>spam/lixo eletrônico</b>. O link expira em 30 minutos.</div>
            <div style="height:16px"></div>
            <a class="btn btnPrimary" href="/parceiros/login">Voltar para Login</a>
          </div>
          `
        )
      );
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] esqueci erro:", msg);
      return res.status(500).type("html").send(
        layout(
          "Erro",
          `
          <div class="card">
            <div class="h1">Ops…</div>
            <p class="p">Não foi possível processar a recuperação agora. Tente novamente.</p>
            <div style="height:14px"></div>
            <a class="btn btnPrimary" href="/parceiros/esqueci">Tentar novamente</a>
          </div>
          `
        )
      );
    }
  });

  app.get("/parceiros/redefinir", (req, res) => {
    const token = String(req.query.token || "").trim();
    if (!token) return res.redirect("/parceiros/esqueci");

    res.type("html").send(
      layout(
        "Redefinir senha",
        `
        <div class="card">
          <div class="h1">Redefinir senha 🔐</div>
          <p class="p">Crie uma nova senha para acessar seu painel.</p>

          <div style="height:14px"></div>

          <form method="POST" action="/parceiros/redefinir">
            <input type="hidden" name="token" value="${esc(token)}"/>

            <div class="formRow">
              <div>
                <label>Nova senha</label>
                <input type="password" name="senha" placeholder="Nova senha" required/>
                <div class="muted" style="margin-top:6px;">Mínimo recomendado: 6+ caracteres.</div>
              </div>
              <div>
                <label>Confirmar nova senha</label>
                <input type="password" name="senha2" placeholder="Repita a nova senha" required/>
              </div>
            </div>

            <div style="height:16px"></div>

            <button class="btn btnPrimary" type="submit">Salvar nova senha</button>
            <a class="btn btnOutline" href="/parceiros/login" style="margin-left:10px;">Voltar</a>
          </form>
        </div>
      `
      )
    );
  });

  app.post("/parceiros/redefinir", async (req, res) => {
    try {
      const token = String(req.body.token || "").trim();
      const senha = String(req.body.senha || "");
      const senha2 = String(req.body.senha2 || "");

      if (!token) throw new Error("Token inválido.");
      if (!senha || senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      if (senha !== senha2) throw new Error("As senhas não conferem.");

      const tokenHash = sha256Hex(token);

      const { data: p, error } = await supabase
        .from("partners")
        .select("id,reset_token_hash,reset_token_expires")
        .eq("reset_token_hash", tokenHash)
        .single();

      if (error || !p) {
        return res.status(400).type("html").send(
          layout(
            "Link inválido",
            `
            <div class="card">
              <div class="h1">Link inválido</div>
              <p class="p">Esse link não é válido ou já foi usado.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/esqueci">Gerar novo link</a>
            </div>
          `
          )
        );
      }

      const exp = p.reset_token_expires ? new Date(p.reset_token_expires).getTime() : 0;
      if (!exp || Date.now() > exp) {
        return res.status(400).type("html").send(
          layout(
            "Link expirado",
            `
            <div class="card">
              <div class="h1">Link expirado ⏳</div>
              <p class="p">Esse link expirou. Gere um novo link para redefinir sua senha.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/esqueci">Gerar novo link</a>
            </div>
          `
          )
        );
      }

      const upd = await supabase
        .from("partners")
        .update({
          password_hash: hashPassword(senha),
          reset_token_hash: null,
          reset_token_expires: null,
        })
        .eq("id", p.id);

      if (upd.error) {
        console.error("[partners] redefinir update error:", upd.error);
        throw new Error("Não foi possível salvar a nova senha.");
      }

      if (!COOKIE_SECRET && !isDev) {
        return res.type("html").send(
          layout(
            "Senha redefinida",
            `
            <div class="card">
              <div class="h1">Senha redefinida ✅</div>
              <p class="p">Sua senha foi atualizada com sucesso. Agora faça login para entrar no painel.</p>
              <div style="height:14px"></div>
              <a class="btn btnPrimary" href="/parceiros/login">Ir para Login</a>
            </div>
            `
          )
        );
      }

      setCookie(req, res, COOKIE_NAME, makeCookieValue(p.id), { maxAgeSec: 60 * 60 * 24 * 30 });
      res.setHeader("Cache-Control", "no-store");
      return res.redirect(303, `/parceiros/perfil/${encodeURIComponent(p.id)}`);
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] redefinir erro:", msg);
      return res.status(500).type("html").send(
        layout(
          "Erro",
          `
          <div class="card">
            <div class="h1">Ops…</div>
            <p class="p">Não foi possível redefinir sua senha agora. Tente novamente.</p>
            ${isDev ? `<div class="err">DEV ERROR:\n${esc(msg)}</div>` : ``}
            <div style="height:14px"></div>
            <a class="btn btnPrimary" href="/parceiros/esqueci">Gerar novo link</a>
          </div>
          `
        )
      );
    }
  });

  // =========================
  // CADASTRO — somente Fabricação
  // =========================
  app.get("/parceiros/cadastro", (req, res, next) => {
    const tipo = String(req.query.tipo || "").toLowerCase();
    if (tipo !== "fabricacao") return next(); // deixa o módulo de venda cuidar do tipo=venda

    const title = "Cadastro — Fabricação";
    const campoSegmento = `<label>Tipo de negócio</label>
      <select name="segmento" required>
        <option value="">Selecione…</option>
        <option value="papelaria">Papelaria</option>
        <option value="grafica">Gráfica</option>
        <option value="personalizados">Personalizados</option>
        <option value="encadernacao">Encadernação</option>
        <option value="outro">Outro</option>
      </select>`;

    res.type("html").send(
      layout(
        title,
        `
        <div class="card">
          <div class="h1">Cadastro de Parceiro — Fabricação 🏭</div>
          <p class="p">Preencha seus dados para criar seu perfil de parceiro.</p>
          <div style="height:14px"></div>

          <form method="POST" action="/parceiros/cadastro">
            <input type="hidden" name="tipo" value="fabricacao"/>

            <div class="formRow">
              <div>
                <label>Nome do responsável</label>
                <input name="responsavel" placeholder="Seu nome" required/>
              </div>
              <div>
                <label>Nome do negócio</label>
                <input name="negocio" placeholder="Ex.: Gráfica do João" required/>
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
                <input type="password" name="senha" placeholder="Crie uma senha" required/>
                <div class="muted" style="margin-top:6px;">Guarde essa senha. Você vai usar no Login.</div>
              </div>
              <div>
                <label>Confirmar senha</label>
                <input type="password" name="senha2" placeholder="Repita a senha" required/>
              </div>
            </div>

            <div style="height:12px"></div>

            <div>
              <label>Observações</label>
              <textarea name="obs" placeholder="Horário, referências, etc."></textarea>
            </div>

            <div style="height:16px"></div>

            <button class="btn btnPrimary" type="submit">Criar meu perfil</button>
            <a class="btn btnOutline" href="/parceiros" style="margin-left:10px;">Voltar</a>
          </form>
        </div>
      `
      )
    );
  });

  app.post("/parceiros/cadastro", async (req, res, next) => {
    const tipo = String(req.body.tipo || "").toLowerCase();
    if (tipo !== "fabricacao") return next(); // deixa o módulo de venda cuidar do tipo=venda

    try {
      const responsavel = String(req.body.responsavel || "").trim();
      const negocio = String(req.body.negocio || "").trim();
      const whatsapp = String(req.body.whatsapp || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const cidade = String(req.body.cidade || "").trim();
      const endereco = String(req.body.endereco || "").trim();
      const cep = String(req.body.cep || "").trim();
      const obs = String(req.body.obs || "").trim();
      const segmento = String(req.body.segmento || "").trim();

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
        tipo: "fabricacao",
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
        comissao_venda_percent: 0,
        fabricacao_por_pedido: 20,
        entrega_por_pedido: 8,
      };

      const { data, error } = await supabase.from("partners").insert(parceiroRow).select("*").single();
      if (error) {
        console.error("[partners] INSERT partners error:", error);
        throw error;
      }

      if (!COOKIE_SECRET && !isDev) throw new Error("Defina PARTNER_COOKIE_SECRET no ambiente de produção.");
      setCookie(req, res, COOKIE_NAME, makeCookieValue(data.id), { maxAgeSec: 60 * 60 * 24 * 30 });

      res.setHeader("Cache-Control", "no-store");
      return res.redirect(303, `/parceiros/perfil/${encodeURIComponent(data.id)}`);
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] cadastro (fab) erro:", msg);

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
  // PERFIL — serve para ambos (mas o módulo de venda também terá)
  // Importante: aqui NÃO filtra tipo; o painel muda pelo p.tipo.
  // =========================
  app.get("/parceiros/perfil/:id", async (req, res, next) => {
    // Deixa o módulo "fabricacao" atender QUALQUER tipo? Pode.
    // Se você preferir que cada módulo cuide só do seu tipo, dá pra filtrar.
    // Aqui mantive igual ao seu: painel dinâmico por p.tipo.
    try {
      res.setHeader("Cache-Control", "no-store");
      const id = String(req.params.id || "").trim();
      if (!id) return res.redirect("/parceiros");

      if (!requirePartnerAuthForId(req, res, id)) return;

      const { data: p, error: pErr } = await supabase.from("partners").select("*").eq("id", id).single();
      if (pErr || !p) return res.redirect("/parceiros");

      const { data: pedidos, error: oErr } = await supabase
        .from("partner_orders")
        .select("*")
        .eq("partner_id", id)
        .order("created_at", { ascending: false });

      if (oErr) console.error("[partners] select orders error:", oErr);

      const orders = Array.isArray(pedidos) ? pedidos : [];
      const pedidos_para_aceitar = orders.filter((x) => x.status === "para_aceitar").length;
      const pedidos_em_fabricacao = orders.filter((x) => x.status === "em_fabricacao").length;
      const pedidos_finalizados = orders.filter((x) => x.status === "finalizado").length;
      const pedidos_retorno = orders.filter((x) => x.status === "retorno").length;
      const caixa_total = orders.reduce((acc, x) => acc + Number(x.ganho_parceiro || 0), 0);

      const isFab = p.tipo === "fabricacao";
      const title = isFab ? "Perfil — Fabricação" : "Perfil — Venda";

      const menuFab = `
        <a href="#caixa">💰 Meu caixa</a>
        <a href="#aceitar">📥 Pedidos para aceitar</a>
        <a href="#emf">🏭 Pedidos em fabricação</a>
        <a href="#finalizados">✅ Pedidos finalizados</a>
        <a href="#retorno">↩️ Pedidos com retorno</a>
        <a href="#como">❓ Como funciona</a>
        <a href="#historico">📚 Histórico</a>
      `;

      const menuVenda = `
        <a href="#caixa">💰 Meu caixa</a>
        <a href="#aceitar">📥 Pedidos para aceitar</a>
        <a href="#emf">🧾 Pedidos em fabricação</a>
        <a href="#finalizados">✅ Pedidos finalizados</a>
        <a href="#retorno">↩️ Pedidos com retorno</a>
        <a href="#como">❓ Como funciona</a>
        <a href="#links">🔗 Meus links</a>
        <a href="#historico">📚 Histórico</a>
      `;

      const host = req.get("host") || "seusite.com";
      const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
      const linkVenda = `${proto}://${host}/?ref=${encodeURIComponent(p.id)}`;

      const historicoHtml =
        orders.length === 0
          ? `<div class="muted">Ainda não há pedidos registrados para este parceiro.</div>`
          : `
            <div style="overflow:auto;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Ganho</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders
                    .slice(0, 50)
                    .map((o) => {
                      const when = o.created_at ? new Date(o.created_at).toLocaleString("pt-BR") : "-";
                      const tipo = o.tipo === "fabricacao" ? "🏭 Fabricação" : "🧲 Venda";
                      const cli = [o.cliente_nome, o.cliente_cidade].filter(Boolean).join(" • ") || "-";
                      const total = `R$ ${moneyBR(o.valor_total)}`;
                      const ganho = `R$ ${moneyBR(o.ganho_parceiro)}`;
                      return `
                        <tr>
                          <td>${esc(when)}</td>
                          <td>${esc(tipo)}</td>
                          <td><span class="pill">${esc(statusLabel(o.status))}</span></td>
                          <td>${esc(cli)}</td>
                          <td>${esc(total)}</td>
                          <td>${esc(ganho)}</td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
            <div style="height:10px"></div>
            <div class="muted">Mostrando os 50 pedidos mais recentes.</div>
          `;

      res.type("html").send(
        layout(
          title,
          `
          <div class="card">
            <div class="h1">${isFab ? "Painel do Parceiro — Fabricação 🏭" : "Painel do Parceiro — Venda 🧲"}</div>
            <p class="p">
              <b>${esc(p.negocio)}</b> • ${esc(p.cidade)} • ${esc(p.whatsapp)}<br/>
              Segmento: <b>${esc(p.segmento || "-")}</b>
            </p>
          </div>

          <div class="dash">
            <div class="menu">
              <div class="card">
                <div style="font-weight:1000; margin-bottom:10px;">Menu</div>
                ${isFab ? menuFab : menuVenda}
              </div>
            </div>

            <div>
              <div class="kpi">
                <div class="box" id="caixa">
                  <div class="t">Meu caixa</div>
                  <div class="v">R$ ${moneyBR(caixa_total)}</div>
                  <div class="muted">${isFab ? "R$ 28 por pedido (20+8)" : "10% por compra via link"}</div>
                </div>
                <div class="box" id="aceitar">
                  <div class="t">Para aceitar</div>
                  <div class="v">${pedidos_para_aceitar}</div>
                  <div class="muted">Pedidos aguardando ação</div>
                </div>
                <div class="box" id="finalizados">
                  <div class="t">Finalizados</div>
                  <div class="v">${pedidos_finalizados}</div>
                  <div class="muted">Histórico de conclusões</div>
                </div>
              </div>

              <div style="height:14px"></div>

              <div class="kpi">
                <div class="box" id="emf">
                  <div class="t">${isFab ? "Em fabricação" : "Em andamento"}</div>
                  <div class="v">${pedidos_em_fabricacao}</div>
                  <div class="muted">Pedidos em processamento</div>
                </div>
                <div class="box" id="retorno">
                  <div class="t">Retorno</div>
                  <div class="v">${pedidos_retorno}</div>
                  <div class="muted">Pedidos com pendência</div>
                </div>
                <div class="box">
                  <div class="t">Total de pedidos</div>
                  <div class="v">${orders.length}</div>
                  <div class="muted">Todos os pedidos deste parceiro</div>
                </div>
              </div>

              <div style="height:14px"></div>

              <div class="card" id="como">
                <div style="font-weight:1000; margin-bottom:8px;">Como funciona</div>
                ${
                  isFab
                    ? `
                  <div class="muted">
                    Quando um pedido for realizado na sua cidade, ele cai em <b>Pedidos para aceitar</b>.
                    Você pode <b>aceitar</b> ou <b>recusar</b>. Aceitando, ele vai para <b>Pedidos em fabricação</b>.
                    Ao finalizar e entregar, marque como <b>finalizado</b>. Cada pedido rende <b>R$ 28</b> (R$ 20 fabricação + R$ 8 entrega).
                  </div>
                `
                    : `
                  <div class="muted">
                    Você gera um <b>link de divulgação</b> em <b>Meus links</b>. Quando alguém compra por ele,
                    você ganha <b>10%</b> do valor total. Seus ganhos aparecem em <b>Meu caixa</b>.
                  </div>
                `
                }
              </div>

              ${
                isFab
                  ? ""
                  : `
                <div style="height:14px"></div>
                <div class="card" id="links">
                  <div style="font-weight:1000; margin-bottom:8px;">Meus links</div>
                  <div class="muted">Link de divulgação:</div>
                  <div style="height:8px"></div>
                  <input readonly value="${esc(linkVenda)}"/>
                  <div style="height:10px"></div>
                  <div class="muted">Dica: use esse link em bio, stories e WhatsApp.</div>
                </div>
              `
              }

              <div style="height:14px"></div>
              <div class="card" id="historico">
                <div style="font-weight:1000; margin-bottom:8px;">Histórico de pedidos</div>
                ${historicoHtml}
              </div>
            </div>
          </div>
        `,
          `
          <a class="btn btnOutline" href="/parceiros">🏠 Início</a>
          <a class="btn btnDanger" href="/parceiros/sair">🚪 Sair</a>
        `
        )
      );
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("[partners] perfil erro:", msg);
      return res.status(500).type("html").send(
        layout(
          "Erro",
          `
          <div class="card">
            <div class="h1">Erro ao abrir o perfil</div>
            <p class="p">Tente novamente.</p>
            ${isDev ? `<div class="err">DEV ERROR:\n${esc(msg)}</div>` : ``}
            <div style="height:14px"></div>
            <a class="btn btnPrimary" href="/parceiros">Voltar para Central</a>
          </div>
        `
        )
      );
    }
  });
};