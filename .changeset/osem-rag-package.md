---
"@ytrynot/osem-rag": minor
---

New package `@ytrynot/osem-rag` (Oscillo Ergo Memini) — deterministic memory-field engine

- Multi-surface seeding (refs / FTS5 per-term IDF / titles / gated dual-channel vector), wave propagation with beam bounds, synaptic + nodal fatigue, fan-in attenuation, spaced forgetting (STP/LTP with `uses_spaced`), honest-silence retrieval and two-pool context injection — all in local SQLite.
- Corpus-relative lexical scoring: every query term is priced by its inverse document frequency (`idf = ln(1 + N/df)`), weighted contributions are additive per term (multi-term coverage dominates), no stop-word list — the corpus itself prices the words.
- Pluggable embedder (`IEmbedder`): built-in hash (zero dependency) or model2vec safetensors loader (pure JS); optional native sqlite-vec KNN index with traced JS-scan fallback and automatic backfill when enabling it on a populated base.
- Memory planes by `scope_id`: personal (`agent:<id>`), shared (`public`), per-scope (`scope:<name>`) and skills (`skill:<name>`); `"all"` = read-only union. An explicit `inject` `scopes` list is authoritative (exactly those planes); default = personal + public. Mirror planes receive waves with `learn=false` (energy + trace only, no double LTP consolidation). Long-term sediment (salience/tau) is global.
- Lazy propagation stats: `deposit` marks the graph dirty; the next wave refreshes `_fan/_mass/_din` on the fly — `deposit → excite` without a `tick()` never runs a dead field.
- Structured retrieval provenance: every surfaced item carries `type`, `breadcrumb`, `source`, `lines`, `excerpt`, `energy` and `foundBy` surfaces.
- Keyword-query contract: prompts are treated as term sets priced by corpus IDF — callers pass distilled keywords (documented in README).
- Idempotent upsert ingestion: re-depositing an atom preserves accumulated salience, tau, uses and spacing state; FTS and title indexes are deduplicated; `supports` channels track the current flag.
- Superseded atoms are inert on every surface: lexical, title, both vector branches (JS scan AND native KNN), and even the IDF document-frequency count.
- 40 vitest tests ported from the v12 adversarial bench: honest silence 10/10, lexical wall 3/3 (frozen dna corpus snapshot), pinned floors, zombie immunity, earned floor by spacing, emergent hype cycles, Gini, injected hubness, latency scaling, byte-identical determinism, stress tests (churn, crash recovery, multi-agents), vec ON/OFF parity, audit regressions (zombie KNN, vec0 backfill, lazy stats), mixed-source ingestion (md + txt + URL + SQL rows), memory planes (share mirrors, learn=false, private/all/scopes) and a LongMemEval-style agent-usage simulation (needle recall, knowledge updates, retraction, adversarial distractors, cross-plane restitution, privacy, abstention, spaced reinforcement, multi-paragraph episodes, query latency).
