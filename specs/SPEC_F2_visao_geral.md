# SPEC F2 — Visão geral

*Pré-requisito: F1 concluída.*

## Objetivo

A página que se lê em um minuto: quanto déficit há, onde está o principal, quanto confiar, e de onde vêm os números (FJP × moradinha).

## Entregas

1. **Mensagem principal** (3 linhas, montada a partir do pacote): déficit absoluto e relativo do ano mais recente e da média de 3 anos; componente maior; a marca mais importante (ex.: "coabitação com total frágil").
2. **Cartões BI:** déficit total e por componente, absoluto e relativo, para o ano mais recente e a média mais recente; cada cartão com mini-série (sparkline) dos anos e pílula de marca. Clicar num cartão abre Resultados com a pergunta correspondente.
3. **Mini-mapa** do déficit relativo total no ano mais recente (mesmo módulo de mapa, sem controles), com link "explorar".
4. **FJP × moradinha**, por indicador de `referencia_fjp.json`, três números lado a lado:
   - **FJP (publicado)**, com fonte, página e link; quando nulo: "a preencher" em cinza;
   - **Reconstrução na PNADc** (a regra da FJP aplicada pelo moradinha aos microdados da PNADc);
   - **Total do mapa** (o que o site mostra).
   Abaixo, o texto `explicacao` e um bloco fixo: "Os totais do mapa seguem a métrica da FJP, mas não são o número da FJP: a coabitação é reconstruída a partir dos núcleos familiares, a precariedade de 2022 vem da amostra do Censo e os totais da RM têm o ruído da amostra da PNADc."
5. **Marcas de cuidado** do domínio, agrupadas por gravidade, cada uma com uma frase do que significa para o leitor.
6. **Números para citar:** tabela com os principais totais e faixas, cada linha com edição e data; botão "Copiar" que copia a linha no formato `Déficit total, RM de Maceió, 2025: 48.638 domicílios (moradinha, edição 580a7cc, 20/11/2026).`

## Validações

| id | critério |
|---|---|
| F2-1 | todo número da página confere com `totais.json`/`referencia_fjp.json` (mesmo teste da F1-1, sobre os elementos marcados `data-num`) |
| F2-2 | `fjp_publicado` nulo → aparece "a preencher"; preenchido no pacote pequeno de teste → aparece o número, a fonte e o link |
| F2-3 | clicar em cada cartão abre Resultados com medida, componente e período corretos |
| F2-4 | o texto copiado tem exatamente o formato acima (teste com área de transferência simulada) |
| F2-5 | página inteira visível sem erro de console, claro e escuro, capturas em `relatorios/F2/`; axe sem serious/critical |
