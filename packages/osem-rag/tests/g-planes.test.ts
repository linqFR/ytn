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
    osem.recallLexical({ agentId: "alpha", prompt: TOPIC,
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

  it("mirrors write their own bookmarks but never graph-learn (learn=false)", () => {
    const { osem, db } = makeOsem();
    osem.recallLexical({ agentId: "alpha", prompt: TOPIC,
                  share: ["public", "scope:gov"] });
    // Bookmarks are each scope's own observations: one commit on the acting
    // plane + one share commit on each mirror.
    const bm = db.prepare(
      `SELECT scope_id, COUNT(*) n FROM bookmarks GROUP BY scope_id ORDER BY scope_id`,
    ).all() as { scope_id: string; n: number }[]; // CAST: all() returns unknown[]
    expect(bm.map(r => r.scope_id)).toEqual(["agent:alpha", "public", "scope:gov"]);
    for (const r of bm) expect(r.n).toBeGreaterThan(0);
    // Graph learning stays acting-scope only: hebbian gain + fatigue rows
    // exist on agent:alpha, nowhere else.
    const learned = db.prepare(
      `SELECT scope_id, COUNT(*) n FROM edge_gain GROUP BY scope_id`,
    ).all() as { scope_id: string; n: number }[]; // CAST: all() returns unknown[]
    expect(learned.map(r => r.scope_id)).toEqual(["agent:alpha"]);
  });

  it("keeps a personal plane invisible to other agents' default formatContext", () => {
    const { osem } = makeOsem();
    osem.recallLexical({ agentId: "alpha", prompt: TOPIC }); // no share
    // beta's default planes (agent:beta + public) hold nothing about it.
    const ctx = osem.formatContext({ agentId: "beta" });
    expect(ctx.leaves).toBe(0);
    // But the read-only union "all" sees every plane, including alpha's.
    const all = osem.formatContext({ agentId: "beta", scopes: "all" });
    expect(all.leaves).toBeGreaterThan(0);
  });

  it("treats an explicit scopes list as authoritative (no implicit personal plane)", () => {
    const { osem } = makeOsem();
    osem.recallLexical({ agentId: "alpha", prompt: TOPIC }); // private only
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
    osem.recallLexical({ agentId: "alpha", prompt: TOPIC, share: "scope:gov" });
    osem.recallLexical({ agentId: "beta", prompt: "maranget matrix", share: "scope:gov" });
    // gamma reads the shared domain plane — both agents' work is there.
    const ctx = osem.formatContext({ agentId: "gamma", scopes: ["scope:gov"] });
    expect(ctx.leaves).toBeGreaterThanOrEqual(2);
  });

  it("actAs lets a scope's owner consolidate bookmarks ON the shared plane", () => {
    const { osem, db } = makeOsem();
    osem.recallLexical({ agentId: "alpha", prompt: TOPIC, actAs: "scope:gov" });
    // The shared plane learned: bookmarks live on scope:gov, not agent:alpha.
    const bm = db.prepare(
      `SELECT scope_id, COUNT(*) n FROM bookmarks
       GROUP BY scope_id`).all() as { scope_id: string; n: number }[]; // CAST: all() returns unknown[]
    expect(bm.map(s => s.scope_id)).toEqual(["scope:gov"]);
    expect(bm[0]?.n).toBeGreaterThan(0);
    // Ownership recorded: first claimer becomes scope_owner.
    const owner = db.prepare(
      `SELECT owner FROM scope_owner WHERE scope_id='scope:gov'`).get() as
      { owner: string };
    expect(owner.owner).toBe("alpha");
    // The scope's own seq advanced (not the agent's): one acting recall =
    // one commit on the scope, zero on the personal plane.
    expect((db.prepare(`SELECT seq FROM scope_clock WHERE scope_id='scope:gov'`)
      .get() as { seq: number }).seq).toBe(1);
    expect(db.prepare(`SELECT seq FROM scope_clock WHERE scope_id='agent:alpha'`)
      .get()).toBeUndefined();
  });

  it("actAs rejects a non-owner — before touching anything", () => {
    const { osem, db } = makeOsem();
    osem.recallLexical({ agentId: "alpha", prompt: TOPIC, actAs: "scope:gov" });
    const loggedBefore = (db.prepare(
      `SELECT COUNT(*) n FROM bookmarks WHERE scope_id='scope:gov'`)
      .get() as { n: number }).n;
    expect(() => osem.recallLexical(
      { agentId: "beta", prompt: TOPIC, actAs: "scope:gov" }),
    ).toThrow(/owned by alpha/);
    // Denied claim = zero side effects: no energy, no seq advance, no bookmarks.
    expect((db.prepare(`SELECT seq FROM scope_clock WHERE scope_id='scope:gov'`)
      .get() as { seq: number }).seq).toBe(1);
    expect((db.prepare(`SELECT COUNT(*) n FROM bookmarks WHERE scope_id='scope:gov'`)
      .get() as { n: number }).n).toBe(loggedBefore);
  });
});
