import { z } from "zod";
import { dna } from "../../src/index.js";

const isEmptySchema = (v: any) => v === true || (typeof v === 'object' && v !== null && Object.keys(v).length === 0);
const contains = (dna: any, zod: any): boolean => {
	if (dna === true) return true;
	if (dna === false) return zod === false;
	if (zod === true || isEmptySchema(zod)) return isEmptySchema(dna);
	if (zod === null || typeof zod !== 'object') return dna === zod;
	if (Array.isArray(zod)) {
		if (!Array.isArray(dna)) return false;
		if (zod.length > dna.length) return false;
		for (let i = 0; i < zod.length; i++) if (!contains(dna[i], zod[i])) return false;
		return true;
	}
	for (const k of Object.keys(zod)) {
		if (!(k in dna)) return false;
		if (!contains(dna[k], zod[k])) return false;
	}
	return true;
};

const cases: [string, any, any, any, boolean][] = [
  ["string", z.string(), dna.string(), "hello", true],
  ["number", z.number(), dna.number(), 42, true],
  ["boolean", z.boolean(), dna.boolean(), true, true],
  ["null", z.null(), dna.null(), null, true],
  ["any", z.any(), dna.any(), "anything", true],
  ["unknown", z.unknown(), dna.unknown(), "anything", true],
  ["never", z.never(), dna.never(), null, false],
  ["array of strings", z.array(z.string()), dna.array(dna.string()), ["a", "b"], true],
  ["object strip default", z.object({ name: z.string() }), dna.object({ name: dna.string() }), { name: "x" }, true],
  ["object strict", z.object({ name: z.string() }).strict(), dna.object({ name: dna.string() }).strict(), { name: "x" }, true],
  ["object loose", z.object({ name: z.string() }).loose(), dna.object({ name: dna.string() }).loose(), { name: "x", extra: 1 }, true],
  ["optional", z.string().optional(), dna.string().optional(), undefined, true],
  ["nullable", z.string().nullable(), dna.string().nullable(), null, true],
  ["union", z.union([z.string(), z.number()]), dna.union([dna.string(), dna.number()]), "a", true],
  ["literal", z.literal("a"), dna.literal("a"), "a", true],
  ["enum", z.enum(["a", "b"]), dna.enum(["a", "b"]), "a", true],
  ["record", z.record(z.string(), z.string()), dna.record(dna.string(), dna.string()), { a: "x" }, true],
  ["tuple", z.tuple([z.string(), z.number()]), dna.tuple([dna.string(), dna.number()]), ["a", 1], true],
  ["intersection", z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })), dna.intersection(dna.object({ a: dna.string() }), dna.object({ b: dna.number() })), { a: "x", b: 1 }, true],
];

export const toJsonSchemaTests = cases.map(([name, zodSchema, dnaSchema, data, valid]) => ({
  description: `toJSONSchema ${name}`,
  zodSchema,
  dnaSchema,
  tests: [
    {
      description: `toJSONSchema matches for ${name}`,
      data,
      valid,
      customCheck: () => contains(dnaSchema.toJSONSchema(), zodSchema.toJSONSchema()),
    },
  ],
}));
