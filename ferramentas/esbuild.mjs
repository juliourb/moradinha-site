#!/usr/bin/env node
// Empacota src/js/main.js num único ESM (assets/js/moradinha.js) e copia os
// bundles do DuckDB-WASM (wasm + worker) para assets/js/duckdb/, servidos
// pelo próprio site (SPEC_00 §3: nada de CDN em produção).
import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA_JS = join(RAIZ, "assets", "js", "moradinha.js");
const SAIDA_DUCKDB = join(RAIZ, "assets", "js", "duckdb");
const DUCKDB_DIST = join(RAIZ, "node_modules", "@duckdb", "duckdb-wasm", "dist");
const MAPLIBRE_DIST = join(RAIZ, "node_modules", "maplibre-gl", "dist");
const MAPLIBRE_CSS = join(MAPLIBRE_DIST, "maplibre-gl.css");
const SAIDA_MAPLIBRE_CSS = join(RAIZ, "assets", "css", "maplibre-gl.css");

async function empacotarJS() {
  await build({
    entryPoints: [join(RAIZ, "src", "js", "main.js")],
    outfile: SAIDA_JS,
    bundle: true,
    format: "esm",
    target: "es2022",
    sourcemap: true,
    logLevel: "info",
  });
}

function copiarDuckDBWasm() {
  mkdirSync(SAIDA_DUCKDB, { recursive: true });
  const arquivos = [
    "duckdb-mvp.wasm",
    "duckdb-eh.wasm",
    "duckdb-browser-mvp.worker.js",
    "duckdb-browser-eh.worker.js",
  ];
  for (const nome of arquivos) {
    copyFileSync(join(DUCKDB_DIST, nome), join(SAIDA_DUCKDB, nome));
  }
}

await empacotarJS();
copiarDuckDBWasm();
copyFileSync(MAPLIBRE_CSS, SAIDA_MAPLIBRE_CSS);
// maplibre-gl calcula a URL do worker como um arquivo irmão do próprio módulo
// (import.meta.url) — aqui, irmão de assets/js/moradinha.js.
copyFileSync(join(MAPLIBRE_DIST, "maplibre-gl-worker.mjs"), join(RAIZ, "assets", "js", "maplibre-gl-worker.mjs"));
console.log("Bundle JS, CSS do MapLibre e assets do DuckDB-WASM/MapLibre gerados em assets/.");
