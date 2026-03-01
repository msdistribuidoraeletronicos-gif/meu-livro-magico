/**
 * partners.venda.page.js — Parceiros (Venda)
 * Mantém URLs originais.
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
    hashPassword,
    COOKIE_SECRET,
    COOKIE_NAME,
    makeCookieValue,
    setCookie,
  } = shared;

  // =========================
  // CADASTRO — somente Venda
  // (pega só tipo=venda; o resto fica com o módulo de fabricação ou com rotas comuns)
  // =========================
  app.get("/parceiros/cadastro", (req, res, next) => {
    const tipo = String(req.query.tipo || "").toLowerCase();
    if (tipo !== "venda") return next();

    const title = "Cadastro — Venda";
    const campoSegmento = `<label>Seu negócio (escreva)</label>
      <input name="segmento_texto" placeholder="Ex.: presentes, mercado, personalizados, livraria…" required/>`;

    return res.type("html").send(
      layout(
        title,
        `
        <div class="card">
          <div class="h1">Cadastro de Parceiro — Venda 🧲</div>
          <p class="p">Preencha seus dados para criar seu perfil de parceiro.</p>
          <div style="height:14px"></div>

          <form method="POST" action="/parceiros/cadastro">
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
      setCookie(req, res, COOKIE_NAME, makeCookieValue(data.id), { maxAgeSec: 60 * 60 * 24 * 30 });

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
};