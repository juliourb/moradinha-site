# SPEC 00 — Fundamentos do site do moradinha

*Versão 1.2, 22/11/2026 (definições de qualidade fechadas com a investigação G1 do moradinha; recortes especiais genéricos; AP dominante; referência da FJP com subcomponentes; regime "provisoria" e `no_mapa` em `totais.json`). Mudanças em `CHANGELOG_SPECS.md`.*

*Versão 1.1, 22/11/2026 (tema de qualidade no explorador; mapa de base sem chave).*

*Versão 1, 22/11/2026. Lida por inteiro antes de qualquer fase. As fases (SPEC_F0 a SPEC_F5) só acrescentam; quando uma fase contradiz este arquivo, este arquivo vence e a contradição é relatada.*

## 1. O que é

Um site público, em português, que mostra os resultados do **moradinha** por domínio de divulgação da PNADc (por exemplo, a RM de Maceió). O moradinha estima o déficit habitacional (coabitação, ônus excessivo com aluguel e precariedade) em hexágonos H3 de resolução 8, para 2022 (âncora no Censo) e para os anos seguintes. O site serve a três leitores: o pesquisador (avaliar o domínio), a orientadora e avaliadores (navegar pelos resultados) e a tese (fonte dos números citados).

O site **não calcula nada de método**. Ele lê um **pacote de publicação** gerado pelo moradinha a cada execução e só desenha, filtra, soma componentes e divide por domicílios.

## 2. Arquitetura

- **Dois repositórios.** O `moradinha` (privado, Databricks) gera o pacote. Este repositório (`moradinha-site`, público) contém o motor do site e recebe pacotes. Nada do moradinha é copiado para cá além dos pacotes.
- **Motor:** Quarto (site com abas e textos) + Observable JS (células interativas) + módulos JavaScript próprios em `src/js/`, empacotados com esbuild num ESM único em `assets/js/moradinha.js`. **Nenhuma lógica de mapa ou gráfico fica presa numa célula do Quarto:** as células só importam e chamam os módulos. Os mesmos módulos serão reusados por uma futura interface de coleta de dados (fora deste escopo).
- **Mapa:** deck.gl `H3HexagonLayer` desenha o hexágono a partir do código H3, sem geometria no pacote. **Uma camada única de hexágonos**; filtros trocam a coluna que pinta. O mapa de base é MapLibre GL com a camada do deck.gl sobreposta (`@deck.gl/mapbox`, `MapboxOverlay`), configurável (seção 6).
- **Dados no navegador:** DuckDB-WASM lê os Parquet do pacote; JSON pequenos são lidos direto.
- **Catálogo:** `catalogo.json` na raiz lista domínios e edições e onde está cada pacote (pasta do repositório ou URL). Trocar a origem não muda o site.
- **Publicação:** GitHub Actions monta o site e publica no GitHub Pages.

## 3. Pilha (versões exatas)

| item | versão |
|---|---|
| deck.gl | 9.1.14 |
| h3-js | 4.2.1 (carregado **antes** do deck.gl quando por UMD; no bundle, importado) |
| d3 | 7.9.0 |
| maplibre-gl | fixar na F0 a última estável com pelo menos 2 semanas; registrar |
| @deck.gl/mapbox | 9.1.14 (mesma versão do deck.gl) |
| pmtiles (JS) | só na F5, se o mapa de base próprio for adotado; fixar então |
| @duckdb/duckdb-wasm | fixar na F0 a última estável com pelo menos 2 semanas; registrar |
| Quarto CLI | fixar na F0 a última estável; registrar no `README` e no workflow |
| Node.js | LTS corrente na F0; registrar em `.nvmrc` |
| testes | vitest (unidade), Playwright (ponta a ponta), ajv (esquemas), @axe-core/playwright (acessibilidade) |
| Python (só para gerar o pacote fictício) | 3.11+, `h3==4.2.2`, `pyarrow`, `duckdb` |

Nenhuma dependência sem versão exata. Nada carregado de CDN em produção: tudo empacotado ou servido pelo próprio site, exceto as fontes (Google Fonts) e as camadas de mapa de base.

## 4. Estrutura do repositório

```
moradinha-site/
  _quarto.yml               # site, abas, tema
  index.qmd                 # Visão geral
  resultados.qmd
  confiabilidade.qmd
  metodologia.qmd
  textos/                   # textos explicativos em Markdown (pt-BR), incluídos pelas páginas
  referencias.bib
  catalogo.json
  pacotes/<conjunto_id>/<edicao>/...   # pacotes (fictícios na F0; reais depois)
  contrato/v1/*.schema.json            # esquemas do pacote (fonte única; o moradinha copia)
  contrato/v1/REGRAS.md                # regras de validação além do esquema
  src/js/{estado,dados,mapa,graficos,ui,util}/...
  assets/css/tokens.css     # design system (seção 7)
  assets/js/moradinha.js    # bundle gerado (não editar à mão)
  ferramentas/validar.mjs   # validador do pacote (seção 5.3)
  ferramentas/gerar_ficticio.py
  tests/{unidade,e2e}/
  relatorios/F0.md ... F5.md
  PROGRESSO.md
  .github/workflows/site.yml
```

## 5. Contrato do pacote de publicação (v1)

Um pacote = uma pasta `pacotes/<conjunto_id>/<edicao>/`. `edicao` = hash curto do commit do moradinha que gerou os números.

### 5.1 Arquivos

| arquivo | grão (uma linha por) | colunas / campos |
|---|---|---|
| `manifesto.json` | pacote | `contrato` ("1.0"), `conjunto_id`, `nome`, `edicao`, `commit_completo`, `data_execucao` (ISO 8601 UTC), `publico` (bool), `h3_resolucao` (8), `centro` [lon, lat], `zoom_inicial`, `periodos` (lista, 5.2), `componentes` (["coabitacao","onus","precariedade"]), `regime_mapa` ("c"), `recortes` [{`id`, `nome`, `motivo`, `fonte`}] (pode ser vazio; no piloto, `braskem`), `arquivos` {nome: sha256} |
| `hex.parquet` | hexágono × período × componente | `h3` str, `periodo` str, `componente` str, `absoluto` double?, `minimo` double?, `maximo` double?, `relativo` double? (% dos domicílios), `marcas` str (códigos separados por `;`, vazio se nenhuma) |
| `hex_base.parquet` | hexágono × período | `h3`, `periodo`, `domicilios` double?, `qualidade` ("ok" \| "parcial_sigilo" \| "sem_dado") |
| `hex_qualidade.parquet` | hexágono × período | `h3`, `periodo`, `fracao_imputada` double? (média, nos 6 blocos da ponte, da fração dos domicílios 2022 do hexágono cujo bloco foi reconstruído **além da AP** — `marca_bloco` residuo_municipio, residuo_conjunto ou residuo_uniforme da composição do setor; a reconstrução dentro da AP não conta), `fracao_sigilo` double? (fração do peso da grade estatística — `peso_construtor` dos pedaços — do hexágono que está em setores com sigilo total; pedaço em sigilo não tem domicílio publicado), `n_setores` int (setores que tocam o hexágono), `fonte_estoque` ('censo' \| 'open_buildings' \| 'mapbiomas'), `g_estoque` double? (estoque antes do ajuste à PNADc, t ÷ 2022; 1 em 2022), `hex_novo` bool (hexágono absorvido sem domicílio em 2022), `enderecos_cnefe` double? (só 2022) |
| `hex_atributos.parquet` | hexágono | `h3`, `municipio_cod`, `municipio_nome` (município dominante por domicílios 2022), `n_municipios` int, `ap_cod` (AP dominante por domicílios 2022), `n_aps` int, `fcu_fracao` (0–1), `recortes` str (ids de `manifesto.recortes` separados por `;`, vazio se nenhum) |
| `contexto.parquet` (opcional) | hexágono × variável × período | `h3`, `variavel`, `periodo`, `valor` double?, `unidade` |
| `contornos/ap.geojson`, `contornos/municipios.geojson`, `contornos/fcu.geojson` | feição | propriedades `cod`, `nome`; geometria simplificada (tolerância em `manifesto.contornos_tolerancia_m`) |
| `ap.parquet` | AP × componente | `ap_cod`, `ap_nome`, `municipio_cod`, `tipo` ("capital" \| "resto"), `componente`, `direta` double?, `direta_cv` double? (%), `direta_ic_inf`, `direta_ic_sup`, `motor_2022` double?, `ressalva` bool, `sem_direta` bool |
| `totais.json` | — | `totais`: [{`componente`, `periodo`, `regime` ("c" \| "d" \| "misto" \| "amostra" \| "provisoria"), `total`, `ep`?, `cv`?, `ic_inf`?, `ic_sup`?, `marcas`[], `no_mapa` (bool; exatamente uma linha `true` por componente × período — o total que o mapa usa: coabitação e ônus no regime c; precariedade "amostra" em 2022 e "provisoria" nos anos t e médias)}]; `domicilios`: [{`periodo`, `total`}]; `mudancas`: [{`componente`, `de`, `para`, `delta`, `z`, `marcas`[]}] |
| `modelo.json` | — | por componente: SPEC_F3, seção 3 |
| `consistencia.json` | — | `spearman`: {componente: {`periodos`[], `matriz`[[]]}}; `razoes`: [{`componente`, `periodo`, `razao_total`, `mediana`, `p5`, `p95`, `n_hexagonos`}] |
| `qualidade.json` | — | SPEC_F3, seção 2 |
| `referencia_fjp.json` | — | [{`indicador` (total \| habitacao_precaria \| coabitacao \| onus \| domicilios), `ano_ref`, `fjp_publicado`?, `fjp_subcomponentes` [{`nome`, `valor`}]?, `fjp_fonte`, `fjp_tabela`, `fjp_pagina`, `fjp_url`?, `reconstrucao_pnadc`?, `reconstrucao_ep`?, `mapa`?, `explicacao`}] (`fjp_publicado` nulo = "a preencher"; `mapa` nulo quando o período não existe no pacote) |
| `achados.json` | — | [{`id`, `data`, `texto`, `efeito`, `situacao`, `publico` bool}] |
| `pipeline.json` | — | `etapas`: [{`id`, `nome`, `descricao`, `commit`, `data`, `saidas`[]}]; `ligacoes`: [{`de`, `para`}]. `saidas` só com tabelas agregadas (nunca `mor_restrito.*` nem caminhos de arquivo de microdado) |

Campo com `?` aceita nulo. **Nulo = não medido; zero = medido e zero.** Nunca trocar um pelo outro.

### 5.2 Períodos

`periodos` em `manifesto.json`: [{`id`, `rotulo`, `tipo` ("ano" \| "media"), `anos`[], `fonte_estoque`, `marcas`[]}]. No piloto: `2022`, `2023` (marca `fonte_estoque_diferente`), `2024`, `2025`, `m2024` ("Média 2022–24", marca `media_inclui_fonte_diferente`), `m2025` ("Média 2023–25", idem). O site nunca escreve ano por literal: lê os períodos do manifesto.

### 5.3 Vocabulário de marcas (fechado)

| código | rótulo no site | onde aparece |
|---|---|---|
| `total_fragil` | Total frágil (CV acima de 15%) | componente × período |
| `mudanca_no_ruido` | Mudança dentro do ruído | componente × período (anos t) e `mudancas` |
| `fonte_estoque_diferente` | Estoque por fonte diferente dos demais anos (Open Buildings); não comparar por hexágono | período 2023 (a fonte real de cada período está em `hex_qualidade.fonte_estoque`) |
| `media_inclui_fonte_diferente` | Média inclui ano com estoque por fonte diferente | médias |
| `precariedade_provisoria_sem_faixa` | Precariedade provisória, sem faixa | precariedade nos anos t e médias |
| `ap_ressalva` | AP com ressalva (CV acima de 30% ou direta zero) | hexágono, AP |
| `parcial_sigilo` | Parte em sigilo do Censo | hexágono |
| `sem_dado` | Sem dado (sigilo total) | hexágono |

Código fora desta lista invalida o pacote. Rótulos ficam em `src/js/util/marcas.js`, num lugar só.

### 5.4 Validador (`npm run validar -- <pasta do pacote>`)

Sai com código diferente de zero se qualquer regra falhar e imprime a regra, o arquivo e até 5 exemplos.

| regra | conteúdo |
|---|---|
| V1 | todo arquivo obrigatório existe e passa no esquema JSON (Parquet: esquema de colunas e tipos) |
| V2 | sha256 de cada arquivo = `manifesto.arquivos` |
| V3 | todo `h3` é válido, da resolução `h3_resolucao`, sem repetição em `hex_atributos` |
| V4 | `hex.parquet` tem exatamente n_hex × n_periodos × n_componentes linhas; `hex_base` e `hex_qualidade`, n_hex × n_periodos; frações entre 0 e 1; `g_estoque` = 1 em 2022 |
| V5 | `totais` tem exatamente uma linha com `no_mapa = true` por componente × período; Σ `absoluto` por (período, componente) = `total` dessa linha, com erro relativo ≤ 1e−6 |
| V6 | Σ `domicilios` por período = `totais.domicilios`, erro relativo ≤ 1e−6 |
| V7 | `minimo` ≤ `absoluto` ≤ `maximo` onde os três existem; `minimo`/`maximo` nulos onde `absoluto` é nulo |
| V8 | `relativo` = 100 × `absoluto` ÷ `domicilios` (tolerância 1e−9) onde `domicilios` > 0; nulo onde `domicilios` é nulo |
| V9 | toda marca pertence ao vocabulário 5.3; todo id em `hex_atributos.recortes` existe em `manifesto.recortes`; `n_aps` ≥ 1 e `n_municipios` ≥ 1 |
| V10 | pacote com `publico = true` não tem a chave `interno` em `modelo.json`, e `ap.parquet` só tem `direta` em AP com ≥ 30 domicílios da amostra (campo `n_amostra` ausente do pacote público; a regra é conferida pelo moradinha e declarada em `manifesto.d17_conferido = true`) |
| V11 | nenhuma coluna com nome da lista proibida (`domicilio_id`, `pessoa`, `v0001`… lista em `contrato/v1/REGRAS.md`) |
| V12 | `hex.parquet` ≤ 5 MB; pacote inteiro ≤ 20 MB |

## 6. Mapa de base

Configurável em `_quarto.yml` (`moradinha.mapa_base`), sempre com a atribuição visível e com aviso discreto se não carregar (o mapa segue sem base). Três opções, nesta ordem de preferência:

1. **Padrão: OpenFreeMap**, estilos `positron` (tema claro) e `dark` (tema escuro), vetoriais, pelo MapLibre. Serviço público sem cadastro, sem chave de API e sem limite de acessos; atribuição OpenStreetMap. O serviço declara que é oferecido "como está" e pode mudar ou acabar, por isso há a opção 2.
2. **Mapa de base próprio (F5):** recorte Protomaps em PMTiles da área do domínio, servido pelo próprio site (sem terceiros, sem chave), sabor de visualização de dados claro/escuro. Torna o site independente de serviço externo, o que importa para arquivar a tese.
3. **Esri World Light/Dark Gray Base** (raster, sem chave, em "suporte maduro", termos de uso da Esri a conferir).

Antes da publicação pública, Julio confirma a opção e os termos (parada da F5).

## 7. Design system (vale para todas as abas)

Extraído do protótipo aprovado (`referencia/prototipo/index.html`). Fonte única: `assets/css/tokens.css`; o tema do Quarto (SCSS) só aponta para esses tokens e desliga a aparência padrão do Bootstrap onde ela conflita.

- **Fontes:** Literata (títulos, número grande da resposta) e Public Sans (corpo, controles, gráficos), Google Fonts, com pilhas de reserva.
- **Tokens claros/escuros:** `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent` (verde-azulado), `--accent-soft`, `--warn`/`--warn-soft`, `--crit`/`--crit-soft`, `--ok`, `--fcu`, `--bk`, `--apline`, exatamente como no protótipo; tema escuro por `prefers-color-scheme` e por `data-theme`.
- **Rampa do mapa (7 classes, quantis):** `#fbf3d5 #f6dc9b #f0b864 #e48a3f #cc5a2c #a2361f #6e1d16`; zero = `--line` translúcido; sigilo = `--muted`.
- **Componentes:** cabeçalho compacto com abas na mesma linha; barra de "pergunta" com controles segmentados; painéis com borda de 1px e raio de 12px; pílulas de marca por cor semântica (aviso, crítico, informação); cartões clicáveis; dock de gráficos minimizáveis.
- **Regras:** números com `tabular-nums` e formato pt-BR (milhar com ponto, decimal com vírgula); foco visível; `prefers-reduced-motion` respeitado; nada de emoji como marcador.

## 8. Regras invioláveis

1. **Todo número exibido vem do pacote.** O site só soma componentes (total), divide por domicílios (relativo), calcula diferença entre períodos e z a partir de `ep` do pacote, diz se o número da FJP cai dentro da faixa de 95% da reconstrução (`reconstrucao_pnadc` ± 1,96 × `reconstrucao_ep`), e calcula as **medidas derivadas de qualidade** listadas na SPEC_F1 §8 (largura relativa da faixa, quantis e contagens para os gráficos). Qualquer outro número é proibido. Há teste para isso (F1 e seguintes).
2. **Total sem faixa:** os percentis dos componentes não se somam; o site nunca inventa faixa para o total.
3. **PNADc não existe por hexágono.** A comparação "amostra × motor" só aparece na AP (`ap.parquet`) e no domínio (`totais.json`).
4. **Sem microdado.** O site nunca recebe linha de domicílio ou pessoa.
5. **`interno` nunca aparece no build público** (ex.: R² do modelo; SPEC_F3).
6. Textos em português, linguagem simples, sigla explicada na primeira vez em cada aba.

## 9. Protocolo de execução das fases (Claude Code)

1. Ler este arquivo e a SPEC da fase. Registrar o início em `PROGRESSO.md`.
2. Implementar só o que a fase pede. Mudança fora do escopo vira item de "pendências" no relatório da fase.
3. Rodar **todas** as validações da fase, colando os comandos e o resumo das saídas em `relatorios/Fn.md` (modelo na seção 10).
4. **Se todas passarem:** commit (`Fn: <resumo>`), marcar a fase como concluída em `PROGRESSO.md` e **seguir para a próxima SPEC sem esperar**.
5. **Se alguma falhar:** até 2 rodadas de correção. Se ainda falhar, parar, registrar no relatório o que falhou, o que foi tentado e a menor reprodução, e esperar Julio.
6. **Pontos de parada obrigatórios** (esperar Julio mesmo com tudo verde): ativar o GitHub Pages e permissões do repositório (F0); publicação pública com pacote real e conferência dos termos do mapa de base (F5).
7. Nunca alterar `contrato/v1` depois da F0 sem registrar a mudança como versão nova (`v1.1`) e avisar no relatório: o moradinha depende dele.

## 10. Modelo de `relatorios/Fn.md`

```
# Fase Fn — <nome>
Data, commit.
## Feito (até 10 linhas)
## Validações
| id | comando | resultado | evidência (resumo da saída) |
## Desvios da SPEC e por quê
## Pendências para depois
## Perguntas para Julio (só se a fase parou)
```
