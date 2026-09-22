import { buildConfig, commonConfig } from "../../tsup.config.base.ts";

export default buildConfig(process.cwd(), {
  external: [
    "@modelcontextprotocol/server",
    "@modelcontextprotocol/client",
    "@ytrynot/dna",
    "zod",
  ],
  base: { ...commonConfig, sourcemap: false },
  min: false,
});
