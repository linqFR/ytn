/**
 * Route ID — single source of truth for the \x00ID route header convention (DEC-0027).
 *
 * `createContract()` injects `\x00ID: dna.string().default(routeId)` via `apply()` into
 * each route. The NUL byte prefix makes it impossible to pass as a CLI argument
 * (NUL-terminated C-strings on Unix, rejected by Node.js `child_process.spawn`).
 * `\x00ID` is filtered from `toParseArgsConfig().options` and stripped from the
 * final `payload` by the extract transform in `preprocess.ts`.
 *
 * This module centralizes:
 * - The runtime constant (`ROUTE_ID_KEY`)
 * - The branded type marker (`$RouteId`)
 * - The property signature type (`$RouteIdProp`)
 * - Type-level injection helpers (`InjectedRoute`, `InjectedRoutes`)
 */

import type { DnaDefault, DnaObject, DnaString } from "@ytrynot/dna/core";

// ============================================================
// Runtime constant
// ============================================================

/** The literal route ID key used at runtime. Single source of truth. */
export const ROUTE_ID_KEY = "\x00ID" as const;

// ============================================================
// Type-level
// ============================================================

/** Branded route ID marker — proves the route went through createContract's
 *  \x00ID injection, not an arbitrary union. Used as a constraint in buildPipeline
 *  and as the _output brand in InjectedRoute. */
export type $RouteId = string & { _routeId: true };

/** Route ID property signature — derived from the runtime constant so the
 *  literal "\x00ID" lives in exactly one place. Used as a constraint in
 *  buildPipeline and as the _output shape reference. */
export type $RouteIdProp = { [K in typeof ROUTE_ID_KEY]: $RouteId };

/** Type-level: inject \x00ID into a single route's shape.
 *  The _output is intersected with a branded route ID marker so that
 *  buildPipeline's constraint is satisfied — the brand acts as a proof
 *  that the route went through createContract's injection. */
export type InjectedRoute<S, K extends string> = S extends DnaObject<infer Shape>
  ? DnaObject<Shape & Record<K, DnaDefault<DnaString>>> & {
      readonly _output: { [P in K]: $RouteId };
    }
  : S;

/** Type-level: map a tuple of routes to their injected versions, preserving tuple structure. */
export type InjectedRoutes<T extends readonly DnaObject[], K extends string> = {
  [K2 in keyof T]: InjectedRoute<T[K2], K>
};
