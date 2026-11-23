// Lógica pura do F5-2 (separada do CLI em validar_catalogo_publico.mjs para
// poder ser testada sem tocar disco/rede): quais domínios/edições do
// catalogo.json são expostos ao build público, e o que está errado com eles.

/** Entradas (domínio, edição) do catálogo que não são `teste_apenas`. */
export function entradasPublicas(catalogo) {
  const entradas = [];
  for (const dominio of catalogo.dominios) {
    if (dominio.teste_apenas) continue;
    for (const edicao of dominio.edicoes) {
      if (edicao.teste_apenas) continue;
      entradas.push({ dominio, edicao });
    }
  }
  return entradas;
}

/**
 * @param {object} catalogo
 * @param {(origem: string) => object} obterManifesto síncrono, lança se não achar/ler
 * @returns {string[]} mensagens de problema (vazio = tudo certo)
 */
export function problemasCatalogoPublico(catalogo, obterManifesto) {
  const problemas = [];
  for (const { dominio, edicao } of entradasPublicas(catalogo)) {
    const rotulo = `${dominio.conjunto_id} / ${edicao.edicao} (${edicao.origem})`;
    let manifesto;
    try {
      manifesto = obterManifesto(edicao.origem);
    } catch (erro) {
      problemas.push(`${rotulo}: falha ao ler o manifesto (${erro.message})`);
      continue;
    }
    if (manifesto.publico !== true) problemas.push(`${rotulo}: manifesto.publico não é true`);
    if (manifesto.ficticio !== false) problemas.push(`${rotulo}: manifesto.ficticio não é false (pacote fictício não pode estar fora de teste_apenas)`);
  }
  return problemas;
}
