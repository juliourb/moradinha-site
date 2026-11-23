import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analisarYamlSimples } from "../../src/js/util/yamlSimples.js";

describe("analisarYamlSimples", () => {
  it("lê grupos_pipeline.yml de verdade (listas, mapas e {})", () => {
    const texto = readFileSync(join(process.cwd(), "textos", "metodologia", "grupos_pipeline.yml"), "utf8");
    const dados = analisarYamlSimples(texto);
    expect(dados.ordem).toEqual(["Coleta", "Grade", "Classificação", "Treino", "Montagem 2022", "Anos t", "Exportação"]);
    expect(dados.esquemas).toEqual({
      mor_coleta: "Coleta", mor_ref: "Grade", mor_classif: "Classificação",
      mor_modelo: "Treino", mor_alocacao: "Montagem 2022", mor_diag: "Anos t",
    });
    expect(dados.excecoes["coleta.parquet"]).toBe("Coleta");
    expect(dados.excecoes["exportacao.parquet"]).toBe("Exportação");
  });

  it("ignora linhas em branco e comentários", () => {
    const dados = analisarYamlSimples("# comentário\na: 1\n\nb:\n  - x\n  - y\n");
    expect(dados).toEqual({ a: "1", b: ["x", "y"] });
  });

  it("lança erro para construções fora do subconjunto suportado", () => {
    expect(() => analisarYamlSimples("a:\n  b:\n    c: 1\n")).toThrow();
  });
});
