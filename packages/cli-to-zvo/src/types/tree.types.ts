import type { tsTargetName } from "../config/parse-args.js";

/**
 * @interface ITargetMeta
 * @description Compact metadata used by the compiler to build an efficient routing decision tree.
 */
export interface ITargetMeta {
  /** The unique name of the target. */
  name: tsTargetName;
  /** Mask of bits that MUST be present for this target to trigger. */
  requiredBits: number;
  /** Mask of bits that MAY be present for this target. Used for optional arguments. */
  allowedBits: number;
}

/**
 * @type tsDecisionNode
 * @description A node in the binary decision tree used to resolve targets from an input bitmask.
 */
export type tsDecisionNode = {
  /** The specific bit (argument) being checked at this level of the tree. */
  bit: number;
  /** Branch followed if the bit is present in the input mask. */
  onTrue: tsDecisionNode | tsTargetName[];
  /** Branch followed if the bit is absent OR optional in the input mask. */
  onFalse: tsDecisionNode | tsTargetName[];
};
