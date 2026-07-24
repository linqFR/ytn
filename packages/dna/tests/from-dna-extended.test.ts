import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fromDna } from "../src/fromDna/index.js";
import type { DnaType } from "../src/builder/dna-interfaces.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const suiteDir = path.resolve(__dirname, "./zod-test-suite");

const supportedOpcodes = new Set<string>([
  's', 'n', 'i', 'bi', 'b', '$o', 'l', 'e', 'n0', 'undefined', 'T', 'F', 'nan',
  'symbol', 'date', 'coerce', 'a', 'anyOf', 'allOf', 'rcd', 'ref', 'seq',
]);
const supportedWrp = new Set<string>(['optional', 'nullable', 'nullish', 'nonoptional', 'exactOptional', 'default', 'prefault']);

function roundTrip(schema: DnaType<unknown, unknown>, cases: unknown[]) {
  const dna = schema.toDna();
  const rebuilt = fromDna(dna);
  expect(rebuilt.toDna()).toEqual(dna);
  for (const c of cases) {
    expect(rebuilt.safeParse(c)).toEqual(schema.safeParse(c));
    expect(rebuilt.validate(c)).toBe(schema.validate(c));
  }
}

function runGroup(entry: unknown, fileName: string) {
  if (entry === null || typeof entry !== 'object') return;
  const e = entry as Record<string, unknown>;
  const dnaSchema = e.dnaSchema as DnaType<unknown, unknown>;
  const tests = e.tests;
  if (!dnaSchema || !Array.isArray(tests)) return;

  const dnaSeq = dnaSchema.toDna();
  const rootDna = dnaSeq[0];
  const opcode = rootDna[0];
  let supported = supportedOpcodes.has(opcode);
  if (opcode === 'wrp') {
    const wrpParams = rootDna[1];
    if (!supportedWrp.has(wrpParams[0])) supported = false;
  }

  const name = typeof e.description === 'string' ? e.description : `unknown from ${fileName}`;
  if (!supported) {
    it.skip(`${name} (unsupported opcode ${opcode})`, () => {});
    return;
  }

  it(`roundtrips ${name}`, () => {
    roundTrip(dnaSchema, tests.map((t: { data: unknown }) => t.data));
  });
}

describe('fromDna roundtrip extended', () => {
  const testFiles = fs.readdirSync(suiteDir).filter((f) => f.endsWith('.ts'));
  for (const file of testFiles) {
    describe(file, async () => {
      const testName = file.replace('.ts', '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      const testModule = await import(path.join(suiteDir, file));
      const testGroups = testModule[`${testName}Tests`] || [];
      for (const group of testGroups) {
        runGroup(group, file);
      }
    });
  }
});
