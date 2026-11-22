// SPEC_F5: validações da publicação (seletor de domínio/edição, catálogo público).
import { test, expect } from "@playwright/test";

test.describe("F5-1: trocar de domínio recarrega mapa, totais e textos do pacote certo", () => {
  test("al_rm_maceio (fictício) -> teste_pequeno, por endereço direto", async ({ page }) => {
    await page.goto("/index.html?dominio=al_rm_maceio&edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-dominio")).toHaveValue("al_rm_maceio");
    const mensagemMaceio = await page.locator("#f2-mensagem").textContent();

    await page.goto("/index.html?dominio=teste_pequeno");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-dominio")).toHaveValue("teste_pequeno");
    const mensagemTeste = await page.locator("#f2-mensagem").textContent();

    expect(mensagemTeste).not.toBe(mensagemMaceio);
  });
});

test.describe("F5-1 (edição, pelo seletor real do cabeçalho)", () => {
  test("trocar a edição no select #sel-edicao recarrega com os dados da edição escolhida", async ({ page }) => {
    await page.goto("/index.html?dominio=al_rm_maceio&edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-edicao")).toHaveValue("ficticio");

    await page.selectOption("#sel-edicao", "69277fd");
    await page.waitForURL(/edicao=69277fd/);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-edicao")).toHaveValue("69277fd");
    await expect(page.locator("#chip-ficticio")).toBeHidden();
  });
});

test.describe("F5-4: links de domínio e edição estáveis", () => {
  test("abrir o endereço direto da edição real mostra exatamente essa edição", async ({ page }) => {
    await page.goto("/metodologia.html?dominio=al_rm_maceio&edicao=69277fd");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#met-rastreio")).toContainText("69277fd");
  });

  test("abrir o endereço direto da edição fictícia mostra exatamente essa edição", async ({ page }) => {
    await page.goto("/metodologia.html?dominio=al_rm_maceio&edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#met-rastreio")).not.toContainText("69277fd");
  });
});

test.describe("F5-2 (cabeçalho público): pacote real não mostra o chip 'dados fictícios'", () => {
  test("edição padrão (sem parâmetros na URL) é a real", async ({ page }) => {
    await page.goto("/index.html");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-edicao")).toHaveValue("69277fd");
    await expect(page.locator("#chip-ficticio")).toBeHidden();
  });
});
