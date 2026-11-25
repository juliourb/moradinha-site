// Estado da "pergunta" do explorador (SPEC_F1 §1) e a frase em texto (§2).
// O hash da URL só guarda o nome da aba (cuidado do próprio Quarto); este
// estado fica na memória e, opcionalmente, em localStorage.

export const CHAVE_LOCALSTORAGE = "moradinha.pergunta";

export const COMPONENTES = ["total", "coabitacao", "onus", "precariedade"];
export const NOME_COMPONENTE = {
  total: "total",
  coabitacao: "coabitação",
  onus: "ônus",
  precariedade: "precariedade",
};
export const MEDIDAS_QUALIDADE = [
  "incerteza",
  "qualidade_dado",
  "ressalva_ap",
  "cv_ap",
  "imputacao",
  "estoque",
  "hex_novo",
];

/** @param {object} manifesto */
export function estadoInicial(manifesto) {
  const periodos = manifesto?.periodos ?? [];
  const periodoPadrao = periodos[3]?.id ?? periodos[periodos.length - 1]?.id ?? null;
  const camadas = { ap: true, fcu: false, municipios: false };
  for (const recorte of manifesto?.recortes ?? []) camadas[recorte.id] = false;

  const salvo = lerLocalStorage();
  return {
    tema: "deficit",
    medida_qualidade: "incerteza",
    conjunto_graficos: 0,
    medida: "absoluto",
    relativo_modo: "quebras",
    opacidade: 0.8,
    componente: "total",
    periodo: periodoPadrao,
    selecionado: null,
    faixa_hist: [],
    quadrante: null,
    camadas,
    ...salvo,
    // Acréscimo B: o mapa de base abre sempre claro (não persiste).
    mapa_base: "claro",
    quadrante: null,
    comparar: null,
    // S1-4: a escolha guardada vem de outro domínio, talvez; só vale o que existe neste manifesto.
    periodo: periodos.some((p) => p.id === salvo.periodo) ? salvo.periodo : periodoPadrao,
    camadas: Object.fromEntries(Object.keys(camadas).map((k) => [k, salvo.camadas?.[k] ?? camadas[k]])),
  };
}

function lerLocalStorage() {
  try {
    const bruto = localStorage.getItem(CHAVE_LOCALSTORAGE);
    return bruto ? JSON.parse(bruto) : {};
  } catch {
    return {};
  }
}

/** @param {object} estado */
export function salvarLocalStorage(estado) {
  try {
    // comparar (cortina) nunca persiste: N6 pede que ela comece desligada em
    // toda carga/recarga da página.
    const { selecionado, faixa_hist, comparar, mapa_base, mapa_base_cinza, quadrante, ...persistido } = estado;
    localStorage.setItem(CHAVE_LOCALSTORAGE, JSON.stringify(persistido));
  } catch {
    // localStorage indisponível (modo privado, quota, etc.): segue sem persistir.
  }
}

/**
 * Grava um estado parcial da pergunta para a próxima vez que Resultados
 * carregar (ex.: clique num cartão da Visão geral). SPEC_F2 item 2.
 */
export function prepararNavegacaoResultados(parcial) {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_LOCALSTORAGE) ?? "{}");
    localStorage.setItem(CHAVE_LOCALSTORAGE, JSON.stringify({ ...salvo, ...parcial }));
  } catch {
    // localStorage indisponível: Resultados abre com o estado padrão.
  }
}

/**
 * Acréscimo F (F6.5): a cortina compara com outro PERÍODO (comparar = id do
 * período) ou com outro COMPONENTE no mesmo período (comparar = "c:<componente>").
 * @returns {{tipo:"periodo", periodo:string, componente:string} | {tipo:"componente", periodo:string, componente:string} | null}
 */
export const PREFIXO_COMPARAR_COMPONENTE = "c:";
export function alvoComparacao(estado) {
  const c = estado?.comparar;
  if (!c) return null;
  if (c.startsWith(PREFIXO_COMPARAR_COMPONENTE)) {
    const componente = c.slice(PREFIXO_COMPARAR_COMPONENTE.length);
    return componente && componente !== estado.componente ? { tipo: "componente", componente, periodo: estado.periodo } : null;
  }
  return c !== estado.periodo ? { tipo: "periodo", periodo: c, componente: estado.componente } : null;
}

function rotuloPeriodo(periodoId, manifesto, preposicao = true) {
  const p = manifesto.periodos.find((x) => x.id === periodoId);
  if (!p) return "";
  if (!preposicao) return p.rotulo;
  return p.tipo === "media" ? `na ${p.rotulo.toLowerCase()}` : `em ${p.rotulo}`;
}

/** @param {object} estado @param {object} manifesto @returns {string} */
export function textoPergunta(estado, manifesto) {
  const per = rotuloPeriodo(estado.periodo, manifesto);
  const comp = estado.componente === "total" ? ", total," : ` de ${NOME_COMPONENTE[estado.componente]},`;

  if (estado.tema === "qualidade") {
    const nomeComp = estado.componente === "total" ? ", no total," : ` de ${NOME_COMPONENTE[estado.componente]}`;
    return `Quão confiável é a estimativa${nomeComp} ${per}?`;
  }

  const medidaTxt = estado.medida === "abs" || estado.medida === "absoluto" ? "absoluto" : "relativo";
  let texto = `Onde está o déficit ${medidaTxt}${comp} ${per}?`;
  const alvo = alvoComparacao(estado);
  if (alvo?.tipo === "periodo") texto += ` Comparado com ${rotuloPeriodo(alvo.periodo, manifesto, false)}.`;
  if (alvo?.tipo === "componente") texto += ` Comparado com ${alvo.componente === "total" ? "o total" : NOME_COMPONENTE[alvo.componente]}, no mesmo período.`;
  return texto;
}
