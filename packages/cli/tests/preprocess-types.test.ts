import { expectTypeOf, test } from "vitest";
import { dna } from "@ytrynot/dna";

import { buildPipeline } from "../src/preprocess.js";
import { ROUTE_ID_KEY } from "../src/routeId.js";
import type {
  IFlagMap,
  OParseArgsConfig,
  OPositionalMeta,
} from "../src/types/contract.types.js";

// Type-regression test for the generic <S> parameter on buildPipeline.
//
// buildPipeline must be generic on S extends readonly DnaSomeType[] so that
// DnaCliUnion<S> preserves the "\x00ID": string key injected by createContract()
// via .extend({ [ROUTE_ID_KEY]: dna.string().default(routeId) }).
//
// Without the generic, S is erased to readonly DnaSomeType[] and
// $Output<S[number]> becomes unknown, losing the "\x00ID" key. This breaks
// the extract transform's type-level access to v["\x00ID"] and degrades
// the pipeline output's `route` field from `string` to `any`.

// --- Build routes with \x00ID injected, mirroring createContract()'s apply() ---

const buildRoute = dna
  .object({
    cmd: dna.literal("build"),
    files: dna.array(dna.string()).optional(),
  })
  .apply((schema) =>
    schema.extend({ [ROUTE_ID_KEY]: dna.string().default("build") }),
  );

const deployRoute = dna
  .object({
    cmd: dna.literal("deploy"),
    target: dna.string().optional(),
  })
  .apply((schema) =>
    schema.extend({ [ROUTE_ID_KEY]: dna.string().default("deploy") }),
  );

const injectedRoutes = [buildRoute, deployRoute] as const;
const cliUnion = dna.cliUnion(injectedRoutes);

// Minimal config objects — runtime values don't matter for type assertions
// (expectTypeOf is a no-op at runtime), but must be structurally valid.
const parseArgsConfig: OParseArgsConfig = {
  allowPositionals: true,
  strict: false,
  options: {},
};
const positionalMeta: OPositionalMeta[] = [{ name: "cmd", variadic: false }];
const flagMap: IFlagMap = {};

const pipeline = buildPipeline(
  cliUnion,
  parseArgsConfig,
  positionalMeta,
  flagMap,
);

test("dna.cliUnion() from \\x00ID-injected routes carries \"\\x00ID\": string in _output", () => {
  type CliUnionOutput = (typeof cliUnion)["_output"];
  expectTypeOf<CliUnionOutput>()
    .toHaveProperty(ROUTE_ID_KEY)
    .toEqualTypeOf<string>();
});

test("buildPipeline preserves cliUnion._output \"\\x00ID\" via generic <S> — pipeline route is string, not any", () => {
  // `.toEqualTypeOf<string>()` alone is sufficient: it uses strict type
  // identity (StrictEqualUsingTSInternalIdenticalToOperator), not bidirectional
  // assignability, so it already catches `any` (an `any` field would fail this
  // assertion). Do NOT add `.not.toBeAny()` here — when the checked type IS
  // `any`, that assertion resolves to a non-callable type
  // (`Inverted<ExpectAny<any>>`), producing a cryptic TS2349 "This expression
  // is not callable" instead of a clear failure. See
  // .devin/skills/ytn-type-regression/LESSONS-LEARNED.md.
  type PipelineOutput = (typeof pipeline)["_output"];
  expectTypeOf<PipelineOutput>()
    .toHaveProperty("route")
    .toEqualTypeOf<string>();
});
