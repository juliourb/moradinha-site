# Lista de verificação antes de publicar (SPEC_F5 §6)

Parada obrigatória (SPEC_00 §9, SPEC_F5): Julio confere item a item e autoriza antes do merge/push
para `main` que torna o site público de fato.

## Pacote

- [x] Pacote real validado: `npm run validar -- pacotes/al_rm_maceio/bd10cbd` → `OK: todas as regras
  passaram.`
- [x] `manifesto.ficticio` é `false` no pacote real.
- [x] `manifesto.publico` é `true` no pacote real.
- [x] `manifesto.d17_conferido` é `true`.
- [x] Chip "dados fictícios" ausente quando a edição padrão (sem parâmetros na URL) é aberta —
  `tests/e2e/f5-publicacao.spec.js`.
- [x] Edição citada (`manifesto.edicao`) igual ao commit do moradinha que gerou o pacote: `bd10cbd`
  é o prefixo de `manifesto.commit_completo` (`bd10cbde76cbd2174abc6fbea0e8ff180265b673`).
- [x] `catalogo.json`: a edição real (`bd10cbd`) é a `padrao` de `al_rm_maceio` (F6.0: a edição
  anterior, `69277fd`, saiu do catálogo por ter o erro da ponte A1 corrigido em `bd10cbd`; a pasta
  `pacotes/al_rm_maceio/69277fd/` fica, apagar é decisão de Julio). A fictícia e o domínio
  `teste_pequeno` ficam marcados `teste_apenas` (nunca aparecem no seletor público, só por
  `?dominio=&edicao=` explícito — é assim que a suíte de testes abre os pacotes fictícios).
- [x] `npm run validar:catalogo-publico` → toda entrada do catálogo fora de `teste_apenas` é
  `publico=true`/`ficticio=false`.

## Mapa de base (OpenFreeMap)

- [x] Termos de Serviço conferidos: <https://openfreemap.org/tos/> (conferido com a Claude Docs em
  22/11/2026 — Julio, confirme a leitura antes de autorizar; não fui eu quem negociou nada com a
  OpenFreeMap, só verifiquei que a URL existe e é a página de termos).
- [x] Atribuição no rodapé e no canto do mapa (explorador e minimapa): "OpenFreeMap © OpenMapTiles ·
  Dados © colaboradores do OpenStreetMap", com links para openfreemap.org, openmaptiles.org e
  openstreetmap.org/copyright; link extra para os Termos de Serviço só no rodapé.
- [x] Nenhuma chave de API no mapa de base (`tests/e2e/f1-resultados.spec.js` F1-16, já da F1).
- [ ] **Decisão de Julio, ainda pendente**: mapa de base próprio via `pmtiles extract` (SPEC_F5
  item 5, opcional) — não implementado nesta rodada; o site continua nos tiles do OpenFreeMap.

## Build e CI

- [x] Build público (`npm run build`) recusa pacote não público/fictício fora de
  `teste_apenas` (`ferramentas/validar_catalogo_publico.mjs`, F5-2).
- [x] Build interno (`npm run build:interno`) só roda no CI como artefato, nunca publicado no Pages.
- [x] **F5-5** (CI publica no Pages a partir da `main`): conferido depois do primeiro merge
  (`5374ee9`, 23/11/2026): execução 45171954087, jobs `build` e `deploy` verdes, site no ar em
  <https://juliourb.github.io/moradinha-site/>. Reconferir a cada novo merge.
- [ ] **F5-6** (mapa de base próprio, `base.pmtiles`): não aplicável — item 5 não foi adotado.

## O que falta para este site ser multi-domínio de verdade

Registrado como pendência, não como bloqueio desta publicação (só há um domínio real hoje):

- Endereços por pasta (`/d/<conjunto_id>/<edicao>/`, gerados no build) da SPEC_F5 item 1: não
  implementados nesta rodada. O seletor do cabeçalho troca de domínio/edição recarregando a mesma
  página com `?dominio=&edicao=` na URL — funciona para qualquer edição marcada no catálogo, mas as
  URLs não são "bonitas" nem persistem se o `catalogo.json` mudar de ordem. Revisitar quando um
  segundo domínio real existir.
- Página inicial com um cartão por domínio (SPEC_F5 item 3): não implementada — `index.qmd` segue
  sendo a Visão Geral de um domínio (o escolhido pelo seletor), como desde a F2. Mesma decisão:
  revisitar com um segundo domínio real.

## Conferência item a item da F6.5 (25/11/2026, branch `f5-publicacao`, `60ea49d` + este commit)

| item | resultado |
|---|---|
| `npm run validar -- pacotes/al_rm_maceio/bd10cbd` | OK: todas as regras passaram |
| `manifesto.ficticio` / `publico` / `d17_conferido` | `false` / `true` / `true` |
| edição = prefixo do commit | `bd10cbd` = início de `bd10cbde76cbd2174abc6fbea0e8ff180265b673` |
| `catalogo.json` | `al_rm_maceio`: `bd10cbd` padrão; `ficticio` marcada `teste_apenas`; `teste_pequeno` `teste_apenas`; `69277fd` fora do catálogo (pasta mantida) |
| `npm run validar:catalogo-publico` | OK |
| chip "dados fictícios" na edição padrão | ausente (`f5-publicacao.spec.js`, verde) |
| atribuição e Termos do OpenFreeMap | presentes no HTML gerado (rodapé e mapa); leitura dos termos continua a ser de Julio |
| build público e interno | `npm run build` e `build:interno` verdes; `validar:build-interno` OK |
| suíte completa (item 7 da F6.5) | unidade 152/152; `validar:citacoes` OK; Playwright 137 verdes e 1 intermitente (F1-5 1440×900: estourou 30 s esperando o mapa na carga a frio; passa isolado, 3,4 s, e na repetição do arquivo) |
| F5-5 (Pages) | conferido no primeiro merge; **reconferir** o job `deploy` depois do próximo merge |
| em aberto (não bloqueiam) | mapa de base próprio (F5-6, decisão de Julio); endereços `/d/…` e página inicial por domínio (feitos na branch `s1-dominios`, não aqui) |

## Autorização

- [ ] Julio autoriza o merge de `f5-publicacao` para `main` e a publicação. **Espera o "publicar" explícito de Julio**;
  nenhum merge nem push na `main` foi feito. (A autorização anterior, de 23/11, valeu para o primeiro merge `5374ee9`.)
