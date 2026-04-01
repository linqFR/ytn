import {
  tsContractCliIN,
  tsContractTargetIN,
} from "../cli-engine/schemas.js";
import { pico } from "../config/pico-config.js";

/**
 * @constant {Object} HELP_CONTRACT
 * @description Native global definitions and targets injected into every contract.
 */
export const HELP_CONTRACT: {
  cli: tsContractCliIN;
  targets: tsContractTargetIN;
} = {
  cli: {
    flags: {
      help: {
        type: "boolean",
        desc: "Show help information",
        short: "h",
      },
    },
  },
  targets: {
    helpTarget: {
      ...pico.help("flag to require help", "help"),
    },
  },
};

/**
 * @function injectHelp
 * @description Injects the global help flag and help target into a contract definition.
 * Safely merges configuration using native spreads to preserve Proxy integrity.
 */
export const injectHelp = (contract: any) => {
  const cli = contract.cli || {};

  return {
    ...contract,
    cli: {
      ...cli,
      flags: {
        ...(cli.flags || {}),
        ...HELP_CONTRACT.cli.flags,
      },
    },
    targets: {
      ...contract.targets,
      ...HELP_CONTRACT.targets,
    },
  };
};
