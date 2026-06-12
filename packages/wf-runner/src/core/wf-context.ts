import { z } from "zod";

/**
 * @constant schWFContext
 * @description Schema for the workflow runtime context.
 */
export const schWFContext = z.object({
  /** The ID of the initial step. */
  init: z.string().default("init"),
  /** Security limit against infinite loops. */
  maxSteps: z.number().int().positive().default(20),
});

/**
 * @type tsWFContext
 * @description Type-safe workflow runtime context.
 */
export type tsWFContext = z.infer<typeof schWFContext>;

/**
 * @function createWFContext
 * @description Factory for creating and validating a workflow context.
 */
export const createWFContext = (opts?: Partial<tsWFContext>): tsWFContext => {
  return schWFContext.parse(opts ?? {});
};
