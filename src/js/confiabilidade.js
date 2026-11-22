// Composição da aba Confiabilidade (SPEC_F3).
import * as d3 from "d3";
import { carregarJSON, escolherDominioEEdicao } from "./dados/pacote.js";
import { BLOCOS_MODELO, CLAB, blocoModelo, achadosPublicos, limiteEixoP99 } from "./dados/confiabilidade.js";
import { rotuloMarca } from "./util/marcas.js";
import { formatar, formatarPercentual } from "./util/formato.js";

function $(id) {
  return document.getElementById(id);
}
function css(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

function renderizarFontes(el, qualidade, manifesto) {
  const fontes = qualidade.fontes?.[0];
  if (!fontes) {
    el.innerHTML = `<p class="empty">Sem dados de fonte.</p>`;
    return;
  }
  el.innerHTML = `<div class="timeline-fontes">${manifesto.periodos
    .map((p) => {
      const uso = fontes.uso_por_periodo?.[p.id] ?? "—";
      const troca = p.marcas?.includes("fonte_estoque_diferente");
      return `<span class="passo${troca ? " troca" : ""}" title="${p.rotulo}: ${uso}">${p.rotulo}: ${uso}</span>`;
    })
    .join("")}</div><div class="sub" style="margin-top:6px">${fontes.variavel} — fonte: ${fontes.fonte}. ${(fontes.marcas ?? [])
    .map((m) => rotuloMarca(m))
    .join("; ")}</div>`;
}

function renderizarSigilo(el, sigilo) {
  el.innerHTML = `
    <div class="cartao-f3"><div class="k">Sem dado (sigilo total)</div><div class="v" data-num="${sigilo.hex_sem_dado}">${formatar(sigilo.hex_sem_dado, 0)} hexágonos</div></div>
    <div class="cartao-f3"><div class="k">Parte em sigilo</div><div class="v" data-num="${sigilo.hex_parcial}">${formatar(sigilo.hex_parcial, 0)} hexágonos</div></div>`;
}

function renderizarAps(el, aps) {
  el.innerHTML = aps
    .map(
      (a) => `<div class="cartao-f3"><div class="k">${CLAB[a.componente] ?? a.componente}</div>
        <div class="v" data-num="${a.n_aps}">${formatar(a.n_aps, 0)} APs</div>
        <div class="sub">${formatar(a.n_ressalva, 0)} com ressalva · ${formatar(a.n_sem_direta, 0)} sem amostra direta</div></div>`
    )
    .join("");
}

function renderizarPonte(el, ponte) {
  el.innerHTML = `<table class="ponte"><thead><tr><th>Indicador</th><th>PNADc</th><th>Censo</th><th>Razão</th><th>Leitura</th></tr></thead><tbody>${ponte
    .map(
      (p) => `<tr>
        <td>${p.indicador}</td>
        <td data-num="${p.pnadc ?? ""}">${p.pnadc == null ? "—" : `${formatar(p.pnadc, 1)} (EP ${formatar(p.pnadc_ep, 1)})`}</td>
        <td data-num="${p.censo ?? ""}">${p.censo == null ? "—" : formatar(p.censo, 1)}</td>
        <td data-num="${p.razao ?? ""}">${p.razao == null ? "—" : formatar(p.razao, 2)}</td>
        <td class="sub">${p.leitura}</td>
      </tr>`
    )
    .join("")}</tbody></table>`;
}

function renderizarLacunas(el, lacunas) {
  el.innerHTML = lacunas.map((l) => `<li><b>${l.item}</b> — ${l.efeito}</li>`).join("");
}

function linhaPergunta(titulo, respostaHtml, significado, { recolhido = false } = {}) {
  const corpo = `<div class="resposta">${respostaHtml}</div><div class="significado">${significado}</div>`;
  if (recolhido) {
    return `<details class="pergunta-bloco"><summary>${titulo}</summary>${corpo}</details>`;
  }
  return `<div class="pergunta-bloco"><h4>${titulo}</h4>${corpo}</div>`;
}

/** Monta o HTML dos blocos do modelo — função pura (testável sem DOM). */
export function montarModeloHtml(modeloComponenteBruto) {
  const m = blocoModelo(modeloComponenteBruto);

  if (!m.usado) {
    return `<div class="pergunta-bloco"><div class="significado">${m.motivo || "Nesta área, o modelo não superou a repartição pela taxa média; o mapa usa a repartição simples."}</div></div>`;
  }

  const ganhoResp = `razão ${formatar(m.ganho.razao, 2)} (IC ${formatar(m.ganho.ic?.[0], 2)}–${formatar(m.ganho.ic?.[1], 2)})`;
  const ordemResp = `Spearman modelo ${formatar(m.ordem.spearman_modelo, 2)} · linha de base ${formatar(m.ordem.spearman_base, 2)} · top 20% ${formatarPercentual(m.ordem.top20_modelo * 100, 0)}`;
  const calibResp = `inclinação ${formatar(m.calibracao.inclinacao, 2)} (IC ${formatar(m.calibracao.ic_inclinacao?.[0], 2)}–${formatar(m.calibracao.ic_inclinacao?.[1], 2)})`;
  const viesResp = (m.vies ?? []).map((v) => `${v.grupo} (${v.grupo_tipo}): ${formatar(v.razao_somas, 2)}`).join(" · ");
  const curvasResp = renderizarCurvas(m.curvas, m.importancia);
  const confiancaResp = `Moran dos resíduos I=${formatar(m.confianca.moran_residuos?.I, 2)} (p=${formatar(m.confianca.moran_residuos?.p, 2)}) · cobertura (d): modelo ${formatarPercentual(m.confianca.cobertura_d?.modelo * 100, 0)}, base ${formatarPercentual(m.confianca.cobertura_d?.base * 100, 0)}`;

  const respostas = { ganho: ganhoResp, ordem: ordemResp, calibracao: calibResp, vies: viesResp, curvas: curvasResp, confianca: confiancaResp };
  return BLOCOS_MODELO.map((b) => linhaPergunta(b.titulo, respostas[b.chave], b.significado, { recolhido: b.recolhido })).join("");
}

function renderizarModelo(el, modeloComponenteBruto) {
  el.innerHTML = montarModeloHtml(modeloComponenteBruto);
}

export function renderizarCurvas(curvas, importancia) {
  if (!curvas?.length) return "<span class='empty'>Sem curvas registradas.</span>";
  const W = 220;
  const H = 70;
  const m = { l: 8, r: 8, t: 8, b: 18 };
  return curvas
    .map((c) => {
      const semFaixa = c.desvio == null;
      const y = d3.scaleLinear().domain(d3.extent([c.escore - (c.desvio ?? 0), c.escore + (c.desvio ?? 0)])).nice().range([H - m.b, m.t]);
      const cy = y(c.escore);
      const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Curva de forma: ${c.rotulo}">
        <line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="${css("--line")}" stroke-dasharray="2,3"/>
        ${!semFaixa ? `<line x1="${W / 2}" x2="${W / 2}" y1="${y(c.escore - c.desvio)}" y2="${y(c.escore + c.desvio)}" stroke="${css("--accent")}" stroke-width="3" opacity="0.5"/>` : ""}
        <circle cx="${W / 2}" cy="${cy}" r="4" fill="${css("--ink")}"/>
      </svg>`;
      return `<div class="comp-row" style="grid-template-columns:120px 1fr 60px"><span>${c.rotulo} <span class="sub">(${c.nivel})</span></span>${svg}<span class="num" style="text-align:right">${formatar(c.escore, 2)}</span></div>${
        semFaixa ? `<div class="sub">faixa de oscilação não calculada nesta edição</div>` : ""
      }`;
    })
    .join("") + `<div class="sub" style="margin-top:6px">Importância: ${(importancia ?? []).map((i) => `${i.rotulo} (${formatar(i.valor, 2)})`).join(" · ")}</div>`;
}

function renderizarHeatmap(el, spearman) {
  el.innerHTML = Object.entries(spearman)
    .map(([comp, { periodos, matriz }]) => {
      const cel = (i, j) => {
        const v = matriz[i][j];
        const cor = v == null ? css("--line") : d3.interpolateRgb(css("--warn-soft"), css("--accent"))(Math.max(0, v));
        return `<td style="background:${cor};text-align:center;padding:4px;font-size:11px" data-num="${v ?? ""}">${v == null ? "—" : formatar(v, 2)}</td>`;
      };
      return `<div class="sub" style="margin-top:8px">${CLAB[comp] ?? comp}</div>
        <table class="ponte"><thead><tr><th></th>${periodos.map((p) => `<th>${p}</th>`).join("")}</tr></thead>
        <tbody>${periodos.map((p, i) => `<tr><th>${p}</th>${periodos.map((_p, j) => cel(i, j)).join("")}</tr>`).join("")}</tbody></table>`;
    })
    .join("");
}

function renderizarRazoes(el, razoes) {
  const porComponente = d3.group(razoes, (r) => r.componente);
  el.innerHTML = [...porComponente.entries()]
    .map(([comp, linhas]) => {
      const limite = limiteEixoP99(linhas.flatMap((l) => [l.p95, l.razao_total]));
      const W = 200;
      const H = 90;
      const m = { l: 28, r: 6, t: 6, b: 16 };
      const x = d3.scaleBand().domain(linhas.map((l) => l.periodo)).range([m.l, W - m.r]).padding(0.3);
      const y = d3.scaleLinear().domain([0, Math.max(limite * 1.1, 1)]).range([H - m.b, m.t]);
      const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Razão do total por hexágono, ${CLAB[comp]}">
        <line x1="${m.l}" x2="${W - m.r}" y1="${y(1)}" y2="${y(1)}" stroke="${css("--line")}" stroke-dasharray="2,3"/>
        ${linhas
          .map(
            (l) => `<line x1="${x(l.periodo) + x.bandwidth() / 2}" x2="${x(l.periodo) + x.bandwidth() / 2}" y1="${y(Math.min(l.p95, limite))}" y2="${y(Math.min(l.p5, limite))}" stroke="${css("--ink")}" stroke-width="2"/>
                <circle cx="${x(l.periodo) + x.bandwidth() / 2}" cy="${y(Math.min(l.mediana, limite))}" r="3" fill="${css("--accent")}"><title>${l.periodo}: mediana ${formatar(l.mediana, 2)}, razão dos totais ${formatar(l.razao_total, 2)}, n=${l.n_hexagonos}</title></circle>`
          )
          .join("")}
        ${linhas.map((l) => `<text x="${x(l.periodo) + x.bandwidth() / 2}" y="${H - 4}" text-anchor="middle" font-size="9">${l.periodo}</text>`).join("")}
      </svg>`;
      return `<div class="mini"><h4>${CLAB[comp] ?? comp}</h4>${svg}</div>`;
    })
    .join("");
}

function renderizarAchados(el, achados) {
  const grupos = achadosPublicos(achados);
  el.innerHTML = grupos
    .map(
      (g) => `<div class="achados-grupo"><h3>${g.situacao}</h3>${g.itens
        .map((a) => `<div class="achado-item">${a.texto}<div class="efeito">${a.efeito}</div></div>`)
        .join("")}</div>`
    )
    .join("");
}

export async function iniciarConfiabilidade() {
  const painel = $("pane-confiabilidade");
  if (!painel) return;

  const catalogo = await carregarJSON(".", "catalogo.json");
  const { edicao } = escolherDominioEEdicao(catalogo);
  const [manifesto, qualidade, modelo, consistencia, achados] = await Promise.all([
    carregarJSON(edicao.origem, "manifesto.json"),
    carregarJSON(edicao.origem, "qualidade.json"),
    carregarJSON(edicao.origem, "modelo.json"),
    carregarJSON(edicao.origem, "consistencia.json"),
    carregarJSON(edicao.origem, "achados.json"),
  ]);

  renderizarFontes($("f3-fontes-timeline"), qualidade, manifesto);
  renderizarSigilo($("f3-sigilo-cartoes"), qualidade.sigilo);
  renderizarAps($("f3-aps-cartoes"), qualidade.aps);
  renderizarPonte($("f3-ponte-tabela"), qualidade.ponte);
  renderizarLacunas($("f3-lacunas"), qualidade.lacunas);
  renderizarHeatmap($("f3-heatmap"), consistencia.spearman);
  renderizarRazoes($("f3-razoes"), consistencia.razoes);
  renderizarAchados($("f3-achados"), achados);

  const segComp = $("f3-seg-comp");
  function atualizarModelo(componente) {
    segComp.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === componente)));
    renderizarModelo($("f3-modelo-blocos"), modelo[componente]);
  }
  segComp.querySelectorAll("button").forEach((b) => (b.onclick = () => atualizarModelo(b.dataset.v)));
  atualizarModelo("coabitacao");
}
