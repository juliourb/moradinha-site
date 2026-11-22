// Seleção de várias faixas do histograma (SPEC_F6 C1): um hexágono entra se
// o valor cai em QUALQUER UMA das faixas marcadas. `faixas` vazia/nula = sem
// filtro (todos entram). x1 == null (ou Infinity) = faixa aberta (p99 ou mais).

/** @param {number|null} v @param {Array<[number, number|null]>} faixas */
export function valorDentroFaixas(v, faixas) {
  if (!faixas?.length) return true;
  if (v == null) return false;
  return faixas.some(([x0, x1]) => v >= x0 && (x1 == null || v < x1));
}

/** Alterna uma faixa [x0,x1] no conjunto selecionado (toggle), por igualdade de x0. */
export function alternarFaixa(faixas, faixa) {
  const atuais = faixas ?? [];
  const existe = atuais.some(([x0]) => x0 === faixa[0]);
  return existe ? atuais.filter(([x0]) => x0 !== faixa[0]) : [...atuais, faixa];
}
