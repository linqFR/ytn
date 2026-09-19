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

  /** Maintenance pass: erode + prune learned `resonates` edges (traced —
   *  each pruning lands on the `system` scope's own commit sequence). */
  function maintain(scopeId: string): { pruned: number } {
    db.prepare(`UPDATE atom_links SET weight = weight * ? WHERE rel = 'resonates'`)
      .run(cfg.erodeResonates);
    const pruned = db.prepare(
      `DELETE FROM atom_links WHERE rel = 'resonates' AND weight < ? RETURNING from_id, to_id`,
    ).all(cfg.weightMin) as { from_id: string; to_id: string }[]; // CAST: all() returns unknown[]
    for (const p of pruned)
      db.prepare(`INSERT INTO surface_log VALUES (?,?,?,'pruned',?,?)`)
        .run(new Date().toISOString(), scopeId, p.to_id, p.from_id, bumpSeq(scopeId));
    refreshStats(db, cfg);
    if (deps.statsState) deps.statsState.dirty = false;
    return { pruned: pruned.length };
  }

  /** Top-salience atoms right now (diagnostics). Sediment is per-scope: each
   *  row decays by its own scope's hit count. `scope` filters one plane;
   *  omitted = hottest row across every plane. */
  function hotAtoms(n = 8, scope?: string): { id: string; flag: string; s: number }[] {
    const scopeSql = scope ? `AND s.scope_id = '${scope.replaceAll("'", "''")}'` : "";
    return db.prepare(
      `SELECT a.id, a.flag, ROUND(MAX(MAX(
        s.salience * POWER(0.5, (IFNULL(c.hit, 0) - s.touched_hit) / s.tau),
        ${cfg.floorMax} * (1 - EXP(-s.uses_spaced / ${cfg.floorLambda})),
        CASE a.flag WHEN 'pinned' THEN ${cfg.floorPinned}
                    WHEN 'high' THEN ${cfg.floorHigh} ELSE 0 END)), 2) s
       FROM atoms a JOIN atom_sediment s ON s.atom_id = a.id
       LEFT JOIN scope_clock c ON c.scope_id = s.scope_id ${scopeSql}
       WHERE a.status='active' AND a.kind != 'ref'
       GROUP BY a.id ORDER BY s DESC LIMIT ?`,
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
    const scopes = (db.prepare(
      `SELECT DISTINCT scope_id FROM agent_energy`).all() as
      { scope_id: string }[]) // CAST: all() returns unknown[]
      .map(r => r.scope_id);
    return { atoms, active, links, embeddings, scopes };
  }

  return { maintain, hotAtoms, stats };
}
