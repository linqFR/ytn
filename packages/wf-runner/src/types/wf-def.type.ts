import { z } from "zod";

/**
 * @function uStep
 * @description Local step definition. Handles schema -> data inference immediately.
 * Does not depend on global state, avoiding circularity.
 * Use this as a helper inside uDefineWF.
 */
export function uStep<
  S extends z.ZodTypeAny = any,
  const O extends Record<string, string> | undefined = undefined,
>(config: {
  schema?: S;
  on?: O;
  gate: (
    data: S extends z.ZodTypeAny ? z.infer<S> : unknown,
    tools: {
      send: (signal: string, data?: any) => any;
      end: (data?: any) => void;
      issues: Record<string, any>;
    },
  ) => any;
}) {
  return config;
}

/**
 * @function uDefineWF
 * @description Global workflow definition. Validates that all 'on' destinations
 * exist as keys in the workflow.
 */
export const uDefineWF = <const T extends Record<string, any>>(config: {
  [K in keyof T]: T[K] & {
    on?: Record<string, keyof T>;
  };
}): T => config as any;
