import { describe, expect, it } from "vitest";
import { chavesCitadas, chavesDoBib, citacoesOrfas } from "../../ferramentas/citacoes.mjs";

const BIB = `@misc{chave_ok,
  title = {Algo},
  year = {2024}
}

@article{outra_chave,
  title = {Outra coisa},
  year = {2023}
}
`;

describe("ferramentas/citacoes.mjs", () => {
  it("chavesCitadas extrai @chave de um texto com várias citações", () => {
    expect(chavesCitadas("Um fato [@chave_ok] e outro [@chave_ok; @outra_chave].")).toEqual(["chave_ok", "outra_chave"]);
  });

  it("chavesDoBib extrai as chaves definidas no .bib", () => {
    expect(chavesDoBib(BIB)).toEqual(["chave_ok", "outra_chave"]);
  });

  it("citacoesOrfas não acusa nada quando toda citação resolve", () => {
    const textos = [{ nome: "a.qmd", texto: "Texto com [@chave_ok]." }];
    expect(citacoesOrfas(textos, BIB)).toEqual([]);
  });

  it("citacoesOrfas acusa a chave que não existe no .bib", () => {
    const textos = [{ nome: "a.qmd", texto: "Texto com [@chave_inventada]." }];
    expect(citacoesOrfas(textos, BIB)).toEqual([{ arquivo: "a.qmd", chave: "chave_inventada" }]);
  });
});
