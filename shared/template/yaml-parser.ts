import { catchSyncFn } from "../safe/safemode.js";

/**
 * Basic YAML Frontmatter parsing and serialization.
 * Features:
 * - Standard functions: parseYAML, toYaml (return raw/throw).
 * - SafeMode functions: safeParseYaml, safeStringifyYaml (return [err, res]).
 */

/* -------------------------------------------------------------------------- */
/*                                   PARSING                                  */
/* -------------------------------------------------------------------------- */

/** Standard YAML Parser (throws if corrupted, though this implementation is basic). */
export const parseYAML = (text: string): Record<string, any> => {
  const result: Record<string, any> = {};
  const lines = text.split("\n");
  for (const line of lines) {
    // 1. Remove comments (everything after #)
    const lineWithoutComment = line.split("#")[0];
    const clean = lineWithoutComment.trim();

    // 2. Skip empty lines
    if (!clean) continue;

    const idx = clean.indexOf(":");
    if (idx !== -1) {
      const key = clean.slice(0, idx).trim();
      const val = clean.slice(idx + 1).trim();

      // Basic primitive inference
      let coerced: any = val;
      if (val === "true") coerced = true;
      else if (val === "false") coerced = false;
      else if (!isNaN(Number(val)) && val !== "") coerced = Number(val);

      result[key] = coerced;
    }
  }
  return result;
};

/** SafeMode version of the YAML Parser. */
export const safeParseYaml = catchSyncFn(parseYAML);

/* -------------------------------------------------------------------------- */
/*                                SERIALIZATION                               */
/* -------------------------------------------------------------------------- */

/** Standard YAML Serializer. */
export const toYaml = (val: any, level: number = 0): string => {
  const indent = "  ".repeat(level);
  if (Array.isArray(val)) {
    return val.map((v) => `\n${indent}- ${toYaml(v, level + 1)}`).join("");
  }
  if (typeof val === "object" && val !== null) {
    return Object.entries(val)
      .map(([k, v]) => `\n${indent}${k}: ${toYaml(v, level + 1)}`)
      .join("");
  }
  return String(val);
};

/** SafeMode version of the YAML Serializer. */
export const safeToYaml = catchSyncFn((val: any) => toYaml(val).trim());

/* -------------------------------------------------------------------------- */
/*                                 FRONTMATTER                                */
/* -------------------------------------------------------------------------- */

/** Non-Safe Frontmatter extractor. */
export const extractFrontmatter = (
  content: string,
): { data: Record<string, any>; content: string } => {
  const lines = content.split("\n");
  if (lines.length === 0 || lines[0].trim() !== "---")
    return { data: {}, content };

  const endIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (endIdx === -1) return { data: {}, content };

  const rawYaml = lines.slice(1, endIdx).join("\n");
  const data = parseYAML(rawYaml);
  const remaining = lines.slice(endIdx + 1).join("\n");

  return { data, content: remaining };
};

/** SafeMode Frontmatter extractor. */
export const extractSafeFrontmatter = catchSyncFn(extractFrontmatter);

/** Standard Frontmatter builder. */
export const buildWithFrontmatter = (
  data: Record<string, any>,
  content: string,
): string => {
  const yaml = toYaml(data).trim();
  return `---\n${yaml}\n---\n${content}`;
};

/** SafeMode Frontmatter builder. */
export const buildWithSafeFrontmatter = catchSyncFn(buildWithFrontmatter);
