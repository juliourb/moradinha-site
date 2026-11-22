# SPEC F5 — Vários domínios e publicação

*Pré-requisito: F4 concluída.*

## Objetivo

O mesmo site para vários domínios e edições, publicado em link público, com pacote real.

## Entregas

1. **Seletor de domínio e edição** no cabeçalho, a partir de `catalogo.json`; endereço por domínio e edição (ex.: `/#resultados` dentro de `/d/al_rm_maceio/580a7cc/`, gerado no build, uma pasta por edição) e `/d/al_rm_maceio/` apontando para a `edicao_padrao`.
2. **Origem do pacote plugável:** `catalogo.json` aceita `local` (pasta do repositório) ou `url` (HTTPS, mesmo esquema); o carregador trata os dois igual. Pacote remoto é validado no build (V1–V12) antes de publicar.
3. **Página inicial** com a lista de domínios (cartão por domínio: nome, edição padrão, data, mini-mapa).
4. **Builds:** público (padrão; recusa pacote com `publico = false` ou com `interno`) e interno (`--profile interno`, não publicado no Pages; artefato do CI).
5. **Mapa de base próprio (opcional, decisão de Julio):** gerar com a CLI `pmtiles extract` um recorte Protomaps da caixa do domínio (zoom até 15), servir em `pacotes/<conjunto_id>/base.pmtiles` e o estilo claro/escuro de visualização de dados; trocar a configuração e conferir que o site não faz nenhuma requisição a terceiros para o mapa.
6. **Lista de verificação de publicação** em `PUBLICAR.md`: termos do mapa de base conferidos; pacote real validado; `manifesto.ficticio` falso; chip "dados fictícios" ausente; edição citada igual ao commit do moradinha.

## Validações

| id | critério |
|---|---|
| F5-1 | com os dois pacotes fictícios no catálogo, trocar de domínio e de edição recarrega mapa, totais e textos do pacote certo (Playwright) |
| F5-2 | pacote com `publico = false` no catálogo → build público falha com mensagem clara |
| F5-3 | pacote por `url` servido localmente no teste → mesma tela que o `local` |
| F5-4 | links de domínio e edição estáveis: abrir o endereço direto mostra a edição pedida |
| F5-5 | CI publica no Pages a partir da `main` (job verde) |
| F5-6 | se o mapa de base próprio for adotado: tamanho do `base.pmtiles` registrado (meta ≤ 30 MB por domínio) e nenhuma requisição de mapa fora do próprio site |

## Parada obrigatória

Antes de trocar o pacote fictício pelo real e tornar o link público: Julio confere `PUBLICAR.md` item a item (inclui os termos da Esri ou a troca para CARTO) e autoriza.
