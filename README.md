# moradinha-site

Site público que mostra os resultados do **moradinha** (déficit habitacional em
hexágonos H3) por domínio de divulgação da PNADc. O moradinha (repositório privado)
gera os pacotes de publicação; este repositório só os lê e desenha.

Ver `specs/` para as especificações completas e `CLAUDE.md` para as regras do projeto.

## Pilha (versões exatas)

| item | versão |
|---|---|
| deck.gl | 9.1.14 |
| @deck.gl/mapbox | 9.1.14 |
| h3-js | 4.2.1 |
| d3 | 7.9.0 |
| maplibre-gl | 6.17.0 (última estável com mais de 2 semanas em 22/11/2026) |
| @duckdb/duckdb-wasm | 1.32.0 (última estável com mais de 2 semanas em 22/11/2026) |
| Quarto CLI | 1.11.9 |
| Node.js | 26.13.1 (LTS "Lithium"; ver `.nvmrc`) |
| esbuild | 0.28.2 |
| vitest | 5.1.1 |
| @playwright/test | 1.65.1 |
| @axe-core/playwright | 4.14.0 |
| ajv / ajv-formats | 8.20.0 / 3.0.1 |
| @duckdb/node-api (só `ferramentas/validar.mjs`, lê Parquet em Node) | 2.0.1-r.1 |
| Python (só para `ferramentas/gerar_ficticio.py`) | 3.13.9, h3==4.2.2, pyarrow==26.0.1, duckdb==2.0.1, em venv isolado `.venv-ficticio/` |

## Como rodar

```sh
npm ci
npm run dev          # quarto preview
npm run build        # bundle JS (esbuild) + quarto render -> _site/
npm test             # vitest (unidade)
npm run test:e2e     # playwright (fim a fim + axe-core)
npm run validar -- pacotes/al_rm_maceio/ficticio
```

### Gerar os pacotes fictícios (precisa de Python)

Este repositório não depende de Python para o site; só o gerador de pacotes
fictícios usa. Criar e usar o venv isolado (não precisa ser o Python de sistema):

```sh
python -m venv .venv-ficticio
./.venv-ficticio/Scripts/python.exe -m pip install "h3==4.2.2" pyarrow duckdb
./.venv-ficticio/Scripts/python.exe ferramentas/gerar_ficticio.py
```

## Estrutura

Ver SPEC_00 §4.
