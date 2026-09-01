import * as z from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const shallowPartialZod = z
  .object({
    name: z.string(),
    age: z.number(),
    outer: z.object({
      inner: z.string(),
    }),
    array: z.array(z.object({ asdf: z.string() })),
  })
  .partial();
const shallowPartialDna = dna
  .object({
    name: dna.string(),
    age: dna.number(),
    outer: dna.object({
      inner: dna.string(),
    }),
    array: dna.array(dna.object({ asdf: dna.string() })),
  })
  .partial();

const requiredZod = z
  .object({
    name: z.string(),
    age: z.number().optional(),
    field: z.string().optional().default("asdf"),
    nullableField: z.number().nullable(),
    nullishField: z.string().nullish(),
  })
  .required();
const requiredDna = dna
  .object({
    name: dna.string(),
    age: dna.number().optional(),
    field: dna.string().optional().default("asdf"),
    nullableField: dna.number().nullable(),
    nullishField: dna.string().nullish(),
  })
  .required();

const partialMaskZod = z
  .object({
    name: z.string(),
    age: z.number().optional(),
    field: z.string().optional().default("asdf"),
    country: z.string(),
  })
  .partial({ age: true, field: true, name: true });
const partialMaskDna = dna
  .object({
    name: dna.string(),
    age: dna.number().optional(),
    field: dna.string().optional().default("asdf"),
    country: dna.string(),
  })
  .partial({ age: true, field: true, name: true });

const requiredMaskZod = z
  .object({
    name: z.string(),
    age: z.number().optional(),
    field: z.string().optional().default("asdf"),
    country: z.string().optional(),
  })
  .required({ age: true });
const requiredMaskDna = dna
  .object({
    name: dna.string(),
    age: dna.number().optional(),
    field: dna.string().optional().default("asdf"),
    country: dna.string().optional(),
  })
  .required({ age: true });

const partialDefaultsZod = z
  .object({
    a: z.string().catch("catch value").optional(),
    b: z.string().default("default value").optional(),
    c: z.string().prefault("prefault value").optional(),
    d: z.string().catch("catch value"),
    e: z.string().default("default value"),
    f: z.string().prefault("prefault value"),
  })
  .partial();
const partialDefaultsDna = dna
  .object({
    a: dna.string().catch("catch value").optional(),
    b: dna.string().default("default value").optional(),
    c: dna.string().prefault("prefault value").optional(),
    d: dna.string().catch("catch value"),
    e: dna.string().default("default value"),
    f: dna.string().prefault("prefault value"),
  })
  .partial();

const partialNullableZod = z
  .object({
    name: z.string(),
    age: z.number().optional(),
    nullableField: z.number().nullable(),
  })
  .partial();
const partialNullableDna = dna
  .object({
    name: dna.string(),
    age: dna.number().optional(),
    nullableField: dna.number().nullable(),
  })
  .partial();

export const partialTests = [
  {
    description: "shallow partial - all fields optional",
    zodSchema: shallowPartialZod,
    dnaSchema: shallowPartialDna,
    tests: [
      { description: "valid empty object", data: {}, valid: true },
      {
        description: "valid with all fields",
        data: {
          name: "John",
          age: 30,
          outer: { inner: "value" },
          array: [{ asdf: "test" }],
        },
        valid: true,
      },
      { description: "valid with partial fields", data: { name: "John", age: 30 }, valid: true },
    ],
  },
  {
    description: "required - all fields required",
    zodSchema: requiredZod,
    dnaSchema: requiredDna,
    tests: [
      {
        description: "valid with all fields",
        data: {
          name: "John",
          age: 30,
          field: "test",
          nullableField: 42,
          nullishField: "test",
        },
        valid: true,
      },
      {
        description: "valid with null nullable field",
        data: {
          name: "John",
          age: 30,
          field: "test",
          nullableField: null,
          nullishField: "test",
        },
        valid: true,
      },
      {
        description: "valid with null nullish field",
        data: {
          name: "John",
          age: 30,
          field: "test",
          nullableField: 42,
          nullishField: null,
        },
        valid: true,
      },
      { description: "invalid missing required field", data: { age: 30 }, valid: false },
    ],
  },
  {
    description: "partial with mask - specific fields optional",
    zodSchema: partialMaskZod,
    dnaSchema: partialMaskDna,
    tests: [
      { description: "valid with only country", data: { country: "US" }, valid: true },
      {
        description: "valid with all fields",
        data: {
          name: "John",
          age: 30,
          field: "test",
          country: "US",
        },
        valid: true,
      },
      { description: "invalid missing required country", data: { name: "John" }, valid: false },
    ],
  },
  {
    description: "required with mask - specific fields required",
    zodSchema: requiredMaskZod,
    dnaSchema: requiredMaskDna,
    tests: [
      {
        description: "valid with all fields",
        data: {
          name: "John",
          age: 30,
          field: "test",
          country: "US",
        },
        valid: true,
      },
      { description: "valid with required age", data: { name: "John", age: 30 }, valid: true },
      { description: "invalid missing required age", data: { name: "John" }, valid: false },
    ],
  },
  {
    description: "partial with default values",
    zodSchema: partialDefaultsZod,
    dnaSchema: partialDefaultsDna,
    tests: [
      { description: "valid empty object (defaults applied)", data: {}, valid: true },
      {
        description: "valid with all fields",
        data: {
          a: "test",
          b: "test",
          c: "test",
          d: "test",
          e: "test",
          f: "test",
        },
        valid: true,
      },
    ],
  },
  {
    description: "partial with nullable",
    zodSchema: partialNullableZod,
    dnaSchema: partialNullableDna,
    tests: [
      { description: "valid empty object", data: {}, valid: true },
      { description: "valid with null nullable field", data: { nullableField: null }, valid: true },
      {
        description: "valid with all fields",
        data: {
          name: "John",
          age: 30,
          nullableField: 42,
        },
        valid: true,
      },
    ],
  },
  {
    description: "handleOptionalObjectResult branches",
    zodSchema: z.object({
      caughtMissing: z.string().catch("caught").optional(),
      caughtUndefined: z.string().catch("caught").optional(),
      issueMissing: z.string().min(5).optional(),
      issueUndefined: z.string().min(5).optional(),
      validUndefined: z.string().optional(),
      defaultValue: z.string().default("default").optional(),
      caughtDefined: z.string().catch("caught").optional(),
      issueDefined: z.string().min(5).optional(),
      validDefinedUndefined: z
        .string()
        .transform(() => undefined)
        .optional(),
      validDefined: z.string().optional(),
    }),
    dnaSchema: dna.object({
      caughtMissing: dna.string().catch("caught").optional(),
      caughtUndefined: dna.string().catch("caught").optional(),
      issueMissing: dna.string().min(5).optional(),
      issueUndefined: dna.string().min(5).optional(),
      validUndefined: dna.string().optional(),
      defaultValue: dna.string().default("default").optional(),
      caughtDefined: dna.string().catch("caught").optional(),
      issueDefined: dna.string().min(5).optional(),
      validDefinedUndefined: dna
        .string()
        .transform(() => undefined)
        .optional(),
      validDefined: dna.string().optional(),
    }),
    tests: [
      {
        description: "valid with undefined-key branches",
        data: {
          caughtUndefined: undefined,
          issueUndefined: undefined,
          validUndefined: undefined,
        },
        valid: true,
      },
      {
        description: "valid with defined-key branches",
        data: {
          caughtDefined: 123,
          validDefinedUndefined: "test",
          validDefined: "valid",
        },
        valid: true,
      },
      {
        description: "invalid issueDefined too short",
        data: {
          issueDefined: "abc",
        },
        valid: false,
      },
    ],
  },
  {
    description: "fastpass vs non-fastpass consistency",
    zodSchema: z.object({
      caughtMissing: z.string().catch("caught").optional(),
      caughtUndefined: z.string().catch("caught").optional(),
      issueMissing: z.string().min(5).optional(),
      issueUndefined: z.string().min(5).optional(),
      validUndefined: z.string().optional(),
      defaultValue: z.string().default("default").optional(),
      caughtDefined: z.string().catch("caught").optional(),
      validDefinedUndefined: z
        .string()
        .transform(() => undefined)
        .optional(),
      validDefined: z.string().optional(),
    }),
    dnaSchema: dna.object({
      caughtMissing: dna.string().catch("caught").optional(),
      caughtUndefined: dna.string().catch("caught").optional(),
      issueMissing: dna.string().min(5).optional(),
      issueUndefined: dna.string().min(5).optional(),
      validUndefined: dna.string().optional(),
      defaultValue: dna.string().default("default").optional(),
      caughtDefined: dna.string().catch("caught").optional(),
      validDefinedUndefined: dna
        .string()
        .transform(() => undefined)
        .optional(),
      validDefined: dna.string().optional(),
    }),
    tests: [
      {
        description: "valid mixed input (fastpath consistency)",
        data: {
          caughtUndefined: undefined,
          issueUndefined: undefined,
          validUndefined: undefined,
          caughtDefined: 123,
          validDefinedUndefined: "test",
          validDefined: "valid",
        },
        valid: true,
      },
    ],
  },
  {
    description: "optional with check",
    zodSchema: z
      .string()
      .optional()
      .check(({ value, ...ctx }) => {
        ctx.issues.push({
          code: "custom",
          input: value,
          message: "message",
        });
      }),
    dnaSchema: dna
      .string()
      .optional()
      .check(
        dna.check((value, ctx) => {
          ctx.addIssue({
            code: "custom",
            input: value,
            message: "message",
          });
        })
      ),
    tests: [
      { description: "invalid undefined with check (top-level)", data: undefined, valid: false },
    ],
  },
  {
    description: "optional with check inside object",
    zodSchema: z.object({
      date: z
        .string()
        .optional()
        .check(({ value, ...ctx }) => {
          ctx.issues.push({
            code: "custom",
            input: value,
            message: "message",
          });
        }),
    }),
    dnaSchema: dna.object({
      date: dna
        .string()
        .optional()
        .check(
          dna.check((value, ctx) => {
            ctx.addIssue({
              code: "custom",
              input: value,
              message: "message",
            });
          })
        ),
    }),
    tests: [
      { description: "invalid undefined with check (object key)", data: { date: undefined }, valid: false },
    ],
  },
  {
    description: "required preserves refinements",
    zodSchema: z
      .object({
        name: z.string().optional(),
        age: z.number().optional(),
      })
      .superRefine((val, ctx) => {
        if (val.name === "admin") {
          ctx.addIssue({
            message: "Name cannot be admin",
            code: "custom",
            path: ["name"],
          });
        }
      })
      .required(),
    dnaSchema: dna
      .object({
        name: dna.string().optional(),
        age: dna.number().optional(),
      })
      .superRefine((val, ctx) => {
        if (val.name === "admin") {
          ctx.addIssue({
            message: "Name cannot be admin",
            code: "custom",
            path: ["name"],
          });
        }
      })
      .required(),
    tests: [
      { description: "invalid name is admin (refinement preserved)", data: { name: "admin", age: 25 }, valid: false },
      { description: "valid normal name", data: { name: "user", age: 25 }, valid: true },
    ],
  },
  {
    description: "required refinement is executed",
    zodSchema: z
      .object({
        password: z.string().optional(),
        confirmPassword: z.string().optional(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords must match",
      })
      .required(),
    dnaSchema: dna
      .object({
        password: dna.string().optional(),
        confirmPassword: dna.string().optional(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords must match",
      })
      .required(),
    tests: [
      { description: "invalid mismatched passwords", data: { password: "abc", confirmPassword: "xyz" }, valid: false },
      { description: "valid matching passwords", data: { password: "abc", confirmPassword: "abc" }, valid: true },
    ],
  },
  {
    description: "exactPartial shallow",
    zodSchema: z
      .object({
        name: z.string(),
        age: z.number(),
        outer: z.object({
          inner: z.string(),
        }),
        array: z.array(z.object({ asdf: z.string() })),
      })
      .exactPartial(),
    dnaSchema: dna.object({
      name: dna.string().exactOptional(),
      age: dna.number().exactOptional(),
      outer: dna.object({
        inner: dna.string(),
      }).exactOptional(),
      array: dna.array(dna.object({ asdf: dna.string() })).exactOptional(),
    }),
    tests: [
      { description: "valid empty object", data: {}, valid: true },
      {
        description: "valid with partial fields",
        data: {
          name: "asdf",
          age: 23143,
        },
        valid: true,
      },
      {
        description: "valid with all fields",
        data: {
          name: "John",
          age: 30,
          outer: { inner: "value" },
          array: [{ asdf: "test" }],
        },
        valid: true,
      },
    ],
  },
  {
    description: "exactPartial absent keys pass, explicit undefined rejected",
    zodSchema: z.object({ name: z.string(), age: z.number() }).exactPartial(),
    dnaSchema: dna.object({
      name: dna.string().exactOptional(),
      age: dna.number().exactOptional(),
    }),
    tests: [
      { description: "valid empty object", data: {}, valid: true },
      { description: "valid with name only", data: { name: "asdf" }, valid: true },
      { description: "invalid explicit undefined for name", data: { name: undefined }, valid: false },
    ],
  },
  {
    description: "exactPartial with mask",
    zodSchema: z
      .object({ name: z.string(), age: z.number(), country: z.string() })
      .exactPartial({ name: true, age: true }),
    dnaSchema: dna.object({
      name: dna.string().exactOptional(),
      age: dna.number().exactOptional(),
      country: dna.string(),
    }),
    tests: [
      { description: "valid with only country", data: { country: "US" }, valid: true },
      { description: "invalid explicit undefined for masked name", data: { country: "US", name: undefined }, valid: false },
      { description: "invalid missing required country", data: { name: "John" }, valid: false },
    ],
  },
];
