import { describe, it, expect } from "vitest";
import { dadosDeficitIncerteza, CORTE_CV_PROTOCOLO } from "../../src/js/dados/qualidade.js";

const linhas = [
  { h3: "a", x: 0.5, y: 9 }, // déficit < 1: fora
  { h3: "b", x: 1, y: 0.1 },
  { h3: "c", x: 2, y: 0.9 },
  { h3: "d", x: 10, y: 0.2 },
  { h3: "e", x: 200, y: 0.8 },
  { h3: "f", x: 3, y: null }, // sem incerteza: entra na mediana do déficit, fora dos pontos
];
const dx = (l) => l.x;
const dy = (l) => l.y;

describe("dadosDeficitIncerteza (acréscimo C)", () => {
  it("corte do déficit = mediana dos hexágonos com déficit ≥ 1", () => {
    const r = dadosDeficitIncerteza(linhas, dx, dy, false);
    expect(r.corteX).toBe(3); // [1,2,3,10,200]
    expect(r.pontos.map((p) => p.l.h3)).toEqual(["b", "c", "d", "e"]);
  });
  it("medida que não é CV: corte da incerteza na mediana", () => {
    const r = dadosDeficitIncerteza(linhas, dx, dy, false);
    expect(r.tipoCorteY).toBe("mediana");
    expect(r.corteY).toBeCloseTo(0.5);
  });
  it("medida CV: corte no limiar do protocolo (30%)", () => {
    const r = dadosDeficitIncerteza(linhas, dx, (l) => (l.y == null ? null : l.y * 50), true);
    expect(r.corteY).toBe(CORTE_CV_PROTOCOLO);
  });
  it("quadrantes somam os pontos e as partes do déficit somam 1", () => {
    const r = dadosDeficitIncerteza(linhas, dx, dy, false);
    const q = r.quadrantes;
    expect(q.aa.n + q.ab.n + q.ba.n + q.bb.n).toBe(r.pontos.length);
    expect(q.aa.parteDeficit + q.ab.parteDeficit + q.ba.parteDeficit + q.bb.parteDeficit).toBeCloseTo(1);
    expect(q.aa.n).toBe(1); // e: 200, 0.8
    expect(q.aa.parteDeficit).toBeCloseTo(200 / 213);
  });
  it("escala log quando a distribuição do déficit é assimétrica", () => {
    expect(dadosDeficitIncerteza(linhas, dx, dy, false).log).toBe(true);
    const simetrico = [1, 2, 3, 4, 5, 6].map((x) => ({ x, y: x / 10 }));
    expect(dadosDeficitIncerteza(simetrico, dx, dy, false).log).toBe(false);
  });
  it("sem pontos com incerteza: null", () => {
    expect(dadosDeficitIncerteza([{ x: 5, y: null }], dx, dy, false)).toBeNull();
  });
});
