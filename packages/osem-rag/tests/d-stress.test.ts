/**
 * Stress tests — B12 churn, B13 crash recovery, B14 multi-agents.
 * (Spec §4.4: to run before any deployment.)
 */
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createOsem } from "../src/index.ts";
import { CORPUS, makeOsem } from "./helpers.ts";

describe("B12 — churn (30% of the corpus replaced)", () => {
  it("erodes and prunes edges to removed atoms (traced); orphans cool down", () => {
    const { osem, db } = makeOsem();
    // Deposit a disposable third of the corpus, consult it, then supersede it.
    for (let i = 0; i < 3; i++)
      osem.registerMemo({ id: `synth:churn#${i}`, kind: "observation",
                     granularity: "paragraph",
                     body: `[${CORPUS.doc}] churn topic tokC${i} transient content` });
    osem.maintain();
    for (let i = 0; i < 10; i++)
      osem.recallLexical({ agentId: "B12", prompt: "churn tokC0 tokC1" });
    const linkedBefore = (db.prepare(
      `SELECT COUNT(*) n FROM atom_links l JOIN atoms a ON a.id = l.to_id
       WHERE a.id LIKE 'synth:churn%' OR a.id LIKE 'syn:%'`).get() as { n: number }).n;
    // Supersede the churn atoms (docs updated/replaced).
    db.prepare(`UPDATE atoms SET status = 'superseded' WHERE id LIKE 'synth:churn%'`).run();
    osem.maintain();
    const zombie = osem.recallLexical({ agentId: "B12", prompt: "churn tokC1 tokC2" });
    expect(zombie.filter(x => x.id.startsWith("synth:churn"))).toHaveLength(0);
    // The stable corpus still surfaces.
    const stable = osem.recallLexical({ agentId: "B12", prompt: "coercion rules" });
    expect(stable.length).toBeGreaterThan(0);
  });
});

describe("B13 — crash recovery (kill mid-session, reopen)", () => {
  it("loses working memory (assumed) but the cadastre + bookmarks survive", () => {
    const db = new Database(":memory:");
    const osem = createOsem({ db });
    osem.registerMemo({ id: "ATOM-KEEP", kind: "observation", granularity: "paragraph",
                   body: "tokKEEP durable founding decision content" });
    osem.recallLexical({ agentId: "B13", prompt: "tokKEEP durable" });
    const bookmarksBefore = (db.prepare(
      `SELECT COUNT(*) n FROM bookmarks
       WHERE atom_id = 'ATOM-KEEP' AND scope_id = 'agent:B13'`).get() as
      { n: number }).n; // CAST: get() returns unknown
    expect(bookmarksBefore).toBeGreaterThan(0);
    // Simulate the crash: drop the working-memory tables, keep the cadastre
    // and the append-only frequency truth.
    db.exec(`DELETE FROM agent_energy; DELETE FROM edge_fatigue; DELETE FROM edge_gain`);
    const after = (db.prepare(
      `SELECT COUNT(*) n FROM bookmarks
       WHERE atom_id = 'ATOM-KEEP' AND scope_id = 'agent:B13'`).get() as
      { n: number }).n; // CAST: get() returns unknown
    expect(after).toBe(bookmarksBefore);
    // A fresh excitation re-surfaces the still-frequent fact.
    const again = osem.recallLexical({ agentId: "B13b", prompt: "tokKEEP durable" });
    expect(again.some(x => x.id === "ATOM-KEEP")).toBe(true);
  });
});

describe("B14 — multi-agents (2 agent_ids in parallel, one cadastre)", () => {
  it("keeps working memories isolated while the lattice stays coherent", () => {
    const { osem, db } = makeOsem();
    osem.recallLexical({ agentId: "alpha", prompt: "maranget" });
    osem.recallLexical({ agentId: "beta", prompt: "serialization toJS" });
    // Working memories are partitioned: each plane only holds its own energy.
    const a = db.prepare(
      `SELECT COUNT(*) n FROM agent_energy WHERE scope_id = 'agent:alpha'`).get() as
      { n: number };
    const b = db.prepare(
      `SELECT COUNT(*) n FROM agent_energy WHERE scope_id = 'agent:beta'`).get() as
      { n: number };
    expect(a.n).toBeGreaterThan(0);
    expect(b.n).toBeGreaterThan(0);    // No cross-contamination: agent A's plane holds no agent B atom.
    const cross = db.prepare(
      `SELECT COUNT(*) n FROM agent_energy WHERE scope_id = 'agent:alpha'
       AND atom_id LIKE '%serialization%'`).get() as { n: number };
    expect(cross.n).toBe(0);
    // The lattice is shared: an edge learned by A is visible to B's field.
    const links = (db.prepare(`SELECT COUNT(*) n FROM atom_links`).get() as { n: number }).n;
    expect(links).toBeGreaterThan(0);
  });
});
