import { describe, expect, it } from "vitest";
import { listarMarcas, MARCAS, rotuloMarca, rotuloFonteEstoque } from "../../src/js/util/marcas.js";

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

  it("rotuloFonteEstoque traduz 'mista' (período de média)", () => {
    expect(rotuloFonteEstoque("mista")).toBe("Média de anos com fontes de estoque diferentes");
  });

  it("rotuloFonteEstoque traduz as fontes conhecidas e mostra valor desconhecido cru, sem quebrar", () => {
    expect(rotuloFonteEstoque("censo")).toBe("Censo 2022");
    expect(rotuloFonteEstoque("open_buildings")).toBe("Open Buildings");
    expect(rotuloFonteEstoque("mapbiomas")).toBe("MapBiomas");
    expect(rotuloFonteEstoque("outra_fonte_fora_do_dicionario")).toBe("outra_fonte_fora_do_dicionario");
    expect(rotuloFonteEstoque(null)).toBe("—");
  });
});
