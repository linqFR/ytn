// NOTE: Muse contain functions to create a function

import type { tsPico, tsPicoString } from "./pico-zod/index.js";
import { pico } from "./config/pico-config.js";

import { defineContract } from "./editor/contract-create.js";
import type { uValidateContract } from "./editor/contract-create.type.js";
import { ContractSchema, type tsContractIN } from "./schema/contract.schema.js";

/**
 * @type tsValidated
 * @description Standardized, compile-time validated CLI contract type.
 * Uses camelCase field validation against defined CLI positionals and flags.
 */
type tsValidated<T = tsContractIN> = uValidateContract<T>;

export type {
  tsContractIN as tsContract,
  tsPico,
  tsPicoString,
  uValidateContract,
  tsValidated,
};

export { ContractSchema, defineContract as createContract, pico };
