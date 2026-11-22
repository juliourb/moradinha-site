// SPEC_F6 B2/F6.1-15: todo gráfico do site tem uma dica "o que mede/como
// ler", visível sem clique, logo abaixo do título. Conta gráficos (cartões
// do dock, blocos do modelo e as duas seções com SVG na Confiabilidade,
// painéis do pop-up "Detalhes") contra as dicas correspondentes.
import { test, expect } from "@playwright/test";

test.describe("F6.1-15: Resultados — cada cartão do dock tem a dica visível", () => {
  test("8 cartões, 8 dicas, sem precisar de clique/hover", async ({ page }) => {
    await page.goto("/resultados.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");

    const cartoes = page.locator(".dcard");
    const nCartoes = await cartoes.count();
    expect(nCartoes).toBeGreaterThanOrEqual(8);

    for (let i = 0; i < nCartoes; i++) {
      const dica = cartoes.nth(i).locator(".grafico-dica");
      await expect(dica).toHaveCount(1);
      expect((await dica.textContent())?.trim().length).toBeGreaterThan(0);
    }
    // O conjunto "Déficit" é o visível por padrão; suas dicas devem estar visíveis sem clique/hover.
    const dicasVisiveis = page.locator("#f1-dock-body-deficit .dcard .grafico-dica");
    for (let i = 0; i < (await dicasVisiveis.count()); i++) {
      await expect(dicasVisiveis.nth(i)).toBeVisible();
    }

    // Visível sem clique: nenhuma dica depende de title/hover.
    const titulosComTitle = await page.locator(".dcard h3[title]").count();
    expect(titulosComTitle).toBe(0);
  });
});

test.describe("F6.1-15: Confiabilidade — gráficos têm dica visível", () => {
  test("heatmap, razões e blocos do modelo (via 'significado')", async ({ page }) => {
    await page.goto("/confiabilidade.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("#f3-secao-consistencia .grafico-dica")).toHaveCount(2);

    const blocos = page.locator("#f3-modelo-blocos .pergunta-bloco");
    const nBlocos = await blocos.count();
    expect(nBlocos).toBeGreaterThan(0);
    for (let i = 0; i < nBlocos; i++) {
      const significado = blocos.nth(i).locator(".significado");
      await expect(significado).toHaveCount(1);
      expect((await significado.textContent())?.trim().length).toBeGreaterThan(0);
    }
  });
});

test.describe("F6.1-15: Visão geral — pop-up Detalhes tem dicas visíveis", () => {
  test("grade de painéis e curva de concentração", async ({ page }) => {
    await page.goto("/index.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await page.locator("#f2-detalhes-btn").click();
    await expect(page.locator("#f2-detalhes-backdrop")).toBeVisible();

    const dicas = page.locator("#f2-detalhes-dialog .como-ler");
    expect(await dicas.count()).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < (await dicas.count()); i++) {
      await expect(dicas.nth(i)).toBeVisible();
    }
  });
});

test.describe("F6.1-15: Metodologia — grafo tem dica visível", () => {
  test("o grafo de grupos tem a explicação de como interagir", async ({ page }) => {
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#met-pipeline").locator("xpath=preceding-sibling::div[contains(@class,'como-ler')][1]")).toBeVisible();
  });
});
