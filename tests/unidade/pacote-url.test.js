// SPEC_F5 F5-3: a origem de um pacote pode ser uma pasta local ou uma URL —
// o carregador trata os dois igual. Aqui provamos a parte que não depende do
// navegador (fetch por URL absoluta), sem DuckDB-WASM: um servidor HTTP local
// servindo a mesma pasta de um pacote fictício, lido por `carregarJSON` tanto
// pela pasta local quanto pela URL do servidor — mesmo resultado.
import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { carregarJSON } from "../../src/js/dados/pacote.js";

const PASTA = join(process.cwd(), "pacotes", "teste_pequeno", "ficticio");
let servidor;
let porta;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    try {
      const corpo = readFileSync(join(PASTA, decodeURIComponent(req.url.slice(1))));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(corpo);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => servidor.listen(0, resolve));
  porta = servidor.address().port;
});

afterAll(() => new Promise((resolve) => servidor.close(resolve)));

describe("F5-3: origem do pacote plugável (local ou URL, mesmo carregador)", () => {
  it("carregarJSON por URL devolve exatamente o mesmo manifesto que a leitura local", async () => {
    const local = JSON.parse(readFileSync(join(PASTA, "manifesto.json"), "utf8"));
    const porUrl = await carregarJSON(`http://localhost:${porta}`, "manifesto.json");
    expect(porUrl).toEqual(local);
  });
});
