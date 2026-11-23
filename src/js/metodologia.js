// Composição da aba Metodologia (SPEC_F4, grafo em grupos pela SPEC_F6 B4/N18).
import { carregarJSON, carregarBinario, carregarTexto, escolherDominioEEdicao } from "./dados/pacote.js";
import {
  camadasPipeline, parametrosDominio, linhasRastreio, agruparPipeline, arestasEntreGrupos, pipelineDoGrupo,
  ID_NO_EXPORTACAO, CLAB, COMPONENTES_MODELO,
} from "./dados/metodologia.js";
import { analisarYamlSimples } from "./util/yamlSimples.js";
import { sha256Hex } from "./util/hash.js";
import { formatar } from "./util/formato.js";

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

const LARGURA_NO = 150;
const ALTURA_NO = 46;
const ESPACO_X = 60;
const ESPACO_Y = 14;

// Subetapas expandidas (SPEC_F6.3 item 9): grade de várias colunas (uma por
// camada do grafo) com o nome inteiro, quebrado em até 2 linhas — não truncado
// com "…"; o nome completo também vai na dica (<title>).
const LARGURA_NO_SUB = 190;
const ALTURA_NO_SUB = 58;
const MAX_CHARS_LINHA_SUB = 24;

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

/** Desenha um mini-grafo em camadas (coleção de nós + arestas já com camada/posicao) — reusado para o grupo expandido. */
function montarSvgCaixas(nos, arestas, { larguraNo = LARGURA_NO, alturaNo = ALTURA_NO } = {}) {
  const nCamadas = Math.max(...nos.map((n) => n.camada)) + 1;
  const maiorCamada = Math.max(1, ...[...d3GrupoContagem(nos)].map(([, v]) => v));
  const W = nCamadas * (larguraNo + ESPACO_X) - ESPACO_X;
  const H = maiorCamada * (alturaNo + ESPACO_Y) - ESPACO_Y;
  const porId = new Map(nos.map((n) => [n.id, n]));
  const xy = (n) => ({ x: n.camada * (larguraNo + ESPACO_X), y: n.posicao * (alturaNo + ESPACO_Y) });

  const linhas = arestas
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
      return `<path d="M${x1},${y1} C${x1 + ESPACO_X / 2},${y1} ${x2 - ESPACO_X / 2},${y2} ${x2},${y2}" fill="none" stroke="${css("--line")}" stroke-width="2"/>`;
    })
    .join("");
  return { W, H, linhas, xy };
}

function d3GrupoContagem(nos) {
  const m = new Map();
  for (const n of nos) m.set(n.camada, (m.get(n.camada) ?? 0) + 1);
  return m;
}

let grupoAtualIdx = -1;

function renderizarPipeline(el, pipeline, manifesto, config) {
  const { grupos, grupoPorEtapaId } = agruparPipeline(pipeline, manifesto, config);
  const arestasGrupos = arestasEntreGrupos(pipeline, grupoPorEtapaId);
  const nomesPresentes = grupos.map((g) => g.nome);

  const LARG_GRUPO = 170;
  const ALT_GRUPO = 56;
  const nosGrupo = grupos.map((g, i) => ({ id: g.nome, camada: i, posicao: 0, grupo: g }));
  const { W, H, linhas } = montarSvgCaixas(nosGrupo, arestasGrupos, { larguraNo: LARG_GRUPO, alturaNo: ALT_GRUPO });

  const caixas = nosGrupo
    .map((n) => {
      const x = n.camada * (LARG_GRUPO + ESPACO_X);
      const g = n.grupo;
      const nEtapas = g.etapas.filter((e) => e.id !== ID_NO_EXPORTACAO).length;
      const sub = g.nome === "Exportação" ? "pacote de publicação" : `${nEtapas} tabela${nEtapas === 1 ? "" : "s"}`;
      return `<g class="no-pipeline" tabindex="0" role="button" aria-expanded="false" data-grupo="${g.nome}" transform="translate(${x},0)" aria-label="${g.nome}: ${sub} — expandir e ir para o texto">
        <rect width="${LARG_GRUPO}" height="${ALT_GRUPO}" rx="8" fill="${css("--surface")}" stroke="${css("--accent")}" stroke-width="1.5"/>
        <text x="10" y="22" font-size="13" font-weight="650" fill="${css("--ink")}">${g.nome}</text>
        <text x="10" y="40" font-size="10" fill="${css("--muted")}">${sub}</text>
      </g>`;
    })
    .join("");

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="group" aria-label="Pipeline do moradinha por etapa do método, da coleta à exportação">${linhas}${caixas}</svg>
    <div id="met-pipeline-expandido"></div>`;

  function expandirGrupo(nomeGrupo) {
    const idx = nomesPresentes.indexOf(nomeGrupo);
    if (idx === -1) return;
    grupoAtualIdx = idx;
    el.querySelectorAll(".no-pipeline").forEach((n) => n.setAttribute("aria-expanded", String(n.dataset.grupo === nomeGrupo)));

    const grupo = grupos[idx];
    const expandidoEl = $("met-pipeline-expandido");
    if (grupo.nome === "Exportação" && grupo.etapas.length === 1 && grupo.etapas[0].id === ID_NO_EXPORTACAO) {
      const n = grupo.etapas[0];
      expandidoEl.innerHTML = `<div class="pergunta-bloco"><h4>${n.nome}</h4><div class="significado">${n.descricao}</div></div>`;
    } else {
      const sub = pipelineDoGrupo(pipeline, grupo);
      const { nos, arestas } = camadasPipeline(sub);
      const { W: We, H: He, linhas: linhasE } = montarSvgCaixas(nos, arestas, { larguraNo: LARGURA_NO_SUB, alturaNo: ALTURA_NO_SUB });
      const caixasE = nos
        .map((n) => {
          const x = n.camada * (LARGURA_NO_SUB + ESPACO_X);
          const y = n.posicao * (ALTURA_NO_SUB + ESPACO_Y);
          const dataCommit = `${n.commit.slice(0, 7)} · ${n.data}`;
          const linhasNome = quebrarNomeDuasLinhas(n.nome, MAX_CHARS_LINHA_SUB);
          const textoNome = linhasNome.map((l, i) => `<text x="8" y="${16 + i * 13}" font-size="11" fill="${css("--ink")}">${l}</text>`).join("");
          return `<g transform="translate(${x},${y})"><rect width="${LARGURA_NO_SUB}" height="${ALTURA_NO_SUB}" rx="8" fill="${css("--surface")}" stroke="${css("--line")}" stroke-width="1.2"/>
            <title>${n.nome} — ${n.commit} · ${n.data}</title>
            ${textoNome}
            <text x="8" y="${16 + linhasNome.length * 13 + 4}" font-size="9" fill="${css("--muted")}">${dataCommit}</text>
          </g>`;
        })
        .join("");
      expandidoEl.innerHTML = `<div class="como-ler">Tabelas do grupo ${grupo.nome}, com as ligações entre elas.</div>
        <svg viewBox="0 0 ${We} ${He}" width="100%" height="${He}" role="group" aria-label="Tabelas do grupo ${grupo.nome}">${linhasE}${caixasE}</svg>`;
    }

    const textoId = GRUPO_PARA_TEXTO_ID[nomeGrupo];
    const destino = $(`met-texto-${textoId}`);
    const subEl = $(`met-sub-${textoId}`);
    if (subEl) {
      const descricoes = grupo.etapas
        .filter((e) => e.id !== ID_NO_EXPORTACAO && e.descricao)
        .map((e) => `<div>${e.nome}: ${e.descricao}</div>`)
        .join("");
      subEl.innerHTML = descricoes;
    }
    destino?.scrollIntoView({ behavior: "smooth", block: "start" });
    destino?.focus();
  }

  el.querySelectorAll(".no-pipeline").forEach((no) => {
    const abrir = () => expandirGrupo(no.dataset.grupo);
    no.addEventListener("click", abrir);
    no.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        abrir();
      }
    });
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    if (grupoAtualIdx === -1) return;
    const delta = ev.key === "ArrowRight" ? 1 : -1;
    const proximo = Math.max(0, Math.min(nomesPresentes.length - 1, grupoAtualIdx + delta));
    expandirGrupo(nomesPresentes[proximo]);
  });
}

function renderizarParametros(el, manifesto) {
  const { periodos, limiares } = parametrosDominio(manifesto);
  const linhasPeriodos = periodos
    .map((p) => `<tr><td>${p.rotulo}</td><td>${p.tipo}</td><td>${p.fonteEstoque}</td></tr>`)
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
