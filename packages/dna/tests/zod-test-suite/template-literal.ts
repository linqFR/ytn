import * as z from "zod";
import { dna } from "../../src/index.js";

export const templateLiteralTests = [
  {
    description: "empty template literal",
    zodSchema: z.templateLiteral([]),
    dnaSchema: dna.templateLiteral([]),
    tests: [
      {
        description: "valid empty string",
        data: "",
        valid: true,
      },
      {
        description: "invalid non-empty string",
        data: "a",
        valid: false,
      },
    ],
  },
  {
    description: "literal string template",
    zodSchema: z.templateLiteral(["hello"]),
    dnaSchema: dna.templateLiteral(["hello"]),
    tests: [
      {
        description: "valid literal",
        data: "hello",
        valid: true,
      },
      {
        description: "invalid with prefix",
        data: "!hello",
        valid: false,
      },
      {
        description: "invalid with suffix",
        data: "hello!",
        valid: false,
      },
    ],
  },
  {
    description: "literal number template",
    zodSchema: z.templateLiteral([1]),
    dnaSchema: dna.templateLiteral([1]),
    tests: [
      {
        description: "valid number string",
        data: "1",
        valid: true,
      },
      {
        description: "invalid different number",
        data: "2",
        valid: false,
      },
    ],
  },
  {
    description: "literal boolean template",
    zodSchema: z.templateLiteral([true]),
    dnaSchema: dna.templateLiteral([true]),
    tests: [
      {
        description: "valid true",
        data: "true",
        valid: true,
      },
      {
        description: "invalid false",
        data: "false",
        valid: false,
      },
    ],
  },
  {
    description: "dynamic string part",
    zodSchema: z.templateLiteral(["", z.string()]),
    dnaSchema: dna.templateLiteral(["", dna.string()]),
    tests: [
      {
        description: "valid any string",
        data: "blahblahblah",
        valid: true,
      },
      {
        description: "valid empty string",
        data: "",
        valid: true,
      },
    ],
  },
  {
    description: "dynamic number part",
    zodSchema: z.templateLiteral(["", z.number()]),
    dnaSchema: dna.templateLiteral(["", dna.number()]),
    tests: [
      {
        description: "valid integer",
        data: "123",
        valid: true,
      },
      {
        description: "valid float",
        data: "1.23",
        valid: true,
      },
      {
        description: "valid negative",
        data: "-1.23",
        valid: true,
      },
      {
        description: "invalid with letters",
        data: "123a",
        valid: false,
      },
    ],
  },
  {
    description: "dynamic boolean part",
    zodSchema: z.templateLiteral(["", z.boolean()]),
    dnaSchema: dna.templateLiteral(["", dna.boolean()]),
    tests: [
      {
        description: "valid true",
        data: "true",
        valid: true,
      },
      {
        description: "valid false",
        data: "false",
        valid: true,
      },
      {
        description: "invalid number",
        data: "123",
        valid: false,
      },
    ],
  },
  {
    description: "literal with dynamic part",
    zodSchema: z.templateLiteral(["", z.literal("world")]),
    dnaSchema: dna.templateLiteral(["", dna.literal("world")]),
    tests: [
      {
        description: "valid literal",
        data: "world",
        valid: true,
      },
      {
        description: "invalid different",
        data: "hello",
        valid: false,
      },
    ],
  },
  {
    description: "optional part",
    zodSchema: z.templateLiteral(["", z.literal("yeah").optional()]),
    dnaSchema: dna.templateLiteral(["", dna.literal("yeah").optional()]),
    tests: [
      {
        description: "valid with literal",
        data: "yeah",
        valid: true,
      },
      {
        description: "valid empty",
        data: "",
        valid: true,
      },
      {
        description: "invalid different",
        data: "no",
        valid: false,
      },
    ],
  },
  {
    description: "nullable part",
    zodSchema: z.templateLiteral(["", z.nullable(z.literal("yo"))]),
    dnaSchema: dna.templateLiteral(["", dna.nullable(dna.literal("yo"))]),
    tests: [
      {
        description: "valid with literal",
        data: "yo",
        valid: true,
      },
      {
        description: "valid null",
        data: "null",
        valid: true,
      },
      {
        description: "invalid different",
        data: "no",
        valid: false,
      },
    ],
  },
  {
    description: "email format",
    zodSchema: z.templateLiteral(["", z.string().email()]),
    dnaSchema: dna.templateLiteral(["", dna.string().email()]),
    tests: [
      {
        description: "valid email",
        data: "info@example.com",
        valid: true,
      },
      {
        description: "invalid email",
        data: "info@example.com@",
        valid: false,
      },
    ],
  },
  {
    description: "uuid format",
    zodSchema: z.templateLiteral(["", z.string().uuid()]),
    dnaSchema: dna.templateLiteral(["", dna.string().uuid()]),
    tests: [
      {
        description: "valid uuid",
        data: "808989fd-3a6e-4af2-b607-737323a176f6",
        valid: true,
      },
      {
        description: "invalid uuid",
        data: "not-a-uuid",
        valid: false,
      },
    ],
  },
  {
    description: "ipv4 format",
    zodSchema: z.templateLiteral(["", z.string().ipv4()]),
    dnaSchema: dna.templateLiteral(["", dna.string().ipv4()]),
    tests: [
      {
        description: "valid ipv4",
        data: "213.174.246.205",
        valid: true,
      },
      {
        description: "invalid ipv4",
        data: "1213.174.246.205",
        valid: false,
      },
    ],
  },
  {
    description: "string with min constraint",
    zodSchema: z.templateLiteral(["", z.string().min(5)]),
    dnaSchema: dna.templateLiteral(["", dna.string().min(5)]),
    tests: [
      {
        description: "valid min length",
        data: "hello",
        valid: true,
      },
      {
        description: "invalid too short",
        data: "1234",
        valid: false,
      },
    ],
  },
  {
    description: "string with max constraint",
    zodSchema: z.templateLiteral(["", z.string().max(5)]),
    dnaSchema: dna.templateLiteral(["", dna.string().max(5)]),
    tests: [
      {
        description: "valid max length",
        data: "hello",
        valid: true,
      },
      {
        description: "invalid too long",
        data: "123456",
        valid: false,
      },
    ],
  },
  {
    description: "complex URL pattern",
    zodSchema: z.templateLiteral(["https://", z.string().regex(/\w+/), ".", z.enum(["com", "net"])]),
    dnaSchema: dna.templateLiteral(["https://", dna.string().regex(/\w+/), ".", dna.enum(["com", "net"])]),
    tests: [
      {
        description: "valid com URL",
        data: "https://example.com",
        valid: true,
      },
      {
        description: "valid net URL",
        data: "https://speedtest.net",
        valid: true,
      },
      {
        description: "invalid protocol",
        data: "http://example.com",
        valid: false,
      },
      {
        description: "invalid TLD",
        data: "https://example.org",
        valid: false,
      },
    ],
  },
  {
    description: "measurement with unit",
    zodSchema: z.templateLiteral([
      "",
      z.number().finite(),
      z.enum(["px", "em", "rem", "vh", "vw", "vmin", "vmax"]).optional(),
    ]),
    dnaSchema: dna.templateLiteral([
      "",
      dna.number().finite(),
      dna.enum(["px", "em", "rem", "vh", "vw", "vmin", "vmax"]).optional(),
    ]),
    tests: [
      {
        description: "valid number only",
        data: "1",
        valid: true,
      },
      {
        description: "valid with unit",
        data: "1px",
        valid: true,
      },
      {
        description: "valid negative with unit",
        data: "-1.1px",
        valid: true,
      },
      {
        description: "invalid with percent",
        data: "1%",
        valid: false,
      },
    ],
  },
];
