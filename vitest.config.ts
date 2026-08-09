import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@ytrynot/dna/core": resolve(rootDir, "packages/dna/src/core.ts"),
    },
  },
  test: {
    // This allows vitest to find tests in all workspaces
    globals: true,
    // Prevents global test failure if a package does not have tests yet
    passWithNoTests: true,
    setupFiles: [resolve(rootDir, "packages/dna/tests/setup.ts")],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "sandbox/**",
      "_archive/**",
      "_archives/**",
      "**/sandbox/**",
      "**/_archive/**",
      "**/_archives/**",
    ],
  },
});
