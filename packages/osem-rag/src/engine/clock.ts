/**
 * Per-scope counters — the scope's own time, counted by the engine.
 * `hit`: acting recalls on the scope (its own consultations — drives decay).
 * `seq`: all commits on the scope (acting + mirrors — unique event identity
 * for `surface_log`, co-surfacing counts and sliding windows).
 * Callers never provide time: a scope ages by its own activity only.
 */
import type Database from "better-sqlite3";

export function makeClock(db: Database.Database) {
  const ins = db.prepare(
    `INSERT INTO scope_clock(scope_id, hit, seq) VALUES (?, 0, 0)
     ON CONFLICT(scope_id) DO NOTHING`);
  const read = db.prepare(`SELECT hit, seq FROM scope_clock WHERE scope_id = ?`);
  const bumpH = db.prepare(
    `UPDATE scope_clock SET hit = hit + 1 WHERE scope_id = ? RETURNING hit`);
  const bumpS = db.prepare(
    `UPDATE scope_clock SET seq = seq + 1 WHERE scope_id = ? RETURNING seq`);

  /** Current acting-recall count (creates the row on first contact). */
  function curHit(scopeId: string): number {
    ins.run(scopeId);
    // CAST: get() returns unknown
    return (read.get(scopeId) as { hit: number }).hit;
  }
  /** Current commit count (creates the row on first contact). */
  function curSeq(scopeId: string): number {
    ins.run(scopeId);
    // CAST: get() returns unknown
    return (read.get(scopeId) as { seq: number }).seq;
  }
  /** An acting recall on the scope: +1 hit (the scope's own consultation). */
  function bumpHit(scopeId: string): number {
    ins.run(scopeId);
    // CAST: get() returns unknown
    return (bumpH.get(scopeId) as { hit: number }).hit;
  }
  /** A commit landing on the scope (acting or mirror): +1 event seq. */
  function bumpSeq(scopeId: string): number {
    ins.run(scopeId);
    // CAST: get() returns unknown
    return (bumpS.get(scopeId) as { seq: number }).seq;
  }
  return { curHit, curSeq, bumpHit, bumpSeq };
}
