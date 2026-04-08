import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // This allows vitest to find tests in all workspaces
    globals: true,
    // Prevents global test failure if a package does not have tests yet
    passWithNoTests: true,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "sandbox/**",
      "**/sandbox/**",
    ],
  },
});
