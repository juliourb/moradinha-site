// Carrega o pacote de publicação: manifesto e JSON por fetch; Parquet lido
// direto do DuckDB-WASM via read_parquet(url) (httpfs embutido, mesma origem
// do site — sem CORS). Nenhuma lógica de mapa ou gráfico entra aqui
// (SPEC_00 §2); este módulo só busca e monta os dados.
import * as duckdb from "@duckdb/duckdb-wasm";

// Bundles auto-hospedados (SPEC_00 §3: nada de CDN em produção).
// Os arquivos .wasm/.worker.js são copiados para assets/js/duckdb/ pelo esbuild
// (ferramentas/esbuild.mjs). URLs absolutas: o worker do DuckDB resolve
// caminhos relativos contra a própria URL dele (um blob), não a da página.
function urlAbsoluta(caminho) {
  return new URL(caminho, document.baseURI).href;
}
function bundles() {
  return {
    mvp: {
      mainModule: urlAbsoluta("assets/js/duckdb/duckdb-mvp.wasm"),
      mainWorker: urlAbsoluta("assets/js/duckdb/duckdb-browser-mvp.worker.js"),
    },
    eh: {
      mainModule: urlAbsoluta("assets/js/duckdb/duckdb-eh.wasm"),
      mainWorker: urlAbsoluta("assets/js/duckdb/duckdb-browser-eh.worker.js"),
    },
  };
}

let conexaoPromessa = null;

function conexao() {
  if (!conexaoPromessa) {
    conexaoPromessa = (async () => {
      const bundle = await duckdb.selectBundle(bundles());
      const worker = await duckdb.createWorker(bundle.mainWorker);
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      return db.connect();
    })();
  }
  return conexaoPromessa;
}

/**
 * Escolhe o domínio do catálogo: `?dominio=<conjunto_id>` na URL, se existir e
 * for conhecido (útil para conferir um pacote específico, ex. nos testes);
 * senão a edição padrão do primeiro domínio (SPEC_F5 trará o seletor de
 * verdade, com vários domínios públicos).
 */
export function escolherDominioEEdicao(catalogo) {
  const pedido = new URLSearchParams(window.location.search).get("dominio");
  const dominio = catalogo.dominios.find((d) => d.conjunto_id === pedido) ?? catalogo.dominios[0];
  const edicao = dominio.edicoes.find((e) => e.padrao) ?? dominio.edicoes[0];
  return { dominio, edicao };
}

/** Roda uma consulta SQL e devolve um array de objetos simples. */
export async function consultar(sql) {
  const conn = await conexao();
  const tabela = await conn.query(sql);
  return tabela.toArray().map((linha) => linha.toJSON());
}

/** URL absoluta do Parquet dentro do pacote, pronta para `read_parquet('...')`. */
export function urlParquet(origem, arquivo) {
  return urlAbsoluta(`${origem}/${arquivo}`).replace(/'/g, "''");
}

/** @param {string} origem pasta ou URL do pacote (catalogo.json) */
export async function carregarManifesto(origem) {
  return carregarJSON(origem, "manifesto.json");
}

/** @param {string} origem @param {string} arquivo nome do JSON dentro do pacote */
export async function carregarJSON(origem, arquivo) {
  const resposta = await fetch(`${origem}/${arquivo}`);
  if (!resposta.ok) throw new Error(`${arquivo}: HTTP ${resposta.status}`);
  return resposta.json();
}

export function dividirCodigos(campo) {
  return campo ? String(campo).split(";").filter(Boolean) : [];
}

/**
 * Monta a estrutura por hexágono (join de hex, hex_base, hex_qualidade,
 * hex_atributos) e por AP a partir de linhas já lidas dos Parquet — função
 * pura, sem depender de como as linhas foram obtidas (DuckDB-WASM no
 * navegador, ou @duckdb/node-api nos testes/ferramentas).
 */
export function montarEstrutura({ hexRows, baseRows, qualRows, atrRows, apRows }) {
  const linhas = new Map();
  for (const a of atrRows) {
    linhas.set(a.h3, {
      h3: a.h3,
      municipioCod: a.municipio_cod,
      municipioNome: a.municipio_nome,
      nMunicipios: a.n_municipios,
      apCod: a.ap_cod,
      nAps: a.n_aps,
      fcuFracao: a.fcu_fracao,
      recortes: dividirCodigos(a.recortes),
      dom: {},
      qualidadeBase: {},
      hex: {},
      qualidade: {},
    });
  }
  for (const b of baseRows) {
    const l = linhas.get(b.h3);
    if (!l) continue;
    l.dom[b.periodo] = b.domicilios ?? null;
    l.qualidadeBase[b.periodo] = b.qualidade;
  }
  for (const q of qualRows) {
    const l = linhas.get(q.h3);
    if (!l) continue;
    l.qualidade[q.periodo] = {
      fracaoImputada: q.fracao_imputada ?? null,
      fracaoSigilo: q.fracao_sigilo ?? null,
      nSetores: q.n_setores,
      fonteEstoque: q.fonte_estoque,
      gEstoque: q.g_estoque ?? null,
      hexNovo: q.hex_novo,
      enderecosCnefe: q.enderecos_cnefe ?? null,
    };
  }
  for (const h of hexRows) {
    const l = linhas.get(h.h3);
    if (!l) continue;
    if (!l.hex[h.periodo]) l.hex[h.periodo] = {};
    l.hex[h.periodo][h.componente] = {
      absoluto: h.absoluto ?? null,
      minimo: h.minimo ?? null,
      maximo: h.maximo ?? null,
      relativo: h.relativo ?? null,
      marcas: dividirCodigos(h.marcas),
    };
  }

  const ap = new Map();
  for (const r of apRows) {
    if (!ap.has(r.ap_cod)) {
      ap.set(r.ap_cod, {
        ap_cod: r.ap_cod,
        ap_nome: r.ap_nome,
        municipio_cod: r.municipio_cod,
        tipo: r.tipo,
        componentes: {},
      });
    }
    ap.get(r.ap_cod).componentes[r.componente] = {
      direta: r.direta ?? null,
      direta_cv: r.direta_cv ?? null,
      direta_ic_inf: r.direta_ic_inf ?? null,
      direta_ic_sup: r.direta_ic_sup ?? null,
      motor_2022: r.motor_2022 ?? null,
      ressalva: r.ressalva,
      sem_direta: r.sem_direta,
    };
  }

  return { linhas, ap };
}

/**
 * Carrega manifesto, totais e os Parquet do pacote, montando uma estrutura
 * por hexágono e por AP, pronta para o mapa e os gráficos (SPEC_F1).
 * @param {string} origem
 */
export async function carregarPacoteCompleto(origem) {
  const [manifesto, totais, qualidade] = await Promise.all([
    carregarManifesto(origem),
    carregarJSON(origem, "totais.json"),
    carregarJSON(origem, "qualidade.json").catch(() => null),
  ]);

  const [hexRows, baseRows, qualRows, atrRows, apRows] = await Promise.all([
    consultar(`SELECT * FROM read_parquet('${urlParquet(origem, "hex.parquet")}')`),
    consultar(`SELECT * FROM read_parquet('${urlParquet(origem, "hex_base.parquet")}')`),
    consultar(`SELECT * FROM read_parquet('${urlParquet(origem, "hex_qualidade.parquet")}')`),
    consultar(`SELECT * FROM read_parquet('${urlParquet(origem, "hex_atributos.parquet")}')`),
    consultar(`SELECT * FROM read_parquet('${urlParquet(origem, "ap.parquet")}')`),
  ]);

  const { linhas, ap } = montarEstrutura({ hexRows, baseRows, qualRows, atrRows, apRows });

  const [contornosAp, contornosMunicipios, contornosFcu] = await Promise.all([
    carregarJSON(origem, "contornos/ap.geojson").catch(() => null),
    carregarJSON(origem, "contornos/municipios.geojson").catch(() => null),
    carregarJSON(origem, "contornos/fcu.geojson").catch(() => null),
  ]);

  return { manifesto, totais, qualidade, linhas, ap, contornosAp, contornosMunicipios, contornosFcu };
}
