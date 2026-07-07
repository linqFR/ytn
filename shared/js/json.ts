import { catchSyncFn } from "../safe/safemode.js";

/* -------------------------------------------------------------------------- */
/*                                   PARSING                                  */
/* -------------------------------------------------------------------------- */

/**
 * @type {Parameters<typeof JSON.parse>} tsJSONParseArgs
 */
type tsJSONParseArgs = Parameters<typeof JSON.parse>;

/**
 * @function safeParse
 * @description Synchronously parses a JSON string into a SafeResult, catching any syntax errors.
 *
 * @template T
 * @param {tsJSONParseArgs[0]} text - The valid JSON string to parse.
 * @param {tsJSONParseArgs[1]} [reviver] - Optional transformation function.
 * @returns {tsSafeResult<T>} A [error, data] tuple.
 */
export function safeParse<T = any>(
  text: tsJSONParseArgs[0],
  reviver?: tsJSONParseArgs[1],
) {
  return catchSyncFn<any, tsJSONParseArgs>(JSON.parse)(text, reviver);
}

/**
 * @type {Parameters<typeof JSON.stringify>} tsJSONStringifyArgs
 */
type tsJSONStringifyArgs = Parameters<typeof JSON.stringify>;

/**
 * @function safeStringify
 * @description Safely serializes a value to a JSON string.
 *
 * @param {tsJSONStringifyArgs[0]} val - The value to stringify.
 * @param {tsJSONStringifyArgs[1]} [replacer] - Optional property filter.
 * @param {tsJSONStringifyArgs[2]} [space=2] - Indentation spacing.
 * @returns {tsSafeResult<string>} A [error, jsonString] tuple.
 */
export function safeStringify(
  val: tsJSONStringifyArgs[0],
  replacer?: tsJSONStringifyArgs[1],
  space: tsJSONStringifyArgs[2] = 2,
) {
  return catchSyncFn<string, tsJSONStringifyArgs>(JSON.stringify)(
    val,
    replacer,
    space,
  );
}

/**
 * @function stringify
 * @description JSON.stringify with built-in bigint support (converts bigint to string).
 *
 * @param {tsJSONStringifyArgs[0]} val - The value to stringify.
 * @param {tsJSONStringifyArgs[1]} [replacer] - Optional property filter (bigint handling is applied first).
 * @param {tsJSONStringifyArgs[2]} [space] - Indentation spacing.
 * @returns {string} JSON string with bigint values converted to strings.
 */
export function stringify(
  val: tsJSONStringifyArgs[0],
  replacer?: (key: string, value: any) => any,
  space?: tsJSONStringifyArgs[2],
): string {
  const bigintReplacer: (key: string, value: any) => any = (key, value) => {
    if (typeof value === 'bigint') return value.toString()+"n";
    return replacer ? replacer(key, value) : value;
  };
  return JSON.stringify(val, bigintReplacer, space);
}
