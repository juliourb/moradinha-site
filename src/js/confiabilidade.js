// Composição da aba Confiabilidade (SPEC_F3, restruturada pela SPEC_F6 §6).
import * as d3 from "d3";
import { carregarJSON, escolherDominioEEdicao } from "./dados/pacote.js";
import {
  BLOCOS_MODELO, CLAB, blocoModelo, achadosPublicos, limiteEixoP99,
  veredictoPergunta1, veredictoPergunta2, veredictoPergunta3, veredictoPergunta4, matrizOqueFalta,
} from "./dados/confiabilidade.js";
import { fjpTresValores } from "./dados/visaoGeral.js";
import { rotuloMarca, rotuloFonteEstoque } from "./util/marcas.js";
import { rotulo } from "./util/rotulos.js";
import { formatar, formatarPercentual } from "./util/formato.js";

const NOME_INDICADOR_FJP = { total: "Total", habitacao_precaria: "Habitação precária", coabitacao: "Coabitação", onus: "Ônus excessivo com aluguel", domicilios: "Domicílios" };

function $(id) {
  return document.getElementById(id);
}
function css(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

function renderizarFontes(el, manifesto) {
  el.innerHTML = `<div class="timeline-fontes">${manifesto.periodos
    .map((p) => {
      const fonte = rotuloFonteEstoque(p.fonte_estoque);
      const troca = p.marcas?.includes("fonte_estoque_diferente") || p.marcas?.includes("media_inclui_fonte_diferente");
      const marcasTxt = (p.marcas ?? []).map((m) => rotuloMarca(m)).join("; ");
      return `<span class="passo${troca ? " troca" : ""}" title="${p.rotulo}: ${fonte}${marcasTxt ? ` — ${marcasTxt}` : ""}">${p.rotulo}: ${fonte}</span>`;
    })
    .join("")}</div>`;
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

function renderizarCnefe(el, cnefe) {
  if (!cnefe) {
    el.innerHTML = `<p class="empty">Sem dado de CNEFE neste pacote.</p>`;
    return;
  }
  el.innerHTML = `
    <div class="cartao-f3"><div class="k">Endereços</div><div class="v" data-num="${cnefe.enderecos}">${formatar(cnefe.enderecos, 0)}</div></div>
    <div class="cartao-f3"><div class="k">Hexágonos sem endereço</div><div class="v" data-num="${cnefe.hex_sem_endereco}">${formatar(cnefe.hex_sem_endereco, 0)}</div>
      <div class="sub">${formatar(cnefe.domicilios_nesses_hex, 0)} domicílios nesses hexágonos</div></div>
    <div class="cartao-f3"><div class="k">Correlação com o hexágono</div><div class="v" data-num="${cnefe.correlacao_hex}">${formatar(cnefe.correlacao_hex, 2)}</div></div>`;
}

/** FJP × moradinha (N8/N9), nos mesmos três valores da Visão geral, para a seção "Números de partida". */
function renderizarFjpConfiabilidade(el, referenciaFjp) {
  const itens = fjpTresValores(referenciaFjp ?? []);
  if (!itens.length) {
    el.innerHTML = `<p class="empty">Sem referência da FJP neste pacote.</p>`;
    return;
  }
  const anoRef = itens[0]?.ano_ref;
  el.innerHTML = `<p class="sub">Comparação com a FJP${anoRef != null ? `, ${anoRef}` : ""}.</p><table class="ponte"><thead><tr><th>Indicador</th><th>FJP publicado</th><th>Parte do CadÚnico</th><th>FJP sem CadÚnico</th><th>Cai na faixa de 95%?</th></tr></thead><tbody>${itens
    .map(
      (item) => `<tr>
        <td>${NOME_INDICADOR_FJP[item.indicador] ?? rotulo(item.indicador)}</td>
        <td data-num="${item.fjp_publicado ?? ""}">${item.fjp_publicado == null ? "a preencher" : formatar(item.fjp_publicado, 0)}</td>
        <td data-num="${item.cadUnico}">${formatar(item.cadUnico, 0)}</td>
        <td data-num="${item.semCadUnico ?? ""}">${formatar(item.semCadUnico, 0)}</td>
        <td>${item.dentro == null ? "—" : item.dentro ? "dentro" : "fora"}</td>
      </tr>`
    )
    .join("")}</tbody></table>`;
}

/** Matriz "o que falta" (N12): variável × período, em linguagem simples. */
function renderizarOqueFalta(el, qualidade, manifesto) {
  const matriz = matrizOqueFalta(qualidade, manifesto);
  if (!matriz.length) {
    el.innerHTML = `<p class="empty">Sem lacunas registradas neste pacote.</p>`;
    return;
  }
  el.innerHTML = `<table class="grade-oquefalta"><thead><tr><th>Variável</th>${manifesto.periodos
    .map((p) => `<th>${p.rotulo}</th>`)
    .join("")}</tr></thead><tbody>${matriz
    .map((linha) => `<tr><td>${rotulo(linha.variavel)}</td>${linha.celulas.map((c) => `<td>${c.uso}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

const SECOES_VEREDITOS = ["f3-secao-dados", "f3-secao-modelo", "f3-secao-consistencia", "f3-secao-achados"];
let secaoAtual = 0;

function irParaSecao(indice) {
  const i = Math.max(0, Math.min(SECOES_VEREDITOS.length - 1, indice));
  secaoAtual = i;
  const el = $(SECOES_VEREDITOS[i]);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
  el?.focus();
}

function classeVeredicto(v) {
  if (v === "sim" || v === "bate") return "ok";
  if (v === "em parte") return "warn";
  if (v === "não" || v === "não bate") return "crit";
  return "";
}

/** Painel de vereditos (B1): grade de perguntas × componentes, com número e navegação (SPEC_F6 §6). */
function renderizarVereditos(el, { qualidade, referenciaFjp, modelo, manifesto, totais, achados }) {
  const componentes = ["coabitacao", "onus", "precariedade"];
  const linhas = [
    { pergunta: "1. Os números de partida batem?", secaoIdx: 0, cels: componentes.map((c) => ({ c, ...veredictoPergunta1(qualidade, referenciaFjp, c) })), fmt: (n) => (n == null ? "—" : formatar(n, 2)) },
    { pergunta: "2. O modelo põe o déficit no lugar certo?", secaoIdx: 1, cels: componentes.map((c) => ({ c, ...veredictoPergunta2(modelo[c]) })), fmt: (n) => (n == null ? "—" : formatarPercentual(n, 0)) },
    { pergunta: "3. A série é comparável entre anos?", secaoIdx: 2, cels: componentes.map((c) => ({ c, ...veredictoPergunta3(manifesto, totais, c) })), fmt: (_n, cel) => (cel.marcados == null ? "—" : `${cel.marcados}/${cel.total}`) },
  ];
  const p4 = veredictoPergunta4(achados);

  const linhasHtml = linhas
    .map(
      (l) => `<tr><th scope="row">${l.pergunta}</th>${l.cels
        .map(
          (cel) => `<td><button type="button" class="vereditocel ${classeVeredicto(cel.veredicto)}" data-secao="${l.secaoIdx}" ${
            cel.usado === false && cel.motivo ? `title="Não adotado: ${cel.motivo}"` : ""
          }>
            <span class="palavra">${cel.veredicto ?? "—"}</span>
            <span class="numero">${l.fmt(cel.numero, cel)}</span>
          </button></td>`
        )
        .join("")}</tr>`
    )
    .join("");

  el.innerHTML = `<table class="grade-vereditos"><thead><tr><th></th>${componentes.map((c) => `<th>${CLAB[c]}</th>`).join("")}</tr></thead>
    <tbody>${linhasHtml}
      <tr><th scope="row">4. O que ainda não sabemos</th><td colspan="${componentes.length}"><button type="button" class="vereditocel" data-secao="3"><span class="numero">${formatar(p4.numero, 0)} achados públicos</span></button></td></tr>
    </tbody></table>`;

  el.querySelectorAll("button[data-secao]").forEach((b) => {
    b.onclick = () => irParaSecao(Number(b.dataset.secao));
  });

  return { veredictoPergunta1Cels: linhas[0].cels, veredictoPergunta2Cels: linhas[1].cels, veredictoPergunta3Cels: linhas[2].cels };
}

function ligarNavegacaoSecoes() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") irParaSecao(secaoAtual + 1);
    else if (e.key === "ArrowLeft") irParaSecao(secaoAtual - 1);
  });
}

/** Frase-resposta de uma pergunta (topo de cada seção), a partir dos vereditos por componente. */
function fraseResposta(cels, rotuloVerbo) {
  const partes = cels.map((c) => `${CLAB[c.c]} ${c.veredicto ?? "—"}`);
  return `${rotuloVerbo}: ${partes.join("; ")}.`;
}

function linhaPergunta(titulo, respostaHtml, significado, { recolhido = false } = {}) {
  const corpo = `<div class="resposta">${respostaHtml}</div><div class="significado">${significado}</div>`;
  if (recolhido) {
    return `<details class="pergunta-bloco"><summary>${titulo}</summary>${corpo}</details>`;
  }
  return `<div class="pergunta-bloco"><h4>${titulo}</h4>${corpo}</div>`;
}

/** Calibração por decis (N15): gráfico previsto × observado com a diagonal. */
export function renderizarCalibracaoDecis(decis) {
  if (!decis?.length) return "";
  const W = 180;
  const H = 180;
  const m = { l: 32, r: 8, t: 8, b: 24 };
  const max = d3.max(decis, (d) => Math.max(d.previsto, d.observado)) || 1;
  const x = d3.scaleLinear().domain([0, max * 1.05]).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, max * 1.05]).range([H - m.b, m.t]);
  const pontos = decis
    .map((d) => `<circle cx="${x(d.previsto)}" cy="${y(d.observado)}" r="3.5" fill="${css("--accent")}"><title>decil ${d.decil}: previsto ${formatar(d.previsto, 1)}, observado ${formatar(d.observado, 1)}</title></circle>`)
    .join("");
  const ticks = d3.ticks(0, max, 4);
  const eixoY = ticks
    .map((t) => `<text x="${m.l - 4}" y="${y(t)}" text-anchor="end" dominant-baseline="middle" font-size="9">${formatar(t, 0)}</text>`)
    .join("");
  return `<div class="sub" style="margin-top:6px">Previsto × observado, por decil:</div><svg viewBox="0 0 ${W} ${H}" width="180" height="180" role="img" aria-label="Calibração por decis: previsto contra observado">
    <line x1="${x(0)}" y1="${y(0)}" x2="${x(max)}" y2="${y(max)}" stroke="${css("--line")}" stroke-dasharray="3,3"/>
    ${eixoY}
    ${pontos}
  </svg>`;
}

/** Viés com destaque (N15): pílula marcada para todo grupo fora de 0,90–1,10, inclusive municípios. */
export function renderizarViesComDestaque(vies) {
  if (!vies?.length) return "<span class='empty'>Sem grupos de viés registrados.</span>";
  return vies
    .map((v) => {
      const fora = v.razao_somas < 0.9 || v.razao_somas > 1.1;
      return `<span class="vies-pill${fora ? " fora" : ""}" title="${v.grupo_tipo}">${v.grupo}: ${formatar(v.razao_somas, 2)}</span>`;
    })
    .join(" ");
}

/** Monta o HTML dos blocos do modelo — função pura (testável sem DOM). */
export function montarModeloHtml(modeloComponenteBruto) {
  const m = blocoModelo(modeloComponenteBruto);

  if (!m.usado) {
    return `<div class="pergunta-bloco"><div class="significado">${m.motivo || "Nesta área, o modelo não superou a repartição pela taxa média; o mapa usa a repartição simples."}</div></div>`;
  }

  const ganhoResp = `razão ${formatar(m.ganho.razao, 2)} (IC ${formatar(m.ganho.ic?.[0], 2)}–${formatar(m.ganho.ic?.[1], 2)})`;
  const ordemResp = `Spearman modelo ${formatar(m.ordem.spearman_modelo, 2)} · linha de base ${formatar(m.ordem.spearman_base, 2)} · top 20% ${formatarPercentual(m.ordem.top20_modelo * 100, 0)}`;
  const calibResp = `inclinação ${formatar(m.calibracao.inclinacao, 2)} (IC ${formatar(m.calibracao.ic_inclinacao?.[0], 2)}–${formatar(m.calibracao.ic_inclinacao?.[1], 2)})${renderizarCalibracaoDecis(m.calibracao.decis)}`;
  const viesResp = renderizarViesComDestaque(m.vies);
  // N15/B1: as curvas ficam recolhidas, sem as linhas cruas — só a nota e a importância (pendência F7).
  const curvasResp = `<div class="sub">Os nomes das categorias entram na próxima edição (pendência F7).</div><div class="sub" style="margin-top:6px">Importância: ${formatarListaImportancia(m.importancia)}</div>`;
  const dobrasResp = (m.confianca.dobras ?? [])
    .map((d) => `dobra ${d.dobra}: erro ${formatar(d.razao_erro, 2)} · Spearman ${formatar(d.spearman, 2)}`)
    .join(" · ");
  const confiancaResp = `${dobrasResp ? `<div class="sub">${dobrasResp}</div>` : ""}Moran dos resíduos I=${formatar(m.confianca.moran_residuos?.I, 2)} (p=${formatar(m.confianca.moran_residuos?.p, 2)}) · cobertura (d): modelo ${formatarPercentual(m.confianca.cobertura_d?.modelo * 100, 0)}, base ${formatarPercentual(m.confianca.cobertura_d?.base * 100, 0)}`;

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
    .join("") + `<div class="sub" style="margin-top:6px">Importância: ${formatarListaImportancia(importancia)}</div>`;
}

/** Importância de cada termo em % da soma das importâncias do componente (N14). */
export function formatarImportancia(valor, soma) {
  if (valor == null || !soma) return formatar(null);
  const pct = (100 * valor) / soma;
  return pct < 0.1 ? "< 0,1%" : `${formatar(pct, 1)}%`;
}

function formatarListaImportancia(importancia) {
  const lista = importancia ?? [];
  const soma = lista.reduce((s, i) => s + (i.valor ?? 0), 0);
  return lista.map((i) => `${i.rotulo} (${formatarImportancia(i.valor, soma)})`).join(" · ");
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

/** Razão do total por hexágono (ano ÷ 2022), com eixo e rótulos sem sobreposição (N16). */
function renderizarRazoes(el, razoes) {
  const porComponente = d3.group(razoes, (r) => r.componente);
  el.innerHTML = [...porComponente.entries()]
    .map(([comp, linhas]) => {
      const limite = limiteEixoP99(linhas.flatMap((l) => [l.p95, l.razao_total]));
      const W = 260;
      const H = 120;
      const m = { l: 34, r: 8, t: 6, b: 28 };
      const x = d3.scaleBand().domain(linhas.map((l) => l.periodo)).range([m.l, W - m.r]).padding(0.35);
      const y = d3.scaleLinear().domain([0, Math.max(limite * 1.1, 1)]).nice().range([H - m.b, m.t]);
      const ticksY = d3.ticks(0, y.domain()[1], 4);
      const eixoY = ticksY.map((t) => `<text x="${m.l - 4}" y="${y(t)}" text-anchor="end" dominant-baseline="middle" font-size="9">${formatar(t, 1)}</text>`).join("");
      const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Razão do total por hexágono, ${CLAB[comp]}">
        ${eixoY}
        <line x1="${m.l}" x2="${W - m.r}" y1="${y(1)}" y2="${y(1)}" stroke="${css("--line")}" stroke-dasharray="2,3"/>
        ${linhas
          .map(
            (l) => `<line x1="${x(l.periodo) + x.bandwidth() / 2}" x2="${x(l.periodo) + x.bandwidth() / 2}" y1="${y(Math.min(l.p95, limite))}" y2="${y(Math.min(l.p5, limite))}" stroke="${css("--ink")}" stroke-width="2"/>
                <circle cx="${x(l.periodo) + x.bandwidth() / 2}" cy="${y(Math.min(l.mediana, limite))}" r="3" fill="${css("--accent")}"><title>${l.periodo}: mediana ${formatar(l.mediana, 2)}, razão dos totais ${formatar(l.razao_total, 2)}, n=${l.n_hexagonos}</title></circle>`
          )
          .join("")}
        ${linhas.map((l) => `<text x="${x(l.periodo) + x.bandwidth() / 2}" y="${H - 6}" text-anchor="middle" font-size="9">${l.periodo}</text>`).join("")}
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
  const [manifesto, qualidade, modelo, consistencia, achados, totais, referenciaFjp] = await Promise.all([
    carregarJSON(edicao.origem, "manifesto.json"),
    carregarJSON(edicao.origem, "qualidade.json"),
    carregarJSON(edicao.origem, "modelo.json"),
    carregarJSON(edicao.origem, "consistencia.json"),
    carregarJSON(edicao.origem, "achados.json"),
    carregarJSON(edicao.origem, "totais.json"),
    carregarJSON(edicao.origem, "referencia_fjp.json"),
  ]);

  renderizarFjpConfiabilidade($("f3-fjp"), referenciaFjp);
  renderizarPonte($("f3-ponte-tabela"), qualidade.ponte);
  renderizarFontes($("f3-fontes-timeline"), manifesto);
  renderizarSigilo($("f3-sigilo-cartoes"), qualidade.sigilo);
  renderizarCnefe($("f3-cnefe-cartoes"), qualidade.cnefe);
  renderizarAps($("f3-aps-cartoes"), qualidade.aps);
  renderizarHeatmap($("f3-heatmap"), consistencia.spearman);
  renderizarRazoes($("f3-razoes"), consistencia.razoes);
  renderizarAchados($("f3-achados"), achados);
  renderizarOqueFalta($("f3-oquefalta"), qualidade, manifesto);

  const { veredictoPergunta1Cels, veredictoPergunta2Cels, veredictoPergunta3Cels } = renderizarVereditos($("f3-grade-vereditos"), {
    qualidade, referenciaFjp, modelo, manifesto, totais, achados,
  });
  $("f3-resposta-1").textContent = fraseResposta(veredictoPergunta1Cels, "Batem");
  $("f3-resposta-2").textContent = fraseResposta(veredictoPergunta2Cels, "Lugar certo");
  $("f3-resposta-3").textContent = fraseResposta(veredictoPergunta3Cels, "Comparável");
  $("f3-resposta-4").textContent = `${veredictoPergunta4(achados).numero} achado(s) público(s) registrado(s).`;
  ligarNavegacaoSecoes();

  const segComp = $("f3-seg-comp");
  function atualizarModelo(componente) {
    segComp.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === componente)));
    renderizarModelo($("f3-modelo-blocos"), modelo[componente]);
  }
  segComp.querySelectorAll("button").forEach((b) => (b.onclick = () => atualizarModelo(b.dataset.v)));
  atualizarModelo("coabitacao");
}
