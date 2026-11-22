# Especificações do site do moradinha (para o Claude Code)

| arquivo | conteúdo |
|---|---|
| CHANGELOG_SPECS.md | o que mudou em cada versão |
| SPEC_00_fundamentos.md | arquitetura, pilha, contrato do pacote v1, validador, design system, regras, protocolo das fases |
| SPEC_F0_fundacao.md | repositório, contrato, validador, pacotes fictícios, CI |
| SPEC_F1_resultados.md | explorador ligado (mapa, cortina, camadas, painel do hexágono, gráficos em carrossel) com tema de qualidade |
| SPEC_F2_visao_geral.md | mensagem principal, cartões, FJP × moradinha, números para citar |
| SPEC_F3_confiabilidade.md | dados e qualidade, métricas do modelo com perguntas, consistência, achados |
| SPEC_F4_metodologia.md | pipeline em grafo, textos, parâmetros, rastreio, seção interna |
| SPEC_F5_dominios_publicacao.md | vários domínios, origem plugável, builds público e interno, publicação |
| SPEC_F6_ajustes.md | ajustes pedidos por Julio depois da revisão do pacote real (números, escala de cores, explorador, Visão geral, Confiabilidade, Metodologia, acabamento) |

Ordem: 00 → F0 → … → F5. O Claude Code avança sozinho quando todas as validações da fase passam; para nas paradas obrigatórias (F0: ativar o Pages; F5: publicação pública) ou após 2 rodadas de correção sem sucesso.

Referências que Julio copia para `referencia/` no repositório do site: o protótipo (`index.html`, `gerar_dados.py`) e a seção 6d do `REGISTRO_RESULTADOS.md`.

O contrato v1 (SPEC_00 §5) é também a entrada do prompt do Genie para os módulos de exportação do moradinha.
