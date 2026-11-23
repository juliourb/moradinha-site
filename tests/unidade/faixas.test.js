import { describe, expect, it } from "vitest";
import { valorDentroFaixas, alternarFaixa } from "../../src/js/util/faixas.js";

describe("valorDentroFaixas (SPEC_F6 C1)", () => {
  it("sem faixas, tudo entra", () => {
    expect(valorDentroFaixas(5, [])).toBe(true);
    expect(valorDentroFaixas(5, null)).toBe(true);
  });

  it("entra se cair em qualquer uma das faixas marcadas", () => {
    const faixas = [[0, 10], [20, 30]];
    expect(valorDentroFaixas(5, faixas)).toBe(true);
    expect(valorDentroFaixas(25, faixas)).toBe(true);
    expect(valorDentroFaixas(15, faixas)).toBe(false);
  });

  it("faixa aberta (x1 nulo) = p99 ou mais", () => {
    expect(valorDentroFaixas(1000, [[50, null]])).toBe(true);
    expect(valorDentroFaixas(10, [[50, null]])).toBe(false);
  });

  it("valor nulo nunca entra quando há filtro", () => {
    expect(valorDentroFaixas(null, [[0, 10]])).toBe(false);
  });
});

describe("alternarFaixa", () => {
  it("adiciona e remove por igualdade de x0 (toggle)", () => {
    let faixas = alternarFaixa([], [0, 10]);
    expect(faixas).toEqual([[0, 10]]);
    faixas = alternarFaixa(faixas, [20, 30]);
    expect(faixas).toEqual([[0, 10], [20, 30]]);
    faixas = alternarFaixa(faixas, [0, 10]);
    expect(faixas).toEqual([[20, 30]]);
  });
});
