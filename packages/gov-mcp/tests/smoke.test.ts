/**
 * Smoke test — verify key exports exist and basic DB lifecycle works.
 */

import { describe, expect, it } from "vitest";
import { GovDb } from "../src/driver.js";
import { initDatabase, initIfEmpty } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";

describe("smoke test", () => {
  it("GovDb.memory() creates an in-memory database", () => {
    const db = GovDb.memory();
    expect(db).toBeDefined();
    db.close();
  });

  it("initDatabase creates schema + triggers + seeds", () => {
    const db = GovDb.memory();
    initDatabase(db);
    expect(db.tableExists("scopes")).toBe(true);
    expect(db.tableExists("decisions")).toBe(true);
    expect(db.tableExists("search_index")).toBe(true);
    db.close();
  });

  it("initIfEmpty returns true on first call, false on second", () => {
    const db = GovDb.memory();
    const first = initIfEmpty(db);
    expect(first).toBe(true);
    const second = initIfEmpty(db);
    expect(second).toBe(false);
    db.close();
  });

  it("compileQueries returns all expected statements", () => {
    const db = GovDb.memory();
    initDatabase(db);
    const queries = compileQueries(db);
    expect(queries.getDecisionById).toBeDefined();
    expect(queries.fts5Search).toBeDefined();
    expect(queries.mailboxLast24h).toBeDefined();
    // New OrIgnore + cycle detection queries
    expect(queries.insertProblemActionOrIgnore).toBeDefined();
    expect(queries.insertActionWorkstreamOrIgnore).toBeDefined();
    expect(queries.insertActionDependencyOrIgnore).toBeDefined();
    expect(queries.insertScopeOrIgnore).toBeDefined();
    expect(queries.checkActionDependencyExists).toBeDefined();
    expect(queries.checkActionDependencyCycle).toBeDefined();
    db.close();
  });
});
