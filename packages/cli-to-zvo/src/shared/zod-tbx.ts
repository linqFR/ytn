import { castArrayValuesToString } from "@ytn/shared/js/cast-ops.js";
import {
  getZodValueDeep,
  isZodDefaultDeep,
  isZodOptionalDeep,
} from "@ytn/shared/zod/zod-reflection.js";

/**
 * @function getZodValue
 * @description Retrieves literal/enum values using shared Deep reflection and casts
 * them to strings for CLI routing compatibility.
 *
 * If a field is Optional or has a Default, it automatically includes an empty string ("")
 * to allow routing matches when the flag/positional is absent.
 *
 * @param {any} schema - The schema to extract values from.
 * @returns {string[]} An array of stringified values.
 */
export function getZodValue(schema: any): string[] {
  const values = getZodValueDeep(schema);
  const casted = castArrayValuesToString(values);
  if (isZodOptionalDeep(schema) || isZodDefaultDeep(schema)) {
    if (!casted.includes("")) casted.push("");
  }
  if (casted.length === 0) return [""];
  return casted;
}
