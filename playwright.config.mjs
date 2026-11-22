import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
  },
  webServer: {
    command: "node ferramentas/servir.mjs 4173",
    port: 4173,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
