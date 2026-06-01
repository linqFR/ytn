import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["@ytn/shared"],
  noExternal: ["@ytn/dna"],
  outDir: "dist",
  splitting: false,
  sourcemap: true
});
