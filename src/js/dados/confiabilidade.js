// Dados da aba Confiabilidade (SPEC_F3). Leitura direta do pacote — nenhum
// cálculo além do que já vem pronto em qualidade.json/modelo.json/
// consistencia.json/achados.json.
import { ascending, quantileSorted } from "d3";

export const COMPONENTES_MODELO = ["coabitacao", "onus", "precariedade"];
export const CLAB = { coabitacao: "Coabitação", onus: "Ônus", precariedade: "Precariedade" };

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
      "O modelo (EBM, Explainable Boosting Machine) soma uma contribuição por característica do domicílio ou do território. " +
      "A curva mostra quanto cada categoria aumenta ou diminui a chance de déficit; a importância, quanto cada variável pesa no total.",
  },
  {
    chave: "confianca",
    titulo: "Quanto confiar nesses números?",
    recolhido: true,
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
