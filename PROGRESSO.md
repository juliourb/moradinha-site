# Progresso

Protocolo: SPEC_00 §9. Fase corrente implementada por completo, validada, e só então
seguimos para a próxima, sem esperar, exceto nas paradas obrigatórias (fim da F0 e
antes da F5).

| fase | status | data | commit |
|---|---|---|---|
| F0 | validações verdes; parado na parada obrigatória (ativar o GitHub Pages) | 2026-11-22 | ver `git log` |
| F1 | pendente | — | — |
| F2 | pendente | — | — |
| F3 | pendente | — | — |
| F4 | pendente | — | — |
| F5 | pendente | — | — |

## Notas

- Ambiente sem Python de sistema. Para `ferramentas/gerar_ficticio.py`, foi criado um
  venv isolado em `.venv-ficticio/` (gitignored), a partir do Python do Anaconda local,
  com `h3==4.2.2` (pino exato pedido pela SPEC_00 §3), `pyarrow==26.0.1`, `duckdb==2.0.1`.
  Esse venv não é o ambiente `moradinha` do usuário (não foi alterado).
