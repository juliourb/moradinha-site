// Painel do hexágono selecionado (SPEC_F1 §5, §10).
import * as d3 from "d3";
import { formatar } from "../util/formato.js";
import { rotuloMarca, rotuloFonteEstoque } from "../util/marcas.js";
import { valorHex, brutoHex, faixaHex, incertezaHex, totalDoMapa, COMPONENTES_BASE } from "../dados/calculo.js";
import { formatarPercentual } from "../util/formato.js";
import { nivelIncerteza, nivelCvAp, nivelFracaoImputada } from "../util/limiares.js";

const CLAB = { coabitacao: "Coabitação", onus: "Ônus", precariedade: "Precariedade" };
const NIVEL_CLASSE = { ok: "ok", atencao: "warn", critico: "crit" };

function css(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

function linhaComponente(linha, componente, periodo) {
  const v = brutoHex(linha, componente, periodo);
  const faixa = faixaHex(linha, componente, periodo);
  if (v == null) {
    return `<div class="comp-row"><span>${CLAB[componente]}</span><span class="empty">sem dado</span><span></span></div>`;
  }
  const maximoEixo = Math.max(faixa ? faixa[1] : v, 0.01) * 1.15;
  const pc = (x) => (100 * x) / maximoEixo;
  return `<div class="comp-row"><span>${CLAB[componente]}</span><div class="bar">${
    faixa ? `<div class="rng" style="left:${pc(faixa[0])}%;width:${pc(faixa[1] - faixa[0])}%"></div>` : ""
  }<div class="pt" style="left:${pc(v)}%"></div></div><span class="num" style="text-align:right">${formatar(v, 1)}</span></div>`;
}

function sparkline(linha, componente, medida, manifesto) {
  const periodosAno = manifesto.periodos.filter((p) => p.tipo === "ano");
  const serie = periodosAno.map((p) => valorHex(linha, componente, p.id, medida));
  const ok = serie.filter((v) => v != null);
  if (!ok.length) return "";
  const W = 300;
  const H = 54;
  const x = d3.scalePoint().domain(periodosAno.map((p) => p.id)).range([16, W - 16]);
  const y = d3.scaleLinear().domain([0, d3.max(ok) * 1.2 || 1]).range([H - 16, 6]);
  const linha2 = d3.line().defined((v) => v != null).x((_v, i) => x(periodosAno[i].id)).y((v) => y(v));
  const pontos = serie
    .map((v, i) => {
      if (v == null) return "";
      const p = periodosAno[i];
      const critico = p.marcas?.includes("fonte_estoque_diferente");
      return `<circle cx="${x(p.id)}" cy="${y(v)}" r="3.5" fill="${critico ? css("--crit") : css("--accent")}"/><text x="${x(
        p.id
      )}" y="${H - 2}" text-anchor="middle">${p.rotulo}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Série do hexágono"><path d="${linha2(
    serie
  )}" fill="none" stroke="${css("--accent")}" stroke-width="2"/>${pontos}</svg>`;
}

function blocoQualidade(linha, estado) {
  const periodo = estado.periodo;
  const qb = linha.qualidadeBase[periodo];
  const qq = linha.qualidade[periodo];
  const incertezas = COMPONENTES_BASE.map((c) => incertezaHex(linha, c, periodo)).filter((v) => v != null);
  const piorIncerteza = incertezas.length ? Math.max(...incertezas) : null;
  const nivelInc = nivelIncerteza(piorIncerteza);
  const itens = [];
  const qbTxt = qb == null ? "—" : qb === "ok" ? "ok" : rotuloMarca(qb);
  itens.push(`<span class="pill ${qb === "ok" ? "ok" : "warn"}">qualidade do dado: ${qbTxt}</span>`);
  if (piorIncerteza != null) {
    itens.push(`<span class="pill ${NIVEL_CLASSE[nivelInc]}">incerteza: ${formatar(piorIncerteza, 2)}</span>`);
  }
  if (qq) {
    if (qq.fracaoImputada != null) {
      const n = nivelFracaoImputada(qq.fracaoImputada);
      itens.push(`<span class="pill ${NIVEL_CLASSE[n]}">fração imputada: ${formatar(qq.fracaoImputada * 100, 0)}%</span>`);
    }
    itens.push(`<span class="pill info">fonte do estoque: ${rotuloFonteEstoque(qq.fonteEstoque)}</span>`);
    if (qq.gEstoque != null) itens.push(`<span class="pill info">estoque ÷ 2022: ${formatar(qq.gEstoque, 2)}</span>`);
    if (qq.hexNovo) itens.push(`<span class="pill warn">hexágono novo neste período</span>`);
  }
  return `<div class="sub" style="margin-top:10px">Qualidade deste hexágono</div><div class="pills">${itens.join("")}</div>`;
}

/**
 * @param {HTMLElement} el
 * @param {object} estado
 * @param {Map} linhas
 * @param {Map} apMap
 * @param {object} manifesto
 */
export function renderizarHexagono(el, estado, linhas, apMap, manifesto, totais) {
  const linha = estado.selecionado ? linhas.get(estado.selecionado) : null;
  if (!linha) {
    el.innerHTML = `<h2>Hexágono</h2><p class="empty">Clique num hexágono do mapa ou do ranking para ver a estimativa, a faixa, as marcas e a comparação com a amostra na AP.</p>`;
    return;
  }
  const periodoRotulo = manifesto.periodos.find((p) => p.id === estado.periodo)?.rotulo ?? estado.periodo;
  const pills = [];
  if (linha.fcuFracao > 0) pills.push('<span class="pill info" style="color:var(--fcu);border-color:var(--fcu)">FCU</span>');
  for (const recorteId of linha.recortes) {
    const recorte = (manifesto.recortes ?? []).find((r) => r.id === recorteId);
    pills.push(`<span class="pill crit" style="color:var(--bk);border-color:var(--bk)">${recorte?.nome ?? recorteId}</span>`);
  }
  if (linha.nAps > 1) pills.push(`<span class="pill warn">Cruza ${linha.nAps} áreas de ponderação; a comparação usa a dominante</span>`);
  if (linha.nMunicipios > 1) pills.push(`<span class="pill warn">Cruza ${linha.nMunicipios} municípios; a comparação usa o dominante</span>`);

  const dom = linha.dom[estado.periodo];
  const ap = apMap.get(linha.apCod);
  const coab = ap?.componentes?.coabitacao;

  // C6: peso do hexágono = absoluto do hexágono ÷ Σ absoluto do componente no período.
  let pesoHtml = "";
  if (totais) {
    const brutoAtual = brutoHex(linha, estado.componente, estado.periodo);
    const totalComponente = totalDoMapa(totais, estado.componente, estado.periodo);
    if (brutoAtual != null && totalComponente?.total) {
      const peso = (100 * brutoAtual) / totalComponente.total;
      pesoHtml = `<dt>Peso no total do domínio</dt><dd>${formatarPercentual(peso, 2)}</dd>`;
    }
  }

  el.innerHTML = `<h2>Hexágono <span class="num" style="font-family:var(--body);font-size:12px;color:var(--muted)">${linha.h3}</span></h2>
   <div class="pills">${pills.join("")}</div>
   <dl class="num"><dt>Área de ponderação</dt><dd>${ap?.ap_nome ?? linha.apCod}</dd><dt>Município</dt><dd>${linha.municipioNome}</dd><dt>Domicílios em ${periodoRotulo}</dt><dd>${
    dom == null ? "sigilo" : formatar(dom, 1)
  }</dd>${pesoHtml}</dl>
   <div class="sub">Estimativa e faixa de 95% em ${periodoRotulo} (domicílios)</div>${COMPONENTES_BASE.map((c) => linhaComponente(linha, c, estado.periodo)).join("")}
   <div class="sub" style="margin-top:10px">${estado.componente === "total" ? "Total" : CLAB[estado.componente] ?? "Total"} ${estado.medida === "relativo" ? "relativo" : "absoluto"} no tempo</div>${sparkline(
    linha,
    estado.componente,
    estado.medida,
    manifesto
  )}
   ${
     coab
       ? `<div class="sub" style="margin-top:8px">Na AP, coabitação 2022: <b>direta da amostra ${
           coab.sem_direta ? "—" : formatar(coab.direta, 0)
         }</b> (CV ${coab.direta_cv == null ? "—" : formatar(coab.direta_cv, 1) + "%"}) · <b>soma do motor ${formatar(
           coab.motor_2022,
           0
         )}</b>${coab.ressalva ? ` ${`<span class="pill warn">${rotuloMarca("ap_ressalva")}</span>`}` : ""}. A PNADc não existe por hexágono; a comparação honesta é na AP e no domínio.</div>`
       : ""
   }
   ${blocoQualidade(linha, estado)}`;
}
