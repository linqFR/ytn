import { defineConfig } from "tsup";
import {
  commonConfig,
  minConfig,
  createDualEntries,
  getEntriesFromPackage,
} from "../../tsup.config.base.js";

const { entries, dts } = getEntriesFromPackage(process.cwd());

export default defineConfig([
  {
    ...commonConfig,
    entry: entries,
    dts,
  },
  {
    ...minConfig,
    entry: createDualEntries(entries),
  },
]);
