import { describe, expect, it } from "vitest";
import { valorMedidaQualidade, medidaConstante } from "../../src/js/dados/qualidade.js";

function linha(h3, overrides = {}) {
  return {
    h3,
    apCod: "ap1",
    dom: {},
    qualidadeBase: { "2025": "ok" },
    qualidade: { "2025": { fracaoImputada: 0.1, gEstoque: 1.0, hexNovo: false } },
    hex: { "2025": { coabitacao: { absoluto: 10, minimo: 8, maximo: 12 } } },
    ...overrides,
  };
}

const AP = new Map([["ap1", { componentes: { coabitacao: { ressalva: false, sem_direta: false, direta_cv: 12 } } }]]);

describe("dados/qualidade.js", () => {
  it("incerteza lê de incertezaHex", () => {
    expect(valorMedidaQualidade(linha("a"), "2025", "incerteza", "coabitacao", AP)).toBeCloseTo(0.4);
  });

  it("hex_novo sempre falso -> medida constante", () => {
    const linhas = [linha("a"), linha("b"), linha("c")];
    expect(medidaConstante(linhas, "2025", "hex_novo", "coabitacao", AP)).toBe(true);
  });

  it("incerteza variando entre hexágonos -> não constante", () => {
    const linhas = [
      linha("a"),
      linha("b", { hex: { "2025": { coabitacao: { absoluto: 10, minimo: 5, maximo: 15 } } } }),
    ];
    expect(medidaConstante(linhas, "2025", "incerteza", "coabitacao", AP)).toBe(false);
  });

  it("qualidade_dado lê de hex_base.qualidade", () => {
    expect(valorMedidaQualidade(linha("a"), "2025", "qualidade_dado", "coabitacao", AP)).toBe("ok");
  });
});
