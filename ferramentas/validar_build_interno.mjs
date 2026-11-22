#!/usr/bin/env node
// CLI: confere que a seção interna da Metodologia (SPEC_F4 item 5/F4-4) está
// ausente do build público e presente no build --profile interno. Roda
// depois dos dois builds (npm run build && npm run build:interno).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLICO = join(RAIZ, "_site", "metodologia.html");
const INTERNO = join(RAIZ, "_site_interno", "metodologia.html");

for (const caminho of [PUBLICO, INTERNO]) {
  if (!existsSync(caminho)) {
    console.error(`Não achei ${caminho}. Rode "npm run build" e "npm run build:interno" antes.`);
    process.exit(1);
  }
}

const publico = readFileSync(PUBLICO, "utf8");
const interno = readFileSync(INTERNO, "utf8");

const problemas = [];
if (publico.includes("met-interna")) problemas.push("_site/metodologia.html (público) contém 'met-interna' — deveria estar ausente.");
if (publico.includes("desfecho interno")) problemas.push("_site/metodologia.html (público) contém o texto da seção interna.");
if (!interno.includes("met-interna")) problemas.push("_site_interno/metodologia.html (--profile interno) não contém 'met-interna' — deveria estar presente.");

if (problemas.length) {
  console.error("FALHOU:");
  for (const p of problemas) console.error(`  ${p}`);
  process.exit(1);
}
console.log("OK: seção interna ausente no build público, presente no build --profile interno.");
