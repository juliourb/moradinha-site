#!/usr/bin/env node
// Servidor estático minimalista para _site/, usado pelo Playwright (F0-5/F0-6).
// Uso: node ferramentas/servir.mjs [porta] [pasta]
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(import.meta.url), "..", "..");
const porta = Number(process.argv[2] ?? 4173);
const pasta = join(RAIZ, process.argv[3] ?? "_site");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".parquet": "application/octet-stream",
  ".wasm": "application/wasm",
  ".geojson": "application/geo+json",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

createServer((req, res) => {
  let caminho = decodeURIComponent(req.url.split("?")[0]);
  if (caminho === "/") caminho = "/index.html";
  let arquivo = join(pasta, caminho);
  if (existsSync(arquivo) && statSync(arquivo).isDirectory()) {
    arquivo = join(arquivo, "index.html");
  }
  if (!existsSync(arquivo)) {
    res.writeHead(404);
    res.end("não encontrado");
    return;
  }
  const tipo = TIPOS[extname(arquivo)] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": tipo });
  createReadStream(arquivo).pipe(res);
}).listen(porta, () => {
  console.log(`servindo ${pasta} em http://localhost:${porta}`);
});
