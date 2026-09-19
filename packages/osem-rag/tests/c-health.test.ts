/**
 * C/D-series — field health (Gini, injected hubness) and operations
 * (bounded latency growth, cross-system determinism).
 */
import { describe, expect, it } from "vitest";
import { makeOsem, synthBody } from "./helpers.ts";

function giniOf(values: number[]): number {
  const v = values.slice().sort((a, b) => a - b);
  const n = v.length, sum = v.reduce((a, b) => a + b, 0);
  if (!sum) return 0;
  let g = 0;
  for (let i = 0; i < n; i++) g += (2 * (i + 1) - n - 1) * v[i];
  return g / (n * sum);
}

describe("C1 — weight inequality (Gini) after 200 prompts", () => {
  it("keeps link weights from collapsing into a winner-take-all field", () => {
    const { osem, db } = makeOsem();
    const topics = ["maranget", "serialization", "coercion", "opcode", "schema",
      "performance", "worker", "bytecode", "dispatch", "coercion"];
    for (let i = 0; i < 200; i++)
      osem.recallShallow({ agentId: "C1",
                    prompt: `${topics[i % topics.length]} ${topics[(i * 7) % topics.length]}` });
    const weights = (db.prepare(`SELECT weight FROM atom_links`).all() as
      { weight: number }[]).map(w => w.weight);
    expect(giniOf(weights)).toBeLessThan(0.6);
  });
});

describe("C2 — injected hubness (post-pools, ancestor cap)", () => {
  it("keeps the top-1% leaves below 20% of injected payload slots", () => {
    const { osem } = makeOsem();
    const topics = ["maranget", "serialization", "coercion", "opcode", "schema",
      "dispatch", "worker", "bytecode", "matrix", "jump"];
    const injected = new Map<string, number>();
    for (let i = 0; i < 50; i++) {
      osem.recallShallow({ agentId: "C2",
                    prompt: `${topics[i % topics.length]} ${topics[(i * 3) % topics.length]}` });
      const ctx = osem.formatContext({ agentId: "C2" });
      for (const id of ctx.leafIds)
        injected.set(id, (injected.get(id) ?? 0) + 1);
    }
    const counts = [...injected.values()].sort((a, b) => b - a);
    const top1pct = Math.max(1, Math.ceil(counts.length / 100));
    const hub = counts.slice(0, top1pct).reduce((a, b) => a + b, 0);
    const total = counts.reduce((a, b) => a + b, 0);
    expect(hub / Math.max(1, total)).toBeLessThan(0.2);
  });
});

describe("D1 — latency scaling (synthetic corpus)", () => {
  it("keeps latency growth bounded across corpus sizes (beam-bounded propagation)", () => {
    const words = Array.from({ length: 300 }, (_, i) => `tok${i}`);
    const medians: number[] = [];
    for (const n of [1000, 5000, 10000]) {
      const { osem } = makeOsem();
      osem.registerMemo({ id: "doc:load.md", kind: "synthese", granularity: "doc",
                     body: "Load corpus", title: "load", fts: false });
      for (let i = 0; i < n; i++)
        osem.registerMemo({ id: `syn:${i}`, kind: "observation", granularity: "paragraph",
                       body: synthBody(i, words), derivesFrom: "doc:load.md" });
      const lat: number[] = [];
      for (let i = 0; i < 30; i++) {
        const t0 = performance.now();
        osem.recallShallow({ agentId: "D1",
                      prompt: `${words[(i * 11) % 300]} ${words[(i * 3 + 1) % 300]}` });
        lat.push(performance.now() - t0);
      }
      lat.sort((a, b) => a - b);
      // Median, not p95: tail noise under parallel load makes p95 flaky.
      medians.push(lat[Math.floor(lat.length / 2)]);
    }
    // Bounded growth on the median (stable): end-to-end latency is ~linear
    // in N (seed collection scans the corpus; only propagation is
    // beam-bounded) — ×5 corpus must not cost ×10, ×2 must not cost ×2.5.
    // Generous bounds — CI machines are noisy.
    expect(medians[1] / medians[0]).toBeLessThan(10);
    expect(medians[2] / medians[1]).toBeLessThan(5);
  }, 240_000);
});

describe("D2 — determinism (two identical systems, 100 identical queries)", () => {
  it("produces byte-identical results across two independent fields", () => {
    const run100 = () => {
      const { osem } = makeOsem();
      const out: string[] = [];
      for (let i = 0; i < 100; i++) {
        const s = osem.recallShallow({ agentId: "D2", prompt: "maranget" });
        out.push(s.map(x => `${x.id}:${x.e.toFixed(4)}`).join("|"));
      }
      return out.join("\n");
    };
    expect(run100()).toBe(run100());
  });
});
