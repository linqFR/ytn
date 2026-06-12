import { z } from "zod";
import { type tsWFStep } from "./step.type.js";

/** @type {Record<string, unknown>} tsWFSpec */
export type tsWFSpec = Record<string, tsWFStep<any, any>>;

/** @type {Object} tsBoxedStep */
export type tsBoxedStep = {
  [x: string]: unknown;
  __step: string;
  __data: unknown;
};

/** @type {Object} tsParsedBoxedStep */
export type tsParsedBoxedStep = {
  __step: string;
  __data: unknown;
  __def: tsWFStep<any, any>;
  /** Optional execution history for this step instance. */
  __history?: string[];
};

/** @type {Object} tsBoxedStepDefHist */
export type tsBoxedStepDefHist = tsParsedBoxedStep & { __history: string[] };

/** @type {Object} tsBoxedStepHist */
export type tsBoxedStepHist = tsBoxedStep & { __history?: string[] };

/**
 * @type tsSchBoxedStep
 * @description Zod schema type for a validated boxed step.
 * Must extend $ZodTypeDiscriminable to be used in discriminated unions.
 */
export type tsSchBoxedStep = z.ZodType<tsParsedBoxedStep, tsBoxedStepHist> &
  z.core.$ZodTypeDiscriminable;

/**
 * @type {Object} tsParseOptions
 * @description Native Zod parsing options for async execution.
 */
export type tsParseOptions = Parameters<z.ZodType["parseAsync"]>[1];
