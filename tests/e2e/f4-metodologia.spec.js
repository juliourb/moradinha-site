// SPEC_F4: validações da aba Metodologia.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PASTA_RELATORIO = join(process.cwd(), "relatorios", "F4");
const PASTA_PACOTE = join(process.cwd(), "pacotes", "al_rm_maceio", "ficticio");
mkdirSync(PASTA_RELATORIO, { recursive: true });

function lerJSON(nome) {
  return JSON.parse(readFileSync(join(PASTA_PACOTE, nome), "utf8"));
}

test.describe("F4-1: o grafo tem exatamente as etapas e ligações do pipeline.json", () => {
  test("contagem e nomes das caixas batem com o pacote", async ({ page }) => {
    const pipeline = lerJSON("pipeline.json");
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");

    const caixas = page.locator("#met-pipeline .no-pipeline");
    await expect(caixas).toHaveCount(pipeline.etapas.length);

    const nomes = await caixas.evaluateAll((els) => els.map((e) => e.getAttribute("data-etapa")));
    expect(new Set(nomes)).toEqual(new Set(pipeline.etapas.map((e) => e.id)));

    const ligacoes = await page.locator("#met-pipeline path").count();
    expect(ligacoes).toBe(pipeline.ligacoes.length);
  });
});

test.describe("F4-2: clicar numa etapa leva à âncora da seção", () => {
  test("clicar na caixa 'treino' rola até o texto de Treino", async ({ page }) => {
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await page.locator('#met-pipeline .no-pipeline[data-etapa="treino"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator("#met-texto-treino")).toBeInViewport();
  });
});

test.describe("F4-3: todo hash do rastreio confere com o manifesto", () => {
  test("todas as linhas da tabela de rastreio mostram a pílula 'ok'", async ({ page }) => {
    const manifesto = lerJSON("manifesto.json");
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#met-rastreio-arquivos tbody tr")).toHaveCount(Object.keys(manifesto.arquivos).length, {
      timeout: 15000,
    });
    await expect(page.locator('#met-rastreio-arquivos [data-status="ok"]')).toHaveCount(Object.keys(manifesto.arquivos).length, {
      timeout: 20000,
    });
  });
});

test.describe("F4-6: página inteira, claro/escuro, axe", () => {
  for (const tema of ["light", "dark"]) {
    test(`tema ${tema}: sem erro no console, captura, axe`, async ({ page }) => {
      const erros = [];
      page.on("console", (msg) => { if (msg.type() === "error") erros.push(msg.text()); });
      page.on("pageerror", (e) => erros.push(String(e)));

      await page.emulateMedia({ colorScheme: tema });
      await page.goto("/metodologia.html?edicao=ficticio");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      expect(erros, erros.join("; ")).toEqual([]);
      await page.screenshot({ path: join(PASTA_RELATORIO, `metodologia-${tema}.png`), fullPage: true });

      const resultado = await new AxeBuilder({ page }).analyze();
      const graves = resultado.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(graves, graves.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
    });
  }
});
