#!/usr/bin/env node
// CLI (SPEC_F5 F5-2): o build público só pode expor domínios/edições reais.
// Para cada entrada do catalogo.json que NÃO é `teste_apenas` (nem o domínio,
// nem a edição — essas só existem para os testes automatizados), confere
// que o manifesto correspondente tem `publico = true` e `ficticio = false`.
// Falha com mensagem clara se não. Lógica de decisão em catalogo_publico.mjs
// (testada sem tocar disco); aqui só a leitura de arquivo/rede.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { problemasCatalogoPublico } from "./catalogo_publico.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

function lerManifestoLocal(origem) {
  const caminho = join(RAIZ, origem, "manifesto.json");
  if (!existsSync(caminho)) throw new Error(`arquivo não encontrado: ${caminho}`);
  return JSON.parse(readFileSync(caminho, "utf8"));
}

const catalogo = JSON.parse(readFileSync(join(RAIZ, "catalogo.json"), "utf8"));
const problemas = problemasCatalogoPublico(catalogo, lerManifestoLocal);

if (problemas.length) {
  console.error("FALHOU: catalogo.json expõe um pacote que não pode ir para o build público.");
  for (const p of problemas) console.error(`  ${p}`);
  process.exit(1);
}
console.log("OK: todo domínio/edição público do catalogo.json é um pacote real (publico=true, ficticio=false).");
