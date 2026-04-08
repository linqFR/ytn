#!/usr/bin/env node
import { launchCzvo } from "./launcher/czvo-launcher.js";
import { AOT_CONTRACT, AOT_HANDLERS } from "./config/aot.js";

/**
 * CZVO AOT COMPILER (New Self-Hosted Version)
 */
launchCzvo(
  AOT_CONTRACT,
  AOT_HANDLERS,
);

/**
 * CZVO AOT COMPILER (Original Logic - Commented)
 * -------------------------------------------
 * import { launchAotCompiler } from "@ytn/shared/cli/aot-launcher.js";
 * import { compileContractToFile } from "./compiler/compiler.api.js";
 * 
 * launchAotCompiler({
 *   name: "CZVO",
 *   command: "czvo-compile",
 *   defaultOut: "contract.compiled.js",
 *   compile: (contract, outPath) => {
 *     compileContractToFile(contract as any, outPath);
 *   },
 * });
 */
