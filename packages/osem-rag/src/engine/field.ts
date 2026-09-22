/**
 * Field engine — wave propagation, synaptic fatigue, windowed frequency.
 * All physics constants come from the resolved IOsemConfig (audited defaults).
 * Deterministic: same db state + same prompt → same wave.
 *
 * Memory planes: STP tables (agent_energy, edge_gain, edge_fatigue) are keyed
 * by `scope_id` — `agent:<id>` personal, `public` shared, `scope:<name>` /
 * `skill:<name>` domain planes. LTP = windowed frequency over `bookmarks`
 * (append-only truth) + `freq_buckets` (derived ring), indexed by the
 * scope's own `seq`.
 */
import type Database from "better-sqlite3";
import type { IEmbedder, IRecallInput, IOsemConfig, ISurfaced,
  tsScopeId, tsSharedScope } from "../types.ts";
import { makeClock } from "./clock.ts";
import { refreshStats } from "./maintenance.ts";

/** Shared staleness flag: registerMemo mutates the graph → propagation stats
 *  (_fan/_mass/_din) are stale until refreshed (lazy, on first recallLexical). */
export interface tsStatsState { dirty: boolean }

export interface tsFieldDeps {
  db: Database.Database;
  cfg: IOsemConfig;
  embedder: IEmbedder;
  hashEmbedder: IEmbedder;
  vecExtReady: boolean;
  statsState?: tsStatsState;
}

export interface tsWaveResult {
  waveRows: { id: string; e: number; via: string | null; srcs: string }[];
  allSeeds: Set<string>;
}

/** Unique informative terms of a text. No stop list: meaningless words are
 *  depreciated by their corpus frequency (IDF) at seeding time — "des" appears
 *  everywhere → weight ≈ 0; a rare term like "EU" keeps its full weight. */
export function termsOf(t: string): string[] {
  return [...new Set(t.toLowerCase().match(/[a-zA-Z_][a-zA-Z0-9_]{2,}/g) ?? [])];
}
// Default referent patterns — cfg.referentPattern / cfg.referentFilePattern override.

export function ftsMatch(t: string): string {
  return termsOf(t).map(x => `"${x}"`).join(" OR ");
}


/** One expansion level: seeds → neighbors (weight-mass × fatigue × fan-in attenuation). */
function levelSql(src: string, seen: string, cfg: IOsemConfig): string {
  return `
SELECT l.to_id AS id, l.from_id AS via,
       s.e * ${cfg.decayProp} * l.weight
         / MAX(1, IFNULL(m.mass, 0))
         / (1 + ${cfg.lambdaFatigue} * IFNULL(f.uses, 0))
         / POWER(1 + ${cfg.betaDin} * IFNULL(di.din, 0), 0.5) AS e
FROM ${src} s
JOIN atom_links l ON l.from_id = s.id
LEFT JOIN _mass m ON m.from_id = l.from_id
LEFT JOIN _din di ON di.to_id = l.to_id
JOIN atoms a ON a.id = l.to_id AND a.status = 'active' AND a.kind != 'query'
LEFT JOIN edge_fatigue f ON f.scope_id = :sid
                       AND f.from_id = l.from_id AND f.to_id = l.to_id
WHERE (l.floor = 1 OR l.rel = 'contains' OR EXISTS (
        SELECT 1 FROM _fan x WHERE x.from_id = l.from_id AND x.to_id = l.to_id))
  AND l.to_id NOT IN (SELECT id FROM ${seen})
GROUP BY l.to_id, l.from_id`;
}

export function makeField(deps: tsFieldDeps) {
  const { db, cfg, embedder, hashEmbedder, vecExtReady } = deps;

  /** Mirror planes of an excitation: personal plane first, then shared planes
   *  (personal planes of OTHER agents are excluded by tsSharedScope). */
  const mirrorScopes = (share?: tsSharedScope | tsSharedScope[]): tsScopeId[] =>
    share ? (Array.isArray(share) ? share : [share]) : [];

  /** Per-scope window index: `seq` counts commits written to the scope —
   *  its own acting recalls (silent or not) and share commits landing on
   *  it. Callers never provide it. */
  const { curSeq, bumpSeq } = makeClock(db);

  /** First writer becomes the scope's owner (used for pin certification). */
  const ownStmt = db.prepare(
    `INSERT OR IGNORE INTO scope_owner(scope_id, owner, created_seq)
     VALUES (?,?,?)`);
  const ownRead = db.prepare(
    `SELECT owner FROM scope_owner WHERE scope_id = ?`);

  /** Resolve the acting plane: `actAs` lets an agent commit on a shared
   *  scope — its energy, its frequency, its seq — but only its recorded
   *  owner may do so (first claimer becomes owner). Rejects BEFORE any
   *  write: a denied claim must not even touch the scope. */
  function resolveActing(opts: IRecallInput): { sid: tsScopeId } {
    const sid: tsScopeId = opts.actAs ?? `agent:${opts.agentId}`;
    const existing = ownRead.get(sid) as { owner: string } | undefined; // CAST: get() returns unknown
    if (opts.actAs && existing && existing.owner !== opts.agentId)
      throw new Error(
        `actAs(${sid}) denied: scope is owned by ${existing.owner}`);
    ownStmt.run(sid, opts.agentId, curSeq(sid));
    return { sid };
  }

  const expand = (scopeId: string, src: string, seen: string) =>
    db.prepare(levelSql(src, seen, cfg)).all({ sid: scopeId }) as
      { id: string; via: string; e: number }[]; // CAST: all() returns unknown[]

  /** Semantic surface: dual-embedder cosine (semantic ∪ hash), silence-guarded. */
  function vecSeeds(text: string, lexicalHadHits: boolean): Map<string, number> {
    const qSem = embedder.embed(text);
    const qHash = hashEmbedder.embed(text);
    const scored: { id: string; cosSem: number; cosHash: number }[] = [];
    if (cfg.useSqliteVec && vecExtReady) {
      // Native KNN on BOTH channels (vec0 cosine: distance = 1 - cos).
      // Superseded atoms never seed — same filter as the JS scan.
      const knnSem = db.prepare(
        `SELECT v.atom_id, v.distance FROM atoms_vec v
         JOIN atoms a ON a.id = v.atom_id AND a.status = 'active'
         WHERE v.vec MATCH ? AND k = ? ORDER BY v.distance`,
      ).all(Buffer.from(qSem.buffer), cfg.topKVec) as
        { atom_id: string; distance: number }[]; // CAST: all() returns unknown[]
      const knnHash = db.prepare(
        `SELECT v.atom_id, v.distance FROM atoms_vec_hash v
         JOIN atoms a ON a.id = v.atom_id AND a.status = 'active'
         WHERE v.vec MATCH ? AND k = ? ORDER BY v.distance`,
      ).all(Buffer.from(qHash.buffer), cfg.topKVec) as
        { atom_id: string; distance: number }[]; // CAST: all() returns unknown[]
      for (const k of knnSem) {
        const c = 1 - k.distance;
        if (c >= cfg.cosMin) scored.push({ id: k.atom_id, cosSem: c, cosHash: 0 });
      }
      for (const k of knnHash) {
        const c = 1 - k.distance;
        if (c < cfg.cosMin) continue;
        const ex = scored.find(s => s.id === k.atom_id);
        if (ex) ex.cosHash = Math.max(ex.cosHash, c);
        else scored.push({ id: k.atom_id, cosSem: 0, cosHash: c });
      }
    } else {
      // Superseded atoms never seed (their spectra stay but are excluded).
      const rows = db.prepare(
        `SELECT e.atom_id, e.vec, e.vec_hash FROM atom_embeddings e
         JOIN atoms a ON a.id = e.atom_id AND a.status = 'active'`).all() as
        { atom_id: string; vec: Buffer; vec_hash: Buffer | null }[]; // CAST: all() returns unknown[]
      for (const r of rows) {
        const v = new Float32Array(r.vec.buffer, r.vec.byteOffset, r.vec.byteLength / 4);
        let dSem = 0;
        for (let i = 0; i < cfg.embedDim; i++) dSem += qSem[i] * v[i];
        let dHash = 0;
        if (r.vec_hash) {
          const vh = new Float32Array(r.vec_hash.buffer, r.vec_hash.byteOffset, r.vec_hash.byteLength / 4);
          for (let i = 0; i < cfg.embedDim; i++) dHash += qHash[i] * vh[i];
        }
        scored.push({ id: r.atom_id, cosSem: dSem, cosHash: dHash });
      }
    }
    const filtered = scored
      .filter(r => Math.max(r.cosSem, r.cosHash) >= cfg.cosMin)
      .sort((a, b) => Math.max(b.cosSem, b.cosHash) - Math.max(a.cosSem, a.cosHash))
      .slice(0, cfg.topKVec);
    const seeds = new Map<string, number>();
    const maxSem = filtered.length ? Math.max(...filtered.map(s => s.cosSem)) : 0;
    const maxHash = filtered.length ? Math.max(...filtered.map(s => s.cosHash)) : 0;
    // Silence guard: no lexical hit AND both channels below thresholds → zero seeds.
    if (!lexicalHadHits && maxSem < cfg.cosSilenceSemantic && maxHash < cfg.cosSilenceHash) return seeds;
    for (const r of filtered) seeds.set(r.id, Math.max(r.cosSem, r.cosHash) * cfg.seedFts);
    return seeds;
  }

  /** Non-committal probe: surfaces → seeds → waves → merged into _all.
   *  The vector surface is only consulted at N2 (useVec=true). */
  function computeWave(scopeId: string, seq: number,
                       promptText: string,
                       extraTerms: string[] = [], useVec = false): tsWaveResult {
    // Lazy refresh: a registerMemo without an intervening maintain() left the
    // propagation stats stale — registerMemo→recallLexical must not run a dead field.
    if (deps.statsState?.dirty) {
      refreshStats(db, cfg);
      deps.statsState.dirty = false;
    }
    const surfaces: [tag: string, seeds: Map<string, number>][] = [
      ["r", new Map()], ["f", new Map()], ["g", new Map()], ["s", new Map()],
    ];
    for (const ref of promptText.match(new RegExp(cfg.referentPattern, "g")) ?? [])
      surfaces[0][1].set(ref, cfg.refSeedEnergy);
    for (const f of promptText.match(new RegExp(cfg.referentFilePattern, "g")) ?? [])
      surfaces[0][1].set(`file:${f}`, cfg.refSeedEnergy);
    // Surface f — per-term IDF seeding (V4-14): each term is queried alone and
    // weighted by its inverse document frequency in the corpus. A meaningless
    // word ("the", "des") appears everywhere → idf ≈ ln(2) → weight ≈ 0; a
    // rare term ("maranget", "EU") → weight ≈ 1. No stop list needed: the
    // corpus itself prices the words. Superseded atoms never seed.
    const terms = termsOf(promptText + " " + extraTerms.join(" "));
    const df = db.prepare(
      `SELECT COUNT(*) n FROM atoms_fts
       JOIN atoms ON atoms.id = atoms_fts.atom_id AND atoms.status = 'active'
       WHERE atoms_fts MATCH ?`);
    const total = (db.prepare(
      `SELECT COUNT(*) n FROM atoms WHERE status = 'active'`).get() as
      { n: number }).n; // CAST: get() returns unknown
    const idfOf = terms.map(term => {
      const r = df.get(`"${term}"`) as { n: number } | undefined;
      return { term, idf: r?.n ? Math.log(1 + total / r.n) : 0 };
    }).filter(t => t.idf > 0);
    const maxIdf = Math.max(...idfOf.map(t => t.idf), 1e-9);
    for (const { term, idf } of idfOf) {
      const rows = db.prepare(
        `SELECT atoms_fts.atom_id AS atom_id, rank FROM atoms_fts
         JOIN atoms ON atoms.id = atoms_fts.atom_id AND atoms.status = 'active'
         WHERE atoms_fts MATCH ? ORDER BY rank LIMIT ?`,
      ).all(`"${term}"`, cfg.topKFts) as { atom_id: string; rank: number }[]; // CAST: all() returns unknown[]
      const best = rows.length ? rows[0]!.rank : -1;
      for (const r of rows) {
        // Additive per-term: covering MORE informative terms must dominate.
        surfaces[1][1].set(r.atom_id, (surfaces[1][1].get(r.atom_id) ?? 0) +
          cfg.seedFts * (idf / maxIdf) *
          Math.max(cfg.rankFloor, best !== 0 ? r.rank / best : 1));
      }
      for (const r of db.prepare(
        `SELECT titles_fts.atom_id FROM titles_fts
         JOIN atoms ON atoms.id = titles_fts.atom_id AND atoms.status = 'active'
         WHERE titles_fts MATCH ? ORDER BY rank LIMIT ?`,
      ).all(`"${term}"`, cfg.topKFts) as { atom_id: string }[]) // CAST: all() returns unknown[]
        surfaces[2][1].set(r.atom_id, (surfaces[2][1].get(r.atom_id) ?? 0) +
          cfg.seedFts * (idf / maxIdf));
    }
    // Semantic surface embeds the RAW prompt — adjacent terms belong to the
    // lexical re-query only. Feeding them to the embedder lets the dominant
    // cluster poison the semantic direction (measured: evidence session went
    // from vector rank #1 to #10 on a real LongMemEval instance).
    if (useVec)
      for (const [id, e] of vecSeeds(promptText,
        surfaces[1][1].size > 0 || surfaces[2][1].size > 0))
        surfaces[3][1].set(id, e);

    db.exec(`DROP TABLE IF EXISTS _s; DROP TABLE IF EXISTS _seen; DROP TABLE IF EXISTS _wave;
             DROP TABLE IF EXISTS _trav; DROP TABLE IF EXISTS _all; DROP TABLE IF EXISTS _lvl;
             CREATE TEMP TABLE _s(id TEXT PRIMARY KEY, e REAL);
             CREATE TEMP TABLE _seen(id TEXT PRIMARY KEY);
             CREATE TEMP TABLE _wave(id TEXT PRIMARY KEY, e REAL, via TEXT);
             CREATE TEMP TABLE _lvl(id TEXT PRIMARY KEY, e REAL);
             CREATE TEMP TABLE _trav(from_id TEXT, to_id TEXT, PRIMARY KEY(from_id, to_id));
             CREATE TEMP TABLE _all(id TEXT PRIMARY KEY, e REAL, via TEXT, srcs TEXT);`);
    const allSeeds = new Set<string>();

    for (const [tag, seeds] of surfaces) {
      if (!seeds.size) continue;
      db.exec(`DELETE FROM _s; DELETE FROM _seen; DELETE FROM _wave;`);
      const insSeed = db.prepare(`INSERT INTO _s VALUES (?,?)`);
      db.transaction(() => { for (const [id, e] of seeds) insSeed.run(id, e); })();
      for (const id of seeds.keys()) allSeeds.add(id);
      db.exec(`INSERT INTO _seen SELECT id FROM _s;
               INSERT INTO _wave SELECT id, e, NULL FROM _s;`);
      for (let level = 0; level < 2; level++) {
        const src = level === 0 ? "_s" : "_lvl";
        if (level === 1)
          db.exec(`DELETE FROM _lvl; INSERT INTO _lvl
                   SELECT id, e FROM _wave WHERE via IS NOT NULL`);
        const pairs = expand(scopeId, src, "_seen")
          .reduce<Map<string, { e: number; via: string }>>((m, r) => {
            const cur = m.get(r.id);
            m.set(r.id, { e: (cur?.e ?? 0) + r.e, via: cur && cur.e >= r.e ? cur.via : r.via });
            return m;
          }, new Map());
        const top = [...pairs.entries()].filter(([, v]) => v.e > cfg.cutEnergy)
          .sort((a, b) => b[1].e - a[1].e).slice(0, cfg.beam);
        const insW = db.prepare(`INSERT OR REPLACE INTO _wave(id, e, via) VALUES (?,?,?)`);
        const insSeen = db.prepare(`INSERT OR IGNORE INTO _seen(id) VALUES (?)`);
        const insT = db.prepare(`INSERT OR IGNORE INTO _trav VALUES (?,?)`);
        db.transaction(() => {
          for (const [id, v] of top) {
            insW.run(id, v.e, v.via); insSeen.run(id); insT.run(v.via, id);
          }
        })();
        if (!top.length) break;
      }
      db.prepare(`INSERT INTO _all(id, e, via, srcs) SELECT id, e, via, ? FROM _wave WHERE true
                  ON CONFLICT(id) DO UPDATE SET e = e + excluded.e,
                    srcs = _all.srcs || ',' || excluded.srcs`).run(tag);
    }

    // Windowed-frequency boost — the scope's recent-attention share.
    // share(a) = (w_recent·f20/K1 + w_warm·f50/K2m + w_durable·spread/NB + w0)/N
    // f20 is commit-exact (grouped range scan on bookmarks); f50/f100/spread
    // are bucket-aligned sums over the ring (freshness folded into the read).
    // Plus an additive flag floor so truth sources keep wave presence even
    // with zero bookmarks. One grouped query per store — never N scans.
    const nb = Math.max(1, Math.floor(cfg.freqWindowLong / cfg.freqBucketSize));
    const nScope = (db.prepare(
      `SELECT COUNT(DISTINCT atom_id) n FROM bookmarks WHERE scope_id = ?`)
      .get(scopeId) as { n: number }).n; // CAST: get() returns unknown
    const curB = Math.floor(seq / cfg.freqBucketSize);
    const f20 = new Map<string, number>();
    const long = new Map<string, { f50: number; f100: number; spread: number }>();
    if (nScope > 0) {
      for (const r of db.prepare(
        `SELECT atom_id, SUM(w) s FROM bookmarks
         WHERE scope_id = ? AND seq > ? - ${cfg.freqWindowHot} AND seq <= ?
           AND atom_id IN (SELECT id FROM _all)
         GROUP BY atom_id`,
      ).all(scopeId, seq, seq) as { atom_id: string; s: number }[]) // CAST: all() returns unknown[]
        f20.set(r.atom_id, r.s);
      for (const r of db.prepare(
        `SELECT atom_id,
                SUM(CASE WHEN bucket_id > ? THEN n ELSE 0 END) f50,
                SUM(n) f100, COUNT(*) spread
         FROM freq_buckets
         WHERE scope_id = ? AND bucket_id > ? AND bucket_id <= ?
           AND atom_id IN (SELECT id FROM _all)
         GROUP BY atom_id`,
      ).all(curB - Math.floor(cfg.freqWindowMedium / cfg.freqBucketSize),
            scopeId, curB - nb, curB) as
        { atom_id: string; f50: number; f100: number; spread: number }[]) // CAST: all() returns unknown[]
        long.set(r.atom_id, r);
    }
    const updAll = db.prepare(`UPDATE _all SET e = e + ? WHERE id = ?`);
    for (const r of db.prepare(
      `SELECT w.id, a.flag FROM _all w
       JOIN atoms a ON a.id = w.id AND a.status = 'active'`,
    ).all() as { id: string; flag: string }[]) { // CAST: all() returns unknown[]
      const l = long.get(r.id);
      const share = nScope > 0
        ? (cfg.freqWeightRecent * (f20.get(r.id) ?? 0) / cfg.freqWindowHot
          + cfg.freqWeightWarm * (l?.f50 ?? 0) / cfg.freqWindowMedium
          + cfg.freqWeightDurable * (l?.spread ?? 0) / nb
          + cfg.registrationWeight) / nScope
        : 0;
      const flagFloor = r.flag === "pinned" ? cfg.floorPinned
        : r.flag === "high" ? cfg.floorHigh : 0;
      updAll.run(cfg.ltpRate * share + cfg.flagFloorWeight * flagFloor, r.id);
    }

    // Nodal fatigue BEFORE the threshold — parents only: the echo is structural
    // (fan-in of doc/section), punishing consulted leaves killed the lift (B1).
    // The window counts committed surfacings (bookmarks) on THIS scope
    // (per-domain fatigue).
    const waveRows = db.prepare(
      `SELECT w.id,
              w.e / (CASE WHEN a.granularity IN ('section','doc')
                          THEN (1 + ${cfg.alphaNodal} * LN(1 + (SELECT COUNT(*) FROM bookmarks b
                                   WHERE b.atom_id = w.id AND b.scope_id = ?
                                     AND b.seq > ? - ${cfg.nodalWindow})))
                          ELSE 1 END) AS e,
              w.via, w.srcs
       FROM _all w
       JOIN atoms a ON a.id = w.id AND a.status = 'active' AND a.kind != 'query'
       WHERE w.e / (CASE WHEN a.granularity IN ('section','doc')
                  THEN (1 + ${cfg.alphaNodal} * LN(1 +
                   (SELECT COUNT(*) FROM bookmarks b
                    WHERE b.atom_id = w.id AND b.scope_id = ?
                      AND b.seq > ? - ${cfg.nodalWindow})))
              ELSE 1 END) >= ?
       ORDER BY e DESC`,
    ).all(scopeId, seq, scopeId, seq, cfg.theta) as
      { id: string; e: number; via: string | null; srcs: string }[]; // CAST: all() returns unknown[]
    return { waveRows, allSeeds };
  }

  /** Register the query atom — one per recall (one query = one event).
   *  Slim: `atoms` row only — no FTS row, no embeddings. `src` carries the
   *  addressed scope ids so a silent recall stays auditable (it writes no
   *  bookmarks). */
  function registerQueryAtom(qid: string, prompt: string,
                             scopes: string[]): void {
    db.prepare(
      `INSERT INTO atoms(id,kind,body,flag,granularity,recorded_at,src)
       VALUES (?,'query',?,'low','query',?,?)`)
      .run(qid, prompt, new Date().toISOString(), scopes.join(","));
  }

  /** Commit: agent_energy (STP heat), one bookmark per surfaced atom
   *  (append-only truth: w = the atom's own energy / atoms surfaced by this
   *  commit), the freq_buckets ring increment, resonates, hebbian gain, edge
   *  fatigue. `learn=false` for mirror planes: bookmarks + ring + STP heat
   *  are the shared scope's own observations — only graph learning
   *  (resonates, hebbian) stays acting-scope only. `viaTag` overrides the
   *  provenance marker ('share' on mirror commits). */
  function commitWave(scopeId: string, seq: number, qid: string,
                      waveRows: tsWaveResult["waveRows"], allSeeds: Set<string>,
                      learn = true, viaTag?: string): ISurfaced[] {
    const bump = db.prepare(
      `INSERT INTO agent_energy(scope_id, atom_id, energy, active_prompts) VALUES (?,?,?,1)
       ON CONFLICT(scope_id,atom_id)
       DO UPDATE SET energy = energy + excluded.energy, active_prompts = active_prompts + 1`);
    const insB = db.prepare(
      `INSERT INTO bookmarks(query_id, scope_id, atom_id, seq, w, via, path)
       VALUES (?,?,?,?,?,?,?)`);
    const insRing = db.prepare(
      `INSERT INTO freq_buckets(scope_id, atom_id, slot, bucket_id, n)
       VALUES (?,?,?,?,?)
       ON CONFLICT(scope_id, atom_id, slot) DO UPDATE SET
         bucket_id = excluded.bucket_id,
         n = CASE WHEN freq_buckets.bucket_id = excluded.bucket_id
                  THEN freq_buckets.n + excluded.n ELSE excluded.n END`);
    const nb = Math.max(1, Math.floor(cfg.freqWindowLong / cfg.freqBucketSize));
    const nCommit = waveRows.length;
    const surfaced: ISurfaced[] = [];
    db.transaction(() => {
      for (const r of waveRows) {
        const via = allSeeds.has(r.id) ? "bubble" : "wave";
        const w = r.e / nCommit;
        bump.run(scopeId, r.id, r.e);
        // Mirror commits keep the acting commit's full provenance under the
        // 'share' marker: via = 'share:<channel>[<srcs>]', path = predecessor.
        insB.run(qid, scopeId, r.id, seq, w,
                 viaTag ? `${viaTag}:${via}[${r.srcs}]` : `${via}[${r.srcs}]`, r.via);
        const b = Math.floor(seq / cfg.freqBucketSize);
        insRing.run(scopeId, r.id, b % nb, b, w);
        surfaced.push({ id: r.id, e: r.e, via, srcs: r.srcs });
      }
      if (!learn) return;
      if (surfaced.length >= 2) {
        const [a, b] = [surfaced[0].id, surfaced[1].id];
        // Resonance = co-activation on ≥2 distinct commits (spec: standing
        // waves), not a one-shot co-occurrence. The current commit is already
        // bookmarked above — count the commits where BOTH surfaced.
        const coTicks = (db.prepare(
          `SELECT COUNT(*) n FROM (
             SELECT seq FROM bookmarks
             WHERE scope_id = ? AND atom_id IN (?,?)
             GROUP BY seq HAVING COUNT(DISTINCT atom_id) = 2)`)
          .get(scopeId, a, b) as { n: number }).n; // CAST: get() returns unknown
        const linked = db.prepare(
          `SELECT 1 FROM atom_links WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?)`)
          .get(a, b, b, a);
        if (coTicks >= 2 && !linked)
          db.prepare(`INSERT INTO atom_links(from_id,to_id,rel,weight,floor)
                      VALUES (?,?,'resonates',1,0)`).run(a, b);
      }
      db.prepare(`INSERT OR IGNORE INTO edge_gain(scope_id,from_id,to_id,gain)
                  SELECT ?, from_id, to_id, 0 FROM _trav`).run(scopeId);
      db.prepare(
        `UPDATE atom_links SET weight = MIN(3, weight + ?)
         WHERE floor = 0
           AND EXISTS (SELECT 1 FROM _trav t JOIN edge_gain g
                       ON g.scope_id = ? AND g.from_id = t.from_id AND g.to_id = t.to_id
                       WHERE t.from_id = atom_links.from_id AND t.to_id = atom_links.to_id
                         AND g.gain < ${cfg.maxGainPerSession})
           AND EXISTS (SELECT 1 FROM atoms a WHERE a.id = atom_links.to_id AND a.status='active')`,
      ).run(cfg.eta, scopeId);
      db.prepare(`UPDATE edge_gain SET gain = gain + ?
                  WHERE scope_id = ? AND (from_id, to_id) IN (SELECT from_id, to_id FROM _trav)`)
        .run(cfg.eta, scopeId);
      db.prepare(
        `INSERT INTO edge_fatigue(scope_id,from_id,to_id,uses)
         SELECT ?, from_id, to_id, 1 FROM _trav WHERE true
         ON CONFLICT(scope_id,from_id,to_id) DO UPDATE SET uses = uses + 1`,
      ).run(scopeId);
    })();
    return surfaced;
  }

  /** Adjacent terms from the weakly-activated region (cascade N2). */
  function adjacentTerms(promptText: string): string[] {
    const stop = new Set(promptText.toLowerCase().match(/[a-z_][a-z0-9_]{2,}/gi) ?? []);
    const terms: string[] = [];
    for (const r of db.prepare(
      `SELECT a.body, a.title FROM _all w JOIN atoms a ON a.id = w.id
       WHERE w.e > ${cfg.adjacentMinEnergy} ORDER BY w.e DESC LIMIT ${cfg.adjacentMax}`,
    ).all() as { body: string | null; title: string | null }[]) { // CAST: all() returns unknown[]
      for (const t of ((r.title ?? "") + " " + (r.body ?? ""))
        .toLowerCase().match(/[a-z_][a-z0-9_]{3,}/g) ?? [])
        if (!stop.has(t) && !terms.includes(t)) terms.push(t);
      if (terms.length >= cfg.adjacentMax) break;
    }
    return terms.slice(0, cfg.adjacentMax);
  }

  /** Lexical-only recall — the cheap probe. Alias of
   *  `recall({ ...opts, mode: "lexical" })`.
   *  Mirror planes (share) receive the same surfacings as their own
   *  observations — their bookmarks + ring advance, but graph learning
   *  stays acting-scope only. A silent recall commits nothing on mirror
   *  planes (no share commit → no foreign seq advance). */
  function recallLexical(opts: IRecallInput): ISurfaced[] {
    return recall({ ...opts, mode: "lexical" }).surfaced;
  }

  /** Cascade: N1 lexical only → N2 adjacent terms + vector surface (always
   *  run; the stronger wave wins). `mode: "vec"` skips the lexical
   *  pre-layer and runs one fused lexical+vector wave instead. */
  function recall(opts: IRecallInput): { surfaced: ISurfaced[]; trace: string[] } {
    const { sid } = resolveActing(opts);
    const mirrors = mirrorScopes(opts.share).filter(s => s !== sid);
    db.transaction(() => {
      for (const scope of [sid, ...mirrors]) {
        db.prepare(`UPDATE agent_energy SET energy = energy * ? WHERE scope_id = ?`)
          .run(cfg.decaySession, scope);
        db.prepare(`UPDATE edge_fatigue SET uses = uses * ? WHERE scope_id = ?`)
          .run(cfg.fatigueDecay, scope);
      }
    })();
    const trace: string[] = [];
    // N1 = lexical only (no vector) — silence stays the rule.
    let waveRows: tsWaveResult["waveRows"];
    let allSeeds: Set<string>;
    if (opts.mode === "vec") {
      // Vec direct: lexical + vector surfaces seed together in one
      // propagation. No lexical pre-layer — hence no adjacent terms (they
      // are read from that pre-layer's weak region) and no winner-take-all.
      ({ waveRows, allSeeds } =
        computeWave(sid, curSeq(sid), opts.prompt, [], true));
      trace.push(`single wave (vec): best energy ${(waveRows[0]?.e ?? 0).toFixed(2)}`);
    } else if (opts.mode === "lexical") {
      // Lexical-only wave — the cheap probe (recallLexical's strategy).
      ({ waveRows, allSeeds } = computeWave(sid, curSeq(sid), opts.prompt));
      trace.push(`single wave (lexical): best energy ${(waveRows[0]?.e ?? 0).toFixed(2)}`);
    } else {
      ({ waveRows, allSeeds } = computeWave(sid, curSeq(sid), opts.prompt));
      const best = waveRows[0]?.e ?? 0;
      trace.push(`step 1 (exact match): best energy ${best.toFixed(2)}`);
      // N2 always: recall is the thorough path (recallLexical stays N1-only).
      // A confident-but-incomplete lexical wave still misses concurrent facts
      // that only the semantic surface can reach.
      const adj = adjacentTerms(opts.prompt);
      trace.push(`step 2 (related terms): [${adj.join(", ")}] + semantic search`);
      const w2 = computeWave(sid, curSeq(sid), opts.prompt, adj, true);
      if ((w2.waveRows[0]?.e ?? 0) > best) {
        ({ waveRows, allSeeds } = w2);
        trace.push(`step 2 improved: best energy ${(waveRows[0]?.e ?? 0).toFixed(2)}`);
      } else trace.push(`step 2: no improvement — keeping step 1 results`);
    }
    // ONE commit for the whole cascade — bookmarks record the final surfaced
    // set, the query atom keeps the ORIGINAL prompt. Eager and atomic.
    let surfaced: ISurfaced[] = [];
    db.transaction(() => {
      const seq = bumpSeq(sid);
      const qid = `qry:${sid}:${seq}`;
      registerQueryAtom(qid, opts.prompt, [sid, ...mirrors]);
      surfaced = commitWave(sid, seq, qid, waveRows, allSeeds);
      if (waveRows.length)
        for (const scope of mirrors)
          commitWave(scope, bumpSeq(scope), qid, waveRows, allSeeds, false, "share");
    })();
    return { surfaced, trace };
  }

  return { recallLexical, recall };
}
