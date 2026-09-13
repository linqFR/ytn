/**
 * Cascade control flag table DDL.
 *
 * The `_cascade_disabled` table is a single-row flag table checked by all
 * cascade triggers via `NOT EXISTS (SELECT 1 FROM _cascade_disabled WHERE value = 1)`.
 *
 * - `UPDATE _cascade_disabled SET value = 1` — disable cascades
 * - `UPDATE _cascade_disabled SET value = 0` — re-enable cascades
 *
 * Separated from the main schema because it is an infrastructure table,
 * not a domain entity. It has no row types, no queries, no QB definition.
 */
export const CASCADE_DDL = [
  "-- Cascade control flag table (checked by cascade triggers)",
  "CREATE TABLE IF NOT EXISTS _cascade_disabled (value INTEGER DEFAULT 0);",
  "INSERT OR IGNORE INTO _cascade_disabled VALUES (0);",
].join("\n");
