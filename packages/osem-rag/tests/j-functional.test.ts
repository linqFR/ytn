/**
 * J-series — functional retrieval-effectiveness checks: does the engine
 * actually FIND things, and does windowed frequency measurably improve
 * retrieval end-to-end (wave ranking → injected payload)?
 *
 *   F1 quality    — top-1/top-5 hit rate on a tagged corpus with distractors
 *   F2 disambig   — frequency breaks a lexical tie between twin atoms
 *   F3 isolation  — bookmarks stay on the acting scope
 *   F4 silence    — unknown topic → zero surfaced, nothing fabricated
 *   F5 cross-plane— a fact shared onto scope:proj is restituted to beta
 *   F6 payload    — the frequently-consulted leaf reaches formatContext
 *   F7 real docs  — registerDoc over the markdown fixtures, targeted queries
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeOsem } from "./helpers.ts";

const MEMO = { kind: "observation", granularity: "paragraph" } as const;

describe("F1 — retrieval quality over a tagged corpus with distractors", () => {
  it("hits top-1 ≥ 80% and top-5 ≥ 90%", () => {
    const { osem } = makeOsem();
    const topics = [
      ["maranget", "maranget decision tree compiles patterns to jump matrices"],
      ["protobuf", "protobuf serialization encodes varint wire format"],
      ["sqlite", "sqlite wal mode allows concurrent readers during write"],
      ["viterbi", "viterbi algorithm decodes the most likely state sequence"],
      ["raft", "raft consensus elects a leader with majority votes"],
      ["bloom", "bloom filter trades false positives for memory"],
      ["lww", "last writer wins register resolves conflicts by timestamp"],
      ["mmap", "mmap maps files into virtual memory pages"],
      ["ebpf", "ebpf runs sandboxed programs in the kernel"],
      ["quic", "quic transport multiplexes streams over udp"],
    ] as const;
    for (const [t, body] of topics)
      osem.registerMemo({ id: `F1:${t}`, ...MEMO, body });
    for (let i = 0; i < 20; i++)
      osem.registerMemo({ id: `F1:d${i}`, ...MEMO,
        body: `generic note ${i} about memory and storage systems` });

    let top1 = 0, top5 = 0;
    for (const [t] of topics) {
      const r = osem.recallLexical({ agentId: "f1", prompt: t });
      const rank = r.findIndex(x => x.id === `F1:${t}`);
      if (rank === 0) top1++;
      if (rank >= 0 && rank < 5) top5++;
    }
    expect(top1).toBeGreaterThanOrEqual(8);
    expect(top5).toBeGreaterThanOrEqual(9);
  });
});

describe("F2 — frequency breaks a lexical tie", () => {
  it("the frequently-consulted twin outranks the equal-match cold one", () => {
    const { osem } = makeOsem();
    osem.registerMemo({ id: "F2:cold", ...MEMO,
      body: "zebra protocol handles distributed locks deterministically" });
    osem.registerMemo({ id: "F2:hot", ...MEMO,
      body: "zebra protocol guarantees distributed locks consistently" });
    for (let i = 0; i < 6; i++) {
      osem.recallLexical({ agentId: "f2",
        prompt: "zebra protocol distributed locks" });
      osem.recallLexical({ agentId: "f2",
        prompt: "zebra guarantees consistently" }); // hits hot only
    }
    const after = osem.recallLexical({ agentId: "f2",
      prompt: "zebra protocol distributed locks" });
    const eHot = after.find(x => x.id === "F2:hot")?.e ?? 0;
    const eCold = after.find(x => x.id === "F2:cold")?.e ?? 0;
    expect(eHot).toBeGreaterThan(eCold);
    expect(after.findIndex(x => x.id === "F2:hot"))
      .toBeLessThanOrEqual(after.findIndex(x => x.id === "F2:cold"));
  });
});

describe("F3 — frequency is per-scope", () => {
  it("bookmarks stay on the acting scope", () => {
    const { osem, db } = makeOsem();
    osem.registerMemo({ id: "F3:x", ...MEMO,
      body: "xenon scheduler preempts realtime tasks" });
    for (let i = 0; i < 5; i++)
      osem.recallLexical({ agentId: "a", prompt: "xenon scheduler" });
    const nA = (db.prepare(
      `SELECT COUNT(*) n FROM bookmarks WHERE scope_id='agent:a'`)
      .get() as { n: number }).n; // CAST: get() returns unknown
    const nB = (db.prepare(
      `SELECT COUNT(*) n FROM bookmarks WHERE scope_id='agent:b'`)
      .get() as { n: number }).n; // CAST: get() returns unknown
    expect(nA).toBeGreaterThan(0);
    expect(nB).toBe(0);
  });
});

describe("F4 — honest silence", () => {
  it("never fabricates a top-k for an unknown topic", () => {
    const { osem } = makeOsem();
    osem.registerMemo({ id: "F4:only", ...MEMO,
      body: "real content about real topics only" });
    expect(osem.recallLexical({ agentId: "f4",
      prompt: "qzxw jvkm bplq zxcv" })).toHaveLength(0);
  });
});

describe("F5 — share mirror restitution", () => {
  it("a fact shared onto scope:proj is restituted and bookmarked there", () => {
    const { osem, db } = makeOsem();
    osem.registerMemo({ id: "F5:shared", ...MEMO,
      body: "quasar routing protocol uses hierarchical link state" });
    osem.recallLexical({ agentId: "alpha", prompt: "quasar routing",
                         share: "scope:proj" });
    expect(osem.recallLexical({ agentId: "beta", prompt: "quasar routing" })
      .some(x => x.id === "F5:shared")).toBe(true);
    const n = (db.prepare(
      `SELECT COUNT(*) n FROM bookmarks WHERE scope_id='scope:proj'`)
      .get() as { n: number }).n; // CAST: get() returns unknown
    expect(n).toBeGreaterThan(0);
  });
});

describe("F6 — frequency reaches the injected payload", () => {
  it("the frequently-consulted leaf is in formatContext's leafIds", () => {
    const { osem } = makeOsem();
    osem.registerMemo({ id: "F6:doc", kind: "synthese", granularity: "doc",
      body: "field doc", title: "field", fts: false });
    osem.registerMemo({ id: "F6:warm", ...MEMO,
      body: "tundra cache eviction uses segmented lru queues",
      derivesFrom: "F6:doc" });
    osem.registerMemo({ id: "F6:cold", ...MEMO,
      body: "tundra cache eviction uses generational arenas",
      derivesFrom: "F6:doc" });
    for (let i = 0; i < 5; i++)
      osem.recallLexical({ agentId: "f6", prompt: "tundra segmented lru" });
    const ctx = osem.formatContext({ agentId: "f6" });
    expect(ctx.text.length).toBeGreaterThan(0);
    expect(ctx.leafIds).toContain("F6:warm");
  });
});

describe("F7 — real-doc retrieval (registerDoc over markdown fixtures)", () => {
  it("answers queries whose ground truth lives in a specific doc", () => {
    const { osem, db } = makeOsem();
    osem.registerDoc(join(import.meta.dirname, "fixtures"));
    osem.maintain();
    const n = (db.prepare(`SELECT COUNT(*) n FROM atoms`)
      .get() as { n: number }).n; // CAST: get() returns unknown
    expect(n).toBeGreaterThan(10);
    const queries: [string, RegExp][] = [
      ["what does maranget decision tree compile", /tree|maranget|decision/i],
      ["opcode dispatch jump table", /opcode|dispatch|jump/i],
      ["serialization bytecode", /serial|bytecode|tojs/i],
    ];
    let hits = 0;
    for (const [prompt, re] of queries) {
      const r = osem.recallLexical({ agentId: "f7", prompt });
      if (r.some(x => re.test(x.id))) hits++;
      else if (osem.formatContext({ agentId: "f7" })
               .leafIds.some(id => re.test(id))) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(2);
  });
});
