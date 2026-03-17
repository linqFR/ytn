import { z, ZodType } from "zod";
import { CliType, CZVO, VALID_CLI_TYPES } from "./cli-types.js";
import { zArgName, zSnakeCaseKey } from "./zod-tbx.js";

/**
 * @interface CliDef
 * @description Global definition for an argument or flag configuration.
 */
export interface CliDef {
  /** Type identifier (string or CZVO schema) */
  type: CliType;
  /** Human-readable explanation */
  description: string;
  /** Label for help (e.g., "path" results in "--file <path>") */
  arg_name?: string;
  /** long and short flag names (only for options) */
  flags?: {
    long: string;
    short: string;
  };
  /** Transformation map: input -> value */
  map?: Record<string, any>;
}

/**
 * @type CliFlagValue
 * @description Allowed values for flags in target definitions.
 */
type CliFlagValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | string[]
  | { optional: boolean };

/**
 * @interface CliTarget
 * @description Configuration for a specific subcommand.
 */
export interface CliTarget<TDef extends string = string> {
  /** Optional subcommand description */
  description?: string;
  /** List of keys from 'def' to be treated as positionals */
  positionals?: TDef[];
  /** Flags specific to this target, constrained by keys in 'def' */
  flags?: Partial<Record<TDef, CliFlagValue>>;
}

/**
 * @interface CliContract
 * @description The root contract structure defining the entire CLI API.
 */
export interface CliContract<TDef extends string = string> {
  /** CLI name */
  name: string;
  /** General description */
  description: string;
  /** App version */
  version?: string;
  /** Dictionary of global type/flag definitions */
  def: Record<TDef, CliDef>;
  /** Subcommands (targets) constrained by definitions keys */
  targets: Record<string, CliTarget<TDef>>;
}

/**
 * @interface CliHelpArg
 * @description Structured metadata for an argument or flag for help generation.
 */
export interface CliHelpArg {
  name: string;
  arg_name?: string;
  usages?: string[];
  position?: number;
  type: string;
  description: string;
}

/**
 * @interface CliHelpCase
 * @description A specific command usage scenario.
 */
export interface CliHelpCase {
  command: string;
  description: string;
}

/**
 * @interface CliHelpData
 * @description Full structured help data for the CLI, ready for the help formatter.
 */
export interface CliHelpData {
  name: string;
  description: string;
  usage_cases: CliHelpCase[];
  arguments: CliHelpArg[];
}

/**
 * @constant CliContractSchema
 * @description Fail-Fast Zod schema for contract validation at runtime.
 */
export const CliContractSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    version: z.string().optional(),
    def: z.record(
      zSnakeCaseKey,
      z.object({
        type: z.union([
          z.string(),
          z.custom<ZodType>(
            (v) =>
              typeof v === "object" &&
              v !== null &&
              "_zod" in v &&
              "parse" in v,
          ),
        ]),
        description: z.string(),
        arg_name: zArgName.optional(),
        flags: z
          .object({
            long: z.string(),
            short: z.string(),
          })
          .optional(),
        map: z.record(z.string(), z.any()).optional(),
      }),
    ),
    targets: z.record(
      zSnakeCaseKey,
      z.object({
        description: z.string().optional(),
        positionals: z.array(z.string()).optional(),
        flags: z
          .record(
            z.string(),
            z.union([
              z.string(),
              z.number(),
              z.boolean(),
              z.null(),
              z.undefined(),
              z.array(z.string()),
              z.object({ optional: z.boolean() }),
            ]),
          )
          .optional(),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    const defKeys = Object.keys(data.def);
    const czvoKeys = VALID_CLI_TYPES;

    // Type check: string types must exist in CZVO
    for (const [key, def] of Object.entries(data.def)) {
      if (typeof def.type === "string") {
        const parts = def.type
          .split("|")
          .map((p) => p.trim())
          .filter(Boolean);
        for (const part of parts) {
          if (!czvoKeys.includes(part)) {
            ctx.addIssue({
              code: "custom",
              message: `Unknown type '${part}' in definition '${key}'. Available types: ${czvoKeys.join(
                ", ",
              )}`,
              path: ["def", key, "type"],
            });
          }
        }
      }
    }

    // Integrity check: positions and flags must exist in 'def'
    for (const [targetName, target] of Object.entries(data.targets)) {
      target.positionals?.forEach((pos, idx) => {
        if (!defKeys.includes(pos)) {
          ctx.addIssue({
            code: "custom",
            message: `Positional '${pos}' used in target '${targetName}' but not defined in 'def'.`,
            path: ["targets", targetName, "positionals", idx],
          });
        }
      });
      if (target.flags) {
        for (const flagKey of Object.keys(target.flags)) {
          if (!defKeys.includes(flagKey)) {
            ctx.addIssue({
              code: "custom",
              message: `Flag '${flagKey}' used in target '${targetName}' but not defined in 'def'.`,
              path: ["targets", targetName, "flags", flagKey],
            });
          }
        }
      }
    }
  });

/**
 * @class Cli
 * @description Manager class for a CLI contract.
 * Orchestrates validation, type enhancement, and help data generation.
 */
export class Cli<K extends string, T extends CliContract<K>> {
  public readonly raw: T;
  private _enhanced?: T;

  constructor(contract: T) {
    this.raw = contract;
    // Fail-Fast: default validation on instantiation
    this.parse();
  }

  /**
   * @property enhanced
   * @description Returns the contract where all string types (e.g. "filepath")
   * are translated into real Zod schemas.
   */
  get enhanced(): T {
    if (!this._enhanced) {
      const definitions = this.raw.def as Record<string, CliDef>;
      this._enhanced = {
        ...(this.raw as object),
        def: Object.fromEntries(
          Object.entries(definitions).map(([key, def]) => [
            key,
            {
              ...(def as object),
              type: this.resolveType((def as CliDef).type),
            },
          ]),
        ),
      } as unknown as T;
    }
    return this._enhanced!;
  }

  /**
   * @method toJSON
   * @description Serializes the contract for JSON output, converting Zod types to JSON Schema.
   */
  toJSON(): any {
    const e = this.enhanced as any;
    return {
      ...e,
      def: Object.fromEntries(
        Object.entries(e.def).map(([key, def]: [string, any]) => [
          key,
          {
            ...def,
            type:
              typeof def.type?.toJSONSchema === "function"
                ? def.type.toJSONSchema()
                : def.type,
          },
        ]),
      ),
    };
  }

  /**
   * Translates string types or unions into Zod schemas.
   */
  private resolveType(type: CliType): ZodType {
    if (typeof type !== "string") return (type as any).toZod || type;

    const parts = type
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0)
      throw new Error(`[contractDef] Empty type definition`);

    const schemas = parts.map((p) => {
      const fn = (CZVO as any)[p];
      if (typeof fn !== "function") {
        throw new Error(`[contractDef] Unknown type identifier: "${p}"`);
      }
      const s = fn();
      // Use the newly implemented .toZod mechanism to unwrap the Proxy
      return (s as any).toZod || s;
    });

    if (schemas.length === 1) return schemas[0];

    // Use native z.union for translated schemas
    return z.union(schemas as [ZodType, ZodType, ...ZodType[]]);
  }

  /**
   * Validates the contract structure using CliContractSchema.
   * Throws a ZodError if the contract is invalid.
   * @returns Injected contract data (T).
   */
  parse(): T {
    return CliContractSchema.parse(this.raw) as T;
  }

  /**
   * Safely validates the contract structure without throwing.
   * @returns A Zod SafeParse result.
   */
  parseSafe() {
    return CliContractSchema.safeParse(this.raw);
  }

  /**
   * Builds structured help data for the CLI.
   * If a target is provided, returns only relevant usage cases for that target.
   */
  help(targetName?: string): CliHelpData {
    const data = this.raw;
    const helpData: CliHelpData = {
      name: data.name,
      description: data.description,
      usage_cases: [],
      arguments: [],
    };

    // 1. Map all arguments to help metadata
    const argRefs: Record<string, CliHelpArg> = {};
    const definitions = this.raw.def as Record<string, CliDef>;

    for (const [key, def] of Object.entries(definitions)) {
      const argName = def.arg_name || undefined;
      const valPart = argName ? ` <${argName}>` : "";

      const usages: string[] = [];
      if (def.flags) {
        usages.push(`--${def.flags.long}${valPart}`);
        usages.push(`-${def.flags.short}${valPart}`);
      }

      const typeStr = typeof def.type === "string" ? def.type : "custom_schema";

      const argObj: CliHelpArg = {
        name: key,
        arg_name: argName,
        usages: usages.length > 0 ? usages : undefined,
        type: typeStr,
        description: def.description,
      };

      argRefs[key] = argObj;
      if (argName || def.flags) {
        helpData.arguments.push(argObj);
      }
    }

    // 2. Build usage cases (subcommands)
    const targetsToProcess = targetName
      ? Object.entries(data.targets).filter(([name]) => name === targetName)
      : Object.entries(data.targets);

    for (const [name, target] of targetsToProcess) {
      const usageParams: string[] = [];

      // Add positionals
      (target as CliTarget).positionals?.forEach((p, idx) => {
        const argDef = (data.def as any)[p] as CliDef | undefined;
        const argName = argDef?.arg_name || p;
        usageParams.push(`<${argName}>`);
        if (argRefs[p] && argRefs[p].position === undefined) {
          argRefs[p].position = idx + 1;
        }
      });

      // Add flags
      if ((target as CliTarget).flags) {
        for (const [flagKey, flagVal] of Object.entries(
          (target as CliTarget).flags!,
        )) {
          const defMeta = (data.def as any)[flagKey] as CliDef | undefined;
          let flagStr = defMeta?.flags
            ? `--${defMeta.flags.long}`
            : `--${flagKey}`;

          if (Array.isArray(flagVal)) {
            flagStr += ` <${flagVal.join("|")}>`;
          } else if (defMeta?.arg_name) {
            flagStr += ` <${defMeta.arg_name}>`;
          }

          const isOptional =
            typeof flagVal === "object" &&
            flagVal !== null &&
            "optional" in flagVal &&
            flagVal.optional;
          usageParams.push(isOptional ? `[${flagStr}]` : flagStr);
        }
      }

      helpData.usage_cases.push({
        command: `${data.name}${
          name === "default" ? "" : " " + name
        } ${usageParams.join(" ")}`.trim(),
        description: (target as CliTarget).description || "",
      });
    }

    return helpData;
  }
}

/**
 * @function contractDef
 * @description Entry point to define a CLI contract.
 * Returns a Cli instance providing Fail-Fast validation and technical enhancement.
 */
export function contractDef<K extends string, T extends CliContract<K>>(
  contract: T,
): Cli<K, T> {
  return new Cli<K, T>(contract);
}
