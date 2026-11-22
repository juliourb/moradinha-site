// SPEC_F6 B4/N18: agrupamento das 54 etapas do pipeline real nas 7 etapas do
// método. Usa o pacote real (bd10cbd) e o grupos_pipeline.yml de verdade.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analisarYamlSimples } from "../../src/js/util/yamlSimples.js";
import { agruparPipeline, arestasEntreGrupos, pipelineDoGrupo, ID_NO_EXPORTACAO } from "../../src/js/dados/metodologia.js";

const PASTA = join(process.cwd(), "pacotes", "al_rm_maceio", "bd10cbd");
const pipeline = JSON.parse(readFileSync(join(PASTA, "pipeline.json"), "utf8"));
const manifesto = JSON.parse(readFileSync(join(PASTA, "manifesto.json"), "utf8"));
const config = analisarYamlSimples(readFileSync(join(process.cwd(), "textos", "metodologia", "grupos_pipeline.yml"), "utf8"));

describe("F6.1-14: agruparPipeline (pacote real bd10cbd)", () => {
  it("forma os 7 grupos, na ordem do método, sem perder nenhuma das 54 etapas", () => {
    const { grupos, tabelasSemGrupo } = agruparPipeline(pipeline, manifesto, config);
    expect(grupos.map((g) => g.nome)).toEqual(["Coleta", "Grade", "Classificação", "Treino", "Montagem 2022", "Anos t", "Exportação"]);
    const totalEtapasReais = grupos.reduce((s, g) => s + g.etapas.filter((e) => e.id !== ID_NO_EXPORTACAO).length, 0);
    expect(totalEtapasReais).toBe(54);
    expect(tabelasSemGrupo).toEqual([]);
  });

  it("o grupo Exportação tem o nó sintético do pacote", () => {
    const { grupos } = agruparPipeline(pipeline, manifesto, config);
    const exportacao = grupos.find((g) => g.nome === "Exportação");
    expect(exportacao.etapas).toHaveLength(1);
    expect(exportacao.etapas[0].id).toBe(ID_NO_EXPORTACAO);
    expect(exportacao.etapas[0].nome).toContain(manifesto.edicao);
  });

  it("cada etapa cai no grupo certo pelo esquema da sua saída", () => {
    const { grupos } = agruparPipeline(pipeline, manifesto, config);
    const coleta = grupos.find((g) => g.nome === "Coleta");
    expect(coleta.etapas.every((e) => (e.saidas?.[0] ?? "").startsWith("mor_coleta."))).toBe(true);
    const treino = grupos.find((g) => g.nome === "Treino");
    expect(treino.etapas.every((e) => (e.saidas?.[0] ?? "").startsWith("mor_modelo."))).toBe(true);
  });
});

describe("arestasEntreGrupos / pipelineDoGrupo", () => {
  it("gera arestas entre grupos sem autolaço, e toda etapa real alimenta a Exportação", () => {
    const { grupos, grupoPorEtapaId } = agruparPipeline(pipeline, manifesto, config);
    const arestas = arestasEntreGrupos(pipeline, grupoPorEtapaId);
    expect(arestas.every((a) => a.de !== a.para)).toBe(true);
    const gruposComEtapasReais = grupos.filter((g) => g.nome !== "Exportação").map((g) => g.nome);
    for (const g of gruposComEtapasReais) {
      expect(arestas).toContainEqual({ de: g, para: "Exportação" });
    }
  });

  it("pipelineDoGrupo só traz ligações internas ao grupo", () => {
    const { grupos } = agruparPipeline(pipeline, manifesto, config);
    const alocacao = grupos.find((g) => g.nome === "Montagem 2022");
    const sub = pipelineDoGrupo(pipeline, alocacao);
    const ids = new Set(alocacao.etapas.map((e) => e.id));
    for (const l of sub.ligacoes) {
      for (const id of [l.de, l.para]) {
        expect(ids.has(id) || alocacao.etapas.some((e) => e.saidas?.includes(id))).toBe(true);
      }
    }
    expect(sub.ligacoes.length).toBeGreaterThan(0);
  });
});
