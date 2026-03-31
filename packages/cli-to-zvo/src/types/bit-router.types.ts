import { tsTargetFieldName, tsTargetName } from "../config/parse-args.js";

export type tsBitCodes = Record<tsTargetFieldName, bigint>;
export type tsBitRouter = Record<string, tsTargetName | tsTargetName[]>;
export type tsBitRouterSet = Record<string, Set<tsTargetName>>;
export type tsBitGroups = Map<bigint, tsTargetName[]>;

export type tsRoutingMasks = Record<string, bigint[]>;
export type tsRoutingMasksSet = Record<string, Set<bigint>>;

export type tsRoutingSignature = string;
export type tsRoutingValues = string[];
export type tsRoutingKeys = tsTargetFieldName[];
export type tsRoutingShape = string;
export type tsRoutingMask = bigint;
export type tsKnownKeys = Set<tsTargetFieldName>;

export type tsPossibleValuesData = Record<tsTargetName, tsRoutingValues>;
export type tsPossibleValuesArray = Record<
  tsTargetFieldName,
  tsPossibleValuesData
>;
