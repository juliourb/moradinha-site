import { describe, it, expect } from "vitest";
import { eixoSerie } from "../../src/js/util/eixoSerie.js";

describe("eixoSerie (acréscimo A)", () => {
  it("ônus de ~15 mil a 42 mil: eixo não começa em zero, folga de 10% e pontas redondas", () => {
    const e = eixoSerie([{ v: 20000, lo: 15000, hi: 25000 }, { v: 38000, lo: 34000, hi: 42000 }]);
    expect(e.naoComecaEmZero).toBe(true);
    expect(e.dominio[0]).toBeLessThanOrEqual(15000 - 2700);
    expect(e.dominio[1]).toBeGreaterThanOrEqual(42000 + 2700);
    expect(e.dominio[0]).toBeGreaterThan(0);
    for (const t of e.marcas) expect(t % 5000).toBe(0);
    expect(e.marcas[0]).toBe(e.dominio[0]);
    expect(e.marcas.at(-1)).toBe(e.dominio[1]);
  });

  it("usa o valor quando não há faixa", () => {
    const e = eixoSerie([{ v: 100 }, { v: 200, lo: null, hi: null }]);
    expect(e.dominio[0]).toBeLessThanOrEqual(90);
    expect(e.dominio[1]).toBeGreaterThanOrEqual(210);
  });

  it("dados perto de zero não ganham eixo negativo", () => {
    const e = eixoSerie([1, 2, 30]);
    expect(e.dominio[0]).toBe(0);
    expect(e.naoComecaEmZero).toBe(false);
  });

  it("série constante e vazia", () => {
    expect(eixoSerie([5, 5]).dominio[1]).toBeGreaterThan(5);
    expect(eixoSerie([null, undefined])).toBeNull();
  });
});
