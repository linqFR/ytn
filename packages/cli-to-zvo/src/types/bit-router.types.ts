import { tsTargetFieldName, tsTargetName } from "../config/parse-args.js";

/**
 * @type tsBitCodes
 * @description Map of target field names to their unique bitmask.
 */
export type tsBitCodes = Record<tsTargetFieldName, number>;

/**
 * @type tsBitRouter
 * @description Flat routing table mapping bitmask-based signatures to matching target names.
 */
export type tsBitRouter = Record<string, tsTargetName | tsTargetName[]>;

/**
 * @type tsBitRouterSet
 * @description Internal structure for gathering targets associated with a single signature during compilation.
 */
export type tsBitRouterSet = Record<string, Set<tsTargetName>>;

/**
 * @type tsBitGroups
 * @description Groups target names by their cumulative bitcode.
 */
export type tsBitGroups = Map<number, tsTargetName[]>;

/**
 * @type tsRoutingMasks
 * @description Map of field names to the set of bitmasks they can contribute to.
 */
export type tsRoutingMasks = Record<string, number[]>;

/**
 * @type tsRoutingMasksSet
 * @description Internal set-based version of tsRoutingMasks used for building non-overlapping masks.
 */
export type tsRoutingMasksSet = Record<string, Set<number>>;

/**
 * @type tsRoutingSignature
 * @description The serialized string representation (Bitmask + Literals) used to identify a route.
 */
export type tsRoutingSignature = string;

/**
 * @type tsRoutingValues
 * @description An array of literal field values in routing order.
 */
export type tsRoutingValues = string[];

/**
 * @type tsRoutingKeys
 * @description An ordered array of field names used to build the routing signature.
 */
export type tsRoutingKeys = tsTargetFieldName[];

/**
 * @type tsRoutingShape
 * @description A string representing the unique signature pattern of a route.
 */
export type tsRoutingShape = string;

/**
 * @type tsRoutingMask
 * @description A numeric bitmask representing a combination of CLI arguments.
 */
export type tsRoutingMask = number;

/**
 * @type tsKnownKeys
 * @description Set of all field names that appear in any target signature.
 */
export type tsKnownKeys = Set<tsTargetFieldName>;

/**
 * @type tsPossibleValuesData
 * @description Mapping from target names to the set of literal values they require for a specific field.
 */
export type tsPossibleValuesData = Record<tsTargetName, tsRoutingValues>;

/**
 * @type tsPossibleValuesArray
 * @description Global registry of all possible literal values across all fields and targets.
 */
export type tsPossibleValuesArray = Record<
  tsTargetFieldName,
  tsPossibleValuesData
>;
