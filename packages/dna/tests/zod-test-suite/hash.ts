import { z } from "zod";
import { createHash } from "node:crypto";
import { dna } from "../../src/index.js";

const input = "zodasklfjaasdf";
const md5Hex = createHash("md5").update(input).digest("hex");
const sha256Hex = createHash("sha256").update(input).digest("hex");

export const hashTests = [
  {
    description: "hash md5 hex default",
    zodSchema: z.hash("md5"),
    dnaSchema: dna.hash("md5"),
    tests: [
      { description: "valid md5 hex", data: md5Hex, valid: true },
      { description: "invalid md5 hex wrong length", data: md5Hex.slice(0, -1), valid: false },
    ],
  },
  {
    description: "hash sha256 hex default",
    zodSchema: z.hash("sha256"),
    dnaSchema: dna.hash("sha256"),
    tests: [
      { description: "valid sha256 hex", data: sha256Hex, valid: true },
    ],
  },
];
