// Gráficos do conjunto "Qualidade" (SPEC_F1 §9): histograma da medida,
// dispersão déficit × incerteza, composição ponderada por domicílios,
// estoque ÷ 2022 por período.
import * as d3 from "d3";
import { formatar, rotuloCurto } from "../util/formato.js";
import { valorHex, incertezaHex, domiciliosTotal } from "../dados/calculo.js";
import { valorMedidaQualidade, TIPO_MEDIDA, dadosDeficitIncerteza, NOME_QUADRANTE, CORTE_CV_PROTOCOLO } from "../dados/qualidade.js";
import { ligarDica, marcarGrafico, htmlDica } from "../ui/ajuda.js";

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
      .attr("fill", css("--accent"))
      .call((sel) => ligarDica(sel, (d) => htmlDica({ titulo: String(d[0]), valor: `${formatar(d[1], 0)} hexágonos`, base: `de ${formatar(d3.sum(dados, (e) => e[1]), 0)} hexágonos` })));
    marcarGrafico(svg.node(), "histograma-qualidade");
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
    })
    .call((sel) =>
      ligarDica(sel, (b) =>
        htmlDica({
          titulo: b === ultimoBin ? `${formatar(b.x0, 2)} ou mais (p99 ou mais)` : `${formatar(b.x0, 2)} a ${formatar(b.x1, 2)}`,
          valor: `${formatar(b.length, 0)} hexágonos`,
          base: `de ${formatar(vs.length, 0)} hexágonos`,
        })
      )
    );
  marcarGrafico(svg.node(), "histograma-qualidade");
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

/** Quadrante ativo no estado, só se ainda vale para o componente/período/medida atuais. */
export function quadranteAtivo(estado) {
  const q = estado.quadrante;
  if (!q || q.componente !== estado.componente || q.periodo !== estado.periodo || q.medida_qualidade !== estado.medida_qualidade) return null;
  return q.id;
}

/**
 * Déficit × incerteza (acréscimo C, F6.5): linhas de corte rotuladas, quatro
 * quadrantes com nº de hexágonos e parte do déficit ("muito déficit e muita
 * incerteza" em destaque), eixo do déficit em log quando a distribuição é
 * assimétrica, dica em cada ponto e clique no quadrante filtrando o mapa.
 */
export function renderizarDispersao(box, estado, linhasArr, apMap, aoSelecionar, aoClicarQuadrante) {
  if (box.closest(".dcard")?.classList.contains("min")) return;
  const ehCv = estado.medida_qualidade === "cv_ap";
  const dados = dadosDeficitIncerteza(
    linhasArr,
    (l) => valorHex(l, estado.componente, estado.periodo, "absoluto"),
    (l) => (ehCv ? valorMedidaQualidade(l, estado.periodo, "cv_ap", estado.componente, apMap) : incertezaHex(l, estado.componente, estado.periodo)),
    ehCv
  );
  if (!dados) {
    box.innerHTML = `<p class="empty">Sem faixa para esta combinação (total ou precariedade provisória não têm incerteza).</p>`;
    return;
  }
  const { pontos, corteX, corteY, quadrantes, log } = dados;
  const nomeY = ehCv ? "CV da AP (%)" : "incerteza";
  const decY = ehCv ? 0 : 2;
  const qAtivo = quadranteAtivo(estado);
  const halo = (sel) => sel.attr("stroke", css("--surface")).attr("stroke-width", 3).attr("paint-order", "stroke").attr("stroke-linejoin", "round");

  const W = Math.max(260, box.clientWidth || 300);
  const H = 176;
  const [y0, y1] = d3.extent([...pontos.map((d) => d.y), corteY]);
  const folgaY = (y1 - y0 || Math.abs(y1) || 1) * 0.12;
  const dominioY = [y0 >= 0 ? Math.max(0, y0 - folgaY) : y0 - folgaY, y1 + folgaY];
  // Incerteza quase igual em todos os hexágonos (variação < 1% do valor): uma só
  // marca "≈ valor" e uma nota, em vez de um eixo com casas decimais sem sentido.
  const quaseConstante = Math.abs(corteY) > 0 && (y1 - y0) / Math.abs(corteY) < 0.01;
  const passoY = d3.tickStep(...dominioY, 4);
  const casasY = quaseConstante ? decY : Math.max(0, Math.min(3, -Math.floor(Math.log10(passoY))));
  const marcasY = quaseConstante ? [corteY] : d3.ticks(...dominioY, 4);
  // Margem esquerda pelo rótulo mais largo do eixo vertical.
  const larguraRotulo = Math.max(...marcasY.map((v) => formatar(v, casasY).length + (quaseConstante ? 2 : 0)), 3);
  const m = { l: Math.max(36, 10 + 6 * larguraRotulo), r: 10, t: 14, b: 32 };
  const [x0, x1] = d3.extent(pontos, (d) => d.x);
  const x = (log ? d3.scaleLog().domain([Math.max(1, x0), Math.max(x1, x0 * 10)]) : d3.scaleLinear().domain([0, x1])).nice().range([m.l, W - m.r]);
  // Eixo da incerteza pela amplitude dos dados (com folga), não a partir de zero:
  // com incerteza quase constante, começar em zero espremia os pontos numa linha.
  const y = d3.scaleLinear().domain(dominioY).range([H - m.b, m.t]);
  const cx = Math.max(m.l, Math.min(W - m.r, x(corteX)));
  const cy = Math.max(m.t, Math.min(H - m.b, y(corteY)));
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img")
    .attr("aria-label", `Déficit por ${nomeY}, com quatro quadrantes${log ? "; eixo do déficit em escala log" : ""}`);

  // Quadrantes (atrás dos pontos): clicar filtra o mapa; clicar de novo limpa.
  const rects = [
    { id: "aa", x: cx, y: m.t, w: W - m.r - cx, h: cy - m.t },
    { id: "ba", x: m.l, y: m.t, w: cx - m.l, h: cy - m.t },
    { id: "ab", x: cx, y: cy, w: W - m.r - cx, h: H - m.b - cy },
    { id: "bb", x: m.l, y: cy, w: cx - m.l, h: H - m.b - cy },
  ];
  svg.append("g").attr("class", "quadrantes").selectAll("rect").data(rects).join("rect")
    .attr("class", (r) => `quadrante q-${r.id}`)
    .attr("data-quadrante", (r) => r.id)
    .attr("x", (r) => r.x).attr("y", (r) => r.y).attr("width", (r) => Math.max(0, r.w)).attr("height", (r) => Math.max(0, r.h))
    .attr("fill", (r) => (r.id === "aa" ? css("--warn-soft") : "transparent"))
    .attr("opacity", (r) => (r.id === "aa" ? 0.75 : 1))
    .attr("stroke", (r) => (qAtivo === r.id ? css("--accent") : r.id === "aa" ? css("--warn") : "none"))
    .attr("stroke-width", (r) => (qAtivo === r.id ? 2 : 1))
    .attr("aria-current", (r) => (qAtivo === r.id ? "true" : null))
    .style("cursor", "pointer")
    .on("click", (e, r) => {
      e.stopPropagation();
      aoClicarQuadrante?.(qAtivo === r.id ? null : r.id);
    })
    .call((sel) => ligarDica(sel, (r) => htmlDica({
      titulo: NOME_QUADRANTE[r.id][0].toUpperCase() + NOME_QUADRANTE[r.id].slice(1),
      valor: `${formatar(quadrantes[r.id].n, 0)} hexágonos · ${formatar(100 * quadrantes[r.id].parteDeficit, 1)}% do déficit`,
      base: qAtivo === r.id ? "clique para tirar o filtro do mapa" : "clique para mostrar só estes hexágonos no mapa",
    })));

  const potencia10 = (v) => Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9;
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat((v) => (log && !potencia10(v) ? "" : formatar(v, 0))));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).tickValues(marcasY).tickFormat((v) => (quaseConstante ? "≈ " : "") + formatar(v, casasY)));
  svg.append("text").attr("class", "rotulo-eixo").attr("x", W - m.r).attr("y", H - 3).attr("text-anchor", "end").attr("font-size", 9).attr("fill", css("--muted"))
    .text(`déficit do hexágono (domicílios${log ? ", escala log" : ""})`);
  svg.append("text").attr("class", "rotulo-eixo").attr("x", 2).attr("y", 9).attr("font-size", 9).attr("fill", css("--muted")).text(nomeY);

  // Linhas de corte, rotuladas.
  const linhaCor = css("--ink");
  svg.append("line").attr("class", "corte corte-x").attr("x1", cx).attr("x2", cx).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", linhaCor).attr("stroke-dasharray", "3,3");
  svg.append("line").attr("class", "corte corte-y").attr("x1", m.l).attr("x2", W - m.r).attr("y1", cy).attr("y2", cy).attr("stroke", linhaCor).attr("stroke-dasharray", "3,3");
  svg.append("text").attr("class", "rotulo-corte corte-x").attr("x", cx).attr("y", m.t - 3).attr("text-anchor", cx > W / 2 ? "end" : "start").attr("font-size", 8.5).attr("fill", css("--muted")).call(halo)
    .text(`mediana do déficit: ${formatar(corteX, 1)}`);
  svg.append("text").attr("class", "rotulo-corte corte-y").attr("x", (m.l + cx) / 2).attr("y", cy - 3).attr("text-anchor", "middle").attr("font-size", 8.5).attr("fill", css("--muted")).call(halo)
    .text(ehCv ? `limiar do protocolo: CV de ${CORTE_CV_PROTOCOLO}%` : `mediana da incerteza: ${formatar(corteY, 2)}`);

  const gp = svg.append("g").selectAll("circle").data(pontos).join("circle")
    .attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.y)).attr("r", 2.4)
    .attr("fill", css("--accent"))
    .attr("opacity", (d) => (qAtivo && d.quadrante !== qAtivo ? 0.15 : 0.6))
    .style("cursor", "pointer")
    .on("click", (e, d) => {
      e.stopPropagation();
      aoSelecionar(d.l.h3);
    });
  ligarDica(gp, (d) => htmlDica({
    titulo: `Hexágono ${d.l.h3.slice(-8)}${d.l.municipioNome ? ` · ${d.l.municipioNome}` : ""}`,
    valor: `déficit ${formatar(d.x, 1)} · ${nomeY} ${formatar(d.y, decY)}`,
    base: `quadrante: ${NOME_QUADRANTE[d.quadrante]}`,
  }));

  // Nº de hexágonos e parte do déficit em cada quadrante.
  const cantos = { aa: [W - m.r - 3, m.t + 10, "end"], ba: [m.l + 3, m.t + 10, "start"], ab: [W - m.r - 3, H - m.b - 14, "end"], bb: [m.l + 3, H - m.b - 14, "start"] };
  for (const [id, [tx, ty, anc]] of Object.entries(cantos)) {
    const q = quadrantes[id];
    svg.append("text").attr("class", `quadrante-contagem q-${id}`).attr("x", tx).attr("y", ty).attr("text-anchor", anc)
      .attr("font-size", 9).attr("font-weight", id === "aa" ? 700 : 400).attr("fill", id === "aa" ? css("--ink") : css("--muted"))
      .style("pointer-events", "none").call(halo)
      .text(`${formatar(q.n, 0)} hex. · ${formatar(100 * q.parteDeficit, 0)}% do déficit`);
  }
  if (quaseConstante) {
    svg.append("text").attr("class", "nota-constante").attr("x", m.l + 3).attr("y", Math.min(cy + 12, H - m.b - 26)).attr("font-size", 8.5).attr("fill", css("--muted")).call(halo)
      .text(`${nomeY} quase não varia entre hexágonos`);
  }
  marcarGrafico(svg.node(), "dispersao");
  box.replaceChildren(svg.node());
}

export function renderizarComposicao(box, manifesto, linhasArr, apMap, estado) {
  if (box.closest(".dcard")?.classList.contains("min")) return;
  const categorias = ["ok", "ressalva", "sigilo", "sem_dado"];
  const NOME_CAT = { ok: "sem ressalva", ressalva: "com ressalva", sigilo: "em sigilo", sem_dado: "sem dado" };
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
        .datum({ lab: d.lab, cat, fracao: d.fracoes[i] })
        .call((sel) => ligarDica(sel, (e) => htmlDica({ titulo: e.lab, valor: `${NOME_CAT[e.cat]}: ${formatar(e.fracao * 100, 1)}%`, base: "% dos domicílios dos hexágonos" })));
      acum += d.fracoes[i];
    });
  }
  marcarGrafico(svg.node(), "composicao");
  box.replaceChildren(svg.node());
}

export function renderizarEstoque(box, manifesto, linhasArr) {
  if (box.closest(".dcard")?.classList.contains("min")) return;
  const st = manifesto.periodos.map((p) => {
    const vs = linhasArr.map((l) => l.qualidade[p.id]?.gEstoque).filter((v) => v != null).sort(d3.ascending);
    const q = (f) => d3.quantileSorted(vs, f);
    return { id: p.id, lab: p.rotulo, n: vs.length, critico: p.marcas?.includes("fonte_estoque_diferente"), q10: q(0.1), q25: q(0.25), q50: q(0.5), q75: q(0.75), q90: q(0.9) };
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
  ligarDica(g, (s) =>
    s.q50 == null
      ? htmlDica({ titulo: s.lab, valor: "sem dado" })
      : htmlDica({ titulo: s.lab, valor: `mediana ${formatar(s.q50, 2)} × o estoque de 2022`, base: `p25–p75: ${formatar(s.q25, 2)} a ${formatar(s.q75, 2)} · ${formatar(s.n, 0)} hexágonos` })
  );
  marcarGrafico(svg.node(), "estoque");
  box.replaceChildren(svg.node());
}
