import { defineConfig } from "tsup";
import { commonConfig, minConfig } from "../../tsup.config.base.js";

export default defineConfig([
  {
    ...commonConfig,
    dts: false,
    external: [...(commonConfig.external ?? []), "@ytn/dna"],
    entry: { index: "src/index.ts" },
    clean: true,
  },
  {
    ...minConfig,
    dts: false,
    external: [...(minConfig.external ?? []), "@ytn/dna"],
    entry: { "index.min": "src/index.ts" },
    clean: false,
  },
]);
