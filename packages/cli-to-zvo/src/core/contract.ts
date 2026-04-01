import { z } from "zod";
import { type tsContractIN } from "../schema/contract.schema.js";
import {
  type OHelpArg,
  type OHelpCase,
  type OHelpData,
  type OHelpOptions,
  type OResponse,
  type IProcessedContract,
  type ValidateContract,
} from "../types/contract.types.js";
import { parseCli } from "./cli-parser.js";
import { cliToZod } from "./cli-to-z.js";
import { buildHelp } from "../output/help-builder.js";
import { printHelp } from "../output/help-printer.js";
import type { tsTargetFieldName, tsTargetName } from "../config/parse-args.js";

/**
 * @class Contract
 * @description The central manager for a CLI-to-Zod contract.
 * It handles the lifecycle of a contract from definition (via `create`)
 * to runtime execution (via `parseCli`) and documentation (via `help`).
 */
export class Contract<I extends tsContractIN = tsContractIN> {
  /**
   * @property _raw
   * @description The original input contract definition passed during creation.
   * Internal use only for reference.
   */
  private readonly _raw: I;

  /**
   * @property _processed
   * @description The compiled contract metadata, including bitmasks and routing trees.
   * This is generated automatically from the raw contract.
   */
  private readonly _processed: IProcessedContract;

  /**
   * @constructor
   * @param {I} contract - The raw input contract definition.
   */
  private constructor(contract: I) {
    this._raw = contract;
    this._processed = cliToZod(contract);
  }

  /**
   * @property processed
   * @description Returns the compiled contract metadata.
   * Useful for inspection or if manual routing is needed via `runProcessed`.
   */
  get processed(): IProcessedContract {
    return this._processed;
  }

  /**
   * @method create
   * @description The primary entry point for defining a CLI contract.
   * This method uses TypeScript's type system to validate your contract definition
   * at compile-time, ensuring targets are properly defined.
   *
   * @template I - The shape of the input contract.
   * @param {ValidateContract<I>} contract - The full CLI contract definition object.
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
   *     greet: { command: "lit(hello)", name: "string" }
   *   },
   *   fallbacks: {
   *     default: { verbose: "bool?" }
   *   },
   *   options: {
   *     onlyAllowedValues: true
   *   }
   * });
   * ```
   *
   * @returns {Contract<I>} A validated and compiled Contract instance.
   */
  public static create<I extends tsContractIN>(
    contract: ValidateContract<I>,
  ): Contract<I> {
    return new Contract<I>(contract as I);
  }

  /**
   * @method from
   * @description Alias for `Contract.create`.
   */
  public static from = Contract.create;

  /**
   * @method parseCli
   * @description Parses raw command-line arguments (argv) against the contract.
   * This handles name mapping, bitmask routing, and final Zod validation in one go.
   *
   * @param {string[]} [args=process.argv.slice(2)] - The array of raw strings from the CLI.
   * @returns {z.ZodSafeParseResult<OResponse>} A Zod safe parse result containing the routed target and its data.
   */
  public parseCli(
    args: string[] = process.argv.slice(2),
  ): z.ZodSafeParseResult<OResponse> {
    return Contract.runProcessed(this._processed, args);
  }

  /**
   * @static
   * @method runProcessed
   * @description Low-level execution of a previously compiled contract metadata against raw arguments.
   * Useful in serverless or pre-compiled environments where you don't want to re-run the DSL compiler.
   *
   * @param {IProcessedContract} processed - The compiled contract metadata.
   * @param {string[]} [args=process.argv.slice(2)] - Arguments to parse.
   * @returns {z.ZodSafeParseResult<OResponse>} The routing and validation result.
   */
  public static runProcessed(
    processed: IProcessedContract,
    args: string[] = process.argv.slice(2),
  ): z.ZodSafeParseResult<OResponse> {
    return parseCli(
      args,
      processed.parsingArgs,
      processed.parseArgsResultParser,
      processed.zvoSchema,
    );
  }

  /**
   * @method help
   * @description Generates structured metadata for the CLI help screen.
   * This extracts info from both the CLI interface definition and the target signatures.
   *
   * @param {string | OHelpOptions} [targetOrOptions] - Name of a target OR a configuration object.
   * @param {OHelpOptions} [options] - Custom options (if first parameter was a target name).
   * @returns {OHelpData} Structured help data ready to be passed to a renderer.
   */
  public help(
    targetOrOptions?: (keyof I["targets"] & string) | OHelpOptions,
    options?: OHelpOptions,
  ): OHelpData {
    if (typeof targetOrOptions === "object") {
      return buildHelp(this._processed, undefined, targetOrOptions);
    }
    return buildHelp(this._processed, targetOrOptions, options);
  }

  /**
   * @method printHelp
   * @description Directly prints the formatted help screen to stdout with colors and alignment.
   *
   * @param {string | OHelpOptions} [targetOrOptions] - Name of a target OR a configuration object.
   * @param {OHelpOptions} [options] - Custom options.
   */
  public printHelp(
    targetOrOptions?: (keyof I["targets"] & string) | OHelpOptions,
    options?: OHelpOptions,
  ): void {
    printHelp(this.help(targetOrOptions as any, options));
  }
}
