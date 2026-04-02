
import { z } from "zod";
import { SafeResult, safeResultErr, safeResultOk } from "../safe/safemode.js";

/**
 * Zod operational adapters and high-level functions.
 */

/**
 * Wraps a synchronous Zod parse into a SafeResult tuple [err, res].
 */
export function safeParseZ<T>(schema: z.ZodType<T>, data: unknown): SafeResult<T> {
  const result = schema.safeParse(data);
  return result.success ? safeResultOk(result.data) : safeResultErr(result.error);
}

/**
 * Same as safeParseZ but for asynchronous parsing.
 */
export async function safeParseZAsync<T>(
  schema: z.ZodType<T>,
  data: unknown,
): Promise<SafeResult<T>> {
  const result = await schema.safeParseAsync(data);
  return result.success ? safeResultOk(result.data) : safeResultErr(result.error);
}
