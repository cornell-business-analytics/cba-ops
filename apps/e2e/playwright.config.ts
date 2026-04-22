import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? "github" : "html",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "website-chromium",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env["BASE_URL_WEBSITE"] ?? "http://localhost:3001",
      },
      testMatch: "tests/website/**/*.spec.ts",
    },
    {
      name: "website-firefox",
      use: {
        ...devices["Desktop Firefox"],
        baseURL: process.env["BASE_URL_WEBSITE"] ?? "http://localhost:3001",
      },
      testMatch: "tests/website/**/*.spec.ts",
    },
    {
      name: "ops-chromium",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env["BASE_URL_FRONTEND"] ?? "http://localhost:3000",
      },
      testMatch: "tests/ops/**/*.spec.ts",
    },
  ],
});
