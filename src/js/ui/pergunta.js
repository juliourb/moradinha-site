// Barra de "pergunta": liga os controles segmentados e seletores ao estado.
import { textoPergunta, MEDIDAS_QUALIDADE } from "../estado/pergunta.js";

const ROTULO_MEDIDA_QUALIDADE = {
  incerteza: "Incerteza — largura da faixa de 95% em relação à estimativa; 0,5 quer dizer que a faixa tem metade do tamanho do valor.",
  qualidade_dado: "Qualidade do dado — se o hexágono tem estimativa plena, parcialmente em sigilo ou sem dado.",
  ressalva_ap: "Ressalva da área de ponderação — a AP do hexágono tem CV acima de 30% ou não tem estimativa direta.",
  cv_ap: "Precisão da amostra na AP — coeficiente de variação da estimativa direta da AP.",
  imputacao: "Parte imputada pela cascata — fração dos domicílios de 2022 cujo bloco veio da reconstrução além da AP.",
  estoque: "Mudança do estoque desde 2022 — razão do estoque do período sobre o de 2022.",
  hex_novo: "Hexágono novo no período — hexágono sem domicílio em 2022, absorvido depois.",
};
const NOME_MEDIDA_QUALIDADE = {
  incerteza: "Incerteza",
  qualidade_dado: "Qualidade do dado",
  ressalva_ap: "Ressalva da AP",
  cv_ap: "Precisão da amostra (CV)",
  imputacao: "Parte imputada",
  estoque: "Mudança do estoque",
  hex_novo: "Hexágono novo",
};

/** @param {(id:string)=>boolean} medidaConstante devolve true quando a medida é constante no período corrente */
export function ligarPergunta(elementos, manifesto, loja, medidaConstante) {
  elementos.selPeriodo.innerHTML = manifesto.periodos.map((p) => `<option value="${p.id}">${p.rotulo}</option>`).join("");
  elementos.selComparar.innerHTML =
    `<option value="">sem comparação</option>` + manifesto.periodos.map((p) => `<option value="${p.id}">${p.rotulo}</option>`).join("");
  elementos.selMedidaQualidade.innerHTML = MEDIDAS_QUALIDADE.map((id) => `<option value="${id}">${NOME_MEDIDA_QUALIDADE[id]}</option>`).join("");

  elementos.segTema.querySelectorAll("button").forEach((b) => {
    b.onclick = () => loja.definir({ tema: b.dataset.v, conjunto_graficos: b.dataset.v === "qualidade" ? 1 : 0, faixa_hist: null });
  });
  elementos.segMedida.querySelectorAll("button").forEach((b) => {
    b.onclick = () => loja.definir({ medida: b.dataset.v, faixa_hist: null });
  });
  elementos.segComponente.querySelectorAll("button").forEach((b) => {
    b.onclick = () => loja.definir({ componente: b.dataset.v, faixa_hist: null });
  });
  elementos.selPeriodo.onchange = () => {
    const periodo = elementos.selPeriodo.value;
    loja.definir({ periodo, comparar: loja.obter().comparar === periodo ? null : loja.obter().comparar, faixa_hist: null });
  };
  elementos.selComparar.onchange = () => {
    const comparar = elementos.selComparar.value || null;
    loja.definir({ comparar: comparar === loja.obter().periodo ? null : comparar, faixa_hist: null });
  };
  elementos.selMedidaQualidade.onchange = () => loja.definir({ medida_qualidade: elementos.selMedidaQualidade.value });

  function sincronizar(estado) {
    elementos.segTema.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === estado.tema)));
    elementos.segMedida.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === estado.medida)));
    elementos.segComponente.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === estado.componente)));
    elementos.selPeriodo.value = estado.periodo;
    elementos.selComparar.value = estado.comparar ?? "";
    elementos.selMedidaQualidade.value = estado.medida_qualidade;

    const qualidade = estado.tema === "qualidade";
    elementos.ctlMedida.hidden = qualidade;
    elementos.ctlMedidaQualidade.hidden = !qualidade;
    elementos.explicacaoMedidaQualidade.textContent = qualidade ? ROTULO_MEDIDA_QUALIDADE[estado.medida_qualidade] ?? "" : "";

    elementos.selMedidaQualidade.querySelectorAll("option").forEach((op) => {
      const constante = medidaConstante ? medidaConstante(op.value) : false;
      op.disabled = constante;
      op.title = constante ? "igual em todos os hexágonos neste período" : "";
    });

    elementos.question.textContent = textoPergunta(estado, manifesto);
  }

  return { sincronizar };
}
