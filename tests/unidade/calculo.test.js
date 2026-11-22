import { describe, expect, it } from "vitest";
import {
  brutoHex, valorHex, faixaHex, incertezaHex, marcasHex, totalDoMapa, domiciliosTotal, mudanca,
} from "../../src/js/dados/calculo.js";

const LINHA = {
  h3: "abc",
  dom: { "2025": 100 },
  hex: {
    "2025": {
      coabitacao: { absoluto: 10, minimo: 8, maximo: 12, relativo: 10, marcas: ["total_fragil"] },
      onus: { absoluto: 20, minimo: 15, maximo: 25, relativo: 20, marcas: [] },
      precariedade: { absoluto: 5, minimo: null, maximo: null, relativo: 5, marcas: ["precariedade_provisoria_sem_faixa"] },
    },
  },
};

const TOTAIS = {
  totais: [
    { componente: "coabitacao", periodo: "2025", regime: "c", total: 100, ep: 10, marcas: ["total_fragil"], no_mapa: true },
    { componente: "onus", periodo: "2025", regime: "c", total: 200, ep: 20, marcas: [], no_mapa: true },
    { componente: "precariedade", periodo: "2025", regime: "provisoria", total: 50, ep: null, marcas: [], no_mapa: true },
    { componente: "coabitacao", periodo: "2022", regime: "c", total: 90, ep: 9, marcas: [], no_mapa: true },
  ],
  domicilios: [{ periodo: "2025", total: 1000 }],
  mudancas: [{ componente: "coabitacao", de: "2022", para: "2025", delta: 10, z: 0.7, marcas: ["mudanca_no_ruido"] }],
};

describe("dados/calculo.js", () => {
  it("brutoHex soma os 3 componentes para total", () => {
    expect(brutoHex(LINHA, "total", "2025")).toBe(35);
    expect(brutoHex(LINHA, "onus", "2025")).toBe(20);
  });

  it("valorHex relativo divide por domicílios", () => {
    expect(valorHex(LINHA, "onus", "2025", "relativo")).toBe(20);
    expect(valorHex(LINHA, "onus", "2025", "absoluto")).toBe(20);
  });

  it("faixaHex é nula para total e para precariedade sem faixa", () => {
    expect(faixaHex(LINHA, "total", "2025")).toBeNull();
    expect(faixaHex(LINHA, "precariedade", "2025")).toBeNull();
    expect(faixaHex(LINHA, "coabitacao", "2025")).toEqual([8, 12]);
  });

  it("incertezaHex = (max-min)/absoluto", () => {
    expect(incertezaHex(LINHA, "coabitacao", "2025")).toBeCloseTo((12 - 8) / 10);
    expect(incertezaHex(LINHA, "total", "2025")).toBeNull();
    expect(incertezaHex(LINHA, "precariedade", "2025")).toBeNull();
  });

  it("marcasHex une as marcas dos 3 componentes para total", () => {
    expect(marcasHex(LINHA, "total", "2025").sort()).toEqual(["precariedade_provisoria_sem_faixa", "total_fragil"]);
  });

  it("totalDoMapa combina ep por soma de quadrados; nulo se algum componente não tem ep", () => {
    const t = totalDoMapa(TOTAIS, "total", "2025");
    expect(t.total).toBe(350);
    expect(t.ep).toBeNull(); // precariedade sem ep
    const coab = totalDoMapa(TOTAIS, "coabitacao", "2025");
    expect(coab).toEqual({ total: 100, ep: 10, regime: "c", marcas: ["total_fragil"] });
  });

  it("domiciliosTotal lê de totais.domicilios", () => {
    expect(domiciliosTotal(TOTAIS, "2025")).toBe(1000);
  });

  it("mudanca usa a linha registrada quando existe", () => {
    expect(mudanca(TOTAIS, "coabitacao", "2022", "2025")).toEqual({
      delta: 10, z: 0.7, marcas: ["mudanca_no_ruido"], calculado: false,
    });
  });

  it("mudanca calcula no site quando não há linha registrada", () => {
    const r = mudanca(TOTAIS, "onus", "2022", "2025");
    expect(r).toBeNull(); // sem total "onus" 2022 no fixture
  });
});
