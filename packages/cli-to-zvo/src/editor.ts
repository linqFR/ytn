// NOTE: Muse contain functions to create a function

import type { tsPico, tsPicoString } from "./pico-zod/index.js";
import { pico } from "./config/pico-config.js";

import { defineContract } from "./editor/define-contract.js";
import type { tsValidateContract } from "./editor/define-contract.type.js";
import { ContractSchema, type tsContractIN } from "./schema/contract.schema.js";

/**
 * @type tsValidated
 * @description Standardized, compile-time validated CLI contract type.
 * Uses camelCase field validation against defined CLI positionals and flags.
 */
type tsValidated<T = tsContractIN> = tsValidateContract<T>;

export type {
  tsContractIN as tsContract,
  tsPico,
  tsPicoString,
  tsValidateContract,
  tsValidated,
};

export { ContractSchema, defineContract, pico };
