// SPEC_F6.3 item 7: nenhum código cru (snake_case) ou id de período (m20xx)
// visível fora de texto livre do pacote (leitura/explicação/motivo/achados/
// descrição de etapa do pipeline — prosa escrita pela equipe de dados, exibida
// verbatim por regra da SPEC_00/SPEC_F6 §7, não um rótulo que o site escolheu).
import { test, expect } from "@playwright/test";

const RE_SNAKE = /\b[a-z]+_[a-z_]+\b/g;
const RE_M20 = /\bm20\d\d\b/g;

// Contêineres com texto livre do pacote (prosa, não rótulo de código fechado).
const SELETORES_PROSA = [
  "#f2-fjp", "#f3-ponte-tabela", "#f3-fjp", "#f3-modelo-blocos", "#f3-achados",
  "#met-pipeline-expandido", "[id^='met-sub-']",
];

async function textoSemProsa(page) {
  return page.evaluate((seletores) => {
    const clone = document.body.cloneNode(true);
    for (const sel of seletores) clone.querySelectorAll(sel).forEach((el) => el.remove());
    return clone.innerText;
  }, SELETORES_PROSA);
}

async function abrirTudo(page, pagina) {
  if (pagina === "index.html") {
    await page.click("#f2-detalhes-btn").catch(() => {});
    await page.waitForTimeout(300);
  }
  if (pagina === "confiabilidade.html") {
    for (const b of await page.locator("button[data-secao]").all()) {
      await b.click().catch(() => {});
    }
    await page.waitForTimeout(200);
  }
  if (pagina === "metodologia.html") {
    for (const n of await page.locator(".no-pipeline").all()) {
      await n.click().catch(() => {});
      await page.waitForTimeout(100);
    }
  }
}

for (const pagina of ["index.html", "resultados.html", "confiabilidade.html", "metodologia.html"]) {
  test(`F6.3 item 7: ${pagina} sem rótulo cru nem id de período (pacote bd10cbd)`, async ({ page }) => {
    await page.goto(`/${pagina}?dominio=al_rm_maceio&edicao=bd10cbd`);
    await page.waitForLoadState("networkidle");
    await abrirTudo(page, pagina);
    const texto = await textoSemProsa(page);
    const snake = [...new Set(texto.match(RE_SNAKE) ?? [])];
    const m20 = [...new Set(texto.match(RE_M20) ?? [])];
    expect(snake, `snake_case cru: ${snake.join(", ")}`).toEqual([]);
    expect(m20, `id de período cru: ${m20.join(", ")}`).toEqual([]);
  });
}
