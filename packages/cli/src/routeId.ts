/**
 * Route ID — single source of truth for the \x00ID route header convention.
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
 * - The record-based injection helper (`$InjectedRoutesRecord`)
 */

import type { DnaLiteral, DnaObject } from "@ytrynot/dna/core";
import type { $Flatten } from "@ytrynot/shared/types/structural.type.js";

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
 *  and as the _output brand in $InjectedRoutesRecord. */
export type $RouteId = string & { _routeId: true };

/** Route ID property signature — derived from the runtime constant so the
 *  literal "\x00ID" lives in exactly one place. Used as a constraint in
 *  buildPipeline and as the _output shape reference. */
export type $RouteIdProp = { [K in typeof ROUTE_ID_KEY]: $RouteId };

// ============================================================
// Record-based route helpers (named targets)
// ============================================================

/** The \x00ID property typed as a literal of the routeId (the object key).
 *  Runtime uses `dna.string().default(routeId)`, but the type pretends
 *  `DnaLiteral<K>` so `_output["\x00ID"] = K` (the literal routeId). */
type $InjectedRouteIdProp<RouteId extends string> = Record<
  typeof ROUTE_ID_KEY,
  DnaLiteral<RouteId>
>;

/** Map a Record<string, DnaObject> to its injected versions — each key K
 *  becomes `DnaObject<Shape & { "\x00ID": DnaLiteral<K> }>` with a branded
 *  `_output["\x00ID"]` so that buildPipeline's `$RouteIdProp` constraint is
 *  satisfied. */
export type $InjectedRoutesRecord<T extends Record<string, DnaObject>> = {
  [K in keyof T]: T[K] extends DnaObject<infer Shape>
    ? K extends string
      ? DnaObject<$Flatten<Shape & $InjectedRouteIdProp<K>>> & {
          readonly _output: { [P in typeof ROUTE_ID_KEY]: $RouteId };
        }
      : never
    : never;
};
