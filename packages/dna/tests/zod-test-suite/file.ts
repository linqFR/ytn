import { z } from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const fileZod = z.file();
const fileDna = dna.file();

export const fileTests = [
  {
    description: "file basic",
    zodSchema: fileZod,
    dnaSchema: fileDna,
    tests: [
      { description: "valid file", data: new File(["content"], "test.txt"), valid: true },
      { description: "invalid not file", data: "not a file", valid: false },
    ],
  },
];
