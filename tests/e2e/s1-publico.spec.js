// E58: o build PÚBLICO (_site, porta 4174) não contém pacotes teste_apenas e não responde a ?teste=1.
import { test, expect } from "@playwright/test";

test.use({ baseURL: "http://localhost:4174" });

test.describe("build público sem pacotes de teste", () => {
  test("catalogo.json público só tem o domínio real, sem edição de teste", async ({ request }) => {
    const catalogo = await (await request.get("/catalogo.json")).json();
    expect(catalogo.dominios.map((d) => d.conjunto_id)).toEqual(["al_rm_maceio"]);
    expect(catalogo.dominios[0].edicoes.map((e) => e.edicao)).toEqual(["bd10cbd"]);
    expect(JSON.stringify(catalogo)).not.toContain("teste");
  });

  for (const caminho of [
    "/pacotes/teste_sp/ficticio/manifesto.json",
    "/pacotes/teste_pequeno/ficticio/manifesto.json",
    "/pacotes/al_rm_maceio/ficticio/manifesto.json",
    "/d/teste_sp/ficticio/visao-geral.html",
    "/d/teste_sp/",
    "/d/teste_pequeno/ficticio/resultados.html",
    "/d/al_rm_maceio/ficticio/metodologia.html",
  ]) {
    test(`${caminho} não existe (404)`, async ({ request }) => {
      expect((await request.get(caminho)).status()).toBe(404);
    });
  }

  test("a edição real continua no ar", async ({ request }) => {
    expect((await request.get("/pacotes/al_rm_maceio/bd10cbd/manifesto.json")).status()).toBe(200);
    expect((await request.get("/d/al_rm_maceio/bd10cbd/visao-geral.html")).status()).toBe(200);
  });

  test("a página inicial com ?teste=1 mostra só o domínio real (não responde ao parâmetro)", async ({ page }) => {
    await page.goto("/index.html?teste=1");
    await expect(page.locator("#inicio-cartoes[data-pronto='1']")).toBeAttached({ timeout: 30000 });
    await expect(page.locator(".cartao-dominio")).toHaveCount(1);
    await expect(page.locator(".cartao-dominio .chip.ficticio")).toHaveCount(0);
  });

  test("?dominio=teste_sp numa aba pública cai no domínio real, sem erro de rede de pacote", async ({ page }) => {
    await page.goto("/visao-geral.html?dominio=teste_sp&edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-dominio")).toHaveValue("al_rm_maceio");
  });
});
