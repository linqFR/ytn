import { z } from "zod";
import { type tsContractIN } from "../schema/contract.schema.js";
import {
  type OHelpArg,
  type OHelpCase,
  type OHelpData,
  type OResponse,
  type IProcessedContract,
} from "../types/contract.types.js";
import { parseCli } from "./cli-parser.js";
import { cliToZod } from "./cli-to-z.js";

/**
 * @class Contract
 * @description Manager class for a CLI contract.
 * Orchestrates validation, type enhancement, and help data generation.
 */
export class Contract<I extends tsContractIN = tsContractIN> {
  /**
   * @property raw
   * @description The fully processed and validated contract.
   */
  private readonly _raw: I;
  private readonly _processed: IProcessedContract;

  private constructor(contract: I) {
    this._raw = contract;
    this._processed = cliToZod(contract);
  }

  /**
   * @property processed
   * @description Returns the contract where all string types
   * are translated into real Zod schemas.
   */
  get processed(): IProcessedContract {
    return this._processed;
  }

  /**
   * @method create
   * @description Entry point to define a CLI contract.
   * A contract orchestrates the mapping between raw CLI arguments (argv)
   * and your internal domain targets.
   *
   * @param {tsContractIN} contract - The CLI contract definition.
   * @param {string} contract.name - The name of the CLI (used for help generation).
   * @param {string} contract.description - A brief description of the CLI's purpose.
   * @param {string} [contract.version] - Optional version string.
   * @param {object} contract.cli - Defines the physical CLI interface.
   * @param {string[]} [contract.cli.positionals] - Names of positional arguments in the order they appear.
   * @param {Record<string, object>} [contract.cli.flags] - Map of flag definitions.
   * @param {string} [contract.cli.flags.short] - Single-character alias for the flag.
   * @param {string} [contract.cli.flags.desc] - Description of the flag for help display.
   * @param {"string" | "boolean"} [contract.cli.flags.type] - The primitive type of the flag (defaults to "string").
   * @param {boolean} [contract.cli.flags.intercept] - If true, this flag is used for global settings and won't affect target routing.
   *
   * @param {Record<string, Record<string, tsPico>>} contract.targets - Logical targets of your application.
   * Each target is defined by a set of fields that must match CLI positionals or flags.
   * Field values can be DSL strings (e.g., "int", "url") or sealed Zod schemas.
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
   *     greet: { command: "lit(hello)", name: "string", verbose: "bool" }
   *   }
   * });
   * ```
   *
   * @returns {Contract<I>} A new Contract instance ready for parsing or help generation.
   */
  public static create<I extends tsContractIN>(contract: I): Contract<I> {
    return new Contract<I>(contract);
  }
  public static from = Contract.create;

  public parseCli(
    args: string[] = process.argv.slice(2),
  ): z.ZodSafeParseResult<OResponse> {
    return Contract.runProcessed(this._processed, args);
  }

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
   * Builds structured help data for the CLI by extracting metadata
   * from the processed contract.
   */
  public help(): OHelpData {
    // 1. Extract arguments (flags and positionals)
    const helpArgs: OHelpArg[] = Object.values(this._processed.help).map(
      (model) => {
        const isFlag = "short" in model;
        const usages = isFlag
          ? [
              (model as any).short ? `-${(model as any).short}` : "",
              `--${model.long}`,
            ].filter(Boolean)
          : [`<${model.long}>`];

        return {
          name: model.long,
          usages,
          type: model.type,
          description: (model as any).desc || "",
        };
      },
    );

    // 2. Extract usage cases from targets
    const usageCases: OHelpCase[] = Object.values(this._processed.targets).map(
      (target) => ({
        command: `${this._processed.name} ${target.name}`,
        description: `Execute task: ${target.name}`,
      }),
    );

    return {
      name: this._processed.name,
      description: this._processed.description,
      usage_cases: usageCases,
      arguments: helpArgs,
    };
  }
}
