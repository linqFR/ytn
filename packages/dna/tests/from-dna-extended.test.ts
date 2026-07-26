import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fromDna } from "../src/fromDna/index.js";
import type { DnaType } from "../src/builder/dna-interfaces.js";
import type { tsDna, tsDnaSeq } from "../src/types/core.types.js";
import type { tsDnaExternals } from "../src/shared/runtime.types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const suiteDir = path.resolve(__dirname, "./zod-test-suite");

const supportedOpcodes = new Set<string>([
  's', 'n', 'i', 'bi', 'b', '$o', 'l', 'e', 'n0', 'undefined', 'T', 'F', 'nan',
  'symbol', 'date', 'coerce', 'a', 'anyOf', 'allOf', 'oneOf', 'rcd', 'ref', 'seq', 'discriminator',
  'chk', 'url', 'instanceOf', 'wrp', 'cidrv6', 'jwt', 'promise',
]);
const supportedWrp = new Set<string>(['optional', 'nullable', 'nullish', 'nonoptional', 'exactOptional', 'default', 'prefault', 'catch']);

function normalizeDna(seq: tsDnaSeq): tsDna[] {
  if (seq.length === 0) return [];

  function resolveRef(id: number): number {
    let current = id;
    const seen = new Set<number>();
    while (current >= 0 && current < seq.length && !seen.has(current)) {
      seen.add(current);
      const node = seq[current] as tsDna | number[];
      if (typeof node[0] !== 'string' || node[0] !== 'ref') break;
      const p = Array.isArray(node[1]) ? (node[1] as number[])[0] : node[1] as number;
      if (typeof p !== 'number' || p === current) break;
      current = p;
    }
    return current;
  }

  function childIds(id: number): number[] {
    if (id < 0 || id >= seq.length) return [];
    const node = seq[id] as tsDna | number[];
    if (typeof node[0] !== 'string') return [];
    const [opcode, params] = node;
    const out: number[] = [];
    switch (opcode) {
      case '$o':
      case '_o':
      case 'o':
      case 'rcd': {
        if (!Array.isArray(params)) break;
        for (const c of params) {
          if (!Array.isArray(c)) continue;
          const name = c[0];
          if ((name === 'properties' || name === 'defaultProperties') && Array.isArray(c[1])) {
            const sorted = [...c[1]].sort((a: any, b: any) => String(a[0]).localeCompare(String(b[0])));
            for (const e of sorted) out.push(e[1]);
          } else if ((name === 'additionalProperties' || name === 'propertyNames') && typeof c[1] === 'number') {
            out.push(c[1]);
          }
        }
        break;
      }
      case 'wrp':
      case 'coerce': {
        const p = Array.isArray(params) ? params : [];
        if (typeof p[1] === 'number') out.push(p[1]);
        break;
      }
      case 'a': {
        const p = Array.isArray(params) ? params : [];
        for (const c of p) {
          if (Array.isArray(c) && c.length === 2 && (c[0] === 'items' || c[0] === 'contains') && typeof c[1] === 'number') {
            out.push(c[1]);
          }
        }
        break;
      }
      case 'anyOf':
      case 'allOf':
      case 'oneOf': {
        const p = Array.isArray(params) ? params : [];
        for (let i = 1; i < p.length; i++) if (typeof p[i] === 'number') out.push(p[i]);
        break;
      }
      case 'ref': {
        const p = Array.isArray(params) ? params : [params];
        if (typeof p[0] === 'number') out.push(resolveRef(p[0]));
        break;
      }
      case 'seq': {
        const p = Array.isArray(params) ? params : [];
        for (const v of p) if (typeof v === 'number') out.push(v);
        break;
      }
      default:
        break;
    }
    return out;
  }

  const oldToNew = new Map<number, number>();
  const order: number[] = [];
  const visited = new Set<number>();
  function add(id: number) {
    if (id < 0 || id >= seq.length || visited.has(id)) return;
    visited.add(id);
    for (const child of childIds(id)) add(child);
    oldToNew.set(id, order.length);
    order.push(id);
  }
  add(0);
  for (let i = 0; i < seq.length; i++) if (!visited.has(i)) { oldToNew.set(i, order.length); order.push(i); }

  function remap(oldId: number): number { return oldToNew.has(oldId) ? oldToNew.get(oldId)! : oldId; }

  function buildNode(oldId: number): tsDna {
    const node = seq[oldId] as tsDna;
    const [opcode, params, meta] = node;
    let newParams: unknown;
    switch (opcode) {
      case '$o':
      case '_o':
      case 'o':
      case 'rcd': {
        const arr = Array.isArray(params) ? params : [];
        const normArr: unknown[] = [];
        for (const c of arr) {
          if (!Array.isArray(c)) { normArr.push(c); continue; }
          const name = c[0];
          if ((name === 'properties' || name === 'defaultProperties') && Array.isArray(c[1])) {
            const sorted = [...c[1]].sort((a: any, b: any) => String(a[0]).localeCompare(String(b[0])));
            normArr.push([name, sorted.map((e: any) => [e[0], remap(e[1]), e[2]]), ...c.slice(2)]);
          } else if (name === 'required' && Array.isArray(c[1])) {
            normArr.push([name, [...c[1]].sort(), ...c.slice(2)]);
          } else if ((name === 'additionalProperties' || name === 'propertyNames') && typeof c[1] === 'number') {
            normArr.push([name, remap(c[1]), ...c.slice(2)]);
          } else {
            normArr.push(c);
          }
        }
        newParams = normArr;
        break;
      }
      case 'wrp': {
        const p = Array.isArray(params) ? params : [];
        newParams = [p[0], remap(p[1] as number), ...p.slice(2)];
        break;
      }
      case 'coerce': {
        const p = Array.isArray(params) ? params : [];
        newParams = [p[0], remap(p[1] as number)];
        break;
      }
      case 'a': {
        const p = Array.isArray(params) ? params : [];
        newParams = p.map((c: any) => {
          if (Array.isArray(c) && c.length === 2 && (c[0] === 'items' || c[0] === 'contains') && typeof c[1] === 'number') {
            return [c[0], remap(c[1])];
          }
          return c;
        });
        break;
      }
      case 'anyOf':
      case 'allOf':
      case 'oneOf': {
        const p = Array.isArray(params) ? params : [];
        newParams = [p[0], ...p.slice(1).map((v: unknown) => typeof v === 'number' ? remap(v) : v)];
        break;
      }
      case 'ref': {
        const p = Array.isArray(params) ? params : [params];
        newParams = [typeof p[0] === 'number' ? remap(resolveRef(p[0])) : p[0], ...p.slice(1)];
        break;
      }
      case 'seq': {
        const p = Array.isArray(params) ? params : [];
        newParams = p.map((v: unknown) => typeof v === 'number' ? remap(v) : v);
        break;
      }
      default:
        newParams = params;
    }
    return [opcode, newParams, meta];
  }

  return order.filter(id => typeof (seq[id] as tsDna | number[])[0] === 'string').map(buildNode);
}

async function roundTrip(schema: DnaType<unknown, unknown>, cases: unknown[], externals?: tsDnaExternals) {
  const rawDna = schema.toDna();
  const rebuilt = fromDna(rawDna);
  expect(normalizeDna(rebuilt.toDna())).toEqual(normalizeDna(rawDna));
  for (const c of cases) {
    let s1: any, s2: any;
    try {
      s1 = schema.safeParse(c, externals);
      s2 = rebuilt.safeParse(c, externals);
      expect(s2.success).toBe(s1.success);
      if (s1.success) {
        if (s2.success) {
          expect(s2.data).toEqual(s1.data);
        }
      } else {
        if (!s2.success) {
          expect(s2.errors.length).toBe(s1.errors.length);
        }
      }
      expect(rebuilt.validate(c, externals)).toBe(schema.validate(c, externals));
    } catch (err: any) {
      if (err?.message?.includes('async refinements/transforms') || err?.message?.includes('Promise cannot be resolved synchronously')) {
        [s1, s2] = await Promise.all([schema.safeParseAsync(c, externals), rebuilt.safeParseAsync(c, externals)]);
        expect(s2.success).toBe(s1.success);
        if (s1.success) {
          if (s2.success) {
            expect(s2.data).toEqual(s1.data);
          }
        } else {
          if (!s2.success) {
            expect(s2.errors.length).toBe(s1.errors.length);
          }
        }
      } else {
        throw err;
      }
    }
  }
}

function runGroup(entry: unknown, fileName: string) {
  if (entry === null || typeof entry !== 'object') return;
  const e = entry as Record<string, unknown>;
  const dnaSchema = e.dnaSchema as DnaType<unknown, unknown>;
  const tests = e.tests;
  if (!dnaSchema || !Array.isArray(tests)) return;

  const dnaSeq = dnaSchema.toDna();
  const rootDna = dnaSeq[0] as tsDna;
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

  const externals = e.externals as tsDnaExternals | undefined;

  it(`roundtrips ${name}`, async () => {
    await roundTrip(dnaSchema, tests.map((t: { data: unknown }) => t.data), externals);
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
