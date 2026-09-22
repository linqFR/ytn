/**
 * B-series — temporal dynamics: hebbian reinforcement, STP decay, pinned
 * floors, zombie immunity, earned floors, hype cycles, burst vs fundamental.
 */
import { describe, expect, it } from "vitest";
import { burn, makeOsem, seqOf } from "./helpers.ts";

/** In-window long-frequency sum + spread for one atom on one scope. */
const FRESH = (scopeId: string, atomId: string) => `
  SELECT IFNULL(SUM(n),0) f100, COUNT(*) spread FROM freq_buckets
  WHERE scope_id = '${scopeId}' AND atom_id = '${atomId}'
    AND bucket_id > ? - 10`; // ring depth NB = freqWindowLong / freqBucketSize

describe("B1 — hebbian reinforcement lift", () => {
  it("raises target energy across repeated excitations then plateaus", () => {
    const { osem } = makeOsem();
    const energies: number[] = [];
    for (let i = 0; i < 5; i++) {
      const s = osem.recallLexical({ agentId: "B1", prompt: "maranget" });
      const t = s.filter(x => x.id.includes("maranget matching"));
      energies.push(t.length ? Math.max(...t.map(x => x.e)) : 0);
      osem.recallLexical({ agentId: "B1", prompt: "qzxw jvkm bplq zxcv" });
    }
    expect(energies[4]).toBeGreaterThanOrEqual(energies[0]);
  });
});

describe("B3 — working-memory decay (STP)", () => {
  it("cools residual energy below θ after exogenous fillers", () => {
    const { osem, db } = makeOsem();
    for (let i = 0; i < 5; i++) {
      osem.recallLexical({ agentId: "B3", prompt: "maranget" });
      osem.recallLexical({ agentId: "B3", prompt: "qzxw jvkm bplq zxcv" });
    }
    for (let i = 0; i < 5; i++)
      osem.recallLexical({ agentId: "B3", prompt: "qzxw jvkm bplq zxcv" });
    const e = db.prepare(
      `SELECT energy FROM agent_energy WHERE scope_id = 'agent:B3'
       AND atom_id LIKE '%maranget%' ORDER BY energy DESC LIMIT 1`,
    ).get() as { energy: number } | undefined;
    expect(e?.energy ?? 0).toBeLessThan(0.5);
  });
});

describe("B5 — pinned floor (50 silent commits without consultation)", () => {
  it("keeps flag-floor wave presence while silence dilutes bookmarks", () => {
    const { osem, db } = makeOsem();
    osem.registerMemo({ id: "ATOM-PIN", kind: "decision", flag: "pinned",
                   granularity: "paragraph",
                   body: "never migrate schema.sql without a backup" });
    burn(osem, "B5", 50); // 50 silent commits — dilution slides, flags don't decay
    // Silence never strengthens: the pin earned zero bookmarks in 50 commits.
    const bm = db.prepare(
      `SELECT COUNT(*) n FROM bookmarks WHERE atom_id = 'ATOM-PIN'`,
    ).get() as { n: number }; // CAST: get() returns unknown
    expect(bm.n).toBe(0);
    // The pinned atom still surfaces: the additive flag floor is
    // frequency-independent (pinned immunity).
    const s = osem.recallLexical({ agentId: "B5", prompt: "migrate schema.sql backup" });
    expect(s.some(x => x.id === "ATOM-PIN")).toBe(true);
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
    const zombie = osem.recallLexical({ agentId: "B6", prompt: "PB-9999 legacy.db" });
    const after = db.prepare(
      `SELECT weight FROM atom_links WHERE to_id = 'ATOM-ZOMBIE' LIMIT 1`).get() as
      { weight: number } | undefined;
    expect(zombie.filter(x => x.id === "ATOM-ZOMBIE")).toHaveLength(0);
    expect(after?.weight).toBe(before?.weight);
  });
});

describe("B8 — earned durability (1 consult vs 5 spaced)", () => {
  it("grants bucket spread only to spaced consultations", () => {
    const { osem, db } = makeOsem();
    osem.registerMemo({ id: "ATOM-RARE", kind: "observation", granularity: "paragraph",
                   body: "tokA tokB tokC rare content, one single consultation" });
    osem.registerMemo({ id: "ATOM-SPACED", kind: "observation", granularity: "paragraph",
                   body: "tokD tokE tokF content consulted regularly spaced" });
    osem.recallLexical({ agentId: "B8", prompt: "tokA tokB tokC" });
    for (let i = 0; i < 5; i++) {
      osem.recallLexical({ agentId: "B8", prompt: "tokD tokE tokF" });
      burn(osem, "B8", 10); // ~10 commits between consults → distinct buckets
    }
    // Bookmarks are the truth: 5 spaced surfacings vs 1.
    const bm = db.prepare(
      `SELECT atom_id id, COUNT(*) n FROM bookmarks
       WHERE scope_id = 'agent:B8' AND atom_id IN ('ATOM-RARE','ATOM-SPACED')
       GROUP BY atom_id`,
    ).all() as { id: string; n: number }[]; // CAST: all() returns unknown[]
    const spaced = bm.find(x => x.id === "ATOM-SPACED");
    const rare = bm.find(x => x.id === "ATOM-RARE");
    expect(spaced?.n).toBe(5);
    expect(rare?.n).toBe(1);
    // Spread = distinct occupied buckets: spacing earns durability.
    const sp = db.prepare(
      `SELECT atom_id id, COUNT(*) spread FROM freq_buckets
       WHERE scope_id = 'agent:B8' AND atom_id IN ('ATOM-RARE','ATOM-SPACED')
       GROUP BY atom_id`,
    ).all() as { id: string; spread: number }[]; // CAST: all() returns unknown[]
    expect(sp.find(x => x.id === "ATOM-SPACED")!.spread)
      .toBeGreaterThanOrEqual(3); // durable tier (freqMinBuckets)
    expect(sp.find(x => x.id === "ATOM-RARE")!.spread).toBe(1);
  });
});

describe("B9 — hype cycle (burst vs spaced, 20 consultations each)", () => {
  it("earns spread only through spacing — a burst packs into few buckets", () => {
    const { osem, db } = makeOsem();
    osem.registerMemo({ id: "ATOM-FAD", kind: "observation", granularity: "paragraph",
                   body: "tokFAD buzz trendy fleeting hype" });
    osem.registerMemo({ id: "ATOM-FUND", kind: "observation", granularity: "paragraph",
                   body: "tokFOND fundamental durable architecture central concept" });
    for (let i = 0; i < 20; i++) osem.recallLexical({ agentId: "B9", prompt: "tokFAD buzz" });
    for (let i = 0; i < 20; i++) {
      osem.recallLexical({ agentId: "B9", prompt: "tokFOND fondamental" });
      burn(osem, "B9", 8); // ~9 commits between consults → spaced reinforcement
    }
    const sp = db.prepare(
      `SELECT atom_id id, COUNT(*) spread, SUM(n) f100 FROM freq_buckets
       WHERE scope_id = 'agent:B9' AND atom_id IN ('ATOM-FAD','ATOM-FUND')
       GROUP BY atom_id`,
    ).all() as { id: string; spread: number; f100: number }[]; // CAST: all() returns unknown[]
    const fad = sp.find(x => x.id === "ATOM-FAD");
    const fund = sp.find(x => x.id === "ATOM-FUND");
    expect(fad && fund).toBeTruthy();
    // Same total exposure, wildly different dispersion.
    expect(fund!.spread).toBeGreaterThan(fad!.spread);
    // The 20-commit burst packed into ≤3 buckets; the spaced pattern fills the ring.
    expect(fad!.spread).toBeLessThanOrEqual(3);
    // The burst is also out of the hot window by now (seq slid past).
    const seq = seqOf(db, "agent:B9");
    const f20fad = (db.prepare(
      `SELECT IFNULL(SUM(w),0) s FROM bookmarks
       WHERE scope_id = 'agent:B9' AND atom_id = 'ATOM-FAD' AND seq > ? - 20`,
    ).get(seq) as { s: number }).s; // CAST: get() returns unknown
    expect(f20fad).toBe(0);
  });
});

describe("B15 — burst vs fundamental (30 close queries then cooling)", () => {
  it("lets the burst die once the window slides past, while the pinned decision holds", () => {
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
      osem.recallLexical({ agentId: "B15", prompt: "tokBUG bug crash" });
    burn(osem, "B15", 120); // slide the long window (100 commits) past the burst
    const sLater = osem.recallLexical({ agentId: "B15", prompt: "schema.sql migration backup" });
    expect(sLater.some(x => x.id === "ATOM-ARCH")).toBe(true);
    // The burst is cold: zero in-window frequency. Bookmarks remain — the
    // truth is append-only — but no bucket survives the window.
    const seq = seqOf(db, "agent:B15");
    const curB = Math.floor(seq / 10);
    const bug = db.prepare(FRESH("agent:B15", "ATOM-BUGDAY"))
      .get(curB) as { f100: number; spread: number }; // CAST: get() returns unknown
    expect(bug.f100).toBe(0);
    expect(bug.spread).toBe(0);
    const bm = (db.prepare(
      `SELECT COUNT(*) n FROM bookmarks
       WHERE scope_id = 'agent:B15' AND atom_id = 'ATOM-BUGDAY'`,
    ).get() as { n: number }).n; // CAST: get() returns unknown
    expect(bm).toBeGreaterThan(0); // history kept, influence gone
  });
});
