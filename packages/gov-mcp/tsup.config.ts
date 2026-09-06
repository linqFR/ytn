import { buildConfig, commonConfig } from "../../tsup.config.base.ts";
export default buildConfig(process.cwd(), {
  external: ["better-sqlite3", "@modelcontextprotocol/sdk"],
  base: { ...commonConfig, sourcemap: false },
  min: false,
});
