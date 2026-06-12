import { z } from "zod";
import { dna } from "../../src/builder/index.js";

class Test {}
class Subtest extends Test {}
abstract class AbstractBar {
  constructor(public val: string) {}
}
class Bar extends AbstractBar {}

// Reusable schemas matching Zod official tests
const instanceofZod = z.instanceof(Test);
const instanceofDna = dna.instanceof(Test);

const instanceofSubtestZod = z.instanceof(Subtest);
const instanceofSubtestDna = dna.instanceof(Subtest);

const instanceofAbstractZod = z.instanceof(AbstractBar);
const instanceofAbstractDna = dna.instanceof(AbstractBar);

const instanceofBarZod = z.instanceof(Bar);
const instanceofBarDna = dna.instanceof(Bar);

const instanceofFatalZod = z.instanceof(Date).refine((d) => d.toString());

// @ts-ignore - Zod test has incorrect refine (returns string instead of boolean)
const instanceofFatalDna = dna.instanceof(Date).refine((d) => d.toString());

export const instanceofTests = [
  {
    description: "instanceof basic",
    zodSchema: instanceofZod,
    dnaSchema: instanceofDna,
    tests: [
      { description: "valid instance", data: new Test(), valid: true },
      { description: "valid subclass", data: new Subtest(), valid: true },
      { description: "invalid not instance", data: 12, valid: false },
      { description: "invalid null", data: null, valid: false },
    ],
  },
  {
    description: "instanceof subclass",
    zodSchema: instanceofSubtestZod,
    dnaSchema: instanceofSubtestDna,
    tests: [
      { description: "valid subtest", data: new Subtest(), valid: true },
      { description: "invalid parent class", data: new Test(), valid: false },
    ],
  },
  {
    description: "instanceof abstract class",
    zodSchema: instanceofAbstractZod,
    dnaSchema: instanceofAbstractDna,
    tests: [
      { description: "valid subclass of abstract", data: new Bar("asdf"), valid: true },
    ],
  },
  {
    description: "instanceof concrete class",
    zodSchema: instanceofBarZod,
    dnaSchema: instanceofBarDna,
    tests: [
      { description: "valid bar instance", data: new Bar("asdf"), valid: true },
    ],
  },
  {
    description: "instanceof fatal with refine",
    zodSchema: instanceofFatalZod,
    dnaSchema: instanceofFatalDna,
    tests: [
      { description: "invalid null", data: null, valid: false },
    ],
  },
];
