import { z } from "zod";
import { createHash } from "node:crypto";
import { dna } from "../../src/index.js";

const input = "zodasklfjaasdf";
const md5Hex = createHash("md5").update(input).digest("hex");
const sha256Hex = createHash("sha256").update(input).digest("hex");
const sha1Hex = createHash("sha1").update(input).digest("hex");
const sha384Hex = createHash("sha384").update(input).digest("hex");
const sha512Hex = createHash("sha512").update(input).digest("hex");

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
  {
    description: "hash sha1 hex default",
    zodSchema: z.hash("sha1"),
    dnaSchema: dna.hash("sha1"),
    tests: [
      { description: "valid sha1 hex", data: sha1Hex, valid: true },
      { description: "valid sha1 uppercase hex", data: sha1Hex.toUpperCase(), valid: true },
      { description: "invalid sha1 wrong length", data: sha1Hex.slice(0, -1), valid: false },
    ],
  },
  {
    description: "hash sha384 hex default",
    zodSchema: z.hash("sha384"),
    dnaSchema: dna.hash("sha384"),
    tests: [
      { description: "valid sha384 hex", data: sha384Hex, valid: true },
      { description: "valid sha384 uppercase hex", data: sha384Hex.toUpperCase(), valid: true },
      { description: "invalid sha384 wrong length", data: sha384Hex.slice(0, -1), valid: false },
    ],
  },
  {
    description: "hash sha512 hex default",
    zodSchema: z.hash("sha512"),
    dnaSchema: dna.hash("sha512"),
    tests: [
      { description: "valid sha512 hex", data: sha512Hex, valid: true },
      { description: "valid sha512 uppercase hex", data: sha512Hex.toUpperCase(), valid: true },
      { description: "invalid sha512 wrong length", data: sha512Hex.slice(0, -1), valid: false },
    ],
  },
  {
    description: "hash sha256 uppercase hex allowed",
    zodSchema: z.hash("sha256"),
    dnaSchema: dna.hash("sha256"),
    tests: [
      { description: "valid sha256 uppercase hex", data: sha256Hex.toUpperCase(), valid: true },
    ],
  },
  {
    description: "hash sha256 wrong-length hex rejection",
    zodSchema: z.hash("sha256"),
    dnaSchema: dna.hash("sha256"),
    tests: [
      { description: "invalid sha256 truncated hex", data: sha256Hex.slice(0, -1), valid: false },
    ],
  },
];
