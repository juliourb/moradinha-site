// F0-5: Playwright abre as 4 páginas em claro e escuro, sem erro no console;
// captura de tela de cada uma em relatorios/F0/.
// F0-6: axe-core sem violação "serious" ou "critical".
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const PAGINAS = [
  ["inicio", "/index.html"],
  ["visao-geral", "/visao-geral.html"],
  ["resultados", "/resultados.html"],
  ["confiabilidade", "/confiabilidade.html"],
  ["metodologia", "/metodologia.html"],
];
const TEMAS = ["light", "dark"];
const PASTA_RELATORIO = join(process.cwd(), "relatorios", "F0");

mkdirSync(PASTA_RELATORIO, { recursive: true });

for (const [nome, caminho] of PAGINAS) {
  for (const tema of TEMAS) {
    test(`${nome} — tema ${tema}: sem erro no console, screenshot, axe`, async ({ page }) => {
      const errosConsole = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errosConsole.push(msg.text());
      });
      page.on("pageerror", (erro) => errosConsole.push(String(erro)));

      await page.emulateMedia({ colorScheme: tema });
      await page.goto(caminho);
      await page.waitForLoadState("networkidle");

      expect(errosConsole, `erros no console em ${nome} (${tema}): ${errosConsole.join("; ")}`).toEqual([]);

      await page.screenshot({
        path: join(PASTA_RELATORIO, `${nome}-${tema}.png`),
        fullPage: true,
      });

      const resultadoAxe = await new AxeBuilder({ page }).analyze();
      const graves = resultadoAxe.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical"
      );
      expect(
        graves,
        graves.map((v) => `${v.id}: ${v.help}`).join("\n")
      ).toEqual([]);
    });
  }
}
