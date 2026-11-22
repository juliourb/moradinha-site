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

test.describe("F6.1-14: o grafo mostra os 7 grupos do método, recolhidos, em ordem", () => {
  test("7 grupos aparecem; expandir um mostra as tabelas dele", async ({ page }) => {
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");

    const caixas = page.locator("#met-pipeline .no-pipeline");
    await expect(caixas).toHaveCount(7);
    const nomes = await caixas.evaluateAll((els) => els.map((e) => e.getAttribute("data-grupo")));
    expect(nomes).toEqual(["Coleta", "Grade", "Classificação", "Treino", "Montagem 2022", "Anos t", "Exportação"]);

    await caixas.nth(3).click(); // Treino
    await expect(page.locator("#met-pipeline-expandido svg")).toBeVisible();
  });
});

test.describe("F4-2: clicar num grupo leva à âncora da seção; as setas passam para o grupo seguinte", () => {
  test("clicar no grupo 'Treino' rola até o texto de Treino; seta direita vai para Montagem 2022", async ({ page }) => {
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await page.locator('#met-pipeline .no-pipeline[data-grupo="Treino"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator("#met-texto-treino")).toBeInViewport();

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    await expect(page.locator("#met-texto-montagem2022")).toBeInViewport();
  });
});

test.describe("F6.1-14: nenhuma ocorrência de 'rascunho' no site", () => {
  test("texto de abertura e os 7 blocos não têm a etiqueta de rascunho", async ({ page }) => {
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    const corpo = await page.locator("body").innerText();
    expect(corpo.toLowerCase()).not.toContain("rascunho");
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

test.describe("F6.1-14: os 54 nós aparecem ao expandir (pacote real bd10cbd)", () => {
  test("7 grupos; expandir cada um soma 54 tabelas (sem a Exportação sintética)", async ({ page }) => {
    await page.goto("/metodologia.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await page.waitForLoadState("networkidle");

    const caixas = page.locator("#met-pipeline .no-pipeline");
    await expect(caixas).toHaveCount(7);

    let total = 0;
    for (let i = 0; i < 6; i++) {
      // 6 grupos reais (exclui Exportação, que é o nó do pacote, não uma tabela)
      await caixas.nth(i).click();
      await page.waitForTimeout(150);
      total += await page.locator("#met-pipeline-expandido svg g").count();
    }
    expect(total).toBe(54);
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
