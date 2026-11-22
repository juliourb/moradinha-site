// Cálculos permitidos pela regra inviolável 1 (SPEC_00 §8): soma de
// componentes, divisão por domicílios, diferença/z entre períodos e as
// medidas derivadas de qualidade (SPEC_F1 §8). Nenhum outro número.
export const COMPONENTES_BASE = ["coabitacao", "onus", "precariedade"];

function linhaNoMapa(totais, componente, periodo) {
  return totais.totais.find((t) => t.componente === componente && t.periodo === periodo && t.no_mapa === true);
}

/** Valor absoluto do hexágono (soma dos componentes quando "total"). */
export function brutoHex(linha, componente, periodo) {
  if (componente === "total") {
    let soma = 0;
    for (const c of COMPONENTES_BASE) {
      const v = linha.hex[periodo]?.[c]?.absoluto;
      if (v == null) return null;
      soma += v;
    }
    return soma;
  }
  return linha.hex[periodo]?.[componente]?.absoluto ?? null;
}

/** Valor do hexágono na medida escolhida (absoluto ou relativo aos domicílios). */
export function valorHex(linha, componente, periodo, medida) {
  const v = brutoHex(linha, componente, periodo);
  if (v == null) return null;
  if (medida === "relativo") {
    const d = linha.dom[periodo];
    return d != null && d > 0.5 ? (100 * v) / d : null;
  }
  return v;
}

/** Faixa [mínimo, máximo] do componente no hexágono; nula para "total" (regra 2). */
export function faixaHex(linha, componente, periodo) {
  if (componente === "total") return null;
  const r = linha.hex[periodo]?.[componente];
  if (!r || r.minimo == null || r.maximo == null) return null;
  return [r.minimo, r.maximo];
}

/** Incerteza = (máximo − mínimo) ÷ absoluto (SPEC_F1 §8); nula para "total". */
export function incertezaHex(linha, componente, periodo) {
  if (componente === "total") return null;
  const r = linha.hex[periodo]?.[componente];
  if (!r || r.absoluto == null || r.minimo == null || r.maximo == null || r.absoluto === 0) return null;
  return (r.maximo - r.minimo) / r.absoluto;
}

/** Marcas do hexágono para o componente/período escolhido (união dos 3, se "total"). */
export function marcasHex(linha, componente, periodo) {
  if (componente === "total") {
    const s = new Set();
    for (const c of COMPONENTES_BASE) for (const m of linha.hex[periodo]?.[c]?.marcas ?? []) s.add(m);
    return [...s];
  }
  return linha.hex[periodo]?.[componente]?.marcas ?? [];
}

/** Total do domínio (linha no_mapa de totais.json), com ep combinado quando "total". */
export function totalDoMapa(totais, componente, periodo) {
  if (componente === "total") {
    let soma = 0;
    let epQuad = 0;
    let semEp = false;
    const marcas = new Set();
    for (const c of COMPONENTES_BASE) {
      const linha = linhaNoMapa(totais, c, periodo);
      if (!linha) return null;
      soma += linha.total;
      if (linha.ep == null) semEp = true;
      else epQuad += linha.ep * linha.ep;
      for (const m of linha.marcas ?? []) marcas.add(m);
    }
    return { total: soma, ep: semEp ? null : Math.sqrt(epQuad), regime: "misto", marcas: [...marcas] };
  }
  const linha = linhaNoMapa(totais, componente, periodo);
  if (!linha) return null;
  return { total: linha.total, ep: linha.ep ?? null, regime: linha.regime, marcas: linha.marcas ?? [] };
}

/** Domicílios totais do período. */
export function domiciliosTotal(totais, periodo) {
  return totais.domicilios.find((d) => d.periodo === periodo)?.total ?? null;
}

/**
 * Diferença e z entre dois períodos para um componente. Usa totais.mudancas
 * quando o par existir; senão calcula só se os dois `ep` existirem
 * (rótulo "calculado no site" — SPEC_F1 §4).
 */
export function mudanca(totais, componente, periodoDe, periodoPara) {
  if (componente !== "total") {
    const registrada = totais.mudancas.find(
      (m) => m.componente === componente && m.de === periodoDe && m.para === periodoPara
    );
    if (registrada) return { delta: registrada.delta, z: registrada.z, marcas: registrada.marcas, calculado: false };
  }
  const de = totalDoMapa(totais, componente, periodoDe);
  const para = totalDoMapa(totais, componente, periodoPara);
  if (!de || !para) return null;
  const delta = para.total - de.total;
  const z = de.ep != null && para.ep != null ? Math.abs(delta) / Math.sqrt(de.ep ** 2 + para.ep ** 2) : null;
  return { delta, z, marcas: [], calculado: true };
}
