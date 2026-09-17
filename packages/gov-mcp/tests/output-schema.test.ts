/**
 * Output-schema conformance tests.
 *
 * For every tool registered in toolList, this test invokes the handler with a
 * representative input against a seeded in-memory database, then validates
 * `structuredContent` against the tool's declared DNA output schema — the same
 * validation the MCP SDK performs before sending results to the client.
 *
 * This is the enforcement layer of the "single source of truth": a handler that
 * returns keys missing from (or shaped differently than) its advertised output
 * schema fails here instead of surfacing as a runtime output-validation error.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GovDb } from "../src/server/driver.js";
import { initDatabase } from "../src/server/init.js";
import { compileQueries } from "../src/server/queries/index.js";
import { toolList } from "../src/server/definitions/tools.js";
import * as write from "../src/server/tools/write.js";
import type { IToolCtx, OToolResult } from "../src/server/types/types.ts";
import { testReportsDir } from "./helpers/setup-mcp.js";

const NANOID = "test-nanoid-21chars__";

type tsFixture = (ctx: IToolCtx) => Record<string, unknown>;

describe("output schemas: every handler's structuredContent validates against its declared schema", () => {
  let db: GovDb;
  let ctx: IToolCtx;
  let threadId: number;
  let freeFieldId: number;

  beforeAll(() => {
    db = GovDb.memory();
    initDatabase(db);
    ctx = { db, queries: compileQueries(db), reportsDir: testReportsDir() };

    write.registerWriter(ctx, { id: "test-admin", role: "admin" });
    db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID, "test-admin");

    // Seed one of each entity
    write.createDecision(ctx, { nanoid: NANOID, title: "Test decision", decider: "test-admin", forcedNumId: 1 });
    write.createAction(ctx, { nanoid: NANOID, title: "Test action", forcedNumId: 1, priority: "P1", owner: "test-admin" });
    write.createAction(ctx, { nanoid: NANOID, title: "Test action 2", forcedNumId: 2 });
    write.createIdea(ctx, { nanoid: NANOID, title: "Test idea", forcedNumId: 1 });
    write.createProblem(ctx, { nanoid: NANOID, title: "Test problem", severity: "HIGH", type: "code", forcedNumId: 1 });
    write.createSpec(ctx, { nanoid: NANOID, id: "SPEC-0001", filename: "spec-test.md", version: 1 });
    write.createScope(ctx, { nanoid: NANOID, id: "test-scope", label: "Test Scope" });

    // Links
    write.linkProblemAction(ctx, { nanoid: NANOID, problemId: "PB-0001", actionId: "ACT-0001" });
    write.linkActionDependency(ctx, { nanoid: NANOID, actionId: "ACT-0002", dependsOnId: "ACT-0001" });
    db.prepare(
      "INSERT INTO workstreams (id, label, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("ws-test", "Test Workstream", 0, "2026-09-05T00:00:00.000Z", "2026-09-05T00:00:00.000Z");
    write.linkActionWorkstream(ctx, { nanoid: NANOID, actionId: "ACT-0001", workstreamId: "ws-test" });

    // A thread (reply creates thread_id) + a free field
    const parent = write.appendLogEntry(ctx, { nanoid: NANOID, type: "question", subject: "Q", body: "Test question" });
    const parentId = (parent.structuredContent as { id: number }).id;
    const reply = write.appendLogEntry(ctx, { nanoid: NANOID, type: "answer", replyTo: parentId, body: "Test answer" });
    threadId = (reply.structuredContent as { thread_id: number }).thread_id;

    const ff = write.addFreeField(ctx, {
      nanoid: NANOID, entityType: "decision", entityId: "DEC-0001",
      key: "test_key", format: "text", value: "test value",
    });
    freeFieldId = (ff.structuredContent as { id: number }).id;
  });

  afterAll(() => db.close());

  const today = new Date().toISOString().slice(0, 10);

  const fixtures: Record<string, tsFixture> = {
    // Writers
    register_writer: () => ({ id: "test-writer-b", role: "agent" }),
    register_me: () => ({ id: "test-writer-c", role: "agent" }),
    whoami: () => ({ nanoid: NANOID }),
    list_writers: () => ({}),
    update_me: () => ({ nanoid: NANOID, responsibility: "Testing output schemas" }),

    // Read: entities
    list_decisions: () => ({}),
    get_decision: () => ({ id: "DEC-0001" }),
    list_actions: () => ({}),
    get_action: () => ({ id: "ACT-0001" }),
    list_ideas: () => ({}),
    get_idea: () => ({ id: "IDEA-0001" }),
    list_problems: () => ({}),
    get_problem: () => ({ id: "PB-0001" }),
    list_specs: () => ({}),
    get_spec: () => ({ id: "SPEC-0001" }),
    list_scopes: () => ({}),
    get_scope_info: () => ({ id: "test-scope" }),
    list_log_entries: () => ({}),
    get_last_log_entry: () => ({ refId: "DEC-0001" }),
    get_thread: () => ({ threadId }),
    get_updates: () => ({ nanoid: NANOID }),
    list_docs: () => ({}),
    get_doc: () => ({ filename: "how-to.md" }),
    get_free_fields: () => ({ entityType: "decision", entityId: "DEC-0001" }),

    // Search
    search_mailbox: () => ({ query: "Test" }),
    mailbox_last_24h: () => ({}),

    // History & lineage
    get_decision_history: () => ({ id: "DEC-0001" }),
    get_action_lineage: () => ({ id: "ACT-0001" }),
    get_open_actions: () => ({}),
    get_handoff: () => ({}),
    audit_consistency: () => ({}),

    // Write
    create_decision: () => ({ nanoid: NANOID, title: "Fixture decision", decider: "test-admin", forcedNumId: 901 }),
    update_decision_status: () => ({ nanoid: NANOID, id: "DEC-0001", newStatus: "Accepted", reason: "fixture" }),
    create_action: () => ({ nanoid: NANOID, title: "Fixture action", forcedNumId: 902 }),
    update_action_status: () => ({ nanoid: NANOID, id: "ACT-0001", newStatus: "in_progress" }),
    create_idea: () => ({ nanoid: NANOID, title: "Fixture idea", forcedNumId: 903 }),
    update_idea_status: () => ({ nanoid: NANOID, id: "IDEA-0001", newStatus: "explored" }),
    create_problem: () => ({ nanoid: NANOID, title: "Fixture problem", severity: "LOW", type: "doc", forcedNumId: 904 }),
    update_problem_status: () => ({ nanoid: NANOID, id: "PB-0001", newStatus: "in_progress" }),
    link_problem_action: () => ({ nanoid: NANOID, problemId: "PB-0001", actionId: "ACT-0002" }),
    link_action_workstream: () => ({ nanoid: NANOID, actionId: "ACT-0002", workstreamId: "ws-test" }),
    link_action_dependency: () => ({ nanoid: NANOID, actionId: "ACT-0902", dependsOnId: "ACT-0001" }),
    create_spec: () => ({ nanoid: NANOID, id: "SPEC-0901", filename: "spec-fixture.md", version: 0 }),
    update_spec_status: () => ({ nanoid: NANOID, id: "SPEC-0001", newStatus: "ready" }),
    create_scope: () => ({ nanoid: NANOID, id: "fixture-scope", label: "Fixture Scope" }),
    update_scope: () => ({ nanoid: NANOID, id: "test-scope", label: "Updated Scope" }),
    append_log_entry: () => ({ nanoid: NANOID, type: "reflection", subject: "Fixture entry", body: "test" }),
    edit_field: () => ({
      nanoid: NANOID, entityType: "decision", entityId: "DEC-0001",
      field: "title", newValue: "Test decision (edited)", reason: "fixture",
    }),
    add_free_field: () => ({
      nanoid: NANOID, entityType: "action", entityId: "ACT-0001",
      key: "fixture_key", format: "text", value: "fixture",
    }),
    deprecate_free_field: () => ({ nanoid: NANOID, id: freeFieldId }),

    // Reports
    generate_daily_report: () => ({ date: today }),
    generate_decisions_report: () => ({}),
    generate_actions_report: () => ({}),
    generate_ideas_report: () => ({}),
    generate_problems_report: () => ({}),
    generate_specs_report: () => ({}),
    generate_decision_history_report: () => ({ id: "DEC-0001" }),
    export_dump: () => ({}),
    generate_all_reports: () => ({}),

    // System
    help: () => ({}),
  };

  it("has a fixture for every registered tool", () => {
    const missing = toolList.map((t) => t.name).filter((n) => !(n in fixtures));
    expect(missing, `Missing fixtures for: ${missing.join(", ")}`).toHaveLength(0);
  });

  for (const tool of toolList) {
    it(`${tool.name} returns structuredContent matching its output schema`, () => {
      const fixture = fixtures[tool.name];
      expect(fixture, `No fixture for ${tool.name}`).toBeDefined();

      // CAST: handlers are a union of specific signatures; all accept a plain
      // args record at runtime (they call .safeParse() internally).
      const result = (tool.handler as (c: IToolCtx, a: Record<string, unknown>) => OToolResult)(ctx, fixture(ctx));

      expect(result.isError, `${tool.name} handler errored: ${result.content[0]?.text}`).toBeFalsy();

      if (!tool.output) {
        // No declared output schema — structuredContent may be absent.
        return;
      }
      const parsed = tool.output.safeParse(result.structuredContent);
      expect(
        parsed.success,
        `${tool.name} output mismatch: ${parsed.success ? "" : JSON.stringify(parsed.errors)}`,
      ).toBeTruthy();
    });
  }
});
