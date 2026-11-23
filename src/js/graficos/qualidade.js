// Gráficos do conjunto "Qualidade" (SPEC_F1 §9): histograma da medida,
// dispersão déficit × incerteza, composição ponderada por domicílios,
// estoque ÷ 2022 por período.
import * as d3 from "d3";
import { formatar, rotuloCurto } from "../util/formato.js";
import { valorHex, incertezaHex, domiciliosTotal } from "../dados/calculo.js";
import { valorMedidaQualidade, TIPO_MEDIDA } from "../dados/qualidade.js";

function css(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

export function renderizarHistogramaQualidade(box, estado, linhasArr, apMap, aoClicarBarra) {
  if (box.closest(".dcard")?.classList.contains("min")) return;
  const tipo = TIPO_MEDIDA[estado.medida_qualidade];
  const W = Math.max(260, box.clientWidth || 300);
  const H = 104;
  const m = { l: 34, r: 8, t: 6, b: 28 };
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img").attr("aria-label", "Distribuição da medida de qualidade");

  if (tipo === "categorica") {
    const contagem = d3.rollup(
      linhasArr.map((l) => valorMedidaQualidade(l, estado.periodo, estado.medida_qualidade, estado.componente, apMap)).filter((v) => v != null),
      (v) => v.length,
      (v) => v
    );
    const dados = [...contagem.entries()];
    const x = d3.scaleBand().domain(dados.map((d) => d[0])).range([m.l, W - m.r]).padding(0.25);
    const y = d3.scaleLinear().domain([0, d3.max(dados, (d) => d[1]) || 1]).nice().range([H - m.b, m.t]);
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4));
    svg
      .append("g")
      .selectAll("rect")
      .data(dados)
      .join("rect")
      .attr("x", (d) => x(d[0]))
      .attr("width", x.bandwidth())
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(0) - y(d[1]))
      .attr("fill", css("--accent"));
    svg.append("g").selectAll("text").data(dados).join("text").attr("x", (d) => x(d[0]) + x.bandwidth() / 2).attr("y", H - 10).attr("text-anchor", "middle").text((d) => d[0]);
    box.replaceChildren(svg.node());
    return;
  }

  const vs = linhasArr.map((l) => valorMedidaQualidade(l, estado.periodo, estado.medida_qualidade, estado.componente, apMap)).filter((v) => v != null);
  if (!vs.length) {
    box.innerHTML = `<p class="empty">Sem faixa para esta combinação (total ou precariedade provisória não têm incerteza).</p>`;
    return;
  }
  const minimo = d3.min(vs);
  const p99 = d3.quantile(vs.slice().sort(d3.ascending), 0.99) ?? d3.max(vs);
  const x = d3.scaleLinear().domain([minimo, p99]).nice().range([m.l, W - m.r]);
  // N2: eixo cortado no p99; os valores acima entram na última barra ("p99 ou mais").
  const bins = d3.bin().domain(x.domain()).thresholds(20)(vs.map((v) => Math.min(v, x.domain()[1] - 1e-9)));
  const ultimoBin = bins.at(-1);
  const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length) || 1]).nice().range([H - m.b, m.t]);
  const faixaAtual = estado.faixa_hist?.[0] ?? null;
  const faixaSelecionada = (b) => !faixaAtual || (b.x0 < (faixaAtual[1] ?? Infinity) && b.x1 > faixaAtual[0]);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => formatar(v, 2)));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4));
  svg
    .append("g")
    .selectAll("rect")
    .data(bins)
    .join("rect")
    .attr("x", (b) => x(b.x0) + 0.5)
    .attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 1))
    .attr("y", m.t)
    .attr("height", H - m.b - m.t)
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("click", (e, b) => {
      e.stopPropagation();
      aoClicarBarra([[b.x0, b === ultimoBin ? null : b.x1]]);
    });
  svg.on("click", () => aoClicarBarra([]));
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
    .attr("stroke", (b) => (faixaSelecionada(b) && faixaAtual ? css("--ink") : "none"))
    .attr("stroke-width", 2)
    .attr("opacity", (b) => (faixaSelecionada(b) ? 1 : 0.35))
    .style("pointer-events", "none");
  svg.append("text").attr("x", W - m.r).attr("y", m.t + 8).attr("text-anchor", "end").attr("font-size", 9).attr("fill", css("--muted")).text("p99 ou mais →");
  box.replaceChildren(svg.node());
}

export function renderizarDispersao(box, estado, linhasArr, aoSelecionar) {
  if (box.closest(".dcard")?.classList.contains("min")) return;
  const pontos = linhasArr
    .map((l) => ({ l, x: valorHex(l, estado.componente, estado.periodo, "absoluto"), y: incertezaHex(l, estado.componente, estado.periodo) }))
    .filter((d) => d.x != null && d.x > 0 && d.y != null);
  if (!pontos.length) {
    box.innerHTML = `<p class="empty">Sem faixa para esta combinação (total ou precariedade provisória não têm incerteza).</p>`;
    return;
  }
  const medX = d3.median(pontos, (d) => d.x);
  const medY = d3.median(pontos, (d) => d.y);
  const noQuadrante = pontos.filter((d) => d.x > medX && d.y > medY).length;

  const W = Math.max(260, box.clientWidth || 300);
  const H = 134;
  const m = { l: 40, r: 8, t: 8, b: 22 };
  const x = d3.scaleLinear().domain(d3.extent(pontos, (d) => d.x)).nice().range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain(d3.extent(pontos, (d) => d.y)).nice().range([H - m.b, m.t]);
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img").attr("aria-label", "Dispersão déficit por incerteza");
  svg.append("rect").attr("x", x(medX)).attr("y", m.t).attr("width", Math.max(0, W - m.r - x(medX))).attr("height", Math.max(0, y(medY) - m.t)).attr("fill", css("--warn-soft")).attr("opacity", 0.5);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(4).tickFormat((v) => formatar(v, 0)));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((v) => formatar(v, 1)));
  svg
    .append("g")
    .selectAll("circle")
    .data(pontos)
    .join("circle")
    .attr("cx", (d) => x(d.x))
    .attr("cy", (d) => y(d.y))
    .attr("r", 2.6)
    .attr("fill", css("--accent"))
    .attr("opacity", 0.6)
    .style("cursor", "pointer")
    .on("click", (_e, d) => aoSelecionar(d.l.h3));
  svg.append("text").attr("class", "quadrante-contagem").attr("x", W - m.r - 4).attr("y", m.t + 12).attr("text-anchor", "end").text(`${noQuadrante} no quadrante`);
  box.replaceChildren(svg.node());
}

export function renderizarComposicao(box, manifesto, linhasArr, apMap, estado) {
  if (box.closest(".dcard")?.classList.contains("min")) return;
  const categorias = ["ok", "ressalva", "sigilo", "sem_dado"];
  const cores = { ok: css("--ok"), ressalva: css("--warn"), sigilo: css("--muted"), sem_dado: css("--line") };
  const dados = manifesto.periodos.map((p) => {
    const somas = { ok: 0, ressalva: 0, sigilo: 0, sem_dado: 0 };
    for (const l of linhasArr) {
      const q = l.qualidadeBase[p.id];
      const dom = l.dom[p.id];
      if (q === "sem_dado" || dom == null) {
        somas.sem_dado += 0; // sem domicílios conhecidos para ponderar (V6/V8: nulo = não medido)
        continue;
      }
      if (q === "parcial_sigilo") somas.sigilo += dom;
      else {
        const ap = apMap.get(l.apCod);
        const comp = estado.componente === "total" ? ap?.componentes?.coabitacao : ap?.componentes?.[estado.componente];
        if (comp?.ressalva) somas.ressalva += dom;
        else somas.ok += dom;
      }
    }
    const total = somas.ok + somas.ressalva + somas.sigilo + somas.sem_dado || 1;
    return { id: p.id, lab: p.rotulo, fracoes: categorias.map((c) => somas[c] / total) };
  });

  const W = Math.max(260, box.clientWidth || 300);
  const H = 122;
  const m = { l: 10, r: 10, t: 8, b: 22 };
  const x = d3.scaleBand().domain(dados.map((d) => d.id)).range([m.l, W - m.r]).padding(0.3);
  const y = d3.scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img").attr("aria-label", "Composição da qualidade por período");
  svg.append("g").selectAll("text").data(dados).join("text").attr("x", (d) => x(d.id) + x.bandwidth() / 2).attr("y", H - 8).attr("text-anchor", "middle").text((d) => rotuloCurto(d.lab));
  for (const d of dados) {
    let acum = 0;
    categorias.forEach((cat, i) => {
      const altura = y(acum) - y(acum + d.fracoes[i]);
      svg
        .append("rect")
        .attr("x", x(d.id))
        .attr("width", x.bandwidth())
        .attr("y", y(acum + d.fracoes[i]))
        .attr("height", Math.max(0, altura))
        .attr("fill", cores[cat])
        .append("title")
        .text(`${cat}: ${formatar(d.fracoes[i] * 100, 1)}%`);
      acum += d.fracoes[i];
    });
  }
  box.replaceChildren(svg.node());
}

export function renderizarEstoque(box, manifesto, linhasArr) {
  if (box.closest(".dcard")?.classList.contains("min")) return;
  const st = manifesto.periodos.map((p) => {
    const vs = linhasArr.map((l) => l.qualidade[p.id]?.gEstoque).filter((v) => v != null).sort(d3.ascending);
    const q = (f) => d3.quantileSorted(vs, f);
    return { id: p.id, lab: p.rotulo, critico: p.marcas?.includes("fonte_estoque_diferente"), q10: q(0.1), q25: q(0.25), q50: q(0.5), q75: q(0.75), q90: q(0.9) };
  });
  const W = Math.max(260, box.clientWidth || 300);
  const H = 122;
  const m = { l: 36, r: 6, t: 8, b: 22 };
  const x = d3.scaleBand().domain(st.map((s) => s.id)).range([m.l, W - m.r]).padding(0.35);
  const y = d3.scaleLinear().domain([0, d3.max(st, (s) => s.q90 ?? 1.2) * 1.1 || 1.2]).nice().range([H - m.b, m.t]);
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img").attr("aria-label", "Estoque dividido por 2022, por período");
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4));
  svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(1)).attr("y2", y(1)).attr("stroke", css("--line")).attr("stroke-dasharray", "2,3");
  svg.append("g").selectAll("text").data(st).join("text").attr("x", (s) => x(s.id) + x.bandwidth() / 2).attr("y", H - 8).attr("text-anchor", "middle").text((s) => rotuloCurto(s.lab));
  const col = (s) => (s.critico ? css("--crit") : css("--ink"));
  const g = svg.append("g").selectAll("g").data(st).join("g");
  g.filter((s) => s.q10 != null).append("line").attr("x1", (s) => x(s.id) + x.bandwidth() / 2).attr("x2", (s) => x(s.id) + x.bandwidth() / 2).attr("y1", (s) => y(s.q10)).attr("y2", (s) => y(s.q90)).attr("stroke", col);
  g.filter((s) => s.q25 != null).append("rect").attr("x", (s) => x(s.id)).attr("width", x.bandwidth()).attr("y", (s) => y(s.q75)).attr("height", (s) => y(s.q25) - y(s.q75)).attr("fill", css("--surface")).attr("stroke", col).attr("rx", 3);
  box.replaceChildren(svg.node());
}
