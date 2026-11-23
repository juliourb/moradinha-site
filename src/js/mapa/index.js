// Mapa do explorador (SPEC_F1 §3): MapLibre GL (OpenFreeMap, sem chave) com a
// camada do deck.gl sobreposta via @deck.gl/mapbox; H3HexagonLayer única;
// cortina com duas instâncias sincronizadas; camadas de contornos.
import { Map as MapaMapLibre } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { H3HexagonLayer, H3ClusterLayer, GeoJsonLayer } from "deck.gl";
import { FillStyleExtension } from "@deck.gl/extensions";
import { luma } from "@luma.gl/core";
import { webgl2Adapter } from "@luma.gl/webgl";
import { ascending, quantileSorted, color as d3color } from "d3";
import { cellToLatLng } from "h3-js";
import { formatar, formatarPercentual } from "../util/formato.js";
import { brutoHex, faixaHex, marcasHex, totalDoMapa } from "../dados/calculo.js";
import { rotuloMarca } from "../util/marcas.js";
import { valorDentroFaixas } from "../util/faixas.js";
import {
  classeHex, calcularEscalasAbsolutas, calcularEscalasRelativas, taxaDominio,
  indiceClasse, indiceClasseVezesTaxa, CORTES_VEZES_TAXA, resumoLegendaClasses,
} from "../dados/escalaCor.js";

// deck.gl v9/luma.gl v9: precisa de um adaptador de GPU registrado antes de
// criar qualquer Device (aqui, WebGL — sem isso o MapboxOverlay falha ao
// inicializar as camadas).
luma.registerAdapters([webgl2Adapter]);

const ESTILOS_BASE = {
  claro: "https://tiles.openfreemap.org/styles/positron",
  escuro: "https://tiles.openfreemap.org/styles/dark",
};
const RAMPA_DEFICIT = ["#fbf3d5", "#f6dc9b", "#f0b864", "#e48a3f", "#cc5a2c", "#a2361f", "#6e1d16"];
const RAMPA_QUALIDADE = ["#eef4fb", "#d3e3f2", "#aec9e6", "#84add8", "#5c8fc4", "#3b6ea8", "#1f4c80"];
// "Vezes a taxa do domínio" (SPEC_F6 C4 item 4b): frio abaixo da taxa, neutro
// perto dela, quente acima — 6 classes fixas (CORTES_VEZES_TAXA).
const RAMPA_VEZES_TAXA = ["#2f6aa8", "#7fb1dd", "#cfd3cd", "#e48a3f", "#cc5a2c", "#6e1d16"];

/** Rampa de n classes (Jenks, n ≤ 6) a partir da RAMPA_DEFICIT (7 tons), preservando o tom mais escuro no topo. */
function rampaDeficit(n) {
  if (n <= 0) return [];
  return RAMPA_DEFICIT.slice(Math.max(0, RAMPA_DEFICIT.length - n));
}

let atlasHachuraCache = null;
/** Atlas de padrão (hachura fina) para o FillStyleExtension, gerado uma vez em canvas (SPEC_F6 C4 item 1). */
function atlasHachura() {
  if (atlasHachuraCache) return atlasHachuraCache;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1.6;
  for (let x = -32; x < 64; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, 32);
    ctx.lineTo(x + 32, 0);
    ctx.stroke();
  }
  atlasHachuraCache = canvas;
  return canvas;
}
const MAPEAMENTO_HACHURA = { linhas: { x: 0, y: 0, width: 32, height: 32, mask: true } };

function css(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}
function rgb(hex) {
  const c = d3color(hex);
  return c ? [c.r, c.g, c.b] : [128, 128, 128];
}
/**
 * Fundo "cinza" (F6.4 2a): repinta o estilo do OpenFreeMap numa paleta neutra
 * (terra, água, vias, limites e rótulos em cinzas), sem pedir tile de provedor
 * novo. Um filtro CSS `grayscale` não bastava: o estilo claro já é quase cinza
 * e o ajuste ficava imperceptível.
 */
export function acinzentarEstilo(mapa) {
  const estilo = mapa.getStyle?.();
  if (!estilo?.layers) return;
  // F6.5 2: sempre o estilo claro, dessaturado, qualquer que seja o tema do site.
  const c = { terra: "#e3e3e3", agua: "#c9c9c9", via: "#f7f7f7", limite: "#a8a8a8", texto: "#666666", halo: "#e3e3e3" };
  const pintar = (id, prop, valor) => {
    try {
      mapa.setPaintProperty(id, prop, valor);
    } catch {
      // propriedade inexistente nesta camada: ignora.
    }
  };
  for (const l of estilo.layers) {
    const agua = /water|ocean|sea/i.test(l.id);
    if (l.type === "background") pintar(l.id, "background-color", c.terra);
    else if (l.type === "fill") {
      pintar(l.id, "fill-color", agua ? c.agua : c.terra);
      pintar(l.id, "fill-outline-color", agua ? c.agua : c.terra);
    } else if (l.type === "line") pintar(l.id, "line-color", agua ? c.agua : /boundary|admin/i.test(l.id) ? c.limite : c.via);
    else if (l.type === "symbol") {
      pintar(l.id, "text-color", c.texto);
      pintar(l.id, "text-halo-color", c.halo);
    }
  }
}

const MODOS_BASE = ["claro", "escuro", "cinza"];

export function criarMapa({ elementos, manifesto, linhas, ap, totais, contornosAp, contornosMunicipios, contornosFcu, contornosRecortes }) {
  const linhasArr = [...linhas.values()];
  const apGrupos = [];
  for (const [, idsPorAp] of agruparPorAp(linhasArr)) apGrupos.push({ ids: idsPorAp });

  // Escalas do tema Déficit (SPEC_F6 C4/N1): calculadas uma vez por
  // componente ao carregar o pacote, não a cada troca de período/cortina.
  const escalasAbsolutas = calcularEscalasAbsolutas(linhasArr, manifesto);
  const escalasRelativas = calcularEscalasRelativas(linhasArr, manifesto);

  let faixaEscala = [];
  let baseFalhou = false;
  let pronto = false;
  let clipPercentual = 50;

  const instancias = {
    a: criarInstancia(elementos.deckA, elementos.basefail, () => {
      baseFalhou = true;
      elementos.basefail.style.display = "block";
    }),
    b: criarInstancia(elementos.deckB, null, () => {}),
  };

  // A2: a cortina compartilha a câmera — arrastar, zoom ou girar de um lado
  // move o outro igual.
  (function sincronizarCameras(mapaA, mapaB) {
    let sincronizando = false;
    function copiar(origem, destino) {
      if (sincronizando) return;
      sincronizando = true;
      destino.jumpTo({ center: origem.getCenter(), zoom: origem.getZoom(), bearing: origem.getBearing(), pitch: origem.getPitch() });
      sincronizando = false;
    }
    mapaA.on("move", () => copiar(mapaA, mapaB));
    mapaB.on("move", () => copiar(mapaB, mapaA));
  })(instancias.a.mapa, instancias.b.mapa);

  // Acréscimo B (F6.5): mapa de base CLARO por padrão em qualquer tema do site;
  // escuro e cinza (claro dessaturado) são opções do painel Camadas.
  let modoBase = "claro";
  let camadasRecolhidas = false;
  function aplicarEstiloBase() {
    for (const { mapa } of Object.values(instancias)) {
      mapa.setStyle(ESTILOS_BASE[modoBase === "escuro" ? "escuro" : "claro"], { diff: false });
      mapa.once("style.load", () => {
        if (modoBase === "cinza") acinzentarEstilo(mapa);
      });
    }
  }
  function definirModoBase(modo) {
    const novo = MODOS_BASE.includes(modo) ? modo : "claro";
    if (novo === modoBase) return;
    modoBase = novo;
    aplicarEstiloBase();
  }

  function criarInstancia(container, elBasefail, aoFalhar) {
    const mapa = new MapaMapLibre({
      container,
      style: ESTILOS_BASE.claro,
      center: manifesto.centro ?? [-35.715, -9.585],
      zoom: manifesto.zoom_inicial ?? 11,
      attributionControl: false,
    });
    mapa.on("error", aoFalhar);
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    mapa.addControl(overlay);
    return { mapa, overlay };
  }

  function agruparPorAp(arr) {
    const g = new Map();
    for (const l of arr) {
      if (!g.has(l.apCod)) g.set(l.apCod, []);
      g.get(l.apCod).push(l.h3);
    }
    return g;
  }

  function corPara(valor, qualidade) {
    if (valor == null) return null;
    const rampa = qualidade ? RAMPA_QUALIDADE : RAMPA_DEFICIT;
    if (!qualidade && valor <= 0) return null;
    let i = 0;
    while (i < faixaEscala.length && valor > faixaEscala[i]) i++;
    return rampa[Math.min(i, rampa.length - 1)];
  }

  const CORES_CATEGORIA = {
    ok: "--ok", parcial_sigilo: "--warn", sem_dado: "--muted",
    ressalva: "--warn", sem_direta: "--muted",
    novo: "--crit", existente: "--ok",
  };

  function computarEscala(periodo, periodoComparar, obterValor, tipoMedida, estado) {
    if (tipoMedida === "categorica" || estado?.tema === "deficit") {
      // Déficit: escala vem de escalasAbsolutas/escalasRelativas (calculadas
      // uma vez por componente, SPEC_F6 C4). Qualidade/categórica seguem abaixo.
      if (estado?.tema !== "deficit") faixaEscala = [];
      return;
    }
    const vs = [];
    for (const l of linhasArr) {
      for (const p of [periodo, periodoComparar]) {
        if (!p) continue;
        const v = obterValor(l, p);
        if (v != null && v > 0) vs.push(v);
      }
    }
    vs.sort(ascending);
    faixaEscala = vs.length ? [1, 2, 3, 4, 5, 6].map((i) => quantileSorted(vs, i / 7)) : [];
  }

  /** Contexto de cor do tema Déficit para um período/lado (SPEC_F6 C4). */
  function contextoCorDeficit(estado, periodo) {
    if (estado.medida === "absoluto") {
      return { tipo: "absoluto", quebras: escalasAbsolutas.get(estado.componente) ?? [] };
    }
    if (estado.relativo_modo === "vezes_taxa") {
      return { tipo: "vezes_taxa", taxa: totais ? taxaDominio(totais, estado.componente, periodo) : null };
    }
    return { tipo: "relativo_quebras", quebras: escalasRelativas.get(estado.componente) ?? [] };
  }

  function alfasPara(estado) {
    const base = Math.round(255 * (estado.opacidade ?? 0.8));
    return { base, apagado: Math.round(base * 0.21) };
  }

  function corHexDeficit(l, periodo, estado, v, contexto) {
    const dom = l.dom[periodo];
    const bruto = brutoHex(l, estado.componente, periodo);
    const classe = classeHex(dom, bruto);
    const { base, apagado } = alfasPara(estado);
    let alfa = base;
    if (!valorDentroFaixas(v, estado.faixa_hist)) alfa = apagado;
    if (classe === "sem_dado") return [...rgb(css("--muted")), 110];
    if (classe === "hachura") return [...rgb(css("--muted")), alfa];
    if (classe === "menos_de_1") return [...rgb(css("--line")), Math.max(alfa, 160)];

    let idx = null;
    let rampa = RAMPA_DEFICIT;
    if (contexto.tipo === "vezes_taxa") {
      const relativoPct = dom > 0.5 ? (100 * bruto) / dom : null;
      const vezes = contexto.taxa && relativoPct != null ? relativoPct / contexto.taxa : null;
      idx = vezes == null ? null : indiceClasseVezesTaxa(vezes);
      rampa = RAMPA_VEZES_TAXA;
    } else {
      const valorClasse = contexto.tipo === "absoluto" ? bruto : dom > 0.5 ? (100 * bruto) / dom : null;
      idx = valorClasse == null || !contexto.quebras.length ? null : indiceClasse(valorClasse, contexto.quebras);
      rampa = rampaDeficit(contexto.quebras.length);
    }
    if (idx == null || !rampa.length) return [...rgb(css("--line")), 70];
    return [...rgb(rampa[Math.min(idx, rampa.length - 1)]), alfa];
  }

  // Acréscimo C: hexágonos fora do quadrante escolhido no gráfico Déficit ×
  // incerteza ficam apagados (null = sem filtro).
  let filtroH3 = null;
  function corHex(l, periodo, estado, obterValor, tipoMedida, contexto) {
    const cor = corHexBase(l, periodo, estado, obterValor, tipoMedida, contexto);
    if (filtroH3 && !filtroH3.has(l.h3)) cor[3] = Math.min(cor[3], alfasPara(estado).apagado);
    return cor;
  }
  function corHexBase(l, periodo, estado, obterValor, tipoMedida, contexto) {
    const v = obterValor(l, periodo);
    const qualidade = estado.tema === "qualidade";
    if (l.dom[periodo] == null && !qualidade) return [...rgb(css("--muted")), 110];
    if (tipoMedida === "categorica") {
      if (v == null) return [...rgb(css("--line")), 70];
      const varName = CORES_CATEGORIA[v] ?? "--muted";
      return [...rgb(css(varName)), 215];
    }
    if (estado.tema === "deficit") return corHexDeficit(l, periodo, estado, v, contexto);
    const c = corPara(v, qualidade);
    if (!c) return [...rgb(css("--line")), 70];
    const { base, apagado } = alfasPara(estado);
    let alfa = base;
    if (!valorDentroFaixas(v, estado.faixa_hist)) alfa = apagado;
    return [...rgb(c), alfa];
  }

  /** Conteúdo da dica ao passar o mouse sobre um hexágono (SPEC_F6 A3). */
  function montarTooltipHtml(l, periodo, estado, obterValor) {
    const municipio = l.municipioNome + (l.nMunicipios > 1 ? ` (+${l.nMunicipios - 1})` : "");
    const apNome = ap?.get(l.apCod)?.ap_nome ?? l.apCod;
    const linhas = [`<b>${municipio}</b>`, `<div class="linha">AP: ${apNome}</div>`];

    if (estado.tema === "deficit") {
      const bruto = brutoHex(l, estado.componente, periodo);
      const dom = l.dom[periodo];
      const relativo = bruto != null && dom > 0.5 ? (100 * bruto) / dom : null;
      linhas.push(`<div class="linha">Absoluto: ${formatar(bruto, 0)} · Relativo: ${formatarPercentual(relativo, 1)}</div>`);
      const faixa = faixaHex(l, estado.componente, periodo);
      if (faixa) linhas.push(`<div class="linha">Faixa de 95%: ${formatar(faixa[0], 1)} a ${formatar(faixa[1], 1)}</div>`);
      if (bruto != null) {
        const totalComponente = totalDoMapa(totais, estado.componente, periodo);
        if (totalComponente?.total) {
          const peso = (100 * bruto) / totalComponente.total;
          linhas.push(`<div class="linha">Peso no total do domínio: ${formatarPercentual(peso, 2)}</div>`);
        }
      }
      const marcas = marcasHex(l, estado.componente, periodo);
      if (marcas.length) linhas.push(`<div class="linha">${marcas.map((m) => rotuloMarca(m)).join("; ")}</div>`);
    } else {
      const v = obterValor(l, periodo);
      linhas.push(`<div class="linha">Valor: ${v == null ? "—" : formatar(v, 2)}</div>`);
    }
    return linhas.join("");
  }

  function criarAoPassarMouse(periodo, estado, obterValor) {
    return ({ object, x, y }) => {
      if (!elementos.tooltip) return;
      if (!object) {
        elementos.tooltip.setAttribute("hidden", "");
        return;
      }
      // F6.3 item 5: nunca deixar a caixa visível sem conteúdo — se montar o HTML
      // falhar (ou vier vazio), esconde em vez de mostrar uma caixa em branco.
      let html;
      try {
        html = montarTooltipHtml(object, periodo, estado, obterValor);
      } catch {
        html = "";
      }
      if (!html) {
        elementos.tooltip.setAttribute("hidden", "");
        return;
      }
      elementos.tooltip.removeAttribute("hidden");
      elementos.tooltip.style.left = `${x}px`;
      elementos.tooltip.style.top = `${y}px`;
      elementos.tooltip.innerHTML = html;
    };
  }

  function camadasPara(periodo, estado, obterValor, lado, tipoMedida) {
    const L = [];
    const contexto = estado.tema === "deficit" ? contextoCorDeficit(estado, periodo) : null;
    L.push(
      new H3HexagonLayer({
        id: "hex-" + lado,
        data: linhasArr,
        getHexagon: (l) => l.h3,
        getFillColor: (l) => corHex(l, periodo, estado, obterValor, tipoMedida, contexto),
        updateTriggers: {
          getFillColor: [
            periodo, estado.tema, estado.medida, estado.componente, estado.medida_qualidade,
            JSON.stringify(estado.faixa_hist), tipoMedida, estado.relativo_modo, estado.opacidade, faixaEscala.join(","), filtroH3 ? filtroH3.size + ":" + JSON.stringify(estado.quadrante) : "",
          ],
        },
        extruded: false,
        highPrecision: true,
        stroked: true,
        getLineColor: [...rgb(css("--surface")), 120],
        lineWidthMinPixels: 0.4,
        pickable: true,
        onClick: ({ object }) => {
          if (object && elementos.aoSelecionar) elementos.aoSelecionar(object.h3);
        },
        onHover: criarAoPassarMouse(periodo, estado, obterValor),
      })
    );
    if (estado.tema === "deficit") {
      const hachuradas = linhasArr.filter((l) => classeHex(l.dom[periodo], brutoHex(l, estado.componente, periodo)) === "hachura");
      if (hachuradas.length) {
        L.push(
          new H3HexagonLayer({
            id: "hex-hachura-" + lado,
            data: hachuradas,
            getHexagon: (l) => l.h3,
            getFillColor: [...rgb(css("--ink")), 190],
            getFillPatternFrame: () => "linhas",
            fillPatternAtlas: atlasHachura(),
            fillPatternMapping: MAPEAMENTO_HACHURA,
            fillPatternMask: true,
            extensions: [new FillStyleExtension({ pattern: true })],
            extruded: false,
            highPrecision: true,
            stroked: false,
            pickable: false,
            updateTriggers: { getFillColor: [periodo, estado.componente] },
          })
        );
      }
    }
    if (estado.camadas.ap) {
      if (contornosAp) {
        L.push(
          new GeoJsonLayer({
            id: "ap-" + lado,
            data: contornosAp,
            filled: false,
            stroked: true,
            getLineColor: [...rgb(css("--apline")), 200],
            lineWidthMinPixels: 1.2,
          })
        );
      } else if (apGrupos.length) {
        L.push(
          new H3ClusterLayer({
            id: "ap-" + lado,
            data: apGrupos,
            getHexagons: (d) => d.ids,
            filled: false,
            stroked: true,
            getLineColor: [...rgb(css("--apline")), 200],
            lineWidthMinPixels: 1.2,
          })
        );
      }
    }
    if (estado.camadas.municipios && contornosMunicipios) {
      L.push(
        new GeoJsonLayer({
          id: "municipios-" + lado,
          data: contornosMunicipios,
          filled: false,
          stroked: true,
          getLineColor: [...rgb(css("--ink")), 160],
          lineWidthMinPixels: 1,
        })
      );
    }
    if (estado.camadas.fcu) {
      if (contornosFcu) {
        L.push(
          new GeoJsonLayer({
            id: "fcu-" + lado,
            data: contornosFcu,
            filled: false,
            stroked: true,
            getLineColor: rgb(css("--fcu")),
            lineWidthMinPixels: 2.2,
          })
        );
      } else {
        L.push(
          new H3HexagonLayer({
            id: "fcu-" + lado,
            data: linhasArr.filter((l) => l.fcuFracao > 0),
            getHexagon: (l) => l.h3,
            extruded: false,
            highPrecision: true,
            filled: false,
            stroked: true,
            getLineColor: rgb(css("--fcu")),
            lineWidthMinPixels: 2.2,
          })
        );
      }
    }
    for (const recorte of manifesto.recortes ?? []) {
      if (!estado.camadas[recorte.id]) continue;
      const featuresDoRecorte = contornosRecortes?.features?.filter((f) => f.properties?.id === recorte.id) ?? [];
      if (featuresDoRecorte.length) {
        L.push(
          new GeoJsonLayer({
            id: "recorte-" + recorte.id + "-" + lado,
            data: { type: "FeatureCollection", features: featuresDoRecorte },
            filled: false,
            stroked: true,
            getLineColor: rgb(css("--bk")),
            lineWidthMinPixels: 3,
            pickable: true,
            onHover: ({ object, x, y }) => {
              if (!elementos.tooltip) return;
              if (!object) {
                elementos.tooltip.setAttribute("hidden", "");
                return;
              }
              elementos.tooltip.removeAttribute("hidden");
              elementos.tooltip.style.left = `${x}px`;
              elementos.tooltip.style.top = `${y}px`;
              elementos.tooltip.innerHTML = `<b>${recorte.nome}</b><div class="linha">${recorte.motivo ?? ""}</div>`;
            },
          })
        );
      } else {
        const ids = linhasArr.filter((l) => l.recortes.includes(recorte.id)).map((l) => l.h3);
        if (!ids.length) continue;
        L.push(
          new H3ClusterLayer({
            id: "recorte-" + recorte.id + "-" + lado,
            data: [{ ids }],
            getHexagons: (d) => d.ids,
            filled: false,
            stroked: true,
            getLineColor: rgb(css("--bk")),
            lineWidthMinPixels: 3,
          })
        );
      }
    }
    if (estado.selecionado) {
      const l = linhas.get(estado.selecionado);
      if (l) {
        L.push(
          new H3HexagonLayer({
            id: "sel-" + lado,
            data: [l],
            getHexagon: (x) => x.h3,
            extruded: false,
            highPrecision: true,
            filled: false,
            stroked: true,
            getLineColor: rgb(css("--ink")),
            lineWidthMinPixels: 3,
          })
        );
      }
    }
    return L;
  }

  /** Rótulo do intervalo de uma classe (item 5 da SPEC_F6 C4). */
  function intervaloLabel(i, contexto) {
    if (contexto.tipo === "vezes_taxa") {
      const cortes = CORTES_VEZES_TAXA;
      if (i === 0) return `< ${formatar(cortes[0], 2)}×`;
      if (i === cortes.length) return `≥ ${formatar(cortes[cortes.length - 1], 2)}×`;
      const txt = `${formatar(cortes[i - 1], 2)}–${formatar(cortes[i], 2)}×`;
      return cortes[i - 1] >= 0.8 && cortes[i] <= 1.25 ? `${txt} (parecido com o domínio)` : txt;
    }
    const unidade = contexto.tipo === "relativo_quebras" ? " %" : "";
    const dec = contexto.tipo === "relativo_quebras" ? 1 : 0;
    const lo = i === 0 ? 1 : contexto.quebras[i - 1];
    const hi = contexto.quebras[i];
    // A última classe é aberta: a quebra é o maior valor OBSERVADO (Jenks), não um
    // limite real — "500 ou mais" evita sugerir que nada passa de 500.
    if (i === contexto.quebras.length - 1) return `${formatar(lo, dec)}${unidade} ou mais`;
    return `${formatar(lo, dec)}${unidade} – ${formatar(hi, dec)}${unidade}`;
  }

  function renderizarLegendaDeficit(estado, contexto, rotuloMedida) {
    const periodo = estado.periodo;
    const entradasNormais = [];
    let hachuraCount = 0;
    let menos1Count = 0;
    for (const l of linhasArr) {
      const dom = l.dom[periodo];
      const bruto = brutoHex(l, estado.componente, periodo);
      const classe = classeHex(dom, bruto);
      if (classe === "hachura") hachuraCount++;
      else if (classe === "menos_de_1") menos1Count++;
      else if (classe === "normal") entradasNormais.push({ bruto, dom });
    }

    function indiceDe(item) {
      if (contexto.tipo === "absoluto") return indiceClasse(item.bruto, contexto.quebras);
      const relativoPct = item.dom > 0.5 ? (100 * item.bruto) / item.dom : null;
      if (relativoPct == null) return null;
      if (contexto.tipo === "vezes_taxa") {
        if (!contexto.taxa) return null;
        return indiceClasseVezesTaxa(relativoPct / contexto.taxa);
      }
      return indiceClasse(relativoPct, contexto.quebras);
    }

    const nClasses = contexto.tipo === "vezes_taxa" ? 6 : contexto.quebras.length;
    const grupos = Array.from({ length: nClasses }, () => ({ n: 0, soma: 0 }));
    let totalDeficit = 0;
    for (const item of entradasNormais) {
      const idx = indiceDe(item);
      if (idx == null) continue;
      grupos[idx].n++;
      grupos[idx].soma += item.bruto;
      totalDeficit += item.bruto;
    }

    const rampa = contexto.tipo === "vezes_taxa" ? RAMPA_VEZES_TAXA : rampaDeficit(contexto.quebras.length);
    if (!nClasses) {
      elementos.legend.innerHTML = `<b>${rotuloMedida}</b><div class="note">sem faixa</div>`;
      return;
    }

    const seletorHtml =
      estado.medida === "relativo"
        ? `<div class="legend-modo" role="group" aria-label="Modo da escala relativa">
        <label><input type="radio" name="relmodo" value="quebras" ${estado.relativo_modo !== "vezes_taxa" ? "checked" : ""}> quebras naturais (%)</label>
        <label><input type="radio" name="relmodo" value="vezes_taxa" ${estado.relativo_modo === "vezes_taxa" ? "checked" : ""}> vezes a taxa do domínio</label>
      </div>`
        : "";

    const linhasClasses = grupos
      .map(
        (g, i) => `<div class="legend-row"><span class="sw" style="background:${rampa[i]}"></span><span class="faixa">${intervaloLabel(
          i,
          contexto
        )}</span><span class="n">${formatar(g.n, 0)} hex.</span><span class="pct">${
          totalDeficit > 0 ? formatarPercentual((100 * g.soma) / totalDeficit, 0) : "—"
        }</span></div>`
      )
      .join("");

    const notaTaxa =
      contexto.tipo === "vezes_taxa" && contexto.taxa != null
        ? `<div class="note">Taxa do domínio (déficit ÷ domicílios): ${formatarPercentual(contexto.taxa, 2)}.</div>`
        : "";

    elementos.legend.innerHTML = `<b>${rotuloMedida}</b>${seletorHtml}
      <div class="legend-classes">${linhasClasses}
        <div class="legend-row especial"><span class="sw" style="background:${css("--line")}"></span><span class="faixa">menos de 1 (déficit)</span><span class="n">${formatar(menos1Count, 0)} hex.</span><span class="pct"></span></div>
        <div class="legend-row especial"><span class="sw hachura" style="background:${css("--muted")}"></span><span class="faixa">menos de 1 domicílio</span><span class="n">${formatar(hachuraCount, 0)} hex.</span><span class="pct"></span></div>
      </div>
      ${notaTaxa}
      <div class="note" style="margin-top:4px">Quebras naturais (Jenks, 1967), do menor ao maior déficit. Listrado = menos de 1 domicílio (fora das contas).</div>`;

    if (estado.medida === "relativo" && elementos.aoMudarRelativoModo) {
      elementos.legend.querySelectorAll('input[name="relmodo"]').forEach((el) => {
        el.onchange = () => elementos.aoMudarRelativoModo(el.value);
      });
    }
  }

  function renderizarLegenda(estado, obterValor, rotuloMedida, tipoMedida, contexto) {
    if (tipoMedida === "categorica") {
      const categorias = [...new Set(linhasArr.map((l) => obterValor(l, estado.periodo)).filter((v) => v != null))];
      elementos.legend.innerHTML = `<b>${rotuloMedida}</b><div class="ramp">${categorias
        .map((v) => `<span style="background:${css(CORES_CATEGORIA[v] ?? "--muted")};flex:0 0 14px;margin-right:4px;border-radius:3px" title="${v}"></span>`)
        .join("")}</div><div class="note" style="margin-top:4px">${categorias.join(" · ")}</div>`;
      return;
    }
    if (estado.tema === "deficit") {
      renderizarLegendaDeficit(estado, contexto, rotuloMedida);
      return;
    }
    const qualidade = estado.tema === "qualidade";
    const rampa = qualidade ? RAMPA_QUALIDADE : RAMPA_DEFICIT;
    const unidade = estado.medida === "relativo" && !qualidade ? " %" : "";
    const t = [0, ...faixaEscala];
    if (!faixaEscala.length) {
      elementos.legend.innerHTML = `<b>${rotuloMedida}</b><div class="note">sem faixa</div>`;
      return;
    }
    elementos.legend.innerHTML = `<b>${rotuloMedida}</b><div class="ramp">${rampa
      .map((c) => `<span style="background:${c}"></span>`)
      .join("")}</div><div class="ticks num"><span>${formatar(t[1], 1)}${unidade}</span><span>${formatar(
      t[4],
      1
    )}${unidade}</span><span>${formatar(t[6], 1)}${unidade}</span></div><div class="note" style="margin-top:4px">Classes por sétimos (quantis). Cinza claro = zero; cinza escuro = sigilo.</div>`;
  }

  function renderizarCamadasUI(estado, aoMudar, aoMudarOpacidade, aoMudarMapaBase) {
    const extras = [];
    extras.push(
      `<label><input type="checkbox" data-camada="ap" ${estado.camadas.ap ? "checked" : ""}> <span class="sw" style="border-color:var(--apline)"></span> Áreas de ponderação</label>`
    );
    extras.push(
      `<label><input type="checkbox" data-camada="fcu" ${estado.camadas.fcu ? "checked" : ""}> <span class="sw" style="border-color:var(--fcu)"></span> Favelas e comunidades (FCU)</label>`
    );
    if (contornosMunicipios) {
      extras.push(
        `<label><input type="checkbox" data-camada="municipios" ${estado.camadas.municipios ? "checked" : ""}> <span class="sw" style="border-color:var(--ink)"></span> Municípios</label>`
      );
    }
    for (const recorte of manifesto.recortes ?? []) {
      extras.push(
        `<label title="${recorte.motivo ?? ""}"><input type="checkbox" data-camada="${recorte.id}" ${
          estado.camadas[recorte.id] ? "checked" : ""
        }> <span class="sw" style="border-color:var(--bk)"></span> ${recorte.nome}</label>`
      );
    }
    const opacidadeHtml = `<label class="ctl-opacidade">Opacidade <input type="range" id="f1-opacidade" min="0.2" max="1" step="0.1" value="${estado.opacidade ?? 0.8}"></label>`;
    const modo = MODOS_BASE.includes(estado.mapa_base) ? estado.mapa_base : "claro";
    const opcaoBase = (v, rotulo, id) => `<label><input type="radio" name="f1-mapa-base" value="${v}" id="${id}" ${modo === v ? "checked" : ""}> ${rotulo}</label>`;
    const cinzaHtml = `<fieldset class="mapa-base"><legend>Mapa de base</legend>${opcaoBase("claro", "Claro", "f1-mapa-claro")}${opcaoBase("escuro", "Escuro", "f1-mapa-escuro")}${opcaoBase("cinza", "Cinza", "f1-mapa-cinza")}</fieldset>`;
    elementos.layers.innerHTML = `<button type="button" class="layers-toggle" aria-expanded="${!camadasRecolhidas}" aria-controls="f1-layers-body"><span>Camadas</span><span aria-hidden="true">${camadasRecolhidas ? "▸" : "▾"}</span></button><div class="layers-body" id="f1-layers-body">${extras.join("")}${opacidadeHtml}${cinzaHtml}</div>`;
    elementos.layers.classList.toggle("recolhido", camadasRecolhidas);
    elementos.layers.querySelector(".layers-toggle").onclick = () => {
      camadasRecolhidas = !camadasRecolhidas;
      elementos.layers.classList.toggle("recolhido", camadasRecolhidas);
      const t = elementos.layers.querySelector(".layers-toggle");
      t.setAttribute("aria-expanded", String(!camadasRecolhidas));
      t.lastElementChild.textContent = camadasRecolhidas ? "▸" : "▾";
    };
    elementos.layers.querySelectorAll("input[data-camada]").forEach((el) => {
      el.onchange = () => aoMudar(el.dataset.camada, el.checked);
    });
    const opEl = elementos.layers.querySelector("#f1-opacidade");
    if (opEl && aoMudarOpacidade) opEl.oninput = () => aoMudarOpacidade(Number(opEl.value));
    elementos.layers.querySelectorAll('input[name="f1-mapa-base"]').forEach((el) => {
      el.onchange = () => el.checked && aoMudarMapaBase && aoMudarMapaBase(el.value);
    });
    elementos.mapboxEl?.classList.toggle("cinza", modo === "cinza");
    definirModoBase(modo);
  }

  function renderizar(estado, obterValor, rotuloMedida, tipoMedida = "deficit", filtro = null) {
    filtroH3 = filtro;
    computarEscala(estado.periodo, estado.comparar, obterValor, tipoMedida, estado);
    instancias.a.overlay.setProps({ layers: camadasPara(estado.periodo, estado, obterValor, "a", tipoMedida) });

    const ligada = !!estado.comparar;
    elementos.deckB.style.display = ligada ? "block" : "none";
    elementos.divider.style.display = ligada ? "block" : "none";
    elementos.labB.style.display = ligada ? "block" : "none";
    const perA = manifesto.periodos.find((p) => p.id === estado.periodo);
    elementos.labA.textContent = perA?.rotulo ?? "";
    if (ligada) {
      instancias.b.overlay.setProps({ layers: camadasPara(estado.comparar, estado, obterValor, "b", tipoMedida) });
      const perB = manifesto.periodos.find((p) => p.id === estado.comparar);
      elementos.labB.textContent = perB?.rotulo ?? "";
      elementos.deckB.style.clipPath = `inset(0 0 0 ${clipPercentual}%)`;
      elementos.divider.style.left = clipPercentual + "%";
    }
    const contextoLegenda = estado.tema === "deficit" ? contextoCorDeficit(estado, estado.periodo) : null;
    renderizarLegenda(estado, obterValor, rotuloMedida, tipoMedida, contextoLegenda);

    if (!pronto) {
      pronto = true;
      elementos.mapboxEl.dataset.pronto = "true";
      elementos.mapboxEl.dispatchEvent(new CustomEvent("mapa-pronto", { bubbles: true }));
    }
  }

  function moverPara(h3) {
    const [lat, lng] = cellToLatLng(h3);
    for (const { mapa } of Object.values(instancias)) {
      mapa.flyTo({ center: [lng, lat], zoom: Math.max(mapa.getZoom(), 12.6) });
    }
  }

  function ligarArrasto() {
    const mb = elementos.mapboxEl;
    const hd = elementos.divider.querySelector("button");
    const mover = (clienteX) => {
      const r = mb.getBoundingClientRect();
      clipPercentual = Math.max(5, Math.min(95, (100 * (clienteX - r.left)) / r.width));
      elementos.deckB.style.clipPath = `inset(0 0 0 ${clipPercentual}%)`;
      elementos.divider.style.left = clipPercentual + "%";
      elementos.divider.setAttribute("aria-valuenow", String(Math.round(clipPercentual)));
    };
    hd.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      hd.setPointerCapture(e.pointerId);
      const mv = (ev) => mover(ev.clientX);
      const up = () => {
        hd.removeEventListener("pointermove", mv);
        hd.removeEventListener("pointerup", up);
      };
      hd.addEventListener("pointermove", mv);
      hd.addEventListener("pointerup", up);
    });
    elementos.divider.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        clipPercentual = Math.max(5, Math.min(95, clipPercentual + (e.key === "ArrowLeft" ? -5 : 5)));
        elementos.deckB.style.clipPath = `inset(0 0 0 ${clipPercentual}%)`;
        elementos.divider.style.left = clipPercentual + "%";
        elementos.divider.setAttribute("aria-valuenow", String(Math.round(clipPercentual)));
      }
    });
  }
  ligarArrasto();


  return {
    renderizar, renderizarCamadasUI, moverPara, agruparPorAp,
    get baseFalhou() { return baseFalhou; },
    // Seam de teste (Playwright, F6.1-6): instâncias MapLibre dos dois lados
    // da cortina, para conferir a sincronia de câmera sem depender de pixels.
    instanciasMapLibre: { a: instancias.a.mapa, b: instancias.b.mapa },
  };
}

/**
 * Mini-mapa da Visão geral (SPEC_F2 §3): mesmo motor de cor/camada do
 * explorador, sem cortina, sem camadas ligáveis e sem controles — só o
 * déficit relativo total no período mais recente.
 */
export function criarMiniMapa({ container, manifesto, linhas, ap, totais, tooltip, aoClicarHexagono }) {
  const linhasArr = [...linhas.values()];
  const periodoRecente = [...manifesto.periodos].reverse().find((p) => p.tipo === "ano")?.id ?? manifesto.periodos.at(-1).id;

  const mapa = new MapaMapLibre({
    container,
    style: ESTILOS_BASE.claro, // acréscimo B: base clara em qualquer tema
    center: manifesto.centro ?? [-35.715, -9.585],
    zoom: Math.max((manifesto.zoom_inicial ?? 11) - 1.6, 0),
    interactive: true,
    attributionControl: false,
  });
  const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
  mapa.addControl(overlay);

  function obterValor(l) {
    let soma = 0;
    for (const c of ["coabitacao", "onus", "precariedade"]) {
      const v = l.hex[periodoRecente]?.[c]?.absoluto;
      if (v == null) return null;
      soma += v;
    }
    const dom = l.dom[periodoRecente];
    return dom != null && dom > 0.5 ? (100 * soma) / dom : null;
  }

  function render() {
    const vs = linhasArr.map(obterValor).filter((v) => v != null && v > 0).sort(ascending);
    const breaks = vs.length ? [1, 2, 3, 4, 5, 6].map((i) => quantileSorted(vs, i / 7)) : [];
    function cor(l) {
      const v = obterValor(l);
      if (v == null || v <= 0) return [...rgb(css("--line")), 70];
      let i = 0;
      while (i < breaks.length && v > breaks[i]) i++;
      return [...rgb(RAMPA_DEFICIT[Math.min(i, RAMPA_DEFICIT.length - 1)]), 215];
    }
    overlay.setProps({
      layers: [
        new H3HexagonLayer({
          id: "mini-hex",
          data: linhasArr,
          getHexagon: (l) => l.h3,
          getFillColor: cor,
          extruded: false,
          highPrecision: true,
          stroked: false,
          pickable: true,
          updateTriggers: { getFillColor: [periodoRecente] },
          onClick: ({ object }) => {
            if (object && aoClicarHexagono) aoClicarHexagono(object.h3);
          },
          onHover: ({ object, x, y }) => {
            if (!tooltip) return;
            if (!object) {
              tooltip.setAttribute("hidden", "");
              return;
            }
            let html = "";
            try {
              const bruto = brutoHex(object, "total", periodoRecente);
              const dom = object.dom[periodoRecente];
              const relativo = bruto != null && dom > 0.5 ? (100 * bruto) / dom : null;
              const municipio = object.municipioNome + (object.nMunicipios > 1 ? ` (+${object.nMunicipios - 1})` : "");
              const apNome = ap?.get(object.apCod)?.ap_nome ?? object.apCod;
              let pesoHtml = "";
              if (totais && bruto != null) {
                const totalComponente = totalDoMapa(totais, "total", periodoRecente);
                if (totalComponente?.total) pesoHtml = `<div class="linha">Peso no total do domínio: ${formatarPercentual((100 * bruto) / totalComponente.total, 2)}</div>`;
              }
              html = `<b>${municipio}</b><div class="linha">AP: ${apNome}</div><div class="linha">Relativo: ${formatarPercentual(relativo, 1)}</div>${pesoHtml}`;
            } catch {
              html = "";
            }
            // F6.3 item 5: nunca mostrar a caixa sem conteúdo.
            if (!html) {
              tooltip.setAttribute("hidden", "");
              return;
            }
            tooltip.removeAttribute("hidden");
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
            tooltip.innerHTML = html;
          },
        }),
      ],
    });
  }

  mapa.on("load", render);

  return { periodoRecente };
}
