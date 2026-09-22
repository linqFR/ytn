# AGENTS.md (Package: @ytrynot/osem-rag)

> [!IMPORTANT] This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**. Use this file ONLY for instructions specific to `@ytrynot/osem-rag`.

---

## Core Architecture

`@ytrynot/osem-rag` (**Oscillo Ergo Memini**) is a deterministic memory-field engine: multi-surface seeding, wave propagation, synaptic fatigue, spaced forgetting (STP/LTP) and honest-silence retrieval, all in local SQLite.

- **`src/types.ts`**: public contract — `IOsemRag` (the engine API), `IOsemConfig` (audited constants with documented defaults), `IEmbedder`, memory-plane types (`tsScopeId`: `agent:<id>` | `public` | `scope:<name>` | `skill:<name>`).
- **`src/engine/ddl.ts`**: the cadastre DDL. `atoms` + `atom_links` are the structural core; `bookmarks` is the append-only LTP truth (one row per commit × scope × surfaced atom, `w = e_atom / n_commit`), `freq_buckets` the derived ring cache (rebuildable from `bookmarks`), `scope_clock.seq` the per-scope window index. `agent_energy`, `edge_gain`, `edge_fatigue` are STP, keyed by `scope_id`; `surface_log` is the audit log (maintenance traces). The vec0 tables are created by the factory only when the sqlite-vec extension loads.
- **`src/engine/field.ts`**: the physics — `computeWave` (non-committal probe: 4 surfaces, beam×2, mass normalization, synaptic fatigue, fan-in attenuation, nodal fatigue on parents only, grouped windowed-frequency boost on pre-commit `seq`) and `commitWave` (atomic commit: `seq` advance, `kind='query'` atom registration, bookmarks + ring writes, `resonates` learning, hebbian gain, edge fatigue — `learn=false` gates graph learning on mirror planes only).
- **`src/engine/formatContext.ts`**: two-pool injection — pinned anchors, payload leaves, ancestor breadcrumbs, hot zones, per-ancestor diversity cap; `kind='query'` atoms are hard-excluded from every surface.
- **`src/engine/maintenance.ts`**: `refreshStats` (materialized `_fan`/`_mass` /`_din`), `maintain` (traced erosion + pruning of learned `resonates` edges
  + `freq_buckets` rebuild with drift count), `hotAtoms` (recent-windowed share over `bookmarks`), `stats`.
- **`src/engine/ingest.ts`**: `registerMemo` (referents → ref atoms + `supports` edges, `derives_from`/`contains`, FTS + dual embeddings + optional vec0), `flagOf`, `leafChunks` (paragraph → sentence when critical/long; never truncate silently), `registerDoc` (generic root dir).
- **`src/index.ts`**: the `createOsem` factory — resolves the embedder (hash default | model2vec dir | custom `IEmbedder`), loads sqlite-vec at most once (traced JS-scan fallback), executes the DDL, refreshes stats.

## Invariants (do not break)

- **The database is injected, never created or closed** by the package.
- **No silent truncation**: leaf granularity is chosen per source, never by truncation. Forgetting is always traced (`surface_log`).
- **Frequency is append-only truth**: `bookmarks` is never updated or deleted; `freq_buckets` is a rebuildable cache, never independent truth. `w0` (registrationWeight) is a read-time term — never a synthetic bookmark.
- **Query atoms are slim**: one `kind='query'` atom per recall (prompt verbatim — no secrets in queries), excluded from seeds, wave targets, payload, breadcrumbs, `formatContext`, `atoms_fts`, `atom_embeddings`.
- **Silence dilutes, never strengthens**: a silent recall writes its query atom + advances the acting scope's `seq`, no bookmarks; foreign silent recalls advance nothing on shared scopes.
- **The wave reads pre-commit state**: a query never sees its own bookmark commit.
- **Determinism**: no `Date.now()` in the physics — timestamps only in logs. Same db state + same prompt → same wave (test D2).
- **Honest silence**: lexical empty AND both vector channels under their thresholds → zero seeds. Never fabricate top-k context.
- **Parents are context, not payload**: injection cites leaves as answers and ancestors as breadcrumbs; parents never steal payload slots.
- **Classifiers never go into the vector surface** (V4-19): hard SQL filters, prefixed FTS tokens, graph hubs; classifier→physics mappings live in configuration, not in engine code.
- All physics constants come from `IOsemConfig` — no hard-coded values in the engine.

## Testing

- 55 vitest tests ported from the v12 adversarial bench: `tests/a-recall.test.ts` (A1 MRR/P@5, A3 lexical wall, A4 honest silence, A10 filiation), `tests/b-temporal.test.ts` (B1, B3, B5, B6, B8, B9, B15), `tests/c-health.test.ts` (C1 Gini, C2 injected hubness, D1 latency, D2 determinism), `tests/d-stress.test.ts` (B12 churn, B13 crash recovery, B14 multi-agents), `tests/e-mixed-sources.test.ts` (md+txt+URL+SQL), `tests/vec-parity.test.ts` (sqlite-vec ON/OFF), `tests/f-audit-regressions.test.ts` (zombie KNN, vec0 backfill, lazy stats), `tests/g-planes.test.ts` (share mirrors, learn=false, private/all/scopes), `tests/i-frequency.test.ts` (windowed-frequency acceptance: ring rebuild, slim query atoms, no self-boost, silence dilution, corpus bound, foreign silence isolation), `tests/h-agent-sim.test.ts` (agent-usage simulation: needle recall, knowledge updates, retraction, distractors, cross-plane, privacy, abstention, spaced reinforcement, query latency, multi-paragraph episodes — LongMemEval-style), `tests/j-functional.test.ts` (end-to-end retrieval effectiveness: hit rate with distractors, frequency tie-break, scope isolation, honest silence, share restitution, payload injection, real-doc retrieval).
- Plain-words map of every test and bench scenario: `docs/result-test-suite_EN.md`.
- Run: `npm.cmd test -w @ytrynot/osem-rag`
- The behavioral reference is the vitest suite itself (see `docs/result-test-suite_EN.md` for what each check guarantees) — re-verify parity after any physics change.
- Perf numbers are platform-dependent: report ratios and trends, never raw ms as universal facts (global AGENTS rule).

## Build & Distribution

- Build: `tsup` via `tsup.config.ts` extending the base config; ESM only.
- `better-sqlite3` is a peer dependency (the caller injects the connection); `sqlite-vec` is an optional peer dependency (native KNN above ~50k atoms).
- Publishing: OIDC trusted publishing via GitHub Actions (see global AGENTS.md). Agents must never run `npm publish` locally.
