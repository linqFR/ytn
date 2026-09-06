/**
 * End-to-end lifecycle cycle tests.
 *
 * Each test exercises a complete governance workflow from creation to terminal
 * state, verifying cross-entity cascades, history immutability, report
 * generation, and handoff snapshots along the way.
 *
 * Cycles covered:
 * 1. Decision → Actions → Problem cascade (ACT done → PB partial)
 * 2. Decision → Idea promotion → Action cascade (all ACTs done → IDEA implemented)
 * 3. Decision cancellation → Idea abandonment cascade
 * 4. Spec lifecycle: draft → ready → locked → implemented → superseded → PB reopened
 * 5. Idea → promoted to decision → superseded by new decision
 * 6. Discussion thread: question → answer → correction → close
 * 7. Workstream: create → link actions → verify via get_action
 * 8. Full daily cycle: create entities → generate reports → handoff snapshot
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { GovDb } from "../src/driver.js";
import { initDatabase } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";
import * as write from "../src/tools/write.js";
import * as read from "../src/tools/read.ts";
import * as reports from "../src/tools/reports.js";
import type { IToolCtx } from "../src/types/types.ts";

const NANOID = "e2e-nanoid-21chars___";

function setup(): { db: GovDb; ctx: IToolCtx } {
  const db = GovDb.memory();
  initDatabase(db);
  const ctx: IToolCtx = { db, queries: compileQueries(db) };
  write.registerWriter(ctx, { id: "e2e-admin", role: "admin" });
  db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID, "e2e-admin");
  return { db, ctx };
}

function generatedDir(): string {
  // Resolve from this test file: tests/e2e-cycles.test.ts → ../../mailbox/generated
  return resolve(import.meta.dirname, "..", "..", "mailbox", "generated");
}

// ─── Cycle 1: Decision → Actions → Problem cascade ────────────────────────

describe("e2e: Decision → Actions → Problem cascade", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("completes the full cycle: create DEC → create ACTs → link PB → ACT done → PB partial", () => {
    // 1. Create a decision
    const dec = write.createDecision(ctx, {
      nanoid: NANOID, title: "Adopt SQLite as source of truth",
      decider: "admin", forcedNumId: 1,
    });
    expect(dec.isError).toBeFalsy();

    // 2. Create two actions sourced from the decision
    write.createAction(ctx, {
      nanoid: NANOID, title: "Write schema migration",
      source: "DEC-0001", source_type: "decision", forcedNumId: 1,
    });
    write.createAction(ctx, {
      nanoid: NANOID, title: "Update documentation",
      source: "DEC-0001", source_type: "decision", forcedNumId: 2,
    });

    // 3. Create a problem and link it to the first action
    write.createProblem(ctx, {
      nanoid: NANOID, title: "Existing DB missing partial column",
      severity: "MEDIUM", type: "code", forcedNumId: 1,
    });
    write.linkProblemAction(ctx, {
      nanoid: NANOID, problemId: "PB-0001", actionId: "ACT-0001", role: "primary",
    });

    // 4. Verify initial states
    const pbBefore = read.getProblem(ctx, { id: "PB-0001" });
    const pbData = pbBefore.structuredContent as any;
    expect(pbData.problem.status).toBe("open");

    // 5. Complete the first action with evidence
    write.updateActionStatus(ctx, {
      nanoid: NANOID, id: "ACT-0001", newStatus: "done",
      evidence: "Migration script tested and committed",
    });

    // 6. Verify cascade: PB should now be partial
    const pbAfter = read.getProblem(ctx, { id: "PB-0001" });
    const pbAfterData = pbAfter.structuredContent as any;
    expect(pbAfterData.problem.status).toBe("partial");

    // 7. Verify status_history recorded the cascade
    const cascadeHistory = db.prepare(
      "SELECT * FROM status_history WHERE entity_type = 'problem' AND entity_id = ? AND cascade_trigger IS NOT NULL",
    ).all("PB-0001") as any[];
    expect(cascadeHistory).toHaveLength(1);
    expect(cascadeHistory[0].old_status).toBe("open");
    expect(cascadeHistory[0].new_status).toBe("partial");
    expect(cascadeHistory[0].changed_by).toBe("cascade:auto");

    // 8. Verify the second action is still pending
    const openActions = read.getOpenActions(ctx, {});
    const oaData = openActions.structuredContent as any;
    expect(oaData.actions.some((a: any) => a.id === "ACT-0002")).toBe(true);
  });
});

// ─── Cycle 2: Decision → Idea promotion → all ACTs done → IDEA implemented ──

describe("e2e: Idea promotion → all actions done → idea implemented", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("promotes an idea to a decision, creates actions, completes them, idea becomes implemented", () => {
    // 1. Create an idea
    write.createIdea(ctx, {
      nanoid: NANOID, title: "Use FTS5 for full-text search", forcedNumId: 1,
    });

    // 2. Create a decision (the idea will be promoted to this)
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Adopt FTS5 for search indexing",
      decider: "admin", forcedNumId: 1,
    });

    // 3. Promote the idea
    write.updateIdeaStatus(ctx, {
      nanoid: NANOID, id: "IDEA-0001", newStatus: "promoted",
      promotedTo: "DEC-0001",
    });

    // 4. Create two actions sourced from the decision
    write.createAction(ctx, {
      nanoid: NANOID, title: "Create FTS5 virtual table",
      source: "DEC-0001", source_type: "decision", forcedNumId: 1,
    });
    write.createAction(ctx, {
      nanoid: NANOID, title: "Write FTS5 sync triggers",
      source: "DEC-0001", source_type: "decision", forcedNumId: 2,
    });

    // 5. Verify idea is promoted, not yet implemented
    const ideaBefore = read.getIdea(ctx, { id: "IDEA-0001" });
    expect((ideaBefore.structuredContent as any).idea.status).toBe("promoted");

    // 6. Complete first action — idea should NOT be implemented yet (second action pending)
    write.updateActionStatus(ctx, {
      nanoid: NANOID, id: "ACT-0001", newStatus: "done",
      evidence: "FTS5 table created",
    });
    const ideaMid = read.getIdea(ctx, { id: "IDEA-0001" });
    expect((ideaMid.structuredContent as any).idea.status).toBe("promoted");

    // 7. Complete second action — NOW idea should be implemented via cascade
    write.updateActionStatus(ctx, {
      nanoid: NANOID, id: "ACT-0002", newStatus: "done",
      evidence: "Triggers tested and working",
    });
    const ideaAfter = read.getIdea(ctx, { id: "IDEA-0001" });
    expect((ideaAfter.structuredContent as any).idea.status).toBe("implemented");

    // 8. Verify cascade history
    const cascadeHistory = db.prepare(
      "SELECT * FROM status_history WHERE entity_type = 'idea' AND entity_id = ? AND cascade_trigger IS NOT NULL",
    ).all("IDEA-0001") as any[];
    expect(cascadeHistory).toHaveLength(1);
    expect(cascadeHistory[0].old_status).toBe("promoted");
    expect(cascadeHistory[0].new_status).toBe("implemented");
  });
});

// ─── Cycle 3: Decision cancellation → Idea abandonment ────────────────────

describe("e2e: Decision cancellation → Idea abandonment", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("cancelling a decision abandons its promoted idea", () => {
    // 1. Create idea and decision
    write.createIdea(ctx, { nanoid: NANOID, title: "Use blockchain for governance", forcedNumId: 1 });
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Adopt blockchain governance",
      decider: "admin", forcedNumId: 1,
    });

    // 2. Promote idea to decision
    write.updateIdeaStatus(ctx, {
      nanoid: NANOID, id: "IDEA-0001", newStatus: "promoted",
      promotedTo: "DEC-0001",
    });

    // 3. Cancel the decision
    write.updateDecisionStatus(ctx, {
      nanoid: NANOID, id: "DEC-0001", newStatus: "Cancelled",
      reason: "Too complex, no ROI",
    });

    // 4. Verify idea is abandoned via cascade
    const idea = read.getIdea(ctx, { id: "IDEA-0001" });
    expect((idea.structuredContent as any).idea.status).toBe("abandoned");

    // 5. Verify cascade history
    const cascadeHistory = db.prepare(
      "SELECT * FROM status_history WHERE entity_type = 'idea' AND entity_id = ? AND cascade_trigger IS NOT NULL",
    ).all("IDEA-0001") as any[];
    expect(cascadeHistory).toHaveLength(1);
    expect(cascadeHistory[0].new_status).toBe("abandoned");
  });
});

// ─── Cycle 4: Spec lifecycle → superseded → Problem reopened ──────────────

describe("e2e: Spec lifecycle → superseded → Problem reopened", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("spec draft → ready → locked → implemented → superseded reopens linked spec-type problem", () => {
    // 1. Create a spec
    write.createSpec(ctx, {
      nanoid: NANOID, id: "SPEC-0001", filename: "schema-v1.md", version: 1,
    });

    // 2. Create a spec-type problem linked to the spec
    write.createProblem(ctx, {
      nanoid: NANOID, title: "Schema v1 missing index",
      severity: "LOW", type: "spec", forcedNumId: 1,
      linkedSpec: "SPEC-0001",
    });

    // 3. Move spec through lifecycle: draft → ready → locked → implemented
    write.updateSpecStatus(ctx, { nanoid: NANOID, id: "SPEC-0001", newStatus: "ready" });
    write.updateSpecStatus(ctx, { nanoid: NANOID, id: "SPEC-0001", newStatus: "locked" });
    write.updateSpecStatus(ctx, { nanoid: NANOID, id: "SPEC-0001", newStatus: "implemented" });

    // 4. Fix the problem
    write.updateProblemStatus(ctx, {
      nanoid: NANOID, id: "PB-0001", newStatus: "fixed",
      fix: "Added missing index in schema v1",
    });

    // 5. Verify problem is fixed
    const pbFixed = read.getProblem(ctx, { id: "PB-0001" });
    expect((pbFixed.structuredContent as any).problem.status).toBe("fixed");

    // 6. Supersede the spec
    write.updateSpecStatus(ctx, { nanoid: NANOID, id: "SPEC-0001", newStatus: "superseded" });

    // 7. Verify cascade: problem should be reopened
    const pbReopened = read.getProblem(ctx, { id: "PB-0001" });
    const pbData = pbReopened.structuredContent as any;
    expect(pbData.problem.status).toBe("open");

    // 8. Verify cascade history
    const cascadeHistory = db.prepare(
      "SELECT * FROM status_history WHERE entity_type = 'problem' AND entity_id = ? AND cascade_trigger IS NOT NULL",
    ).all("PB-0001") as any[];
    expect(cascadeHistory).toHaveLength(1);
    expect(cascadeHistory[0].old_status).toBe("fixed");
    expect(cascadeHistory[0].new_status).toBe("open");
  });
});

// ─── Cycle 5: Decision supersession ───────────────────────────────────────

describe("e2e: Decision supersession chain", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("new decision supersedes old one, old gets superseded_by", () => {
    // 1. Create original decision
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Use JSON files for governance",
      decider: "admin", forcedNumId: 1,
    });

    // 2. Create a superseding decision
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Use SQLite for governance",
      decider: "admin", forcedNumId: 2,
      supersedes: ["DEC-0001"],
    });

    // 3. Verify the original decision is marked as superseded
    const old = read.getDecision(ctx, { id: "DEC-0001" });
    const oldData = old.structuredContent as any;
    expect(oldData.decision.superseded_by).toBe("DEC-0002");

    // 4. Verify decision history includes the creation entry
    const history = read.getDecisionHistory(ctx, { id: "DEC-0001" });
    const historyData = history.structuredContent as any;
    expect(historyData.history.length).toBeGreaterThanOrEqual(1);
    expect(historyData.decision.id).toBe("DEC-0001");
  });
});

// ─── Cycle 6: Discussion thread lifecycle ─────────────────────────────────

describe("e2e: Discussion thread lifecycle", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("creates a standalone discussion, replies, corrects, and closes via log entries", () => {
    // 1. Start a standalone discussion (no ref_id)
    const root = write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "question",
      subject: "Should we add a workstream table?",
      body: "I'm wondering if we need a separate workstream table or if scopes are enough.",
    });
    const rootId = (root.structuredContent as any).id;
    const threadId = (root.structuredContent as any).thread_id;
    expect(threadId).toBe(rootId); // root sets its own thread_id

    // 2. Reply to the discussion
    const reply1 = write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "answer",
      subject: "Re: workstream table",
      body: "Yes, workstreams group actions across scopes.",
      replyTo: rootId,
    });
    expect((reply1.structuredContent as any).thread_id).toBe(threadId);

    // 3. Another reply
    const reply2 = write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "challenge",
      body: "But isn't that what scopes already do?",
      replyTo: reply1.structuredContent && (reply1.structuredContent as any).id,
    });
    expect((reply2.structuredContent as any).thread_id).toBe(threadId);

    // 4. Retrieve the full thread
    const thread = read.getThread(ctx, { threadId });
    const threadData = thread.structuredContent as any;
    expect(threadData.entries).toHaveLength(3);

    // 5. Correct the root message (append a correction, don't mutate)
    const correction = write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "correction",
      subject: "Correction: workstream table question",
      body: "Actually, I meant to ask about action_workstreams junction table.",
      replyTo: rootId,
    });
    expect((correction.structuredContent as any).thread_id).toBe(threadId);

    // 6. Verify thread now has 4 entries (original + 2 replies + correction)
    const threadFinal = read.getThread(ctx, { threadId });
    const threadFinalData = threadFinal.structuredContent as any;
    expect(threadFinalData.entries).toHaveLength(4);

    // 7. Verify the original root entry is unchanged (immutable)
    const rootEntry = threadFinalData.entries.find((e: any) => e.id === rootId);
    expect(rootEntry.subject).toBe("Should we add a workstream table?");
    expect(rootEntry.body).toContain("I'm wondering");
  });
});

// ─── Cycle 7: Workstream lifecycle ────────────────────────────────────────

describe("e2e: Workstream lifecycle", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("creates a workstream, links multiple actions, verifies via get_action", () => {
    // 1. Create actions
    write.createAction(ctx, { nanoid: NANOID, title: "Implement schema", forcedNumId: 1 });
    write.createAction(ctx, { nanoid: NANOID, title: "Write tests", forcedNumId: 2 });
    write.createAction(ctx, { nanoid: NANOID, title: "Update docs", forcedNumId: 3 });

    // 2. Create a workstream directly (no MCP tool for workstream creation)
    db.prepare(
      `INSERT INTO workstreams (id, label, description, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("ws-migration", "DB Migration", "SQLite migration workstream",
      1, "2026-09-05T00:00:00.000Z", "2026-09-05T00:00:00.000Z");

    // 3. Link all actions to the workstream
    write.linkActionWorkstream(ctx, { nanoid: NANOID, actionId: "ACT-0001", workstreamId: "ws-migration" });
    write.linkActionWorkstream(ctx, { nanoid: NANOID, actionId: "ACT-0002", workstreamId: "ws-migration" });
    write.linkActionWorkstream(ctx, { nanoid: NANOID, actionId: "ACT-0003", workstreamId: "ws-migration" });

    // 4. Verify each action has the workstream link
    for (const actionId of ["ACT-0001", "ACT-0002", "ACT-0003"]) {
      const action = read.getAction(ctx, { id: actionId });
      const data = action.structuredContent as any;
      expect(data.workstreamLinks).toHaveLength(1);
      expect(data.workstreamLinks[0].workstream_id).toBe("ws-migration");
    }

    // 5. Complete two actions, leave one pending
    write.updateActionStatus(ctx, {
      nanoid: NANOID, id: "ACT-0001", newStatus: "done",
      evidence: "Schema implemented",
    });
    write.updateActionStatus(ctx, {
      nanoid: NANOID, id: "ACT-0002", newStatus: "done",
      evidence: "Tests pass",
    });

    // 6. Verify open actions only shows the third
    const openActions = read.getOpenActions(ctx, {});
    const oaData = openActions.structuredContent as any;
    expect(oaData.actions).toHaveLength(1);
    expect(oaData.actions[0].id).toBe("ACT-0003");
  });
});

// ─── Cycle 8: Full daily cycle with reports and handoff ───────────────────

describe("e2e: Full daily cycle with reports and handoff", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => {
    ({ db, ctx } = setup());
    // Clean up any previously generated reports
    const dir = generatedDir();
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });
  afterEach(() => {
    db.close();
    // Clean up generated reports
    const dir = generatedDir();
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it("creates entities across types, generates all reports, and produces a handoff snapshot", () => {
    // 1. Create a decision
    write.createDecision(ctx, {
      nanoid: NANOID, title: "Daily cycle test decision",
      decider: "admin", forcedNumId: 1,
    });

    // 2. Create an action
    write.createAction(ctx, {
      nanoid: NANOID, title: "Daily cycle test action", forcedNumId: 1,
    });

    // 3. Create an idea
    write.createIdea(ctx, {
      nanoid: NANOID, title: "Daily cycle test idea", forcedNumId: 1,
    });

    // 4. Create a problem
    write.createProblem(ctx, {
      nanoid: NANOID, title: "Daily cycle test problem",
      severity: "LOW", type: "code", forcedNumId: 1,
    });

    // 5. Create a spec
    write.createSpec(ctx, {
      nanoid: NANOID, id: "SPEC-DAILY", filename: "daily-cycle.md", version: 1,
    });

    // 6. Add a log entry
    write.appendLogEntry(ctx, {
      nanoid: NANOID, date: "2026-09-05", type: "status",
      subject: "Daily cycle started", body: "All entities created for daily cycle test.",
    });

    // 7. Generate daily report
    const dailyReport = reports.generateDailyReport(ctx, { date: "2026-09-05" });
    expect(dailyReport.isError).toBeFalsy();
    const dailyData = dailyReport.structuredContent as any;
    expect(dailyData.filepath).toBeDefined();
    expect(existsSync(dailyData.filepath)).toBe(true);

    // 8. Generate decisions report
    const decReport = reports.generateDecisionsReport(ctx);
    expect(decReport.isError).toBeFalsy();
    expect(existsSync((decReport.structuredContent as any).filepath)).toBe(true);

    // 9. Generate actions report
    const actReport = reports.generateActionsReport(ctx);
    expect(actReport.isError).toBeFalsy();
    expect(existsSync((actReport.structuredContent as any).filepath)).toBe(true);

    // 10. Generate ideas report
    const ideaReport = reports.generateIdeasReport(ctx);
    expect(ideaReport.isError).toBeFalsy();
    expect(existsSync((ideaReport.structuredContent as any).filepath)).toBe(true);

    // 11. Generate problems report
    const pbReport = reports.generateProblemsReport(ctx);
    expect(pbReport.isError).toBeFalsy();
    expect(existsSync((pbReport.structuredContent as any).filepath)).toBe(true);

    // 12. Generate decision history report
    const histReport = reports.generateDecisionHistoryReport(ctx, { id: "DEC-0001" });
    expect(histReport.isError).toBeFalsy();
    expect(existsSync((histReport.structuredContent as any).filepath)).toBe(true);

    // 13. Export dump (returns string, no file)
    const dump = reports.exportDump(ctx);
    expect(dump.isError).toBeFalsy();
    const dumpData = dump.structuredContent as any;
    expect(typeof dumpData.sql).toBe("string");
    expect(dumpData.sql.length).toBeGreaterThan(0);
    expect(dumpData.tables).toBeGreaterThan(0);

    // 14. Get handoff snapshot
    const handoff = read.getHandoff(ctx);
    expect(handoff.isError).toBeFalsy();
    const handoffData = handoff.structuredContent as any;
    expect(handoffData.open_actions).toBeDefined();
    expect(handoffData.pending_decisions).toBeDefined();
    expect(handoffData.active_problems).toBeDefined();
    expect(handoffData.raw_ideas).toBeDefined();
    expect(handoffData.to_test).toBeDefined();
    expect(handoffData.architectural_items).toBeDefined();

    // 15. Verify handoff sees our entities
    expect(handoffData.pending_decisions.some((d: any) => d.id === "DEC-0001")).toBe(true);
    expect(handoffData.open_actions.some((a: any) => a.id === "ACT-0001")).toBe(true);
    expect(handoffData.raw_ideas.some((i: any) => i.id === "IDEA-0001")).toBe(true);

    // 16. Audit consistency
    const audit = read.auditConsistency(ctx, {});
    expect(audit.isError).toBeFalsy();
    const auditData = audit.structuredContent as any;
    expect(auditData.findings).toBeDefined();
    expect(Array.isArray(auditData.findings)).toBe(true);
  });
});
