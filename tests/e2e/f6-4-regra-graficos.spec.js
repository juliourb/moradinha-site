// SPEC F6.4, regra geral: em cada aba, nº de gráficos = nº de ícones (?) = nº de
// gráficos que respondem ao mouse com uma caixa de valor.
import { test, expect } from "@playwright/test";

async function conferir(page, raiz) {
  const graficos = page.locator(`${raiz} [data-grafico]:visible`);
  const ajudas = page.locator(`${raiz} .ajuda:visible`);
  const n = await graficos.count();
  expect(n).toBeGreaterThan(0);
  expect(await ajudas.count()).toBe(n);

  let respondem = 0;
  for (let i = 0; i < n; i++) {
    const g = graficos.nth(i);
    await g.scrollIntoViewIfNeeded();
    const alvo = (await g.evaluate((el) => el.classList.contains("dica-alvo"))) ? g : g.locator(".dica-alvo").nth(
          await g.locator(".dica-alvo").evaluateAll((els) => {
            let melhor = 0;
            els.forEach((e, i) => { const r = e.getBoundingClientRect(); const a = r.width * r.height; const m = els[melhor].getBoundingClientRect(); if (a > m.width * m.height) melhor = i; });
            return melhor;
          })
        );
    if ((await alvo.count()) === 0) { console.log("sem alvo:", await g.getAttribute("data-grafico")); continue; }
    await alvo.hover({ force: true });
    const caixa = page.locator(".dica-flutuante");
    if ((await caixa.isVisible()) && ((await caixa.innerText()).trim().length > 0)) respondem++;
    else console.log("sem caixa:", await g.getAttribute("data-grafico"));
    await page.mouse.move(0, 0);
  }
  expect(respondem).toBe(n);

  // cada (?) abre a dica
  await ajudas.first().hover();
  await expect(page.locator(".ajuda-pop")).toBeVisible();
  expect((await page.locator(".ajuda-pop").innerText()).trim().length).toBeGreaterThan(10);
}

test.describe("regra geral dos gráficos (pacote real)", () => {
  test("Visão geral (cartões + Detalhes)", async ({ page }) => {
    await page.goto("/visao-geral.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await page.waitForLoadState("networkidle");
    await conferir(page, "#f2-cartoes");
    await page.locator("#f2-detalhes-btn").click();
    await expect(page.locator("#f2-detalhes-backdrop")).toBeVisible();
    await conferir(page, "#f2-detalhes-dialog");
  });

  test("Resultados: Déficit, Qualidade e painel do hexágono", async ({ page }) => {
    await page.goto("/resultados.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await page.waitForSelector('[data-pronto="true"]', { timeout: 30000 });
    await page.waitForTimeout(800);
    await page.locator("#f1-rank tr").first().click();
    await page.waitForTimeout(500);
    await conferir(page, "#pane-resultados");
    await page.locator('#f1-seg-tema button[data-v="qualidade"]').click();
    await page.locator('#f1-seg-comp button[data-v="coabitacao"]').click();
    await page.waitForTimeout(800);
    await conferir(page, "#pane-resultados");
  });

  test("Confiabilidade (seções Série comparável e Lugar certo)", async ({ page }) => {
    await page.goto("/confiabilidade.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await page.waitForLoadState("networkidle");
    // F6.5 4d: gráficos E tabelas/blocos de números, em todas as seções (a 1 já vem aberta).
    for (const s of [0, 1, 2, 3]) {
      await page.locator(`button.vereditocel[data-secao="${s}"]`).first().click();
      await conferir(page, "#pane-confiabilidade");
    }
  });
});

test.describe("F6.4-4e: referências", () => {
  test("lista em 'Dados' e 'Métodos', com links e recuo francês, e as fontes pedidas", async ({ page }) => {
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    const secao = page.locator("#referencias");
    await expect(secao).toBeVisible();
    await expect(page.locator("h4", { hasText: "Dados" })).toBeVisible();
    await expect(page.locator("h4", { hasText: "Métodos" })).toBeVisible();
    const texto = await page.locator("body").innerText();
    for (const t of ["Black Marble", "Open Buildings 2.5D Temporal", "Coleção 11", "CNEFE", "Grade Estatística", "Favelas e Comunidades Urbanas", "Censo Escolar", "Mapa Social", "Lou", "Roberts", "Jenks", "OpenFreeMap", "Déficit habitacional no Brasil 2023"]) {
      expect(texto.toUpperCase()).toContain(t.toUpperCase());
    }
    const itens = page.locator(".lista-refs .ref-item");
    expect(await itens.count()).toBeGreaterThanOrEqual(18);
    expect(await itens.first().evaluate((e) => getComputedStyle(e).textIndent)).not.toBe("0px");
    // ordem alfabética dentro de cada grupo
    for (const g of await page.locator(".lista-refs").all()) {
      const ts = (await g.locator(".ref-item").allInnerTexts()).map((x) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase());
      expect(ts).toEqual([...ts].sort((a, b) => a.localeCompare(b, "pt")));
    }
    expect(await page.locator('.lista-refs a[href^="https://doi.org/"]').count()).toBeGreaterThanOrEqual(3);
  });
});
