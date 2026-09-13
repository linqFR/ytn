/**
 * constants.ts — Shared DNA schema constants used across tool-inputs and tool-outputs.
 *
 * Contains common building-block schemas (nanoid, entity ID, scope, etc.)
 * and shared row schemas (placeholder `dna.any()` for complex row types).
 */

import { dna } from "@ytrynot/dna";
import {
  ACTION_STATUSES,
  DECISION_STATUSES,
  ENTITY_TYPES,
  IDEA_PRIORITIES,
  IDEA_STATUSES,
  LOG_ENTRY_TYPES,
  PRIORITIES,
  PROBLEM_ACTION_ROLES,
  PROBLEM_STATUSES,
  PROBLEM_TYPES,
  SEVERITIES,
  SOURCE_TYPES,
  SPEC_STATUSES,
  TESTED_STATUSES,
  WRITER_ROLES,
} from "../enums.js";

// ─── Common schemas ──────────────────────────────────────────────────────────

export const nanoidSchema = dna.nanoid({ length: 21 }).describe("Your secret writer token");

export const entityIdSchema = dna.string().min(1).max(50).describe("Entity ID");

/** Forced entity seq — just the number (e.g. 90001). The prefix is added by the tool. */
export const forcedNumIdSchema = dna.int().min(1).max(10000).optional().describe("Force a specific seq number (1-10000)");

export const scopeSchema = dna.string().min(1).max(100).describe("Scope ID");

/** Array of scope IDs. */
export const scopeOrScopesSchema = scopeSchema.array().optional().describe("Array of scope IDs");

/** When true, scope filtering includes all descendant scopes (recursive CTE). Default: false. */
export const withChildrenSchema = dna.boolean().optional().describe("Include descendant scopes (recursive)");

/** Target audience for log entries. Array of writer IDs, or ["all"] for broadcast. */
export const audienceSchema = dna.string().min(1).max(100).array().optional().describe('Target audience: ["all"] (broadcast, default), or array of writer IDs (e.g. ["writer1","writer2"]). If you want a specific writer to see your write, include their writer ID here — do not rely on scope-sharing alone.');

/**
 * Date input schema for write operations (entity creation, log entries).
 * Requires at least HH:MM — date-only (YYYY-MM-DD) is rejected.
 *
 * Accepted formats:
 * - `YYYY-MM-DD HH:MM` → local time
 * - `YYYY-MM-DDTHH:MM` → local time
 * - `YYYY-MM-DD HH:MMZ` / `YYYY-MM-DDTHH:MMZ` → GMT/UTC
 * - Full ISO with `Z` or `±HH:MM` offset → explicit timezone
 *
 * Rule: no timezone suffix → local time; `Z` or offset → GMT/UTC.
 * All values are stored as full ISO 8601 (UTC) in the database.
 */
export const dateSchema = dna.preprocess(
  (v) => {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}(Z?)$/.test(v.trim())) {
      throw new Error("Date must include time (HH:MM). Use YYYY-MM-DD HH:MM or YYYY-MM-DDTHH:MM for local time of suffix it with 'Z' for GMT/UTC Time");
    }
    return v;
  },
  dna.coerce.date().transform((d: Date) => d.toISOString()),
).describe("Date with time (YYYY-MM-DD HH:MM, YYYY-MM-DDTHH:MM, or full ISO. Without Z/offset = local; with Z/offset = GMT/UTC)");

/**
 * Date filter schema for read operations (list_log_entries, daily report).
 * Accepts date-only (YYYY-MM-DD) for filtering, plus all formats supported by dateSchema.
 */
export const dateFilterSchema = dna.preprocess(
  (v) => {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
      return v.trim() + "T00:00:00";
    }
    return v;
  },
  dna.coerce.date().transform((d: Date) => d.toISOString()),
).describe("Date filter (YYYY-MM-DD, YYYY-MM-DD HH:MM, YYYY-MM-DDTHH:MM, or full ISO)");

/**
 * Date-only schema for report generation. Accepts YYYY-MM-DD and keeps it as-is
 * (no timezone conversion) so LIKE queries and filenames use the intended date.
 */
export const dateOnlySchema = dna.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date (YYYY-MM-DD)");

export const timestampSchema = dna.iso.datetime().describe("ISO datetime");

export const limitSchema = dna.int().min(1).max(1000).optional().describe("Max results (1-1000, default 100)");

// ─── Entity status enums ─────────────────────────────────────────────────────

export const decisionStatusSchema = dna.enum(DECISION_STATUSES);
export const actionStatusSchema = dna.enum(ACTION_STATUSES);
export const ideaStatusSchema = dna.enum(IDEA_STATUSES);
export const problemStatusSchema = dna.enum(PROBLEM_STATUSES);
export const testedStatusSchema = dna.enum(TESTED_STATUSES);
export const specStatusSchema = dna.enum(SPEC_STATUSES);
export const severitySchema = dna.enum(SEVERITIES);
export const problemTypeSchema = dna.enum(PROBLEM_TYPES).describe("Problem domain: spec = spec/ADR issue, code = code/runtime issue, doc = documentation issue");
export const prioritySchema = dna.enum(PRIORITIES);
export const ideaPrioritySchema = dna.enum(IDEA_PRIORITIES);
export const sourceTypeSchema = dna.enum(SOURCE_TYPES);
export const writerRoleSchema = dna.enum(WRITER_ROLES);
export const logEntryTypeSchema = dna.enum(LOG_ENTRY_TYPES);
export const entityTypeSchema = dna.enum(ENTITY_TYPES);
export const problemActionRoleSchema = dna.enum(PROBLEM_ACTION_ROLES);