import { describe, expect, it } from "vitest";
import {
  periodoRecenteAno, periodoRecenteMedia, componenteMaior, marcaMaisImportante,
  dadosCartoesBI, marcasDoDominio, linhasParaCitar, fjpTresValores,
} from "../../src/js/dados/visaoGeral.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REFERENCIA_FJP_BD10CBD = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../pacotes/al_rm_maceio/bd10cbd/referencia_fjp.json", import.meta.url)))
);

const MANIFESTO = {
  nome: "RM de Maceió",
  edicao: "c691276",
  data_execucao: "2026-11-22T00:00:00Z",
  periodos: [
    { id: "2022", rotulo: "2022", tipo: "ano" },
    { id: "2023", rotulo: "2023", tipo: "ano" },
    { id: "2025", rotulo: "2025", tipo: "ano" },
    { id: "m2025", rotulo: "Média 2023–25", tipo: "media" },
  ],
};

const TOTAIS = {
  totais: [
    { componente: "coabitacao", periodo: "2025", regime: "c", total: 7707.19, ep: 1497.0, marcas: ["mudanca_no_ruido"], no_mapa: true },
    { componente: "onus", periodo: "2025", regime: "c", total: 35356.44, ep: 3073.5, marcas: ["total_fragil"], no_mapa: true },
    { componente: "precariedade", periodo: "2025", regime: "provisoria", total: 5573.96, ep: null, marcas: ["precariedade_provisoria_sem_faixa"], no_mapa: true },
    { componente: "coabitacao", periodo: "m2025", regime: "c", total: 7114.81, ep: 852.2, marcas: [], no_mapa: true },
    { componente: "onus", periodo: "m2025", regime: "c", total: 33209.44, ep: 2013.7, marcas: [], no_mapa: true },
    { componente: "precariedade", periodo: "m2025", regime: "provisoria", total: 5450.38, ep: null, marcas: [], no_mapa: true },
    { componente: "coabitacao", periodo: "2022", regime: "c", total: 8391.73, ep: 1593.9, marcas: [], no_mapa: true },
    { componente: "onus", periodo: "2022", regime: "c", total: 27770.24, ep: 3258.2, marcas: [], no_mapa: true },
    { componente: "precariedade", periodo: "2022", regime: "amostra", total: 5081.73, ep: 263.3, marcas: [], no_mapa: true },
  ],
  domicilios: [
    { periodo: "2022", total: 427204.0 },
    { periodo: "2025", total: 466575.0 },
    { periodo: "m2025", total: 452612.7 },
  ],
  mudancas: [],
};

describe("dados/visaoGeral.js", () => {
  it("periodoRecenteAno/Media pegam o último de cada tipo", () => {
    expect(periodoRecenteAno(MANIFESTO).id).toBe("2025");
    expect(periodoRecenteMedia(MANIFESTO).id).toBe("m2025");
  });

  it("componenteMaior identifica o componente com maior total", () => {
    expect(componenteMaior(TOTAIS, "2025")).toBe("onus");
  });

  it("marcaMaisImportante segue a ordem de prioridade", () => {
    // total_fragil (onus) tem prioridade sobre mudanca_no_ruido (coabitacao)
    const m = marcaMaisImportante(TOTAIS, "2025");
    expect(m).toEqual({ componente: "onus", codigo: "total_fragil" });
  });

  it("dadosCartoesBI monta total+3 componentes com série e relativo", () => {
    const cartoes = dadosCartoesBI(MANIFESTO, TOTAIS);
    expect(cartoes.map((c) => c.componente)).toEqual(["total", "coabitacao", "onus", "precariedade"]);
    const onus = cartoes.find((c) => c.componente === "onus");
    expect(onus.absolutoAno).toBe(35356.44);
    expect(onus.relativoAno).toBeCloseTo((100 * 35356.44) / 466575.0);
    expect(onus.serie).toEqual([27770.24, null, 35356.44]); // 2023 sem total "onus" no fixture -> null
  });

  it("marcasDoDominio agrupa por código sem repetir", () => {
    const marcas = marcasDoDominio(TOTAIS);
    const codigos = marcas.map((m) => m.codigo).sort();
    expect(codigos).toEqual(["mudanca_no_ruido", "precariedade_provisoria_sem_faixa", "total_fragil"].sort());
  });

  it("fjpTresValores: publicado / CadÚnico / sem CadÚnico (F6.1-2, pacote bd10cbd)", () => {
    const itens = fjpTresValores(REFERENCIA_FJP_BD10CBD);
    const porIndicador = Object.fromEntries(itens.map((i) => [i.indicador, i]));
    expect([porIndicador.total.fjp_publicado, porIndicador.total.cadUnico, porIndicador.total.semCadUnico]).toEqual([50099, 5812, 44287]);
    expect([porIndicador.habitacao_precaria.fjp_publicado, porIndicador.habitacao_precaria.cadUnico, porIndicador.habitacao_precaria.semCadUnico]).toEqual([11936, 5812, 6124]);
    expect([porIndicador.domicilios.fjp_publicado, porIndicador.domicilios.cadUnico, porIndicador.domicilios.semCadUnico]).toEqual([462956, 5812, 457144]);
    expect([porIndicador.coabitacao.fjp_publicado, porIndicador.coabitacao.cadUnico, porIndicador.coabitacao.semCadUnico]).toEqual([5666, 0, 5666]);
    expect([porIndicador.onus.fjp_publicado, porIndicador.onus.cadUnico, porIndicador.onus.semCadUnico]).toEqual([32498, 0, 32498]);
    for (const item of itens) expect(item.ano_ref).toBe(2023);
    for (const item of itens) expect(item.faixa == null || item.faixa.inf >= 0).toBe(true);
  });

  it("linhasParaCitar usa o formato exato de citação", () => {
    const linhas = linhasParaCitar(MANIFESTO, TOTAIS);
    const total2025 = linhas.find((l) => l.componente === "total" && l.periodo === "2025");
    expect(total2025.texto).toBe(
      "Déficit total, RM de Maceió, 2025: 48.638 domicílios (moradinha, edição c691276, 22/11/2026)."
    );
  });
});
