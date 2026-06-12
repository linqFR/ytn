import type { $brand } from "zod";

/**
 * Branded types for strict type-level isolation.
 */

/**
 * @type {T & { [$brand]: { [P in K]: true } }} $Branded
 * @description Type Branding Utility strictly compatible with Zod's internal mechanism.
 * Uses Zod's unique $brand symbol to ensure that static types (ts*) and validated 
 * schemas (sch*) are perfectly converged and interchangeable.
 *
 * @template T - The base primitive or object type.
 * @template {string} K - The unique literal brand name.
 */
export type $Branded<T, K extends string> = T & {
  readonly [$brand]: {
    readonly [P in K]: true;
  };
};