// Composição da aba Metodologia (SPEC_F4).
import { carregarJSON, carregarBinario, escolherDominioEEdicao } from "./dados/pacote.js";
import { camadasPipeline, parametrosDominio, linhasRastreio, CLAB, COMPONENTES_MODELO } from "./dados/metodologia.js";
import { sha256Hex } from "./util/hash.js";
import { formatar } from "./util/formato.js";

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

function renderizarPipeline(el, pipeline) {
  const { nos, arestas, nCamadas, maiorCamada } = camadasPipeline(pipeline);
  const W = nCamadas * (LARGURA_NO + ESPACO_X) - ESPACO_X;
  const H = maiorCamada * (ALTURA_NO + ESPACO_Y) - ESPACO_Y;
  const porId = new Map(nos.map((n) => [n.id, n]));
  const xy = (n) => ({
    x: n.camada * (LARGURA_NO + ESPACO_X),
    y: n.posicao * (ALTURA_NO + ESPACO_Y),
  });

  const linhas = arestas
    .map((a) => {
      const de = xy(porId.get(a.de));
      const para = xy(porId.get(a.para));
      const x1 = de.x + LARGURA_NO;
      const y1 = de.y + ALTURA_NO / 2;
      const x2 = para.x;
      const y2 = para.y + ALTURA_NO / 2;
      return `<path d="M${x1},${y1} C${x1 + ESPACO_X / 2},${y1} ${x2 - ESPACO_X / 2},${y2} ${x2},${y2}" fill="none" stroke="${css("--line")}" stroke-width="2"/>`;
    })
    .join("");

  const caixas = nos
    .map((n) => {
      const { x, y } = xy(n);
      const dataCommit = `${n.commit.slice(0, 7)} · ${n.data}`;
      return `<g class="no-pipeline" tabindex="0" role="button" data-etapa="${n.id}" transform="translate(${x},${y})" aria-label="${n.nome} ${dataCommit} — ir para o texto desta etapa">
        <rect width="${LARGURA_NO}" height="${ALTURA_NO}" rx="8" fill="${css("--surface")}" stroke="${css("--accent")}" stroke-width="1.5"/>
        <text x="10" y="18" font-size="13" font-weight="650" fill="${css("--ink")}">${n.nome}</text>
        <text x="10" y="34" font-size="10" fill="${css("--muted")}">${dataCommit}</text>
      </g>`;
    })
    .join("");

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="group" aria-label="Pipeline do moradinha, da coleta à exportação">${linhas}${caixas}</svg>`;

  el.querySelectorAll(".no-pipeline").forEach((no) => {
    const irParaTexto = () => {
      const destino = $(`met-texto-${no.dataset.etapa}`);
      destino?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    no.addEventListener("click", irParaTexto);
    no.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        irParaTexto();
      }
    });
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
  const [manifesto, pipeline, modelo] = await Promise.all([
    carregarJSON(edicao.origem, "manifesto.json"),
    carregarJSON(edicao.origem, "pipeline.json"),
    carregarJSON(edicao.origem, "modelo.json"),
  ]);

  renderizarPipeline(painel, pipeline);
  renderizarParametros($("met-parametros"), manifesto);
  await renderizarRastreio($("met-rastreio"), manifesto, edicao.origem, __VERSAO_SITE__);
  renderizarInterna($("met-interna"), modelo);
}
