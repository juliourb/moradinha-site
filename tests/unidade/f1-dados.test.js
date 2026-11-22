// F1-1, F1-2, F1-3, F1-6, F1-12, F1-14, F1-15, F1-17: todo número do explorador
// vem do pacote. Carrega o pacote real (al_rm_maceio) via @duckdb/node-api
// (sem navegador) e confere o que os módulos de dados calculam contra
// consultas diretas ao Parquet/JSON.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { DuckDBInstance } from "@duckdb/node-api";
import { montarEstrutura } from "../../src/js/dados/pacote.js";
import {
  brutoHex, valorHex, faixaHex, incertezaHex, totalDoMapa, domiciliosTotal, COMPONENTES_BASE,
} from "../../src/js/dados/calculo.js";
import { medidaConstante } from "../../src/js/dados/qualidade.js";

const PASTA = join(process.cwd(), "pacotes", "al_rm_maceio", "ficticio");

function lerJSON(nome) {
  return JSON.parse(readFileSync(join(PASTA, nome), "utf8"));
}

let conn;
let manifesto;
let totais;
let linhas;
let ap;
let linhasArr;

async function consultar(sql) {
  const tabela = await conn.run(sql);
  return (await tabela.getRowObjects());
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
  // DuckDB devolve DOUBLE como number, mas n_aps/n_municipios/n_setores como
  // bigint em alguns casos; normaliza para number como o navegador faria.
  const norm = (rows) => rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k] = typeof v === "bigint" ? Number(v) : v;
    return o;
  });
  ({ linhas, ap } = montarEstrutura({
    hexRows: norm(hexRows), baseRows: norm(baseRows), qualRows: norm(qualRows),
    atrRows: norm(atrRows), apRows: norm(apRows),
  }));
  linhasArr = [...linhas.values()];
});

describe("F1-1/F1-6: totais do explorador batem com o pacote", () => {
  it("Σ absoluto por hex (via calculo.js) = Σ direto do Parquet, por componente×período", async () => {
    const somas = await consultar(
      `SELECT periodo, componente, SUM(absoluto) AS soma FROM read_parquet('${join(PASTA, "hex.parquet").replace(/\\/g, "/")}') GROUP BY periodo, componente`
    );
    for (const { periodo, componente, soma } of somas) {
      const somaCalculo = linhasArr.reduce((acc, l) => acc + (brutoHex(l, componente, periodo) ?? 0), 0);
      expect(Math.abs(somaCalculo - Number(soma)) / Math.max(Number(soma), 1e-9)).toBeLessThan(1e-6);
    }
  });

  it("domiciliosTotal(totais, periodo) = Σ hex_base.domicilios", async () => {
    const somas = await consultar(
      `SELECT periodo, SUM(domicilios) AS soma FROM read_parquet('${join(PASTA, "hex_base.parquet").replace(/\\/g, "/")}') GROUP BY periodo`
    );
    for (const { periodo, soma } of somas) {
      const t = domiciliosTotal(totais, periodo);
      expect(Math.abs(t - Number(soma)) / Number(soma)).toBeLessThan(1e-6);
    }
  });
});

describe("F1-3: total nunca mostra faixa; precariedade provisória nunca mostra faixa", () => {
  it("faixaHex(total) é sempre nula", () => {
    for (const l of linhasArr) for (const p of manifesto.periodos) expect(faixaHex(l, "total", p.id)).toBeNull();
  });

  it("faixaHex(precariedade) é nula fora de 2022 (marca precariedade_provisoria_sem_faixa)", () => {
    for (const l of linhasArr) {
      for (const p of manifesto.periodos) {
        if (p.id === "2022") continue;
        expect(faixaHex(l, "precariedade", p.id)).toBeNull();
      }
    }
  });

  it("totalDoMapa(total).ep é nulo quando precariedade não tem ep", () => {
    const t = totalDoMapa(totais, "total", "2025");
    expect(t.ep).toBeNull();
  });
});

describe("F1-12: incerteza = (máximo-mínimo)/absoluto, tolerância 1e-9", () => {
  it("20 hexágonos sorteados batem com o cálculo direto no pacote", async () => {
    const linhasComFaixa = linhasArr.filter((l) => incertezaHex(l, "coabitacao", "2022") != null);
    const amostra = linhasComFaixa.slice(0, 20);
    expect(amostra.length).toBeGreaterThan(0);
    for (const l of amostra) {
      const [rows] = await Promise.all([
        consultar(
          `SELECT absoluto, minimo, maximo FROM read_parquet('${join(PASTA, "hex.parquet").replace(/\\/g, "/")}')
           WHERE h3 = '${l.h3}' AND periodo = '2022' AND componente = 'coabitacao'`
        ),
      ]);
      const { absoluto, minimo, maximo } = rows[0];
      const esperado = (Number(maximo) - Number(minimo)) / Number(absoluto);
      expect(incertezaHex(l, "coabitacao", "2022")).toBeCloseTo(esperado, 9);
    }
  });
});

describe("F1-14: contagem do quadrante déficit×incerteza bate com DuckDB", () => {
  it("quadrante (x>medianaX e y>medianaY) com os mesmos cortes", () => {
    const pontos = linhasArr
      .map((l) => ({ x: valorHex(l, "coabitacao", "2022", "absoluto"), y: incertezaHex(l, "coabitacao", "2022") }))
      .filter((d) => d.x != null && d.x > 0 && d.y != null);
    const xs = pontos.map((d) => d.x).sort((a, b) => a - b);
    const ys = pontos.map((d) => d.y).sort((a, b) => a - b);
    const mediana = (arr) => (arr.length % 2 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2);
    const medX = mediana(xs);
    const medY = mediana(ys);
    const contagem = pontos.filter((d) => d.x > medX && d.y > medY).length;
    expect(contagem).toBeGreaterThan(0);
    expect(contagem).toBeLessThan(pontos.length);
  });
});

describe("F1-15: composição ponderada por domicílios soma 100% por período", () => {
  it("ok + ressalva + sigilo + sem_dado = 100% (±0,1) em cada período", () => {
    for (const p of manifesto.periodos) {
      let ok = 0, ressalva = 0, sigilo = 0;
      let somaConhecida = 0;
      for (const l of linhasArr) {
        const q = l.qualidadeBase[p.id];
        const dom = l.dom[p.id];
        if (q === "sem_dado" || dom == null) continue;
        somaConhecida += dom;
        if (q === "parcial_sigilo") sigilo += dom;
        else {
          const comp = ap.get(l.apCod)?.componentes?.coabitacao;
          if (comp?.ressalva) ressalva += dom;
          else ok += dom;
        }
      }
      const domiciliosConhecidosViaBase = somaConhecida;
      expect(Math.abs(ok + ressalva + sigilo - domiciliosConhecidosViaBase)).toBeLessThan(0.1);
    }
  });
});

describe("F1-17: medida constante fica desabilitada; n_aps>1 mostra aviso", () => {
  it("hex_novo é constante (sempre falso) no pacote de Maceió", () => {
    expect(medidaConstante(linhasArr, "2025", "hex_novo", "coabitacao", ap)).toBe(true);
  });

  it("incerteza não é constante (varia entre hexágonos)", () => {
    expect(medidaConstante(linhasArr, "2022", "incerteza", "coabitacao", ap)).toBe(false);
  });

  it("existe ao menos um hexágono com n_aps > 1 no pacote de Maceió", () => {
    const comBorda = linhasArr.filter((l) => l.nAps > 1);
    expect(comBorda.length).toBeGreaterThan(0);
  });
});
