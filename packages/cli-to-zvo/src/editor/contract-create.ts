import { ContractSchema, tsContractIN } from "../schema/contract.schema.js";
import { IProcessedContract } from "../types/contract.types.js";
import { uValidateContract } from "./contract-create.type.js";

/**
 * @method createContrat
 * @description The primary entry point for defining a CLI contract.
 * This method uses TypeScript's type system to validate your contract definition
 * at compile-time, ensuring targets are properly defined.
 *
 * @template I - The shape of the input contract.
 * @param {uValidateContract<I>} contract - The full CLI contract definition object.
 * @param {string} contract.name - The name of your CLI tool.
 * @param {string} contract.description - What your CLI tool does (used in help).
 * @param {string} [contract.version] - Version of your CLI tool.
 * @param {object} contract.cli - The physical command-line interface definition.
 * @param {string[]} [contract.cli.positionals] - Positional argument names in order.
 * @param {Record<string, tsFlagIN>} [contract.cli.flags] - Flag definitions mapping long names to settings.
 * @param {Record<string, tsTargetIN>} contract.targets - Logical application entry points.
 * Each target represents a valid command signature that will be routed to.
 * @param {Record<string, tsTargetIN>} [contract.fallbacks] - Catch-all targets for partial matches.
 * @param {tsOptionsIN} [contract.options] - Engine-level configuration (e.g., onlyAllowedValues).
 *
 * @example
 * ```ts
 * const contract = Contract.create({
 *   name: "my-cli",
 *   description: "A cool CLI tool",
 *   cli: {
 *     positionals: ["command"],
 *     flags: {
 *       verbose: { short: "v", desc: "Enable verbose mode", type: "boolean" }
 *     }
 *   },
 *   targets: {
 *     greet: { command: pico.literal("hello"), name: "string" }
 *   },
 *   fallbacks: {
 *     default: { verbose: pico.boolean().optional() }
 *   },
 *   options: {
 *     onlyAllowedValues: true
 *   }
 * });
 * ```
 *
 * @returns {Contract<I>} A validated and compiled Contract instance.
 */
export function defineContract<I extends tsContractIN>(
  contract: uValidateContract<I>,
): IProcessedContract {
  const res = ContractSchema.safeParse(contract);
  if (!res.success) {
    throw new SyntaxError(`Error with the Contract`, { cause: res.error });
  }
  return res.data;
}
