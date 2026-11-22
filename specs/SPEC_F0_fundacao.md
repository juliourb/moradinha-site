# SPEC F0 — Fundação do repositório

*Pré-requisito: SPEC_00 lida. Entrada: protótipo aprovado em `referencia/prototipo/` (index.html e gerar_dados.py, copiados por Julio).*

## Objetivo

Repositório pronto para as próximas fases: site Quarto com as 4 abas vazias no design system, contrato v1 com esquemas e validador, pacote fictício válido, bundle JS, testes e CI.

## Entregas

1. Estrutura da SPEC_00 §4; `README.md` com como rodar (`npm ci`, `npm run dev`, `npm run build`, `npm test`, `npm run validar`).
2. `_quarto.yml` com as abas **Visão geral, Resultados, Confiabilidade, Metodologia**, nesta ordem; cabeçalho compacto como no protótipo (marca, nome do domínio, abas, chips de edição).
3. `assets/css/tokens.css` + tema SCSS do Quarto aplicando a SPEC_00 §7 (claro e escuro).
4. `contrato/v1/`: um `*.schema.json` por arquivo JSON do pacote, um `parquet.schema.json` com colunas e tipos dos Parquet, `REGRAS.md` com V1–V12 e a lista de colunas proibidas.
5. `ferramentas/validar.mjs` (V1–V12; Parquet lido por DuckDB em Node) e `npm run validar`.
6. `ferramentas/gerar_ficticio.py`: gera **dois** pacotes fictícios no contrato v1, a partir da lógica de `referencia/prototipo/gerar_dados.py`:
   - `pacotes/al_rm_maceio/ficticio/`: recorte de Maceió, totais reais do piloto (tabela em anexo A), distribuição fictícia, `hex_qualidade.parquet` fictício coerente (2023 com `fonte_estoque = open_buildings` e `g_estoque` com ruído de ±6%; 2024–2025 com `mapbiomas` e `g_estoque` = 1 em cerca de 60% dos hexágonos; `fracao_imputada` maior nas bordas das APs), contornos de AP fictícios (pais H3 resolução 7), FCU e recorte `braskem` fictícios, `modelo.json`, `qualidade.json`, `consistencia.json` (valores do anexo B), `referencia_fjp.json` com `fjp_publicado` nulo, `achados.json` com 3 itens, `pipeline.json` com as etapas da seção "pipeline" do anexo C;
   - `pacotes/teste_pequeno/ficticio/`: 20 hexágonos, para testes rápidos.
   - Todo pacote fictício tem `manifesto.ficticio = true`, e o site mostra o chip "dados fictícios" quando esse campo é verdadeiro.
   - `referencia_fjp.json` do pacote de Maceió fictício usa os **valores reais da FJP 2023** do anexo D (eles são públicos), com `mapa` e `reconstrucao_pnadc` do anexo A, período 2023.
7. `catalogo.json` com os dois pacotes.
8. `src/js/` com os módulos vazios e as funções utilitárias já testáveis: `util/formato.js` (pt-BR), `util/marcas.js` (vocabulário §5.3), `dados/pacote.js` (carregar manifesto e JSON, abrir Parquet no DuckDB-WASM), `estado/loja.js` (estado global da "pergunta" com assinatura de mudanças).
9. esbuild gerando `assets/js/moradinha.js`; `npm run build` = bundle + `quarto render`.
10. `.github/workflows/site.yml`: em PR e push: `npm ci`, testes, validar os pacotes do catálogo, build; em push na `main`: publicar no GitHub Pages (job só ativo depois que Julio ativar o Pages — ponto de parada).

## Validações (todas automáticas)

| id | critério |
|---|---|
| F0-1 | `npm run build` termina sem erro e gera `_site/` com 4 páginas |
| F0-2 | `npm run validar -- pacotes/al_rm_maceio/ficticio` e `pacotes/teste_pequeno/ficticio` saem com código 0 |
| F0-3 | **validador morde:** para cada regra V1–V12, um teste que corrompe uma cópia do pacote pequeno e confirma que o validador falha na regra certa (12 testes verdes) |
| F0-4 | testes de unidade de `formato.js` (1234567,891 → "1.234.567,9"; nulo → "—"), `marcas.js` (código desconhecido lança erro) e `loja.js` |
| F0-5 | Playwright abre as 4 páginas em claro e escuro, sem erro no console; captura de tela de cada uma em `relatorios/F0/` |
| F0-6 | axe-core sem violação "serious" ou "critical" nas 4 páginas |
| F0-7 | workflow verde num PR de teste |
| F0-8 | nenhuma dependência sem versão exata (`npm ls` + conferência do `package.json`); versões fixadas registradas no README |

## Parada obrigatória

Depois das validações: Julio ativa o GitHub Pages (Settings → Pages → GitHub Actions) e confirma. Com a confirmação, seguir para a F1.

## Anexo A — totais reais do piloto (regime c; 2022 = regime pnadc; precariedade 2022 pela amostra)

| componente | 2022 | 2023 | 2024 | 2025 | m2024 | m2025 |
|---|---|---|---|---|---|---|
| coabitação total (EP) | 8.391,73 (1.593,9) | 6.890,99 (1.408,8) | 6.746,24 (1.289,8) | 7.707,19 (1.497,0) | 7.342,99 (816,7) | 7.114,81 (852,2) |
| ônus total (EP) | 27.770,24 (3.258,2) | 34.444,48 (2.989,7) | 29.827,39 (3.525,3) | 35.356,44 (3.073,5) | 30.680,70 (1.907,5) | 33.209,44 (2.013,7) |
| precariedade total (EP) | 5.081,73 (263,3) | 5.454,27 (—) | 5.322,92 (—) | 5.573,96 (—) | 5.286,31 (—) | 5.450,38 (—) |
| domicílios | 427.204,0 | 444.688,6 | 446.574,5 | 466.575,0 | 439.489,0 | 452.612,7 |

Largura relativa mediana da faixa (para gerar mínimo e máximo fictícios): coabitação 0,705 / 0,7556 / 0,6887 / 0,7719 / 0,415 / 0,485; ônus 0,466 / 0,3578 / 0,4295 / 0,3367 / 0,236 / 0,219; precariedade 0,203 em 2022, sem faixa nos demais.

Mudanças (z): coabitação 0,705 / 0,076 / 0,486; ônus 1,509 / 0,999 / 1,182 (pares 2022→23, 23→24, 24→25), todas `mudanca_no_ruido`.

## Anexo B — consistência real (para `consistencia.json` fictício)

Spearman com 2022 e com o ano anterior; razão dos totais; mediana, p5 e p95 da razão por hexágono; n — tabela da seção 6d do `REGISTRO_RESULTADOS.md` (copiada por Julio para `referencia/`).

## Anexo C — etapas do pipeline (para `pipeline.json` fictício)

coleta (Censo, CNEFE, PNADc, luz, Open Buildings, MapBiomas, FCU, MDS) → grade (pedaços setor × hexágono) → classificação (regra da FJP na amostra e na PNADc) → treino (EBM, validação por AP fora da dobra) → montagem 2022 (composição, taxa, fator da AP, calibração, faixa) → anos t (estoque, estimativa, faixa, médias) → exportação (pacote de publicação).

## Anexo D — FJP, Déficit habitacional no Brasil 2023 (FJP, 2025), RM de Maceió

Fonte: FUNDAÇÃO JOÃO PINHEIRO. *Déficit habitacional no Brasil 2023*. Belo Horizonte: FJP, 2025 (relatório completo, versão de 25/09/2025). Dados básicos: PNADc 2023 (IBGE, 2024) e CadÚnico 2023.

| indicador | FJP 2023 | onde | reconstrução do moradinha na PNADc 2023 (EP) | explicação |
|---|---|---|---|---|
| total | 50.099 (relativo 10,8%) | Tabela 1, p. 16 | 47.039 (CV 12,3%) | a FJP soma os improvisados do CadÚnico, que a PNADc não capta |
| habitação precária | 11.936 = improvisados 5.812 + rústicos 6.124 | Tabelas 1 e 13, p. 16 e 46 | 5.704 (CV 96,8%) | comparar com os rústicos (6.124): mesmo conceito; improvisados vêm do CadÚnico |
| coabitação | 5.666 (só unidade convivente; cômodos 0) | Tabelas 1 e 15, p. 16 e 52 | 6.891 (EP 1.408,8) | núcleos reconstruídos pela descrição secundária (E19); FJP dentro da faixa de 95% |
| ônus | 32.498 | Tabela 1, p. 16 | 34.445 (EP 2.989,7) | FJP dentro da faixa de 95% |
| domicílios | 462.956 = PNADc 457.144 + improvisados 5.812 | Apêndice A, p. 72 | 452.802 (visita 1) | a FJP soma os improvisados; diferença de visita da PNADc a conferir |
