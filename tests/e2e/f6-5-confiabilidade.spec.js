// SPEC F6.5, itens 4 e 5 (Confiabilidade e destaque da seleção).
import { test, expect } from "@playwright/test";

const URL = "/confiabilidade.html?dominio=al_rm_maceio&edicao=bd10cbd";
const ABERTAS = (page) => page.locator('.panel[id^="f3-secao"]:not([hidden])');

test.describe("F6.5-4a/4f: menu das seções e fechamento", () => {
  test("a seção 1 já vem aberta, com texto visível", async ({ page }) => {
    await page.goto(URL);
    await page.waitForLoadState("networkidle");
    await expect(ABERTAS(page)).toHaveCount(1);
    await expect(page.locator("#f3-secao-dados")).toBeVisible();
    expect((await page.locator("#f3-secao-dados").innerText()).length).toBeGreaterThan(200);
  });

  test("cada item do menu abre a seção certa com texto visível; setas passam adiante", async ({ page }) => {
    await page.goto(URL);
    await page.waitForLoadState("networkidle");
    const ids = ["f3-secao-dados", "f3-secao-modelo", "f3-secao-consistencia", "f3-secao-achados"];
    for (let i = 3; i >= 0; i--) {
      await page.locator(".nav-lateral a").nth(i).click();
      await expect(ABERTAS(page)).toHaveCount(1);
      await expect(page.locator(`#${ids[i]}`)).toBeVisible();
      expect((await page.locator(`#${ids[i]}`).innerText()).length).toBeGreaterThan(100);
    }
    await page.locator(".nav-lateral a").nth(0).click();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#f3-secao-modelo")).toBeVisible();
  });

  test("clicar de novo na célula aberta não fecha; o título fecha", async ({ page }) => {
    await page.goto(URL);
    await page.waitForLoadState("networkidle");
    const cel = page.locator('button.vereditocel[data-secao="1"]').first();
    await cel.click();
    await cel.click();
    await expect(page.locator("#f3-secao-modelo")).toBeVisible();
    await page.locator("#f3-secao-modelo h2").click();
    await expect(ABERTAS(page)).toHaveCount(0);
    await cel.click();
    await page.locator("#f3-secao-modelo .secao-fechar").click();
    await expect(ABERTAS(page)).toHaveCount(0);
  });
});

test.describe("F6.5-4b/4c/4e: tabela FJP igual à da Visão geral, ponte legível, dobras em gráfico", () => {
  test("FJP: mesmas 3 colunas, sem coluna do CadÚnico; observação só em Total e Habitação precária", async ({ page }) => {
    await page.goto(URL);
    await page.waitForLoadState("networkidle");
    const f = page.locator("#f3-fjp");
    await expect(f.locator(".fjp-col .k").first()).toContainText("FJP comparável");
    const ks = (await f.locator(".fjp-col .k").allTextContents()).map((s) => s.trim());
    expect(new Set(ks)).toEqual(new Set(["FJP comparável (sem CadÚnico)", "Reconstrução do moradinha na PNADc", "Total do mapa"]));
    expect(await f.getByText("Parte do CadÚnico").count()).toBe(0);
    await expect(f.locator("text=faixa de 95%").first()).toBeVisible();
    for (const h of await f.locator(".fjp-linha").all()) {
      const nome = await h.locator("h4").innerText();
      const temObs = (await h.locator(".fjp-obs").count()) > 0;
      if (temObs) expect(["Total", "Habitação precária"]).toContain(nome);
    }
  });

  test("ponte: 'precariedade' com rótulo legível", async ({ page }) => {
    await page.goto(URL);
    await page.waitForLoadState("networkidle");
    const col = await page.locator("#f3-ponte-tabela tbody tr td:first-child").allInnerTexts();
    expect(col).not.toContain("precariedade");
    expect(col).toContain("Precariedade");
  });

  test("dobras viram gráfico com caixa de valor", async ({ page }) => {
    await page.goto(URL);
    await page.waitForLoadState("networkidle");
    await page.locator(".nav-lateral a").nth(1).click();
    const g = page.locator('[data-grafico="dobras"]');
    await expect(g).toBeVisible();
    await g.locator(".dica-alvo").first().hover({ force: true });
    await expect(page.locator(".dica-flutuante")).toContainText("dobra");
  });
});

test.describe("F6.5-5: destaque da seleção", () => {
  test("painel de vereditos e menu: exatamente 1 item com destaque depois do clique", async ({ page }) => {
    await page.goto(URL);
    await page.waitForLoadState("networkidle");
    await page.locator('button.vereditocel[data-secao="2"]').nth(1).click();
    await expect(page.locator('button.vereditocel[aria-current="true"]')).toHaveCount(1);
    await expect(page.locator('button.vereditocel[aria-current="true"]')).toHaveAttribute("data-secao", "2");
    await expect(page.locator('.nav-lateral a[aria-current="true"]')).toHaveCount(1);
    const css = await page.locator('button.vereditocel[aria-current="true"]').evaluate((e) => {
      const s = getComputedStyle(e);
      return [s.borderTopWidth, s.borderTopColor, s.backgroundColor];
    });
    expect(css[0]).toBe("2px");
  });

  test("Metodologia: 1 grupo e 1 tabela com destaque", async ({ page }) => {
    await page.goto("/metodologia.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await page.waitForLoadState("networkidle");
    await page.locator('#met-pipeline .no-pipeline[data-grupo="Treino"]').click();
    await expect(page.locator('#met-pipeline .no-pipeline[aria-current="true"]')).toHaveCount(1);
    await page.locator("#met-pipeline-expandido .no-tabela").first().click();
    await expect(page.locator('#met-pipeline-expandido .no-tabela[aria-current="true"]')).toHaveCount(1);
    await page.locator('#met-pipeline .no-pipeline[data-grupo="Grade"]').click();
    await expect(page.locator('#met-pipeline .no-pipeline[aria-current="true"]')).toHaveCount(1);
  });
});
