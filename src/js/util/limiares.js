// Limiares para as pílulas semânticas (bom/atenção/crítico) do bloco
// "Qualidade deste hexágono" (SPEC_F1 §10) e do tema de qualidade.

export const LIMIARES = Object.freeze({
  incerteza: { atencao: 0.7, critico: 1.0 },
  cv_ap: { critico: 30 }, // direta_cv em % (SPEC_00 ap.parquet)
  fracao_imputada: { atencao: 0.3 },
});

/** @returns {"ok"|"atencao"|"critico"} */
export function nivelIncerteza(valor) {
  if (valor == null) return "ok";
  if (valor > LIMIARES.incerteza.critico) return "critico";
  if (valor > LIMIARES.incerteza.atencao) return "atencao";
  return "ok";
}

/** @returns {"ok"|"critico"} */
export function nivelCvAp(valorPercentual) {
  if (valorPercentual == null) return "ok";
  return valorPercentual > LIMIARES.cv_ap.critico ? "critico" : "ok";
}

/** @returns {"ok"|"atencao"} */
export function nivelFracaoImputada(valor) {
  if (valor == null) return "ok";
  return valor > LIMIARES.fracao_imputada.atencao ? "atencao" : "ok";
}
