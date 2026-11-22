// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { estadoInicial, textoPergunta, salvarLocalStorage } from "../../src/js/estado/pergunta.js";

const MANIFESTO = {
  periodos: [
    { id: "2022", rotulo: "2022", tipo: "ano" },
    { id: "2023", rotulo: "2023", tipo: "ano" },
    { id: "2024", rotulo: "2024", tipo: "ano" },
    { id: "2025", rotulo: "2025", tipo: "ano" },
    { id: "m2024", rotulo: "Média 2022–24", tipo: "media" },
    { id: "m2025", rotulo: "Média 2023–25", tipo: "media" },
  ],
  recortes: [{ id: "braskem" }],
};

describe("estado/pergunta.js", () => {
  beforeEach(() => localStorage.clear());

  it("N6: a cortina (comparar) nunca persiste — recarregar sempre volta desligada", () => {
    const comCortina = { ...estadoInicial(MANIFESTO), comparar: "2022" };
    salvarLocalStorage(comCortina);
    const recarregado = estadoInicial(MANIFESTO);
    expect(recarregado.comparar).toBeNull();
  });

  it("estado inicial usa o 4º período (2025) e liga a camada de AP", () => {
    const estado = estadoInicial(MANIFESTO);
    expect(estado.periodo).toBe("2025");
    expect(estado.camadas.ap).toBe(true);
    expect(estado.camadas.braskem).toBe(false);
  });

  it("pergunta do tema déficit, sem comparação", () => {
    const estado = { ...estadoInicial(MANIFESTO), medida: "relativo", componente: "onus" };
    expect(textoPergunta(estado, MANIFESTO)).toBe("Onde está o déficit relativo de ônus, em 2025?");
  });

  it("pergunta do tema déficit, total, com comparação", () => {
    const estado = { ...estadoInicial(MANIFESTO), componente: "total", comparar: "2022" };
    expect(textoPergunta(estado, MANIFESTO)).toBe(
      "Onde está o déficit absoluto, total, em 2025? Comparado com 2022."
    );
  });

  it("pergunta de médias usa 'na'", () => {
    const estado = { ...estadoInicial(MANIFESTO), periodo: "m2024", componente: "coabitacao" };
    expect(textoPergunta(estado, MANIFESTO)).toBe(
      "Onde está o déficit absoluto de coabitação, na média 2022–24?"
    );
  });

  it("pergunta do tema qualidade", () => {
    const estado = { ...estadoInicial(MANIFESTO), tema: "qualidade", componente: "coabitacao" };
    expect(textoPergunta(estado, MANIFESTO)).toBe("Quão confiável é a estimativa de coabitação em 2025?");
  });
});
