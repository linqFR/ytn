# 19 — ARIANE-CHAMP v4: concepts, code status, measurement protocol

> Status: spec + measurement plan. Reference code: `sandbox/poc-ariane-champ-v6.ts`
> (~610 lines, zero dependencies outside `better-sqlite3`) — implements V4-1→V4-10:
> multi-surface engine, `contains` descent, fatigue, traced pruning, lazy STP/LTP,
> cascade with reformulation, 2-pool injection. History: v3 (STP/LTP),
> v4 (pure SQL), v5 (crossed surfaces).

---

## 1. Concepts — what is actually new

### 1.1 The dual time scale (STP / LTP)

Two states per atom, two time constants, two roles:

| Layer | Storage | Decay | Analogy | Role |
|---|---|---|---|---|
| `session_energy` | SQLite, reset per session | ×0.7 / prompt | STP (working memory) | Priming: a raised topic stays "warm" within the session |
| `salience` | SQLite, persistent | ×0.9 / session | LTP (consolidation) | A frequently worked-on topic survives days without solicitation |

Key v3 rule: **salience only adds energy to atoms that are already excited**.
Long-term warmth *lowers the threshold*; it does not resurface anything without
a signal. A warm off-topic atom never pollutes the context.

### 1.2 Bounded hysteresis (association reinforcement)

Every edge traversed by the wave gains `η = 0.05` of weight (cap `w ≤ 3`,
`+0.5` max per session, 0.98/session refill planned). Frequently used paths
become highways; dead paths slowly erode.

**Immunities** (against the zombie fact, skeptic's C4):
- `status ≠ active` → never reinforced, never excited.
- `floor = 1` edges (engraved channels) → neither reinforced nor eroded: the
  guarantee does not depend on usage.

### 1.3 The critical floor

`flag = pinned` or `critical` → `salience` can never drop below 0.3.
Criticality is a *right of surfacing*, not a probabilistic score.
A fact stated once remains reachable months later —
independently of its usage frequency (frequency ≠ importance).

### 1.4 Behavioral consolidation

At session end: `salience += 0.3 × session_energy` for atoms that
resonated on ≥ 2 prompts (standing waves). The field *measures* what to
consolidate; no LLM decides. The LLM only serves to write the optional summary.

### 1.5 Synaptic fatigue (deterministic anti-echo-chamber)

Against rich-get-richer, **no randomness** (ε-greedy abandoned: it injected
noise to compensate for a flaw in the weight model). The right mechanism is
**synaptic depression** — a synapse that fires a lot temporarily
transmits less well:

`w_eff = w / (1 + λ·recent_uses)` with λ≈0.15, decay ×0.5/prompt.

The most-traveled path tires → neighbors become *relatively*
more attractive → the field mechanically rotates around the theme instead of
fixating on it. Rotation without noise, bounded by construction (the nominal
strength `w` is never modified), reversible (intra-session only).
**Exemption**: `floor=1` never fatigues — an engraved channel does not depend on
the field's mood.

### 1.6 Thermal selection (transposition of T-GADE, arXiv:2609.12287)

T-GADE applies statistical thermodynamics to *generation* (artifact
selection by energy level, high entropy = preserved diversity, unstable
states eliminated). Different domain, but the transposition to the field is
real — **not on propagation, on injection**:

- The current hard `θ` is a binary filter (in/out). A **Boltzmann
  selection** `P(surface) ∝ exp(E/kT)` would replace the threshold with a
  distribution: atoms just below θ get a chance, proportional to
  their energy — no more cliff effect.
- The useful parameter is not randomness but the **temperature
  schedule (annealing)**: high T at session start (the field
  explores broadly, context not yet crystallized) → low T when
  standing waves emerge (the session has a theme, exploit it).
  Temperature becomes a *deterministic function of session state*:
  `T = f(nb_waves, session_entropy)` — the policy stays mechanical,
  only the sampling is stochastic.
- **Distinction from fatigue**: fatigue *rotates paths*
  (propagation); temperature adjusts the *admission width* (injection).
  The two mechanisms are orthogonal and not substitutable.

Status: experimental candidate — to be A/B evaluated against the hard θ (test A6).
The original T-GADE targets generation; its value here is the schedule, not
the selection itself.

### 1.7 What is NOT new (skeptic's cartography, maintained)

- Propagation = spreading activation / PPR (HippoRAG, 2024)
- Standing waves = co-activation counter / EWMA (Generative Agents, 2023)
- Harmonics = `derives_from` ascent (RAPTOR)
- The near-unique remainder: **nodal/accessibility audit** and
  `carrier_at_write` (memory knows the agent's situation at encoding time).

---

## 2. The code — v3 state and v4 changes

### 2.1 Effective architecture (v3, tested)

```
prompt ──► excite()
             1. seeds: FTS5 (OR of terms ≥3 chars, BM25 rank) ∪ regex refs
             2. + residual salience on excited atoms (threshold lowering)
             3. propagation: iterative frontier (2 iters, ×0.85), Map in RAM
             4. traversed edges: w += η (bounded)
             5. session_energy: upsert + decay
session end ──► consolidate(): standing waves ∪ flagged → salience += 0.3×E
             ► longTermDecay(): salience ×= 0.9, floor for flagged atoms
```

### 2.2 v4 changes (answer to the engineering critique)

| # | v3 problem | v4 fix |
|---|---|---|
| V4-1 | `loadAdjacency` loads the whole graph into Node RAM → OOM at ~100k nodes, frozen Event Loop | **Pure-SQL propagation**: `WITH RECURSIVE wave(id, e, depth)` over `atom_links`, depth ≤ 2, `SUM(e)` aggregation per atom inside the CTE. Result materialized in temp table `_wave`. |
| V4-2 | N+1: one `UPDATE` per traversed edge (500 edges = 500 queries) | **A single `UPDATE ... FROM _wave`** joined on `atom_links.src`. All synapses reinforced in one query. |
| V4-3 | `longTermDecay` = `UPDATE` over all active atoms → locks + WAL bloat | **Lazy decay**: `salience` decays at read time (`salience × 0.9^sessions_since_last_touch`), a single `UPDATE` per *touched* atom. Alternative if the team prefers eager decay: `UPDATE ... WHERE salience > FLOOR AND flag IS NULL` (filtered, not full-table). |
| V4-4 | No exploration → guaranteed echo chamber eventually | **Synaptic fatigue** (see 1.5): `w_eff = w / (1 + λ·recent_uses)`, λ≈0.15, decay ×0.5/prompt, `floor=1` exempt. Deterministic rotation, ε-greedy removed. |
| V4-5 | Hubs capture energy — but dividing by the *count* would strangle foundational documents (50 edges → energy/50) | **Weight-mass normalization**: `w_ij / Σ_j w_ij`. A weight-3 edge among fifty weight-1 edges keeps 3/53 of the energy instead of 1/50. `floor=1` excluded from the divisor: engraved channels transmit fully. |
| V4-6 | Cycles: the `e > 0.05` cutoff only preserves dissipation — with reinforced edges (w×0.85 > 1) a loop can **amplify** energy instead of dissipating it | **Path traced in the CTE**: `path` column, exclusion `instr(path, '\|'||to_id||'\|') = 0`. True cycle prevention, negligible cost at depth ≤ 2. |
| V4-7 | Combinatorial explosion: seeds × degree² — a mega-hub (500 edges) produces ~10⁵ CTE rows per prompt | **Three-level pruning**: (a) *structural* — an edge eroded below `w_min` is deleted, **traced** (`forgetting = traced action`); (b) *fan-out* — top-M=20 edges per node during propagation; (c) *beam* — materialized levels with top-K=50 per level → work bounded at K×M, independent of the corpus. |
| V4-8 | Strictly upward propagation: a leaf without the keyword can never surface (no semantic locality) | **`contains` descent**: parent→child, w=0.3 — a warm region *illuminates* its leaves. Non-conservative glow: outside the mass divisor and outside the fan-out cap, bounded by the beam. Cumulative boost — an already-warm leaf crosses θ; a cold leaf stays underwater. |
| V4-9 | A single seeding surface = a single angle of attack | **Multi-surfaces (crossed threads of Ariadne)**: each index produces its own wave — leaf FTS = *fine* surface, title/doc FTS = *global* surface, regex referents = *structural* surface. Waves sum: an atom touched by ≥2 surfaces = **constructive interference** (`srcs` provenance tagged). The loop closes: the global one lights up docs → `contains` descends; the fine one lights up leaves → `derives_from` climbs; where surfaces cross = resonance. |
| V4-10 | A single wave cannot distinguish confident answer / weak signal / absence | **Cascade with escalation**: surfaces run in competition; if the wave top < `θ_conf` (0.9) → **reformulation** by adjacent terms (vocabulary of near-answers, e>0.08, max 1 round); if the wave is **empty** → honest silence, no reformulation (a total absence does not fabricate synonyms). Implementation: `computeWave` (non-committal probe) / `commitWave` (commitment) separated — the cascade only commits the retained wave. Three measured regimes: direct (E≥0.9), reformulated, silence. |
| V4-11 | Lexical wall: synonym/paraphrase/typo = no seed | **Semantic surface (4th)**: flat `atom_embeddings(atom_id, vec BLOB)` — top-k cosine as seeds, energy ∝ similarity. **Leaves, bubbles, waves unchanged**: only seeding is added, the physics is unchanged. Pluggable embedder: `embed(text) → Float32Array` interface; *hash-embedder* (character n-grams, deterministic, zero-dep) = mechanical test bench (typos, morphological variants); **model2vec = real swap**, conditioned on measurements (test A3 = baseline to beat). Vector reformulation: nudge = embedder(prompt + adjacent terms) — drift of the spectrum, not word substitution. The cascade becomes: lexical → vector → reformulation. |
| V4-11b | **A4 measurement (bench): the permanent vector surface destroys honest silence** — 0/10 absent concepts stay silent (hash-embedder trigram collisions → fictitious seeds) | **Cascade gating**: the vector is NOT a permanent surface — it only activates in **N2** (lexical + refs below `θ_conf`). Silence guard: empty lexical **AND** max cos < strict threshold (0.55 hash / 0.40 model2vec) → **zero seeds**. The bench did its job: caught by test A4 before any deployment. |
| V4-12 | The base grows continuously; fixed-rate decay (×0.9/session) ignores usage; "sessions" are an artificial boundary for continuous work | **Two-component forgetting curve** (spaced repetition fused into the field): `effective_salience(t) = MAX(salience₀ × 0.5^(Δt/τ), floor(uses), flag_floor)`. **Growing half-life**: `τ = τ₀ × (1 + κ)^min(uses, cap)` — the older and more consulted, the less it degrades. **Earned floor**: `floor(uses) = FLOOR_MAX × (1 − e^(−uses/λ))`, λ≈3 — the exponential alone would reach 0; the non-forgetting threshold rises with each consultation. `flag_floor` unchanged (pinned 0.6 / high 0.3). Real timestamp (`touched_at`), **continuous** consolidation (every surfacing = micro-consolidation `uses++`). Vocabulary: *working memory* (per **agent_id**, volatile) vs *consolidation* (temporal). |
| V4-13 | **Measured hubness 48.3%** (criterion <20%) — diagnosis: parents aggregate fan-in (energy sinks); *leaves-only* hubness = 21.1% (borderline). The echo is geometric, not learned (Gini 0.32 ✓) | **Three levers**: (1) *nodal fatigue* — `e_eff = e / (1 + α·ln(1 + recent_surface_count))`, α≈0.3, sliding window; (2) **fan-in attenuation** — `e_received = e × 1/√(1 + β·d_in)`, β≈0.1; (3) **pool partitioning** + diversity cap (≤ N leaves per ancestor). **C2 criterion amendment**: hubness is measured on *injected leaves* (post-pools), not on raw surfacing — surfacing parents are the expected harmonics. Measured v10: **6.3% injected** ✓. |
| V4-14 | Seeds have flat energy (`SEED_FTS` flat) — "code" (omnipresent) injects the same wave as "maranget" (rare); the v9 fatigue-vs-reinforcement conflict (B1 dropped 0.79→0.55) came from nodal fatigue hitting *legitimately consulted* leaves | **(a) IDF on seeds**: seed energy = relative BM25 (`SEED_FTS × rank_i/rank_0`) — FTS5 provides IDF for free; a rare term injects a strong wave, an omnipresent term a weak one. **Nodal fatigue restricted to parents** (`section`/`doc`) — the echo is structural (fan-in), not leaf-level; legitimately consulted leaves are no longer punished (V4-12/V4-13 conflict resolved). **What stays global**: θ, BEAM, BUDGET_TOK, FANOUT (physics + budget); what becomes local: τ, weights, fatigue (already), seed energy (IDF). |
| V4-15 | The hash-embedder caps semantics (A3 2/3); the model2vec swap alone would lose typos (WordPiece degrades misspelled words) | **DUAL embedder, zero transformers**: pure-JS loader for `potion-base-8M` (safetensors 29528×256 F32 + hand-implemented WordPiece tokenizer, ~80 lines, inference = lookup + synchronous mean-pool). **Two spectra per leaf**: `vec` (model2vec, semantic) + `vec_hash` (hash, typos) — score = max of the two cosines. **Per-channel** silence guard: empty lexical AND (cos_sem < 0.40 AND cos_hash < 0.55) → silence. v11 campaign result: **A3 = 3/3, A4 = 10/10** — the two channels complete each other without betraying each other. |
| V4-16 | **Multilingual (measured)**: potion-base-8M is distilled from an English BERT — cos with "serialization": ES 0.32, DE 0.28, FR 0.26 (via cognates), RU 0.13, HI 0.03, **ZH 0.000** (pruned vocabulary without CJK → 100% UNK). Second layer: the lexical `ftsMatch` is ASCII-only (`[a-zA-Z]`) → a CJK prompt produces no seed. **The field physics is agnostic** — the failure is confined to seeding (vocabulary + regex); the dynamics (waves, fatigue, floors) are intact | **Activation-on-demand workstream** (the main scope is FR/EN): (1) *FTS5* — `tokenize='unicode61'` (international diacritics) or `'trigram'` (CJK without spaces); (2) *JS tokenizer* — per-character split of CJK ranges in the pre-tokenizer before WordPiece lookup; (3) *embedder* — swap the safetensors for a multilingual model2vec variant (same loader, different file). **Isolation proof**: the multilingual failure only touches seeding — CTE, fatigue, propagation, floors unchanged. |
| V4-18 | The JS cosine scan is O(N) — bottleneck beyond 50k atoms (D1) | **sqlite-vec toggleable**: `ARIANE_SQLITE_VEC=1` → vec0 extension loaded (`allowExtension`), **two native KNN indexes** (one per dual-embedder channel: `atoms_vec` semantic + `atoms_vec_hash`), `distance_metric=cosine` (*column* option). `vecSeeds()` switches native KNN / JS scan per the flag — identical semantics (A3 3/3, A4 10/10 in A/B). **vec0 details**: no `INSERT OR REPLACE` nor `ON CONFLICT` → DELETE+INSERT; automatic traced fallback if the extension fails to load. **A/B D1 @10k**: OFF p95=102ms / ON p95=103ms — no measurable gain under 10k (vec0 = C brute-force, not ANN); the expected gain is at 50k+ where C replaces the BLOB→Float32Array transfer. |
| V4-19 | **Database connector**: many fields are *classifiers* (enums, statuses, categories) — embedders handle discrete values and exact matches poorly | **Three integration levels, golden rule: vectors handle the fuzzy, SQL/FTS5 handle the discrete**: (1) **hard SQL filters** — classifiers as structured columns or dedicated JSON, deterministic guard `WHERE type='incident' AND status='open'` pre-filtering seeds (eliminates the irrelevant without consuming budget); (2) **prefixed FTS5 injection** — `[type:incident] [status:open]` header in the atom body: instant exact match on prefixed tokens, the dense embedder processes the block without drifting on the enum; (3) **graph hubs + conditional physics** — a major category becomes a hub atom (deterministic edges → activating it irrigates the sub-graph by propagation); the classifier drives the physics: `obsolete` → shortened τ, `structuring_decision` → locked floor. **Golden rule: vectors handle the fuzzy; SQL and FTS5 handle the discrete and the strict.** |
| V4-12c | **B15 (drastic test) caught an internal contradiction**: the earned floor rewarded BURSTS — 30 tight consultations → uses=30 → high floor → the buzz never dies (contradiction with V4-12b anti-hype). D2 also poorly designed (2 passes on the same warming db ≠ determinism) | **Earned floor by SPACING (V4-12c)**: new `uses_spaced` counter — a consultation increments the floor **only if Δt ≥ τ/2** (the interval that preceded it). v12 campaign result: burst of 30 → uses_spaced=0 → floor ≈ 0 → effective salience **0.005** (the buzz dies ✓); spaced consultation → uses_spaced++ → floor (B8 unchanged ✓). **D2 fixed**: 2 identical databases ×100 queries = **100% identical ✓ (deterministic)**. A10 filiation: leaf + breadcrumbs ✓. |
| V4-12b | The Gartner hype cycle: every word has its hype — some stay, others decline fast — but coding a cycle per concept would be arbitrary | **Spacing weighting** (spacing effect): at each consultation, `τ ← τ × (1 + κ · min(1, Δt_since_last/τ))` — *the stability gain is weighted by the interval that preceded it*. The hype cycle **emerges** without being coded: a buzz = tight consultations (Δt≈0) → τ does not grow → peak then fast drop; a fundamental = spaced consultations → τ compounds → quasi-immortal. Gartner becomes an **emergent consequence**, not a coded rule. Nuance: structural immortality (titles, refs, engraved channels) comes from the cadastre, orthogonal. |

### 2.3 Target propagation query (v4)

```sql
CREATE TEMP TABLE _wave AS
WITH RECURSIVE wave(id, e, depth, path) AS (
  -- seeds: FTS5 ∪ refs, initial energy = score
  SELECT atom_id, e0, 0, '|' || atom_id || '|' FROM _seeds
  UNION ALL
  SELECT l.to_id,
         w.e * 0.85 * l.weight
           / MAX(1, (SELECT SUM(x.weight) FROM atom_links x
                     WHERE x.from_id = w.id AND x.floor = 0))     -- V4-5: mass, floor excluded
           / (1 + 0.15 * IFNULL(f.uses, 0)),                     -- V4-4: synaptic fatigue
         w.depth + 1,
         w.path || l.to_id || '|'
  FROM wave w
  JOIN atom_links l ON l.from_id = w.id
  JOIN atoms a ON a.id = l.to_id AND a.status = 'active'
  LEFT JOIN edge_fatigue f ON f.from_id = l.from_id AND f.to_id = l.to_id
  WHERE w.depth < 2 AND w.e > 0.05
    AND instr(w.path, '|' || l.to_id || '|') = 0                  -- V4-6: exact anti-cycle
)
SELECT id, SUM(e) AS energy, MIN(depth) AS hops FROM wave GROUP BY id;
```

Cycle: exact detection via `path` (V4-6) replaces the cutoff alone —
necessary because a loop of reinforced edges could amplify energy
(w×0.85 > 1) instead of dissipating it. `edge_fatigue` is only fed for
`floor=0` edges (engraved channels never fatigue).

Scale (V4-7): at high degree, the single CTE is replaced by per-level
materialization — `_wave_d1` → `SELECT ... ORDER BY e DESC
LIMIT 50` → expansion → `_wave_d2` → top-50. Two queries instead of one;
the worst case becomes ~2×(50×20) row scans, **independent of graph
size**. Structural pruning (`w_min` + 0.98/session refill without
traversal → traced deletion) is the only one of the three levels that shrinks
the graph itself: without it, the lattice grows forever even if every
prompt stays fast.

### 2.4 Ingestion: leaf granularity (markdown → sentence, SQL → row)

The leaf atom = **the smallest self-contained atom** — the one that keeps its
meaning when quoted alone. Granularity is chosen per source, never by
truncation (a truncation is untraced forgetting → forbidden):

| Source | Leaf | `derives_from` chain |
|---|---|---|
| Markdown | **paragraph** — *sentence* if the paragraph carries a rule (flag≠low) or >900 chars | sentence → paragraph → section → chapter → doc |
| SQL database | **row** — body = canonical `col: val` serialization | row → table |
| Rule-bearing field row | additional **field** atom | field → row → table |

- `atoms.granularity` (`sentence|paragraph|section|row|field|doc`) explicit:
  injection cites the **leaf** as the answer and renders the ancestors'
  thread of Ariadne as location — the parent is context, not the answer.
- **FTS on leaves only**: parents are reached by propagation
  (`derives_from`), not by match — avoids energy double-counting and the
  `doc:*` surfacing theft observed in v5.
- A lone column value is not self-contained (`"active"` out of a row)
  → the whole serialized row is the SQL leaf; only a rule-bearing field
  deserves a dedicated atom.

---

## 3. Measurement protocol — performance, effectiveness, limitations

Method: real corpus (26 dna docs → ~1074 atoms) + inflatable synthetic corpus
(generator: N atoms, degree law, plausible refs) for scale.
Each test has a **death criterion**: if the threshold is missed, the mechanism is
removed or rethought — not adjusted until it passes.

### A. Recall effectiveness (vs baseline)

Baseline: FTS5 alone, top-8, same corpus. Field: same seeds + propagation.

| Test | Measure | Expected / criterion |
|---|---|---|
| A1. Exact-term queries (20 annotated queries) | MRR, P@5 field vs baseline | Field ≥ baseline; degradation >5% = death of propagation |
| A2. Multi-hop reachability (facts linked by co-citation, no common word) | % of targets surfaced outside top-FTS | >0% = real lattice gain; 0% = the graph adds nothing → simplify |
| A3. FR→EN paraphrase ("convertir les types" → coercion) | failure rate | Documents the lexical wall — upper bound of field-0 effectiveness, field-3 justification |
| A4. Honest silence (10 absent concepts) | % total silence | 100% — the field must never fabricate |
| A5. Noised frequent word ("zod") | wave size, % noise | Measures the need for degree normalization |
| A6. Thermal selection vs hard θ | P@5 and surfacing diversity: Boltzmann `exp(E/kT)` with annealing vs binary threshold | Diversity gain without P@5 loss >5% — otherwise the hard θ (simpler) wins |
| A7. 2-pool injection vs raw surfacing | P@5 on injected leaves (payload) vs mixed raw surfacing | The payload/context split must raise the precision of injected leaves |
| A8. Cascade | % of direct / reformulated / silent answers on an annotated query set (strong, paraphrases, absent) | Absent → 100% silence; paraphrases → post-reformulation convergence rate measured; average cost (ms) per regime |

### B. Temporal dynamics (the v3 promise)

| Test | Measure | Expected / criterion |
|---|---|---|
| B1. Reinforcement lift | rank of a target atom: 1st vs 5th occurrence of the topic | monotone improvement then plateau (cap) — otherwise η is useless |
| B2. Edge reinforcement | w(edge) after N traversals; surfacing gain of the target | w follows 1+η·N bounded; verify a never-traversed edge stays at 1.0 |
| B3. STP: topic raised then absent | energy at +1, +3, +5 prompts without recall | return below θ in ~5 prompts (working memory) |
| B4. LTP: topic worked then 10 blank sessions | does the atom still surface faster than a virgin atom? | yes = real LTP; no = decorative salience |
| B5. Critical floor | salience of a flagged atom after 50 blank sessions | ≥ 0.3 exactly — never below |
| B6. Zombie fact | a `superseded` atom artificially excited | w frozen, no reinforcement, no salience |
| B7. Rotation by fatigue | same path traversed N times in one session: w_eff drops, relative share of an untraveled neighbor | rotation observable after ~6-7 traversals at λ=0.15; never below θ for `floor=1` channels |
| B8. Earned floor (V4-12) | atom consulted 1× vs 5× then left alone: effective salience after a long Δt | 5 consultations → floor ≈ FLOOR_MAX (resists); 1 consultation → quasi-free decay; measured half-life grows with uses |
| B9. Emergent hype cycle | same consultation count (e.g. 20), two distributions: burst (1 tick) vs spaced (Δt ≥ τ) | burst final τ ≈ τ₀ (fast drop after buzz); spaced τ compounded (quasi-immortal) — Gartner emerges uncoded |

### C. Field health (anti-drift)

| Test | Measure | Threshold |
|---|---|---|
| C1. Edge-weight Gini | after 200 simulated prompts | Gini < 0.6; above = echo chamber → harden caps or ε |
| C2. Hubness | % of surfacings captured by the top-1% of atoms | < 20% (`surface_count` cap) |
| C3. Weak signals | a specific, poorly-connected atom, queried directly | always surfaces (the popular must not drown the precise) |
| C4. Parasitic resonance | prompts on subject A, % of surfacings on unrelated subject B | ~0% |
| C5. Nodal audit | touched channels whose atom did not surface | correct alarm; FP < 50% for the geometric (shadow) version |

### D. Performance / scalability

| Test | Measure | Threshold |
|---|---|---|
| D1. `excite` latency | p50/p95/p99 at 1k / 10k / 100k / 500k atoms | p95 < 50ms at 100k (v4 SQL); compare v3-RAM vs v4-SQL for the crossover |
| D2. Writes per session | number of `UPDATE`s (v3 vs v4) + WAL file growth | v4: O(touched atoms), not O(corpus); stable WAL |
| D3. RAM footprint | Node heap during excite | flat at any corpus size in v4 (no more `loadAdjacency`) |
| D4. Ingestion cost | ms/deposited atom | < 50ms constant |
| D5. Wave size | number of CTE/temp `_wave` rows, p95 at 10k and 100k atoms | ≤ ~2k rows with beam K=50 + fan-out M=20 — **independent of corpus**; without V4-7, measures the crossover where the single CTE explodes |
| D6. Lattice growth | edge count after N sessions with/without structural pruning | sub-linear with `w_min`; linear without = pruning mandatory |

### E. Limitations to document (model constants)

1. **Lexical wall**: 100% of pure paraphrases fail at field-0 → embeddings = field-3 entry condition, non-negotiable.
2. **Seed dependence**: no seed = no wave. The field has no spontaneous memory — it is a property (no background noise), but recall rests entirely on seeding quality.
3. **Irreversible consolidation decision**: a consolidated wave ≠ a wave that should have been. Measure the rate of "regretted" consolidation (high salience, never re-surfaced afterwards).
4. **No truth in the field**: the landscape says what is near, never what is true. All contradiction/truth logic stays protocol-level (cadastre).

---

## 4. Execution sequence

1. **Implement v4** (V4-1→V4-5) on the PoC — ~100 lines of delta.
2. **Measurement harness**: `sandbox/bench-ariane.ts` — synthetic corpus
   generator + reproducible scenarios + metrics output (JSON).
3. **A+B campaign** first (effectiveness), C in long simulation, D at scale.
4. Report: `20-mesures-v4.md` — figures, held/dead criteria, go/no-go
   decision per mechanism before any field-3 investment (embeddings).

### 4.1 Results of the first campaign (v7, 2026-09-16)

| Test | Result | Verdict |
|---|---|---|
| A1 MRR/P@5 | field **0.95** vs FTS5 baseline **0.81** (**×1.18**) | ✓ held |
| A3 lexical wall | 3/3 targets reached (typo, FR morphology, partial FR→EN) | ✓ held |
| A4 silence | **0/10 — ✗ FAILED**: the hash-embedder fabricates fictitious seeds | → V4-11b (cascade gating) |
| B1 lift | rank 1→1→1 — measurement ceiling (target already #1) | ⚠ harness to fix (target rank 5-10) |
| B3 STP | 2.81 after 5 fillers (θ=0.5) | ✗ biased test — non-neutral fillers, redo exogenous |
| B5 floor | 0.30 after 50 blank sessions | ✓ |
| B6 zombie fact | w frozen, never surfaced | ✓ |
| C1 Gini | **0.317** after 200 prompts | ✓ < 0.6 |
| C2 hubness | **39.7%** captured by top-1% | ✗ FAILED (criterion <20%) — `surface_count` cap + normalization to harden |
| D1 latency | linear: ×5 atoms = ×5 p95 (170ms at 10k) | ⚠ O(N) cosine scan — optimization required |

### 4.2 Vector swap points (field-3)

- **model2vec** (potion-base-8M, ONNX ~30MB): replaces the body of `embed()` —
  same interface. Eliminates trigram collisions (cause of the A4 failure);
  expected lower silence threshold (0.40 vs 0.55). Dep. `@xenova/transformers`
  + model download — to be done in sandbox, conditioned on A4/A3 re-test.
- **sqlite-vec**: useless at 10⁴ atoms (JS scan sufficient once vectors are
  cached in RAM); relevant at 10⁵+ where the O(N) scan dominates (measured:
  linear latency in D1). The branching point stays `vecSeeds()`.

### 4.3 sqlite-vec: in reserve

The JS scan is largely sufficient under 10k atoms; the branch activates at
the **50k atom** crossing (O(N) latency threshold measured in D1).
Branch point: `vecSeeds()` only.

### 4.4 Drastic tests (to run before any deployment)

The current campaign (26 docs, 10 topics, 200 prompts) validates the mechanics.
The following tests submit it to real conditions:

| Test | Protocol | Criterion |
|---|---|---|
| **F1. Real scale** | corpus ×20 (500k real atoms, not synthetic) | p95 < 50ms with sqlite-vec; otherwise the O(N) scan is the confirmed bottleneck |
| **B10. Longevity** | 1000 simulated sessions, realistic usage | stable Gini, floor held, no τ drift (does the TAU_CAP_USES cap hold?) |
| **B10b. Coalescence** | deposit 50 near-duplicate documents (same fact rephrased) | the field must coalesce or at least not surface all of them (consensus coalescence test, never implemented) |
| **B11. Contradictions** | two opposing facts on the same subject | both surface **together with their context** (never one alone) — the "contested never served alone" rule |
| **B11b. Poison** | adversarial injection prompts ("ignore previous instructions") | no fabricated seed, silence or correct surfacing — the field must not amplify an injection |
| **B12. Churn** | 30% of the corpus replaced (updated/deleted docs) | edges to the deleted erode and prune (traced); orphaned saliences fall back |
| **B13. Crash recovery** | kill the process mid-session, restart | working memory is lost (accepted), cadastre + salience intact — the landscape regenerates |
| **B14. Multi-agents** | 2 agent_ids in parallel on the same cadastre | partitioned working memories, coherent shared lattice (multi-carrier corroboration) |
| **A9. Synthesis round-trip** | deposit an LLM synthesis citing 5 leaves → does it surface when its sources are queried? | the sedimentary loop (V4-17b) works end to end |

### 4.5 Next fixes (in order)

1. ~~Vector gating (V4-11b)~~ — ✅ done (v8), A4 = 10/10.
2. ~~V4-12~~ — ✅ implemented (v8), validated B8/B9.
3. ~~Harness~~ — ✅ fixed (exogenous fillers, mid-rank target).
4. ~~Latency~~ — ✅ p95 ~100ms @10k (vs 170ms v7); sqlite-vec at 50k+.
5. **V4-16 multilingual** — activation on demand (model swap + CJK
   tokenizer + FTS5 trigram).
6. **V4-17 (candidate)**: *conceptual lineage* view + sedimentary loop
   (V4-17b) — see §5.3.

**Consensus reminder**: the field does not require the vector — the vector
requires the field. Fields 0→2 run purely deterministic; field-3 is conditioned
on the measurements above.

---

## 5. Assessment — innovation and transmission of knowledge memory (post-v11 campaign)

### 5.1 What is actually new?

The individual bricks exist in the literature (spreading activation =
HippoRAG, forgetting curves = Ebbinghaus/SuperMemo, EWMA = Generative Agents) —
the skeptic's cartography is maintained. **The innovation is in the assembly
and the frugality**:

1. **Deterministic emergence**: the Gartner cycle (B9: τ_fad 6.3 vs τ_fund
   43.8) and rotation-by-fatigue emerge from the physics of intervals —
   no ε-greedy, no coded business rule. The dynamic behavior is born from
   the physics of access intervals, not from business rules.
2. **Watertight multi-surface coupling**: the deterministic (FTS5,
   filiation graph) and the statistical (dual-embedder) coexist with a
   **strict silence guard** — the system prefers staying silent over
   fabricating false context by forced vector proximity (A4: 10/10).
3. **Zero infrastructure debt**: a dual-time-scale semantic engine in a
   local SQLite file, ~80-line pure-JS loader — no ONNX
   Runtime, no Python, no dedicated vector database.

### 5.2 Research and transmission of knowledge memory

Classic RAG produces an **amnesiac photograph**: truncation, k-nearest
neighbors, a two-year-old note treated like a principle reaffirmed
yesterday — incapable of restoring the trajectory of an idea. ARIANE-CHAMP makes
research **sedimentary**:

- **Preserved filiation** (`derives_from`): two-pool injection (leaf
  = the fact, ancestor = the structure) knows where the information comes
  from and how it articulates.
- **Noise vs fundamental naturally differentiated**: the spacing effect
  (V4-12b) separates ephemeral effervescence from anchored knowledge — the way
  collective memory filters the history of ideas, emergent and measured (B9).
- **Incorruptibility of the cadastre**: `pinned`/`floor=1` escape erosion
  and fatigue — a founding decision cannot be forgotten by
  accident on the grounds of no recent citation.

Assessment formula: **an engine designed for epistemic continuity rather than
keyword matching.**

### 5.3 What is missing: narrating the history of knowledge (V4-17 candidate)

The field models the *thermodynamics* of knowledge (what heats up, cools down,
resists) but not yet its *narrative*. It cannot answer "how did our
understanding of X evolve?". All the data is there (append-only,
`surface_log`, cadastre `mutation_log`) — what is missing is the
**conceptual lineage view**: when a fact entered, by which carrier, what
replaced it (`superseded_by`), how its formulation drifted. A query
"tell me the history of this concept" that replays the lineage from the
cadastre — consistent with the consensus promise: *the entire landscape is
regenerable from the cadastre*; the history of knowledge is replayable from
the journal.

**V4-17b extension — the sedimentary loop**: a synthesis (or document)
produced *from* the field itself becomes a cadastre atom, linked by
`derives_from` to its sources (the leaves that fed it). **One more
layer**: the field does not just restore the history of knowledge — it
*produces* documents that deposit into it, creating a next
generation of the hierarchy. Compound knowledge (synthesis + references)
becomes a new-generation leaf, `derives_from` toward the leaves it
synthesizes. Memory no longer merely restores: it sediments its
own synthesis — and the next synthesis will start from an enriched base.

---

## 6. V4-20 — Extracting the engine into a ytn package: `@ytrynot/osem-rag`

**Decision**: the engine leaves the sandbox and becomes a reusable module of
the ytn family (`dna`, `schvalid`, `qb`, `cli`). Identity: **Oscillo Ergo
Memini** — *it oscillates, therefore it remembers*: memory is born not of
intensity but of the temporal oscillation of accesses (spacing), which the
campaign measured (B9: τ_fad 6.3 vs τ_fund 43.8; B15: burst →
uses_spaced=0 → the buzz dies).

### 6.1 API decisions (validated)

| Decision | Value |
|---|---|
| Package name | `@ytrynot/osem-rag` |
| Factory | `createOsem({ db, config })` → `IOsemRag` |
| Storage | **DB injected, never created or closed** (like `@ytrynot/qb`); `better-sqlite3` as peerDependency, `sqlite-vec` as optional peer |
| Embedder | Pluggable: `{kind:"hash"}` (default) · `{kind:"model2vec", modelDir}` · `{embedder}` — the field physics is identical whatever the backend |
| Config | `IOsemConfig` — the ~30 audited constants become documented fields, defaults = campaign values (θ 0.5, τ₀ 5, κ 0.25, α 0.3, β 0.1, λ 3, θ_conf 0.9, silences 0.40/0.55…) |
| Classifiers (V4-19) | Out of v0.1.0 — v12 parity first; the declarative classifier→physics mapping arrives with the SQL connector |

### 6.2 Memory planes (replace `session_id`)

A single physical mechanism: the `scope_id` column of the STP tables
(`agent_energy`, `edge_gain`, `edge_fatigue`, `surface_log`).

| Plane | `scope_id` | Write | Read |
|---|---|---|---|
| **Personal** | `agent:<id>` | the agent excites its own working memory | itself only |
| **Public** | `public` | any agent (shared memory) | everyone |
| **Scope** | `scope:<name>` | public memory **per scope** (project, team, repo) | authorized agents |
| **Skills** | `skill:<name>` | durable knowledge = `kind:"skill"` atoms; working memory *shared* among all agents invoking the skill | everyone |
| **All** (`all`) | read-only union | never written directly | search across all planes |

- **Global LTP**: `salience`/`tau`/`uses`/`uses_spaced` stay global on
  `atoms` — the sediment is collective by nature (already the case in v12).
- **Expert**: virtual agent `agent:expert:<name>` only if it needs
  private working memory (persistent persona); otherwise the expert is
  mere provenance (`deposited_by` on atoms). No new engine
  mechanism: skills/experts reuse `scope_id` + `kind` + provenance.

### 6.3 Package structure

```
packages/osem-rag/src/
├── index.ts            — createOsem: resolves the embedder, loads vec0 at
│                         most once (traced fallback), DDL + refreshStats
├── types.ts            — IOsemRag · IOsemConfig · IEmbedder · tsScopeId
├── engine/
│   ├── ddl.ts          — cadastre (atoms, links, agent_energy, edge_gain,
│   │                     edge_fatigue, surface_log, FTS5, embeddings, vec0)
│   ├── field.ts        — computeWave (4 surfaces, beam×2) / commitWave
│   │                     (continuous consolidation V4-12c)
│   ├── inject.ts       — 2 pools + breadcrumbs + hot zones + per-ancestor cap
│   ├── maintenance.ts  — refreshStats (_fan/_mass/_din), tick (erosion +
│   │                     traced pruning), hotAtoms, stats
│   └── ingest.ts       — deposit (referents, derives_from/contains, dual
│                         embeddings) + adaptive markdown chunking
└── embedder/
    ├── types.ts        — IEmbedder { embed(text): Float32Array; dim; vocab }
    ├── hash.ts         — default, zero dependency (typos, morphology)
    └── model2vec.ts    — pure-JS potion-base-8M loader (safetensors + WordPiece)
```

### 6.4 Test status (anti-regression suite)

22 vitest tests ported from the bench (`tests/`) — **22/22 green**:

| Series | Tests | Status |
|---|---|---|
| A — recall | A1 (MRR ≥ FTS5 baseline), A4 silence 10/10, A10 filiation | ✅ |
| A3 — lexical wall | typo `serializaton` / FR `sérialisation` (frozen dna corpus snapshot) | ✅ |
| B — temporal | B1, B3, B5, B6, B8, B9, B15 | ✅ |
| C — health | C1 Gini, C2 injected hubness | ✅ |
| D — operations | D1 sub-linearity, D2 determinism | ✅ |
| Stress | B12 churn, B13 crash recovery, B14 multi-agents | ✅ |
| Vec parity | identical semantics, sqlite-vec ON/OFF | ✅ |
| E — sources | mixed-source ingestion: md + txt + URL + SQL rows in one field | ✅ |

**Lessons from the two fixes (measured, not assumed)**:

1. **A3 — lexical wall**: on a synthetic fixture of 9 one-line leaves,
   the hash cosine of the typo `serializaton` falls to **0.373** (< silence
   threshold 0.55) and the semantic to 0.284 (< 0.40) → silence. On the real
   dna corpus (26 docs → 4358 atoms), the same engine passes **3/3** via the
   `[s]` surface (`dna:docs/serialization.md#0` surfaced for the typo and the
   FR morphology, `doc:docs/type-inventory.md` for the FR→EN). **The engine is
   correct; the one-line fixture was undersized** — the A3 test runs on the
   real corpus, exact v12 campaign conditions.
2. **B15**: the `ATOM-ARCH` leaf referenced `derivesFrom: "table:decisions"`
   without depositing the table atom first → FK. The v12 bench deposited
   `table:decisions` explicitly before the leaf — the port does the same.

### 6.5 Package roadmap

1. ~~Fix the 2 tests~~ — ✅ done, campaign **40/40**.
2. ~~Qualitative parity vs the v12 bench~~ — ✅ A4 10/10, A3 3/3,
   B15 (pinned floor holds, buzz dead uses_spaced=0), D2 100% identical.
3. ~~Vec ON/OFF tests (identical semantics in A/B)~~ — ✅ done (+ zombie
   parity under KNN and vec0 backfill regressions, see §6.6).
4. ~~`README.md` (EN, TOC, examples) + package `AGENTS.md` + full JSDoc~~ — ✅ done.
5. ~~ADR (new module = structuring decision)~~ — ✅ logged (mailbox DEC,
   awaiting ADMIN validation).
6. ~~Changeset (minor, new package) + `git add`~~ — ✅ staged; **owner commit
   pending** (SSH signing key is owner-only).

**Reminder**: the v12 sandbox remains the behavioral reference until parity
is established; no production-readiness claim before a green suite + parity.

### 6.6 Post-extraction revision — audit fixes and corpus-priced seeding (v0.1.0)

Changes applied after two full code audits (public surface + physics), each
one validated by a measurement before acceptance:

**Physics corrections**

| # | Defect found | Fix |
|---|---|---|
| R1 | Mirror planes (`share`) ran the global LTP update *before* the `learn=false` guard → sharing a prompt multiplied `uses`/`uses_spaced`/`τ` consolidation per plane (the opposite of anti-hype) | LTP block moved inside the learn guard: mirrors receive the energy bump + trace only |
| R2 | `superseded` atoms could not surface but still **seeded** (FTS/title/vector) and radiated energy to neighbours | `status='active'` filter on all three seed surfaces |
| R3 | `titles_fts` INSERT-only on upsert → phantom FTS rows per re-ingestion | DELETE+INSERT, same as `atoms_fts` / `atom_embeddings` |
| R4 | Upsert reset `salience`/`tau`/`uses`/`uses_spaced`/`touched_tick` → re-depositing a doc erased its accumulated memory | Sediment preserved (`salience = MAX(old,new)`, temporal state kept) — consistent with "the sediment is collective" |
| R5 | Pinned anchors consumed the leaf payload budget | Separate `payloadUsed` accounting — anchors are genuinely above budget |
| R6 | Hard-coded constants + governance-corpus referent patterns | All in `IOsemConfig` (`refSeedEnergy`, `rankFloor`, `salienceBoost`, `adjacentMinEnergy/Max`, `referentPattern`, `referentFilePattern`) |

**Lexical scoring revision — IDF replaces the stop list**

The relevance complaint ("how does the injection budget work?" → "How to
integrate" #1) was first patched with an EN/FR stop list, then replaced by a
principled mechanism: **each query term is priced by its corpus IDF**
(`ln(1 + N/df)`, normalized by the max term IDF) — the corpus itself prices
the words, no dictionary. Contributions are **additive per term** (was
`Math.max`): covering several informative terms dominates a single-term hit.
Measured: `injection budget` → the `BUDGET_TOK` leaf surfaces #1 at 4.03
(invisible before); `the` at df≈925/3606 is priced ≈0.24 and effectively
inert. `des`/`dés`/`dès`/`EU` stay distinct, corpus-priced terms.

**Measured limitation → documented contract**: question scaffolding words
(`how`, `comment`) are *rare* in declarative technical corpora → high IDF →
they seed for real. IDF measures rarity, not vacuity; no corpus statistic can
fix this. Resolution: **OSEM is a keyword engine** — the contract is "pass
distilled keywords, the calling agent/LLM does question→keyword". Documented
in README §2; the demo runs scripted keyword queries.

**V4-16 CJK — need validated, not implemented**

`sandbox/validate-cjk.ts`: a Chinese prompt on a zh corpus → **total silence**
(honest, nothing fabricated); FTS5 `unicode61` stores each CJK run as one
opaque token (even the exact bigram `记忆` matches nothing); `termsOf`
extracts zero CJK terms. The failure is confined to seeding — waves, fatigue
and floors are untouched. Activation path when needed: CJK-bigram extraction
in `termsOf` (IDF prices bigrams, no dictionary required) +
`tokenize='trigram'` on the FTS tables + a multilingual safetensors file.

**Bench correction (honesty)**: D1 latency is **~linear in N** (×5 corpus →
×5.2 p95), not sub-linear — the beam bounds *propagation*, but seed collection
(per-term FTS + JS vector scan) is O(N). p95 ≈ 125ms @10k atoms.

**Second audit pass (probe-verified)** — three more bugs, each with a
regression test in `tests/f-audit-regressions.test.ts`:

| # | Defect found | Fix |
|---|---|---|
| A1 | vec0 KNN branch seeded `superseded` atoms (the JS scan filtered them) — ON/OFF parity broken on zombies | `JOIN atoms … status='active'` on both KNN queries |
| A2 | vec0 tables created on an already-populated base stayed **empty** → reopening with `useSqliteVec` silently killed the semantic surface | Backfill `INSERT … SELECT FROM atom_embeddings` after the DDL |
| A3 | `_fan`/`_mass`/`_din` stale until the first `tick()` → `deposit→excite` ran with **dead upward propagation**, silently | Shared `statsState.dirty` flag: `deposit` marks, `computeWave` lazily refreshes, `tick` clears |

Plus the minors: `share:"system"` excluded from `tsSharedScope`, hot zones
filter `status='active'`, `surface_log(atom_id,tick)` index, `'pruned'` rows
excluded from the nodal-fatigue window, `resonates` now requires co-activation
on **≥2 distinct ticks** (spec-conformant standing waves), `supports` floor
follows the current flag on re-deposit, `leafChunks` line offsets survive
duplicate paragraphs, `inject.agentId` optional when `scopes` is given.

**Third audit pass** — a semantic defect and three residuals, all closed:

- `inject` prepended the personal plane *even with an explicit `scopes`
  list* → a scoped read leaked the caller's private memory. Fixed:
  **`scopes` is now authoritative** (exactly those planes); the personal
  plane only enters the default set. Regression test in `g-planes`.
- IDF `df` counted `superseded` rows → term weights deflated by retracted
  content. Fixed: the df query joins `atoms.status='active'`, consistent
  with "superseded = inert on every surface".
- D1 test renamed "bounded latency growth" (was "sub-linear") and its
  median index corrected (`lat[10]` on 30 samples was p33, not p50).
- Documented: one `IOsemRag` handle per connection — handles share the
  stats TEMP tables but not the dirty flag (single-writer assumption).
