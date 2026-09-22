import { fromJsonSchema, type JsonSchemaType } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { e2eSuite } from "./e2e-suite.js";

/**
 * Plain JSON Schema draft-2020-12 documents (json-schema.org standard).
 * The MCP spec only requires the JSON Schema document to be advertised in
 * tools/list — the SDK's `fromJsonSchema` wraps it into the Standard Schema
 * contract. No validator is passed: the SDK resolves its default provider,
 * and the choice stays with whoever configures the server.
 */
// Mirrors the spec's "default 2020-12 schema" example: no `$schema` field —
// the document defaults to draft 2020-12 per the MCP spec.
const GREET_INPUT_SCHEMA = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
  additionalProperties: false,
};

const GREET_OUTPUT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: { greeting: { type: "string" } },
  required: ["greeting"],
  additionalProperties: false,
};

const NAMES_OUTPUT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "array",
  items: { type: "string" },
};

const input = fromJsonSchema<{ name: string }>(GREET_INPUT_SCHEMA);
const output = fromJsonSchema(GREET_OUTPUT_SCHEMA);
const arrayOutput = fromJsonSchema<string[]>(NAMES_OUTPUT_SCHEMA);

e2eSuite("json-schema", {
  input,
  output,
  arrayOutput,
  description: "Greets by name.",
  expectedDescription: "Greets by name.",
  parseName: (v) => {
    // CAST: the SDK validates input against GREET_INPUT_SCHEMA before the
    // handler runs (tools/call); the handler only reads the validated field.
    return (v as { name: string }).name;
  },
});

describe("declared JSON Schema dialects", () => {
  // Spec example "tool with explicit draft-07 schema": `$schema` may declare
  // an older dialect. Draft-07 uses the tuple form `items: [schema, ...]` +
  // `additionalItems`, both ignored under 2020-12 (replaced by `prefixItems` /
  // `items`) — so if the validator mis-routed this document to the 2020-12
  // dialect, ["a","b"] would pass instead of failing.
  const DRAFT7_TUPLE_SCHEMA = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "array",
    items: [{ type: "string" }],
    additionalItems: false,
  };

  it("routes an explicit draft-07 document to the draft-07 dialect", async () => {
    // CAST: JsonSchemaType models 2020-12 keyword shapes — draft-07's tuple
    // `items` form is a valid document but outside that type.
    const schema = fromJsonSchema<string[]>(DRAFT7_TUPLE_SCHEMA as JsonSchemaType);
    const validate = schema["~standard"].validate;

    // validate may return a Result or Promise<Result> per Standard Schema —
    // await handles both.
    expect(await validate(["a"])).toMatchObject({ value: ["a"] });
    expect(await validate(["a", "b"])).toHaveProperty("issues");
  });
});
