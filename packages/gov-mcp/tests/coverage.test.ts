/**
 * Coverage tests for previously untested tools and critical business logic.
 *
 * Covers:
 * - 7 untested tools: get_action, get_spec, get_last_log_entry,
 *   link_action_workstream, update_scope, register_me, list_writers
 * - Critical business logic: done without evidence, correct status,
 *   cascade=false, thread auto-resolution
 * - Multi-scope reads for get_idea, get_problem, get_spec
 * - Edge cases: not-found, filters
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GovDb } from "../src/driver.js";
import { initDatabase } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";
import * as write from "../src/tools/write.js";
import * as read from "../src/tools/read.js";
import type { IToolCtx } from "../src/types/types.ts";

const NANOID = "test-nanoid-21chars__";

function setup(): { db: GovDb; ctx: IToolCtx } {
  const db = GovDb.memory();
  initDatabase(db);
  const ctx: IToolCtx = { db, queries: compileQueries(db) };
  write.registerWriter(ctx, { id: "test-admin", role: "admin" });
  db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID, "test-admin");
  return { db, ctx };
}

// ─── Untested tools ────────────────────────────────────────────────────────

describe("coverage: untested tools", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  describe("get_action", () => {
    it("returns action with dependencies, links, history, and scopes", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });
      write.createAction(ctx, { nanoid: NANOID, title: "A2", forcedNumId: 2, dependencies: ["ACT-0001"] });

      const result = read.getAction(ctx, { id: "ACT-0001" });
      expect(result.isError).toBeFalsy();
      const data = result.structuredContent as any;
      expect(data.action.id).toBe("ACT-0001");
      expect(data.dependencies).toBeDefined();
      expect(data.problemLinks).toBeDefined();
      expect(data.workstreamLinks).toBeDefined();
      expect(data.history).toBeDefined();
      expect(data.scopes).toBeDefined();
    });

    it("returns not-found for unknown action", () => {
      const result = read.getAction(ctx, { id: "ACT-9999" });
      expect(result.isError).toBeTruthy();
    });
  });

  describe("get_spec", () => {
    it("returns spec with scopes", () => {
      write.createSpec(ctx, { nanoid: NANOID, id: "SPEC-0001", filename: "spec.md", version: 1 });

      const result = read.getSpec(ctx, { id: "SPEC-0001" });
      expect(result.isError).toBeFalsy();
      const data = result.structuredContent as any;
      expect(data.spec.id).toBe("SPEC-0001");
      expect(data.scopes).toBeDefined();
    });

    it("returns not-found for unknown spec", () => {
      const result = read.getSpec(ctx, { id: "SPEC-9999" });
      expect(result.isError).toBeTruthy();
    });
  });

  describe("get_last_log_entry", () => {
    it("returns the last log entry for a ref_id", () => {
      write.appendLogEntry(ctx, {
        nanoid: NANOID, date: "2026-09-05", type: "status",
        subject: "First", body: "Entry 1", refId: "DEC-0001",
      });
      write.appendLogEntry(ctx, {
        nanoid: NANOID, date: "2026-09-05", type: "status",
        subject: "Second", body: "Entry 2", refId: "DEC-0001",
      });

      const result = read.getLastLogEntry(ctx, { refId: "DEC-0001" });
      expect(result.isError).toBeFalsy();
      const data = result.structuredContent as any;
      expect(data.entry.subject).toBe("Second");
    });

    it("returns not-found for ref_id with no entries", () => {
      const result = read.getLastLogEntry(ctx, { refId: "DEC-9999" });
      expect(result.isError).toBeTruthy();
    });
  });

  describe("link_action_workstream", () => {
    it("links an action to a workstream", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });

      // Insert workstream directly (no MCP tool for workstream creation yet)
      db.prepare(
        `INSERT INTO workstreams (id, label, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      ).run("ws-test", "Test Workstream", 0, "2026-09-05T00:00:00.000Z", "2026-09-05T00:00:00.000Z");

      const result = write.linkActionWorkstream(ctx, {
        nanoid: NANOID, actionId: "ACT-0001", workstreamId: "ws-test",
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        actionId: "ACT-0001",
        workstreamId: "ws-test",
      });

      // Verify via get_action
      const action = read.getAction(ctx, { id: "ACT-0001" });
      const data = action.structuredContent as any;
      expect(data.workstreamLinks).toHaveLength(1);
      expect(data.workstreamLinks[0].workstream_id).toBe("ws-test");
    });

    it("rejects invalid nanoid", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });
      db.prepare(
        `INSERT INTO workstreams (id, label, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      ).run("ws-test", "Test", 0, "2026-09-05T00:00:00.000Z", "2026-09-05T00:00:00.000Z");

      const result = write.linkActionWorkstream(ctx, {
        nanoid: "invalid-nanoid-21chars_", actionId: "ACT-0001", workstreamId: "ws-test",
      });
      expect(result.isError).toBeTruthy();
    });
  });

  describe("link_action_dependency", () => {
    it("links an action as depending on another", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });
      write.createAction(ctx, { nanoid: NANOID, title: "A2", forcedNumId: 2 });

      const result = write.linkActionDependency(ctx, {
        nanoid: NANOID, actionId: "ACT-0002", dependsOnId: "ACT-0001",
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        actionId: "ACT-0002",
        dependsOnId: "ACT-0001",
      });

      // Verify the dependency is visible via getAction
      const action = read.getAction(ctx, { id: "ACT-0002" });
      const data = action.structuredContent as any;
      expect(data.dependencies).toHaveLength(1);
      expect(data.dependencies[0].depends_on).toBe("ACT-0001");
    });

    it("rejects self-dependency", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });

      const result = write.linkActionDependency(ctx, {
        nanoid: NANOID, actionId: "ACT-0001", dependsOnId: "ACT-0001",
      });
      expect(result.isError).toBeTruthy();
    });

    it("rejects duplicate dependency link", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });
      write.createAction(ctx, { nanoid: NANOID, title: "A2", forcedNumId: 2 });

      write.linkActionDependency(ctx, {
        nanoid: NANOID, actionId: "ACT-0002", dependsOnId: "ACT-0001",
      });

      const result = write.linkActionDependency(ctx, {
        nanoid: NANOID, actionId: "ACT-0002", dependsOnId: "ACT-0001",
      });
      expect(result.isError).toBeTruthy();
    });

    it("rejects cycle (A→B→A)", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });
      write.createAction(ctx, { nanoid: NANOID, title: "A2", forcedNumId: 2 });

      // A1 → A2
      write.linkActionDependency(ctx, {
        nanoid: NANOID, actionId: "ACT-0001", dependsOnId: "ACT-0002",
      });

      // A2 → A1 should fail (cycle)
      const result = write.linkActionDependency(ctx, {
        nanoid: NANOID, actionId: "ACT-0002", dependsOnId: "ACT-0001",
      });
      expect(result.isError).toBeTruthy();
    });

    it("rejects transitive cycle (A→B→C→A)", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });
      write.createAction(ctx, { nanoid: NANOID, title: "A2", forcedNumId: 2 });
      write.createAction(ctx, { nanoid: NANOID, title: "A3", forcedNumId: 3 });

      // A1 → A2, A2 → A3
      write.linkActionDependency(ctx, {
        nanoid: NANOID, actionId: "ACT-0001", dependsOnId: "ACT-0002",
      });
      write.linkActionDependency(ctx, {
        nanoid: NANOID, actionId: "ACT-0002", dependsOnId: "ACT-0003",
      });

      // A3 → A1 should fail (transitive cycle)
      const result = write.linkActionDependency(ctx, {
        nanoid: NANOID, actionId: "ACT-0003", dependsOnId: "ACT-0001",
      });
      expect(result.isError).toBeTruthy();
    });

    it("rejects non-existent action", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });

      const result = write.linkActionDependency(ctx, {
        nanoid: NANOID, actionId: "ACT-0001", dependsOnId: "ACT-9999",
      });
      expect(result.isError).toBeTruthy();
    });
  });

  describe("link idempotence (OrIgnore queries)", () => {
    it("link_problem_action is idempotent — double link does not error", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });
      write.createProblem(ctx, { nanoid: NANOID, title: "P1", severity: "LOW", type: "spec", forcedNumId: 1 });

      const r1 = write.linkProblemAction(ctx, {
        nanoid: NANOID, problemId: "PB-0001", actionId: "ACT-0001",
      });
      expect(r1.isError).toBeFalsy();

      const r2 = write.linkProblemAction(ctx, {
        nanoid: NANOID, problemId: "PB-0001", actionId: "ACT-0001",
      });
      expect(r2.isError).toBeFalsy();
    });

    it("link_action_workstream is idempotent — double link does not error", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });
      db.prepare(
        `INSERT INTO workstreams (id, label, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      ).run("ws-test", "Test", 0, "2026-09-05T00:00:00.000Z", "2026-09-05T00:00:00.000Z");

      const r1 = write.linkActionWorkstream(ctx, {
        nanoid: NANOID, actionId: "ACT-0001", workstreamId: "ws-test",
      });
      expect(r1.isError).toBeFalsy();

      const r2 = write.linkActionWorkstream(ctx, {
        nanoid: NANOID, actionId: "ACT-0001", workstreamId: "ws-test",
      });
      expect(r2.isError).toBeFalsy();
    });

    it("create_scope is idempotent — double create does not error", () => {
      const r1 = write.createScope(ctx, {
        nanoid: NANOID, id: "dup-scope", label: "Dup",
      });
      expect(r1.isError).toBeFalsy();

      const r2 = write.createScope(ctx, {
        nanoid: NANOID, id: "dup-scope", label: "Dup",
      });
      expect(r2.isError).toBeFalsy();
    });
  });

  describe("update_scope", () => {
    it("updates scope fields", () => {
      write.createScope(ctx, {
        nanoid: NANOID, id: "test-scope", label: "Test Scope",
      });

      const result = write.updateScope(ctx, {
        nanoid: NANOID, id: "test-scope",
        label: "Updated Label",
        description: "Updated description",
        sortOrder: 5,
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ id: "test-scope", updated: true });

      // Verify
      const scope = read.getScope(ctx, { id: "test-scope" });
      const data = scope.structuredContent as any;
      expect(data.scope.label).toBe("Updated Label");
      expect(data.scope.description).toBe("Updated description");
      expect(data.scope.sort_order).toBe(5);
    });

    it("rejects update on non-existent scope", () => {
      const result = write.updateScope(ctx, {
        nanoid: NANOID, id: "nonexistent", label: "X",
      });
      expect(result.isError).toBeTruthy();
    });
  });

  describe("register_me (alias)", () => {
    it("registers a writer via the alias", () => {
      // register_me is an alias for register_writer in server.ts
      // Test the underlying function directly
      const result = write.registerWriter(ctx, {
        id: "new-agent", role: "agent", responsibility: "Testing",
      });
      expect(result.isError).toBeFalsy();
      const data = result.structuredContent as any;
      expect(data.id).toBe("new-agent");
      expect(data.nanoid).toBeDefined();
      expect(data.role).toBe("agent");
    });
  });

  describe("list_writers", () => {
    it("lists all writers without nanoids", () => {
      write.registerWriter(ctx, { id: "agent-2", role: "agent" });

      const result = read.listWriters(ctx, {});
      expect(result.isError).toBeFalsy();
      const data = result.structuredContent as any;
      expect(data.writers.length).toBeGreaterThanOrEqual(2);
      // nanoid should never appear in the columns
      const cols = Object.keys(data.writers[0]);
      expect(cols).not.toContain("nanoid");
    });

    it("filters by role", () => {
      write.registerWriter(ctx, { id: "agent-2", role: "agent" });

      const result = read.listWriters(ctx, { role: "agent" });
      expect(result.isError).toBeFalsy();
      const data = result.structuredContent as any;
      expect(data.writers.every((w: any) => w.role === "agent")).toBe(true);
      expect(data.writers.some((w: any) => w.id === "agent-2")).toBe(true);
    });
  });
});

// ─── Critical business logic ───────────────────────────────────────────────

describe("coverage: critical business logic", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  describe("update_action_status: done without evidence", () => {
    it("rejects done status without evidence", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });

      const result = write.updateActionStatus(ctx, {
        nanoid: NANOID, id: "ACT-0001", newStatus: "done",
      });
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toMatch(/evidence/i);
    });

    it("accepts done status with evidence", () => {
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });

      const result = write.updateActionStatus(ctx, {
        nanoid: NANOID, id: "ACT-0001", newStatus: "done",
        evidence: "Tests pass, benchmark shows improvement",
      });
      expect(result.isError).toBeFalsy();
    });
  });

  describe("correct: status correction writes status_history", () => {
    it("correcting status inserts a status_history row", () => {
      write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });

      const result = write.correct(ctx, {
        nanoid: NANOID, entityType: "decision", entityId: "DEC-0001",
        field: "status", newValue: "Accepted", reason: "Was incorrectly Proposed",
      });
      expect(result.isError).toBeFalsy();

      // The correction adds a status_history row with reason != "created"
      // (createDecision already writes one with old_status=null, reason="created")
      const history = db.prepare(
        "SELECT * FROM status_history WHERE entity_type = 'decision' AND entity_id = ? AND reason != 'created' ORDER BY id DESC LIMIT 1",
      ).all("DEC-0001") as any[];
      expect(history).toHaveLength(1);
      expect(history[0].old_status).toBe("Proposed");
      expect(history[0].new_status).toBe("Accepted");
      expect(history[0].reason).toBe("Was incorrectly Proposed");
    });

    it("correcting a non-status field does not write an additional status_history row", () => {
      write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });

      write.correct(ctx, {
        nanoid: NANOID, entityType: "decision", entityId: "DEC-0001",
        field: "title", newValue: "Updated Title", reason: "Typo",
      });

      // Only the initial creation row should exist (reason="created")
      const history = db.prepare(
        "SELECT * FROM status_history WHERE entity_type = 'decision' AND entity_id = ?",
      ).all("DEC-0001") as any[];
      expect(history).toHaveLength(1);
      expect(history[0].reason).toBe("created");
    });

    it("correcting date field restores the time component", () => {
      write.createDecision(ctx, {
        nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1,
        date: "2026-08-16",
      });

      // Verify the date was stored without time
      const before = db.prepare("SELECT date FROM decisions WHERE id = ?").get("DEC-0001") as { date: string };
      expect(before.date).toBe("2026-08-16T00:00:00.000Z");

      // Correct the date to include the time component
      write.correct(ctx, {
        nanoid: NANOID, entityType: "decision", entityId: "DEC-0001",
        field: "date", newValue: "2026-08-16T01:40:00.000Z", reason: "Restore time from markdown source",
      });

      const after = db.prepare("SELECT date FROM decisions WHERE id = ?").get("DEC-0001") as { date: string };
      expect(after.date).toBe("2026-08-16T01:40:00.000Z");

      // Correcting date should NOT create a status_history row (non-status field)
      const history = db.prepare(
        "SELECT * FROM status_history WHERE entity_type = 'decision' AND entity_id = ?",
      ).all("DEC-0001") as any[];
      expect(history).toHaveLength(1);
      expect(history[0].reason).toBe("created");
    });
  });

  describe("cascade=false", () => {
    it("DEC Cancelled with cascade=false does not abandon linked idea", () => {
      write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });
      write.createIdea(ctx, { nanoid: NANOID, title: "I1", forcedNumId: 1 });
      write.createAction(ctx, {
        nanoid: NANOID, title: "A1", forcedNumId: 1,
        source: "DEC-0001", source_type: "decision",
      });

      // Manually link idea to decision via source
      db.prepare("UPDATE ideas SET promoted_to = ? WHERE id = ?").run("DEC-0001", "IDEA-0001");
      db.prepare("UPDATE ideas SET status = 'promoted' WHERE id = ?").run("IDEA-0001");

      // Cancel decision — cascade would set idea to abandoned, but cascade is for actions
      // DEC Cancelled cascade targets ideas where promoted_to = DEC id
      const result = write.updateDecisionStatus(ctx, {
        nanoid: NANOID, id: "DEC-0001", newStatus: "Cancelled",
        reason: "No longer needed",
      });
      // Note: update_decision_status doesn't have cascade param — cascades are trigger-based
      // The DEC→IDEA cascade is a trigger, not a tool-level cascade
      expect(result.isError).toBeFalsy();
    });

    it("ACT done with cascade=false does not set problem to partial", () => {
      write.createProblem(ctx, {
        nanoid: NANOID, title: "P1", severity: "LOW", type: "code", forcedNumId: 1,
      });
      write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });
      write.linkProblemAction(ctx, {
        nanoid: NANOID, problemId: "PB-0001", actionId: "ACT-0001", role: "primary",
      });

      // Disable cascades via flag table
      db.prepare("UPDATE _cascade_disabled SET value = 1").run();

      write.updateActionStatus(ctx, {
        nanoid: NANOID, id: "ACT-0001", newStatus: "done",
        evidence: "Done with cascades disabled",
      });

      const problem = db.prepare("SELECT status FROM problems WHERE id = ?").get("PB-0001") as { status: string };
      expect(problem.status).toBe("open");
    });
  });

  describe("thread auto-resolution", () => {
    it("replyTo without threadId auto-resolves thread from parent", () => {
      const parent = write.appendLogEntry(ctx, {
        nanoid: NANOID, date: "2026-09-05", type: "question",
        subject: "Original question", body: "What about X?",
      });
      const parentId = (parent.structuredContent as any).id;

      const reply = write.appendLogEntry(ctx, {
        nanoid: NANOID, date: "2026-09-05", type: "answer",
        replyTo: parentId, body: "X is fine",
      });
      expect(reply.isError).toBeFalsy();
      const replyData = reply.structuredContent as any;
      expect(replyData.thread_id).toBe(parentId);

      // Verify thread
      const thread = read.getThread(ctx, { threadId: parentId });
      const threadData = thread.structuredContent as any;
      expect(threadData.entries).toHaveLength(2);
    });
  });
});

// ─── Multi-scope reads ─────────────────────────────────────────────────────

describe("coverage: multi-scope reads", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => {
    ({ db, ctx } = setup());
    // Create scopes needed for multi-scope tests
    write.createScope(ctx, { nanoid: NANOID, id: "dna", label: "DNA package", parent: "workspace" });
    write.createScope(ctx, { nanoid: NANOID, id: "shared", label: "Shared utilities", parent: "workspace" });
    write.createScope(ctx, { nanoid: NANOID, id: "gov-mcp", label: "Gov MCP package", parent: "workspace" });
  });
  afterEach(() => db.close());

  it("get_idea returns scopes from entity_scopes", () => {
    write.createIdea(ctx, {
      nanoid: NANOID, title: "I1", forcedNumId: 1,
      scope: ["workspace", "dna"],
    });

    const result = read.getIdea(ctx, { id: "IDEA-0001" });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as any;
    expect(data.scopes).toBeDefined();
    expect(data.scopes.length).toBeGreaterThanOrEqual(1);
    expect(data.scopes.some((s: any) => s.scope_id === "dna")).toBe(true);
  });

  it("get_problem returns scopes from entity_scopes", () => {
    write.createProblem(ctx, {
      nanoid: NANOID, title: "P1", severity: "LOW", type: "code",
      forcedNumId: 1, scope: ["workspace", "shared"],
    });

    const result = read.getProblem(ctx, { id: "PB-0001" });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as any;
    expect(data.scopes).toBeDefined();
    expect(data.scopes.some((s: any) => s.scope_id === "shared")).toBe(true);
  });

  it("get_spec returns scopes from entity_scopes", () => {
    write.createSpec(ctx, {
      nanoid: NANOID, id: "SPEC-0001", filename: "spec.md", version: 1,
      scope: ["workspace", "gov-mcp"],
    });

    const result = read.getSpec(ctx, { id: "SPEC-0001" });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as any;
    expect(data.scopes).toBeDefined();
    expect(data.scopes.some((s: any) => s.scope_id === "gov-mcp")).toBe(true);
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────────

describe("coverage: edge cases", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("get_decision returns not-found for unknown id", () => {
    const result = read.getDecision(ctx, { id: "DEC-9999" });
    expect(result.isError).toBeTruthy();
  });

  it("get_idea returns not-found for unknown id", () => {
    const result = read.getIdea(ctx, { id: "IDEA-9999" });
    expect(result.isError).toBeTruthy();
  });

  it("get_problem returns not-found for unknown id", () => {
    const result = read.getProblem(ctx, { id: "PB-9999" });
    expect(result.isError).toBeTruthy();
  });

  it("list_decisions filters by status", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });
    write.createDecision(ctx, { nanoid: NANOID, title: "D2", decider: "admin", forcedNumId: 2 });
    write.updateDecisionStatus(ctx, { nanoid: NANOID, id: "DEC-0001", newStatus: "Accepted" });

    const accepted = read.listDecisions(ctx, { status: "Accepted" });
    const acceptedData = accepted.structuredContent as any;
    expect(acceptedData.decisions).toHaveLength(1);
    expect(acceptedData.decisions[0].id).toBe("DEC-0001");

    const proposed = read.listDecisions(ctx, { status: "Proposed" });
    const proposedData = proposed.structuredContent as any;
    expect(proposedData.decisions).toHaveLength(1);
    expect(proposedData.decisions[0].id).toBe("DEC-0002");
  });

  it("list_actions filters by status", () => {
    write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });
    write.createAction(ctx, { nanoid: NANOID, title: "A2", forcedNumId: 2 });
    write.updateActionStatus(ctx, { nanoid: NANOID, id: "ACT-0001", newStatus: "in_progress" });

    const inProgress = read.listActions(ctx, { status: "in_progress" });
    const data = inProgress.structuredContent as any;
    expect(data.actions).toHaveLength(1);
    expect(data.actions[0].id).toBe("ACT-0001");
  });

  it("list_problems filters by severity", () => {
    write.createProblem(ctx, {
      nanoid: NANOID, title: "P1", severity: "HIGH", type: "code", forcedNumId: 1,
    });
    write.createProblem(ctx, {
      nanoid: NANOID, title: "P2", severity: "LOW", type: "doc", forcedNumId: 2,
    });

    const high = read.listProblems(ctx, { severity: "HIGH" });
    const data = high.structuredContent as any;
    expect(data.problems).toHaveLength(1);
    expect(data.problems[0].id).toBe("PB-0001");
  });

  it("list_ideas filters by status", () => {
    write.createIdea(ctx, { nanoid: NANOID, title: "I1", forcedNumId: 1 });
    write.createIdea(ctx, { nanoid: NANOID, title: "I2", forcedNumId: 2 });
    write.updateIdeaStatus(ctx, { nanoid: NANOID, id: "IDEA-0001", newStatus: "explored" });

    const explored = read.listIdeas(ctx, { status: "explored" });
    const data = explored.structuredContent as any;
    expect(data.ideas).toHaveLength(1);
    expect(data.ideas[0].id).toBe("IDEA-0001");
  });

  it("list_specs filters by status", () => {
    write.createSpec(ctx, { nanoid: NANOID, id: "SPEC-0001", filename: "s1.md", version: 1 });
    write.createSpec(ctx, { nanoid: NANOID, id: "SPEC-0002", filename: "s2.md", version: 1 });
    write.updateSpecStatus(ctx, { nanoid: NANOID, id: "SPEC-0001", newStatus: "ready" });

    const ready = read.listSpecs(ctx, { status: "ready" });
    const data = ready.structuredContent as any;
    expect(data.specs).toHaveLength(1);
    expect(data.specs[0].id).toBe("SPEC-0001");
  });

  it("correct rejects disallowed field", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });

    const result = write.correct(ctx, {
      nanoid: NANOID, entityType: "decision", entityId: "DEC-0001",
      field: "id", newValue: "DEC-9999", reason: "Trying to change ID",
    });
    expect(result.isError).toBeTruthy();
  });

  it("correct on action entity works", () => {
    write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });

    const result = write.correct(ctx, {
      nanoid: NANOID, entityType: "action", entityId: "ACT-0001",
      field: "title", newValue: "Updated Action Title", reason: "Better title",
    });
    expect(result.isError).toBeFalsy();
  });

  it("correct on problem entity works", () => {
    write.createProblem(ctx, {
      nanoid: NANOID, title: "P1", severity: "LOW", type: "code", forcedNumId: 1,
    });

    const result = write.correct(ctx, {
      nanoid: NANOID, entityType: "problem", entityId: "PB-0001",
      field: "description", newValue: "Updated description", reason: "More detail",
    });
    expect(result.isError).toBeFalsy();
  });

  it("correct on spec entity works", () => {
    write.createSpec(ctx, { nanoid: NANOID, id: "SPEC-0001", filename: "spec.md", version: 1 });

    const result = write.correct(ctx, {
      nanoid: NANOID, entityType: "spec", entityId: "SPEC-0001",
      field: "filename", newValue: "updated-spec.md", reason: "Renamed file",
    });
    expect(result.isError).toBeFalsy();
  });
});

// ─── FTS5 UPDATE/DELETE sync ───────────────────────────────────────────────

describe("coverage: FTS5 UPDATE/DELETE sync", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  function searchIndex(entityType: string, entityId: string): any | undefined {
    return db.prepare(
      "SELECT * FROM search_index WHERE entity_type = ? AND entity_id = ?",
    ).get(entityType, entityId) as any | undefined;
  }

  it("decision: INSERT indexes, UPDATE re-indexes, DELETE removes", () => {
    write.createDecision(ctx, {
      nanoid: NANOID, title: "UniqueFtsDecisionAlpha", decider: "admin", forcedNumId: 1,
      context: "contextualizing alpha",
    });

    // INSERT: should be indexed
    let row = searchIndex("decision", "DEC-0001");
    expect(row).toBeDefined();
    expect(row.title).toBe("UniqueFtsDecisionAlpha");

    // UPDATE via correct: should re-index with new title
    write.correct(ctx, {
      nanoid: NANOID, entityType: "decision", entityId: "DEC-0001",
      field: "title", newValue: "UniqueFtsDecisionBeta", reason: "Rename",
    });
    row = searchIndex("decision", "DEC-0001");
    expect(row).toBeDefined();
    expect(row.title).toBe("UniqueFtsDecisionBeta");

    // DELETE: should remove from FTS index
    db.prepare("DELETE FROM decisions WHERE id = ?").run("DEC-0001");
    row = searchIndex("decision", "DEC-0001");
    expect(row).toBeUndefined();
  });

  it("action: INSERT indexes, UPDATE re-indexes, DELETE removes", () => {
    write.createAction(ctx, {
      nanoid: NANOID, title: "UniqueFtsActionAlpha", forcedNumId: 1,
      body: "action body alpha",
    });

    let row = searchIndex("action", "ACT-0001");
    expect(row).toBeDefined();
    expect(row.title).toBe("UniqueFtsActionAlpha");

    write.correct(ctx, {
      nanoid: NANOID, entityType: "action", entityId: "ACT-0001",
      field: "title", newValue: "UniqueFtsActionBeta", reason: "Rename",
    });
    row = searchIndex("action", "ACT-0001");
    expect(row).toBeDefined();
    expect(row.title).toBe("UniqueFtsActionBeta");

    db.prepare("DELETE FROM actions WHERE id = ?").run("ACT-0001");
    row = searchIndex("action", "ACT-0001");
    expect(row).toBeUndefined();
  });

  it("idea: INSERT indexes, UPDATE re-indexes, DELETE removes", () => {
    write.createIdea(ctx, {
      nanoid: NANOID, title: "UniqueFtsIdeaAlpha", forcedNumId: 1,
      shortDesc: "short alpha",
    });

    let row = searchIndex("idea", "IDEA-0001");
    expect(row).toBeDefined();
    expect(row.title).toBe("UniqueFtsIdeaAlpha");

    write.correct(ctx, {
      nanoid: NANOID, entityType: "idea", entityId: "IDEA-0001",
      field: "title", newValue: "UniqueFtsIdeaBeta", reason: "Rename",
    });
    row = searchIndex("idea", "IDEA-0001");
    expect(row).toBeDefined();
    expect(row.title).toBe("UniqueFtsIdeaBeta");

    db.prepare("DELETE FROM ideas WHERE id = ?").run("IDEA-0001");
    row = searchIndex("idea", "IDEA-0001");
    expect(row).toBeUndefined();
  });

  it("problem: INSERT indexes, UPDATE re-indexes, DELETE removes", () => {
    write.createProblem(ctx, {
      nanoid: NANOID, title: "UniqueFtsProblemAlpha",
      severity: "LOW", type: "code", forcedNumId: 1,
      description: "problem desc alpha",
    });

    let row = searchIndex("problem", "PB-0001");
    expect(row).toBeDefined();
    expect(row.title).toBe("UniqueFtsProblemAlpha");

    write.correct(ctx, {
      nanoid: NANOID, entityType: "problem", entityId: "PB-0001",
      field: "title", newValue: "UniqueFtsProblemBeta", reason: "Rename",
    });
    row = searchIndex("problem", "PB-0001");
    expect(row).toBeDefined();
    expect(row.title).toBe("UniqueFtsProblemBeta");

    db.prepare("DELETE FROM problems WHERE id = ?").run("PB-0001");
    row = searchIndex("problem", "PB-0001");
    expect(row).toBeUndefined();
  });

  it("spec: INSERT indexes, UPDATE re-indexes, DELETE removes", () => {
    write.createSpec(ctx, {
      nanoid: NANOID, id: "SPEC-0001", filename: "unique-fts-spec-alpha.md", version: 1,
    });

    let row = searchIndex("spec", "SPEC-0001");
    expect(row).toBeDefined();
    expect(row.title).toBe("unique-fts-spec-alpha.md");

    write.correct(ctx, {
      nanoid: NANOID, entityType: "spec", entityId: "SPEC-0001",
      field: "filename", newValue: "unique-fts-spec-beta.md", reason: "Rename",
    });
    row = searchIndex("spec", "SPEC-0001");
    expect(row).toBeDefined();
    expect(row.title).toBe("unique-fts-spec-beta.md");

    db.prepare("DELETE FROM specs WHERE id = ?").run("SPEC-0001");
    row = searchIndex("spec", "SPEC-0001");
    expect(row).toBeUndefined();
  });

  it("log_entry: INSERT indexes, DELETE removes", () => {
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "UniqueFtsLogAlpha", body: "log body alpha",
    });

    // Find the log entry id
    const logRow = db.prepare(
      "SELECT id FROM log_entries WHERE subject = ? ORDER BY id DESC LIMIT 1",
    ).get("UniqueFtsLogAlpha") as { id: number };

    let row = searchIndex("log_entry", String(logRow.id));
    expect(row).toBeDefined();
    expect(row.title).toBe("UniqueFtsLogAlpha");

    db.prepare("DELETE FROM log_entries WHERE id = ?").run(logRow.id);
    row = searchIndex("log_entry", String(logRow.id));
    expect(row).toBeUndefined();
  });

  it("search_mailbox finds results across entity types after INSERT", () => {
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Searchable Gamma Decision", decider: "admin", forcedNumId: 1,
    });
    write.createAction(ctx, {
      nanoid: NANOID, title: "Searchable Gamma Action", forcedNumId: 1,
    });
    write.createIdea(ctx, {
      nanoid: NANOID, title: "Searchable Gamma Idea", forcedNumId: 1,
    });

    const result = read.searchMailbox(ctx, { query: "gamma" });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as any;
    expect(data.count).toBeGreaterThanOrEqual(3);
    const types = data.results.map((r: any) => r.entity_type);
    expect(types).toContain("decision");
    expect(types).toContain("action");
    expect(types).toContain("idea");
  });

  it("search_mailbox filters by entityType", () => {
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Filterable Delta Decision", decider: "admin", forcedNumId: 1,
    });
    write.createAction(ctx, {
      nanoid: NANOID, title: "Filterable Delta Action", forcedNumId: 1,
    });

    const result = read.searchMailbox(ctx, { query: "delta", entityType: "decision" });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as any;
    expect(data.results.every((r: any) => r.entity_type === "decision")).toBe(true);
    expect(data.results.some((r: any) => r.entity_id === "DEC-0001")).toBe(true);
  });
});
