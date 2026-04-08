import { z } from "zod";
import { safeResultErr, safeResultOk, tsSafeResult } from "../safe/safemode.js";

/**
 * Zod operational adapters and high-level functions.
*/
// NOTE: to keep??

/**
 * @function safeParseZ
 * @description Wraps a synchronous Zod parse operation into a standardized SafeResult tuple.
 * Useful for bridging Zod's internal SafeParseReturnType with the Linq-style Error|Data tuple.
 *
 * @template T
 * @param {z.ZodType<T>} schema - The Zod schema to use for validation.
 * @param {unknown} data - The raw data to parse.
 * @returns {tsSafeResult<T>} A SafeResult [error, result] tuple.
 */
export function safeParseZ<T>(
  schema: z.ZodType<T>,
  data: unknown,
): tsSafeResult<T> {
  const result = schema.safeParse(data);
  return result.success
    ? safeResultOk(result.data)
    : safeResultErr(result.error);
}

/**
 * @function safeParseZAsync
 * @description Asynchronous version of safeParseZ. Wraps schema.safeParseAsync.
 *
 * @template T
 * @param {z.ZodType<T>} schema - The Zod schema to use for validation.
 * @param {unknown} data - The raw data to parse.
 * @returns {Promise<tsSafeResult<T>>} A promise resolving to a SafeResult tuple.
 */
export async function safeParseZAsync<T>(
  schema: z.ZodType<T>,
  data: unknown,
): Promise<tsSafeResult<T>> {
  const result = await schema.safeParseAsync(data);
  return result.success
    ? safeResultOk(result.data)
    : safeResultErr(result.error);
}
