// Tabela "FJP × moradinha" — o MESMO componente na Visão geral (Detalhes) e na
// Confiabilidade (SPEC F6.5 4b): FJP comparável (sem CadÚnico), reconstrução do
// moradinha na PNADc com a faixa de 95% e total do mapa. A observação do CadÚnico
// só aparece em Total e Habitação precária. Cada número responde ao mouse.
import { fjpTresValores } from "../dados/visaoGeral.js";
import { rotulo } from "../util/rotulos.js";
import { formatar } from "../util/formato.js";
import { instalarAjudas, ligarDicaPorAtributos, attr } from "./ajuda.js";

const NOME_INDICADOR = {
  total: "Total", habitacao_precaria: "Habitação precária", coabitacao: "Coabitação",
  onus: "Ônus excessivo com aluguel", domicilios: "Domicílios",
};

const AJUDA =
  "Cada linha compara um indicador do déficit em três números: o que a FJP publica sem a parte do CadÚnico (que a PNADc não capta), o que o moradinha reconstrói na PNADc com a faixa de 95%, e o total que ficou no mapa. Passe o mouse num número para ver de onde vem.";

/**
 * @param {HTMLElement} el
 * @param {object[]} referenciaFjp conteúdo de referencia_fjp.json
 * @param {{ titulo?: "h3" | "sub" }} [opcoes] h3 = título próprio (Visão geral); sub = a página já tem o título (Confiabilidade)
 */
export function renderizarFjp(el, referenciaFjp, { titulo = "h3" } = {}) {
  const itens = fjpTresValores(referenciaFjp ?? []);
  if (!itens.length) {
    el.innerHTML = `<p class="empty">Sem referência da FJP neste pacote.</p>`;
    return;
  }
  const anoRef = itens[0]?.ano_ref;
  const texto = `Comparação com a FJP${anoRef != null ? `, ${anoRef}` : ""}`;
  const num = (v) => (v == null ? "—" : formatar(v, 0));
  const cab = titulo === "h3" ? `<h3>${texto}</h3>` : `<header class="graf-cab"><span class="sub">${texto}</span></header>`;
  const linhas = itens
    .map((item) => {
      const nome = NOME_INDICADOR[item.indicador] ?? rotulo(item.indicador);
      const faixaTxt = item.faixa ? `faixa de 95%: ${formatar(item.faixa.inf, 0)} a ${formatar(item.faixa.sup, 0)}` : "sem faixa de 95%";
      const dentro = item.dentro == null ? "" : ` · o valor da FJP sem CadÚnico cai ${item.dentro ? "dentro" : "fora"} da faixa`;
      const obs =
        item.cadUnico > 0 && item.fjp_publicado != null && ["total", "habitacao_precaria"].includes(item.indicador)
          ? `<div class="fjp-sub fjp-obs">A FJP publica ${formatar(item.fjp_publicado, 0)}, dos quais ${formatar(item.cadUnico, 0)} são improvisados do CadÚnico, que a PNADc não capta.</div>`
          : "";
      const fonte =
        item.fjp_publicado != null
          ? `<div class="fjp-sub">${item.fjp_fonte}${item.fjp_tabela ? `, ${item.fjp_tabela}` : ""}${item.fjp_pagina ? `, p. ${item.fjp_pagina}` : ""}${item.fjp_url ? ` · <a href="${item.fjp_url}" target="_blank" rel="noopener">link</a>` : ""}</div>`
          : "";
      const dica = (coluna, valor, faixa, base) =>
        `data-dica-titulo="${attr(nome)} · ${attr(coluna)}" data-dica-valor="${attr(valor)}"${faixa ? ` data-dica-faixa="${attr(faixa)}"` : ""}${base ? ` data-dica-base="${attr(base)}"` : ""}`;
      return `<div class="fjp-linha">
        <h4>${nome}</h4>
        <div class="fjp-colunas">
          <div class="fjp-col" ${dica("FJP comparável", item.semCadUnico == null ? "a preencher" : num(item.semCadUnico), null, item.fjp_fonte)}><div class="k">FJP comparável (sem CadÚnico)</div>
            <div class="v ${item.semCadUnico == null ? "a-preencher" : ""}" data-num="${item.semCadUnico ?? ""}">${item.semCadUnico == null ? "a preencher" : num(item.semCadUnico)}</div>
          </div>
          <div class="fjp-col" ${dica("reconstrução na PNADc", num(item.reconstrucao_pnadc), item.faixa ? `${formatar(item.faixa.inf, 0)} a ${formatar(item.faixa.sup, 0)}` : null, item.faixa ? null : "sem faixa de 95%")}><div class="k">Reconstrução do moradinha na PNADc</div>
            <div class="v" data-num="${item.reconstrucao_pnadc ?? ""}">${num(item.reconstrucao_pnadc)}</div>
            <div class="fjp-sub">${faixaTxt}${dentro}</div>
          </div>
          <div class="fjp-col" ${dica("total do mapa", num(item.mapa), null, "soma dos hexágonos")}><div class="k">Total do mapa</div>
            <div class="v" data-num="${item.mapa ?? ""}">${num(item.mapa)}</div>
          </div>
        </div>
        ${obs}
        <div class="fjp-sub" style="margin-top:6px">${item.explicacao}</div>
        ${fonte}
      </div>`;
    })
    .join("");
  el.innerHTML = `${cab}<div class="grafico-dica">${AJUDA}</div><div data-grafico="tabela-fjp">${linhas}</div>`;
  instalarAjudas(el);
  ligarDicaPorAtributos(el);
}
