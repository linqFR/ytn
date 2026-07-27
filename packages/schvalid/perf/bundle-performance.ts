import { jschemaToDna } from "../src/index.js";
import { validator as validatorFull } from "@ytn/dna/toJs";
import { validator as validatorMin } from "@ytn/dna/toJs/min";

const schema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 2 },
    age: { type: "number", minimum: 0 },
    active: { type: "boolean" },
  },
  required: ["name", "age", "active"],
};

const dnaSeq = jschemaToDna(schema);

const validateFull = validatorFull(dnaSeq);
const validateMin = validatorMin(dnaSeq);

if (typeof validateFull !== "function") {
  throw new Error("Full bundle did not compile to a function");
}
if (typeof validateMin !== "function") {
  throw new Error("Minified bundle did not compile to a function");
}

if (validateFull({ name: "John", age: 30, active: true }) !== true) {
  throw new Error("Full bundle validation failed on valid data");
}
if (validateFull({ name: "J", age: 30, active: true }) !== false) {
  throw new Error("Full bundle validation should have failed on invalid data");
}
if (validateMin({ name: "John", age: 30, active: true }) !== true) {
  throw new Error("Minified bundle validation failed on valid data");
}
if (validateMin({ name: "J", age: 30, active: true }) !== false) {
  throw new Error("Minified bundle validation should have failed on invalid data");
}

const iterations = 10000;
const runs = 30;
const testData = { name: "John", age: 30, active: true };

// Warm up
for (let i = 0; i < 1000; i++) {
  validateFull(testData);
  validateMin(testData);
}

const fullSamples: number[] = [];
const minSamples: number[] = [];

// Interleaved runs: A-B, A-B, ... (repeated `runs` times)
for (let r = 0; r < runs; r++) {
  const startFull = performance.now();
  for (let i = 0; i < iterations; i++) {
    validateFull(testData);
  }
  const timeFull = performance.now() - startFull;

  const startMin = performance.now();
  for (let i = 0; i < iterations; i++) {
    validateMin(testData);
  }
  const timeMin = performance.now() - startMin;

  fullSamples.push(timeFull / iterations);
  minSamples.push(timeMin / iterations);
}

const stats = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const median = sorted.length % 2
    ? sorted[Math.floor(sorted.length / 2)]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  return { mean, median, p95, stdDev };
};

const fullStats = stats(fullSamples);
const minStats = stats(minSamples);

const toMs = (s: number) => (s * 1000).toFixed(3);
const toThroughput = (s: number) => (1 / s).toFixed(0);

const diff = (minStats.median - fullStats.median) / fullStats.median;

console.log("\n");
console.log("WARNING: Benchmark results may vary between runs due to parallel execution scheduling.");
console.log("=".repeat(70));
console.log("BUNDLE VALIDATION BENCHMARK with compiled function");
console.log("=".repeat(70));
console.log(`Schema:     JSON Schema -> DNA (object with string/number/boolean)`);
console.log(`Data:       ${JSON.stringify(testData)}`);
console.log(`Workload:   ${runs.toLocaleString()} runs x ${iterations.toLocaleString()} validations = ${(runs * iterations).toLocaleString()} total validations`);
console.log("=".repeat(70));
console.log("| Bundle      | ms/validation | median (ms) | p95 (ms) | stddev (ms) | validations/sec |");
console.log("|-------------|---------------|-------------|----------|-------------|-----------------|");
console.log(`| Full bundle | ${toMs(fullStats.mean).padEnd(13)} | ${toMs(fullStats.median).padEnd(11)} | ${toMs(fullStats.p95).padEnd(8)} | ${toMs(fullStats.stdDev).padEnd(11)} | ${toThroughput(fullStats.median).padEnd(15)} |`);
console.log(`| Min bundle  | ${toMs(minStats.mean).padEnd(13)} | ${toMs(minStats.median).padEnd(11)} | ${toMs(minStats.p95).padEnd(8)} | ${toMs(minStats.stdDev).padEnd(11)} | ${toThroughput(minStats.median).padEnd(15)} |`);
console.log("=".repeat(70));
console.log(`Min bundle is ${Math.abs(diff * 100).toFixed(2)}% ${diff < 0 ? "faster" : "slower"} than Full bundle (median)`);
console.log("=".repeat(70));

if (fullStats.median >= 0.01) {
  throw new Error(`Full bundle median ${fullStats.median} ms is too slow`);
}
if (minStats.median >= 0.01) {
  throw new Error(`Min bundle median ${minStats.median} ms is too slow`);
}
