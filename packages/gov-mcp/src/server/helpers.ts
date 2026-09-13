/**
 * Utility helpers for the governance MCP.
 */

import { nanoid as generateNanoid } from "nanoid";
import type { IToolCtx } from "./types/types.ts";
import { tables } from "./definitions/schema.js";

/** Generate a 21-character nanoid for writer tokens. */
export function generateWriterNanoid(): string {
  return generateNanoid(21);
}

/** Format an entity ID with prefix and zero-padded sequence. */
export function formatId(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

/** Get the current ISO date (YYYY-MM-DD). */
export function currentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Get the current ISO 8601 timestamp (e.g. 2026-09-04T20:06:33.123Z). */
export function currentTimestamp(): string {
  return new Date().toISOString();
}

/** Get the current UTC datetime in readable format (e.g. 2026-09-13 01:05 UTC). */
export function currentDateTimeUTC(): string {
  const iso = new Date().toISOString();
  return formatDateTimeUTC(iso);
}

/**
 * Format an ISO date string as a readable UTC date or datetime.
 * - `2026-09-13T01:00:00.000Z` → `2026-09-13 01:00 UTC`
 * - `2026-09-13T01:00:00.000+02:00` → `2026-09-12 23:00 UTC` (converted to UTC)
 * - `2026-09-13` → `2026-09-13` (date-only unchanged)
 * - `""` or nullish → `—`
 */
export function formatDateTimeUTC(iso: string | null | undefined): string {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

/**
 * Resolve scope filter: exact match or recursive (withChildren).
 * Returns a WHERE clause fragment and params object.
 * Uses a subquery against entity_scopes since there is no scope column on entity tables.
 * When withChildren is true, uses a recursive CTE subquery to match all descendant scopes.
 *
 * @param entityType - The entity_type value in entity_scopes (e.g. 'decision', 'log_entry')
 * @param idExpr - The SQL expression for the entity ID column (default 'id'; use 'CAST(id AS TEXT)' for INTEGER PKs)
 */
export function resolveScopeFilter(
  ctx: IToolCtx,
  scope: string,
  withChildren?: boolean,
  entityType?: string,
  idExpr: string = "id",
): { clause: string; params: Record<string, unknown> } {
  const et = entityType ?? "decision";
  const es = tables.entity_scopes.names;
  const exactClause = `${idExpr} IN (SELECT ${es.col.entity_id} FROM ${es.table} WHERE ${es.col.entity_type} = '${et}' AND ${es.col.scope_id} = @scope)`;
  let clause = exactClause;
  let params: Record<string, unknown> = { scope };
  if (withChildren) {
    const childIds = ctx.queries.scopeTree
      .all({ scope })
      .map((r) => (r as { id: string }).id);
    if (childIds.length > 0) {
      const placeholders = childIds.map((_, i) => `@scope_${i}`).join(", ");
      const childParams: Record<string, unknown> = {};
      childIds.forEach((id, i) => { childParams[`scope_${i}`] = id; });
      clause = `${idExpr} IN (SELECT ${es.col.entity_id} FROM ${es.table} WHERE ${es.col.entity_type} = '${et}' AND ${es.col.scope_id} IN (${placeholders}))`;
      params = childParams;
    }
  }
  return { clause, params };
}

/**
 * Resolve a scope wildcard pattern.
 * - `workspace/#` → parent + all children
 * - `workspace` → exact match
 * - `#` → all scopes
 *
 * Returns a SQL WHERE clause fragment and parameters.
 */
export function resolveScopeWildcard(
  scope: string,
  allScopes: string[],
): { clause: string; params: string[] } {
  let clause = "scope = ?";
  let params: string[] = [scope];

  if (scope === "#") {
    clause = "1=1";
    params = [];
  } else if (scope.endsWith("/#")) {
    const parent = scope.slice(0, -2);
    const children = allScopes.filter(
      (s) => s === parent || s.startsWith(parent + "/"),
    );
    if (children.length > 0) {
      const placeholders = children.map(() => "?").join(", ");
      clause = `scope IN (${placeholders})`;
      params = children;
    } else {
      params = [parent];
    }
  } else if (scope.endsWith("#")) {
    const parent = scope.slice(0, -1);
    const children = allScopes.filter(
      (s) => s === parent || s.startsWith(parent),
    );
    if (children.length > 0) {
      const placeholders = children.map(() => "?").join(", ");
      clause = `scope IN (${placeholders})`;
      params = children;
    } else {
      params = [parent];
    }
  }

  return { clause, params };
}

/** Get all scope IDs from the database. */
export function getAllScopeIds(
  scopeRows: { id: string }[],
): string[] {
  return scopeRows.map((r) => r.id);
}
