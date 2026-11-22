// Mapa do explorador (SPEC_F1 §3): MapLibre GL (OpenFreeMap, sem chave) com a
// camada do deck.gl sobreposta via @deck.gl/mapbox; H3HexagonLayer única;
// cortina com duas instâncias sincronizadas; camadas de contornos.
import { Map as MapaMapLibre } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { H3HexagonLayer, H3ClusterLayer } from "deck.gl";
import { luma } from "@luma.gl/core";
import { webgl2Adapter } from "@luma.gl/webgl";
import { ascending, quantileSorted, color as d3color } from "d3";
import { cellToLatLng } from "h3-js";
import { formatar } from "../util/formato.js";

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

function css(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}
function rgb(hex) {
  const c = d3color(hex);
  return c ? [c.r, c.g, c.b] : [128, 128, 128];
}
function temaEscuro() {
  const t = document.documentElement.getAttribute("data-theme");
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

export function criarMapa({ elementos, manifesto, linhas, ap, contornosAp, contornosMunicipios, contornosFcu }) {
  const linhasArr = [...linhas.values()];
  const apGrupos = [];
  for (const [, idsPorAp] of agruparPorAp(linhasArr)) apGrupos.push({ ids: idsPorAp });

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

  function criarInstancia(container, elBasefail, aoFalhar) {
    const mapa = new MapaMapLibre({
      container,
      style: temaEscuro() ? ESTILOS_BASE.escuro : ESTILOS_BASE.claro,
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

  function computarEscala(periodo, periodoComparar, obterValor, tipoMedida) {
    if (tipoMedida === "categorica") {
      faixaEscala = [];
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

  function corHex(l, periodo, estado, obterValor, tipoMedida) {
    const v = obterValor(l, periodo);
    const qualidade = estado.tema === "qualidade";
    if (l.dom[periodo] == null && !qualidade) return [...rgb(css("--muted")), 110];
    if (tipoMedida === "categorica") {
      if (v == null) return [...rgb(css("--line")), 70];
      const varName = CORES_CATEGORIA[v] ?? "--muted";
      return [...rgb(css(varName)), 215];
    }
    const c = corPara(v, qualidade);
    if (!c) return [...rgb(css("--line")), 70];
    let alfa = 215;
    if (estado.faixa_hist && !(v >= estado.faixa_hist[0] && v < estado.faixa_hist[1])) alfa = 45;
    return [...rgb(c), alfa];
  }

  function camadasPara(periodo, estado, obterValor, lado, tipoMedida) {
    const L = [];
    L.push(
      new H3HexagonLayer({
        id: "hex-" + lado,
        data: linhasArr,
        getHexagon: (l) => l.h3,
        getFillColor: (l) => corHex(l, periodo, estado, obterValor, tipoMedida),
        updateTriggers: {
          getFillColor: [
            periodo, estado.tema, estado.medida, estado.componente, estado.medida_qualidade,
            estado.faixa_hist, tipoMedida, faixaEscala.join(","),
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
      })
    );
    if (estado.camadas.ap && apGrupos.length) {
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
    if (estado.camadas.fcu) {
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
    for (const recorte of manifesto.recortes ?? []) {
      if (!estado.camadas[recorte.id]) continue;
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

  function renderizarLegenda(estado, obterValor, rotuloMedida, tipoMedida) {
    if (tipoMedida === "categorica") {
      const categorias = [...new Set(linhasArr.map((l) => obterValor(l, estado.periodo)).filter((v) => v != null))];
      elementos.legend.innerHTML = `<b>${rotuloMedida}</b><div class="ramp">${categorias
        .map((v) => `<span style="background:${css(CORES_CATEGORIA[v] ?? "--muted")};flex:0 0 14px;margin-right:4px;border-radius:3px" title="${v}"></span>`)
        .join("")}</div><div class="note" style="margin-top:4px">${categorias.join(" · ")}</div>`;
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

  function renderizarCamadasUI(estado, aoMudar) {
    const extras = [];
    extras.push(
      `<label><input type="checkbox" data-camada="ap" ${estado.camadas.ap ? "checked" : ""}> <span class="sw" style="border-color:var(--apline)"></span> Áreas de ponderação</label>`
    );
    extras.push(
      `<label><input type="checkbox" data-camada="fcu" ${estado.camadas.fcu ? "checked" : ""}> <span class="sw" style="border-color:var(--fcu)"></span> Favelas e comunidades (FCU)</label>`
    );
    for (const recorte of manifesto.recortes ?? []) {
      extras.push(
        `<label title="${recorte.motivo ?? ""}"><input type="checkbox" data-camada="${recorte.id}" ${
          estado.camadas[recorte.id] ? "checked" : ""
        }> <span class="sw" style="border-color:var(--bk)"></span> ${recorte.nome}</label>`
      );
    }
    elementos.layers.innerHTML = `<span class="t">Camadas</span>${extras.join("")}`;
    elementos.layers.querySelectorAll("input[data-camada]").forEach((el) => {
      el.onchange = () => aoMudar(el.dataset.camada, el.checked);
    });
  }

  function renderizar(estado, obterValor, rotuloMedida, tipoMedida = "deficit") {
    computarEscala(estado.periodo, estado.comparar, obterValor, tipoMedida);
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
    renderizarLegenda(estado, obterValor, rotuloMedida, tipoMedida);

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

  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", trocarEstilo);
  new MutationObserver(trocarEstilo).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  function trocarEstilo() {
    const url = temaEscuro() ? ESTILOS_BASE.escuro : ESTILOS_BASE.claro;
    instancias.a.mapa.setStyle(url);
    instancias.b.mapa.setStyle(url);
  }

  return { renderizar, renderizarCamadasUI, moverPara, agruparPorAp, get baseFalhou() { return baseFalhou; } };
}

/**
 * Mini-mapa da Visão geral (SPEC_F2 §3): mesmo motor de cor/camada do
 * explorador, sem cortina, sem camadas ligáveis e sem controles — só o
 * déficit relativo total no período mais recente.
 */
export function criarMiniMapa({ container, manifesto, linhas }) {
  const linhasArr = [...linhas.values()];
  const periodoRecente = [...manifesto.periodos].reverse().find((p) => p.tipo === "ano")?.id ?? manifesto.periodos.at(-1).id;

  const mapa = new MapaMapLibre({
    container,
    style: temaEscuro() ? ESTILOS_BASE.escuro : ESTILOS_BASE.claro,
    center: manifesto.centro ?? [-35.715, -9.585],
    zoom: Math.max((manifesto.zoom_inicial ?? 11) - 1.6, 0),
    interactive: false,
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
          updateTriggers: { getFillColor: [periodoRecente] },
        }),
      ],
    });
  }

  mapa.on("load", render);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    mapa.setStyle(temaEscuro() ? ESTILOS_BASE.escuro : ESTILOS_BASE.claro);
    mapa.once("styledata", render);
  });
  new MutationObserver(() => {
    mapa.setStyle(temaEscuro() ? ESTILOS_BASE.escuro : ESTILOS_BASE.claro);
    mapa.once("styledata", render);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return { periodoRecente };
}
