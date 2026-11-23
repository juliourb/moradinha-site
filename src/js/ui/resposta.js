// Resposta, faixa, pílulas de marca e cartões dos componentes (SPEC_F1 §4).
import { formatar, formatarPercentual } from "../util/formato.js";
import { rotuloMarca, classeMarca } from "../util/marcas.js";
import { totalDoMapa, domiciliosTotal, mudanca, COMPONENTES_BASE } from "../dados/calculo.js";

const CLAB = { total: "Total", coabitacao: "Coabitação", onus: "Ônus", precariedade: "Precariedade" };

function pill(classe, texto) {
  return `<span class="pill ${classe}">${texto}</span>`;
}

/**
 * @param {object} elementos {lab,big,range,pills,cards}
 * @param {object} estado
 * @param {object} manifesto
 * @param {object} totais
 * @param {(componente:string)=>void} aoClicarCartao
 */
export function renderizarResposta(elementos, estado, manifesto, totais, aoClicarCartao) {
  const periodoRotulo = manifesto.periodos.find((p) => p.id === estado.periodo)?.rotulo ?? estado.periodo;
  elementos.lab.textContent = `${CLAB[estado.componente]} · ${periodoRotulo} · domínio inteiro`;

  const t = totalDoMapa(totais, estado.componente, estado.periodo);
  const dom = domiciliosTotal(totais, estado.periodo);
  const isRel = estado.medida === "relativo";
  const k = isRel && dom ? 100 / dom : 1;

  if (!t) {
    elementos.big.textContent = "—";
    elementos.range.innerHTML = "";
    elementos.pills.innerHTML = "";
  } else {
    elementos.big.textContent = isRel ? formatarPercentual(t.total * k, 2) : `${formatar(t.total, 0)} domicílios`;

    let faixa;
    if (t.ep != null) {
      const lo = (t.total - 1.96 * t.ep) * k;
      const hi = (t.total + 1.96 * t.ep) * k;
      faixa = `faixa de 95%: ${isRel ? `${formatar(lo, 2)} a ${formatar(hi, 2)} %` : `${formatar(lo, 0)} a ${formatar(hi, 0)}`} · CV ${formatar(
        (100 * t.ep) / t.total,
        1
      )}%`;
    } else {
      faixa =
        estado.componente === "total"
          ? "O total não tem faixa: as faixas dos componentes não podem ser somadas."
          : "sem faixa (provisória)";
    }

    if (estado.comparar) {
      const m = mudanca(totais, estado.componente, estado.comparar, estado.periodo);
      if (m) {
        const dlt = m.delta * (isRel && dom ? k : 1);
        let z = "";
        if (m.z != null) z = ` · z = ${formatar(m.z, 2)} (${m.z < 1.96 ? "dentro do ruído" : "mudança afirmável"})`;
        const rotulo = m.calculado ? " (calculado no site)" : "";
        faixa += `<br>contra ${manifesto.periodos.find((p) => p.id === estado.comparar)?.rotulo}: ${
          dlt >= 0 ? "+" : "−"
        }${formatar(Math.abs(dlt), isRel ? 2 : 0)}${isRel ? " %" : " domicílios"}${z}${rotulo}`;
      }
    }
    elementos.range.innerHTML = faixa;

    const pills = (t.marcas ?? []).map((m) => pill(classeMarca(m), rotuloMarca(m)));
    elementos.pills.innerHTML = pills.join("");
  }

  elementos.cards.innerHTML = COMPONENTES_BASE.map((c) => {
    const tc = totalDoMapa(totais, c, estado.periodo);
    const v = tc ? (isRel && dom ? (100 * tc.total) / dom : tc.total) : null;
    return `<button type="button" class="card" data-c="${c}" aria-pressed="${estado.componente === c}"><div class="k">${CLAB[c]}</div><div class="v num">${
      v == null ? "—" : isRel ? formatar(v, 2) + " %" : formatar(v, 0)
    }</div></button>`;
  }).join("");
  elementos.cards.querySelectorAll(".card").forEach((b) => {
    b.onclick = () => aoClicarCartao(estado.componente === b.dataset.c ? "total" : b.dataset.c);
  });
}
