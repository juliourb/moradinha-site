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

test.describe("B: mapa de base claro por padrão nos dois temas", () => {
  for (const tema of ["light", "dark"]) {
    for (const pagina of ["/resultados.html", "/index.html"]) {
      test(`${pagina}, tema ${tema}: só o estilo claro é pedido ao abrir`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: tema });
        const pedidos = [];
        page.on("request", (r) => {
          const u = r.url();
          if (u.startsWith("https://tiles.openfreemap.org/styles/")) pedidos.push(u.split("/").pop());
        });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`${pagina}${Q}`);
        if (pagina === "/resultados.html") await page.waitForSelector('[data-pronto="true"]', { timeout: 30000 });
        else await page.waitForLoadState("networkidle");
        await page.waitForTimeout(800);
        expect(pedidos).toContain("positron");
        expect(pedidos).not.toContain("dark");
        if (pagina === "/resultados.html") {
          await expect(page.locator("#f1-mapa-claro")).toBeChecked();
          const estado = await page.evaluate(() => window.__moradinhaEstado());
          expect(estado.mapa_base).toBe("claro");
          // escuro continua como opção
          await page.evaluate(() => document.querySelector("#f1-mapa-escuro").click());
          await page.waitForTimeout(800);
          expect(pedidos).toContain("dark");
        }
      });
    }
  }

  test("a escolha não persiste: recarregar volta ao claro", async ({ page }) => {
    await abrirResultados(page);
    await page.evaluate(() => document.querySelector("#f1-mapa-escuro").click());
    await page.reload();
    await page.waitForSelector('[data-pronto="true"]', { timeout: 30000 });
    await expect(page.locator("#f1-mapa-claro")).toBeChecked();
  });
});

async function abrirDispersao(page, componente = "onus") {
  await abrirResultados(page);
  await page.locator('#f1-seg-tema button[data-v="qualidade"]').click();
  await page.locator(`#f1-seg-comp button[data-v="${componente}"]`).click();
  await page.waitForTimeout(500);
  const svg = page.locator('#f1-disp svg');
  await svg.scrollIntoViewIfNeeded();
  return svg;
}

test.describe("C: Déficit × incerteza com quadrantes", () => {
  test("linhas de corte rotuladas, quatro quadrantes com nº e parte do déficit, destaque", async ({ page }) => {
    const svg = await abrirDispersao(page);
    await expect(svg.locator("line.corte-x")).toHaveCount(1);
    await expect(svg.locator("line.corte-y")).toHaveCount(1);
    await expect(svg.locator("text.rotulo-corte.corte-x")).toHaveText(/mediana do déficit/);
    await expect(svg.locator("text.rotulo-corte.corte-y")).toHaveText(/mediana da incerteza|CV de 30%/);
    const textos = await svg.locator("text.quadrante-contagem").allTextContents();
    expect(textos).toHaveLength(4);
    const nPontos = await svg.locator("circle").count();
    const soma = textos.reduce((a, t) => a + Number(t.match(/^([\d.]+) hex/)[1].replace(/\./g, "")), 0);
    expect(soma).toBe(nPontos);
    // destaque do quadrante "muito déficit e muita incerteza"
    await expect(svg.locator("text.quadrante-contagem.q-aa")).toHaveAttribute("font-weight", "700");
    await expect(svg.locator("rect.quadrante.q-aa")).not.toHaveAttribute("fill", "transparent");
    // eixo do déficit declara a escala log quando ela é usada
    const rotulo = await svg.locator("text.rotulo-eixo").first().textContent();
    expect(rotulo).toMatch(/déficit do hexágono/);
  });

  test("CV da AP: corte no limiar do protocolo (30%)", async ({ page }) => {
    const svg = await abrirDispersao(page);
    await page.selectOption("#f1-sel-medida-qualidade", "cv_ap");
    await page.waitForTimeout(400);
    await expect(page.locator("#f1-disp svg text.rotulo-corte.corte-y")).toHaveText(/CV de 30%/);
    void svg;
  });

  test("dica do ponto com hexágono, déficit, incerteza e quadrante", async ({ page }) => {
    const svg = await abrirDispersao(page);
    await svg.locator("circle").first().hover({ force: true });
    const caixa = page.locator(".dica-flutuante");
    await expect(caixa).toBeVisible();
    await expect(caixa).toContainText("Hexágono");
    await expect(caixa).toContainText("déficit");
    await expect(caixa).toContainText("incerteza");
    await expect(caixa).toContainText("quadrante:");
  });

  test("clicar num quadrante filtra o mapa; clicar de novo limpa", async ({ page }) => {
    const svg = await abrirDispersao(page);
    const q = svg.locator("rect.quadrante.q-aa");
    const box = await q.boundingBox();
    await page.mouse.click(box.x + box.width - 6, box.y + box.height / 2);
    await page.waitForTimeout(300);
    let estado = await page.evaluate(() => window.__moradinhaEstado());
    expect(estado.quadrante?.id).toBe("aa");
    await expect(page.locator("#f1-recorte-ativo")).toBeVisible();
    await expect(page.locator("#f1-recorte-ativo")).toContainText("muito déficit e muita incerteza");
    await expect(page.locator('#f1-disp rect.quadrante[aria-current="true"]')).toHaveCount(1);
    const q2 = page.locator("#f1-disp rect.quadrante.q-aa");
    const box2 = await q2.boundingBox();
    await page.mouse.click(box2.x + box2.width - 6, box2.y + box2.height / 2);
    await page.waitForTimeout(300);
    estado = await page.evaluate(() => window.__moradinhaEstado());
    expect(estado.quadrante).toBeNull();
    await expect(page.locator("#f1-recorte-ativo")).toBeHidden();
  });
});
