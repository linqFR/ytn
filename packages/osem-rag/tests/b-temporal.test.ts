/**
 * B-series — temporal dynamics: hebbian reinforcement, STP decay, pinned
 * floors, zombie immunity, earned floors, hype cycles, burst vs fundamental.
 */
import { describe, expect, it } from "vitest";
import { burn, hitOf, makeOsem } from "./helpers.ts";

const SALIENCE = (hit: number) =>
  `ROUND(MAX(IFNULL(s.salience, 0) * POWER(0.5, (? - IFNULL(s.touched_hit, 0)) / IFNULL(s.tau, 5)),
      0.3 * (1 - EXP(-IFNULL(s.uses_spaced, 0) / 3)),
      CASE a.flag WHEN 'pinned' THEN 0.6 WHEN 'high' THEN 0.3 ELSE 0 END), 3)`;

describe("B1 — hebbian reinforcement lift", () => {
  it("raises target energy across repeated excitations then plateaus", () => {
    const { osem } = makeOsem();
    const energies: number[] = [];
    for (let i = 0; i < 5; i++) {
      const s = osem.recallShallow({ agentId: "B1", prompt: "maranget" });
      const t = s.filter(x => x.id.includes("maranget matching"));
      energies.push(t.length ? Math.max(...t.map(x => x.e)) : 0);
      osem.recallShallow({ agentId: "B1", prompt: "qzxw jvkm bplq zxcv" });
    }
    expect(energies[4]).toBeGreaterThanOrEqual(energies[0]);
  });
});

describe("B3 — working-memory decay (STP)", () => {
  it("cools residual energy below θ after exogenous fillers", () => {
    const { osem, db } = makeOsem();
    for (let i = 0; i < 5; i++) {
      osem.recallShallow({ agentId: "B3", prompt: "maranget" });
      osem.recallShallow({ agentId: "B3", prompt: "qzxw jvkm bplq zxcv" });
    }
    for (let i = 0; i < 5; i++)
      osem.recallShallow({ agentId: "B3", prompt: "qzxw jvkm bplq zxcv" });
    const e = db.prepare(
      `SELECT energy FROM agent_energy WHERE scope_id = 'agent:B3'
       AND atom_id LIKE '%maranget%' ORDER BY energy DESC LIMIT 1`,
    ).get() as { energy: number } | undefined;
    expect(e?.energy ?? 0).toBeLessThan(0.5);
  });
});

describe("B5 — pinned floor (50 hits without consultation)", () => {
  it("keeps flagged salience at or above the high floor", () => {
    const { osem, db } = makeOsem();
    osem.registerMemo({ id: "ATOM-PIN", kind: "decision", flag: "pinned",
                   granularity: "paragraph",
                   body: "never migrate schema.sql without a backup" });
    burn(osem, "B5", 50); // 50 consultations on the plane, none touching the pin
    const r = db.prepare(
      `SELECT COUNT(*) n, MIN(MAX(IFNULL(s.salience, 0) * POWER(0.5, (? - IFNULL(s.touched_hit, 0)) / IFNULL(s.tau, 5)),
          0.3 * (1 - EXP(-IFNULL(s.uses_spaced, 0) / 3)),
          CASE a.flag WHEN 'pinned' THEN 0.6 WHEN 'high' THEN 0.3 ELSE 0 END)) mn
       FROM atoms a LEFT JOIN atom_sediment s ON s.atom_id = a.id
       WHERE a.flag IN ('pinned','high')`,
    ).get(hitOf(db, "agent:B5")) as { n: number; mn: number | null };
    expect(r.n).toBeGreaterThan(0);
    expect(r.mn).toBeGreaterThanOrEqual(0.3);
  });
});

describe("B6 — zombie fact (superseded never surfaces)", () => {
  it("never surfaces a superseded atom and freezes its edge weight", () => {
    const { osem, db } = makeOsem();
    osem.registerMemo({ id: "ATOM-ZOMBIE", kind: "observation", granularity: "paragraph",
                   body: "PB-9999 never use legacy.db — superseded by new storage" });
    db.prepare(`UPDATE atoms SET status = 'superseded' WHERE id = 'ATOM-ZOMBIE'`).run();
    const before = db.prepare(
      `SELECT weight FROM atom_links WHERE to_id = 'ATOM-ZOMBIE' LIMIT 1`).get() as
      { weight: number } | undefined;
    const zombie = osem.recallShallow({ agentId: "B6", prompt: "PB-9999 legacy.db" });
    const after = db.prepare(
      `SELECT weight FROM atom_links WHERE to_id = 'ATOM-ZOMBIE' LIMIT 1`).get() as
      { weight: number } | undefined;
    expect(zombie.filter(x => x.id === "ATOM-ZOMBIE")).toHaveLength(0);
    expect(after?.weight).toBe(before?.weight);
  });
});

describe("B8 — earned floor (1 consult vs 5 spaced)", () => {
  it("grants a durable floor only to spaced consultations", () => {
    const { osem, db } = makeOsem();
    osem.registerMemo({ id: "ATOM-RARE", kind: "observation", granularity: "paragraph",
                   body: "tokA tokB tokC rare content, one single consultation" });
    osem.registerMemo({ id: "ATOM-SPACED", kind: "observation", granularity: "paragraph",
                   body: "tokD tokE tokF content consulted regularly spaced" });
    osem.recallShallow({ agentId: "B8", prompt: "tokA tokB tokC" });
    for (let i = 0; i < 5; i++) {
      osem.recallShallow({ agentId: "B8", prompt: "tokD tokE tokF" });
      burn(osem, "B8", 10); // ~10 hits between consults → dt ≥ τ/2 = spaced
    }
    const r = db.prepare(
      `SELECT a.id, ROUND(MAX(s.salience * POWER(0.5, (? - s.touched_hit) / s.tau),
          0.3 * (1 - EXP(-s.uses_spaced / 3))), 3) s, s.uses_spaced
       FROM atoms a JOIN atom_sediment s ON s.atom_id = a.id AND s.scope_id = 'agent:B8'
       WHERE a.id IN ('ATOM-RARE','ATOM-SPACED') GROUP BY a.id`,
    ).all(hitOf(db, "agent:B8")) as { id: string; s: number; uses_spaced: number }[];
    const spaced = r.find(x => x.id === "ATOM-SPACED");
    const rare = r.find(x => x.id === "ATOM-RARE");
    expect(spaced && rare).toBeTruthy();
    expect(spaced!.s).toBeGreaterThan(rare!.s);
    expect(spaced!.uses_spaced).toBeGreaterThan(0);
  });
});

describe("B9 — hype cycle (burst vs spaced, 20 consultations each)", () => {
  it("grows tau only through spacing", () => {
    const { osem, db } = makeOsem();
    osem.registerMemo({ id: "ATOM-FAD", kind: "observation", granularity: "paragraph",
                   body: "tokFAD buzz trendy fleeting hype" });
    osem.registerMemo({ id: "ATOM-FUND", kind: "observation", granularity: "paragraph",
                   body: "tokFOND fundamental durable architecture central concept" });
    for (let i = 0; i < 20; i++) osem.recallShallow({ agentId: "B9", prompt: "tokFAD buzz" });
    for (let i = 0; i < 20; i++) {
      osem.recallShallow({ agentId: "B9", prompt: "tokFOND fondamental" });
      burn(osem, "B9", 8); // ~8 hits between consults → spaced reinforcement
    }
    const taus = db.prepare(
      `SELECT atom_id id, ROUND(tau, 1) tau FROM atom_sediment
       WHERE atom_id IN ('ATOM-FAD','ATOM-FUND') AND scope_id = 'agent:B9'`,
    ).all() as { id: string; tau: number }[];
    const fad = taus.find(x => x.id === "ATOM-FAD");
    const fund = taus.find(x => x.id === "ATOM-FUND");
    expect(fad && fund).toBeTruthy();
    expect(fad!.tau).toBeLessThan(fund!.tau);
  });
});

describe("B15 — burst vs fundamental (30 close queries then cooling)", () => {
  it("lets the burst die (uses_spaced = 0) while the pinned decision holds", () => {
    const { osem, db } = makeOsem();
    osem.registerMemo({ id: "table:decisions", kind: "synthese", granularity: "doc",
                   body: "Table decisions (external source)", title: "decisions",
                   fts: false });
    osem.registerMemo({ id: "ATOM-BUGDAY", kind: "observation", granularity: "paragraph",
                   body: "tokBUG temporary one-day bug intermittent crash tokBUG" });
    osem.registerMemo({ id: "ATOM-ARCH", kind: "observation", flag: "pinned",
                   granularity: "paragraph",
                   body: "tokARCH founding architecture decision: never migrate schema.sql without backup",
                   derivesFrom: "table:decisions" });
    for (let i = 0; i < 30; i++)
      osem.recallShallow({ agentId: "B15", prompt: "tokBUG bug crash" });
    burn(osem, "B15", 60); // 60 consultations elsewhere — the burst cools off
    const sLater = osem.recallShallow({ agentId: "B15", prompt: "schema.sql migration backup" });
    expect(sLater.some(x => x.id === "ATOM-ARCH")).toBe(true);
    const bug = db.prepare(
      `SELECT ROUND(MAX(s.salience * POWER(0.5, (? - s.touched_hit) / s.tau),
          0.3 * (1 - EXP(-s.uses_spaced / 3))), 3) s, s.uses_spaced
       FROM atom_sediment s WHERE s.atom_id = 'ATOM-BUGDAY' AND s.scope_id = 'agent:B15'`,
    ).get(hitOf(db, "agent:B15")) as { s: number; uses_spaced: number } | undefined;
    expect(bug?.uses_spaced).toBe(0);
    expect(bug!.s).toBeLessThan(0.05);
  });
});
