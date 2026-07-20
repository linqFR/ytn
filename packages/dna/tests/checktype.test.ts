import { describe, it, expectTypeOf } from "vitest";
import { dna } from "../src/index.js";

describe("Type API testing - Primitive Types", () => {
  it("must be of type string", () => {
    const dnaSchema = dna.string();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string>();
  });
  it("must be of type string", () => {
    const dnaSchema = dna.string().min(3);
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string>();
  });

  it("must be of type number", () => {
    const dnaSchema = dna.number();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<number>();
  });

  it("must be of type integer", () => {
    const dnaSchema = dna.int();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<number>();
  });

  it("must be of type integer32", () => {
    const dnaSchema = dna.int32();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<number>();
  });

  it("must be of type bigint", () => {
    const dnaSchema = dna.bigint();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<bigint>();
  });

  it("must be of type boolean", () => {
    const dnaSchema = dna.boolean();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<boolean>();
  });

  it("must be of type Date", () => {
    const dnaSchema = dna.date();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<Date>();
  });
});

describe("Type API testing - Primitive Type Inferences", () => {
  it("must be of type string", () => {
    const dnaSchema = dna.string();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string>();
  });

  it("must be of type number", () => {
    const dnaSchema = dna.number();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<number>();
  });

  it("must be of type integer = number)", () => {
    const dnaSchema = dna.int();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<number>();
  });

  it("must be of type integer32 = number", () => {
    const dnaSchema = dna.int32();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<number>();
  });

  it("must be of type bigint", () => {
    const dnaSchema = dna.bigint();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<bigint>();
  });

  it("must be of type boolean", () => {
    const dnaSchema = dna.boolean();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<boolean>();
  });

  it("must be of type Date", () => {
    const dnaSchema = dna.date();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<Date>();
  });
});

describe("Type API testing - Special Types", () => {
  it("must be of type any", () => {
    const dnaSchema = dna.any();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<any>();
  });

  it("must be of type unknown", () => {
    const dnaSchema = dna.unknown();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<unknown>();
  });

  it("must be of type never", () => {
    const dnaSchema = dna.never();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<never>();
  });

  it("must be of type literal", () => {
    const dnaSchema = dna.literal("hello");
    expectTypeOf(dnaSchema._output).toEqualTypeOf<"hello">();
    expectTypeOf(dnaSchema._output).not.toEqualTypeOf<"helto">();
  });

  it("must be of type enum", () => {
    const dnaSchema = dna.enum(["a", "b", "c"] as const);
    expectTypeOf(dnaSchema._output).toEqualTypeOf<"a" | "b" | "c">();
  });
});

describe("Type API testing - Composite Types", () => {
  it("must be of type object", () => {
    const dnaSchema = dna.object({ name: dna.string(), age: dna.number() });
    expectTypeOf(dnaSchema._output).toEqualTypeOf<{ name: string; age: number }>();
  });

  it("must be of type array", () => {
    const dnaSchema = dna.array(dna.string());
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string[]>();
  });

  it("must be of type union", () => {
    const dnaSchema = dna.union([dna.string(), dna.number()]);
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string | number>();
  });
});

describe("Type API testing - Wrapper Types", () => {
  it("must be of type optional", () => {
    const dnaSchema = dna.string().optional();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string | undefined>();
  });

  it("must be of type nullable", () => {
    const dnaSchema = dna.string().nullable();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string | null>();
  });

  it("must be of type nullish", () => {
    const dnaSchema = dna.string().nullish();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string | null | undefined>();
  });

  it("must be of type default", () => {
    const dnaSchema = dna.string().default("default");
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string>();
  });

  it("must be of type prefault", () => {
    const dnaSchema = dna.string().prefault("prefault");
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string>();
  });
});

describe("Type API testing - String Format Types", () => {
  it("email must return string", () => {
    expectTypeOf(dna.email()._output).toEqualTypeOf<string>();
  });

  it("url must return string", () => {
    expectTypeOf(dna.url()._output).toEqualTypeOf<string>();
  });

  it("uuid must return string", () => {
    expectTypeOf(dna.uuid()._output).toEqualTypeOf<string>();
  });

  it("hostname must return string", () => {
    expectTypeOf(dna.hostname()._output).toEqualTypeOf<string>();
  });

  it("base64 must return string", () => {
    expectTypeOf(dna.base64()._output).toEqualTypeOf<string>();
  });

  it("hex must return string", () => {
    expectTypeOf(dna.hex()._output).toEqualTypeOf<string>();
  });
});

describe("Type API testing - Other Types", () => {
  it("instanceof must return Date", () => {
    const dnaSchema = dna.instanceof(Date);
    expectTypeOf(dnaSchema._output).toEqualTypeOf<Date>();
  });

  it("symbol must return symbol", () => {
    const dnaSchema = dna.symbol();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<symbol>();
  });

  it("void must return void", () => {
    const dnaSchema = dna.void();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<void>();
  });

  it("nan must return typeof NaN", () => {
    const dnaSchema = dna.nan();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<number>();
  });

  it("file must return File", () => {
    const dnaSchema = dna.file();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<File>();
  });
});

describe("Type API testing - Coerce Variants", () => {
  it("coerce.string must return string", () => {
    const dnaSchema = dna.coerce.string();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string>();
  });

  it("coerce.number must return number", () => {
    const dnaSchema = dna.coerce.number();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<number>();
  });

  it("coerce.boolean must return boolean", () => {
    const dnaSchema = dna.coerce.boolean();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<boolean>();
  });

  it("coerce.bigint must return bigint", () => {
    const dnaSchema = dna.coerce.bigint();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<bigint>();
  });

  it("coerce.date must return Date", () => {
    const dnaSchema = dna.coerce.date();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<Date>();
  });
});

describe("Type API testing - ISO Variants", () => {
  it("iso.datetime must return string", () => {
    expectTypeOf(dna.iso.datetime()._output).toEqualTypeOf<string>();
  });

  it("iso.date must return string", () => {
    expectTypeOf(dna.iso.date()._output).toEqualTypeOf<string>();
  });

  it("iso.time must return string", () => {
    expectTypeOf(dna.iso.time()._output).toEqualTypeOf<string>();
  });

  // it("iso.duration must return string", () => {
  //   expectTypeOf(dna.iso.duration()._output).toEqualTypeOf<string>();
  // });
});

describe("Assess types of combinations : or, and, xor, intersection", () => {
  it("union (or) must return tsDnaUnion", () => {
    const dnaSchema = dna.union([dna.string(), dna.number()]);
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string | number>();
  });
  it("union (or) must return tsDnaUnion", () => {
    const dnaSchema = dna.string().or(dna.number());
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string | number>();
  });
  it(".and must return mix of types", () => {
    const dnaSchema = dna.string().and(dna.number());
    expectTypeOf(dnaSchema._output).toEqualTypeOf<string & number>();
  });

  it("intersection (and) must return IDnaSchemaBase with intersection type", () => {
    const schema1 = dna.object({ name: dna.string() });
    const schema2 = dna.object({ age: dna.number() });
    const dnaSchema = dna.intersection(schema1, schema2);
    expectTypeOf(dnaSchema._output).toEqualTypeOf<{ name: string } & { age: number }>();
  });
})