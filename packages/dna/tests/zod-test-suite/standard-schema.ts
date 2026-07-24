import { z } from "zod";
import { dna } from "../../src/index.js";

export const standardSchemaTests = [
  {
    description: "Standard Schema validate string",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "valid string returns value",
        data: "asdf",
        valid: true,
        customCheck: async () => {
          const zodResult = await (z.string() as any)["~standard"].validate("asdf");
          const dnaResult = await (dna.string() as any)["~standard"].validate("asdf");
          return zodResult.value === "asdf" && dnaResult.value === "asdf";
        },
      },
      {
        description: "invalid number returns issues",
        data: 123,
        valid: false,
        customCheck: async () => {
          const zodResult = await (z.string() as any)["~standard"].validate(123);
          const dnaResult = await (dna.string() as any)["~standard"].validate(123);
          return (
            (zodResult.issues?.length ?? 0) > 0 &&
            (dnaResult.issues?.length ?? 0) > 0
          );
        },
      },
    ],
  },
];
