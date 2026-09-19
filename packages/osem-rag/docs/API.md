# API reference — `@ytrynot/osem-rag`

> Full reference for the public surface. For the physics behind the calls,
> see [HOW-IT-WORKS.md](HOW-IT-WORKS.md); for a guided tour, the
> [README](../README.md#quick-start).

## Table of Contents

- [`createOsem(options)` — the factory](#createosemoptions--the-factory)
- [`IOsemRag` — the engine](#iosemrag--the-engine)
  - [`registerMemo(input)`](#registermemoinput)
  - [`registerDoc(rootDir, opts?)`](#registerdocrootdir-opts)
  - [`recallShallow(opts)`](#recallshallowopts)
  - [`recall(opts)`](#recallopts)
  - [`formatContext(opts)`](#formatcontextopts)
  - [`maintain()`](#maintain)
  - [`hotAtoms(n?, scope?)` and `stats()`](#hotatomsn-scope-and-stats)
- [Memory planes (`scope_id`)](#memory-planes-scope_id)
- [`IEmbedder` — plug your own model](#iembedder--plug-your-own-model)
- [`IOsemConfig` — every constant](#iosemconfig--every-constant)
- [How-to cookbook](#how-to-cookbook)
- [Errors](#errors)

---

## `createOsem(options)` — the factory

The single entry point. It never opens or closes the database — you inject
an open `better-sqlite3` connection.

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

The semantic model is loaded **eagerly** (a few ms); a missing or unreadable
`modelDir` throws at construction. `embedDim` must equal the model's
dimension.

---

## `IOsemRag` — the engine

### `registerMemo(input)`

Register one memo into the cadastre. Register the **parent before the child**:
`derivesFrom` is a foreign key.

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

`IMemoInput` also carries `src` / `srcLine` — the source address and
1-based line — recorded for exact provenance in `formatContext()` items.

Referents inside the body (`DEC-0006`, `file:schema.sql`…) automatically
become hub atoms linked by `supports` edges.

### `registerDoc(rootDir, opts?)`

Walk `rootDir` recursively, register every `*.md` (or `opts.ext`) as
`doc → section → paragraph → sentence` (sentences only for critical or very
long paragraphs). Never truncates. `opts.idPrefix` overrides the default id
prefix (the path relative to `rootDir`). Returns `{ files, atoms }`.

### `recallShallow(opts)`

Single-pass excitation: decay the agent's working memory, seed the lexical
surfaces (referents, FTS5 BM25-weighted, titles), propagate two beam-bounded
levels, commit. Lexical surfaces only — no escalation, no vector surface.
Prefer [`recall`](#recallopts) for user-facing queries.

```typescript
osem.recallShallow({ agentId: "a1", prompt: "…" });
```

`IRecallInput`:

| Field | Type | Meaning |
|---|---|---|
| `agentId` | `string` | The acting agent — its personal plane is `agent:<agentId>` |
| `prompt` | `string` | The query — pass distilled keywords, not a full sentence (IDF prices each term) |
| `share?` | `tsSharedScope \| tsSharedScope[]` | Shared plane(s) receiving a mirror of the wave's energy, without double learning |
| `actAs?` | `tsSharedScope` | Act on behalf of a shared scope: it becomes the acting plane (energy + sediment + clock). Owner-gated — first claimer becomes `scope_owner`, later non-owner claims throw |

### `recall(opts)`

The full two-step strategy (N1 lexical → N2 adjacent terms + vector surface).
Returns `{ surfaced, trace }` — `trace` explains what happened at each step,
useful for debugging recall.

Both `recallShallow` and `recall` fill the agent's working memory (the STP
plane `agent:<agentId>`) *and* return the atoms that crossed the surfacing
threshold — [`formatContext`](#formatcontextopts) then renders that working memory.

`ISurfaced` — one atom that crossed the threshold:

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | Atom id |
| `e` | `number` | Wave energy after the `theta` threshold |
| `via` | `string` | `"bubble"` (direct seed) or `"wave"` (reached by propagation) |
| `srcs?` | `string` | Surfaces that hit it — e.g. `"f,g"` = full-text + title |

### `formatContext(opts)`

Build the ready-to-paste context block from the agent's working memory —
i.e. from what `recallShallow` / `recall` surfaced.

```typescript
osem.formatContext({ agentId: "my-agent", scopes: ["public", "scope:gov"], budgetTok: 800 });
```

- `scopes` — which memory planes to aggregate: explicit list or `"all"`
  (read-only union of every plane). An explicit list is **authoritative** —
  exactly those planes are read; the personal plane is not implicitly added.
  Default (no `scopes`): personal + public.
- Returns `{ text, usedTok, leaves, leafIds, items }`:
  - `text` — the ready-to-paste block; each fact carries its breadcrumb and
    line range.
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

Maintenance pass: erode learned `resonates` edges (×0.97), prune those below
`weightMin` (every pruning logged to `surface_log`), refresh the propagation
statistics. No argument — each scope counts its own hits internally.
to `recallShallow`. Returns `{ pruned }`.

> **One handle per connection.** Two `createOsem()` handles on the same
> `better-sqlite3` connection share the propagation-stats TEMP tables but
> each tracks its own dirty flag — registrations made through handle B leave
> handle A's stats stale until its next `maintain()`. Treat an `IOsemRag`
> instance as the single writer of its connection.

### `hotAtoms(n?, scope?)` and `stats()`

Diagnostics — see [Operations in the README](../README.md#operations).
`hotAtoms` returns the top-salience atoms right now; `scope` filters
one plane (omitted = hottest row across every plane). `stats()` returns
`{ atoms, active, links, embeddings, scopes }` — field health.

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
// Personal excitation, mirrored into a shared scope:
osem.recallShallow({ agentId: "agent-1", prompt, share: "scope:gov" });

// Inject from public + a scope (authoritative list):
osem.formatContext({ agentId: "a", scopes: ["public", "scope:gov"] });

// Read-only union of every plane:
osem.formatContext({ agentId: "a", scopes: "all" });
```

Every scope is an **attention domain**: long-term sediment lives in
`atom_sediment(atom_id, scope_id)` — each plane consolidates its own memory
of an atom. Skills are scopes (`skill:<name>`) plus atoms with
`kind: "skill"`; an "expert" is a virtual agent (`agent:expert:<name>`) only
when it needs a private working memory, otherwise it is mere provenance.

Two guards make divergent callers safe:

- **Per-scope hit counter** (`scope_clock`): callers never provide time —
  each scope counts its own acting recalls (`hit`) and commits (`seq`). A
  stale or foreign caller cannot rewind — nor inflate — a scope's sediment.
- **Scope ownership** (`scope_owner`): the first writer becomes the scope's
  owner — and the only agent allowed to `actAs` it (pin certification and
  shared-scope consolidation).

> **Learning is per-plane**: `share` mirrors energy + trace into shared
> planes but never consolidates their sediment — only the acting plane
> learns. A shared scope accumulates LTP only through its owner's
> `actAs` recall.

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

Built-in: `createHashEmbedder(dim = 256)` (zero dependency) and
`loadModel2Vec(dir)` (pure-JS safetensors + WordPiece loader). Any
third-party embedder works through the same contract; the field physics are
identical whatever the backend.

## `IOsemConfig` — every constant

Every field is documented in `src/types.ts` and validated by a test. The
defaults:

`theta` 0.5 · `decaySession` 0.7 · `decayProp` 0.85 · `cutEnergy` 0.05 ·
`seedFts` 0.8 · `topKFts` 8 · `eta` 0.05 · `maxGainPerSession` 0.5 ·
`ltpRate` 0.3 · `floorPinned` 0.6 · `floorHigh` 0.3 · `tau0` 5 ·
`kappaTau` 0.25 · `tauCapUses` 12 · `floorMax` 0.3 · `floorLambda` 3 ·
`lambdaFatigue` 0.15 · `fatigueDecay` 0.5 · `fanout` 20 · `beam` 50 ·
`erodeResonates` 0.97 · `weightMin` 0.7 · `weightContains` 0.3 ·
`budgetTok` 800 · `payloadShare` 0.7 · `thetaConf` 0.9 ·
`cosSilenceSemantic` 0.4 · `cosSilenceHash` 0.55 · `cosMin` 0.25 ·
`topKVec` 8 · `alphaNodal` 0.3 · `nodalWindow` 30 · `betaDin` 0.1 ·
`maxLeavesPerAncestor` 3 · `embedDim` 256 · `useSqliteVec` false ·
`salienceBoost` 0.4 · `adjacentMinEnergy` 0.08 · `adjacentMax` 6 ·
`rankFloor` 0.3 · `refSeedEnergy` 1.0 · `referentPattern` /
`referentFilePattern` (governance-id and file-path regexes for the referent
surface — override them for non-governance corpora).

Each value traces back to a test in the campaign — see
[`19-v4-mesures_EN.md`](19-v4-mesures_EN.md) before changing the physics.

---

## How-to cookbook

### Ask a question

```typescript
let t = 0;
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

No clock to pass — each scope counts its own **hits** (acting recalls) and
**commits**. Decay, spacing and fatigue are driven by the scope's own
activity: a plane that isn't consulted doesn't age. Just call:

```typescript
for (const prompt of conversation) {
  osem.recall({ agentId: "assistant", prompt });
  osem.maintain();                           // maintenance: erosion + pruning + stats
}
```

### Ingest non-markdown sources

`registerMemo()` accepts any source — rows, API payloads, web pages. Set `src` /
`srcLine` so `formatContext()` returns exact citations:

```typescript
osem.registerMemo({ id: `url:${u}`, kind: "web", body: pageText,
               src: u, flag: "medium", granularity: "doc" });
```

## Errors

- Missing `db` or a closed connection → construction throws.
- Missing `modelDir` for `model2vec` → construction throws.
- `derivesFrom` pointing to a non-existent atom → `registerMemo` throws (FK).
- `embedDim` mismatch with the embedder → construction throws.
