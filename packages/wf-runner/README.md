# @ytn/wf

High-performance Agentic Workflow Runner based on Zod v4. Orchestrate workflows and state machines with strict type safety at every step.

## Table of Contents
- [Introduction](#introduction)
- [Installation](#installation)
- [How To (Usage Guide)](#how-to-usage-guide)
  - [1. Define Your Workflow Specification](#1-define-your-workflow-specification)
  - [2. Instantiation and Execution](#2-instantiation-and-execution)
- [API Reference](#api-reference)

## Introduction

`@ytn/wf` allows you to define a workflow graph (a state machine) where:
- Each step is strictly validated by a Zod schema.
- Business logic is executed within a `gate` function.
- Step transitions are handled by sending signals to the next step, preventing anarchic mutations.
- Infinite loops are prevented by a configurable cycle limit (`maxSteps`).

## Installation

Within a YTN monorepo / npm workspaces environment:
```bash
npm install @ytn/wf
```

## How To (Usage Guide)

### 1. Define Your Workflow Specification

A workflow is a key-value dictionary object where each key represents a step.
Each step must implement:
- `schema`: A Zod schema validating the expected input data for this step.
- `on`: The routing table (`Record<string, string>`) mapping a "signal" to the next step's ID.
- `gate`: The function containing the logic (asynchronous or synchronous) for the step.

> [!IMPORTANT]
> The `gate` function receives the validated data as the first parameter, and a `tools` object as the second. You **must** use `tools.send[your_signal](data)` to transition to the next step.

```typescript
import { z } from "zod";
import { WFRunner } from "@ytn/wf";

const workflowSpec = {
  // Initial step
  init: {
    schema: z.object({ userInput: z.string() }),
    on: {
      valid: "processTask",
      invalid: "init", // Loop back capability
    },
    gate: async (data, tools) => {
      if (data.userInput.length > 3) {
        return tools.send.valid({ text: data.userInput });
      }
      // Loop back to the init step with data
      return tools.send.invalid({ userInput: "" }); 
    }
  },

  // Next step
  processTask: {
    schema: z.object({ text: z.string() }),
    on: {}, // No specific routing, we will use 'end'
    gate: async (data, tools) => {
      const processed = `Processed: ${data.text}`;
      
      // 'end' is a magical reserved action of the tools object
      // used to terminate the workflow and return the final result.
      return tools.send.end({ result: processed });
    }
  }
};
```

### 2. Instantiation and Execution

Once your specification is written, pass it to the `WFRunner` instance.

```typescript
// Runner initialization
const runner = new WFRunner(workflowSpec, {
  init: "init",   // Starting step key (Default: "init")
  maxSteps: 20    // Security limit against infinite loops (Default: 20)
});

async function main() {
  const result = await runner.run({ userInput: "Hello World" });
  console.log(result); // { result: "Processed: Hello World" }
}

main();
```

## API Reference

### `new WFRunner(def, options)`

- `def` *(Object)*: The object describing the initial configuration of the graph steps.
- `options` *(Object)*:
  - `init` *(string)*: The ID of the step where the workflow begins. (Default: `"init"`).
  - `maxSteps` *(number)*: The maximum number of `gate` transitions before an execution limit error is thrown. Useful for preventing infinite loops. (Default: `20`).

### `runner.run(data, parseOptions?)`

- `data` *(any)*: The input payload that will be injected and validated by the initial step (`init`).
- `parseOptions` *(object)*: Optional native Zod options to pass during validation (`{ reportInput: boolean }`, etc.).
- **Returns**: A promise resolving with the payload passed to `tools.send.end(payload)`.
