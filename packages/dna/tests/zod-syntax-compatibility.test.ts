import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dna } from "../src/builder/index.js";
import { validatorBuilder as validator, parserBuilder as parser } from "../src/toJs.js";
import { z } from "zod";

// Emulate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suiteDir = path.resolve(__dirname, "./zod-test-suite");

// Discover all test files
const testFiles = fs.readdirSync(suiteDir).filter((f) => f.endsWith(".ts"));

describe("DNA Schema Builder API", () => {
  it("exports core schema builders", () => {
    expect(dna.string).toBeDefined();
    expect(dna.number).toBeDefined();
    expect(dna.boolean).toBeDefined();
    expect(dna.object).toBeDefined();
    expect(dna.array).toBeDefined();
    expect(dna.email).toBeDefined();
    expect(dna.url).toBeDefined();
    expect(dna.uuid).toBeDefined();
    expect(dna.lazy).toBeDefined();
    expect(dna.literal).toBeDefined();
    expect(dna.enum).toBeDefined();
    expect(dna.null).toBeDefined();
    expect(dna.undefined).toBeDefined();
    expect(dna.any).toBeDefined();
    expect(dna.unknown).toBeDefined();
    expect(dna.never).toBeDefined();
    expect(dna.union).toBeDefined();
    expect(dna.record).toBeDefined();
    expect(dna.bigint).toBeDefined();
    expect(dna.default).toBeDefined();
    expect(dna.prefault).toBeDefined();
  });
});

describe("DNA vs Zod Compatibility Tests", () => {
  const runTestGroup = (testGroup: any, fileName: string) => {
    const { description, zodSchema, dnaSchema, tests } = testGroup;
    
    // Skip test groups without dnaSchema
    if (!dnaSchema) {
      console.log(`SKIPPED (no dnaSchema): ${fileName} > ${description}`);
      return;
    }
    
    let dnaValidate: any;
    let dnaParse: any;
    let dnaCompileError: any = null;

    try {
      const dnaBytecode = dnaSchema.toDna();
      dnaValidate = validator(dnaBytecode);
      dnaParse = parser(dnaBytecode);
    } catch (e: any) {
      dnaCompileError = e;
      console.log(`ERROR in group: ${fileName} > ${description}`);
      console.log(`DNA Schema:`, JSON.stringify(dnaSchema.toDna(), (key, value) => {
        if (typeof value === 'bigint') return value.toString();
        return value;
      }));
    }

    describe(description, () => {
      for (const test of tests) {
        it(test.description, () => {
          if (dnaCompileError) throw dnaCompileError;

          // Test Zod
          const zodResult = zodSchema.safeParse(test.data, { reportInput: true });
          const zodValid = zodResult.success;

          // Test DNA validator
          let dnaValid = false;
          try {
            dnaValid = dnaValidate(test.data);
          } catch (e: any) {
            dnaValid = false;
          }

          // Test DNA parser
          let dnaParseResult: any;
          try {
            dnaParseResult = dnaParse(test.data);
          } catch (e: any) {
            dnaParseResult = { success: false, errors: [e] };
          }

          // Compare Zod and DNA validator results
          try {
            expect(dnaValid).toBe(zodValid);
          } catch (e: any) {
            if (dnaValid !== zodValid) {
              console.log(
                `\x1b[31mVALIDATION MISMATCH: ${description} > ${test.description}\x1b[0m`,
              );
              console.log(`Data:`, JSON.stringify(test.data));
              console.log(`Zod valid:`, zodValid);
              console.log(`DNA valid:`, dnaValid);
              console.log(`Zod result:`, JSON.stringify(zodResult));
            }
            throw e;
          }

          // Compare Zod safeParse and DNA parser results
          try {
            expect(dnaParseResult.success).toBe(zodValid);
            if (zodValid) {
              expect(dnaParseResult).toHaveProperty("data");
            } else {
              expect(dnaParseResult).toHaveProperty("errors");
            }
          } catch (e: any) {
            console.log(
              `\x1b[31mPARSER STRUCTURE MISMATCH: ${description} > ${test.description}\x1b[0m`,
            );
            console.log(`Data:`, JSON.stringify(test.data));
            console.log(`Zod valid:`, zodValid);
            console.log(`Zod safeParse:`, JSON.stringify(zodResult));
            console.log(`DNA parser:`);
            console.dir(dnaParseResult);
            throw e;
          }

          // For valid data, compare parsed data
          if (zodValid) {
            try {
              expect(dnaParseResult.data).toEqual(zodResult.data);
            } catch (e: any) {
              console.log(
                `\x1b[31mPARSED DATA MISMATCH: ${description} > ${test.description}\x1b[0m`,
              );
              console.log(`Data:`, JSON.stringify(test.data));
              console.log(`Zod parsed:`);
              console.dir(zodResult.data, { depth: null });
              console.log(`DNA parsed:`);
              console.dir(dnaParseResult.data, { depth: null });
              throw e;
            }
          }
        });
      }
    });
  };

  for (const file of testFiles) {
    describe(file, async () => {
      const testName = file.replace(".ts", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const testModule = await import(path.join(suiteDir, file));
      const testGroups = testModule[`${testName}Tests`] || [];

      for (const group of testGroups) {
        runTestGroup(group, file);
      }
    });
  }
});
