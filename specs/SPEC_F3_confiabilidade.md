# SPEC F3 — Confiabilidade

*Pré-requisito: F2 concluída. Esta aba responde "quanto confiar no mapa". O que o mapa diz sobre o território fica em Resultados.*

## 1. Estrutura da aba

Quatro seções, nesta ordem, com navegação lateral fixa: **Dados e qualidade · O modelo · Consistência entre anos · Achados**. Cada seção abre com "Como ler" (até 3 linhas) e cada bloco de métrica tem **a pergunta do leitor como título**, a resposta em número e a frase "o que significa".

## 2. Dados e qualidade (`qualidade.json`)

Esta seção é o resumo do domínio inteiro; a qualidade por hexágono fica no tema Qualidade da aba Resultados (SPEC_F1 §8), e esta seção tem o link "ver no mapa" para cada medida.


Campos: `fontes`: [{`variavel`, `fonte`, `anos_disponiveis`[], `uso_por_periodo`: {periodo: "do ano" \| "congelada em AAAA" \| "fixa do Censo"}, `marcas`[]}]; `sigilo`: {`hex_sem_dado`, `hex_parcial`}; `aps`: [{`componente`, `n_aps`, `n_ressalva`, `n_sem_direta`}]; `ponte`: [{`indicador`, `pnadc`, `pnadc_ep`, `censo`, `censo_ep`, `razao`, `leitura`}]; `cnefe`: {`enderecos`, `hex_sem_endereco`, `domicilios_nesses_hex`, `correlacao_hex`}; `lacunas`: [{`item`, `efeito`}].

Visual: linha do tempo das fontes por período (quem é do ano, congelada ou fixa; a troca Open Buildings → MapBiomas destacada); cartões de sigilo e ressalva; tabela da ponte PNADc × Censo com barras de intervalo; lacunas em lista.

## 3. O modelo (`modelo.json`, por componente)

Campos por componente: `configuracao` (ex.: "e3"), `usado` (bool; precariedade = false), `motivo`, `treino` {`n_domicilios`, `peso_total`, `n_aps`, `dobras`, `motor`, `versao`, `semente`}, `ganho` {`erro_modelo`, `erro_base`, `razao`, `ic`[]}, `ordem` {`spearman_modelo`, `spearman_base`, `top20_modelo`, `top20_base`, `ic_spearman`[]}, `calibracao` {`decis`: [{`decil`, `previsto`, `observado`}], `inclinacao`, `intercepto`, `ic_inclinacao`[]}, `vies` [{`grupo_tipo` ("tipo de AP" \| "município"), `grupo`, `razao_somas`}], `curvas` [{`variavel`, `rotulo`, `nivel`, `escore`, `desvio`}], `importancia` [{`variavel`, `rotulo`, `valor`}], `confianca` {`dobras`: [{`dobra`, `razao_erro`, `spearman`}], `moran_residuos` {`I`, `p`}, `cobertura_d` {`modelo`, `base`}}, `interno` {`r2_ap`, ...} (**só no pacote privado**; o build público nunca lê nem exibe).

Blocos, títulos e textos (usar estes textos; ajustes só de forma):

| título (pergunta) | métrica exibida | "o que significa" |
|---|---|---|
| **O modelo ajuda?** | razão erro do modelo ÷ erro da linha de base, com intervalo | Compara o modelo com o jeito mais simples de repartir o total: dar a todas as áreas a mesma taxa. "Erra 42% menos" quer dizer que, nas áreas deixadas de fora do treino, o erro médio do modelo é 58% do erro dessa repartição simples. |
| **Acha onde está?** | Spearman do modelo e da linha de base; captura do top 20% | Mede se o modelo põe as áreas na ordem certa, da que tem mais déficit para a que tem menos. 1 é a ordem perfeita; perto de 0, a ordem é aleatória. O top 20% diz que parte do déficit real cai nas 20% de áreas que o modelo aponta como piores. |
| **Erra o tamanho?** | gráfico de calibração por decis; inclinação com intervalo | Quando o modelo diz que uma área tem 3% de domicílios em déficit, ela tem mesmo 3%? Pontos sobre a diagonal = acerta o tamanho; inclinação menor que 1 = exagera nas áreas altas e subestima nas baixas. |
| **Erra para quem?** | razão das somas por tipo de AP e por município (barras em torno de 1) | Mostra se o erro se concentra em algum grupo: acima de 1, o modelo põe déficit demais naquele grupo; abaixo de 1, de menos. A faixa entre 0,90 e 1,10 é a tolerância do protocolo. |
| **Por quê?** | curvas de forma por variável e importância | O modelo (EBM, Explainable Boosting Machine) soma uma contribuição por característica do domicílio ou do território. A curva mostra quanto cada categoria aumenta ou diminui a chance de déficit; a importância, quanto cada variável pesa no total. |
| **Quanto confiar nesses números?** (bloco recolhido, "para avaliadores") | métricas por dobra; intervalos por reamostragem das APs; Moran dos resíduos; cobertura (d) | Com poucas áreas (53 no piloto), cada métrica oscila; os intervalos mostram quanto. O Moran dos resíduos diz se os erros se agrupam no mapa (se sim, falta ao modelo alguma informação espacial). A cobertura diz em quantas áreas o modelo cai dentro do intervalo de 95% da amostra — um teste exigente, porque pede ao modelo a precisão da própria amostra. |

Componente com `usado = false` (precariedade no piloto) mostra só: "Nesta área, o modelo não superou a repartição pela taxa média; o mapa usa a repartição simples." e os números do teste.

## 4. Consistência entre anos (`consistencia.json`)

Matriz de Spearman entre períodos (mapa de calor, rótulos de valor), razões por hexágono (pequenos múltiplos com eixo em log ou recortado no p99, nunca o histograma ilegível até 700) e o texto fixo da marca `fonte_estoque_diferente`.

## 5. Achados (`achados.json`)

Lista só com `publico = true`, agrupada por `situacao`; cada item com efeito em uma linha.

## Validações

| id | critério |
|---|---|
| F3-1 | todo número da aba confere com o pacote (teste `data-num`, como na F1-1) |
| F3-2 | **`interno` nunca aparece:** build público com pacote que contém `interno` → nenhum texto "R²" nem o valor no HTML gerado; teste falha se aparecer |
| F3-3 | cada bloco da tabela §3 existe, com o título-pergunta e o texto "o que significa" (teste de presença) |
| F3-4 | componente com `usado = false` mostra a mensagem própria e não mostra curvas |
| F3-5 | histograma/razões sem eixo dominado por extremos: o eixo vai no máximo até o p99 ou usa escala log (teste do domínio do eixo) |
| F3-6 | capturas claro/escuro em `relatorios/F3/`; axe sem serious/critical |
