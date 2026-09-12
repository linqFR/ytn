/**
 * Tests for get_updates scope/audience filtering.
 *
 * Verifies that get_updates returns:
 * - entries with audience="all" (broadcast)
 * - entries where audience contains the writer's id (direct address)
 * - entries authored by writers sharing the caller's default_scope
 * - excludes entries authored by writers in other scopes with audience="all" being the exception
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GovDb } from "../src/driver.js";
import { currentDate, currentTimestamp } from "../src/helpers.js";
import { initDatabase } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";
import * as write from "../src/tools/write.js";
import * as read from "../src/tools/read.js";
import type { IToolCtx } from "../src/types/types.ts";

const NANOID_A = "aud-nanoid-aaaaaaaaaa";
const NANOID_B = "aud-nanoid-bbbbbbbbbb";
const NANOID_C = "aud-nanoid-cccccccccc";

function setup(): { db: GovDb; ctx: IToolCtx } {
  const db = GovDb.memory();
  initDatabase(db);
  const ctx: IToolCtx = { db, queries: compileQueries(db) };
  // Create scopes directly (FK constraint on writers.default_scope)
  db.prepare("INSERT INTO scopes (id, label, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run("cli", "CLI", currentTimestamp(), currentTimestamp());
  db.prepare("INSERT INTO scopes (id, label, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run("dna", "DNA", currentTimestamp(), currentTimestamp());
  // Writer A — scope "cli"
  write.registerWriter(ctx, { id: "writer-a", role: "agent", defaultScope: "cli" });
  db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID_A, "writer-a");
  // Writer B — scope "cli" (same scope as A)
  write.registerWriter(ctx, { id: "writer-b", role: "agent", defaultScope: "cli" });
  db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID_B, "writer-b");
  // Writer C — scope "dna" (different scope)
  write.registerWriter(ctx, { id: "writer-c", role: "agent", defaultScope: "dna" });
  db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID_C, "writer-c");
  return { db, ctx };
}

function insertLogEntry(
  db: GovDb,
  opts: { author: string; audience: string; subject: string },
) {
  db.prepare(
    "INSERT INTO log_entries (date, timestamp, type, author, audience, subject) VALUES (?, ?, 'status', ?, ?, ?)",
  ).run(currentDate(), currentTimestamp(), opts.author, opts.audience, opts.subject);
}

describe("get_updates scope/audience filtering", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => {
    ({ db, ctx } = setup());
  });

  afterEach(() => {
    db.close();
  });

  it("returns entries with audience='all' (broadcast)", () => {
    insertLogEntry(db, { author: "writer-c", audience: "all", subject: "broadcast from C" });

    const result = read.getUpdates(ctx, { nanoid: NANOID_A });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { entries: { subject: string }[] };
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].subject).toBe("broadcast from C");
  });

  it("returns entries where audience contains the writer's id (direct address)", () => {
    insertLogEntry(db, { author: "writer-c", audience: "writer-a", subject: "direct to A" });
    insertLogEntry(db, { author: "writer-c", audience: "writer-b", subject: "direct to B" });

    const result = read.getUpdates(ctx, { nanoid: NANOID_A });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { entries: { subject: string }[] };
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].subject).toBe("direct to A");
  });

  it("returns entries authored by writers sharing the caller's scope", () => {
    // Writer B is in the same scope (cli) as Writer A
    insertLogEntry(db, { author: "writer-b", audience: "writer-b", subject: "from B (same scope)" });
    // Writer C is in a different scope (dna)
    insertLogEntry(db, { author: "writer-c", audience: "writer-c", subject: "from C (other scope)" });

    const result = read.getUpdates(ctx, { nanoid: NANOID_A });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { entries: { subject: string }[] };
    // Should get B's entry (same scope author) but not C's (different scope, audience not "all", not containing A)
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].subject).toBe("from B (same scope)");
  });

  it("returns entries with multiple writers in audience (comma-separated)", () => {
    insertLogEntry(db, { author: "writer-c", audience: "writer-a,writer-b", subject: "to A and B" });

    const result = read.getUpdates(ctx, { nanoid: NANOID_A });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { entries: { subject: string }[] };
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].subject).toBe("to A and B");
  });

  it("excludes entries addressed to other writers only", () => {
    insertLogEntry(db, { author: "writer-c", audience: "writer-b", subject: "only to B" });

    const result = read.getUpdates(ctx, { nanoid: NANOID_A });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { entries: { subject: string }[] };
    expect(data.entries).toHaveLength(0);
  });

  it("combines all three filters: broadcast + direct + same-scope author", () => {
    insertLogEntry(db, { author: "writer-c", audience: "all", subject: "broadcast" });
    insertLogEntry(db, { author: "writer-c", audience: "writer-a", subject: "direct to A" });
    insertLogEntry(db, { author: "writer-b", audience: "writer-b", subject: "same-scope author" });
    insertLogEntry(db, { author: "writer-c", audience: "writer-b", subject: "not for A" });

    const result = read.getUpdates(ctx, { nanoid: NANOID_A });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { entries: { subject: string }[] };
    expect(data.entries).toHaveLength(3);
    const subjects = data.entries.map((e) => e.subject).sort();
    expect(subjects).toEqual(["broadcast", "direct to A", "same-scope author"]);
  });
});

describe("write tools audience parameter", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => {
    ({ db, ctx } = setup());
  });

  afterEach(() => {
    db.close();
  });

  it("createDecision with audience='writer-a' stores it in log_entry", () => {
    const result = write.createDecision(ctx, {
      nanoid: NANOID_B,
      title: "Decision for A",
      decider: "writer-b",
      audience: "writer-a",
    });
    expect(result.isError).toBeFalsy();

    const logRow = db.prepare(
      "SELECT audience FROM log_entries WHERE type = 'decision' AND author = ? ORDER BY id DESC LIMIT 1",
    ).get("writer-b") as { audience: string };
    expect(logRow.audience).toBe("writer-a");
  });

  it("createDecision without audience defaults to 'all'", () => {
    const result = write.createDecision(ctx, {
      nanoid: NANOID_B,
      title: "Decision for all",
      decider: "writer-b",
    });
    expect(result.isError).toBeFalsy();

    const logRow = db.prepare(
      "SELECT audience FROM log_entries WHERE type = 'decision' AND author = ? ORDER BY id DESC LIMIT 1",
    ).get("writer-b") as { audience: string };
    expect(logRow.audience).toBe("all");
  });

  it("createAction with audience stores it in log_entry", () => {
    const result = write.createAction(ctx, {
      nanoid: NANOID_C,
      title: "Action for A and B",
      audience: "writer-a,writer-b",
    });
    expect(result.isError).toBeFalsy();

    const logRow = db.prepare(
      "SELECT audience FROM log_entries WHERE type = 'action' AND author = ? ORDER BY id DESC LIMIT 1",
    ).get("writer-c") as { audience: string };
    expect(logRow.audience).toBe("writer-a,writer-b");
  });

  it("createIdea with audience stores it in log_entry", () => {
    const result = write.createIdea(ctx, {
      nanoid: NANOID_B,
      title: "Idea for A",
      audience: "writer-a",
    });
    expect(result.isError).toBeFalsy();

    const logRow = db.prepare(
      "SELECT audience FROM log_entries WHERE type = 'idea' AND author = ? ORDER BY id DESC LIMIT 1",
    ).get("writer-b") as { audience: string };
    expect(logRow.audience).toBe("writer-a");
  });

  it("createProblem with audience stores it in log_entry", () => {
    const result = write.createProblem(ctx, {
      nanoid: NANOID_C,
      title: "Problem for A",
      severity: "HIGH",
      type: "code",
      audience: "writer-a",
    });
    expect(result.isError).toBeFalsy();

    const logRow = db.prepare(
      "SELECT audience FROM log_entries WHERE type = 'pb' AND author = ? ORDER BY id DESC LIMIT 1",
    ).get("writer-c") as { audience: string };
    expect(logRow.audience).toBe("writer-a");
  });

  it("correct with audience stores it in log_entry", () => {
    // First create a decision to correct
    write.createDecision(ctx, {
      nanoid: NANOID_B,
      title: "Decision to correct",
      decider: "writer-b",
    });
    const decId = db.prepare(
      "SELECT ref_id FROM log_entries WHERE type = 'decision' ORDER BY id DESC LIMIT 1",
    ).get() as { ref_id: string };

    const result = write.correct(ctx, {
      nanoid: NANOID_C,
      entityType: "decision",
      entityId: decId.ref_id,
      field: "title",
      newValue: "Corrected title",
      reason: "typo",
      audience: "writer-a",
    });
    expect(result.isError).toBeFalsy();

    const logRow = db.prepare(
      "SELECT audience FROM log_entries WHERE type = 'correction' AND author = ? ORDER BY id DESC LIMIT 1",
    ).get("writer-c") as { audience: string };
    expect(logRow.audience).toBe("writer-a");
  });
});
