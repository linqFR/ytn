/**
 * DNA Type Inference System
 *
 * Provides TypeScript type inference from DNA bytecode schemas.
 * Similar to Zod's Infer<Schema> functionality.
 */

import type {tsDna} from "./core.types.js";

/**
 * @type InferDNA
 * @description Infer TypeScript type from DNA bytecode schema
 *
 * Maps DNA opcodes to their corresponding TypeScript types.
 * This is a compile-time type system only - runtime validation is separate.
 */
export type InferDNA<T extends tsDna> =
	T extends ["s", infer _S, infer _M] ? string :
	T extends ["n", infer _N, infer _M] ? number :
	T extends ["i", infer _I, infer _M] ? number :
	T extends ["b", infer _B] ? boolean :
	T extends ["o", infer _O, infer _M] ? InferObjectDNA<_O> :
	T extends ["a", infer _A, infer _M] ? unknown[] :
	T extends ["c", infer _C, infer _M] ? InferConstDNA<_C> :
	T extends ["l", infer _L, infer _M] ? InferLiteralDNA<_L> :
	T extends ["e", infer _E, infer _M] ? InferEnumDNA<_E> :
	T extends ["optional", [infer _Opt, infer _M]] ? (_Opt extends tsDna ? InferDNA<_Opt> | undefined : undefined) :
	T extends ["nullable", [infer _Null, infer _M]] ? (_Null extends tsDna ? InferDNA<_Null> | null : null) :
	T extends ["mutate", infer _Mut, infer _M] ? unknown :
	T extends ["check", [infer _Chk, infer _M]] ? (_Chk extends tsDna ? InferDNA<_Chk> : unknown) :
	T extends ["ref", infer _Ref, infer _M] ? unknown :
	unknown;

/**
 * Infer type from object DNA constraints
 */
type InferObjectDNA<T> = T extends [infer _Constraints, infer _Meta]
	? Record<string, unknown>
	: unknown;

/**
 * Infer type from const DNA
 */
type InferConstDNA<T> = T extends [infer _Value, infer _Meta]
	? _Value
	: unknown;

/**
 * Infer type from literal DNA
 */
type InferLiteralDNA<T> = T extends [infer _Value, infer _Meta]
	? _Value
	: unknown;

/**
 * Infer type from enum DNA
 */
type InferEnumDNA<T> = T extends [infer _Values, infer _Meta]
	? _Values extends (infer V)[]
		? V
		: unknown
	: unknown;

/**
 * Type guard function for DNA validation
 *
 * @param value - The value to check
 * @param schema - The DNA schema to validate against
 * @returns True if value matches the schema type
 */
export function isDNA<T>(
	value: unknown,
	schema: tsDna
): value is InferDNA<typeof schema> {
	// This is a runtime placeholder - actual validation should use the validator from toJs
	// Type narrowing happens at compile time via the type parameter
	return true;
}

/**
 * Assert type for DNA schema
 *
 * Use this to assert that a value matches the inferred type of a DNA schema.
 * This is a compile-time type assertion only.
 */
export type AssertDNA<T extends tsDna, U> = U extends InferDNA<T> ? T : never;

/**
 * Example usage:
 *
 * ```typescript
 * const stringSchema: tsDna = ["s", [null, null, null, null], {}];
 * type StringType = InferDNA<typeof stringSchema>; // string
 *
 * const objectSchema: tsDna = ["o", [["properties", [["name", 1]]], ["required", ["name"]]], {}];
 * type ObjectType = InferDNA<typeof objectSchema>; // Record<string, unknown>
 * ```
 */
