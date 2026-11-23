// Composição da aba Confiabilidade (SPEC_F3, restruturada pela SPEC_F6 §6).
import * as d3 from "d3";
import { carregarJSON, escolherDominioEEdicao } from "./dados/pacote.js";
import {
  BLOCOS_MODELO, CLAB, blocoModelo, achadosPublicos, limiteEixoP99,
  veredictoPergunta1, veredictoPergunta2, veredictoPergunta3, veredictoPergunta4, matrizOqueFalta,
  ESCALA_SPEARMAN, posicaoSpearman, fraseAnoMenosParecido, spearmanContraBase,
} from "./dados/confiabilidade.js";
import { instalarAjudas, ligarDicaPorAtributos, marcarGrafico, attr } from "./ui/ajuda.js";
import { renderizarFjp } from "./ui/fjp.js";
import { rotuloMarca, rotuloFonteEstoque } from "./util/marcas.js";
import { rotulo } from "./util/rotulos.js";
import { formatar, formatarPercentual, rotuloCurto } from "./util/formato.js";

const NOME_INDICADOR_FJP = { total: "Total", habitacao_precaria: "Habitação precária", precariedade: "Precariedade", coabitacao: "Coabitação", onus: "Ônus excessivo com aluguel", domicilios: "Domicílios" };

/** Atributos da caixa de valor (F6.5 4d) para tabelas e blocos de números. */
function dica(titulo, valor, base) {
  return `data-dica-titulo="${attr(titulo)}" data-dica-valor="${attr(valor)}"${base ? ` data-dica-base="${attr(base)}"` : ""}`;
}

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
      return `<span class="passo${troca ? " troca" : ""}" ${dica(p.rotulo, fonte, marcasTxt || null)}>${p.rotulo}: ${fonte}</span>`;
    })
    .join("")}</div>`;
  marcarGrafico(el, "tabela-fontes");
}

function renderizarSigilo(el, sigilo) {
  el.innerHTML = `
    <div class="cartao-f3" ${dica("Sem dado (sigilo total)", `${formatar(sigilo.hex_sem_dado, 0)} hexágonos`, "hexágonos sem nenhum dado publicável")}><div class="k">Sem dado (sigilo total)</div><div class="v" data-num="${sigilo.hex_sem_dado}">${formatar(sigilo.hex_sem_dado, 0)} hexágonos</div></div>
    <div class="cartao-f3" ${dica("Parte em sigilo", `${formatar(sigilo.hex_parcial, 0)} hexágonos`, "hexágonos com alguma parte em sigilo")}><div class="k">Parte em sigilo</div><div class="v" data-num="${sigilo.hex_parcial}">${formatar(sigilo.hex_parcial, 0)} hexágonos</div></div>`;
  marcarGrafico(el, "cartoes-sigilo");
}

function renderizarAps(el, aps) {
  el.innerHTML = aps
    .map(
      (a) => `<div class="cartao-f3" ${dica(CLAB[a.componente] ?? a.componente, `${formatar(a.n_aps, 0)} APs`, `${formatar(a.n_ressalva, 0)} com ressalva · ${formatar(a.n_sem_direta, 0)} sem amostra direta`)}><div class="k">${CLAB[a.componente] ?? a.componente}</div>
        <div class="v" data-num="${a.n_aps}">${formatar(a.n_aps, 0)} APs</div>
        <div class="sub">${formatar(a.n_ressalva, 0)} com ressalva · ${formatar(a.n_sem_direta, 0)} sem amostra direta</div></div>`
    )
    .join("");
  marcarGrafico(el, "cartoes-aps");
}

function renderizarPonte(el, ponte) {
  el.innerHTML = `<table class="ponte"><thead><tr><th>Indicador</th><th>PNADc</th><th>Censo</th><th>Razão</th><th>Leitura</th></tr></thead><tbody>${ponte
    .map(
      (p) => `<tr ${dica(NOME_INDICADOR_FJP[p.indicador] ?? rotulo(p.indicador), `PNADc ${p.pnadc == null ? "—" : formatar(p.pnadc, 1)} · Censo ${p.censo == null ? "—" : formatar(p.censo, 1)} · razão ${p.razao == null ? "—" : formatar(p.razao, 2)}`, p.leitura)}>
        <td>${NOME_INDICADOR_FJP[p.indicador] ?? rotulo(p.indicador)}</td>
        <td data-num="${p.pnadc ?? ""}">${p.pnadc == null ? "—" : `${formatar(p.pnadc, 1)} (EP ${formatar(p.pnadc_ep, 1)})`}</td>
        <td data-num="${p.censo ?? ""}">${p.censo == null ? "—" : formatar(p.censo, 1)}</td>
        <td data-num="${p.razao ?? ""}">${p.razao == null ? "—" : formatar(p.razao, 2)}</td>
        <td class="sub">${p.leitura}</td>
      </tr>`
    )
    .join("")}</tbody></table>`;
  marcarGrafico(el, "tabela-ponte");
}

function renderizarCnefe(el, cnefe) {
  if (!cnefe) {
    el.innerHTML = `<p class="empty">Sem dado de CNEFE neste pacote.</p>`;
    return;
  }
  el.innerHTML = `
    <div class="cartao-f3" ${dica("Endereços", formatar(cnefe.enderecos, 0), "endereços do CNEFE no domínio")}><div class="k">Endereços</div><div class="v" data-num="${cnefe.enderecos}">${formatar(cnefe.enderecos, 0)}</div></div>
    <div class="cartao-f3" ${dica("Hexágonos sem endereço", formatar(cnefe.hex_sem_endereco, 0), `${formatar(cnefe.domicilios_nesses_hex, 0)} domicílios nesses hexágonos`)}><div class="k">Hexágonos sem endereço</div><div class="v" data-num="${cnefe.hex_sem_endereco}">${formatar(cnefe.hex_sem_endereco, 0)}</div>
      <div class="sub">${formatar(cnefe.domicilios_nesses_hex, 0)} domicílios nesses hexágonos</div></div>
    <div class="cartao-f3" ${dica("Correlação com o hexágono", formatar(cnefe.correlacao_hex, 2), "correlação entre endereços e domicílios por hexágono")}><div class="k">Correlação com o hexágono</div><div class="v" data-num="${cnefe.correlacao_hex}">${formatar(cnefe.correlacao_hex, 2)}</div></div>`;
  marcarGrafico(el, "cartoes-cnefe");
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
    .map((linha) => `<tr><td>${rotulo(linha.variavel)}</td>${linha.celulas.map((c, i) => `<td ${dica(`${rotulo(linha.variavel)} · ${manifesto.periodos[i]?.rotulo ?? ""}`, c.uso)}>${c.uso}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
  marcarGrafico(el, "tabela-oquefalta");
}

const SECOES_VEREDITOS = ["f3-secao-dados", "f3-secao-modelo", "f3-secao-consistencia", "f3-secao-achados"];
// F6.5 4a/4f: a seção 1 já vem aberta (a página nunca fica sem texto). Abre uma, fecha as
// outras. Clicar de novo na célula aberta NÃO fecha; só outra célula, o menu, as setas ou
// o título da seção trocam ou fecham.
let secaoAtual = 0;
let celulaAtual = null;

function sincronizarSecoes() {
  SECOES_VEREDITOS.forEach((id, i) => {
    const el = $(id);
    if (!el) return;
    el.hidden = i !== secaoAtual;
  });
  // Destaque da seleção (F6.5 5): exatamente uma célula do painel e um item do menu.
  const botoes = [...document.querySelectorAll("button[data-secao]")];
  const daSecao = botoes.filter((b) => Number(b.dataset.secao) === secaoAtual);
  const escolhida = daSecao.includes(celulaAtual) ? celulaAtual : daSecao[0] ?? null;
  botoes.forEach((b) => {
    b.setAttribute("aria-expanded", String(b === escolhida));
    if (b === escolhida) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  });
  document.querySelectorAll(".nav-lateral a").forEach((a) => {
    if (SECOES_VEREDITOS[secaoAtual] && a.hash === `#${SECOES_VEREDITOS[secaoAtual]}`) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  });
}

function irParaSecao(indice, { celula = null, rolar = true } = {}) {
  const i = Math.max(0, Math.min(SECOES_VEREDITOS.length - 1, indice));
  secaoAtual = i;
  celulaAtual = celula;
  sincronizarSecoes();
  const el = $(SECOES_VEREDITOS[i]);
  if (rolar) el?.scrollIntoView({ behavior: "smooth", block: "start" });
  el?.focus({ preventScroll: true });
}

function fecharSecao() {
  secaoAtual = null;
  celulaAtual = null;
  sincronizarSecoes();
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
    b.onclick = () => irParaSecao(Number(b.dataset.secao), { celula: b });
  });

  return { veredictoPergunta1Cels: linhas[0].cels, veredictoPergunta2Cels: linhas[1].cels, veredictoPergunta3Cels: linhas[2].cels };
}

function ligarNavegacaoSecoes() {
  document.addEventListener("keydown", (e) => {
    if (secaoAtual == null || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? "")) return;
    if (e.key === "ArrowRight") irParaSecao(secaoAtual + 1);
    else if (e.key === "ArrowLeft") irParaSecao(secaoAtual - 1);
  });
  // O main.js reescreve os href internos com a consulta da página; por isso se usa a.hash.
  document.querySelectorAll(".nav-lateral a").forEach((a) => {
    a.addEventListener("click", (e) => {
      const i = SECOES_VEREDITOS.indexOf(a.hash.slice(1));
      if (i < 0) return;
      e.preventDefault();
      irParaSecao(i);
    });
  });
  // O título da seção aberta a fecha (botão acessível).
  SECOES_VEREDITOS.forEach((id) => {
    const h2 = $(id)?.querySelector("h2");
    if (!h2) return;
    h2.style.cursor = "pointer";
    h2.title = "Clique no título para fechar esta seção";
    h2.onclick = (e) => {
      if (e.target.closest("a")) return;
      fecharSecao();
    };
    // Equivalente por teclado (o título tem o link de âncora do Quarto, então não vira botão).
    const fechar = document.createElement("button");
    fechar.type = "button";
    fechar.className = "iconbtn secao-fechar";
    fechar.textContent = "Fechar seção ×";
    fechar.onclick = fecharSecao;
    h2.insertAdjacentElement("afterend", fechar);
  });
  const hash = SECOES_VEREDITOS.indexOf(window.location.hash.slice(1));
  irParaSecao(hash >= 0 ? hash : 0, { rolar: hash >= 0 });
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
    .map((d) => `<circle cx="${x(d.previsto)}" cy="${y(d.observado)}" r="3.5" fill="${css("--accent")}"/><circle cx="${x(d.previsto)}" cy="${y(d.observado)}" r="9" fill="transparent" data-dica-titulo="decil ${attr(d.decil)}" data-dica-valor="previsto ${attr(formatar(d.previsto, 1))} · observado ${attr(formatar(d.observado, 1))}"/>`)
    .join("");
  const ticks = d3.ticks(0, max, 4);
  const eixoY = ticks
    .map((t) => `<text x="${m.l - 4}" y="${y(t)}" text-anchor="end" dominant-baseline="middle" font-size="9">${formatar(t, 0)}</text>`)
    .join("");
  return `<header class="graf-cab" style="margin-top:6px"><span class="sub">Previsto × observado, por decil</span></header><div class="grafico-dica">Cada ponto é um décimo das áreas, do que o modelo prevê menos ao que prevê mais: o eixo horizontal é o previsto e o vertical, o observado na amostra. Pontos sobre a linha tracejada = o modelo acerta o tamanho. Passe o mouse num ponto.</div><svg data-grafico="calibracao" viewBox="0 0 ${W} ${H}" width="180" height="180" role="img" aria-label="Calibração por decis: previsto contra observado">
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

/**
 * Erro e Spearman por dobra (F6.5 4e): dois painéis pequenos lado a lado, um ponto por
 * dobra, com a caixa de valor ao passar o mouse.
 */
export function graficoDobras(dobras) {
  if (!dobras?.length) return "";
  const W = 150;
  const H = 96;
  const m = { l: 30, r: 6, t: 8, b: 20 };
  const x = d3.scalePoint().domain(dobras.map((d) => d.dobra)).range([m.l + 8, W - m.r - 8]);
  const painel = (titulo, chave, dominio, fmt) => {
    const y = d3.scaleLinear().domain(dominio).nice().range([H - m.b, m.t]);
    const ticks = y.ticks(3);
    const eixo = ticks.map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="${css("--line")}" stroke-width="0.5"/><text x="${m.l - 4}" y="${y(v)}" text-anchor="end" dominant-baseline="middle" font-size="9">${fmt(v)}</text>`).join("");
    const eixoX = dobras.map((d) => `<text x="${x(d.dobra)}" y="${H - 6}" text-anchor="middle" font-size="9">${d.dobra}</text>`).join("");
    const pontos = dobras
      .map((d) => `<circle cx="${x(d.dobra)}" cy="${y(d[chave])}" r="3.5" fill="${css("--accent")}"/><rect x="${x(d.dobra) - 11}" y="${m.t}" width="22" height="${H - m.b - m.t}" fill="transparent" data-dica-titulo="dobra ${attr(d.dobra)}" data-dica-valor="erro ${attr(formatar(d.razao_erro, 2))} · Spearman ${attr(formatar(d.spearman, 2))}" data-dica-base="1 = o erro do modelo é igual ao da linha de base; abaixo de 1, o modelo erra menos"/>`)
      .join("");
    return `<div class="dobras-painel"><div class="sub">${titulo}</div><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${titulo} por dobra">${eixo}${eixoX}${pontos}</svg></div>`;
  };
  const erros = dobras.map((d) => d.razao_erro);
  const sps = dobras.map((d) => d.spearman);
  return `<header class="graf-cab"><span class="sub">Erro e Spearman por dobra</span></header><div class="grafico-dica">Cada ponto é uma dobra da validação (uma parte das áreas deixada de fora do treino). À esquerda, a razão do erro do modelo contra a linha de base (abaixo de 1, o modelo erra menos); à direita, o Spearman entre o previsto e o observado (quanto mais perto de 1, melhor a ordem). Passe o mouse num ponto.</div><div class="dobras-graficos" data-grafico="dobras">${painel("Razão do erro", "razao_erro", [Math.min(0, ...erros), Math.max(1, ...erros)], (v) => formatar(v, 1))}${painel("Spearman", "spearman", [Math.min(...sps), 1], (v) => formatar(v, 2))}</div>`;
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
  const confiancaResp = `${graficoDobras(m.confianca.dobras)}Moran dos resíduos I=${formatar(m.confianca.moran_residuos?.I, 2)} (p=${formatar(m.confianca.moran_residuos?.p, 2)}) · cobertura (d): modelo ${formatarPercentual(m.confianca.cobertura_d?.modelo * 100, 0)}, base ${formatarPercentual(m.confianca.cobertura_d?.base * 100, 0)}`;

  const respostas = { ganho: ganhoResp, ordem: ordemResp, calibracao: calibResp, vies: viesResp, curvas: curvasResp, confianca: confiancaResp };
  return BLOCOS_MODELO.map((b) => linhaPergunta(b.titulo, respostas[b.chave], b.significado, { recolhido: b.recolhido })).join("");
}

function renderizarModelo(el, modeloComponenteBruto) {
  el.innerHTML = montarModeloHtml(modeloComponenteBruto);
  instalarAjudas(el);
  ligarDicaPorAtributos(el);
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

/**
 * Spearman entre anos (F6.4 3b): três mapas de calor (escala fixa de 0,8 a 1,0,
 * valor na dica do mouse, anos de estoque de outra fonte destacados), uma frase
 * gerada do pacote e, ao lado, o Spearman de cada ano contra o primeiro ano.
 */
function renderizarHeatmap(el, spearman, manifesto) {
  const rotuloPeriodo = (id) => manifesto.periodos.find((p) => p.id === id)?.rotulo ?? id;
  const destaque = new Set(manifesto.periodos.filter((p) => p.marcas?.includes("fonte_estoque_diferente")).map((p) => p.id));
  const cor = (v) => (v == null ? css("--line") : d3.interpolateRgb(css("--warn-soft"), css("--accent"))(posicaoSpearman(v)));
  const matrizes = Object.entries(spearman)
    .map(([comp, { periodos, matriz }]) => {
      const cel = (i, j) => {
        const v = matriz[i][j];
        const dest = destaque.has(periodos[i]) || destaque.has(periodos[j]) ? " destaque-periodo" : "";
        return `<td class="hm-cel${dest}" style="background:${cor(v)} !important;color:var(--ink) !important" data-num="${v ?? ""}" data-dica-titulo="${attr(CLAB[comp] ?? comp)}: ${attr(rotuloPeriodo(periodos[i]))} × ${attr(rotuloPeriodo(periodos[j]))}" data-dica-valor="Spearman ${v == null ? "sem dado" : attr(formatar(v, 3))}" ${v != null && v < ESCALA_SPEARMAN.min ? 'data-dica-base="abaixo de 0,8 (fora da escala de cor)"' : ""}>${v == null ? "—" : formatar(v, 2)}</td>`;
      };
      const th = (p) => `<th class="${destaque.has(p) ? "destaque-periodo" : ""}">${rotuloCurto(rotuloPeriodo(p))}</th>`;
      return `<div class="hm-bloco"><header class="graf-cab"><h4>${CLAB[comp] ?? comp}</h4></header>
        <div class="grafico-dica">Cada célula compara dois períodos: o quanto a ordem dos hexágonos (quem tem mais ou menos déficit) se mantém entre eles. 1 = mesma ordem; cor mais forte = mais parecida. A escala de cor vai de 0,8 a 1,0. Os períodos com estoque de outra fonte estão destacados.</div>
        <table class="ponte hm" data-grafico="heatmap"><thead><tr><th></th>${periodos.map(th).join("")}</tr></thead>
        <tbody>${periodos.map((p, i) => `<tr>${th(p)}${periodos.map((_p, j) => cel(i, j)).join("")}</tr>`).join("")}</tbody></table></div>`;
    })
    .join("");
  const legenda = `<div class="hm-legenda" aria-label="Escala de cor do Spearman, de 0,8 a 1,0"><span>0,8 ou menos</span><span class="hm-rampa" style="background:linear-gradient(to right, ${css("--warn-soft")}, ${css("--accent")})"></span><span>1,0</span></div>`;
  const frase = fraseAnoMenosParecido(spearman, manifesto);
  el.innerHTML = `${frase ? `<p class="sub" id="f3-frase-spearman">${frase}</p>` : ""}${legenda}
    <div class="spearman-layout"><div class="hm-matrizes">${matrizes}</div><div class="hm-linhas" id="f3-spearman-linhas"></div></div>`;
  renderizarSpearmanLinhas($("f3-spearman-linhas"), spearman, manifesto);
  instalarAjudas(el);
  ligarDicaPorAtributos(el);
}

const COR_COMPONENTE = { coabitacao: "--accent", onus: "--warn", precariedade: "--ink" };

/** Linhas: Spearman de cada ano contra o primeiro ano, uma linha por componente. */
function renderizarSpearmanLinhas(el, spearman, manifesto) {
  const series = spearmanContraBase(spearman, manifesto);
  const todos = series.flatMap((sr) => sr.pontos.map((p) => p.valor));
  if (!todos.length) {
    el.innerHTML = "";
    return;
  }
  const base = series[0].base;
  const anos = manifesto.periodos.filter((p) => p.tipo === "ano" && p.id !== base.id);
  const W = 300;
  const H = 190;
  const m = { l: 38, r: 10, t: 10, b: 24 };
  const x = d3.scalePoint().domain(anos.map((p) => p.id)).range([m.l + 8, W - m.r - 8]);
  const y = d3.scaleLinear().domain([Math.min(ESCALA_SPEARMAN.min, Math.floor((d3.min(todos) - 0.01) * 20) / 20), 1]).range([H - m.b, m.t]);
  const eixoY = d3.ticks(y.domain()[0], 1, 4).map((t) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="${css("--line")}" stroke-width="0.5"/><text x="${m.l - 4}" y="${y(t)}" text-anchor="end" dominant-baseline="middle" font-size="9" fill="${css("--muted")}">${formatar(t, 2)}</text>`).join("");
  const eixoX = anos.map((p) => `<text x="${x(p.id)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="${css("--muted")}">${p.rotulo}</text>`).join("");
  const linhas = series
    .map((sr) => {
      const cor = css(COR_COMPONENTE[sr.componente] ?? "--accent");
      const caminho = d3.line().x((p) => x(p.periodo.id)).y((p) => y(p.valor))(sr.pontos);
      const pontos = sr.pontos
        .map((p) => `<circle cx="${x(p.periodo.id)}" cy="${y(p.valor)}" r="3.5" fill="${cor}"/><circle cx="${x(p.periodo.id)}" cy="${y(p.valor)}" r="9" fill="transparent" data-dica-titulo="${attr(CLAB[sr.componente] ?? sr.componente)}: ${attr(p.periodo.rotulo)} contra ${attr(base.rotulo)}" data-dica-valor="Spearman ${attr(formatar(p.valor, 3))}"/>`)
        .join("");
      return `<path d="${caminho}" fill="none" stroke="${cor}" stroke-width="1.8"/>${pontos}`;
    })
    .join("");
  const chaves = series.map((sr) => `<span class="hm-chave"><span class="sw" style="background:${css(COR_COMPONENTE[sr.componente] ?? "--accent")}"></span>${CLAB[sr.componente] ?? sr.componente}</span>`).join("");
  el.innerHTML = `<header class="graf-cab"><h4>Cada ano contra ${base.rotulo}</h4></header>
    <div class="grafico-dica">Spearman de cada ano contra ${base.rotulo}, uma linha por componente: quanto mais baixa a linha, menos a ordem dos hexágonos se parece com a de ${base.rotulo}. Passe o mouse num ponto para ver o valor.</div>
    <svg data-grafico="spearman-linhas" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Spearman de cada ano contra ${base.rotulo}, por componente">${eixoY}${eixoX}${linhas}</svg>
    <div class="hm-chaves">${chaves}</div>`;
}

/** Razão do total por hexágono (ano ÷ 2022), com eixo e rótulos sem sobreposição (N16). */
function renderizarRazoes(el, razoes, manifesto) {
  const rotuloPeriodo = (id) => rotuloCurto(manifesto.periodos.find((p) => p.id === id)?.rotulo ?? id);
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
      const svg = `<svg data-grafico="razoes" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Razão do total por hexágono, ${CLAB[comp]}">
        ${eixoY}
        <line x1="${m.l}" x2="${W - m.r}" y1="${y(1)}" y2="${y(1)}" stroke="${css("--line")}" stroke-dasharray="2,3"/>
        ${linhas
          .map(
            (l) => `<line x1="${x(l.periodo) + x.bandwidth() / 2}" x2="${x(l.periodo) + x.bandwidth() / 2}" y1="${y(Math.min(l.p95, limite))}" y2="${y(Math.min(l.p5, limite))}" stroke="${css("--ink")}" stroke-width="2"/>
                <circle cx="${x(l.periodo) + x.bandwidth() / 2}" cy="${y(Math.min(l.mediana, limite))}" r="3" fill="${css("--accent")}"/><rect x="${x(l.periodo)}" y="${m.t}" width="${x.bandwidth()}" height="${H - m.b - m.t}" fill="transparent" data-dica-titulo="${attr(CLAB[comp] ?? comp)}: ${attr(rotuloPeriodo(l.periodo))} ÷ 2022" data-dica-valor="mediana ${attr(formatar(l.mediana, 2))} · razão dos totais ${attr(formatar(l.razao_total, 2))}" data-dica-faixa="${attr(formatar(l.p5, 2))} a ${attr(formatar(l.p95, 2))} (p5–p95)" data-dica-base="${attr(formatar(l.n_hexagonos, 0))} hexágonos"/>`
          )
          .join("")}
        ${linhas.map((l, i) => `<text x="${x(l.periodo) + x.bandwidth() / 2}" y="${H - 6}" text-anchor="middle" font-size="9" transform="${linhas.length > 4 ? `rotate(-30, ${x(l.periodo) + x.bandwidth() / 2}, ${H - 6})` : ""}">${rotuloPeriodo(l.periodo)}</text>`).join("")}
      </svg>`;
      return `<div class="mini"><header class="graf-cab"><h4>${CLAB[comp] ?? comp}</h4></header><div class="grafico-dica">Ponto = mediana da razão (ano ÷ 2022) do total por hexágono; haste = p5–p95; linha pontilhada = sem mudança (razão 1). Passe o mouse numa coluna para ver os valores.</div>${svg}</div>`;
    })
    .join("");
  instalarAjudas(el);
  ligarDicaPorAtributos(el);
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

  renderizarFjp($("f3-fjp"), referenciaFjp, { titulo: "sub" });
  renderizarPonte($("f3-ponte-tabela"), qualidade.ponte);
  renderizarFontes($("f3-fontes-timeline"), manifesto);
  renderizarSigilo($("f3-sigilo-cartoes"), qualidade.sigilo);
  renderizarCnefe($("f3-cnefe-cartoes"), qualidade.cnefe);
  renderizarAps($("f3-aps-cartoes"), qualidade.aps);
  renderizarHeatmap($("f3-heatmap"), consistencia.spearman, manifesto);
  renderizarRazoes($("f3-razoes"), consistencia.razoes, manifesto);
  renderizarAchados($("f3-achados"), achados);
  renderizarOqueFalta($("f3-oquefalta"), qualidade, manifesto);

  const { veredictoPergunta1Cels, veredictoPergunta2Cels, veredictoPergunta3Cels } = renderizarVereditos($("f3-grade-vereditos"), {
    qualidade, referenciaFjp, modelo, manifesto, totais, achados,
  });
  $("f3-resposta-1").textContent = fraseResposta(veredictoPergunta1Cels, "Batem");
  $("f3-resposta-2").textContent = fraseResposta(veredictoPergunta2Cels, "Lugar certo");
  $("f3-resposta-3").textContent = fraseResposta(veredictoPergunta3Cels, "Comparável");
  $("f3-resposta-4").textContent = `${veredictoPergunta4(achados).numero} achado(s) público(s) registrado(s).`;
  instalarAjudas(painel);
  ligarDicaPorAtributos(painel);
  ligarNavegacaoSecoes();

  const segComp = $("f3-seg-comp");
  function atualizarModelo(componente) {
    segComp.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === componente)));
    renderizarModelo($("f3-modelo-blocos"), modelo[componente]);
  }
  segComp.querySelectorAll("button").forEach((b) => (b.onclick = () => atualizarModelo(b.dataset.v)));
  atualizarModelo("coabitacao");
}
