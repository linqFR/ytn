import { describe, it, expect } from "vitest";
import { getFnUndeclared } from "../js/fn-reflect.js";

describe("fn-reflect (AST Analysis)", () => {
  it("should identify simple global dependencies", () => {
    const code = "(data) => console.log(data) + outsideVar";
    const deps = getFnUndeclared(code);
    expect(deps).toContain("console");
    expect(deps).toContain("outsideVar");
    expect(deps).not.toContain("data");
  });

  it("should ignore local variables and arguments", () => {
    const code = "(a, b) => { const c = a + b; return c + d; }";
    const deps = getFnUndeclared(code);
    expect(deps).toEqual(["d"]); // 'd' is the only undeclared
  });

  it("should handle async functions and await expressions", () => {
    const code = "async (id) => { const res = await db.get(id); return res; }";
    const deps = getFnUndeclared(code);
    expect(deps).toContain("db");
    expect(deps).not.toContain("res");
  });

  it("should handle destructuring in parameters", () => {
    const code = "({ id, name }, { send }) => id + name + send() + other";
    const deps = getFnUndeclared(code);
    expect(deps).toEqual(["other"]);
  });

  it("should correctly handle property renaming in destructuring", () => {
    const code = "({ id: userId }) => userId + external";
    const deps = getFnUndeclared(code);
    expect(deps).toEqual(["external"]);
    expect(deps).not.toContain("id"); // 'id' is a property key, not a variable
  });

  it("should handle complex async gates (Production Case)", () => {
    const code = "async (data, tools) => { const user = await db.users.find({ id: data.userId }); if (!user) return tools.send.error('not_found'); return tools.send.next({ ...user, meta: 'processed' }); }";
    const deps = getFnUndeclared(code);
    expect(deps).toContain("db");
    expect(deps).not.toContain("data");
    expect(deps).not.toContain("tools");
    expect(deps).not.toContain("user");
  });

  it("should detect Zod (z) when used inside a gate", () => {
    const code = "(data, tools) => { const schema = z.string().email(); if (schema.safeParse(data.email).success) return tools.send.ok(data); return tools.send.fail(); }";
    const deps = getFnUndeclared(code);
    expect(deps).toEqual(["z"]);
  });

  it("should detect multiple external tools (logger, fetch, db)", () => {
    const code = "async (data) => { logger.info('fetching...'); const res = await fetch(API_URL); return db.save(res); }";
    const deps = getFnUndeclared(code);
    expect(deps).toContain("logger");
    expect(deps).toContain("fetch");
    expect(deps).toContain("API_URL");
    expect(deps).toContain("db");
  });
});

