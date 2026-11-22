// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { camadasPipeline, parametrosDominio, linhasRastreio } from "../../src/js/dados/metodologia.js";
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

  it("parametrosDominio lê os períodos do manifesto e traduz fonte_estoque", () => {
    const manifesto = {
      periodos: [
        { id: "2022", rotulo: "2022", tipo: "ano", fonte_estoque: "censo" },
        { id: "m2024", rotulo: "Média 2022–24", tipo: "media", fonte_estoque: "mista" },
      ],
    };
    const { periodos, limiares } = parametrosDominio(manifesto);
    expect(periodos[0]).toEqual({ id: "2022", rotulo: "2022", tipo: "ano", fonteEstoque: "censo" });
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
