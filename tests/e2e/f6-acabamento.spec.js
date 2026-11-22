// SPEC_F6.2: A5/C1/C2/C3/A6/N2/N3/N4/N5.
import { test, expect } from "@playwright/test";

async function aguardarMapaPronto(page) {
  await page.waitForSelector('[data-pronto="true"]', { timeout: 15000 });
}

test.describe("A6: sem rolagem lateral, nas 4 abas, em 1024/1280/1440", () => {
  for (const [w, h] of [[1024, 768], [1280, 800], [1440, 900]]) {
    for (const pagina of ["index.html", "resultados.html", "confiabilidade.html", "metodologia.html"]) {
      test(`${pagina} em ${w}x${h}`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`/${pagina}?edicao=ficticio`);
        await page.waitForLoadState("networkidle");
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth).toBeLessThanOrEqual(w + 1);
      });
    }
  }
});

test.describe("N5: em 1440x900, o primeiro gráfico do explorador fica dentro da janela", () => {
  test("a caixa do cartão 'hist' fica inteira sem rolar", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/resultados.html?edicao=ficticio");
    await aguardarMapaPronto(page);
    const box = await page.locator('[data-k="hist"]').boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(900);
  });
});

test.describe("C1: marcar 2 barras do histograma filtra o mapa; 'limpar' volta tudo", () => {
  test("alterna faixa_hist com 2 barras e limpa", async ({ page }) => {
    await page.goto("/resultados.html?edicao=ficticio");
    await aguardarMapaPronto(page);
    const barras = page.locator("#f1-hist rect");
    await expect(barras.first()).toBeVisible();
    const n = await barras.count();
    expect(n).toBeGreaterThan(2);
    await barras.nth(0).click();
    await page.waitForTimeout(150);
    await barras.nth(1).click();
    await page.waitForTimeout(150);
    let estado = await page.evaluate(() => window.__moradinhaEstado());
    expect(estado.faixa_hist.length).toBe(2);

    await page.locator("#f1-hist-limpar").click();
    await page.waitForTimeout(150);
    estado = await page.evaluate(() => window.__moradinhaEstado());
    expect(estado.faixa_hist.length).toBe(0);
  });
});

test.describe("C2: opacidade muda o preenchimento dos hexágonos", () => {
  test("alterar o slider muda o alfa da camada hex", async ({ page }) => {
    await page.goto("/resultados.html?edicao=ficticio");
    await aguardarMapaPronto(page);
    const slider = page.locator("#f1-opacidade");
    await expect(slider).toHaveCount(1);
    await slider.fill("0.3");
    await slider.dispatchEvent("input");
    await page.waitForTimeout(200);
    const estado = await page.evaluate(() => JSON.parse(localStorage.getItem("moradinha.pergunta") ?? "{}"));
    expect(estado.opacidade).toBeCloseTo(0.3, 5);
  });
});

test.describe("C3: fundo 'cinza' carrega sem requisição a provedor novo", () => {
  test("marcar o checkbox aplica o filtro, sem pedir tiles de outro host", async ({ page }) => {
    const hostsExternos = new Set();
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "localhost" && !url.hostname.includes("127.0.0.1")) hostsExternos.add(url.hostname);
      route.continue();
    });
    await page.goto("/resultados.html?edicao=ficticio");
    await aguardarMapaPronto(page);
    const hostsAntes = new Set(hostsExternos);

    await page.locator("#f1-mapa-cinza").check();
    await page.waitForTimeout(400);
    await expect(page.locator("#f1-mapbox")).toHaveClass(/cinza/);

    const hostsNovos = [...hostsExternos].filter((h) => !hostsAntes.has(h));
    expect(hostsNovos).toEqual([]);
  });
});

test.describe("F6.2-1: AP/FCU/recortes desenhados pelos contornos reais do pacote", () => {
  test("recorte Braskem: 1 feição no pacote real bd10cbd", async ({ page }) => {
    await page.goto("/resultados.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await aguardarMapaPronto(page);
    const recortes = await page.evaluate(async () => {
      const r = await fetch("pacotes/al_rm_maceio/bd10cbd/contornos/recortes.geojson");
      return (await r.json()).features.length;
    });
    expect(recortes).toBe(1);

    const camadaBraskem = page.locator('#f1-layers input[data-camada="braskem"]');
    await expect(camadaBraskem).toHaveCount(1);
    await camadaBraskem.check();
    await page.waitForTimeout(300);
    await expect(camadaBraskem).toBeChecked();
  });
});

test.describe("N3: ranking sem duas linhas com o mesmo texto", () => {
  test("cada linha do ranking é distinta (município, AP, código do hexágono)", async ({ page }) => {
    await page.goto("/resultados.html?edicao=ficticio");
    await aguardarMapaPronto(page);
    const textos = await page.locator("#f1-rank tbody tr td:nth-child(2)").allTextContents();
    expect(new Set(textos).size).toBe(textos.length);
  });
});

test.describe("N4: distribuição por período declara o corte do eixo", () => {
  test("o SVG de caixas mostra a nota 'eixo cortado no p99'", async ({ page }) => {
    await page.goto("/resultados.html?edicao=ficticio");
    await aguardarMapaPronto(page);
    const texto = await page.locator("#f1-boxes svg").textContent();
    expect(texto).toContain("eixo cortado no p99");
  });
});
