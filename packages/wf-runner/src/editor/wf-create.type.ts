/**
 * @file wf-create.type.ts
 * @description Type-level utilities for defining and validating workflows.
 */

/**
 * @type $GetStepKeys
 * @description Extracts the keys of the workflow specification.
 */
type $GetStepKeys<T> = keyof T & string;

/**
 * @type $ValidateTransitions
 * @description Ensures each transition target in the 'on' block exists as a step.
 */
type $ValidateTransitions<On, AllowedKeys extends string> = {
  [K in keyof On]: On[K] extends AllowedKeys
    ? On[K]
    : `ERROR: Step '${On[K] & string}' is not defined. Misspelled or missing?`;
};

/**
 * @type tsValidateWorkflow
 * @description A top-level validation helper that checks workflow integrity,
 * specifically ensuring that step transitions (the 'on' field) are consistent.
 *
 * @example
 * const myWF = {
 *   start: { on: { ok: "end" }, gate: () => {} },
 *   end: { gate: () => {} }
 * } satisfies tsValidateWorkflow<typeof myWF>;
 */
export type tsValidateWorkflow<T> = {
  [Step in keyof T]: T[Step] extends { on?: infer On }
    ? T[Step] & {
        on?: $ValidateTransitions<On, $GetStepKeys<T>>;
      }
    : T[Step];
};
