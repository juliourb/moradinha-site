# Mudanças nas especificações

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
