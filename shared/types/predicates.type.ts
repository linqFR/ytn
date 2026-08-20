/**
 * Type-Level Predicates — boolean checks and property existence tests.
 * Rules: use '$*' prefix for active type modifiers.
 */

/**
 * @type {$IsAny} $IsAny
 * @description Detects whether `T` is exactly `any`. Needed because `any` is
 * absorbant (`any | T = any`) and breaks conditional type logic.
 *
 * @template T
 */
export type $IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * @type {$IsDigit} $IsDigit
 * @description Checks if a single-character string is a digit (0-9).
 *
 * @template {string} C
 */
export type $IsDigit<C extends string> = C extends "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ? true : false;

/**
 * @type {$IsLower} $IsLower
 * @description Checks if a single-character string is a lowercase letter.
 *
 * @template {string} C
 */
export type $IsLower<C extends string> = C extends Lowercase<C> ? (C extends Uppercase<C> ? false : true) : false;

/**
 * @type {$IsUpper} $IsUpper
 * @description Checks if a single-character string is an uppercase letter.
 *
 * @template {string} C
 */
export type $IsUpper<C extends string> = C extends Uppercase<C> ? (C extends Lowercase<C> ? false : true) : false;

/**
 * @type {$HasProperty} $HasProperty
 * @description Returns `T` if key `K` exists on `T`, otherwise `never`.
 * Useful as a type guard in conditional types.
 *
 * @template T
 * @template {PropertyKey} K
 */
export type $HasProperty<T, K extends PropertyKey> = K extends keyof T ? T : never;

/**
 * @type {$PropertyCheck} $PropertyCheck
 * @description Returns `T` if key `K` exists on `T`, otherwise a type with
 * property `K` of type `S` (useful for error messages in conditional types).
 *
 * @template T
 * @template {PropertyKey} K
 * @template S
 */
export type $PropertyCheck<T, K extends PropertyKey, S> = K extends keyof T ? T : { [P in K]: S };
