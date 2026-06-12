import type { tsDnaId, tsMeta } from "./dna-core.types.js";

export type tsTypeDNA = [number[], tsMeta];
export type tsOfList = [[string, ...number[]], tsMeta];

export type tsStringDNA = [
	[number | null, number | null, string | null, string | null], // [min, max, pattern, format]
	tsMeta, // meta (without path)
];

export type tsNumberDNA = [
	[number | bigint | null, boolean, number | bigint | null, boolean, number | bigint | null], // [min, exclMin, max, exclMax, multOf]
	tsMeta, // meta (without path)
];

export type tsConstDNA = ["c", any, tsMeta];

export type tsEnumDNA = ["e", any[], tsMeta];

export type tsLiteralDNA = ["l", any, tsMeta];

export type tsRequiredDNA = [
	string[], // required keys
	tsDnaId,
];

export type tsObjectDNA = [any[], tsMeta];

export type tsObjProperties = [[string, tsDnaId][]];

export type tsArrayDNA = [any[], tsMeta];

export type tsIfThenElseDNA = [
	[number, number, number], // [ifIndex, thenIndex, elseIndex] where -1 means n/a
];
