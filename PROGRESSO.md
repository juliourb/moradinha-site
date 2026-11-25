# Progresso

Protocolo: SPEC_00 §9. Fase corrente implementada por completo, validada, e só então
seguimos para a próxima, sem esperar, exceto nas paradas obrigatórias (fim da F0 e
antes da F5).

| fase | status | data | commit |
|---|---|---|---|
| F0 | concluída (Pages ativado, workflow verde, confirmado por Julio) | 2026-11-22 | `80e05a0` |
| F1 | concluída (17/17 validações verdes; critério F1-5 ajustado para v1.3 por decisão de Julio) | 2026-11-22 | ver `git log` |
| F2 | concluída (5/5 validações verdes) | 2026-11-22 | ver `git log` |
| F3 | concluída (6/6 validações verdes; contrato v1.1 e complemento `fonte_estoque` por decisão de Julio) | 2026-11-22 | ver `git log` |
| F4 | concluída (6/6 validações verdes) | 2026-11-22 | ver `git log` |
| F5 | implementada na branch `f5-publicacao`, não publicada; revisão de Julio pediu ajustes (F6, spec a chegar) | 2026-11-22 | ver `git log f5-publicacao` (não mesclada) |
| F6.1 | concluída (pacote `bd10cbd`; conteúdo e leitura — números, escala de cores, explorador, Visão geral, Confiabilidade, Metodologia, dicas); suíte completa verde | 2026-11-22 | ver `git log f5-publicacao` (não mesclada) |
| F6.2 | concluída (interação e acabamento — polígonos reais, seleção múltipla do histograma, opacidade, fundo cinza, sem rolagem lateral, eixos p99, ranking sem repetição, 1º gráfico dentro da janela); suíte completa verde; relatório em `relatorios/F6.md` | 2026-11-22 | ver `git log f5-publicacao` (não mesclada) |
| F6.3 | concluída (revisão do preview: CI corrigido, faixa de duas alças no histograma, exclusões da legenda no histograma/caixas, código curto do ranking sem repetição, dica do hexágono nunca vazia — bug de BigInt corrigido —, painel de vereditos em largura total + regra nova do veredito 1, rótulos crus restantes, pop-up Detalhes e Metodologia com nome completo); suíte completa verde; relatório em `relatorios/F6.md` §F6.3 | 2026-11-22 | ver `git log f5-publicacao` (não mesclada) |
| F6.4 | concluída, exceto textos da Metodologia (4c: `specs/TEXTOS_METODOLOGIA_F6.md` ausente); suíte completa verde; relatório em `relatorios/F6.md` §F6.4 | 2026-11-23 | ver `git log f5-publicacao` (não mesclada) |
| S1 | implementado na branch `s1-dominios` (sai da `f5-publicacao`, que tem a F6.5 não mesclada; depende dela): catálogo montado no build, endereços `/d/…` e página inicial, pacote fictício `teste_sp`, site com 1 município e 332 APs, inventário para o contrato 1.2; relatório em `relatorios/S1.md`; PARADA (decisões de Julio no relatório) | 2026-11-25 | ver `git log s1-dominios` (não mesclada) |

## Notas

- Ambiente sem Python de sistema. Para `ferramentas/gerar_ficticio.py`, foi criado um
  venv isolado em `.venv-ficticio/` (gitignored), a partir do Python do Anaconda local,
  com `h3==4.2.2` (pino exato pedido pela SPEC_00 §3), `pyarrow==26.0.1`, `duckdb==2.0.1`.
  Esse venv não é o ambiente `moradinha` do usuário (não foi alterado).
