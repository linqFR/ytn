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

/**
 * @type tsProcessedPositional
 * @description Represents a positional argument enriched with bitmask and original kebab-name.
 */
export type tsProcessedPositional = {
  long: tsParseArgString;
  bit: bigint;
};

/**
 * @type tsProcessedFlag
 * @description Represents a CLI flag enriched with bitmask and original kebab-name.
 */
export type tsProcessedFlag = {
  type: "string" | "boolean";
  short: string;
  desc?: string;
  long: tsParseArgString;
  bit: bigint;
};

/**
 * @type tsParseArgSchema
 * @description Structure expected by the CLI parser for node:util.parseArgs configuration.
 */
export type tsParseArgSchema = {
  positionals: string[];
  options: Record<string, { type: "string" | "boolean"; short: string }>;
};

/**
 * @type tsProcessedCliOUT
 * @description Structure of the CLI configuration after being processed (with bitmasks and long names).
 */
export type tsProcessedCliOUT = {
  flags: Record<tsTargetFieldName, tsProcessedFlag>;
  positionals: Record<tsTargetFieldName, tsProcessedPositional>;
};

/**
 * @type tsParsedCLI
 * @description Final result object of the CLI parsing, after name mapping.
 */
export type tsParsedCLI = Record<
  tsTargetFieldName,
  string | boolean | string[] | undefined
> & { discriminant?: string };

/** @type tsParseArgsResultParser - Zod result parser for the CLI mapping. */
export type tsParseArgsResultParser = z.ZodType<tsParsedCLI, any>;

/** @type tsProcessedTarget - Deeply resolved target metadata. */
export interface tsProcessedTarget {
  name: tsTargetName;
  zod: z.ZodObject <any>;
  targetCode: bigint;
  targetMask: bigint;
  targetSignatures: string[];
  fields: Record<tsParseArgString, string>;
}

/** @type tsProcessedDataModel - Unified metadata for any CLI argument (positional or flag). */
export type tsProcessedDataModel =
  | (tsProcessedPositional & { type: "string" })
  | tsProcessedFlag;

/** @type tsDiscriminantMap - Mapping from positional argument name to a list of target names that use it. */
export type tsDiscriminantMap = Record<tsTargetFieldName, tsTargetName[]>;

export type tsPossibleValuesSet = Record<
  tsTargetFieldName,
  Record<tsTargetName, Set<string>>
>;

/** @type tsSignatureGroup - Internal grouping of targets by their bitmask signature. */
export type tsSignatureGroup = Record<string, tsTargetName[]>;

/** @type tsRouteOutput - The structured output of a successfully routed command. */
export type tsRouteOutput = Readonly<{
  route: tsTargetName;
  data: Record<string, any>;
}>;

// Response Definition (Centralized in Types)
/** @type tsResponse - Union type for success or error command response. */
export type tsResponse<T = any> =
  | Readonly<{ route: tsTargetName; data: T; error?: never }>
  | Readonly<{ route: tsTargetName; data?: never; error: any }>;

/** @type OResponse - Tagged response from the CLI. */
export type OResponse = tsResponse & z.$brand<"tsResponse">;

export type $SafeResult<T extends OResponse = OResponse> =
  z.ZodSafeParseResult<T>;

/** @type tsGate - The final gate schema for routing. */
export type tsGate = z.ZodType<OResponse, Record<tsTargetName, any>>;

/**
 * @interface OHelpArg
 * @description Structured metadata for an argument or flag for help generation.
 */
export interface OHelpArg {
  name: string;
  arg_name?: string;
  usages?: string[];
  position?: number;
  type: string;
  description: string;
}

/**
 * @interface OHelpCase
 * @description A specific command usage scenario.
 */
export interface OHelpCase {
  command: string;
  description: string;
}

/**
 * @interface OHelpData
 * @description Full structured help data for the CLI, ready for the help formatter.
 */
export interface OHelpData {
  name: string;
  description: string;
  usage_cases: OHelpCase[];
  arguments: OHelpArg[];
}

/**
 * @interface tsProcessedContract
 * @description Fully resolved and factored contract object.
 * Renamed from tsContractOUT to avoid circular dependency with Zod inference.
 */
export interface IProcessedContract {
  name: string;
  description: string;
  version?: string;
  cli: tsProcessedCliOUT;
  targets: Record<tsTargetName, tsProcessedTarget>;
  routing: {
    groups: tsBitGroups;
    def: tsBitCodes;
    router: tsBitRouter;
    /*
    interceptors: tsInterceptors;
    interceptorMask: tsInterceptorMask;
    */
    discriminants: tsDiscriminantMap;

    discriminantKeys: tsTargetFieldName[];
    possibleValues: tsPossibleValuesArray;
    masks: tsRoutingMasks;
    fallbackSignature?: string;
  };
  dataModels: Record<tsTargetFieldName, tsProcessedDataModel>;
  parsingArgs: tsParseArgSchema;
  parseArgsResultParser: tsParseArgsResultParser;
  parseArgsConfig: any;
  zvoSchema: tsGate;
  router: tsBitRouter;
  help: Record<tsTargetFieldName, tsProcessedDataModel>;
  fallbackSchema?: z.ZodType;
}
