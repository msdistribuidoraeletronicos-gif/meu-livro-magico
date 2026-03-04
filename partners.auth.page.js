/**
 * partners.auth.page.js — Autenticação comum para parceiros (login/logout/esqueci/redefinir)
 * UNIFICADO: usa as funções JWT do shared para manter consistência.
 */
"use strict";

const { buildPartnersShared } = require("./partners.shared");

module.exports = function mountPartnersAuth(app, opts = {}) {
  const shared = buildPartnersShared(app, opts);
  const {
    isDev,
    supabase,
    layout,
    esc,
    verifyPassword,
    hashPassword,
    COOKIE_SECRET,
    setPartnerCookie,
    clearPartnerCookie,
    genResetToken,
    sha256Hex,
    getBaseUrl,
    sendResetEmail,
    getPartnerIdFromToken, // NOVA FUNÇÃO
  } = shared;

  // GET /parceiros/login
  app.get("/parceiros/login", (req, res) => {
    // Verifica se já está autenticado
    const partnerId = getPartnerIdFromToken(req);
    if (partnerId) {
      // Se já estiver logado, redireciona para o perfil
      const next = String(req.query.next || "").trim();
      const targetId = next || partnerId;
      return res.redirect(303, `/parceiros/perfil/${encodeURIComponent(targetId)}`);
    }

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
          </form>

          <div style="height:12px"></div>
          <div class="muted">
            <a href="/parceiros/esqueci" style="text-decoration:underline; font-weight:900;">Esqueci minha senha</a>
            <span style="opacity:.6; padding:0 8px;">•</span>
            <a href="/parceiros" style="text-decoration:underline;">Voltar</a>
          </div>
        </div>
        `
      )
    );
  });

  // POST /parceiros/login (mantido igual)
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

      setPartnerCookie(res, p.id);

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

  // GET /parceiros/sair
  app.get("/parceiros/sair", (req, res) => {
    clearPartnerCookie(res);
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

  // GET /parceiros/esqueci (mantido igual)
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

  // POST /parceiros/esqueci (mantido igual)
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
            <p class="p">Se o e-mail estiver cadastrado, enviamos um <b>link de recuperação de senha</b> para sua caixa de entrada.</p>
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

  // GET /parceiros/redefinir (mantido igual)
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

  // POST /parceiros/redefinir (mantido igual)
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

      setPartnerCookie(res, p.id);

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
};