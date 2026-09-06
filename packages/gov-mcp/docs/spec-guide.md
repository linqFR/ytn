# Spec Writing Guide — @ytrynot/gov-mcp

How to write and manage specification annexes (specs) in a governance system powered by `@ytrynot/gov-mcp`. Specs are versioned technical specifications that serve as the single source of truth for the technical content of a feature, refactor, or design change.

## Table of Contents

- [What is a Spec?](#what-is-a-spec)
- [Hierarchy of Truth](#hierarchy-of-truth)
- [Naming](#naming)
- [Header (Mandatory)](#header-mandatory)
- [Versioning — Complete Restatements, Not Diffs](#versioning--complete-restatements-not-diffs)
- [Spec Statuses](#spec-statuses)
- [Invariants Section (Mandatory)](#invariants-section-mandatory)
- [Drift Handling](#drift-handling)
- [Relationship to Decisions and Actions](#relationship-to-decisions-and-actions)
- [Checklists](#checklists)
- [Complete Workflow](#complete-workflow)

---

## What is a Spec?

A spec is a dated annex that holds the **technical detail** of a feature or design change:

- **Spec** — what to build, how, acceptance criteria, file-level plan, invariants.
- **Decision** — governance: was it approved? by whom? when? (1-3 line summary, points to the spec)
- **Action** — execution: who, when, evidence (1-3 line summary, points to the spec)

No duplication of technical content between the three. The spec holds the detail; decisions and actions hold pointers.

### Scope of the MCP server

`@ytrynot/gov-mcp` tracks specs as entities — it stores their ID, status, linked decision/action, scope, and metadata. The MCP server does **not** manage the spec file itself: it does not create, write, edit, or version the Markdown file. The spec file is authored and maintained by the team (human or agent) using the template and versioning rules in this guide. The MCP server tracks the spec's governance state (status transitions, links, cascades) and provides the `create_spec` and `update_spec_status` tools to register and update the spec entity in the database.

## Hierarchy of Truth

```
source code > spec > decision > log
```

The spec is the best governance-internal approximation of the source code, not the ultimate truth. The source code remains the truth. When the source drifts from a spec marked `implemented`, the spec is `desync` (see [Drift Handling](#drift-handling)).

## Naming

Specs are named `spec-YYYY-MM-DD-<package>-<short-topic>.md` (the date is the creation date).

Examples:
- `spec-2026-08-25-cli-mode.md` — CLI mode design
- `spec-2026-08-22-dna-maranget.md` — Maranget algorithm spec

## Header (Mandatory)

Every spec MUST begin with this header block:

```markdown
# Spec — YYYY-MM-DD (<topic>)

> **Status**: draft | ready | locked | implemented | desync | superseded | rejected
> **Current version**: v0
> **Linked decision (why)**: DEC-NNNN — what triggered the spec
> **Linked action (how)**: ACT-NNNN — what implements the spec
> **Superseded by**: spec-YYYY-MM-DD-<package>-<short-topic>.md (filled in only if/when superseded)
> **Linked problem** (optional): PB-NNNN (if a bug is linked)
```

### Fields modifiable in-place

The following fields may be updated in-place in the header (exception to append-only). This is a closed list — no other field may be modified in-place:

1. `Status`
2. `Current version`
3. `Superseded by`

All other content in the spec is **append-only**. Bugs are appended after the header as new sections, never modified in-place.

## Versioning — Complete Restatements, Not Diffs

A spec evolves through **complete restatements**, not incremental diffs. Each version is self-contained and readable independently.

- **v0** = pre-spec (exploration notes, draft, not locked). Captures the R&D exploration phase.
- **v1** = first formal spec (ready → locked). Self-contained.
- **vN+1** = complete restatement + drift section that captures what changed and why.

Structure:

```markdown
---

## v0 — <date>

<exploration notes — informal, captures PoC findings, open questions, etc.>

---

## v1 — <date>

<complete spec v1 — goal, requirements, design, files, validation, invariants, etc.>

---

## Drift v1 → v2 — <date>

**Motivation**: <why v1 changed — empirical discovery, bug, expert review, new decision, etc.>

**What changed**:
- §2.3: <before> → <after>, reason: <...>
- §3: <added/removed file X>, reason: <...>

---

## v2 — <date>

<complete spec v2 — full restatement, not a diff>
```

Rules:
- Each version section (`## vN — <date>`) contains the **full spec** at that version, not just the changes.
- The drift section (`## Drift vN → vN+1`) captures **what changed and why**.
- The `Current version` field in the header is updated when a new version is added.
- Previous versions are **never deleted or modified** — they remain in the file as history.

## Spec Statuses

| Status | Meaning |
|--------|---------|
| `draft` | Being written, not yet reviewed |
| `ready` | Complete, ready for review |
| `locked` | Reviewed and frozen — implementation may proceed against this version |
| `implemented` | Implementation complete and verified against the spec |
| `desync` | Code is correct but spec is not up-to-date with implementation changes |
| `superseded` | Replaced by a newer spec (link in `Superseded by`) |
| `rejected` | Reviewed and explicitly declined; kept for the record |

## Invariants Section (Mandatory)

Every spec MUST contain a `## Invariants` section. Invariants are constraints/requirements that must not change (runtime, type-level, format).

Examples:
- "The sentinel `WILDCARD_CELL = \x00` never leaks into serialized output."
- "An absent key in a branch = optional, not wildcard."
- "The order of discriminators matches between builder and codegen."

If the spec has no invariants, the section contains:
```markdown
## Invariants

N/A — no runtime/type-level invariants for this spec.
```

Invariants are what make the spec-vs-code comparison **actionable** at review time. Without explicit invariants, the spec describes a format — with invariants, it provides an independent source of truth against which to compare the code.

## Drift Handling

Three cases:

| Case | Description | Spec status | Action |
|------|-------------|-------------|--------|
| 1. Code drift after implementation | Code changed after implementation, spec didn't follow. Code is correct. | `desync` | Decide: new version (vN+1) or not. Align spec to code. |
| 2. Spec incomplete/imprecise | Discovered during implementation — spec wasn't wrong, just missing something. | vN+1 (drift section, not superseded) | Spec amended with what implementation revealed. |
| 3. Spec incorrect | Spec says X, code should do Y — spec was wrong from the start. | `superseded` + vN+1 (urgent) | New version corrects the error, old version superseded. |

## Relationship to Decisions and Actions

The spec is the **source of truth for technical content**. Decisions and actions are **governance and execution pointers**:

- **Decision**: records that the spec was approved (governance). Keeps a 1-3 line summary, points to the spec for detail. Does not duplicate the technical content.
- **Action**: records the execution status (who, when, evidence). Points to the spec for the implementation plan. Does not duplicate it.

Decisions and actions that do not have a spec (simple decisions, conventions) keep their full content inline — the spec is optional and proportionate to complexity.

## Checklists

### Writing a spec

- [ ] Header filled (Status, Current version, Linked decision, Linked action)
- [ ] v0 (pre-spec) or v1 (formal) depending on workflow stage
- [ ] Invariants section present (even if "N/A")
- [ ] Acceptance criteria concrete (inputs/outputs, no vague adjectives)
- [ ] If reviewed → drift section + vN+1 (complete restatement)
- [ ] Status updated (draft → ready → locked)

### Before lock

- [ ] Spec is complete (no empty sections except Invariants "N/A")
- [ ] Acceptance criteria are concrete and testable
- [ ] Invariants are verifiable against the code
- [ ] Review is complete (or admin authorizes lock without review)
- [ ] Implementation decision is ready (or being validated)

### Before implementation

- [ ] Spec is `locked`
- [ ] Implementation decision is `Accepted`
- [ ] Action is created pointing to the locked spec
- [ ] Agent has read the spec in full (not just the decision summary)

### After implementation

- [ ] Build + tests pass
- [ ] Acceptance criteria from the spec are verified
- [ ] Invariants from the spec are verified against the code
- [ ] Spec status → `implemented`
- [ ] Action status → `done` with evidence
- [ ] If bugs discovered → problem created
- [ ] If spec incompleteness revealed by implementation → vN+1 (drift, not superseded)

## Complete Workflow

```
1. Idea raised (raw → discussed)
2. Decision (Accepted) — "authorize exploration of X"
   Spec: not yet — exploration in progress
3. PoC in sandbox + measurements + tests
4. Spec created: spec-YYYY-MM-DD-<package>-<short-topic>.md
   v0 (pre-spec, draft) → v1 (ready → locked)
   Header: Status, Linked decision (why), Invariants
   Checklist "before lock" verified
5. Review → drift v1 → v2 if needed
   Spec: v1 + Drift v1→v2 (reasons) + v2
   Status: locked (v2)
6. Decision (Accepted) — "implement X per spec vN"
   1-3 line summary mandatory
   Checklist "before implementation" verified
7. Action (done) — "Implement per spec vN §<section>"
   1-3 line summary mandatory
8. Build + tests + acceptance criteria + invariants verified
   Checklist "after implementation" verified
9. Spec → implemented
10. If bug discovered:
    Problem created
    - CRITICAL → fast-track (admin authorizes, fix immediately, spec aligned later)
    - Bug in spec (incorrect) → spec superseded + vN+1 (urgent)
    - Spec incomplete (implementation reveals gap) → vN+1 (drift, not superseded)
    - Code drift after implementation → desync + admin decides
```

### Decisions and actions without a spec

Simple decisions (conventions, rules, small fixes) do not require a spec. The decision/action keeps its full content inline. The spec is optional and proportionate to complexity.
