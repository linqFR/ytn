import { z } from "zod";
import { type ISealedInterface } from "./sealer.js";
import { FORBIDDEN_MODIFIERS, InternalKeys } from "./zod-modifiers.js";

export type tsForbidden = InternalKeys | (typeof FORBIDDEN_MODIFIERS)[number];

/**
 * Utility type to "seal" a Zod type or factory.
 * It recursively obscures forbidden methods to prevent contract pollution
 * while preserving the original schema via the `.toZod` escape hatch.
 */
export type $Sealed<T> = 0 extends 1 & T
  ? T
  : T extends (...args: infer A) => infer R
  ? (...args: A) => $Sealed<R>
  : T extends { _zod: any }
  ? {
      [K in keyof T as K extends tsForbidden ? never : K]: $Sealed<T[K]>;
    } & ISealedInterface<
      z.output<T>,
      z.input<T>,
      T & z.ZodType<any, any, any>
    > &
      ("default" extends keyof T
        ? {
            default(
              def: z.input<T> | (() => z.input<T>),
            ): $Sealed<z.ZodDefault<T extends z.ZodTypeAny ? T : any>>;
          }
        : unknown)
  : T;

/**
 * Specialized sealing for namespaces (objects containing factories).
 * Does not recurse as deeply as Sealed to avoid compiler serialization issues.
 */
export type $NamespaceSealed<T> = {
  [K in keyof T as K extends tsForbidden ? never : K]: T[K] extends (
    ...args: infer A
  ) => infer R
    ? (...args: A) => $Sealed<R>
    : T[K];
};
