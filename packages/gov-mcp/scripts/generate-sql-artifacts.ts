/**
 * Generate committed SQL artifacts (schema.sql, triggers.sql).
 * Run: npx tsx scripts/generate-sql-artifacts.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { generateSchemaSQL } from "../src/definitions/schema.js";
import { generateTriggersSQL } from "../src/definitions/triggers.js";

const schemaDir = resolve(import.meta.dirname, "..", "schema");
mkdirSync(schemaDir, { recursive: true });

writeFileSync(resolve(schemaDir, "schema.sql"), generateSchemaSQL(), "utf-8");
writeFileSync(resolve(schemaDir, "triggers.sql"), generateTriggersSQL(), "utf-8");

console.log("SQL artifacts generated in schema/");
