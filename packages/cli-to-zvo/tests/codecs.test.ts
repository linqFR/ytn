import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  jsonCodec,
  jsonlCodec,
  jsonSchemaCodec,
  stringListCodec,
} from "@ytn/shared/zod/codecs.js";

describe("listCodec", () => {
  it("should decode a comma-separated string into an array", () => {
    expect(stringListCodec.parse("a, b, c")).toEqual(["a", "b", "c"]);
    expect(stringListCodec.parse("apple,banana, cherry")).toEqual([
      "apple",
      "banana",
      "cherry",
    ]);
  });

  it("should encode an array into a comma-separated string", () => {
    expect(stringListCodec.encode(["a", "b", "c"])).toBe("a, b, c");
  });
});

describe("jsonCodec", () => {
  it("should decode a JSON string into an object", () => {
    const json = '{"name": "Alice", "age": 30}';
    expect(jsonCodec.parse(json)).toEqual({ name: "Alice", age: 30 });
  });

  it("should encode an object into a JSON string", () => {
    const obj = { name: "Alice", age: 30 };
    expect(jsonCodec.encode(obj)).toBe(JSON.stringify(obj));
  });

  it("should throw on invalid JSON", () => {
    expect(() => jsonCodec.parse("{invalid}")).toThrow();
  });
});

describe("jsonlCodec", () => {
  it("should decode newline-separated JSON into an array", () => {
    const jsonl = '{"id": 1}\n{"id": 2}\n{"id": 3}';
    expect(jsonlCodec.parse(jsonl)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("should encode an array into newline-separated JSON", () => {
    const arr = [{ id: 1 }, { id: 2 }];
    expect(jsonlCodec.encode(arr)).toBe('{"id":1}\n{"id":2}');
  });

  it("should skip empty lines", () => {
    const jsonl = '{"id": 1}\n\n{"id": 2}';
    expect(jsonlCodec.parse(jsonl)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("should throw on invalid JSON line", () => {
    const jsonl = '{"id": 1}\n{invalid}';
    expect(() => jsonlCodec.parse(jsonl)).toThrow();
  });
});

describe("jsonSchemaCodec", () => {
  it("should decode a JSON Schema string into a Zod schema", () => {
    const schemaString = JSON.stringify({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    });

    // Use parse to decode
    const zodSchema = jsonSchemaCodec.parse(schemaString);

    expect(zodSchema).toBeDefined();
    // The result should be a Zod schema we can use
    const validData = { name: "Alice", age: 30 };
    const invalidData = { age: 30 };

    expect(zodSchema.parse(validData)).toEqual(validData);
    expect(() => zodSchema.parse(invalidData)).toThrow();
  });

  it("should decode a complex JSON Schema string", () => {
    const schemaString = JSON.stringify({
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
        },
        metadata: {
          type: "object",
          properties: {
            id: { type: "integer" },
          },
        },
      },
    });

    const zodSchema = jsonSchemaCodec.parse(schemaString);

    const valid = { tags: ["a", "b"], metadata: { id: 1 } };
    expect(zodSchema.parse(valid)).toEqual(valid);

    const invalid = { tags: [1], metadata: { id: "one" } };
    expect(() => zodSchema.parse(invalid)).toThrow();
  });

  it("should encode a Zod schema into a JSON Schema string", () => {
    const zodSchema = z.object({
      name: z.string(),
      age: z.number().optional(),
    }) as any;

    const encoded = jsonSchemaCodec.encode(zodSchema);

    const parsedEncoded = JSON.parse(encoded);
    expect(parsedEncoded.type).toBe("object");
    expect(parsedEncoded.properties.name.type).toBe("string");
  });

  it("should throw on invalid JSON string", () => {
    const invalidJson = "{ invalid: json }";

    expect(() => jsonSchemaCodec.parse(invalidJson)).toThrow();
  });
});
