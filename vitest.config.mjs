import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unidade/**/*.test.js"],
    testTimeout: 30000,
  },
});
