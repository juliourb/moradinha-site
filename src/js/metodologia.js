// Composição da aba Metodologia (SPEC_F4, grafo em grupos pela SPEC_F6 B4/N18).
import { carregarJSON, carregarBinario, carregarTexto, escolherDominioEEdicao } from "./dados/pacote.js";
import {
  layoutCamadasEmColunas, parametrosDominio, linhasRastreio, agruparPipeline, arestasEntreGrupos, pipelineDoGrupo,
  ID_NO_EXPORTACAO, CLAB, COMPONENTES_MODELO,
} from "./dados/metodologia.js";
import { analisarYamlSimples } from "./util/yamlSimples.js";
import { sha256Hex } from "./util/hash.js";
import { formatar } from "./util/formato.js";
import { instalarAjudas } from "./ui/ajuda.js";

/** Grupo (nome do método) → id da seção de texto, anexo A (SPEC_F6). */
const GRUPO_PARA_TEXTO_ID = {
  Coleta: "coleta", Grade: "grade", Classificação: "classificacao", Treino: "treino",
  "Montagem 2022": "montagem2022", "Anos t": "anost", Exportação: "exportacao",
};

function $(id) {
  return document.getElementById(id);
}
function css(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

const ESPACO_X = 44;
const ESPACO_Y = 12;

// Grupos: caixas compactas numa linha só (7 grupos cabem ao lado do painel).
const LARG_GRUPO = 122;
const ALT_GRUPO = 50;
const ESPACO_GRUPO = 22;

// Tabelas expandidas (F6.4 4a): layout em camadas, da esquerda para a direita, com o
// nome inteiro em até 2 linhas e colunas curtas.
const LARGURA_NO_SUB = 178;
const ALTURA_NO_SUB = 46;
const MAX_CHARS_LINHA_SUB = 26;
const MAX_POR_COLUNA = 6;

/** Quebra um nome em até 2 linhas por palavra inteira; só corta se uma linha sozinha ainda não couber. */
function quebrarNomeDuasLinhas(nome, maxCharsPorLinha) {
  if (nome.length <= maxCharsPorLinha) return [nome];
  const palavras = nome.split(" ");
  let linha1 = "";
  let i = 0;
  while (i < palavras.length) {
    const tentativa = linha1 ? `${linha1} ${palavras[i]}` : palavras[i];
    if (tentativa.length > maxCharsPorLinha && linha1) break;
    linha1 = tentativa;
    i++;
  }
  let linha2 = palavras.slice(i).join(" ");
  if (!linha2) return [linha1];
  if (linha2.length > maxCharsPorLinha) linha2 = `${linha2.slice(0, maxCharsPorLinha - 1)}…`;
  return [linha1, linha2];
}

/** Linhas de ligação (curvas) entre caixas posicionadas por coluna/linha. */
function desenharLigacoes(nos, arestas, larguraNo, alturaNo) {
  const porId = new Map(nos.map((n) => [n.id, n]));
  const xy = (n) => ({ x: n.camada * (larguraNo + ESPACO_X), y: n.posicao * (alturaNo + ESPACO_Y) });
  return arestas
    .map((a) => {
      const de = porId.get(a.de);
      const para = porId.get(a.para);
      if (!de || !para) return "";
      const p1 = xy(de);
      const p2 = xy(para);
      const x1 = p1.x + larguraNo;
      const y1 = p1.y + alturaNo / 2;
      const x2 = p2.x;
      const y2 = p2.y + alturaNo / 2;
      const dx = Math.max(ESPACO_X / 2, (x2 - x1) / 2);
      return `<path d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}" fill="none" stroke="${css("--muted")}" stroke-width="1.4" opacity="0.7" marker-end="url(#met-seta)"/>`;
    })
    .join("");
}

const DEFS_SETA = `<defs><marker id="met-seta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${"currentColor"}"/></marker></defs>`;

/** Texto de uma etapa do método (F6.4 4c): "Síntese" em destaque e "Explicação" logo abaixo. */
function textoDoGrupo(nomeGrupo) {
  const secao = $(`met-texto-${GRUPO_PARA_TEXTO_ID[nomeGrupo]}`);
  if (!secao) return { sintese: "", explicacao: "" };
  return {
    sintese: secao.querySelector(".sintese")?.innerHTML ?? "",
    explicacao: secao.querySelector(".explicacao")?.innerHTML ?? "",
  };
}

function renderizarPipeline(el, pipeline, manifesto, config) {
  const { grupos, grupoPorEtapaId } = agruparPipeline(pipeline, manifesto, config);
  const arestasGrupos = arestasEntreGrupos(pipeline, grupoPorEtapaId);
  const nomesPresentes = grupos.map((g) => g.nome);
  const estado = { grupo: -1, tabela: null };

  const nosGrupo = grupos.map((g, i) => ({ id: g.nome, camada: i, posicao: 0, grupo: g }));
  const WG = nosGrupo.length * (LARG_GRUPO + ESPACO_GRUPO) - ESPACO_GRUPO;
  const xGrupo = (i) => i * (LARG_GRUPO + ESPACO_GRUPO);
  const ligacoesGrupos = arestasGrupos
    .filter((a) => nomesPresentes.indexOf(a.para) === nomesPresentes.indexOf(a.de) + 1)
    .map((a) => {
      const i = nomesPresentes.indexOf(a.de);
      const x1 = xGrupo(i) + LARG_GRUPO;
      const x2 = xGrupo(i + 1);
      const y = ALT_GRUPO / 2;
      return `<path d="M${x1},${y} L${x2},${y}" stroke="${css("--muted")}" stroke-width="1.4" marker-end="url(#met-seta)"/>`;
    })
    .join("");

  const caixas = nosGrupo
    .map((n) => {
      const g = n.grupo;
      const nEtapas = g.etapas.filter((e) => e.id !== ID_NO_EXPORTACAO).length;
      const sub = g.nome === "Exportação" ? "pacote" : `${nEtapas} tabela${nEtapas === 1 ? "" : "s"}`;
      return `<g class="no-pipeline" tabindex="0" role="button" aria-expanded="false" data-grupo="${g.nome}" transform="translate(${xGrupo(n.camada)},0)" aria-label="${g.nome}: ${sub} — abrir o texto da etapa">
        <rect width="${LARG_GRUPO}" height="${ALT_GRUPO}" rx="8" fill="${css("--surface")}" stroke="${css("--accent")}" stroke-width="1.5"/>
        <text x="10" y="21" font-size="13" font-weight="650" fill="${css("--ink")}">${g.nome}</text>
        <text x="10" y="38" font-size="10" fill="${css("--muted")}">${sub}</text>
      </g>`;
    })
    .join("");

  el.innerHTML = `<div class="met-layout">
      <div class="met-grafo">
        <svg viewBox="0 0 ${WG} ${ALT_GRUPO}" width="100%" role="group" aria-label="Pipeline do moradinha por etapa do método, da coleta à exportação" style="color:${css("--muted")}">${DEFS_SETA}${ligacoesGrupos}${caixas}</svg>
        <div id="met-pipeline-expandido"></div>
      </div>
      <div class="met-painel" id="met-painel" role="region" aria-label="Texto da etapa" aria-live="polite"><p class="sub">Clique numa etapa do método para ler o texto dela; depois, numa tabela, para ver o nome.</p></div>
    </div>`;

  const painel = $("met-painel");

  function setas() {
    return `<span class="met-setas"><button type="button" class="iconbtn" data-seta="-1" aria-label="Anterior">←</button><button type="button" class="iconbtn" data-seta="1" aria-label="Próximo">→</button></span>`;
  }

  function desenharPainelGrupo(grupo) {
    const { sintese, explicacao } = textoDoGrupo(grupo.nome);
    painel.innerHTML = `<div class="met-painel-cab"><h4>${grupo.nome}</h4>${setas()}</div>
      <div class="met-sintese">${sintese}</div><div class="met-explicacao">${explicacao}</div>`;
  }

  function desenharPainelTabela(grupo, no) {
    painel.innerHTML = `<div class="met-painel-cab"><h4>Tabela</h4>${setas()}</div>
      <div class="met-tabela-nome">${no.nome}</div>
      <div class="sub">Etapa do método: ${grupo.nome}</div>
      <p><button type="button" class="iconbtn" id="met-voltar-grupo">Ver o texto da etapa ${grupo.nome}</button></p>`;
    $("met-voltar-grupo").onclick = () => selecionarGrupo(nomesPresentes.indexOf(grupo.nome));
  }

  function ligarSetas(aoMover) {
    painel.querySelectorAll("[data-seta]").forEach((b) => (b.onclick = () => aoMover(Number(b.dataset.seta))));
  }

  let nosTabela = [];

  function selecionarTabela(grupo, idx) {
    const i = Math.max(0, Math.min(nosTabela.length - 1, idx));
    estado.tabela = i;
    const no = nosTabela[i];
    document.querySelectorAll("#met-pipeline-expandido .no-tabela").forEach((g) => g.classList.toggle("selecionado", g.dataset.id === no.id));
    desenharPainelTabela(grupo, no);
    ligarSetas((d) => selecionarTabela(grupo, estado.tabela + d));
  }

  function selecionarGrupo(idx) {
    const i = Math.max(0, Math.min(nomesPresentes.length - 1, idx));
    estado.grupo = i;
    estado.tabela = null;
    const grupo = grupos[i];
    el.querySelectorAll(".no-pipeline").forEach((n) => n.setAttribute("aria-expanded", String(n.dataset.grupo === grupo.nome)));

    const expandidoEl = $("met-pipeline-expandido");
    nosTabela = [];
    if (grupo.nome === "Exportação" && grupo.etapas.length === 1 && grupo.etapas[0].id === ID_NO_EXPORTACAO) {
      expandidoEl.innerHTML = "";
    } else {
      const sub = pipelineDoGrupo(pipeline, grupo);
      const { nos, arestas, nColunas, maiorColuna } = layoutCamadasEmColunas(sub, MAX_POR_COLUNA);
      nosTabela = [...nos].sort((x, y) => x.camada - y.camada || x.posicao - y.posicao);
      const We = nColunas * (LARGURA_NO_SUB + ESPACO_X) - ESPACO_X;
      const He = maiorColuna * (ALTURA_NO_SUB + ESPACO_Y) - ESPACO_Y;
      const caixasE = nosTabela
        .map((n) => {
          const x = n.camada * (LARGURA_NO_SUB + ESPACO_X);
          const y = n.posicao * (ALTURA_NO_SUB + ESPACO_Y);
          const linhasNome = quebrarNomeDuasLinhas(n.nome, MAX_CHARS_LINHA_SUB);
          const textoNome = linhasNome.map((l, i) => `<text x="8" y="${18 + i * 13}" font-size="11" fill="${css("--ink")}">${l}</text>`).join("");
          return `<g class="no-tabela" tabindex="0" role="button" data-id="${n.id}" transform="translate(${x},${y})" aria-label="Tabela ${n.nome}">
            <rect width="${LARGURA_NO_SUB}" height="${ALTURA_NO_SUB}" rx="8" fill="${css("--surface")}" stroke="${css("--line")}" stroke-width="1.2"/>
            <title>${n.nome}</title>
            ${textoNome}
          </g>`;
        })
        .join("");
      expandidoEl.innerHTML = `<header class="graf-cab"><h4>Tabelas da etapa ${grupo.nome}</h4></header><div class="grafico-dica">Cada caixa é uma tabela do pipeline; as linhas mostram de onde cada uma vem, da esquerda para a direita. Clique numa tabela para ver o nome no painel.</div>
        <svg viewBox="0 0 ${We} ${He}" width="100%" style="max-width:${We}px;color:var(--muted)" role="group" aria-label="Tabelas do grupo ${grupo.nome}">${DEFS_SETA.replace("met-seta", "met-seta2")}${desenharLigacoes(nos, arestas, LARGURA_NO_SUB, ALTURA_NO_SUB).replaceAll("met-seta", "met-seta2")}${caixasE}</svg>`;
      instalarAjudas(expandidoEl);
      expandidoEl.querySelectorAll(".no-tabela").forEach((g) => {
        const abrir = () => selecionarTabela(grupo, nosTabela.findIndex((n) => n.id === g.dataset.id));
        g.addEventListener("click", abrir);
        g.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            abrir();
          }
        });
      });
    }
    desenharPainelGrupo(grupo);
    ligarSetas((d) => selecionarGrupo(estado.grupo + d));
  }

  el.querySelectorAll(".no-pipeline").forEach((no) => {
    const abrir = () => selecionarGrupo(nomesPresentes.indexOf(no.dataset.grupo));
    no.addEventListener("click", abrir);
    no.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        abrir();
      }
    });
  });

  // ← → passam para o item seguinte do nível aberto: tabela (se uma estiver selecionada) ou grupo.
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    if (estado.grupo === -1 || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? "")) return;
    const delta = ev.key === "ArrowRight" ? 1 : -1;
    if (estado.tabela != null) selecionarTabela(grupos[estado.grupo], estado.tabela + delta);
    else selecionarGrupo(estado.grupo + delta);
  });
}

function renderizarParametros(el, manifesto) {
  const { periodos, limiares } = parametrosDominio(manifesto);
  const linhasPeriodos = periodos
    .map((p) => `<tr><td>${p.rotulo}</td><td>${p.tipoRotulo}</td><td>${p.fonteEstoque}</td></tr>`)
    .join("");
  const linhasLimiares = Object.values(limiares)
    .map((l) => `<tr><td>${l.rotulo}</td><td data-num="${l.valor}">${formatar(l.valor, l.valor < 10 ? 2 : 0)}${l.unidade}</td></tr>`)
    .join("");
  el.innerHTML = `
    <h4>Períodos</h4>
    <table class="ponte"><thead><tr><th>Período</th><th>Tipo</th><th>Fonte do estoque</th></tr></thead><tbody>${linhasPeriodos}</tbody></table>
    <h4 style="margin-top:14px">Limiares do protocolo</h4>
    <table class="ponte"><thead><tr><th>Limiar</th><th>Valor</th></tr></thead><tbody>${linhasLimiares}</tbody></table>`;
}

async function renderizarRastreio(el, manifesto, edicaoOrigem, versaoSite) {
  const { edicao, commitCompleto, dataExecucao, contrato, arquivos } = linhasRastreio(manifesto);
  el.innerHTML = `
    <div class="pills">
      <span class="pill info">edição: ${edicao}</span>
      <span class="pill info">commit do moradinha: ${commitCompleto}</span>
      <span class="pill info">executado em: ${dataExecucao.slice(0, 10)}</span>
      <span class="pill info">contrato: v${contrato}</span>
      <span class="pill info">commit deste site: ${versaoSite}</span>
    </div>
    <table class="ponte" id="met-rastreio-arquivos"><thead><tr><th>Arquivo</th><th>Hash esperado (manifesto)</th><th>Conferência</th></tr></thead><tbody>${arquivos
      .map(
        (a) =>
          `<tr data-arquivo="${a.nome}"><td>${a.nome}</td><td style="font-family:monospace;font-size:11px">${a.hashEsperado}</td><td class="status">verificando…</td></tr>`
      )
      .join("")}</tbody></table>`;

  await Promise.all(
    arquivos.map(async (a) => {
      const linha = el.querySelector(`tr[data-arquivo="${a.nome}"] .status`);
      try {
        const bytes = await carregarBinario(edicaoOrigem, a.nome);
        const real = await sha256Hex(bytes);
        const ok = real === a.hashEsperado;
        linha.innerHTML = `<span class="pill ${ok ? "ok" : "crit"}" data-status="${ok ? "ok" : "divergente"}">${ok ? "ok" : "divergente"}</span>`;
      } catch {
        linha.innerHTML = `<span class="pill crit" data-status="erro">erro ao buscar</span>`;
      }
    })
  );
}

/**
 * Monta o HTML da seção interna — função pura (testável sem DOM). Só é chamada
 * quando `#met-interna` existe, ou seja, só no build `--profile interno`
 * (no build público o bloco inteiro é removido do HTML por `when-profile`,
 * SPEC_F4 item 5). Os dois pacotes fictícios são `manifesto.publico = true`,
 * e o validador (V10) proíbe `interno` em modelo.json nesse caso — por isso,
 * com eles, esta função sempre cai no "sem dados internos registrados".
 */
export function montarInternaHtml(modelo) {
  const cartoes = COMPONENTES_MODELO.map((c) => {
    const interno = modelo[c]?.interno;
    if (!interno) return `<div class="cartao-f3"><div class="k">${CLAB[c]}</div><div class="sub">sem dados internos registrados</div></div>`;
    const itens = Object.entries(interno)
      .map(([k, v]) => `<span class="pill info">${k}: ${typeof v === "number" ? formatar(v, 2) : v}</span>`)
      .join("");
    return `<div class="cartao-f3"><div class="k">${CLAB[c]}</div><div class="pills">${itens}</div></div>`;
  }).join("");
  return `<div class="aviso-interno">Atenção: desfecho interno, não publicado.</div><div class="cartoes-f3">${cartoes}</div>`;
}

function renderizarInterna(el, modelo) {
  if (!el) return; // ausente no build público: o bloco quarto inteiro é removido no render (when-profile)
  el.innerHTML = montarInternaHtml(modelo);
}

export async function iniciarMetodologia() {
  const painel = $("met-pipeline");
  if (!painel) return;

  const catalogo = await carregarJSON(".", "catalogo.json");
  const { edicao } = escolherDominioEEdicao(catalogo);
  const [manifesto, pipeline, modelo, configTexto] = await Promise.all([
    carregarJSON(edicao.origem, "manifesto.json"),
    carregarJSON(edicao.origem, "pipeline.json"),
    carregarJSON(edicao.origem, "modelo.json"),
    carregarTexto("textos/metodologia/grupos_pipeline.yml"),
  ]);
  const config = analisarYamlSimples(configTexto);

  renderizarPipeline(painel, pipeline, manifesto, config);
  renderizarParametros($("met-parametros"), manifesto);
  await renderizarRastreio($("met-rastreio"), manifesto, edicao.origem, __VERSAO_SITE__);
  renderizarInterna($("met-interna"), modelo);
}
