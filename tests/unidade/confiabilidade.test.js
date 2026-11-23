// @vitest-environment jsdom
// Precisa de DOM: montarModeloHtml/renderizarCurvas leem cores do design
// system via getComputedStyle(document.documentElement) (assets/css/tokens.css).
import { describe, expect, it } from "vitest";
import { blocoModelo, achadosPublicos, limiteEixoP99, BLOCOS_MODELO } from "../../src/js/dados/confiabilidade.js";
import { montarModeloHtml, renderizarCurvas, formatarImportancia } from "../../src/js/confiabilidade.js";

const MODELO_BASE = {
  configuracao: "e3", usado: true, motivo: "",
  treino: { n_domicilios: 100, peso_total: 1, n_aps: 10, dobras: 5, motor: "EBM", versao: "e3", semente: 1 },
  ganho: { erro_modelo: 1, erro_base: 2, razao: 0.58, ic: [0.49, 0.67] },
  ordem: { spearman_modelo: 0.83, spearman_base: 0.55, top20_modelo: 0.61, top20_base: 0.2, ic_spearman: [0.74, 0.89] },
  calibracao: { decis: [], inclinacao: 0.91, intercepto: 0.002, ic_inclinacao: [0.84, 0.98] },
  vies: [{ grupo_tipo: "tipo de AP", grupo: "capital", razao_somas: 1.02 }],
  curvas: [{ variavel: "renda", rotulo: "Renda", nivel: "baixa", escore: 0.4, desvio: 0.05 }],
  importancia: [{ variavel: "renda", rotulo: "Renda", valor: 0.3 }],
  confianca: { dobras: [], moran_residuos: { I: 0.04, p: 0.21 }, cobertura_d: { modelo: 0.91, base: 0.8 } },
};

describe("dados/confiabilidade.js", () => {
  it("blocoModelo nunca inclui 'interno' (regra inviolável 5)", () => {
    const modeloComInterno = {
      configuracao: "e3", usado: true, motivo: "",
      treino: {}, ganho: {}, ordem: {}, calibracao: {}, vies: [], curvas: [], importancia: [], confianca: {},
      interno: { r2_ap: 0.87, nota: "R² por AP: 0.87" },
    };
    const bloco = blocoModelo(modeloComInterno);
    expect(bloco).not.toHaveProperty("interno");
    expect(JSON.stringify(bloco)).not.toMatch(/interno|r2_ap|0\.87/);
  });

  it("blocoModelo mantém todos os campos públicos", () => {
    const modelo = {
      configuracao: "e3", usado: false, motivo: "não superou a linha de base",
      treino: { n_domicilios: 100 }, ganho: { razao: 0.58 }, ordem: {}, calibracao: {},
      vies: [], curvas: [], importancia: [], confianca: {},
    };
    expect(blocoModelo(modelo)).toEqual(modelo);
  });

  it("achadosPublicos só inclui publico=true, agrupado por situação", () => {
    const achados = [
      { id: "E1", situacao: "registrado", publico: true },
      { id: "E2", situacao: "registrado", publico: false },
      { id: "E3", situacao: "em análise", publico: true },
    ];
    const grupos = achadosPublicos(achados);
    expect(grupos).toHaveLength(2);
    expect(grupos.find((g) => g.situacao === "registrado").itens).toEqual([achados[0]]);
    expect(grupos.find((g) => g.situacao === "em análise").itens).toEqual([achados[2]]);
  });

  it("limiteEixoP99 não deixa um extremo dominar o eixo", () => {
    const valores = [...Array(99).fill(1), 700]; // igual ao caso real do razao_hex ilegível
    expect(limiteEixoP99(valores)).toBeLessThan(10);
  });
});

describe("F3-2: 'interno' nunca aparece no HTML montado", () => {
  it("montarModeloHtml não vaza interno mesmo com dados reais de R² por AP", () => {
    const modeloComInterno = { ...MODELO_BASE, interno: { r2_ap: 0.87321, nota_interna: "não mostrar" } };
    const html = montarModeloHtml(modeloComInterno);
    expect(html).not.toMatch(/interno|r2_ap|0[.,]87321|nota_interna|R²/i);
  });
});

describe("F3-3: cada bloco tem título-pergunta e 'o que significa'", () => {
  it("montarModeloHtml inclui todos os títulos e textos de significado da SPEC", () => {
    const html = montarModeloHtml(MODELO_BASE);
    for (const bloco of BLOCOS_MODELO) {
      expect(html).toContain(bloco.titulo);
      expect(html).toContain(bloco.significado.slice(0, 30));
    }
  });
});

describe("F3-4: componente com usado=false mostra só a mensagem própria", () => {
  it("não mostra nenhum bloco de pergunta nem curvas", () => {
    const html = montarModeloHtml({ ...MODELO_BASE, usado: false, motivo: "Não superou a linha de base." });
    expect(html).toContain("Não superou a linha de base.");
    for (const bloco of BLOCOS_MODELO) expect(html).not.toContain(bloco.titulo);
    expect(html).not.toContain("<svg");
  });
});

describe("F3-5 (curvas): desvio nulo mostra a nota, sem inventar faixa", () => {
  it("curva com desvio null não desenha faixa e mostra a nota fixa", () => {
    const html = renderizarCurvas([{ variavel: "x", rotulo: "X", nivel: "n", escore: 0.5, desvio: null }], []);
    expect(html).toContain("faixa de oscilação não calculada nesta edição");
  });

  it("curva com desvio numérico desenha a faixa e não mostra a nota", () => {
    const html = renderizarCurvas([{ variavel: "x", rotulo: "X", nivel: "n", escore: 0.5, desvio: 0.1 }], []);
    expect(html).not.toContain("faixa de oscilação não calculada nesta edição");
    expect(html).toContain("<svg");
  });
});

describe("N14: importância em % da soma, sem arredondar para 0,00", () => {
  it("valores pequenos não somem em 0,00 e abaixo de 0,1% mostram '< 0,1%'", () => {
    expect(formatarImportancia(0.0001, 1)).toBe("< 0,1%");
    expect(formatarImportancia(0.5, 1)).toBe("50,0%");
  });

  it("renderizarCurvas mostra a importância como percentual, não o valor cru", () => {
    const html = renderizarCurvas(
      [{ variavel: "x", rotulo: "X", nivel: "n", escore: 0.5, desvio: 0.1 }],
      [
        { variavel: "a", rotulo: "A", valor: 0.03464566672669605 },
        { variavel: "b", rotulo: "B", valor: 0.00001 },
      ]
    );
    expect(html).not.toContain("(0,00)");
    expect(html).toContain("< 0,1%");
  });
});

import { posicaoSpearman, periodoMenosParecido, fraseAnoMenosParecido, spearmanContraBase } from "../../src/js/dados/confiabilidade.js";

describe("Spearman (F6.4 3b)", () => {
  const manifesto = {
    periodos: [
      { id: "2022", rotulo: "2022", tipo: "ano", marcas: [] },
      { id: "2023", rotulo: "2023", tipo: "ano", marcas: ["fonte_estoque_diferente"] },
      { id: "2024", rotulo: "2024", tipo: "ano", marcas: [] },
      { id: "m2024", rotulo: "Média 2022–24", tipo: "media", marcas: [] },
    ],
  };
  const spearman = {
    coabitacao: {
      periodos: ["2022", "2023", "2024", "m2024"],
      matriz: [[1, 0.86, 0.97, 0.9], [0.86, 1, 0.86, 0.95], [0.97, 0.86, 1, 0.9], [0.9, 0.95, 0.9, 1]],
    },
  };

  it("escala fixa de 0,8 a 1,0, com clamp", () => {
    expect(posicaoSpearman(0.8)).toBe(0);
    expect(posicaoSpearman(0.9)).toBeCloseTo(0.5);
    expect(posicaoSpearman(1)).toBe(1);
    expect(posicaoSpearman(0.5)).toBe(0);
    expect(posicaoSpearman(null)).toBeNull();
  });

  it("acha o ano que menos se parece com os outros (só anos, não médias)", () => {
    const r = periodoMenosParecido(spearman, manifesto);
    expect(r.periodo.id).toBe("2023");
    expect(r.fonteDiferente).toBe(true);
  });

  it("frase gerada do pacote; sem a causa quando o estoque não vem de outra fonte", () => {
    expect(fraseAnoMenosParecido(spearman, manifesto)).toBe(
      "2023 é o ano que menos se parece com os outros: a ordem dos hexágonos muda porque o estoque vem de outra fonte."
    );
    const semMarca = { periodos: manifesto.periodos.map((p) => ({ ...p, marcas: [] })) };
    expect(fraseAnoMenosParecido(spearman, semMarca)).toBe("2023 é o ano que menos se parece com os outros: a ordem dos hexágonos muda.");
  });

  it("Spearman de cada ano contra o primeiro ano", () => {
    const [serie] = spearmanContraBase(spearman, manifesto);
    expect(serie.base.id).toBe("2022");
    expect(serie.pontos.map((p) => [p.periodo.id, p.valor])).toEqual([["2023", 0.86], ["2024", 0.97]]);
  });
});
