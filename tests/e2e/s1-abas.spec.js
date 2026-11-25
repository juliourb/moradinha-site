// S1-4: o site com um domínio de um município só e 332 APs (teste_sp), sem nada preso a Maceió.
// Nenhum erro no console nas 4 abas com os pacotes; camada de municípios e recortes; rótulos de
// eixo inteiros com números grandes; tempo até o mapa aparecer (registrado em relatorios/S1/tempos.json).
import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACOTES = [
  ["maceio_real", "d/al_rm_maceio/bd10cbd/"],
  ["maceio_ficticio", "d/al_rm_maceio/ficticio/"],
  ["teste_pequeno", "d/teste_pequeno/ficticio/"],
  ["teste_sp", "d/teste_sp/ficticio/"],
];
const ABAS = ["visao-geral", "resultados", "confiabilidade", "metodologia"];
const tempos = {};

function observarErros(page) {
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  page.on("pageerror", (e) => erros.push(String(e)));
  return erros;
}

for (const [nome, base] of PACOTES) {
  for (const aba of ABAS) {
    test(`${nome} / ${aba}: sem erro no console; tempo até o mapa`, async ({ page }) => {
      const erros = observarErros(page);
      const t0 = Date.now();
      await page.goto(`/${base}${aba}.html`);
      if (aba === "resultados") {
        await page.waitForSelector("[data-pronto='true']", { timeout: 60000 });
        (tempos[nome] ??= {}).resultados_ms = Date.now() - t0;
      } else if (aba === "visao-geral") {
        await page.waitForSelector("#f2-minimapa canvas", { timeout: 60000 });
        (tempos[nome] ??= {}).visao_geral_ms = Date.now() - t0;
      }
      await page.waitForLoadState("networkidle");
      expect(erros, erros.join("; ")).toEqual([]);
      const rolagem = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(rolagem).toBe(0);
    });
  }
}

test.afterAll(() => {
  const pasta = join(process.cwd(), "relatorios", "S1");
  mkdirSync(pasta, { recursive: true });
  writeFileSync(join(pasta, "tempos.json"), JSON.stringify(tempos, null, 2));
});

test.describe("domínio de um município só, sem recortes", () => {
  test("camada Municípios e recortes ausentes em teste_sp; presentes em Maceió", async ({ page }) => {
    await page.goto("/d/teste_sp/ficticio/resultados.html");
    await page.waitForSelector("[data-pronto='true']", { timeout: 60000 });
    await expect(page.locator('input[data-camada="ap"]')).toBeAttached();
    await expect(page.locator('input[data-camada="municipios"]')).toHaveCount(0);
    await expect(page.locator('input[data-camada="braskem"]')).toHaveCount(0);

    await page.goto("/d/al_rm_maceio/bd10cbd/resultados.html");
    await page.waitForSelector("[data-pronto='true']", { timeout: 60000 });
    await expect(page.locator('input[data-camada="municipios"]')).toBeAttached();
    await expect(page.locator('input[data-camada="braskem"]')).toBeAttached();
  });

  test("ranking não repete o nome do único município", async ({ page }) => {
    await page.goto("/d/teste_sp/ficticio/resultados.html");
    await page.waitForSelector("[data-pronto='true']", { timeout: 60000 });
    const linhas = page.locator('[data-k="rank"] tbody tr');
    await expect(linhas.first()).toBeVisible();
    for (const t of await linhas.allTextContents()) expect(t).not.toContain("São Paulo");
  });

  test("escolhas guardadas de outro domínio (período inexistente) não quebram a página", async ({ page }) => {
    const erros = observarErros(page);
    await page.addInitScript(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    });
    await page.goto("/d/teste_sp/ficticio/resultados.html");
    await page.waitForSelector("[data-pronto='true']", { timeout: 60000 });
    const chave = await page.evaluate(() => Object.keys(localStorage).find((k) => /moradinha|pergunta/i.test(k)));
    expect(chave).toBeTruthy();
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ periodo: "1999", camadas: { braskem: true, ap: true } })), chave);
    await page.reload();
    await page.waitForSelector("[data-pronto='true']", { timeout: 60000 });
    const estado = await page.evaluate(() => window.__moradinhaEstado());
    expect(estado.periodo).not.toBe("1999");
    expect(Object.keys(estado.camadas)).not.toContain("braskem");
    expect(erros).toEqual([]);
  });
});

test.describe("332 APs e números grandes", () => {
  test("Qualidade: todas as medidas e componentes sem erro", async ({ page }) => {
    test.setTimeout(120000);
    const erros = observarErros(page);
    await page.goto("/d/teste_sp/ficticio/resultados.html");
    await page.waitForSelector("[data-pronto='true']", { timeout: 60000 });
    await page.click('#f1-seg-tema button[data-v="qualidade"]');
    for (const comp of ["coabitacao", "onus", "precariedade"]) {
      await page.click(`#f1-seg-comp button[data-v="${comp}"]`);
      for (const medida of ["incerteza", "qualidade_dado", "ressalva_ap", "cv_ap", "imputacao", "estoque", "hex_novo"]) {
        await page.click("#f1-sel-medida-qualidade");
        // Medida constante no pacote fica desativada de propósito (F6.5): só fecha a lista.
        const opcao = page.locator(`.mq-opcao[data-v="${medida}"]`);
        if (await opcao.isDisabled()) {
          await page.keyboard.press("Escape");
          continue;
        }
        await opcao.click();
        await page.waitForTimeout(150);
      }
    }
    expect(erros).toEqual([]);
  });

  test("rótulos dos eixos verticais cabem dentro do gráfico (números de 6 dígitos)", async ({ page }) => {
    await page.goto("/d/teste_sp/ficticio/resultados.html");
    await page.waitForSelector("[data-pronto='true']", { timeout: 60000 });
    await page.waitForTimeout(1500);
    const cortados = await page.evaluate(() => {
      const ruins = [];
      for (const svg of document.querySelectorAll('[data-k="series"] svg, [data-k="boxes"] svg, [data-k="hist"] svg')) {
        const r = svg.getBoundingClientRect();
        for (const t of svg.querySelectorAll(".axis text")) {
          const b = t.getBoundingClientRect();
          if (b.width && b.left < r.left - 0.5) ruins.push(t.textContent);
        }
      }
      return ruins;
    });
    expect(cortados).toEqual([]);
  });
});
