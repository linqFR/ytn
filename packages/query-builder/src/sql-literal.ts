import type { tsDefaultValue } from "./types.js";

/**
 * @function resolveDefault
 * @description Resolves a `tsDefaultValue` (tagged or direct) into a SQL literal
 * string suitable for a `DEFAULT` clause.
 *
 * - **Tagged form** `{ [type]: value }`: the type tag determines quoting.
 *   - `{ string: "pending" }` → `'pending'` (single-quoted, `'` escaped as `''`)
 *   - `{ number: 42 }` → `42` (unquoted)
 *   - `{ boolean: true }` → `TRUE` / `FALSE` (SQLite 3.23+)
 *   - `{ date: new Date("2024-01-01") }` → `'2024-01-01T00:00:00.000Z'` (ISO 8601, quoted)
 *   - `{ raw: "CURRENT_TIMESTAMP" }` → `CURRENT_TIMESTAMP` (verbatim SQL)
 * - **Direct form** (string or number): passes through `.toString()` as raw SQL.
 *   - `"CURRENT_TIMESTAMP"` → `CURRENT_TIMESTAMP`
 *   - `42` → `42`
 *
 * @param {tsDefaultValue | undefined} def - The default value to resolve.
 * @returns {string | undefined} The SQL literal string, or `undefined` if no default.
 */
export function resolveDefault(def: tsDefaultValue | undefined): string | undefined {
  if (def === undefined) return undefined;
  if (typeof def === "string") return def;
  if (typeof def === "number") return String(def);
  if (typeof def === "object" && def !== null) {
    if ("string" in def) return `'${String(def.string).replace(/'/g, "''")}'`;
    if ("number" in def) return String(def.number);
    if ("boolean" in def) return def.boolean ? "TRUE" : "FALSE";
    if ("date" in def) return `'${new Date(def.date).toISOString()}'`;
    if ("raw" in def) return String(def.raw);
  }
  return String(def);
}
