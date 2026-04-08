/**
 * Branded types for strict type-level isolation using unique signatures.
 */

// brand symbol
declare const __brand: unique symbol;

/**
 * @type {T & { [__brand]: K }} Branded
 * @description Type Branding Utility. Creates an opaque/branded type that remains compatible
 * with base type `T` at runtime but stays incompatible with other identical structures at compile-time.
 *
 * @template T - The base primitive or object type.
 * @template {string} K - The unique literal brand name.
 */
export type Branded<T, K extends string> = T & { [__brand]: K };
