/**
 * partners.central.page.js — Central "Seja Parceiro"
 * Rotas:
 *  - GET /parceiros
 */
"use strict";

const { buildPartnersShared } = require("./partners.shared");

module.exports = function mountPartnersCentral(app, opts = {}) {
  const shared = buildPartnersShared(app, opts);
  const { layout } = shared;

  app.get("/parceiros", (req, res) => {
    res.type("html").send(
      layout(
        "Seja Parceiro",
        `
        <style>
          :root{
            --violet-50:#f5f3ff;
            --violet-100:#ede9fe;
            --violet-200:#ddd6fe;
            --violet-600:#7c3aed;
            --violet-700:#6d28d9;

            --pink-50:#fff1f2;
            --pink-100:#ffe4e6;
            --pink-600:#db2777;
            --pink-700:#be185d;

            --blue-50:#eff6ff;
            --blue-100:#dbeafe;
            --blue-600:#2563eb;
            --blue-700:#1d4ed8;

            --amber-50:#fffbeb;
            --amber-100:#fef3c7;
            --amber-500:#f59e0b;
            --amber-600:#d97706;

            --emerald-50:#ecfdf5;
            --emerald-100:#d1fae5;
            --emerald-600:#059669;

            --gray-50:#f8fafc;
            --gray-100:#f1f5f9;
            --gray-200:#e5e7eb;
            --gray-300:#d1d5db;
            --gray-500:#64748b;
            --gray-700:#334155;
            --gray-800:#1f2937;
            --gray-900:#0f172a;

            --white:#ffffff;
            --shadow-lg:0 24px 60px rgba(15,23,42,.10);
            --shadow-md:0 14px 32px rgba(15,23,42,.08);
            --shadow-sm:0 8px 20px rgba(15,23,42,.06);
          }

          .pc-wrap{
            max-width: 1120px;
            margin: 0 auto;
          }

          .pc-hero{
            position: relative;
            overflow: hidden;
            padding: 28px;
            border-radius: 28px;
            background:
              radial-gradient(900px 300px at 10% 0%, rgba(124,58,237,.16), transparent 55%),
              radial-gradient(900px 300px at 90% 100%, rgba(219,39,119,.12), transparent 55%),
              linear-gradient(135deg, #ffffff, #faf5ff 45%, #fff7ed 100%);
            border: 1px solid rgba(124,58,237,.10);
            box-shadow: var(--shadow-lg);
          }

          .pc-badge{
            display:inline-flex;
            align-items:center;
            gap:8px;
            padding:10px 14px;
            border-radius:999px;
            background: linear-gradient(90deg, rgba(37,99,235,.10), rgba(124,58,237,.10));
            border:1px solid rgba(37,99,235,.12);
            color: var(--blue-700);
            font-weight: 900;
            font-size: 13px;
            margin-bottom: 14px;
          }

          .pc-h1{
            margin: 0;
            font-size: 40px;
            line-height: 1.05;
            letter-spacing: -.8px;
            color: var(--gray-900);
            font-weight: 1000;
          }

          .pc-grad{
            background: linear-gradient(90deg, var(--violet-600), var(--pink-600), var(--amber-500));
            -webkit-background-clip:text;
            background-clip:text;
            color: transparent;
          }

          .pc-p{
            margin: 16px 0 0;
            max-width: 760px;
            color: var(--gray-700);
            font-size: 17px;
            line-height: 1.7;
            font-weight: 700;
          }

          .pc-topstats{
            margin-top: 22px;
            display:grid;
            grid-template-columns: repeat(3, minmax(0,1fr));
            gap: 14px;
          }

          .pc-stat{
            background: rgba(255,255,255,.86);
            border: 1px solid rgba(148,163,184,.18);
            border-radius: 18px;
            padding: 16px;
            box-shadow: var(--shadow-sm);
          }

          .pc-stat-k{
            font-size: 12px;
            font-weight: 900;
            letter-spacing: .04em;
            text-transform: uppercase;
            color: var(--gray-500);
            margin-bottom: 8px;
          }

          .pc-stat-v{
            font-size: 22px;
            font-weight: 1000;
            color: var(--gray-900);
          }

          .pc-stat-d{
            margin-top: 4px;
            color: var(--gray-700);
            font-size: 13px;
            font-weight: 700;
            line-height: 1.5;
          }

          .pc-section{
            margin-top: 26px;
          }

          .pc-progress{
            background: var(--white);
            border: 1px solid rgba(148,163,184,.16);
            border-radius: 22px;
            padding: 18px;
            box-shadow: var(--shadow-md);
          }

          .pc-progress-head{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            margin-bottom: 14px;
            flex-wrap:wrap;
          }

          .pc-progress-title{
            margin:0;
            font-size:18px;
            font-weight:1000;
            color:var(--gray-900);
          }

          .pc-progress-pill{
            padding:8px 12px;
            border-radius:999px;
            background: var(--emerald-50);
            color: var(--emerald-600);
            border:1px solid rgba(5,150,105,.10);
            font-size:12px;
            font-weight:900;
          }

          .pc-steps{
            display:grid;
            grid-template-columns: repeat(3, minmax(0,1fr));
            gap: 14px;
          }

          .pc-step{
            background: linear-gradient(180deg, #fff, #fafafa);
            border:1px solid var(--gray-200);
            border-radius:18px;
            padding:16px;
          }

          .pc-step-num{
            width:34px;
            height:34px;
            display:grid;
            place-items:center;
            border-radius:999px;
            font-weight:1000;
            color:#fff;
            margin-bottom:10px;
            box-shadow: 0 10px 20px rgba(0,0,0,.10);
          }

          .pc-step:nth-child(1) .pc-step-num{ background: linear-gradient(135deg, var(--blue-600), var(--blue-700)); }
          .pc-step:nth-child(2) .pc-step-num{ background: linear-gradient(135deg, var(--violet-600), var(--pink-600)); }
          .pc-step:nth-child(3) .pc-step-num{ background: linear-gradient(135deg, var(--amber-500), var(--amber-600)); }

          .pc-step h4{
            margin:0 0 8px;
            font-size:16px;
            font-weight:1000;
            color:var(--gray-900);
          }

          .pc-step p{
            margin:0;
            color:var(--gray-700);
            font-size:14px;
            line-height:1.6;
            font-weight:700;
          }

          .pc-grid{
            display:grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 22px;
          }

          .pc-card{
            position:relative;
            overflow:hidden;
            border-radius: 24px;
            background: var(--white);
            border: 1px solid rgba(148,163,184,.16);
            box-shadow: var(--shadow-lg);
            padding: 24px;
          }

          .pc-card::before{
            content:"";
            position:absolute;
            inset:0 0 auto 0;
            height:6px;
          }

          .pc-card.fabricacao::before{
            background: linear-gradient(90deg, var(--blue-600), var(--violet-600));
          }

          .pc-card.venda::before{
            background: linear-gradient(90deg, var(--pink-600), var(--amber-500));
          }

          .pc-tag{
            display:inline-flex;
            align-items:center;
            gap:8px;
            padding:8px 12px;
            border-radius:999px;
            font-size:12px;
            font-weight:900;
            margin-bottom:14px;
          }

          .pc-card.fabricacao .pc-tag{
            background: var(--blue-50);
            color: var(--blue-700);
            border:1px solid rgba(37,99,235,.10);
          }

          .pc-card.venda .pc-tag{
            background: var(--pink-50);
            color: var(--pink-700);
            border:1px solid rgba(219,39,119,.10);
          }

          .pc-card h3{
            margin:0 0 10px;
            font-size:28px;
            line-height:1.1;
            color:var(--gray-900);
            font-weight:1000;
            letter-spacing:-.4px;
          }

          .pc-card p{
            margin:0;
            color:var(--gray-700);
            font-size:15px;
            line-height:1.7;
            font-weight:700;
          }

          .pc-highlight{
            margin-top:16px;
            padding:16px;
            border-radius:18px;
            font-weight:900;
            font-size:16px;
            box-shadow: var(--shadow-sm);
          }

          .pc-card.fabricacao .pc-highlight{
            background: linear-gradient(135deg, rgba(37,99,235,.10), rgba(124,58,237,.10));
            color: var(--blue-700);
          }

          .pc-card.venda .pc-highlight{
            background: linear-gradient(135deg, rgba(219,39,119,.10), rgba(245,158,11,.12));
            color: var(--pink-700);
          }

          .pc-list{
            margin:16px 0 0;
            padding:0;
            list-style:none;
            display:grid;
            gap:10px;
          }

          .pc-list li{
            display:flex;
            align-items:flex-start;
            gap:10px;
            color:var(--gray-800);
            font-size:14px;
            line-height:1.6;
            font-weight:700;
          }

          .pc-check{
            width:22px;
            height:22px;
            flex:0 0 22px;
            display:grid;
            place-items:center;
            border-radius:999px;
            margin-top:1px;
            font-size:12px;
            font-weight:1000;
          }

          .pc-card.fabricacao .pc-check{
            background: var(--blue-100);
            color: var(--blue-700);
          }

          .pc-card.venda .pc-check{
            background: var(--pink-100);
            color: var(--pink-700);
          }

          .pc-actions{
            display:flex;
            gap:12px;
            flex-wrap:wrap;
            margin-top:20px;
          }

          .pc-btn{
            display:inline-flex;
            align-items:center;
            justify-content:center;
            gap:10px;
            min-height:48px;
            padding: 14px 18px;
            border-radius: 999px;
            text-decoration:none;
            font-weight:1000;
            transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
            white-space:nowrap;
          }

          .pc-btn:hover{ transform: translateY(-1px); }
          .pc-btn:active{ transform: translateY(1px); }

          .pc-btn-primary{
            color:#fff;
            background: linear-gradient(90deg, var(--violet-600), var(--pink-600));
            box-shadow: 0 16px 36px rgba(124,58,237,.22);
          }

          .pc-btn-primary:hover{
            box-shadow: 0 18px 42px rgba(124,58,237,.28);
          }

          .pc-btn-outline{
            color: var(--violet-700);
            background:#fff;
            border:2px solid var(--violet-200);
            box-shadow: var(--shadow-sm);
          }

          .pc-examples{
            margin-top: 26px;
            padding: 24px;
            border-radius: 24px;
            background:
              radial-gradient(700px 220px at 0% 0%, rgba(37,99,235,.08), transparent 55%),
              radial-gradient(700px 220px at 100% 100%, rgba(219,39,119,.08), transparent 55%),
              linear-gradient(180deg, #ffffff, #fafafa);
            border:1px solid rgba(148,163,184,.16);
            box-shadow: var(--shadow-md);
          }

          .pc-examples-head{
            margin-bottom: 18px;
          }

          .pc-examples-head h3{
            margin:0 0 8px;
            font-size: 24px;
            font-weight: 1000;
            color: var(--gray-900);
            letter-spacing: -.4px;
          }

          .pc-examples-head p{
            margin:0;
            max-width: 760px;
            color: var(--gray-700);
            font-size: 15px;
            line-height: 1.7;
            font-weight: 700;
          }

          .pc-ex-grid{
            display:grid;
            grid-template-columns: repeat(3, minmax(0,1fr));
            gap: 16px;
          }

          .pc-ex-card{
            background:#fff;
            border:1px solid var(--gray-200);
            border-radius:20px;
            padding:18px;
            box-shadow: var(--shadow-sm);
          }

          .pc-ex-top{
            display:flex;
            align-items:center;
            gap:12px;
            margin-bottom:12px;
          }

          .pc-avatar{
            width:48px;
            height:48px;
            border-radius:999px;
            display:grid;
            place-items:center;
            font-size:20px;
            font-weight:1000;
            color:#fff;
            box-shadow: 0 10px 20px rgba(0,0,0,.10);
          }

          .pc-ex-card:nth-child(1) .pc-avatar{ background: linear-gradient(135deg, var(--blue-600), var(--violet-600)); }
          .pc-ex-card:nth-child(2) .pc-avatar{ background: linear-gradient(135deg, var(--pink-600), var(--amber-500)); }
          .pc-ex-card:nth-child(3) .pc-avatar{ background: linear-gradient(135deg, var(--emerald-600), var(--blue-600)); }

          .pc-ex-name{
            font-size:15px;
            font-weight:1000;
            color:var(--gray-900);
          }

          .pc-ex-role{
            font-size:12px;
            font-weight:900;
            color:var(--gray-500);
            text-transform:uppercase;
            letter-spacing:.04em;
          }

          .pc-ex-text{
            color:var(--gray-700);
            font-size:14px;
            line-height:1.7;
            font-weight:700;
          }

          .pc-fit{
            margin-top: 18px;
            display:grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }

          .pc-fit-box{
            background:#fff;
            border:1px solid var(--gray-200);
            border-radius:20px;
            padding:18px;
            box-shadow: var(--shadow-sm);
          }

          .pc-fit-box h4{
            margin:0 0 10px;
            font-size:18px;
            font-weight:1000;
            color:var(--gray-900);
          }

          .pc-fit-list{
            margin:0;
            padding:0;
            list-style:none;
            display:grid;
            gap:10px;
          }

          .pc-fit-list li{
            display:flex;
            gap:10px;
            align-items:flex-start;
            color:var(--gray-700);
            font-size:14px;
            line-height:1.6;
            font-weight:700;
          }

          .pc-dot{
            width:10px;
            height:10px;
            border-radius:999px;
            margin-top:7px;
            flex:0 0 10px;
          }

          .pc-fit-box:first-child .pc-dot{
            background: linear-gradient(135deg, var(--blue-600), var(--violet-600));
          }

          .pc-fit-box:last-child .pc-dot{
            background: linear-gradient(135deg, var(--pink-600), var(--amber-500));
          }

          .pc-bottomCta{
            margin-top: 18px;
            padding: 20px;
            border-radius: 20px;
            background: linear-gradient(135deg, rgba(124,58,237,.08), rgba(219,39,119,.08));
            border:1px solid rgba(124,58,237,.10);
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:16px;
            flex-wrap:wrap;
          }

          .pc-bottomCta h4{
            margin:0 0 6px;
            font-size:20px;
            font-weight:1000;
            color:var(--gray-900);
          }

          .pc-bottomCta p{
            margin:0;
            color:var(--gray-700);
            font-size:14px;
            line-height:1.6;
            font-weight:700;
            max-width: 640px;
          }

          @media (max-width: 920px){
            .pc-topstats,
            .pc-grid,
            .pc-steps,
            .pc-ex-grid,
            .pc-fit{
              grid-template-columns: 1fr;
            }

            .pc-h1{
              font-size: 32px;
            }
          }

          @media (max-width: 640px){
            .pc-hero{
              padding:20px;
              border-radius:22px;
            }

            .pc-h1{
              font-size: 28px;
            }

            .pc-p{
              font-size:15px;
            }

            .pc-card h3{
              font-size:24px;
            }

            .pc-actions{
              flex-direction:column;
            }

            .pc-btn{
              width:100%;
            }

            .pc-examples{
              padding:18px;
            }

            .pc-bottomCta{
              padding:18px;
            }
          }
        </style>

        <div class="pc-wrap">
          <div class="pc-hero">
            <div class="pc-badge">🤝 Programa de Parceiros • Ganhe com o Meu Livro Mágico</div>

            <h1 class="pc-h1">
              Seja parceiro e transforme
              <span class="pc-grad">pedidos em renda</span>
            </h1>

            <p class="pc-p">
              Escolha como você quer participar: <b>fabricando</b> livros na sua cidade
              ou <b>vendendo</b> com seu link de divulgação. Tudo com um fluxo simples,
              visual e fácil de entender.
            </p>

            <div class="pc-topstats">
              <div class="pc-stat">
                <div class="pc-stat-k">Modelo 1</div>
                <div class="pc-stat-v">🏭 Fabricação</div>
                <div class="pc-stat-d">Receba pedidos, aceite, produza e entregue na sua região.</div>
              </div>

              <div class="pc-stat">
                <div class="pc-stat-k">Modelo 2</div>
                <div class="pc-stat-v">🧲 Venda</div>
                <div class="pc-stat-d">Divulgue seu link e ganhe comissão em cada compra.</div>
              </div>

              <div class="pc-stat">
                <div class="pc-stat-k">Objetivo</div>
                <div class="pc-stat-v">Renda recorrente</div>
                <div class="pc-stat-d">Escolha o caminho que combina com seu perfil e comece hoje.</div>
              </div>
            </div>
          </div>

          <div class="pc-section">
            <div class="pc-progress">
              <div class="pc-progress-head">
                <h2 class="pc-progress-title">Como funciona</h2>
                <div class="pc-progress-pill">Processo simples em 3 etapas</div>
              </div>

              <div class="pc-steps">
                <div class="pc-step">
                  <div class="pc-step-num">1</div>
                  <h4>Escolha seu perfil</h4>
                  <p>Decida se você quer fabricar os livros na sua cidade ou vender usando seu link.</p>
                </div>

                <div class="pc-step">
                  <div class="pc-step-num">2</div>
                  <h4>Faça seu cadastro</h4>
                  <p>Preencha seus dados e entre para a rede de parceiros com acesso à sua área.</p>
                </div>

                <div class="pc-step">
                  <div class="pc-step-num">3</div>
                  <h4>Comece a ganhar</h4>
                  <p>Receba pedidos para produzir ou divulgue seu link para ganhar comissão nas vendas.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="pc-grid">
            <div class="pc-card fabricacao">
              <div class="pc-tag">🏭 Parceiro de Fabricação</div>
              <h3>Produza livros e atenda sua cidade</h3>
              <p>
                Ideal para quem quer operar localmente. Você recebe pedidos da sua região,
                escolhe aceitar ou não, fabrica o material e faz a entrega.
              </p>

              <div class="pc-highlight">
                Ganho por pedido: <b>R$ 28</b> <span style="font-weight:800;opacity:.86;">(R$ 20 fabricação + R$ 8 entrega)</span>
              </div>

              <ul class="pc-list">
                <li><span class="pc-check">✓</span><span>Receba pedidos compatíveis com sua cidade.</span></li>
                <li><span class="pc-check">✓</span><span>Aceite apenas os pedidos que fizerem sentido para você.</span></li>
                <li><span class="pc-check">✓</span><span>Fluxo claro de produção e entrega dentro da plataforma.</span></li>
                <li><span class="pc-check">✓</span><span>Modelo ideal para quem gosta de operação e atendimento local.</span></li>
              </ul>

              <div class="pc-actions">
                <a class="pc-btn pc-btn-primary" href="/parceiros/cadastro?tipo=fabricacao">Quero Fabricar</a>
              </div>
            </div>

            <div class="pc-card venda">
              <div class="pc-tag">🧲 Parceiro de Venda</div>
              <h3>Divulgue seu link e ganhe comissão</h3>
              <p>
                Ideal para quem quer vender sem fabricar. Você recebe um link exclusivo
                para divulgação e ganha comissão sobre as compras realizadas por ele.
              </p>

              <div class="pc-highlight">
                Comissão: <b>10%</b> <span style="font-weight:800;opacity:.86;">do valor total de cada compra pelo seu link</span>
              </div>

              <ul class="pc-list">
                <li><span class="pc-check">✓</span><span>Link próprio para divulgar em redes sociais e WhatsApp.</span></li>
                <li><span class="pc-check">✓</span><span>Sem necessidade de produzir ou entregar o livro.</span></li>
                <li><span class="pc-check">✓</span><span>Modelo simples para afiliados, criadores e divulgadores.</span></li>
                <li><span class="pc-check">✓</span><span>Ganhe conforme suas indicações gerarem pedidos reais.</span></li>
              </ul>

              <div class="pc-actions">
                <a class="pc-btn pc-btn-primary" href="/parceiros/cadastro?tipo=venda">Quero Vender</a>
              </div>
            </div>
          </div>

          <div class="pc-examples">
            <div class="pc-examples-head">
              <h3>Quem costuma se dar bem como parceiro?</h3>
              <p>
                Existem perfis diferentes que podem aproveitar essa oportunidade. Alguns preferem
                atuar na produção local, enquanto outros gostam mais de divulgar, indicar e vender.
                Abaixo estão exemplos simulados para ajudar a visualizar melhor.
              </p>
            </div>

            <div class="pc-ex-grid">
              <div class="pc-ex-card">
                <div class="pc-ex-top">
                  <div class="pc-avatar">A</div>
                  <div>
                    <div class="pc-ex-name">Ana Paula</div>
                    <div class="pc-ex-role">Exemplo de parceira de fabricação</div>
                  </div>
                </div>
                <div class="pc-ex-text">
                  Trabalha com impressão, papelaria ou brindes personalizados e quer usar sua estrutura
                  para produzir livros na própria cidade, atendendo pedidos com mais proximidade.
                </div>
              </div>

              <div class="pc-ex-card">
                <div class="pc-ex-top">
                  <div class="pc-avatar">R</div>
                  <div>
                    <div class="pc-ex-name">Rafael</div>
                    <div class="pc-ex-role">Exemplo de parceiro de venda</div>
                  </div>
                </div>
                <div class="pc-ex-text">
                  Gosta de divulgar produtos nas redes sociais, grupos de WhatsApp ou atendimento direto.
                  Prefere focar em indicação e relacionamento sem precisar fabricar o livro.
                </div>
              </div>

              <div class="pc-ex-card">
                <div class="pc-ex-top">
                  <div class="pc-avatar">C</div>
                  <div>
                    <div class="pc-ex-name">Carla</div>
                    <div class="pc-ex-role">Exemplo híbrido de perfil empreendedor</div>
                  </div>
                </div>
                <div class="pc-ex-text">
                  Já atende famílias, trabalha com festas, fotografia, papelaria ou público infantil e
                  enxerga no Meu Livro Mágico uma nova frente de renda conectada ao que já faz hoje.
                </div>
              </div>
            </div>

            <div class="pc-fit">
              <div class="pc-fit-box">
                <h4>🏭 Pode combinar com fabricação</h4>
                <ul class="pc-fit-list">
                  <li><span class="pc-dot"></span><span>Pessoas com gráfica rápida, papelaria, encadernação ou impressão.</span></li>
                  <li><span class="pc-dot"></span><span>Quem já faz entregas locais ou atende clientes na própria cidade.</span></li>
                  <li><span class="pc-dot"></span><span>Empreendedores que gostam de operação, produção e organização.</span></li>
                  <li><span class="pc-dot"></span><span>Negócios locais que querem aproveitar estrutura já existente.</span></li>
                </ul>
              </div>

              <div class="pc-fit-box">
                <h4>🧲 Pode combinar com venda</h4>
                <ul class="pc-fit-list">
                  <li><span class="pc-dot"></span><span>Criadores de conteúdo, afiliados, divulgadores e social media.</span></li>
                  <li><span class="pc-dot"></span><span>Pessoas que têm contato com mães, pais e público infantil.</span></li>
                  <li><span class="pc-dot"></span><span>Quem gosta de indicar produtos e ganhar comissão sem operar produção.</span></li>
                  <li><span class="pc-dot"></span><span>Profissionais de fotografia, festas, lembranças e serviços infantis.</span></li>
                </ul>
              </div>
            </div>

            <div class="pc-bottomCta">
              <div>
                <h4>Escolha o caminho que mais combina com você</h4>
                <p>
                  Se você quer entrar agora, pode seguir direto para o cadastro no formato que preferir.
                  E se já se cadastrou antes, basta acessar sua área de parceiro.
                </p>
              </div>

              <div class="pc-actions" style="margin-top:0">
                <a class="pc-btn pc-btn-outline" href="/parceiros/login">🔐 Já sou parceiro</a>
                <a class="pc-btn pc-btn-primary" href="/parceiros/cadastro?tipo=venda">Começar agora</a>
              </div>
            </div>
          </div>
        </div>
        `,
        `
        <a class="btn btnOutline" href="/sales">⬅️ Voltar</a>
        <a class="btn btnPrimary" href="/parceiros/login">🔐 Sou Parceiro</a>
        `
      )
    );
  });
};