// Lógica pura do catálogo montado no build (S1-1), separada do CLI para ser
// testada sem tocar disco. Entrada: os pacotes achados em pacotes/<conjunto>/<edicao>/
// (cada um com o manifesto já lido) e as exceções feitas à mão (pacotes/excecoes.json).
// Saída: o objeto do catalogo.json.
//
// Regras:
//  - o id da edição é o nome da pasta; o `nome` do domínio é o do manifesto da edição padrão;
//  - a edição padrão é a MAIS RECENTE pela data (`manifesto.data_execucao`) entre as edições
//    que não são `teste_apenas` (se o domínio só tem teste, entre todas);
//  - `fora_do_catalogo` tira a edição do catálogo; `teste_apenas` marca edição ou domínio.

function achar(lista, conjunto, edicao) {
  return (lista ?? []).find((e) => e.conjunto_id === conjunto && e.edicao === edicao);
}

/** Instante (ms) de `data_execucao`; lança se faltar ou não for uma data (seria mudança de contrato). */
export function instanteDaEdicao(manifesto, rotulo) {
  const texto = manifesto?.data_execucao;
  const t = typeof texto === "string" ? Date.parse(texto) : NaN;
  if (Number.isNaN(t)) throw new Error(`${rotulo}: manifesto sem data_execucao válida (${JSON.stringify(texto)})`);
  return t;
}

/**
 * @param {{conjunto_id: string, edicao: string, origem: string, manifesto: object}[]} pacotes
 * @param {{fora_do_catalogo?: object[], teste_apenas?: object[]}} excecoes
 */
export function montarCatalogo(pacotes, excecoes = {}) {
  const porDominio = new Map();
  for (const p of pacotes) {
    if (achar(excecoes.fora_do_catalogo, p.conjunto_id, p.edicao)) continue;
    if (!porDominio.has(p.conjunto_id)) porDominio.set(p.conjunto_id, []);
    porDominio.get(p.conjunto_id).push(p);
  }

  const dominios = [];
  for (const conjunto of [...porDominio.keys()].sort()) {
    const dominioTeste = Boolean(achar(excecoes.teste_apenas, conjunto, undefined));
    const edicoes = porDominio.get(conjunto).map((p) => ({
      p,
      teste: Boolean(achar(excecoes.teste_apenas, conjunto, p.edicao)),
      t: instanteDaEdicao(p.manifesto, `${conjunto}/${p.edicao}`),
    }));
    const reais = edicoes.filter((e) => !e.teste);
    const candidatas = reais.length ? reais : edicoes;
    const maisRecente = (a, b) => b.t - a.t || (a.p.edicao < b.p.edicao ? -1 : 1);
    const padrao = [...candidatas].sort(maisRecente)[0];
    // Reais primeiro (a mais recente antes), depois as de teste.
    const ordenadas = [...edicoes].sort((a, b) => Number(a.teste) - Number(b.teste) || maisRecente(a, b));
    const dominio = { conjunto_id: conjunto, nome: padrao.p.manifesto.nome };
    if (dominioTeste) dominio.teste_apenas = true;
    dominio.edicoes = ordenadas.map((e) => {
      const item = { edicao: e.p.edicao, origem: e.p.origem, padrao: e === padrao };
      if (e.teste) item.teste_apenas = true;
      return item;
    });
    dominios.push(dominio);
  }
  return { dominios };
}
