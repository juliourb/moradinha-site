// Escala de cores do mapa de déficit (SPEC_F6 C4/N1): classes de hexágono,
// quebras naturais (Jenks/ckmeans) e o modo "vezes a taxa do domínio".
import { ckmeans } from "simple-statistics";
import { brutoHex, totalDoMapa, domiciliosTotal, COMPONENTES_BASE } from "./calculo.js";

export const COMPONENTES_MAPA = ["total", ...COMPONENTES_BASE];

const SERIE_ARREDONDAMENTO = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5];

/**
 * Arredonda um valor para o mais próximo da série 1; 1,5; 2; 2,5; 3; 4; 5;
 * 7,5 × 10ⁿ (n ≥ −1).
 */
export function arredondarParaSerie(valor) {
  if (!(valor > 0)) return 0;
  const expCentral = Math.floor(Math.log10(valor));
  let melhor = null;
  let menorDist = Infinity;
  for (let n = Math.max(-1, expCentral - 1); n <= expCentral + 1; n++) {
    for (const base of SERIE_ARREDONDAMENTO) {
      const candidato = base * 10 ** n;
      const dist = Math.abs(candidato - valor);
      if (dist < menorDist) {
        menorDist = dist;
        melhor = candidato;
      }
    }
  }
  return melhor;
}

/**
 * Classifica um hexágono num período: 'sem_dado' (domicílios não medido),
 * 'hachura' (menos de 1 domicílio), 'menos_de_1' (déficit menor que 1, com 1+
 * domicílio) ou 'normal' (entra nas quebras naturais).
 */
export function classeHex(domicilios, deficitAbsoluto) {
  if (domicilios == null) return "sem_dado";
  if (domicilios < 1) return "hachura";
  if (deficitAbsoluto == null) return "sem_dado";
  if (deficitAbsoluto < 1) return "menos_de_1";
  return "normal";
}

/** 6 quebras de Jenks (ckmeans) sobre valores ≥ 1; cada quebra é o maior valor da classe. */
export function quebrasJenks(valores) {
  const vs = [...valores].filter((v) => v != null && v >= 1).sort((a, b) => a - b);
  if (!vs.length) return [];
  const distintos = new Set(vs).size;
  const k = Math.min(6, distintos);
  if (k <= 1) return [arredondarParaSerie(vs[vs.length - 1])];
  const clusters = ckmeans(vs, k);
  const brutas = clusters.map((c) => c[c.length - 1]);
  return [...new Set(brutas.map(arredondarParaSerie))].sort((a, b) => a - b);
}

/**
 * Escala absoluta por componente: Jenks sobre o absoluto dos hexágonos
 * classificados 'normal', juntando todos os períodos do manifesto, uma vez
 * por componente.
 */
export function calcularEscalasAbsolutas(linhasArr, manifesto, componentes = COMPONENTES_MAPA) {
  const escalas = new Map();
  for (const componente of componentes) {
    const valores = [];
    for (const linha of linhasArr) {
      for (const p of manifesto.periodos) {
        const dom = linha.dom[p.id];
        const v = brutoHex(linha, componente, p.id);
        if (classeHex(dom, v) === "normal") valores.push(v);
      }
    }
    escalas.set(componente, quebrasJenks(valores));
  }
  return escalas;
}

/** Escala relativa "quebras naturais %": mesma regra, sobre o relativo (déficit ÷ domicílios × 100). */
export function calcularEscalasRelativas(linhasArr, manifesto, componentes = COMPONENTES_MAPA) {
  const escalas = new Map();
  for (const componente of componentes) {
    const valores = [];
    for (const linha of linhasArr) {
      for (const p of manifesto.periodos) {
        const dom = linha.dom[p.id];
        const v = brutoHex(linha, componente, p.id);
        if (classeHex(dom, v) === "normal") valores.push((100 * v) / dom);
      }
    }
    escalas.set(componente, quebrasJenks(valores));
  }
  return escalas;
}

/** Taxa do domínio (%) de um componente/período: Σ absoluto ÷ Σ domicílios × 100, do pacote. */
export function taxaDominio(totais, componente, periodoId) {
  const t = totalDoMapa(totais, componente, periodoId);
  const dom = domiciliosTotal(totais, periodoId);
  if (t == null || dom == null || dom === 0) return null;
  return (100 * t.total) / dom;
}

/** Cortes fixos de "vezes a taxa do domínio" (SPEC_F6 C4 item 4b). */
export const CORTES_VEZES_TAXA = [0.5, 0.8, 1.25, 1.5, 2];

/** Índice de classe (0..quebras.length-1) para uma escala por quebras (maior valor de cada classe). */
export function indiceClasse(valor, quebras) {
  if (!quebras.length) return 0;
  let i = 0;
  while (i < quebras.length - 1 && valor > quebras[i]) i++;
  return i;
}

/** Índice de classe (0..5) para "vezes a taxa do domínio", pelos cortes fixos. */
export function indiceClasseVezesTaxa(vezes) {
  let i = 0;
  while (i < CORTES_VEZES_TAXA.length && vezes >= CORTES_VEZES_TAXA[i]) i++;
  return i;
}

/**
 * Resumo da legenda: para cada classe (0..quebras.length-1), número de
 * hexágonos e % do déficit absoluto que eles somam no período mostrado
 * (entre os hexágonos classificados 'normal').
 */
export function resumoLegendaClasses(valoresAbsolutos, quebras) {
  const n = quebras.length;
  const grupos = Array.from({ length: n }, () => ({ n: 0, soma: 0 }));
  let total = 0;
  for (const v of valoresAbsolutos) {
    const i = indiceClasse(v, quebras);
    grupos[i].n++;
    grupos[i].soma += v;
    total += v;
  }
  return grupos.map((g, i) => ({
    indice: i,
    min: i === 0 ? 1 : quebras[i - 1],
    max: quebras[i],
    n: g.n,
    pctDeficit: total > 0 ? (100 * g.soma) / total : null,
  }));
}
