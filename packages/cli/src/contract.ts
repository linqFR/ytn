import { dna } from "@ytrynot/dna";
import { DnaLiteral, DnaCliUnion, DnaObject } from "@ytrynot/dna/core";
import { toParseArgsConfig } from "@ytrynot/dna/introspect";
import { parseArgs as nodeParseArgs } from "node:util";

import { buildPipeline } from "./preprocess.js";
import type { $InjectedRoutesRecord } from "./routeId.js";
import { ROUTE_ID_KEY } from "./routeId.js";
import type {
  ICliMeta,
  IContract,
  IContractOptions,
  IFlagMap,
  IProcessedContract,
  OParseArgsConfig,
  OPositionalMeta,
} from "./types/contract.types.js";

/**
 * Reads `.meta().cli` from a DNA object (route or field).
 * Returns `undefined` if no meta or no `cli` key.
 */
export function getCliMeta(schema: { meta?: () => unknown }): ICliMeta | undefined {
  if (typeof schema.meta !== "function") return undefined;
  const meta = schema.meta() as { cli?: ICliMeta } | Record<string, never>;
  if (!meta || typeof meta !== "object" || !("cli" in meta)) return undefined;
  const cli = (meta as { cli: ICliMeta }).cli;
  // flag: true implies hidden: "cmd" — a flag interceptor is never a positional command
  if (cli.flag && !cli.hidden) {
    return { ...cli, hidden: "cmd" };
  }
  return cli;
}

export function createContract<
  T extends Record<string, DnaObject>,
>(
  contract: IContract<T>,
  options?: IContractOptions,
): IProcessedContract<T> {
  const entries = Object.entries(contract.routes) as [string, T[keyof T]][];
  const routeValues = Object.values(contract.routes) as T[keyof T][];

  if (entries.length === 0) {
    throw new Error(
      `createContract: "routes" must contain at least one route.`,
    );
  }

  // Read `.meta().cli` from routes and fields to build
  // flagMap (flag → subcommand) and parseArgsConfig.options automatically.
  // Also validates cmd presence on each route — routeId is the record key,
  // no separate routeId metadata is needed.
  const flagMap: IFlagMap = {};
  const interceptorOptions: Record<string, { type: "boolean"; multiple: boolean; short?: string }> = {};
  const shortOverrides: Record<string, string> = {};

  for (const route of routeValues) {
    const cmdField = route.shape.cmd;
    if (!(cmdField instanceof DnaLiteral)) {
      throw new Error(
        `createContract: route is missing required "cmd: dna.literal(...)" field. ` +
          `Found keys: [${Object.keys(route.shape).join(", ")}]`,
      );
    }

    const routeMeta = getCliMeta(route);

    // Route-level: flag interceptor
    if (routeMeta?.flag === true) {
      const cmdValue = cmdField.value as string;
      flagMap[cmdValue] = cmdValue;
      interceptorOptions[cmdValue] = {
        type: "boolean",
        multiple: false,
        ...(routeMeta.short !== undefined ? { short: routeMeta.short } : {}),
      };
    }

    // Field-level: short overrides + flag validation
    for (const fieldName of Object.keys(route.shape)) {
      if (fieldName === "cmd") continue; // cmd is a positional, not an option

      const field = route.shape[fieldName];
      const fieldMeta = getCliMeta(field);

      if (fieldMeta?.flag === true) {
        throw new Error(
          `createContract: \`cli: { flag: true }\` is only valid on a route, not on field "${fieldName}". ` +
            `Use \`cli: { flag: true }\` on the route object to declare a flag interceptor.`,
        );
      }

      if (fieldMeta?.short !== undefined) {
        shortOverrides[fieldName] = fieldMeta.short;
      }
    }
  }

  // Build cliUnion on CLEAN routes (no \x00ID) first,
  // so toParseArgsConfig does not see the internal route key.
  const cliUnionClean = dna.cliUnion(routeValues);

  // toParseArgsConfig is standalone: positionals override goes here,
  // not into dna.cliUnion. ignoreKeys not needed because clean routes have no \x00ID.
  const dnaConfig = toParseArgsConfig(cliUnionClean, {
    strict: contract.cli?.strict,
    ...(contract.cli?.positionals ? { positionals: contract.cli.positionals } : {}),
  });

  // Build options: DNA config → add shorts from .meta().cli → add interceptor flags
  const mergedOptions: OParseArgsConfig["options"] = {};
  for (const [name, opt] of Object.entries(dnaConfig.options)) {
    if (name === ROUTE_ID_KEY) continue; // defensive: clean routes should not have \x00ID
    mergedOptions[name] = {
      ...opt,
      ...(shortOverrides[name] !== undefined ? { short: shortOverrides[name] } : {}),
    };
  }
  // Add interceptor flags (from .meta().cli.flag on routes)
  for (const [name, opt] of Object.entries(interceptorOptions)) {
    mergedOptions[name] = opt;
  }

  const parseArgsConfig: OParseArgsConfig = options?.parseArgsConfig ?? {
    ...dnaConfig,
    allowNegative: contract.cli?.allowNegative,
    options: mergedOptions,
  };

  // Validate: every flagMap key must have a corresponding option in parseArgsConfig
  for (const flagName of Object.keys(flagMap)) {
    if (!(flagName in parseArgsConfig.options)) {
      throw new Error(
        `createContract: flagMap key "${flagName}" has no corresponding option in parseArgsConfig. ` +
          `Ensure the route declares \`cli: { flag: true }\` in its .meta().`,
      );
    }
  }

  // Inject \x00ID via DnaObject.apply — routeId is the record key.
  // DNA transports \x00ID opaquely; the extractStep (preprocess.ts) strips it
  // into { route, payload }.
  // CAST: .map() returns DnaObject[]; $InjectedRoutesRecord<T>[keyof T][] is the
  // record-mapped injected type. TS cannot verify the array-to-record correspondence.
  const injectedRoutes = entries.map(([routeId, dnaObj]) =>
    dnaObj.apply((schema) =>
      schema.extend({ [ROUTE_ID_KEY]: dna.string().default(routeId) }),
    ),
  ) as unknown as $InjectedRoutesRecord<T>[keyof T][];

  // CAST: injectedRoutes is DnaObject[] at runtime; the injected type includes
  // \x00ID per route, matching buildPipeline's constraint.
  const cliUnion = dna.cliUnion(injectedRoutes) as unknown as DnaCliUnion<
    $InjectedRoutesRecord<T>[keyof T][]
  >;

  // positionalMeta — use provided or compute from effective positionals.
  // Positionals override goes into toParseArgsConfig, NOT dna.cliUnion,
  // so cliUnion.positionals only contains DETECTED positionals (discriminator).
  // Effective positionals = override (if provided) or detected.
  // For the `multiple` check, call toParseArgsConfig with positionals:[] so all
  // declared keys appear in options (positional keys are normally excluded).
  let positionalMeta: OPositionalMeta[];
  if (options?.positionalMeta) {
    positionalMeta = options.positionalMeta;
  } else {
    const effectivePositionals = contract.cli?.positionals ?? cliUnionClean.positionals;
    const configNoPos = toParseArgsConfig(cliUnionClean, {
      positionals: [],
      ignoreKeys: [ROUTE_ID_KEY],
    });
    positionalMeta = effectivePositionals.map((name) => ({
      name,
      variadic: configNoPos.options[name]?.multiple ?? false,
    }));
  }

  // Pipeline built in preprocess.ts — isolated for clarity.
  // Only 1 external: parseArgs. Config objects are DNA defaults (inlined by toJS).
  const pipeline = buildPipeline(cliUnion, parseArgsConfig, positionalMeta, flagMap);

  // 1 external: parseArgs only
  // parseArgsConfig, positionalMeta, flagMap are DNA defaults (inlined)
  const externals: Record<string, unknown> = {
    parseArgs: nodeParseArgs,
  };

  return {
    name: contract.name,
    description: contract.description,
    pipeline,
    cliUnion,
    routes: contract.routes,
    parseArgsConfig,
    positionalMeta,
    externals,
    allowNegative: contract.cli?.allowNegative,
    flagMap,
  };
}
