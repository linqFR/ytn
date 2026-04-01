import { z } from "zod";
import type {
  tsParseArgString,
  tsTargetFieldName,
  tsTargetName,
} from "../config/parse-args.js";
import type {
  tsBitCodes,
  tsBitRouter,
  tsBitGroups,
  tsPossibleValuesArray,
  tsRoutingMasks,
} from "./bit-router.types.js";
import type { tsDecisionNode } from "./tree.types.js";

/**
 * @type tsProcessedPositional
 * @description Represents a positional argument enriched with bitmask and original kebab-name.
 */
export type tsProcessedPositional = {
  /** The full name of the positional argument (kebab-case from CLI config). */
  long: tsParseArgString;
  /** The unique bitmask assigned to this positional for routing calculations. */
  bit: number;
};

/**
 * @type tsProcessedFlag
 * @description Represents a CLI flag enriched with its metadata and bitmask.
 */
export type tsProcessedFlag = {
  /** The expected data type of the flag value. */
  type: "string" | "boolean";
  /** The single-character alias for the flag (e.g., 'v' for '-v'). */
  short: string;
  /** An optional description of the flag for help documentation. */
  desc?: string;
  /** The full name of the flag (e.g., 'verbose' for '--verbose'). */
  long: tsParseArgString;
  /** The unique bitmask assigned to this flag for routing calculations. */
  bit: number;
};

/**
 * @type tsParseArgSchema
 * @description Configuration structure required by Node's util.parseArgs to define the CLI parser.
 */
export type tsParseArgSchema = {
  /** List of positional argument names in their expected order. */
  positionals: string[];
  /** Mapping of option long names to their type and short alias. */
  options: Record<string, { type: "string" | "boolean"; short: string }>;
};

/**
 * @type tsProcessedCliOUT
 * @description The unified result of processing the CLI configuration, containing enriched flags and positionals.
 */
export type tsProcessedCliOUT = {
  /** Map of target field names to their processed flag metadata. */
  flags: Record<tsTargetFieldName, tsProcessedFlag>;
  /** Map of target field names to their processed positional metadata. */
  positionals: Record<tsTargetFieldName, tsProcessedPositional>;
};

/**
 * @type tsParsedCLI
 * @description The result object returned after the raw CLI arguments have been parsed and mapped to target names.
 */
export type tsParsedCLI = Record<
  tsTargetFieldName,
  string | boolean | string[] | undefined
> & {
  /** An optional discriminant used to fine-tune routing when bitmasks are ambiguous. */
  discriminant?: string;
};

/**
 * @type tsParseArgsResultParser
 * @description A Zod schema used to validate and transform the output of the CLI parsing stage.
 */
export type tsParseArgsResultParser = z.ZodType<tsParsedCLI, any>;

/**
 * @interface tsProcessedTarget
 * @description Deeply resolved metadata for a specific logical target (command/tool) defined in the contract.
 */
export interface tsProcessedTarget {
  /** The unique name of the target. */
  name: tsTargetName;
  /** The Zod schema associated with this target for final payload validation. */
  zod: z.ZodObject<any>;
  /** The unique bitcode identifying this target's specific combination of required arguments. */
  targetCode: number;
  /** The mask of all bits that ARE required to be present for this target to match. */
  targetRequiredBits: number;
  /** The mask of all bits that MAY be present for this target. */
  targetMask: number;
  /** All possible bitmask signature strings that can resolve to this target. */
  targetSignatures: string[];
  /** A map of literal values required by this target for specific fields. */
  targetLiterals: Record<tsTargetFieldName, string[]>;
  /** A reverse mapping of CLI kebab-names to target field names. */
  fields: Record<tsParseArgString, string>;
}

/**
 * @type tsProcessedDataModel
 * @description A unified view of an argument (flag or positional) used for help generation and internal tracking.
 */
export type tsProcessedDataModel =
  | (tsProcessedPositional & { type: "string" })
  | tsProcessedFlag;

/**
 * @type tsDiscriminantMap
 * @description A mapping from a field name to the set of literal values it can take to act as a routing discriminant.
 */
export type tsDiscriminantMap = Record<tsTargetFieldName, string[]>;

/**
 * @type tsPossibleValuesSet
 * @description Internal tracking for possible values across all targets, used to optimize routing trees.
 */
export type tsPossibleValuesSet = Record<
  tsTargetFieldName,
  Record<tsTargetName, Set<string>>
>;

/**
 * @type tsSignatureGroup
 * @description Groups target names by their bitmask signature for O(1) routing lookups.
 */
export type tsSignatureGroup = Record<string, tsTargetName[]>;

/**
 * @type tsRouteOutput
 * @description The result of a successful routing operation, pairing a target name with its validated data.
 */
export type tsRouteOutput = Readonly<{
  /** The name of the target that was successfully matched. */
  route: tsTargetName;
  /** The validated data payload for that target. */
  data: Record<string, any>;
}>;

/**
 * @type tsResponse
 * @description A standard union response type for CLI commands, handling both success and error paths.
 */
export type tsResponse<T = any> =
  | Readonly<{ route: tsTargetName; data: T; error?: never }>
  | Readonly<{ route: tsTargetName; data?: never; error: any }>;

/**
 * @type OResponse
 * @description A branded version of tsResponse, used to ensure type safety in the Zod-to-CLI pipeline.
 */
export type OResponse = tsResponse & z.$brand<"tsResponse">;

/**
 * @type $SafeResult
 * @description Alias for Zod's safe parse result specifically for CLI responses.
 */
export type $SafeResult<T extends OResponse = OResponse> =
  z.ZodSafeParseResult<T>;

/**
 * @type tsGate
 * @description The final "Gate" Zod schema which handles the entire routing and validation pipeline from CLI input.
 */
export type tsGate = z.ZodType<OResponse, Record<tsTargetName, any>>;

/**
 * @interface OHelpArg
 * @description Metadata for a single CLI argument or flag, formatted for display in help output.
 */
export interface OHelpArg {
  /** The primary name of the argument. */
  name: string;
  /** Internal field name if different from the display name. */
  arg_name?: string;
  /** List of usage strings (e.g., ["-v", "--verbose"]). */
  usages?: string[];
  /** 0-based position of the argument if it is a positional. */
  position?: number;
  /** Human-readable type string (e.g., "string", "boolean"). */
  type: string;
  /** Description of the argument's purpose. */
  description: string;
}

/**
 * @interface OHelpCase
 * @description A single valid command-line example or usage scenario for the CLI.
 */
export interface OHelpCase {
  /** The unique name of the target for this usage case. */
  target: string;
  /** The example command string. */
  command: string;
  /** A description of what this command example does. */
  description: string;
}

/**
 * @interface OHelpOptions
 * @description Configuration options to customize the generated help output.
 */
export interface OHelpOptions {
  /** Override the primary CLI command name in usage strings. */
  cmd?: string;
  /** Mapping of target names to custom descriptions for the help screen. */
  desc?: Record<string, string>;
}

/**
 * @interface OHelpData
 * @description The complete collection of metadata needed to render a comprehensive help screen for the CLI.
 */
export interface OHelpData {
  /** The name of the CLI tool. */
  name: string;
  /** A general description of the tool. */
  description: string;
  /** A list of common usage examples. */
  usage_cases: OHelpCase[];
  /** A list of all available arguments and flags. */
  arguments: OHelpArg[];
}

/**
 * @interface IProcessedContract
 * @description The final, fully compiled CLI contract ready for runtime use.
 * This object contains all bitmasks, routing trees, and validation schemas.
 */
export interface IProcessedContract {
  /** Name of the CLI. */
  name: string;
  /** Description of the CLI. */
  description: string;
  /** Optional version number. */
  version?: string;
  /** Processed CLI flags and positionals. */
  cli: tsProcessedCliOUT;
  /** Detailed metadata for every defined target. */
  targets: Record<tsTargetName, tsProcessedTarget>;
  /** Internal routing engine state. */
  routing: {
    /** Target groups by signature. */
    groups: tsBitGroups;
    /** Bitcode definitions for targets. */
    def: tsBitCodes;
    /** The bit-level router. */
    router: tsBitRouter;
    /** Mapping of positional names to their literal values for discrimination. */
    discriminants: tsDiscriminantMap;
    /** Ordered keys used for discrimination. */
    discriminantKeys: tsTargetFieldName[];
    /** Possible values for each field. */
    possibleValues: tsPossibleValuesArray;
    /** Routing masks for bitwise resolution. */
    masks: tsRoutingMasks;
    /** Optimized decision tree for fast routing. */
    tree: tsDecisionNode | tsTargetName[];
    /** Signature used for fallback if no target matches perfectly. */
    fallbackSignature?: string;
  };
  /** Unified data models for all interface fields. */
  dataModels: Record<tsTargetFieldName, tsProcessedDataModel>;
  /** Schema for Node's util.parseArgs. */
  parsingArgs: tsParseArgSchema;
  /** Zod parser for CLI result mapping. */
  parseArgsResultParser: tsParseArgsResultParser;
  /** Raw config for parseArgs. */
  parseArgsConfig: any;
  /** The "Gate" schema representing the entry point into the routing logic. */
  zvoSchema: tsGate;
  /** The high-performance bitwise router instance. */
  router: tsBitRouter;
  /** Help metadata for all arguments. */
  help: Record<tsTargetFieldName, tsProcessedDataModel>;
  /** Optional fallback schema for catch-all behavior. */
  fallbackSchema?: z.ZodType;
}

/**
 * @type ValidateContract
 * @description A recursive validation helper that ensures targets are not empty and follow project rules at compile time.
 */
export type ValidateContract<T> = T & {
  targets: {
    [K in keyof (T extends { targets: infer Tar }
      ? Tar
      : object)]: keyof (T extends { targets: Record<K, infer Fields> }
      ? Fields
      : object) extends never
      ? "ERROR: Target fields cannot be empty. Use 'fallbacks' for catch-all (with at least one field)."
      : T extends { targets: Record<K, infer Fields> }
      ? Fields
      : never;
  };
};
