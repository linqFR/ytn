import { z } from "zod";
import { ParseArgObjectNameSchema, type tsParseArgObjectName } from "../config/parse-args.js";
import { OResponse, tsResponse } from "../types/contract.types.js";
// Removed old imports

// On définit les deux états possibles de la réponse
const SuccessSchema = z.object({
  route: ParseArgObjectNameSchema,
  data: z.unknown(),
  error: z.undefined().optional(), // Assure l'exclusivité au niveau du type
});

const ErrorSchema = z.object({
  route: ParseArgObjectNameSchema,
  data: z.undefined().optional(),
  error: z.unknown(),
});

// L'union discriminée est brandée pour marquer officiellement le résultat comme étant routé.
export const ResponseSchema = z
  .union([SuccessSchema, ErrorSchema])
  .readonly()
  .brand<"tsResponse">();

/**
 * Garde de type pour vérifier si un objet est une réponse (enveloppe de routage).
 */
export const isResponse = (val: unknown): val is tsResponse => {
  return ResponseSchema.safeParse(val).success;
};

// Response Transform / Formatter

export const formatResponse =
  (route: tsParseArgObjectName | string) =>
  <T>(data: T): OResponse =>
    ({
      route,
      data,
    } as unknown as OResponse);

export const formatError =
  (route: tsParseArgObjectName | string) =>
  (error: unknown): OResponse =>
    ({
      route,
      error,
    } as unknown as OResponse);
