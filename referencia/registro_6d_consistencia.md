# Consistência entre anos — piloto RM de Maceió (cópia da seção 6d do REGISTRO_RESULTADOS do moradinha, 22/11/2026)

## 6d. t2b-2b-2: exportação da série e consistência entre anos (commit `580a7cc`, 20/11, com push)

**Método:**
- GeoPackage único da série: `estimativa_hex_serie_<dominio>_<ano inicial>_<ano final>.gpkg` (no piloto, `estimativa_hex_serie_al_rm_maceio_2022_2025.gpkg`), gravado em arquivo temporário local e copiado para o Volume;
- **12 camadas:** 6 de hexágonos (2022; 2023, 2024 e 2025 com as marcas; médias 2024 e 2025), com 2.416 feições cada; `ap` (53), `municipios` (11), `totais_regimes` (28), `mudanca_entre_anos` (6), `totais_media_movel` (6), `dicionario` (226 linhas);
- déficit relativo pelo estoque do ano; na média, pela média dos domicílios da janela;
- consistência entre anos: razão dos totais t ÷ 2022, razão por hexágono (só hexágonos com as duas estimativas > 0), Spearman de cada ano com 2022 (âncora) e com o ano anterior;
- gráficos só locais (`serie_totais.png`, `razao_hex.png`, `dispersao_ancora_ultimo.png`, `spearman_anos.png`); CSV `metricas_consistencia.csv`.

**Ensaio em /tmp (conferido por Claude, 20/11; critério fixado antes):**

| item | resultado |
|---|---|
| (i) camadas e feições | 12 camadas, contagens acima. Passou |
| (ii) déficit absoluto 2022 / 2023 / 2024 / 2025 / média 2024 / média 2025 | 41.243,70 / 46.789,75 / 41.896,55 / 48.637,59 / 43.310,00 / 45.774,63 (2023 difere do esperado em 0,01, arredondamento). Passou |
| (iii) déficit relativo | 9,654 / 10,522 / 9,382 / 10,424 / 9,855 / 10,113%, sobre 427.204 / 444.688,6 / 446.574,5 / 466.575,0 / 439.489,0 / 452.612,7 domicílios. Passou |
| (iv) faixa | 0 violações de mínimo ≤ absoluto ≤ máximo; faixa nula onde o absoluto é nulo; precariedade dos anos t e médias sem faixa. Passou |
| (v) alertas | "mudança dentro do ruído" em coabitação e ônus nos anos t; "precariedade provisória sem faixa" em 2.401–2.403 hexágonos dos anos t; médias sem "total frágil". Contagens que faltavam medidas na conferência pós-execução (abaixo). Passou |
| (vi) intocabilidade | hash do `estimativa_hex_2022.gpkg` igual antes e depois; nada gravado fora de /tmp. Passou |
| (vii) suíte | 612 testes, 0 falha, 0 skipped; pyflakes 0. Passou |

O Genie corrigiu 16 falhas, todas nos testes dele; os valores esperados trocados foram conferidos à mão por Claude (Spearman 0,5; "total frágil" vale em todo hexágono com dado, inclusive de domicílio 0).

**Conferência depois da execução de Julio (20/11, noite; saídas coladas pelo Genie):**
- GeoPackage da série no Volume: 8.040.448 bytes, 12 camadas, totais e relativos iguais ao ensaio (domicílios das médias: 439.489,04 e 452.612,71).
- `metricas_consistencia.csv`: diferença máxima contra o ensaio ≤ 9e−10 por coluna; mesmo número de hexágonos nas 9 linhas.
- sha256 do `estimativa_hex_2022.gpkg`: `4e31a0cd…b8298` (3.354.624 bytes), inalterado.
- Linhagem: 109 linhas, nenhuma nova (o GeoPackage e a consistência são arquivos, não registram linhagem).
- Suíte 612 OK, 0 skipped; pyflakes 0 (a 1ª rodada falhou porque o compute serverless trocou e perdeu os pinos; reinstalados, rodou limpa).
- Achado: `estimativa_hex_2022.gpkg-journal` (4.616 bytes) ao lado do GeoPackage de 2022 no Volume (E41).

**Alertas por camada** (hexágonos; entre colchetes, hexágonos com dado):

| camada | coabitação | ônus | precariedade |
|---|---|---|---|
| 2022 [2.403] | total frágil 2.403; AP com ressalva 646 | nenhum | AP com ressalva 1.082 |
| 2023 [2.401] | total frágil 2.401; mudança dentro do ruído 2.401; AP com ressalva 782 | mudança dentro do ruído 2.401 | provisória sem faixa 2.401 |
| 2024 [2.403] | total frágil 2.403; ruído 2.403; AP com ressalva 656 | ruído 2.403 | provisória sem faixa 2.403 |
| 2025 [2.403] | total frágil 2.403; ruído 2.403; AP com ressalva 657 | ruído 2.403 | provisória sem faixa 2.403 |
| média 2024 [2.401] | AP com ressalva 787 (sem total frágil) | — | provisória sem faixa 2.401 |
| média 2025 [2.401] | AP com ressalva 788 (sem total frágil) | — | provisória sem faixa 2.401 |

"Total frágil" e "provisória sem faixa" marcam todo hexágono com dado, como decidido. Nas camadas com o ano de 2023 (2023 e as duas médias), 2.401 hexágonos com dado: os 2 do E37 a menos.

**Métricas de consistência** (`metricas_consistencia.csv`; razão e Spearman só sobre hexágonos com as duas estimativas > 0):

| componente | ano | razão dos totais | mediana da razão por hex | p5 / p95 da razão | Spearman com 2022 | Spearman com o ano anterior | hexágonos |
|---|---|---|---|---|---|---|---|
| coabitação | 2023 | 0,821 | 0,824 | 0,689 / 1,037 | **0,861** | **0,861** | 1.285 |
| coabitação | 2024 | 0,804 | 0,787 | 0,787 / 0,919 | 0,970 | **0,860** | 1.285 |
| coabitação | 2025 | 0,918 | 0,888 | 0,888 / 1,126 | 0,966 | 0,996 | 1.285 |
| ônus | 2023 | 1,240 | 1,259 | 0,593 / 3,198 | **0,854** | **0,854** | 1.241 |
| ônus | 2024 | 1,074 | 1,089 | 0,290 / 1,459 | 0,960 | **0,855** | 1.239 |
| ônus | 2025 | 1,273 | 1,300 | 0,561 / 1,780 | 0,952 | 0,975 | 1.223 |
| precariedade | 2023 | 1,073 | 1,045 | 0,870 / 1,328 | 0,855 | 0,855 | 1.253 |
| precariedade | 2024 | 1,047 | 1,023 | 1,023 / 1,193 | 0,967 | 0,851 | 1.253 |
| precariedade | 2025 | 1,097 | 1,057 | 1,057 / 1,340 | 0,963 | 0,996 | 1.253 |

**Matriz de Spearman entre todos os pares de anos** (`spearman_anos.png`; coabitação / ônus / precariedade):
- 2022×2024: 0,970 / 0,960 / 0,967; 2022×2025: 0,966 / 0,952 / 0,963; 2024×2025: 0,996 / 0,975 / 0,996;
- todo par com 2023: 0,849 a 0,861 nos três componentes (2023×2024 0,860 / 0,855 / 0,851; 2023×2025 0,859 / 0,857 / 0,849).

**Fatos medidos (sem veredito):**
- 2023 fica a cerca de 0,85–0,86 de todos os outros anos, nos três componentes; 2022, 2024 e 2025 ficam a 0,95–0,996 entre si (E40).
- Na coabitação e na precariedade de 2024 e 2025, o p5 da razão por hexágono é igual à mediana: pelo menos 45% dos hexágonos (do p5 ao p50) têm exatamente a mesma razão t ÷ 2022. No ônus isso não acontece (p5 0,29–0,56).
- Coabitação: razão dos totais 0,80–0,92 (a PNADc da coabitação cai); ônus: 1,07–1,27; precariedade: 1,05–1,10 (acompanha o estoque, salvo o excesso de 2023, E36).
- Nos gráficos de dispersão 2022 × 2025, coabitação e precariedade ficam quase sobre uma reta; o ônus espalha mais nos hexágonos pequenos (estimativas abaixo de 0,1).
- O histograma da razão por hexágono (`razao_hex.png`) tem eixo até cerca de 700: existem razões dessa ordem em poucos hexágonos (não identificados), e a massa fica toda na primeira barra. O gráfico não é legível como está.

Commit e push da t2b-2b-2 em 20/11: **fim da R3 dos anos t no piloto.**

