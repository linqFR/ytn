/**
 * Check whether a string is a valid ECMAScript regex pattern.
 * @param pattern - The regex pattern to validate.
 * @param flag - The regex flag to use for validation. Defaults to `"u"`.
 * @returns `true` if `pattern` can be compiled with the given flag.
 */
export const isValidRegex = (pattern: string, flag: string = "u"): boolean => {
  if (typeof pattern !== "string") return false;
  try {
    new RegExp(pattern, flag);
    return true;
  } catch {
    return false;
  }
}