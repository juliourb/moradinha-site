// Medidas derivadas de qualidade (SPEC_F1 §8). Cada uma só lê campos do
// pacote ou aplica a fórmula declarada na SPEC — nenhum outro número.
import { incertezaHex } from "./calculo.js";

export const TIPO_MEDIDA = {
  incerteza: "sequencial",
  qualidade_dado: "categorica",
  ressalva_ap: "categorica",
  cv_ap: "sequencial",
  imputacao: "sequencial",
  estoque: "divergente",
  hex_novo: "categorica",
};

function ressalvaComponente(linha, apMap, componente) {
  const ap = apMap.get(linha.apCod);
  if (!ap) return null;
  const comps = componente === "total" ? Object.values(ap.componentes) : [ap.componentes[componente]].filter(Boolean);
  if (!comps.length) return null;
  if (comps.some((c) => c.ressalva)) return "ressalva";
  if (comps.every((c) => c.sem_direta)) return "sem_direta";
  return "ok";
}

/**
 * @returns {number|string|null} número para sequencial/divergente; string para categórica
 */
export function valorMedidaQualidade(linha, periodo, medidaId, componente, apMap) {
  switch (medidaId) {
    case "incerteza":
      return incertezaHex(linha, componente, periodo);
    case "qualidade_dado":
      return linha.qualidadeBase[periodo] ?? null;
    case "ressalva_ap":
      return ressalvaComponente(linha, apMap, componente);
    case "cv_ap": {
      const ap = apMap.get(linha.apCod);
      const comp = componente === "total" ? ap?.componentes?.coabitacao : ap?.componentes?.[componente];
      return comp?.direta_cv ?? null;
    }
    case "imputacao":
      return linha.qualidade[periodo]?.fracaoImputada ?? null;
    case "estoque":
      return linha.qualidade[periodo]?.gEstoque ?? null;
    case "hex_novo":
      return linha.qualidade[periodo]?.hexNovo === true ? "novo" : "existente";
    default:
      return null;
  }
}

/** Medida é constante quando todo hexágono com valor não-nulo tem o mesmo valor. */
export function medidaConstante(linhasArr, periodo, medidaId, componente, apMap) {
  let referencia;
  let visto = false;
  for (const l of linhasArr) {
    const v = valorMedidaQualidade(l, periodo, medidaId, componente, apMap);
    if (v == null) continue;
    if (!visto) {
      referencia = v;
      visto = true;
    } else if (v !== referencia) {
      return false;
    }
  }
  return visto;
}

/** Nomes dos quadrantes do gráfico Déficit × incerteza (acréscimo C, F6.5). */
export const NOME_QUADRANTE = Object.freeze({
  aa: "muito déficit e muita incerteza",
  ab: "muito déficit e pouca incerteza",
  ba: "pouco déficit e muita incerteza",
  bb: "pouco déficit e pouca incerteza",
});

/** Limiar de incerteza do protocolo quando a medida é um CV (em %). */
export const CORTE_CV_PROTOCOLO = 30;

function assimetria(vs) {
  const n = vs.length;
  if (n < 3) return 0;
  const media = vs.reduce((a, b) => a + b, 0) / n;
  let m2 = 0;
  let m3 = 0;
  for (const v of vs) {
    const d = v - media;
    m2 += d * d;
    m3 += d * d * d;
  }
  m2 /= n;
  m3 /= n;
  return m2 > 0 ? m3 / m2 ** 1.5 : 0;
}

function mediana(vs) {
  const s = [...vs].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return null;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/**
 * Dados do gráfico Déficit × incerteza (acréscimo C): pontos (hexágonos com
 * déficit ≥ 1 e incerteza conhecida), linhas de corte, quadrantes com nº de
 * hexágonos e parte do déficit, e se o eixo do déficit vai em escala log.
 * - corte do déficit: mediana do déficit dos hexágonos com déficit ≥ 1;
 * - corte da incerteza: CV de 30% (limiar do protocolo) quando a medida é CV;
 *   senão, a mediana da medida.
 * @param {(l) => number|null} deficitDe déficit absoluto do hexágono
 * @param {(l) => number|null} incertezaDe medida de incerteza do hexágono
 * @param {boolean} medidaEhCv
 */
export function dadosDeficitIncerteza(linhasArr, deficitDe, incertezaDe, medidaEhCv) {
  const comDeficit = [];
  for (const l of linhasArr) {
    const x = deficitDe(l);
    if (x != null && x >= 1) comDeficit.push({ l, x, y: incertezaDe(l) });
  }
  const corteX = mediana(comDeficit.map((d) => d.x));
  const pontos = comDeficit.filter((d) => d.y != null && Number.isFinite(d.y));
  if (!pontos.length) return null;
  const corteY = medidaEhCv ? CORTE_CV_PROTOCOLO : mediana(pontos.map((d) => d.y));
  const quadrantes = { aa: { n: 0, deficit: 0 }, ab: { n: 0, deficit: 0 }, ba: { n: 0, deficit: 0 }, bb: { n: 0, deficit: 0 } };
  let soma = 0;
  for (const d of pontos) {
    d.quadrante = (d.x > corteX ? "a" : "b") + (d.y > corteY ? "a" : "b");
    quadrantes[d.quadrante].n += 1;
    quadrantes[d.quadrante].deficit += d.x;
    soma += d.x;
  }
  for (const q of Object.values(quadrantes)) q.parteDeficit = soma > 0 ? q.deficit / soma : 0;
  const log = assimetria(pontos.map((d) => d.x)) > 1 && Math.min(...pontos.map((d) => d.x)) >= 1;
  return { pontos, corteX, corteY, tipoCorteY: medidaEhCv ? "cv" : "mediana", quadrantes, log, somaDeficit: soma };
}
