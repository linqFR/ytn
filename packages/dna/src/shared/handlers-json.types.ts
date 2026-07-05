import type { tsDnaId } from "../types/core.types.js";
import type { tsDnaMeta, tsDnaInnerMeta } from "./meta-context.type.js";


export type tsDnaStringOpt = [
	[number | null, number | null, string | null, string | null], // [min, max, pattern, format]
	tsDnaInnerMeta, // meta (without path)
];

export type tsDnaNumberOpt = [
	[number | bigint | null, boolean, number | bigint | null, boolean, number | bigint | null], // [min, exclMin, max, exclMax, multOf]
	tsDnaInnerMeta, // meta (without path)
];

export type tsDnaConstOpt = [ any, tsDnaInnerMeta];

export type tsDnaEnumOpt = [any[], tsDnaInnerMeta];

export type tsDnaLiteralOpt = [any|any[], tsDnaInnerMeta];

export type tsDnaRequiredOpt = [
	string[], // required keys
	tsDnaId,
];

export type tsDnaObjectOpt = [any[], tsDnaInnerMeta];

export type tsDnaObjPropertiesOpt = [[string, tsDnaId][]];

export type tsDnaBaseArrayOpt = [number[], tsDnaMeta];
export type tsDnaArrayOpt = [any[], tsDnaInnerMeta];

export type tsDnaIfThenElseOpt = [
	[number, number, number], // [ifIndex, thenIndex, elseIndex] where -1 means n/a
];
