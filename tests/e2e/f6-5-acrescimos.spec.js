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
    await page.locator("#f1-sel-medida-qualidade").click();
    await page.locator('#f1-mq-lista .mq-opcao[data-v="cv_ap"]').click();
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

test.describe("D: (?) em cada opção do seletor de medida de qualidade", () => {
  test("cada opção tem (?) com o que mede, como se calcula e quando desconfiar", async ({ page }) => {
    await abrirResultados(page);
    await page.locator('#f1-seg-tema button[data-v="qualidade"]').click();
    await page.locator("#f1-sel-medida-qualidade").click();
    const lista = page.locator("#f1-mq-lista");
    await expect(lista).toBeVisible();
    const itens = lista.locator("li");
    const n = await itens.count();
    expect(n).toBe(7);
    for (let i = 0; i < n; i++) {
      const ajuda = itens.nth(i).locator("button.ajuda");
      await expect(ajuda).toHaveCount(1);
      const texto = await ajuda.getAttribute("data-texto");
      expect(texto).toMatch(/O que mede:/);
      expect(texto).toMatch(/Como se calcula:/);
      expect(texto).toMatch(/Quando desconfiar:/);
      // sigla só com explicação: AP, CV e IBGE aparecem por extenso na primeira vez
      for (const [sigla, extenso] of [["AP", "área de ponderação"], ["CV", "coeficiente de variação"], ["IBGE", "Instituto Brasileiro"]]) {
        const pos = texto.search(new RegExp(`\b${sigla}\b`));
        if (pos >= 0) expect(texto.slice(0, pos + 60)).toContain(extenso);
      }
    }
    // o (?) não escolhe a opção; o botão da opção escolhe
    await itens.nth(3).locator("button.ajuda").hover();
    await expect(lista).toBeVisible();
    await expect(page.locator(".ajuda-pop")).toBeVisible();
    await itens.nth(3).locator(".mq-opcao").click();
    await expect(lista).toBeHidden();
    const estado = await page.evaluate(() => window.__moradinhaEstado());
    expect(estado.medida_qualidade).toBe("cv_ap");
    await expect(page.locator("#f1-sel-medida-qualidade")).toHaveAttribute("title", /CV/);
  });

  test("teclado: Esc fecha e devolve o foco ao botão", async ({ page }) => {
    await abrirResultados(page);
    await page.locator('#f1-seg-tema button[data-v="qualidade"]').click();
    await page.locator("#f1-sel-medida-qualidade").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#f1-mq-lista")).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(page.locator("#f1-mq-lista")).toBeHidden();
    await expect(page.locator("#f1-sel-medida-qualidade")).toBeFocused();
  });
});

test.describe("E: rastreio da execução recolhido com resumo de uma linha", () => {
  test("fechado por padrão; resumo com edição, commit e nº de arquivos conferidos", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/metodologia.html${Q}`);
    const dobra = page.locator("#met-rastreio-dobra");
    await expect(dobra).toHaveCount(1);
    await expect(dobra).not.toHaveAttribute("open", "");
    const resumo = page.locator("#met-rastreio-resumo");
    await expect(resumo).toHaveText(/^edição bd10cbd · moradinha [0-9a-f]{7}… · \d+ arquivos conferidos$/, { timeout: 30000 });
    await expect(page.locator("#met-rastreio-arquivos")).toBeHidden();
    const alturaResumo = (await page.locator("#met-rastreio-dobra > summary").boundingBox()).height;
    expect(alturaResumo).toBeLessThan(32); // uma linha
    await page.locator("#met-rastreio-dobra > summary").click();
    await expect(page.locator("#met-rastreio-arquivos")).toBeVisible();
  });
});

test.describe("F1: cortina comparando componentes no mesmo período", () => {
  test("Coabitação × Ônus em 2025: dois lados rotulados, pergunta e resposta falam da comparação", async ({ page }) => {
    await abrirResultados(page, 1920, 1080);
    await page.locator('#f1-seg-comp button[data-v="coabitacao"]').click();
    await page.selectOption("#f1-sel-per", "2025");
    // as duas famílias de opção existem
    await expect(page.locator('#f1-sel-cmp optgroup[label="Outro período"] option')).not.toHaveCount(0);
    await expect(page.locator('#f1-sel-cmp optgroup[label="Outro componente, mesmo período"] option')).toHaveCount(4);
    await expect(page.locator('#f1-sel-cmp option[value="c:coabitacao"]')).toBeDisabled();
    await page.selectOption("#f1-sel-cmp", "c:onus");
    await page.waitForTimeout(600);
    await expect(page.locator("#f1-deckB")).toBeVisible();
    await expect(page.locator("#f1-labA")).toHaveText("Coabitação · 2025");
    await expect(page.locator("#f1-labB")).toHaveText("Ônus · 2025");
    await expect(page.locator("#f1-question")).toContainText("Comparado com ônus, no mesmo período");
    await expect(page.locator("#f1-ans-range")).toContainText("na cortina, Ônus");
    // trocar o componente para o mesmo da cortina desliga a cortina
    await page.locator('#f1-seg-comp button[data-v="onus"]').click();
    await page.waitForTimeout(300);
    const estado = await page.evaluate(() => window.__moradinhaEstado());
    expect(estado.comparar).toBeNull();
    await expect(page.locator("#f1-deckB")).toBeHidden();
  });

  test("comparação por período continua igual", async ({ page }) => {
    await abrirResultados(page, 1920, 1080);
    await page.selectOption("#f1-sel-per", "2025");
    await page.selectOption("#f1-sel-cmp", "2022");
    await page.waitForTimeout(500);
    await expect(page.locator("#f1-labA")).toHaveText("2025");
    await expect(page.locator("#f1-labB")).toHaveText("2022");
    await expect(page.locator("#f1-ans-range")).toContainText("contra 2022");
  });
});

test.describe("F2: correlação entre componentes por hexágono", () => {
  test("3 pares × períodos, valores entre −1 e 1, dica e clique levando o período", async ({ page }) => {
    await abrirResultados(page);
    const svg = page.locator('#f1-corr svg[data-grafico="correlacao"]');
    await svg.scrollIntoViewIfNeeded();
    const celulas = svg.locator("g[data-periodo]");
    await expect(celulas).toHaveCount(3 * 6);
    const valores = await svg.locator("g[data-periodo] text").allTextContents();
    for (const v of valores) {
      if (v === "—") continue;
      const n = Number(v.replace(",", "."));
      expect(n).toBeGreaterThanOrEqual(-1);
      expect(n).toBeLessThanOrEqual(1);
    }
    await expect(page.locator('#f1-dock-body-deficit article[data-k="corr"] header button.ajuda')).toHaveCount(1);
    await celulas.first().hover();
    await expect(page.locator(".dica-flutuante")).toContainText("Spearman");
    await expect(page.locator(".dica-flutuante")).toContainText("hexágonos");
    await svg.locator('g[data-periodo="2022"]').first().click();
    await page.waitForTimeout(300);
    expect((await page.evaluate(() => window.__moradinhaEstado())).periodo).toBe("2022");
  });

  for (const w of [1024, 1280, 1440]) {
    test(`${w}px: cinco cartões do Déficit sem rolagem lateral`, async ({ page }) => {
      await abrirResultados(page, w, 900);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
    });
  }
});
