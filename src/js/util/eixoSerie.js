// Escala vertical dos gráficos de série no tempo (acréscimo A, F6.5).
// O eixo vai do menor limite inferior ao maior limite superior da faixa de 95%
// (ou do valor, quando não há faixa), com 10% de folga e marcas em números
// redondos. Não começa obrigatoriamente em zero; quando não começa, quem
// desenha mostra uma marca discreta no eixo.
import * as d3 from "d3";

/**
 * @param {Array<{v?: number|null, lo?: number|null, hi?: number|null}|number|null>} pontos
 * @param {number} [nMarcas=4] número aproximado de marcas no eixo
 * @returns {{dominio: [number, number], marcas: number[], naoComecaEmZero: boolean} | null}
 */
export function eixoSerie(pontos, nMarcas = 4) {
  const vals = [];
  for (const p of pontos ?? []) {
    if (p == null) continue;
    if (typeof p === "number") {
      if (Number.isFinite(p)) vals.push(p);
      continue;
    }
    for (const k of ["v", "lo", "hi"]) if (Number.isFinite(p[k])) vals.push(p[k]);
  }
  if (!vals.length) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  let amplitude = max - min;
  if (amplitude === 0) amplitude = Math.abs(max) || 1;
  let a = min - 0.1 * amplitude;
  let b = max + 0.1 * amplitude;
  // Dados não negativos não ganham eixo negativo só por causa da folga.
  if (min >= 0 && a < 0) a = 0;
  if (max <= 0 && b > 0) b = 0;
  // Arredonda as pontas para o passo das marcas (números redondos).
  const passo = d3.tickStep(a, b, nMarcas);
  a = Math.floor(a / passo) * passo;
  b = Math.ceil(b / passo) * passo;
  if (min >= 0 && a < 0) a = 0;
  const marcas = d3.range(a, b + passo / 2, passo).map((t) => +t.toPrecision(12));
  return { dominio: [a, b], marcas, naoComecaEmZero: a > 0 || b < 0 };
}

/** Texto curto da marca quando o eixo não começa em zero. */
export const NOTA_EIXO_SEM_ZERO = "eixo não começa em zero";

/**
 * Desenha a marca de quebra (dois traços inclinados) na base do eixo vertical,
 * como string SVG. `x` é a posição do eixo; `y` a base do gráfico.
 */
export function svgQuebraEixo(x, y, cor) {
  const d = `M${x - 4},${y - 3} l8,-3 M${x - 4},${y + 1} l8,-3`;
  return `<path class="quebra-eixo" d="${d}" stroke="${cor}" stroke-width="1.2" fill="none"><title>${NOTA_EIXO_SEM_ZERO}</title></path>`;
}
