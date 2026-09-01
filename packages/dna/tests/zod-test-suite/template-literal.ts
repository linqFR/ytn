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
  {
    description: "literal false template",
    zodSchema: z.templateLiteral([false]),
    dnaSchema: dna.templateLiteral([false]),
    tests: [
      { description: "valid false", data: "false", valid: true },
      { description: "invalid true", data: "true", valid: false },
      { description: "invalid with prefix", data: "1false", valid: false },
      { description: "invalid with suffix", data: "false1", valid: false },
    ],
  },
  {
    description: "literal null template",
    zodSchema: z.templateLiteral([null]),
    dnaSchema: dna.templateLiteral([null]),
    tests: [
      { description: "valid null", data: "null", valid: true },
      { description: "invalid number", data: "123", valid: false },
      { description: "invalid with suffix", data: "null1", valid: false },
      { description: "invalid with prefix", data: "1null", valid: false },
    ],
  },
  {
    description: "null via z.null() template",
    zodSchema: z.templateLiteral(["", z.null()]),
    dnaSchema: dna.templateLiteral(["", dna.null()]),
    tests: [
      { description: "valid null", data: "null", valid: true },
      { description: "invalid number", data: "123", valid: false },
      { description: "invalid with suffix", data: "null1", valid: false },
      { description: "invalid with prefix", data: "1null", valid: false },
    ],
  },
  {
    description: "literal undefined template",
    zodSchema: z.templateLiteral([undefined]),
    dnaSchema: dna.templateLiteral([undefined]),
    tests: [
      { description: "valid undefined", data: "undefined", valid: true },
      { description: "invalid number", data: "123", valid: false },
      { description: "invalid with suffix", data: "undefined1", valid: false },
      { description: "invalid with prefix", data: "1undefined", valid: false },
    ],
  },
  {
    description: "undefined via z.undefined() template",
    zodSchema: z.templateLiteral(["", z.undefined()]),
    dnaSchema: dna.templateLiteral(["", dna.undefined()]),
    tests: [
      { description: "valid undefined", data: "undefined", valid: true },
      { description: "invalid number", data: "123", valid: false },
      { description: "invalid with suffix", data: "undefined1", valid: false },
      { description: "invalid with prefix", data: "1undefined", valid: false },
    ],
  },
  {
    description: "literal number 2 via z.literal template",
    zodSchema: z.templateLiteral(["", z.literal(2)]),
    dnaSchema: dna.templateLiteral(["", dna.literal(2)]),
    tests: [
      { description: "valid 2", data: "2", valid: true },
      { description: "invalid 1", data: "1", valid: false },
      { description: "invalid 21", data: "21", valid: false },
      { description: "invalid 12", data: "12", valid: false },
    ],
  },
  {
    description: "literal 1.1 via z.literal template",
    zodSchema: z.templateLiteral([z.literal(1.1)]),
    dnaSchema: dna.templateLiteral([dna.literal(1.1)]),
    tests: [
      { description: "valid 1.1", data: "1.1", valid: true },
      { description: "invalid 1s1", data: "1s1", valid: false },
    ],
  },
  {
    description: "dynamic int part",
    zodSchema: z.templateLiteral(["", z.number().int()]),
    dnaSchema: dna.templateLiteral(["", dna.number().int()]),
    tests: [
      { description: "valid integer", data: "123", valid: true },
      { description: "invalid float", data: "1.23", valid: false },
      { description: "invalid negative float", data: "-1.23", valid: false },
      { description: "invalid with letter suffix", data: "1d", valid: false },
      { description: "invalid with letter prefix", data: "d1", valid: false },
    ],
  },
  {
    description: "bigint literal template",
    zodSchema: z.templateLiteral(["", z.literal(BigInt(1))]),
    dnaSchema: dna.templateLiteral(["", dna.literal(BigInt(1))]),
    tests: [
      { description: "valid 1", data: "1", valid: true },
      { description: "invalid 2", data: "2", valid: false },
      { description: "invalid with prefix", data: "c1", valid: false },
    ],
  },
  {
    description: "dynamic bigint part",
    zodSchema: z.templateLiteral(["", z.bigint()]),
    dnaSchema: dna.templateLiteral(["", dna.bigint()]),
    tests: [
      { description: "valid bigint", data: "123456", valid: true },
      { description: "valid zero", data: "0", valid: true },
      { description: "invalid float", data: "1.23", valid: false },
      { description: "invalid negative float", data: "-1.23", valid: false },
      { description: "invalid with prefix", data: "c123", valid: false },
    ],
  },
  {
    description: "nullable string part",
    zodSchema: z.templateLiteral(["", z.nullable(z.string())]),
    dnaSchema: dna.templateLiteral(["", dna.nullable(dna.string())]),
    tests: [
      { description: "valid string", data: "abc", valid: true },
      { description: "valid null", data: "null", valid: true },
      { description: "invalid with suffix", data: "null1", valid: false },
      { description: "invalid with prefix", data: "1null", valid: false },
    ],
  },
  {
    description: "optional string part",
    zodSchema: z.templateLiteral(["", z.string().optional()]),
    dnaSchema: dna.templateLiteral(["", dna.string().optional()]),
    tests: [
      { description: "valid string", data: "abc", valid: true },
      { description: "valid empty", data: "", valid: true },
    ],
  },
  {
    description: "optional number part",
    zodSchema: z.templateLiteral(["", z.number().optional()]),
    dnaSchema: dna.templateLiteral(["", dna.number().optional()]),
    tests: [
      { description: "valid integer", data: "123", valid: true },
      { description: "valid float", data: "1.23", valid: true },
      { description: "valid zero", data: "0", valid: true },
      { description: "valid negative", data: "-1.23", valid: true },
      { description: "valid empty", data: "", valid: true },
      { description: "invalid with suffix", data: "123a", valid: false },
      { description: "invalid with prefix", data: "a123", valid: false },
    ],
  },
  {
    description: "nullish part",
    zodSchema: z.templateLiteral(["", z.literal("bruh").nullish()]),
    dnaSchema: dna.templateLiteral(["", dna.literal("bruh").nullish()]),
    tests: [
      { description: "valid bruh", data: "bruh", valid: true },
      { description: "valid null", data: "null", valid: true },
      { description: "valid empty", data: "", valid: true },
      { description: "invalid with suffix", data: "bruh1", valid: false },
      { description: "invalid with prefix", data: "1bruh", valid: false },
      { description: "invalid undefined", data: "undefined", valid: false },
    ],
  },
  {
    description: "cuid format",
    zodSchema: z.templateLiteral(["", z.string().cuid()]),
    dnaSchema: dna.templateLiteral(["", dna.string().cuid()]),
    tests: [
      { description: "valid cuid", data: "cjld2cyuq0000t3rmniod1foy", valid: true },
      { description: "invalid wrong prefix", data: "bjld2cyuq0000t3rmniod1foy", valid: false },
      { description: "invalid too short", data: "cjld2", valid: false },
      { description: "invalid with space", data: "cjld2 cyu", valid: false },
      { description: "invalid with trailing space", data: "cjld2cyuq0000t3rmniod1foy ", valid: false },
      { description: "invalid with prefix", data: "1cjld2cyuq0000t3rmniod1foy", valid: false },
    ],
  },
  {
    description: "cuid with suffix",
    zodSchema: z.templateLiteral(["", z.string().cuid(), "ZZZ"]),
    dnaSchema: dna.templateLiteral(["", dna.string().cuid(), "ZZZ"]),
    tests: [
      { description: "valid cuid with ZZZ", data: "cjld2cyuq0000t3rmniod1foyZZZ", valid: true },
      { description: "invalid without ZZZ", data: "cjld2cyuq0000t3rmniod1foy", valid: false },
      { description: "invalid wrong suffix", data: "cjld2cyuq0000t3rmniod1foyZZY", valid: false },
      { description: "invalid with extra suffix", data: "cjld2cyuq0000t3rmniod1foyZZZ1", valid: false },
      { description: "invalid with prefix", data: "1cjld2cyuq0000t3rmniod1foyZZZ", valid: false },
    ],
  },
  {
    description: "cuid2 format",
    zodSchema: z.templateLiteral(["", z.string().cuid2()]),
    dnaSchema: dna.templateLiteral(["", dna.string().cuid2()]),
    tests: [
      { description: "valid cuid2", data: "tz4a98xxat96iws9zmbrgj3a", valid: true },
      { description: "invalid uppercase prefix", data: "A9z4a98xxat96iws9zmbrgj3a", valid: false },
      { description: "invalid with special char", data: "tz4a98xxat96iws9zmbrgj3!", valid: false },
    ],
  },
  {
    description: "datetime format",
    zodSchema: z.templateLiteral(["", z.string().datetime()]),
    dnaSchema: dna.templateLiteral(["", dna.string().datetime()]),
    tests: [
      { description: "valid ISO datetime", data: "2024-01-15T10:30:00.000Z", valid: true },
      { description: "invalid space-separated", data: "2022-01-01 00:00:00", valid: false },
    ],
  },
  {
    description: "ipv6 format",
    zodSchema: z.templateLiteral(["", z.string().ipv6()]),
    dnaSchema: dna.templateLiteral(["", dna.string().ipv6()]),
    tests: [
      { description: "valid ipv6", data: "c359:f57c:21e5:39eb:1187:e501:f936:b452", valid: true },
      { description: "invalid ipv4 as ipv6", data: "213.174.246.205", valid: false },
      { description: "invalid too long", data: "c359:f57c:21e5:39eb:1187:e501:f936:b4521", valid: false },
    ],
  },
  {
    description: "mac format",
    zodSchema: z.templateLiteral(["", z.mac()]),
    dnaSchema: dna.templateLiteral(["", dna.mac()]),
    tests: [
      { description: "valid mac uppercase", data: "00:1A:2B:3C:4D:5E", valid: true },
      { description: "invalid too long", data: "00:1A:2B:3C:4D:5E:6A:7B", valid: false },
      { description: "invalid too short", data: "00:1A:2B:3C", valid: false },
    ],
  },
  {
    description: "ulid format",
    zodSchema: z.templateLiteral(["", z.string().ulid()]),
    dnaSchema: dna.templateLiteral(["", dna.string().ulid()]),
    tests: [
      { description: "valid ulid", data: "01GW3D2QZJBYB6P1Z1AE997VPW", valid: true },
      { description: "invalid with special char", data: "01GW3D2QZJBYB6P1Z1AE997VPW!", valid: false },
    ],
  },
  {
    description: "string with regex constraint",
    zodSchema: z.templateLiteral(["", z.string().regex(/^[a-z]+$/)]),
    dnaSchema: dna.templateLiteral(["", dna.string().regex(/^[a-z]+$/)]),
    tests: [
      { description: "valid lowercase", data: "asudgaskhdgashd", valid: true },
      { description: "invalid with digit suffix", data: "asdasdasd1", valid: false },
      { description: "invalid with digit prefix", data: "1asdasdasd", valid: false },
    ],
  },
  {
    description: "string startsWith constraint",
    zodSchema: z.templateLiteral(["", z.string().startsWith("hello")]),
    dnaSchema: dna.templateLiteral(["", dna.string().startsWith("hello")]),
    tests: [
      { description: "valid starts with hello", data: "hello world", valid: true },
      { description: "invalid prefix", data: "ahello", valid: false },
    ],
  },
  {
    description: "string endsWith constraint",
    zodSchema: z.templateLiteral(["", z.string().endsWith("world")]),
    dnaSchema: dna.templateLiteral(["", dna.string().endsWith("world")]),
    tests: [
      { description: "valid ends with world", data: "hello world", valid: true },
      { description: "invalid suffix", data: "worlda", valid: false },
    ],
  },
  {
    description: "string length constraint",
    zodSchema: z.templateLiteral(["", z.string().length(5)]),
    dnaSchema: dna.templateLiteral(["", dna.string().length(5)]),
    tests: [
      { description: "valid length 5", data: "hello", valid: true },
      { description: "invalid too long", data: "123456", valid: false },
      { description: "invalid too short", data: "1234", valid: false },
    ],
  },
  {
    description: "string min and max constraint",
    zodSchema: z.templateLiteral(["", z.string().min(5).max(10)]),
    dnaSchema: dna.templateLiteral(["", dna.string().min(5).max(10)]),
    tests: [
      { description: "valid length in range", data: "hello worl", valid: true },
      { description: "invalid too short", data: "1234", valid: false },
      { description: "invalid too long", data: "12345678901", valid: false },
    ],
  },
  {
    description: "string startsWith with max constraint",
    zodSchema: z.templateLiteral(["", z.string().startsWith("hello").max(5)]),
    dnaSchema: dna.templateLiteral(["", dna.string().startsWith("hello").max(5)]),
    tests: [
      { description: "valid hello", data: "hello", valid: true },
      { description: "invalid wrong prefix", data: "1hell", valid: false },
    ],
  },
  {
    description: "branded string template",
    zodSchema: z.templateLiteral(["", z.string().min(1).brand("myBrand")]),
    dnaSchema: dna.templateLiteral(["", dna.string().min(1).brand("myBrand")]),
    tests: [
      { description: "valid branded string", data: "branded string", valid: true },
      { description: "invalid empty string", data: "", valid: false },
    ],
  },
  {
    description: "exponent enum template",
    zodSchema: z.templateLiteral(["", z.enum({ A: 1e21 })]),
    dnaSchema: dna.templateLiteral(["", dna.enum({ A: 1e21 })]),
    tests: [
      { description: "valid 1e+21", data: "1e+21", valid: true },
      { description: "invalid 1e21 without plus", data: "1e21", valid: false },
    ],
  },
  {
    description: "decimal enum template",
    zodSchema: z.templateLiteral(["", z.enum({ A: 1.2 })]),
    dnaSchema: dna.templateLiteral(["", dna.enum({ A: 1.2 })]),
    tests: [
      { description: "valid 1.2", data: "1.2", valid: true },
      { description: "invalid 1x2", data: "1x2", valid: false },
    ],
  },
  {
    description: "MongoDB connection string template",
    zodSchema: z.templateLiteral([
      "mongodb://",
      z
        .templateLiteral([
          "",
          z.string().regex(/\w+/).describe("username"),
          ":",
          z.string().regex(/\w+/).describe("password"),
          "@",
        ])
        .optional(),
      z.string().regex(/\w+/).describe("host"),
      ":",
      z.number().finite().int().positive().describe("port"),
      z
        .templateLiteral([
          "/",
          z.string().regex(/\w+/).optional().describe("defaultauthdb"),
          z
            .templateLiteral([
              "?",
              z
                .string()
                .regex(/^\w+=\w+(&\w+=\w+)*$/)
                .optional()
                .describe("options"),
            ])
            .optional(),
        ])
        .optional(),
    ]),
    dnaSchema: dna.templateLiteral([
      "mongodb://",
      dna
        .templateLiteral([
          "",
          dna.string().regex(/\w+/).describe("username"),
          ":",
          dna.string().regex(/\w+/).describe("password"),
          "@",
        ])
        .optional(),
      dna.string().regex(/\w+/).describe("host"),
      ":",
      dna.number().finite().int().positive().describe("port"),
      dna
        .templateLiteral([
          "/",
          dna.string().regex(/\w+/).optional().describe("defaultauthdb"),
          dna
            .templateLiteral([
              "?",
              dna
                .string()
                .regex(/^\w+=\w+(&\w+=\w+)*$/)
                .optional()
                .describe("options"),
            ])
            .optional(),
        ])
        .optional(),
    ]),
    tests: [
      { description: "valid host port only", data: "mongodb://host:1234", valid: true },
      { description: "valid with trailing slash", data: "mongodb://host:1234/", valid: true },
      { description: "valid with auth db", data: "mongodb://host:1234/defaultauthdb", valid: true },
      { description: "valid with auth db and options", data: "mongodb://host:1234/defaultauthdb?authSource=admin", valid: true },
      { description: "valid with multiple options", data: "mongodb://host:1234/defaultauthdb?authSource=admin&connectTimeoutMS=300000", valid: true },
      { description: "valid with options no db", data: "mongodb://host:1234/?authSource=admin", valid: true },
      { description: "valid with credentials", data: "mongodb://username:password@host:1234", valid: true },
      { description: "valid with credentials and db", data: "mongodb://username:password@host:1234/defaultauthdb", valid: true },
      { description: "valid with credentials db and options", data: "mongodb://username:password@host:1234/defaultauthdb?authSource=admin", valid: true },
      { description: "invalid wrong protocol", data: "mongod://host:1234", valid: false },
      { description: "invalid missing host", data: "mongodb://:1234", valid: false },
      { description: "invalid missing colon", data: "mongodb://host1234", valid: false },
      { description: "invalid non-numeric port", data: "mongodb://host:d234", valid: false },
      { description: "invalid float port", data: "mongodb://host:12.34", valid: false },
      { description: "invalid missing port", data: "mongodb://host:", valid: false },
      { description: "invalid credentials missing username", data: "mongodb://:password@host:1234", valid: false },
      { description: "invalid credentials no separator", data: "mongodb://usernamepassword@host:1234", valid: false },
      { description: "invalid credentials empty password", data: "mongodb://username:@host:1234", valid: false },
      { description: "invalid at only", data: "mongodb://@host:1234", valid: false },
      { description: "invalid options no equals", data: "mongodb://host:1234/defaultauthdb?authSourceadmin", valid: false },
      { description: "invalid options with leading ampersand", data: "mongodb://host:1234/defaultauthdb?&authSource=admin", valid: false },
    ],
  },
];
