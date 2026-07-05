import * as z from "zod";
import { dna } from "../../src/index.js";

export const continuabilityTests = [
  {
    description: "email with refine - continuability",
    zodSchema: z.email().refine(() => false),
    dnaSchema: dna.email().check(() => false),
    tests: [
      {
        description: "invalid email - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "uuid with refine - continuability",
    zodSchema: z.uuid().refine(() => false),
    dnaSchema: dna.uuid().check(() => false),
    tests: [
      {
        description: "invalid uuid - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "url with refine - continuability",
    zodSchema: z.url().refine(() => false),
    dnaSchema: dna.url().check(() => false),
    tests: [
      {
        description: "invalid url - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "jwt with refine - continuability",
    zodSchema: z.jwt().refine(() => false),
    dnaSchema: dna.jwt().check(() => false),
    tests: [
      {
        description: "invalid jwt - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "ipv4 with refine - continuability",
    zodSchema: z.ipv4().refine(() => false),
    dnaSchema: dna.ipv4().check(() => false),
    tests: [
      {
        description: "invalid ipv4 - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "ipv6 with refine - continuability",
    zodSchema: z.ipv6().refine(() => false),
    dnaSchema: dna.ipv6().check(() => false),
    tests: [
      {
        description: "invalid ipv6 - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "cidrv4 with refine - continuability",
    zodSchema: z.cidrv4().refine(() => false),
    dnaSchema: dna.cidrv4().check(() => false),
    tests: [
      {
        description: "invalid cidrv4 - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "cidrv6 with refine - continuability",
    zodSchema: z.cidrv6().refine(() => false),
    dnaSchema: dna.cidrv6().check(() => false),
    tests: [
      {
        description: "invalid cidrv6 - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "mac with refine - continuability",
    zodSchema: z.mac().refine(() => false),
    dnaSchema: dna.mac().check(() => false),
    tests: [
      {
        description: "invalid mac - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "emoji with refine - continuability",
    zodSchema: z.emoji().refine(() => false),
    dnaSchema: dna.emoji().check(() => false),
    tests: [
      {
        description: "invalid emoji - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "nanoid with refine - continuability",
    zodSchema: z.nanoid().refine(() => false),
    dnaSchema: dna.nanoid().check(() => false),
    tests: [
      {
        description: "invalid nanoid - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "cuid with refine - continuability",
    zodSchema: z.cuid().refine(() => false),
    dnaSchema: dna.cuid().check(() => false),
    tests: [
      {
        description: "invalid cuid - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "cuid2 with refine - continuability",
    zodSchema: z.cuid2().refine(() => false),
    dnaSchema: dna.cuid2().check(() => false),
    tests: [
      {
        description: "invalid cuid2 - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "ulid with refine - continuability",
    zodSchema: z.ulid().refine(() => false),
    dnaSchema: dna.ulid().check(() => false),
    tests: [
      {
        description: "invalid ulid - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "xid with refine - continuability",
    zodSchema: z.xid().refine(() => false),
    dnaSchema: dna.xid().check(() => false),
    tests: [
      {
        description: "invalid xid - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
  {
    description: "ksuid with refine - continuability",
    zodSchema: z.ksuid().refine(() => false),
    dnaSchema: dna.ksuid().check(() => false),
    tests: [
      {
        description: "invalid ksuid - should report both format and custom errors",
        data: "invalid_value",
        valid: false,
      },
    ],
  },
];
