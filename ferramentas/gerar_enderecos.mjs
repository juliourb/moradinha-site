#!/usr/bin/env node
// Depois do `quarto render` (S1-2, SPEC_F5 item 1): gera os endereços estáveis por
// domínio e edição a partir do catalogo.json e das 4 páginas já renderizadas.
//
//   d/<conjunto>/<edicao>/{index,visao-geral,resultados,confiabilidade,metodologia}.html
//   d/<conjunto>/{...}.html                    (edição padrão do domínio)
//
// Cada cópia ganha, logo após <head>: <base href="../../../"> (ou "../../") para
// que catalogo.json, assets/, pacotes/ e site_libs/ resolvam como na raiz; três
// <meta> (moradinha-dominio, -edicao, -pagina) lidos por src/js/util/endereco.js; e
// os links entre páginas reescritos para o mesmo endereço (a <base> faria um link
// relativo ir para a raiz). Domínios de teste também ganham endereço: ficam fora do
// seletor público, mas abrem (é assim que os testes e a revisão os conferem).
//
// Com --publico (build público, E58): pacotes teste_apenas NÃO entram. O catalogo.json da pasta do site é
// reescrito sem eles, as pastas deles saem de pacotes/ e não ganham endereço. Sem a opção (build interno),
// tudo fica: o interno e os testes usam os pacotes fictícios.
//
// Uso: node ferramentas/gerar_enderecos.mjs [pasta do site, padrão _site] [--publico]
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGINAS = ["visao-geral", "resultados", "confiabilidade", "metodologia"];

/** Reescreve uma página renderizada para viver em `d/<conjunto>[/<edicao>]/`. Pura (testada sem disco). */
export function paginaDoEndereco(html, { dominio, edicao, pagina }) {
  const profundidade = edicao ? 3 : 2;
  const base = "../".repeat(profundidade);
  const pasta = `d/${dominio}/${edicao ? `${edicao}/` : ""}`;
  let saida = html.replace(/\r\n/g, "\n");
  // 1) <base> e <meta>
  const cabeca = `<base href="${base}">\n<meta name="moradinha-dominio" content="${dominio}">\n<meta name="moradinha-edicao" content="${edicao ?? ""}">\n<meta name="moradinha-pagina" content="${pagina}.html">`;
  if (!/<head[^>]*>/.test(saida)) throw new Error(`${pagina}.html: sem <head>`);
  saida = saida.replace(/<head[^>]*>/, (m) => `${m}\n${cabeca}`);
  // 2) links entre páginas (e a âncora de pular para o conteúdo) continuam dentro desta edição
  saida = saida.replace(
    /href="(?:\.\/)?(visao-geral|resultados|confiabilidade|metodologia)\.html((?:#[^"]*)?)"/g,
    (_, nome, ancora) => `href="${pasta}${nome}.html${ancora}"`,
  );
  saida = saida.replace(/href="#([^"]*)"/g, (_, ancora) => `href="${pasta}${pagina}.html#${ancora}"`);
  return saida;
}

/** Separa o catálogo em público (sem teste_apenas) e as pastas de pacote a remover do build público. Pura. */
export function separarTeste(catalogo) {
  const publico = { dominios: [] };
  const remover = [];
  for (const d of catalogo.dominios) {
    if (d.teste_apenas) {
      remover.push(`pacotes/${d.conjunto_id}`);
      continue;
    }
    const edicoes = d.edicoes.filter((e) => !e.teste_apenas);
    for (const e of d.edicoes.filter((x) => x.teste_apenas)) remover.push(e.origem);
    if (edicoes.length) publico.dominios.push({ ...d, edicoes });
  }
  return { publico, remover };
}

function main() {
  const args = process.argv.slice(2);
  const soPublico = args.includes("--publico");
  const pastaSite = join(RAIZ, args.find((a) => !a.startsWith("--")) ?? "_site");
  let catalogo = JSON.parse(readFileSync(join(RAIZ, "catalogo.json"), "utf8"));
  if (soPublico) {
    const { publico, remover } = separarTeste(catalogo);
    catalogo = publico;
    for (const r of remover) rmSync(join(pastaSite, r), { recursive: true, force: true });
    rmSync(join(pastaSite, "pacotes", "excecoes.json"), { force: true }); // nomes e motivos das exceções: só do repositório
    writeFileSync(join(pastaSite, "catalogo.json"), JSON.stringify(publico, null, 2) + "\n");
  }
  const originais = Object.fromEntries(
    PAGINAS.map((p) => {
      const arquivo = join(pastaSite, `${p}.html`);
      if (!existsSync(arquivo)) throw new Error(`${arquivo} não existe; rode o quarto render antes.`);
      return [p, readFileSync(arquivo, "utf8")];
    }),
  );

  let n = 0;
  function escrever(dominio, edicao) {
    const pasta = join(pastaSite, "d", dominio, ...(edicao ? [edicao] : []));
    mkdirSync(pasta, { recursive: true });
    for (const pagina of PAGINAS) {
      const html = paginaDoEndereco(originais[pagina], { dominio, edicao, pagina });
      writeFileSync(join(pasta, `${pagina}.html`), html);
      n++;
    }
    // A pasta abre na Visão geral (o servidor estático serve index.html).
    copyFileSync(join(pasta, "visao-geral.html"), join(pasta, "index.html"));
  }

  for (const d of catalogo.dominios) {
    escrever(d.conjunto_id, null);
    for (const e of d.edicoes) escrever(d.conjunto_id, e.edicao);
  }
  console.log(`endereços: ${catalogo.dominios.length} domínio(s), ${n} página(s) em ${pastaSite}/d/`);
}

if (process.argv[1] && process.argv[1].endsWith("gerar_enderecos.mjs")) main();
