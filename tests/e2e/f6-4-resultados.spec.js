// SPEC F6.4, item 2 (Resultados).
import { test, expect } from "@playwright/test";

const ESTILO_AZUL = JSON.stringify({
  version: 8, sources: {}, layers: [{ id: "fundo", type: "background", paint: { "background-color": "#2060ff" } }],
});

async function aguardarMapaPronto(page) {
  await page.waitForSelector('[data-pronto="true"]', { timeout: 20000 });
}

/** Conta pixels "azuis" (base) e "quentes" (hexágonos) numa captura do mapa, sem legenda/rótulos. */
async function contarPixels(page) {
  await page.addStyleTag({ content: ".legend,.layers,.maplab,.attrib,.basefail,.divider{display:none !important}" });
  await page.waitForTimeout(600);
  const png = await page.locator("#f1-mapbox").screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let azul = 0, quente = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      if (b > r + 60) azul++;
      if (r > b + 60 && r > 150) quente++;
    }
    return { azul, quente, total: d.length / 4 };
  }, png.toString("base64"));
}

test.describe("F6.4-2a: fundo cinza dessatura só o mapa de base", () => {
  test("com o fundo azul de teste: ligado, a base fica cinza e os hexágonos mantêm cor", async ({ page }) => {
    await page.route("https://tiles.openfreemap.org/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: ESTILO_AZUL })
    );
    await page.goto("/resultados.html?edicao=ficticio");
    await aguardarMapaPronto(page);
    await page.waitForTimeout(1500);

    const antes = await contarPixels(page);
    expect(antes.azul).toBeGreaterThan(antes.total * 0.1);
    expect(antes.quente).toBeGreaterThan(50);

    await page.evaluate(() => document.querySelector("#f1-mapa-cinza").click());
    const depois = await contarPixels(page);
    expect(depois.azul).toBeLessThan(antes.azul * 0.02);
    expect(depois.quente).toBeGreaterThan(antes.quente * 0.5);
  });
});

test.describe("F6.4-2b: qualidade × incerteza do total mostra aviso com atalho", () => {
  test("aviso visível e o botão troca para um componente", async ({ page }) => {
    await page.goto("/resultados.html?edicao=ficticio");
    await aguardarMapaPronto(page);
    await page.locator('#f1-seg-tema button[data-v="qualidade"]').click();
    await page.locator("#f1-sel-medida-qualidade").selectOption("incerteza");
    await page.locator('#f1-seg-comp button[data-v="total"]').click();
    const aviso = page.locator("#f1-aviso-mapa");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("O total não tem faixa de incerteza; escolha um componente.");
    await page.locator("#f1-aviso-mapa-btn").click();
    await expect(aviso).toBeHidden();
    const estado = await page.evaluate(() => window.__moradinhaEstado());
    expect(estado.componente).not.toBe("total");
  });
});

test.describe("F6.4-2c/2d: painel do hexágono sem 'motor'; camadas recolhíveis; sem rolagem lateral", () => {
  test("texto do hexágono e painel de camadas", async ({ page }) => {
    await page.goto("/resultados.html?edicao=ficticio");
    await aguardarMapaPronto(page);
    await page.locator("#f1-rank tr").first().click();
    const detalhe = page.locator("#f1-detail");
    await expect(detalhe).not.toContainText("motor");
    await expect(detalhe).toContainText("soma do modelo nos hexágonos da AP");

    const toggle = page.locator("#f1-layers .layers-toggle");
    await expect(page.locator("#f1-layers .layers-body")).toBeVisible();
    await toggle.click();
    await expect(page.locator("#f1-layers .layers-body")).toBeHidden();
    await toggle.click();
    await expect(page.locator("#f1-layers .layers-body")).toBeVisible();
  });

  for (const w of [1024, 1280, 1440]) {
    test(`sem rolagem lateral em ${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto("/resultados.html?edicao=ficticio");
      await aguardarMapaPronto(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w + 1);
    });
  }
});
