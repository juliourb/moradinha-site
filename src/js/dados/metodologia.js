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
function resolverEtapa(etapas, chave) {
  if (etapas.some((e) => e.id === chave)) return [chave];
  return etapas.filter((e) => e.saidas?.includes(chave)).map((e) => e.id);
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

/** Tabela de parâmetros do domínio: períodos do manifesto + limiares fixos do protocolo. */
export function parametrosDominio(manifesto) {
  return {
    periodos: manifesto.periodos.map((p) => ({
      id: p.id,
      rotulo: p.rotulo,
      tipo: p.tipo,
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
