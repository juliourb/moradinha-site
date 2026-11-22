// Composição do explorador da aba Resultados (SPEC_F1). Carrega o pacote,
// cria o estado e liga mapa, resposta, painel do hexágono e gráficos.
import { criarLoja } from "./estado/loja.js";
import { estadoInicial, salvarLocalStorage } from "./estado/pergunta.js";
import { carregarJSON, carregarPacoteCompleto, escolherDominioEEdicao } from "./dados/pacote.js";
import { valorHex } from "./dados/calculo.js";
import { valorMedidaQualidade, medidaConstante, TIPO_MEDIDA } from "./dados/qualidade.js";
import { criarMapa } from "./mapa/index.js";
import { ligarPergunta } from "./ui/pergunta.js";
import { renderizarResposta } from "./ui/resposta.js";
import { renderizarHexagono } from "./ui/hexagono.js";
import { renderizarHistograma, renderizarRanking, renderizarSerie, renderizarCaixas } from "./graficos/deficit.js";
import { renderizarHistogramaQualidade, renderizarDispersao, renderizarComposicao, renderizarEstoque } from "./graficos/qualidade.js";

const NOME_MEDIDA_QUALIDADE = {
  incerteza: "Incerteza", qualidade_dado: "Qualidade do dado", ressalva_ap: "Ressalva da AP",
  cv_ap: "Precisão da amostra (CV)", imputacao: "Parte imputada", estoque: "Mudança do estoque", hex_novo: "Hexágono novo",
};
const CLAB = { total: "Total", coabitacao: "Coabitação", onus: "Ônus", precariedade: "Precariedade" };

function $(id) {
  return document.getElementById(id);
}

export async function iniciarExplorador() {
  const painel = $("pane-resultados");
  if (!painel) return;

  const catalogo = await carregarJSON(".", "catalogo.json");
  const { edicao } = escolherDominioEEdicao(catalogo);
  const dados = await carregarPacoteCompleto(edicao.origem);
  const { manifesto, totais, linhas, ap } = dados;
  const linhasArr = [...linhas.values()];

  const loja = criarLoja(estadoInicial(manifesto));
  // Seam de teste (Playwright): seleciona um hexágono sem precisar simular o
  // clique no canvas do mapa. Não faz parte da API pública do explorador.
  window.__moradinhaSelecionarHex = (h3) => loja.definir({ selecionado: h3 });

  const elementosPergunta = {
    question: $("f1-question"),
    segTema: $("f1-seg-tema"),
    ctlMedida: $("f1-ctl-medida"),
    ctlMedidaQualidade: $("f1-ctl-medida-qualidade"),
    selMedidaQualidade: $("f1-sel-medida-qualidade"),
    explicacaoMedidaQualidade: $("f1-medida-qualidade-explicacao"),
    segMedida: $("f1-seg-med"),
    segComponente: $("f1-seg-comp"),
    selPeriodo: $("f1-sel-per"),
    selComparar: $("f1-sel-cmp"),
  };

  function ehMedidaConstante(id) {
    return medidaConstante(linhasArr, loja.obter().periodo, id, loja.obter().componente, ap);
  }
  const { sincronizar: sincronizarPergunta } = ligarPergunta(elementosPergunta, manifesto, loja, ehMedidaConstante);

  const elementosMapa = {
    deckA: $("f1-deckA"), deckB: $("f1-deckB"), divider: $("f1-divider"),
    labA: $("f1-labA"), labB: $("f1-labB"), legend: $("f1-legend"),
    basefail: $("f1-basefail"), layers: $("f1-layers"), mapboxEl: $("f1-mapbox"),
    aoSelecionar: (h3) => loja.definir({ selecionado: h3 }),
  };
  const mapa = criarMapa({
    elementos: elementosMapa, manifesto, linhas, ap,
    contornosAp: dados.contornosAp, contornosMunicipios: dados.contornosMunicipios, contornosFcu: dados.contornosFcu,
  });

  const elementosResposta = { lab: $("f1-ans-lab"), big: $("f1-ans-big"), range: $("f1-ans-range"), pills: $("f1-ans-pills"), cards: $("f1-cards") };
  const elDetail = $("f1-detail");

  function obterValorMapa(estado) {
    if (estado.tema === "qualidade") {
      return { fn: (l, periodo) => valorMedidaQualidade(l, periodo, estado.medida_qualidade, estado.componente, ap), tipo: TIPO_MEDIDA[estado.medida_qualidade] };
    }
    return { fn: (l, periodo) => valorHex(l, estado.componente, periodo, estado.medida), tipo: "deficit" };
  }

  function rotuloLegenda(estado) {
    if (estado.tema === "qualidade") return `${NOME_MEDIDA_QUALIDADE[estado.medida_qualidade]} · ${CLAB[estado.componente]}`;
    const unidade = estado.medida === "relativo" ? "relativo (% dos domicílios)" : "absoluto (domicílios)";
    return `${CLAB[estado.componente]} · ${unidade}`;
  }

  function renderizarGraficos(estado) {
    const dock = $("f1-dock");
    if (dock.classList.contains("collapsed")) return;
    if (estado.conjunto_graficos === 0) {
      renderizarHistograma($("f1-hist"), estado, linhasArr, (faixa) => loja.definir({ faixa_hist: faixa }));
      renderizarRanking($("f1-rank"), estado, linhasArr, ap, (h3) => loja.definir({ selecionado: h3 }));
      renderizarSerie($("f1-series"), estado, manifesto, totais, (periodo) => loja.definir({ periodo, faixa_hist: null }));
      renderizarCaixas($("f1-boxes"), estado, manifesto, linhasArr, (periodo) => loja.definir({ periodo, faixa_hist: null }));
    } else {
      renderizarHistogramaQualidade($("f1-qhist"), estado, linhasArr, ap, (faixa) => loja.definir({ faixa_hist: faixa }));
      renderizarDispersao($("f1-disp"), estado, linhasArr, (h3) => loja.definir({ selecionado: h3 }));
      renderizarComposicao($("f1-comp"), manifesto, linhasArr, ap, estado);
      renderizarEstoque($("f1-estoque"), manifesto, linhasArr);
    }
  }

  function renderTudo(estado) {
    sincronizarPergunta(estado);
    const { fn: obterValor, tipo } = obterValorMapa(estado);
    mapa.renderizar(estado, obterValor, rotuloLegenda(estado), tipo);
    mapa.renderizarCamadasUI(estado, (id, ligado) => loja.definir({ camadas: { ...loja.obter().camadas, [id]: ligado } }));
    renderizarResposta(elementosResposta, estado, manifesto, totais, (componente) => loja.definir({ componente, faixa_hist: null }));
    renderizarHexagono(elDetail, estado, linhas, ap, manifesto);
    renderizarGraficos(estado);
    salvarLocalStorage(estado);
  }

  // Carrossel e dock
  const dock = $("f1-dock");
  const dockToggle = $("f1-dock-toggle");
  const corpoDeficit = $("f1-dock-body-deficit");
  const corpoQualidade = $("f1-dock-body-qualidade");
  const titulo = $("f1-dock-titulo");
  const pontosEl = $("f1-carrossel-pontos");
  pontosEl.innerHTML = [0, 1]
    .map((i) => `<button type="button" data-i="${i}" aria-label="Conjunto ${i === 0 ? "Déficit" : "Qualidade"}"></button>`)
    .join("");

  function atualizarCarrossel(estado) {
    const qualidade = estado.conjunto_graficos === 1;
    corpoDeficit.hidden = qualidade;
    corpoQualidade.hidden = !qualidade;
    titulo.textContent = `Gráficos ligados ao mapa — ${qualidade ? "Qualidade" : "Déficit"}`;
    pontosEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", String(Number(b.dataset.i) === estado.conjunto_graficos)));
  }
  pontosEl.querySelectorAll("button").forEach((b) => (b.onclick = () => loja.definir({ conjunto_graficos: Number(b.dataset.i) })));
  $("f1-carrossel-prev").onclick = () => loja.definir({ conjunto_graficos: loja.obter().conjunto_graficos === 0 ? 1 : 0 });
  $("f1-carrossel-next").onclick = () => loja.definir({ conjunto_graficos: loja.obter().conjunto_graficos === 0 ? 1 : 0 });

  dockToggle.onclick = () => {
    const colapsado = dock.classList.toggle("collapsed");
    painel.classList.toggle("dock-off", colapsado);
    dockToggle.textContent = colapsado ? "Mostrar gráficos" : "Minimizar todos";
    dockToggle.setAttribute("aria-expanded", String(!colapsado));
    if (!colapsado) renderizarGraficos(loja.obter());
  };
  document.querySelectorAll(".dcard header .iconbtn").forEach((b) => {
    b.onclick = () => {
      const card = b.closest(".dcard");
      const min = card.classList.toggle("min");
      b.textContent = min ? "+" : "–";
      renderizarGraficos(loja.obter());
    };
  });
  let rt;
  new ResizeObserver(() => {
    clearTimeout(rt);
    rt = setTimeout(() => renderizarGraficos(loja.obter()), 120);
  }).observe(dock);

  // Menu "Mais" (SPEC_F1 v1.3): abaixo de 1600px, "comparar com (cortina)" só
  // aparece ao abrir o menu; acima de 1600px, o CSS mostra tudo em linha
  // (display:contents) e o botão fica escondido.
  const maisBtn = $("f1-mais-btn");
  const maisMenu = $("f1-mais-menu");
  maisBtn.onclick = () => {
    const aberto = maisMenu.hasAttribute("hidden");
    if (aberto) maisMenu.removeAttribute("hidden");
    else maisMenu.setAttribute("hidden", "");
    maisBtn.setAttribute("aria-expanded", String(aberto));
  };
  document.addEventListener("click", (e) => {
    if (!$("f1-ctl-mais").contains(e.target) && !maisMenu.hasAttribute("hidden") && matchMedia("(max-width: 1599.98px)").matches) {
      maisMenu.setAttribute("hidden", "");
      maisBtn.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !maisMenu.hasAttribute("hidden")) {
      maisMenu.setAttribute("hidden", "");
      maisBtn.setAttribute("aria-expanded", "false");
    }
  });

  loja.assinar((estado) => {
    atualizarCarrossel(estado);
    renderTudo(estado);
  });
  atualizarCarrossel(loja.obter());
  renderTudo(loja.obter());
}
