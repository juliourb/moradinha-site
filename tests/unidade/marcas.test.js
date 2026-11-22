import { describe, expect, it } from "vitest";
import { listarMarcas, MARCAS, rotuloMarca } from "../../src/js/util/marcas.js";

describe("marcas.js", () => {
  it("retorna o rótulo de um código válido", () => {
    expect(rotuloMarca("sem_dado")).toBe(MARCAS.sem_dado);
  });

  it("lança erro para código fora do vocabulário fechado", () => {
    expect(() => rotuloMarca("codigo_inventado")).toThrow();
  });

  it("lista os códigos de um campo marcas separado por ;", () => {
    expect(listarMarcas("total_fragil;ap_ressalva")).toEqual(["total_fragil", "ap_ressalva"]);
  });

  it("campo vazio não tem marcas", () => {
    expect(listarMarcas("")).toEqual([]);
  });
});
