import * as z from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const obj1Zod = z.object({
  first: z.string(),
  second: z.string(),
});
const obj1Dna = dna.object({
  first: dna.string(),
  second: dna.string(),
});

const obj2Zod = obj1Zod.partial().strict();
const obj2Dna = obj1Dna.partial().strict();

const obj3Zod = obj2Zod.refine((data) => data.first || data.second, "Either first or second should be filled in.");
const obj3Dna = obj2Dna.refine((data) => data.first || data.second, "Either first or second should be filled in.");

const validationSchemaZod = z
  .object({
    email: z.string().email(),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, "Both password and confirmation must match");
const validationSchemaDna = dna
  .object({
    email: dna.string().email(),
    password: dna.string(),
    confirmPassword: dna.string(),
  })
  .refine((data) => data.password === data.confirmPassword, "Both password and confirmation must match");

const customPathZod = z
  .object({ password: z.string(), confirm: z.string() })
  .refine((data) => data.confirm === data.password, { path: ["confirm"] });
const customPathDna = dna
  .object({ password: dna.string(), confirm: dna.string() })
  .refine((data) => data.confirm === data.password, { path: ["confirm"] });

const stringsZod = z.array(z.string()).superRefine((val, ctx) => {
  if (val.length > 3) {
    ctx.addIssue({
      input: val,
      code: "too_big",
      origin: "array",
      maximum: 3,
      inclusive: true,
      exact: true,
      message: "Too many items 😡",
    });
  }

  if (val.length !== new Set(val).size) {
    ctx.addIssue({
      input: val,
      code: "custom",
      message: `No duplicates allowed.`,
    });
  }
});
const stringsDna = dna.array(dna.string()).superRefine((val, ctx) => {
  if (val.length > 3) {
    ctx.addIssue({
      input: val,
      code: "too_big",
      origin: "array",
      maximum: 3,
      inclusive: true,
      exact: true,
      message: "Too many items 😡",
    });
  }

  if (val.length !== new Set(val).size) {
    ctx.addIssue({
      input: val,
      code: "custom",
      message: `No duplicates allowed.`,
    });
  }
});

const objectSchemaZod = z
  .object({
    length: z.number(),
    size: z.number(),
  })
  .refine(({ length }) => length > 5, {
    path: ["length"],
    message: "length greater than 5",
  })
  .refine(({ size }) => size > 7, {
    path: ["size"],
    message: "size greater than 7",
  });
const objectSchemaDna = dna
  .object({
    length: dna.number(),
    size: dna.number(),
  })
  .refine(({ length }) => length > 5, {
    path: ["length"],
    message: "length greater than 5",
  })
  .refine(({ size }) => size > 7, {
    path: ["size"],
    message: "size greater than 7",
  });

export const refineTests = [
  {
    description: "should create a new schema instance when refining",
    zodSchema: obj3Zod,
    dnaSchema: obj3Dna,
    tests: [
      { description: "valid with first property", data: { first: "a" }, valid: true },
      { description: "valid with second property", data: { second: "a" }, valid: true },
      { description: "valid with both properties", data: { first: "a", second: "a" }, valid: true },
      { description: "invalid empty object", data: {}, valid: false },
    ],
  },
  {
    description: "should validate strict mode correctly",
    zodSchema: obj2Zod,
    dnaSchema: obj2Dna,
    tests: [
      { description: "valid empty", data: {}, valid: true },
      { description: "valid with first", data: { first: "a" }, valid: true },
      { description: "invalid with extra property", data: { third: "adsf" }, valid: false },
    ],
  },
  {
    description: "refinement with custom error messages",
    zodSchema: validationSchemaZod,
    dnaSchema: validationSchemaDna,
    tests: [
      {
        description: "invalid non-matching passwords",
        data: {
          email: "aaaa@gmail.com",
          password: "aaaaaaaa",
          confirmPassword: "bbbbbbbb",
        },
        valid: false,
      },
    ],
  },
  {
    description: "custom error paths",
    zodSchema: customPathZod,
    dnaSchema: customPathDna,
    tests: [
      { description: "invalid mismatch", data: { password: "asdf", confirm: "qewr" }, valid: false },
    ],
  },
  {
    description: "superRefine functionality - multiple validation rules",
    zodSchema: stringsZod,
    dnaSchema: stringsDna,
    tests: [
      { description: "invalid too many items and duplicates", data: ["asfd", "asfd", "asfd", "asfd"], valid: false },
      { description: "valid", data: ["asfd", "qwer"], valid: true },
    ],
  },
  {
    description: "chained refinements - collect all validation errors",
    zodSchema: objectSchemaZod,
    dnaSchema: objectSchemaDna,
    tests: [
      { description: "invalid one error (length)", data: { length: 4, size: 9 }, valid: false },
      { description: "invalid two errors", data: { length: 4, size: 3 }, valid: false },
      { description: "valid", data: { length: 6, size: 8 }, valid: true },
    ],
  },
  {
    description: "top-level dna.refine() reusable check",
    zodSchema: z.string().check(z.refine((val: unknown) => val !== "forbidden")),
    dnaSchema: dna.string().check(dna.refine((val: unknown) => val !== "forbidden")),
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "invalid forbidden", data: "forbidden", valid: false },
    ],
  },
  {
    description: "top-level dna.check() reusable check (low-level ctx-based, Zod v4 z.check() parity)",
    zodSchema: z.string().check(
      z.check((ctx) => {
        if (ctx.value.length <= 3) {
          ctx.issues.push({ code: "custom", message: "Must be longer than 3", input: ctx.value });
        }
      })
    ),
    dnaSchema: dna.string().check(
      dna.check((value, ctx) => {
        if ((value as string).length <= 3) {
          ctx.addIssue({ code: "custom", message: "Must be longer than 3", input: value });
        }
      })
    ),
    tests: [
      { description: "valid long string", data: "hello", valid: true },
      { description: "invalid short string", data: "hi", valid: false },
    ],
  },
  {
    description: "reusable check on multiple schemas",
    zodSchema: null,
    dnaSchema: dna.string().check(dna.refine((val: unknown) => (val as string).startsWith("a"))),
    tests: [
      { description: "valid starts with a", data: "apple", valid: true },
      { description: "invalid does not start with a", data: "banana", valid: false },
    ],
  },
  {
    description: "should support async refinement functions",
    zodSchema: z
      .object({
        email: z.string().email(),
        password: z.string(),
        confirmPassword: z.string(),
      })
      .refine(
        (data) => Promise.resolve().then(() => data.password === data.confirmPassword),
        "Both password and confirmation must match"
      ),
    dnaSchema: dna
      .object({
        email: dna.string().email(),
        password: dna.string(),
        confirmPassword: dna.string(),
      })
      .refine(
        (data) => Promise.resolve().then(() => data.password === data.confirmPassword),
        "Both password and confirmation must match"
      ),
    tests: [
      {
        description: "valid matching passwords",
        data: {
          email: "aaaa@gmail.com",
          password: "password",
          confirmPassword: "password",
        },
        valid: true,
      },
      {
        description: "invalid non-matching passwords",
        data: {
          email: "aaaa@gmail.com",
          password: "password",
          confirmPassword: "different",
        },
        valid: false,
      },
    ],
  },
  {
    description: "should abort early with continue: false",
    zodSchema: z
      .string()
      .superRefine((val, ctx) => {
        if (val.length < 2) {
          ctx.addIssue({
            code: "custom",
            message: "BAD",
            continue: false,
          });
        }
      })
      .refine((_) => false),
    dnaSchema: dna
      .string()
      .superRefine((val, ctx) => {
        if (val.length < 2) {
          ctx.addIssue({
            code: "custom",
            message: "BAD",
            continue: false,
          });
        }
      })
      .refine((_) => false),
    tests: [
      { description: "invalid empty string (abort early)", data: "", valid: false },
    ],
  },
  {
    description: "should abort early with fatal: true",
    zodSchema: z
      .string()
      .superRefine((val, ctx) => {
        if (val.length < 2) {
          ctx.addIssue({
            code: "custom",
            fatal: true,
            message: "BAD",
          });
        }
      })
      .refine((_) => false),
    dnaSchema: dna
      .string()
      .superRefine((val, ctx) => {
        if (val.length < 2) {
          ctx.addIssue({
            code: "custom",
            fatal: true,
            message: "BAD",
          });
        }
      })
      .refine((_) => false),
    tests: [
      { description: "invalid empty string (fatal abort)", data: "", valid: false },
    ],
  },
  {
    description: "should abort early with abort flag",
    zodSchema: z
      .string()
      .refine((_) => false, { abort: true })
      .refine((_) => false),
    dnaSchema: dna
      .string()
      .refine((_) => false, { abort: true })
      .refine((_) => false),
    tests: [
      { description: "invalid empty string (abort flag)", data: "", valid: false },
    ],
  },
  {
    description: "should support async superRefine",
    zodSchema: z.array(z.string()).superRefine(async (val, ctx) => {
      if (val.length > 3) {
        ctx.addIssue({
          input: val,
          code: "too_big",
          origin: "array",
          maximum: 3,
          inclusive: true,
          message: "Too many items",
        });
      }

      if (val.length !== new Set(val).size) {
        ctx.addIssue({
          input: val,
          code: "custom",
          message: `No duplicates allowed.`,
        });
      }
    }),
    dnaSchema: dna.array(dna.string()).superRefine(async (val, ctx) => {
      if (val.length > 3) {
        ctx.addIssue({
          input: val,
          code: "too_big",
          origin: "array",
          maximum: 3,
          inclusive: true,
          message: "Too many items",
        });
      }

      if (val.length !== new Set(val).size) {
        ctx.addIssue({
          input: val,
          code: "custom",
          message: `No duplicates allowed.`,
        });
      }
    }),
    tests: [
      { description: "invalid too many items and duplicates", data: ["asfd", "asfd", "asfd", "asfd"], valid: false },
      { description: "valid array", data: ["asfd", "qwer"], valid: true },
    ],
  },
  {
    description: "should accept string as shorthand for custom error message",
    zodSchema: z.string().superRefine((_, ctx) => {
      ctx.addIssue("bad stuff");
    }),
    dnaSchema: dna.string().superRefine((_, ctx) => {
      ctx.addIssue("bad stuff");
    }),
    tests: [
      { description: "invalid string shorthand issue", data: "asdf", valid: false },
    ],
  },
  {
    description: "should preserve explicit nullish issue input",
    zodSchema: z.string().superRefine((_, ctx) => {
      ctx.addIssue({ code: "custom", message: "default" });
      ctx.addIssue({ code: "custom", message: "null", input: null });
      ctx.addIssue({ code: "custom", message: "undefined", input: undefined });
    }),
    dnaSchema: dna.string().superRefine((_, ctx) => {
      ctx.addIssue({ code: "custom", message: "default" });
      ctx.addIssue({ code: "custom", message: "null", input: null });
      ctx.addIssue({ code: "custom", message: "undefined", input: undefined });
    }),
    tests: [
      { description: "invalid with nullish issue inputs", data: "sensitive", valid: false },
    ],
  },
  {
    description: "should keep issue input aligned with the issue path",
    zodSchema: z.object({ a: z.string().nullable() }).superRefine((val, ctx) => {
      if (val.a === null) ctx.addIssue({ code: "custom", path: ["a"], input: val.a, message: "no null" });
    }),
    dnaSchema: dna.object({ a: dna.string().nullable() }).superRefine((val, ctx) => {
      if (val.a === null) ctx.addIssue({ code: "custom", path: ["a"], input: val.a, message: "no null" });
    }),
    tests: [
      { description: "invalid null at path a", data: { a: null }, valid: false },
      { description: "valid string at a", data: { a: "hello" }, valid: true },
    ],
  },
  {
    description: "should respect fatal flag in superRefine",
    zodSchema: z
      .string()
      .superRefine((val, ctx) => {
        if (val === "") {
          ctx.addIssue({
            input: val,
            code: "custom",
            message: "foo",
            fatal: true,
          });
        }
      })
      .superRefine((val, ctx) => {
        if (val !== " ") {
          ctx.addIssue({
            input: val,
            code: "custom",
            message: "bar",
          });
        }
      }),
    dnaSchema: dna
      .string()
      .superRefine((val, ctx) => {
        if (val === "") {
          ctx.addIssue({
            input: val,
            code: "custom",
            message: "foo",
            fatal: true,
          });
        }
      })
      .superRefine((val, ctx) => {
        if (val !== " ") {
          ctx.addIssue({
            input: val,
            code: "custom",
            message: "bar",
          });
        }
      }),
    tests: [
      { description: "invalid empty string (fatal stops second superRefine)", data: "", valid: false },
    ],
  },
  {
    description: "should run superRefine validation even when base schema validation fails when 'when' is defined",
    zodSchema: z
      .object({
        foo: z.number(),
        bar: z.number(),
      })
      .superRefine(
        (data, ctx) => {
          if (data.foo > 10) {
            ctx.addIssue({
              code: "custom",
              message: "foo must be less than 10",
            });
          }
        },
        {
          when: ({ value }) => z.object({ foo: z.number() }).safeParse(value).success,
        }
      ),
    dnaSchema: dna
      .object({
        foo: dna.number(),
        bar: dna.number(),
      })
      .superRefine((data, ctx) => {
        if (data.foo > 10) {
          ctx.addIssue({
            code: "custom",
            message: "foo must be less than 10",
          });
        }
      }),
    tests: [
      { description: "invalid missing bar with foo > 10 (when returns true)", data: { foo: 11 }, valid: false },
    ],
  },
  {
    description: "should not run superRefine validation when 'when' is defined and returns false",
    zodSchema: z
      .object({
        foo: z.number(),
        bar: z.number(),
      })
      .superRefine(
        (data, ctx) => {
          if (data.foo > 10) {
            ctx.addIssue({
              code: "custom",
              message: "foo must be less than 10",
            });
          }
        },
        {
          when: ({ value }) => z.object({ foo: z.number(), bar: z.number() }).safeParse(value).success,
        }
      ),
    dnaSchema: dna
      .object({
        foo: dna.number(),
        bar: dna.number(),
      })
      .superRefine((data, ctx) => {
        if (data.foo > 10) {
          ctx.addIssue({
            code: "custom",
            message: "foo must be less than 10",
          });
        }
      }),
    tests: [
      { description: "invalid missing bar (when returns false, superRefine skipped)", data: { foo: 11 }, valid: false },
    ],
  },
  {
    description: "when - refine with when option",
    zodSchema: z
      .strictObject({
        password: z.string().min(8),
        confirmPassword: z.string(),
        other: z.string(),
      })
      .refine(
        (data) => data.password === data.confirmPassword,
        {
          message: "Passwords do not match",
          path: ["confirmPassword"],
          when(payload) {
            if (payload.value === undefined) return false;
            if (payload.value === null) return false;
            return payload.issues.every((iss) => iss.path?.[0] !== "confirmPassword" && iss.path?.[0] !== "password");
          },
        }
      ),
    dnaSchema: dna
      .strictObject({
        password: dna.string().min(8),
        confirmPassword: dna.string(),
        other: dna.string(),
      })
      .refine(
        (data) => data.password === data.confirmPassword,
        {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        }
      ),
    tests: [
      { description: "invalid undefined input", data: undefined, valid: false },
      { description: "invalid null input", data: null, valid: false },
      {
        description: "invalid short password (refine skipped via when)",
        data: { password: "asdf", confirmPassword: "asdfg", other: "qwer" },
        valid: false,
      },
      {
        description: "invalid short password and wrong other type",
        data: { password: "asdf", confirmPassword: "asdfg", other: 1234 },
        valid: false,
      },
    ],
  },
];
