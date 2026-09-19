/**
 * OSEM-RAG DDL — the cadastre tables (append-only where it matters).
 * All forgetting is traced; the landscape is regenerable from these tables.
 *
 * Memory planes: STP tables are keyed by `scope_id` — `agent:<id>` (personal),
 * `public` (shared), `scope:<name>` / `skill:<name>` (domain planes).
 * LTP is per-scope too: `atom_sediment(atom_id, scope_id, …)` — every scope is
 * an attention domain with its own sediment, its own clock (`scope_clock`)
 * and its own owner (`scope_owner`).
 */
export const OSEM_DDL = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS atoms (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  flag   TEXT NOT NULL DEFAULT 'low',
  granularity TEXT NOT NULL DEFAULT 'section',
  title  TEXT,
  recorded_at TEXT NOT NULL,
  src TEXT,
  src_line INTEGER
);
CREATE TABLE IF NOT EXISTS atom_sediment (
  atom_id TEXT NOT NULL REFERENCES atoms(id),
  scope_id TEXT NOT NULL,
  salience REAL NOT NULL DEFAULT 0,
  tau REAL NOT NULL DEFAULT 5,
  uses INTEGER NOT NULL DEFAULT 0,
  uses_spaced INTEGER NOT NULL DEFAULT 0,
  touched_hit INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (atom_id, scope_id)
);
CREATE TABLE IF NOT EXISTS scope_clock (
  scope_id TEXT PRIMARY KEY,
  hit INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS scope_owner (
  scope_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  created_hit INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS atom_links (
  from_id TEXT NOT NULL REFERENCES atoms(id),
  to_id   TEXT NOT NULL REFERENCES atoms(id),
  rel TEXT NOT NULL, weight REAL NOT NULL DEFAULT 1 CHECK (weight BETWEEN 0 AND 3),
  floor INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (from_id, to_id, rel)
);
CREATE TABLE IF NOT EXISTS agent_energy (
  scope_id TEXT NOT NULL, atom_id TEXT NOT NULL REFERENCES atoms(id),
  energy REAL NOT NULL DEFAULT 0, active_prompts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope_id, atom_id)
);
CREATE TABLE IF NOT EXISTS edge_gain (
  scope_id TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
  gain REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (scope_id, from_id, to_id)
);
CREATE TABLE IF NOT EXISTS edge_fatigue (
  scope_id TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
  uses REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (scope_id, from_id, to_id)
);
CREATE TABLE IF NOT EXISTS surface_log (ts TEXT, scope_id TEXT, atom_id TEXT, via TEXT, path TEXT,
  seq INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS surface_log_atom_seq ON surface_log(atom_id, seq);
CREATE VIRTUAL TABLE IF NOT EXISTS atoms_fts USING fts5(atom_id UNINDEXED, body);
CREATE VIRTUAL TABLE IF NOT EXISTS titles_fts USING fts5(atom_id UNINDEXED, title);
CREATE TABLE IF NOT EXISTS atom_embeddings (
  atom_id TEXT PRIMARY KEY REFERENCES atoms(id),
  vec BLOB NOT NULL,
  vec_hash BLOB
);
`;

/** vec0 virtual tables — created only after the sqlite-vec extension is loaded. */
export const vecDdl = (dim: number) => `
CREATE VIRTUAL TABLE IF NOT EXISTS atoms_vec USING vec0(
  atom_id TEXT PRIMARY KEY, vec float[${dim}] distance_metric=cosine);
CREATE VIRTUAL TABLE IF NOT EXISTS atoms_vec_hash USING vec0(
  atom_id TEXT PRIMARY KEY, vec float[${dim}] distance_metric=cosine);
`;
