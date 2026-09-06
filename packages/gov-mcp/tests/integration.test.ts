/**
 * Integration test: schema creation, triggers, cascades.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GovDb } from "../src/driver.js";
import { currentDate, currentTimestamp } from "../src/helpers.js";
import { initDatabase } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";

describe("governance DB integration", () => {
  let db: GovDb;

  beforeEach(() => {
    db = GovDb.memory();
    initDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  it("creates all 16 tables", () => {
    const tables = db.listTables().filter(
      (t) => !t.startsWith("sqlite_") && !t.startsWith("search_index") && !t.startsWith("_"),
    );
    expect(tables).toHaveLength(16);
    expect(tables).toContain("scopes");
    expect(tables).toContain("decisions");
    expect(tables).toContain("actions");
    expect(tables).toContain("ideas");
    expect(tables).toContain("problems");
    expect(tables).toContain("specs");
    expect(tables).toContain("log_entries");
    expect(tables).toContain("status_history");
    expect(tables).toContain("writers");
    expect(tables).toContain("action_dependencies");
    expect(tables).toContain("decision_supersedes");
    expect(tables).toContain("entity_scopes");
    expect(tables).toContain("free_fields");
    expect(tables).toContain("problem_actions");
    expect(tables).toContain("workstreams");
    expect(tables).toContain("action_workstreams");
  });

  it("seeds only the invariant workspace scope at init", () => {
    const rows = db.prepare("SELECT * FROM scopes ORDER BY sort_order").all() as { id: string }[];
    // Only workspace is seeded — other scopes are declared via create_scope
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("workspace");
  });

  it("scope_tree recursive CTE resolves all descendants", () => {
    // Create a scope hierarchy: workspace → ytn → dna
    db.prepare(
      "INSERT INTO scopes (id, label, description, parent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("ytn", "ytn repo", "ytn monorepo", "workspace", 1, currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO scopes (id, label, description, parent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("dna", "@ytrynot/dna", "DNA package", "ytn", 2, currentTimestamp(), currentTimestamp());
    const queries = compileQueries(db);
    // scopeTree for "workspace" should return workspace + ytn + dna
    const wsTree = queries.scopeTree.all({ scope: "workspace" }) as { id: string }[];
    expect(wsTree.map((r) => r.id).sort()).toEqual(["dna", "workspace", "ytn"]);
    // scopeTree for "ytn" should return ytn + dna
    const ytnTree = queries.scopeTree.all({ scope: "ytn" }) as { id: string }[];
    expect(ytnTree.map((r) => r.id).sort()).toEqual(["dna", "ytn"]);
    // scopeTree for "dna" should return only dna
    const dnaTree = queries.scopeTree.all({ scope: "dna" }) as { id: string }[];
    expect(dnaTree.map((r) => r.id)).toEqual(["dna"]);
  });

  it("scope_tree resolves nested descendants (3 levels)", () => {
    // workspace → ytn → gov-mcp → triggers (3 levels deep)
    db.prepare(
      "INSERT INTO scopes (id, label, description, parent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("ytn", "ytn repo", "ytn monorepo", "workspace", 1, currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO scopes (id, label, description, parent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("gov-mcp", "@ytrynot/gov-mcp", "Governance MCP", "ytn", 2, currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO scopes (id, label, description, parent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("triggers", "triggers subscope", "Trigger subsystem", "gov-mcp", 3, currentTimestamp(), currentTimestamp());
    const queries = compileQueries(db);
    // workspace withChildren should include all 4 scopes
    const wsTree = queries.scopeTree.all({ scope: "workspace" }) as { id: string }[];
    expect(wsTree.map((r) => r.id).sort()).toEqual(["gov-mcp", "triggers", "workspace", "ytn"]);
    // ytn withChildren should include ytn + gov-mcp + triggers (not workspace)
    const ytnTree = queries.scopeTree.all({ scope: "ytn" }) as { id: string }[];
    expect(ytnTree.map((r) => r.id).sort()).toEqual(["gov-mcp", "triggers", "ytn"]);
  });

  it("withChildren: false (default) uses exact scope match", async () => {
    // Hierarchy: workspace → ytn → dna
    db.prepare(
      "INSERT INTO scopes (id, label, description, parent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("ytn", "ytn repo", "ytn monorepo", "workspace", 1, currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO scopes (id, label, description, parent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("dna", "@ytrynot/dna", "DNA package", "ytn", 2, currentTimestamp(), currentTimestamp());
    // Insert decisions in different scopes
    db.prepare(
      "INSERT INTO decisions (id, seq, title, status, date, decider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("DEC-0001", 1, "Workspace DEC", "Accepted", currentDate(), "ADMIN", currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO decisions (id, seq, title, status, date, decider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("DEC-0002", 2, "ytn DEC", "Accepted", currentDate(), "ADMIN", currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO decisions (id, seq, title, status, date, decider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("DEC-0003", 3, "dna DEC", "Accepted", currentDate(), "ADMIN", currentTimestamp(), currentTimestamp());
    const queries = compileQueries(db);
    queries.insertEntityScope.run({ entity_type: "decision", entity_id: "DEC-0001", scope_id: "workspace" });
    queries.insertEntityScope.run({ entity_type: "decision", entity_id: "DEC-0002", scope_id: "ytn" });
    queries.insertEntityScope.run({ entity_type: "decision", entity_id: "DEC-0003", scope_id: "dna" });

    const read = await import("../src/tools/read.js");
    const ctx = { db, queries };

    // Exact match: scope=ytn returns only ytn
    const exact = read.listDecisions(ctx, { scope: "ytn" });
    expect(exact.isError).toBe(false);
    const exactData = exact.structuredContent as { decisions: { id: string }[] };
    expect(exactData.decisions).toHaveLength(1);
    expect(exactData.decisions[0].id).toBe("DEC-0002");

    // withChildren: false is the same as default
    const explicitFalse = read.listDecisions(ctx, { scope: "ytn", withChildren: false });
    const falseData = explicitFalse.structuredContent as { decisions: { id: string }[] };
    expect(falseData.decisions).toHaveLength(1);
    expect(falseData.decisions[0].id).toBe("DEC-0002");
  });

  it("withChildren: true includes descendant scopes", async () => {
    // Hierarchy: workspace → ytn → dna
    db.prepare(
      "INSERT INTO scopes (id, label, description, parent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("ytn", "ytn repo", "ytn monorepo", "workspace", 1, currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO scopes (id, label, description, parent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("dna", "@ytrynot/dna", "DNA package", "ytn", 2, currentTimestamp(), currentTimestamp());
    // Insert actions in different scopes
    db.prepare(
      "INSERT INTO actions (id, seq, title, status, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("ACT-0001", 1, "Workspace ACT", "pending", currentTimestamp(), currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO actions (id, seq, title, status, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("ACT-0002", 2, "ytn ACT", "pending", currentTimestamp(), currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO actions (id, seq, title, status, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("ACT-0003", 3, "dna ACT", "pending", currentTimestamp(), currentTimestamp(), currentTimestamp());
    const queries = compileQueries(db);
    queries.insertEntityScope.run({ entity_type: "action", entity_id: "ACT-0001", scope_id: "workspace" });
    queries.insertEntityScope.run({ entity_type: "action", entity_id: "ACT-0002", scope_id: "ytn" });
    queries.insertEntityScope.run({ entity_type: "action", entity_id: "ACT-0003", scope_id: "dna" });

    const read = await import("../src/tools/read.js");
    const ctx = { db, queries };

    // withChildren: true on ytn → ytn + dna (not workspace)
    const ytnChildren = read.listActions(ctx, { scope: "ytn", withChildren: true });
    const ytnData = ytnChildren.structuredContent as { actions: { id: string }[] };
    expect(ytnData.actions).toHaveLength(2);
    expect(ytnData.actions.map((a) => a.id).sort()).toEqual(["ACT-0002", "ACT-0003"]);

    // withChildren: true on workspace → all 3
    const wsChildren = read.listActions(ctx, { scope: "workspace", withChildren: true });
    const wsData = wsChildren.structuredContent as { actions: { id: string }[] };
    expect(wsData.actions).toHaveLength(3);

    // withChildren: true on dna → only dna (leaf)
    const dnaChildren = read.listActions(ctx, { scope: "dna", withChildren: true });
    const dnaData = dnaChildren.structuredContent as { actions: { id: string }[] };
    expect(dnaData.actions).toHaveLength(1);
    expect(dnaData.actions[0].id).toBe("ACT-0003");
  });

  it("withChildren: true works across entity types (ideas, problems, specs, log_entries)", async () => {
    // Hierarchy: workspace → ytn → qb
    db.prepare(
      "INSERT INTO scopes (id, label, description, parent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("ytn", "ytn repo", "ytn monorepo", "workspace", 1, currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO scopes (id, label, description, parent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("qb", "@ytrynot/qb", "Query Builder", "ytn", 2, currentTimestamp(), currentTimestamp());

    // Ideas
    db.prepare(
      "INSERT INTO ideas (id, seq, title, status, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("IDEA-0001", 1, "ytn idea", "raw", currentTimestamp(), currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO ideas (id, seq, title, status, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("IDEA-0002", 2, "qb idea", "raw", currentTimestamp(), currentTimestamp(), currentTimestamp());

    // Problems
    db.prepare(
      "INSERT INTO problems (id, seq, title, status, severity, type, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("PB-0001", 1, "ytn pb", "open", "HIGH", "code", currentTimestamp(), currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO problems (id, seq, title, status, severity, type, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("PB-0002", 2, "qb pb", "open", "MEDIUM", "code", currentTimestamp(), currentTimestamp(), currentTimestamp());

    // Specs
    db.prepare(
      "INSERT INTO specs (id, filename, version, status, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("SPEC-0001", "spec-ytn.md", 1, "draft", currentTimestamp(), currentTimestamp(), currentTimestamp());
    db.prepare(
      "INSERT INTO specs (id, filename, version, status, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("SPEC-0002", "spec-qb.md", 1, "draft", currentTimestamp(), currentTimestamp(), currentTimestamp());

    // Log entries
    db.prepare(
      "INSERT INTO log_entries (date, timestamp, type, subject) VALUES (?, ?, ?, ?)",
    ).run(currentDate(), currentTimestamp(), "action", "ytn log");
    const ytnLogId = db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number };
    db.prepare(
      "INSERT INTO log_entries (date, timestamp, type, subject) VALUES (?, ?, ?, ?)",
    ).run(currentDate(), currentTimestamp(), "action", "qb log");
    const qbLogId = db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number };

    const queries = compileQueries(db);
    queries.insertEntityScope.run({ entity_type: "idea", entity_id: "IDEA-0001", scope_id: "ytn" });
    queries.insertEntityScope.run({ entity_type: "idea", entity_id: "IDEA-0002", scope_id: "qb" });
    queries.insertEntityScope.run({ entity_type: "problem", entity_id: "PB-0001", scope_id: "ytn" });
    queries.insertEntityScope.run({ entity_type: "problem", entity_id: "PB-0002", scope_id: "qb" });
    queries.insertEntityScope.run({ entity_type: "spec", entity_id: "SPEC-0001", scope_id: "ytn" });
    queries.insertEntityScope.run({ entity_type: "spec", entity_id: "SPEC-0002", scope_id: "qb" });
    queries.insertEntityScope.run({ entity_type: "log_entry", entity_id: String(ytnLogId.id), scope_id: "ytn" });
    queries.insertEntityScope.run({ entity_type: "log_entry", entity_id: String(qbLogId.id), scope_id: "qb" });

    const read = await import("../src/tools/read.js");
    const ctx = { db, queries };

    // Ideas: ytn withChildren → 2
    const ideas = read.listIdeas(ctx, { scope: "ytn", withChildren: true });
    const ideasData = ideas.structuredContent as { ideas: { id: string }[] };
    expect(ideasData.ideas).toHaveLength(2);

    // Problems: ytn withChildren → 2
    const problems = read.listProblems(ctx, { scope: "ytn", withChildren: true });
    const problemsData = problems.structuredContent as { problems: { id: string }[] };
    expect(problemsData.problems).toHaveLength(2);

    // Specs: ytn withChildren → 2
    const specs = read.listSpecs(ctx, { scope: "ytn", withChildren: true });
    const specsData = specs.structuredContent as { specs: { id: string }[] };
    expect(specsData.specs).toHaveLength(2);

    // Log entries: ytn withChildren → 2
    const logs = read.listLogEntries(ctx, { scope: "ytn", withChildren: true });
    const logsData = logs.structuredContent as { entries: { id: number }[] };
    expect(logsData.entries).toHaveLength(2);

    // Exact match: ytn only → 1 each
    const ideasExact = read.listIdeas(ctx, { scope: "ytn" });
    const ideasExactData = ideasExact.structuredContent as { ideas: { id: string }[] };
    expect(ideasExactData.ideas).toHaveLength(1);
  });

  it("withChildren: true on unknown scope falls back to exact match", async () => {
    const read = await import("../src/tools/read.js");
    const queries = compileQueries(db);
    const ctx = { db, queries };

    // Scope "nonexistent" has no children → returns empty (no rows match)
    const result = read.listDecisions(ctx, { scope: "nonexistent", withChildren: true });
    const data = result.structuredContent as { decisions: unknown[] };
    expect(data.decisions).toHaveLength(0);
  });

  it("creates FTS5 search_index", () => {
    expect(db.tableExists("search_index")).toBe(true);
  });

  it("creates all 27 triggers (4 cascade + 1 scope inheritance + 1 supersession + 21 FTS5)", () => {
    const rows = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
    ).all() as { name: string }[];
    expect(rows).toHaveLength(27);
  });

  it("creates 32 indexes", () => {
    const rows = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name",
    ).all() as { name: string }[];
    expect(rows).toHaveLength(32);
  });

  it("CHECK constraint rejects invalid log_entries.type", () => {
    expect(() => {
      db.prepare(
        "INSERT INTO log_entries (date, timestamp, type) VALUES (?, ?, ?)",
      ).run(currentDate(), currentTimestamp(), "invalid_type");
    }).toThrow();
  });

  it("CHECK constraint rejects invalid writers.role", () => {
    expect(() => {
      db.prepare(
        "INSERT INTO writers (id, nanoid, role, default_scope, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("test-writer", "test-nanoid-12345678901", "invalid_role", "workspace", currentTimestamp());
    }).toThrow();
  });

  it("CHECK constraint rejects invalid actions.source_type", () => {
    // First create a valid action to verify the constraint works
    db.prepare(
      "INSERT INTO writers (id, nanoid, role, default_scope, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("admin", "test-nanoid-12345678901", "admin", "workspace", currentTimestamp());

    expect(() => {
      db.prepare(
        "INSERT INTO actions (id, seq, title, status, source_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run("ACT-0001", 1, "Test", "pending", "invalid_source", currentTimestamp(), currentTimestamp());
    }).toThrow();
  });

  it("FK constraint rejects invalid scope reference", () => {
    db.prepare(
      "INSERT INTO decisions (id, seq, title, status, date, decider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("DEC-0001", 1, "Test", "Proposed", currentTimestamp(), "ADMIN", currentTimestamp(), currentTimestamp());
    expect(() => {
      db.prepare(
        "INSERT INTO entity_scopes (entity_type, entity_id, scope_id) VALUES (?, ?, ?)",
      ).run("decision", "DEC-0001", "nonexistent");
    }).toThrow();
  });
});

describe("cascade triggers", () => {
  let db: GovDb;

  beforeEach(() => {
    db = GovDb.memory();
    initDatabase(db);
    // Seed writer
    db.prepare(
      "INSERT INTO writers (id, nanoid, role, default_scope, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("admin", "test-nanoid-12345678901", "admin", "workspace", currentTimestamp());
    // Seed decision
    db.prepare(
      "INSERT INTO decisions (id, seq, title, status, date, decider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("DEC-0001", 1, "Test DEC", "Accepted", currentTimestamp(), "ADMIN", currentTimestamp(), currentTimestamp());
    // Seed action
    db.prepare(
      "INSERT INTO actions (id, seq, title, status, source, source_type, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("ACT-0001", 1, "Test ACT", "in_progress", "DEC-0001", "decision", currentTimestamp(), currentTimestamp(), currentTimestamp());
    // Seed problem
    db.prepare(
      "INSERT INTO problems (id, seq, title, status, severity, type, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("PB-0001", 1, "Test PB", "open", "HIGH", "code", currentTimestamp(), currentTimestamp(), currentTimestamp());
    // Link problem ↔ action
    db.prepare(
      "INSERT INTO problem_actions (problem_id, action_id, role, created_at) VALUES (?, ?, ?, ?)",
    ).run("PB-0001", "ACT-0001", "primary", currentTimestamp());
  });

  afterEach(() => {
    db.close();
  });

  it("ACT → done → PB → partial + tested='partially'", () => {
    db.prepare("UPDATE actions SET status = 'done', evidence = 'test evidence', updated_at = ? WHERE id = ?")
      .run(currentTimestamp(), "ACT-0001");

    const pb = db.prepare("SELECT * FROM problems WHERE id = ?").get("PB-0001") as Record<string, unknown>;
    expect(pb!.status).toBe("partial");
    expect(pb!.tested).toBe("partially");

    const history = db.prepare("SELECT * FROM status_history WHERE entity_type = 'problem' AND entity_id = ?").all("PB-0001");
    expect(history).toHaveLength(1);
    expect(history[0].new_status).toBe("partial");
  });

  it("ACT → done → IDEA → implemented (when all ACTs of DEC done)", () => {
    // Seed idea promoted to DEC-0001
    db.prepare(
      "INSERT INTO ideas (id, seq, title, status, promoted_to, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("IDEA-0001", 1, "Test IDEA", "promoted", "DEC-0001", currentTimestamp(), currentTimestamp(), currentTimestamp());

    db.prepare("UPDATE actions SET status = 'done', evidence = 'test evidence', updated_at = ? WHERE id = ?")
      .run(currentTimestamp(), "ACT-0001");

    const idea = db.prepare("SELECT * FROM ideas WHERE id = ?").get("IDEA-0001") as Record<string, unknown>;
    expect(idea!.status).toBe("implemented");
    expect(idea!.tested).toBe("partially");
  });

  it("DEC → Cancelled → IDEA → abandoned", () => {
    db.prepare(
      "INSERT INTO ideas (id, seq, title, status, promoted_to, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("IDEA-0001", 1, "Test IDEA", "promoted", "DEC-0001", currentTimestamp(), currentTimestamp(), currentTimestamp());

    db.prepare("UPDATE decisions SET status = 'Cancelled', updated_at = ? WHERE id = ?")
      .run(currentTimestamp(), "DEC-0001");

    const idea = db.prepare("SELECT * FROM ideas WHERE id = ?").get("IDEA-0001") as Record<string, unknown>;
    expect(idea!.status).toBe("abandoned");
  });

  it("cascade=false disables ACT → PB cascade", () => {
    // Disable cascades via temp table flag (as the tool does)
    db.exec("UPDATE _cascade_disabled SET value = 1");
    db.prepare("UPDATE actions SET status = 'done', evidence = 'test evidence', updated_at = ? WHERE id = ?")
      .run(currentTimestamp(), "ACT-0001");
    db.exec("UPDATE _cascade_disabled SET value = 0");

    const pb = db.prepare("SELECT * FROM problems WHERE id = ?").get("PB-0001") as Record<string, unknown>;
    expect(pb!.status).toBe("open");
  });
});

describe("FTS5 search", () => {
  let db: GovDb;

  beforeEach(() => {
    db = GovDb.memory();
    initDatabase(db);
    db.prepare(
      "INSERT INTO writers (id, nanoid, role, default_scope, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("admin", "test-nanoid-12345678901", "admin", "workspace", currentTimestamp());
    db.prepare(
      "INSERT INTO decisions (id, seq, title, status, date, decider, context, decision, consequences, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("DEC-0001", 1, "Maranget decision tree", "Accepted", currentTimestamp(), "ADMIN", "Pattern matching", "Use Maranget algorithm", "Better routing", currentTimestamp(), currentTimestamp());
  });

  afterEach(() => {
    db.close();
  });

  it("search finds decision by keyword", () => {
    const results = db.prepare(
      "SELECT entity_type, entity_id, title FROM search_index WHERE search_index MATCH ? ORDER BY rank",
    ).all("maranget");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entity_type).toBe("decision");
    expect(results[0].entity_id).toBe("DEC-0001");
  });

  it("search filters by entity_type", () => {
    const allResults = db.prepare(
      "SELECT entity_type, entity_id FROM search_index WHERE search_index MATCH ? ORDER BY rank",
    ).all("maranget");
    const filtered = allResults.filter((r) => r.entity_type === "decision");
    expect(filtered).toHaveLength(allResults.length);
  });
});

describe("get_updates cursor", () => {
  let db: GovDb;

  beforeEach(() => {
    db = GovDb.memory();
    initDatabase(db);
    db.prepare(
      "INSERT INTO writers (id, nanoid, role, default_scope, last_read_log_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("devin-cli", "test-nanoid-12345678901", "agent", "workspace", 0, currentTimestamp());
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
    expect(writer!.last_read_log_id).toBe(0);

    const rows = db.prepare("SELECT * FROM log_entries WHERE id > ? ORDER BY id ASC LIMIT ?")
      .all(0, 50);
    expect(rows).toHaveLength(5);

    // Advance cursor
    const newCursor = rows[rows.length - 1].id;
    queries.updateWriterCursor.run({ last_read_log_id: newCursor, nanoid: "test-nanoid-12345678901" });

    const updated = queries.getWriterByNanoid.get({ nanoid: "test-nanoid-12345678901" });
    expect(updated!.last_read_log_id).toBe(newCursor);
  });

  it("whoami returns the writer profile", async () => {
    const write = await import("../src/tools/write.js");
    const read = await import("../src/tools/read.js");
    const queries = compileQueries(db);
    const ctx = { db, queries };
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

  it("whoami rejects unknown nanoid", async () => {
    const read = await import("../src/tools/read.js");
    const queries = compileQueries(db);
    const ctx = { db, queries };
    const result = read.whoami(ctx, { nanoid: "nonexistent-nanoid-xx" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Writer not found");
  });

  it("registerWriter rejects duplicate id", async () => {
    const write = await import("../src/tools/write.js");
    const queries = compileQueries(db);
    const ctx = { db, queries };
    const first = write.registerWriter(ctx, { id: "dup-agent", role: "agent" });
    expect(first.isError).toBe(false);
    const second = write.registerWriter(ctx, { id: "dup-agent", role: "agent" });
    expect(second.isError).toBe(true);
    expect(second.content[0].text).toContain("already exists");
  });

  it("createDecision rejects invalid input via DNA (direct call, no MCP)", async () => {
    const write = await import("../src/tools/write.js");
    const queries = compileQueries(db);
    const ctx = { db, queries };
    // Missing required fields: title, decider
    const result = write.createDecision(ctx, { nanoid: "x".repeat(21) } as any);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation failed");
  });

  it("createDecision rejects invalid enum value via DNA (direct call)", async () => {
    const write = await import("../src/tools/write.js");
    const queries = compileQueries(db);
    const ctx = { db, queries };
    const result = write.createDecision(ctx, {
      nanoid: "x".repeat(21),
      title: "Test",
      decider: "admin",
      // @ts-expect-error — intentionally invalid status to verify DNA runtime rejection
      status: "INVALID_STATUS",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation failed");
  });
});
