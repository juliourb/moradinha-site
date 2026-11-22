# Regras de validação do pacote v1.1 (além do esquema)

*Única mudança em relação ao `contrato/v1`: `modelo.json`, `componente.curvas[].desvio`
aceita `null` (pedido do moradinha; investigação G1/G2 — algumas variáveis não têm
desvio-padrão calculável na curva de forma). `contrato/v1/` não muda; pacotes com
`manifesto.contrato = "1.0"` continuam validados pelo esquema de lá. `ferramentas/
validar.mjs` escolhe a pasta do contrato pelo campo `manifesto.contrato` ("1.0" →
`contrato/v1/`; "1.1" → `contrato/v1.1/`). Ver `specs/CHANGELOG_SPECS.md`.*

Implementadas em `ferramentas/validar.mjs`. `npm run validar -- <pasta do pacote>`
sai com código diferente de zero se qualquer regra falhar, imprimindo a regra, o
arquivo e até 5 exemplos.

| regra | conteúdo |
|---|---|
| V1 | todo arquivo obrigatório existe e passa no esquema JSON (Parquet: esquema de colunas e tipos, `contrato/v1/parquet.schema.json`) |
| V2 | sha256 de cada arquivo = `manifesto.arquivos` |
| V3 | todo `h3` é válido, da resolução `h3_resolucao`, sem repetição em `hex_atributos` |
| V4 | `hex.parquet` tem exatamente n_hex × n_periodos × n_componentes linhas; `hex_base` e `hex_qualidade`, n_hex × n_periodos; frações entre 0 e 1; `g_estoque` = 1 em 2022 |
| V5 | `totais` tem exatamente uma linha com `no_mapa = true` por componente × período; Σ `absoluto` por (período, componente) = `total` dessa linha, com erro relativo ≤ 1e−6 |
| V6 | Σ `domicilios` por período = `totais.domicilios`, erro relativo ≤ 1e−6 |
| V7 | `minimo` ≤ `absoluto` ≤ `maximo` onde os três existem; `minimo`/`maximo` nulos onde `absoluto` é nulo |
| V8 | `relativo` = 100 × `absoluto` ÷ `domicilios` (tolerância 1e−9) onde `domicilios` > 0; nulo onde `domicilios` é nulo |
| V9 | toda marca pertence ao vocabulário fechado (SPEC_00 §5.3); todo id em `hex_atributos.recortes` existe em `manifesto.recortes`; `n_aps` ≥ 1 e `n_municipios` ≥ 1 em todo hexágono |
| V10 | pacote com `publico = true` não tem a chave `interno` em `modelo.json`, e `ap.parquet` só tem `direta` em AP com ≥ 30 domicílios da amostra (campo `n_amostra` ausente do pacote público; a regra é conferida pelo moradinha e declarada em `manifesto.d17_conferido = true`) |
| V11 | nenhuma coluna com nome da lista proibida (abaixo) |
| V12 | `hex.parquet` ≤ 5 MB; pacote inteiro ≤ 20 MB |

## Vocabulário de marcas (fechado)

`total_fragil`, `mudanca_no_ruido`, `fonte_estoque_diferente`, `media_inclui_fonte_diferente`,
`precariedade_provisoria_sem_faixa`, `ap_ressalva`, `parcial_sigilo`, `sem_dado`.

Código fora desta lista invalida o pacote (V9). Rótulos ficam em `src/js/util/marcas.js`.

## Lista de colunas proibidas (V11)

Microdado nunca entra no pacote (SPEC_00 regra inviolável 4). Nenhum arquivo Parquet
do pacote pode ter coluna com um destes nomes (comparação exata, case-insensitive):

```
domicilio_id
pessoa
pessoa_id
v0001
v0002
v0003
v0004
v1008
v2005
v2007
v2009
v2010
uf
upa
estrato
peso_pessoa
peso_domicilio
n_amostra
```

Esta lista é conferida contra as colunas de **todos** os Parquet do pacote
(`hex`, `hex_base`, `hex_qualidade`, `hex_atributos`, `contexto`, `ap`), não só
os citados na SPEC_00 como exemplo.
