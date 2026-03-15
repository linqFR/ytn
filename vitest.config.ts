import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
    },
    // This allows vitest to find tests in all workspaces
    globals: true,
    // Prevents global test failure if a package does not have tests yet
    passWithNoTests: true,
  },
});
