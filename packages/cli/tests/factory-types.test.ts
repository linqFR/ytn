import { expectTypeOf, test } from "vitest";

import { execute, executeContract } from "../src/factory.js";
import { createContract } from "../src/contract.js";
import type { IHandlers, OExecuteResult, OHandlerResult } from "../src/types/contract.types.js";
import { routes } from "./fixtures.js";

// Type-regression tests locking in the discriminated-union narrowing of
// execute() and executeContract(). Both build their `success` discriminant
// from inline object literals (`{ success: false as const, ... }` /
// `{ success: true as const, ... }`). Without the `as const` on those
// literals, TypeScript widens `success` to `boolean` in the inferred return
// type, which silently turns `if (result.success) result.payload` into a
// `possibly undefined` error at every call site (see mailbox-2026-08-18,
// entries 02:21-02:53, for the full root-cause analysis).

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  routes,
  cli: { positionals: ["cmd", "files"] },
});

test("execute() return type is a discriminated union matching OExecuteResult", () => {
  const result = execute(processed, []);
  // `toEqualTypeOf` on a raw 2-shape union of object types is unreliable in
  // vitest's expectTypeOf (see dna's assignability.test.ts, which only uses
  // it on unions of primitives). Assert narrowing branch by branch instead —
  // that's the actual regression this test guards against (the `success`
  // discriminant staying a literal `true`/`false`, not widened to `boolean`).
  expectTypeOf<OExecuteResult>().toExtend<typeof result>();
  expectTypeOf(result).toExtend<OExecuteResult>();

  if (result.success) {
    expectTypeOf(result.payload).toEqualTypeOf<Record<string, unknown>>();
    expectTypeOf(result.route).toEqualTypeOf<string>();
  } else {
    expectTypeOf(result.errors).not.toBeAny();
  }
});

test("executeContract()'s handler-dispatch transform preserves OHandlerResult as a discriminated union", () => {
  const handlers: IHandlers = {
    build: () => ({ success: true, data: {} }),
  };
  const executable = executeContract(processed, handlers);
  type Output = (typeof executable.pipeline)["_output"];
  expectTypeOf<OHandlerResult>().toExtend<Output>();
  expectTypeOf<Output>().toExtend<OHandlerResult>();
});
