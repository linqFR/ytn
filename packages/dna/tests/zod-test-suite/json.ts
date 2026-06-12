import { z } from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const jsonZod = z.json();
const jsonDna = dna.json();

export const jsonTests = [
  {
    description: "json basic",
    zodSchema: jsonZod,
    dnaSchema: jsonDna,
    tests: [
      { description: "valid json string", data: '{"foo": 123}', valid: true },
      { description: "valid json object", data: { foo: 123 }, valid: true },
      { description: "valid json array", data: [1, 2, 3], valid: true },
      { description: "invalid json string", data: '{not valid json}', valid: false },
    ],
  },
];
