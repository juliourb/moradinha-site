// Cálculos da Visão geral (SPEC_F2) — só o que a regra inviolável 1 permite:
// soma de componentes, relativo e os totais já no pacote.
import { totalDoMapa, domiciliosTotal, brutoHex, mudanca, COMPONENTES_BASE } from "./calculo.js";
import { PRIORIDADE_MARCAS } from "../util/marcas.js";
import { taxaDominio } from "./escalaCor.js";
import { formatar } from "../util/formato.js";

/** Parte do CadÚnico de um indicador do referencia_fjp.json (SPEC_F6 N8/N9). */
export function parteCadUnico(item, todosItens) {
  const origem = item.indicador === "total" ? todosItens.find((i) => i.indicador === "habitacao_precaria") : item;
  const sub = origem?.fjp_subcomponentes?.find((s) => s.nome === "improvisados");
  return sub?.valor ?? 0;
}

/** Faixa de 95% da reconstrução, com a ponta de baixo cortada em 0 só na exibição (N7). */
export function faixaReconstrucao(reconstrucaoPnadc, reconstrucaoEp) {
  if (reconstrucaoPnadc == null || reconstrucaoEp == null) return null;
  return {
    inf: Math.max(0, reconstrucaoPnadc - 1.96 * reconstrucaoEp),
    sup: reconstrucaoPnadc + 1.96 * reconstrucaoEp,
  };
}

/**
 * Os três valores da comparação com a FJP (N8/N9): publicado, parte do CadÚnico e
 * sem CadÚnico. "Dentro/fora da faixa" compara o valor sem CadÚnico com a faixa de
 * 95% da reconstrução.
 */
export function fjpTresValores(referenciaFjp) {
  return referenciaFjp.map((item) => {
    const cadUnico = parteCadUnico(item, referenciaFjp);
    const semCadUnico = item.fjp_publicado == null ? null : item.fjp_publicado - cadUnico;
    const faixa = faixaReconstrucao(item.reconstrucao_pnadc, item.reconstrucao_ep);
    const dentro = semCadUnico != null && faixa != null ? semCadUnico >= faixa.inf && semCadUnico <= faixa.sup : null;
    return { ...item, cadUnico, semCadUnico, faixa, dentro };
  });
}

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

/**
 * Curva de concentração (SPEC_F6 B6): hexágonos com 1+ domicílio, do maior
 * para o menor déficit absoluto; % dos hexágonos (eixo x) vs. % do déficit
 * acumulado (eixo y). Também marca onde a curva chega à metade do déficit.
 */
export function curvaConcentracao(linhasArr, componente, periodo) {
  const valores = [];
  for (const l of linhasArr) {
    const dom = l.dom[periodo];
    if (dom == null || dom < 1) continue;
    const v = brutoHex(l, componente, periodo);
    if (v == null) continue;
    valores.push(v);
  }
  valores.sort((a, b) => b - a);
  const n = valores.length;
  const totalDeficit = valores.reduce((s, v) => s + v, 0);
  const pontos = [];
  let acumulado = 0;
  for (let i = 0; i < n; i++) {
    acumulado += valores[i];
    pontos.push({ pctHex: (100 * (i + 1)) / n, pctDeficitAcumulado: totalDeficit > 0 ? (100 * acumulado) / totalDeficit : 0 });
  }
  const idxMeio = pontos.findIndex((p) => p.pctDeficitAcumulado >= 50);
  const nHexMeio = idxMeio === -1 ? n : idxMeio + 1;
  const pctHexMeio = idxMeio === -1 ? 100 : pontos[idxMeio].pctHex;
  return { pontos, n, nHexMeio, pctHexMeio };
}

/** Maior valor relativo (%) entre hexágonos com 1+ domicílio, no componente/período. */
export function maiorRelativo(linhasArr, componente, periodo) {
  let melhor = null;
  for (const l of linhasArr) {
    const dom = l.dom[periodo];
    if (dom == null || dom < 1) continue;
    const v = brutoHex(l, componente, periodo);
    if (v == null) continue;
    const relativo = (100 * v) / dom;
    if (melhor == null || relativo > melhor) melhor = relativo;
  }
  return melhor;
}

/** Frase da ressalva do relativo (SPEC_F6, Visão geral), gerada do pacote. */
export function fraseRessalvaRelativo(linhasArr, totais, componente, periodo) {
  const conc = curvaConcentracao(linhasArr, componente, periodo);
  const maiorRel = maiorRelativo(linhasArr, componente, periodo);
  const taxa = taxaDominio(totais, componente, periodo);
  const vezes = taxa && maiorRel != null ? maiorRel / taxa : null;
  const frase1 = `${formatar(conc.nHexMeio, 0)} hexágonos (${formatar(conc.pctHexMeio, 0)}% dos que têm domicílio) somam metade do déficit absoluto.`;
  if (vezes == null) return frase1;
  const frase2 =
    vezes >= 2
      ? `No relativo, o maior hexágono tem ${formatar(vezes, 1)} vezes a taxa do domínio.`
      : `No relativo, o maior hexágono tem ${formatar(vezes, 1)} vezes a taxa do domínio: a concentração do mapa absoluto acompanha, em boa parte, onde estão os domicílios.`;
  return `${frase1} ${frase2}`;
}

/** Pares de anos consecutivos (manifesto.periodos, tipo "ano") cuja mudança passa de 1,96 EP. */
export function mudancasAnuaisForaDoRuido(manifesto, totais) {
  const anos = manifesto.periodos.filter((p) => p.tipo === "ano");
  const resultado = [];
  for (let i = 0; i < anos.length - 1; i++) {
    for (const componente of ["total", ...COMPONENTES_BASE]) {
      const m = mudanca(totais, componente, anos[i].id, anos[i + 1].id);
      if (m?.z != null && m.z > 1.96) {
        resultado.push({ componente, de: anos[i], para: anos[i + 1], z: m.z });
      }
    }
  }
  return resultado;
}

/** Frase do pop-up "Detalhes" (B3) sobre mudanças anuais fora do ruído da amostra. */
export function fraseRuidoAnual(manifesto, totais) {
  const passam = mudancasAnuaisForaDoRuido(manifesto, totais);
  if (!passam.length) return "Nenhuma mudança de um ano para o outro passa do ruído da amostra.";
  const nomes = passam.map((p) => `${NOME_COMPONENTE[p.componente]} de ${p.de.rotulo} para ${p.para.rotulo}`);
  return `Passa(m) do ruído da amostra: ${nomes.join("; ")}.`;
}
