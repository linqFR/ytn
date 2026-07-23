import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { afterAll, describe, expect, it } from "vitest";
import { schvalid } from "../../src/index.js";
import { OutOfScopeError } from "../../src/jschema-to-dna.js";

// Emulate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suiteDir = path.resolve(
  __dirname,
  "../json-schema-suite/tests/draft2020-12",
);

const remotesDir = path.resolve(__dirname, "../json-schema-suite/remotes");
const remoteRegistry = new Map<string, any>();

function loadRemotes(dir: string, base: string = "") {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const rel = base ? base + "/" + item : item;
    if (fs.statSync(fullPath).isDirectory()) {
      loadRemotes(fullPath, rel);
    } else if (item.endsWith(".json")) {
      try {
        const schema = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        remoteRegistry.set("http://localhost:1234/" + rel, schema);
      } catch {}
    }
  }
}
if (fs.existsSync(remotesDir)) {
  loadRemotes(remotesDir);
}

// Découvre tous les fichiers JSON
const files = fs.readdirSync(suiteDir).filter((f) => f.endsWith(".json"));

describe("JSON Schema Draft 2020-12 Official Suite (DNA-JS Parser)", () => {
  for (const file of files) {
    // skip refRemote tests (not supported, not planned)
    if (file === "refRemote.json") continue;
    // skip not implemented features
    if (file === "dynamicRef.json") continue;
    if (file === "content.json") continue;
    if (file === "vocabulary.json") continue;

    const filePath = path.join(suiteDir, file);
    const testGroups = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    describe(file, () => {
      for (const group of testGroups) {
        describe(group.description, () => {
          let parse: (v: any) => any;
          let compileError: any = null;
          let isOutOfScope = false;

          // console.log(`Compiling parser: ${file} > ${group.description}`);

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

          // Print summary after all tests in group
          afterAll(() => {
            // Vitest already provides summary
          });
        });
      }
    });
  }
});
