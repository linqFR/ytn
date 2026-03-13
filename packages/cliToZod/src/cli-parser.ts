import { z } from "zod";

import { ArgContractSchema } from "./cli-contract-schema.js";

export function createParseArgsObject(contract: ArgContractSchema) {
  return z
    .object({
      positionals: z.array(z.string()),
      values: z.record(z.string(), z.any()),
    })
    .transform((raw) => {
      // FINI LA TRICHE ! On fait une boucle générique basée sur le contrat passé en paramètre
      const mappedObj = { ...raw.values };

      contract.positionals.forEach((keyName, index) => {
        mappedObj[keyName] = raw.positionals[index];
      });

      return mappedObj;
    });
}
