// SPEC_F4: validações da aba Metodologia.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PASTA_RELATORIO = join(process.cwd(), "relatorios", "F4");
const PASTA_PACOTE = join(process.cwd(), "pacotes", "al_rm_maceio", "ficticio");
mkdirSync(PASTA_RELATORIO, { recursive: true });

function lerJSON(nome) {
  return JSON.parse(readFileSync(join(PASTA_PACOTE, nome), "utf8"));
}

test.describe("F6.1-14: o grafo mostra os 7 grupos do método, recolhidos, em ordem", () => {
  test("7 grupos aparecem; expandir um mostra as tabelas dele", async ({ page }) => {
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");

    const caixas = page.locator("#met-pipeline .no-pipeline");
    await expect(caixas).toHaveCount(7);
    const nomes = await caixas.evaluateAll((els) => els.map((e) => e.getAttribute("data-grupo")));
    expect(nomes).toEqual(["Coleta", "Grade", "Classificação", "Treino", "Montagem 2022", "Anos t", "Exportação"]);

    await caixas.nth(3).click(); // Treino
    await expect(page.locator("#met-pipeline-expandido svg")).toBeVisible();
  });
});

test.describe("F6.4-4b/4c: clicar abre o painel (sem rolar) com síntese e explicação; as setas passam adiante", () => {
  test("grupo 'Treino': painel com síntese em destaque e explicação; a página não rola; seta direita vai a Montagem 2022", async ({ page }) => {
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    const y0 = await page.evaluate(() => window.scrollY);
    await page.locator('#met-pipeline .no-pipeline[data-grupo="Treino"]').click();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
    const painel = page.locator("#met-painel");
    await expect(painel.locator("h4")).toHaveText("Treino");
    await expect(painel.locator(".met-sintese")).not.toBeEmpty();
    await expect(painel.locator(".met-explicacao")).not.toBeEmpty();
    // os textos não ficam listados abaixo do grafo
    await expect(page.locator("#met-textos")).toBeHidden();

    await page.keyboard.press("ArrowRight");
    await expect(painel.locator("h4")).toHaveText("Montagem 2022");
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
  });

  test("clicar numa tabela mostra só o nome (sem a descrição do contrato) e não rola", async ({ page }) => {
    await page.goto("/metodologia.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await page.waitForLoadState("networkidle");
    await page.locator('#met-pipeline .no-pipeline[data-grupo="Treino"]').click();
    const y0 = await page.evaluate(() => window.scrollY);
    const tabela = page.locator("#met-pipeline-expandido .no-tabela").first();
    const nome = await tabela.locator("title").textContent();
    await tabela.click();
    await expect(page.locator("#met-painel .met-tabela-nome")).toHaveText(nome);
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
    const textoPainel = await page.locator("#met-painel").innerText();
    expect(textoPainel.length).toBeLessThan(400); // sem o texto técnico do YAML
  });
});

test.describe("F6.4-4a: subgrafo horizontal em camadas; Coleta não vira uma coluna", () => {
  test("Coleta (22 tabelas, pacote real) ocupa várias colunas e tem no máximo 6 caixas por coluna", async ({ page }) => {
    await page.goto("/metodologia.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await page.waitForLoadState("networkidle");
    await page.locator('#met-pipeline .no-pipeline[data-grupo="Coleta"]').click();
    const nos = page.locator("#met-pipeline-expandido .no-tabela");
    expect(await nos.count()).toBe(22);
    const xs = await nos.evaluateAll((els) => els.map((e) => e.getAttribute("transform")));
    const colunas = new Map();
    for (const t of xs) {
      const x = t.match(/translate\(([-\d.]+),/)[1];
      colunas.set(x, (colunas.get(x) ?? 0) + 1);
    }
    expect(colunas.size).toBeGreaterThanOrEqual(4);
    expect(Math.max(...colunas.values())).toBeLessThanOrEqual(6);
  });

  test("Montagem 2022 tem ligações desenhadas entre as tabelas, da esquerda para a direita", async ({ page }) => {
    await page.goto("/metodologia.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await page.waitForLoadState("networkidle");
    await page.locator('#met-pipeline .no-pipeline[data-grupo="Montagem 2022"]').click();
    expect(await page.locator("#met-pipeline-expandido svg path[marker-end]").count()).toBeGreaterThan(0);
  });
});

test.describe("F6.4-4c/4f: botão de download desativado; rótulo legível na tabela de parâmetros", () => {
  test("botão 'Baixar a metodologia completa' desativado com a nota", async ({ page }) => {
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    const botao = page.getByRole("button", { name: "Baixar a metodologia completa" });
    await expect(botao).toBeDisabled();
    await expect(page.locator(".met-download")).toContainText("em preparação (documento da tese)");
  });
  test("a coluna Tipo não mostra 'media'/'ano' cru", async ({ page }) => {
    await page.goto("/metodologia.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await page.waitForLoadState("networkidle");
    const celulas = await page.locator("#met-parametros table").first().locator("tbody td:nth-child(2)").allInnerTexts();
    expect(celulas).toContain("Ano");
    expect(celulas.some((c) => /^Média de \d+ anos$/.test(c))).toBe(true);
    expect(celulas).not.toContain("media");
  });
});

test.describe("F6.1-14: nenhuma ocorrência de 'rascunho' no site", () => {
  test("texto de abertura e os 7 blocos não têm a etiqueta de rascunho", async ({ page }) => {
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    const corpo = await page.locator("body").innerText();
    expect(corpo.toLowerCase()).not.toContain("rascunho");
  });
});

test.describe("F4-3: todo hash do rastreio confere com o manifesto", () => {
  test("todas as linhas da tabela de rastreio mostram a pílula 'ok'", async ({ page }) => {
    const manifesto = lerJSON("manifesto.json");
    await page.goto("/metodologia.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#met-rastreio-arquivos tbody tr")).toHaveCount(Object.keys(manifesto.arquivos).length, {
      timeout: 15000,
    });
    await expect(page.locator('#met-rastreio-arquivos [data-status="ok"]')).toHaveCount(Object.keys(manifesto.arquivos).length, {
      timeout: 20000,
    });
  });
});

test.describe("F6.1-14: os 54 nós aparecem ao expandir (pacote real bd10cbd)", () => {
  test("7 grupos; expandir cada um soma 54 tabelas (sem a Exportação sintética)", async ({ page }) => {
    await page.goto("/metodologia.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await page.waitForLoadState("networkidle");

    const caixas = page.locator("#met-pipeline .no-pipeline");
    await expect(caixas).toHaveCount(7);

    let total = 0;
    for (let i = 0; i < 6; i++) {
      // 6 grupos reais (exclui Exportação, que é o nó do pacote, não uma tabela)
      await caixas.nth(i).click();
      await page.waitForTimeout(150);
      total += await page.locator("#met-pipeline-expandido svg g").count();
    }
    expect(total).toBe(54);
  });
});

test.describe("F4-6: página inteira, claro/escuro, axe", () => {
  for (const tema of ["light", "dark"]) {
    test(`tema ${tema}: sem erro no console, captura, axe`, async ({ page }) => {
      const erros = [];
      page.on("console", (msg) => { if (msg.type() === "error") erros.push(msg.text()); });
      page.on("pageerror", (e) => erros.push(String(e)));

      await page.emulateMedia({ colorScheme: tema });
      await page.goto("/metodologia.html?edicao=ficticio");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      expect(erros, erros.join("; ")).toEqual([]);
      await page.screenshot({ path: join(PASTA_RELATORIO, `metodologia-${tema}.png`), fullPage: true });

      const resultado = await new AxeBuilder({ page }).analyze();
      const graves = resultado.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(graves, graves.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
    });
  }
});
