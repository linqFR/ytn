import { z } from "zod";
import { type tsParseArgObjectName, type tsParseArgString } from "../config/parse-args.js";
import { tsBitCodes, tsBitGroups, tsBitRouter, tsInterceptor } from "./bit-router.types.js";

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
  intercept?: boolean;
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
  flags: Record<tsParseArgObjectName, tsProcessedFlag>;
  positionals: Record<tsParseArgObjectName, tsProcessedPositional>;
};

/**
 * @type tsParsedCLI
 * @description Final result object of the CLI parsing, after name mapping.
 */
export type tsParsedCLI = Record<
  tsParseArgObjectName,
  string | boolean | string[] | undefined
> & { discriminant?: string };

/** @type tsParseArgsResultParser - Zod result parser for the CLI mapping. */
export type tsParseArgsResultParser = z.ZodType<tsParsedCLI, any>;

/** @type tsProcessedTarget - Deeply resolved target metadata. */
export interface tsProcessedTarget {
  name: tsParseArgObjectName;
  zod: z.ZodObject<any>;
  bitCode: bigint;
  bitSignature: string;
  fields: Record<tsParseArgString, string>;
}

/** @type tsProcessedDataModel - Unified metadata for any CLI argument (positional or flag). */
export type tsProcessedDataModel = (tsProcessedPositional & { type: "string" }) | tsProcessedFlag;

/** @type tsDiscriminantMap - Mapping from positional argument name to a list of target names that use it. */
export type tsDiscriminantMap = Record<tsParseArgObjectName, tsParseArgObjectName[]>;

/** @type tsSignatureGroup - Internal grouping of targets by their bitmask signature. */
export type tsSignatureGroup = Record<string, tsParseArgObjectName[]>;

/** @type tsRouteOutput - The structured output of a successfully routed command. */
export type tsRouteOutput = Readonly<{
  route: tsParseArgObjectName;
  data: Record<string, any>;
}>;

// Response Definition (Centralized in Types)
/** @type tsResponse - Union type for success or error command response. */
export type tsResponse<T = any> = 
  | Readonly<{ route: tsParseArgObjectName; data: T; error?: never }>
  | Readonly<{ route: tsParseArgObjectName; data?: never; error: any }>
;

/** @type OResponse - Tagged response from the CLI. */
export type OResponse = tsResponse & z.$brand<"tsResponse">;

/** @type tsGate - The final gate schema for routing. */
export type tsGate = z.ZodType<OResponse, Record<string, any>>;

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
export interface tsProcessedContract {
  name: string;
  description: string;
  version?: string;
  cli: tsProcessedCliOUT;
  targets: Record<tsParseArgObjectName, tsProcessedTarget>;
  routing: {
    groups: tsBitGroups;
    def: tsBitCodes;
    router: tsBitRouter;
    interceptors: tsInterceptor;
    discriminants: tsDiscriminantMap;
    discriminantKeys: tsParseArgObjectName[];
    possibleValues: Record<tsParseArgObjectName, string[]>;
  };
  dataModels: Record<tsParseArgObjectName, tsProcessedDataModel>;
  parsingArgs: tsParseArgSchema;
  parseArgsResultParser: tsParseArgsResultParser;
  parseArgsConfig: any;
  zvoSchema: tsGate;
}
