// Leitor de um subconjunto bem restrito de YAML: mapas de nível 0, cada um
// contendo OU um mapa plano (chave: valor) OU uma lista (- item), sem
// aninhamento mais profundo. Usado só para `textos/metodologia/grupos_pipeline.yml`
// (SPEC_F6 B4/N18) — não é um parser YAML geral. Lança erro em qualquer
// construção fora desse subconjunto, em vez de adivinhar.

function desaspar(valor) {
  const t = valor.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

const RE_CHAVE_VALOR = /^([\w./-]+):\s*(.*)$/;

/**
 * @param {string} texto
 * @returns {Record<string, string|string[]|Record<string,string>>}
 */
export function analisarYamlSimples(texto) {
  const raiz = {};
  let chaveAtual = null;
  let modoAtual = null; // null | "indef" | "mapa" | "lista"
  let indentFilho = null; // indentação da primeira linha filha da chave atual

  for (const linhaCrua of texto.split("\n")) {
    const semComentario = linhaCrua.split("#")[0];
    if (!semComentario.trim()) continue;
    const indent = semComentario.match(/^ */)[0].length;
    const linha = semComentario.trim();

    if (indent > 0 && indentFilho != null && indent !== indentFilho) {
      throw new Error(`grupos_pipeline.yml: aninhamento fora do subconjunto suportado em "${chaveAtual}" (só 1 nível): "${linha}"`);
    }

    if (indent === 0) {
      indentFilho = null;
      const m = RE_CHAVE_VALOR.exec(linha);
      if (!m) throw new Error(`grupos_pipeline.yml: linha de nível 0 não reconhecida: "${linha}"`);
      const [, chave, valor] = m;
      chaveAtual = chave;
      if (valor === "{}") {
        raiz[chave] = {};
        modoAtual = null;
      } else if (valor === "[]") {
        raiz[chave] = [];
        modoAtual = null;
      } else if (valor === "") {
        raiz[chave] = null;
        modoAtual = "indef";
      } else {
        raiz[chave] = desaspar(valor);
        modoAtual = null;
      }
      continue;
    }

    if (chaveAtual == null) throw new Error(`grupos_pipeline.yml: linha indentada sem chave de nível 0: "${linha}"`);
    if (indentFilho == null) indentFilho = indent;

    if (linha.startsWith("- ")) {
      if (modoAtual === "indef") {
        raiz[chaveAtual] = [];
        modoAtual = "lista";
      }
      if (modoAtual !== "lista") throw new Error(`grupos_pipeline.yml: item de lista inesperado em "${chaveAtual}"`);
      raiz[chaveAtual].push(desaspar(linha.slice(2)));
      continue;
    }

    const m2 = RE_CHAVE_VALOR.exec(linha);
    if (!m2) throw new Error(`grupos_pipeline.yml: linha indentada não reconhecida: "${linha}"`);
    if (modoAtual === "indef") {
      raiz[chaveAtual] = {};
      modoAtual = "mapa";
    }
    if (modoAtual !== "mapa") throw new Error(`grupos_pipeline.yml: entrada de mapa inesperada em "${chaveAtual}"`);
    raiz[chaveAtual][m2[1]] = desaspar(m2[2]);
  }

  return raiz;
}
