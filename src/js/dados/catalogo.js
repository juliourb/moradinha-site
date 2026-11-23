// Dados do catálogo (SPEC_F5): quais domínios e edições aparecem no seletor
// do cabeçalho. `teste_apenas` marca domínios/edições que só existem para os
// testes automatizados (pacotes fictícios) — nunca aparecem como opção no
// seletor público, mesmo que continuem acessíveis por `?dominio=&edicao=`
// (é assim que os testes abrem a edição fictícia de propósito).

/** Domínios que podem aparecer no seletor público. */
export function dominiosPublicos(catalogo) {
  return catalogo.dominios.filter((d) => !d.teste_apenas);
}

/** Edições de um domínio que podem aparecer no seletor público. */
export function edicoesPublicas(dominio) {
  return dominio.edicoes.filter((e) => !e.teste_apenas);
}

/**
 * Opções do seletor de domínio: os domínios públicos, mais o domínio atual
 * se ele não entrar nessa lista (ex.: página aberta com `?dominio=` de um
 * domínio `teste_apenas` — o seletor não fica numa opção inexistente).
 */
export function opcoesDominio(catalogo, dominioAtual) {
  const base = dominiosPublicos(catalogo);
  return base.some((d) => d.conjunto_id === dominioAtual.conjunto_id) ? base : [...base, dominioAtual];
}

/** Mesma lógica de `opcoesDominio`, para as edições de um domínio. */
export function opcoesEdicao(dominio, edicaoAtual) {
  const base = edicoesPublicas(dominio);
  return base.some((e) => e.edicao === edicaoAtual.edicao) ? base : [...base, edicaoAtual];
}
