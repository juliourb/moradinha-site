// F0-3: "o validador morde" — corrompe uma cópia do pacote pequeno e confirma
// que o validador falha na regra certa, uma vez por regra V1–V12.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DuckDBInstance } from "@duckdb/node-api";
import { validarPacote } from "../../ferramentas/validar.mjs";

const PACOTE_ORIGINAL = join(process.cwd(), "pacotes", "teste_pequeno", "ficticio");

let pasta;

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), "moradinha-validar-"));
  cpSync(PACOTE_ORIGINAL, pasta, { recursive: true });
});

afterEach(() => {
  rmSync(pasta, { recursive: true, force: true });
});

function lerJSON(nome) {
  return JSON.parse(readFileSync(join(pasta, nome), "utf8"));
}

function escreverJSON(nome, dados) {
  writeFileSync(join(pasta, nome), JSON.stringify(dados, null, 2));
}

async function reescreverParquet(nomeArquivo, sqlSelect) {
  const instancia = await DuckDBInstance.create(":memory:");
  const conn = await instancia.connect();
  const caminho = join(pasta, nomeArquivo).replace(/\\/g, "/");
  const destino = `${caminho}.novo`;
  await conn.run(`COPY (${sqlSelect.replace(/__ORIGEM__/g, caminho)}) TO '${destino}' (FORMAT PARQUET)`);
  conn.closeSync();
  cpSync(destino, join(pasta, nomeArquivo));
  rmSync(destino);
}

async function falhas(regra) {
  const rel = await validarPacote(pasta);
  return rel.falhas.filter((f) => f.regra === regra);
}

describe("validador morde (F0-3)", () => {
  it("V1: arquivo obrigatório ausente", async () => {
    rmSync(join(pasta, "modelo.json"));
    expect(await falhas("V1")).not.toHaveLength(0);
  });

  it("V2: sha256 não confere com manifesto.arquivos", async () => {
    const caminho = join(pasta, "totais.json");
    writeFileSync(caminho, readFileSync(caminho, "utf8") + "\n");
    expect(await falhas("V2")).not.toHaveLength(0);
  });

  it("V3: h3 inválido em hex_atributos", async () => {
    await reescreverParquet(
      "hex_atributos.parquet",
      `SELECT CASE WHEN row_number() OVER () = 1 THEN 'nao_e_um_h3' ELSE h3 END AS h3,
              municipio_cod, municipio_nome, ap_cod, fcu_fracao, recortes
       FROM read_parquet('__ORIGEM__')`
    );
    expect(await falhas("V3")).not.toHaveLength(0);
  });

  it("V4: linha a mais em hex.parquet (fora de n_hex×n_periodos×n_componentes)", async () => {
    await reescreverParquet(
      "hex.parquet",
      `SELECT * FROM read_parquet('__ORIGEM__')
       UNION ALL
       SELECT * FROM read_parquet('__ORIGEM__') LIMIT 1`
    );
    expect(await falhas("V4")).not.toHaveLength(0);
  });

  it("V5: soma do absoluto não bate com totais.json", async () => {
    // Corrompe a linha de maior absoluto (nunca zero no pacote pequeno, dado
    // que vários hexágonos têm densidade/estoque zero nele).
    await reescreverParquet(
      "hex.parquet",
      `SELECT h3, periodo, componente,
              CASE WHEN row_number() OVER (ORDER BY absoluto DESC) = 1 THEN absoluto * 5 ELSE absoluto END AS absoluto,
              minimo, maximo, relativo, marcas
       FROM read_parquet('__ORIGEM__')`
    );
    expect(await falhas("V5")).not.toHaveLength(0);
  });

  it("V6: soma de domicílios não bate com totais.domicilios", async () => {
    await reescreverParquet(
      "hex_base.parquet",
      `SELECT h3, periodo,
              CASE WHEN row_number() OVER (ORDER BY domicilios DESC) = 1 THEN domicilios * 5 ELSE domicilios END AS domicilios,
              qualidade
       FROM read_parquet('__ORIGEM__')`
    );
    expect(await falhas("V6")).not.toHaveLength(0);
  });

  it("V7: minimo maior que absoluto", async () => {
    await reescreverParquet(
      "hex.parquet",
      `SELECT h3, periodo, componente, absoluto,
              CASE WHEN row_number() OVER (ORDER BY absoluto DESC) = 1 THEN absoluto * 2 + 1 ELSE minimo END AS minimo,
              maximo, relativo, marcas
       FROM read_parquet('__ORIGEM__')`
    );
    expect(await falhas("V7")).not.toHaveLength(0);
  });

  it("V8: relativo não é 100×absoluto÷domicílios", async () => {
    await reescreverParquet(
      "hex.parquet",
      `SELECT h3, periodo, componente, absoluto, minimo, maximo,
              CASE WHEN row_number() OVER (ORDER BY absoluto DESC) = 1 THEN 999.0 ELSE relativo END AS relativo,
              marcas
       FROM read_parquet('__ORIGEM__')`
    );
    expect(await falhas("V8")).not.toHaveLength(0);
  });

  it("V9: marca fora do vocabulário fechado", async () => {
    await reescreverParquet(
      "hex.parquet",
      `SELECT h3, periodo, componente, absoluto, minimo, maximo, relativo,
              CASE WHEN row_number() OVER () = 1 THEN 'codigo_inventado' ELSE marcas END AS marcas
       FROM read_parquet('__ORIGEM__')`
    );
    expect(await falhas("V9")).not.toHaveLength(0);
  });

  it("V10: 'interno' em modelo.json de pacote público", async () => {
    const modelo = lerJSON("modelo.json");
    modelo.coabitacao.interno = { r2_ap: 0.5 };
    escreverJSON("modelo.json", modelo);
    expect(await falhas("V10")).not.toHaveLength(0);
  });

  it("V11: coluna proibida (microdado) num Parquet", async () => {
    await reescreverParquet(
      "hex_atributos.parquet",
      `SELECT *, 1 AS pessoa FROM read_parquet('__ORIGEM__')`
    );
    expect(await falhas("V11")).not.toHaveLength(0);
  });

  it("V12: hex.parquet maior que 5 MB", async () => {
    // Linhas aleatórias (não repetidas) para não comprimir de volta a poucos KB.
    await reescreverParquet(
      "hex.parquet",
      `SELECT h3, periodo, componente, absoluto, minimo, maximo, relativo, marcas FROM read_parquet('__ORIGEM__')
       UNION ALL
       SELECT md5(i::VARCHAR) AS h3, '2022' AS periodo, 'coabitacao' AS componente,
              random() AS absoluto, random() AS minimo, random() AS maximo, random() AS relativo, '' AS marcas
       FROM range(300000) AS t(i)`
    );
    expect(await falhas("V12")).not.toHaveLength(0);
  });
});
