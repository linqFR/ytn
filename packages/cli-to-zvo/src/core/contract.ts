import {
  ContractSchema,
  type tsContractIN,
} from "../schema/contract.schema.js";
import { type tsProcessedContract, type OHelpData } from "../types/contract.types.js";

/**
 * @class Contract
 * @description Manager class for a CLI contract.
 * Orchestrates validation, type enhancement, and help data generation.
 */
export class Contract<T extends tsProcessedContract = tsProcessedContract> {
  /**
   * @property raw
   * @description The fully processed and validated contract.
   */
  public readonly raw: T;

  constructor(contract: T) {
    this.raw = contract;
  }

  /**
   * @property enhanced
   * @description Returns the contract where all string types (e.g. "filepath")
   * are translated into real Zod schemas.
   */
  get enhanced(): T {
    return this.raw;
  }

  /**
   * @method create
   * @description Entry point to define a CLI contract.
   */
  public static create<I extends tsContractIN>(contract: I): Contract<tsProcessedContract> {
    const res = ContractSchema.parse(contract);
    return new Contract(res as unknown as tsProcessedContract);
  }

  /**
   * Builds structured help data for the CLI.
   */
  help(): OHelpData {
    return {
      name: this.raw.name,
      description: this.raw.description,
      usage_cases: [],
      arguments: [],
    };
  }
}

/** Represents any instance of Contracts */
export type tsContractAny = Contract<tsProcessedContract>;
