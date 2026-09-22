---
"@ytrynot/osem-rag": minor
---

New package `@ytrynot/osem-rag` (Oscillo Ergo Memini) — deterministic memory-field engine

- Multi-surface seeding (refs / FTS5 per-term IDF / titles / gated dual-channel vector), wave propagation with beam bounds, synaptic + nodal fatigue, fan-in attenuation, windowed-frequency LTP and honest-silence retrieval — all in local SQLite.
- **Windowed-frequency memory**: every recall is an atomic commit — one `kind='query'` atom (the prompt verbatim, slim: no FTS, no embeddings, excluded from every surface) + one append-only `bookmarks` row per surfaced atom (`w = e_atom / n_commit`) + `freq_buckets` ring increments. Durable importance = the atom's share of the scope's recent commits (`f20` exact on bookmarks; `f50`/`f100`/`spread` on the ring). `maintain()` rebuilds the ring from `bookmarks` and reports `ringDrift`.
- Silence dilutes: a silent recall advances the acting scope's `seq` and writes no bookmarks — windows slide past old surfacings. Foreign silent recalls cannot flush a shared scope (only owner `actAs` recalls and share commits advance it).
- Corpus-relative lexical scoring: every query term is priced by its inverse document frequency (`idf = ln(1 + N/df)`), weighted contributions are additive per term (multi-term coverage dominates), no stop-word list — the corpus itself prices the words.
- Pluggable embedder (`IEmbedder`): built-in hash (zero dependency) or model2vec safetensors loader (pure JS); optional native sqlite-vec KNN index with traced JS-scan fallback and automatic backfill when enabling it on a populated base.
- Memory planes by `scope_id`: personal (`agent:<id>`), shared (`public`), per-scope (`scope:<name>`) and skills (`skill:<name>`); `"all"` = read-only union. An explicit `formatContext` `scopes` list is authoritative (exactly those planes); default = personal + public. Mirror planes write their own bookmarks (share commits) but never graph-learn (`learn=false`). Per-scope normalization: `N_scope` counts distinct bookmarked atoms — deposits are inert, a foreign corpus cannot dilute a scope.
- Lazy propagation stats: `registerMemo` marks the graph dirty; the next wave refreshes `_fan/_mass/_din` on the fly.
- Structured retrieval provenance: every injected item carries `source`, `section`, `lines`, `excerpt`, `energy`; bookmarks keep `via`/`path`.
- Idempotent upsert ingestion: re-depositing an atom preserves its bookmarks and ring; FTS and title indexes are deduplicated.
- Superseded atoms are inert on every surface: lexical, title, both vector branches (JS scan AND native KNN), and even the IDF document-frequency count.
- 55 vitest tests ported from the v12 adversarial bench plus windowed-frequency acceptance tests (ring rebuild, slim query atoms, no self-boost, silence dilution, corpus bound, foreign-silence isolation) and functional retrieval checks: honest silence 10/10, lexical wall 3/3, pinned floors, zombie immunity, earned spread by spacing, emergent hype cycles, Gini, injected hubness, latency scaling, byte-identical determinism, stress tests (churn, crash recovery, multi-agents), vec ON/OFF parity, audit regressions, mixed-source ingestion, memory planes and a LongMemEval-style agent-usage simulation.
- `recall` wave strategy via `mode`: `"lexical"` (one lexical-only wave — `recallShallow` is its alias), `"lexical_vec"` (default: lexical wave then a full wave with adjacent terms + the vector surface, stronger wave kept), `"vec"` (one fused lexical+vector wave — no adjacent terms, ~half the cascade cost). The vector surface always embeds the raw prompt.
- External benchmark harness: `npm run lme` runs LongMemEval-S retrieval evaluation (500 instances, dataset auto-downloaded and cleaned up) — hit@5 0.932–0.946 across modes, evidence coverage + injected-coverage metrics included.
- Public helpers for custom ingestion pipelines: `leafChunks`, `splitMarkdownSections`, `ancestorsOf`.
