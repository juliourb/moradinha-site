// SPEC_F2: validações da Visão geral (visao-geral.html).
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PASTA_RELATORIO = join(process.cwd(), "relatorios", "F2");
const PASTA_PACOTE = join(process.cwd(), "pacotes", "al_rm_maceio", "ficticio");
mkdirSync(PASTA_RELATORIO, { recursive: true });

function lerJSON(nome) {
  return JSON.parse(readFileSync(join(PASTA_PACOTE, nome), "utf8"));
}

function totalNoMapa(totais, componente, periodo) {
  const COMPONENTES = ["coabitacao", "onus", "precariedade"];
  if (componente === "total") {
    let soma = 0;
    for (const c of COMPONENTES) soma += totais.totais.find((t) => t.componente === c && t.periodo === periodo && t.no_mapa === true).total;
    return soma;
  }
  return totais.totais.find((t) => t.componente === componente && t.periodo === periodo && t.no_mapa === true).total;
}

test.describe("F2-1: todo número da página confere com o pacote (data-num)", () => {
  test("cartões BI e mensagem principal", async ({ page }) => {
    const totais = lerJSON("totais.json");
    const manifesto = lerJSON("manifesto.json");
    const ano = [...manifesto.periodos].reverse().find((p) => p.tipo === "ano").id;
    const dom = totais.domicilios.find((d) => d.periodo === ano).total;

    await page.goto("/visao-geral.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");

    for (const comp of ["total", "coabitacao", "onus", "precariedade"]) {
      const esperadoAbs = totalNoMapa(totais, comp, ano);
      const esperadoRel = (100 * esperadoAbs) / dom;
      const card = page.locator(`.cartao-bi[data-componente="${comp}"]`);
      const abs = Number(await card.locator(".v").getAttribute("data-num"));
      const rel = Number(await card.locator(".r").getAttribute("data-num"));
      expect(Math.abs(abs - esperadoAbs) / Math.max(esperadoAbs, 1e-9)).toBeLessThan(1e-6);
      expect(Math.abs(rel - esperadoRel) / Math.max(esperadoRel, 1e-9)).toBeLessThan(1e-6);
    }
  });

  test("tabela de números para citar", async ({ page }) => {
    const totais = lerJSON("totais.json");
    const manifesto = lerJSON("manifesto.json");
    const ano = [...manifesto.periodos].reverse().find((p) => p.tipo === "ano").id;

    await page.goto("/visao-geral.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");

    const esperadoTotal = totalNoMapa(totais, "total", ano);
    const valor = Number(await page.locator("#f2-citar tbody tr").first().locator("td.num").getAttribute("data-num"));
    expect(Math.abs(valor - esperadoTotal) / esperadoTotal).toBeLessThan(1e-6);
  });
});

test.describe("F2-2: FJP publicado nulo vira 'a preencher'; preenchido mostra número/fonte/link", () => {
  test("pacote de Maceió: todos os indicadores reais vêm preenchidos", async ({ page }) => {
    await page.goto("/visao-geral.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    const linhas = page.locator(".fjp-linha");
    await expect(linhas).toHaveCount(5);
    const aPreencher = page.locator(".fjp-col .v.a-preencher");
    await expect(aPreencher).toHaveCount(0);
  });

  test("pacote pequeno de teste: 'total' preenchido, os demais 'a preencher'", () => {
    const referencia = JSON.parse(readFileSync(join(process.cwd(), "pacotes", "teste_pequeno", "ficticio", "referencia_fjp.json"), "utf8"));
    const total = referencia.find((r) => r.indicador === "total");
    expect(total.fjp_publicado).not.toBeNull();
    expect(total.fjp_fonte).not.toBe("a preencher");
    expect(total.fjp_url).toBeTruthy();
    const outros = referencia.filter((r) => r.indicador !== "total");
    for (const o of outros) expect(o.fjp_publicado).toBeNull();
  });
});

test.describe("F2-3: clicar num cartão abre Resultados com o estado correto", () => {
  test("cartão de ônus leva a Resultados com componente=ônus", async ({ page }) => {
    await page.goto("/visao-geral.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await page.click('.cartao-bi[data-componente="onus"]');
    await page.waitForURL(/resultados\.html/);
    await expect(page.locator('#f1-seg-comp button[data-v="onus"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('#f1-seg-med button[data-v="absoluto"]')).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("F2-4: Copiar usa o formato exato de citação", () => {
  test("clicar em Copiar bate com o texto esperado", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "permissão de clipboard só é concedida de forma confiável no Chromium");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const manifesto = lerJSON("manifesto.json");
    const data = manifesto.data_execucao.slice(0, 10).split("-").reverse().join("/");

    await page.goto("/visao-geral.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await page.click('#f2-citar tbody tr:first-child button[data-i="0"]');
    const texto = await page.evaluate(() => navigator.clipboard.readText());
    expect(texto).toMatch(
      new RegExp(`^Déficit total, ${manifesto.nome}, .+: [\\d.]+ domicílios \\(moradinha, edição ${manifesto.edicao}, ${data.replace(/\//g, "\\/")}\\)\\.$`)
    );
  });
});

test.describe("F2-5: página inteira, claro/escuro, axe", () => {
  for (const tema of ["light", "dark"]) {
    test(`tema ${tema}: sem erro no console, captura, axe`, async ({ page }) => {
      const erros = [];
      page.on("console", (msg) => { if (msg.type() === "error") erros.push(msg.text()); });
      page.on("pageerror", (e) => erros.push(String(e)));

      await page.emulateMedia({ colorScheme: tema });
      await page.goto("/visao-geral.html?edicao=ficticio");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      expect(erros, erros.join("; ")).toEqual([]);
      await page.screenshot({ path: join(PASTA_RELATORIO, `visaogeral-${tema}.png`), fullPage: true });

      const resultado = await new AxeBuilder({ page }).analyze();
      const graves = resultado.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(graves, graves.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
    });
  }
});
