import { describe, expect, it } from "vitest";
import { entradasPublicas, problemasCatalogoPublico } from "../../ferramentas/catalogo_publico.mjs";

const CATALOGO = {
  dominios: [
    {
      conjunto_id: "al_rm_maceio",
      nome: "RM de Maceió",
      edicoes: [
        { edicao: "69277fd", origem: "pacotes/al_rm_maceio/69277fd", padrao: true },
        { edicao: "ficticio", origem: "pacotes/al_rm_maceio/ficticio", padrao: false, teste_apenas: true },
      ],
    },
    {
      conjunto_id: "teste_pequeno",
      nome: "Teste pequeno",
      teste_apenas: true,
      edicoes: [{ edicao: "ficticio", origem: "pacotes/teste_pequeno/ficticio", padrao: true }],
    },
  ],
};

describe("ferramentas/catalogo_publico.mjs", () => {
  it("entradasPublicas ignora domínio/edição teste_apenas", () => {
    const entradas = entradasPublicas(CATALOGO);
    expect(entradas).toHaveLength(1);
    expect(entradas[0].edicao.edicao).toBe("69277fd");
  });

  it("problemasCatalogoPublico não acusa nada quando o manifesto é real e público", () => {
    const problemas = problemasCatalogoPublico(CATALOGO, () => ({ publico: true, ficticio: false }));
    expect(problemas).toEqual([]);
  });

  it("problemasCatalogoPublico acusa manifesto.publico=false (F5-2)", () => {
    const problemas = problemasCatalogoPublico(CATALOGO, () => ({ publico: false, ficticio: false }));
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("manifesto.publico não é true");
  });

  it("problemasCatalogoPublico acusa manifesto.ficticio=true fora de teste_apenas", () => {
    const problemas = problemasCatalogoPublico(CATALOGO, () => ({ publico: true, ficticio: true }));
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("manifesto.ficticio não é false");
  });

  it("problemasCatalogoPublico acusa falha de leitura do manifesto", () => {
    const problemas = problemasCatalogoPublico(CATALOGO, () => {
      throw new Error("HTTP 404");
    });
    expect(problemas[0]).toContain("falha ao ler o manifesto");
  });
});
