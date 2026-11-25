// S1-2: endereços por domínio e edição (/d/<conjunto>/<edicao>/), página inicial com um
// cartão por domínio e as validações F5-1 e F5-4 com DOIS domínios (Maceió e o fictício no
// formato de São Paulo). Os domínios de teste só aparecem na página inicial com ?teste=1.
import { test, expect } from "@playwright/test";

function observarErros(page) {
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  page.on("pageerror", (e) => erros.push(String(e)));
  return erros;
}

test.describe("S1-2: página inicial", () => {
  test("sem ?teste=1 só o domínio real; cada cartão tem nome, edição, data e mini-mapa", async ({ page }) => {
    const erros = observarErros(page);
    await page.goto("/index.html");
    await expect(page.locator("#inicio-cartoes[data-pronto='1']")).toBeAttached({ timeout: 20000 });
    const cartoes = page.locator(".cartao-dominio");
    await expect(cartoes).toHaveCount(1);
    const c = cartoes.first();
    await expect(c.locator("h2")).toHaveText("RM de Maceió com a capital");
    await expect(c).toContainText("Edição bd10cbd");
    await expect(c).toContainText("22/11/2026");
    await expect(c.locator("svg.mini-svg path").first()).toBeAttached();
    await expect(c.locator("a.iconbtn")).toHaveAttribute("href", "d/al_rm_maceio/visao-geral.html");
    expect(erros).toEqual([]);
  });

  test("?teste=1 mostra os 3 domínios (os fictícios marcados) e cada um abre o seu endereço", async ({ page }) => {
    const erros = observarErros(page);
    await page.goto("/index.html?teste=1");
    await expect(page.locator("#inicio-cartoes[data-pronto='1']")).toBeAttached({ timeout: 40000 });
    await expect(page.locator(".cartao-dominio")).toHaveCount(3);
    await expect(page.locator(".cartao-dominio .chip.ficticio")).toHaveCount(2);
    for (const id of ["al_rm_maceio", "teste_pequeno", "teste_sp"]) {
      await expect(page.locator(`.cartao-dominio[data-dominio="${id}"] svg.mini-svg path`).first()).toBeAttached();
    }
    await page.locator('.cartao-dominio[data-dominio="teste_sp"] a.iconbtn').click();
    await page.waitForURL(/\/d\/teste_sp\/visao-geral\.html/);
    await expect(page.locator("#sel-dominio")).toHaveValue("teste_sp");
    expect(erros).toEqual([]);
  });
});

test.describe("F5-1 com dois domínios: trocar de domínio e de edição recarrega o pacote certo", () => {
  test("Maceió (real) -> São Paulo fictício pelo seletor do cabeçalho, por endereço", async ({ page }) => {
    await page.goto("/d/al_rm_maceio/bd10cbd/visao-geral.html");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-dominio")).toHaveValue("al_rm_maceio");
    await expect(page.locator("#sel-edicao")).toHaveValue("bd10cbd");
    const mensagemMaceio = await page.locator("#f2-mensagem").textContent();

    // O domínio de teste não está no seletor público; abre-se por endereço e o seletor o mostra.
    await page.goto("/d/teste_sp/ficticio/visao-geral.html");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-dominio")).toHaveValue("teste_sp");
    await expect(page.locator("#chip-ficticio")).toBeVisible();
    const mensagemSp = await page.locator("#f2-mensagem").textContent();
    expect(mensagemSp).not.toBe(mensagemMaceio);

    // Do domínio de teste de volta ao real, pelo próprio seletor: vai ao endereço do domínio (edição padrão).
    await page.selectOption("#sel-dominio", "al_rm_maceio");
    await page.waitForURL(/\/d\/al_rm_maceio\/visao-geral\.html/);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-edicao")).toHaveValue("bd10cbd");
    expect(await page.locator("#f2-mensagem").textContent()).toBe(mensagemMaceio);
  });

  test("trocar a edição pelo seletor vai ao endereço da edição, na mesma aba", async ({ page }) => {
    await page.goto("/d/al_rm_maceio/ficticio/resultados.html");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-edicao")).toHaveValue("ficticio");
    await page.selectOption("#sel-edicao", "bd10cbd");
    await page.waitForURL(/\/d\/al_rm_maceio\/bd10cbd\/resultados\.html/);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-edicao")).toHaveValue("bd10cbd");
    await expect(page.locator("#chip-ficticio")).toBeHidden();
  });
});

test.describe("F5-4 com dois domínios: endereços estáveis", () => {
  test("/d/<conjunto>/ aponta para a edição padrão; /d/<conjunto>/<edicao>/ para a pedida", async ({ page }) => {
    await page.goto("/d/al_rm_maceio/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-edicao")).toHaveValue("bd10cbd");

    await page.goto("/d/al_rm_maceio/ficticio/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-edicao")).toHaveValue("ficticio");
    await expect(page.locator("#chip-ficticio")).toBeVisible();

    await page.goto("/d/teste_sp/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-dominio")).toHaveValue("teste_sp");
  });

  test("a Metodologia de cada endereço cita a edição certa (rastreio)", async ({ page }) => {
    await page.goto("/d/al_rm_maceio/bd10cbd/metodologia.html");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#met-rastreio")).toContainText("bd10cbd");
    await page.goto("/d/al_rm_maceio/ficticio/metodologia.html");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#met-rastreio")).not.toContainText("bd10cbd");
  });

  test("os links das abas e do cartão da Visão geral ficam dentro da mesma edição", async ({ page }) => {
    await page.goto("/d/teste_sp/ficticio/visao-geral.html");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('.navbar a.nav-link[href$="resultados.html"]').first()).toHaveAttribute("href", /\/d\/teste_sp\/ficticio\/resultados\.html$/);
    await page.locator('.navbar a.nav-link[href$="resultados.html"]').first().click();
    await page.waitForURL(/\/d\/teste_sp\/ficticio\/resultados\.html/);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-dominio")).toHaveValue("teste_sp");
    // O título da barra volta à página inicial.
    await expect(page.locator("a.navbar-brand, .navbar-title a").first()).toHaveAttribute("href", /localhost:4173\/(index\.html)?$/);
  });

  test("modo ?dominio=&edicao= continua valendo nas páginas da raiz e leva a escolha nos links", async ({ page }) => {
    await page.goto("/visao-geral.html?dominio=teste_sp&edicao=ficticio");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sel-dominio")).toHaveValue("teste_sp");
    await expect(page.locator('.navbar a.nav-link[href*="resultados.html"]').first()).toHaveAttribute("href", /resultados\.html\?dominio=teste_sp&edicao=ficticio$/);
  });
});
