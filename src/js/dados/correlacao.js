// Correlação entre componentes por hexágono (acréscimo F2, F6.5): Spearman,
// por período, na medida escolhida. Só lê valores do pacote (valorHex).
import { valorHex } from "./calculo.js";

/** Postos com empate pela média (1 = menor). */
export function postos(vs) {
  const idx = vs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(vs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const media = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = media;
    i = j + 1;
  }
  return r;
}

/** Coeficiente de Spearman (Pearson dos postos). null com menos de 3 pares ou sem variação. */
export function spearman(xs, ys) {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const rx = postos(xs);
  const ry = postos(ys);
  const mx = (n + 1) / 2;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - mx;
    const dy = ry[i] - mx;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

export const PARES_COMPONENTES = Object.freeze([
  ["coabitacao", "onus"],
  ["coabitacao", "precariedade"],
  ["onus", "precariedade"],
]);

/**
 * Spearman entre cada par de componentes, por período, nos hexágonos com pelo
 * menos 1 domicílio e valor nos dois componentes.
 * @returns {Array<{a:string, b:string, periodo:string, rho:number|null, n:number}>}
 */
export function correlacaoComponentes(linhasArr, periodos, medida) {
  const saida = [];
  for (const p of periodos) {
    for (const [a, b] of PARES_COMPONENTES) {
      const xs = [];
      const ys = [];
      for (const l of linhasArr) {
        const dom = l.dom?.[p.id];
        if (dom == null || dom < 1) continue;
        const va = valorHex(l, a, p.id, medida);
        const vb = valorHex(l, b, p.id, medida);
        if (va == null || vb == null) continue;
        xs.push(va);
        ys.push(vb);
      }
      saida.push({ a, b, periodo: p.id, rho: spearman(xs, ys), n: xs.length });
    }
  }
  return saida;
}
