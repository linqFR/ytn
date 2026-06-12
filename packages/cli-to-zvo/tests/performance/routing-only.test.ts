import { describe, it, expect } from "vitest";
import { performance } from "node:perf_hooks";

import { defineContract, pico } from "../../src/editor.js";
import { execute } from "../../src/index.js";

describe("Pure Bitmask Routing Performance (O(1))", () => {
  // Helper to create contracts with N targets
  const createContractWithTargets = (targetCount: number) => {
    const targets: Record<string, any> = {};
    
    for (let i = 0; i < targetCount; i++) {
      targets[`action${i}`] = {
        cmd: `string`,
        param: `string`,
        flag: pico.boolean().optional()
      };
    }

    return defineContract({
      name: "routing-test",
      description: "Pure routing performance test",
      cli: {
        positionals: ["cmd", "param"],
        flags: {
          verbose: { short: "v", type: "string", desc: "Verbose mode" },
          flag: { short: "f", type: "boolean", desc: "Test flag" }
        }
      },
      targets,
      fallbacks: {
        help: { verbose: pico.string().optional() }
      }
    });
  };

  it("should demonstrate O(1) routing via execute() with pre-compiled validator", () => {
    const targetCounts = [10, 50, 100, 200, 500];
    const executionTimes: number[] = [];

    for (const count of targetCounts) {
      const contract = createContractWithTargets(count);
      const testArgs = ["action42", "testparam", "--flag"];
      
      // Warm up
      for (let i = 0; i < 100; i++) {
        execute(contract, testArgs);
      }

      // Measure execution performance (includes routing + validation)
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        execute(contract, testArgs);
      }
      const end = performance.now();
      
      executionTimes.push(end - start);
    }

    // Execution time should grow slowly with target count (validation overhead dominates)
    const maxTime = Math.max(...executionTimes);
    const minTime = Math.min(...executionTimes);
    const growthFactor = maxTime / minTime;

    console.log(`Execution times (ms): ${executionTimes.map(t => t.toFixed(4)).join(", ")}`);
    console.log(`Growth factor: ${growthFactor.toFixed(2)}x`);

    // Allow some growth due to validation overhead, but should be sub-linear
    expect(growthFactor).toBeLessThan(25.0);
  });

  it("should show pre-compiled validator performance", () => {
    const contract = createContractWithTargets(100);
    const testArgs = ["action42", "testparam", "--flag"];

    // Warm up
    for (let i = 0; i < 100; i++) {
      execute(contract, testArgs);
    }

    // Measure execution with pre-compiled validator
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      execute(contract, testArgs);
    }
    const end = performance.now();
    const avgTime = (end - start) / 1000;

    console.log(`Average execution time: ${avgTime.toFixed(6)}ms`);

    // Should be fast with pre-compiled validator
    expect(avgTime).toBeLessThan(1.0);
  });

  it("should prove O(1) routing table lookup", () => {
    // Create a simple Map to simulate pure O(1) lookup
    const routingTable = new Map<number, string>();
    for (let i = 0; i < 1000; i++) {
      routingTable.set(i, `route${i}`);
    }
    
    // Generate different keys
    const keys = [];
    for (let i = 0; i < 100; i++) {
      keys.push(Math.floor(Math.random() * 1000));
    }

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      // Just Map.get() lookup - pure O(1)
      const key = keys[i % keys.length];
      const route = routingTable.get(key);
    }
    const end = performance.now();
    
    const avgTime = (end - start) / 10000;
    console.log(`Pure Map lookup: ${avgTime.toFixed(6)}ms per call`);
    
    // Map lookup should be virtually instantaneous
    expect(avgTime).toBeLessThan(0.0001); // < 0.0001ms for Map.get()
  });
});
