import { z } from "zod";
import { type tsParseArgObjectName } from "../config/parse-args.js";
import {
  type tsGate,
  type tsProcessedCliOUT,
  type tsProcessedContract,
  type tsSignatureGroup,
} from "../types/contract.types.js";

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
  public readonly interceptors: Record<string, bigint>;
  protected readonly discriminantKeys: tsParseArgObjectName[];
  protected readonly possibleValues: Record<tsParseArgObjectName, string[]>;

  constructor(processed: tsProcessedContract) {
    const { targets, cli, routing } = processed;
    this.cli = cli;
    this.interceptors = routing.interceptors;
    this.discriminantKeys = routing.discriminantKeys;
    this.possibleValues = routing.possibleValues || {};

    const signatureGroup: tsSignatureGroup = {};
    for (const [sig, targetName] of Object.entries(routing.router)) {
      if (!signatureGroup[sig]) signatureGroup[sig] = [];
      signatureGroup[sig].push(targetName);
    }

    const branches = Object.entries(signatureGroup).map(
      ([sig, targetNames]) => {
        const targetSchemas = targetNames.map((name) => {
          const target = targets[name];
          return target.zod
            .extend({
              discriminant: z.literal(sig),
            })
            .transform((data: any) => {
              const { discriminant, ...cleanData } = data;
              return { route: name, data: cleanData };
            });
        });

        return targetSchemas.length > 1
          ? z.union(targetSchemas as any)
          : targetSchemas[0]!;
      },
    );

    this.zvoSchema = z.discriminatedUnion(
      "discriminant",
      branches as any,
    ) as unknown as tsGate;
  }
}
