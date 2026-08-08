import { dna } from "@ytrynot/dna";

export interface IResult {
  success: boolean;
  data?: unknown;
  errors?: unknown[];
}

export type DnaSchema = NonNullable<Parameters<typeof dna.union>[0][number]>;

type LiteralInput = string | number | boolean | (string | number | boolean)[];

type PicoMethod =
  | "min"
  | "max"
  | "length"
  | "email"
  | "url"
  | "uuid"
  | "regex"
  | "int"
  | "positive"
  | "negative";

export interface BasePico {
  safeParse: (v: unknown) => IResult;
  parse: (v: unknown) => unknown;
  min: (...args: unknown[]) => BasePico;
  max: (...args: unknown[]) => BasePico;
  length: (...args: unknown[]) => BasePico;
  email: (...args: unknown[]) => BasePico;
  url: (...args: unknown[]) => BasePico;
  uuid: (...args: unknown[]) => BasePico;
  regex: (...args: unknown[]) => BasePico;
  int: (...args: unknown[]) => BasePico;
  positive: (...args: unknown[]) => BasePico;
  negative: (...args: unknown[]) => BasePico;
  describe: (...args: unknown[]) => BasePico;
  optional: (...args: unknown[]) => BasePico;
}

const wrapperMap = new WeakMap<object, unknown>();

function unwrap(item: unknown): unknown {
  if (item && typeof item === "object") {
    return wrapperMap.get(item) ?? item;
  }
  return item;
}

function makeBasePico(schema: unknown, extra: PicoMethod[] = []): BasePico {
  const s = schema as Record<string, (...args: unknown[]) => unknown>;

  const create = (next: unknown) => makeBasePico(next, extra);

  const out: BasePico = {
    safeParse: (v) => s.safeParse(v) as IResult,
    parse: (v) => s.parse(v),
    min: () => out,
    max: () => out,
    length: () => out,
    email: () => out,
    url: () => out,
    uuid: () => out,
    regex: () => out,
    int: () => out,
    positive: () => out,
    negative: () => out,
    describe: () => out,
    optional: () => out,
  };

  for (const m of extra) {
    const fn = s[m];
    if (typeof fn === "function") {
      out[m] = (...args: unknown[]) => create(s[m](...args));
    }
  }

  for (const m of ["optional", "describe"] as const) {
    const fn = s[m];
    if (typeof fn === "function") {
      out[m] = (...args: unknown[]) => create(s[m](...args));
    }
  }

  wrapperMap.set(out, schema);
  return out;
}

const split = (value: unknown): unknown =>
  typeof value === "string" ? value.split(",") : value;
const toNumber = (value: unknown): number => Number(value);

export interface Pico {
  string: () => BasePico;
  number: () => BasePico;
  boolean: () => BasePico;
  bool: () => BasePico;
  url: () => BasePico;
  json: () => BasePico;
  filepath: () => BasePico;
  numList: () => BasePico;
  stringList: () => BasePico;
  boolList: () => BasePico;
  literal: (value: LiteralInput) => BasePico;
  or: (...items: (BasePico | DnaSchema)[]) => BasePico;
  xor: (...items: (BasePico | DnaSchema)[]) => BasePico;
  tuple: (...items: (BasePico | DnaSchema)[]) => BasePico;
}

export const pico: Pico = {
  string: () =>
    makeBasePico(dna.string(), ["min", "max", "length", "email", "url", "uuid", "regex"]),
  number: () =>
    makeBasePico(dna.coerce.number(), ["min", "max", "int", "positive", "negative"]),
  boolean: () => makeBasePico(dna.boolean()),
  bool: () =>
    makeBasePico(dna.stringbool({ truthy: ["true", "yes"], falsy: ["false", "no"] })),
  url: () => makeBasePico(dna.url()),
  json: () => makeBasePico(dna.json()),
  filepath: () => makeBasePico(dna.file()),

  // Per-item preprocess avoids the `coerce`-inside-array codegen bug in DNA.
  numList: () =>
    makeBasePico(
      dna.preprocess(split, dna.array(dna.preprocess(toNumber, dna.number()))),
    ),
  stringList: () =>
    makeBasePico(dna.preprocess(split, dna.array(dna.string()))),
  boolList: () =>
    makeBasePico(
      dna.preprocess(
        split,
        dna.array(dna.stringbool({ truthy: ["true", "yes"], falsy: ["false", "no"] })),
      ),
    ),

  literal: (value) => makeBasePico(dna.literal(value)),

  or: (...items) => {
    const schemas = items.map(picoToDna) as [DnaSchema, ...DnaSchema[]];
    return makeBasePico(dna.union(schemas));
  },

  xor: (...items) => {
    const [first, ...rest] = items.map(picoToDna) as [DnaSchema, ...DnaSchema[]];
    let combined = first;
    for (const s of rest) {
      combined = combined.xor(s);
    }
    return makeBasePico(combined);
  },

  tuple: (...items) => {
    const schemas = items.map(picoToDna) as [DnaSchema, ...DnaSchema[]];
    return makeBasePico(dna.tuple(schemas));
  },
};

export function picoToDna(pico: unknown): DnaSchema {
  return unwrap(pico) as DnaSchema;
}
