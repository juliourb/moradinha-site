// Dados da aba Metodologia (SPEC_F4). Leitura direta de pipeline.json e do
// manifesto — nenhum cálculo de domínio além do que já vem pronto no pacote.
import { LIMIARES_RASTREIO } from "../util/limiares.js";
import { rotuloFonteEstoque } from "../util/marcas.js";

export const COMPONENTES_MODELO = ["coabitacao", "onus", "precariedade"];
export const CLAB = { coabitacao: "Coabitação", onus: "Ônus", precariedade: "Precariedade" };

/**
 * Resolve uma ponta de ligação (`de`/`para`) para o(s) id(s) de etapa: o
 * contrato não fixa se `ligacoes` referencia `etapas[].id` diretamente (como
 * nos pacotes fictícios) ou um nome em `etapas[].saidas` (como no pipeline
 * real do moradinha, onde a ligação é pela tabela de saída); aqui aceita os
 * dois. Mais de uma etapa pode produzir a mesma saída (reprocessamento) —
 * nesse caso resolve para todas.
 */
export function resolverEtapa(etapas, chave) {
  if (etapas.some((e) => e.id === chave)) return [chave];
  return etapas.filter((e) => e.saidas?.includes(chave)).map((e) => e.id);
}

export const ID_NO_EXPORTACAO = "__exportacao__";

/**
 * Grupo de uma etapa pelo esquema da tabela que produz (antes do ponto em
 * `saidas[0]`), com exceções por tabela (SPEC_F6 B4/N18). Tabela sem grupo
 * conhecido cai em "Outras".
 */
export function grupoDaTabela(nomeTabela, config) {
  if (config.excecoes?.[nomeTabela]) return config.excecoes[nomeTabela];
  const esquema = nomeTabela.includes(".") ? nomeTabela.split(".")[0] : nomeTabela;
  return config.esquemas?.[esquema] ?? "Outras";
}

/**
 * Agrupa as 54 etapas do pipeline nas etapas do método, mais um nó
 * sintético de Exportação (manifesto + edição do pacote). Retorna só os
 * grupos com pelo menos uma etapa, na ordem de `config.ordem` (grupos fora
 * dessa lista, como "Outras", vão ao final).
 */
export function agruparPipeline(pipeline, manifesto, config) {
  const grupos = new Map();
  const grupoPorEtapaId = new Map();
  for (const etapa of pipeline.etapas) {
    const tabela = etapa.saidas?.[0] ?? etapa.id;
    const nomeGrupo = grupoDaTabela(tabela, config);
    grupoPorEtapaId.set(etapa.id, nomeGrupo);
    if (!grupos.has(nomeGrupo)) grupos.set(nomeGrupo, { nome: nomeGrupo, etapas: [] });
    grupos.get(nomeGrupo).etapas.push(etapa);
  }

  const noExportacao = {
    id: ID_NO_EXPORTACAO,
    nome: `Pacote ${manifesto.edicao}`,
    descricao: "Manifesto, hashes e a edição exata do pacote de publicação.",
    commit: manifesto.commit_completo ?? manifesto.edicao,
    data: manifesto.data_execucao?.slice(0, 10) ?? "",
    saidas: [],
  };
  if (!grupos.has("Exportação")) grupos.set("Exportação", { nome: "Exportação", etapas: [] });
  grupos.get("Exportação").etapas.push(noExportacao);

  const ordemFinal = [...(config.ordem ?? []), ...[...grupos.keys()].filter((k) => !(config.ordem ?? []).includes(k))];
  return {
    grupos: ordemFinal.map((nome) => grupos.get(nome)).filter((g) => g?.etapas.length),
    grupoPorEtapaId,
    tabelasSemGrupo: pipeline.etapas.filter((e) => grupoPorEtapaId.get(e.id) === "Outras").map((e) => e.saidas?.[0] ?? e.id),
  };
}

/** Ligações entre grupos (para o grafo recolhido), deduplicadas, sem autolaço. */
export function arestasEntreGrupos(pipeline, grupoPorEtapaId) {
  const vistos = new Set();
  const arestas = [];
  for (const l of pipeline.ligacoes) {
    for (const deId of resolverEtapa(pipeline.etapas, l.de)) {
      for (const paraId of resolverEtapa(pipeline.etapas, l.para)) {
        const g1 = grupoPorEtapaId.get(deId);
        const g2 = grupoPorEtapaId.get(paraId);
        if (!g1 || !g2 || g1 === g2) continue;
        const chave = `${g1}>>${g2}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        arestas.push({ de: g1, para: g2 });
      }
    }
  }
  // Toda etapa alimenta a Exportação do pacote (nó sintético, sempre ao final).
  for (const g of new Set(grupoPorEtapaId.values())) {
    if (g === "Exportação") continue;
    const chave = `${g}>>Exportação`;
    if (!vistos.has(chave)) {
      vistos.add(chave);
      arestas.push({ de: g, para: "Exportação" });
    }
  }
  return arestas;
}

/** Ligações internas de um grupo (para o grafo expandido de subetapas). */
export function pipelineDoGrupo(pipeline, grupo) {
  const idsDoGrupo = new Set(grupo.etapas.map((e) => e.id));
  const ligacoes = pipeline.ligacoes.filter((l) => {
    const deIds = resolverEtapa(pipeline.etapas, l.de);
    const paraIds = resolverEtapa(pipeline.etapas, l.para);
    return deIds.some((id) => idsDoGrupo.has(id)) && paraIds.some((id) => idsDoGrupo.has(id));
  });
  return { etapas: grupo.etapas, ligacoes };
}

/**
 * Camadas do grafo do pipeline por caminho mais longo a partir das raízes
 * (sem predecessor): cada etapa fica à direita de todas as que a alimentam,
 * o layout fica determinístico mesmo que o pipeline vire um DAG com ramos.
 */
export function camadasPipeline(pipeline) {
  const { etapas, ligacoes } = pipeline;
  const predecessores = new Map(etapas.map((e) => [e.id, []]));
  const arestas = [];
  for (const l of ligacoes) {
    for (const paraId of resolverEtapa(etapas, l.para)) {
      for (const deId of resolverEtapa(etapas, l.de)) {
        if (deId === paraId) continue;
        predecessores.get(paraId)?.push(deId);
        arestas.push({ de: deId, para: paraId });
      }
    }
  }

  const camadaPorId = new Map();
  function camadaDe(id, emProgresso = new Set()) {
    if (camadaPorId.has(id)) return camadaPorId.get(id);
    if (emProgresso.has(id)) return 0; // ciclo (não devia existir numa linhagem de tabelas, mas não trava o grafo)
    emProgresso.add(id);
    const preds = predecessores.get(id) ?? [];
    const c = preds.length ? 1 + Math.max(...preds.map((p) => camadaDe(p, emProgresso))) : 0;
    camadaPorId.set(id, c);
    return c;
  }
  for (const e of etapas) camadaDe(e.id);

  const porCamada = new Map();
  for (const e of etapas) {
    const c = camadaPorId.get(e.id);
    if (!porCamada.has(c)) porCamada.set(c, []);
    porCamada.get(c).push(e.id);
  }

  const nos = etapas.map((e) => ({
    ...e,
    camada: camadaPorId.get(e.id),
    posicao: porCamada.get(camadaPorId.get(e.id)).indexOf(e.id),
  }));
  const nCamadas = Math.max(...[...camadaPorId.values()]) + 1;
  const maiorCamada = Math.max(...[...porCamada.values()].map((v) => v.length));
  return { nos, arestas, nCamadas, maiorCamada };
}

/**
 * Layout em camadas, da esquerda para a direita, do subgrafo de um grupo
 * (F6.4 4a). A camada de cada tabela vem da ordem das ligações do pipeline
 * (caminho mais longo a partir das raízes). Tabelas da mesma camada empilham em
 * colunas curtas (no máximo `maxPorColuna` linhas): uma camada com 22 tabelas
 * sem ligação (Coleta) vira um bloco de poucas colunas, não uma coluna de 22.
 * Dentro de cada camada, a ordem vertical segue a média das posições dos
 * predecessores (reduz o cruzamento de linhas). Devolve nós com `camada` =
 * índice de coluna visual e `posicao` = linha dentro da coluna.
 */
export function layoutCamadasEmColunas(pipeline, maxPorColuna = 6) {
  const base = camadasPipeline(pipeline);
  const preds = new Map(base.nos.map((n) => [n.id, []]));
  for (const a of base.arestas) preds.get(a.para)?.push(a.de);

  const porCamada = new Map();
  for (const n of base.nos) {
    if (!porCamada.has(n.camada)) porCamada.set(n.camada, []);
    porCamada.get(n.camada).push(n);
  }
  const yNorm = new Map(); // posição vertical relativa (0–1) de cada nó já ordenado
  const colunaDe = new Map();
  const linhaDe = new Map();
  let colunaAtual = 0;
  for (const camada of [...porCamada.keys()].sort((a, b) => a - b)) {
    const nos = porCamada.get(camada);
    const origem = new Map(nos.map((n, i) => [n.id, i]));
    const media = (n) => {
      const ys = (preds.get(n.id) ?? []).map((p) => yNorm.get(p)).filter((v) => v != null);
      return ys.length ? ys.reduce((x, y) => x + y, 0) / ys.length : null;
    };
    const ordenados = [...nos].sort((a, b) => {
      const ma = media(a);
      const mb = media(b);
      if (ma != null && mb != null && ma !== mb) return ma - mb;
      return origem.get(a.id) - origem.get(b.id);
    });
    const nCols = Math.max(1, Math.ceil(ordenados.length / maxPorColuna));
    const porCol = Math.ceil(ordenados.length / nCols);
    ordenados.forEach((n, i) => {
      colunaDe.set(n.id, colunaAtual + Math.floor(i / porCol));
      linhaDe.set(n.id, i % porCol);
      yNorm.set(n.id, i / Math.max(1, ordenados.length));
    });
    colunaAtual += nCols;
  }
  const nos = base.nos.map((n) => ({ ...n, camada: colunaDe.get(n.id), posicao: linhaDe.get(n.id), camadaLogica: n.camada }));
  return {
    nos,
    arestas: base.arestas,
    nColunas: colunaAtual,
    maiorColuna: Math.max(1, ...nos.map((n) => n.posicao + 1)),
  };
}

/** Tabela de parâmetros do domínio: períodos do manifesto + limiares fixos do protocolo. */
export function parametrosDominio(manifesto) {
  return {
    periodos: manifesto.periodos.map((p) => ({
      id: p.id,
      rotulo: p.rotulo,
      tipo: p.tipo,
      tipoRotulo: p.tipo === "media" ? `Média de ${p.anos?.length ?? "vários"} anos` : p.tipo === "ano" ? "Ano" : p.tipo,
      fonteEstoque: rotuloFonteEstoque(p.fonte_estoque),
    })),
    limiares: LIMIARES_RASTREIO,
  };
}

/** Dados do rastreio: edição, commit, data, contrato, e a lista de arquivos com o hash esperado (manifesto). */
export function linhasRastreio(manifesto) {
  return {
    edicao: manifesto.edicao,
    commitCompleto: manifesto.commit_completo,
    dataExecucao: manifesto.data_execucao,
    contrato: manifesto.contrato,
    arquivos: Object.entries(manifesto.arquivos).map(([nome, hashEsperado]) => ({ nome, hashEsperado })),
  };
}
