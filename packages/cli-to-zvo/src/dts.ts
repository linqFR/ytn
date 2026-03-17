/**
 * @type Without
 * @description Utility type to ensure a type T does not contain any keys from U.
 */
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/**
 * @type XOR
 * @description Logical XOR between two types T and U.
 * Used for strict subcommand routing validation.
 */
export type XOR<T, U> = (T & Without<U, T>) | (U & Without<T, U>);
