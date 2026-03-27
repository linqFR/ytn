import { pico } from "../pico-zod/index.js";
import {
  tsContractCliIN,
  tsContractTargetIN,
} from "../cli-engine/schemas.js";

/**
 * @constant {Object} NATIVE_GLOBAL_CONTRACT
 * @description Native global definitions and targets injected into every contract.
 */
export const NATIVE_GLOBAL_CONTRACT: {
  cli: tsContractCliIN;
  targets: tsContractTargetIN;
} = {
  cli: {
    flags: {
      help: {
        type: "boolean",
        desc: "Show help information",
        short: "h",
        intercept: true,
      },
    },
  },
  targets: {
    helpTarget: {
      help: pico.boolean().desc("Help"),
    },
  },
};
