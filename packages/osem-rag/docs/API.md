# API reference — `@ytrynot/osem-rag`

> Full reference for the public surface. For the physics behind the calls, see [HOW-IT-WORKS.md](HOW-IT-WORKS.md); for a guided tour, the [README](../README.md#quick-start).

## Table of Contents

- [`createOsem(options)` — the factory](#createosemoptions--the-factory)
- [`IOsemRag` — the engine](#iosemrag--the-engine)
  - [`registerMemo(input)`](#registermemoinput)
  - [`registerDoc(rootDir, opts?)`](#registerdocrootdir-opts)
  - [`recallLexical(opts)`](#recalllexicalopts)
  - [`recall(opts)`](#recallopts)
  - [`formatContext(opts)`](#formatcontextopts)
  - [`maintain()`](#maintain)
  - [`hotAtoms(n?, scope?)` and `stats()`](#hotatomsn-scope-and-stats)
- [Memory planes (`scope_id`)](#memory-planes-scope_id)
- [`IEmbedder` — plug your own model](#iembedder--plug-your-own-model)
- [Utilities — ingestion helpers and internals](#utilities--ingestion-helpers-and-internals)
- [`IOsemConfig` — every constant](#iosemconfig--every-constant)
- [How-to cookbook](#how-to-cookbook)
- [Errors](#errors)

---

## `createOsem(options)` — the factory

The single entry point. It never opens or closes the database — you inject an open `better-sqlite3` connection.

```typescript
import Database from "better-sqlite3";
import { createOsem } from "@ytrynot/osem-rag";

const db = new Database("memory.db");          // your connection, your file
const osem = createOsem({
  db,                                          // required
  embedder: { kind: "hash" },                  // optional — see below
  hashEmbedder: undefined,                     // optional: custom typo channel
  config: { theta: 0.5 },                      // partial overrides
});
```

`IOsemOptions`:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `db` | `Database.Database` | *required* | Open better-sqlite3 connection. Never created or closed by the engine. |
| `embedder` | `tsEmbedderChoice` | `{ kind: "hash" }` | `{ kind: "hash" }` (zero dependency) · `{ kind: "model2vec", modelDir }` (local safetensors) · `{ embedder: IEmbedder }` (your own). |
| `hashEmbedder` | `IEmbedder` | built-in | The typo/morphology channel. |
| `config` | `Partial<IOsemConfig>` | audited defaults | Any subset of the engine constants. |

The semantic model is loaded **eagerly** (a few ms); a missing or unreadable `modelDir` throws at construction. `embedDim` must equal the model's dimension.

---

## `IOsemRag` — the engine

### `registerMemo(input)`

Register one memo into the cadastre. Register the **parent before the child**: `derivesFrom` is a foreign key.

```typescript
// Parent first — a structural atom, reached by propagation only:
osem.registerMemo({ id: "table:decisions", kind: "synthese", granularity: "doc",
               body: "Table decisions (external source)", fts: false });

// Then the leaf:
osem.registerMemo({
  id: "row:decisions#DEC-0006",       // unique id — encode the hierarchy if you like
  body: "table: decisions | id: DEC-0006 | status: adopted | …",
  kind: "observation",                // free-form: observation, synthese, decision, skill…
  title: "decisions governance",      // indexed in the title surface
  flag: "pinned",                     // pinned | high | medium | low (drives floors)
  granularity: "row",                 // sentence | paragraph | section | row | field | doc
  derivesFrom: "table:decisions",     // provenance — must exist first
  fts: true,                          // false = parent reached by propagation only
});
```

`IMemoInput` also carries `src` / `srcLine` — the source address and 1-based line — recorded for exact provenance in `formatContext()` items.

Referents inside the body (`DEC-0006`, `file:schema.sql`…) automatically become hub atoms linked by `supports` edges.

### `registerDoc(rootDir, opts?)`

Walk `rootDir` recursively, register every `*.md` (or `opts.ext`) as `doc → section → paragraph → sentence` (sentences only for critical or very long paragraphs). Never truncates. `opts.idPrefix` overrides the default id prefix (the path relative to `rootDir`). Returns `{ files, atoms }`.

### `recallLexical(opts)`

Single-pass activation: decay the agent's working memory, seed the lexical surfaces (referents, FTS5 BM25-weighted, titles), propagate two beam-bounded levels, commit. Lexical surfaces only — no escalation, no vector surface. Alias of `recall({ mode: "lexical" })`; prefer [`recall`](#recallopts) for user-facing queries.

```typescript
osem.recallLexical({ agentId: "a1", prompt: "…" });
```

`IRecallInput`:

| Field | Type | Meaning |
|---|---|---|
| `agentId` | `string` | The acting agent — its personal plane is `agent:<agentId>` |
| `prompt` | `string` | The query — pass distilled keywords, not a full sentence (IDF prices each term) |
| `share?` | `tsSharedScope \| tsSharedScope[]` | Shared plane(s) receiving a mirror of the wave's energy, without double learning |
| `actAs?` | `tsSharedScope` | Act on behalf of a shared scope: it becomes the acting plane (energy + bookmarks + seq). Owner-gated — first claimer becomes `scope_owner`, later non-owner claims throw |
| `mode?` | `"lexical" \| "lexical_vec" \| "vec"` | `recall` only. `"lexical"`: one lexical-only wave (the cheap probe — same as `recallLexical`). `"lexical_vec"` (default): lexical pre-layer wave first, then the full wave (adjacent terms + vector) — stronger wave kept. `"vec"`: one fused lexical+vector wave — ~half the cost, no adjacent-term expansion |

### `recall(opts)`

The full two-step strategy — a first **lexical wave (N1)**, then always a second **full wave (N2)** adding adjacent terms and the vector surface; the stronger wave is kept. `recallLexical` is the cheap N1-only path (equivalent to `mode: "lexical"`). With `mode: "vec"`, `recall` skips the lexical pre-layer and computes one fused wave where lexical and vector seeds propagate together — no adjacent terms, no winner-take-all. Returns `{ surfaced, trace }` — `trace` explains what happened at each step, useful for debugging recall.

Both `recallLexical` and `recall` fill the agent's working memory (the STP plane `agent:<agentId>`) *and* return the atoms that crossed the surfacing threshold — [`formatContext`](#formatcontextopts) then renders that working memory.

> **Every recall is a commit.** One `kind='query'` atom is written per recall (the prompt stored verbatim — **never put secrets in queries**), `seq` advances on the acting scope, and each surfaced atom earns a `bookmark` weighted `w = e_atom / n_commit` plus a `freq_buckets` ring increment. A silent recall still writes its query atom and advances `seq` — silence dilutes by sliding windows, it never strengthens atoms.

`ISurfaced` — one atom that crossed the threshold:

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | Atom id |
| `e` | `number` | Wave energy after the `theta` threshold |
| `via` | `string` | `"bubble"` (direct seed) or `"wave"` (reached by propagation) |
| `srcs?` | `string` | Surfaces that hit it — e.g. `"f,g"` = full-text + title |

### `formatContext(opts)`

Build the ready-to-paste context block from the agent's working memory — i.e. from what `recallLexical` / `recall` surfaced. `formatContext` reads the working memory of the plane(s) given in `scopes` (default: the `agentId`'s personal plane + `public`), so the `agentId` passed here must be the one the recall filled — a different `agentId` renders that *other* plane's memory (empty if it was never recalled), not an error.

```typescript
osem.formatContext({ agentId: "my-agent", scopes: ["public", "scope:gov"], budgetTok: 800 });
```

- `scopes` — which memory planes to aggregate: explicit list or `"all"` (read-only union of every plane). An explicit list is **authoritative** — exactly those planes are read; the personal plane is not implicitly added. Default (no `scopes`): personal + public.
- Returns `{ text, usedTok, leaves, leafIds, items }`:
  - `text` — the ready-to-paste block; each fact carries its breadcrumb and line range.
  - `items` — structured provenance per injected fact:

    ```typescript
    {
      source: "docs/serialization.md",      // file path or URL
      section: "serialization > Internals", // doc > section breadcrumb
      lines: [42, 47],                      // 1-based lines (null when unknown)
      excerpt: "serialization toJS converts…",
      energy: 1.28,
    }[]
    ```

### `maintain()`

Maintenance pass: erode learned `resonates` edges (×0.97), prune those below `weightMin` (every pruning logged to `surface_log`), rebuild the `freq_buckets` ring from `bookmarks`, refresh the propagation statistics. No argument — each scope counts its own commits internally. Returns `{ pruned, ringDrift }` — `ringDrift` is the number of ring slots that had drifted from the `bookmarks` truth before the rebuild (0 on a healthy base).

> **One handle per connection.** Two `createOsem()` handles on the same `better-sqlite3` connection share the propagation-stats TEMP tables but each tracks its own dirty flag — registrations made through handle B leave handle A's stats stale until its next `maintain()`. Treat an `IOsemRag` instance as the single writer of its connection.

### `hotAtoms(n?, scope?)` and `stats()`

Diagnostics — see [Operations in the README](../README.md#operations). `hotAtoms` returns the hottest atoms by recent-windowed share; `scope` filters one plane (omitted = best share across every plane). `stats()` returns `{ atoms, active, links, embeddings, scopes, queryAtoms }` — field health; `queryAtoms` counts the `kind='query'` provenance atoms separately (they are excluded from corpus surfaces).

---

## Memory planes (`scope_id`)

One physical mechanism, four addressing modes:

| Plane | `scope_id` | Write | Read |
|---|---|---|---|
| Personal | `agent:<agentId>` | the agent recalls into its own working memory | that agent only |
| Shared | `public` | any agent may recall into it | everyone |
| Per-scope | `scope:<name>` | public memory scoped to a project/team | agents of that scope |
| Skill | `skill:<name>` | shared working memory of a skill | any agent invoking the skill |
| All | `"all"` | never written directly | read-only union of every plane |

```typescript
// Personal recall, mirrored into a shared scope:
osem.recallLexical({ agentId: "agent-1", prompt, share: "scope:gov" });

// Inject from public + a scope (authoritative list):
osem.formatContext({ agentId: "a", scopes: ["public", "scope:gov"] });

// Read-only union of every plane:
osem.formatContext({ agentId: "a", scopes: "all" });
```

Every scope is an **attention domain**: durable memory lives in `bookmarks(scope_id, atom_id, seq, w, …)` — each plane records its own surfacings. Skills are scopes (`skill:<name>`) plus atoms with `kind: "skill"`; an "expert" is a virtual agent (`agent:expert:<name>`) only when it needs a private working memory, otherwise it is mere provenance.

Two guards make divergent callers safe:

- **Per-scope commit counter** (`scope_clock.seq`): callers never provide time — each scope counts its own commits (acting recalls and share commits that land on it). A stale or foreign caller cannot rewind — nor flush — a scope's windows: foreign silent recalls advance nothing on it.
- **Scope ownership** (`scope_owner`): the first writer becomes the scope's owner — and the only agent allowed to `actAs` it (pin certification and shared-scope consolidation).

> **Sharing is observation, not learning**: `share` commits write the same surfacings onto the mirror planes as *their own* bookmarks — the shared scope accumulates frequency honestly — but graph learning (`resonates`, hebbian gain, edge fatigue) stays acting-plane only (`learn=false`).

---

## `IEmbedder` — plug your own model

```typescript
export interface IEmbedder {
  /** L2-normalized dense vector for the text. Deterministic. */
  embed(text: string): Float32Array;
  readonly dim: number;
  readonly vocab: number;
}
```

Built-in: `createHashEmbedder(dim = 256)` (zero dependency) and `loadModel2Vec(dir)` (pure-JS safetensors + WordPiece loader). Any third-party embedder works through the same contract; the field physics are identical whatever the backend.

## Utilities — ingestion helpers and internals

Exported from the package root for custom ingestion pipelines and provenance display:

| Export | Signature | Purpose |
|---|---|---|
| `DEFAULT_OSEM_CONFIG` | `IOsemConfig` | the audited defaults — the base to spread before overriding |
| `splitMarkdownSections(md)` | `(md: string) => { text, line }[]` | reproduce `registerDoc`'s section splitting on a single markdown text |
| `leafChunks(secId, rel, section, secLine?)` | generator of `{ id, granularity, body, flag, srcLine }` | reproduce `registerDoc`'s adaptive leaf chunking (paragraph → sentence) |
| `ancestorsOf(db, id)` | `(db, atomId) => { id, title }[]` | walk the `derives_from` chain upward — breadcrumbs for display |
| `ftsMatch(term)` | `(t: string) => string` | the engine's FTS5 term escaping — build a MATCH expression safely |
| `refreshStats(db, cfg)` | `(db, cfg) => void` | force-refresh the `_fan`/`_mass`/`_din` propagation stats (normally lazy) |

## `IOsemConfig` — every constant

Every field is documented in `src/types.ts` and validated by a test. The defaults, grouped by subsystem:

**Wave and surfacing**

| Field | Default | Meaning |
|---|---|---|
| `theta` | 0.5 | surfacing threshold on wave energy |
| `cutEnergy` | 0.05 | beam pruning floor |
| `beam` | 50 | max atoms per wave level |
| `fanout` | 20 | max outgoing edges explored per atom |
| `decayProp` | 0.85 | per-hop energy discount |
| `decaySession` | 0.7 | STP decay applied at commit |
| `betaDin` | 0.1 | destination in-degree dilution |
| `rankFloor` | 0.3 | minimum rank weight on seeds |
| `adjacentMinEnergy` / `adjacentMax` | 0.08 / 6 | adjacent-term expansion gate and cap (N2) |

**Frequency windows (the forgetting model)**

| Field | Default | Meaning |
|---|---|---|
| `freqWindowHot` / `freqWindowMedium` / `freqWindowLong` | 20 / 50 / 100 | commit windows — hot / warm / durable tiers |
| `freqBucketSize` | 10 | commits per ring bucket (`freqWindowLong / freqBucketSize` = ring depth) |
| `freqMinBuckets` | 3 | minimum bucket spread for the durable tier |
| `freqWeightRecent` / `freqWeightWarm` / `freqWeightDurable` | 1.0 / 1.0 / 1.0 | per-tier share weights |
| `flagFloorWeight` | 1.0 | weight of the flag floor in the share |
| `registrationWeight` | 1.0 | `w0` — the read-time floor for never-bookmarked atoms |

**Learning and fatigue**

| Field | Default | Meaning |
|---|---|---|
| `eta` | 0.05 | hebbian gain rate |
| `maxGainPerSession` | 0.5 | gain cap per scope clock |
| `ltpRate` | 0.3 | deposit-rate coefficient in the share |
| `lambdaFatigue` / `fatigueDecay` | 0.15 / 0.5 | synaptic fatigue coefficient and decay |
| `alphaNodal` / `nodalWindow` | 0.3 / 30 | nodal fatigue weight and window |
| `erodeResonates` / `weightMin` | 0.97 / 0.7 | maintenance erosion rate and prune floor |

**Seeding surfaces**

| Field | Default | Meaning |
|---|---|---|
| `seedFts` / `topKFts` | 0.8 / 8 | FTS5 seed energy and count |
| `refSeedEnergy` | 1.0 | referent seed energy |
| `referentPattern` / `referentFilePattern` | *regexes* | governance-id and file-path extractors — override for non-governance corpora |

**Vector surface and silence**

| Field | Default | Meaning |
|---|---|---|
| `cosSilenceSemantic` / `cosSilenceHash` | 0.40 / 0.55 | per-channel silence guards |
| `cosMin` / `topKVec` | 0.25 / 8 | vector seed floor and count |
| `embedDim` | 256 | embedding dimension (must match the embedder) |
| `useSqliteVec` | false | native KNN via the sqlite-vec extension |

**Context injection**

| Field | Default | Meaning |
|---|---|---|
| `budgetTok` / `payloadShare` | 800 / 0.7 | token budget and payload share |
| `maxLeavesPerAncestor` | 3 | diversity cap per ancestor |
| `floorPinned` / `floorHigh` | 0.6 / 0.3 | flag floors (`pinned` / `high`) |
| `weightContains` | 0.3 | `contains` edge weight |

Each value traces back to a test in the campaign — see [`spec-memory-model_EN.md`](spec-memory-model_EN.md) before changing the physics.

---

## How-to cookbook

### Ask a question

```typescript
const { surfaced, trace } = osem.recall({
  agentId: "assistant", prompt: "sqlite migration strategy",
});
const ctx = osem.formatContext({ agentId: "assistant", budgetTok: 800 });
// → paste ctx.text into your prompt; ctx.items is the machine-readable
//   provenance for citations.
```

### Run a multi-agent system

```typescript
// Each agent works in its own plane; shared knowledge flows via share:
osem.recall({ agentId: "agent-a", prompt, share: "scope:team" });
osem.recall({ agentId: "agent-b", prompt });   // sees nothing of a's plane

// Inject the union an agent is entitled to:
osem.formatContext({ agentId: "agent-b", scopes: ["agent:agent-b", "scope:team", "public"] });
```

### The engine keeps its own time

No clock to pass — each scope counts its own **commits** (`seq`): every acting recall is one commit, silent or not, and every share commit landing on a mirror plane counts on that plane. Dilution, spread and fatigue are driven by the scope's own activity: a plane nobody commits on doesn't age — and a foreign agent's silent recalls cannot flush a shared scope. Just call:

```typescript
for (const prompt of conversation) {
  osem.recall({ agentId: "assistant", prompt });
  osem.maintain();                           // maintenance: erosion + pruning + stats
}
```

### Ingest non-markdown sources

`registerMemo()` accepts any source — rows, API payloads, web pages. Set `src` / `srcLine` so `formatContext()` returns exact citations:

```typescript
osem.registerMemo({ id: `url:${u}`, kind: "web", body: pageText,
               src: u, flag: "medium", granularity: "doc" });
```

## Errors

- Missing `db` or a closed connection → construction throws.
- Missing `modelDir` for `model2vec` → construction throws.
- `derivesFrom` pointing to a non-existent atom → `registerMemo` throws (FK).
- `embedDim` mismatch with the embedder → construction throws.
