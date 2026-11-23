// Dados da aba Confiabilidade (SPEC_F3). Leitura direta do pacote — nenhum
// cálculo além do que já vem pronto em qualidade.json/modelo.json/
// consistencia.json/achados.json.
import { ascending, quantileSorted } from "d3";
import { fjpTresValores } from "./visaoGeral.js";

export const COMPONENTES_MODELO = ["coabitacao", "onus", "precariedade"];
export const CLAB = { coabitacao: "Coabitação", onus: "Ônus", precariedade: "Precariedade" };

/** Indicador do referencia_fjp.json correspondente a cada componente (SPEC_F6 pergunta 1). */
const INDICADOR_FJP_POR_COMPONENTE = { coabitacao: "coabitacao", onus: "onus", precariedade: "habitacao_precaria" };

/**
 * Pergunta 1 ("Os números de partida batem?") — SPEC_F6.3, regra nova (decisão
 * de Julio, 22/11/2026): "bate" só quando as duas coisas valem — a FJP sem
 * CadÚnico cai dentro da faixa de 95% da reconstrução E a razão da ponte
 * (`qualidade.ponte.razao`) está entre 0,80 e 1,25; se só uma vale, "em parte";
 * se nenhuma vale, "não bate".
 */
export function veredictoPergunta1(qualidade, referenciaFjp, componente) {
  const pontePonto = (qualidade.ponte ?? []).find((p) => p.indicador === componente);
  const numero = pontePonto?.razao ?? null;
  const indicadorFjp = INDICADOR_FJP_POR_COMPONENTE[componente];
  const item = fjpTresValores(referenciaFjp ?? []).find((i) => i.indicador === indicadorFjp);
  const fjpDentro = item?.dentro ?? null;
  const ponteDentro = numero == null ? null : numero >= 0.8 && numero <= 1.25;
  let veredicto = null;
  if (fjpDentro != null && ponteDentro != null) {
    const nOk = (fjpDentro ? 1 : 0) + (ponteDentro ? 1 : 0);
    veredicto = nOk === 2 ? "bate" : nOk === 1 ? "em parte" : "não bate";
  }
  return { veredicto, numero };
}

/**
 * Pergunta 2 ("O modelo põe o déficit no lugar certo?") — protocolo a–e,
 * SPEC_F6 painel de vereditos. Roda sempre que os campos existirem, mesmo
 * com usado=false (o motivo é exibido separadamente na seção do modelo).
 */
export function veredictoPergunta2(modeloComponente) {
  if (!modeloComponente) return { veredicto: null, numero: null, motivo: null, usado: null };
  const numero = modeloComponente.ganho?.razao != null ? 100 * modeloComponente.ganho.razao : null;
  const a = modeloComponente.ganho?.razao != null && modeloComponente.ganho.razao <= 0.9;
  const ordem = modeloComponente.ordem;
  const b = ordem != null && ordem.spearman_modelo > ordem.spearman_base && ordem.spearman_modelo > 0.6;
  const c = ordem != null && ordem.top20_modelo > ordem.top20_base;
  const cobertura = modeloComponente.confianca?.cobertura_d;
  const d = cobertura != null && cobertura.modelo > cobertura.base;
  const viesAp = (modeloComponente.vies ?? []).filter((v) => v.grupo_tipo === "tipo de AP");
  const e = viesAp.length > 0 && viesAp.every((v) => v.razao_somas >= 0.9 && v.razao_somas <= 1.1);
  let veredicto;
  if (!a) veredicto = "não";
  else veredicto = a && b && c && d && e ? "sim" : "em parte";
  return { veredicto, numero, motivo: modeloComponente.motivo ?? null, usado: modeloComponente.usado };
}

const MARCAS_COMPARABILIDADE = new Set([
  "fonte_estoque_diferente", "media_inclui_fonte_diferente", "mudanca_no_ruido", "precariedade_provisoria_sem_faixa",
]);

/** Pergunta 3 ("A série é comparável entre anos?") — SPEC_F6 painel de vereditos. */
export function veredictoPergunta3(manifesto, totais, componente) {
  const linhasPorPeriodo = new Map(totais.totais.filter((t) => t.componente === componente && t.no_mapa === true).map((t) => [t.periodo, t]));
  const mudancasComponente = (totais.mudancas ?? []).filter((m) => m.componente === componente);
  let marcados = 0;
  for (const p of manifesto.periodos) {
    const marcasPeriodo = p.marcas ?? [];
    const marcasLinha = linhasPorPeriodo.get(p.id)?.marcas ?? [];
    const mudancaAqui = mudancasComponente.some((m) => m.para === p.id && (m.marcas ?? []).includes("mudanca_no_ruido"));
    const temMarca = [...marcasPeriodo, ...marcasLinha].some((m) => MARCAS_COMPARABILIDADE.has(m)) || mudancaAqui;
    if (temMarca) marcados++;
  }
  const total = manifesto.periodos.length;
  return { veredicto: marcados === 0 ? "sim" : "em parte", numero: total > 0 ? marcados / total : null, marcados, total };
}

/** Pergunta 4 ("O que ainda não sabemos") — sem veredito, só o número de achados públicos. */
export function veredictoPergunta4(achados) {
  return { veredicto: null, numero: achadosPublicos(achados).reduce((s, g) => s + g.itens.length, 0) };
}

/** Rótulo em linguagem simples para um valor de `uso_por_periodo` (N12). */
export function rotuloUso(uso) {
  if (uso == null) return "sem dado";
  if (uso === "do ano") return "do próprio ano";
  return uso;
}

/**
 * Matriz "o que falta" (N12): variável × período, SPEC_F6 seção 4.
 * Lê `qualidade.fontes[].uso_por_periodo`.
 */
export function matrizOqueFalta(qualidade, manifesto) {
  const fontes = qualidade.fontes ?? [];
  return fontes.map((f) => ({
    variavel: f.variavel,
    celulas: manifesto.periodos.map((p) => ({ periodo: p.id, uso: rotuloUso(f.uso_por_periodo?.[p.id]) })),
  }));
}

export const BLOCOS_MODELO = [
  {
    chave: "ganho",
    titulo: "O modelo ajuda?",
    significado:
      "Compara o modelo com o jeito mais simples de repartir o total: dar a todas as áreas a mesma taxa. " +
      '"Erra 42% menos" quer dizer que, nas áreas deixadas de fora do treino, o erro médio do modelo é 58% do erro dessa repartição simples.',
  },
  {
    chave: "ordem",
    titulo: "Acha onde está?",
    significado:
      "Mede se o modelo põe as áreas na ordem certa, da que tem mais déficit para a que tem menos. 1 é a ordem perfeita; perto de 0, a ordem é aleatória. " +
      "O top 20% diz que parte do déficit real cai nas 20% de áreas que o modelo aponta como piores.",
  },
  {
    chave: "calibracao",
    titulo: "Erra o tamanho?",
    significado:
      "Quando o modelo diz que uma área tem 3% de domicílios em déficit, ela tem mesmo 3%? Pontos sobre a diagonal = acerta o tamanho; " +
      "inclinação menor que 1 = exagera nas áreas altas e subestima nas baixas.",
  },
  {
    chave: "vies",
    titulo: "Erra para quem?",
    significado:
      "Mostra se o erro se concentra em algum grupo: acima de 1, o modelo põe déficit demais naquele grupo; abaixo de 1, de menos. " +
      "A faixa entre 0,90 e 1,10 é a tolerância do protocolo.",
  },
  {
    chave: "curvas",
    titulo: "Por quê?",
    significado:
      "O modelo (EBM, Explainable Boosting Machine) soma uma contribuição por característica do domicílio ou do território; " +
      "a importância diz quanto cada variável pesa no total. As curvas ficam recolhidas nesta edição.",
  },
  {
    chave: "confianca",
    titulo: "Quanto confiar nesses números?",
    significado:
      "Com poucas áreas (53 no piloto), cada métrica oscila; os intervalos mostram quanto. O Moran dos resíduos diz se os erros se agrupam no mapa " +
      "(se sim, falta ao modelo alguma informação espacial). A cobertura diz em quantas áreas o modelo cai dentro do intervalo de 95% da amostra — " +
      "um teste exigente, porque pede ao modelo a precisão da própria amostra.",
  },
];

/**
 * Allow-list explícita dos campos de `modelo.json` por componente — nunca lê
 * `.interno` (regra inviolável 5: nunca aparece no build público).
 */
export function blocoModelo(modeloComponente) {
  const { configuracao, usado, motivo, treino, ganho, ordem, calibracao, vies, curvas, importancia, confianca } = modeloComponente;
  return { configuracao, usado, motivo, treino, ganho, ordem, calibracao, vies, curvas, importancia, confianca };
}

/** Achados públicos, agrupados por situação. */
export function achadosPublicos(achados) {
  const grupos = new Map();
  for (const a of achados) {
    if (!a.publico) continue;
    if (!grupos.has(a.situacao)) grupos.set(a.situacao, []);
    grupos.get(a.situacao).push(a);
  }
  return [...grupos.entries()].map(([situacao, itens]) => ({ situacao, itens }));
}

/** Limite superior do eixo sem deixar valores extremos dominarem (SPEC_F3 F3-5): p99. */
export function limiteEixoP99(valores) {
  const vs = valores.filter((v) => v != null).sort(ascending);
  if (!vs.length) return 1;
  return quantileSorted(vs, 0.99) || vs.at(-1) || 1;
}

/** Escala fixa dos mapas de calor de Spearman (F6.4 3b): 0,8 a 1,0. */
export const ESCALA_SPEARMAN = { min: 0.8, max: 1 };

/** Posição (0–1) de um Spearman na escala fixa; abaixo de 0,8 fica no extremo baixo. */
export function posicaoSpearman(v) {
  if (v == null) return null;
  return Math.max(0, Math.min(1, (v - ESCALA_SPEARMAN.min) / (ESCALA_SPEARMAN.max - ESCALA_SPEARMAN.min)));
}

/**
 * Ano que menos se parece com os outros: menor média do Spearman com os demais
 * anos (fora da diagonal), somando os componentes. Só anos, não médias de período.
 * Devolve também se o pacote marca o estoque do ano como de outra fonte.
 */
export function periodoMenosParecido(spearman, manifesto) {
  const anos = manifesto.periodos.filter((p) => p.tipo === "ano");
  const somas = new Map(anos.map((p) => [p.id, { soma: 0, n: 0 }]));
  for (const { periodos, matriz } of Object.values(spearman ?? {})) {
    periodos.forEach((pi, i) => {
      if (!somas.has(pi)) return;
      periodos.forEach((pj, j) => {
        if (i === j || !somas.has(pj) || matriz[i][j] == null) return;
        const acc = somas.get(pi);
        acc.soma += matriz[i][j];
        acc.n += 1;
      });
    });
  }
  let pior = null;
  for (const p of anos) {
    const { soma, n } = somas.get(p.id);
    if (!n) continue;
    const media = soma / n;
    if (!pior || media < pior.media) pior = { periodo: p, media };
  }
  if (!pior) return null;
  return { ...pior, fonteDiferente: pior.periodo.marcas?.includes("fonte_estoque_diferente") ?? false };
}

/** Frase da Série comparável, gerada do pacote (F6.4 3b). */
export function fraseAnoMenosParecido(spearman, manifesto) {
  const r = periodoMenosParecido(spearman, manifesto);
  if (!r) return "";
  return `${r.periodo.rotulo} é o ano que menos se parece com os outros: a ordem dos hexágonos muda${
    r.fonteDiferente ? " porque o estoque vem de outra fonte" : ""
  }.`;
}

/** Spearman de cada ano contra o primeiro ano da série, por componente (F6.4 3b). */
export function spearmanContraBase(spearman, manifesto) {
  const anos = manifesto.periodos.filter((p) => p.tipo === "ano");
  const base = anos[0]?.id;
  return Object.entries(spearman ?? {}).map(([componente, { periodos, matriz }]) => {
    const ib = periodos.indexOf(base);
    const pontos = anos
      .filter((p) => p.id !== base)
      .map((p) => ({ periodo: p, valor: ib < 0 || periodos.indexOf(p.id) < 0 ? null : matriz[ib][periodos.indexOf(p.id)] }))
      .filter((d) => d.valor != null);
    return { componente, base: anos[0], pontos };
  });
}
