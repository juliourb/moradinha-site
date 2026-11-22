# SPEC F1 — Aba Resultados (explorador, com tema de qualidade)

*Pré-requisito: F0 concluída. Referência visual e de comportamento: `referencia/prototipo/index.html` (aprovado por Julio em 22/11). Portar o comportamento para módulos; não copiar o arquivo inteiro.*

## Objetivo

O explorador ligado: uma "pergunta" muda junto o mapa, a resposta, os cartões, as marcas, o painel do hexágono e os gráficos.

## Entregas

1. **Estado (`estado/loja.js`):** `tema` (deficit \| qualidade), `medida_qualidade` (id da §8), `conjunto_graficos` (índice do carrossel), `medida` (absoluto \| relativo), `componente` (total \| coabitacao \| onus \| precariedade), `periodo` (id do manifesto), `comparar` (id \| nulo), `selecionado` (h3 \| nulo), `faixa_hist` ([de, até] \| nulo), camadas ligadas. Estado refletido no hash da URL (`#resultados`) só pelo nome da aba; o resto fica na memória e, opcionalmente, em `localStorage` com try/catch.
2. **Pergunta em texto** montada a partir do estado ("Onde está o déficit relativo de ônus em 2025? Comparado com 2022.").
   A barra da pergunta fica sempre numa linha só. Abaixo de 1600 px de largura, os controles de
   camadas e "comparar com (cortina)" saem da barra e vão para um menu "mais" (botão com
   `aria-expanded`, abre por clique e por teclado); tema, medida, componente e período continuam
   visíveis na barra em qualquer largura (decisão de Julio, v1.3 — `CHANGELOG_SPECS.md`).
3. **Mapa (`mapa/`):**
   - camada de base MapLibre (SPEC_00 §6) com a camada do deck.gl sobreposta, atribuição e aviso de falha;
   - `H3HexagonLayer` única, sem extrusão, `highPrecision: true`, cor pela rampa de 7 quantis calculados sobre os valores > 0 do período (e do período comparado, quando houver cortina, para a escala ser a mesma);
   - cortina: duas instâncias sincronizadas, a da direita recortada por `clip-path`, divisória arrastável por ponteiro e por teclado (setas);
   - camadas ligáveis a partir de `contornos/`: AP, municípios, FCU; recortes de `hex_atributos.recortes` (ex.: Braskem); camadas de `contexto.parquet`, quando existirem, aparecem na lista; ausentes aparecem desligadas com "em breve";
   - dica ao passar o mouse; clique seleciona o hexágono.
4. **Resposta e cartões (`ui/resposta.js`):** total do domínio do período (de `totais.json`), faixa de 95% (`ic_inf`/`ic_sup`) ou o motivo de não haver faixa, CV; com cortina, diferença e z (de `totais.json.mudancas` quando o par existir; senão calculado só se os dois `ep` existirem, com o rótulo "calculado no site"); pílulas de marca; cartões dos três componentes, clicáveis.
5. **Painel do hexágono (`ui/hexagono.js`):** código H3, AP, município, domicílios, recortes; por componente, valor e faixa em barra; série do hexágono nos anos com o período de `fonte_estoque_diferente` destacado; comparação da AP ("direta da amostra × soma do motor", com CV e marca de ressalva) e a frase fixa "A PNADc não existe por hexágono; a comparação honesta é na AP e no domínio."
6. **Dock de gráficos (`graficos/`)**, cada um minimizável e o dock inteiro minimizável:
   - histograma dos hexágonos > 0, clicar numa barra destaca esses hexágonos no mapa (os outros ficam translúcidos);
   - ranking dos 5 maiores (clique leva o mapa ao hexágono);
   - total do domínio no tempo (pontos = anos; losangos = médias; barras = faixa de 95%; clique troca o período);
   - distribuição por período (caixa p25–p75, mediana, haste p10–p90; clique troca o período).
   Os gráficos se redesenham pela largura do contêiner (ResizeObserver) e ao abrir/fechar.
7. **Altura (critério v1.3 — decisão de Julio, substitui a v1):** o mapa ocupa a altura livre da
   janela com o dock aberto, com mínimo de 560 px; com o dock minimizado, cresce. A coluna da
   direita tem a mesma altura do mapa e rola por dentro. `--maph` é calculada para que, em qualquer
   largura, a borda superior do dock de gráficos (pelo menos 24 px dos títulos dos cartões) apareça
   na primeira tela, sem rolagem horizontal; os gráficos do dock começam abertos em qualquer
   largura e podem exigir rolagem vertical para serem vistos por inteiro. O piso de 560 px do mapa
   não muda.

8. **Tema de qualidade** (controle "Tema: Déficit \| Qualidade" na barra da pergunta; no tema Qualidade aparece o seletor "Medida de qualidade" e a pergunta em texto vira, por exemplo, "Quão confiável é a estimativa de coabitação em 2025?"):

   | medida (id) | de onde vem | escala no mapa |
   |---|---|---|
   | `incerteza` — incerteza da estimativa | (`maximo` − `minimo`) ÷ `absoluto` do componente escolhido (derivada no site; total e precariedade provisória: "sem faixa", cinza) | sequencial em azul-acinzentado (rampa própria, não a do déficit) |
   | `qualidade_dado` — qualidade do dado | `hex_base.qualidade` | categórica: ok / parte em sigilo / sem dado |
   | `ressalva_ap` — ressalva da área de ponderação | `ap.parquet.ressalva` e `sem_direta` do componente | categórica |
   | `cv_ap` — precisão da amostra na AP | `ap.parquet.direta_cv` | sequencial |
   | `imputacao` — parte imputada pela cascata | `hex_qualidade.fracao_imputada` | sequencial 0–1 |
   | `estoque` — mudança do estoque desde 2022 | `hex_qualidade.g_estoque` | divergente centrada em 1; período com `fonte_estoque_diferente` com a pílula crítica |
   | `hex_novo` — hexágono novo no período | `hex_qualidade.hex_novo` | categórica |

   Medida com o mesmo valor em todos os hexágonos do período (ex.: `hex_novo` sempre falso no piloto) fica **desabilitada** no seletor, com a dica "igual em todos os hexágonos neste período"; nunca pinta o mapa de uma cor só.

   Cada medida tem, no seletor, uma frase de "o que significa" (ex.: incerteza = "largura da faixa de 95% em relação à estimativa; 0,5 quer dizer que a faixa tem metade do tamanho do valor").
9. **Carrossel do dock:** o dock ganha conjuntos de gráficos navegáveis por setas e pontos ("Déficit", "Qualidade"; extensível a "Território" quando houver `contexto.parquet`). Trocar o tema troca o conjunto exibido; as setas permitem ver o outro conjunto sem trocar o mapa. Conjunto **Qualidade**:
   - histograma da medida de qualidade escolhida (clique destaca no mapa);
   - **dispersão déficit × incerteza** (um ponto por hexágono; quadrante "muito déficit e muita incerteza" sombreado e contado; clique seleciona o hexágono);
   - **composição da qualidade ponderada por domicílios** por período (barras empilhadas: ok, AP com ressalva, parte em sigilo, sem dado);
   - **estoque t ÷ 2022 por período** (caixas p10–p90; o período com `fonte_estoque_diferente` em vermelho).
10. **Painel do hexágono** mostra a AP dominante e, quando `n_aps` > 1, o aviso "este hexágono cruza N áreas de ponderação; a comparação usa a dominante" (idem para município). Ganha também o bloco "Qualidade deste hexágono": qualidade do dado, incerteza por componente, ressalva e CV da AP, fração imputada, fonte do estoque e `g_estoque`, hexágono novo — cada item com pílula semântica (bom, atenção, crítico) por limiares declarados em `src/js/util/limiares.js` (incerteza > 0,7 atenção; > 1,0 crítico; CV da AP > 30% crítico; fração imputada > 0,3 atenção).

## Validações

| id | critério |
|---|---|
| F1-1 | **números vêm do pacote:** para 12 combinações (medida × componente × período), o número grande da resposta e os três cartões são iguais ao valor obtido por consulta DuckDB direta ao pacote (`totais.json` e soma de `hex.parquet`), com tolerância de arredondamento de exibição |
| F1-2 | soma dos valores dos hexágonos desenhados (lida do estado do layer) = total da resposta, por componente, nos 6 períodos (erro relativo ≤ 1e−6) |
| F1-3 | total nunca mostra faixa; precariedade nos períodos com `precariedade_provisoria_sem_faixa` nunca mostra faixa |
| F1-4 | Playwright, roteiro: trocar cada controle → a pergunta em texto, a legenda, o número grande e o título do histograma mudam; ligar a cortina → aparecem as duas legendas de período e a divisória; arrastar a divisória → `clip-path` muda; clicar num hexágono → o painel mostra o mesmo código H3; clicar numa barra do histograma → hexágonos fora da faixa ficam com alfa ≤ 60; clicar num ponto da série → o período muda; minimizar cada gráfico e o dock → o mapa cresce |
| F1-5 | **critério v1.3** (medido em 1920×1080 e 1440×900): cabeçalho + barra de pergunta + mapa inteiro visíveis sem rolar; borda superior do dock visível na primeira tela (≥ 24 px dos títulos dos cartões); gráficos abertos por padrão em qualquer largura (podem exigir rolagem vertical); nenhuma rolagem horizontal |
| F1-6 | o período com `fonte_estoque_diferente` mostra a pílula crítica e aparece em vermelho na série e na série do hexágono |
| F1-7 | tempo até o evento `mapa-pronto` ≤ 4 s no CI com o pacote de Maceió (cache frio), medido 3 vezes, mediana registrada |
| F1-8 | axe-core sem violação serious/critical; todos os controles operáveis por teclado (roteiro Tab/Enter/setas) |
| F1-9 | tema escuro: captura de tela clara e escura em `relatorios/F1/`; mapa de base troca para a versão escura |
| F1-10 | mapa de base indisponível (rota bloqueada no teste) → aviso aparece e o resto funciona |
| F1-11 | tema Qualidade: para cada medida da §8, a legenda, a rampa e a pergunta em texto mudam; a medida `incerteza` no total e na precariedade provisória fica cinza com "sem faixa" |
| F1-12 | medidas derivadas conferem: para 20 hexágonos sorteados, a `incerteza` exibida = (máx − mín) ÷ absoluto calculado por DuckDB direto no pacote (tolerância 1e−9) |
| F1-13 | carrossel: setas e pontos trocam o conjunto de gráficos sem mudar o mapa; trocar o tema leva o carrossel ao conjunto do tema; teclado (setas) funciona |
| F1-14 | dispersão déficit × incerteza: a contagem do quadrante = consulta DuckDB com os mesmos cortes (medianas do período) |
| F1-15 | composição ponderada por domicílios: as barras de cada período somam 100% (± 0,1) e batem com `hex_base` + `ap.parquet` |
| F1-17 | medida constante no período aparece desabilitada (teste com `hex_novo` do pacote de Maceió); hexágono com `n_aps` > 1 mostra o aviso |
| F1-16 | mapa de base: OpenFreeMap `positron` no claro e `dark` no escuro, sem chave de API em nenhuma requisição (teste inspeciona as URLs) |
