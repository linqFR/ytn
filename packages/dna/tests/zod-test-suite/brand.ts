import { z } from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const brandZod = z.object({ name: z.string() }).brand<"MyBrand">();
const brandDna = dna.object({ name: dna.string() }).brand<"MyBrand">();

export const brandTests = [
  {
    description: "brand basic",
    zodSchema: brandZod,
    dnaSchema: brandDna,
    tests: [
      { description: "valid object", data: { name: "hello" }, valid: true },
      { description: "invalid missing field", data: {}, valid: false },
    ],
  },
];
