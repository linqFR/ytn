import type { tsDnaInnerMeta } from "../shared/meta-context.type.js";
import type { tsDnaId } from "../types/core.types.js";

export type tsTypeDNA = [number[], tsDnaInnerMeta];
export type tsOfList = [[string, ...number[]], tsDnaInnerMeta];

export type tsStringDNA = [
	[number | null, number | null, string | null, string | null], // [min, max, pattern, format]
	tsDnaInnerMeta, // meta (without path)
];

export type tsNumberDNA = [
	[number | bigint | null, boolean, number | bigint | null, boolean, number | bigint | null], // [min, exclMin, max, exclMax, multOf]
	tsDnaInnerMeta, // meta (without path)
];

export type tsConstDNA = ["c", any, tsDnaInnerMeta];

export type tsEnumDNA = ["e", any[], tsDnaInnerMeta];

export type tsLiteralDNA = ["l", any, tsDnaInnerMeta];

export type tsRequiredDNA = [
	string[], // required keys
	tsDnaId,
];

export type tsObjectDNA = [any[], tsDnaInnerMeta];

export type tsObjProperties = [[string, tsDnaId][]];

export type tsArrayDNA = [any[], tsDnaInnerMeta];

export type tsIfThenElseDNA = [
	[number, number, number], // [ifIndex, thenIndex, elseIndex] where -1 means n/a
];
