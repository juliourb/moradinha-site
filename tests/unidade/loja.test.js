import { describe, expect, it, vi } from "vitest";
import { criarLoja } from "../../src/js/estado/loja.js";

describe("loja.js", () => {
  it("devolve o estado inicial", () => {
    const loja = criarLoja({ medida: "abs" });
    expect(loja.obter()).toEqual({ medida: "abs" });
  });

  it("mescla parcial em definir()", () => {
    const loja = criarLoja({ medida: "abs", comp: "total" });
    loja.definir({ comp: "coabitacao" });
    expect(loja.obter()).toEqual({ medida: "abs", comp: "coabitacao" });
  });

  it("notifica assinantes com o novo estado", () => {
    const loja = criarLoja({ medida: "abs" });
    const fn = vi.fn();
    loja.assinar(fn);
    loja.definir({ medida: "rel" });
    expect(fn).toHaveBeenCalledWith({ medida: "rel" });
  });

  it("cancelar assinatura para de notificar", () => {
    const loja = criarLoja({ medida: "abs" });
    const fn = vi.fn();
    const cancelar = loja.assinar(fn);
    cancelar();
    loja.definir({ medida: "rel" });
    expect(fn).not.toHaveBeenCalled();
  });
});
