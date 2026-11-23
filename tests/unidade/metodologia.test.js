// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { camadasPipeline, layoutCamadasEmColunas, parametrosDominio, linhasRastreio } from "../../src/js/dados/metodologia.js";
import { montarInternaHtml } from "../../src/js/metodologia.js";

const PIPELINE_LINEAR = {
  etapas: [
    { id: "a", nome: "A", commit: "0000000000000000000000000000000000000a", data: "2026-01-01" },
    { id: "b", nome: "B", commit: "0000000000000000000000000000000000000b", data: "2026-01-02" },
    { id: "c", nome: "C", commit: "0000000000000000000000000000000000000c", data: "2026-01-03" },
  ],
  ligacoes: [{ de: "a", para: "b" }, { de: "b", para: "c" }],
};

// DAG com ramo: d e e saem de a; f depende dos dois. f precisa ficar na
// camada seguinte à do ramo mais longo até ele (camadamento por caminho mais
// longo), não só "uma camada depois do pai mais próximo".
const PIPELINE_RAMO = {
  etapas: [
    { id: "a", nome: "A", commit: "x", data: "2026-01-01" },
    { id: "d", nome: "D", commit: "x", data: "2026-01-01" },
    { id: "e", nome: "E", commit: "x", data: "2026-01-01" },
    { id: "g", nome: "G", commit: "x", data: "2026-01-01" },
    { id: "f", nome: "F", commit: "x", data: "2026-01-01" },
  ],
  ligacoes: [
    { de: "a", para: "d" },
    { de: "d", para: "e" },
    { de: "e", para: "g" },
    { de: "a", para: "f" },
    { de: "g", para: "f" },
  ],
};

describe("dados/metodologia.js", () => {
  it("camadasPipeline põe uma etapa por camada numa cadeia linear", () => {
    const { nos, nCamadas } = camadasPipeline(PIPELINE_LINEAR);
    expect(nCamadas).toBe(3);
    expect(nos.map((n) => n.camada)).toEqual([0, 1, 2]);
  });

  it("camadasPipeline usa o caminho mais longo até cada etapa (ramo que se junta de novo)", () => {
    const { nos } = camadasPipeline(PIPELINE_RAMO);
    const camadaPorId = Object.fromEntries(nos.map((n) => [n.id, n.camada]));
    expect(camadaPorId.a).toBe(0);
    expect(camadaPorId.d).toBe(1);
    expect(camadaPorId.e).toBe(2);
    expect(camadaPorId.g).toBe(3);
    // f depende de a (camada 0) e de g (camada 3): fica depois do mais longo.
    expect(camadaPorId.f).toBe(4);
  });

  it("camadasPipeline resolve ligações por nome de saída (pipeline real do moradinha), não só por id", () => {
    const pipeline = {
      etapas: [
        { id: "e1", nome: "Coleta", commit: "x", data: "2026-01-01", saidas: ["coleta.tabela"] },
        { id: "e2", nome: "Grade", commit: "x", data: "2026-01-01", saidas: ["grade.tabela"] },
      ],
      ligacoes: [{ de: "coleta.tabela", para: "grade.tabela" }],
    };
    const { nos, arestas } = camadasPipeline(pipeline);
    const camadaPorId = Object.fromEntries(nos.map((n) => [n.id, n.camada]));
    expect(camadaPorId.e1).toBe(0);
    expect(camadaPorId.e2).toBe(1);
    expect(arestas).toEqual([{ de: "e1", para: "e2" }]);
  });

  it("camadasPipeline não trava quando duas etapas produzem a mesma saída (reprocessamento)", () => {
    const pipeline = {
      etapas: [
        { id: "e1", nome: "Coleta v1", commit: "x", data: "2026-01-01", saidas: ["coleta.tabela"] },
        { id: "e1b", nome: "Coleta v2", commit: "x", data: "2026-01-02", saidas: ["coleta.tabela"] },
        { id: "e2", nome: "Grade", commit: "x", data: "2026-01-01", saidas: ["grade.tabela"] },
      ],
      ligacoes: [{ de: "coleta.tabela", para: "grade.tabela" }],
    };
    const { nos } = camadasPipeline(pipeline);
    const camadaPorId = Object.fromEntries(nos.map((n) => [n.id, n.camada]));
    expect(camadaPorId.e2).toBe(1);
  });

  it("parametrosDominio lê os períodos do manifesto e traduz fonte_estoque", () => {
    const manifesto = {
      periodos: [
        { id: "2022", rotulo: "2022", tipo: "ano", fonte_estoque: "censo" },
        { id: "m2024", rotulo: "Média 2022–24", tipo: "media", fonte_estoque: "mista" },
      ],
    };
    const { periodos, limiares } = parametrosDominio(manifesto);
    expect(periodos[0]).toEqual({ id: "2022", rotulo: "2022", tipo: "ano", tipoRotulo: "Ano", fonteEstoque: "Censo 2022" });
    expect(periodos[1].tipoRotulo).toBe("Média de vários anos");
    expect(periodos[1].fonteEstoque).toBe("Média de anos com fontes de estoque diferentes");
    expect(limiares.cv_ap_ressalva.valor).toBe(30);
  });

  it("linhasRastreio traz edição, commit, contrato e a lista de arquivos com hash esperado", () => {
    const manifesto = {
      edicao: "c691276",
      commit_completo: "c691276e3743cfa5b5066614d467c2b41891cbee",
      data_execucao: "2026-11-22T00:00:00Z",
      contrato: "1.0",
      arquivos: { "manifesto.json": "abc", "hex.parquet": "def" },
    };
    const r = linhasRastreio(manifesto);
    expect(r.edicao).toBe("c691276");
    expect(r.contrato).toBe("1.0");
    expect(r.arquivos).toEqual([
      { nome: "manifesto.json", hashEsperado: "abc" },
      { nome: "hex.parquet", hashEsperado: "def" },
    ]);
  });
});

describe("F4-5 (seção interna): só aparece quando o pacote tem 'interno'", () => {
  it("sem 'interno' (caso real dos pacotes fictícios, públicos) mostra a mensagem de ausência", () => {
    const html = montarInternaHtml({ coabitacao: {}, onus: {}, precariedade: {} });
    expect(html).toContain("sem dados internos registrados");
    expect(html).toContain("desfecho interno, não publicado");
  });

  it("com 'interno' (pacote privado, sintético) mostra os valores e o aviso", () => {
    const html = montarInternaHtml({ coabitacao: { interno: { r2_ap_fora_dobra: 0.873 } }, onus: {}, precariedade: {} });
    expect(html).toContain("r2_ap_fora_dobra");
    expect(html).toContain("0,87");
    expect(html).toContain("desfecho interno, não publicado");
  });
});

describe("layoutCamadasEmColunas (F6.4 4a)", () => {
  it("22 tabelas sem ligação (Coleta) viram colunas curtas, nunca uma coluna de 22", () => {
    const etapas = Array.from({ length: 22 }, (_v, i) => ({ id: `t${i}`, nome: `T${i}`, commit: "x", data: "d" }));
    const { nos, nColunas, maiorColuna } = layoutCamadasEmColunas({ etapas, ligacoes: [] }, 6);
    expect(nos).toHaveLength(22);
    expect(maiorColuna).toBeLessThanOrEqual(6);
    expect(nColunas).toBeGreaterThanOrEqual(4);
    // nenhum par de nós na mesma célula
    expect(new Set(nos.map((n) => `${n.camada}:${n.posicao}`)).size).toBe(22);
  });

  it("respeita a ordem das ligações: o destino fica numa coluna à direita da origem", () => {
    const { nos } = layoutCamadasEmColunas(PIPELINE_RAMO, 6);
    const col = Object.fromEntries(nos.map((n) => [n.id, n.camada]));
    expect(col.a).toBeLessThan(col.d);
    expect(col.d).toBeLessThan(col.e);
    expect(col.e).toBeLessThan(col.g);
    expect(col.g).toBeLessThan(col.f);
  });

  it("camadas largas ocupam várias colunas e empurram as camadas seguintes para a direita", () => {
    const etapas = [
      ...Array.from({ length: 8 }, (_v, i) => ({ id: `r${i}`, nome: `R${i}`, commit: "x", data: "d" })),
      { id: "fim", nome: "Fim", commit: "x", data: "d" },
    ];
    const ligacoes = Array.from({ length: 8 }, (_v, i) => ({ de: `r${i}`, para: "fim" }));
    const { nos } = layoutCamadasEmColunas({ etapas, ligacoes }, 4);
    const maxRaiz = Math.max(...nos.filter((n) => n.id.startsWith("r")).map((n) => n.camada));
    expect(maxRaiz).toBe(1);
    expect(nos.find((n) => n.id === "fim").camada).toBe(2);
  });
});
