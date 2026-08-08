import { performance } from "node:perf_hooks";

import { defineContract, pico } from "../src/editor.js";
import { execute } from "../src/index.js";

const czvoContract = defineContract({
  name: "benchmark",
  description: "Benchmark contract",
  cli: {
    positionals: ["cmd", "param"],
    flags: {
      verbose: { short: "v", type: "boolean", desc: "Verbose" },
      output: { short: "o", type: "string", desc: "Output file" },
      force: { short: "f", type: "boolean", desc: "Force" },
    },
  },
  targets: {
    install: {
      cmd: pico.literal("install"),
      param: pico.string(),
      verbose: "boolean",
      output: "string",
    },
    remove: {
      cmd: pico.literal("remove"),
      param: pico.string(),
      force: "boolean",
    },
    update: {
      cmd: pico.literal("update"),
      param: pico.string(),
      verbose: "boolean",
    },
    list: {
      cmd: pico.literal("list"),
      verbose: "boolean",
    },
    info: {
      cmd: pico.literal("info"),
      param: pico.string(),
    },
    status: {
      cmd: pico.literal("status"),
      verbose: "boolean",
    },
    start: {
      cmd: pico.literal("start"),
      param: pico.string(),
      force: "boolean",
    },
    stop: {
      cmd: pico.literal("stop"),
      param: pico.string(),
    },
    restart: {
      cmd: pico.literal("restart"),
      param: pico.string(),
      force: "boolean",
    },
    config: {
      cmd: pico.literal("config"),
      param: pico.string(),
      output: "string",
    },
  },
});

const testArgs = ["install", "mypackage", "--verbose", "--output", "file.txt"];

console.log("=== Benchmarks ===");

// Parsing + validation
for (let i = 0; i < 100; i++) {
  execute(czvoContract, testArgs);
}

const startParse = performance.now();
for (let i = 0; i < 10000; i++) {
  execute(czvoContract, testArgs);
}
const endParse = performance.now();
const avgParse = (endParse - startParse) / 10000;
console.log(`@ytrynot/czvo avg time: ${avgParse.toFixed(6)}ms per call`);

// Compilation overhead
const startCompile = performance.now();
const compileContract = defineContract({
  name: "compile-test",
  description: "Compilation test",
  cli: {
    positionals: ["cmd"],
    flags: {
      verbose: { short: "v", type: "boolean", desc: "Verbose" },
    },
  },
  targets: {
    test: { cmd: pico.literal("test"), verbose: "boolean" },
  },
});
const endCompile = performance.now();
const compileTime = endCompile - startCompile;
console.log(`@ytrynot/czvo compilation time: ${compileTime.toFixed(2)}ms`);

// Routing only
const startRouting = performance.now();
for (let i = 0; i < 10000; i++) {
  czvoContract.router["1"];
}
const endRouting = performance.now();
const avgRouting = (endRouting - startRouting) / 10000;
console.log(`@ytrynot/czvo routing only (object lookup): ${avgRouting.toFixed(6)}ms per call`);

// Manual parsing baseline
const manualParse = (args: string[]) => {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      result[key] = true;
    } else {
      result.positional = args[i];
    }
  }
  return result;
};

for (let i = 0; i < 100; i++) {
  manualParse(testArgs);
}

const startManual = performance.now();
for (let i = 0; i < 10000; i++) {
  manualParse(testArgs);
}
const endManual = performance.now();
const avgManual = (endManual - startManual) / 10000;
console.log(`Manual parsing baseline: ${avgManual.toFixed(6)}ms per call`);

// Summary
console.log("\n=== Performance Summary ===");
console.log("Note: These are internal @ytrynot/czvo benchmarks.");
console.log("For comparison with other CLI libraries (commander.js, yargs, etc.),");
console.log("additional benchmarks would need to be created with those libraries installed.");
console.log("Current setup only tests @ytrynot/czvo to avoid external dependencies.");

// Startup time
const iterations = 1000;
const times: number[] = [];

for (let i = 0; i < iterations; i++) {
  const start = performance.now();

  const contract = defineContract({
    name: "benchmark-cli",
    description: "Benchmark CLI",
    cli: {
      positionals: ["cmd"],
      flags: {
        verbose: { short: "v", type: "boolean", desc: "Verbose" },
      },
    },
    targets: {
      version: { cmd: pico.literal("version") },
      help: { cmd: pico.literal("help"), verbose: "boolean" },
      test: { cmd: pico.literal("test"), verbose: "boolean" },
    },
  });

  execute(contract, ["test", "--verbose"]);

  const end = performance.now();
  times.push(end - start);
}

const avgStartup = times.reduce((a, b) => a + b, 0) / iterations;
const minStartup = Math.min(...times);
const maxStartup = Math.max(...times);

console.log(`@ytrynot/czvo startup + command: ${avgStartup.toFixed(2)}ms (avg)`);
console.log(`  Min: ${minStartup.toFixed(2)}ms, Max: ${maxStartup.toFixed(2)}ms`);
console.log(`  Iterations: ${iterations}`);
