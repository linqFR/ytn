/**
 * Pre-compiled queries facade.
 *
 * Each table cluster has its own compile function in a dedicated file.
 * This module assembles them into the full IQueries store.
 *
 * File organization:
 * - decisions.ts    — decisions CRUD + reports
 * - actions.ts      — actions CRUD + open actions + junction tables + reports
 * - ideas.ts        — ideas CRUD + reports
 * - problems.ts     — problems CRUD + reports
 * - specs.ts        — specs CRUD + reports
 * - scopes-writers.ts — scopes (recursive CTE) + writers (cursor)
 * - log-entries.ts  — log_entries append-only journal + threads + reports
 * - status-history.ts — status_history append-only audit
 * - lifecycle.ts    — inter-table relations + cross-entity audits
 * - shared.ts       — FTS5 search + transverse UNION
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { compileDecisionQueries } from "./decisions.js";
import { compileActionQueries } from "./actions.js";
import { compileIdeaQueries } from "./ideas.js";
import { compileProblemQueries } from "./problems.js";
import { compileSpecQueries } from "./specs.js";
import { compileScopeWriterQueries } from "./scopes-writers.js";
import { compileLogEntryQueries } from "./log-entries.js";
import { compileStatusHistoryQueries } from "./status-history.js";
import { compileLifecycleQueries } from "./lifecycle.js";
import { compileSharedQueries } from "./shared.js";

export type { IQueries } from "../types/queries.ts";

/** Compile all queries against a database. */
export function compileQueries(db: GovDb): IQueries {
  return {
    ...compileDecisionQueries(db),
    ...compileActionQueries(db),
    ...compileIdeaQueries(db),
    ...compileProblemQueries(db),
    ...compileSpecQueries(db),
    ...compileScopeWriterQueries(db),
    ...compileLogEntryQueries(db),
    ...compileStatusHistoryQueries(db),
    ...compileLifecycleQueries(db),
    ...compileSharedQueries(db),
  };
}
