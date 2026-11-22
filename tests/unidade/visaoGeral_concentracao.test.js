// SPEC_F6 B6 / ressalva do relativo: carrega o pacote real (bd10cbd) via
// @duckdb/node-api para conferir F6.1-8 e F6.1-9 com números de verdade.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { DuckDBInstance } from "@duckdb/node-api";
import { montarEstrutura } from "../../src/js/dados/pacote.js";
import { curvaConcentracao, maiorRelativo, fraseRessalvaRelativo, mudancasAnuaisForaDoRuido } from "../../src/js/dados/visaoGeral.js";
import { taxaDominio } from "../../src/js/dados/escalaCor.js";

const PASTA = join(process.cwd(), "pacotes", "al_rm_maceio", "bd10cbd");

function lerJSON(nome) {
  return JSON.parse(readFileSync(join(PASTA, nome), "utf8"));
}

let conn;
let manifesto;
let totais;
let linhasArr;

async function consultar(sql) {
  const tabela = await conn.run(sql);
  return await tabela.getRowObjects();
}

beforeAll(async () => {
  const instancia = await DuckDBInstance.create(":memory:");
  conn = await instancia.connect();
  manifesto = lerJSON("manifesto.json");
  totais = lerJSON("totais.json");

  const p = (arq) => join(PASTA, arq).replace(/\\/g, "/");
  const [hexRows, baseRows, qualRows, atrRows, apRows] = await Promise.all([
    consultar(`SELECT * FROM read_parquet('${p("hex.parquet")}')`),
    consultar(`SELECT * FROM read_parquet('${p("hex_base.parquet")}')`),
    consultar(`SELECT * FROM read_parquet('${p("hex_qualidade.parquet")}')`),
    consultar(`SELECT * FROM read_parquet('${p("hex_atributos.parquet")}')`),
    consultar(`SELECT * FROM read_parquet('${p("ap.parquet")}')`),
  ]);
  const norm = (rows) =>
    rows.map((r) => {
      const o = {};
      for (const [k, v] of Object.entries(r)) o[k] = typeof v === "bigint" ? Number(v) : v;
      return o;
    });
  const { linhas } = montarEstrutura({
    hexRows: norm(hexRows), baseRows: norm(baseRows), qualRows: norm(qualRows),
    atrRows: norm(atrRows), apRows: norm(apRows),
  });
  linhasArr = [...linhas.values()];
}, 30000);

describe("F6.1-8: curva de concentração (total, 2025)", () => {
  it("63 maiores hexágonos somam 54% (± 1 ponto) do déficit", () => {
    const conc = curvaConcentracao(linhasArr, "total", "2025");
    const ponto63 = conc.pontos[62];
    expect(ponto63).toBeDefined();
    expect(ponto63.pctDeficitAcumulado).toBeGreaterThanOrEqual(53);
    expect(ponto63.pctDeficitAcumulado).toBeLessThanOrEqual(55);
  });
});

describe("F6.1-9: ressalva do relativo (total, 2025)", () => {
  it("maior relativo ≈ 20% (± 0,5) e menos de 2 vezes a taxa do domínio", () => {
    const maiorRel = maiorRelativo(linhasArr, "total", "2025");
    const taxa = taxaDominio(totais, "total", "2025");
    const vezes = maiorRel != null && taxa ? maiorRel / taxa : null;
    expect(maiorRel).toBeGreaterThanOrEqual(19.5);
    expect(maiorRel).toBeLessThanOrEqual(20.5);
    expect(vezes).toBeLessThan(2);
    const frase = fraseRessalvaRelativo(linhasArr, totais, "total", "2025");
    expect(frase).toContain("somam metade do déficit absoluto");
    // vezes < 2 (1,92): mantém a frase longa de explicação (SPEC_F6, Visão geral).
    expect(frase).toContain("a concentração do mapa absoluto acompanha");
  });
});

describe("mudancasAnuaisForaDoRuido", () => {
  it("relata as mudanças anuais que passam de 1,96 EP no pacote bd10cbd", () => {
    const passam = mudancasAnuaisForaDoRuido(manifesto, totais);
    // eslint-disable-next-line no-console
    console.log("mudancasAnuaisForaDoRuido:", JSON.stringify(passam.map((p) => ({ c: p.componente, de: p.de.id, para: p.para.id, z: p.z }))));
    expect(Array.isArray(passam)).toBe(true);
  });
});
