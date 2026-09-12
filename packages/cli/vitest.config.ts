import { defineConfig, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.config";

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      // Inherits alias, setupFiles (DNA polyfill __name + Function.prototype.toString),
      // globals, passWithNoTests, exclude, typecheck from root config.
    },
  }),
);
