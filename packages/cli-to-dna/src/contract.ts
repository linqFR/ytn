import { dna } from "@ytrynot/dna";
import { pico, picoToDna, type BasePico, type DnaSchema } from "./pico.js";

export interface ICliFlag {
  short: string;
  type: "string" | "boolean";
}

export interface IContract {
  name: string;
  description: string;
  cli: {
    positionals: string[];
    flags: Record<string, ICliFlag>;
  };
  targets: Record<string, Record<string, unknown>>;
}

interface IParsingArgs {
  positionals: string[];
  options: Record<string, ICliFlag>;
  allowPositionals: boolean;
  allowNegative: boolean;
  strict: boolean;
}

export interface IProcessedContract {
  validator: BasePico;
  parsingArgs: IParsingArgs;
}

export function createContract(contract: IContract): IProcessedContract {
  const targetSchemas: DnaSchema[] = [];

  for (const [, fields] of Object.entries(contract.targets)) {
    const shape: Record<string, DnaSchema> = {};
    for (const [k, v] of Object.entries(fields)) {
      shape[k] = picoToDna(v);
    }
    targetSchemas.push(dna.looseObject(shape));
  }

  const validator = pico.or(...targetSchemas);

  const parsingArgs: IParsingArgs = {
    positionals: contract.cli.positionals ?? [],
    options: contract.cli.flags ?? {},
    allowPositionals: true,
    allowNegative: false,
    strict: false,
  };

  return { validator, parsingArgs };
}
