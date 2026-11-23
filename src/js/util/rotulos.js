// Dicionário de rótulos para nomes crus que aparecem no pacote (SPEC_F6 N10).
// Chave sem rótulo aqui aparece crua no site (e é listada no relatório da fase).

export const ROTULOS = Object.freeze({
  rusticos: "rústicos",
  improvisados: "improvisados (CadÚnico)",
  comodos: "cômodos",
  unidade_convivente: "famílias conviventes",
  pnadc: "domicílios na PNADc",
  habitacao_precaria: "habitação precária",
  atencao_basica: "atenção básica (equipamentos)",
  contagem_edificios: "contagem de edificações",
  escolas_pub: "escolas públicas",
  fracao_fcu: "fração em FCU (favelas e comunidades urbanas)",
  fracao_urbanizada: "fração urbanizada",
  luz_allangle: "luz noturna",
  estoque: "estoque de domicílios",
});

/**
 * @param {string} chave
 * @returns {string} rótulo legível, ou a própria chave se não houver rótulo conhecido
 */
export function rotulo(chave) {
  if (chave == null) return chave;
  return ROTULOS[chave] ?? chave;
}
