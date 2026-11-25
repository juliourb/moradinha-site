// S1-2: reescrita das páginas para os endereços d/<conjunto>/<edicao>/ (ferramentas/gerar_enderecos.mjs).
import { describe, expect, it } from "vitest";
import { paginaDoEndereco } from "../../ferramentas/gerar_enderecos.mjs";

const HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<link href="site_libs/x.css" rel="stylesheet">
</head><body>
<a href="#quarto-document-content">Pular</a>
<a class="navbar-brand" href="./index.html">moradinha</a>
<a href="./visao-geral.html">Visão geral</a><a href="./resultados.html">Resultados</a>
<a href="resultados.html#topo">Explorar</a>
<a href="https://openfreemap.org">externo</a>
<script type="module" src="assets/js/moradinha.js"></script>
</body></html>`;

describe("paginaDoEndereco", () => {
  const e = paginaDoEndereco(HTML, { dominio: "teste_sp", edicao: "ficticio", pagina: "visao-geral" });

  it("põe <base> para a raiz do site e os <meta> do endereço", () => {
    expect(e).toContain('<base href="../../../">');
    expect(e).toContain('<meta name="moradinha-dominio" content="teste_sp">');
    expect(e).toContain('<meta name="moradinha-edicao" content="ficticio">');
    expect(e).toContain('<meta name="moradinha-pagina" content="visao-geral.html">');
  });

  it("links entre páginas e a âncora ficam na mesma edição; o título volta à página inicial", () => {
    expect(e).toContain('href="d/teste_sp/ficticio/resultados.html"');
    expect(e).toContain('href="d/teste_sp/ficticio/visao-geral.html"');
    expect(e).toContain('href="d/teste_sp/ficticio/resultados.html#topo"');
    expect(e).toContain('href="d/teste_sp/ficticio/visao-geral.html#quarto-document-content"');
    expect(e).toContain('class="navbar-brand" href="./index.html"');
    expect(e).toContain('href="https://openfreemap.org"');
  });

  it("endereço do domínio (edição padrão): uma pasta a menos e <meta> de edição vazio", () => {
    const d = paginaDoEndereco(HTML, { dominio: "teste_sp", edicao: null, pagina: "resultados" });
    expect(d).toContain('<base href="../../">');
    expect(d).toContain('<meta name="moradinha-edicao" content="">');
    expect(d).toContain('href="d/teste_sp/resultados.html"');
  });
});
