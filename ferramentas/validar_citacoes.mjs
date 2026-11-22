#!/usr/bin/env node
// CLI: falha (exit 1) se algum texto de textos/metodologia/*.qmd citar uma
// chave que não existe em referencias.bib (SPEC_F4 F4-5).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { citacoesOrfas } from "./citacoes.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASTA_TEXTOS = join(RAIZ, "textos", "metodologia");
const BIB = join(RAIZ, "referencias.bib");

const textos = readdirSync(PASTA_TEXTOS)
  .filter((f) => f.endsWith(".qmd") || f.endsWith(".md"))
  .map((nome) => ({ nome, texto: readFileSync(join(PASTA_TEXTOS, nome), "utf8") }));
const bib = readFileSync(BIB, "utf8");

const orfas = citacoesOrfas(textos, bib);
if (orfas.length) {
  console.error("Citações órfãs (sem chave correspondente em referencias.bib):");
  for (const { arquivo, chave } of orfas) console.error(`  ${arquivo}: @${chave}`);
  process.exit(1);
}
console.log(`OK: todas as citações de ${textos.length} textos resolvem no referencias.bib.`);
