import { describe, it, expect } from "vitest";
import { postos, spearman } from "../../src/js/dados/correlacao.js";

describe("Spearman (acréscimo F2)", () => {
  it("postos com empate pela média", () => {
    expect(postos([10, 20, 20, 5])).toEqual([2, 3.5, 3.5, 1]);
  });
  it("monotônico crescente = 1; decrescente = −1", () => {
    expect(spearman([1, 2, 3, 4], [10, 100, 1000, 10000])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
  });
  it("valor conhecido com empates (conferido à mão)", () => {
    // postos x: 1,2,3,4,5; postos y: 2,1,4,3,5 → ρ = 1 − 6·Σd²/(n(n²−1)) = 1 − 6·4/120 = 0,8
    expect(spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])).toBeCloseTo(0.8);
  });
  it("sem variação ou poucos pares: null", () => {
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(spearman([1, 2], [1, 2])).toBeNull();
  });
});
