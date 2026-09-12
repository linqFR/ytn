import { defineConfig, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.config";

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      // Inherits alias, setupFiles, globals, passWithNoTests, exclude, typecheck from root config.
      // No package-specific overrides needed — gov-mcp uses the shared DNA setup file.
    },
  }),
);
