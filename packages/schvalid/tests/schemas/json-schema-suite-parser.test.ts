import fs from "fs";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import { schvalid } from "../../src/index.js";
import { OutOfScopeError } from "../../src/jschema-to-dna.js";
import {
  discoverJsonFiles,
  loadRemotes,
  shouldSkipFile,
  suiteDir,
} from "./json-schema-suite-helpers.js";

// Load remote schemas (for potential future refRemote support)
loadRemotes();

// Discover all JSON test files recursively (includes optional/)
const files = discoverJsonFiles(suiteDir);

describe("JSON Schema Draft 2020-12 Official Suite (Parser mode)", () => {
  for (const file of files) {
    if (shouldSkipFile(file)) continue;

    const filePath = path.join(suiteDir, file);
    const testGroups = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    describe(file, () => {
      for (const group of testGroups) {
        describe(group.description, () => {
          let parse: (v: any) => any;
          let compileError: any = null;
          let isOutOfScope = false;

          try {
            parse = schvalid("parser").compile(group.schema);
          } catch (e: any) {
            if (e instanceof OutOfScopeError) {
              console.log(`\x1b[33mOUT OF SCOPE (parser): ${file} > ${group.description} - ${e.message}\x1b[0m`);
              isOutOfScope = true;
            } else {
              compileError = e;
              console.log(`ERROR in parser group: ${file} > ${group.description}`);
              console.log(`Schema: ${JSON.stringify(group.schema)}`);
            }
          }

          for (const test of group.tests) {
            if (isOutOfScope) {
              it.skip(test.description, () => {});
              continue;
            }

            it(test.description, () => {
              if (compileError) throw compileError;

              let result: any = { success: false };
              try {
                result = parse(test.data);
              } catch (e: any) {
                result = { success: false, errors: [e] };
              }

              try {
                expect(result.success).toBe(test.valid);
                if (test.valid && result.success) {
                  expect(result.data).toEqual(test.data);
                }
                if (!test.valid) {
                  expect(result.errors?.length).toBeGreaterThan(0);
                }
              } catch (e: any) {
                if (result.success !== test.valid) {
                  console.log(
                    `\x1b[31mPARSER FAILED: ${file} > ${group.description} > ${test.description}\x1b[0m`,
                  );
                  console.log(`Schema: ${JSON.stringify(group.schema)}`);
                  console.log(`Data: ${JSON.stringify(test.data)}`);
                  try {
                    console.log(
                      "CODE:\n",
                      parse.toString(),
                    );
                  } catch {}
                }
                throw e;
              }
            });
          }

          afterAll(() => {
            // Vitest already provides summary
          });
        });
      }
    });
  }
});
