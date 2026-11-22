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
