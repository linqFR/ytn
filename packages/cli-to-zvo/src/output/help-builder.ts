import type {
  IProcessedContract,
  OHelpArg,
  OHelpCase,
  OHelpData,
  OHelpOptions,
  tsProcessedFlag,
  tsProcessedTarget,
} from "../types/contract.types.js";
import type {
  tsTargetFieldName,
  tsTargetName,
} from "../config/parse-args.js";

/**
 * @function buildHelp
 * @description Generates structured metadata for the CLI help screen.
 * Externalized from the Contract class for better maintainability.
 *
 * @param {IProcessedContract} processed - The compiled contract metadata.
 * @param {string} [targetName] - Optional name of a specific target to get help for.
 * @returns {OHelpData} Structured help data ready to be passed to a renderer.
 */
export function buildHelp(
  processed: IProcessedContract,
  targetName?: string,
  options?: OHelpOptions,
): OHelpData {
  const target = targetName
    ? (processed.targets as any)[targetName as tsTargetName]
    : undefined;

  const cliName = options?.cmd || processed.name;

  // 1. Extract arguments (flags and positionals)
  const helpArgs: OHelpArg[] = Object.entries(processed.help)
    .filter(([, model]) => {
      if (!target) return true;
      // Only include arguments relevant to the selected target
      return (target.targetCode & model.bit) !== 0;
    })
    .map(([fieldName, model]) => {
      const isFlag = "short" in model;
      let usages: string[] = [];

      if (isFlag) {
        const flag = model as tsProcessedFlag;
        usages = [
          flag.short ? `-${flag.short}` : "",
          `--${flag.long}`,
        ].filter(Boolean);
      } else {
        // For positionals, if there's a literal value for this target, show it
        const literals = target?.targetLiterals[fieldName as tsTargetFieldName];
        if (literals && literals.length === 1) {
          usages = [literals[0]];
        } else if (literals && literals.length > 1) {
          usages = [`(${literals.join("|")})`];
        } else {
          usages = [`<${model.long}>`];
        }
      }

      // Positional argument index
      let position: number | undefined = undefined;
      if (!isFlag) {
        position = Object.keys(processed.cli.positionals).indexOf(fieldName);
      }

      // For targeted help, only show literals that apply to this target.
      // For global help, show all known discriminants.
      let uniqueValues = target
        ? target.targetLiterals[fieldName as tsTargetFieldName] || []
        : processed.routing.discriminants[fieldName as tsTargetFieldName] || [];

      // For boolean flags, don't show "true" in the list of allowed values
      if (model.type === "boolean") {
        uniqueValues = uniqueValues.filter((v: string) => v !== "true");
      }

      const typeString =
        uniqueValues.length > 0
          ? `${model.type} (${uniqueValues.join(", ")})`
          : model.type;

      return {
        name: model.long,
        arg_name: fieldName,
        usages,
        position,
        type: typeString,
        description: isFlag ? (model as tsProcessedFlag).desc || "" : "",
      };
    });

  // 2. Extract usage cases
  let usageCases: OHelpCase[] = [];

  if (target) {
    usageCases = [
      {
        target: target.name,
        command: buildTargetUsage(processed, target, options),
        description:
          options?.desc?.[target.name] || `Execute task: ${target.name}`,
      },
    ];
  } else {
    // Global help showing usage for every target
    usageCases = Object.values(processed.targets).map((t) => ({
      target: (t as tsProcessedTarget).name,
      command: buildTargetUsage(processed, t as tsProcessedTarget, options),
      description:
        options?.desc?.[(t as tsProcessedTarget).name] ||
        `Execute task: ${(t as tsProcessedTarget).name}`,
    }));
  }

  const mainDescription = target
    ? options?.desc?.[target.name] || `Execute task: ${target.name}`
    : processed.description;

  return {
    name: cliName,
    description: mainDescription,
    usage_cases: usageCases,
    arguments: helpArgs,
  };
}

/**
 * @function buildTargetUsage
 * @description Builds a full CLI syntax string for a specific target.
 *
 * @param {IProcessedContract} processed - The compiled contract metadata.
 * @param {tsProcessedTarget} target - The target to build usage for.
 * @returns {string} The formatted command syntax.
 */
export function buildTargetUsage(
  processed: IProcessedContract,
  target: tsProcessedTarget,
  options?: OHelpOptions,
): string {
  let command = options?.cmd || processed.name;

  // 1. Add positionals in order
  const sortedPos = Object.entries(processed.cli.positionals).sort(
    ([, a], [, b]) => a.bit - b.bit,
  );

  sortedPos.forEach(([fieldName, pos]) => {
    if ((target.targetCode & pos.bit) !== 0) {
      const literals = target.targetLiterals[fieldName as tsTargetFieldName];
      if (literals && literals.length === 1) {
        command += ` ${literals[0]}`;
      } else if (literals && literals.length > 1) {
        command += ` (${literals.join("|")})`;
      } else {
        command += ` <${pos.long}>`;
      }
    }
  });

  // 2. Add required flags
  const flagEntries = Object.entries(processed.cli.flags);

  flagEntries
    .filter(([, f]) => (target.targetRequiredBits & f.bit) !== 0)
    .forEach(([fieldName, f]) => {
      const literals = target.targetLiterals[fieldName as tsTargetFieldName];
      const isBoolean = f.type === "boolean";

      if (isBoolean) {
        command += ` --${f.long}`;
      } else if (literals && literals.length === 1) {
        command += ` --${f.long} ${literals[0]}`;
      } else if (literals && literals.length > 1) {
        command += ` --${f.long} (${literals.join("|")})`;
      } else {
        command += ` --${f.long} <${f.long}>`;
      }
    });

  // 3. Add [options] hint if there are optional flags
  const hasOptionalFlags = flagEntries.some(
    ([, f]) =>
      (target.targetCode & f.bit) !== 0 &&
      (target.targetRequiredBits & f.bit) === 0,
  );

  if (hasOptionalFlags) {
    command += " [options]";
  }

  return command;
}
