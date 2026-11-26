// Barra de "pergunta": liga os controles segmentados e seletores ao estado.
import { textoPergunta, MEDIDAS_QUALIDADE, PREFIXO_COMPARAR_COMPONENTE } from "../estado/pergunta.js";

const NOME_COMPONENTE_CORTINA = { total: "Total", coabitacao: "Coabitação", onus: "Ônus", precariedade: "Precariedade" };
import { criarAjuda } from "./ajuda.js";

/**
 * Acréscimo D (F6.5): explicação curta de cada medida de qualidade — o que
 * mede, como se calcula (uma frase) e quando desconfiar. Linguagem simples,
 * sigla explicada na primeira vez em cada texto.
 */
export const AJUDA_MEDIDA_QUALIDADE = Object.freeze({
  incerteza:
    "O que mede: quanto a estimativa do hexágono pode variar. Como se calcula: a largura da faixa de 95% (máximo menos mínimo) dividida pelo valor estimado. Quando desconfiar: acima de 0,7 a faixa já é quase do tamanho do valor; acima de 1, é maior que ele.",
  qualidade_dado:
    "O que mede: se o hexágono tem dado completo. Como se calcula: marca do pacote que separa estimativa plena, parte em sigilo do IBGE (Instituto Brasileiro de Geografia e Estatística) e sem dado. Quando desconfiar: com sigilo ou sem dado, o número do hexágono é parcial ou não existe.",
  ressalva_ap:
    "O que mede: se a área de ponderação (AP, a menor área com amostra própria no Censo) do hexágono tem estimativa frágil. Como se calcula: a AP ganha ressalva quando o coeficiente de variação (CV, o erro da amostra dividido pela estimativa) passa de 30% ou quando ela não tem estimativa direta. Quando desconfiar: sempre que houver ressalva, o hexágono herda essa fragilidade.",
  cv_ap:
    "O que mede: a precisão da amostra do Censo na área de ponderação (AP) do hexágono. Como se calcula: coeficiente de variação (CV), o erro-padrão da estimativa direta da AP dividido pela própria estimativa, em %. Quando desconfiar: acima de 30%, o limiar do protocolo.",
  imputacao:
    "O que mede: quanto do hexágono foi preenchido com informação de fora da sua área de ponderação (AP). Como se calcula: a parte dos domicílios de 2022 cujo bloco veio da reconstrução além da AP (município, conjunto ou divisão igual). Quando desconfiar: acima de 30% (0,3), boa parte do número não vem da própria área.",
  estoque:
    "O que mede: quanto o número de domicílios do hexágono mudou desde 2022. Como se calcula: o estoque do período dividido pelo de 2022 (1 = igual; 1,2 = 20% a mais). Quando desconfiar: em valores muito longe de 1 e nos períodos marcados com estoque vindo de outra fonte.",
  hex_novo:
    "O que mede: se o hexágono não tinha domicílio em 2022 e passou a ter depois. Como se calcula: marca do pacote para hexágonos sem domicílio no Censo 2022 que aparecem em períodos seguintes. Quando desconfiar: não há valor de 2022 para comparar; leia a evolução desses hexágonos com cuidado.",
});

const NOME_COMPLETO_MEDIDA = {
  incerteza: "Incerteza",
  qualidade_dado: "Qualidade do dado",
  ressalva_ap: "Ressalva da área de ponderação",
  cv_ap: "Precisão da amostra na AP (CV)",
  imputacao: "Parte imputada",
  estoque: "Mudança do estoque desde 2022",
  hex_novo: "Hexágono novo",
};

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
  qualidade_dado: "Dado",
  ressalva_ap: "Ressalva AP",
  cv_ap: "CV da AP",
  imputacao: "Imputada",
  estoque: "Estoque",
  hex_novo: "Novo",
};

/** @param {(id:string)=>boolean} medidaConstante devolve true quando a medida é constante no período corrente */
export function ligarPergunta(elementos, manifesto, loja, medidaConstante) {
  elementos.selPeriodo.innerHTML = manifesto.periodos.map((p) => `<option value="${p.id}">${p.rotulo}</option>`).join("");
  // Acréscimo F: "comparar com" oferece outro período OU outro componente (mesmo período).
  elementos.selComparar.innerHTML =
    `<option value="">sem comparação</option>` +
    `<optgroup label="Outro período">${manifesto.periodos.map((p) => `<option value="${p.id}">${p.rotulo}</option>`).join("")}</optgroup>` +
    `<optgroup label="Outro componente, mesmo período">${Object.entries(NOME_COMPONENTE_CORTINA)
      .map(([id, nome]) => `<option value="${PREFIXO_COMPARAR_COMPONENTE}${id}">${nome}</option>`)
      .join("")}</optgroup>`;
  const seletorMedida = montarSeletorMedida(elementos.selMedidaQualidade, (id) => loja.definir({ medida_qualidade: id }));

  elementos.segTema.querySelectorAll("button").forEach((b) => {
    b.onclick = () => loja.definir({ tema: b.dataset.v, conjunto_graficos: b.dataset.v === "qualidade" ? 1 : 0, faixa_hist: [] });
  });
  elementos.segMedida.querySelectorAll("button").forEach((b) => {
    b.onclick = () => loja.definir({ medida: b.dataset.v, faixa_hist: [] });
  });
  elementos.segComponente.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      const componente = b.dataset.v;
      const comparar = loja.obter().comparar === PREFIXO_COMPARAR_COMPONENTE + componente ? null : loja.obter().comparar;
      loja.definir({ componente, comparar, faixa_hist: [] });
    };
  });
  elementos.selPeriodo.onchange = () => {
    const periodo = elementos.selPeriodo.value;
    loja.definir({ periodo, comparar: loja.obter().comparar === periodo ? null : loja.obter().comparar, faixa_hist: [] });
  };
  elementos.selComparar.onchange = () => {
    const comparar = elementos.selComparar.value || null;
    loja.definir({ comparar: comparar === loja.obter().periodo ? null : comparar, faixa_hist: [] });
  };

  function sincronizar(estado) {
    elementos.segTema.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === estado.tema)));
    elementos.segMedida.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === estado.medida)));
    elementos.segComponente.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === estado.componente)));
    elementos.selPeriodo.value = estado.periodo;
    elementos.selComparar.value = estado.comparar ?? "";
    // O componente/período atual não aparece como alvo da cortina.
    elementos.selComparar.querySelectorAll("option").forEach((op) => {
      op.disabled = !!op.value && (op.value === estado.periodo || op.value === PREFIXO_COMPARAR_COMPONENTE + estado.componente);
    });

    const qualidade = estado.tema === "qualidade";
    elementos.ctlMedida.hidden = qualidade;
    elementos.ctlMedidaQualidade.hidden = !qualidade;
    const expl = qualidade ? ROTULO_MEDIDA_QUALIDADE[estado.medida_qualidade] ?? "" : "";
    elementos.explicacaoMedidaQualidade.textContent = expl;
    seletorMedida.sincronizar(estado.medida_qualidade, (id) => (medidaConstante ? medidaConstante(id) : false));

    elementos.question.textContent = textoPergunta(estado, manifesto);
  }

  return { sincronizar };
}

/**
 * Seletor da medida de qualidade (acréscimo D): botão compacto que abre uma
 * lista; cada medida é um botão com o seu (?) ao lado. Não usa <select>
 * porque uma opção nativa não aceita ícone, e não usa role="option" porque
 * o (?) dentro dela seria um controle aninhado.
 */
function montarSeletorMedida(botao, aoEscolher) {
  const ctl = botao.parentElement;
  ctl.classList.add("mq-ctl");
  botao.setAttribute("aria-haspopup", "true");
  botao.setAttribute("aria-expanded", "false");
  botao.setAttribute("aria-controls", "f1-mq-lista");
  const lista = document.createElement("ul");
  lista.className = "mq-lista";
  lista.id = "f1-mq-lista";
  lista.hidden = true;
  for (const id of MEDIDAS_QUALIDADE) {
    const li = document.createElement("li");
    const op = document.createElement("button");
    op.type = "button";
    op.className = "mq-opcao";
    op.dataset.v = id;
    op.textContent = NOME_COMPLETO_MEDIDA[id];
    op.onclick = () => {
      fechar();
      botao.focus();
      aoEscolher(id);
    };
    const ajuda = criarAjuda(AJUDA_MEDIDA_QUALIDADE[id]);
    ajuda.setAttribute("aria-label", `O que é: ${NOME_COMPLETO_MEDIDA[id]}`);
    li.append(op, ajuda);
    lista.appendChild(li);
  }
  ctl.appendChild(lista);

  // A barra da pergunta corta o que passa da borda (overflow): a lista fica
  // fixa na janela, logo abaixo do botão, e fecha ao rolar a página.
  function posicionar() {
    const r = botao.getBoundingClientRect();
    lista.style.top = `${r.bottom + 4}px`;
    lista.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - lista.offsetWidth - 8))}px`;
  }
  window.addEventListener("scroll", () => !lista.hidden && fechar(), { passive: true });
  window.addEventListener("resize", () => !lista.hidden && posicionar());
  function abrir() {
    lista.hidden = false;
    posicionar();
    botao.setAttribute("aria-expanded", "true");
    (lista.querySelector('.mq-opcao[aria-pressed="true"]') ?? lista.querySelector(".mq-opcao:not([disabled])"))?.focus();
  }
  function fechar() {
    lista.hidden = true;
    botao.setAttribute("aria-expanded", "false");
  }
  botao.onclick = (e) => {
    e.stopPropagation();
    if (lista.hidden) abrir();
    else fechar();
  };
  lista.addEventListener("keydown", (e) => {
    const ops = [...lista.querySelectorAll(".mq-opcao:not([disabled])")];
    const i = ops.indexOf(document.activeElement);
    if (e.key === "Escape") {
      fechar();
      botao.focus();
    } else if (e.key === "ArrowDown" && i >= 0) {
      e.preventDefault();
      ops[(i + 1) % ops.length].focus();
    } else if (e.key === "ArrowUp" && i >= 0) {
      e.preventDefault();
      ops[(i - 1 + ops.length) % ops.length].focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!lista.hidden && !ctl.contains(e.target)) fechar();
  });

  function sincronizar(atual, ehConstante) {
    botao.innerHTML = `<span class="mq-rot">${NOME_MEDIDA_QUALIDADE[atual] ?? atual}</span><span aria-hidden="true"> ▾</span>`;
    botao.dataset.v = atual;
    botao.title = `${NOME_COMPLETO_MEDIDA[atual] ?? ""} — ${ROTULO_MEDIDA_QUALIDADE[atual] ?? ""}`;
    botao.setAttribute("aria-label", `Medida de qualidade: ${NOME_COMPLETO_MEDIDA[atual] ?? atual}`);
    lista.querySelectorAll(".mq-opcao").forEach((op) => {
      const constante = ehConstante(op.dataset.v);
      op.disabled = constante;
      op.title = constante ? "igual em todos os hexágonos neste período" : "";
      op.setAttribute("aria-pressed", String(op.dataset.v === atual));
    });
  }
  return { sincronizar };
}
