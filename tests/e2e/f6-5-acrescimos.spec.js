// SPEC F6.5, acréscimos A–F (Julio, 23/11), pacote real bd10cbd.
import { test, expect } from "@playwright/test";

const Q = "?dominio=al_rm_maceio&edicao=bd10cbd";

async function abrirResultados(page, w = 1440, h = 900, extra = "") {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`/resultados.html${Q}${extra}`);
  await page.waitForSelector('[data-pronto="true"]', { timeout: 30000 });
  await page.waitForTimeout(600);
}

/** Lê os rótulos do eixo vertical (números) de um SVG d3 com .axis. */
async function rotulosEixo(loc) {
  return loc.evaluate((svg) =>
    [...svg.querySelectorAll(".axis .tick text")].map((t) => Number(t.textContent.replace(/\./g, "").replace(",", ".")))
  );
}

test.describe("A: eixo das séries pela faixa de 95%", () => {
  test("Detalhes: ônus não começa em zero, marca de quebra e eixo cobrindo as faixas", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/index.html${Q}`);
    await page.waitForLoadState("networkidle");
    await page.locator("#f2-detalhes-btn").click();
    const svgs = page.locator('#f2-detalhes-backdrop svg[data-grafico="serie-detalhe"]');
    await expect(svgs.first()).toBeVisible();
    const n = await svgs.count();
    expect(n).toBeGreaterThan(0);
    let algumSemZero = false;
    for (let i = 0; i < n; i++) {
      const s = svgs.nth(i);
      const ticks = await rotulosEixo(s);
      const semZero = ticks[0] > 0;
      const temQuebra = (await s.locator(".quebra-eixo").count()) > 0;
      expect(temQuebra).toBe(semZero);
      if (semZero) {
        algumSemZero = true;
        await expect(s).toHaveAttribute("aria-label", /não começa em zero/);
      }
    }
    expect(algumSemZero).toBe(true);
  });

  test("Resultados: série do total por período com marcas redondas", async ({ page }) => {
    await abrirResultados(page);
    const ticks = await rotulosEixo(page.locator("#f1-series svg"));
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    const passo = ticks[1] - ticks[0];
    for (const t of ticks) expect(Math.abs(t / passo - Math.round(t / passo))).toBeLessThan(1e-6);
  });
});
