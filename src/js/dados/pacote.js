// Carrega o pacote de publicação: manifesto e JSON por fetch; Parquet aberto
// no DuckDB-WASM. Mapa de base e camadas de deck.gl ficam em src/js/mapa/
// (SPEC_F1). Nenhuma lógica de mapa ou gráfico entra aqui.
import * as duckdb from "@duckdb/duckdb-wasm";

// Bundles auto-hospedados (SPEC_00 §3: nada de CDN em produção).
// Os arquivos .wasm/.worker.js são copiados para assets/js/duckdb/ pelo esbuild
// (ferramentas/esbuild.mjs).
const BUNDLES = {
  mvp: {
    mainModule: "assets/js/duckdb/duckdb-mvp.wasm",
    mainWorker: "assets/js/duckdb/duckdb-browser-mvp.worker.js",
  },
  eh: {
    mainModule: "assets/js/duckdb/duckdb-eh.wasm",
    mainWorker: "assets/js/duckdb/duckdb-browser-eh.worker.js",
  },
};

let instanciaPromessa = null;

function instanciaDuckDB() {
  if (!instanciaPromessa) {
    instanciaPromessa = (async () => {
      const bundle = await duckdb.selectBundle(BUNDLES);
      const worker = await duckdb.createWorker(bundle.mainWorker);
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      return db;
    })();
  }
  return instanciaPromessa;
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

/**
 * Abre um Parquet do pacote como view no DuckDB-WASM.
 * @param {string} origem
 * @param {string} arquivo ex.: "hex.parquet"
 * @param {string} [alias] nome da view; padrão é o nome do arquivo sem extensão
 */
export async function abrirParquet(origem, arquivo, alias = arquivo.replace(/\.parquet$/, "")) {
  const db = await instanciaDuckDB();
  const conn = await db.connect();
  const url = `${origem}/${arquivo}`;
  await db.registerFileURL(arquivo, url, duckdb.DuckDBDataProtocol.HTTP, false);
  await conn.query(`CREATE OR REPLACE VIEW ${alias} AS SELECT * FROM read_parquet('${arquivo}')`);
  return conn;
}
