import { FUNC_SERIALIZED_REGEX } from "@ytn/shared/zod/vm-codecs.js";
import { z } from "zod";
import { TERMINAL_STEP_ID } from "./constants.js";
import { schWFGateFn } from "./gate-schema.js";
import type { tsWFStep } from "../types/step.type.js";
import { vmCodec } from "./wfconfig.js";
import type { tsSchBoxedStep } from "../types/runtime.types.js";

/** @constant schWFSchema */
export const schWFSchema = z.instanceof(z.ZodType).optional();

/** @constant schWFONMap */
export const schWFONMap = z.record(z.string(), z.string()).optional();

/**
 * @constant stepAOTSchema
 * @description Zod schema for a single serialized workflow step.
 */
export const schWFStepString = z.strictObject({
  /** The Zod schema to validate inputs (optional, defaults to any). */
  schema: schWFSchema,
  /** Mapping of logical signals to target step IDs. */
  on: schWFONMap,

  /** The functional logic (gate) to execute for this step. */
  gate: z.string().trim().regex(FUNC_SERIALIZED_REGEX).pipe(vmCodec),
});

/**
 * @constant schWFStepSchema
 * @description Universal Zod schema for a workflow step (Live or Serialized).
 */
export const schWFStepSchema = z.union([
  z.strictObject({
    schema: schWFSchema,
    on: schWFONMap,
    gate: schWFGateFn,
  }),
  schWFStepString,
]);

/**
 * @function boxedStepSchemaFactory
 * @description Factory for creating a boxed step validator.
 */
export const boxedStepSchemaFactory = (
  stepId: string,
  def: tsWFStep,
): tsSchBoxedStep => {
  return z
    .strictObject({
      __step: z.literal(stepId),
      __data: (def.schema as z.ZodType) ?? z.any(),
      __history: z.string().array().optional(),
    })
    .transform((v) => ({
      ...v,
      __def: def,
    })) as unknown as tsSchBoxedStep;
};

/**
 * @constant terminalStepSchema
 * @description Schema for the terminal exit point of a workflow.
 */
export const terminalStepSchema = z.strictObject({
  __step: z.literal(TERMINAL_STEP_ID),
  __data: z.any(),
  __history: z.string().array().optional().default([]),
});
