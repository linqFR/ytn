import { defineConfig } from 'tsup';
import { commonConfig, minConfig, createDualEntries, getEntriesFromExports } from '../../tsup.config.base.js';

const entry = getEntriesFromExports(process.cwd());

export default defineConfig([
  {
    ...commonConfig,
    entry
  },
  {
    ...minConfig,
    entry: createDualEntries(entry)
  }
]);
