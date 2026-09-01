import { z } from "zod";
import { dna } from "../../src/index.js";

// Self-referential object schemas (cyclic data)
const nodeZod: any = z.object({
  id: z.number(),
  get self() {
    return nodeZod;
  },
});

const nodeDna: any = dna.object({
  id: dna.number(),
  self: dna.lazy(() => nodeDna),
});

// Mutual recursion
const aZod: any = z.object({
  x: z.string(),
  get b() {
    return bZod;
  },
});
const bZod: any = z.object({
  y: z.number(),
  get a() {
    return aZod;
  },
});

const aDna: any = dna.object({
  x: dna.string(),
  b: dna.lazy(() => bDna),
});
const bDna: any = dna.object({
  y: dna.number(),
  a: dna.lazy(() => aDna),
});

// Self-referential with refine
const nodeRefineZod: any = z
  .object({
    id: z.number(),
    get self() {
      return nodeRefineZod;
    },
  })
  .refine((value: any) => value.id > 100, "too small");

const nodeRefineDna: any = dna
  .object({
    id: dna.number(),
    self: dna.lazy(() => nodeRefineDna),
  })
  .refine((value: any) => value.id > 100, "too small");

// Self-referential array
const arrayNodeZod: any = z.object({
  id: z.number(),
  get kids() {
    return z.array(arrayNodeZod);
  },
});

const arrayNodeDna: any = dna.object({
  id: dna.number(),
  kids: dna.array(dna.lazy(() => arrayNodeDna)),
});

// Self-referential record
const recordNodeZod: any = z.object({
  id: z.number(),
  get kids() {
    return z.record(z.string(), recordNodeZod);
  },
});
const recordNodeDna: any = dna.object({
  id: dna.number(),
  kids: dna.record(dna.string(), dna.lazy(() => recordNodeDna)),
});

// Self-referential tuple
const tupleNodeZod: any = z.object({
  id: z.number(),
  get pair() {
    return z.tuple([z.number(), tupleNodeZod]);
  },
});
const tupleNodeDna: any = dna.object({
  id: dna.number(),
  pair: dna.tuple([dna.number(), dna.lazy(() => tupleNodeDna)]),
});

// Self-referential set
const setNodeZod: any = z.object({
  id: z.number(),
  get peers() {
    return z.set(setNodeZod);
  },
});
const setNodeDna: any = dna.object({
  id: dna.number(),
  peers: dna.set(dna.lazy(() => setNodeDna)),
});

// Self-referential map
const mapNodeZod: any = z.object({
  id: z.number(),
  get links() {
    return z.map(z.string(), mapNodeZod);
  },
});
const mapNodeDna: any = dna.object({
  id: dna.number(),
  links: dna.map(dna.string(), dna.lazy(() => mapNodeDna)),
});

// Self-referential union
const unionNodeZod: any = z.object({
  id: z.number(),
  get self() {
    return z.union([z.string(), unionNodeZod]);
  },
});
const unionNodeDna: any = dna.object({
  id: dna.number(),
  self: dna.union([dna.string(), dna.lazy(() => unionNodeDna)]),
});

// Self-referential discriminated union
const discUnionZod: any = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("leaf"), v: z.number() }),
  z.object({
    kind: z.literal("branch"),
    get next() {
      return discUnionZod;
    },
  }),
]);
const discUnionDna: any = dna.discriminatedUnion("kind", [
  dna.object({ kind: dna.literal("leaf"), v: dna.number() }),
  dna.object({ kind: dna.literal("branch"), next: dna.lazy(() => discUnionDna) }),
]);

// Self-referential with transform (not on cycle)
const transformNodeZod: any = z.object({
  n: z.number().transform((value: number) => value * 2),
  get self() {
    return transformNodeZod;
  },
});
const transformNodeDna: any = dna.object({
  n: dna.number().transform((value: number) => value * 2),
  self: dna.lazy(() => transformNodeDna),
});

// Self-referential through readonly
const readonlyNodeZod: any = z.object({
  id: z.number(),
  get self() {
    return readonlyNodeZod.readonly();
  },
});
const readonlyNodeDna: any = dna.object({
  id: dna.number(),
  self: dna.lazy(() => readonlyNodeDna).readonly(),
});

// Self-referential through intersection
const intersectionNodeZod: any = z.object({
  id: z.number(),
  get self() {
    return z.intersection(intersectionNodeZod, z.object({ id: z.number() }));
  },
});
const intersectionNodeDna: any = dna.object({
  id: dna.number(),
  self: dna.intersection(dna.lazy(() => intersectionNodeDna), dna.object({ id: dna.number() })),
});

// Mutual recursion 5 hops
const hopAZod: any = z.object({ get b() { return hopBZod; } });
const hopBZod: any = z.object({ get c() { return hopCZod; } });
const hopCZod: any = z.object({ get d() { return hopDZod; } });
const hopDZod: any = z.object({ get e() { return hopEZod; } });
const hopEZod: any = z.object({ get a() { return hopAZod; } });

const hopADna: any = dna.object({ b: dna.lazy(() => hopBDna) });
const hopBDna: any = dna.object({ c: dna.lazy(() => hopCDna) });
const hopCDna: any = dna.object({ d: dna.lazy(() => hopDDna) });
const hopDDna: any = dna.object({ e: dna.lazy(() => hopEDna) });
const hopEDna: any = dna.object({ a: dna.lazy(() => hopADna) });

export const cyclicDataTests = [
  {
    description: "self-referential object - valid cycle",
    zodSchema: nodeZod,
    dnaSchema: nodeDna,
    tests: [
      { description: "valid self-referential input", data: (() => { const o: any = { id: 1, self: null }; o.self = o; return o; })(), valid: true },
    ],
  },
  {
    description: "self-referential object - invalid id in cycle",
    zodSchema: nodeZod,
    dnaSchema: nodeDna,
    tests: [
      { description: "invalid id type in cycle", data: (() => { const o: any = { id: "nope", self: null }; o.self = o; return o; })(), valid: false },
    ],
  },
  {
    description: "mutual recursion - invalid y",
    zodSchema: aZod,
    dnaSchema: aDna,
    tests: [
      { description: "invalid y type in mutual recursion", data: (() => { const o: any = { x: "s", y: "not a number", a: null, b: null }; o.a = o; o.b = o; return o; })(), valid: false },
    ],
  },
  {
    description: "self-referential with refine - id too small",
    zodSchema: nodeRefineZod,
    dnaSchema: nodeRefineDna,
    tests: [
      { description: "id 1 fails refine (>100)", data: (() => { const o: any = { id: 1, self: null }; o.self = o; return o; })(), valid: false },
    ],
  },
  {
    description: "self-referential with refine - id large enough",
    zodSchema: nodeRefineZod,
    dnaSchema: nodeRefineDna,
    tests: [
      { description: "id 200 passes refine", data: (() => { const o: any = { id: 200, self: null }; o.self = o; return o; })(), valid: true },
    ],
  },
  {
    description: "self-referential array - valid",
    zodSchema: arrayNodeZod,
    dnaSchema: arrayNodeDna,
    tests: [
      { description: "valid nested array node", data: { id: 1, kids: [{ id: 2, kids: [] }] }, valid: true },
    ],
  },
  {
    description: "self-referential array - invalid kid id",
    zodSchema: arrayNodeZod,
    dnaSchema: arrayNodeDna,
    tests: [
      { description: "invalid kid id type", data: { id: 1, kids: [{ id: "bad", kids: [] }] }, valid: false },
    ],
  },
  {
    description: "breaks cycle through record",
    zodSchema: recordNodeZod,
    dnaSchema: recordNodeDna,
    tests: [
      {
        description: "valid self-referential record",
        data: (() => { const o: any = { id: 1, kids: {} }; o.kids.self = o; return o; })(),
        valid: true,
      },
    ],
  },
  {
    description: "breaks cycle through tuple",
    zodSchema: tupleNodeZod,
    dnaSchema: tupleNodeDna,
    tests: [
      {
        description: "valid self-referential tuple",
        data: (() => { const o: any = { id: 1 }; o.pair = [1, o]; return o; })(),
        valid: true,
      },
    ],
  },
  {
    description: "breaks cycle through set",
    zodSchema: setNodeZod,
    dnaSchema: setNodeDna,
    tests: [
      {
        description: "valid self-referential set",
        data: (() => { const o: any = { id: 1, peers: new Set() }; o.peers.add(o); return o; })(),
        valid: true,
      },
    ],
  },
  {
    description: "breaks cycle through map",
    zodSchema: mapNodeZod,
    dnaSchema: mapNodeDna,
    tests: [
      {
        description: "valid self-referential map",
        data: (() => { const o: any = { id: 1, links: new Map() }; o.links.set("s", o); return o; })(),
        valid: true,
      },
    ],
  },
  {
    description: "breaks cycle through union",
    zodSchema: unionNodeZod,
    dnaSchema: unionNodeDna,
    tests: [
      {
        description: "valid self-referential union",
        data: (() => { const o: any = { id: 1 }; o.self = o; return o; })(),
        valid: true,
      },
    ],
  },
  {
    description: "breaks cycle through discriminated union",
    zodSchema: discUnionZod,
    dnaSchema: discUnionDna,
    tests: [
      {
        description: "valid self-referential discriminated union",
        data: (() => { const o: any = { kind: "branch" }; o.next = o; return o; })(),
        valid: true,
      },
      {
        description: "valid leaf in discriminated union",
        data: { kind: "leaf", v: 42 },
        valid: true,
      },
    ],
  },
  {
    description: "breaks cycle through lazy",
    zodSchema: nodeZod,
    dnaSchema: nodeDna,
    tests: [
      {
        description: "valid lazy self-referential",
        data: (() => { const o: any = { id: 1 }; o.self = o; return o; })(),
        valid: true,
      },
    ],
  },
  {
    description: "mutual recursion 5 hops apart",
    zodSchema: hopAZod,
    dnaSchema: hopADna,
    tests: [
      {
        description: "valid 5-hop mutual recursion",
        data: (() => { const a: any = {}; a.b = { c: { d: { e: { a } } } }; return a; })(),
        valid: true,
      },
    ],
  },
  {
    description: "leaves a transform not on the cycle alone",
    zodSchema: transformNodeZod,
    dnaSchema: transformNodeDna,
    tests: [
      {
        description: "transform applies inside cycle",
        data: (() => { const o: any = { n: 21 }; o.self = o; return o; })(),
        valid: true,
        customCheck: () => {
          const input: any = { n: 21 };
          input.self = input;
          const zodResult = transformNodeZod.parse(input);
          const dnaResult = transformNodeDna.parse(input);
          return zodResult.n === 42 && dnaResult.n === 42;
        },
      },
    ],
  },
  {
    description: "cycle through readonly",
    zodSchema: readonlyNodeZod,
    dnaSchema: readonlyNodeDna,
    tests: [
      {
        description: "valid readonly cycle",
        data: (() => { const o: any = { id: 1 }; o.self = o; return o; })(),
        valid: true,
      },
    ],
  },
  {
    description: "cycle through intersection",
    zodSchema: intersectionNodeZod,
    dnaSchema: intersectionNodeDna,
    tests: [
      {
        description: "valid intersection cycle",
        data: (() => { const o: any = { id: 7 }; o.self = o; return o; })(),
        valid: true,
      },
      {
        description: "invalid intersection cycle",
        data: (() => { const o: any = { id: "nope" }; o.self = o; return o; })(),
        valid: false,
      },
    ],
  },
  {
    description: "keeps separate parses independent",
    zodSchema: nodeZod,
    dnaSchema: nodeDna,
    tests: [
      {
        description: "two parses of same input are independent",
        data: { id: 1 },
        valid: true,
        customCheck: () => {
          const input: any = { id: 1 };
          input.self = input;
          const zodFirst = nodeZod.parse(input);
          const zodSecond = nodeZod.parse(input);
          const dnaFirst = nodeDna.parse(input);
          const dnaSecond = nodeDna.parse(input);
          return zodFirst !== zodSecond && dnaFirst !== dnaSecond &&
            zodFirst.self === zodFirst && dnaFirst.self === dnaFirst;
        },
      },
    ],
  },
  {
    description: "non-recursive schema copies shared reference twice",
    zodSchema: z.object({ a: z.object({ v: z.number() }), b: z.object({ v: z.number() }) }),
    dnaSchema: dna.object({ a: dna.object({ v: dna.number() }), b: dna.object({ v: dna.number() }) }),
    tests: [
      {
        description: "shared leaf is copied twice",
        data: { a: { v: 1 }, b: { v: 1 } },
        valid: true,
        customCheck: () => {
          const shared = { v: 1 };
          const zodResult = z.object({ a: z.object({ v: z.number() }), b: z.object({ v: z.number() }) }).parse({ a: shared, b: shared });
          const dnaResult = dna.object({ a: dna.object({ v: dna.number() }), b: dna.object({ v: dna.number() }) }).parse({ a: shared, b: shared });
          return zodResult.a !== zodResult.b && dnaResult.a !== dnaResult.b;
        },
      },
    ],
  },
  {
    description: "recursive schema shares one output node per input node",
    zodSchema: arrayNodeZod,
    dnaSchema: arrayNodeDna,
    tests: [
      {
        description: "shared kid is same output object",
        data: { id: 0, kids: [{ id: 1, kids: [] }, { id: 1, kids: [] }] },
        valid: true,
        customCheck: () => {
          const shared: any = { v: 1, kids: [] };
          const zodResult = arrayNodeZod.parse({ v: 0, kids: [shared, shared] });
          const dnaResult = arrayNodeDna.parse({ v: 0, kids: [shared, shared] });
          return zodResult.kids[0] === zodResult.kids[1] && dnaResult.kids[0] === dnaResult.kids[1];
        },
      },
    ],
  },
  {
    description: "does not mutate input and tolerates frozen",
    zodSchema: nodeZod,
    dnaSchema: nodeDna,
    tests: [
      {
        description: "frozen input is not mutated",
        data: (() => { const o: any = { id: 1 }; o.self = o; Object.freeze(o); return o; })(),
        valid: true,
      },
    ],
  },
  {
    description: "closes cycle through Map key and Set member",
    zodSchema: z.object({ id: z.number() }),
    dnaSchema: dna.object({ id: dna.number() }),
    tests: [
      {
        description: "cycle through Map key",
        data: { id: 1 },
        valid: true,
        customCheck: () => {
          const KeyedZod: any = z.object({ id: z.number(), get keyed() { return z.map(KeyedZod, z.string()); } });
          const KeyedDna: any = dna.object({ id: dna.number(), keyed: dna.map(dna.lazy(() => KeyedDna), dna.string()) });
          const k: any = { id: 1, keyed: new Map() };
          k.keyed.set(k, "v");
          try {
            const zodOut = KeyedZod.parse(k);
            const dnaOut = KeyedDna.parse(k);
            return [...zodOut.keyed.keys()][0] === zodOut && [...dnaOut.keyed.keys()][0] === dnaOut;
          } catch { return false; }
        },
      },
      {
        description: "cycle through Set member",
        data: { id: 1 },
        valid: true,
        customCheck: () => {
          const PeeredZod: any = z.object({ id: z.number(), get peers() { return z.set(PeeredZod); } });
          const PeeredDna: any = dna.object({ id: dna.number(), peers: dna.set(dna.lazy(() => PeeredDna)) });
          const p: any = { id: 1, peers: new Set() };
          p.peers.add(p);
          try {
            const zodOut = PeeredZod.parse(p);
            const dnaOut = PeeredDna.parse(p);
            return [...zodOut.peers][0] === zodOut && [...dnaOut.peers][0] === dnaOut;
          } catch { return false; }
        },
      },
    ],
  },
  {
    description: "parses cycle asynchronously",
    zodSchema: z.object({ id: z.number() }),
    dnaSchema: dna.object({ id: dna.number() }),
    tests: [
      {
        description: "async parse of self-referential input",
        data: { id: 1 },
        valid: true,
        customCheck: async () => {
          const AsyncNodeZod: any = z.object({ id: z.number().refine(async (v: number) => v > 0), get self() { return AsyncNodeZod; } });
          const AsyncNodeDna: any = dna.object({ id: dna.number().refine(async (v: number) => v > 0), self: dna.lazy(() => AsyncNodeDna) });
          const input: any = { id: 1 };
          input.self = input;
          const zodResult = await AsyncNodeZod.parseAsync(input);
          const dnaResult = await AsyncNodeDna.parseAsync(input);
          return zodResult.self === zodResult && dnaResult.self === dnaResult;
        },
      },
    ],
  },
  {
    description: "keeps two cycles and a shared node distinct",
    zodSchema: arrayNodeZod,
    dnaSchema: arrayNodeDna,
    tests: [
      {
        description: "root cycle + shared kid",
        data: { id: 0, kids: [{ id: 9, kids: [] }, { id: 9, kids: [] }] },
        valid: true,
        customCheck: () => {
          const shared: any = { id: 9, kids: [] };
          const root: any = { id: 0, kids: [shared, shared] };
          root.kids.push(root);
          try {
            const zodResult = arrayNodeZod.parse(root);
            const dnaResult = arrayNodeDna.parse(root);
            return zodResult.kids[0] === zodResult.kids[1] && zodResult.kids[2] === zodResult &&
              dnaResult.kids[0] === dnaResult.kids[1] && dnaResult.kids[2] === dnaResult;
          } catch { return false; }
        },
      },
    ],
  },
];
