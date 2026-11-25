import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  fullyParallel: false,
  // Um worker só: várias páginas carregando DuckDB-WASM/deck.gl/MapLibre ao
  // mesmo tempo disputam CPU e derrubavam o tempo de carregamento para além
  // do timeout dos testes (flakiness só em suíte cheia, não isolado).
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    // WebGL por software (deck.gl/MapLibre) em Chromium headless.
    launchOptions: {
      args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
    },
  },
  // Os testes usam o build INTERNO (_site_interno), que inclui os pacotes fictícios de teste
  // (E58: o build público não os contém). A porta 4174 serve o build público, só para
  // conferir que ele não tem pacote de teste (tests/e2e/s1-publico.spec.js).
  webServer: [
    {
      command: "node ferramentas/servir.mjs 4173 _site_interno",
      port: 4173,
      reuseExistingServer: true,
      timeout: 15000,
    },
    {
      command: "node ferramentas/servir.mjs 4174 _site",
      port: 4174,
      reuseExistingServer: true,
      timeout: 15000,
    },
  ],
});
