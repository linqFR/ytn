/**
 * Per-scope window index — `seq` counts commits written to the scope
 * (its own acting recalls, silent or not, plus `share` commits landing on
 * it). It is NOT a clock: no decay is computed from it — it only orders
 * events so windows can slide over `bookmarks`/`freq_buckets`.
 * Callers never provide time: a scope moves by its own activity only.
 */
import type Database from "better-sqlite3";

export function makeClock(db: Database.Database) {
  const ins = db.prepare(
    `INSERT INTO scope_clock(scope_id, seq) VALUES (?, 0)
     ON CONFLICT(scope_id) DO NOTHING`);
  const read = db.prepare(`SELECT seq FROM scope_clock WHERE scope_id = ?`);
  const bumpS = db.prepare(
    `UPDATE scope_clock SET seq = seq + 1 WHERE scope_id = ? RETURNING seq`);

  /** Current commit count (creates the row on first contact). */
  function curSeq(scopeId: string): number {
    ins.run(scopeId);
    // CAST: get() returns unknown
    return (read.get(scopeId) as { seq: number }).seq;
  }
  /** A commit landing on the scope (acting or mirror): +1 event seq. */
  function bumpSeq(scopeId: string): number {
    ins.run(scopeId);
    // CAST: get() returns unknown
    return (bumpS.get(scopeId) as { seq: number }).seq;
  }
  return { curSeq, bumpSeq };
}
