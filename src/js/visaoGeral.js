// Composição da Visão geral (SPEC_F2). Carrega o pacote e renderiza a
// mensagem principal, os cartões BI, o mini-mapa, FJP × moradinha, as marcas
// de cuidado e os números para citar.
import * as d3 from "d3";
import { carregarJSON, carregarPacoteCompleto, escolherDominioEEdicao } from "./dados/pacote.js";
import {
  periodoRecenteAno, periodoRecenteMedia, componenteMaior, marcaMaisImportante,
  dadosCartoesBI, marcasDoDominio, linhasParaCitar,
  fraseRessalvaRelativo, fraseRuidoAnual, NOME_COMPONENTE, CLAB,
} from "./dados/visaoGeral.js";
import { rotuloMarca, classeMarca } from "./util/marcas.js";
import { formatar, formatarPercentual } from "./util/formato.js";
import { prepararNavegacaoResultados } from "./estado/pergunta.js";
import { criarMiniMapa } from "./mapa/index.js";
import { renderizarPainelDetalhe, renderizarCurvaConcentracao } from "./graficos/deficit.js";
import { ligarDica, marcarGrafico, htmlDica, instalarAjudas, criarAjuda } from "./ui/ajuda.js";
import { renderizarFjp } from "./ui/fjp.js";

const GRAVIDADE_ORDEM = ["crit", "warn", "info"];
const NOME_GRAVIDADE = { crit: "Crítico", warn: "Atenção", info: "Informativo" };

function $(id) {
  return document.getElementById(id);
}

function css(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

/** Minúscula só na primeira letra — preserva siglas como "CV" no resto do texto. */
function primeiraMinuscula(texto) {
  return texto ? texto[0].toLowerCase() + texto.slice(1) : texto;
}

/**
 * Mini-série do cartão (SPEC F6.4 1a): eixo mínimo — valor mínimo e máximo na
 * vertical, primeiro e último ano na horizontal — e caixa de valor ao passar o
 * mouse (período, valor e faixa de 95% quando o pacote tem).
 */
function sparkline(c) {
  const serie = c.serie;
  const ok = serie.filter((v) => v != null);
  if (!ok.length) return null;
  const W = 150;
  const H = 30;
  const m = { l: 40, r: 4, t: 4, b: 10 };
  const lo = d3.min(ok);
  const hi = d3.max(ok);
  const x = d3.scalePoint().domain(serie.map((_v, i) => i)).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([lo === hi ? 0 : lo, hi]).range([H - m.b, m.t]);
  const linha = d3.line().defined((v) => v != null).x((_v, i) => x(i)).y((v) => y(v));
  const svg = d3.create("svg").attr("class", "spark").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H).attr("role", "img").attr("aria-label", `Série de ${c.rotulo}, ${c.anos[0]} a ${c.anos.at(-1)}`);
  svg.append("path").attr("d", linha(serie)).attr("fill", "none").attr("stroke", css("--accent")).attr("stroke-width", 1.6);
  const rot = (txt, px, py, anchor) => svg.append("text").attr("x", px).attr("y", py).attr("text-anchor", anchor).attr("font-size", 7.5).attr("fill", css("--muted")).text(txt);
  rot(formatar(hi, 0), m.l - 4, m.t + 3, "end");
  rot(formatar(lo, 0), m.l - 4, H - m.b + 1, "end");
  rot(c.anos[0], m.l, H - 1, "start");
  rot(c.anos.at(-1), W - m.r, H - 1, "end");
  const pts = serie.map((v, i) => ({ v, i, ano: c.anos[i], faixa: c.faixas?.[i] ?? null })).filter((d) => d.v != null);
  const bolas = svg.append("g").selectAll("circle").data(pts).join("circle").attr("cx", (d) => x(d.i)).attr("cy", (d) => y(d.v)).attr("r", 2.4).attr("fill", css("--accent"));
  svg.append("g").selectAll("rect").data(pts).join("rect")
    .attr("x", (d) => x(d.i) - 9).attr("width", 18).attr("y", 0).attr("height", H).attr("fill", "transparent");
  ligarDica(svg.selectAll("rect"), (d) =>
    htmlDica({ titulo: d.ano, valor: `${formatar(d.v, 0)} domicílios`, faixa: d.faixa ? `${formatar(d.faixa[0], 0)} a ${formatar(d.faixa[1], 0)}` : null, base: d.faixa ? null : "sem faixa de 95% para este indicador" })
  );
  marcarGrafico(svg.node(), "mini-serie");
  void bolas;
  return svg.node();
}

function renderizarMensagem(el, manifesto, totais) {
  const ano = periodoRecenteAno(manifesto);
  const media = periodoRecenteMedia(manifesto);
  const cartoes = dadosCartoesBI(manifesto, totais);
  const total = cartoes.find((c) => c.componente === "total");
  const maior = componenteMaior(totais, ano.id);
  const marca = marcaMaisImportante(totais, ano.id);

  const linha1 = `O déficit habitacional total na ${manifesto.nome} é de <b data-num="${total.absolutoAno}">${formatar(total.absolutoAno, 0)}</b> domicílios (<span data-num="${total.relativoAno}">${formatarPercentual(total.relativoAno, 2)}</span>) em ${ano.rotulo}${
    media ? `, e de ${formatar(total.absolutoMedia, 0)} (${formatarPercentual(total.relativoMedia, 2)}) na ${media.rotulo.toLowerCase()}` : ""
  }.`;
  const linha2 = maior ? `O maior componente é ${NOME_COMPONENTE[maior]}.` : "";
  const linha3 = marca ? `${CLAB[marca.componente]} com ${primeiraMinuscula(rotuloMarca(marca.codigo))}.` : "";

  el.innerHTML = [linha1, linha2, linha3].filter(Boolean).join("<br>");
}

function renderizarCartoes(el, manifesto, totais) {
  const cartoes = dadosCartoesBI(manifesto, totais);
  el.innerHTML = "";
  for (const c of cartoes) {
    const card = document.createElement("article");
    card.className = "cartao-bi";
    card.dataset.componente = c.componente;
    card.innerHTML = `<header><span class="k">${c.rotulo}</span></header>
      <button type="button" class="cartao-corpo">
        <span class="cb-vr"><span class="v" data-num="${c.absolutoAno ?? ""}">${formatar(c.absolutoAno, 0)}</span>
        <span class="r" data-num="${c.relativoAno ?? ""}">${formatarPercentual(c.relativoAno, 2)}</span>
        <span class="pills">${(c.marcas ?? []).map((m) => `<span class="pill marca-ico ${classeMarca(m)}" role="img" aria-label="${rotuloMarca(m)}" title="${rotuloMarca(m)}">${classeMarca(m) === "info" ? "i" : "!"}</span>`).join("")}</span></span>
        <span class="spark-slot"></span>
      </button>`;
    card.querySelector("header").appendChild(
      criarAjuda("Evolução do total do indicador por ano. O eixo vertical vai do menor ao maior valor da série; passe o mouse num ponto para ver o ano, o valor e, quando houver, a faixa de 95%.")
    );
    const svg = sparkline(c);
    if (svg) card.querySelector(".spark-slot").appendChild(svg);
    card.onclick = (e) => {
      if (e.target.closest(".ajuda")) return;
      const ano = periodoRecenteAno(manifesto);
      prepararNavegacaoResultados({ tema: "deficit", medida: "absoluto", componente: c.componente, periodo: ano.id });
      window.location.href = "resultados.html";
    };
    el.appendChild(card);
  }
}

function renderizarMarcas(el, totais) {
  const marcas = marcasDoDominio(totais);
  const grupos = new Map();
  for (const m of marcas) {
    const grav = classeMarca(m.codigo);
    if (!grupos.has(grav)) grupos.set(grav, []);
    grupos.get(grav).push(m);
  }
  el.innerHTML = GRAVIDADE_ORDEM.filter((g) => grupos.has(g))
    .map(
      (g) => `<div class="marca-grupo"><h3>${NOME_GRAVIDADE[g]}</h3>${grupos
        .get(g)
        .map((m) => `<div class="marca-item"><span class="pill ${g}">${rotuloMarca(m.codigo)}</span> — ${m.componentes.map((c) => CLAB[c] ?? c).join(", ")}</div>`)
        .join("")}</div>`
    )
    .join("");
}

function renderizarCitar(el, manifesto, totais) {
  const linhas = linhasParaCitar(manifesto, totais);
  el.querySelector("tbody").innerHTML = linhas
    .map(
      (l, i) => `<tr>
        <td>${l.componente === "total" ? "Déficit total" : `Déficit de ${NOME_COMPONENTE[l.componente]}`}</td>
        <td>${l.periodoRotulo}</td>
        <td class="num" data-num="${l.total}">${formatar(l.total, 0)} domicílios</td>
        <td>${manifesto.edicao}</td>
        <td><button type="button" class="iconbtn" data-i="${i}">Copiar</button></td>
      </tr>`
    )
    .join("");
  el.querySelectorAll("button[data-i]").forEach((b) => {
    b.onclick = async () => {
      const texto = linhas[Number(b.dataset.i)].texto;
      try {
        await navigator.clipboard.writeText(texto);
        b.textContent = "Copiado!";
        setTimeout(() => (b.textContent = "Copiar"), 1500);
      } catch {
        // clipboard indisponível (ex.: sem permissão); sem efeito visual.
      }
    };
  });
}

export async function iniciarVisaoGeral() {
  const painel = $("pane-visaogeral");
  if (!painel) return;

  const catalogo = await carregarJSON(".", "catalogo.json");
  const { edicao } = escolherDominioEEdicao(catalogo);
  const [dados, referenciaFjp] = await Promise.all([
    carregarPacoteCompleto(edicao.origem),
    carregarJSON(edicao.origem, "referencia_fjp.json"),
  ]);
  const { manifesto, totais, linhas, ap } = dados;
  const linhasArr = [...linhas.values()];

  renderizarMensagem($("f2-mensagem"), manifesto, totais);
  renderizarCartoes($("f2-cartoes"), manifesto, totais);
  renderizarFjp($("f2-fjp"), referenciaFjp);
  renderizarMarcas($("f2-marcas"), totais);
  renderizarCitar($("f2-citar"), manifesto, totais);

  // A4: mini-mapa interativo (arrastar/zoom), com dica (A3) e clique que abre
  // Resultados no mesmo hexágono, componente e período.
  const { periodoRecente } = criarMiniMapa({
    container: $("f2-minimapa"), manifesto, linhas, ap, totais,
    tooltip: $("f2-minimapa-tooltip"),
    aoClicarHexagono: (h3) => {
      prepararNavegacaoResultados({ tema: "deficit", medida: "relativo", componente: "total", periodo: periodoRecente, selecionado: h3 });
      window.location.href = "resultados.html";
    },
  });
  const periodo = manifesto.periodos.find((p) => p.id === periodoRecente);
  $("f2-minimapa-sub").textContent = `Déficit relativo total, ${periodo?.rotulo ?? periodoRecente}.`;

  // Ressalva do relativo (SPEC_F6, Visão geral), para o período padrão (ano mais recente).
  const anoRecente = periodoRecenteAno(manifesto);
  $("f2-ressalva-relativo").textContent = fraseRessalvaRelativo(linhasArr, totais, "total", anoRecente.id);

  // B3/B6: pop-up "Detalhes" (4 painéis + frase de ruído + curva de concentração).
  const backdrop = $("f2-detalhes-backdrop");
  let detalhesRenderizados = false;
  function renderizarDetalhes() {
    if (detalhesRenderizados) return;
    detalhesRenderizados = true;
    renderizarPainelDetalhe($("f2-det-total"), manifesto, totais, "total", "Total");
    renderizarPainelDetalhe($("f2-det-coabitacao"), manifesto, totais, "coabitacao", "Coabitação");
    renderizarPainelDetalhe($("f2-det-onus"), manifesto, totais, "onus", "Ônus");
    renderizarPainelDetalhe($("f2-det-precariedade"), manifesto, totais, "precariedade", "Precariedade");
    $("f2-det-frase-ruido").textContent = fraseRuidoAnual(manifesto, totais);
    $("f2-det-concentracao-titulo").firstChild.textContent = `Curva de concentração — Total, ${anoRecente.rotulo}`;
    renderizarCurvaConcentracao($("f2-det-concentracao"), linhasArr, "total", anoRecente.id);
  }
  function abrirDetalhes() {
    backdrop.removeAttribute("hidden");
    renderizarDetalhes();
    $("f2-detalhes-fechar").focus();
  }
  function fecharDetalhes() {
    backdrop.setAttribute("hidden", "");
    $("f2-detalhes-btn").focus();
  }
  $("f2-detalhes-btn").onclick = abrirDetalhes;
  $("f2-detalhes-fechar").onclick = fecharDetalhes;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) fecharDetalhes();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !backdrop.hasAttribute("hidden")) fecharDetalhes();
  });
}
