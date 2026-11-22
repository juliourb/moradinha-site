# moradinha-site

Site público que mostra os resultados do moradinha (déficit habitacional em hexágonos H3) por domínio. O moradinha é outro repositório, privado; aqui só entram os pacotes de publicação que ele exporta.

## Antes de qualquer tarefa

1. Ler `specs/README_SPECS.md` e `specs/SPEC_00_fundamentos.md` inteiros.
2. Ler `PROGRESSO.md` (se existir) para saber em que fase estamos.
3. Ler a SPEC da fase atual.

## Regras

- Seguir o protocolo de fases da SPEC_00 §9: implementar só a fase atual; rodar todas as validações; se todas passarem, commit `Fn: <resumo>`, atualizar `PROGRESSO.md`, escrever `relatorios/Fn.md` e seguir para a próxima fase sem esperar; se falharem após 2 rodadas de correção, parar e relatar.
- Paradas obrigatórias: fim da F0 (Julio ativa o GitHub Pages) e antes da publicação pública (F5).
- Nunca alterar `contrato/v1/` depois da F0 sem criar versão nova e avisar: o moradinha depende dele.
- Todo número exibido vem do pacote (SPEC_00 §8). Nada de microdado. `interno` nunca no build público.
- Textos do site em português, linguagem simples, sigla explicada na primeira vez.
- Versões exatas de dependências; nada de `latest`.
- Nunca commitar credenciais. Não há credenciais neste projeto.
- Referência visual e de comportamento: `referencia/prototipo/index.html` (aprovado). Números de consistência reais: `referencia/registro_6d_consistencia.md`.
