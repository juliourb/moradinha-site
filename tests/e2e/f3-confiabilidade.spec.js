// SPEC_F3: validações da aba Confiabilidade.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PASTA_RELATORIO = join(process.cwd(), "relatorios", "F3");
const PASTA_PACOTE = join(process.cwd(), "pacotes", "al_rm_maceio", "ficticio");
mkdirSync(PASTA_RELATORIO, { recursive: true });

function lerJSON(nome) {
  return JSON.parse(readFileSync(join(PASTA_PACOTE, nome), "utf8"));
}

test.describe("F3-1: números da aba conferem com o pacote (data-num)", () => {
  test("sigilo, APs e ponte", async ({ page }) => {
    const qualidade = lerJSON("qualidade.json");
    await page.goto("/confiabilidade.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");

    const semDado = Number(await page.locator("#f3-sigilo-cartoes .cartao-f3 .v").first().getAttribute("data-num"));
    expect(semDado).toBe(qualidade.sigilo.hex_sem_dado);

    const primeiraAp = qualidade.aps[0];
    const apsNum = Number(await page.locator("#f3-aps-cartoes .cartao-f3 .v").first().getAttribute("data-num"));
    expect(apsNum).toBe(primeiraAp.n_aps);

    const primeiraPonte = qualidade.ponte[0];
    const ponteNum = await page.locator("#f3-ponte-tabela tbody tr").first().locator("td").nth(1).getAttribute("data-num");
    expect(Number(ponteNum)).toBeCloseTo(primeiraPonte.pnadc, 6);
  });
});

test.describe("F3-2: 'interno' nunca aparece no HTML gerado", () => {
  test("nenhum traço de R²/interno na página renderizada", async ({ page }) => {
    await page.goto("/confiabilidade.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    const html = await page.content();
    expect(html).not.toMatch(/r2_ap|"interno"/i);
  });
});

test.describe("F3-3: blocos do modelo têm título-pergunta e significado", () => {
  test("os 6 blocos aparecem para o componente padrão (coabitação)", async ({ page }) => {
    await page.goto("/confiabilidade.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    const titulos = ["O modelo ajuda?", "Acha onde está?", "Erra o tamanho?", "Erra para quem?", "Por quê?", "Quanto confiar nesses números?"];
    for (const t of titulos) {
      await expect(page.locator("#f3-modelo-blocos")).toContainText(t);
    }
    await expect(page.locator("#f3-modelo-blocos .significado").first()).not.toBeEmpty();
  });
});

test.describe("F3-4: componente com usado=false mostra só a mensagem própria", () => {
  test("precariedade não mostra os blocos de pergunta nem curvas", async ({ page }) => {
    await page.goto("/confiabilidade.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await page.locator('button.vereditocel[data-secao="1"]').first().click();
    await page.click('#f3-seg-comp button[data-v="precariedade"]');
    await expect(page.locator("#f3-modelo-blocos")).not.toContainText("O modelo ajuda?");
    await expect(page.locator("#f3-modelo-blocos svg")).toHaveCount(0);
  });
});

test.describe("F3-5: razões por hexágono não têm eixo dominado por extremos", () => {
  test("os SVGs de razões existem e têm viewBox finito", async ({ page }) => {
    await page.goto("/confiabilidade.html?edicao=ficticio");
    await page.waitForLoadState("networkidle");
    const viewBoxes = await page.locator("#f3-razoes svg").evaluateAll((els) => els.map((e) => e.getAttribute("viewBox")));
    expect(viewBoxes.length).toBeGreaterThan(0);
    for (const vb of viewBoxes) {
      const [, , , h] = vb.split(" ").map(Number);
      expect(h).toBeLessThan(200); // nunca estica pra caber um outlier
    }
  });
});

test.describe("F3-6: página inteira, claro/escuro, axe", () => {
  for (const tema of ["light", "dark"]) {
    test(`tema ${tema}: sem erro no console, captura, axe`, async ({ page }) => {
      const erros = [];
      page.on("console", (msg) => { if (msg.type() === "error") erros.push(msg.text()); });
      page.on("pageerror", (e) => erros.push(String(e)));

      await page.emulateMedia({ colorScheme: tema });
      await page.goto("/confiabilidade.html?edicao=ficticio");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      expect(erros, erros.join("; ")).toEqual([]);
      await page.screenshot({ path: join(PASTA_RELATORIO, `confiabilidade-${tema}.png`), fullPage: true });

      const resultado = await new AxeBuilder({ page }).analyze();
      const graves = resultado.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(graves, graves.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
    });
  }
});

test.describe("F6.1-11: painel de vereditos (pacote real bd10cbd)", () => {
  test("vereditos esperados; clicar numa célula abre a seção; as setas passam para a seguinte", async ({ page }) => {
    await page.goto("/confiabilidade.html?dominio=al_rm_maceio&edicao=bd10cbd");
    await page.waitForLoadState("networkidle");

    const linhas = page.locator("#f3-grade-vereditos .grade-vereditos tbody tr");
    const linha2 = linhas.nth(1); // pergunta 2
    const celulas2 = linha2.locator(".vereditocel");
    await expect(celulas2.nth(0).locator(".palavra")).toHaveText("sim");
    await expect(celulas2.nth(1).locator(".palavra")).toHaveText("sim");
    await expect(celulas2.nth(2).locator(".palavra")).toHaveText("não");

    const linha3 = linhas.nth(2); // pergunta 3
    for (const i of [0, 1, 2]) {
      await expect(linha3.locator(".vereditocel").nth(i).locator(".palavra")).toHaveText("em parte");
    }

    await celulas2.nth(0).click();
    await expect(page.locator("#f3-secao-modelo")).toBeFocused({ timeout: 3000 });

    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#f3-secao-consistencia")).toBeFocused({ timeout: 3000 });
  });
});
