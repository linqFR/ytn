/**
 * Public types for OSEM-RAG (Oscillo Ergo Memini) — the memory-field engine.
 *
 * Naming conventions (ytn): `I*` input/config shapes, `O*` output shapes,
 * `ts*` static type aliases, `u*` high-level utility functions.
 */

import type Database from "better-sqlite3";
import type { IEmbedder } from "./embedder/types.ts";

export type { IEmbedder } from "./embedder/types.ts";

/** Memory planes: personal (`agent:<id>`), shared (`public`), domain
 *  (`scope:<name>`) and skills (`skill:<name>`). `"system"` is reserved for
 *  the engine's own maintenance logs (never a memory plane). */
export type tsScopeId =
  | `agent:${string}` | "public" | `scope:${string}` | `skill:${string}`
  | "system";

/** A plane an agent may WRITE into: excludes other agents' personal planes
 *  (working memory is private by design) AND `"system"` (maintenance logs). */
export type tsSharedScope = Exclude<tsScopeId, `agent:${string}` | "system">;

/** Scope selection for injection: explicit planes, or `"all"` (read-only union of every plane). */
export type tsScopeSelection = tsScopeId[] | "all";

/** Closed granularity enum (the spec's leaf hierarchy). */
export type tsGranularity =
  | "sentence" | "paragraph" | "section" | "row" | "field" | "doc";

/** Pluggable text embedder — the field is agnostic to the implementation. */
export type tsEmbedderChoice =
  | { kind: "hash" }
  | { kind: "model2vec"; modelDir: string }
  | { embedder: IEmbedder };

/** Audited engine constants — every value has a validating test (see the v12 campaign). */
export interface IOsemConfig {
  /** Surfacing threshold on wave energy. */
  theta: number;
  /** Working-memory decay per prompt (STP). */
  decaySession: number;
  /** Propagation decay per hop. */
  decayProp: number;
  /** Energy cut-off below which propagation stops (cycle guard). */
  cutEnergy: number;
  /** Base energy of an FTS/vector seed. */
  seedFts: number;
  /** Max lexical seeds per surface. */
  topKFts: number;
  /** Hebbian reinforcement per edge traversal. */
  eta: number;
  /** Max reinforcement gain per agent per edge. */
  maxGainPerSession: number;
  /** LTP weight: multiplier of the windowed-frequency boost in the wave. */
  ltpRate: number;
  /** Floor for `pinned` atoms (right of surfacing, granted by the cadastre). */
  floorPinned: number;
  /** Floor for `high` atoms. */
  floorHigh: number;
  /** Hot window K1 — commits, commit-exact (read from `bookmarks`). */
  freqWindowHot: number;
  /** Medium window K2m — commits, bucket-aligned (read from `freq_buckets`). */
  freqWindowMedium: number;
  /** Long/durability window K2 — commits, bucket-aligned. */
  freqWindowLong: number;
  /** Commits per bucket; the ring depth is `freqWindowLong / freqBucketSize`. */
  freqBucketSize: number;
  /** Minimum occupied buckets (spread) for the `durable` tier. */
  freqMinBuckets: number;
  /** Boost weight of the hot-window share. */
  freqWeightRecent: number;
  /** Boost weight of the medium-window share. */
  freqWeightWarm: number;
  /** Boost weight of bucket spread (dispersion across distinct commits). */
  freqWeightDurable: number;
  /** Additive flag-floor term weight — truth sources keep wave presence
   *  independent of bookmarks. */
  flagFloorWeight: number;
  /** Baseline share for atoms with no bookmarks (the « new things are
   *  findable » prior); lives in the boost formula, never a bookmark. */
  registrationWeight: number;
  /** Edge fatigue per recent traversal. */
  lambdaFatigue: number;
  /** Fatigue recovery per prompt. */
  fatigueDecay: number;
  /** Top-M edges followed per node during propagation. */
  fanout: number;
  /** Top-K nodes kept per beam level. */
  beam: number;
  /** Per-pass erosion factor of learned `resonates` edges (per `maintain()` call). */
  erodeResonates: number;
  /** Learned edges below this weight are pruned (traced). */
  weightMin: number;
  /** Parent→child descent edge weight. */
  weightContains: number;
  /** Injection token budget. */
  budgetTok: number;
  /** Share of the budget allocated to the payload pool. */
  payloadShare: number;
  /** Semantic-channel silence threshold (model2vec-like embedder). */
  cosSilenceSemantic: number;
  /** Hash-channel silence threshold (typo/morphology channel). */
  cosSilenceHash: number;
  /** Minimum cosine for a vector seed. */
  cosMin: number;
  /** Max vector seeds per query. */
  topKVec: number;
  /** Nodal fatigue strength (parents only). */
  alphaNodal: number;
  /** Sliding window (commits on the scope) for nodal fatigue. */
  nodalWindow: number;
  /** Fan-in attenuation coefficient. */
  betaDin: number;
  /** Max payload leaves per ancestor per injection. */
  maxLeavesPerAncestor: number;
  /** Embedding dimension (must match the embedder). */
  embedDim: number;
  /** Enable the native sqlite-vec KNN index (falls back to JS scan). */
  useSqliteVec: boolean;
  /** Minimum energy for an atom to feed adjacent-term reformulation. */
  adjacentMinEnergy: number;
  /** Max adjacent terms injected at cascade step 2. */
  adjacentMax: number;
  /** Floor on the relative BM25 rank of an FTS seed. */
  rankFloor: number;
  /** Seed energy of an exact referent match (surface r). */
  refSeedEnergy: number;
  /** Regex source matching entity referents in bodies/prompts (surface r).
   *  Default targets governance ids (DEC/ACT/PB/IDEA/SPEC-0000). */
  referentPattern: string;
  /** Regex source matching file paths in bodies (surface r). */
  referentFilePattern: string;
}

/** Input of {@link IOsemRag.registerMemo}. */
export interface IMemoInput {
  id: string;
  body: string;
  kind: string;
  title?: string;
  flag?: "pinned" | "high" | "medium" | "low";
  derivesFrom?: string;
  granularity?: tsGranularity;
  /** When false, the atom is a parent reached by propagation only (no FTS/embedding). */
  fts?: boolean;
  /** Where this atom comes from: file path or URL (provenance). */
  src?: string;
  /** 1-based line in the source where this atom starts (provenance). */
  srcLine?: number;
}

/** Markdown ingestion options for {@link IOsemRag.registerDoc}. */
export interface IRegisterDocOptions {
  /** Atom id prefix (defaults to the file path relative to `rootDir`). */
  idPrefix?: string;
  /** Only files matching this extension (defaults to `.md`). */
  ext?: string;
}

/** Options of {@link IOsemRag.recallLexical} / {@link IOsemRag.recall}. */
export interface IRecallInput {
  /** The acting agent — its personal plane is `agent:<agentId>`. */
  agentId: string;
  prompt: string;
  /** Shared plane(s) receiving a mirror of this excitation's energy
   *  (e.g. `"public"`, `"scope:gov"`, `"skill:sql"`). */
  share?: tsSharedScope | tsSharedScope[];
  /** Act on behalf of a shared scope: the scope becomes the acting plane —
   *  its energy, its sediment, its clock — instead of the agent's personal
   *  plane. Requires ownership: the first caller to actAs a scope becomes its
   *  `scope_owner`; later claims by other agents are rejected. */
  actAs?: tsSharedScope;
  /** Wave strategy. `"lexical"`: one lexical-only wave (the cheap probe —
   *  equivalent to `recallLexical`). `"lexical_vec"` (default): the
   *  cascade — a lexical wave first, then a full wave with adjacent-term
   *  expansion + the vector surface; the stronger wave is kept. `"vec"`:
   *  vec direct — one single wave where lexical AND vector seeds propagate
   *  together; no pre-layer, no adjacent terms, no winner-take-all.
   *  ~half the cost of the cascade. */
  mode?: "lexical" | "lexical_vec" | "vec";
}

/** Options of {@link IOsemRag.formatContext}. */
export interface IFormatContextOpts {
  /** The acting agent. Only used to build the default plane set
   *  (personal + public) when `scopes` is not given. */
  agentId?: string;
  /** Planes to aggregate — authoritative when given: exactly these planes
   *  are read. Default: personal + public. `"all"` = every plane (read-only union). */
  scopes?: tsScopeSelection;
  budgetTok?: number;
}

/** A surfaced atom returned by recallLexical/recall. */
export interface ISurfaced {
  id: string;
  e: number;
  via: string;
  srcs?: string;
}

/** One injected fact, with full provenance (source, section, lines). */
export interface OContextItem {
  /** Source address: file path or URL of the document. */
  source: string;
  /** Breadcrumb: document > section titles. */
  section: string;
  /** 1-based line range in the source (null when unknown, e.g. web pages). */
  lines: [number, number] | null;
  /** Cleaned text of the fact. */
  excerpt: string;
  /** Match energy (higher = stronger). */
  energy: number;
}

/** Injection result: two pools (payload leaves + context breadcrumbs). */
export interface OContextBlock {
  text: string;
  usedTok: number;
  leaves: number;
  leafIds: string[];
  /** Structured provenance for each injected leaf (source, section, lines). */
  items: OContextItem[];
}

/** Field health statistics. */
export interface OStats {
  atoms: number;
  active: number;
  links: number;
  embeddings: number;
  scopes: string[];
  /** Query atoms (`kind='query'`) — provenance entities, excluded from
   *  corpus totals. */
  queryAtoms: number;
}

/** Result of {@link IOsemRag.registerDoc}. */
export interface ORegisterDocResult {
  files: number;
  atoms: number;
}

/** Result of {@link IOsemRag.recall}: the retained wave + its trace. */
export interface ORecallResult {
  surfaced: ISurfaced[];
  trace: string[];
}

/** Result of a maintenance pass. */
export interface OMaintainResult {
  /** Learned edges pruned this pass (each pruning is traced in surface_log). */
  pruned: number;
  /** `freq_buckets` slots that had drifted from the `bookmarks` truth
   *  before this pass rebuilt the ring (0 = cache consistent). */
  ringDrift: number;
}

/** One hottest atom by recent-windowed share (diagnostics). */
export interface OHotAtom {
  id: string;
  flag: string;
  s: number;
}

/** Options of the {@link createOsem} factory. */
export interface IOsemOptions {
  /** Open better-sqlite3 Database (the engine never creates or closes it). */
  db: Database.Database;
  /** Embedder selection (defaults to the built-in hash embedder). */
  embedder?: tsEmbedderChoice;
  /** Optional hash embedder for the typo channel (defaults to built-in). */
  hashEmbedder?: IEmbedder;
  /** Partial config overrides — audited defaults are applied for the rest. */
  config?: Partial<IOsemConfig>;
}

/** The OSEM-RAG public API. */
export interface IOsemRag {
  readonly db: Database.Database;
  readonly config: IOsemConfig;
  readonly embedder: IEmbedder;
  /** Register one memo (leaf or structural parent) into the cadastre. */
  registerMemo(input: IMemoInput): void;
  /** Register a doc tree: doc → sections → paragraphs/sentences (adaptive leaves). */
  registerDoc(rootDir: string, opts?: IRegisterDocOptions): ORegisterDocResult;
  /** Lexical-only recall — the cheap probe. Alias of
   *  `recall({ ...opts, mode: "lexical" })`. */
  recallLexical(opts: IRecallInput): ISurfaced[];
  /** Recall: the query cascade — `mode` picks the wave strategy:
   *  `"lexical"` lexical only, `"lexical_vec"` (default) lexical pre-layer
   *  then full wave, `"vec"` one fused lexical+vector wave. */
  recall(opts: IRecallInput): ORecallResult;
  /** Format context: pinned anchors + payload leaves + breadcrumbs + hot zones. */
  formatContext(opts: IFormatContextOpts): OContextBlock;
  /** Maintenance pass: erode/prune learned edges (traced) + refresh stats. */
  maintain(): OMaintainResult;
  /** Hottest atoms right now by recent-windowed share (diagnostics).
   *  `scope` filters one plane; omitted = best share across every plane —
   *  each atom normalized by its own scope's vocabulary. */
  hotAtoms(n?: number, scope?: tsScopeId): OHotAtom[];
  /** Field health statistics. */
  stats(): OStats;
}
