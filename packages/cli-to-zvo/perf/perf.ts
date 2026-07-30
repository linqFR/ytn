import { performance } from "node:perf_hooks";

import { defineContract, pico } from "../src/editor.js";
import { execute } from "../src/index.js";

const createContractWithTargets = (targetCount: number) => {
  const targets: Record<string, Record<string, unknown>> = {};

  for (let i = 0; i < targetCount; i++) {
    targets[`action${i}`] = {
      cmd: "string",
      param: "string",
      flag: pico.boolean().optional(),
    };
  }

  return defineContract({
    name: "perf-test",
    description: "Performance test CLI",
    cli: {
      positionals: ["cmd", "param"],
      flags: {
        verbose: { short: "v", type: "string", desc: "Verbose mode" },
        flag: { short: "f", type: "boolean", desc: "Test flag" },
      },
    },
    targets,
    fallbacks: {
      help: { verbose: pico.string().optional() },
    },
  });
};

const testArgs = ["action42", "testparam", "--flag"];

// ---------------------------------------------------------------------------
// AOT-Compiled Routing Performance
// ---------------------------------------------------------------------------
console.log("=== AOT-Compiled Routing Performance ===");

const aotTargetCounts = [10, 50, 100, 200, 500];
const aotTimes: number[] = [];

for (const count of aotTargetCounts) {
  const contract = createContractWithTargets(count);

  for (let i = 0; i < 100; i++) {
    execute(contract, testArgs);
  }

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    execute(contract, testArgs);
  }
  const end = performance.now();

  const avgTime = (end - start) / 1000;
  aotTimes.push(avgTime);
  console.log(`AOT Targets: ${count}, Avg time: ${avgTime.toFixed(4)}ms`);
}

const aotBaseTime = aotTimes[0];
const aotMaxTime = Math.max(...aotTimes);
const aotGrowthFactor = aotMaxTime / aotBaseTime;
console.log(`AOT Growth factor: ${aotGrowthFactor.toFixed(2)}x`);

// AOT vs sequential simulation
const targetCount = 200;
const aotContract = createContractWithTargets(targetCount);

const aotStart = performance.now();
for (let i = 0; i < 10000; i++) {
  execute(aotContract, testArgs);
}
const aotEnd = performance.now();
const aotTime = aotEnd - aotStart;

const sequentialStart = performance.now();
for (let i = 0; i < 10000; i++) {
  for (let j = 0; j < targetCount; j++) {
    if (j === 42) break;
  }
}
const sequentialEnd = performance.now();
const sequentialTime = sequentialEnd - sequentialStart;

console.log(`AOT: ${aotTime.toFixed(2)}ms`);
console.log(`Sequential: ${sequentialTime.toFixed(2)}ms`);
console.log(`Speedup: ${(sequentialTime / aotTime).toFixed(2)}x`);

// AOT fallback routing
const aotFallbackContract = createContractWithTargets(100);
const fallbackArgs = ["--verbose", "debug"];

const fallbackStart = performance.now();
for (let i = 0; i < 1000; i++) {
  execute(aotFallbackContract, fallbackArgs);
}
const fallbackEnd = performance.now();
const aotFallbackAvg = (fallbackEnd - fallbackStart) / 1000;
console.log(`AOT Fallback routing avg time: ${aotFallbackAvg.toFixed(4)}ms`);

// AOT bitmask efficiency
const aotContracts = [10, 50, 100].map(createContractWithTargets);

aotContracts.forEach((contract, index) => {
  const targetCount = [10, 50, 100][index];
  const testCases = [
    ["action1", "param1"],
    ["action5", "param2", "--verbose", "debug"],
    ["action10", "param3", "--flag"],
    ["--verbose", "help"],
  ];

  testCases.forEach((args, caseIndex) => {
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      execute(contract, args);
    }
    const end = performance.now();

    const avgTime = (end - start) / 500;
    console.log(`AOT Targets: ${targetCount}, Case ${caseIndex + 1}: ${avgTime.toFixed(4)}ms`);
  });
});

// Compilation overhead vs runtime benefit
const compileStart = performance.now();
const compileContract = createContractWithTargets(100);
const compileEnd = performance.now();
const compileTime = compileEnd - compileStart;

const execStart = performance.now();
for (let i = 0; i < 1000; i++) {
  execute(compileContract, testArgs);
}
const execEnd = performance.now();
const execTime = execEnd - execStart;

console.log(`AOT Compilation time: ${compileTime.toFixed(2)}ms (one-time)`);
console.log(`AOT Execution time: ${(execTime / 1000).toFixed(4)}ms per call`);
console.log(`Break-even point: ${(compileTime / (execTime / 1000)).toFixed(0)} calls`);

// ---------------------------------------------------------------------------
// Routing Performance - O(1) Verification
// ---------------------------------------------------------------------------
console.log("\n=== Routing Performance - O(1) Verification ===");

const o1TargetCounts = [10, 50, 100, 200, 500];
const o1Times: number[] = [];

for (const count of o1TargetCounts) {
  const contract = createContractWithTargets(count);

  for (let i = 0; i < 100; i++) {
    execute(contract, testArgs);
  }

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    execute(contract, testArgs);
  }
  const end = performance.now();

  const avgTime = (end - start) / 1000;
  o1Times.push(avgTime);
  console.log(`Targets: ${count}, Avg time: ${avgTime.toFixed(4)}ms`);
}

const o1BaseTime = o1Times[0];
const o1MaxTime = Math.max(...o1Times);
const o1GrowthFactor = o1MaxTime / o1BaseTime;
console.log(`Growth factor: ${o1GrowthFactor.toFixed(2)}x`);

// Fallback
const o1FallbackContract = createContractWithTargets(100);
const o1FallbackStart = performance.now();
for (let i = 0; i < 1000; i++) {
  execute(o1FallbackContract, fallbackArgs);
}
const o1FallbackEnd = performance.now();
const o1FallbackAvg = (o1FallbackEnd - o1FallbackStart) / 1000;
console.log(`Fallback routing avg time: ${o1FallbackAvg.toFixed(4)}ms`);

// Bitmask efficiency
const o1Contracts = [10, 50, 100].map(createContractWithTargets);

o1Contracts.forEach((contract, index) => {
  const targetCount = [10, 50, 100][index];
  const testCases = [
    ["action1", "param1"],
    ["action5", "param2", "--verbose", "debug"],
    ["action10", "param3", "--flag"],
    ["--verbose", "help"],
  ];

  testCases.forEach((args, caseIndex) => {
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      execute(contract, args);
    }
    const end = performance.now();

    const avgTime = (end - start) / 500;
    console.log(`Targets: ${targetCount}, Case ${caseIndex + 1}: ${avgTime.toFixed(4)}ms`);
  });
});

// ---------------------------------------------------------------------------
// Pure Bitmask Routing Performance (O(1))
// ---------------------------------------------------------------------------
console.log("\n=== Pure Bitmask Routing Performance (O(1)) ===");

const onlyExecutionTimes: number[] = [];

for (const count of [10, 50, 100, 200, 500]) {
  const contract = createContractWithTargets(count);

  for (let i = 0; i < 100; i++) {
    execute(contract, testArgs);
  }

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    execute(contract, testArgs);
  }
  const end = performance.now();

  onlyExecutionTimes.push(end - start);
}

const onlyMaxTime = Math.max(...onlyExecutionTimes);
const onlyMinTime = Math.min(...onlyExecutionTimes);
const onlyGrowthFactor = onlyMaxTime / onlyMinTime;

console.log(`Execution times (ms): ${onlyExecutionTimes.map((t) => t.toFixed(4)).join(", ")}`);
console.log(`Growth factor: ${onlyGrowthFactor.toFixed(2)}x`);

const onlyContract = createContractWithTargets(100);
for (let i = 0; i < 100; i++) {
  execute(onlyContract, testArgs);
}

const onlyStart = performance.now();
for (let i = 0; i < 1000; i++) {
  execute(onlyContract, testArgs);
}
const onlyEnd = performance.now();
const onlyAvg = (onlyEnd - onlyStart) / 1000;
console.log(`Average execution time: ${onlyAvg.toFixed(6)}ms`);

// Pure Map lookup
const routingTable = new Map<number, string>();
for (let i = 0; i < 1000; i++) {
  routingTable.set(i, `route${i}`);
}

const keys: number[] = [];
for (let i = 0; i < 100; i++) {
  keys.push(Math.floor(Math.random() * 1000));
}

const mapStart = performance.now();
for (let i = 0; i < 10000; i++) {
  const key = keys[i % keys.length];
  routingTable.get(key);
}
const mapEnd = performance.now();
const mapAvg = (mapEnd - mapStart) / 10000;
console.log(`Pure Map lookup: ${mapAvg.toFixed(6)}ms per call`);

// ---------------------------------------------------------------------------
// Simple O(1) Routing Demonstration
// ---------------------------------------------------------------------------
console.log("\n=== Simple O(1) Routing Demonstration ===");

const tableSizes = [10, 100, 500, 1000];
const mapTimes: number[] = [];

tableSizes.forEach((size) => {
  const table = new Map<number, string>();
  for (let i = 0; i < size; i++) {
    table.set(i, `route${i}`);
  }

  const keys = Array.from({ length: 100 }, () => Math.floor(Math.random() * size));

  for (let i = 0; i < 100; i++) {
    const key = keys[i % keys.length];
    table.get(key);
  }

  const start = performance.now();
  for (let i = 0; i < 10000; i++) {
    const key = keys[i % keys.length];
    table.get(key);
  }
  const end = performance.now();

  const avgTime = (end - start) / 10000;
  mapTimes.push(avgTime);
  console.log(`Map size ${size}: ${avgTime.toFixed(6)}ms`);
});

const mapBaseTime = mapTimes[0];
const mapMaxTime = Math.max(...mapTimes);
const mapGrowthFactor = mapMaxTime / mapBaseTime;
console.log(`Map lookup growth factor: ${mapGrowthFactor.toFixed(2)}x`);

// Bitmask calculation
const argsToBitmask = (args: string[]) => {
  let bitmask = 0;
  if (args.includes("--flag")) bitmask |= 1 << 0;
  if (args.includes("--verbose")) bitmask |= 1 << 1;
  if (args.includes("action1")) bitmask |= 1 << 2;
  if (args.includes("action2")) bitmask |= 1 << 3;
  for (let i = 0; i < 20; i++) {
    if (args.includes(`--flag${i}`)) bitmask |= 1 << (4 + i);
  }
  return bitmask;
};

const bitmaskCases = [
  [],
  ["--flag"],
  ["--verbose"],
  ["action1"],
  ["--flag", "--verbose", "action1"],
  ["--flag", "--verbose", "action1", "--flag0", "--flag5", "--flag10"],
];

const bitmaskTimes: number[] = [];

bitmaskCases.forEach((args, index) => {
  for (let i = 0; i < 1000; i++) {
    argsToBitmask(args);
  }

  const start = performance.now();
  for (let i = 0; i < 10000; i++) {
    argsToBitmask(args);
  }
  const end = performance.now();

  const avgTime = (end - start) / 10000;
  bitmaskTimes.push(avgTime);
  console.log(`Bitmask calc case ${index + 1}: ${avgTime.toFixed(6)}ms`);
});

// Routing vs validation overhead
const pureRouting = (args: string[]) => {
  const table = new Map<number, string>();
  table.set(1, "route1");
  table.set(3, "route2");
  table.set(7, "route3");

  let bitmask = 0;
  if (args.includes("--flag")) bitmask |= 1 << 0;
  if (args.includes("--verbose")) bitmask |= 1 << 1;
  if (args.includes("action")) bitmask |= 1 << 2;

  return table.get(bitmask);
};

const fullValidation = (args: string[]) => {
  const route = pureRouting(args);

  if (args.length > 10) return null;
  if (args.some((arg) => arg.length > 50)) return null;
  if (args.some((arg) => !/^[a-zA-Z0-9\-]+$/.test(arg))) return null;

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const value = arg.substring(2);
      if (value.length > 20) return null;
    }
  }

  return route;
};

const testRoutingArgs = ["--flag", "--verbose", "action"];

const routingStart2 = performance.now();
for (let i = 0; i < 10000; i++) {
  pureRouting(testRoutingArgs);
}
const routingEnd2 = performance.now();
const routingTime2 = (routingEnd2 - routingStart2) / 10000;

const validationStart2 = performance.now();
for (let i = 0; i < 10000; i++) {
  fullValidation(testRoutingArgs);
}
const validationEnd2 = performance.now();
const validationTime2 = (validationEnd2 - validationStart2) / 10000;

console.log(`Pure routing: ${routingTime2.toFixed(6)}ms`);
console.log(`Full validation: ${validationTime2.toFixed(6)}ms`);
console.log(`Validation overhead: ${(validationTime2 / routingTime2).toFixed(1)}x`);

// Complexity scaling
const complexityTimes: number[] = [];

[10, 50, 100, 500].forEach((complexity) => {
  const table = new Map<number, string>();
  for (let i = 0; i < complexity; i++) {
    table.set(i, `route${i}`);
  }

  const complexBitmask = (args: string[]) => {
    let bitmask = 0;
    for (let i = 0; i < complexity / 10; i++) {
      if (args.includes(`--flag${i}`)) bitmask |= 1 << i;
    }
    return bitmask;
  };

  const complexArgs = [`--flag${Math.floor(complexity / 20)}`];

  for (let i = 0; i < 100; i++) {
    const bitmask = complexBitmask(complexArgs);
    table.get(bitmask);
  }

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    const bitmask = complexBitmask(complexArgs);
    table.get(bitmask);
  }
  const end = performance.now();

  const avgTime = (end - start) / 1000;
  complexityTimes.push(avgTime);
  console.log(`Complexity ${complexity}: ${avgTime.toFixed(6)}ms`);
});

const complexityBaseTime = complexityTimes[0];
const complexityMaxTime = Math.max(...complexityTimes);
const complexityGrowthFactor = complexityMaxTime / complexityBaseTime;
console.log(`Complexity growth factor: ${complexityGrowthFactor.toFixed(2)}x`);
