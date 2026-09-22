/**
 * OSEM-RAG (Oscillo Ergo Memini) — public entry point.
 *
 * "It oscillates, therefore it remembers."
 *
 * The engine never creates or closes the database: the caller injects an open
 * better-sqlite3 Database. The embedder is pluggable (hash by default).
 */
import type Database from "better-sqlite3";
import { createRequire } from "node:module";
import { OSEM_DDL, vecDdl } from "./engine/ddl.ts";
import { makeField } from "./engine/field.ts";
import { makeInject } from "./engine/formatContext.ts";
import { makeMaintenance, refreshStats } from "./engine/maintenance.ts";
import { registerMemo, registerDoc } from "./engine/ingest.ts";
import { createHashEmbedder } from "./embedder/hash.ts";
import { loadModel2Vec } from "./embedder/model2vec.ts";
import type { IEmbedder, IOsemConfig, IOsemOptions, IOsemRag, OStats,
  tsEmbedderChoice } from "./types.ts";

export * from "./types.ts";
export { ftsMatch } from "./engine/field.ts";
export { refreshStats } from "./engine/maintenance.ts";
// NOTE: `registerMemo`/`registerDoc` are NOT re-exported as free functions —
// they require the internal tsIngestDeps bag. Use the bound methods on the
// IOsemRag instance returned by createOsem().
export { createHashEmbedder } from "./embedder/hash.ts";
export { loadModel2Vec } from "./embedder/model2vec.ts";
// Public helpers for custom ingestion pipelines and provenance display:
// leafChunks/splitMarkdownSections reproduce registerDoc's chunking on a
// single markdown text; ancestorsOf walks the derives_from chain.
export { leafChunks, splitMarkdownSections } from "./engine/ingest.ts";
export { ancestorsOf } from "./engine/formatContext.ts";

/** Audited defaults — every value traces back to a v12 campaign test. */
export const DEFAULT_OSEM_CONFIG: IOsemConfig = {
  theta: 0.5,
  decaySession: 0.7,
  decayProp: 0.85,
  cutEnergy: 0.05,
  seedFts: 0.8,
  topKFts: 8,
  eta: 0.05,
  maxGainPerSession: 0.5,
  ltpRate: 0.3,
  floorPinned: 0.6,
  floorHigh: 0.3,
  freqWindowHot: 20,
  freqWindowMedium: 50,
  freqWindowLong: 100,
  freqBucketSize: 10,
  freqMinBuckets: 3,
  freqWeightRecent: 1.0,
  freqWeightWarm: 1.0,
  freqWeightDurable: 1.0,
  flagFloorWeight: 1.0,
  registrationWeight: 1.0,
  lambdaFatigue: 0.15,
  fatigueDecay: 0.5,
  fanout: 20,
  beam: 50,
  erodeResonates: 0.97,
  weightMin: 0.7,
  weightContains: 0.3,
  budgetTok: 800,
  payloadShare: 0.7,
  cosSilenceSemantic: 0.4,
  cosSilenceHash: 0.55,
  cosMin: 0.25,
  topKVec: 8,
  alphaNodal: 0.3,
  nodalWindow: 30,
  betaDin: 0.1,
  maxLeavesPerAncestor: 3,
  embedDim: 256,
  useSqliteVec: false,
  adjacentMinEnergy: 0.08,
  adjacentMax: 6,
  rankFloor: 0.3,
  refSeedEnergy: 1.0,
  referentPattern: "\\b(?:DEC|ACT|PB|IDEA|SPEC)-\\d{4}\\b",
  referentFilePattern: "[\\w./-]+\\.(?:ts|sql|md|json|db)\\b",
};

/** Create an OSEM-RAG memory field over an injected SQLite database. */
export function createOsem(opts: IOsemOptions): IOsemRag {
  const db = opts.db;
  const cfg: IOsemConfig = { ...DEFAULT_OSEM_CONFIG, ...opts.config };

  let vecExtReady = false;
  if (cfg.useSqliteVec) {
    try {
      // ESM-safe: createRequire works in both ESM and CJS builds (a bare
      // `require` would throw at runtime in the ESM bundle).
      const require = createRequire(import.meta.url);
      // CAST: createRequire returns a NodeRequire whose return is unknown —
      // sqlite-vec exports a single { load(db) } function.
      const sqliteVec = require("sqlite-vec") as { load(db: Database.Database): void };
      sqliteVec.load(db);
      db.exec(vecDdl(cfg.embedDim));
      vecExtReady = true;
    } catch (e) {
      // Traced fallback: JS scan (sufficient below ~50k atoms).
      console.warn("[osem-rag] sqlite-vec unavailable — falling back to JS scan:",
        e instanceof Error ? e.message : e);
      vecExtReady = false;
    }
  }

  const embedder = resolveEmbedder(opts.embedder ?? { kind: "hash" }, cfg);
  const hashEmbedder = opts.hashEmbedder ?? createHashEmbedder(cfg.embedDim);
  // Dimension validation covers ALL branches: a custom embedder with a
  // mismatched dim would silently corrupt the stored spectra.
  if (embedder.dim !== cfg.embedDim)
    throw new Error(`embedder dim ${embedder.dim} != config.embedDim ${cfg.embedDim}`);
  if (hashEmbedder.dim !== cfg.embedDim)
    throw new Error(`hashEmbedder dim ${hashEmbedder.dim} != config.embedDim ${cfg.embedDim}`);

  db.exec(OSEM_DDL);
  if (vecExtReady)
    // Backfill: vec0 tables created on an already-populated base start EMPTY
    // (CREATE IF NOT EXISTS) — without this, reopening a populated DB with
    // useSqliteVec silently kills the semantic surface. Must run AFTER the
    // DDL created atom_embeddings.
    db.exec(
      `INSERT INTO atoms_vec(atom_id, vec)
         SELECT e.atom_id, e.vec FROM atom_embeddings e
         WHERE NOT EXISTS (SELECT 1 FROM atoms_vec v WHERE v.atom_id = e.atom_id);
       INSERT INTO atoms_vec_hash(atom_id, vec)
         SELECT e.atom_id, e.vec_hash FROM atom_embeddings e
         WHERE e.vec_hash IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM atoms_vec_hash v WHERE v.atom_id = e.atom_id)`);
  refreshStats(db, cfg);

  // Shared staleness flag: deposits mark the propagation stats dirty; the
  // next wave lazily refreshes them (registerMemo→recallLexical without maintain() works).
  const statsState = { dirty: false };
  const ingestDeps = { db, cfg, embedder, hashEmbedder, vecExtReady, statsState };
  const field = makeField({ db, cfg, embedder, hashEmbedder, vecExtReady, statsState });
  const formatContext = makeInject({ db, cfg });
  const maint = makeMaintenance({ db, cfg, statsState });

  return {
    db,
    config: cfg,
    embedder,
    registerMemo: (input) => registerMemo(ingestDeps, input),
    registerDoc: (rootDir, o) => registerDoc(ingestDeps, rootDir, o),
    recallLexical: (x) => field.recallLexical(x),
    recall: (x) => field.recall(x),
    formatContext: (o) => formatContext.formatContext(o),
    maintain: () => maint.maintain("system"),
    hotAtoms: (n, scope) => maint.hotAtoms(n, scope),
    stats: () => maint.stats(),
  };
}

function resolveEmbedder(choice: tsEmbedderChoice, cfg: IOsemConfig): IEmbedder {
  if ("embedder" in choice) return choice.embedder;
  if (choice.kind === "model2vec") {
    const m = loadModel2Vec(choice.modelDir);
    if (m.dim !== cfg.embedDim)
      throw new Error(`embedder dim ${m.dim} != config.embedDim ${cfg.embedDim}`);
    return m;
  }
  return createHashEmbedder(cfg.embedDim);
}
