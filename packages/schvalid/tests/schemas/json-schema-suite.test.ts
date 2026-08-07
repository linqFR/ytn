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

describe("JSON Schema Draft 2020-12 Official Suite (Validator mode)", () => {
  for (const file of files) {
    if (shouldSkipFile(file)) continue;

    const filePath = path.join(suiteDir, file);
    const testGroups = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    describe(file, () => {
      for (const group of testGroups) {
        describe(group.description, () => {
          let validate: (v: any) => boolean;
          let compileError: any = null;
          let isOutOfScope = false;

          try {
            validate = schvalid("validation").compile(group.schema);
          } catch (e: any) {
            if (e instanceof OutOfScopeError) {
              console.log(`\x1b[33mOUT OF SCOPE: ${file} > ${group.description} - ${e.message}\x1b[0m`);
              isOutOfScope = true;
            } else {
              compileError = e;
              console.log(`ERROR in group: ${file} > ${group.description}`);
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

              let success = false;
              try {
                success = validate(test.data);
              } catch (e: any) {
                success = false;
              }
              try {
                expect(success).toBe(test.valid);
              } catch (e: any) {
                if (success !== test.valid) {
                  console.log(
                    `\x1b[31mFAILED: ${file} > ${group.description} > ${test.description}\x1b[0m`,
                  );
                  console.log(`Schema: ${JSON.stringify(group.schema)}`);
                  console.log(`Data: ${JSON.stringify(test.data)}`);
                  try {
                    console.log(
                      "CODE:\n",
                      validate.toString(),
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
