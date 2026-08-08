import { expect, expectTypeOf, test } from "vitest";
import {dna} from "../src/index.js";
import * as z from "zod/v4";
const args1 = [dna.string()] as const;
const returns1 = dna.number();
const func1 = dna.function({
  input: args1,
  output: returns1,
});

test("function parsing", () => {
  const parsed = func1.implement((arg: any) => arg.length);
  const result = parsed("asdf");
  expect(result).toBe(4);
});

test("parsed function fail 1", () => {
  // @ts-expect-error
  const parsed = func1.implement((x: string) => x);
  expect(() => parsed("asdf")).toThrow();
});

test("parsed function fail 2", () => {
  // @ts-expect-error
  const parsed = func1.implement((x: string) => x);
  expect(() => parsed(13 as any)).toThrow();
});

test("function inference 1", () => {
  type func1 = (typeof func1)["_input"];
  expectTypeOf<func1>().toEqualTypeOf<(k: string) => number>();
});

test("method parsing", () => {
  const methodObject = dna.object({
    property: dna.number(),
    method: dna
      .function()
      .input([dna.string()])
      .output(dna.number()),
  });
  const methodInstance = {
    property: 3,
    method: function (s: string) {
      return s.length + this.property;
    },
  };
  const parsed = methodObject.parse(methodInstance);
  expect(parsed.method("length=8")).toBe(11); // 8 length + 3 property
});

test("async method parsing", async () => {
  const methodObject = dna.object({
    property: dna.number(),
    method: dna.function().input([dna.string()]).output(dna.promise(dna.number())),
  });
  const methodInstance = {
    property: 3,
    method: async function (s: string) {
      return s.length + this.property;
    },
  };
  const parsed = methodObject.parse(methodInstance);
  expect(await parsed.method("length=8")).toBe(11); // 8 length + 3 property
});

test("args method", () => {
  const t1 = dna.function();
  type t1 = (typeof t1)["_input"];
  expectTypeOf<t1>().toEqualTypeOf<(...args_1: never[]) => unknown>();
  t1._input;

  const t2args = dna.tuple([dna.string()], dna.unknown());

  const t2 = t1.input(t2args);
  type t2 = (typeof t2)["_input"];
  expectTypeOf<t2>().toEqualTypeOf<(arg: string, ...args_1: unknown[]) => unknown>();

  const t3 = t2.output(dna.boolean());
  type t3 = (typeof t3)["_input"];
  expectTypeOf<t3>().toEqualTypeOf<(arg: string, ...args_1: unknown[]) => boolean>();
});

test("input options", () => {
  const t1 = dna.function();

  const fromAsConst = t1.input([dna.string(), dna.unknown()] as const);
  type fromAsConst = (typeof fromAsConst)["_input"];
  expectTypeOf<fromAsConst>().toEqualTypeOf<(arg0: string, arg1: unknown) => unknown>();

  const fromPlain = t1.input([dna.string(), dna.unknown()]);
  type fromPlain = (typeof fromPlain)["_input"];
  expectTypeOf<fromPlain>().toBeFunction();

  const fromTuple = t1.input(dna.tuple([dna.string()], dna.unknown()));
  type fromTuple = (typeof fromTuple)["_input"];
  expectTypeOf<fromTuple>().toBeFunction();

  const fromFactory = dna.function({
    input: [dna.string(), dna.unknown()] as const,
    output: dna.boolean(),
  });
  type fromFactory = (typeof fromFactory)["_input"];
  expectTypeOf<fromFactory>().toEqualTypeOf<(arg0: string, arg1: unknown) => boolean>();
});

// test("custom args", () => {
//   const fn = z.function().implement((_a: string, _b: number) => {
//     return new Date();
//   });

//   expectTypeOf(fn).toEqualTypeOf<(a: string, b: number) => Date>();
// });

const args2 = [
  dna.object({
    f1: dna.number(),
    f2: dna.string().nullable(),
    f3: dna.array(dna.boolean().optional()).optional(),
  }),
] as const;
const returns2 = dna.union([dna.string(), dna.number()]);

const func2 = dna.function({
  input: args2,
  output: returns2,
});

test("function inference 2", () => {
  type func2 = (typeof func2)["_input"];

  expectTypeOf<func2>().toEqualTypeOf<
    (arg: {
      f1: number;
      f2: string | null;
      f3: (boolean | undefined)[] | undefined;
    }) => string | number
  >();
});

test("valid function run", () => {
  const validFunc2Instance = func2.implement((_x) => {
    _x.f2;
    _x.f3![0];
    return "adf" as any;
  });

  validFunc2Instance({
    f1: 21,
    f2: "asdf",
    f3: [true, false],
  });
});

test("f3 omitted and explicit undefined are equivalent", () => {
  const schema = args2[0];
  const parsedOmitted = schema.parse({ f1: 21, f2: "asdf" });
  const parsedExplicit = schema.parse({ f1: 21, f2: "asdf", f3: undefined });
  const expected = { f1: 21, f2: "asdf" };
  expect(parsedOmitted).toEqual(expected);
  expect(parsedExplicit).toEqual(expected);
  expect(parsedOmitted).not.toHaveProperty("f3");
  expect(parsedExplicit).not.toHaveProperty("f3");
});

const args3 = [
  dna.object({
    f1: dna.number(),
    f2: dna.string().nullable(),
    f3: dna.array(dna.boolean().optional()).optional(),
  }),
] as const;
const returns3 = dna.union([dna.string(), dna.number()]);

const func3 = dna.function({
  input: args3,
  output: returns3,
});

test("function inference 3", () => {
  type func3 = (typeof func3)["_input"];

  expectTypeOf<func3>().toEqualTypeOf<
    (arg: {
      f1: number;
      f2: string | null;
      f3: (boolean | undefined)[] | undefined;
    }) => string | number
  >();
});

test("valid function run", () => {
  const validFunc3Instance = func3.implement((_x) => {
    _x.f2;
    _x.f3![0];
    return "adf" as any;
  });

  validFunc3Instance({
    f1: 21,
    f2: "asdf",
    f3: [true, false],
  });
});

test("input validation error", () => {
  const schema = dna.function({
    input: [dna.string()],
    output: dna.void(),
  });
  const fn = schema.implement(() => 1234 as any);

  // @ts-expect-error
  const checker = () => fn();

  try {
    checker();
  } catch (e: any) {
    expect(e.issues).toMatchInlineSnapshot(`
      [
        {
          "input": [],
          "message": "Array requires at least 1 items",
          "path": "#/array/minItems",
        },
      ]
    `);
  }
});

test("array inputs", () => {
  const a = dna.function({
    input: [
      dna.object({
        name: dna.string(),
        age: dna.number().int(),
      }),
    ],
    output: dna.string(),
  });

  a.implement((args) => {
    return `${args.age}`;
  });

  const b = dna.function({
    input: [
      dna.object({
        name: dna.string(),
        age: dna.number().int(),
      }),
    ],
  });
  b.implement((args) => {
    return `${args.age}`;
  });
});

test("output validation error", () => {
  const schema = dna.function({
    input: [],
    output: dna.string(),
  });
  const fn = schema.implement(() => 1234 as any);
  try {
    fn();
  } catch (e: any) {
    expect(e.issues).toMatchInlineSnapshot(`
      [
        {
          "input": 1234,
          "message": "String is required",
          "path": "#/string",
        },
      ]
    `);
  }
});

test("function with async refinements", async () => {
  const schema = dna
    .function()
    .input([dna.string().refine(async (val) => val.length > 10)])
    .output(dna.promise(dna.number().refine(async (val) => val > 10)));

  const func = schema.implementAsync(async (val) => {
    return val.length;
  });
  const results = [];
  try {
    await func("asdfasdf");
    results.push("success");
  } catch (_) {
    results.push("fail");
  }
  try {
    await func("asdflkjasdflkjsf");
    results.push("success");
  } catch (_) {
    results.push("fail");
  }

  expect(results).toEqual(["fail", "success"]);
});

test("implement async with transforms", async () => {
  const codeSchema = dna.string().transform((data, ctx) => {
    if (data === "1234") {
      return data;
    } else {
      ctx.addIssue({
        code: "custom",
        message: "Invalid code",
      });
    }
  });
  const schema = dna
    .function()
    .input([codeSchema])
    .output(dna.string());

  const func = schema.implementAsync((val) => {
    return val + "!";
  });

  const results = [];
  try {
    await func("1234");
    results.push("success");
  } catch (_) {
    results.push("fail");
  }
  try {
    await func("1235");
    results.push("success");
  } catch (_) {
    results.push("fail");
  }

  expect(results).toEqual(["success", "fail"]);
});

test("non async function with async refinements should fail", () => {
  expect(() =>
    dna
      .function()
      .input([dna.string().refine(async (val) => val.length > 10)])
      .output(dna.number().refine(async (val) => val > 10))
      .implement((val) => val.length)
  ).toThrow("use implementAsync() instead of implement()");
});

test("extra parameters with rest", () => {
  const maxLength5 = dna
    .function()
    .input([dna.string()], dna.number().int().positive());
  const func = maxLength5.implement((s, ...rest) => {
    return rest.length;
  });
  expect(func("asdf", 1, 2, 3, 4)).toBe(4);
});

test("no input", () => {
  const func = dna
    .function()
    .input([])
    .output(dna.string())
    .implement(() => "hello");
  expect(func()).toBe("hello");
});

test("no output", () => {
  const func = dna
    .function()
    .input([dna.string()])
    .implement((s) => {
      expect(s).toBe("hello");
    });
  func("hello");
});
