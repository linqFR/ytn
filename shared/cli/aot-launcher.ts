import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { existsSync } from "../dirpath/fs-ops.js";

/**
 * @interface ICompilerLauncherOptions
 * @description Configuration for the AOT compiler launcher.
 */
export interface ICompilerLauncherOptions {
  /** The human-readable name of the compiler (e.g., 'CZVO') */
  name: string;
  /** The official command name (e.g., 'czvo-compile') */
  command: string;
  /** Default output filename if not specified by user. */
  defaultOut: string;
  /** The actual compilation function to execute. */
  compile: (input: any, outPath: string) => void | Promise<void>;
}

/**
 * @function launchAotCompiler
 * @description Factorized entry point for YTN AOT compilers.
 * Handles CLI argument parsing, file resolution, dynamic module loading,
 * and standard error reporting.
 *
 * @param {ICompilerLauncherOptions} opts - Launcher configuration.
 */
export async function launchAotCompiler(
  opts: ICompilerLauncherOptions,
): Promise<void> {
  const { positionals, values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      out: { type: "string", short: "o" },
    },
    allowPositionals: true,
  });

  if (positionals.length === 0) {
    console.error(
      `Usage: ${opts.command} <input-file.ts|js> --out <output-file>`,
    );
    process.exit(1);
  }

  const inputPath = resolve(process.cwd(), positionals[0]);
  const outPath = resolve(
    process.cwd(),
    (values.out as string) || opts.defaultOut,
  );

  if (!existsSync(inputPath)) {
    console.error(`[${opts.name}] Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`[${opts.name}] Loading source from ${inputPath}...`);

  try {
    // Dynamic import to handle both JS and TS (if runtime allows)
    const source = await import(`file://${inputPath}`);

    // Auto-detect the exported configuration (Priority: default > named 'contract'/'spec' > first export)
    const payload =
      source.default ||
      source.contract ||
      source.spec ||
      source.workflow ||
      Object.values(source)[0];

    if (!payload || typeof payload !== "object") {
      console.error(
        `[${opts.name}] Error: Could not find a valid exported configuration in ${inputPath}`,
      );
      process.exit(1);
    }

    console.log(`[${opts.name}] Compiling to ${outPath}...`);
    await opts.compile(payload, outPath);
    console.log(`[${opts.name}] Success! Compiled output saved.`);
  } catch (err) {
    console.error(`[${opts.name}] Compilation failed:`, err);
    process.exit(1);
  }
}
