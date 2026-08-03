import { buildConfig, commonConfig } from "../../tsup.config.base.ts";

export default buildConfig(process.cwd(), {
  base: {
    ...commonConfig,
    dts: false,
  },
});
