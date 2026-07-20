import Ajv2020 from "ajv/dist/2020.js";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { jschemaToDna } from "../../dist/index.js";
import { validator as validatorDnaNormal, parser as parserDnaNormal } from "@ytn/dna/toJs";
import { schvalid as schvalidNormal } from "../../dist/index.js";
const Ajv = Ajv2020;

type BenchmarkStats = {
  mean: number;
  median: number;
  p95: number;
  stdDev: number;
};

const computeStats = (samples: number[]): BenchmarkStats => {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const median = sorted.length % 2
    ? sorted[Math.floor(sorted.length / 2)]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  // p95: 95% of measurements are at or below this value; 5% are slower.
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  return { mean, median, p95, stdDev };
};

const pad = (n: number, width: number) => n.toFixed(5).padEnd(width);

const runCompilationBench = (
  fn: (index: number) => unknown,
  iterations: number,
  runs: number,
): BenchmarkStats => {
  for (let i = 0; i < 100; i++) fn(i);
  const samples: number[] = [];
  for (let r = 0; r < runs; r++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn(i);
    samples.push((performance.now() - start) / iterations);
  }
  return computeStats(samples);
};

const runValidationBench = (
  fn: (data: unknown) => unknown,
  iterations: number,
  runs: number,
): { valid: BenchmarkStats; invalid: BenchmarkStats } => {
  for (let i = 0; i < 100; i++) {
    fn(validData);
    fn(invalidData);
  }
  const validSamples: number[] = [];
  const invalidSamples: number[] = [];
  for (let r = 0; r < runs; r++) {
    const startValid = performance.now();
    for (let i = 0; i < iterations; i++) fn(validData);
    validSamples.push((performance.now() - startValid) / iterations);

    const startInvalid = performance.now();
    for (let i = 0; i < iterations; i++) fn(invalidData);
    invalidSamples.push((performance.now() - startInvalid) / iterations);
  }
  return { valid: computeStats(validSamples), invalid: computeStats(invalidSamples) };
};

const shuffle = <T>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const runValidationBenchInterleaved = (
  fns: ((data: unknown) => unknown)[],
  iterations: number,
  runs: number,
): { valid: BenchmarkStats; invalid: BenchmarkStats }[] => {
  for (let i = 0; i < 100; i++) {
    for (const fn of fns) {
      fn(validData);
      fn(invalidData);
    }
  }
  const validSamples: number[][] = fns.map(() => []);
  const invalidSamples: number[][] = fns.map(() => []);
  const indices = fns.map((_, i) => i);
  for (let r = 0; r < runs; r++) {
    for (const i of shuffle(indices)) {
      const fn = fns[i];
      const startValid = performance.now();
      for (let j = 0; j < iterations; j++) fn(validData);
      validSamples[i].push((performance.now() - startValid) / iterations);

      const startInvalid = performance.now();
      for (let j = 0; j < iterations; j++) fn(invalidData);
      invalidSamples[i].push((performance.now() - startInvalid) / iterations);
    }
  }
  return fns.map((_, i) => ({
    valid: computeStats(validSamples[i]),
    invalid: computeStats(invalidSamples[i]),
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
  name: "", // too short
  age: -5, // too low
  email: "invalid-email",
  extraProp: "not allowed",
};

describe("Full Comparative Benchmark: Schvalid + DNA vs AJV vs Zod", () => {
  let ajvValid: any;
  let ajvErrors: any;
  let dnaValidNormal: any;
  let dnaErrorsNormal: any;
  let schvalidValidNormal: any;
  let schvalidErrorsNormal: any;
  let zodSchema: any;

  beforeAll(() => {
    const dna = jschemaToDna(testSchema);

    // 1. AJV Validation (minimal)
    ajvValid = new Ajv({ validateFormats: false }).compile(testSchema);

    // 2. AJV Errors (detailed)
    ajvErrors = new Ajv({ validateFormats: false, allErrors: true }).compile(testSchema);

    // 3. DNA Validation
    dnaValidNormal = validatorDnaNormal(dna);

    // 4. DNA Parser
    dnaErrorsNormal = parserDnaNormal(dna);

    // 5. Schvalid Validation
    schvalidValidNormal = schvalidNormal("validation").compile(testSchema);

    // 6. Schvalid Parser
    schvalidErrorsNormal = schvalidNormal("parser").compile(testSchema);

    // 7. Zod
    zodSchema = z.object({
      name: z.string().min(1).max(100),
      age: z.number().min(0).max(150),
      email: z.email(),
      tags: z.array(z.string()).min(1).max(10),
      active: z.boolean()
    });
  });

  describe("Compilation Performance", () => {

    it("Summary - Compilation comparison table", () => {
      const iterations = 3000;
      const runs = 5;
      const schemas = Array.from({ length: iterations }, () => JSON.parse(JSON.stringify(testSchema)));

      const dnaVal = runCompilationBench((i) => validatorDnaNormal(jschemaToDna(schemas[i])), iterations, runs);
      const dnaParse = runCompilationBench((i) => parserDnaNormal(jschemaToDna(schemas[i])), iterations, runs);
      const schvalidVal = runCompilationBench((i) => schvalidNormal("validation").compile(schemas[i]), iterations, runs);
      const schvalidParse = runCompilationBench((i) => schvalidNormal("parser").compile(schemas[i]), iterations, runs);

      const ajv1 = new Ajv({ validateFormats: false });
      const ajvMin = runCompilationBench((i) => ajv1.compile(schemas[i]), iterations, runs);

      const ajv2 = new Ajv({ validateFormats: false, allErrors: true });
      const ajvAll = runCompilationBench((i) => ajv2.compile(schemas[i]), iterations, runs);

      const zod = runCompilationBench((i) => {
        z.object({
          name: z.string().min(1).max(100),
          age: z.number().min(0).max(150),
          email: z.email(),
          tags: z.array(z.string()).min(1).max(10),
          active: z.boolean()
        });
      }, iterations, runs);

      console.log("\n");
      console.log("WARNING: Benchmark results may vary between runs due to parallel execution scheduling.");
      console.log("=".repeat(90));
      console.log("COMPILATION PERFORMANCE COMPARISON (ms per compilation)");
      console.log("Stats: mean = average; median = middle value; p95 = 95% of measurements are at or below this value (5% are slower); stddev = dispersion.");
      console.log(`Workload: ${runs} runs × ${iterations.toLocaleString()} schemas = ${(runs * iterations).toLocaleString()} compilations per mode`);
      console.log("=".repeat(90));
      console.log("| Mode               | mean (ms)    | median (ms) | p95 (ms) | stddev (ms) |");
      console.log("|--------------------|--------------|-------------|----------|-------------|");
      console.log(`| DNA Validation     | ${pad(dnaVal.mean, 12)} | ${pad(dnaVal.median, 11)} | ${pad(dnaVal.p95, 8)} | ${pad(dnaVal.stdDev, 11)} |`);
      console.log(`| DNA Parser         | ${pad(dnaParse.mean, 12)} | ${pad(dnaParse.median, 11)} | ${pad(dnaParse.p95, 8)} | ${pad(dnaParse.stdDev, 11)} |`);
      console.log(`| Schvalid Val       | ${pad(schvalidVal.mean, 12)} | ${pad(schvalidVal.median, 11)} | ${pad(schvalidVal.p95, 8)} | ${pad(schvalidVal.stdDev, 11)} |`);
      console.log(`| Schvalid Parse     | ${pad(schvalidParse.mean, 12)} | ${pad(schvalidParse.median, 11)} | ${pad(schvalidParse.p95, 8)} | ${pad(schvalidParse.stdDev, 11)} |`);
      console.log(`| AJV Minimal        | ${pad(ajvMin.mean, 12)} | ${pad(ajvMin.median, 11)} | ${pad(ajvMin.p95, 8)} | ${pad(ajvMin.stdDev, 11)} |`);
      console.log(`| AJV AllErrors      | ${pad(ajvAll.mean, 12)} | ${pad(ajvAll.median, 11)} | ${pad(ajvAll.p95, 8)} | ${pad(ajvAll.stdDev, 11)} |`);
      console.log(`| Zod                | ${pad(zod.mean, 12)} | ${pad(zod.median, 11)} | ${pad(zod.p95, 8)} | ${pad(zod.stdDev, 11)} |`);
      console.log("=".repeat(90));
      const speedupLabel = (s: string) => s.padEnd(16);
      const speedupValue = (n: number) => `${n.toFixed(2)}x`.padStart(6);
      console.log("\nSPEED vs AJV Minimal (mean):");
      console.log(`  ${speedupLabel("DNA Validation")}: ${speedupValue(ajvMin.mean / dnaVal.mean)}`);
      console.log(`  ${speedupLabel("DNA Parser")}: ${speedupValue(ajvMin.mean / dnaParse.mean)}`);
      console.log(`  ${speedupLabel("Schvalid Val")}: ${speedupValue(ajvMin.mean / schvalidVal.mean)}`);
      console.log(`  ${speedupLabel("Schvalid Parse")}: ${speedupValue(ajvMin.mean / schvalidParse.mean)}`);
      console.log(`  ${speedupLabel("Zod")}: ${speedupValue(ajvMin.mean / zod.mean)}`);
      console.log("=".repeat(90));
      console.log("\nSPEED vs AJV AllErrors (mean):");
      console.log(`  ${speedupLabel("DNA Validation")}: ${speedupValue(ajvAll.mean / dnaVal.mean)}`);
      console.log(`  ${speedupLabel("DNA Parser")}: ${speedupValue(ajvAll.mean / dnaParse.mean)}`);
      console.log(`  ${speedupLabel("Schvalid Val")}: ${speedupValue(ajvAll.mean / schvalidVal.mean)}`);
      console.log(`  ${speedupLabel("Schvalid Parse")}: ${speedupValue(ajvAll.mean / schvalidParse.mean)}`);
      console.log(`  ${speedupLabel("Zod")}: ${speedupValue(ajvAll.mean / zod.mean)}`);
      console.log("=".repeat(90));

      expect(true).toBe(true);
    });
  });

  describe("Validation Performance", () => {
    it("Summary - Validation comparison table", () => {
      const iterations = 5000;
      const runs = 30;

      const labels = ["AJV Minimal", "AJV AllErrors", "DNA Validation", "DNA Parser", "Schvalid Val", "Schvalid Parse", "Zod"];
      const fns = [
        (d: unknown) => ajvValid(d),
        (d: unknown) => ajvErrors(d),
        (d: unknown) => dnaValidNormal(d),
        (d: unknown) => dnaErrorsNormal(d),
        (d: unknown) => schvalidValidNormal(d),
        (d: unknown) => schvalidErrorsNormal(d),
        (d: unknown) => zodSchema.safeParse(d),
      ];

      const results = runValidationBenchInterleaved(fns, iterations, runs);
      const [ajvMin, ajvAll, dnaVal, dnaParse, schvalidVal, schvalidParse, zod] = results;

      console.log("\n");
      console.log("WARNING: Benchmark results may vary between runs due to parallel execution scheduling.");
      console.log("=".repeat(110));
      console.log("VALIDATION PERFORMANCE COMPARISON (ms per validation)");
      console.log("Stats: mean = average; median = middle value; p95 = 95% of measurements are at or below this value (5% are slower).");
      console.log("=".repeat(110));
      console.log("Schema:     JSON Schema with string, number, email, array, boolean");
      console.log(`Valid:      ${JSON.stringify(validData)}`);
      console.log(`Invalid:    ${JSON.stringify(invalidData)}`);
      console.log(`Workload:   ${runs} runs × ${iterations.toLocaleString()} validations × ${fns.length} validators = ${(runs * iterations * fns.length).toLocaleString()} total validations per data`);
      console.log("Method:     Interleaved + random order per run; each validator measured on the same data");
      console.log("=".repeat(110));
      console.log("| Mode               | Valid mean | Valid median | Valid p95 | Invalid mean | Invalid median | Invalid p95 |");
      console.log("|--------------------|------------|--------------|-----------|--------------|----------------|-------------|");
      for (let i = 0; i < labels.length; i++) {
        const r = results[i];
        console.log(`| ${labels[i].padEnd(18)} | ${pad(r.valid.mean, 10)} | ${pad(r.valid.median, 12)} | ${pad(r.valid.p95, 9)} | ${pad(r.invalid.mean, 12)} | ${pad(r.invalid.median, 14)} | ${pad(r.invalid.p95, 11)} |`);
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
      }
      console.log("=".repeat(62));
      const totalValidations = runs * iterations;
      const totalTime = (r: { valid: BenchmarkStats; invalid: BenchmarkStats }) => (r.valid.mean + r.invalid.mean) * totalValidations;
      const padTotal = (n: number) => n.toFixed(2).padStart(10);
      console.log("\n" + "=".repeat(80));
      console.log("TOTAL RAW TIME (valid + invalid, all operations = runs × validations)");
      console.log("Total = (valid.mean + invalid.mean) × runs × validations. Ratio is speedup = AJV total / mode total.");
      console.log("=".repeat(80));
      console.log("| Mode               | total (ms) | ratio vs AJV Min | ratio vs AJV All |");
      console.log("|--------------------|------------|------------------|------------------|");
      for (let i = 0; i < labels.length; i++) {
        const r = results[i];
        const ratioMin = totalTime(results[0]) / totalTime(r);
        const ratioAll = totalTime(results[1]) / totalTime(r);
        console.log(`| ${labels[i].padEnd(18)} | ${padTotal(totalTime(r))} | ${("x" + ratioMin.toFixed(2)).padStart(16)} | ${("x" + ratioAll.toFixed(2)).padStart(16)} |`);
      }
      console.log("=".repeat(80));

      expect(true).toBe(true);
    });
  });

  describe("Summary", () => {
    it("Function Sizes", () => {
      console.log("\n" + "=".repeat(80));
      console.log("GENERATED CODE SIZES (bytes)");
      console.log("=".repeat(80));
      console.log(`| Mode               | Size (bytes) |`);
      console.log("|--------------------|--------------|");
      console.log(`| AJV Minimal        | ${ajvValid.toString().length.toString().padStart(12)} |`);
      console.log(`| AJV AllErrors      | ${ajvErrors.toString().length.toString().padStart(12)} |`);
      console.log(`| DNA Validation     | ${dnaValidNormal.toString().length.toString().padStart(12)} |`);
      console.log(`| DNA Parser         | ${dnaErrorsNormal.toString().length.toString().padStart(12)} |`);
      console.log(`| Schvalid Val       | ${schvalidValidNormal.toString().length.toString().padStart(12)} |`);
      console.log(`| Schvalid Parse     | ${schvalidErrorsNormal.toString().length.toString().padStart(12)} |`);
      console.log(`| Zod Schema         | ${JSON.stringify(zodSchema).length.toString().padStart(12)} |`);
      console.log("=".repeat(80));

      expect(true).toBe(true);
    });
  });
});
