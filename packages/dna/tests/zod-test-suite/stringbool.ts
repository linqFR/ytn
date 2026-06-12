import * as z from "zod";
import { dna } from "../../src/builder/index.js";

export const stringboolTests = [
  {
    description: "default stringbool",
    zodSchema: z.stringbool(),
    dnaSchema: dna.stringbool(),
    tests: [
      {
        description: "valid true values",
        data: "true",
        valid: true,
      },
      {
        description: "valid yes",
        data: "yes",
        valid: true,
      },
      {
        description: "valid 1",
        data: "1",
        valid: true,
      },
      {
        description: "valid on",
        data: "on",
        valid: true,
      },
      {
        description: "valid y",
        data: "y",
        valid: true,
      },
      {
        description: "valid enabled",
        data: "enabled",
        valid: true,
      },
      {
        description: "valid TRUE",
        data: "TRUE",
        valid: true,
      },
      {
        description: "valid false",
        data: "false",
        valid: true,
      },
      {
        description: "valid no",
        data: "no",
        valid: true,
      },
      {
        description: "valid 0",
        data: "0",
        valid: true,
      },
      {
        description: "valid off",
        data: "off",
        valid: true,
      },
      {
        description: "valid n",
        data: "n",
        valid: true,
      },
      {
        description: "valid disabled",
        data: "disabled",
        valid: true,
      },
      {
        description: "valid FALSE",
        data: "FALSE",
        valid: true,
      },
      {
        description: "invalid other string",
        data: "other",
        valid: false,
      },
      {
        description: "invalid empty string",
        data: "",
        valid: false,
      },
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
      {
        description: "invalid object",
        data: {},
        valid: false,
      },
      {
        description: "invalid boolean true",
        data: true,
        valid: false,
      },
      {
        description: "invalid boolean false",
        data: false,
        valid: false,
      },
    ],
  },
  {
    description: "custom truthy/falsy values",
    zodSchema: z.stringbool({
      truthy: ["y"],
      falsy: ["N"],
    }),
    dnaSchema: dna.stringbool({
      truthy: ["y"],
      falsy: ["N"],
    }),
    tests: [
      {
        description: "valid y",
        data: "y",
        valid: true,
      },
      {
        description: "valid Y (case insensitive)",
        data: "Y",
        valid: true,
      },
      {
        description: "valid n (case insensitive)",
        data: "n",
        valid: true,
      },
      {
        description: "valid N",
        data: "N",
        valid: true,
      },
      {
        description: "invalid true",
        data: "true",
        valid: false,
      },
      {
        description: "invalid false",
        data: "false",
        valid: false,
      },
    ],
  },
  {
    description: "case sensitive custom values",
    zodSchema: z.stringbool({
      truthy: ["y"],
      falsy: ["N"],
      case: "sensitive",
    }),
    dnaSchema: dna.stringbool({
      truthy: ["y"],
      falsy: ["N"],
      case: "sensitive",
    }),
    tests: [
      {
        description: "valid y (lowercase)",
        data: "y",
        valid: true,
      },
      {
        description: "invalid Y (uppercase)",
        data: "Y",
        valid: false,
      },
      {
        description: "valid N (uppercase)",
        data: "N",
        valid: true,
      },
      {
        description: "invalid n (lowercase)",
        data: "n",
        valid: false,
      },
      {
        description: "invalid TRUE",
        data: "TRUE",
        valid: false,
      },
    ],
  },
  {
    description: "custom error message",
    zodSchema: z.stringbool("wrong!"),
    dnaSchema: dna.stringbool("wrong!"),
    tests: [
      {
        description: "valid true",
        data: "true",
        valid: true,
      },
      {
        description: "invalid with custom error",
        data: "",
        valid: false,
      },
    ],
  },
];
