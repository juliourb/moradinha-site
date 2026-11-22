# Mudanças nas especificações

## v1.4 (22/11/2026) — contrato do pacote sobe para v1.1 (pedido do moradinha)
- Criado `contrato/v1.1/` (cópia de `contrato/v1/`), com uma única mudança:
  `modelo.schema.json`, `<componente>.curvas[].desvio` passa a aceitar `null` (algumas variáveis não
  têm desvio-padrão calculável na curva de forma — investigação G1/G2 do moradinha).
  `contrato/v1/` não muda; pacotes com `manifesto.contrato = "1.0"` continuam validados por ele.
  `ferramentas/validar.mjs` escolhe a pasta do contrato pelo campo `manifesto.contrato` ("1.0" →
  `contrato/v1/`; "1.1" → `contrato/v1.1/`), espiando o campo antes de validar o esquema do próprio
  `manifesto.json`.
- SPEC_F3 (aba Confiabilidade, "O modelo", curvas de forma): quando `desvio` vier nulo, a curva é
  desenhada sem faixa, com a nota "faixa de oscilação não calculada nesta edição".

## v1.3 (22/11/2026) — decisão de Julio sobre o layout do explorador (F1-5)
- F1-5 (SPEC_F1 §7 e Validações) substituído: não exige mais zero rolagem em 1920×1080 e ≤ 40 px em
  1440×900 contando o dock inteiro; passa a exigir cabeçalho + barra de pergunta + mapa inteiro
  visíveis sem rolar, e a borda superior do dock (≥ 24 px dos títulos) visível na primeira tela, em
  qualquer uma das duas larguras; os gráficos continuam abertos por padrão (podem pedir rolagem
  vertical para serem vistos por inteiro); nenhuma rolagem horizontal. O piso de 560 px do mapa
  continua.
- SPEC_F1 §2: a barra da pergunta nunca quebra linha; abaixo de 1600 px, camadas e "comparar com
  (cortina)" saem para um menu "mais"; tema, medida, componente e período continuam sempre visíveis.

## v1.2 (22/11/2026) — depois da investigação G1 no moradinha
- `hex_qualidade.fracao_imputada`: só reconstrução **além da AP** (município, conjunto, divisão igual), média dos 6 blocos, ponderada por domicílios 2022.
- `hex_qualidade.fracao_sigilo`: denominador = peso da grade estatística (`peso_construtor`), porque pedaço em sigilo não tem domicílio.
- `hex_atributos`: município e AP **dominantes** por domicílios 2022; colunas novas `n_aps` e `n_municipios`; `recortes` referencia `manifesto.recortes`.
- `manifesto.recortes` (novo): lista genérica de recortes especiais por domínio (pode ser vazia; no piloto, `braskem`, 99 setores).
- `referencia_fjp.json`: indicador fechado, `fjp_tabela`, `fjp_subcomponentes`, `reconstrucao_ep`; valores reais da FJP 2023 no anexo D da F0.
- `pipeline.json`: sem `mor_restrito` e sem caminhos de microdado.
- Marca `fonte_estoque_diferente`: rótulo esclarecido (só 2023).
- V9 ampliada (recortes, `n_aps`, `n_municipios`).
- `totais.json`: regime aceita `provisoria`; cada linha tem `no_mapa` (bool; exatamente uma `true` por componente × período — o total que o mapa usa: coabitação e ônus no regime c; precariedade "amostra" em 2022 e "provisoria" nos anos t e médias). V5 passa a conferir contra a linha `no_mapa`.
- F1: medida de qualidade constante fica desabilitada; aviso de hexágono que cruza APs.
- F2: subcomponentes da FJP e "dentro/fora da faixa da reconstrução".
- F3: curva de forma sem faixa quando `desvio` é nulo (caso do piloto).
- Se o `contrato/v1` já foi escrito na F0: ajustar agora, ainda dentro da F0 (sem criar v1.1 do contrato).

## v1.1 (22/11/2026)
- Tema de qualidade no explorador, carrossel de gráficos, `hex_qualidade.parquet`; mapa de base OpenFreeMap.

## v1 (22/11/2026)
- Versão inicial.
