import { buildConfig, commonConfig } from "../../tsdown.config.base.ts";

export default buildConfig(process.cwd(), {
  base: {
    ...commonConfig,
    dts: { resolver: "tsc", eager: true },
  },
});
