/**
 * Auto-generate parameter signatures from DNA schemas.
 *
 * Uses `schema.toJSONSchema()` (JSON Schema Draft 2020-12) for the structural
 * information (types, enums, required/optional, array items) and reads
 * `.describe()` metadata from the DNA schema fields for descriptions.
 *
 * The result is a Markdown-formatted `Parameters:` block that `help()`
 * assembles with the prose `usage` text from `meta.ts`.
 */

import type { DnaSomeType } from "@ytrynot/dna/core";
import { DnaObject } from "@ytrynot/dna/core";
import { getDescription } from "@ytrynot/dna/introspect";
import { toolList } from "../definitions/tools.js";

/** JSON Schema property shape (subset we care about). */
interface IJSProp {
  type?: string;
  enum?: (string | number)[];
  items?: IJSProp;
  anyOf?: IJSProp[];
  description?: string;
}

/** JSON Schema object shape (subset). */
interface IJSObject {
  type?: string;
  properties?: Record<string, IJSProp>;
  required?: string[];
}

/**
 * Map a JSON Schema property to a human-readable type name.
 */
function typeName(prop: IJSProp): string {
  // Enum: list all values
  if (prop.enum) {
    return prop.enum.map((v) => `"${v}"`).join(" | ");
  }
  // Array: recurse into items
  if (prop.type === "array" && prop.items) {
    return `${typeName(prop.items)}[]`;
  }
  // Union (anyOf): merge member types
  if (prop.anyOf) {
    const types = prop.anyOf.map((m) => typeName(m)).filter((t) => t !== "any");
    const unique = [...new Set(types)];
    return unique.length === 1 ? unique[0] : unique.join(" | ");
  }
  // Standard types — only "integer" needs renaming; undefined means "any"
  if (prop.type === undefined) return "any";
  if (prop.type === "integer") return "int";
  return prop.type;
}

/**
 * Generate a `Parameters:` block from a DNA object schema.
 *
 * Types are derived from `toJSONSchema()`. Descriptions are read from
 * the DNA schema's `.describe()` metadata (via `field.description`).
 *
 * Returns an empty string for schemas with no fields (e.g. `helpInput`).
 * Returns an empty string if the schema is not a DnaObject.
 */
export function describeSignature(schema: DnaSomeType): string {
  if (!(schema instanceof DnaObject)) return "";

  // Get JSON Schema structure (types, enums, required)
  const js = schema.toJSONSchema() as IJSObject;
  if (js.type !== "object" || !js.properties) return "";

  const shape = schema.shape;
  const keys = Object.keys(js.properties);
  if (keys.length === 0) return "";

  const requiredSet = new Set(js.required ?? []);

  const lines: string[] = ["Parameters:"];
  for (const key of keys) {
    const prop = js.properties[key];
    if (!prop) continue;
    const optional = !requiredSet.has(key);
    const type = typeName(prop);
    const optMark = optional ? "?" : "";
    const reqMark = optional ? ", optional" : ", required";
    // Read description from the DNA schema field, walking through wrappers
    // (optional, nullable, etc.) to find the first non-undefined description.
    const desc = shape[key] ? getDescription(shape[key]) : undefined;
    if (desc) {
      lines.push(`  ${key}${optMark} (${type}${reqMark}) — ${desc}`);
    } else {
      lines.push(`  ${key}${optMark} (${type}${reqMark})`);
    }
  }
  return lines.join("\n");
}

/**
 * Map tool names to their DNA input schemas, derived from `toolList`.
 *
 * `toolList` is the single source of truth — each entry's `args` field is the
 * DNA schema. Built lazily to break the circular import chain:
 *   describe-signature.ts → definitions/tools.ts → tools/read.ts → describe-signature.ts
 */
let _toolSchemas: Record<string, DnaSomeType> | null = null;

function getToolSchemas(): Record<string, DnaSomeType> {
  if (_toolSchemas !== null) return _toolSchemas;
  _toolSchemas = Object.fromEntries(
    toolList
      .filter((t) => t.args !== undefined)
      .map((t) => [t.name, t.args as DnaSomeType]),
  );
  return _toolSchemas;
}

/**
 * Get the auto-generated `Parameters:` block for a tool by name.
 *
 * Descriptions are read from the DNA schema's `.describe()` metadata.
 *
 * Returns "" if the tool has no schema or no fields.
 */
export function describeToolSignature(toolName: string): string {
  const schema = getToolSchemas()[toolName];
  if (!schema) return "";
  return describeSignature(schema);
}
