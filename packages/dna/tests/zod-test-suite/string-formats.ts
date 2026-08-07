import * as z from "zod";
import { dna } from "../../src/index.js";

export const stringFormatsTests = [
  {
    description: "email with min constraint",
    zodSchema: z.email().min(10),
    dnaSchema: dna.email().min(10),
    tests: [
      {
        description: "valid long email",
        data: "longemail@example.com",
        valid: true,
      },
      {
        description: "invalid short email",
        data: "ort@e.co",
        valid: false,
      },
    ],
  },
  {
    description: "email with max constraint",
    zodSchema: z.email().max(10),
    dnaSchema: dna.email().max(10),
    tests: [
      {
        description: "valid short email",
        data: "sho@e.co",
        valid: true,
      },
      {
        description: "invalid long email",
        data: "longemail@example.com",
        valid: false,
      },
    ],
  },
  {
    description: "email with exact length",
    zodSchema: z.email().length(10),
    dnaSchema: dna.email().length(10),
    tests: [
      {
        description: "valid exact length",
        data: "56780@e.co",
        valid: true,
      },
      {
        description: "invalid too long",
        data: "shoasdfasdfrt@e.co",
        valid: false,
      },
    ],
  },
  {
    description: "email with uppercase",
    zodSchema: z.email().uppercase(),
    dnaSchema: dna.email().uppercase(),
    tests: [
      {
        description: "valid uppercase email",
        data: "EMAIL@EXAMPLE.COM",
        valid: true,
      },
      {
        description: "invalid lowercase email",
        data: "email@example.com",
        valid: false,
      },
    ],
  },
  {
    description: "email with lowercase",
    zodSchema: z.email().lowercase(),
    dnaSchema: dna.email().lowercase(),
    tests: [
      {
        description: "valid lowercase email",
        data: "email@example.com",
        valid: true,
      },
      {
        description: "invalid uppercase email",
        data: "EMAIL@EXAMPLE.COM",
        valid: false,
      },
    ],
  },
  {
    description: "hex format",
    zodSchema: z.hex(),
    dnaSchema: dna.hex(),
    tests: [
      {
        description: "valid empty hex",
        data: "",
        valid: true,
      },
      {
        description: "valid lowercase hex",
        data: "123abc",
        valid: true,
      },
      {
        description: "valid uppercase hex",
        data: "DEADBEEF",
        valid: true,
      },
      {
        description: "valid mixed case hex",
        data: "0123456789abcdefABCDEF",
        valid: true,
      },
      {
        description: "invalid with letters g-z",
        data: "xyz",
        valid: false,
      },
      {
        description: "invalid with g",
        data: "123g",
        valid: false,
      },
      {
        description: "invalid with spaces",
        data: "hello world",
        valid: false,
      },
      {
        description: "invalid with dash",
        data: "123-abc",
        valid: false,
      },
    ],
  },
  {
    description: "guid format (permissive 8-4-4-4-12 hex, less strict than uuid)",
    zodSchema: z.guid(),
    dnaSchema: dna.guid(),
    tests: [
      {
        description: "valid standard uuid",
        data: "550e8400-e29b-41d4-a716-446655440000",
        valid: true,
      },
      {
        description: "valid guid with non-variant bits (01d4 — would fail uuid)",
        data: "550e8400-e29b-01d4-a716-446655440000",
        valid: true,
      },
      {
        description: "valid guid with non-variant bits (ff in 3rd group)",
        data: "550e8400-e29b-ff d4-a716-446655440000".replace(" ", ""),
        valid: true,
      },
      {
        description: "invalid non-hex character",
        data: "550e8400-e29b-41d4-a716-44665544000g",
        valid: false,
      },
      {
        description: "invalid wrong length",
        data: "550e8400-e29b-41d4-a716",
        valid: false,
      },
      {
        description: "invalid missing dashes",
        data: "550e8400e29b41d4a716446655440000",
        valid: false,
      },
    ],
  },
];
