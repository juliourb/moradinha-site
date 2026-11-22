// Checagem de citações da Metodologia (SPEC_F4 F4-5): toda citação @chave usada
// nos textos precisa existir em referencias.bib. Lógica pura, sem tocar disco —
// testável e reaproveitada pelo CLI em validar_citacoes.mjs.

const REGEX_CITACAO = /@([A-Za-z][\w:.#$%&\-+?<>~/]*)/g;
const REGEX_CHAVE_BIB = /@\w+\{\s*([^,\s]+)\s*,/g;

/** @param {string} texto @returns {string[]} chaves citadas (@chave), sem duplicar */
export function chavesCitadas(texto) {
  return [...new Set([...texto.matchAll(REGEX_CITACAO)].map((m) => m[1]))];
}

/** @param {string} bib @returns {string[]} chaves definidas no .bib */
export function chavesDoBib(bib) {
  return [...bib.matchAll(REGEX_CHAVE_BIB)].map((m) => m[1]);
}

/**
 * @param {{nome: string, texto: string}[]} textos
 * @param {string} bib
 * @returns {{arquivo: string, chave: string}[]} citações que não existem no .bib
 */
export function citacoesOrfas(textos, bib) {
  const chavesValidas = new Set(chavesDoBib(bib));
  const orfas = [];
  for (const { nome, texto } of textos) {
    for (const chave of chavesCitadas(texto)) {
      if (!chavesValidas.has(chave)) orfas.push({ arquivo: nome, chave });
    }
  }
  return orfas;
}
