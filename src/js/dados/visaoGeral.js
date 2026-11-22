// Cálculos da Visão geral (SPEC_F2) — só o que a regra inviolável 1 permite:
// soma de componentes, relativo e os totais já no pacote.
import { totalDoMapa, domiciliosTotal, COMPONENTES_BASE } from "./calculo.js";
import { PRIORIDADE_MARCAS } from "../util/marcas.js";

export const NOME_COMPONENTE = { total: "total", coabitacao: "coabitação", onus: "ônus", precariedade: "precariedade" };
export const CLAB = { total: "Total", coabitacao: "Coabitação", onus: "Ônus", precariedade: "Precariedade" };

export function periodoRecenteAno(manifesto) {
  return [...manifesto.periodos].reverse().find((p) => p.tipo === "ano") ?? manifesto.periodos.at(-1);
}

export function periodoRecenteMedia(manifesto) {
  return [...manifesto.periodos].reverse().find((p) => p.tipo === "media") ?? null;
}

/** Componente (entre os 3 base) com o maior total absoluto no período. */
export function componenteMaior(totais, periodoId) {
  let maior = null;
  for (const c of COMPONENTES_BASE) {
    const t = totalDoMapa(totais, c, periodoId);
    if (t && (!maior || t.total > maior.total)) maior = { componente: c, total: t.total };
  }
  return maior?.componente ?? null;
}

/** "{componente} com {marca}", pela marca de maior prioridade presente no período. */
export function marcaMaisImportante(totais, periodoId) {
  for (const codigo of PRIORIDADE_MARCAS) {
    for (const c of COMPONENTES_BASE) {
      const t = totalDoMapa(totais, c, periodoId);
      if (t?.marcas?.includes(codigo)) {
        return { componente: c, codigo };
      }
    }
  }
  return null;
}

/** Dados dos cartões BI: total + 3 componentes, ano e média mais recentes, com série por ano. */
export function dadosCartoesBI(manifesto, totais) {
  const ano = periodoRecenteAno(manifesto);
  const media = periodoRecenteMedia(manifesto);
  const anosTipo = manifesto.periodos.filter((p) => p.tipo === "ano");
  const dom = domiciliosTotal(totais, ano.id);
  const domMedia = media ? domiciliosTotal(totais, media.id) : null;

  return ["total", ...COMPONENTES_BASE].map((componente) => {
    const tAno = totalDoMapa(totais, componente, ano.id);
    const tMedia = media ? totalDoMapa(totais, componente, media.id) : null;
    const serie = anosTipo.map((p) => totalDoMapa(totais, componente, p.id)?.total ?? null);
    return {
      componente,
      rotulo: CLAB[componente],
      absolutoAno: tAno?.total ?? null,
      relativoAno: tAno && dom ? (100 * tAno.total) / dom : null,
      absolutoMedia: tMedia?.total ?? null,
      relativoMedia: tMedia && domMedia ? (100 * tMedia.total) / domMedia : null,
      marcas: tAno?.marcas ?? [],
      serie,
      anos: anosTipo.map((p) => p.rotulo),
      periodoAno: ano.id,
      periodoMedia: media?.id ?? null,
    };
  });
}

/** Marcas do domínio, agrupadas por gravidade (warn/crit/info), sem repetição. */
export function marcasDoDominio(totais) {
  const vistas = new Map(); // codigo -> Set(componente)
  const registrar = (codigo, componente) => {
    if (!vistas.has(codigo)) vistas.set(codigo, new Set());
    vistas.get(codigo).add(componente);
  };
  for (const t of totais.totais) for (const m of t.marcas ?? []) registrar(m, t.componente);
  for (const mu of totais.mudancas ?? []) for (const m of mu.marcas ?? []) registrar(m, mu.componente);
  return [...vistas.entries()].map(([codigo, componentes]) => ({ codigo, componentes: [...componentes] }));
}

/**
 * Linhas de "números para citar": total + 3 componentes, ano e média mais
 * recentes, no formato exato de citação.
 */
export function linhasParaCitar(manifesto, totais) {
  const ano = periodoRecenteAno(manifesto);
  const media = periodoRecenteMedia(manifesto);
  const data = manifesto.data_execucao.slice(0, 10).split("-").reverse().join("/");
  const linhas = [];
  for (const periodo of [ano, media].filter(Boolean)) {
    for (const componente of ["total", ...COMPONENTES_BASE]) {
      const t = totalDoMapa(totais, componente, periodo.id);
      if (!t) continue;
      const rotulo = componente === "total" ? "Déficit total" : `Déficit de ${NOME_COMPONENTE[componente]}`;
      linhas.push({
        componente,
        periodo: periodo.id,
        periodoRotulo: periodo.rotulo,
        total: t.total,
        ep: t.ep,
        texto: `${rotulo}, ${manifesto.nome}, ${periodo.rotulo}: ${Math.round(t.total).toLocaleString("pt-BR")} domicílios (moradinha, edição ${manifesto.edicao}, ${data}).`,
      });
    }
  }
  return linhas;
}
