/**
 * Maintenance — traced erosion/pruning of learned edges + field diagnostics.
 * Forgetting is an auditable action: every pruning is logged.
 */
import type Database from "better-sqlite3";
import type { IOsemConfig, OStats } from "../types.ts";
import { makeClock } from "./clock.ts";
import type { tsStatsState } from "./field.ts";

export interface tsMaintDeps {
  db: Database.Database;
  cfg: IOsemConfig;
  statsState?: tsStatsState;
}

/** Materialize the propagation stats (fan-out cap, weight mass, fan-in). */
export function refreshStats(db: Database.Database, cfg: IOsemConfig): void {
  db.exec(`DROP TABLE IF EXISTS _fan; DROP TABLE IF EXISTS _mass; DROP TABLE IF EXISTS _din;
           CREATE TEMP TABLE _fan AS
             SELECT from_id, to_id FROM (
               SELECT from_id, to_id,
                 ROW_NUMBER() OVER (PARTITION BY from_id ORDER BY weight DESC) rn
               FROM atom_links WHERE floor = 0 AND rel != 'contains') WHERE rn <= ${cfg.fanout};
           CREATE INDEX _fan_i ON _fan(from_id, to_id);
           CREATE TEMP TABLE _mass AS
             SELECT from_id, SUM(weight) mass FROM atom_links
             WHERE floor = 0 GROUP BY from_id;
           CREATE TEMP TABLE _din AS
             SELECT to_id, COUNT(*) din FROM atom_links GROUP BY to_id;
           CREATE INDEX _din_i ON _din(to_id)`);
}

export function makeMaintenance(deps: tsMaintDeps) {
  const { db, cfg } = deps;
  const { bumpSeq } = makeClock(db);
  const nb = Math.max(1, Math.floor(cfg.freqWindowLong / cfg.freqBucketSize));

  /** Rebuild the `freq_buckets` ring from `bookmarks` — the append-only
   *  truth. Returns the number of drifted slots (missing, extra, or
   *  mismatched n) found before the rebuild: a cache-drift detector. */
  function rebuildRing(): { drift: number } {
    const expected = db.prepare(
      `SELECT scope_id, atom_id, bucket_id, n FROM (
         SELECT scope_id, atom_id, bucket_id, SUM(w) n,
                ROW_NUMBER() OVER (PARTITION BY scope_id, atom_id
                                   ORDER BY bucket_id DESC) rn
         FROM (SELECT scope_id, atom_id, seq / ${cfg.freqBucketSize} AS bucket_id,
                      w FROM bookmarks)
         GROUP BY scope_id, atom_id, bucket_id)
       WHERE rn <= ${nb}`,
    ).all() as { scope_id: string; atom_id: string; bucket_id: number;
                 n: number }[]; // CAST: all() returns unknown[]
    const cur = new Map<string, number>();
    for (const r of db.prepare(
      `SELECT scope_id, atom_id, bucket_id, n FROM freq_buckets`,
    ).all() as { scope_id: string; atom_id: string; bucket_id: number;
                 n: number }[]) // CAST: all() returns unknown[]
      cur.set(`${r.scope_id}|${r.atom_id}|${r.bucket_id}`, r.n);
    const seen = new Set<string>();
    let drift = 0;
    for (const e of expected) {
      const key = `${e.scope_id}|${e.atom_id}|${e.bucket_id}`;
      seen.add(key);
      const got = cur.get(key);
      if (got === undefined || Math.abs(got - e.n) > 1e-9) drift++;
    }
    for (const key of cur.keys()) if (!seen.has(key)) drift++;
    db.transaction(() => {
      db.exec(`DELETE FROM freq_buckets`);
      const ins = db.prepare(
        `INSERT INTO freq_buckets(scope_id, atom_id, slot, bucket_id, n)
         VALUES (?,?,?,?,?)`);
      for (const e of expected)
        ins.run(e.scope_id, e.atom_id, e.bucket_id % nb, e.bucket_id, e.n);
    })();
    return { drift };
  }

  /** Maintenance pass: erode + prune learned `resonates` edges (traced —
   *  each pruning lands on the `system` scope's own commit sequence) +
   *  rebuild the frequency ring from `bookmarks` (cache-drift detector). */
  function maintain(scopeId: string): { pruned: number; ringDrift: number } {
    db.prepare(`UPDATE atom_links SET weight = weight * ? WHERE rel = 'resonates'`)
      .run(cfg.erodeResonates);
    const pruned = db.prepare(
      `DELETE FROM atom_links WHERE rel = 'resonates' AND weight < ? RETURNING from_id, to_id`,
    ).all(cfg.weightMin) as { from_id: string; to_id: string }[]; // CAST: all() returns unknown[]
    for (const p of pruned)
      db.prepare(`INSERT INTO surface_log VALUES (?,?,?,'pruned',?,?)`)
        .run(new Date().toISOString(), scopeId, p.to_id, p.from_id, bumpSeq(scopeId));
    const { drift } = rebuildRing();
    refreshStats(db, cfg);
    if (deps.statsState) deps.statsState.dirty = false;
    return { pruned: pruned.length, ringDrift: drift };
  }

  /** Hottest atoms by recent-windowed share (diagnostics). The hot window
   *  is commit-exact — one grouped scan on `bookmarks` (the ring cannot
   *  answer a K1-commit window exactly: bucket edges quantize ±B commits).
   *  `scope` filters one plane; omitted = best share across every plane —
   *  each atom normalized by its own scope's vocabulary. */
  function hotAtoms(n = 8, scope?: string): { id: string; flag: string; s: number }[] {
    const scopeSql = scope ? `AND b.scope_id = '${scope.replaceAll("'", "''")}'` : "";
    return db.prepare(
      `SELECT b.atom_id AS id, a.flag,
              ROUND((SUM(b.w) + ${cfg.registrationWeight}) / Ns.n, 4) AS s,
              (SELECT COUNT(*) FROM freq_buckets fb
               WHERE fb.scope_id = b.scope_id AND fb.atom_id = b.atom_id
                 AND fb.bucket_id > c.seq / ${cfg.freqBucketSize} - ${nb}) AS spread
       FROM bookmarks b
       JOIN scope_clock c ON c.scope_id = b.scope_id
       JOIN (SELECT scope_id, COUNT(DISTINCT atom_id) n
             FROM bookmarks GROUP BY scope_id) Ns ON Ns.scope_id = b.scope_id
       JOIN atoms a ON a.id = b.atom_id AND a.status = 'active'
       WHERE b.seq > c.seq - ${cfg.freqWindowHot} ${scopeSql}
       GROUP BY b.scope_id, b.atom_id ORDER BY s DESC, spread DESC LIMIT ?`,
    ).all(n) as { id: string; flag: string; s: number }[]; // CAST: all() returns unknown[]
  }

  /** Field health statistics. */
  function stats(): OStats {
    // CAST: get() returns unknown — the queries return a single {n} row each.
    const atoms = (db.prepare(`SELECT COUNT(*) n FROM atoms`).get() as { n: number }).n;
    const active = (db.prepare(
      `SELECT COUNT(*) n FROM atoms WHERE status = 'active'`).get() as { n: number }).n;
    const links = (db.prepare(`SELECT COUNT(*) n FROM atom_links`).get() as { n: number }).n;
    const embeddings = (db.prepare(
      `SELECT COUNT(*) n FROM atom_embeddings`).get() as { n: number }).n;
    const queryAtoms = (db.prepare(
      `SELECT COUNT(*) n FROM atoms WHERE kind = 'query'`).get() as { n: number }).n;
    const scopes = (db.prepare(
      `SELECT DISTINCT scope_id FROM agent_energy`).all() as
      { scope_id: string }[]) // CAST: all() returns unknown[]
      .map(r => r.scope_id);
    return { atoms, active, links, embeddings, scopes, queryAtoms };
  }

  return { maintain, hotAtoms, stats };
}
