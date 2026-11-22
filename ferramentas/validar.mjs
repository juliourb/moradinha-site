#!/usr/bin/env node
// Validador do pacote de publicação (contrato v1). SPEC_00 §5.4.
// Uso: node ferramentas/validar.mjs <pasta do pacote>
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { DuckDBInstance } from "@duckdb/node-api";
import { isValidCell, getResolution } from "h3-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRATO_DIR = join(__dirname, "..", "contrato", "v1");

const MARCAS_VALIDAS = new Set([
  "total_fragil",
  "mudanca_no_ruido",
  "fonte_estoque_diferente",
  "media_inclui_fonte_diferente",
  "precariedade_provisoria_sem_faixa",
  "ap_ressalva",
  "parcial_sigilo",
  "sem_dado",
]);

const COLUNAS_PROIBIDAS = new Set([
  "domicilio_id", "pessoa", "pessoa_id", "v0001", "v0002", "v0003", "v0004",
  "v1008", "v2005", "v2007", "v2009", "v2010", "uf", "upa", "estrato",
  "peso_pessoa", "peso_domicilio", "n_amostra",
].map((c) => c.toLowerCase()));

const JSON_SCHEMAS = {
  "manifesto.json": "manifesto.schema.json",
  "totais.json": "totais.schema.json",
  "modelo.json": "modelo.schema.json",
  "consistencia.json": "consistencia.schema.json",
  "qualidade.json": "qualidade.schema.json",
  "referencia_fjp.json": "referencia_fjp.schema.json",
  "achados.json": "achados.schema.json",
  "pipeline.json": "pipeline.schema.json",
};

const ARQUIVOS_OBRIGATORIOS = [
  "manifesto.json", "totais.json", "modelo.json", "consistencia.json",
  "qualidade.json", "referencia_fjp.json", "achados.json", "pipeline.json",
  "hex.parquet", "hex_base.parquet", "hex_qualidade.parquet", "hex_atributos.parquet",
  "ap.parquet",
  "contornos/ap.geojson", "contornos/municipios.geojson", "contornos/fcu.geojson",
];

class Relatorio {
  constructor() {
    this.falhas = []; // { regra, arquivo, mensagem, exemplos }
  }
  falha(regra, arquivo, mensagem, exemplos = []) {
    this.falhas.push({ regra, arquivo, mensagem, exemplos: exemplos.slice(0, 5) });
  }
  ok() {
    return this.falhas.length === 0;
  }
  imprimir() {
    if (this.ok()) {
      console.log("OK: todas as regras passaram.");
      return;
    }
    console.error(`FALHOU: ${this.falhas.length} problema(s).\n`);
    for (const f of this.falhas) {
      console.error(`[${f.regra}] ${f.arquivo}: ${f.mensagem}`);
      for (const ex of f.exemplos) {
        console.error(`    exemplo: ${JSON.stringify(ex)}`);
      }
    }
  }
}

function sha256(caminho) {
  return createHash("sha256").update(readFileSync(caminho)).digest("hex");
}

function lerJSON(caminho) {
  return JSON.parse(readFileSync(caminho, "utf8"));
}

function ajvInstancia() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

async function validarEsquemasJSON(pasta, rel) {
  const ajv = ajvInstancia();
  const dados = {};
  for (const [arquivo, esquema] of Object.entries(JSON_SCHEMAS)) {
    const caminho = join(pasta, arquivo);
    if (!existsSync(caminho)) {
      rel.falha("V1", arquivo, "arquivo obrigatório não existe");
      continue;
    }
    let conteudo;
    try {
      conteudo = lerJSON(caminho);
    } catch (e) {
      rel.falha("V1", arquivo, `JSON inválido: ${e.message}`);
      continue;
    }
    dados[arquivo] = conteudo;
    const schema = lerJSON(join(CONTRATO_DIR, esquema));
    const validate = ajv.compile(schema);
    if (!validate(conteudo)) {
      rel.falha(
        "V1",
        arquivo,
        "não passa no esquema JSON",
        validate.errors.map((e) => `${e.instancePath} ${e.message}`)
      );
    }
  }
  for (const nome of ["contornos/ap.geojson", "contornos/municipios.geojson", "contornos/fcu.geojson"]) {
    const caminho = join(pasta, nome);
    if (!existsSync(caminho)) {
      rel.falha("V1", nome, "arquivo obrigatório não existe");
      continue;
    }
    let gj;
    try {
      gj = lerJSON(caminho);
    } catch (e) {
      rel.falha("V1", nome, `JSON inválido: ${e.message}`);
      continue;
    }
    if (gj.type !== "FeatureCollection" || !Array.isArray(gj.features)) {
      rel.falha("V1", nome, "não é um FeatureCollection GeoJSON válido");
      continue;
    }
    const semProps = gj.features.filter(
      (f) => !f.properties || f.properties.cod == null || f.properties.nome == null
    );
    if (semProps.length) {
      rel.falha("V1", nome, "feição sem propriedades cod/nome", semProps.slice(0, 5));
    }
  }
  return dados;
}

async function conectarDuckDB() {
  const instancia = await DuckDBInstance.create(":memory:");
  return instancia.connect();
}

async function consultar(conn, sql) {
  const resultado = await conn.run(sql);
  return resultado.getRowObjects();
}

async function descreverParquet(conn, caminho) {
  const sqlPath = caminho.replace(/\\/g, "/").replace(/'/g, "''");
  const linhas = await consultar(conn, `DESCRIBE SELECT * FROM read_parquet('${sqlPath}')`);
  return linhas.map((l) => ({ nome: String(l.column_name), tipo: String(l.column_type) }));
}

const TIPO_EQUIV = {
  VARCHAR: new Set(["VARCHAR", "VARCHAR(255)"]),
  DOUBLE: new Set(["DOUBLE", "FLOAT", "DECIMAL"]),
  BOOLEAN: new Set(["BOOLEAN"]),
  INTEGER: new Set(["INTEGER", "BIGINT", "SMALLINT", "TINYINT", "UINTEGER", "UBIGINT"]),
};

function tipoCompativel(esperado, real) {
  const realBase = real.split("(")[0];
  if (TIPO_EQUIV[esperado]) return TIPO_EQUIV[esperado].has(realBase) || TIPO_EQUIV[esperado].has(real);
  return esperado === real;
}

async function validarEsquemaParquet(conn, pasta, rel) {
  const esquemaParquet = lerJSON(join(CONTRATO_DIR, "parquet.schema.json"));
  const colunasPorArquivo = {};
  for (const [arquivo, def] of Object.entries(esquemaParquet.arquivos)) {
    const caminho = join(pasta, arquivo);
    if (!existsSync(caminho)) {
      if (!def.opcional) rel.falha("V1", arquivo, "arquivo obrigatório não existe");
      continue;
    }
    const colunasReais = await descreverParquet(conn, caminho);
    colunasPorArquivo[arquivo] = colunasReais;
    const porNome = new Map(colunasReais.map((c) => [c.nome, c.tipo]));
    for (const col of def.colunas) {
      const tipoReal = porNome.get(col.nome);
      if (tipoReal === undefined) {
        rel.falha("V1", arquivo, `coluna obrigatória ausente: ${col.nome}`);
        continue;
      }
      if (!tipoCompativel(col.tipo, tipoReal)) {
        rel.falha("V1", arquivo, `coluna ${col.nome}: tipo esperado ${col.tipo}, real ${tipoReal}`);
      }
    }
  }
  return colunasPorArquivo;
}

function validarV2(pasta, manifesto, rel) {
  if (!manifesto?.arquivos) return;
  for (const [relCaminho, hashEsperado] of Object.entries(manifesto.arquivos)) {
    const caminho = join(pasta, relCaminho);
    if (!existsSync(caminho)) {
      rel.falha("V2", relCaminho, "listado em manifesto.arquivos mas não existe");
      continue;
    }
    const real = sha256(caminho);
    if (real !== hashEsperado) {
      rel.falha("V2", relCaminho, `sha256 não confere (esperado ${hashEsperado}, real ${real})`);
    }
  }
}

async function validarV3(conn, pasta, manifesto, rel) {
  const caminho = join(pasta, "hex_atributos.parquet");
  if (!existsSync(caminho)) return;
  const linhas = await consultar(conn, `SELECT h3 FROM read_parquet('${caminho.replace(/\\/g, "/")}')`);
  const vistos = new Set();
  const invalidos = [];
  const resErrado = [];
  const repetidos = [];
  for (const { h3 } of linhas) {
    if (!isValidCell(h3)) invalidos.push(h3);
    else if (getResolution(h3) !== manifesto.h3_resolucao) resErrado.push(h3);
    if (vistos.has(h3)) repetidos.push(h3);
    vistos.add(h3);
  }
  if (invalidos.length) rel.falha("V3", "hex_atributos.parquet", "h3 inválido", invalidos);
  if (resErrado.length) rel.falha("V3", "hex_atributos.parquet", `h3 fora da resolução ${manifesto.h3_resolucao}`, resErrado);
  if (repetidos.length) rel.falha("V3", "hex_atributos.parquet", "h3 repetido", repetidos);
}

async function validarV4(conn, pasta, manifesto, rel) {
  const pHex = join(pasta, "hex.parquet").replace(/\\/g, "/");
  const pBase = join(pasta, "hex_base.parquet").replace(/\\/g, "/");
  const pQual = join(pasta, "hex_qualidade.parquet").replace(/\\/g, "/");
  const pAtr = join(pasta, "hex_atributos.parquet").replace(/\\/g, "/");
  if (![pHex, pBase, pQual, pAtr].every(existsSync)) return;

  const [{ n }] = await consultar(conn, `SELECT COUNT(*)::BIGINT AS n FROM read_parquet('${pAtr}')`);
  const nHex = Number(n);
  const nPeriodos = manifesto.periodos.length;
  const nComponentes = manifesto.componentes.length;

  const [{ n: nHexRows }] = await consultar(conn, `SELECT COUNT(*)::BIGINT AS n FROM read_parquet('${pHex}')`);
  const esperadoHex = nHex * nPeriodos * nComponentes;
  if (Number(nHexRows) !== esperadoHex) {
    rel.falha("V4", "hex.parquet", `esperado ${esperadoHex} linhas (n_hex×n_periodos×n_componentes), real ${nHexRows}`);
  }

  for (const [nome, caminho] of [["hex_base.parquet", pBase], ["hex_qualidade.parquet", pQual]]) {
    const [{ n: nLinhas }] = await consultar(conn, `SELECT COUNT(*)::BIGINT AS n FROM read_parquet('${caminho}')`);
    const esperado = nHex * nPeriodos;
    if (Number(nLinhas) !== esperado) {
      rel.falha("V4", nome, `esperado ${esperado} linhas (n_hex×n_periodos), real ${nLinhas}`);
    }
  }

  const foraFaixa = await consultar(
    conn,
    `SELECT h3, periodo, fracao_imputada, fracao_sigilo FROM read_parquet('${pQual}')
     WHERE (fracao_imputada IS NOT NULL AND (fracao_imputada < 0 OR fracao_imputada > 1))
        OR (fracao_sigilo IS NOT NULL AND (fracao_sigilo < 0 OR fracao_sigilo > 1))`
  );
  if (foraFaixa.length) rel.falha("V4", "hex_qualidade.parquet", "fração fora de [0,1]", foraFaixa);

  const periodo2022 = manifesto.periodos.find((p) => p.anos?.length === 1 && p.anos[0] === 2022);
  if (periodo2022) {
    const gErrado = await consultar(
      conn,
      `SELECT h3, g_estoque FROM read_parquet('${pQual}') WHERE periodo = '${periodo2022.id}' AND (g_estoque IS NULL OR g_estoque != 1)`
    );
    if (gErrado.length) rel.falha("V4", "hex_qualidade.parquet", "g_estoque deveria ser 1 em 2022", gErrado);
  }
}

function linhasNoMapa(totais, componente, periodoId) {
  return totais.totais.filter((t) => t.componente === componente && t.periodo === periodoId && t.no_mapa === true);
}

async function validarV5(conn, pasta, manifesto, totais, rel) {
  // Exatamente uma linha com no_mapa=true por componente × período.
  const combinacoes = new Set(totais.totais.map((t) => `${t.componente} ${t.periodo}`));
  for (const chave of combinacoes) {
    const [componente, periodo] = chave.split(" ");
    const linhas = linhasNoMapa(totais, componente, periodo);
    if (linhas.length !== 1) {
      rel.falha(
        "V5",
        "totais.json",
        `componente ${componente}, período ${periodo}: esperada 1 linha com no_mapa=true, encontradas ${linhas.length}`
      );
    }
  }

  const pHex = join(pasta, "hex.parquet").replace(/\\/g, "/");
  if (!existsSync(join(pasta, "hex.parquet"))) return;
  const somas = await consultar(
    conn,
    `SELECT periodo, componente, SUM(absoluto) AS soma FROM read_parquet('${pHex}') GROUP BY periodo, componente`
  );
  for (const { periodo, componente, soma } of somas) {
    const [t] = linhasNoMapa(totais, componente, periodo);
    if (!t) continue;
    const erro = Math.abs(Number(soma) - t.total) / Math.max(Math.abs(t.total), 1e-9);
    if (erro > 1e-6) {
      rel.falha("V5", "hex.parquet / totais.json", `componente ${componente}, período ${periodo}: soma ${soma} vs totais (no_mapa) ${t.total}`);
    }
  }
}

async function validarV6(conn, pasta, totais, rel) {
  const pBase = join(pasta, "hex_base.parquet").replace(/\\/g, "/");
  if (!existsSync(join(pasta, "hex_base.parquet"))) return;
  const somas = await consultar(
    conn,
    `SELECT periodo, SUM(domicilios) AS soma FROM read_parquet('${pBase}') GROUP BY periodo`
  );
  for (const { periodo, soma } of somas) {
    const d = totais.domicilios.find((x) => x.periodo === periodo);
    if (!d) continue;
    const erro = Math.abs(Number(soma) - d.total) / Math.max(Math.abs(d.total), 1e-9);
    if (erro > 1e-6) {
      rel.falha("V6", "hex_base.parquet / totais.json", `período ${periodo}: soma domicílios ${soma} vs totais ${d.total}`);
    }
  }
}

async function validarV7(conn, pasta, rel) {
  const pHex = join(pasta, "hex.parquet").replace(/\\/g, "/");
  if (!existsSync(join(pasta, "hex.parquet"))) return;
  const violacoes = await consultar(
    conn,
    `SELECT h3, periodo, componente, absoluto, minimo, maximo FROM read_parquet('${pHex}')
     WHERE (minimo IS NOT NULL AND absoluto IS NOT NULL AND minimo > absoluto)
        OR (maximo IS NOT NULL AND absoluto IS NOT NULL AND maximo < absoluto)
        OR (absoluto IS NULL AND (minimo IS NOT NULL OR maximo IS NOT NULL))`
  );
  if (violacoes.length) rel.falha("V7", "hex.parquet", "minimo <= absoluto <= maximo violado, ou faixa não nula com absoluto nulo", violacoes);
}

async function validarV8(conn, pasta, rel) {
  const pHex = join(pasta, "hex.parquet").replace(/\\/g, "/");
  const pBase = join(pasta, "hex_base.parquet").replace(/\\/g, "/");
  if (!existsSync(join(pasta, "hex.parquet")) || !existsSync(join(pasta, "hex_base.parquet"))) return;
  const linhas = await consultar(
    conn,
    `SELECT h.h3, h.periodo, h.componente, h.absoluto, h.relativo, b.domicilios
     FROM read_parquet('${pHex}') h
     JOIN read_parquet('${pBase}') b ON h.h3 = b.h3 AND h.periodo = b.periodo`
  );
  const erros = [];
  for (const l of linhas) {
    const dom = l.domicilios == null ? null : Number(l.domicilios);
    if (dom == null) {
      if (l.relativo != null) erros.push(l);
      continue;
    }
    if (dom <= 0) continue;
    const esperado = l.absoluto == null ? null : 100 * Number(l.absoluto) / dom;
    if (esperado == null) {
      if (l.relativo != null) erros.push(l);
      continue;
    }
    if (l.relativo == null || Math.abs(Number(l.relativo) - esperado) > 1e-9) erros.push(l);
  }
  if (erros.length) rel.falha("V8", "hex.parquet", "relativo != 100×absoluto÷domicilios (tolerância 1e-9)", erros);
}

async function colunasDeTodosParquet(conn, pasta, rel) {
  const arquivos = [
    "hex.parquet", "hex_base.parquet", "hex_qualidade.parquet",
    "hex_atributos.parquet", "contexto.parquet", "ap.parquet",
  ];
  for (const nome of arquivos) {
    const caminho = join(pasta, nome);
    if (!existsSync(caminho)) continue;
    const colunas = await descreverParquet(conn, caminho);
    const proibidas = colunas.filter((c) => COLUNAS_PROIBIDAS.has(c.nome.toLowerCase()));
    if (proibidas.length) {
      rel.falha("V11", nome, "coluna proibida (microdado)", proibidas.map((c) => c.nome));
    }
  }
}

function validarV9(manifesto, totais, qualidade, dados, rel) {
  const todasMarcas = [];
  for (const p of manifesto.periodos ?? []) for (const m of p.marcas ?? []) todasMarcas.push(["manifesto.periodos", m]);
  for (const t of totais?.totais ?? []) for (const m of t.marcas ?? []) todasMarcas.push(["totais.totais", m]);
  for (const mu of totais?.mudancas ?? []) for (const m of mu.marcas ?? []) todasMarcas.push(["totais.mudancas", m]);
  for (const f of qualidade?.fontes ?? []) for (const m of f.marcas ?? []) todasMarcas.push(["qualidade.fontes", m]);
  const invalidas = todasMarcas.filter(([, m]) => !MARCAS_VALIDAS.has(m));
  if (invalidas.length) {
    rel.falha("V9", "vários", "marca fora do vocabulário fechado", invalidas.map(([o, m]) => `${o}: ${m}`));
  }
}

async function validarV9Hex(conn, pasta, rel) {
  const pHex = join(pasta, "hex.parquet").replace(/\\/g, "/");
  if (!existsSync(join(pasta, "hex.parquet"))) return;
  const linhas = await consultar(conn, `SELECT DISTINCT marcas FROM read_parquet('${pHex}') WHERE marcas != ''`);
  const invalidas = [];
  for (const { marcas } of linhas) {
    for (const codigo of String(marcas).split(";")) {
      if (codigo && !MARCAS_VALIDAS.has(codigo)) invalidas.push(codigo);
    }
  }
  if (invalidas.length) rel.falha("V9", "hex.parquet", "marca fora do vocabulário fechado", invalidas);
}

async function validarV9HexAtributos(conn, pasta, manifesto, rel) {
  const pAtr = join(pasta, "hex_atributos.parquet").replace(/\\/g, "/");
  if (!existsSync(join(pasta, "hex_atributos.parquet"))) return;
  const idsValidos = new Set((manifesto.recortes ?? []).map((r) => r.id));
  const linhas = await consultar(
    conn,
    `SELECT DISTINCT recortes FROM read_parquet('${pAtr}') WHERE recortes != ''`
  );
  const idsDesconhecidos = [];
  for (const { recortes } of linhas) {
    for (const id of String(recortes).split(";")) {
      if (id && !idsValidos.has(id)) idsDesconhecidos.push(id);
    }
  }
  if (idsDesconhecidos.length) {
    rel.falha("V9", "hex_atributos.parquet", "id de recortes fora de manifesto.recortes", idsDesconhecidos);
  }

  const foraDoMinimo = await consultar(
    conn,
    `SELECT h3, n_aps, n_municipios FROM read_parquet('${pAtr}') WHERE n_aps < 1 OR n_municipios < 1`
  );
  if (foraDoMinimo.length) {
    rel.falha("V9", "hex_atributos.parquet", "n_aps ou n_municipios menor que 1", foraDoMinimo);
  }
}

async function validarV10(pasta, manifesto, modelo, rel) {
  if (manifesto.publico !== true) return;
  for (const [componente, bloco] of Object.entries(modelo ?? {})) {
    if (bloco && typeof bloco === "object" && "interno" in bloco) {
      rel.falha("V10", "modelo.json", `pacote público com chave 'interno' em ${componente}`);
    }
  }
  if (manifesto.d17_conferido !== true) {
    rel.falha("V10", "manifesto.json", "pacote público precisa declarar manifesto.d17_conferido = true");
  }
}

async function validarV12(pasta, rel) {
  const pHex = join(pasta, "hex.parquet");
  if (existsSync(pHex)) {
    const tamanho = statSync(pHex).size;
    if (tamanho > 5 * 1024 * 1024) rel.falha("V12", "hex.parquet", `${tamanho} bytes > 5 MB`);
  }
  const total = somaTamanhoPasta(pasta);
  if (total > 20 * 1024 * 1024) rel.falha("V12", pasta, `pacote inteiro ${total} bytes > 20 MB`);
}

function somaTamanhoPasta(pasta) {
  let total = 0;
  function andar(p) {
    for (const nome of readdirSync(p, { withFileTypes: true })) {
      const caminho = join(p, nome.name);
      if (nome.isDirectory()) andar(caminho);
      else total += statSync(caminho).size;
    }
  }
  andar(pasta);
  return total;
}

export async function validarPacote(pasta) {
  const rel = new Relatorio();
  if (!existsSync(pasta)) {
    rel.falha("V1", pasta, "pasta do pacote não existe");
    return rel;
  }

  const dados = await validarEsquemasJSON(pasta, rel);
  const manifesto = dados["manifesto.json"];
  if (!manifesto) {
    return rel;
  }

  // Cada passo roda isolado: um Parquet corrompido/ilegível não deve
  // interromper a checagem das demais regras.
  async function passo(regra, fn) {
    try {
      await fn();
    } catch (e) {
      rel.falha(regra, pasta, `erro ao checar: ${e.message}`);
    }
  }

  const conn = await conectarDuckDB();
  try {
    await passo("V1", () => validarEsquemaParquet(conn, pasta, rel));
    await passo("V2", () => validarV2(pasta, manifesto, rel));
    await passo("V3", () => validarV3(conn, pasta, manifesto, rel));
    await passo("V4", () => validarV4(conn, pasta, manifesto, rel));
    await passo("V5", () => validarV5(conn, pasta, manifesto, dados["totais.json"], rel));
    await passo("V6", () => validarV6(conn, pasta, dados["totais.json"], rel));
    await passo("V7", () => validarV7(conn, pasta, rel));
    await passo("V8", () => validarV8(conn, pasta, rel));
    await passo("V9", () => validarV9(manifesto, dados["totais.json"], dados["qualidade.json"], dados, rel));
    await passo("V9", () => validarV9Hex(conn, pasta, rel));
    await passo("V9", () => validarV9HexAtributos(conn, pasta, manifesto, rel));
    await passo("V10", () => validarV10(pasta, manifesto, dados["modelo.json"], rel));
    await passo("V11", () => colunasDeTodosParquet(conn, pasta, rel));
    await passo("V12", () => validarV12(pasta, rel));
  } finally {
    conn.closeSync?.();
  }

  return rel;
}

async function main() {
  const pasta = process.argv[2];
  if (!pasta) {
    console.error("Uso: node ferramentas/validar.mjs <pasta do pacote>");
    process.exit(2);
  }
  const rel = await validarPacote(pasta);
  rel.imprimir();
  process.exit(rel.ok() ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("validar.mjs")) {
  main();
}
