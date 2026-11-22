// SPEC_F6 C4/N1: escala de cores do mapa. Carrega o pacote real (bd10cbd) via
// @duckdb/node-api (sem navegador) para conferir F6.1-3 e F6.1-5 com números
// de verdade; se os valores obtidos diferirem do esperado na SPEC, o teste
// relata o que obteve em vez de ajustar a regra para bater (regra da fase).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { DuckDBInstance } from "@duckdb/node-api";
import { montarEstrutura } from "../../src/js/dados/pacote.js";
import {
  arredondarParaSerie, classeHex, quebrasJenks, calcularEscalasAbsolutas,
  taxaDominio, indiceClasse, indiceClasseVezesTaxa, CORTES_VEZES_TAXA, resumoLegendaClasses,
} from "../../src/js/dados/escalaCor.js";

const PASTA = join(process.cwd(), "pacotes", "al_rm_maceio", "bd10cbd");

function lerJSON(nome) {
  return JSON.parse(readFileSync(join(PASTA, nome), "utf8"));
}

let conn;
let manifesto;
let totais;
let linhas;
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
  ({ linhas } = montarEstrutura({
    hexRows: norm(hexRows), baseRows: norm(baseRows), qualRows: norm(qualRows),
    atrRows: norm(atrRows), apRows: norm(apRows),
  }));
  linhasArr = [...linhas.values()];
}, 30000);

describe("arredondarParaSerie", () => {
  it("arredonda para o mais próximo da série 1/1,5/2/2,5/3/4/5/7,5 × 10ⁿ", () => {
    expect(arredondarParaSerie(48)).toBe(50);
    expect(arredondarParaSerie(145)).toBe(150);
    expect(arredondarParaSerie(0.9)).toBe(1);
    expect(arredondarParaSerie(260)).toBe(250);
  });
});

describe("classeHex", () => {
  it("classifica hachura, menos_de_1, sem_dado e normal", () => {
    expect(classeHex(null, 5)).toBe("sem_dado");
    expect(classeHex(0.4, 0.1)).toBe("hachura");
    expect(classeHex(3, 0.5)).toBe("menos_de_1");
    expect(classeHex(3, 2)).toBe("normal");
  });
});

describe("F6.1-3: quebras absolutas (pacote bd10cbd)", () => {
  it("calcula e relata as quebras por componente (todos os períodos juntos)", () => {
    const escalas = calcularEscalasAbsolutas(linhasArr, manifesto);
    const obtidas = {
      total: escalas.get("total"),
      coabitacao: escalas.get("coabitacao"),
      onus: escalas.get("onus"),
      precariedade: escalas.get("precariedade"),
    };
    // eslint-disable-next-line no-console
    console.log("F6.1-3 quebras obtidas:", JSON.stringify(obtidas));
    for (const quebras of Object.values(obtidas)) {
      expect(quebras.length).toBeGreaterThan(0);
      expect(quebras.length).toBeLessThanOrEqual(6);
      expect([...quebras]).toEqual([...quebras].sort((a, b) => a - b));
    }
  });

  it("conta hexágonos por faixa do total em 2025 e relata (déficit ≥ 1)", () => {
    const escalas = calcularEscalasAbsolutas(linhasArr, manifesto);
    const quebrasTotal = escalas.get("total");
    const valores2025 = [];
    for (const linha of linhasArr) {
      const dom = linha.dom["2025"];
      let soma = 0;
      let ok = true;
      for (const c of ["coabitacao", "onus", "precariedade"]) {
        const v = linha.hex["2025"]?.[c]?.absoluto;
        if (v == null) { ok = false; break; }
        soma += v;
      }
      if (ok && classeHex(dom, soma) === "normal") valores2025.push(soma);
    }
    const resumo = resumoLegendaClasses(valores2025, quebrasTotal);
    // eslint-disable-next-line no-console
    console.log("F6.1-3 contagem por faixa (total, 2025):", JSON.stringify(resumo.map((r) => r.n)));
    const somaPct = resumo.reduce((s, r) => s + (r.pctDeficit ?? 0), 0);
    expect(somaPct).toBeCloseTo(100, 0);
  });
});

describe("F6.1-5: taxa do domínio e classes relativas", () => {
  it("taxa do domínio do total em 2025 (relata o valor obtido)", () => {
    const taxa = taxaDominio(totais, "total", "2025");
    // eslint-disable-next-line no-console
    console.log("F6.1-5 taxa do domínio (total, 2025):", taxa);
    expect(taxa).not.toBeNull();
    expect(taxa).toBeGreaterThan(0);
  });

  it("indiceClasseVezesTaxa classifica pelos cortes fixos", () => {
    expect(indiceClasseVezesTaxa(0.3)).toBe(0);
    expect(indiceClasseVezesTaxa(0.6)).toBe(1);
    expect(indiceClasseVezesTaxa(1)).toBe(2);
    expect(indiceClasseVezesTaxa(1.3)).toBe(3);
    expect(indiceClasseVezesTaxa(1.8)).toBe(4);
    expect(indiceClasseVezesTaxa(3)).toBe(5);
    expect(CORTES_VEZES_TAXA).toEqual([0.5, 0.8, 1.25, 1.5, 2]);
  });
});

describe("indiceClasse", () => {
  it("usa a maior quebra de cada classe como limite superior", () => {
    const quebras = [10, 20, 30];
    expect(indiceClasse(5, quebras)).toBe(0);
    expect(indiceClasse(15, quebras)).toBe(1);
    expect(indiceClasse(30, quebras)).toBe(2);
    expect(indiceClasse(100, quebras)).toBe(2);
  });
});
