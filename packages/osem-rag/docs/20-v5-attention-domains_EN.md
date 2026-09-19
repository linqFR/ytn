# 20 — ARIANE-CHAMP v5: attention domains, ownership, episodic query cache

> Status: converged design, pending decision. Builds on doc 19 (v4 physics).
> Motivation: a probe-verified defect — divergent per-agent tick clocks corrupt
> the global sediment (negative exponent → exponential salience inflation,
> clock rewind). v5 resolves it by partition, not by patch, and generalizes
> the scope model into a uniform attention-domain architecture.

---

## 1. The core change — every scope IS an attention domain

v4 treats `tick` as a caller-supplied scalar written into global LTP fields
(`atoms.salience/tau/uses_spaced/touched_tick`). Two agents on different
timelines corrupt that shared state.

v5 removes the ambiguity entirely: **a scope is a memory plane with its own
attention clock, its own sediment, its own consultation log**. No field is
ever written by two different clocks.

```
domain(scope) = scope          — the mapping is the identity, no special cases
```

`public` is simply the shared plane whose owner is the system. Consulting it
is asking the collective agent; its clock advances when collective attention
lands there — whoever asked.

## 2. Definitions

| Symbol | Meaning |
|---|---|
| `s` | a scope: `agent:X` \| `public` \| `scope:*` \| `skill:*` |
| `owner(s)` | `owner(agent:X) = X` (self-owned); `owner(scope:*)` = its owner-agent; `owner(public)` = system |
| `tick_s` | per-scope attention counter, starts at 0 |
| `σ(a, s)` | sediment of atom `a` under domain `s`: `(salience, τ, uses_spaced, touched_tick)` |
| `L_s` | bounded consultation log of `s` (last X entries): `(requester, prompt, surfaces, tick_s)` |
| `P_s` | pinned truths of `s` — owner-certified |

## 3. The addressed request

`recall(X, q, scopes = [s₁..sₙ])` **transmits** `q` to each domain `sᵢ` — it is
a delegated request, not a table read:

```
∀ sᵢ : wave(q, sᵢ) → commit(sᵢ)
   if retained surfaces (above thresholds):
      tick_{sᵢ}++                             — attention advances time
      L_{sᵢ} += (X, q, surfaces, tick_{sᵢ})   — attribution
      ∀ a surfaced : update σ(a, sᵢ) on the clock of sᵢ
   else : honest silence → nothing moves
```

- **Attribution**: the consulted scope's request log `L_s` records *who asked
  what* — collective attention becomes accountable. Note: this is a request
  log, not an access log — the engine knows who asked, never who *saw*
  (surfaced ≠ injected ≠ read; what the caller does with the output is
  outside the engine's reach).
- **Read governance**: the owner can gate consultation — `scopes` becomes an
  ACL (delegable/revocable), not just a filter.
- The requester's own clock only advances if it commits to its own plane.

### Surfaced is internal state, not an audit trail

`surface_log` stays pure physics instrumentation — its only consumers are
nodal fatigue (parent surface_count in window) and `resonates` learning
(co-surfaced atoms on ≥2 ticks). It records *which atoms heated up in which
plane*, never *who accessed what*. If governance wants an audit trail
("who asked what"), it lives in the separate rotative request log `L_s` —
and "who saw what" remains an application-level concern, outside the engine.

## 4. Attention-gated clocks

`tick_s` advances **only on commit above thresholds** in `s` — a tick is an
attention event, not a query event. Honest silence ages nothing: asking
unanswerable questions does not erode memory. The counter is derivable from
state (commit count per domain) → determinism preserved.

The `tick` parameter leaves the public API: `recall({ agentId, prompt })`.
Explicit tick survives only as a debug/replay override.

## 5. The hype physics, per domain

On each hit of `a` in domain `s`, with `Δt = tick_s − touched_tick(a,s)`
(clamped `Δt ≥ 0`):

```
salience'    = max( salience · 2^(−Δt/τ),  λ_LTP · E )
τ'           = min( τ · (1 + κτ·min(1, Δt/τ)),  τ_cap ),   τ_cap = τ₀(1+κτ)^U
uses_spaced' = uses_spaced + [Δt ≥ τ/2]
touched_tick' = tick_s                     — monotone, never rewinds
```

Effective salience in scoring:

```
S_eff(a, s) = max( salience·2^(−Δt/τ),  F_max·(1 − e^(−Us/λf)),  F_flag )
```

The contraction factor `2^(−Δt/τ) · boost · λ_LTP ≤ 0.12 < 1` bounds the
feedback loop — **unconditionally**, since Δt can no longer go negative.

Permanence ladder:

```
pinned       → permanent while the truth lives (authoritative plateau)
earned floor → F_max·(1 − e^(−Us/λf)), asymptotic, earned by spacing
decay        → living hype
inert        → functional 0 (re-seedable)
superseded   → declared dead
```

## 6. Three strata per scope

| Stratum | Key | Governance |
|---|---|---|
| Truths | atoms deposited in `s` | hype: decay / spacing / floor |
| Request log | `L_s` rotative (last X) | who asked what — attribution |
| Field traces | `surface_log` (internal) | fatigue + resonates only |
| Confirmed truths | `P_s` | **owner only**, exempt from decay |

## 7. Pins are living references

A pin points to a *truth identity*, not a frozen fact. `injectContext` resolves
each pin through the supersession chain to the currently **active** version:

- truth updated (v1→v2→v3) → the pin follows;
- truth retracted with no successor → the pin dies (or flags *stale*).

A pin on retracted knowledge is a persistent lie — worse than no pin.
Authority is scoped: confirming in `scope:proj` does not pin for `agent:X`.

## 8. The episodic query cache (private plane)

After a fruitful search, the agent deposits into its own plane:

```
deposit(agent:X, atom_query = q)  +  links (supports / derives_from) → top-N results
```

The query-atom is searchable content. **The memory of the request lives only
on the requester's side**: the consulted scope does NOT deposit the received
query — it only appends an `L_s` entry (rotative log, not an atom). Otherwise
the same request would impact the atoms twice: once via the wave commit on
the consulted domain, once via the deposited query-atom's propagation. One
request = one impact on each atom.

A later similar query matches the query-atom first;
propagation carries energy to the real atoms:

```
e_real ≈ e_query · w_link / √(1 + β_din · din)
```

With `w_supports = 0.6` and `din = 1` (unique link): **~60% of the hit reaches
the real atom** — near `thetaConf`. A popular atom (high `din`) dilutes the
bookmark's contribution, correctly: famous content must not be dominated by
one agent's cache.

The private plane becomes a **learned personal index** over shared knowledge —
each agent builds its own PageRank on the collective corpus, weighted by its
own attention history, with zero content duplication.

## 9. Cache-hit semantics

When the bookmark hits and propagation surfaces the real atom, the commit
happens in the requester's plane:

```
σ(real_atom, agent:X)  += hit     — X's familiarity grows
σ(real_atom, public)   unchanged  — public was never asked
```

**Rule**: sediment is written in the domain where the commit occurred. A
cache hit is private business between the agent, its bookmarks, and the graph;
`tick_s` advances only on requests actually transmitted to `s`.

Self-repair: if the bookmark's targets were superseded since, propagation
reaches inert atoms → the gap is detected → the agent retransmits to `public`
→ public's clock ticks then, legitimately.

## 10. ACL matrix

| Action | Who | Clock effect |
|---|---|---|
| `recall` | any agent on accessible scopes | ticks the committed scopes |
| `deposit` | owner in `agent:X` (free); scopes with write right | — |
| `pin` | `owner(s)` in `s` only | — |
| `tick` | internal, per scope, attention-gated | removed from public API |

Mirrors survive only for deliberate broadcast; personal caching uses
bookmarks. Write isolation is absolute: an agent never writes outside its
own plane.

## 11. API surface

```ts
recall({ agentId, prompt, mode?: "terms" })   // cascade by default
deposit(...)   ingestDocs(...)   injectContext(...)
maintain()     topAtoms()        stats()
confirm(atom, scope)                          // pin — owner only
```

## 12. Migration from v4

- `atoms.salience/tau/uses_spaced/touched_tick` → `atom_sediment(atom_id, scope_id, ...)`.
- `hot` query joins sediment on the committing scope's domain.
- `surface_log` unchanged (internal instrumentation); new `consultation_log(scope_id, requester, prompt, tick)` rotative table for `L_s`.
- `agent_energy` unchanged (already per-scope) — STP/LTP now share the same key.
- `IExciteInput.tick` → internal per-scope counters.
- `share` mirrors keep energy+trace (`learn=false`); personal caching moves to bookmarks.

## 13. Invariants

- **I1**: `tick_s` advances only on commits above thresholds in `s`.
- **I2**: two domains never write the same sediment row — `σ` is keyed `(atom, scope)`.
- **I3**: `touched_tick(a,s)` is monotone non-decreasing within its domain.
- **I4**: pins resolve to active atoms only (through supersession); a pin with no live successor dies or flags stale.
- **I5**: `confirm` requires `owner(scope)`; no other role can pin.
- **I6**: an agent never writes outside its own plane (except scopes with explicit write right); cross-scope visibility comes from reads, not mirrors.
- **I7**: honest silence commits nothing, logs nothing, ticks nothing.
- **I8**: `surface_log` is never an access/audit record — surfaced state is internal; attribution lives only in `L_s`, and "who saw" is never recorded by the engine.
- **I9**: a request impacts each atom exactly once — the consulted scope records the request in `L_s` only; the query-atom is deposited solely in the requester's plane, linked `supports`/`derives_from` to the results.

## 14. Addendum — experimental directions (POC required before decision)

### 14a. Sensitivity/virality automaton — studied, rejected (production validated)

A family of discrete recurrences was simulated (`sandbox/sim-automaton*.mjs`,
`sim-poc.mjs`): additive impulse, gap-closing slope `s(A)`, logistic virality
channel `K·(y+P)(1−(y+P)/L)` gated by `P>0`, and four erosion readings
(literal drain, rate damping, `d·max(0,y−P)`, `d·(y−P)`).

Verdict by elimination — production `max(σ·2^(−Δt/τ), λ·e)` is confirmed:

- additive impulse pumps under spam (×5); `max` is the structural anti-hype;
- ungated virality with `K>d` creates a universal attractor `L(1−d/K)` —
  forgetting is abolished; `K<d` is mandatory for unconditional decay;
- `y+P > L` is lethal under saturation — would require `L ≥ 1+H` or clamping;
- the carried-plateau effect (`y* ≈ P` while the neighborhood feeds) is real
  but small and approximated by the existing `uses_spaced` floor;
- cost: +2 constants, regime bounds, for marginal operational gain → shelved.

Useful semantic kept: `P` (propagated energy) is **pure modulation**
(sensitization), never a direct write — consistent with GATE below.

### 14b. Injection-gated LTP — consolidation follows actual use

Direction shift under study: STP (`agent_energy`) is written at surface/commit,
but LTP (salience, uses_spaced, τ, floor) is written only for atoms actually
**injected** into context — consolidation rewards delivery, not mere activation.

Sandbox POC results (`sandbox/sim-poc.mjs`, 40-atom clustered corpus, parameter
sweep): phantom LTP under the current commit-time write is real — up to **36%
of consolidation credit** goes to never-injected bystanders at tight injection
budgets (PAYLOAD=3), ~10% at baseline, and it scales inversely with injection
budget. Gating eliminates phantom LTP by construction with **zero cost on
anchors** (identical floors for injected parents, which are delivered as
breadcrumbs). The effect concentrates in moderately-connected graphs where
propagation commits bystanders without diluting them below `thetaTop`.

Open points: breadcrumbs count as delivered context (role-weighted credit?);
requires the caller to invoke `injectContext` for learning to happen (possible
two-counter model: tick on commit for STP, spaced credit on injection for LTP).

GATE is the only direction carried to a real-POC candidate — measurable on
`poc-ariane-champ-v12`. The v5 core model (attention domains, per-scope
sediment, pins, bookmarks) does not depend on it.

## 15. Open points

- Rotative bound X of `L_s` and eviction semantics (FIFO).
- Pin in `public`: single owner vs quorum.
- Mirror tick semantics for deliberate broadcast (does a committed share tick the target plane? proposal: yes — it IS attention landed on that plane).
- `resonates` learning under per-domain sediment.
