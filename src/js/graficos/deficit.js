// Gráficos do conjunto "Déficit" (SPEC_F1 §6): histograma, ranking, série,
// distribuição por período.
import * as d3 from "d3";
import { formatar, rotuloCurto } from "../util/formato.js";
import { valorHex, totalDoMapa, domiciliosTotal } from "../dados/calculo.js";
import { curvaConcentracao } from "../dados/visaoGeral.js";
import { alternarFaixa } from "../util/faixas.js";

function css(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

export function renderizarHistograma(box, estado, linhasArr, aoClicarBarra) {
  if (box.closest(".dcard")?.classList.contains("min")) return;
  const isRel = estado.medida === "relativo";
  const vs = linhasArr.map((l) => valorHex(l, estado.componente, estado.periodo, estado.medida)).filter((v) => v != null && v > 0);
  const W = Math.max(260, box.clientWidth || 300);
  const H = 104;
  const m = { l: 34, r: 8, t: 6, b: 22 };
  if (!vs.length) {
    box.innerHTML = `<p class="empty">Nenhum hexágono acima de zero nesta combinação.</p>`;
    return;
  }
  const p99 = d3.quantile(vs.slice().sort(d3.ascending), 0.99) || vs[0];
  const x = d3.scaleLinear().domain([0, p99 * 1.05]).nice().range([m.l, W - m.r]);
  // N2: eixo cortado no p99; os valores acima entram na última barra ("p99 ou mais").
  const bins = d3.bin().domain(x.domain()).thresholds(x.ticks(28))(vs.map((v) => Math.min(v, x.domain()[1] - 1e-9)));
  const ultimoBin = bins.at(-1);
  const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length) || 1]).nice().range([H - m.b, m.t]);
  const faixaSelecionada = (b) => (estado.faixa_hist ?? []).some(([x0]) => x0 === b.x0);
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img").attr("aria-label", "Histograma dos hexágonos");
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat((v) => formatar(v, isRel ? 1 : 0)));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4));
  svg
    .append("g")
    .selectAll("rect")
    .data(bins)
    .join("rect")
    .attr("x", (b) => x(b.x0) + 0.5)
    .attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 1))
    .attr("y", (b) => y(b.length))
    .attr("height", (b) => y(0) - y(b.length))
    .attr("fill", css("--accent"))
    .attr("stroke", (b) => (faixaSelecionada(b) ? css("--ink") : "none"))
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .attr("opacity", (b) => (!estado.faixa_hist?.length || faixaSelecionada(b) ? 1 : 0.35))
    .on("click", (_e, b) => aoClicarBarra(alternarFaixa(estado.faixa_hist, [b.x0, b === ultimoBin ? null : b.x1])))
    .append("title")
    .text((b) => (b === ultimoBin ? `${b.length} hexágonos de ${formatar(b.x0, 1)} (p99 ou mais)` : `${b.length} hexágonos entre ${formatar(b.x0, 1)} e ${formatar(b.x1, 1)}`));
  svg.append("text").attr("x", W - m.r).attr("y", m.t + 8).attr("text-anchor", "end").attr("font-size", 9).attr("fill", css("--muted")).text("p99 ou mais →");
  box.replaceChildren(svg.node());
}

export function renderizarRanking(box, estado, linhasArr, apMap, aoIrPara) {
  const isRel = estado.medida === "relativo";
  const rs = linhasArr
    .map((l) => ({ l, v: valorHex(l, estado.componente, estado.periodo, estado.medida) }))
    .filter((d) => d.v != null)
    .sort((a, b) => b.v - a.v)
    .slice(0, 5);
  const mx = rs[0]?.v || 1;
  box.innerHTML = `<tbody>${rs
    .map(
      (d, i) =>
        // N3: município + AP + código curto do hexágono (6 últimos caracteres), para não repetir linha.
        `<tr data-h3="${d.l.h3}" tabindex="0"><td>${i + 1}</td><td>${d.l.municipioNome} · ${apMap.get(d.l.apCod)?.ap_nome ?? d.l.apCod} · <span class="num" style="font-size:10px;color:var(--muted)">${d.l.h3.slice(-6)}</span>${
          d.l.fcuFracao > 0 ? " · FCU" : ""
        }</td><td style="width:45%"><div class="b" style="width:${(100 * d.v) / mx}%"></div></td><td style="text-align:right">${formatar(
          d.v,
          isRel ? 2 : 0
        )}${isRel ? " %" : ""}</td></tr>`
    )
    .join("")}</tbody>`;
  box.querySelectorAll("tr").forEach((tr) => {
    const ir = () => aoIrPara(tr.dataset.h3);
    tr.onclick = ir;
    tr.onkeydown = (e) => {
      if (e.key === "Enter") ir();
    };
  });
}

export function renderizarSerie(box, estado, manifesto, totais, aoClicarPeriodo) {
  if (box.closest(".dcard")?.classList.contains("min")) return;
  const isRel = estado.medida === "relativo";
  const anos = manifesto.periodos.filter((p) => p.tipo === "ano");
  const medias = manifesto.periodos.filter((p) => p.tipo === "media");
  const pts = manifesto.periodos.map((p, i) => {
    const t = totalDoMapa(totais, estado.componente, p.id);
    const dom = domiciliosTotal(totais, p.id);
    const k = isRel && dom ? 100 / dom : 1;
    return {
      p: i, id: p.id, lab: p.rotulo, media: p.tipo === "media",
      v: t ? t.total * k : null, lo: t?.ep != null ? (t.total - 1.96 * t.ep) * k : null, hi: t?.ep != null ? (t.total + 1.96 * t.ep) * k : null,
      critico: p.marcas?.includes("fonte_estoque_diferente"),
    };
  });
  const W = Math.max(260, box.clientWidth || 300);
  const H = 122;
  const m = { l: 46, r: 8, t: 8, b: 22 };
  const nAnos = anos.length;
  const xpos = (i) => (i < nAnos ? i : i - (nAnos - 1) + 0.28);
  const x = d3.scaleLinear().domain([-0.4, nAnos - 1 + 0.6]).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, d3.max(pts, (d) => d.hi ?? d.v ?? 0) * 1.1 || 1]).nice().range([H - m.b, m.t]);
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img").attr("aria-label", "Total do domínio no tempo");
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat((v) => formatar(v, isRel ? 1 : 0)));
  svg
    .append("g")
    .selectAll("text")
    .data(anos)
    .join("text")
    .attr("x", (_p, i) => x(i))
    .attr("y", H - 8)
    .attr("text-anchor", "middle")
    .text((p) => p.rotulo);
  const anosPts = pts.slice(0, nAnos);
  svg.append("path").attr("d", d3.line().x((d) => x(xpos(d.p))).y((d) => y(d.v ?? 0))(anosPts)).attr("fill", "none").attr("stroke", css("--muted")).attr("stroke-width", 1.2);
  const g = svg.append("g").selectAll("g").data(pts).join("g").style("cursor", "pointer").on("click", (_e, d) => aoClicarPeriodo(d.id));
  g.filter((d) => d.lo != null)
    .append("line")
    .attr("x1", (d) => x(xpos(d.p)))
    .attr("x2", (d) => x(xpos(d.p)))
    .attr("y1", (d) => y(d.lo))
    .attr("y2", (d) => y(d.hi))
    .attr("stroke", (d) => (d.media ? css("--accent") : css("--ink")))
    .attr("stroke-width", (d) => (d.media ? 4 : 2))
    .attr("opacity", (d) => (d.media ? 0.55 : 0.8));
  g.filter((d) => d.v != null)
    .append("path")
    .attr("transform", (d) => `translate(${x(xpos(d.p))},${y(d.v)})`)
    .attr("d", (d) => d3.symbol(d.media ? d3.symbolDiamond : d3.symbolCircle, d.id === estado.periodo ? 130 : 60)())
    .attr("fill", (d) => (d.critico ? css("--crit") : d.media ? css("--accent") : css("--ink")))
    .attr("stroke", (d) => (d.id === estado.periodo ? css("--warn") : "none"))
    .attr("stroke-width", 3);
  g.append("title").text((d) => `${d.lab}: ${d.v == null ? "sem dado" : formatar(d.v, isRel ? 2 : 0)}${d.lo != null ? ` (${formatar(d.lo, isRel ? 2 : 0)} a ${formatar(d.hi, isRel ? 2 : 0)})` : " (sem faixa)"}`);
  box.replaceChildren(svg.node());
}

/**
 * Painel de um componente no pop-up "Detalhes" da Visão geral (SPEC_F6 B3):
 * mesmo desenho da série por ano (ponto + faixa de 95%, 2023 marcado), mais
 * uma linha tracejada na média de cada período "media" do manifesto.
 */
export function renderizarPainelDetalhe(box, manifesto, totais, componente, rotulo) {
  const anos = manifesto.periodos.filter((p) => p.tipo === "ano");
  const medias = manifesto.periodos.filter((p) => p.tipo === "media");
  const pontoDe = (p) => {
    const t = totalDoMapa(totais, componente, p.id);
    return {
      id: p.id, lab: p.rotulo, media: p.tipo === "media",
      v: t ? t.total : null, lo: t?.ep != null ? t.total - 1.96 * t.ep : null, hi: t?.ep != null ? t.total + 1.96 * t.ep : null,
      critico: p.marcas?.includes("fonte_estoque_diferente"),
      semFaixaProvisoria: t?.marcas?.includes("precariedade_provisoria_sem_faixa") ?? false,
    };
  };
  const anosPts = anos.map(pontoDe);
  const mediaPts = medias.map(pontoDe);
  const W = Math.max(220, box.clientWidth || 260);
  const H = 128;
  const m = { l: 44, r: 8, t: 8, b: 20 };
  const x = d3.scalePoint().domain(anos.map((p) => p.id)).range([m.l, W - m.r]);
  const maxV = d3.max([...anosPts, ...mediaPts], (d) => d.hi ?? d.v ?? 0) || 1;
  const y = d3.scaleLinear().domain([0, maxV * 1.15]).nice().range([H - m.b, m.t]);
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img").attr("aria-label", `Série de ${rotulo}`);
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((v) => formatar(v, 0)));
  svg.append("g").selectAll("text").data(anos).join("text").attr("x", (p) => x(p.id)).attr("y", H - 4).attr("text-anchor", "middle").text((p) => rotuloCurto(p.rotulo));
  svg.append("path").attr("d", d3.line().defined((d) => d.v != null).x((d) => x(d.id)).y((d) => y(d.v ?? 0))(anosPts)).attr("fill", "none").attr("stroke", css("--muted")).attr("stroke-width", 1.2);
  // Médias de período: linha tracejada horizontal (referência de comparação).
  svg
    .append("g")
    .selectAll("line")
    .data(mediaPts.filter((d) => d.v != null))
    .join("line")
    .attr("x1", m.l)
    .attr("x2", W - m.r)
    .attr("y1", (d) => y(d.v))
    .attr("y2", (d) => y(d.v))
    .attr("stroke", css("--accent"))
    .attr("stroke-width", 1.4)
    .attr("stroke-dasharray", "4,3")
    .append("title")
    .text((d) => `${d.lab} (média): ${formatar(d.v, 0)}`);
  const g = svg.append("g").selectAll("g").data(anosPts).join("g");
  g.filter((d) => d.lo != null)
    .append("line")
    .attr("x1", (d) => x(d.id))
    .attr("x2", (d) => x(d.id))
    .attr("y1", (d) => y(d.lo))
    .attr("y2", (d) => y(d.hi))
    .attr("stroke", css("--ink"))
    .attr("stroke-width", 2)
    .attr("opacity", 0.8);
  g.filter((d) => d.v != null)
    .append("circle")
    .attr("cx", (d) => x(d.id))
    .attr("cy", (d) => y(d.v))
    .attr("r", 4)
    .attr("fill", (d) => (d.critico ? css("--crit") : css("--ink")));
  g.append("title").text((d) => {
    if (d.v == null) return `${d.lab}: sem dado`;
    const base = `${d.lab}: ${formatar(d.v, 0)}`;
    if (d.critico) return `${base} (estoque por fonte diferente — não comparar por hexágono)`;
    if (d.semFaixaProvisoria) return `${base} (provisória, sem faixa)`;
    return d.lo != null ? `${base} (faixa de 95%: ${formatar(d.lo, 0)} a ${formatar(d.hi, 0)})` : `${base} (sem faixa)`;
  });
  box.replaceChildren(svg.node());
}

/** Curva de concentração do pop-up "Detalhes" (SPEC_F6 B6). */
export function renderizarCurvaConcentracao(box, linhasArr, componente, periodo) {
  const conc = curvaConcentracao(linhasArr, componente, periodo);
  const W = Math.max(260, box.clientWidth || 320);
  const H = 140;
  const m = { l: 40, r: 10, t: 8, b: 22 };
  const x = d3.scaleLinear().domain([0, 100]).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, 100]).range([H - m.b, m.t]);
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img").attr("aria-label", "Curva de concentração do déficit");
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => `${v}%`));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((v) => `${v}%`));
  svg
    .append("path")
    .attr("d", d3.line().x((d) => x(d.pctHex)).y((d) => y(d.pctDeficitAcumulado))([{ pctHex: 0, pctDeficitAcumulado: 0 }, ...conc.pontos]))
    .attr("fill", "none")
    .attr("stroke", css("--accent"))
    .attr("stroke-width", 2);
  svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(50)).attr("y2", y(50)).attr("stroke", css("--line")).attr("stroke-dasharray", "3,3");
  svg.append("circle").attr("cx", x(conc.pctHexMeio)).attr("cy", y(50)).attr("r", 4).attr("fill", css("--crit"))
    .append("title").text(`${formatar(conc.pctHexMeio, 1)}% dos hexágonos somam metade do déficit`);
  box.replaceChildren(svg.node());
}

export function renderizarCaixas(box, estado, manifesto, linhasArr, aoClicarPeriodo) {
  if (box.closest(".dcard")?.classList.contains("min")) return;
  const isRel = estado.medida === "relativo";
  const todosValores = [];
  const st = manifesto.periodos.map((p) => {
    const vs = linhasArr.map((l) => valorHex(l, estado.componente, p.id, estado.medida)).filter((v) => v != null && v > 0).sort(d3.ascending);
    todosValores.push(...vs);
    const q = (f) => d3.quantileSorted(vs, f);
    return { id: p.id, lab: p.rotulo, media: p.tipo === "media", critico: p.marcas?.includes("fonte_estoque_diferente"), q10: q(0.1), q25: q(0.25), q50: q(0.5), q75: q(0.75), q90: q(0.9) };
  });
  const W = Math.max(260, box.clientWidth || 300);
  const H = 122;
  const m = { l: 40, r: 6, t: 14, b: 22 };
  const x = d3.scaleBand().domain(st.map((s) => s.id)).range([m.l, W - m.r]).padding(0.35);
  // N4: eixo cortado no p99 (do conjunto de todos os períodos), para as caixas ficarem comparáveis
  // mesmo quando um período tem um valor bem fora da curva.
  todosValores.sort(d3.ascending);
  const p99 = todosValores.length ? d3.quantileSorted(todosValores, 0.99) : 1;
  const y = d3.scaleLinear().domain([0, Math.max(p99 * 1.1, d3.max(st, (s) => s.q90 ?? 0) ?? 0, 1)]).nice().range([H - m.b, m.t]);
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img").attr("aria-label", "Distribuição dos hexágonos por período, eixo cortado no p99");
  svg.append("text").attr("x", W - m.r).attr("y", 9).attr("text-anchor", "end").attr("font-size", 9).attr("fill", css("--muted")).text("eixo cortado no p99");
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((v) => formatar(v, isRel ? 1 : 1)));
  svg
    .append("g")
    .selectAll("text")
    .data(st)
    .join("text")
    .attr("x", (s) => x(s.id) + x.bandwidth() / 2)
    .attr("y", H - 8)
    .attr("text-anchor", "middle")
    .text((s) => rotuloCurto(s.lab))
    .append("title")
    .text((s) => s.lab);
  const g = svg.append("g").selectAll("g").data(st).join("g").style("cursor", "pointer").on("click", (_e, s) => aoClicarPeriodo(s.id));
  const cx = (s) => x(s.id) + x.bandwidth() / 2;
  const col = (s) => (s.critico ? css("--crit") : s.media ? css("--accent") : css("--ink"));
  g.filter((s) => s.q10 != null).append("line").attr("x1", cx).attr("x2", cx).attr("y1", (s) => y(s.q10)).attr("y2", (s) => y(s.q90)).attr("stroke", col);
  g.filter((s) => s.q25 != null)
    .append("rect")
    .attr("x", (s) => x(s.id))
    .attr("width", x.bandwidth())
    .attr("y", (s) => y(s.q75))
    .attr("height", (s) => y(s.q25) - y(s.q75))
    .attr("fill", (s) => (s.id === estado.periodo ? css("--accent-soft") : css("--surface")))
    .attr("stroke", col)
    .attr("stroke-width", (s) => (s.id === estado.periodo ? 2.5 : 1.2))
    .attr("rx", 3);
  g.filter((s) => s.q50 != null).append("line").attr("x1", (s) => x(s.id)).attr("x2", (s) => x(s.id) + x.bandwidth()).attr("y1", (s) => y(s.q50)).attr("y2", (s) => y(s.q50)).attr("stroke", col).attr("stroke-width", 2.5);
  g.append("title").text((s) => (s.q50 == null ? `${s.lab}: sem hexágono acima de zero` : `${s.lab}: mediana ${formatar(s.q50, 2)}; p25–p75 ${formatar(s.q25, 2)}–${formatar(s.q75, 2)}`));
  box.replaceChildren(svg.node());
}
