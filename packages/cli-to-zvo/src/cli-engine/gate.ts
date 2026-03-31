import { z } from "zod";
import { tsTargetName, type tsTargetFieldName } from "../config/parse-args.js";
import type {
  tsGate,
  tsProcessedCliOUT,
  IProcessedContract,
} from "../types/contract.types.js";
import type { tsPossibleValuesArray } from "../types/bit-router.types.js";

/**
 * @class ZvoGate
 * @description Pure runtime orchestrator. Lean and performance-focused.
 * Only contains the native Zod Discriminated Union.
 *
 * Moved to cli-engine to follow the principle: Core is a consumer, not a provider.
 */
export class ZvoGate {
  /** @property {tsGate} zvoSchema - Pure native Zod Discriminated Union dispatcher. */
  public readonly zvoSchema: tsGate;

  public readonly cli: tsProcessedCliOUT;
  // public readonly interceptors: tsInterceptors;
  protected readonly discriminantKeys: tsTargetFieldName[];
  protected readonly possibleValues: tsPossibleValuesArray;

  constructor(processed: IProcessedContract) {
    const { targets, cli, routing } = processed;
    this.cli = cli;
    // this.interceptors = routing.interceptors;
    this.discriminantKeys = routing.discriminantKeys;
    this.possibleValues = routing.possibleValues || {};

    const forge = (sig: string, name: tsTargetName): z.ZodType =>
      targets[name].zod
        .extend({ discriminant: z.literal(sig) })
        .transform(({ discriminant, ...data }: any) => ({
          route: name,
          data,
        }));

    const branches = Object.entries(routing.router).map(([sig, names]) => {
      const targetNames = Array.isArray(names) ? names : [names];

      if (targetNames.length === 1) return forge(sig, targetNames[0]!);

      return z
        .looseObject({ discriminant: z.literal(sig) })
        .pipe(z.union(targetNames.map((n) => forge(sig, n)) as any));
    });

    this.zvoSchema = z.discriminatedUnion(
      "discriminant",
      branches as any,
    ) as unknown as tsGate;
  }
}
