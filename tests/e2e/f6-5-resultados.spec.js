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
    await page.locator("#f1-rank tr").first().waitFor({ timeout: 15000 });
    await page.locator("#f1-rank tr").first().click();
    await page.locator("#f1-detail dl dd").nth(1).waitFor({ timeout: 15000 });
    await page.waitForTimeout(400);
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

// F6.5-2: com "Fundo cinza" ligado a base é SEMPRE o estilo claro dessaturado.
const estilo = (cor) => JSON.stringify({ version: 8, sources: {}, layers: [{ id: "fundo", type: "background", paint: { "background-color": cor } }] });

async function luminosidadeBase(page) {
  await page.addStyleTag({ content: ".legend,.layers,.maplab,.attrib,.basefail,.divider{display:none !important}" });
  await page.waitForTimeout(800);
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
    let soma = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      if (r > b + 40) continue; // hexágonos (quentes): fora da conta da base
      soma += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; n++;
    }
    return n ? soma / n : 0;
  }, png.toString("base64"));
}

for (const tema of ["light", "dark"]) {
  test(`F6.5-2: fundo cinza ligado dá base clara (>60%) no tema ${tema}; desligado volta ao tema`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    await page.route("https://tiles.openfreemap.org/styles/dark", (r) => r.fulfill({ status: 200, contentType: "application/json", body: estilo("#101010") }));
    await page.route("https://tiles.openfreemap.org/styles/positron", (r) => r.fulfill({ status: 200, contentType: "application/json", body: estilo("#2060ff") }));
    await page.goto("/resultados.html?edicao=ficticio");
    await page.waitForSelector('[data-pronto="true"]', { timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector("#f1-mapa-cinza").click());
    expect(await luminosidadeBase(page)).toBeGreaterThan(0.6);
    await page.evaluate(() => document.querySelector("#f1-mapa-cinza").click());
    const sem = await luminosidadeBase(page);
    if (tema === "dark") expect(sem).toBeLessThan(0.3);
  });
}

// F6.5-3: cartões da Visão geral com no máximo metade da altura anterior (251 px em 1440×900).
test("F6.5-3: cartões da faixa de totais ≤ 50% da altura anterior; marcas seguem no DOM", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/index.html?dominio=al_rm_maceio&edicao=bd10cbd");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  const cartoes = page.locator(".cartao-bi");
  expect(await cartoes.count()).toBe(4);
  for (let i = 0; i < 4; i++) {
    const h = (await cartoes.nth(i).boundingBox()).height;
    expect(h).toBeLessThanOrEqual(251 * 0.5);
  }
  // número e porcentagem na mesma linha; mini-série à direita do número
  const g = await page.evaluate(() => {
    const c = document.querySelector('.cartao-bi[data-componente="total"]');
    const r = (s) => c.querySelector(s).getBoundingClientRect();
    return { v: r(".v"), pct: r(".r"), spark: r(".spark"), esp: getComputedStyle(c.querySelector(".cb-vr")).opacity };
  });
  expect(Math.abs(g.v.bottom - g.pct.bottom)).toBeLessThan(8);
  expect(g.spark.left).toBeGreaterThan(g.v.right);
  expect(g.spark.height).toBeLessThanOrEqual(32);
  expect(g.esp).toBe("1");
  // marcas: ícones no DOM, com o texto completo na dica e no nome acessível
  const marcas = page.locator(".cartao-bi .marca-ico");
  expect(await marcas.count()).toBeGreaterThan(0);
  const m = marcas.first();
  expect((await m.getAttribute("title")).length).toBeGreaterThan(8);
  expect(await m.getAttribute("aria-label")).toBe(await m.getAttribute("title"));
  await expect(page.locator("#f2-detalhes-btn")).toBeVisible();
  // mini-série mantém a dica do mouse
  await page.locator('.cartao-bi[data-componente="total"] .spark rect').nth(1).hover({ force: true });
  await expect(page.locator(".dica-flutuante")).toBeVisible();
});
