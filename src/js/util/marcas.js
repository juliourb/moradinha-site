// Vocabulário fechado de marcas do pacote (SPEC_00 §5.3). Rótulos num lugar só.

export const MARCAS = Object.freeze({
  total_fragil: "Total frágil (CV acima de 15%)",
  mudanca_no_ruido: "Mudança dentro do ruído",
  fonte_estoque_diferente: "Estoque por fonte diferente dos demais anos (Open Buildings); não comparar por hexágono",
  media_inclui_fonte_diferente: "Média inclui ano com estoque por fonte diferente",
  precariedade_provisoria_sem_faixa: "Precariedade provisória, sem faixa",
  ap_ressalva: "AP com ressalva (CV acima de 30% ou direta zero)",
  parcial_sigilo: "Parte em sigilo do Censo",
  sem_dado: "Sem dado (sigilo total)",
});

/**
 * @param {string} codigo
 * @returns {string} rótulo da marca
 * @throws {Error} se o código não pertencer ao vocabulário fechado
 */
export function rotuloMarca(codigo) {
  if (!(codigo in MARCAS)) {
    throw new Error(`marca desconhecida (fora do vocabulário fechado): "${codigo}"`);
  }
  return MARCAS[codigo];
}

/**
 * @param {string} campoMarcas string com códigos separados por ";" (vazio = nenhuma)
 * @returns {string[]} códigos
 */
export function listarMarcas(campoMarcas) {
  if (!campoMarcas) return [];
  return campoMarcas.split(";").filter(Boolean);
}

/** Cor semântica da pílula (SPEC_00 §7): aviso, crítico, informação. */
export function classeMarca(codigo) {
  if (codigo === "total_fragil" || codigo === "ap_ressalva" || codigo === "precariedade_provisoria_sem_faixa") return "warn";
  if (codigo === "fonte_estoque_diferente") return "crit";
  return "info";
}

/** Rótulos conhecidos para `hex_qualidade.fonte_estoque`/`manifesto.periodos[].fonte_estoque` (CHANGELOG_SPECS v1.5). */
const ROTULOS_FONTE_ESTOQUE = Object.freeze({
  mista: "Média de anos com fontes de estoque diferentes",
});

/**
 * @param {string|null|undefined} valor
 * @returns {string} rótulo conhecido, ou o próprio valor cru se não houver rótulo (nunca quebra)
 */
export function rotuloFonteEstoque(valor) {
  if (valor == null) return "—";
  return ROTULOS_FONTE_ESTOQUE[valor] ?? valor;
}

/** Ordem de importância para "a marca mais importante" (SPEC_F2 item 1). */
export const PRIORIDADE_MARCAS = Object.freeze([
  "total_fragil",
  "fonte_estoque_diferente",
  "ap_ressalva",
  "mudanca_no_ruido",
  "media_inclui_fonte_diferente",
  "precariedade_provisoria_sem_faixa",
  "parcial_sigilo",
  "sem_dado",
]);
