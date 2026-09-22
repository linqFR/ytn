/**
 * OSEM-RAG DDL — the cadastre tables (append-only where it matters).
 * All forgetting is traced; the landscape is regenerable from these tables.
 *
 * Memory planes: STP tables are keyed by `scope_id` — `agent:<id>` (personal),
 * `public` (shared), `scope:<name>` / `skill:<name>` (domain planes).
 * LTP is windowed frequency: `bookmarks` is the append-only truth (« this
 * query surfaced this atom on this scope »), `freq_buckets` is the derived
 * ring cache (rebuildable from `bookmarks`), and `scope_clock.seq` is the
 * per-scope window index. `surface_log` survives as the maintenance/audit
 * log ('pruned' rows — forgetting is always traced).
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
CREATE TABLE IF NOT EXISTS bookmarks (
  query_id TEXT NOT NULL REFERENCES atoms(id),
  scope_id TEXT NOT NULL,
  atom_id TEXT NOT NULL REFERENCES atoms(id),
  seq INTEGER NOT NULL,
  w REAL NOT NULL,
  via TEXT,
  path TEXT
);
CREATE INDEX IF NOT EXISTS bookmarks_scope_atom_seq
  ON bookmarks(scope_id, atom_id, seq);
CREATE INDEX IF NOT EXISTS bookmarks_scope_seq
  ON bookmarks(scope_id, seq, atom_id);
CREATE TABLE IF NOT EXISTS freq_buckets (
  scope_id TEXT NOT NULL,
  atom_id TEXT NOT NULL,
  slot INTEGER NOT NULL,
  bucket_id INTEGER NOT NULL,
  n REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (scope_id, atom_id, slot)
);
CREATE TABLE IF NOT EXISTS scope_clock (
  scope_id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS scope_owner (
  scope_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  created_seq INTEGER NOT NULL DEFAULT 0
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
