/**
 * H-series — agent-usage simulation: osem driven the way an agent would use
 * a memory MCP at load. Query classes follow the published memory-benchmark
 * taxonomy (LongMemEval: extraction, knowledge update, temporal reasoning,
 * abstention; LoCoMo: single-hop/multi-hop/adversarial), adapted to a
 * keyword engine:
 *
 *   needle      — direct fact lookup (information extraction)
 *   update      — a fact re-deposited with a new value restitutes the CURRENT
 *                 value (knowledge update), the old one is gone
 *   retracted   — a superseded memory stays inert on every surface
 *   distractor  — near-duplicate memories: the distinguishing term wins
 *   cross-plane — a fact shared into scope:proj is restituted to ANOTHER agent
 *   privacy     — a private memory is absent from another agent's planes
 *   abstain     — never-deposited topics → honest silence
 *   recency     — a memory reinforced on spaced hits outranks its twin
 *
 * Metrics per class: recall@formatContext (the memory actually pasted into context),
 * MRR on recallShallow, abstention accuracy, and end-to-end query latency
 * (p50 / p95 reported; only a generous upper bound is asserted — CI noise).
 */
import { describe, expect, it } from "vitest";
import type { IOsemRag } from "../src/index.ts";
import { burn, makeOsem } from "./helpers.ts";

/** Rare token families — every fact gets an unambiguous ground-truth term. */
const TAGS = ["zephyr", "quillback", "tarnhold", "mirel", "vossk",
              "brindle", "corvane", "dellwick", "fenmar", "grell"];
const FILLER = ["routine", "workspace", "note", "review", "status",
                "backlog", "meeting", "report", "summary", "update"];

const N_NEEDLE = 40;
const N_UPDATE = 10;
const N_RETRACT = 10;
const N_DISTRACT = 10;
const N_CROSS = 8;
const N_PRIVACY = 8;
const N_ABSTAIN = 10;
const N_RECENCY = 3;
const N_FILLER = 250;
const N_LONG = 3;

const tok = (tag: number, i: number) => `${TAGS[tag % TAGS.length]}${i}`;

interface tsQuery {
  prompt: string;
  targetId?: string;          // atom expected in the injected payload
  twinId?: string;            // adversarial twin that must rank below targetId
}

interface tsSim {
  osem: IOsemRag;
  needles: tsQuery[];
  updates: { id: string; newTok: string; oldTok: string }[];
  retracted: { id: string; query: string }[];
  distractors: tsQuery[];
  cross: tsQuery[];
  privacy: tsQuery[];
  abstain: tsQuery[];
  recency: { prompt: string; reinforced: string; twin: string }[];
  long: { id: string; prompt: string; minLines: number; longBody: boolean }[];
}

/** Deposit a leaf under its own section (formatContext caps 3 leaves/ancestor). */
function leaf(osem: IOsemRag, sec: string, id: string, body: string) {
  osem.registerMemo({ id, kind: "observation", granularity: "paragraph",
                 body, derivesFrom: sec });
}

/** Build the simulated session once: deposits only, no recallShallow yet. */
function buildSim(): tsSim {
  const { osem, db } = makeOsem();
  osem.registerMemo({ id: "mem:project", kind: "synthese", granularity: "doc",
                 body: "Agent working memory", title: "project", fts: false });
  const sec = (name: string) => {
    const id = `sec:${name}`;
    osem.registerMemo({ id, kind: "observation", granularity: "section",
                   title: name, body: `memory section ${name}`,
                   derivesFrom: "mem:project", fts: false });
    return id;
  };

  const sim: tsSim = { osem, needles: [], updates: [], retracted: [],
                       distractors: [], cross: [], privacy: [],
                       abstain: [], recency: [], long: [] };

  // Needles: unique rare token + generic context.
  for (let i = 0; i < N_NEEDLE; i++) {
    const t = tok(0, i), s = sec(`needle-${i}`);
    leaf(osem, s, `fact:needle-${i}`,
         `user preference ${t}: prefers option ${t} for the deployment workflow`);
    sim.needles.push({ prompt: `${t} deployment workflow`, targetId: `fact:needle-${i}` });
  }
  // Knowledge updates: v1 deposited, then the SAME atom re-deposited with v2.
  for (let i = 0; i < N_UPDATE; i++) {
    const oldT = tok(1, i), newT = tok(2, i), s = sec(`update-${i}`);
    leaf(osem, s, `fact:update-${i}`,
         `decision ${tok(3, i)}: use ${oldT} for the storage layer`);
    leaf(osem, s, `fact:update-${i}`,
         `decision ${tok(3, i)}: use ${newT} for the storage layer`);
    sim.updates.push({ id: `fact:update-${i}`, newTok: newT, oldTok: oldT });
  }
  // Retracted memories: deposited then superseded (the MCP "forget" path).
  for (let i = 0; i < N_RETRACT; i++) {
    const t = tok(4, i), s = sec(`retract-${i}`);
    leaf(osem, s, `fact:retract-${i}`,
         `temporary credential ${t} grants access to the staging vault`);
    db.prepare(`UPDATE atoms SET status='superseded' WHERE id = ?`)
      .run(`fact:retract-${i}`);
    sim.retracted.push({ id: `fact:retract-${i}`,
                         query: `${t} staging vault` });
  }
  // Distractor pairs: identical bodies except the discriminating term.
  for (let i = 0; i < N_DISTRACT; i++) {
    const t = tok(5, i), s = sec(`distract-${i}`);
    leaf(osem, s, `fact:distract-${i}-a`,
         `configuration ${t} mode alphamode enables the fast codepath`);
    leaf(osem, s, `fact:distract-${i}-b`,
         `configuration ${t} mode betamode enables the safe codepath`);
    sim.distractors.push({ prompt: `${t} alphamode`,
                           targetId: `fact:distract-${i}-a`,
                           twinId: `fact:distract-${i}-b` });
  }
  // Cross-plane facts: alpha shares into scope:proj, beta will read it.
  for (let i = 0; i < N_CROSS; i++) {
    const t = tok(6, i), s = sec(`cross-${i}`);
    leaf(osem, s, `fact:cross-${i}`,
         `team convention ${t}: always rebase the integration branch`);
    sim.cross.push({ prompt: `${t} integration branch`,
                     targetId: `fact:cross-${i}` });
  }
  // Privacy: alpha-private facts, never shared.
  for (let i = 0; i < N_PRIVACY; i++) {
    const t = tok(7, i), s = sec(`priv-${i}`);
    leaf(osem, s, `fact:priv-${i}`,
         `private scratch note ${t}: draft hypothesis not ready to share`);
    sim.privacy.push({ prompt: `${t} draft hypothesis`,
                       targetId: `fact:priv-${i}` });
  }
  // Abstention: tokens that were never deposited.
  for (let i = 0; i < N_ABSTAIN; i++)
    sim.abstain.push({ prompt: `qzx${i}wv kdmv${i}q` });
  // Recency: twin facts sharing a token; one is reinforced on spaced hits.
  for (let i = 0; i < N_RECENCY; i++) {
    const t = tok(8, i), s = sec(`recency-${i}`);
    leaf(osem, s, `fact:recency-${i}-r`,
         `strategy ${t} reinforced approach delivers the delta`);
    leaf(osem, s, `fact:recency-${i}-t`,
         `strategy ${t} alternate approach delivers the delta`);
    sim.recency.push({ prompt: `${t} approach`,
                       reinforced: `fact:recency-${i}-r`,
                       twin: `fact:recency-${i}-t` });
  }
  // Long memories: multi-paragraph episodes (~100-140 words), the shape an
  // agent stores when it writes a session retrospective instead of a fact.
  const LONG_BODIES = [
    `Session retrospective ${tok(9, 0)}: the morning went to hunting down a ` +
    `regression in the ingestion pipeline. The first hypothesis blamed the ` +
    `chunker, but the chunk boundaries were exactly where they should be.\n\n` +
    `The actual cause was a stale cache key surviving the schema migration — ` +
    `entries written before the deploy kept answering with the old layout. ` +
    `Invalidating the store brought recall back to normal immediately.\n\n` +
    `Action item: ${tok(9, 0)} needs a cache-version check on boot, and the ` +
    `incident is worth a page in the runbook.`,
    `Incident notes ${tok(9, 1)}: the nightly export failed silently for three ` +
    `days because the alert only watched the exit code, not the produced ` +
    `artifact. The job returned success while writing an empty file.\n\n` +
    `We added a size check on the output and a heartbeat metric. ` +
    `${tok(9, 1)} is now tracked in the reliability dashboard.`,
    `Design decision record ${tok(9, 2)}: after weighing the options the team ` +
    `chose local-first storage over the hosted alternative, mostly for audit ` +
    `and offline reasons.\n\nThe rejected option scored better on latency and ` +
    `ops burden, but data residency was a hard requirement from legal.\n\n` +
    `Revisit ${tok(9, 2)} only if the residency constraint is lifted or the ` +
    `hosted offer gains a compliance mode.`,
  ];
  for (let i = 0; i < N_LONG; i++) {
    const s = sec(`long-${i}`);
    osem.registerMemo({ id: `fact:long-${i}`, kind: "observation",
                   granularity: "paragraph", body: LONG_BODIES[i]!,
                   derivesFrom: s, src: "agent-memory.log",
                   srcLine: i * 40 + 1 });
    sim.long.push({ id: `fact:long-${i}`, prompt: `${tok(9, i)}`,
                    minLines: LONG_BODIES[i]!.split("\n").length,
                    longBody: LONG_BODIES[i]!.length > 400 });
  }
  // Filler mass: routine memories so the corpus is not trivially small.
  const fs = sec("filler");
  for (let i = 0; i < N_FILLER; i++)
    leaf(osem, fs, `filler:${i}`,
         `note ${i}: ${FILLER[i % 10]} ${FILLER[(i * 3) % 10]} ` +
         `${FILLER[(i * 7 + 2) % 10]} item ${i}`);
  return sim;
}

let sim: tsSim | undefined;
const getSim = () => (sim ??= buildSim());

describe("H1 — needle recall at load (LongMemEval: information extraction)", () => {
  it("restitutes deposited facts into the injected context", () => {
    const { osem, needles } = getSim();
    let hits = 0, mrr = 0;
    // MRR among LEAVES only — parents legitimately rank above by propagation.
    const isLeaf = (id: string) =>
      !/^(sec:|mem:|doc:)/.test(id) && !/^synth:doc#\d+$/.test(id);
    for (const q of needles) {
      const surfaced = osem.recallShallow({ agentId: "alpha", prompt: q.prompt });
      const rank = surfaced.filter(x => isLeaf(x.id))
                           .findIndex(x => x.id === q.targetId);
      if (rank >= 0) mrr += 1 / (rank + 1);
      const ctx = osem.formatContext({ agentId: "alpha" });
      if (q.targetId && ctx.leafIds.includes(q.targetId)) hits++;
    }
    const recall = hits / needles.length;
    console.log(`H1 needle: recall@formatContext ${hits}/${needles.length}` +
                ` (${(recall * 100).toFixed(0)}%), MRR ${(mrr / needles.length).toFixed(3)}`);
    expect(recall).toBeGreaterThanOrEqual(0.9);
  });
});

describe("H2 — knowledge updates restitute the current value", () => {
  it("returns the new value and buries the old one", () => {
    const { osem, updates } = getSim();
    let ok = 0;
    for (const u of updates) {
      // New token → the atom surfaces with its CURRENT body.
      const ctx = (() => {
        osem.recallShallow({ agentId: "alpha", prompt: u.newTok });
        return osem.formatContext({ agentId: "alpha" });
      })();
      const item = ctx.items.find(x => x.excerpt.includes(u.newTok));
      if (item) ok++;
      // Old token → the atom must NOT be restituted as the old value.
      osem.recallShallow({ agentId: "alpha", prompt: u.oldTok });
      const stale = osem.formatContext({ agentId: "alpha" });
      expect(stale.items.some(x => x.excerpt.includes(u.oldTok))).toBe(false);
    }
    console.log(`H2 update: ${ok}/${updates.length} current values restituted`);
    expect(ok).toBe(updates.length);
  });
});

describe("H3 — retracted memories stay inert (superseded)", () => {
  it("never surfaces nor injects a superseded fact", () => {
    const { osem, retracted } = getSim();
    for (const r of retracted) {
      const surfaced = osem.recallShallow({ agentId: "alpha", prompt: r.query });
      expect(surfaced.some(x => x.id === r.id)).toBe(false);
      const ctx = osem.formatContext({ agentId: "alpha" });
      expect(ctx.leafIds.includes(r.id)).toBe(false);
    }
  });
});

describe("H4 — distractor pairs (adversarial near-duplicates)", () => {
  it("the discriminating term picks the right twin", () => {
    const { osem, distractors } = getSim();
    let ok = 0;
    for (const q of distractors) {
      const surfaced = osem.recallShallow({ agentId: "alpha", prompt: q.prompt });
      const ai = surfaced.findIndex(x => x.id === q.targetId);
      const bi = surfaced.findIndex(x => x.id === q.twinId);
      if (ai >= 0 && (bi < 0 || ai < bi)) ok++;
    }
    console.log(`H4 distractor: ${ok}/${distractors.length} correct twins on top`);
    expect(ok).toBeGreaterThanOrEqual(N_DISTRACT - 1);
  });
});

describe("H5 — cross-plane restitution (multi-agent shared scope)", () => {
  it("a fact shared into scope:proj is restituted to another agent", () => {
    const { osem, cross } = getSim();
    // Alpha consults and mirrors its working memory into scope:proj.
    for (const q of cross)
      osem.recallShallow({ agentId: "alpha", prompt: q.prompt,
                    share: "scope:proj" });
    // Beta reads the shared plane only — authoritative scopes.
    let hits = 0;
    for (const q of cross) {
      const ctx = osem.formatContext({ agentId: "beta", scopes: ["scope:proj"] });
      if (q.targetId && ctx.leafIds.includes(q.targetId)) hits++;
    }
    console.log(`H5 cross-plane: ${hits}/${cross.length} shared facts restituted to beta`);
    expect(hits).toBe(cross.length);
  });
});

describe("H6 — privacy: private planes do not leak", () => {
  it("alpha's private memories are absent from beta's planes", () => {
    const { osem, privacy } = getSim();
    for (const q of privacy)
      osem.recallShallow({ agentId: "alpha", prompt: q.prompt }); // no share
    // Beta's formatContext (default: agent:beta + public) must not contain them.
    const ctx = osem.formatContext({ agentId: "beta" });
    for (const q of privacy)
      expect(ctx.leafIds.includes(q.targetId!)).toBe(false);
  });
});

describe("H7 — abstention (honest silence on unknown topics)", () => {
  it("returns silence for every never-deposited topic", () => {
    const { osem, abstain } = getSim();
    let silent = 0;
    for (const q of abstain) {
      const surfaced = osem.recallShallow({ agentId: "alpha", prompt: q.prompt });
      if (surfaced.length === 0) silent++;
    }
    console.log(`H7 abstention: ${silent}/${abstain.length} honest silences`);
    expect(silent).toBe(abstain.length);
  });
});

describe("H8 — spaced reinforcement outranks the twin (temporal memory)", () => {
  it("a memory consulted on spaced hits wins over an untouched twin", () => {
    const { osem, recency } = getSim();
    let ok = 0;
    for (const r of recency) {
      // Reinforce at Δhits ≥ tau/2 (tau0=5 → spaced consultations count):
      // ~5 unrelated consultations between each reinforcement.
      for (let i = 0; i < 3; i++) {
        osem.recallShallow({ agentId: "alpha",
                      prompt: `${r.prompt} reinforced` });
        burn(osem, "alpha", 5);
      }
      const surfaced = osem.recallShallow({ agentId: "alpha", prompt: r.prompt });
      const ri = surfaced.findIndex(x => x.id === r.reinforced);
      const ti = surfaced.findIndex(x => x.id === r.twin);
      if (ri >= 0 && (ti < 0 || ri < ti)) ok++;
    }
    console.log(`H8 recency: ${ok}/${recency.length} reinforced memories on top`);
    expect(ok).toBe(recency.length);
  });
});

describe("H9 — end-to-end query latency under the full battery", () => {
  it("stays bounded while restituting the whole workload", () => {
    const { osem, ...s } = getSim();
    const battery = [
      ...s.needles.map(q => q.prompt),
      ...s.updates.map(u => u.newTok),
      ...s.retracted.map(r => r.query),
      ...s.distractors.map(q => q.prompt),
      ...s.cross.map(q => q.prompt),
      ...s.privacy.map(q => q.prompt),
      ...s.abstain.map(q => q.prompt),
      ...s.recency.map(r => r.prompt),
      ...s.long.map(l => l.prompt),
    ];
    const lat: number[] = [];
    for (let i = 0; i < battery.length; i++) {
      const t0 = performance.now();
      osem.recallShallow({ agentId: "alpha", prompt: battery[i]! });
      osem.formatContext({ agentId: "alpha" });
      lat.push(performance.now() - t0);
    }
    lat.sort((a, b) => a - b);
    const p50 = lat[Math.floor(lat.length / 2)]!;
    const p95 = lat[Math.ceil(0.95 * lat.length) - 1]!;
    console.log(`H9 battery: ${battery.length} queries, ` +
                `p50 ${p50.toFixed(1)}ms, p95 ${p95.toFixed(1)}ms`);
    // Generous bound: asserts no pathological blowup, not a timing claim.
    expect(p95).toBeLessThan(500);
  });
});

describe("H10 — long memories (multi-paragraph episodes)", () => {
  it("restitutes paragraph-scale memories with bounded excerpts", () => {
    const { osem, long } = getSim();
    let hits = 0;
    for (const l of long) {
      osem.recallShallow({ agentId: "alpha", prompt: l.prompt });
      const ctx = osem.formatContext({ agentId: "alpha" });
      if (!ctx.leafIds.includes(l.id)) continue;
      hits++;
      const item = ctx.items.find(x => x.source === l.id
                                     || x.excerpt.includes(l.prompt));
      // Provenance spans the whole paragraph block, not just line one.
      expect(item?.lines).not.toBeNull();
      expect(item!.lines![1] - item!.lines![0] + 1).toBe(l.minLines);
      // The injected excerpt stays inside its presentation bound.
      expect(item!.excerpt.length).toBeLessThanOrEqual(400);
      // Bodies longer than the bound are truncated, not dropped.
      if (l.longBody) expect(item!.excerpt.length).toBe(400);
    }
    console.log(`H10 long: ${hits}/${long.length} episodes restituted`);
    expect(hits).toBe(long.length);
  });
});
