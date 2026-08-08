import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type tsFunctionMetrics = {
  kind: "validate" | "parse";
  length: number;
  returnCount: number;
  ifCount: number;
  forCount: number;
  whileCount: number;
  objectKeysCount: number;
  objectAssignCount: number;
  objectHasOwnCount: number;
  objectCreateNullCount: number;
  arrayIsArrayCount: number;
  regexCount: number;
  refCallCount: number;
  uniqueRefCalls: string[];
  hasVisitMap: boolean;
};

export type tsFunctionAnalysis = {
  label: string;
  validate: tsFunctionMetrics | null;
  parse: tsFunctionMetrics | null;
  concerns: string[];
};

const HEADER_RE = /^=+\s+(.+?)\s+=+$/gm;

function extractCodeAfter(header: string, block: string): string | null {
  const pos = block.indexOf(header + "\n");
  if (pos < 0) return null;
  let end = block.indexOf("\n\n", pos + header.length + 1);
  if (end < 0) end = block.length;
  const code = block.slice(pos + header.length + 1, end).trim();
  return code.length > 0 && !code.startsWith("ERROR:") ? code : null;
}

function uComputeMetrics(kind: "validate" | "parse", code: string): tsFunctionMetrics {
  const refCallMatches = [...code.matchAll(/\b(L\d{4,})\(/g)];
  const uniqueRefCalls = [...new Set(refCallMatches.map((m) => m[1]!))];

  return {
    kind,
    length: code.length,
    returnCount: (code.match(/\breturn\b/g) ?? []).length,
    ifCount: (code.match(/\bif\(/g) ?? []).length,
    forCount: (code.match(/\bfor\(/g) ?? []).length,
    whileCount: (code.match(/\bwhile\(/g) ?? []).length,
    objectKeysCount: (code.match(/Object\.keys\(/g) ?? []).length,
    objectAssignCount: (code.match(/Object\.assign\(/g) ?? []).length,
    objectHasOwnCount: (code.match(/Object\.hasOwn\(/g) ?? []).length,
    objectCreateNullCount: (code.match(/Object\.create\(null\)/g) ?? []).length,
    arrayIsArrayCount: (code.match(/Array\.isArray\(/g) ?? []).length,
    regexCount: (code.match(/\/(?:\\\/|[^/])+\/[gimusy]*/g) ?? []).length,
    refCallCount: refCallMatches.length,
    uniqueRefCalls,
    hasVisitMap: code.includes(".visit=new Map()") || code.includes(".visit = new Map()"),
  };
}

function uComputeConcerns(
  label: string,
  metrics: tsFunctionMetrics,
  code: string,
): string[] {
  const concerns: string[] = [];

  if (metrics.objectKeysCount > 0) {
    concerns.push(
      `${metrics.kind}: ${metrics.objectKeysCount}x Object.keys(...) — O(n) allocations; a counter for matched keys would avoid the second pass.`,
    );
  }

  if (metrics.objectAssignCount > 0 || metrics.objectCreateNullCount > 0) {
    concerns.push(
      `${metrics.kind}: ${metrics.objectAssignCount}x Object.assign + ${metrics.objectCreateNullCount}x Object.create(null) — full input copy in parser path.`,
    );
  }

  if (metrics.refCallCount > 0) {
    concerns.push(
      `${metrics.kind}: ${metrics.refCallCount} call(s) to ref function(s) ${metrics.uniqueRefCalls.join(", ")} — call overhead, inline if no recursion.`,
    );
  }

  if (metrics.hasVisitMap) {
    concerns.push(
      `${metrics.kind}: circular-ref visit Map prelude in a ref function — allocates Map per function even for acyclic data.`,
    );
  }

  if (metrics.objectHasOwnCount > 0) {
    concerns.push(
      `${metrics.kind}: ${metrics.objectHasOwnCount}x per-property Object.hasOwn(...) — for dense objects, direct property access + undefined guard is faster.`,
    );
  }

  if (metrics.forCount > 0 && code.includes("Object.keys(passed")) {
    concerns.push(
      `${metrics.kind}: additionalProperties check uses Object.keys(passed).length inside a loop — a counter could short-circuit earlier.`,
    );
  }

  if (metrics.arrayIsArrayCount > 1) {
    concerns.push(
      `${metrics.kind}: ${metrics.arrayIsArrayCount}x Array.isArray on the same value — one guard would suffice.`,
    );
  }

  return concerns;
}

export function uAnalyzeLog(source: string): tsFunctionAnalysis[] {
  const matches = [...source.matchAll(HEADER_RE)];
  const result: tsFunctionAnalysis[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const label = match[1]!;
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : source.length;
    const block = source.slice(start, end);

    const validateCode = extractCodeAfter("GENERATED VALIDATE FUNCTION:", block);
    const parseCode = extractCodeAfter("GENERATED PARSER FUNCTION:", block);

    const validate = validateCode ? uComputeMetrics("validate", validateCode) : null;
    const parse = parseCode ? uComputeMetrics("parse", parseCode) : null;

    const concerns: string[] = [];
    if (validate) concerns.push(...uComputeConcerns(label, validate, validateCode!));
    if (parse) concerns.push(...uComputeConcerns(label, parse, parseCode!));

    result.push({ label, validate, parse, concerns });
  }

  return result;
}

export function uBuildRuntimePerfReport(analysis: tsFunctionAnalysis[]): string {
  const total = analysis.length;
  const withValidate = analysis.filter((a) => a.validate).length;
  const withParse = analysis.filter((a) => a.parse).length;
  const withConcerns = analysis.filter((a) => a.concerns.length > 0).length;

  const totals = {
    validateLength: 0,
    parseLength: 0,
    objectKeys: 0,
    objectAssign: 0,
    objectCreateNull: 0,
    objectHasOwn: 0,
    refCalls: 0,
    visitMaps: 0,
  };

  for (const a of analysis) {
    if (a.validate) {
      totals.validateLength += a.validate.length;
      totals.objectKeys += a.validate.objectKeysCount;
      totals.objectAssign += a.validate.objectAssignCount;
      totals.objectCreateNull += a.validate.objectCreateNullCount;
      totals.objectHasOwn += a.validate.objectHasOwnCount;
      totals.refCalls += a.validate.refCallCount;
      totals.visitMaps += a.validate.hasVisitMap ? 1 : 0;
    }
    if (a.parse) {
      totals.parseLength += a.parse.length;
      totals.objectKeys += a.parse.objectKeysCount;
      totals.objectAssign += a.parse.objectAssignCount;
      totals.objectCreateNull += a.parse.objectCreateNullCount;
      totals.objectHasOwn += a.parse.objectHasOwnCount;
      totals.refCalls += a.parse.refCallCount;
      totals.visitMaps += a.parse.hasVisitMap ? 1 : 0;
    }
  }

  const heavy = [...analysis]
    .map((a) => ({
      label: a.label,
      size: (a.validate?.length ?? 0) + (a.parse?.length ?? 0),
    }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  const sample = analysis.find((a) => a.concerns.length > 0);

  const lines: string[] = [
    "# Runtime JS performance analysis of generated validator/parser functions",
    "",
    `Schemas analyzed: ${total}`,
    `With generated validate function: ${withValidate}`,
    `With generated parse function: ${withParse}`,
    `Schemas with at least one concern: ${withConcerns}`,
    "",
    "## Aggregate generated code metrics",
    `Total validate code characters: ${totals.validateLength}`,
    `Total parse code characters: ${totals.parseLength}`,
    `Object.keys(...) occurrences: ${totals.objectKeys}`,
    `Object.assign(...) occurrences: ${totals.objectAssign}`,
    `Object.create(null) occurrences: ${totals.objectCreateNull}`,
    `Object.hasOwn(...) occurrences: ${totals.objectHasOwn}`,
    `Reference function calls (L####): ${totals.refCalls}`,
    `Functions with visit Map prelude: ${totals.visitMaps}`,
    "",
    "## Heaviest generated functions (validate + parse chars)",
    ...heavy.map((h) => `- ${h.label}: ${h.size} chars`),
    "",
    "## Sample of concerns",
  ];

  if (sample) {
    lines.push(`Label: ${sample.label}`);
    for (const c of sample.concerns) lines.push(`  - ${c}`);
  } else {
    lines.push("No concerns detected.");
  }

  lines.push(
    "",
    "## Common optimization opportunities",
    "",
    "1. `Object.keys(passed).length` in additionalProperties checks — replace with a counter to avoid a second pass and allocation.",
    "2. `Object.assign(Object.create(null), v)` on every parser success — consider reusing the input object when no unknown keys need to be stripped.",
    "3. Per-property `Object.hasOwn(v, 'prop')` guards — batch required checks or trust direct `v.prop` access when the shape is known.",
    "4. `L####` reference functions with `.visit` Map — for non-recursive schemas, inlining the ref would remove the Map allocation and call overhead.",
    "5. Repeated `Array.isArray(v)` + `typeof v === 'object'` checks — a single monomorphic type guard at entry can shrink the generated body.",
    "",
    "## Note",
    "These are static observations on the compiled source of the generated JS functions. Architecture-level changes should be evaluated against the DNA-to-JS compiler in @ytrynot/dna before applying.",
  );

  return lines.join("\n");
}

function main() {
  const inPath = process.argv[2] ?? path.resolve(__dirname, "../sandbox/schema-adn-functions.log");
  const outPath = process.argv[3] ?? path.resolve(__dirname, "../sandbox/runtime-perf-report.log");

  const source = fs.readFileSync(inPath, "utf8");
  const analysis = uAnalyzeLog(source);
  const report = uBuildRuntimePerfReport(analysis);

  fs.writeFileSync(outPath, report);
  console.log(`Report written to ${outPath} (${analysis.length} schemas analyzed)`);
}

if (
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
) {
  main();
}
