import { z } from "zod";

/** @typedef {Record<string, any>} tsWFSpec */
export type tsWFSpec = Record<string, any>;

/** @typedef {Object} tsBoxedStep */
export type tsBoxedStep = {
  [x: string]: unknown;
  __step: string;
  __data: unknown;
};

/** @typedef {z.infer<typeof import("./core/schemas.js").stepSchema>} tsStep */
export type tsStep = {
  schema: any;
  on?: Record<string, string> | null;
  gate: (data: any, tools?: any) => any;
};

/** @typedef {Object} ParsedBoxedStep */
export type ParsedBoxedStep = {
  __step: string;
  __data: unknown;
  __def: tsStep;
};

export type tsBoxedStepDefHist = ParsedBoxedStep & { __history: string[] };
export type tsBoxedStepHist = tsBoxedStep & { __history: string[] };

/**
 * @typedef {z.ZodType<ParsedBoxedStep, any, any>} tsSchBoxedStep
 * @description Public type for individual step schemas.
 */
export type tsSchBoxedStep = z.ZodType<ParsedBoxedStep, any, any>;

/**
 * @typedef {Object} ParseOptions
 * @description Native Zod parsing options for async execution.
 */
export type ParseOptions = Parameters<z.ZodType["parseAsync"]>[1];
