// Formatação de números no padrão pt-BR (milhar com ponto, decimal com vírgula).
// SPEC_00 §7: "números com tabular-nums e formato pt-BR".

const SEM_DADO = "—";

/**
 * @param {number|null|undefined} valor
 * @param {number} decimais
 * @returns {string}
 */
export function formatar(valor, decimais = 0) {
  if (valor == null || Number.isNaN(valor)) return SEM_DADO;
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

/** Abrevia rótulos de média para caber em eixos estreitos: "Média 2022–24" → "M22–24". */
export function rotuloCurto(rotulo) {
  return rotulo.replace(/^Média (\d{2})(\d{2})–/, "M$2–");
}

/**
 * @param {number|null|undefined} valor
 * @param {number} decimais
 * @returns {string}
 */
export function formatarPercentual(valor, decimais = 1) {
  if (valor == null || Number.isNaN(valor)) return SEM_DADO;
  return `${formatar(valor, decimais)} %`;
}

/**
 * Altura do rótulo de período no eixo horizontal (varredura F6.5): quando o
 * passo entre colunas é estreito (< 44 px), os rótulos alternam em duas linhas
 * para "M22–24" e "M23–25" não se encostarem.
 */
export function yRotuloPeriodo(indice, passo, yBase) {
  if (passo >= 44) return yBase;
  return indice % 2 ? yBase + 5 : yBase - 6;
}
