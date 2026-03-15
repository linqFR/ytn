import { defineConfig } from 'tsup';
import { commonConfig, minConfig, createDualEntries } from '../../tsup.config.base.js';

const entry = {
  index: 'src/index.ts',
  router: 'src/wfZodRouter.ts',
  'xor-gate': 'src/xor-gate.ts'
};

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
