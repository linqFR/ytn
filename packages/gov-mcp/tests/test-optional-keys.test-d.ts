// Type-regression test: validate that the key-remapping fix for DnaObject output/input types
// resolves the real type errors in gov-mcp test files (coverage.test.ts, e2e-cycles.test.ts, etc.).
//
// The problem: dna.infer<typeof S.xxxInput> produces types where .optional() fields become
// `prop: T | undefined` (required key) instead of `prop?: T` (optional key).
// This causes TS to reject object literals that omit optional fields.
//
// This test uses the REAL gov-mcp schemas and the EXACT object literals that fail.
// Positive cases use direct assignment (the strictest check).
// Negative cases use @ts-expect-error on assignment.
//
// Run with: npx.cmd vitest run packages/gov-mcp/tests/test-optional-keys.test-d.ts --typecheck

import { describe, it, expectTypeOf } from "vitest";
import * as S from "../src/schemas/tool-inputs.js";
import type {
  DnaOptional,
  DnaNullish,
  DnaDefault,
  DnaPrefault,
  DnaExactOptional,
  DnaSomeType,
  DnaLazy,
} from "@ytrynot/dna/core";

// $Output/$Input are not re-exported from @ytrynot/dna/core, so we inline them.
// These match the definitions in packages/dna/src/types/helpers.types.ts.
type $Output<S> = S extends { _output: any } ? S["_output"] : unknown;
type $Input<S> = S extends { _input: any } ? S["_input"] : unknown;

// ─── Proposed fix: key remapping with recursive lazy unwrap ──────────────────

type $OptionalOutSchema =
  | DnaOptional<any>
  | DnaNullish<any>
  | DnaDefault<any, any>
  | DnaPrefault<any>
  | DnaExactOptional<any>;

type $IsOptionalKey<S> =
  S extends DnaLazy<any, any, infer Inner>
    ? $IsOptionalKey<Inner>
    : S extends $OptionalOutSchema
      ? true
      : false;

type $DnaObjectOutputFixed<T extends Record<string, DnaSomeType>> = {
  [K in keyof T as $IsOptionalKey<T[K]> extends true ? never : K]: $Output<T[K]>
} & {
  [K in keyof T as $IsOptionalKey<T[K]> extends true ? K : never]?: $Output<T[K]>
};

type $DnaObjectInputFixed<T extends Record<string, DnaSomeType>> = {
  [K in keyof T as $IsOptionalKey<T[K]> extends true ? never : K]: $Input<T[K]>
} & {
  [K in keyof T as $IsOptionalKey<T[K]> extends true ? K : never]?: $Input<T[K]>
};

// Helper: extract shape from a DnaObject schema via the `shape` getter
type ShapeOf<O> = O extends { shape: infer T extends Record<string, DnaSomeType> } ? T : never;
type FixedInput<O> = $DnaObjectInputFixed<ShapeOf<O>>;
type FixedOutput<O> = $DnaObjectOutputFixed<ShapeOf<O>>;

// ─── Tests with REAL gov-mcp schemas ─────────────────────────────────────────

describe("registerWriterInput — real schema", () => {
  // From coverage.test.ts line 27: { id: "admin", role: "admin" } should be valid
  it("accepts minimal object with only required fields (id, role)", () => {
    const _ok: FixedInput<typeof S.registerWriterInput> = { id: "admin", role: "admin" };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.registerWriterInput>>();
  });

  it("accepts object with some optional fields", () => {
    const _ok: FixedInput<typeof S.registerWriterInput> = { id: "devin", role: "agent", responsibility: "dev" };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.registerWriterInput>>();
  });

  it("rejects object missing required field (id)", () => {
    // @ts-expect-error missing required field 'id'
    const _bad: FixedInput<typeof S.registerWriterInput> = { role: "admin" };
    void _bad;
  });
});

describe("createDecisionInput — real schema with pipe+optional and transform", () => {
  // From coverage.test.ts line 245: { nanoid, title, decider, forcedNumId } should be valid
  // scope is scopeOrScopesSchema = .transform().optional() → optional key
  // date is dateSchema = .transform() → required key (pipe, not optional)
  it("accepts minimal object with only required fields", () => {
    const _ok: FixedInput<typeof S.createDecisionInput> = {
      nanoid: "abc",
      title: "Test",
      decider: "admin",
      forcedNumId: 1,
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.createDecisionInput>>();
  });

  it("accepts object with optional fields filled", () => {
    const _ok: FixedInput<typeof S.createDecisionInput> = {
      nanoid: "abc",
      title: "Test",
      decider: "admin",
      forcedNumId: 1,
      status: "Accepted",
      context: "some context",
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.createDecisionInput>>();
  });

  it("rejects object missing required field (title)", () => {
    // @ts-expect-error missing required field 'title'
    const _bad: FixedInput<typeof S.createDecisionInput> = {
      nanoid: "abc",
      decider: "admin",
      forcedNumId: 1,
    };
    void _bad;
  });
});

describe("createActionInput — real schema", () => {
  // From coverage.test.ts line 43: { nanoid, title, forcedNumId } should be valid
  it("accepts minimal object with only required fields", () => {
    const _ok: FixedInput<typeof S.createActionInput> = {
      nanoid: "abc",
      title: "Test",
      forcedNumId: 1,
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.createActionInput>>();
  });

  it("accepts object with dependencies array", () => {
    const _ok: FixedInput<typeof S.createActionInput> = {
      nanoid: "abc",
      title: "Test",
      forcedNumId: 1,
      dependencies: ["ACT-0001"],
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.createActionInput>>();
  });
});

describe("createSpecInput — real schema", () => {
  // From coverage.test.ts line 65: { nanoid, id, filename, version } should be valid
  it("accepts minimal object with only required fields", () => {
    const _ok: FixedInput<typeof S.createSpecInput> = {
      nanoid: "abc",
      id: "SPEC-0001",
      filename: "spec.md",
      version: 1,
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.createSpecInput>>();
  });

  it("accepts object with scope array", () => {
    const _ok: FixedInput<typeof S.createSpecInput> = {
      nanoid: "abc",
      id: "SPEC-0001",
      filename: "spec.md",
      version: 1,
      scope: ["ytn"],
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.createSpecInput>>();
  });
});

describe("updateActionStatusInput — real schema", () => {
  // From coverage.test.ts line 225: { nanoid, id, newStatus: "done" } should be valid
  it("accepts minimal object with only required fields", () => {
    const _ok: FixedInput<typeof S.updateActionStatusInput> = {
      nanoid: "abc",
      id: "ACT-0001",
      newStatus: "done",
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.updateActionStatusInput>>();
  });

  it("accepts object with evidence", () => {
    const _ok: FixedInput<typeof S.updateActionStatusInput> = {
      nanoid: "abc",
      id: "ACT-0001",
      newStatus: "done",
      evidence: "done",
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.updateActionStatusInput>>();
  });
});

describe("updateDecisionStatusInput — real schema", () => {
  // From e2e-cycles.test.ts line 296: { nanoid, id, newStatus: "Cancelled", reason } should be valid
  it("accepts minimal object with only required fields", () => {
    const _ok: FixedInput<typeof S.updateDecisionStatusInput> = {
      nanoid: "abc",
      id: "DEC-0001",
      newStatus: "Cancelled",
      reason: "obsolete",
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.updateDecisionStatusInput>>();
  });
});

describe("updateIdeaStatusInput — real schema", () => {
  // From e2e-cycles.test.ts line 136: { nanoid, id, newStatus: "promoted", promotedTo } should be valid
  it("accepts minimal object with only required fields", () => {
    const _ok: FixedInput<typeof S.updateIdeaStatusInput> = {
      nanoid: "abc",
      id: "IDEA-0001",
      newStatus: "promoted",
      promotedTo: "DEC-0001",
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.updateIdeaStatusInput>>();
  });
});

describe("updateSpecStatusInput — real schema", () => {
  // From e2e-cycles.test.ts line 246: { nanoid, id, newStatus: "ready" } should be valid
  it("accepts minimal object with only required fields", () => {
    const _ok: FixedInput<typeof S.updateSpecStatusInput> = {
      nanoid: "abc",
      id: "SPEC-0001",
      newStatus: "ready",
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.updateSpecStatusInput>>();
  });
});

describe("updateProblemStatusInput — real schema", () => {
  // From e2e-cycles.test.ts line 251: { nanoid, id, newStatus: "fixed", fix } should be valid
  it("accepts minimal object with only required fields", () => {
    const _ok: FixedInput<typeof S.updateProblemStatusInput> = {
      nanoid: "abc",
      id: "PB-0001",
      newStatus: "fixed",
      fix: "patched",
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.updateProblemStatusInput>>();
  });
});

describe("createScopeInput — real schema", () => {
  // From coverage.test.ts line 143: { nanoid, id, label } should be valid
  it("accepts minimal object with only required fields", () => {
    const _ok: FixedInput<typeof S.createScopeInput> = {
      nanoid: "abc",
      id: "ytn",
      label: "YTN",
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.createScopeInput>>();
  });

  it("accepts object with parent and sortOrder", () => {
    const _ok: FixedInput<typeof S.createScopeInput> = {
      nanoid: "abc",
      id: "ytn",
      label: "YTN",
      parent: "workspace",
      sortOrder: 1,
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.createScopeInput>>();
  });
});

describe("createProblemInput — real schema", () => {
  // From coverage.test.ts line 306: { nanoid, title, severity: "LOW", type: "code", forcedNumId } should be valid
  it("accepts minimal object with only required fields", () => {
    const _ok: FixedInput<typeof S.createProblemInput> = {
      nanoid: "abc",
      title: "Bug",
      severity: "LOW",
      type: "code",
      forcedNumId: 1,
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.createProblemInput>>();
  });
});

describe("appendLogEntryInput — real schema with transform (dateSchema)", () => {
  // date is dateSchema = dna.coerce.date().transform() → DnaPipe, NOT optional → required key
  // Note: coerce.date() has _input: Date (a pre-existing typing issue, not related to key remapping).
  // We test the key-remapping behavior: date is required, optional fields are ?:.
  it("date is a required key (not optional)", () => {
    // @ts-expect-error missing required field 'date'
    const _bad: FixedInput<typeof S.appendLogEntryInput> = {
      nanoid: "abc",
      type: "status",
      subject: "s",
      body: "b",
    };
    void _bad;
  });

  it("optional fields (audience, subject, body, refId, scope, replyTo, threadId) are optional keys", () => {
    // An object with only required fields (nanoid, date, type) should be assignable
    // date's _input is Date (pre-existing coerce typing), so we use Date here
    const _ok: FixedInput<typeof S.appendLogEntryInput> = {
      nanoid: "abc",
      date: new Date(),
      type: "status",
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.appendLogEntryInput>>();
  });
});

describe("listDecisionsInput — real schema (all optional query params)", () => {
  // From coverage.test.ts line 436: { status: "Accepted" } should be valid
  // All fields are optional → empty object should be valid too
  it("accepts empty object (all fields optional)", () => {
    const _ok: FixedInput<typeof S.listDecisionsInput> = {};
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.listDecisionsInput>>();
  });

  it("accepts object with status only", () => {
    const _ok: FixedInput<typeof S.listDecisionsInput> = { status: "Accepted" };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.listDecisionsInput>>();
  });

  it("accepts object with scope and withChildren", () => {
    const _ok: FixedInput<typeof S.listDecisionsInput> = { scope: "ytn", withChildren: false };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.listDecisionsInput>>();
  });
});

describe("getFreeFieldsInput — real schema", () => {
  // From free-fields.test.ts line 48: { entityType: "decision", entityId: "DEC-0001" } should be valid
  it("accepts minimal object with only required fields", () => {
    const _ok: FixedInput<typeof S.getFreeFieldsInput> = {
      entityType: "decision",
      entityId: "DEC-0001",
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.getFreeFieldsInput>>();
  });
});

describe("addFreeFieldInput — real schema", () => {
  // From free-fields.test.ts line 67: object with all required fields but missing ftsIndexed should be valid
  it("accepts object without optional ftsIndexed", () => {
    const _ok: FixedInput<typeof S.addFreeFieldInput> = {
      nanoid: "abc",
      entityType: "action",
      entityId: "ACT-0001",
      key: "ref",
      format: "md",
      value: "content",
    };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.addFreeFieldInput>>();
  });
});

describe("searchMailboxInput — real schema", () => {
  // From coverage.test.ts line 701: { query: "something" } should be valid
  it("accepts object with only required field (query)", () => {
    const _ok: FixedInput<typeof S.searchMailboxInput> = { query: "something" };
    expectTypeOf(_ok).toEqualTypeOf<FixedInput<typeof S.searchMailboxInput>>();
  });
});
