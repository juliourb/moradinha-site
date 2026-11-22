// Estado global da "pergunta" (medida, componente, período, comparação, ...)
// com assinatura de mudanças. Reusado pelas células do Quarto e, no futuro,
// pela interface de coleta de dados.

/**
 * @template T
 * @param {T} estadoInicial
 */
export function criarLoja(estadoInicial) {
  let estado = { ...estadoInicial };
  const assinantes = new Set();

  return {
    /** @returns {T} */
    obter() {
      return estado;
    },
    /** @param {Partial<T>} parcial */
    definir(parcial) {
      estado = { ...estado, ...parcial };
      for (const fn of assinantes) fn(estado);
    },
    /**
     * @param {(estado: T) => void} fn
     * @returns {() => void} função para cancelar a assinatura
     */
    assinar(fn) {
      assinantes.add(fn);
      return () => assinantes.delete(fn);
    },
  };
}
