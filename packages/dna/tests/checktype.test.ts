import { describe, it, expectTypeOf } from "vitest";
import { dna } from "../src/index.js";

describe("Type API testing - Primitive Types", () => {
  it("must be of type tsDnaString()", () => {
    const dnaSchema = dna.string();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaString>();
  });
  it("must be of type tsDnaString()", () => {
    const dnaSchema = dna.string().min(3);
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaString>();
  });

  it("must be of type tsDnaNumber()", () => {
    const dnaSchema = dna.number();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaNumber>();
  });

  it("must be of type tsDnaInteger()", () => {
    const dnaSchema = dna.int();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaInteger>();
  });

  it("must be of type tsDnaInteger32()", () => {
    const dnaSchema = dna.int32();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaInteger32>();
  });

  it("must be of type tsDnaBigInt()", () => {
    const dnaSchema = dna.bigint();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaBigInt>();
  });

  it("must be of type tsDnaBoolean()", () => {
    const dnaSchema = dna.boolean();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaBoolean>();
  });

  it("must be of type tsDnaDate()", () => {
    const dnaSchema = dna.date();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaDate>();
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
  it("must be of type tsDnaAny()", () => {
    const dnaSchema = dna.any();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaAny>();
  });

  it("must be of type tsDnaUnknown()", () => {
    const dnaSchema = dna.unknown();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaUnknown>();
  });

  it("must be of type tsDnaNever()", () => {
    const dnaSchema = dna.never();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaNever>();
  });

  it("must be of type tsDnaLiteral()", () => {
    const dnaSchema = dna.literal("hello");
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaLiteral<"hello">>();
    expectTypeOf(dnaSchema).not.toEqualTypeOf<dna.tsDnaLiteral<"helto">>();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<"hello">();
    expectTypeOf(dnaSchema._output).not.toEqualTypeOf<"helto">();
  });

  it("must be of type tsDnaEnum()", () => {
    const dnaSchema = dna.enum(["a", "b", "c"] as const);
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaEnum<["a", "b", "c"]>>();
  });
});

describe("Type API testing - Composite Types", () => {
  it("must be of type tsDnaObject()", () => {
    const dnaSchema = dna.object({ name: dna.string(), age: dna.number() });
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaObject<{ name: string; age: number }>>();
    expectTypeOf(dnaSchema._output).toEqualTypeOf<{ name: string; age: number }>();

  });

  it("must be of type tsDnaArray()", () => {
    const dnaSchema = dna.array(dna.string());
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaArray<dna.tsDnaString>>();
  });

  it("must be of type tsDnaUnion()", () => {
    const dnaSchema = dna.union([dna.string(), dna.number()]);
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaUnion<string | number>>();
  });
});

describe("Type API testing - Wrapper Types", () => {
  it("must be of type tsDnaOptional()", () => {
    const dnaSchema = dna.string().optional();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaOptional<string, string>>();
  });

  it("must be of type tsDnaNullable()", () => {
    const dnaSchema = dna.string().nullable();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaNullable<string, string>>();
  });

  it("must be of type tsDnaNullish()", () => {
    const dnaSchema = dna.string().nullish();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaNullish<string, string>>();
  });

  it("must be of type tsDnaDefault()", () => {
    const dnaSchema = dna.string().default("default");
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaDefault<string, string>>();
  });

  it("must be of type tsDnaPrefault()", () => {
    const dnaSchema = dna.string().prefault("prefault");
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaPrefault<string, string>>();
  });
});

describe("Type API testing - String Format Types", () => {
  it("email must return tsDnaString", () => {
    expectTypeOf(dna.email()).toEqualTypeOf<dna.tsDnaEmail>();
  });

  it("url must return tsDnaUrl", () => {
    expectTypeOf(dna.url()).toEqualTypeOf<dna.tsDnaUrl>();
  });

  it("uuid must return tsDnaString", () => {
    expectTypeOf(dna.uuid()).toEqualTypeOf<dna.tsDnaUUID>();
  });

  it("hostname must return tsDnaString", () => {
    expectTypeOf(dna.hostname()).toEqualTypeOf<dna.tsDnaHostname>();
  });

  it("base64 must return tsDnaString", () => {
    expectTypeOf(dna.base64()).toEqualTypeOf<dna.tsDnaBase64>();
  });

  it("hex must return tsDnaString", () => {
    expectTypeOf(dna.hex()).toEqualTypeOf<dna.tsDnaHex>();
  });
});

describe("Type API testing - Other Types", () => {
  it("instanceof must return tsDnaInstanceOf", () => {
    const dnaSchema = dna.instanceof(Date);
    expectTypeOf(dnaSchema._output).toEqualTypeOf<Date>();
  });

  it("symbol must return IDnaSchemaBase<symbol>", () => {
    const dnaSchema = dna.symbol();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaSymbol>();
  });

  it("void must return IDnaSchemaBase<void>", () => {
    const dnaSchema = dna.void();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaVoid>();
  });

  it("nan must return IDnaSchemaBase<typeof NaN>", () => {
    const dnaSchema = dna.nan();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaNan>();
  });

  it("file must return tsDnaInstanceOf<File, File>", () => {
    const dnaSchema = dna.file();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaInstanceOf<File>>();
  });
});

describe("Type API testing - Coerce Variants", () => {
  it("coerce.string must return tsDnaString", () => {
    const dnaSchema = dna.coerce.string();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaString>();
  });

  it("coerce.number must return tsDnaNumber", () => {
    const dnaSchema = dna.coerce.number();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaNumber>();
  });

  it("coerce.boolean must return tsDnaBoolean", () => {
    const dnaSchema = dna.coerce.boolean();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaBoolean>();
  });

  it("coerce.bigint must return tsDnaBigInt", () => {
    const dnaSchema = dna.coerce.bigint();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaBigInt>();
  });

  it("coerce.date must return tsDnaDate", () => {
    const dnaSchema = dna.coerce.date();
    expectTypeOf(dnaSchema).toEqualTypeOf<dna.tsDnaDate>();
  });
});

describe("Type API testing - ISO Variants", () => {
  it("iso.datetime must return tsDnaString", () => {
    expectTypeOf(dna.iso.datetime()).toEqualTypeOf<dna.tsDnaISODateTime>();
  });

  it("iso.date must return tsDnaString", () => {
    expectTypeOf(dna.iso.date()).toEqualTypeOf<dna.tsDnaISODate>();
  });

  it("iso.time must return tsDnaString", () => {
    expectTypeOf(dna.iso.time()).toEqualTypeOf<dna.tsDnaISOTime>();
  });

  it("iso.duration must return tsDnaString", () => {
    expectTypeOf(dna.iso.duration()).toEqualTypeOf<dna.tsDnaISODuration>();
  });
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