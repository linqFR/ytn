import type {
  DnaObject,
  DnaCliUnion,
  DnaSomeType,
  DnaType,
} from "@ytrynot/dna";

// ============================================================
// parseArgs config
// ============================================================

export interface OParseArgsConfig {
  allowPositionals: true;
  strict: boolean;
  allowNegative?: boolean;
  options: Record<string, { type: "string" | "boolean"; multiple: boolean; short?: string }>;
}

// ============================================================
// Positional metadata
// ============================================================

export interface OPositionalMeta {
  name: string;
  variadic: boolean;
}

// ============================================================
// CLI config
// ============================================================

export interface ICliOptions {
  positionals?: string[];
  strict?: boolean;
  allowNegative?: boolean;
}

// ============================================================
// CLI meta — structure for `.meta({ cli: ... })` on DNA schemas
// ============================================================

/**
 * Structure expected in `.meta().cli` on DNA schemas.
 *
 * - On a **route** (DnaObject): `{ flag: true, short?: string }` declares
 *   the route as accessible via `--<cmdValue>` (flag interceptor).
 *   `short` adds a short alias (e.g. `-h` for `--help`).
 * - On a **field**: `{ short?: string }` adds a short alias for
 *   the corresponding parseArgs option.
 * - `flag: true` on a **field** is forbidden (semantically incorrect).
 */
export interface ICliMeta {
  /** Route-level: marks the route as accessible via `--<cmdValue>`. Implies `hidden: "cmd"`. */
  flag?: boolean;
  /** Short alias for the parseArgs option (e.g. `"h"` for `--help`). */
  short?: string;
  /** Hide the route from help output. `"cmd"` = hide from Commands, `"flag"` = hide from Options, `"all"` = hide everywhere. Automatically `"cmd"` when `flag: true`. */
  hidden?: "cmd" | "flag" | "all";
  /** Route-level: internal route identifier, injected as `\x00ID` by `apply`. */
  routeId?: string;
}

// ============================================================
// Flag map — flag name → subcommand (for flag→cmd routing)
// ============================================================

/**
 * Flag → subcommand mapping (e.g. `{ help: "help", version: "version" }`).
 * Keys are parseArgs option names (not `--help`, but `help`).
 * Values are subcommand names routed to after parseArgs.
 * Built automatically by `createContract()` from `.meta().cli.flag` on routes.
 */
export type IFlagMap = Record<string, string>;

// ============================================================
// IContract — user input
// ============================================================

export interface IContract {
  name: string;
  description: string;
  targets: readonly [DnaObject, ...DnaObject[]];
  fallbacks?: readonly DnaObject[];
  cli?: ICliOptions;
}

// ============================================================
// IContractOptions — options for createContract()
// ============================================================

export interface IContractOptions {
  parseArgsConfig?: OParseArgsConfig;
  positionalMeta?: OPositionalMeta[];
}

// ============================================================
// Handler result — handlers return {success, data?} | {success, error?}
// ============================================================

export type OHandlerResult =
  | { success: true; data: unknown }
  | { success: false; error: string };


// ============================================================
// Formatted result — couche 3 output
// ============================================================

export interface OFormattedResult {
  exit: number;
  message: string;
}

// ============================================================
// IProcessedContract — output of createContract() (couche 1)
// ============================================================

export interface IProcessedContract {
  name: string;
  description: string;
  pipeline: DnaType<{ route: string; payload: Record<string, unknown> }>;
  cliUnion: DnaCliUnion<readonly DnaSomeType[]>;
  routes: readonly DnaObject[];
  parseArgsConfig: OParseArgsConfig;
  positionalMeta: OPositionalMeta[];
  externals: Record<string, unknown>;
  allowNegative?: boolean;
  /** Flag → subcommand mapping, built automatically from `.meta().cli.flag` on routes. */
  flagMap: IFlagMap;
}

// ============================================================
// IExecutableContract — output of executeContract() (couche 2)
// ============================================================

export interface IExecutableContract {
  name: string;
  description: string;
  pipeline: DnaType<OHandlerResult>;
  externals: Record<string, unknown>;
  handlers: IHandlers;
}

// ============================================================
// IFormattedContract — output of cliFactory() (couche 3)
// ============================================================

export interface IFormattedContract {
  name: string;
  description: string;
  pipeline: DnaType<OFormattedResult>;
  externals: Record<string, unknown>;
  handlers: IHandlers;
  formatter: FormatterFn;
}

// ============================================================
// OExecuteResult
// ============================================================

export interface CliError {
  message: string;
  path: string;
  input: unknown;
}

/**
 * Minimal shape actually consumed by `formatCliError` — `message` is
 * optional (defaults to `"Unknown error"`) and `input` is not read. This is
 * narrower than `CliError` on purpose: the formatter shouldn't require a
 * field it never uses.
 */
export interface tsCliErrorInput {
  message?: string;
  path: string;
}

export type OExecuteResult =
  | { success: true; route: string; payload: Record<string, unknown> }
  | { success: false; errors: CliError[] };

// ============================================================
// IHandlers
// ============================================================

export type RouteHandler = (payload: Record<string, unknown>) => OHandlerResult | Promise<OHandlerResult>;
export type FormatterFn = (result: OHandlerResult) => OFormattedResult;

export type IHandlers = {
  [route: string]: RouteHandler | undefined;
};
