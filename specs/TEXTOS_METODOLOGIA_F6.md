# TEXTOS_METODOLOGIA_F6.md — textos da aba Metodologia (versão 23/11/2026)

*Cada etapa tem uma **Síntese** (o núcleo, em destaque no painel do grafo) e uma **Explicação** logo abaixo, em texto normal. O texto completo do método fica para a tese. Citações: chaves de `referencias.bib` (acrescentar as novas da F6.4 onde couber). Classificação e Montagem 2022 foram reescritas em 23/11; Julio confere no preview.*

## Abertura (topo da aba)

O moradinha usa a definição de déficit habitacional da Fundação João Pinheiro (habitação precária, coabitação e ônus excessivo com aluguel) e não a substitui. O que ele muda é a escala. O total que a PNADc permite afirmar para a região inteira é repartido em hexágonos de cerca de 0,7 km², com a incerteza declarada. Quanto déficit há só se diz para o domínio; o mapa diz onde ele está.

## Coleta

**Síntese.** Reúne o Censo 2022, a PNADc de 2022 a 2025 e fontes do território, cada uma na sua resolução original.

**Explicação.** Do Censo 2022 vêm o universo por setor censitário, a amostra, a malha de setores, o CNEFE (cadastro de endereços) e as favelas e comunidades urbanas. Da PNADc vêm os anos de 2022 a 2025. Do território vêm a luz noturna (NASA Black Marble), as edificações do Open Buildings (2022 e 2023), a área urbanizada do MapBiomas, as escolas do INEP e o Mapa Social do MDS. Nada é combinado antes da grade. [@ibge_censo2022; @ibge_pnadc; @sirko2021openbuildings; @souza2020mapbiomas]

## Grade

**Síntese.** O território vira hexágonos de cerca de 0,7 km², e cada setor censitário é repartido entre os hexágonos que toca, na proporção dos seus domicílios.

**Explicação.** Os hexágonos são do sistema H3, na resolução 8. Cada setor censitário é cortado pelos hexágonos que ele toca, e cada corte, o "pedaço", recebe a sua parte dos domicílios do setor pela grade estatística do IBGE. É o pedaço que leva cada fonte até o hexágono. [@brodsky2018h3]

## Classificação

**Síntese.** Antes de mapear, é preciso saber quem está em déficit. A regra da FJP responde isso em duas pesquisas, e cada uma tem um papel.

**Explicação.** A FJP considera em déficit o domicílio precário, a família que divide a casa com outra (coabitação) e quem gasta parte excessiva da renda com aluguel (ônus). O moradinha aplica essa regra domicílio por domicílio. Na amostra do Censo 2022, ela diz quais domicílios entrevistados estão em déficit e em que área de ponderação eles ficam: essas respostas são o gabarito com que o modelo aprende e é testado. Na PNADc, ela diz quantos domicílios estão em déficit na região inteira, ano a ano: esse total é o número que o mapa precisa respeitar. Cada domicílio conta em um só componente, nesta ordem: precariedade, coabitação, ônus. O ônus só vale para domicílios urbanos, alugados e com renda de até 3 salários mínimos. [@fjp2023deficit]

## Treino

**Síntese.** Um modelo aditivo (EBM) aprende onde a chance de déficit é maior. Ele só é usado onde erra menos que a repartição simples: na coabitação e no ônus, sim; na precariedade, não.

**Explicação.** O EBM (Explainable Boosting Machine) aprende, por componente, quanto cada característica do domicílio que existe ao mesmo tempo na amostra e no universo do Censo (espécie, moradores, água, banheiros, esgoto e lixo) aumenta ou diminui a chance de déficit. O ônus usa também cinco variáveis do território. O teste deixa cada área de ponderação de fora do treino e compara o modelo com a repartição mais simples, a mesma taxa para todos. A coabitação e o ônus venceram essa repartição; a precariedade não, e por isso usa a taxa única: a estimativa de cada área de ponderação é repartida entre os seus hexágonos na proporção dos domicílios de cada um. [@nori2019interpretml]

## Montagem 2022

**Síntese.** O mapa de 2022 nasce em três passos: a chance de déficit vira número de domicílios; esse número é alinhado ao que a amostra mediu em cada área de ponderação; e a soma é ajustada ao total da região.

**Explicação.** Primeiro, o modelo dá a chance de déficit dos domicílios de cada pedaço, e chance × domicílios = domicílios em déficit previstos. Depois, as previsões de cada área de ponderação são somadas e comparadas com o que a amostra do Censo mediu ali. Na área 002, por exemplo, a amostra mediu 221 domicílios em coabitação e o modelo previu 201, então cada pedaço da área é multiplicado por 1,1: o modelo decide onde fica o déficit dentro da área, e a amostra decide quanto. Por fim, na coabitação e no ônus, todos os hexágonos são multiplicados por um mesmo número para que a soma bata com o total da PNADc (no ônus de 2022, 1,12); na precariedade de 2022, o total é o da própria amostra do Censo. Esse último ajuste só fecha a conta e não diz se o modelo é bom: quem diz isso é o teste do Treino. A faixa de incerteza vem de refazer a conta com as 200 réplicas da PNADc. [@ibge_censo2022]

## Anos t

**Síntese.** Os domicílios de cada ano crescem com as edificações e a área urbanizada; as taxas de 2022 são mantidas, e o total passa a ser o da PNADc do ano.

**Explicação.** O estoque de domicílios de cada ano é atualizado pela variação das edificações (Open Buildings até 2023) e da área urbanizada (MapBiomas depois), com o total ajustado ao da PNADc. As taxas de 2022 são mantidas e os totais são recalibrados na PNADc do ano. A precariedade dos anos seguintes é provisória e sai sem faixa. As médias de três anos reduzem o ruído da amostra, e uma mudança entre anos só é afirmada quando passa de 1,96 erro padrão. [@souza2020mapbiomas; @ibge_pnadc]

## Exportação

**Síntese.** O site recebe só números agregados, validados e com a impressão digital de cada arquivo.

**Explicação.** O pacote público não leva microdado, e a estimativa direta por área só aparece em áreas com pelo menos 30 domicílios na amostra. Cada arquivo tem a sua impressão digital (hash) no manifesto, o pacote é validado antes de sair, e a edição citada é o commit exato do código que o gerou.
