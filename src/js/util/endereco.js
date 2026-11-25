// Endereços estáveis por domínio e edição (S1-2, SPEC_F5 item 1).
//
// O build gera, para cada edição do catálogo, uma cópia das páginas em
// `d/<conjunto>/<edicao>/` e, para o domínio, `d/<conjunto>/` (edição padrão).
// Essas cópias trazem no <head> um <base href> que aponta para a raiz do site e
// três <meta>: moradinha-dominio, moradinha-edicao (vazio = edição padrão) e
// moradinha-pagina. Com isso `fetch("catalogo.json")`, `assets/...` e
// `pacotes/...` resolvem igual em qualquer profundidade (ver
// ferramentas/gerar_enderecos.mjs). Sem esses <meta> (páginas da raiz, `quarto
// preview`, testes), vale o modo antigo: `?dominio=` e `?edicao=` na URL.

function meta(nome) {
  return document.querySelector(`meta[name="${nome}"]`)?.getAttribute("content") ?? null;
}

/** @returns {{aninhada: boolean, dominio: string|null, edicao: string|null, pagina: string}} */
export function lerEndereco() {
  const dominio = meta("moradinha-dominio");
  const edicao = meta("moradinha-edicao");
  const pagina =
    meta("moradinha-pagina") ??
    (window.location.pathname.split("/").pop() || "index.html");
  return { aninhada: Boolean(dominio), dominio, edicao: edicao || null, pagina };
}

/** Caminho (relativo à raiz do site) de uma página de um domínio/edição. */
export function caminhoDaPagina(dominio, edicao, pagina) {
  return `d/${dominio}/${edicao ? `${edicao}/` : ""}${pagina}`;
}

/** URL absoluta da página irmã (mesmo domínio e edição) — `resultados.html`, etc. */
export function urlDaPaginaIrma(pagina) {
  const e = lerEndereco();
  if (e.aninhada) return new URL(caminhoDaPagina(e.dominio, e.edicao, pagina), document.baseURI).href;
  // Modo `?dominio=&edicao=`: mantém a consulta (e o domínio/edição escolhidos).
  return new URL(pagina, window.location.href).href.split("?")[0] + window.location.search;
}

export function irParaPagina(pagina) {
  window.location.href = urlDaPaginaIrma(pagina);
}

/** Escolha do seletor do cabeçalho: vai para o endereço do domínio/edição pedidos, na mesma página. */
export function irParaDominioEdicao(dominioId, edicaoId) {
  const e = lerEndereco();
  if (e.aninhada) {
    window.location.href = new URL(caminhoDaPagina(dominioId, edicaoId, e.pagina), document.baseURI).href;
    return;
  }
  const params = new URLSearchParams(window.location.search);
  params.set("dominio", dominioId);
  if (edicaoId) params.set("edicao", edicaoId);
  else params.delete("edicao");
  window.location.search = params.toString();
}
