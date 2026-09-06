/**
 * Integration tests for junction tables: decision_supersedes + entity_scopes.
 *
 * Verifies multi-supersedes (N:N) and multi-scope (N:N) support
 * on create_decision, create_action, create_idea, create_problem, create_spec.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GovDb } from "../src/driver.js";
import { initDatabase } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";
import * as write from "../src/tools/write.js";
import * as read from "../src/tools/read.js";
import type { IToolCtx } from "../src/types/types.ts";

const NANOID = "test-nanoid-21chars__";

describe("junction tables: decision_supersedes", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => {
    db = GovDb.memory();
    initDatabase(db);
    ctx = { db, queries: compileQueries(db) };

    // Register a writer
    write.registerWriter(ctx, { id: "test-admin", role: "admin" });
    // Patch the writer's nanoid to a known value for tests
    db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID, "test-admin");
  });

  afterEach(() => db.close());

  it("create_decision with multiple supersedes inserts into decision_supersedes", () => {
    // Create two decisions to be superseded
    const d1 = write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });
    expect(d1.isError).toBeFalsy();
    const d2 = write.createDecision(ctx, { nanoid: NANOID, title: "D2", decider: "admin", forcedNumId: 2 });
    expect(d2.isError).toBeFalsy();

    // Create a decision that supersedes both
    const d3 = write.createDecision(ctx, {
      nanoid: NANOID,
      title: "D3 supersedes D1 and D2",
      decider: "admin",
      forcedNumId: 3,
      supersedes: ["DEC-0001", "DEC-0002"],
    });
    expect(d3.isError).toBeFalsy();

    // Verify junction table rows
    const rows = ctx.queries.getDecisionSupersedes.all({ superseding_id: "DEC-0003" });
    expect(rows).toHaveLength(2);
    const supersededIds = rows.map((r) => r.superseded_id).sort();
    expect(supersededIds).toEqual(["DEC-0001", "DEC-0002"]);
  });

  it("create_decision with single supersedes works", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });
    const d2 = write.createDecision(ctx, {
      nanoid: NANOID,
      title: "D2",
      decider: "admin",
      forcedNumId: 2,
      supersedes: ["DEC-0001"],
    });
    expect(d2.isError).toBeFalsy();
    const rows = ctx.queries.getDecisionSupersedes.all({ superseding_id: "DEC-0002" });
    expect(rows).toHaveLength(1);
    expect(rows[0].superseded_id).toBe("DEC-0001");
  });

  it("create_decision without supersedes inserts nothing into junction", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });
    const rows = ctx.queries.getDecisionSupersedes.all({ superseding_id: "DEC-0001" });
    expect(rows).toHaveLength(0);
  });

  it("get_decision returns supersedes from junction table", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });
    write.createDecision(ctx, { nanoid: NANOID, title: "D2", decider: "admin", forcedNumId: 2 });
    write.createDecision(ctx, {
      nanoid: NANOID,
      title: "D3",
      decider: "admin",
      forcedNumId: 3,
      supersedes: ["DEC-0001", "DEC-0002"],
    });

    const result = read.getDecision(ctx, { id: "DEC-0003" });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { supersedes: { superseded_id: string }[] };
    expect(structured.supersedes).toHaveLength(2);
  });
});

describe("decision_supersedes: partial + superseded_by trigger", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => {
    db = GovDb.memory();
    initDatabase(db);
    ctx = { db, queries: compileQueries(db) };

    write.registerWriter(ctx, { id: "test-admin", role: "admin" });
    db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID, "test-admin");
  });

  afterEach(() => db.close());

  it("supersedesPartial inserts with partial=1", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });
    write.createDecision(ctx, {
      nanoid: NANOID,
      title: "D2 partially supersedes D1",
      decider: "admin",
      forcedNumId: 2,
      supersedesPartial: ["DEC-0001"],
    });

    const rows = ctx.queries.getDecisionSupersedes.all({ superseding_id: "DEC-0002" });
    expect(rows).toHaveLength(1);
    expect(rows[0].partial).toBe(1);
  });

  it("supersedes (full) inserts with partial=0", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });
    write.createDecision(ctx, {
      nanoid: NANOID,
      title: "D2 fully supersedes D1",
      decider: "admin",
      forcedNumId: 2,
      supersedes: ["DEC-0001"],
    });

    const rows = ctx.queries.getDecisionSupersedes.all({ superseding_id: "DEC-0002" });
    expect(rows).toHaveLength(1);
    expect(rows[0].partial).toBe(0);
  });

  it("trigger populates superseded_by on the superseded decision", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });
    write.createDecision(ctx, {
      nanoid: NANOID,
      title: "D2 supersedes D1",
      decider: "admin",
      forcedNumId: 2,
      supersedes: ["DEC-0001"],
    });

    const d1 = ctx.queries.getDecisionById.get({ id: "DEC-0001" });
    expect(d1!.superseded_by).toBe("DEC-0002");
  });

  it("trigger populates superseded_by for partial supersedes too", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });
    write.createDecision(ctx, {
      nanoid: NANOID,
      title: "D2 partially supersedes D1",
      decider: "admin",
      forcedNumId: 2,
      supersedesPartial: ["DEC-0001"],
    });

    const d1 = ctx.queries.getDecisionById.get({ id: "DEC-0001" });
    expect(d1!.superseded_by).toBe("DEC-0002");
  });
});

describe("junction tables: entity_scopes (multi-scope)", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => {
    db = GovDb.memory();
    initDatabase(db);
    ctx = { db, queries: compileQueries(db) };

    write.registerWriter(ctx, { id: "test-admin", role: "admin" });
    db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID, "test-admin");

    // Create additional scopes
    write.createScope(ctx, { nanoid: NANOID, id: "cli", label: "CLI" });
    write.createScope(ctx, { nanoid: NANOID, id: "dna", label: "DNA" });
  });

  afterEach(() => db.close());

  it("create_decision with array scope inserts into entity_scopes", () => {
    const result = write.createDecision(ctx, {
      nanoid: NANOID,
      title: "Multi-scope decision",
      decider: "admin",
      forcedNumId: 1,
      scope: ["cli", "dna"],
    });
    expect(result.isError).toBeFalsy();

    const rows = ctx.queries.getEntityScopes.all({ entity_type: "decision", entity_id: "DEC-0001" });
    expect(rows).toHaveLength(2);
    const scopeIds = rows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("create_decision with single string scope inserts one row into entity_scopes", () => {
    write.createDecision(ctx, {
      nanoid: NANOID,
      title: "Single scope",
      decider: "admin",
      forcedNumId: 1,
      scope: "cli",
    });

    const rows = ctx.queries.getEntityScopes.all({ entity_type: "decision", entity_id: "DEC-0001" });
    expect(rows).toHaveLength(1);
  });

  it("create_decision with array scope inserts all scopes without duplication", () => {
    write.createDecision(ctx, {
      nanoid: NANOID,
      title: "No dup",
      decider: "admin",
      forcedNumId: 1,
      scope: ["cli", "dna"],
    });

    const rows = ctx.queries.getEntityScopes.all({ entity_type: "decision", entity_id: "DEC-0001" });
    expect(rows).toHaveLength(2);
    const scopeIds = rows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("create_action with array scope inserts into entity_scopes", () => {
    write.createAction(ctx, {
      nanoid: NANOID,
      title: "Multi-scope action",
      forcedNumId: 1,
      scope: ["cli", "dna"],
    });

    const rows = ctx.queries.getEntityScopes.all({ entity_type: "action", entity_id: "ACT-0001" });
    expect(rows).toHaveLength(2);
    const scopeIds = rows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("create_idea with array scope inserts into entity_scopes", () => {
    write.createIdea(ctx, {
      nanoid: NANOID,
      title: "Multi-scope idea",
      forcedNumId: 1,
      scope: ["cli", "dna"],
    });

    const rows = ctx.queries.getEntityScopes.all({ entity_type: "idea", entity_id: "IDEA-0001" });
    expect(rows).toHaveLength(2);
    const scopeIds = rows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("create_problem with array scope inserts into entity_scopes", () => {
    write.createProblem(ctx, {
      nanoid: NANOID,
      title: "Multi-scope problem",
      severity: "HIGH",
      type: "code",
      forcedNumId: 1,
      scope: ["cli", "dna"],
    });

    const rows = ctx.queries.getEntityScopes.all({ entity_type: "problem", entity_id: "PB-0001" });
    expect(rows).toHaveLength(2);
    const scopeIds = rows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("create_spec with array scope inserts into entity_scopes", () => {
    write.createSpec(ctx, {
      nanoid: NANOID,
      id: "SPEC-test-001",
      filename: "test.md",
      version: 1,
      scope: ["cli", "dna"],
    });

    const rows = ctx.queries.getEntityScopes.all({ entity_type: "spec", entity_id: "SPEC-test-001" });
    expect(rows).toHaveLength(2);
    const scopeIds = rows.map((r) => r.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("get_decision returns scopes from junction table", () => {
    write.createDecision(ctx, {
      nanoid: NANOID,
      title: "Test",
      decider: "admin",
      forcedNumId: 1,
      scope: ["cli", "dna"],
    });

    const result = read.getDecision(ctx, { id: "DEC-0001" });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { scopes: { scope_id: string }[] };
    expect(structured.scopes).toHaveLength(2);
    const scopeIds = structured.scopes.map((s) => s.scope_id).sort();
    expect(scopeIds).toEqual(["cli", "dna"]);
  });

  it("get_action returns scopes from junction table", () => {
    write.createAction(ctx, {
      nanoid: NANOID,
      title: "Test",
      forcedNumId: 1,
      scope: ["cli", "dna"],
    });

    const result = read.getAction(ctx, { id: "ACT-0001" });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { scopes: { scope_id: string }[] };
    expect(structured.scopes).toHaveLength(2);
  });
});

describe("create_decision with date field", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => {
    db = GovDb.memory();
    initDatabase(db);
    ctx = { db, queries: compileQueries(db) };

    write.registerWriter(ctx, { id: "test-admin", role: "admin" });
    db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID, "test-admin");
  });

  afterEach(() => db.close());

  it("create_decision with YYYY-MM-DD date normalizes to ISO UTC", () => {
    const result = write.createDecision(ctx, {
      nanoid: NANOID,
      title: "Dated decision",
      decider: "admin",
      forcedNumId: 1,
      date: "2026-08-15",
    });
    expect(result.isError).toBeFalsy();

    const row = ctx.queries.getDecisionById.get({ id: "DEC-0001" });
    expect(row!.date).toBe("2026-08-15T00:00:00.000Z");
  });

  it("create_decision without date defaults to current timestamp", () => {
    const result = write.createDecision(ctx, {
      nanoid: NANOID,
      title: "Undated decision",
      decider: "admin",
      forcedNumId: 1,
    });
    expect(result.isError).toBeFalsy();

    const row = ctx.queries.getDecisionById.get({ id: "DEC-0001" });
    expect(row!.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("create_decision with datetime (hours:minutes) normalizes to ISO UTC", () => {
    const result = write.createDecision(ctx, {
      nanoid: NANOID,
      title: "Dated decision with time",
      decider: "admin",
      forcedNumId: 1,
      date: "2026-08-16T01:30:00Z",
    });
    expect(result.isError).toBeFalsy();

    const row = ctx.queries.getDecisionById.get({ id: "DEC-0001" });
    expect(row!.date).toBe("2026-08-16T01:30:00.000Z");
  });

  it("create_decision with space-separated datetime normalizes to ISO UTC", () => {
    const result = write.createDecision(ctx, {
      nanoid: NANOID,
      title: "Space-separated datetime",
      decider: "admin",
      forcedNumId: 1,
      date: "2026-08-16 01:30:00Z",
    });
    expect(result.isError).toBeFalsy();

    const row = ctx.queries.getDecisionById.get({ id: "DEC-0001" });
    expect(row!.date).toBe("2026-08-16T01:30:00.000Z");
  });

  it("create_decision with full ISO datetime preserves it", () => {
    const result = write.createDecision(ctx, {
      nanoid: NANOID,
      title: "Full ISO datetime",
      decider: "admin",
      forcedNumId: 1,
      date: "2026-08-17T00:37:00.000Z",
    });
    expect(result.isError).toBeFalsy();

    const row = ctx.queries.getDecisionById.get({ id: "DEC-0001" });
    expect(row!.date).toBe("2026-08-17T00:37:00.000Z");
  });
});
