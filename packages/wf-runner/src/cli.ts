#!/usr/bin/env node
import { compileWorkflowToFile } from "./core.js";
import * as path from "node:path";

/**
 * @file cli.ts
 * @description Command-line entry point for WF-Runner tools.
 */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "compile") {
    const inputPath = args[1];
    const outputPath = args[2] || inputPath.replace(/\.ts$/, ".compiled.ts");

    if (!inputPath) {
      console.error("Usage: wf-compile compile <inputPath> [outputPath]");
      process.exit(1);
    }

    try {
      const absoluteInput = path.resolve(process.cwd(), inputPath);
      const absoluteOutput = path.resolve(process.cwd(), outputPath);

      // In a real scenario, we'd dynamic import the inputPath 
      // but for this CLI to work as a standalone tool, we use ts-node or similar in the background 
      // or assume it's running in an environment where it can import it.
      const module = await import(absoluteInput);
      const workflow = module.default || module.workflow;

      if (!workflow) {
        throw new Error(`No workflow definition found in ${inputPath}`);
      }

      compileWorkflowToFile(workflow, absoluteOutput);
      console.log(`[WF-Runner] Compiled workflow to: ${outputPath}`);
    } catch (err: any) {
      console.error(`[WF-Runner] Compilation failed: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log("WF-Runner CLI");
    console.log("Usage: wf-compile compile <inputPath> [outputPath]");
  }
}

main();
