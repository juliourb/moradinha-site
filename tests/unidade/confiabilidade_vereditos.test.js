// SPEC_F6 B1: painel de vereditos da Confiabilidade. Usa o pacote real
// (bd10cbd) para conferir os vereditos esperados em Maceió (F6.1-11, F6.1-13).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  veredictoPergunta1, veredictoPergunta2, veredictoPergunta3, veredictoPergunta4, matrizOqueFalta, rotuloUso,
} from "../../src/js/dados/confiabilidade.js";

const PASTA = join(process.cwd(), "pacotes", "al_rm_maceio", "bd10cbd");
function lerJSON(nome) {
  return JSON.parse(readFileSync(join(PASTA, nome), "utf8"));
}
const manifesto = lerJSON("manifesto.json");
const totais = lerJSON("totais.json");
const qualidade = lerJSON("qualidade.json");
const modelo = lerJSON("modelo.json");
const referenciaFjp = lerJSON("referencia_fjp.json");

describe("F6.1-11: vereditos esperados em Maceió", () => {
  it("pergunta 2: coabitação 'sim' (58%), ônus 'sim' (56%), precariedade 'não' (99%)", () => {
    const coab = veredictoPergunta2(modelo.coabitacao);
    const onus = veredictoPergunta2(modelo.onus);
    const prec = veredictoPergunta2(modelo.precariedade);
    expect(coab.veredicto).toBe("sim");
    expect(Math.round(coab.numero)).toBe(58);
    expect(onus.veredicto).toBe("sim");
    expect(Math.round(onus.numero)).toBe(56);
    expect(prec.veredicto).toBe("não");
    expect(Math.round(prec.numero)).toBe(99);
  });

  it("pergunta 3: 'em parte' nos três componentes", () => {
    for (const c of ["coabitacao", "onus", "precariedade"]) {
      expect(veredictoPergunta3(manifesto, totais, c).veredicto).toBe("em parte");
    }
  });

  it("clicar numa célula / navegar: vereditos têm número sempre que há dado", () => {
    for (const c of ["coabitacao", "onus", "precariedade"]) {
      expect(veredictoPergunta1(qualidade, referenciaFjp, c).numero).not.toBeNull();
    }
  });
});

describe("F6.1-13: viés destaca Marechal Deodoro, Satuba e Rio Largo (coabitação)", () => {
  it("razao_somas fora de 0,90–1,10 para esses três municípios", () => {
    const viesMunicipio = modelo.coabitacao.vies.filter((v) => v.grupo_tipo === "município");
    const foraDaFaixa = viesMunicipio.filter((v) => v.razao_somas < 0.9 || v.razao_somas > 1.1).map((v) => v.grupo);
    expect(foraDaFaixa.sort()).toEqual(["Marechal Deodoro", "Rio Largo", "Satuba"].sort());
  });
});

describe("N12: matriz 'o que falta'", () => {
  it("rotuloUso traduz 'do ano' e mantém os demais legíveis", () => {
    expect(rotuloUso("do ano")).toBe("do próprio ano");
    expect(rotuloUso("congelada em 2022")).toBe("congelada em 2022");
    expect(rotuloUso(null)).toBe("sem dado");
  });

  it("matrizOqueFalta tem uma linha por variável e uma célula por período", () => {
    const matriz = matrizOqueFalta(qualidade, manifesto);
    expect(matriz.length).toBe(qualidade.fontes.length);
    for (const linha of matriz) expect(linha.celulas.length).toBe(manifesto.periodos.length);
    const estoque = matriz.find((l) => l.variavel === "estoque");
    expect(estoque.celulas.every((c) => c.uso === "do próprio ano")).toBe(true);
  });
});

describe("veredictoPergunta4", () => {
  it("conta achados públicos sem veredito", () => {
    const achados = lerJSON("achados.json");
    const r = veredictoPergunta4(achados);
    expect(r.veredicto).toBeNull();
    expect(r.numero).toBeGreaterThanOrEqual(0);
  });
});
