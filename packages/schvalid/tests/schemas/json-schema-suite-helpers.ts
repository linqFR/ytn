/**
 * Shared helpers for the JSON Schema Test Suite runner files.
 *
 * Centralizes file discovery and the skip list so that
 * `json-schema-suite.test.ts` (validator mode) and
 * `json-schema-suite-parser.test.ts` (parser mode) stay in sync.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Emulate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Root directory of the Draft 2020-12 test suite. */
export const suiteDir = path.resolve(
  __dirname,
  "../json-schema-suite/tests/draft2020-12",
);

/** Directory of remote schemas (for refRemote, not supported but loaded for completeness). */
export const remotesDir = path.resolve(__dirname, "../json-schema-suite/remotes");

/**
 * Recursively discovers all `.json` files under `dir`, returning relative paths
 * (e.g. `"optional/format/date.json"`).
 */
export function discoverJsonFiles(dir: string, base: string = ""): string[] {
  const items = fs.readdirSync(dir);
  const results: string[] = [];
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const rel = base ? base + "/" + item : item;
    if (fs.statSync(fullPath).isDirectory()) {
      results.push(...discoverJsonFiles(fullPath, rel));
    } else if (item.endsWith(".json")) {
      results.push(rel);
    }
  }
  return results;
}

/**
 * Returns `true` if a test file (relative path) should be skipped.
 *
 * Reasons:
 *  - feature not supported / not planned (refRemote, dynamicRef, content, vocabulary)
 *  - optional/ files that test features schvalid does not implement
 *  - optional/format/ requires formatAssertion:true + semantic validation
 *    (leap seconds, days per month) — schvalid uses regex-only formats
 */
export function shouldSkipFile(file: string): boolean {
  // --- Not supported / not planned ---
  if (file === "refRemote.json") return true;
  if (file.endsWith("dynamicRef.json")) return true;
  if (file.endsWith("content.json")) return true;
  if (file.endsWith("vocabulary.json")) return true;

  // --- optional/ files that test unsupported features or cause infinite loops ---
  if (file === "optional/id.json") return true;           // complex $id scoping → infinite loop
  if (file === "optional/anchor.json") return true;       // complex anchor scoping
  if (file === "optional/cross-draft.json") return true;  // multi-draft (not supported)
  if (file === "optional/dependencies-compatibility.json") return true; // draft-07 dependencies
  if (file === "optional/unknownKeyword.json") return true; // unknown keywords
  if (file === "optional/refOfUnknownKeyword.json") return true; // unknown keyword refs
  if (file === "optional/float-overflow.json") return true; // "valid if overflow handling is implemented" (1e308 % 0.5 ≠ 0 in JS)
  if (file === "optional/non-bmp-regex.json") return true; // non-BMP regex
  if (file === "optional/format-assertion.json") return true; // format assertion mode

  // --- optional/format/ — requires formatAssertion:true + semantic validation ---
  if (file.startsWith("optional/format/")) return true;

  return false;
}

/**
 * Loads remote schemas into a Map keyed by their HTTP URL.
 * Used for potential future refRemote support; currently a no-op if the dir doesn't exist.
 */
export function loadRemotes(): Map<string, any> {
  const remoteRegistry = new Map<string, any>();
  if (!fs.existsSync(remotesDir)) return remoteRegistry;

  function walk(dir: string, base: string = "") {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const rel = base ? base + "/" + item : item;
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath, rel);
      } else if (item.endsWith(".json")) {
        try {
          const schema = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
          remoteRegistry.set("http://localhost:1234/" + rel, schema);
        } catch {}
      }
    }
  }
  walk(remotesDir);
  return remoteRegistry;
}
