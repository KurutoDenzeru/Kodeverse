import { defineConfig } from "vitest/config";

// The suites cover the pure library modules, so they need no browser and no
// Astro. The page itself is proven by scripts/browser-smoke.mjs against the
// real build.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
