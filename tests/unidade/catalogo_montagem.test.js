// S1-1: o catálogo é montado dos manifestos (ferramentas/catalogo_montagem.mjs).
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { montarCatalogo, instanteDaEdicao } from "../../ferramentas/catalogo_montagem.mjs";
import { separarTeste } from "../../ferramentas/gerar_enderecos.mjs";

const RAIZ = process.cwd();
const pac = (conjunto, edicao, data, nome = conjunto) => ({
  conjunto_id: conjunto, edicao, origem: `pacotes/${conjunto}/${edicao}`,
  manifesto: { conjunto_id: conjunto, nome, data_execucao: data },
});

describe("montarCatalogo", () => {
  it("a edição padrão é a mais recente pela data do manifesto", () => {
    const c = montarCatalogo([
      pac("d", "aaa", "2026-11-01T10:00:00Z"),
      pac("d", "bbb", "2026-11-20T10:00:00Z"),
      pac("d", "ccc", "2026-11-10T10:00:00Z"),
    ]);
    expect(c.dominios[0].edicoes.map((e) => e.edicao)).toEqual(["bbb", "ccc", "aaa"]);
    expect(c.dominios[0].edicoes.filter((e) => e.padrao).map((e) => e.edicao)).toEqual(["bbb"]);
  });

  it("edição teste_apenas nunca é a padrão se há uma real, mesmo mais recente", () => {
    const c = montarCatalogo(
      [pac("d", "real", "2026-11-01T00:00:00Z"), pac("d", "ficticio", "2026-12-01T00:00:00Z")],
      { teste_apenas: [{ conjunto_id: "d", edicao: "ficticio" }] },
    );
    const [real, fic] = c.dominios[0].edicoes;
    expect(real).toMatchObject({ edicao: "real", padrao: true });
    expect(fic).toMatchObject({ edicao: "ficticio", padrao: false, teste_apenas: true });
  });

  it("fora_do_catalogo tira a edição; teste_apenas sem edição marca o domínio", () => {
    const c = montarCatalogo(
      [pac("d", "velha", "2026-11-30T00:00:00Z"), pac("d", "nova", "2026-11-01T00:00:00Z"), pac("t", "ficticio", "2026-11-01T00:00:00Z")],
      { fora_do_catalogo: [{ conjunto_id: "d", edicao: "velha", motivo: "erro" }], teste_apenas: [{ conjunto_id: "t" }] },
    );
    expect(c.dominios.map((d) => d.conjunto_id)).toEqual(["d", "t"]);
    expect(c.dominios[0].edicoes.map((e) => e.edicao)).toEqual(["nova"]);
    expect(c.dominios[1]).toMatchObject({ teste_apenas: true });
    expect(c.dominios[1].edicoes[0].padrao).toBe(true);
  });

  it("o nome do domínio vem do manifesto da edição padrão", () => {
    const c = montarCatalogo([pac("d", "a", "2026-01-01T00:00:00Z", "Antigo"), pac("d", "b", "2026-02-01T00:00:00Z", "Novo")]);
    expect(c.dominios[0].nome).toBe("Novo");
  });

  it("manifesto sem data_execucao: erro claro (seria mudança de contrato)", () => {
    expect(() => montarCatalogo([{ ...pac("d", "a", undefined) }])).toThrow(/d\/a.*data_execucao/);
    expect(() => instanteDaEdicao({ data_execucao: "ontem" }, "x")).toThrow(/data_execucao/);
  });
});

describe("catálogo gerado com os pacotes atuais x catalogo.json de antes do S1", () => {
  // Lê os manifestos do disco (a validação V1–V12 é do CLI) e as exceções versionadas.
  const excecoes = JSON.parse(readFileSync(join(RAIZ, "pacotes", "excecoes.json"), "utf8"));
  const pacotes = [];
  for (const conjunto of readdirSync(join(RAIZ, "pacotes"), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const edicao of readdirSync(join(RAIZ, "pacotes", conjunto.name), { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const origem = `pacotes/${conjunto.name}/${edicao.name}`;
      pacotes.push({ conjunto_id: conjunto.name, edicao: edicao.name, origem, manifesto: JSON.parse(readFileSync(join(RAIZ, origem, "manifesto.json"), "utf8")) });
    }
  }
  const gerado = montarCatalogo(pacotes, excecoes);
  const antes = JSON.parse(readFileSync(join(RAIZ, "tests", "unidade", "fixtures", "catalogo_antes_s1.json"), "utf8"));

  it("mesmos domínios, edições e padrão (o nome passa a ser o do manifesto da edição padrão)", () => {
    const semNome = (d) => { const { nome, ...resto } = d; return resto; };
    for (const d of antes.dominios) {
      const novo = gerado.dominios.find((x) => x.conjunto_id === d.conjunto_id);
      expect(novo, d.conjunto_id).toBeDefined();
      expect(semNome(novo)).toEqual(semNome(d));
    }
  });

  it("os domínios novos são só os de teste (o catalogo.json não é versionado: é gerado no build)", () => {
    const novos = gerado.dominios.filter((d) => !antes.dominios.some((a) => a.conjunto_id === d.conjunto_id));
    expect(novos.every((d) => d.teste_apenas)).toBe(true);
  });
});

describe("E58: separarTeste (catálogo do build público)", () => {
  const cat = {
    dominios: [
      { conjunto_id: "a", nome: "A", edicoes: [{ edicao: "r", origem: "pacotes/a/r", padrao: true }, { edicao: "f", origem: "pacotes/a/f", padrao: false, teste_apenas: true }] },
      { conjunto_id: "t", nome: "T", teste_apenas: true, edicoes: [{ edicao: "f", origem: "pacotes/t/f", padrao: true }] },
    ],
  };
  it("tira domínio e edição de teste e lista o que apagar do build", () => {
    const { publico, remover } = separarTeste(cat);
    expect(publico.dominios.map((d) => d.conjunto_id)).toEqual(["a"]);
    expect(publico.dominios[0].edicoes.map((e) => e.edicao)).toEqual(["r"]);
    expect(remover.sort()).toEqual(["pacotes/a/f", "pacotes/t"]);
  });
});
