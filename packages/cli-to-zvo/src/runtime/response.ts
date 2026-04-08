import { z } from "zod";
import {
  ParseArgObjectNameSchema,
  type tsParseArgObjectName,
} from "../config/parse-args.js";
import type {
  OSafeResult,
  OResponseOk,
  OResponseErr,
} from "../types/contract.types.js";
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

// Response Transform / Formatter

export const formatResponse =
  (route: tsParseArgObjectName | string) =>
  <T>(data: T): OResponseOk =>
    ({
      route,
      data,
    } as unknown as OResponseOk);

export const formatError =
  (route: tsParseArgObjectName | string) =>
  (error: unknown): OResponseErr =>
    ({
      route,
      error,
    } as unknown as OResponseErr);

export const formatOutput = (
  cliRes: OSafeResult,
): OResponseOk | OResponseErr => {
  if (cliRes.success) {
    const { route, data } = cliRes.data;
    return formatResponse(route)(data);
  }
  return formatError("error")(z.treeifyError(cliRes.error));
};
