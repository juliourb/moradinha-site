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
// Uso: node ferramentas/gerar_enderecos.mjs [pasta do site, padrão _site]
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

function main() {
  const pastaSite = join(RAIZ, process.argv[2] ?? "_site");
  const catalogo = JSON.parse(readFileSync(join(RAIZ, "catalogo.json"), "utf8"));
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
