import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, './shared'),
    },
    // This allows vitest to find tests in all workspaces
    globals: true,
    // Prevents global test failure if a package does not have tests yet
    passWithNoTests: true,
  },
});
