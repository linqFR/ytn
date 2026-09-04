import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const fileZod = z.file();
const fileDna = dna.file();

// Additional schemas for expanded test groups
const fileMinZod = z.file().min(5);
const fileMinDna = dna.file().min(5);

const fileMaxZod = z.file().max(8);
const fileMaxDna = dna.file().max(8);

const fileMimeZod = z.file().mime(["text/plain", "application/json"]);
const fileMimeDna = dna.file().mime(["text/plain", "application/json"]);

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
  {
    description: "passing validations with min",
    zodSchema: fileMinZod,
    dnaSchema: fileMinDna,
    tests: [
      { description: "valid min size file", data: new File(["12345"], "test.txt"), valid: true },
    ],
  },
  {
    description: "passing validations with max",
    zodSchema: fileMaxZod,
    dnaSchema: fileMaxDna,
    tests: [
      { description: "valid max size file", data: new File(["12345678"], "test.txt"), valid: true },
    ],
  },
  {
    description: "passing validations with mime",
    zodSchema: fileMimeZod,
    dnaSchema: fileMimeDna,
    tests: [
      { description: "valid mime type", data: new File([""], "test.csv", { type: "text/plain" }), valid: true },
    ],
  },
  {
    description: "failing validations (too small)",
    zodSchema: fileMinZod,
    dnaSchema: fileMinDna,
    tests: [
      { description: "invalid too small", data: new File(["1234"], "test.txt"), valid: false },
    ],
  },
  {
    description: "failing validations (too big)",
    zodSchema: fileMaxZod,
    dnaSchema: fileMaxDna,
    tests: [
      { description: "invalid too big", data: new File(["123456789"], "test.txt"), valid: false },
    ],
  },
  {
    description: "failing validations (wrong MIME)",
    zodSchema: fileMimeZod,
    dnaSchema: fileMimeDna,
    tests: [
      { description: "invalid no mime type", data: new File([""], "test.txt"), valid: false },
      { description: "invalid wrong mime type", data: new File([""], "test.csv", { type: "text/csv" }), valid: false },
    ],
  },
];
