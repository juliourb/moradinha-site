// Página inicial (S1-2, SPEC_F5 item 3): um cartão por domínio com nome, edição
// padrão, data e um mini-mapa do déficit relativo. Tudo vem do catálogo e do
// manifesto/Parquet de cada domínio; nenhum nome ou número fica no código.
//
// O mini-mapa é um SVG estático (hexágonos desenhados a partir do código H3), não
// um mapa interativo: vários mapas WebGL na mesma página passariam do limite de
// contextos do navegador, e o cartão só precisa mostrar a forma e a mancha do domínio.
import { quantileSorted, ascending } from "d3";
import { cellToBoundary } from "h3-js";
import { carregarJSON, consultar, urlParquet } from "./dados/pacote.js";
import { dominiosPublicos, edicoesPublicas } from "./dados/catalogo.js";
import { periodoRecenteAno } from "./dados/visaoGeral.js";
import { RAMPA_DEFICIT } from "./mapa/index.js";
import { caminhoDaPagina } from "./util/endereco.js";

const LARGURA = 320;
const ALTURA = 200;
const MARGEM = 6;

function escapar(texto) {
  return String(texto).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function dataBR(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : String(iso);
}

/** Hexágonos do período recente com o déficit relativo total (soma dos componentes ÷ domicílios), como no mini-mapa da Visão geral. */
async function hexagonosDoCartao(origem, periodoId) {
  const p = periodoId.replace(/'/g, "''");
  const linhas = await consultar(`
    SELECT h.h3 AS h3, SUM(h.absoluto) AS soma, COUNT(h.absoluto) AS n, ANY_VALUE(b.domicilios) AS dom
    FROM read_parquet('${urlParquet(origem, "hex.parquet")}') h
    JOIN read_parquet('${urlParquet(origem, "hex_base.parquet")}') b ON b.h3 = h.h3 AND b.periodo = h.periodo
    WHERE h.periodo = '${p}'
    GROUP BY h.h3`);
  return linhas.map((l) => ({
    h3: l.h3,
    relativo: Number(l.n) >= 3 && l.dom != null && l.dom > 0.5 ? (100 * l.soma) / l.dom : null,
  }));
}

/** SVG com um <path> por classe de cor (no máximo 8), projeção plana corrigida pela latitude. */
export function svgMiniMapa(hexagonos, nome) {
  const celulas = hexagonos.map((h) => ({ ...h, pts: cellToBoundary(h.h3).map(([lat, lng]) => [lat, lng]) }));
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const c of celulas) for (const [lat, lng] of c.pts) {
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
  }
  const fatorLng = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const larguraGeo = Math.max((maxLng - minLng) * fatorLng, 1e-9);
  const alturaGeo = Math.max(maxLat - minLat, 1e-9);
  const escala = Math.min((LARGURA - 2 * MARGEM) / larguraGeo, (ALTURA - 2 * MARGEM) / alturaGeo);
  const x0 = (LARGURA - larguraGeo * escala) / 2;
  const y0 = (ALTURA - alturaGeo * escala) / 2;
  const proj = ([lat, lng]) => `${(x0 + (lng - minLng) * fatorLng * escala).toFixed(1)},${(y0 + (maxLat - lat) * escala).toFixed(1)}`;

  const positivos = celulas.map((c) => c.relativo).filter((v) => v != null && v > 0).sort(ascending);
  const quebras = positivos.length ? [1, 2, 3, 4, 5, 6].map((i) => quantileSorted(positivos, i / 7)) : [];
  const classeDe = (v) => {
    if (v == null || v <= 0) return -1;
    let k = 0;
    while (k < quebras.length && v > quebras[k]) k++;
    return k;
  };
  const caminhos = new Map();
  for (const c of celulas) {
    const k = classeDe(c.relativo);
    caminhos.set(k, (caminhos.get(k) ?? "") + `M${c.pts.map(proj).join("L")}Z`);
  }
  const paths = [...caminhos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, d]) => `<path d="${d}" fill="${k < 0 ? "var(--line)" : RAMPA_DEFICIT[k]}"/>`)
    .join("");
  return `<svg class="mini-svg" viewBox="0 0 ${LARGURA} ${ALTURA}" role="img" aria-label="${escapar(`Mapa do déficit relativo de ${nome}`)}">${paths}</svg>`;
}

function htmlCartao(dominio, edicao, manifesto, periodoRotulo, outras) {
  const alvo = caminhoDaPagina(dominio.conjunto_id, null, "visao-geral.html");
  const links = outras
    .map((e) => `<a href="${caminhoDaPagina(dominio.conjunto_id, e.edicao, "visao-geral.html")}">${escapar(e.edicao)}</a>`)
    .join(", ");
  return `
    <a class="mini" href="${alvo}" tabindex="-1" aria-hidden="true"><div class="mini-slot" data-mini></div></a>
    <h2>${escapar(manifesto.nome ?? dominio.nome)}</h2>
    <p class="sub">Edição ${escapar(edicao.edicao)} · gerada em ${dataBR(manifesto.data_execucao)}${periodoRotulo ? ` · cores: déficit relativo total, ${escapar(periodoRotulo)}` : ""}</p>
    ${manifesto.ficticio ? '<span class="chip ficticio">dados fictícios</span>' : ""}
    <p><a class="iconbtn" href="${alvo}">Abrir os resultados →</a></p>
    ${outras.length ? `<p class="sub">Outras edições: ${links}</p>` : ""}`;
}

export async function iniciarInicio() {
  const raiz = document.getElementById("inicio-cartoes");
  if (!raiz) return;
  const catalogo = await carregarJSON(".", "catalogo.json");
  // `?teste=1` mostra também os domínios de teste (fictícios), para conferir o site com mais de um domínio.
  const comTeste = new URLSearchParams(window.location.search).get("teste") === "1";
  const dominios = comTeste ? catalogo.dominios : dominiosPublicos(catalogo);

  const cartoes = dominios.map((dominio) => {
    const artigo = document.createElement("article");
    artigo.className = "cartao-dominio";
    artigo.dataset.dominio = dominio.conjunto_id;
    raiz.appendChild(artigo);
    return { dominio, artigo };
  });

  // Um cartão por vez: o DuckDB-WASM é um só e o mini-mapa é secundário ao texto do cartão.
  for (const { dominio, artigo } of cartoes) {
    const edicao = dominio.edicoes.find((e) => e.padrao) ?? dominio.edicoes[0];
    const manifesto = await carregarJSON(edicao.origem, "manifesto.json");
    const periodo = periodoRecenteAno(manifesto);
    const outras = (comTeste ? dominio.edicoes : edicoesPublicas(dominio)).filter((e) => e.edicao !== edicao.edicao);
    artigo.innerHTML = htmlCartao(dominio, edicao, manifesto, periodo?.rotulo, outras);
    try {
      const hexagonos = await hexagonosDoCartao(edicao.origem, periodo.id);
      artigo.querySelector("[data-mini]").innerHTML = svgMiniMapa(hexagonos, manifesto.nome ?? dominio.nome);
    } catch (erro) {
      // eslint-disable-next-line no-console
      console.error(`Mini-mapa de ${dominio.conjunto_id}:`, erro);
    }
  }
  raiz.dataset.pronto = "1";
}
