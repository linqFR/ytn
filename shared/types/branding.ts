
/**
 * Branded types for strict type-level isolation using unique signatures.
 */

// brand symbol
declare const __brand: unique symbol;

/**
 * Type Branding Generator: Branded<Type, 'BrandName'>
 * This ensures that two types with same structure but different brands stay incompatible.
 */
export type Branded<T, K extends string> = T & { [__brand]: K };
