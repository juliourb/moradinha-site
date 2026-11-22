// Composição da Visão geral (SPEC_F2). Carrega o pacote e renderiza a
// mensagem principal, os cartões BI, o mini-mapa, FJP × moradinha, as marcas
// de cuidado e os números para citar.
import * as d3 from "d3";
import { carregarJSON, carregarPacoteCompleto, escolherDominioEEdicao } from "./dados/pacote.js";
import {
  periodoRecenteAno, periodoRecenteMedia, componenteMaior, marcaMaisImportante,
  dadosCartoesBI, marcasDoDominio, linhasParaCitar, NOME_COMPONENTE, CLAB,
} from "./dados/visaoGeral.js";
import { rotuloMarca, classeMarca } from "./util/marcas.js";
import { formatar, formatarPercentual } from "./util/formato.js";
import { prepararNavegacaoResultados } from "./estado/pergunta.js";
import { criarMiniMapa } from "./mapa/index.js";

const NOME_INDICADOR = {
  total: "Total", habitacao_precaria: "Habitação precária", coabitacao: "Coabitação",
  onus: "Ônus excessivo com aluguel", domicilios: "Domicílios",
};
const GRAVIDADE_ORDEM = ["crit", "warn", "info"];
const NOME_GRAVIDADE = { crit: "Crítico", warn: "Atenção", info: "Informativo" };

function $(id) {
  return document.getElementById(id);
}

function css(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

function sparkline(serie) {
  const ok = serie.filter((v) => v != null);
  if (!ok.length) return "";
  const W = 120;
  const H = 32;
  const x = d3.scalePoint().domain(serie.map((_v, i) => i)).range([4, W - 4]);
  const y = d3.scaleLinear().domain([0, d3.max(ok) * 1.15 || 1]).range([H - 4, 4]);
  const linha = d3.line().defined((v) => v != null).x((_v, i) => x(i)).y((v) => y(v));
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Série de anos"><path d="${linha(serie)}" fill="none" stroke="${css("--accent")}" stroke-width="1.6"/></svg>`;
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
  const linha3 = marca ? `${CLAB[marca.componente]} com ${rotuloMarca(marca.codigo).toLowerCase()}.` : "";

  el.innerHTML = [linha1, linha2, linha3].filter(Boolean).join("<br>");
}

function renderizarCartoes(el, manifesto, totais) {
  const cartoes = dadosCartoesBI(manifesto, totais);
  el.innerHTML = cartoes
    .map(
      (c) => `<button type="button" class="cartao-bi" data-componente="${c.componente}">
        <span class="k">${c.rotulo}</span>
        <span class="v" data-num="${c.absolutoAno ?? ""}">${formatar(c.absolutoAno, 0)}</span>
        <span class="r" data-num="${c.relativoAno ?? ""}">${formatarPercentual(c.relativoAno, 2)}</span>
        ${sparkline(c.serie)}
        <span class="pills">${(c.marcas ?? []).map((m) => `<span class="pill ${classeMarca(m)}">${rotuloMarca(m)}</span>`).join("")}</span>
      </button>`
    )
    .join("");
  el.querySelectorAll(".cartao-bi").forEach((b) => {
    b.onclick = () => {
      const componente = b.dataset.componente;
      const ano = periodoRecenteAno(manifesto);
      prepararNavegacaoResultados({ tema: "deficit", medida: "absoluto", componente, periodo: ano.id });
      window.location.href = "resultados.html";
    };
  });
}

function dentroDaFaixa(publicado, reconstrucao, ep) {
  if (publicado == null || reconstrucao == null || ep == null) return null;
  const lo = reconstrucao - 1.96 * ep;
  const hi = reconstrucao + 1.96 * ep;
  return publicado >= lo && publicado <= hi;
}

function renderizarFjp(el, referenciaFjp) {
  el.innerHTML = referenciaFjp
    .map((item) => {
      const dentro = dentroDaFaixa(item.fjp_publicado, item.reconstrucao_pnadc, item.reconstrucao_ep);
      const faixaTxt =
        item.reconstrucao_ep != null
          ? `faixa de 95%: ${formatar(item.reconstrucao_pnadc - 1.96 * item.reconstrucao_ep, 1)} a ${formatar(item.reconstrucao_pnadc + 1.96 * item.reconstrucao_ep, 1)}${
              dentro != null ? ` · o número da FJP cai ${dentro ? "dentro" : "fora"} da faixa da reconstrução` : ""
            }`
          : "";
      const subcomponentes = (item.fjp_subcomponentes ?? [])
        .map((s) => `<div class="fjp-sub">${s.nome}: ${formatar(s.valor, 0)}</div>`)
        .join("");
      return `<div class="fjp-linha">
        <h3>${NOME_INDICADOR[item.indicador] ?? item.indicador}</h3>
        <div class="fjp-colunas">
          <div class="fjp-col"><div class="k">FJP (publicado)</div>
            <div class="v ${item.fjp_publicado == null ? "a-preencher" : ""}" data-num="${item.fjp_publicado ?? ""}">${
              item.fjp_publicado == null ? "a preencher" : formatar(item.fjp_publicado, 0)
            }</div>
            ${subcomponentes}
            ${item.fjp_publicado != null ? `<div class="fjp-sub">${item.fjp_fonte}${item.fjp_tabela ? `, ${item.fjp_tabela}` : ""}${item.fjp_pagina ? `, p. ${item.fjp_pagina}` : ""}${item.fjp_url ? ` · <a href="${item.fjp_url}" target="_blank" rel="noopener">link</a>` : ""}</div>` : ""}
          </div>
          <div class="fjp-col"><div class="k">Reconstrução na PNADc</div>
            <div class="v" data-num="${item.reconstrucao_pnadc ?? ""}">${formatar(item.reconstrucao_pnadc, 1)}</div>
            <div class="fjp-sub">${faixaTxt}</div>
          </div>
          <div class="fjp-col"><div class="k">Total do mapa</div>
            <div class="v" data-num="${item.mapa ?? ""}">${formatar(item.mapa, 1)}</div>
          </div>
        </div>
        <div class="fjp-sub" style="margin-top:6px">${item.explicacao}</div>
      </div>`;
    })
    .join("");
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
  const { manifesto, totais, linhas } = dados;

  renderizarMensagem($("f2-mensagem"), manifesto, totais);
  renderizarCartoes($("f2-cartoes"), manifesto, totais);
  renderizarFjp($("f2-fjp"), referenciaFjp);
  renderizarMarcas($("f2-marcas"), totais);
  renderizarCitar($("f2-citar"), manifesto, totais);

  const { periodoRecente } = criarMiniMapa({ container: $("f2-minimapa"), manifesto, linhas });
  const periodo = manifesto.periodos.find((p) => p.id === periodoRecente);
  $("f2-minimapa-sub").textContent = `Déficit relativo total, ${periodo?.rotulo ?? periodoRecente}.`;
}
