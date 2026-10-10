import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  retries: 0,
  use: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
  },
});
