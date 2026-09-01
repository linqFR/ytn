import { z } from "zod";
import { dna } from "../../src/index.js";

export const standardSchemaTests = [
  {
    description: "Standard Schema validate string",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "valid string returns value",
        data: "asdf",
        valid: true,
        customCheck: async () => {
          const zodResult = await z.string()["~standard"].validate("asdf");
          const dnaResult = await dna.string()["~standard"].validate("asdf");
          return "value" in zodResult && zodResult.value === "asdf" && "value" in dnaResult && dnaResult.value === "asdf";
        },
      },
      {
        description: "invalid number returns issues",
        data: 123,
        valid: false,
        customCheck: async () => {
          const zodResult = await z.string()["~standard"].validate(123);
          const dnaResult = await dna.string()["~standard"].validate(123);
          return (
            (zodResult.issues?.length ?? 0) > 0 &&
            (dnaResult.issues?.length ?? 0) > 0
          );
        },
      },
    ],
  },
  {
    description: "length checks - string with async refine, invalid type",
    zodSchema: z.string().refine(async (val) => val.length > 5),
    dnaSchema: dna.string().refine(async (val) => val.length > 5),
    tests: [
      {
        description: "invalid number (type mismatch before refine)",
        data: 12,
        valid: false,
      },
    ],
  },
  {
    description: "length checks - string with async refine, valid value",
    zodSchema: z.string().refine(async (val) => val.length > 5),
    dnaSchema: dna.string().refine(async (val) => val.length > 5),
    tests: [
      {
        description: "valid string with length > 5",
        data: "234134134",
        valid: true,
      },
    ],
  },
  {
    description: "schemas conform to StandardJSONSchemaV1",
    zodSchema: z.codec(z.string(), z.number(), {
      decode: (str) => Number.parseFloat(str),
      encode: (num) => num.toString(),
    }),
    dnaSchema: dna.codec(dna.string(), dna.number(), {
      decode: (str) => Number.parseFloat(str),
      encode: (num) => num.toString(),
    }),
    tests: [
      {
        description: "~standard.validate on codec returns value",
        data: "42",
        valid: true,
        customCheck: async () => {
          const zodSchema = z.codec(z.string(), z.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const dnaSchema = dna.codec(dna.string(), dna.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const zodResult = await zodSchema["~standard"].validate("42");
          const dnaResult = await dnaSchema["~standard"].validate("42");
          return "value" in zodResult && zodResult.value === 42 &&
            "value" in dnaResult && dnaResult.value === 42;
        },
      },
      {
        description: "~standard.jsonSchema.input returns string type",
        data: "42",
        valid: true,
        customCheck: async () => {
          const zodSchema = z.codec(z.string(), z.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const dnaSchema = dna.codec(dna.string(), dna.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const zodInput = zodSchema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
          const dnaInput = dnaSchema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
          return zodInput.type === "string" && dnaInput.type === "string";
        },
      },
      {
        description: "~standard.jsonSchema.output returns number type",
        data: "42",
        valid: true,
        customCheck: async () => {
          const zodSchema = z.codec(z.string(), z.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const dnaSchema = dna.codec(dna.string(), dna.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const zodOutput = zodSchema["~standard"].jsonSchema.output({ target: "draft-2020-12" });
          const dnaOutput = dnaSchema["~standard"].jsonSchema.output({ target: "draft-2020-12" });
          return zodOutput.type === "number" && dnaOutput.type === "number";
        },
      },
    ],
  },
  {
    description: ".toJSONSchema() returns StandardJSONSchemaV1",
    zodSchema: z.codec(z.string(), z.number(), {
      decode: (str) => Number.parseFloat(str),
      encode: (num) => num.toString(),
    }),
    dnaSchema: dna.codec(dna.string(), dna.number(), {
      decode: (str) => Number.parseFloat(str),
      encode: (num) => num.toString(),
    }),
    tests: [
      {
        description: "toJSONSchema result has ~standard.validate",
        data: "42",
        valid: true,
        customCheck: async () => {
          const zodCodec = z.codec(z.string(), z.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const dnaCodec = dna.codec(dna.string(), dna.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const zodResult = zodCodec.toJSONSchema();
          const dnaResult = dnaCodec.toJSONSchema();
          if (typeof zodResult["~standard"]?.validate !== "function") return false;
          if (typeof dnaResult["~standard"]?.validate !== "function") return false;
          const zodValidated = await zodResult["~standard"].validate("42");
          const dnaValidated = await dnaResult["~standard"].validate("42");
          return "value" in zodValidated && zodValidated.value === 42 &&
            "value" in dnaValidated && dnaValidated.value === 42;
        },
      },
      {
        description: "toJSONSchema result has ~standard.jsonSchema.input",
        data: "42",
        valid: true,
        customCheck: async () => {
          const zodCodec = z.codec(z.string(), z.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const dnaCodec = dna.codec(dna.string(), dna.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const zodResult = zodCodec.toJSONSchema();
          const dnaResult = dnaCodec.toJSONSchema();
          if (typeof zodResult["~standard"]?.jsonSchema?.input !== "function") return false;
          if (typeof dnaResult["~standard"]?.jsonSchema?.input !== "function") return false;
          const zodInput = zodResult["~standard"].jsonSchema.input({ target: "draft-2020-12" });
          const dnaInput = dnaResult["~standard"].jsonSchema.input({ target: "draft-2020-12" });
          return zodInput.type === "string" && dnaInput.type === "string";
        },
      },
      {
        description: "toJSONSchema result has ~standard.jsonSchema.output",
        data: "42",
        valid: true,
        customCheck: async () => {
          const zodCodec = z.codec(z.string(), z.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const dnaCodec = dna.codec(dna.string(), dna.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const zodResult = zodCodec.toJSONSchema();
          const dnaResult = dnaCodec.toJSONSchema();
          if (typeof zodResult["~standard"]?.jsonSchema?.output !== "function") return false;
          if (typeof dnaResult["~standard"]?.jsonSchema?.output !== "function") return false;
          const zodOutput = zodResult["~standard"].jsonSchema.output({ target: "draft-2020-12" });
          const dnaOutput = dnaResult["~standard"].jsonSchema.output({ target: "draft-2020-12" });
          return zodOutput.type === "number" && dnaOutput.type === "number";
        },
      },
    ],
  },
  {
    description: "dna.toJSONSchema() returns StandardJSONSchemaV1",
    zodSchema: z.codec(z.string(), z.number(), {
      decode: (str) => Number.parseFloat(str),
      encode: (num) => num.toString(),
    }),
    dnaSchema: dna.codec(dna.string(), dna.number(), {
      decode: (str) => Number.parseFloat(str),
      encode: (num) => num.toString(),
    }),
    tests: [
      {
        description: "top-level toJSONSchema result has ~standard.validate",
        data: "42",
        valid: true,
        customCheck: async () => {
          const zodCodec = z.codec(z.string(), z.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const dnaCodec = dna.codec(dna.string(), dna.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const zodResult = z.toJSONSchema(zodCodec);
          const dnaResult = dna.toJSONSchema(dnaCodec);
          if (typeof zodResult["~standard"]?.validate !== "function") return false;
          if (typeof dnaResult["~standard"]?.validate !== "function") return false;
          const zodValidated = await zodResult["~standard"].validate("42");
          const dnaValidated = await dnaResult["~standard"].validate("42");
          return "value" in zodValidated && zodValidated.value === 42 &&
            "value" in dnaValidated && dnaValidated.value === 42;
        },
      },
      {
        description: "top-level toJSONSchema result has ~standard.jsonSchema.input",
        data: "42",
        valid: true,
        customCheck: async () => {
          const zodCodec = z.codec(z.string(), z.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const dnaCodec = dna.codec(dna.string(), dna.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const zodResult = z.toJSONSchema(zodCodec);
          const dnaResult = dna.toJSONSchema(dnaCodec);
          if (typeof zodResult["~standard"]?.jsonSchema?.input !== "function") return false;
          if (typeof dnaResult["~standard"]?.jsonSchema?.input !== "function") return false;
          const zodInput = zodResult["~standard"].jsonSchema.input({ target: "draft-2020-12" });
          const dnaInput = dnaResult["~standard"].jsonSchema.input({ target: "draft-2020-12" });
          return zodInput.type === "string" && dnaInput.type === "string";
        },
      },
      {
        description: "top-level toJSONSchema result has ~standard.jsonSchema.output",
        data: "42",
        valid: true,
        customCheck: async () => {
          const zodCodec = z.codec(z.string(), z.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const dnaCodec = dna.codec(dna.string(), dna.number(), {
            decode: (str) => Number.parseFloat(str),
            encode: (num) => num.toString(),
          });
          const zodResult = z.toJSONSchema(zodCodec);
          const dnaResult = dna.toJSONSchema(dnaCodec);
          if (typeof zodResult["~standard"]?.jsonSchema?.output !== "function") return false;
          if (typeof dnaResult["~standard"]?.jsonSchema?.output !== "function") return false;
          const zodOutput = zodResult["~standard"].jsonSchema.output({ target: "draft-2020-12" });
          const dnaOutput = dnaResult["~standard"].jsonSchema.output({ target: "draft-2020-12" });
          return zodOutput.type === "number" && dnaOutput.type === "number";
        },
      },
    ],
  },
];
