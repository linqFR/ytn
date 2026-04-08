import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileContractToFile } from "../compiler/compiler.api.js";
import { defineContract } from "../editor/contract-create.js";
import { IProcessedContract } from "../index.js";
import { tsHandler } from "../launcher/czvo-launcher.js";

/**
 * @constant AOT_CONTRACT
 * @description Standard CLI contract for CZVO-powered AOT compilers.
 * All compilers using the Standard Launcher will share this grammar.
 */
export const AOT_CONTRACT: IProcessedContract = defineContract({
  name: "CZVO AOT Compiler",
  description: "Standard YTN AOT Compiler Engine for CZVO.",
  cli: {
    positionals: ["source-file"],
    flags: {
      out: {
        short: "o",
        type: "string",
        desc: "Output artifact path (.js, .json, .ts)",
      },
    },
  },
  targets: {
    compile: {
      sourceFile: "string",
      out: "string?",
    },
  },
});

/**
 * @constant AOT_HANDLERS
 * @description Action handlers for the AOT Compiler.
 */
export const AOT_HANDLERS: tsHandler = {
  compile: async (data: any) => {
    const inputPath = resolve(process.cwd(), data.sourceFile);
    const outPath = resolve(process.cwd(), data.out || "contract.compiled.js");

    try {
      // Dynamic import to load the live source contract
      const module = await import(pathToFileURL(inputPath).href);
      const rawContract =
        module.default || module.contract || module.spec || module.workflow;

      if (!rawContract || typeof rawContract !== "object") {
        throw new Error(
          `Could not find a valid contract export in ${data.sourceFile}`,
        );
      }

      console.log(`[CZVO] Compiling ${data.sourceFile}...`);
      compileContractToFile(rawContract, outPath);
      console.log(`[CZVO] Success! Output saved to ${outPath}`);
    } catch (err) {
      console.error(
        `[CZVO] AOT Error:`,
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    }
  },
};
