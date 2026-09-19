/**
 * Memory planes — the scope_id contract (spec §6.2):
 *  - personal `agent:<id>` planes are private working memories;
 *  - `share` mirrors a wave into shared planes (public / scope: / skill:)
 *    with learn=false: energy + trace, but NO multiplied LTP;
 *  - formatContext aggregates planes; "all" is the read-only union.
 */
import { describe, expect, it } from "vitest";
import { makeOsem } from "./helpers.ts";

const TOPIC = "maranget decision tree";

describe("memory planes — share mirrors a wave without double learning", () => {
  it("writes energy into personal + shared planes, readable by another agent", () => {
    const { osem, db } = makeOsem();
    osem.recallShallow({ agentId: "alpha", prompt: TOPIC,
                  share: ["public", "scope:gov", "skill:sql"] });
    // The wave is mirrored into every shared plane.
    for (const scope of ["agent:alpha", "public", "scope:gov", "skill:sql"]) {
      const n = (db.prepare(
        `SELECT COUNT(*) n FROM agent_energy WHERE scope_id = ?`).get(scope) as
        { n: number }).n;
      expect(n, `plane ${scope} should hold energy`).toBeGreaterThan(0);
    }
    // Another agent can read the shared plane.
    const ctx = osem.formatContext({ agentId: "beta", scopes: ["public"] });
    expect(ctx.leaves).toBeGreaterThan(0);
  });

  it("does NOT multiply LTP consolidation across mirrors (learn=false)", () => {
    const { osem, db } = makeOsem();
    osem.recallShallow({ agentId: "alpha", prompt: TOPIC,
                  share: ["public", "scope:gov"] });
    // One consultation — even mirrored into 2 shared planes, sediment is
    // consolidated ONCE on the learning plane (sharing must not accelerate it).
    const u = db.prepare(
      `SELECT atom_id id, scope_id, uses, uses_spaced FROM atom_sediment
       WHERE uses > 0 ORDER BY uses DESC`).all() as
      { id: string; scope_id: string; uses: number; uses_spaced: number }[];
    expect(u.every(a => a.scope_id === "agent:alpha"),
      "sediment should only exist on the learning plane").toBe(true);
    expect(u.length).toBeGreaterThan(0);
    for (const a of u) expect(a.uses, `uses of ${a.id}`).toBe(1);
  });

  it("keeps a personal plane invisible to other agents' default formatContext", () => {
    const { osem } = makeOsem();
    osem.recallShallow({ agentId: "alpha", prompt: TOPIC }); // no share
    // beta's default planes (agent:beta + public) hold nothing about it.
    const ctx = osem.formatContext({ agentId: "beta" });
    expect(ctx.leaves).toBe(0);
    // But the read-only union "all" sees every plane, including alpha's.
    const all = osem.formatContext({ agentId: "beta", scopes: "all" });
    expect(all.leaves).toBeGreaterThan(0);
  });

  it("treats an explicit scopes list as authoritative (no implicit personal plane)", () => {
    const { osem } = makeOsem();
    osem.recallShallow({ agentId: "alpha", prompt: TOPIC }); // private only
    // Asking for "public" reads ONLY public — alpha's own private plane
    // does not leak into a scoped read.
    const scoped = osem.formatContext({ agentId: "alpha", scopes: ["public"] });
    expect(scoped.leaves).toBe(0);
    // The default (no scopes) still includes the personal plane.
    const def = osem.formatContext({ agentId: "alpha" });
    expect(def.leaves).toBeGreaterThan(0);
  });

  it("lets a scope plane accumulate knowledge across agents", () => {
    const { osem } = makeOsem();
    osem.recallShallow({ agentId: "alpha", prompt: TOPIC, share: "scope:gov" });
    osem.recallShallow({ agentId: "beta", prompt: "maranget matrix", share: "scope:gov" });
    // gamma reads the shared domain plane — both agents' work is there.
    const ctx = osem.formatContext({ agentId: "gamma", scopes: ["scope:gov"] });
    expect(ctx.leaves).toBeGreaterThanOrEqual(2);
  });

  it("actAs lets a scope's owner consolidate sediment ON the shared plane", () => {
    const { osem, db } = makeOsem();
    osem.recallShallow({ agentId: "alpha", prompt: TOPIC, actAs: "scope:gov" });
    // The shared plane learned: sediment lives on scope:gov, not agent:alpha.
    const sed = db.prepare(
      `SELECT scope_id, COUNT(*) n FROM atom_sediment WHERE uses > 0
       GROUP BY scope_id`).all() as { scope_id: string; n: number }[];
    expect(sed.map(s => s.scope_id)).toEqual(["scope:gov"]);
    expect(sed[0]?.n).toBeGreaterThan(0);
    // Ownership recorded: first claimer becomes scope_owner.
    const owner = db.prepare(
      `SELECT owner FROM scope_owner WHERE scope_id='scope:gov'`).get() as
      { owner: string };
    expect(owner.owner).toBe("alpha");
    // The scope's own hit count advanced (not the agent's): one acting
    // recall = one hit on the scope, zero on the personal plane.
    expect((db.prepare(`SELECT hit FROM scope_clock WHERE scope_id='scope:gov'`)
      .get() as { hit: number }).hit).toBe(1);
    expect(db.prepare(`SELECT hit FROM scope_clock WHERE scope_id='agent:alpha'`)
      .get()).toBeUndefined();
  });

  it("actAs rejects a non-owner — before touching anything", () => {
    const { osem, db } = makeOsem();
    osem.recallShallow({ agentId: "alpha", prompt: TOPIC, actAs: "scope:gov" });
    const loggedBefore = (db.prepare(
      `SELECT COUNT(*) n FROM surface_log WHERE scope_id='scope:gov'`)
      .get() as { n: number }).n;
    expect(() => osem.recallShallow(
      { agentId: "beta", prompt: TOPIC, actAs: "scope:gov" }),
    ).toThrow(/owned by alpha/);
    // Denied claim = zero side effects: no energy, no hit advance, no log.
    expect((db.prepare(`SELECT hit FROM scope_clock WHERE scope_id='scope:gov'`)
      .get() as { hit: number }).hit).toBe(1);
    expect((db.prepare(`SELECT COUNT(*) n FROM surface_log WHERE scope_id='scope:gov'`)
      .get() as { n: number }).n).toBe(loggedBefore);
  });
});
