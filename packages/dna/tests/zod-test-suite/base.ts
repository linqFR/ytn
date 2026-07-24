import { z } from "zod";
import { dna } from "../../src/index.js";

export const baseTests = [
  {
    description: "this binding",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "parse can be called as a detached function",
        data: "asdf",
        valid: true,
        customCheck: () => {
          const zodParse = z.string().parse;
          const dnaParse = dna.string().parse;
          return zodParse("asdf") === "asdf" && dnaParse("asdf") === "asdf";
        },
      },
    ],
  },
];
