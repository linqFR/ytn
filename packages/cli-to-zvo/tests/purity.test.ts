import { describe, it, expect } from "vitest";
import { contractDef } from "../src/cli-contract-validator.js";
import { CZVO } from "../src/cli-types.js";
import { ZodType, ZodArray } from "zod";

describe("Type Purity and Sealing", () => {
  it("should unwrap sealed types into raw Zod types during enhancement", () => {
    const cli = contractDef({
      name: "test",
      description: "test enhanced purity",
      def: {
        tags: {
          type: CZVO.list(CZVO.string().min(3).max(15)),
          description: "List of tags",
        },
      },
      targets: {},
    });

    const enhanced = cli.enhanced;
    const tagsType = enhanced.def.tags.type;

    // 1. The enhanced type should be a pure ZodType (it's a Pipe because of coercion)
    expect(tagsType).toBeInstanceOf(ZodType);
    expect((tagsType as any).type).toBe("pipe");

    // 2. It should NOT be a Proxy (no toZod property on raw Zod types)
    expect((tagsType as any).toZod).toBeUndefined();

    // 3. Drill down into the pipe to find the Array
    // In our implementation: z.coerce.string().pipe(z.preprocess(...))
    // In Zod v4, preprocess is also a pipe.
    const preprocessPipe = (tagsType as any).out;
    expect(preprocessPipe.type).toBe("pipe");
    
    const innerArray = (preprocessPipe as any).out;
    expect(innerArray).toBeInstanceOf(ZodArray);
    expect(innerArray.type).toBe("array");

    // 4. Inner items should be raw ZodTypes
    const itemType = (innerArray as any).element;
    expect(itemType).toBeInstanceOf(ZodType);
    expect((itemType as any).toZod).toBeUndefined();
  });

  it("should be serializable to JSON without Proxy invariant errors", () => {
    const cli = contractDef({
      name: "test",
      description: "test serialization",
      def: {
        tags: {
          type: CZVO.list(CZVO.string().min(3).max(15)),
          description: "List of tags",
        },
      },
      targets: {},
    });

    // This should not throw 'Proxy invariant' or 'Maximum call stack' errors
    const json = JSON.stringify(cli, null, 2);
    console.log("--- Serialized Contract JSON ---");
    console.log(json);
    console.log("-------------------------------");
    
    expect(json).toContain('"name": "test"');
    expect(json).toContain('"minLength": 3');
    expect(json).toContain('"maxLength": 15');
  });

  it("should block forbidden methods at runtime on CZVO types", () => {
    const sealedString = CZVO.string();
    
    // @ts-expect-error - .object() is forbidden
    expect(() => sealedString.object({})).toThrow(/forbidden/);
    
    // @ts-expect-error - .array() is forbidden (use CZVO.list instead)
    expect(() => sealedString.array()).toThrow(/forbidden/);
  });
});
