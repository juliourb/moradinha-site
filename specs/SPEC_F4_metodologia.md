# SPEC F4 — Metodologia

*Pré-requisito: F3 concluída.*

## Objetivo

Documentar a execução: como o número nasce, com quais parâmetros, de qual commit.

## Entregas

1. **Pipeline em grafo** a partir de `pipeline.json`: etapas em camadas da esquerda para a direita, ligações, e em cada etapa nome, commit e data; clicar numa etapa rola para a seção de texto correspondente. Layout feito pelo próprio módulo (d3, camadas pela ordem topológica); sem biblioteca nova sem registrar no relatório.
2. **Textos metodológicos** em `textos/metodologia/*.md` (pt-BR), um por etapa, com citações por chave do `referencias.bib` (formato de citação definido em `_quarto.yml`). Na F4, os textos são esqueletos com os títulos e uma frase por seção, marcados `rascunho: true`; o conteúdo final é escrito com Julio depois.
3. **Parâmetros do domínio:** tabela lida do manifesto e do `qualidade.json` (períodos, fontes por ano, limiares de marca: CV 15%, z 1,96, CV da AP 30%).
4. **Rastreio:** manifesto (edição, commit completo, data), hash de cada arquivo do pacote, versão do contrato, versão do site (commit deste repositório).
5. **Seção interna** (só no build privado, flag `--profile interno`): `modelo.json.interno` (ex.: R² por AP fora da dobra) com o aviso "desfecho interno, não publicado".

## Validações

| id | critério |
|---|---|
| F4-1 | o grafo tem exatamente as etapas e ligações do `pipeline.json` (teste de contagem e de nomes) |
| F4-2 | clicar numa etapa leva à âncora da seção (Playwright) |
| F4-3 | todo hash do rastreio é igual ao do manifesto |
| F4-4 | build público: nenhuma seção interna; build `--profile interno`: seção interna presente (dois builds no CI) |
| F4-5 | toda citação dos textos resolve no `referencias.bib` (build falha com citação órfã) |
| F4-6 | capturas em `relatorios/F4/`; axe sem serious/critical |
