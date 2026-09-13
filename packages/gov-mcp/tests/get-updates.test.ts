/**
 * Tests for get_updates modes and mailbox_last_24h filters.
 *
 * Split from integration.test.ts — these tests share a common setup
 * (1 writer + 5 log entries) and focus on cursor + filter behavior.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GovDb, resolveReportsDir } from "../src/server/driver.js";
import { currentDate, currentTimestamp } from "../src/server/helpers.js";
import { initDatabase } from "../src/server/init.js";
import { compileQueries } from "../src/server/queries/index.js";

describe("get_updates, mailbox_last_24h, and spec status", () => {
  let db: GovDb;

  beforeEach(() => {
    db = GovDb.memory();
    initDatabase(db);
    db.prepare(
      "INSERT INTO writers (id, nanoid, role, default_scope, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("devin-cli", "test-nanoid-12345678901", "agent", "workspace", currentTimestamp());
    // Insert some log entries
    for (let i = 0; i < 5; i++) {
      db.prepare(
        "INSERT INTO log_entries (date, timestamp, type, author, audience, subject) VALUES (?, ?, 'status', ?, 'all', ?)",
      ).run(currentDate(), currentTimestamp(), "devin-dna", `Entry ${i + 1}`);
    }
  });

  afterEach(() => {
    db.close();
  });

  it("returns entries and advances cursor", () => {
    const queries = compileQueries(db);
    const writer = queries.getWriterByNanoid.get({ nanoid: "test-nanoid-12345678901" });
    expect(writer!.last_read_at).toBe("1970-01-01T00:00:00.000Z");

    const rows = db.prepare("SELECT * FROM log_entries WHERE timestamp > ? ORDER BY timestamp ASC LIMIT ?")
      .all("1970-01-01T00:00:00.000Z", 50);
    expect(rows).toHaveLength(5);

    // Advance cursor
    queries.updateWriterCursor.run({ last_read_at: new Date().toISOString(), nanoid: "test-nanoid-12345678901" });

    const updated = queries.getWriterByNanoid.get({ nanoid: "test-nanoid-12345678901" });
    expect(updated!.last_read_at).not.toBeNull();
  });

  it("whoami returns the writer profile", async () => {
    const write = await import("../src/server/tools/write.js");
    const read = await import("../src/server/tools/read.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const regResult = write.registerWriter(ctx, {
      id: "agent-x",
      role: "agent",
      responsibility: "frontend",
      objective: "ship UI",
      expertise: "React, CSS",
      prohibitions: "no backend changes",
    });
    expect(regResult.isError).toBe(false);
    const nanoid = regResult.structuredContent?.nanoid as string;
    const result = read.whoami(ctx, { nanoid });
    expect(result.isError).toBe(false);
    const writer = result.structuredContent?.writer as Record<string, unknown>;
    expect(writer!.id).toBe("agent-x");
    expect(writer!.role).toBe("agent");
    expect(writer!.responsibility).toBe("frontend");
    expect(writer!.objective).toBe("ship UI");
    expect(writer!.expertise).toBe("React, CSS");
    expect(writer!.prohibitions).toBe("no backend changes");
  });

  it("get_updates with lastN returns N most recent entries (DESC) and advances cursor to now", async () => {
    const read = await import("../src/server/tools/read.js");
    const write = await import("../src/server/tools/write.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    // Register a writer to get a valid nanoid
    const regResult = write.registerWriter(ctx, { id: "test-agent-last", role: "agent" });
    const nanoid = regResult.structuredContent?.nanoid as string;
    const result = read.getUpdates(ctx, { nanoid, lastN: 3 });
    expect(result.isError).toBe(false);
    const data = result.structuredContent as { entries: { id: number }[]; new_cursor: string; has_more: boolean; remaining: number };
    expect(data.entries).toHaveLength(3);
    // DESC order: most recent first
    expect(data.entries[0].id).toBeGreaterThan(data.entries[1].id);
    // new_cursor is now an ISO timestamp (date of reading)
    expect(typeof data.new_cursor).toBe("string");
    // has_more is true (2 older entries exist)
    expect(data.has_more).toBe(true);
    // Cursor in DB should be updated to now (not epoch)
    const writer = queries.getWriterByNanoid.get({ nanoid });
    expect(writer!.last_read_at).not.toBe("1970-01-01T00:00:00.000Z");
  });

  it("get_updates with markAllRead sets cursor to now without returning entries", async () => {
    const read = await import("../src/server/tools/read.js");
    const write = await import("../src/server/tools/write.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const regResult = write.registerWriter(ctx, { id: "test-agent-reset", role: "agent" });
    const nanoid = regResult.structuredContent?.nanoid as string;
    const result = read.getUpdates(ctx, { nanoid, markAllRead: true });
    expect(result.isError).toBe(false);
    const data = result.structuredContent as { entries: unknown[]; new_cursor: string; has_more: boolean; remaining: number };
    expect(data.entries).toHaveLength(0);
    expect(data.has_more).toBe(false);
    expect(data.remaining).toBe(0);
    // new_cursor is an ISO timestamp (date of reading)
    expect(typeof data.new_cursor).toBe("string");
    // Verify cursor was actually updated in DB to now (not epoch)
    const writer = queries.getWriterByNanoid.get({ nanoid });
    expect(writer!.last_read_at).not.toBe("1970-01-01T00:00:00.000Z");
  });

  it("get_updates with markAllRead + peek does NOT advance cursor", async () => {
    const read = await import("../src/server/tools/read.js");
    const write = await import("../src/server/tools/write.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const regResult = write.registerWriter(ctx, { id: "test-agent-reset-peek", role: "agent" });
    const nanoid = regResult.structuredContent?.nanoid as string;
    const cursorBefore = queries.getWriterByNanoid.get({ nanoid })!.last_read_at;
    const result = read.getUpdates(ctx, { nanoid, markAllRead: true, peek: true });
    expect(result.isError).toBe(false);
    // Cursor must NOT have been advanced
    const writerAfter = queries.getWriterByNanoid.get({ nanoid });
    expect(writerAfter!.last_read_at).toBe(cursorBefore);
  });

  it("get_updates with peek returns entries WITHOUT advancing the cursor", async () => {
    const read = await import("../src/server/tools/read.js");
    const write = await import("../src/server/tools/write.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const regResult = write.registerWriter(ctx, { id: "test-agent-peek", role: "agent" });
    const nanoid = regResult.structuredContent?.nanoid as string;
    // Cursor starts at epoch
    const writerBefore = queries.getWriterByNanoid.get({ nanoid });
    const cursorBefore = writerBefore!.last_read_at;
    // Peek — should return entries but NOT advance cursor
    const result = read.getUpdates(ctx, { nanoid, peek: true });
    expect(result.isError).toBe(false);
    const data = result.structuredContent as { entries: { id: number }[]; new_cursor: string };
    expect(data.entries.length).toBeGreaterThan(0);
    // Cursor must NOT have been advanced
    const writerAfter = queries.getWriterByNanoid.get({ nanoid });
    expect(writerAfter!.last_read_at).toBe(cursorBefore);
    // A second normal get_updates should return the same entries (cursor still at epoch)
    const result2 = read.getUpdates(ctx, { nanoid });
    const data2 = result2.structuredContent as { entries: { id: number }[] };
    expect(data2.entries.length).toBe(data.entries.length);
    // After the normal call, cursor should now be advanced to now
    const writerAfter2 = queries.getWriterByNanoid.get({ nanoid });
    expect(writerAfter2!.last_read_at).not.toBe(cursorBefore);
  });

  it("list_entries with nanoid advances the writer's read cursor to now", async () => {
    const read = await import("../src/server/tools/read.js");
    const write = await import("../src/server/tools/write.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const regResult = write.registerWriter(ctx, { id: "test-agent-list", role: "agent" });
    const nanoid = regResult.structuredContent?.nanoid as string;
    const cursorBefore = queries.getWriterByNanoid.get({ nanoid })!.last_read_at;
    expect(cursorBefore).toBe("1970-01-01T00:00:00.000Z");
    const result = read.listLogEntries(ctx, { nanoid });
    expect(result.isError).toBe(false);
    // Cursor should be advanced to now
    const writerAfter = queries.getWriterByNanoid.get({ nanoid });
    expect(writerAfter!.last_read_at).not.toBe("1970-01-01T00:00:00.000Z");
  });

  it("list_entries with nanoid + peek does NOT advance the cursor", async () => {
    const read = await import("../src/server/tools/read.js");
    const write = await import("../src/server/tools/write.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const regResult = write.registerWriter(ctx, { id: "test-agent-list-peek", role: "agent" });
    const nanoid = regResult.structuredContent?.nanoid as string;
    const cursorBefore = queries.getWriterByNanoid.get({ nanoid })!.last_read_at;
    const result = read.listLogEntries(ctx, { nanoid, peek: true });
    expect(result.isError).toBe(false);
    // Cursor must NOT have been advanced
    const writerAfter = queries.getWriterByNanoid.get({ nanoid });
    expect(writerAfter!.last_read_at).toBe(cursorBefore);
  });

  it("list_entries without nanoid does NOT touch any cursor", async () => {
    const read = await import("../src/server/tools/read.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const result = read.listLogEntries(ctx, {});
    expect(result.isError).toBe(false);
    const data = result.structuredContent as { count: number };
    expect(data.count).toBe(5);
  });

  it("get_updates default mode returns entries in DESC order (most recent first)", async () => {
    const read = await import("../src/server/tools/read.js");
    const write = await import("../src/server/tools/write.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const regResult = write.registerWriter(ctx, { id: "test-agent-default", role: "agent" });
    const nanoid = regResult.structuredContent?.nanoid as string;
    // Default mode: DESC (most recent first)
    const result = read.getUpdates(ctx, { nanoid });
    expect(result.isError).toBe(false);
    const data = result.structuredContent as { entries: { id: number }[]; new_cursor: string };
    expect(data.entries).toHaveLength(5);
    // DESC order: most recent first
    expect(data.entries[0].id).toBeGreaterThan(data.entries[4].id);
    // new_cursor is an ISO timestamp
    expect(typeof data.new_cursor).toBe("string");
  });

  it("mailbox_last_24h with type filter returns only matching entity type", async () => {
    const read = await import("../src/server/tools/read.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    // The 5 log entries are all type "status" — filter by type "log_entry" should still work
    // since mailbox_last_24h UNIONs all tables. With only log_entries populated, type "log_entry"
    // returns all 5, type "decision" returns 0.
    const resultLog = read.mailboxLast24h(ctx, { type: "log_entry" });
    expect(resultLog.isError).toBe(false);
    const dataLog = resultLog.structuredContent as { timeline: { type: string }[]; count: number };
    expect(dataLog.count).toBe(5);
    expect(dataLog.timeline.every((r) => r.type === "log_entry")).toBe(true);

    const resultDecision = read.mailboxLast24h(ctx, { type: "decision" });
    expect(resultDecision.isError).toBe(false);
    const dataDecision = resultDecision.structuredContent as { count: number };
    expect(dataDecision.count).toBe(0);
  });

  it("mailbox_last_24h with limit returns at most N items", async () => {
    const read = await import("../src/server/tools/read.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const result = read.mailboxLast24h(ctx, { limit: 2 });
    expect(result.isError).toBe(false);
    const data = result.structuredContent as { timeline: unknown[]; count: number };
    expect(data.count).toBe(2);
    expect(data.timeline).toHaveLength(2);
  });

  it("mailbox_last_24h with type + limit combines both filters in SQL", async () => {
    const read = await import("../src/server/tools/read.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const result = read.mailboxLast24h(ctx, { type: "log_entry", limit: 3 });
    expect(result.isError).toBe(false);
    const data = result.structuredContent as { timeline: { type: string }[]; count: number };
    expect(data.count).toBe(3);
    expect(data.timeline.every((r) => r.type === "log_entry")).toBe(true);
  });

  it("mailbox_last_24h without type/limit returns all (backward compat)", async () => {
    const read = await import("../src/server/tools/read.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const result = read.mailboxLast24h(ctx, {});
    expect(result.isError).toBe(false);
    const data = result.structuredContent as { count: number };
    expect(data.count).toBe(5);
  });

  it("update_spec_status accepts optional reason and stores it in status_history", async () => {
    const write = await import("../src/server/tools/write.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    // Create a spec first
    const regResult = write.registerWriter(ctx, { id: "test-agent-spec", role: "agent" });
    const nanoid = regResult.structuredContent?.nanoid as string;
    const specResult = write.createSpec(ctx, {
      nanoid,
      id: "SPEC-0001",
      filename: "test-spec-reason.md",
      version: 1,
      scope: ["workspace"],
    });
    expect(specResult.isError).toBe(false);
    const specId = specResult.structuredContent?.id as string;

    // Update with reason
    const updateResult = write.updateSpecStatus(ctx, {
      nanoid,
      id: specId,
      newStatus: "ready",
      reason: "Spec reviewed and validated",
    });
    expect(updateResult.isError).toBe(false);

    // Verify reason is stored in status_history
    const history = db.prepare(
      "SELECT reason FROM status_history WHERE entity_type = 'spec' AND entity_id = ? ORDER BY changed_at DESC LIMIT 1",
    ).get(specId) as { reason: string | null };
    expect(history.reason).toBe("Spec reviewed and validated");
  });

  it("whoami rejects unknown nanoid", async () => {
    const read = await import("../src/server/tools/read.js");
    const queries = compileQueries(db);
    const ctx = { db, queries, reportsDir: resolveReportsDir() };
    const result = read.whoami(ctx, { nanoid: "nonexistent-nanoid-xx" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Writer not found");
  });
});
