#!/usr/bin/env node
// Monta o catalogo.json a partir de pacotes/<conjunto>/<edicao>/manifesto.json (S1-1).
// Cada pacote candidato é validado (V1–V12, ferramentas/validar.mjs); pacote inválido
// derruba o build e diz qual. Exceções (edição fora do catálogo, pacote de teste) ficam
// em pacotes/excecoes.json, mantido à mão.
//
// O catalogo.json NÃO é versionado (.gitignore): é gerado em todo build (npm run build, CI) e
// impresso no log. Uso: node ferramentas/montar_catalogo.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { montarCatalogo } from "./catalogo_montagem.mjs";
import { validarPacote } from "./validar.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASTA_PACOTES = join(RAIZ, "pacotes");

function subpastas(pasta) {
  return readdirSync(pasta, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
}

const excecoes = JSON.parse(readFileSync(join(PASTA_PACOTES, "excecoes.json"), "utf8"));
const foraDoCatalogo = (c, e) => (excecoes.fora_do_catalogo ?? []).some((x) => x.conjunto_id === c && x.edicao === e);

const pacotes = [];
const problemas = [];
for (const conjunto of subpastas(PASTA_PACOTES)) {
  for (const edicao of subpastas(join(PASTA_PACOTES, conjunto))) {
    if (foraDoCatalogo(conjunto, edicao)) continue; // não entra no catálogo; não é conferida aqui
    const origem = `pacotes/${conjunto}/${edicao}`;
    const caminhoManifesto = join(RAIZ, origem, "manifesto.json");
    if (!existsSync(caminhoManifesto)) {
      problemas.push(`${origem}: sem manifesto.json`);
      continue;
    }
    const manifesto = JSON.parse(readFileSync(caminhoManifesto, "utf8"));
    if (manifesto.conjunto_id !== conjunto) {
      problemas.push(`${origem}: manifesto.conjunto_id (${manifesto.conjunto_id}) difere da pasta (${conjunto})`);
      continue;
    }
    const rel = await validarPacote(join(RAIZ, origem));
    if (!rel.ok()) {
      for (const f of rel.falhas) problemas.push(`${origem}: [${f.regra}] ${f.arquivo}: ${f.mensagem}`);
      continue;
    }
    pacotes.push({ conjunto_id: conjunto, edicao, origem, manifesto });
  }
}

if (problemas.length) {
  console.error("FALHOU: pacote inválido; o catálogo não foi gerado.");
  for (const p of problemas) console.error(`  ${p}`);
  process.exit(1);
}

let catalogo;
try {
  catalogo = montarCatalogo(pacotes, excecoes);
} catch (erro) {
  console.error(`FALHOU: ${erro.message}`);
  process.exit(1);
}
const texto = JSON.stringify(catalogo, null, 2) + "\n";
const arquivo = join(RAIZ, "catalogo.json");

writeFileSync(arquivo, texto);
const n = catalogo.dominios.reduce((soma, d) => soma + d.edicoes.length, 0);
console.log(`catalogo.json: ${catalogo.dominios.length} domínio(s), ${n} edição(ões), ${pacotes.length} pacote(s) validado(s). Conteúdo:`);
console.log(texto);
