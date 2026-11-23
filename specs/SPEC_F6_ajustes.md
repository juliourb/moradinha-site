# SPEC F6 — Ajustes depois da revisão do pacote real

*Pré-requisito: F5 implementada na branch `f5-publicacao`, não publicada. Pacote real: edição `bd10cbd` (moradinha `bd10cbde76cbd2174abc6fbea0e8ff180265b673`, contrato 1.1, 17 arquivos), branch `pacote/al_rm_maceio-bd10cbd` (commit `b8582e0`). Origem das decisões: revisão de Julio e navegação do preview em 22/11/2026.*

## Objetivo

Deixar o site pronto para publicar e para servir de material à orientadora: números e textos certos, um mapa que mostra onde o déficit se concentra, uma aba Confiabilidade que se lê como argumento, e a interação do explorador funcionando.

## Regras desta fase

1. **Tudo dinâmico.** Nenhum número, nome, limiar ou quebra de classe de um domínio fica escrito no código. Tudo vem do pacote carregado (`manifesto`, `totais`, `hex*`, `qualidade`, `modelo`, `consistencia`, `referencia_fjp`, `pipeline`). Os números de Maceió abaixo servem **só para os testes de aceite**.
2. Contrato **1.1** sem mudança. Se faltar um campo no pacote para algum item, o item é feito sem ele, e o relatório lista o que faltou. **Não inventar dado.**
3. Duas partes **em sequência**: F6.1, depois F6.2. Cada parte termina com a suíte verde (testes antigos e novos), commit e push **só** da `f5-publicacao`. A revisão de Julio vem depois das duas.
4. Protocolo da SPEC_00 §9: no máximo 2 rodadas de correção por validação. Na terceira, parar e relatar.
5. Ao terminar, `relatorios/F6.md` (desvios, o que faltou no pacote, tabela de grupos do pipeline) e `PROGRESSO.md` atualizado. Acrescentar a linha da F6 em `specs/README_SPECS.md` e em `specs/CHANGELOG_SPECS.md`.

## F6.0 — Preparação (dentro da F6.1)

- `git fetch origin` e `git merge --no-ff origin/pacote/al_rm_maceio-bd10cbd` na `f5-publicacao`. O merge traz só a pasta `pacotes/al_rm_maceio/bd10cbd/`; se trouxer outra coisa, parar.
- `catalogo.json`: `bd10cbd` passa a ser a edição padrão de `al_rm_maceio`. A `69277fd` **sai do catálogo**, porque tem o erro da ponte (A1); a pasta fica, e apagar é decisão de Julio. `ficticio` continua como `teste_apenas`.
- Validar o pacote `bd10cbd` (V1–V12) no build.

## F6.1 — Conteúdo e leitura

### 1. Números certos

| id | item | o que fazer |
|---|---|---|
| N7 | faixa da reconstrução com ponta negativa | a ponta de baixo de toda faixa de 95% exibida é cortada em 0 (só na exibição) |
| N8, N9 | FJP × moradinha | para cada indicador do `referencia_fjp.json`, mostrar três valores: **FJP publicado**, **parte do CadÚnico** e **FJP sem CadÚnico**. A parte do CadÚnico é o subcomponente `improvisados` do próprio indicador; no `total`, é o `improvisados` de `habitacao_precaria`; sem subcomponente `improvisados`, a parte é 0. A frase "cai dentro / fora da faixa" compara o **valor sem CadÚnico** com a faixa de 95% da reconstrução (`reconstrucao_pnadc ± 1,96 × reconstrucao_ep`, ponta de baixo em 0). O título diz o ano de `ano_ref` ("Comparação com a FJP, 2023"). Usar `explicacao`, `fjp_fonte`, `fjp_tabela` e `fjp_pagina` do pacote |
| N11 | "De onde vem o estoque" mostrava a variável `atencao_basica` | o estoque de cada período vem de `manifesto.periodos[].fonte_estoque` (censo, open_buildings, mapbiomas, mista), com rótulo legível e a marca `fonte_estoque_diferente` explicada |
| N14 | importância arredonda para 0,00 | importância de cada termo em % da soma das importâncias do componente, com uma casa decimal; abaixo de 0,1% aparece "< 0,1%" |
| N10 | nomes crus | um dicionário de rótulos no site: `rusticos` → "rústicos", `improvisados` → "improvisados (CadÚnico)", `comodos` → "cômodos", `unidade_convivente` → "famílias conviventes", `pnadc` → "domicílios na PNADc", `habitacao_precaria` → "habitação precária". Siglas na primeira aparição: "CV (coeficiente de variação)". Chave sem rótulo: aparece crua e é listada no relatório |

### 2. Textos da Metodologia (N17)

- Substituir os 7 textos de `textos/metodologia/*.qmd` e criar a abertura no topo da aba com o texto de `TEXTOS_METODOLOGIA_F6.md` (anexo A desta SPEC), **sem a etiqueta "rascunho"**.
- No Treino, a última frase é a do anexo A (já corrigida).
- Citações: só chaves que já existem em `referencias.bib`.

### 3. Escala de cores do mapa (C4, N1)

Regra única para qualquer domínio, componente (incluindo o total, que é a soma dos três) e período:

1. **Hexágono com menos de 1 domicílio** no período: cinza **hachurado em linhas finas** (deck.gl `FillStyleExtension`). Fica visível, fora das classes e fora das contas da legenda. Na legenda: "menos de 1 domicílio".
2. **Hexágono com 1 domicílio ou mais e déficit menor que 1:** classe própria, cinza claro, "menos de 1".
3. **Absoluto: quebras naturais.**
   - Calculadas sobre os valores ≥ 1 do componente, **juntando todos os períodos**, para que a mesma cor queira dizer o mesmo valor em todos os anos e a cortina compare cores equivalentes.
   - **6 classes**, pela otimização de Jenks (equivalente ao k-means ótimo em uma dimensão; pode usar `ckmeans` da `simple-statistics`). A quebra é o **maior valor** de cada classe, como no `jenkspy`.
   - Cada quebra é arredondada para o número **mais próximo** da série 1; 1,5; 2; 2,5; 3; 4; 5; 7,5 × 10ⁿ (n ≥ −1). Quebras que arredondam igual se fundem.
   - Calcular uma vez por componente ao carregar o pacote (meta: < 500 ms por componente em 1440×900) e guardar em memória.
4. **Relativo: seletor dentro do mapa**, ao lado da legenda, com duas opções:
   - **quebras naturais em %**: mesma regra do item 3, sobre o relativo dos hexágonos com 1 domicílio ou mais;
   - **"vezes a taxa do domínio"**: a taxa do domínio é Σ absoluto ÷ Σ domicílios do componente no período, tirada do pacote. Cortes em 0,5 / 0,8 / 1,25 / 1,5 / 2 vezes a taxa; a faixa de 0,8 a 1,25 tem cor neutra ("parecido com a média do domínio"), com cores frias abaixo e quentes acima. A legenda mostra a taxa do domínio em %.

   O absoluto não tem seletor.
5. **Legenda** de cada faixa: intervalo, número de hexágonos e **parte do déficit** que eles somam (%), no período mostrado.

### 4. Explorador (Resultados): o essencial

| id | item | o que fazer |
|---|---|---|
| A2 | cortina sem sincronia | os dois mapas compartilham o estado de câmera: arrastar, dar zoom ou girar de um lado move o outro igual |
| N6 | cortina volta ligada | ao abrir ou recarregar, a cortina começa **desligada** |
| A3 | dica ao passar o mouse | sobre o hexágono: município, área de ponderação, valor no modo atual (absoluto e relativo), faixa de 95% quando houver, peso no total do domínio e as marcas em linguagem simples; some ao sair. Funciona nos dois lados da cortina |
| C5 | camada de municípios | ligável no controle de camadas, desenhada com `contornos/municipios.geojson` |
| C6 | peso do hexágono | no painel do hexágono: absoluto do hexágono ÷ Σ absoluto do componente no período, em % |

### 5. Visão geral

| id | item | o que fazer |
|---|---|---|
| B3 | gráficos | os cartões continuam com a mini-série. Um botão **"Detalhes"** na faixa abre um pop-up (fecha com Esc, clique fora ou botão) com **quatro painéis**: total, coabitação, ônus, precariedade. Cada painel tem eixo com valores, os anos, o ponto de cada ano com **faixa de 95%** (± 1,96 EP do `totais.json`), a média de 3 anos tracejada, 2023 marcado "estoque por fonte diferente" e a **precariedade dos anos seguintes a 2022 sem faixa**, marcada "provisória". Embaixo, uma frase gerada pelo pacote: se nenhuma mudança anual passa de 1,96 EP, "nenhuma mudança de um ano para o outro passa do ruído da amostra"; senão, nomeia as que passam |
| B6 | curva de concentração | no mesmo pop-up: eixo x = % dos hexágonos com domicílio, do maior para o menor déficit absoluto; eixo y = % do déficit acumulado. Componente e período seguem a seleção da página (padrão: total, último ano). Uma marca no ponto em que se chega à metade do déficit |
| — | ressalva do relativo | frase na Visão geral, gerada pelo pacote para o período padrão: "N hexágonos (P% dos que têm domicílio) somam metade do déficit absoluto. No relativo, o maior hexágono tem X vezes a taxa do domínio: a concentração do mapa absoluto acompanha, em boa parte, onde estão os domicílios." Se X ≥ 2, a segunda frase troca por "…tem X vezes a taxa do domínio." |
| A4 | mini-mapa parado | o mini-mapa da Visão geral aceita arrastar e zoom, mostra a dica de A3 e, no clique, abre Resultados com aquele hexágono selecionado, no mesmo componente e período |
| B5 | nome do domínio | usar `manifesto.nome` como vier; não reescrever no site |

### 6. Confiabilidade como argumento (B1, N12, N13, N15, N16)

**Painel de vereditos no topo.** Uma grade com as perguntas nas linhas e os componentes nas colunas. Cada célula traz uma palavra ("sim", "em parte", "não") e um número. Clicar numa célula abre a seção da pergunta; as setas ← → (e o teclado) passam para a seção seguinte, como no carrossel da Metodologia.

| pergunta | veredito por componente | número na célula |
|---|---|---|
| 1. Os números de partida batem? | "bate" se o valor da FJP sem CadÚnico do indicador cai dentro da faixa de 95% da reconstrução; "não bate" se cai fora | razão da ponte PNADc ÷ Censo (`qualidade.ponte.razao`) |
| 2. O modelo põe o déficit no lugar certo? | protocolo a–e com os campos do `modelo.json`: a) `ganho.razao` ≤ 0,90; b) `ordem.spearman_modelo` > `spearman_base` e > 0,6; c) `top20_modelo` > `top20_base`; d) `confianca.cobertura_d.modelo` > `.base`; e) `vies` com `grupo_tipo = "tipo de AP"`: todas as `razao_somas` entre 0,90 e 1,10. **"sim"** se todos passam; **"não"** se a) falha; **"em parte"** nos outros casos. Componente com `usado = false` mostra o `motivo` | erro do modelo em % do erro da linha de base (`ganho.razao`) |
| 3. A série é comparável entre anos? | "sim" se nenhum período do componente tem marca; **"em parte"** se algum tem `fonte_estoque_diferente`, `media_inclui_fonte_diferente`, `mudanca_no_ruido` ou `precariedade_provisoria_sem_faixa` | número de períodos com marca / total de períodos |
| 4. O que ainda não sabemos | uma linha só, sem veredito | número de achados públicos |

**Seções** (cada uma abre com a resposta em uma frase e depois os gráficos e a ressalva):

1. **Números de partida:** ponte com o texto `leitura` de cada indicador, FJP com os três valores (item 1), sigilo e cobertura do CNEFE.
2. **Lugar certo:** ganho com IC, ordem, **calibração por decis** (gráfico de previsto × observado com a diagonal; N15), viés com **destaque** para todo grupo fora de 0,90–1,10, inclusive municípios (N15), e importância em %. As **curvas do modelo ficam recolhidas**: sem as linhas cruas, só a nota "os nomes das categorias entram na próxima edição" (pendência F7).
3. **Série comparável:** fonte do estoque por período (N11), consistência (Spearman entre períodos do `consistencia.json`), **razão por hexágono com eixo e rótulos sem sobreposição** (N16).
4. **O que ainda não sabemos:** achados públicos e **"O que falta" como matriz variável × período** (N12), com células em linguagem simples ("do próprio ano", "congelada em 2022", "sem dado") e nomes de variável legíveis.

**Bloco técnico recolhido no fim:** dobras, Moran dos resíduos, cobertura.

### 7. Metodologia: grafo e carrossel (B4, N18)

- **Grupos:** as 54 etapas do `pipeline.json` são agrupadas nas 7 etapas do método (Coleta, Grade, Classificação, Treino, Montagem 2022, Anos t, Exportação). O grupo padrão vem do esquema da tabela (`mor_coleta` → Coleta, `mor_ref` → Grade, `mor_classif` → Classificação, `mor_modelo` → Treino, `mor_alocacao` → Montagem 2022, `mor_diag` → Anos t), com exceções por tabela num arquivo de configuração do site (ex.: `textos/metodologia/grupos_pipeline.yml`). O arquivo vale para todos os domínios. Tabela sem grupo vai para "Outras" e é listada no relatório. A tabela completa tabela → grupo vai no `relatorios/F6.md` para Julio revisar. Exportação é o nó do pacote (manifesto e edição).
- **Grafo interativo:** os grupos aparecem recolhidos em ordem (esquerda → direita); clicar expande as subetapas (tabelas) do grupo com as ligações. Sem área vazia, sem caixas empilhadas. Commit curto visível e completo na dica.
- **Carrossel:** clicar num grupo abre um painel com o texto da etapa (anexo A) e a lista das subetapas (nome e descrição do pacote; descrição vazia não mostra texto). As setas ← → e o teclado passam para a etapa seguinte na ordem do método.

### 8. Dicas nos gráficos (B2)

Todo gráfico do site tem uma frase curta "o que mede / como ler", visível sem clique, logo abaixo do título.

### Validações F6.1

| id | critério (Playwright, com o pacote `bd10cbd`, salvo indicação) |
|---|---|
| F6.1-1 | catálogo: `bd10cbd` é a padrão; `69277fd` não aparece no seletor |
| F6.1-2 | FJP 2023 (publicado / CadÚnico / sem CadÚnico): total 50.099 / 5.812 / 44.287; habitação precária 11.936 / 5.812 / 6.124; domicílios 462.956 / 5.812 / 457.144; coabitação 5.666 / 0 / 5.666; ônus 32.498 / 0 / 32.498; título com "2023"; nenhuma ponta de faixa negativa na página |
| F6.1-3 | quebras absolutas arredondadas (teste de unidade sobre o pacote): total 50/150/250/400/500; coabitação 15/30/50/100/150; ônus 40/100/200/300/400; precariedade 15/40/75/150/200. Total 2025 por faixa: 253 / 106 / 47 / 37 / 12 / 14 hexágonos (déficit ≥ 1). **Se diferir, relatar os valores obtidos e parar o item; não ajustar a regra para bater** |
| F6.1-4 | hexágono com < 1 domicílio desenhado hachurado e fora das contas da legenda; a soma das partes do déficit da legenda dá 100% (± 0,5) |
| F6.1-5 | "vezes a taxa": taxa do domínio do total em 2025 = 10,42% (± 0,05); o seletor troca as classes sem recarregar; com o pacote `teste_pequeno` a escala é recalculada (nada fixo) |
| F6.1-6 | cortina: arrastar e dar zoom de um lado deixa os dois lados com o mesmo centro e zoom (diferença < 1e-6); recarregar a página volta com a cortina desligada |
| F6.1-7 | passar o mouse num hexágono mostra a dica com município e valor; o painel do hexágono mostra o peso no total; a camada de municípios liga e desliga |
| F6.1-8 | pop-up "Detalhes": 4 painéis com eixo e faixa; precariedade de 2023–2025 sem faixa; a frase de ruído vem do pacote; a curva de concentração mostra os 63 maiores hexágonos do total de 2025 somando 54% (± 1 ponto) do déficit |
| F6.1-9 | ressalva: maior relativo do total em 2025 ≈ 20% (± 0,5) e menos de 2 vezes a taxa do domínio; a frase aparece com os números do pacote |
| F6.1-10 | mini-mapa: arrastar muda a vista; o clique abre Resultados com o mesmo hexágono selecionado |
| F6.1-11 | Confiabilidade, vereditos esperados em Maceió: pergunta 2 coabitação "sim" (58%), ônus "sim" (56%), precariedade "não" (99%); pergunta 3 "em parte" nos três; clicar numa célula abre a seção e as setas passam para a próxima |
| F6.1-12 | "De onde vem o estoque" mostra censo / open_buildings / mapbiomas nos anos; nenhuma ocorrência de "atencao_basica" nessa seção |
| F6.1-13 | importância sem "0,00"; nenhum código cru (`unidade_convivente`, `V000`) visível na página pública; viés destaca Marechal Deodoro, Satuba e Rio Largo |
| F6.1-14 | Metodologia: 7 grupos na ordem; os 54 nós aparecem ao expandir; as setas passam pelos 7 textos; nenhuma ocorrência de "rascunho" no site |
| F6.1-15 | todo gráfico tem a dica "o que mede / como ler" (contagem de gráficos = contagem de dicas) |
| F6.1-16 | números da Visão geral sem mudança: 2025 total 48.638 (10,42%), coabitação 7.707, ônus 35.356, precariedade 5.574; média 2023–25 45.775 (10,11%) |
| F6.1-17 | suíte completa (F0–F5 e F6.1) verde; build público valida o pacote |

## F6.2 — Interação e acabamento

| id | item | o que fazer |
|---|---|---|
| A5 | polígonos | AP, FCU e recortes (Braskem) desenhados pelos contornos do pacote (`contornos/ap.geojson`, `fcu.geojson`, `recortes.geojson`), não por hexágonos; na dica, o nome e o `motivo` do recorte |
| C1 | vários bins | no histograma, clicar marca e desmarca barras (mais de uma); o mapa mostra só os hexágonos das barras marcadas; botão "limpar" |
| C2 | transparência | controle de opacidade dos hexágonos (0,2 a 1,0; padrão 0,8) |
| C3 | fundo cinza | terceira opção de mapa de base, "cinza", sem provedor novo (estilo do OpenFreeMap ou o estilo atual dessaturado), com a atribuição mantida |
| A6 | rolagem lateral | a barra da pergunta (`.ask`) quebra ou recolhe; sem rolagem lateral em 1024, 1280 e 1440 px |
| N2 | histograma ilegível | eixo cortado no percentil 99, com a última barra "p99 ou mais" (a regra da F3) |
| N3 | ranking com linhas iguais | cada linha mostra município, AP e o código curto do hexágono (6 últimos caracteres) |
| N4 | distribuição por período | escala que separa as caixas (corte no p99 ou log, declarado no eixo); rótulos de período sem sobreposição |
| N5 | gráficos abaixo da dobra | em 1440×900, o primeiro gráfico do explorador aparece inteiro sem rolar |

### Validações F6.2

| id | critério |
|---|---|
| F6.2-1 | as camadas AP, FCU e Braskem desenham polígonos (contagem de feições = arquivo do pacote: Braskem 1) |
| F6.2-2 | marcar 2 barras do histograma filtra o mapa para a soma das duas; "limpar" volta tudo |
| F6.2-3 | a opacidade muda o preenchimento; o fundo "cinza" carrega sem requisição a provedor novo |
| F6.2-4 | `document.documentElement.scrollWidth ≤ innerWidth` em 1024, 1280 e 1440 px, nas quatro abas |
| F6.2-5 | ranking sem duas linhas com o mesmo texto; rótulos da distribuição sem sobreposição (caixas de texto sem interseção) |
| F6.2-6 | em 1440×900, a caixa do primeiro gráfico do explorador fica dentro da janela |
| F6.2-7 | suíte completa verde (F0–F6.2) |

## Parada obrigatória

Depois da F6.2: commit e push só da `f5-publicacao`, `relatorios/F6.md` completo, e **parar**. Nenhum merge nem push na `main`; a publicação é decisão de Julio, depois da revisão dele.

## Fora da F6 (registrado em `AJUSTES_POS_F5.md` §F)

Tabela da FJP no Databricks (F1); descrições públicas das 6 etapas vazias (F2); agrupamentos Moran e LISA dos hexágonos (F3); correlações (F4); camadas de contexto (F5); cortina entre componentes (F6); rótulos das curvas do modelo (F7); AUC e Brier (fora por decisão de 21/11).

---

## Anexo A — Textos da Metodologia aprovados por Julio (22/11/2026)

*Regra: todo termo técnico é explicado no próprio texto, na primeira vez em que aparece.*

**Abertura (topo da aba).** O moradinha usa a definição de déficit habitacional da Fundação João Pinheiro (habitação precária, coabitação e ônus excessivo com aluguel) e não a substitui. O que ele muda é a escala. O total que a PNADc permite afirmar para a região inteira é repartido em hexágonos de cerca de 0,7 km², com a incerteza declarada. Quanto déficit há só se diz para o domínio; o mapa diz onde ele está.

**Coleta.** Reúne, cada fonte na sua resolução original: do Censo 2022, o universo por setor censitário, a amostra, a malha de setores, o CNEFE (cadastro de endereços) e as favelas e comunidades urbanas; a PNADc de 2022 a 2025; luz noturna (NASA Black Marble); edificações do Open Buildings (2022 e 2023); área urbanizada do MapBiomas; escolas do INEP; e o Mapa Social do MDS. Nada é combinado antes da grade. [@ibge_censo2022; @ibge_pnadc; @sirko2021openbuildings; @souza2020mapbiomas]

**Grade.** O território é coberto por hexágonos H3 de resolução 8. Cada setor censitário é cortado pelos hexágonos que ele toca, e cada corte, o "pedaço", recebe a sua parte dos domicílios do setor pela grade estatística do IBGE. É o pedaço que leva cada fonte até o hexágono. [@brodsky2018h3]

**Classificação.** Antes do mapa, é preciso saber quais domicílios estão em déficit. A regra da FJP é aplicada a cada domicílio de duas pesquisas, com papéis diferentes. Na amostra do Censo 2022 (os domicílios que responderam ao questionário completo), a regra marca quem está em déficit: essas marcas são o gabarito com que o modelo aprende e é testado. Na PNADc de cada ano, a regra dá quantos domicílios estão em déficit na região inteira: é o total que o mapa respeita. Cada domicílio entra em um só componente, nesta ordem: habitação precária, coabitação, ônus. O ônus só é avaliado em domicílios urbanos, alugados e com renda de até 3 salários mínimos. [@fjp2023deficit]

**Treino.** Um modelo aditivo (EBM, Explainable Boosting Machine) aprende, por componente, quanto cada característica do domicílio que existe ao mesmo tempo na amostra e no universo do Censo (espécie, moradores, água, banheiros, esgoto e lixo) aumenta ou diminui a chance de déficit. O ônus usa também cinco variáveis do território. O teste deixa cada área de ponderação de fora do treino e compara o modelo com a repartição mais simples, a mesma taxa para todos. A coabitação e o ônus venceram essa repartição; a precariedade não, e por isso usa a taxa única: a estimativa de cada área de ponderação é repartida entre os seus hexágonos na proporção dos domicílios de cada um. [@nori2019interpretml]

**Montagem 2022.** A taxa de cada pedaço sai da soma das contribuições do modelo pelas proporções do setor, uma conta exata. Um fator por área de ponderação alinha o resultado à estimativa da amostra naquela área. Na coabitação e no ônus, o total é ajustado ao da PNADc; a precariedade de 2022 vem da amostra do Censo. A faixa de incerteza vem de 200 réplicas da PNADc. O ajuste ao total é uma conta de fechamento e não mede a qualidade do modelo. [@ibge_censo2022]

**Anos t.** O estoque de domicílios de cada ano é atualizado pela variação das edificações (Open Buildings até 2023) e da área urbanizada (MapBiomas depois), com o total ajustado ao da PNADc. As taxas de 2022 são mantidas e os totais são recalibrados na PNADc do ano. A precariedade dos anos seguintes é provisória e sai sem faixa. As médias de três anos reduzem o ruído da amostra, e uma mudança entre anos só é afirmada quando passa de 1,96 erro padrão. [@souza2020mapbiomas; @ibge_pnadc]

**Exportação.** O pacote público leva só números agregados: nada de microdado, e a estimativa direta por área só aparece em áreas com pelo menos 30 domicílios na amostra. Cada arquivo tem a sua impressão digital (hash) no manifesto, o pacote é validado antes de sair, e a edição citada é o commit exato do código que o gerou.
