import type { DnaObject } from "@ytrynot/dna";
import { dna } from "@ytrynot/dna";
import { DnaLiteral } from "@ytrynot/dna/core";
import { parseArgs as nodeParseArgs } from "node:util";

import { ROUTE_ID_KEY } from "./constants.js";
import { buildPipeline } from "./preprocess.js";
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

/**
 * Extracts the `cmd` literal value from a route (e.g. `dna.literal("build")` â†’ `"build"`).
 * Used to build the `flagMap` entry for flag-interceptor routes.
 */
function getCmdValue(route: DnaObject): string | undefined {
  const cmdField = route.shape.cmd;
  if (cmdField instanceof DnaLiteral) {
    return cmdField.value as string;
  }
  return undefined;
}

export function createContract(
  contract: IContract,
  options?: IContractOptions,
): IProcessedContract {
  const allRoutes = contract.fallbacks
    ? [...contract.targets, ...contract.fallbacks]
    : [...contract.targets];

  if (allRoutes.length === 0) {
    throw new Error(
      `createContract: "targets" must contain at least one route.`,
    );
  }

  // Validate cmd presence and read routeId from .meta().cli
  for (const route of allRoutes) {
    const cmdField = route.shape.cmd;
    if (!(cmdField instanceof DnaLiteral)) {
      throw new Error(
        `createContract: route is missing required "cmd: dna.literal(...)" field. ` +
          `Found keys: [${Object.keys(route.shape).join(", ")}]`,
      );
    }
    const routeMeta = getCliMeta(route);
    if (!routeMeta?.routeId) {
      throw new Error(
        `createContract: route with cmd "${cmdField.value}" is missing \`cli: { routeId: "..." }\` in its .meta(). ` +
          `Example: .meta({ cli: { routeId: "${cmdField.value}" } })`,
      );
    }
  }

  // DEC-0026: Read `.meta().cli` from routes and fields to build
  // flagMap (flag â†’ subcommand) and parseArgsConfig.options automatically.
  // DEC-0027: Read routeId from .meta().cli, inject \x00ID via apply.
  const flagMap: IFlagMap = {};
  const interceptorOptions: Record<string, { type: "boolean"; multiple: boolean; short?: string }> = {};
  const shortOverrides: Record<string, string> = {};

  for (const route of allRoutes) {
    const routeMeta = getCliMeta(route);

    // Route-level: flag interceptor
    if (routeMeta?.flag === true) {
      const cmdValue = getCmdValue(route);
      if (cmdValue === undefined) {
        throw new Error(
          `createContract: route with \`cli: { flag: true }\` must have a \`cmd: dna.literal(...)\` field. ` +
            `Could not extract cmd value from route.`,
        );
      }
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

  // DEC-0027: Inject \x00ID via apply from .meta().cli.routeId
  const injectedRoutes = allRoutes.map((route) =>
    route.apply((schema) => {
      const meta = getCliMeta(schema);
      const routeId = meta?.routeId;
      if (!routeId) {
        throw new Error(
          `createContract: route is missing \`cli: { routeId: "..." }\` in its .meta().`,
        );
      }
      return schema.extend({ [ROUTE_ID_KEY]: dna.string().default(routeId) });
    }),
  );

  const cliUnion = dna.cliUnion(
    injectedRoutes,
    contract.cli?.positionals
      ? { positionals: contract.cli.positionals }
      : undefined,
  );

  // parseArgsConfig â€” build from DNA config + meta-derived flags
  const dnaConfig = cliUnion.toParseArgsConfig({ strict: contract.cli?.strict });

  // Build options: DNA config â†’ add shorts from .meta().cli â†’ add interceptor flags â†’ filter \x00ID
  const mergedOptions: OParseArgsConfig["options"] = {};
  for (const [name, opt] of Object.entries(dnaConfig.options)) {
    if (name === ROUTE_ID_KEY) continue; // filter \x00ID (internal, not a user flag)
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

  // positionalMeta â€” use provided or compute via no-pos technique
  let positionalMeta: OPositionalMeta[];
  if (options?.positionalMeta) {
    positionalMeta = options.positionalMeta;
  } else {
    const cliNoPos = dna.cliUnion(
      injectedRoutes,
    );
    const configNoPos = cliNoPos.toParseArgsConfig();
    positionalMeta = cliUnion.positionals.map((name) => ({
      name,
      variadic: configNoPos.options[name]?.multiple ?? false,
    }));
  }

  // DEC-0027: Pipeline built in preprocess.ts — isolated for clarity.
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
    routes: allRoutes,
    parseArgsConfig,
    positionalMeta,
    externals,
    allowNegative: contract.cli?.allowNegative,
    flagMap,
  };
}

