// SPEC F6.5, item 1 (Resultados).
import { test, expect } from "@playwright/test";

const URL = "/resultados.html?dominio=al_rm_maceio&edicao=bd10cbd";
async function abrir(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(URL);
  await page.waitForSelector('[data-pronto="true"]', { timeout: 30000 });
  await page.waitForTimeout(600);
}

test.describe("F6.5-1a: seletores de qualidade e de cortina na mesma linha", () => {
  for (const w of [1280, 1440]) {
    test(`${w}px: mesmo offsetTop e sem rolagem lateral`, async ({ page }) => {
      await abrir(page, w, 900);
      await page.locator('#f1-seg-tema button[data-v="qualidade"]').click();
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({
        a: document.getElementById("f1-sel-medida-qualidade").offsetTop + document.getElementById("f1-ctl-medida-qualidade").offsetTop,
        b: document.getElementById("f1-sel-cmp").offsetTop + document.getElementById("f1-ctl-comparar").offsetTop,
        ya: document.getElementById("f1-sel-medida-qualidade").getBoundingClientRect().top,
        yb: document.getElementById("f1-sel-cmp").getBoundingClientRect().top,
        sw: document.documentElement.scrollWidth,
      }));
      expect(Math.abs(r.ya - r.yb)).toBeLessThan(2);
      expect(r.sw).toBeLessThanOrEqual(w);
      await expect(page.locator("#f1-sel-medida-qualidade")).toHaveAttribute("title", /.{10,}/);
    });
  }
  test("1024px: sem rolagem lateral", async ({ page }) => {
    await abrir(page, 1024, 800);
    await page.locator('#f1-seg-tema button[data-v="qualidade"]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
  });
});

test.describe("F6.5-1b/1c: coluna à direita", () => {
  test("1440×900: título 'Hexágono' e as duas primeiras linhas visíveis sem rolar a coluna", async ({ page }) => {
    await abrir(page, 1440, 900);
    await page.locator("#f1-rank tr").first().click();
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const lado = document.querySelector(".side");
      const base = lado.getBoundingClientRect().bottom;
      const h2 = document.querySelector("#f1-detail h2").getBoundingClientRect().bottom;
      const dds = document.querySelectorAll("#f1-detail dl dd");
      return { rolou: lado.scrollTop, base, h2, linha2: dds[1].getBoundingClientRect().bottom };
    });
    expect(r.rolou).toBe(0);
    expect(r.h2).toBeLessThanOrEqual(r.base);
    expect(r.linha2).toBeLessThanOrEqual(r.base);
  });

  test("a frase do total sem faixa aparece uma só vez, e não como marca", async ({ page }) => {
    await abrir(page, 1440, 900);
    const corpo = await page.locator(".answer").innerText();
    expect(corpo.split("não tem faixa").length - 1).toBe(1);
    await expect(page.locator("#f1-ans-pills .pill", { hasText: "não tem faixa" })).toHaveCount(0);
  });
});
