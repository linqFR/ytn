import { describe, it, expect } from "vitest";
import { performance } from "node:perf_hooks";

import { defineContract, pico } from "../../src/editor.js";
import { execute } from "../../src/index.js";

describe("CLI Libraries Performance Comparison", () => {
  // Test contract with 10 targets
  const czvoContract = defineContract({
    name: "benchmark",
    description: "Benchmark contract",
    cli: {
      positionals: ["cmd", "param"],
      flags: {
        verbose: { short: "v", type: "boolean", desc: "Verbose" },
        output: { short: "o", type: "string", desc: "Output file" },
        force: { short: "f", type: "boolean", desc: "Force" }
      }
    },
    targets: {
      install: {
        cmd: pico.literal("install"),
        param: pico.string(),
        verbose: "boolean",
        output: "string"
      },
      remove: {
        cmd: pico.literal("remove"),
        param: pico.string(),
        force: "boolean"
      },
      update: {
        cmd: pico.literal("update"),
        param: pico.string(),
        verbose: "boolean"
      },
      list: {
        cmd: pico.literal("list"),
        verbose: "boolean"
      },
      info: {
        cmd: pico.literal("info"),
        param: pico.string()
      },
      status: {
        cmd: pico.literal("status"),
        verbose: "boolean"
      },
      start: {
        cmd: pico.literal("start"),
        param: pico.string(),
        force: "boolean"
      },
      stop: {
        cmd: pico.literal("stop"),
        param: pico.string()
      },
      restart: {
        cmd: pico.literal("restart"),
        param: pico.string(),
        force: "boolean"
      },
      config: {
        cmd: pico.literal("config"),
        param: pico.string(),
        output: "string"
      }
    }
  });

  const testArgs = ["install", "mypackage", "--verbose", "--output", "file.txt"];

  it("should measure czvo parsing + validation performance", () => {
    // Warm up
    for (let i = 0; i < 100; i++) {
      execute(czvoContract, testArgs);
    }

    // Measure
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      execute(czvoContract, testArgs);
    }
    const end = performance.now();

    const avgTime = (end - start) / 10000;
    console.log(`@ytn/czvo avg time: ${avgTime.toFixed(6)}ms per call`);

    expect(avgTime).toBeGreaterThan(0);
  });

  it("should measure czvo compilation overhead", () => {
    const start = performance.now();
    const contract = defineContract({
      name: "compile-test",
      description: "Compilation test",
      cli: {
        positionals: ["cmd"],
        flags: {
          verbose: { short: "v", type: "boolean", desc: "Verbose" }
        }
      },
      targets: {
        test: { cmd: pico.literal("test"), verbose: "boolean" }
      }
    });
    const end = performance.now();

    const compileTime = end - start;
    console.log(`@ytn/czvo compilation time: ${compileTime.toFixed(2)}ms`);

    expect(compileTime).toBeGreaterThan(0);
  });

  it("should measure czvo routing performance only", () => {
    // Test pure routing by measuring just the router lookup
    // The router is a Record<string, tsTargetName | tsTargetName[]>
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      czvoContract.router["1"]; // Simple object property lookup
    }
    const end = performance.now();

    const avgTime = (end - start) / 10000;
    console.log(`@ytn/czvo routing only (object lookup): ${avgTime.toFixed(6)}ms per call`);

    expect(avgTime).toBeGreaterThan(0);
  });

  it("should compare with manual parsing baseline", () => {
    // Manual parsing without any library
    const manualParse = (args: string[]) => {
      const result: any = {};
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

    // Warm up
    for (let i = 0; i < 100; i++) {
      manualParse(testArgs);
    }

    // Measure
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      manualParse(testArgs);
    }
    const end = performance.now();

    const avgTime = (end - start) / 10000;
    console.log(`Manual parsing baseline: ${avgTime.toFixed(6)}ms per call`);

    expect(avgTime).toBeGreaterThan(0);
  });

  it("should provide performance summary", () => {
    console.log("\n=== Performance Summary ===");
    console.log("Note: These are internal @ytn/czvo benchmarks.");
    console.log("For comparison with other CLI libraries (commander.js, yargs, etc.),");
    console.log("additional benchmarks would need to be created with those libraries installed.");
    console.log("Current setup only tests @ytn/czvo to avoid external dependencies.");
  });

  it("should measure startup time (comparable to external benchmarks)", () => {
    // This benchmark mimics the methodology from the external article:
    // Measure time to create a contract and execute a simple command
    
    const iterations = 1000;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      // Create contract (simulates framework startup)
      const contract = defineContract({
        name: "benchmark-cli",
        description: "Benchmark CLI",
        cli: {
          positionals: ["cmd"],
          flags: {
            verbose: { short: "v", type: "boolean", desc: "Verbose" }
          }
        },
        targets: {
          version: { cmd: pico.literal("version") },
          help: { cmd: pico.literal("help"), verbose: "boolean" },
          test: { cmd: pico.literal("test"), verbose: "boolean" }
        }
      });

      // Execute command (simulates command execution)
      execute(contract, ["test", "--verbose"]);
      
      const end = performance.now();
      times.push(end - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log(`@ytn/czvo startup + command: ${avgTime.toFixed(2)}ms (avg)`);
    console.log(`  Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    console.log(`  Iterations: ${iterations}`);

    expect(avgTime).toBeGreaterThan(0);
  });
});
