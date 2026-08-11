# DNA Recipes

Common usage patterns for `@ytrynot/dna`. Each recipe is a minimal, copy-pasteable example.

For the full API reference, see the [README](../README.md). For internals and codegen, see [technical.md](./technical.md).

## Table of Contents

- [Object Modes: Standard vs Strict vs Loose](#object-modes-standard-vs-strict-vs-loose)
- [Discriminated Union](#discriminated-union)
- [Recursion via `dna.lazy()` and object getters](#recursion-via-dnalazy-and-object-getters)
- [Pipe + Transform with Externals](#pipe--transform-with-externals)
- [`dna.instanceof()` + Constructor Registry](#dnainstanceof--constructor-registry)
- [Coercion (`dna.coerce.*`)](#coercion-dnacoerce)
- [Template Literals](#template-literals)
- [Function Schemas + `.implement()`](#function-schemas--implement)
- [Records, Maps, Sets](#records-maps-sets)
- [Preprocess](#preprocess)
- [Refinements (`.refine()`, `.superRefine()`, `.check()`)](#refinements-refine-superrefine-check)
- [Default, Prefault, Catch](#default-prefault-catch)
- [Brand](#brand)
- [Metadata (`.meta()`, `.describe()`)](#metadata-meta-describe)
- [Choosing `validator()` vs `.validate()`](#choosing-validator-vs-validate)

---

## Object Modes: Standard vs Strict vs Loose

```typescript
import { dna } from "@ytrynot/dna";

// Standard — strips unknown keys from parsed output
const standard = dna.object({ name: dna.string() });
standard.safeParse({ name: "John", extra: 1 });
// { success: true, data: { name: "John" } }  — "extra" dropped

// Strict — rejects unknown keys
const strict = dna.strictObject({ name: dna.string() });
// or: dna.object({ name: dna.string() }).strict();
strict.safeParse({ name: "John", extra: 1 });
// { success: false, errors: [...] }  — "extra" rejected

// Loose — passes unknown keys through
const loose = dna.looseObject({ name: dna.string() });
// or: dna.object({ name: dna.string() }).loose();
loose.safeParse({ name: "John", extra: 1 });
// { success: true, data: { name: "John", extra: 1 } }
```

**Output difference**: `standard` uses the `keepOnly` mechanism (undefined optional props are not copied); `strict`/`loose` use `Object.assign` (unknown/evaluated props preserved).

---

## Discriminated Union

```typescript
import { dna } from "@ytrynot/dna";

const schema = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("a"), a: dna.string() }),
  dna.object({ type: dna.literal("b"), b: dna.number() }),
]);

schema.parse({ type: "a", a: "hello" });  // valid
schema.parse({ type: "b", b: 42 });       // valid
schema.parse({ type: "a", b: 42 });       // invalid
```

The discriminator field (`"type"`) is used for fast switch dispatch in the generated code — faster than a plain `dna.union()`.

---

## Recursion via `dna.lazy()` and object getters

DNA supports two patterns for recursive/circular schemas, matching Zod's API.

### `dna.lazy()` — explicit lazy getter

```typescript
import { dna, type DnaLazy } from "@ytrynot/dna";

type Category = { name: string; subcategories: Category[] };

const CategorySchema: DnaLazy<Category> = dna.lazy(() =>
  dna.object({
    name: dna.string(),
    subcategories: dna.array(CategorySchema),
  })
);

CategorySchema.parse({
  name: "root",
  subcategories: [
    { name: "child", subcategories: [] },
  ],
});
```

The getter `() => schema` defers evaluation so the schema can reference itself. Works for mutual recursion too (A references B, B references A).

### Object getters — self-referencing properties

For self-referencing objects, you can use JavaScript getters instead of `dna.lazy()`. The builder resolves getter properties at emit time (after the const exits its TDZ):

```typescript
import { dna } from "@ytrynot/dna";

type Node = {
  name: string;
  self: Node;
  optself?: Node;
  nullself: Node | null;
  subcategories: Node[];
  nested: { sub: Node };
};

const NodeSchema = dna.object({
  name: dna.string(),
  get self() {
    return NodeSchema;
  },
  get optself() {
    return NodeSchema.optional();
  },
  get nullself() {
    return NodeSchema.nullable();
  },
  get subcategories() {
    return dna.array(NodeSchema);
  },
  nested: dna.object({
    get sub() {
      return NodeSchema;
    },
  }),
});
```

Getters are resolved at emit time, so optional/nullable/default wrappers on recursive refs are correctly detected (not treated as required). Use `dna.lazy()` for top-level recursive schemas or mutual recursion; use getters for self-referencing object properties.

---

## Pipe + Transform with Externals

```typescript
import { dna } from "@ytrynot/dna";

const allowed = ["foo", "bar", "baz"];

const schema = dna
  .string()
  .transform(
    (data, ctx) => {
      if (!allowed.includes(data)) {
        ctx.addIssue({ input: data, code: "custom", message: "Not allowed" });
      }
      return data.length;
    },
    { allowed },  // declare externals
  )
  .pipe(dna.number());

// Pass externals at parse time
schema.parse("foo", { allowed });  // 3
```

See [externals.md](./externals.md) for the full externals contract (registry, codegen, portability).

---

## `dna.instanceof()` + Constructor Registry

```typescript
import { dna } from "@ytrynot/dna";

class User {
  constructor(public name: string) {}
}

// Register the constructor (also auto-registered on schema emission)
dna.registerConstructor("User", User);

const schema = dna.instanceof(User);

schema.parse(new User("John"));  // valid
schema.parse({ name: "John" });   // invalid — not a User instance
```

---

## Coercion (`dna.coerce.*`)

```typescript
import { dna } from "@ytrynot/dna";

dna.coerce.string().parse(123);        // "123"
dna.coerce.number().parse("123");      // 123
dna.coerce.boolean().parse("true");    // true
dna.coerce.bigint().parse("123");      // 123n
dna.coerce.date().parse("2024-01-01"); // Date object
```

Coercion runs before validation — useful for CLI args, query params, and other stringly-typed inputs.

---

## Template Literals

DNA provides two variants of template literals. Both validate that a string matches the concatenation of literal parts and inner schemas. The difference is what they return on `parse()`:

- **`dna.templateLiteral()`** (alias `dna.tl`) — **validate-only**. The matched string is returned **unchanged**. Any inner transformations (`.toUpperCase()`, `.trim()`, ...) are ignored for the output. This matches Zod's `z.templateLiteral()` behavior.
- **`dna.templateLiteralMutate()`** (alias `dna.tlm`) — **mutating**. Inner transformations **are applied**, so the parsed output reflects them.

```typescript
import { dna } from "@ytrynot/dna";

// templateLiteral — validate-only, output unchanged
const validateUrl = dna.templateLiteral([
  "https://",
  dna.string(),
  ".",
  dna.enum(["com", "net"]),
]);
validateUrl.parse("https://example.com");  // "https://example.com" (unchanged)

// templateLiteralMutate — inner transformations applied to output
const normalizeUser = dna.templateLiteralMutate([
  "user:",
  dna.string().min(3).toUpperCase(),
]);
normalizeUser.parse("user:john");  // "user:JOHN" (toUpperCase applied)
```

Use `templateLiteral` when you only need to validate the format (Zod parity). Use `templateLiteralMutate` when you want the parsed output to reflect inner transformations (e.g. normalization, trimming).

---

## Function Schemas + `.implement()`

```typescript
import { dna } from "@ytrynot/dna";

// Builder chain API
const funcSchema = dna.function({
  input: [dna.string()] as const,
  output: dna.number(),
});

// Or equivalently:
// const funcSchema = dna.function().input([dna.string()]).output(dna.number());

// Sync implementation — input/output validated automatically
const strlen = funcSchema.implement((s: string) => s.length);
strlen("hello");  // 5
strlen(123);      // throws DnaError (invalid input)

// Async implementation
const asyncFunc = funcSchema.implementAsync(async (s: string) => s.length);
await asyncFunc("hello");  // 5
```

`.implement()` is sync-only and throws if the schema or function is async — use `.implementAsync()` for async cases.

### Rebuilding a function schema from bytecode

Function schemas survive `toDna()` / `fromDna()` roundtrips. Use `ReturnType<typeof dna.function>` as the type argument to recover `.implement()` on the rebuilt schema:

```typescript
import { dna, fromDna } from "@ytrynot/dna";

const fnSchema = dna.function().input([dna.string()]).output(dna.number());
const rebuiltFn = fromDna<ReturnType<typeof dna.function>>(fnSchema.toDna());
const impl = rebuiltFn.implement((s: string) => s.length);
impl("hello");  // 5
```

---

## Records, Maps, Sets

```typescript
import { dna } from "@ytrynot/dna";

// Record — plain object with typed keys/values
const recordSchema = dna.record(dna.string(), dna.boolean());
recordSchema.parse({ a: true, b: false });

// Map — Map instance
const mapSchema = dna.map(dna.string(), dna.string());
mapSchema.parse(new Map([["key", "value"]]));

// Set — Set instance
const setSchema = dna.set(dna.string());
setSchema.parse(new Set(["a", "b"]));

// Size constraints (Map/Set)
mapSchema.min(2).max(5);
setSchema.size(3).nonempty();
```

---

## Preprocess

```typescript
import { dna } from "@ytrynot/dna";

const schema = dna.preprocess(
  (v) => Number(v),
  dna.number().positive(),
);

schema.parse("123");  // 123 (coerced then validated)
schema.parse("-5");   // invalid (not positive)
```

Preprocess runs before validation — like Zod's `.preprocess()`.

---

## Refinements (`.refine()`, `.superRefine()`, `.check()`)

```typescript
import { dna } from "@ytrynot/dna";

// .refine() — simple boolean check
const passwords = dna
  .object({ password: dna.string(), confirm: dna.string() })
  .refine((d) => d.password === d.confirm, "Passwords must match");

// .superRefine() — manual issue control
const limited = dna
  .array(dna.string())
  .superRefine((val, ctx) => {
    if (val.length > 3) {
      ctx.addIssue({ code: "too_big", maximum: 3, message: "Too many items" });
    }
  });

// .check() — reusable top-level checks
const notForbidden = dna.refine((v: unknown) => v !== "forbidden");
const safe = dna.string().check(notForbidden);

// Low-level check with ctx
const longEnough = dna.check((value, ctx) => {
  if (typeof value === "string" && value.length <= 3) {
    ctx.addIssue({ code: "custom", message: "Must be longer than 3", input: value });
  }
});
const s = dna.string().check(longEnough);
```

---

## Default, Prefault, Catch

```typescript
import { dna } from "@ytrynot/dna";

// .default() — applied when input is undefined
const withDefault = dna.string().default("fallback");
withDefault.parse(undefined);  // "fallback"

// .prefault() — applied before validation (transforms run on default)
const withPrefault = dna.string().trim().prefault("  default  ");
withPrefault.parse(undefined);  // "default" (trimmed)

// .catch() — applied when validation fails
const withCatch = dna.string().catch("fallback");
withCatch.parse(123);  // "fallback" (invalid input caught)

// Top-level prefault
const topPrefault = dna.prefault(dna.string().trim(), "  default  ");
```

- **`.default()`**: input is `undefined` → use default
- **`.prefault()`**: before validation → use fallback (transforms apply to it)
- **`.catch()`**: validation fails → use fallback

---

## Brand

```typescript
import { dna } from "@ytrynot/dna";

const schema = dna.object({ name: dna.string() }).brand<"MyBrand">();

type Branded = dna.infer<typeof schema>;
// { name: string } & { __brand__: "MyBrand" }
```

Branding is type-level only — no runtime effect. Useful for nominal typing patterns.

---

## Metadata (`.meta()`, `.describe()`)

```typescript
import { dna } from "@ytrynot/dna";

// Instance method
const email = dna.string().meta({
  title: "Email",
  description: "User email address",
});

// .describe() — shorthand for description only
const name = dna.string().describe("User's full name");

// Top-level checks with metadata
const schema = dna.object({
  email: dna.string().check(
    dna.describe("User email"),
    dna.meta({ title: "Email" }),
  ),
  age: dna.number().check(
    dna.meta({ title: "Age", description: "User's age" }),
  ),
});
```

Metadata is preserved through `toDna()` / `fromDna()` roundtrips and accessible via the `.meta()` getter.

---

## Choosing `validator()` vs `.validate()`

```typescript
import { dna, validator } from "@ytrynot/dna";

const schema = dna.object({ name: dna.string() });
const bytecode = schema.toDna();

// .validate() — everyday use, schema already in memory
schema.validate({ name: "John" });  // true

// validator() — pre-compile standalone fn from bytecode
const validateFn = validator(bytecode);
validateFn({ name: "John" });  // true
```

- **`.validate()` / `.safeParse()` / `.parse()`**: use when you have the schema instance. Simplest API.
- **`validator()` / `parser()` / `toJS()`**: use when you have DNA bytecode (e.g. from `@ytrynot/schvalid`), need a standalone serializable function, or want to pre-compile for hot paths.
