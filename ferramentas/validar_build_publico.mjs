#!/usr/bin/env node
// E58: o build PÚBLICO (_site) não contém pacote teste_apenas. Confere o que o build
// gerou: catalogo.json sem teste, nenhuma pasta de pacote/endereço de teste, e que
// toda pasta em _site/pacotes e _site/d corresponde a uma entrada do catálogo público.
// Uso: node ferramentas/validar_build_publico.mjs [pasta, padrão _site]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(RAIZ, process.argv[2] ?? "_site");

const subpastas = (p) => (existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []);
const problemas = [];

const publico = JSON.parse(readFileSync(join(SITE, "catalogo.json"), "utf8"));
const completo = existsSync(join(RAIZ, "catalogo.json")) ? JSON.parse(readFileSync(join(RAIZ, "catalogo.json"), "utf8")) : { dominios: [] };

for (const d of publico.dominios) {
  if (d.teste_apenas) problemas.push(`catalogo.json público traz o domínio de teste ${d.conjunto_id}`);
  for (const e of d.edicoes) if (e.teste_apenas) problemas.push(`catalogo.json público traz a edição de teste ${d.conjunto_id}/${e.edicao}`);
}
const permitidos = new Set(publico.dominios.map((d) => d.conjunto_id));
for (const c of subpastas(join(SITE, "d"))) if (!permitidos.has(c)) problemas.push(`d/${c} no build público (fora do catálogo público)`);
for (const d of completo.dominios) {
  if (d.teste_apenas && (existsSync(join(SITE, "pacotes", d.conjunto_id)) || existsSync(join(SITE, "d", d.conjunto_id)))) problemas.push(`domínio de teste ${d.conjunto_id} presente no build público`);
  for (const e of d.edicoes) if (e.teste_apenas && existsSync(join(SITE, e.origem))) problemas.push(`edição de teste ${e.origem} presente no build público`);
}
if (existsSync(join(SITE, "pacotes", "excecoes.json"))) problemas.push("pacotes/excecoes.json no build público");
for (const c of subpastas(join(SITE, "pacotes"))) if (/^teste_/.test(c)) problemas.push(`pacotes/${c} no build público`);

if (problemas.length) {
  console.error("FALHOU: o build público contém pacote de teste (E58).");
  for (const p of problemas) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`OK: build público sem pacote de teste (${publico.dominios.length} domínio(s) público(s): ${publico.dominios.map((d) => d.conjunto_id).join(", ")}).`);
