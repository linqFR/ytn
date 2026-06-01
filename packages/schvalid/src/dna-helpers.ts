// import type { namerFn } from "./toJS/utils.js";

export const parseType = (rawType: any): { isNullable: boolean; types: string[] } => {
  const isNullable = Array.isArray(rawType)
    ? rawType.includes("null")
    : rawType === "null";
  const types = Array.isArray(rawType)
    ? rawType.filter((t) => t !== "null")
    : rawType && rawType !== "null"
    ? [rawType]
    : [];
  return { isNullable, types };
};

export const resolveUri = (base: string, relative: string): string => {
  if (!relative) return base;
  if (
    relative.startsWith("http://") ||
    relative.startsWith("https://") ||
    relative.startsWith("urn:")
  ) {
    return relative;
  }
  try {
    const url = new URL(
      relative,
      base.includes("#") ? base.split("#")[0] : base,
    );
    return url.href;
  } catch {
    if (relative.startsWith("#")) return base.split("#")[0] + relative;
    if (typeof base === "string" && base.startsWith("urn:"))
      return (
        base.split("#")[0] + (relative.startsWith("/") ? "" : "/") + relative
      );
    return relative;
  }
};

export type tsValidatorFn = () => [string, string, string];
export type tsModifierFn = (args: number[]) => [string, string, string];
export type tsWrapperFn = (item: [number], value: any) => [string, string, string];
export type tsConstraintFn = (...args: any[]) => [string, string, string];

// Legacy mapper for dna-to-txt-raw.ts (returns simple strings)
export type tsLegacyValidatorFn = () => string;
export type tsLegacyModifierFn = (args: number[]) => string;
export type tsLegacyWrapperFn = (item: [number], value: any) => string;
export type tsLegacyConstraintFn = (...args: any[]) => string;

export type tsMapperRec = Record<string, tsValidatorFn | tsModifierFn | tsWrapperFn | tsConstraintFn>;
export type tsLegacyMapperRec = Record<string, tsLegacyValidatorFn | tsLegacyModifierFn | tsLegacyWrapperFn | tsLegacyConstraintFn>;
export type tsMapperFn = (fn: namerFn, args: any[]) => string;

// export type tsDnaBytecode = [string, ...any[]]

