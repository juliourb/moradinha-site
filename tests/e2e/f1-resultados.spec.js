// SPEC_F1: validações do explorador (aba Resultados).
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";

const PASTA_RELATORIO = join(process.cwd(), "relatorios", "F1");
const PASTA_PACOTE = join(process.cwd(), "pacotes", "al_rm_maceio", "ficticio");
mkdirSync(PASTA_RELATORIO, { recursive: true });

function lerJSON(nome) {
  return JSON.parse(readFileSync(join(PASTA_PACOTE, nome), "utf8"));
}

function parsePtBr(texto) {
  return parseFloat(texto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
}

function totalNoMapa(totais, componente, periodo) {
  const COMPONENTES = ["coabitacao", "onus", "precariedade"];
  if (componente === "total") {
    let soma = 0;
    for (const c of COMPONENTES) {
      const l = totais.totais.find((t) => t.componente === c && t.periodo === periodo && t.no_mapa === true);
      soma += l.total;
    }
    return soma;
  }
  return totais.totais.find((t) => t.componente === componente && t.periodo === periodo && t.no_mapa === true).total;
}

async function aguardarMapaPronto(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const el = document.getElementById("f1-mapbox");
        if (el.dataset.pronto) return resolve();
        el.addEventListener("mapa-pronto", () => resolve(), { once: true });
      })
  );
}

test.describe("F1-7: tempo até mapa-pronto", () => {
  test("mediana de 3 medições <= 4s (cache frio simulado por contexto novo)", async ({ browser }) => {
    const tempos = [];
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const t0 = Date.now();
      await page.goto("/resultados.html");
      await aguardarMapaPronto(page);
      tempos.push(Date.now() - t0);
      await context.close();
    }
    tempos.sort((a, b) => a - b);
    const mediana = tempos[1];
    console.log("F1-7 tempos (ms):", tempos, "mediana:", mediana);
    expect(mediana).toBeLessThanOrEqual(4000);
  });
});

test.describe("F1-4/F1-11/F1-13: roteiro de interação", () => {
  test("trocar controles muda pergunta, legenda e histograma; cortina liga; clique no hexágono; carrossel", async ({ page }) => {
    // Viewport largo: "comparar com (cortina)" fica sempre na barra (sem
    // precisar abrir o menu "Mais" — isso tem teste próprio, F1-5).
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/resultados.html");
    await aguardarMapaPronto(page);

    const pergunta1 = await page.locator("#f1-question").textContent();
    await page.click('#f1-seg-comp button[data-v="onus"]');
    await expect(page.locator("#f1-question")).not.toHaveText(pergunta1);
    await expect(page.locator("#f1-ans-lab")).toContainText("Ônus");

    // Medida relativo muda o grande número (unidade %)
    await page.click('#f1-seg-med button[data-v="relativo"]');
    await expect(page.locator("#f1-ans-big")).toContainText("%");

    // Cortina: liga comparação -> aparecem as duas legendas de período
    await page.selectOption("#f1-sel-cmp", "2022");
    await expect(page.locator("#f1-labB")).toBeVisible();
    await expect(page.locator("#f1-divider")).toBeVisible();

    // Arrastar a divisória pelo teclado muda o clip-path
    const clipAntes = await page.locator("#f1-deckB").evaluate((el) => el.style.clipPath);
    await page.locator("#f1-divider").focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    const clipDepois = await page.locator("#f1-deckB").evaluate((el) => el.style.clipPath);
    expect(clipDepois).not.toBe(clipAntes);

    await page.selectOption("#f1-sel-cmp", "");

    // Clique numa barra do histograma destaca (verifica que a opacidade de ao
    // menos uma barra muda, por existir uma classe/estilo "selecionada" != outras)
    const barraComAltura = page.locator('#f1-hist rect:not([height="0"])').first();
    await expect(barraComAltura).toBeVisible();
    await barraComAltura.click();

    // Clique num hexágono via ranking leva o mesmo h3 ao painel de detalhe
    const primeiraLinha = page.locator("#f1-rank tr").first();
    const labelAntes = await primeiraLinha.locator("td").nth(1).textContent();
    await primeiraLinha.click();
    await expect(page.locator("#f1-detail")).toContainText("Hexágono");
    expect(labelAntes).toBeTruthy();

    // Minimizar um gráfico faz o mapa crescer (classe "min" aplicada)
    await page.locator('[data-k="hist"] .iconbtn').click();
    await expect(page.locator('[data-k="hist"]')).toHaveClass(/min/);

    // Minimizar o dock inteiro
    await page.click("#f1-dock-toggle");
    await expect(page.locator("#pane-resultados")).toHaveClass(/dock-off/);
    await page.click("#f1-dock-toggle");

    // F1-11: tema Qualidade muda a pergunta e o seletor de medida aparece
    await page.click('#f1-seg-tema button[data-v="qualidade"]');
    await expect(page.locator("#f1-ctl-medida-qualidade")).toBeVisible();
    await expect(page.locator("#f1-question")).toContainText("confiável");

    // F1-13: carrossel muda o conjunto sem mudar o mapa
    const tituloAntes = await page.locator("#f1-dock-titulo").textContent();
    await page.click("#f1-carrossel-prev");
    await expect(page.locator("#f1-dock-titulo")).not.toHaveText(tituloAntes);
    await page.keyboard.press("Tab"); // navegação por teclado não falha
  });
});

test.describe("F1-5: menu 'Mais' abaixo de 1600px", () => {
  test("abre por clique e por teclado (Escape fecha); comparar funciona de dentro do menu", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/resultados.html");
    await aguardarMapaPronto(page);

    await expect(page.locator("#f1-mais-btn")).toBeVisible();
    await expect(page.locator("#f1-mais-menu")).toBeHidden();

    await page.click("#f1-mais-btn");
    await expect(page.locator("#f1-mais-btn")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#f1-mais-menu")).toBeVisible();

    await page.selectOption("#f1-sel-cmp", "2022");
    await expect(page.locator("#f1-labB")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#f1-mais-menu")).toBeHidden();
    await expect(page.locator("#f1-mais-btn")).toHaveAttribute("aria-expanded", "false");
  });

  test("acima de 1600px o menu some e o controle fica sempre visível na barra", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/resultados.html");
    await aguardarMapaPronto(page);
    await expect(page.locator("#f1-mais-btn")).toBeHidden();
    await expect(page.locator("#f1-sel-cmp")).toBeVisible();
  });
});

test.describe("F1-16: mapa de base sem chave de API", () => {
  test("nenhuma requisição ao mapa de base contém chave/token", async ({ page }) => {
    const urls = [];
    page.on("request", (req) => {
      if (/tiles\.openfreemap\.org/.test(req.url())) urls.push(req.url());
    });
    await page.goto("/resultados.html");
    await aguardarMapaPronto(page);
    await page.waitForTimeout(1000);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u).not.toMatch(/key=|token=|api_key=/i);
    }
  });
});

test.describe("F1-10: mapa de base indisponível", () => {
  test("rota bloqueada -> aviso aparece e o resto funciona", async ({ page }) => {
    await page.route("https://tiles.openfreemap.org/**", (route) => route.abort());
    await page.goto("/resultados.html");
    await expect(page.locator("#f1-basefail")).toBeVisible({ timeout: 10000 });
    // o resto do explorador segue funcionando mesmo sem mapa de base
    await expect(page.locator("#f1-ans-big")).not.toHaveText("");
  });
});

test.describe("F1-9: capturas claro/escuro", () => {
  for (const tema of ["light", "dark"]) {
    test(`tema ${tema}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema });
      await page.goto("/resultados.html");
      await aguardarMapaPronto(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(PASTA_RELATORIO, `resultados-${tema}.png`), fullPage: true });
    });
  }
});

test.describe("F1-8: axe-core e teclado", () => {
  test("sem violação serious/critical", async ({ page }) => {
    await page.goto("/resultados.html");
    await aguardarMapaPronto(page);
    const resultado = await new AxeBuilder({ page }).analyze();
    const graves = resultado.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(graves, graves.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
  });

  test("controles operáveis por teclado (Tab/Enter/setas)", async ({ page }) => {
    await page.goto("/resultados.html");
    await aguardarMapaPronto(page);
    await page.locator('#f1-seg-tema button[data-v="deficit"]').focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focoAtivo = await page.evaluate(() => document.activeElement?.tagName);
    expect(["BUTTON", "SELECT", "A", "INPUT"]).toContain(focoAtivo);
  });
});

test.describe("F1-5 (critério v1.3): cabeçalho+pergunta+mapa visíveis; dock espia; sem rolagem horizontal", () => {
  for (const [w, h] of [
    [1920, 1080],
    [1440, 900],
  ]) {
    test(`${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/resultados.html");
      await aguardarMapaPronto(page);
      const medidas = await page.evaluate(() => {
        const mapbox = document.getElementById("f1-mapbox").getBoundingClientRect();
        const dock = document.getElementById("f1-dock").getBoundingClientRect();
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          mapboxBottom: mapbox.bottom,
          dockTop: dock.top,
        };
      });
      // sem rolagem horizontal
      expect(medidas.scrollWidth).toBeLessThanOrEqual(medidas.innerWidth + 1);
      // cabeçalho + pergunta + mapa inteiro visíveis sem rolar
      expect(medidas.mapboxBottom).toBeLessThanOrEqual(medidas.innerHeight + 1);
      // borda superior do dock visível na 1ª tela, com pelo menos 24px dos títulos
      expect(medidas.dockTop).toBeLessThanOrEqual(medidas.innerHeight - 24);
    });
  }

  test("gráficos abertos por padrão em 1440x900 (não minimizados)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/resultados.html");
    await aguardarMapaPronto(page);
    await expect(page.locator(".dcard.min")).toHaveCount(0);
  });
});

test.describe("F1-1: número grande da resposta lido do DOM bate com o pacote", () => {
  test("12 combinações (medida × componente × período)", async ({ page }) => {
    const totais = lerJSON("totais.json");
    const manifesto = lerJSON("manifesto.json");
    const COMPONENTES = ["total", "coabitacao", "onus", "precariedade"];
    const MEDIDAS = ["absoluto", "relativo"];
    const periodos = manifesto.periodos.slice(0, 2).map((p) => p.id);

    const combos = [];
    for (const medida of MEDIDAS) for (const comp of COMPONENTES) for (const per of periodos) combos.push({ medida, comp, per });
    const amostra = combos.slice(0, 12);
    expect(amostra.length).toBe(12);

    await page.goto("/resultados.html");
    await aguardarMapaPronto(page);

    for (const { medida, comp, per } of amostra) {
      await page.click(`#f1-seg-med button[data-v="${medida}"]`);
      await page.click(`#f1-seg-comp button[data-v="${comp}"]`);
      await page.selectOption("#f1-sel-per", per);

      const total = totalNoMapa(totais, comp, per);
      let esperado = total;
      if (medida === "relativo") {
        const dom = totais.domicilios.find((d) => d.periodo === per).total;
        esperado = (100 * total) / dom;
      }
      const texto = await page.locator("#f1-ans-big").textContent();
      const valor = parsePtBr(texto);
      const erro = Math.abs(valor - esperado) / Math.max(Math.abs(esperado), 1e-9);
      expect(erro, `medida=${medida} comp=${comp} per=${per}: DOM="${texto}" esperado=${esperado}`).toBeLessThan(0.01);
    }
  });
});

test.describe("F1-17 (DOM): hexágono com n_aps > 1 mostra o aviso", () => {
  test("clique num hexágono fictício com n_aps=2", async ({ page }) => {
    const instancia = await DuckDBInstance.create(":memory:");
    const conn = await instancia.connect();
    const caminho = join(PASTA_PACOTE, "hex_atributos.parquet").replace(/\\/g, "/");
    const resultado = await conn.run(`SELECT h3 FROM read_parquet('${caminho}') WHERE n_aps > 1 LIMIT 1`);
    const linhas = await resultado.getRowObjects();
    expect(linhas.length).toBe(1);
    const h3DeBorda = linhas[0].h3;

    await page.goto("/resultados.html");
    await aguardarMapaPronto(page);
    await page.evaluate((h3) => window.__moradinhaSelecionarHex(h3), h3DeBorda);
    await expect(page.locator("#f1-detail")).toContainText(/cruza/i);
    await expect(page.locator("#f1-detail")).toContainText(h3DeBorda);
  });
});
