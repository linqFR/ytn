/**
 * Functional tests for scope inheritance and scope filtering.
 *
 * 7 test groups:
 * 1. Scope inheritance on status_history (the trigger)
 * 2. Scope inheritance via cascade
 * 3. get_updates filtered by scope
 * 4. mailbox_last_24h filtered by scope
 * 5. list_log_entries filtered by scope
 * 6. search_mailbox filtered by scope (post-FTS)
 * 7. Regression: status_history without scope
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GovDb } from "../src/driver.js";
import { initDatabase } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";
import * as write from "../src/tools/write.js";
import * as read from "../src/tools/read.js";
import type { IToolCtx } from "../src/types/types.ts";

const NANOID = "scope-nanoid-21chars_";

function setup(): { db: GovDb; ctx: IToolCtx } {
  const db = GovDb.memory();
  initDatabase(db);
  const ctx: IToolCtx = { db, queries: compileQueries(db) };
  write.registerWriter(ctx, { id: "scope-admin", role: "admin" });
  db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID, "scope-admin");
  // Create base scopes for tests
  write.createScope(ctx, { nanoid: NANOID, id: "cli", label: "CLI" });
  write.createScope(ctx, { nanoid: NANOID, id: "dna", label: "DNA" });
  write.createScope(ctx, { nanoid: NANOID, id: "qb", label: "Query Builder" });
  return { db, ctx };
}

function setupWithHierarchy(): { db: GovDb; ctx: IToolCtx } {
  const { db, ctx } = setup();
  // Create cli/dna as a child of cli (for withChildren tests)
  write.createScope(ctx, { nanoid: NANOID, id: "cli-dna", label: "CLI DNA child", parent: "cli" });
  return { db, ctx };
}

// ─── Group 1: Scope inheritance on status_history (the new trigger) ─────────

describe("scope inheritance: status_history trigger", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("decision with multi-scope → status_history inherits 2 scopes", () => {
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Multi-scope decision",
      decider: "admin", forcedNumId: 1,
      scope: ["cli", "dna"],
    });
    // Update status to trigger a new status_history row
    write.updateDecisionStatus(ctx, {
      nanoid: NANOID, id: "DEC-0001", newStatus: "Accepted",
    });

    // Find the status_history row for the status update (not the creation one)
    const historyRows = db.prepare(
      "SELECT id FROM status_history WHERE entity_type = 'decision' AND entity_id = ? AND new_status = 'Accepted'",
    ).all("DEC-0001") as { id: number }[];
    expect(historyRows).toHaveLength(1);
    const shId = String(historyRows[0].id);

    // Verify entity_scopes has 2 entries for this status_history row
    const scopeRows = ctx.queries.getEntityScopes.all({
      entity_type: "status_history", entity_id: shId,
    });
    expect(scopeRows).toHaveLength(2);
    const scopeIds = scopeRows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("action with multi-scope → status_history inherits 2 scopes", () => {
    write.createAction(ctx, {
      nanoid: NANOID, title: "Multi-scope action", forcedNumId: 1,
      scope: ["cli", "dna"],
    });
    write.updateActionStatus(ctx, {
      nanoid: NANOID, id: "ACT-0001", newStatus: "in_progress",
    });

    const historyRows = db.prepare(
      "SELECT id FROM status_history WHERE entity_type = 'action' AND entity_id = ? AND new_status = 'in_progress'",
    ).all("ACT-0001") as { id: number }[];
    expect(historyRows).toHaveLength(1);
    const shId = String(historyRows[0].id);

    const scopeRows = ctx.queries.getEntityScopes.all({
      entity_type: "status_history", entity_id: shId,
    });
    expect(scopeRows).toHaveLength(2);
    const scopeIds = scopeRows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("idea with multi-scope → status_history inherits 2 scopes", () => {
    // Create a decision first (FK target for promoted_to)
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Target decision", decider: "admin", forcedNumId: 1,
    });
    write.createIdea(ctx, {
      nanoid: NANOID, title: "Multi-scope idea", forcedNumId: 1,
      scope: ["cli", "dna"],
    });
    write.updateIdeaStatus(ctx, {
      nanoid: NANOID, id: "IDEA-0001", newStatus: "promoted",
      promotedTo: "DEC-0001",
    });

    const historyRows = db.prepare(
      "SELECT id FROM status_history WHERE entity_type = 'idea' AND entity_id = ? AND new_status = 'promoted'",
    ).all("IDEA-0001") as { id: number }[];
    expect(historyRows).toHaveLength(1);
    const shId = String(historyRows[0].id);

    const scopeRows = ctx.queries.getEntityScopes.all({
      entity_type: "status_history", entity_id: shId,
    });
    expect(scopeRows).toHaveLength(2);
    const scopeIds = scopeRows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("problem with multi-scope → status_history inherits 2 scopes", () => {
    write.createProblem(ctx, {
      nanoid: NANOID, title: "Multi-scope problem",
      severity: "HIGH", type: "code", forcedNumId: 1,
      scope: ["cli", "dna"],
    });
    write.updateProblemStatus(ctx, {
      nanoid: NANOID, id: "PB-0001", newStatus: "fixed",
      fix: "Fixed the issue",
    });

    const historyRows = db.prepare(
      "SELECT id FROM status_history WHERE entity_type = 'problem' AND entity_id = ? AND new_status = 'fixed'",
    ).all("PB-0001") as { id: number }[];
    expect(historyRows).toHaveLength(1);
    const shId = String(historyRows[0].id);

    const scopeRows = ctx.queries.getEntityScopes.all({
      entity_type: "status_history", entity_id: shId,
    });
    expect(scopeRows).toHaveLength(2);
    const scopeIds = scopeRows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("spec with multi-scope → status_history inherits 2 scopes", () => {
    write.createSpec(ctx, {
      nanoid: NANOID, id: "SPEC-test-001", filename: "test.md", version: 1,
      scope: ["cli", "dna"],
    });
    write.updateSpecStatus(ctx, {
      nanoid: NANOID, id: "SPEC-test-001", newStatus: "ready",
    });

    const historyRows = db.prepare(
      "SELECT id FROM status_history WHERE entity_type = 'spec' AND entity_id = ? AND new_status = 'ready'",
    ).all("SPEC-test-001") as { id: number }[];
    expect(historyRows).toHaveLength(1);
    const shId = String(historyRows[0].id);

    const scopeRows = ctx.queries.getEntityScopes.all({
      entity_type: "status_history", entity_id: shId,
    });
    expect(scopeRows).toHaveLength(2);
    const scopeIds = scopeRows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("single scope → status_history inherits 1 entry", () => {
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Single scope decision",
      decider: "admin", forcedNumId: 1,
      scope: "cli",
    });
    write.updateDecisionStatus(ctx, {
      nanoid: NANOID, id: "DEC-0001", newStatus: "Accepted",
    });

    const historyRows = db.prepare(
      "SELECT id FROM status_history WHERE entity_type = 'decision' AND entity_id = ? AND new_status = 'Accepted'",
    ).all("DEC-0001") as { id: number }[];
    expect(historyRows).toHaveLength(1);
    const shId = String(historyRows[0].id);

    const scopeRows = ctx.queries.getEntityScopes.all({
      entity_type: "status_history", entity_id: shId,
    });
    expect(scopeRows).toHaveLength(1);
    expect(scopeRows[0].scope_id).toBe("cli");
  });

  it("default scope (workspace, no scope provided) → status_history inherits 1 entry", () => {
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Default scope decision",
      decider: "admin", forcedNumId: 1,
      // No scope → defaults to writer's default_scope (workspace)
    });
    write.updateDecisionStatus(ctx, {
      nanoid: NANOID, id: "DEC-0001", newStatus: "Accepted",
    });

    const historyRows = db.prepare(
      "SELECT id FROM status_history WHERE entity_type = 'decision' AND entity_id = ? AND new_status = 'Accepted'",
    ).all("DEC-0001") as { id: number }[];
    expect(historyRows).toHaveLength(1);
    const shId = String(historyRows[0].id);

    const scopeRows = ctx.queries.getEntityScopes.all({
      entity_type: "status_history", entity_id: shId,
    });
    expect(scopeRows).toHaveLength(1);
    expect(scopeRows[0].scope_id).toBe("workspace");
  });
});

// ─── Group 2: Scope inheritance via cascade ─────────────────────────────────

describe("scope inheritance: cascade trigger inherits problem scopes", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("ACT done → PB partial: status_history inherits problem scopes, not action scopes", () => {
    // Create a problem with scopes ["cli"]
    write.createProblem(ctx, {
      nanoid: NANOID, title: "Scoped problem",
      severity: "HIGH", type: "code", forcedNumId: 1,
      scope: "cli",
    });

    // Create an action with scopes ["dna"] (different from problem)
    write.createAction(ctx, {
      nanoid: NANOID, title: "Scoped action", forcedNumId: 1,
      scope: "dna",
    });

    // Link problem ↔ action
    write.linkProblemAction(ctx, {
      nanoid: NANOID, problemId: "PB-0001", actionId: "ACT-0001", role: "primary",
    });

    // Mark action as done → triggers cascade: PB → partial
    write.updateActionStatus(ctx, {
      nanoid: NANOID, id: "ACT-0001", newStatus: "done",
      evidence: "Work completed",
    });

    // Verify the problem is now partial
    const pb = read.getProblem(ctx, { id: "PB-0001" });
    const pbData = pb.structuredContent as { problem: { status: string } };
    expect(pbData.problem.status).toBe("partial");

    // Find the cascade-created status_history row for the problem
    const cascadeHistory = db.prepare(
      "SELECT id FROM status_history WHERE entity_type = 'problem' AND entity_id = ? AND cascade_trigger IS NOT NULL",
    ).all("PB-0001") as { id: number }[];
    expect(cascadeHistory).toHaveLength(1);
    const shId = String(cascadeHistory[0].id);

    // The status_history row should inherit the PROBLEM's scopes (["cli"]), not the action's (["dna"])
    const scopeRows = ctx.queries.getEntityScopes.all({
      entity_type: "status_history", entity_id: shId,
    });
    expect(scopeRows).toHaveLength(1);
    expect(scopeRows[0].scope_id).toBe("cli");
  });

  it("ACT done → PB partial: multi-scope problem inherits all problem scopes", () => {
    // Create a problem with scopes ["cli", "dna"]
    write.createProblem(ctx, {
      nanoid: NANOID, title: "Multi-scope problem",
      severity: "HIGH", type: "code", forcedNumId: 1,
      scope: ["cli", "dna"],
    });

    // Create an action with a single different scope
    write.createAction(ctx, {
      nanoid: NANOID, title: "Single scope action", forcedNumId: 1,
      scope: "qb",
    });

    write.linkProblemAction(ctx, {
      nanoid: NANOID, problemId: "PB-0001", actionId: "ACT-0001", role: "primary",
    });

    write.updateActionStatus(ctx, {
      nanoid: NANOID, id: "ACT-0001", newStatus: "done",
      evidence: "Done",
    });

    const cascadeHistory = db.prepare(
      "SELECT id FROM status_history WHERE entity_type = 'problem' AND entity_id = ? AND cascade_trigger IS NOT NULL",
    ).all("PB-0001") as { id: number }[];
    expect(cascadeHistory).toHaveLength(1);
    const shId = String(cascadeHistory[0].id);

    // Should inherit both problem scopes, not the action's "qb"
    const scopeRows = ctx.queries.getEntityScopes.all({
      entity_type: "status_history", entity_id: shId,
    });
    expect(scopeRows).toHaveLength(2);
    const scopeIds = scopeRows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });
});

// ─── Group 3: get_updates filtered by scope ─────────────────────────────────

describe("scope filtering: get_updates", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setupWithHierarchy()); });
  afterEach(() => db.close());

  it("get_updates({ scope: 'cli' }) returns only cli log entries", () => {
    // Create log entries in different scopes
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "CLI update", body: "CLI scoped entry",
      scope: "cli",
    });
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "DNA update", body: "DNA scoped entry",
      scope: "dna",
    });

    const result = read.getUpdates(ctx, { nanoid: NANOID, scope: "cli" });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { entries: { subject: string }[] };
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].subject).toBe("CLI update");
  });

  it("get_updates({ scope: 'cli', withChildren: true }) returns cli + children", () => {
    // cli-dna is a child of cli
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "CLI entry", body: "cli",
      scope: "cli",
    });
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "CLI-DNA child entry", body: "cli-dna",
      scope: "cli-dna",
    });
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "DNA entry", body: "dna",
      scope: "dna",
    });

    const result = read.getUpdates(ctx, { nanoid: NANOID, scope: "cli", withChildren: true });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { entries: { subject: string }[] };
    // Should return cli + cli-dna (2 entries), not dna
    expect(data.entries).toHaveLength(2);
    const subjects = data.entries.map((e) => e.subject).sort();
    expect(subjects).toEqual(["CLI entry", "CLI-DNA child entry"]);
  });

  it("get_updates() without scope returns everything", () => {
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "CLI entry", body: "cli",
      scope: "cli",
    });
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "DNA entry", body: "dna",
      scope: "dna",
    });

    const result = read.getUpdates(ctx, { nanoid: NANOID });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { entries: { subject: string }[] };
    // Should return all entries (including auto-generated log entries from createDecision etc.)
    // At minimum, the two we explicitly created
    const subjects = data.entries.map((e) => e.subject);
    expect(subjects).toContain("CLI entry");
    expect(subjects).toContain("DNA entry");
  });
});

// ─── Group 4: mailbox_last_24h filtered by scope ────────────────────────────

describe("scope filtering: mailbox_last_24h", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setupWithHierarchy()); });
  afterEach(() => db.close());

  it("mailbox_last_24h({ scope: 'cli' }) returns only cli items", () => {
    // Create entities in different scopes (these generate log entries + entity rows)
    write.createDecision(ctx, {
      nanoid: NANOID, title: "CLI decision", decider: "admin", forcedNumId: 1,
      scope: "cli",
    });
    write.createDecision(ctx, {
      nanoid: NANOID, title: "DNA decision", decider: "admin", forcedNumId: 2,
      scope: "dna",
    });

    const result = read.mailboxLast24h(ctx, { scope: "cli" });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { timeline: { id: string; title: string }[] };
    // Should only contain the CLI decision (and its log entry)
    const titles = data.timeline.map((t) => t.title);
    expect(titles).toContain("CLI decision");
    expect(titles.some((t) => t === "DNA decision")).toBe(false);
  });

  it("mailbox_last_24h({ scope: 'cli', withChildren: true }) returns cli + children", () => {
    write.createAction(ctx, {
      nanoid: NANOID, title: "CLI action", forcedNumId: 1,
      scope: "cli",
    });
    write.createAction(ctx, {
      nanoid: NANOID, title: "CLI-DNA child action", forcedNumId: 2,
      scope: "cli-dna",
    });
    write.createAction(ctx, {
      nanoid: NANOID, title: "DNA action", forcedNumId: 3,
      scope: "dna",
    });

    const result = read.mailboxLast24h(ctx, { scope: "cli", withChildren: true });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { timeline: { id: string; title: string }[] };
    const titles = data.timeline.map((t) => t.title);
    // Should contain cli + cli-dna, not dna
    expect(titles).toContain("CLI action");
    expect(titles).toContain("CLI-DNA child action");
    expect(titles.some((t) => t === "DNA action")).toBe(false);
  });
});

// ─── Group 5: list_log_entries filtered by scope ────────────────────────────

describe("scope filtering: list_log_entries", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("list_log_entries({ scope: 'dna' }) returns only dna-scoped entries", () => {
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "DNA log", body: "dna scoped",
      scope: "dna",
    });
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "CLI log", body: "cli scoped",
      scope: "cli",
    });

    const result = read.listLogEntries(ctx, { scope: "dna" });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { entries: { subject: string }[] };
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].subject).toBe("DNA log");
  });

  it("multi-scope log entry is returned by both scope filters", () => {
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "Multi-scope log", body: "cli and dna",
      scope: ["cli", "dna"],
    });

    // Filter by cli → should find it
    const cliResult = read.listLogEntries(ctx, { scope: "cli" });
    const cliData = cliResult.structuredContent as { entries: { subject: string }[] };
    expect(cliData.entries).toHaveLength(1);
    expect(cliData.entries[0].subject).toBe("Multi-scope log");

    // Filter by dna → should also find it
    const dnaResult = read.listLogEntries(ctx, { scope: "dna" });
    const dnaData = dnaResult.structuredContent as { entries: { subject: string }[] };
    expect(dnaData.entries).toHaveLength(1);
    expect(dnaData.entries[0].subject).toBe("Multi-scope log");
  });
});

// ─── Group 6: search_mailbox filtered by scope (post-FTS) ───────────────────

describe("scope filtering: search_mailbox (post-FTS)", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setupWithHierarchy()); });
  afterEach(() => db.close());

  it("search_mailbox finds multi-scope decision when filtering by a matching scope", () => {
    write.createDecision(ctx, {
      nanoid: NANOID, title: "ZyzzFlake unique decision text",
      decider: "admin", forcedNumId: 1,
      scope: ["cli", "dna"],
      context: "ZyzzFlake context body",
    });

    // Search with scope=dna → should find it (dna is in the decision's scopes)
    const result = read.searchMailbox(ctx, {
      query: "ZyzzFlake", scope: "dna",
    });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { results: { entity_id: string }[] };
    expect(data.results).toHaveLength(1);
    expect(data.results[0].entity_id).toBe("DEC-0001");
  });

  it("search_mailbox does not find decision when filtering by non-matching scope", () => {
    write.createDecision(ctx, {
      nanoid: NANOID, title: "ZyzzFlake unique decision text",
      decider: "admin", forcedNumId: 1,
      scope: ["cli", "dna"],
      context: "ZyzzFlake context body",
    });

    // Search with scope=qb → should NOT find it (qb is not in the decision's scopes)
    const result = read.searchMailbox(ctx, {
      query: "ZyzzFlake", scope: "qb",
    });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { results: unknown[] };
    expect(data.results).toHaveLength(0);
  });

  it("search_mailbox with withChildren finds decision if its scope is a child", () => {
    // Create a decision in the cli-dna scope (child of cli)
    write.createDecision(ctx, {
      nanoid: NANOID, title: "ZyzzFlake child decision",
      decider: "admin", forcedNumId: 1,
      scope: "cli-dna",
      context: "ZyzzFlake child context",
    });

    // Search with scope=cli, withChildren=true → cli-dna is a child of cli → should find it
    const result = read.searchMailbox(ctx, {
      query: "ZyzzFlake", scope: "cli", withChildren: true,
    });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { results: { entity_id: string }[] };
    expect(data.results).toHaveLength(1);
    expect(data.results[0].entity_id).toBe("DEC-0001");
  });
});

// ─── Group 7: Regression: status_history without scope ──────────────────────

describe("regression: status_history scope rows exist", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("multi-scope decision → status update → entity_scopes contains status_history rows", () => {
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Regression test decision",
      decider: "admin", forcedNumId: 1,
      scope: ["cli", "dna"],
    });
    write.updateDecisionStatus(ctx, {
      nanoid: NANOID, id: "DEC-0001", newStatus: "Accepted",
    });

    // Get all status_history rows for this decision
    const historyRows = db.prepare(
      "SELECT id, new_status FROM status_history WHERE entity_type = 'decision' AND entity_id = ? ORDER BY id",
    ).all("DEC-0001") as { id: number; new_status: string }[];
    // There should be 2: one for creation (Proposed), one for update (Accepted)
    expect(historyRows).toHaveLength(2);

    // Each status_history row should have corresponding entity_scopes entries
    for (const h of historyRows) {
      const shId = String(h.id);
      const scopeRows = ctx.queries.getEntityScopes.all({
        entity_type: "status_history", entity_id: shId,
      });
      expect(scopeRows).toHaveLength(2);
      const scopeIds = scopeRows.map((r) => r.scope_id).sort();
      expect(scopeIds).toEqual(["cli", "dna"]);
    }
  });

  it("entity_scopes entity_type is exactly 'status_history'", () => {
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Entity type check",
      decider: "admin", forcedNumId: 1,
      scope: ["cli", "dna"],
    });
    write.updateDecisionStatus(ctx, {
      nanoid: NANOID, id: "DEC-0001", newStatus: "Accepted",
    });

    // Verify entity_scopes has rows with entity_type='status_history'
    const shScopeRows = db.prepare(
      "SELECT * FROM entity_scopes WHERE entity_type = 'status_history' ORDER BY entity_id, scope_id",
    ).all() as { entity_type: string; entity_id: string; scope_id: string }[];
    // Should have 4 rows total (2 status_history rows × 2 scopes each)
    expect(shScopeRows).toHaveLength(4);
    for (const row of shScopeRows) {
      expect(row.entity_type).toBe("status_history");
    }

    // Verify the status_history IDs match
    const historyIds = db.prepare(
      "SELECT id FROM status_history WHERE entity_type = 'decision' AND entity_id = ?",
    ).all("DEC-0001") as { id: number }[];
    const historyIdStrings = historyIds.map((h) => String(h.id));
    const scopeEntityIds = [...new Set(shScopeRows.map((r) => r.entity_id))];
    for (const eid of scopeEntityIds) {
      expect(historyIdStrings).toContain(eid);
    }
  });
});
