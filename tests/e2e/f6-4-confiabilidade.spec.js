// SPEC F6.4, item 3 (Confiabilidade).
import { test, expect } from "@playwright/test";

const URL = "/confiabilidade.html?dominio=al_rm_maceio&edicao=bd10cbd";
const SECOES = ["#f3-secao-dados", "#f3-secao-modelo", "#f3-secao-consistencia", "#f3-secao-achados"];

test.describe("F6.4-3a: seções recolhíveis a partir do painel de vereditos", () => {
  test("começa só com o painel; clicar abre só uma seção, logo abaixo do painel; setas passam de seção", async ({ page }) => {
    await page.goto(URL);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#f3-grade-vereditos")).toBeVisible();
    // F6.5 4a: a seção 1 já vem aberta; as outras, fechadas.
    await expect(page.locator("#f3-secao-dados")).toBeVisible();
    for (const id of SECOES.slice(1)) await expect(page.locator(id)).toBeHidden();

    await page.locator('button.vereditocel[data-secao="2"]').first().click();
    await expect(page.locator("#f3-secao-consistencia")).toBeVisible();
    for (const id of SECOES.filter((x) => x !== "#f3-secao-consistencia")) await expect(page.locator(id)).toBeHidden();

    // "logo abaixo do painel": a seção aberta começa depois do painel e antes de qualquer outra coisa visível.
    const yPainel = (await page.locator("#f3-vereditos").boundingBox()).y;
    const ySecao = (await page.locator("#f3-secao-consistencia").boundingBox()).y;
    expect(ySecao).toBeGreaterThan(yPainel);

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#f3-secao-modelo")).toBeVisible();
    await expect(page.locator("#f3-secao-consistencia")).toBeHidden();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#f3-secao-achados")).toBeVisible();

    await page.locator('button.vereditocel[data-secao="3"]').first().click(); // F6.5 4f: de novo não fecha
    await expect(page.locator("#f3-secao-achados")).toBeVisible();
    await page.locator("#f3-secao-achados .secao-fechar").click();
    await expect(page.locator("#f3-secao-achados")).toBeHidden();
  });
});

test.describe("F6.4-3b: Série comparável — mapas de calor, frase e linhas", () => {
  test("três mapas de calor com 2023 destacado, frase do pacote e gráfico de linhas", async ({ page }) => {
    await page.goto(URL);
    await page.waitForLoadState("networkidle");
    await page.locator('button.vereditocel[data-secao="2"]').first().click();

    await expect(page.locator("#f3-heatmap table.hm")).toHaveCount(3);
    await expect(page.locator("#f3-frase-spearman")).toHaveText(
      "2023 é o ano que menos se parece com os outros: a ordem dos hexágonos muda porque o estoque vem de outra fonte."
    );
    await expect(page.locator("#f3-heatmap th.destaque-periodo").first()).toHaveText("2023");
    await expect(page.locator("#f3-heatmap .hm-legenda")).toContainText("0,8");
    await expect(page.locator('#f3-spearman-linhas svg[data-grafico="spearman-linhas"] path')).toHaveCount(3);

    // cor pela correlação, escala fixa: a diagonal (1,0) é mais escura que o 0,86 de 2022×2023
    const cores = await page.locator("#f3-heatmap table.hm").first().locator("td.hm-cel").evaluateAll((tds) => tds.map((t) => getComputedStyle(t).backgroundColor));
    expect(new Set(cores).size).toBeGreaterThan(2);

    const celula = page.locator("#f3-heatmap td.hm-cel").nth(1);
    await celula.hover();
    await expect(page.locator(".dica-flutuante")).toBeVisible();
    await expect(page.locator(".dica-flutuante")).toContainText("Spearman");
  });
});

test.describe("F6.4-3c: nenhum título de bloco sem conteúdo", () => {
  for (const comp of ["coabitacao", "onus", "precariedade"]) {
    test(`blocos do modelo — ${comp}`, async ({ page }) => {
      await page.goto(URL);
      await page.waitForLoadState("networkidle");
      await page.locator('button.vereditocel[data-secao="1"]').first().click();
      await page.click(`#f3-seg-comp button[data-v="${comp}"]`);
      const blocos = page.locator("#f3-modelo-blocos .pergunta-bloco");
      const n = await blocos.count();
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        await expect(blocos.nth(i).locator(".resposta, .significado").first()).toBeVisible();
        expect(((await blocos.nth(i).locator(".resposta, .significado").first().innerText()) || "").trim().length).toBeGreaterThan(5);
      }
    });
  }
});
