import { Ajv2020 as Ajv } from "ajv/dist/2020.js";
import { z } from "zod";
import { validator as validatorDnaNormal, parser as parserDnaNormal } from "@ytrynot/dna/toJs";
import { jschemaToDna, schvalid as schvalidNormal } from "../src/index.js";

const GC_AVAILABLE = typeof globalThis.gc === "function";

/** Force GC between runs if --expose-gc was passed; no-op otherwise. */
function forceGc(): void {
  if (GC_AVAILABLE) globalThis.gc?.();
}

/** Print GC status + stats legend (shared between compilation and validation sections). */
function printGcAndStatsLegend(): void {
  console.log(`GC between runs: ${GC_AVAILABLE ? "YES (--expose-gc)" : "NO (pass --expose-gc)"}`);
  console.log("Stats: mean = average; median = middle value; p95 = 95% of measurements are at or below this value (5% are slower). CV% = coefficient of variation.");
}

/** DCE sink — prevents V8 from eliminating function calls. */
let _sink = 0;

type BenchmarkStats = {
  mean: number;
  median: number;
  p95: number;
  stdDev: number;
  cvPct: number;
};

const computeStats = (samples: number[]): BenchmarkStats => {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const median = sorted.length % 2
    ? sorted[Math.floor(sorted.length / 2)]!
    : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  const cvPct = (stdDev / mean) * 100;
  return { mean, median, p95, stdDev, cvPct };
};

const pad = (n: number, width: number) => n.toFixed(5).padEnd(width);
const fmtCv = (n: number) => `${n.toFixed(1)}%`.padStart(6);

const runCompilationBench = (
  fn: (index: number) => unknown,
  iterations: number,
  runs: number,
): BenchmarkStats => {
  for (let i = 0; i < 100; i++) _sink = (_sink + +!!fn(i % iterations)) | 0;
  const samples: number[] = [];
  for (let r = 0; r < runs; r++) {
    forceGc();
    const start = performance.now();
    for (let i = 0; i < iterations; i++) _sink = (_sink + +!!fn(i)) | 0;
    samples.push((performance.now() - start) / iterations);
  }
  return computeStats(samples);
};

const runValidationBench = (
  fn: (data: unknown) => unknown,
  iterations: number,
  runs: number,
): { valid: BenchmarkStats; invalid: BenchmarkStats } => {
  for (let i = 0; i < 10_000; i++) {
    _sink = (_sink + +!!fn(validData)) | 0;
    _sink = (_sink + +!!fn(invalidData)) | 0;
  }
  const validSamples: number[] = [];
  const invalidSamples: number[] = [];
  for (let r = 0; r < runs; r++) {
    forceGc();
    const startValid = performance.now();
    for (let i = 0; i < iterations; i++) _sink = (_sink + +!!fn(validData)) | 0;
    validSamples.push((performance.now() - startValid) / iterations);

    forceGc();
    const startInvalid = performance.now();
    for (let i = 0; i < iterations; i++) _sink = (_sink + +!!fn(invalidData)) | 0;
    invalidSamples.push((performance.now() - startInvalid) / iterations);
  }
  return { valid: computeStats(validSamples), invalid: computeStats(invalidSamples) };
};

/** Deterministic shuffle (seeded) — avoids Math.random() non-determinism. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shuffle = <T>(arr: T[], rng: () => number): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
};

const runValidationBenchInterleaved = (
  fns: ((data: unknown) => unknown)[],
  iterations: number,
  runs: number,
): { valid: BenchmarkStats; invalid: BenchmarkStats }[] => {
  for (let i = 0; i < 10_000; i++) {
    for (const fn of fns) {
      _sink = (_sink + +!!fn(validData)) | 0;
      _sink = (_sink + +!!fn(invalidData)) | 0;
    }
  }
  const validSamples: number[][] = fns.map(() => []);
  const invalidSamples: number[][] = fns.map(() => []);
  const indices = fns.map((_, i) => i);
  for (let r = 0; r < runs; r++) {
    forceGc();
    // Seeded shuffle per run — deterministic, different order each run
    const order = shuffle(indices, mulberry32(r * 7919 + 31));
    for (const i of order) {
      const fn = fns[i]!;
      forceGc();
      const startValid = performance.now();
      for (let j = 0; j < iterations; j++) _sink = (_sink + +!!fn(validData)) | 0;
      validSamples[i]!.push((performance.now() - startValid) / iterations);

      forceGc();
      const startInvalid = performance.now();
      for (let j = 0; j < iterations; j++) _sink = (_sink + +!!fn(invalidData)) | 0;
      invalidSamples[i]!.push((performance.now() - startInvalid) / iterations);
    }
  }
  return fns.map((_, i) => ({
    valid: computeStats(validSamples[i]!),
    invalid: computeStats(invalidSamples[i]!),
  }));
};

const testSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100 },
    age: { type: "number", minimum: 0, maximum: 150 },
    email: { type: "string", format: "email" },
    tags: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
      minItems: 1,
      maxItems: 10,
    },
    active: { type: "boolean" },
  },
  required: ["name", "email"],
  additionalProperties: false,
};

const validData = {
  name: "John Doe",
  age: 30,
  email: "john@example.com",
  tags: ["user", "premium"],
  active: true,
};

const invalidData = {
  name: "",
  age: -5,
  email: "invalid-email",
  extraProp: "not allowed",
};

const dna = jschemaToDna(testSchema);

const ajvValid = new Ajv({ validateFormats: false }).compile(testSchema);
const ajvErrors = new Ajv({ validateFormats: false, allErrors: true }).compile(testSchema);

const dnaValidNormal = validatorDnaNormal(dna);
const dnaErrorsNormal = parserDnaNormal(dna);

const schvalidValidNormal = schvalidNormal("validation").compile(testSchema);
const schvalidErrorsNormal = schvalidNormal("parser").compile(testSchema);
const schvalidFastNormal = schvalidNormal("fast").compile(testSchema);

const zodSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().min(0).max(150),
  email: z.email(),
  tags: z.array(z.string()).min(1).max(10),
  active: z.boolean(),
});

// --- Compilation Performance ---
{
  const iterations = 3000;
  const runs = 5;
  const schemas = Array.from({ length: iterations }, () => JSON.parse(JSON.stringify(testSchema)));

  const dnaVal = runCompilationBench((i) => validatorDnaNormal(jschemaToDna(schemas[i])), iterations, runs);
  const dnaParse = runCompilationBench((i) => parserDnaNormal(jschemaToDna(schemas[i])), iterations, runs);
  const schvalidVal = runCompilationBench((i) => schvalidNormal("validation").compile(schemas[i]), iterations, runs);
  const schvalidParse = runCompilationBench((i) => schvalidNormal("parser").compile(schemas[i]), iterations, runs);
  const schvalidFast = runCompilationBench((i) => schvalidNormal("fast").compile(schemas[i]), iterations, runs);

  const ajv1 = new Ajv({ validateFormats: false });
  const ajvMin = runCompilationBench((i) => ajv1.compile(schemas[i]), iterations, runs);

  const ajv2 = new Ajv({ validateFormats: false, allErrors: true });
  const ajvAll = runCompilationBench((i) => ajv2.compile(schemas[i]), iterations, runs);

  const zod = runCompilationBench(() => {
    z.object({
      name: z.string().min(1).max(100),
      age: z.number().min(0).max(150),
      email: z.email(),
      tags: z.array(z.string()).min(1).max(10),
      active: z.boolean(),
    });
  }, iterations, runs);

  console.log("\n");
  console.log("WARNING: Benchmark results may vary between runs due to parallel execution scheduling.");
  console.log("=".repeat(90));
  console.log("COMPILATION PERFORMANCE COMPARISON (ms per compilation)");
  printGcAndStatsLegend();
  console.log("NOTE: 'DNA Validation' and 'DNA Parser' are low-level @ytrynot/dna modes included for internal comparison with Zod.");
  console.log(`Workload: ${runs} runs x ${iterations.toLocaleString()} schemas = ${(runs * iterations).toLocaleString()} compilations per mode`);
  console.log("=".repeat(90));
  console.log("| Mode               | mean (ms)    | median (ms) | p95 (ms) | stddev (ms) | CV%   |");
  console.log("|--------------------|--------------|-------------|----------|-------------|-------|");
  console.log(`| AJV Minimal        | ${pad(ajvMin.mean, 12)} | ${pad(ajvMin.median, 11)} | ${pad(ajvMin.p95, 8)} | ${pad(ajvMin.stdDev, 11)} | ${fmtCv(ajvMin.cvPct)} |`);
  console.log(`| AJV AllErrors      | ${pad(ajvAll.mean, 12)} | ${pad(ajvAll.median, 11)} | ${pad(ajvAll.p95, 8)} | ${pad(ajvAll.stdDev, 11)} | ${fmtCv(ajvAll.cvPct)} |`);
  console.log(`| Schvalid Val       | ${pad(schvalidVal.mean, 12)} | ${pad(schvalidVal.median, 11)} | ${pad(schvalidVal.p95, 8)} | ${pad(schvalidVal.stdDev, 11)} | ${fmtCv(schvalidVal.cvPct)} |`);
  console.log(`| Schvalid ParseFast | ${pad(schvalidFast.mean, 12)} | ${pad(schvalidFast.median, 11)} | ${pad(schvalidFast.p95, 8)} | ${pad(schvalidFast.stdDev, 11)} | ${fmtCv(schvalidFast.cvPct)} |`);
  console.log(`| DNA Validation     | ${pad(dnaVal.mean, 12)} | ${pad(dnaVal.median, 11)} | ${pad(dnaVal.p95, 8)} | ${pad(dnaVal.stdDev, 11)} | ${fmtCv(dnaVal.cvPct)} |`);
  console.log("|--------------------|--------------|-------------|----------|-------------|-------|");
  console.log(`| DNA Parser         | ${pad(dnaParse.mean, 12)} | ${pad(dnaParse.median, 11)} | ${pad(dnaParse.p95, 8)} | ${pad(dnaParse.stdDev, 11)} | ${fmtCv(dnaParse.cvPct)} |`);
  console.log(`| Schvalid Parse     | ${pad(schvalidParse.mean, 12)} | ${pad(schvalidParse.median, 11)} | ${pad(schvalidParse.p95, 8)} | ${pad(schvalidParse.stdDev, 11)} | ${fmtCv(schvalidParse.cvPct)} |`);
  console.log(`| Zod                | ${pad(zod.mean, 12)} | ${pad(zod.median, 11)} | ${pad(zod.p95, 8)} | ${pad(zod.stdDev, 11)} | ${fmtCv(zod.cvPct)} |`);
  console.log("=".repeat(90));
  const speedupLabel = (s: string) => s.padEnd(16);
  const speedupValue = (n: number) => `${n.toFixed(2)}x`.padStart(6);
  console.log("\nSPEED vs AJV Minimal (mean):");
  console.log(`  ${speedupLabel("DNA Validation")}: ${speedupValue(ajvMin.mean / dnaVal.mean)}`);
  console.log(`  ${speedupLabel("DNA Parser")}: ${speedupValue(ajvMin.mean / dnaParse.mean)}`);
  console.log(`  ${speedupLabel("Schvalid Val")}: ${speedupValue(ajvMin.mean / schvalidVal.mean)}`);
  console.log(`  ${speedupLabel("Schvalid Parse")}: ${speedupValue(ajvMin.mean / schvalidParse.mean)}`);
  console.log(`  ${speedupLabel("Schvalid ParseFast")}: ${speedupValue(ajvMin.mean / schvalidFast.mean)}`);
  console.log(`  ${speedupLabel("Zod")}: ${speedupValue(ajvMin.mean / zod.mean)}`);
  console.log("=".repeat(90));
  console.log("\nSPEED vs AJV AllErrors (mean):");
  console.log(`  ${speedupLabel("DNA Validation")}: ${speedupValue(ajvAll.mean / dnaVal.mean)}`);
  console.log(`  ${speedupLabel("DNA Parser")}: ${speedupValue(ajvAll.mean / dnaParse.mean)}`);
  console.log(`  ${speedupLabel("Schvalid Val")}: ${speedupValue(ajvAll.mean / schvalidVal.mean)}`);
  console.log(`  ${speedupLabel("Schvalid Parse")}: ${speedupValue(ajvAll.mean / schvalidParse.mean)}`);
  console.log(`  ${speedupLabel("Schvalid ParseFast")}: ${speedupValue(ajvAll.mean / schvalidFast.mean)}`);
  console.log(`  ${speedupLabel("Zod")}: ${speedupValue(ajvAll.mean / zod.mean)}`);
  console.log("=".repeat(90));
}

// --- Validation Performance ---
{
  const iterations = 5000;
  const runs = 30;

  const labels = ["AJV Minimal", "AJV AllErrors", "DNA Validation", "Schvalid Val", "Schvalid ParseFast", "DNA Parser", "Schvalid Parse", "Zod"];
  const fns = [
    (d: unknown) => ajvValid(d),
    (d: unknown) => ajvErrors(d),
    (d: unknown) => dnaValidNormal(d),
    (d: unknown) => schvalidValidNormal(d),
    (d: unknown) => schvalidFastNormal(d),
    (d: unknown) => dnaErrorsNormal(d),
    (d: unknown) => schvalidErrorsNormal(d),
    (d: unknown) => zodSchema.safeParse(d),
  ];
  const parserStartIndex = 5;

  const results = runValidationBenchInterleaved(fns, iterations, runs);
  const [ajvMin, ajvAll, dnaVal, schvalidVal, schvalidFast, dnaParse, schvalidParse, zod] = results;

  console.log("\n");
  console.log("WARNING: Benchmark results may vary between runs due to parallel execution scheduling.");
  console.log("=".repeat(110));
  console.log("VALIDATION PERFORMANCE COMPARISON (ms per validation)");
  printGcAndStatsLegend();
  console.log("NOTE: 'DNA Parser' is the low-level DNA parser included for apples-to-apples comparison with Zod's parse-and-transform contract.");
  console.log("=".repeat(110));
  console.log("Schema:     JSON Schema with string, number, email, array, boolean");
  console.log(`Valid:      ${JSON.stringify(validData)}`);
  console.log(`Invalid:    ${JSON.stringify(invalidData)}`);
  console.log(`Workload:   ${runs} runs x ${iterations.toLocaleString()} validations x ${fns.length} validators = ${(runs * iterations * fns.length).toLocaleString()} total validations per data`);
  console.log("Method:     Interleaved + seeded shuffle per run; each validator measured on the same data; GC forced between runs");
  console.log("=".repeat(110));
  console.log("| Mode               | Valid mean | Valid median | Valid p95 | Valid CV% | Invalid mean | Invalid median | Invalid p95 | Invalid CV% |");
  console.log("|--------------------|------------|--------------|-----------|-----------|--------------|----------------|-------------|-------------|");
  for (let i = 0; i < labels.length; i++) {
    const r = results[i]!;
    console.log(`| ${labels[i]!.padEnd(18)} | ${pad(r.valid.mean, 10)} | ${pad(r.valid.median, 12)} | ${pad(r.valid.p95, 9)} | ${fmtCv(r.valid.cvPct)} | ${pad(r.invalid.mean, 12)} | ${pad(r.invalid.median, 14)} | ${pad(r.invalid.p95, 11)} | ${fmtCv(r.invalid.cvPct)} |`);
    if (i === parserStartIndex - 1) {
      console.log("|--------------------|------------|--------------|-----------|-----------|--------------|----------------|-------------|-------------|");
    }
  }
  console.log("=".repeat(110));
  const formatPercent = (ratio: number) => {
    const diff = (ratio - 1) * 100;
    return `${diff >= 0 ? "+" : ""}${diff.toFixed(0)} %`;
  };
  console.log("\n" + "=".repeat(62));
  console.log("SPEED vs AJV Minimal (valid data)");
  console.log("Ratio is speedup = ops/ms ratio = AJV time / mode time. x1.00 = same speed; x1.50 = 50% faster; x0.50 = 50% slower. % = (ratio - 1) * 100.");
  console.log("=".repeat(62));
  console.log("| Mode               | median | median%  | mean   | mean%    |");
  console.log("|--------------------|--------|----------|--------|----------|");
  for (let i = 0; i < labels.length; i++) {
    const r = results[i];
    const medianSpeedup = results[0].valid.median / r.valid.median;
    const meanSpeedup = results[0].valid.mean / r.valid.mean;
    console.log(`| ${labels[i].padEnd(18)} | x${medianSpeedup.toFixed(2).padEnd(5)} | ${formatPercent(medianSpeedup).padStart(8)} | x${meanSpeedup.toFixed(2).padEnd(5)} | ${formatPercent(meanSpeedup).padStart(8)} |`);
    if (i === parserStartIndex - 1) {
      console.log("|--------------------|--------|----------|--------|----------|");
    }
  }
  console.log("=".repeat(62));
  console.log("\n" + "=".repeat(62));
  console.log("SPEED vs AJV AllErrors (valid data)");
  console.log("Ratio is speedup = ops/ms ratio = AJV AllErrors time / mode time. x1.00 = same speed; x1.50 = 50% faster; x0.50 = 50% slower. % = (ratio - 1) * 100.");
  console.log("=".repeat(62));
  console.log("| Mode               | median | median%  | mean   | mean%    |");
  console.log("|--------------------|--------|----------|--------|----------|");
  for (let i = 0; i < labels.length; i++) {
    const r = results[i];
    const medianSpeedup = results[1].valid.median / r.valid.median;
    const meanSpeedup = results[1].valid.mean / r.valid.mean;
    console.log(`| ${labels[i].padEnd(18)} | x${medianSpeedup.toFixed(2).padEnd(5)} | ${formatPercent(medianSpeedup).padStart(8)} | x${meanSpeedup.toFixed(2).padEnd(5)} | ${formatPercent(meanSpeedup).padStart(8)} |`);
    if (i === parserStartIndex - 1) {
      console.log("|--------------------|--------|----------|--------|----------|");
    }
  }
  console.log("=".repeat(62));
  const totalValidations = runs * iterations;
  const totalTime = (r: { valid: BenchmarkStats; invalid: BenchmarkStats }) => (r.valid.mean + r.invalid.mean) * totalValidations;
  const padTotal = (n: number) => n.toFixed(2).padStart(10);
  console.log("\n" + "=".repeat(80));
  console.log("TOTAL RAW TIME (valid + invalid, all operations = runs x validations)");
  console.log("Total = (valid.mean + invalid.mean) x runs x validations. Ratio is speedup = AJV total / mode total.");
  console.log("=".repeat(80));
  console.log("| Mode               | total (ms) | ratio vs AJV Min | ratio vs AJV All |");
  console.log("|--------------------|------------|------------------|------------------|");
  for (let i = 0; i < labels.length; i++) {
    const r = results[i];
    const ratioMin = totalTime(results[0]) / totalTime(r);
    const ratioAll = totalTime(results[1]) / totalTime(r);
    console.log(`| ${labels[i].padEnd(18)} | ${padTotal(totalTime(r))} | ${("x" + ratioMin.toFixed(2)).padStart(16)} | ${("x" + ratioAll.toFixed(2)).padStart(16)} |`);
    if (i === parserStartIndex - 1) {
      console.log("|--------------------|------------|------------------|------------------|");
    }
  }
  console.log("=".repeat(80));
}

// --- Summary / Code Sizes ---
{
  console.log("\n" + "=".repeat(80));
  console.log("GENERATED CODE SIZES (bytes)");
  console.log("=".repeat(80));
  console.log("| Mode               | Size (bytes) |");
  console.log("|--------------------|--------------|");
  console.log(`| AJV Minimal        | ${ajvValid.toString().length.toString().padStart(12)} |`);
  console.log(`| AJV AllErrors      | ${ajvErrors.toString().length.toString().padStart(12)} |`);
  console.log(`| DNA Validation     | ${dnaValidNormal.toString().length.toString().padStart(12)} |`);
  console.log(`| DNA Parser         | ${dnaErrorsNormal.toString().length.toString().padStart(12)} |`);
  console.log(`| Schvalid Val       | ${schvalidValidNormal.toString().length.toString().padStart(12)} |`);
  console.log(`| Schvalid Parse     | ${schvalidErrorsNormal.toString().length.toString().padStart(12)} |`);
  console.log(`| Schvalid ParseFast | ${(schvalidValidNormal.toString().length + schvalidErrorsNormal.toString().length).toString().padStart(12)} | (validate + parse, both inlined; see note below)`);
  console.log(`| Zod Schema         | ${JSON.stringify(zodSchema).length.toString().padStart(12)} |`);
  console.log("Note: ParseFast's own dispatcher closure is tiny (~150 bytes); its real cost is the sum of the validate + parse functions it wraps and reuses (see `combineFast`).");
  console.log("=".repeat(80));
}

console.log(`\nDCE sink: ${_sink} (non-zero confirms calls were not eliminated)`);
