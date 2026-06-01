import type {
	tsArrayDNA,
	tsConstDNA,
	tsFnInlineCache,
	tsIfThenElseDNA,
	tsJSFuncReturn,
	tsJSFuncReturnLong,
	tsMeta,
	tsNumberDNA,
	tsObjectDNA,
	tsStringDNA,
	tsTargetList,
} from "../dna.type.js";

/**
 * Version ultra-performante des mots-clés DNA (Validation booléenne pure).
 * Pas de gestion d'erreurs, pas de parsing, pas d'allocations.
 */

export const type = (dnaOpt: tsTargetList, varName: string = "v") => {
	const indices = dnaOpt[0];
	const validations = [];
	for (let i = 0; i < indices.length; i++) {
		switch (indices[i]) {
			case "string": validations.push("typeof " + varName + '==="string"'); break;
			case "number": validations.push("typeof " + varName + '==="number"'); break;
			case "boolean": validations.push("typeof " + varName + '==="boolean"'); break;
			case "object": validations.push("typeof " + varName + '==="object"&&' + varName + "!==null"); break;
			case "array": validations.push("Array.isArray(" + varName + ")"); break;
			case "null": validations.push(varName + "===null"); break;
			case "undefined": validations.push(varName + "===undefined"); break;
		}
	}
	return "(" + validations.join("||") + ")";
};

export const string = (dnaOpt: tsStringDNA, varName: string = "v"): tsJSFuncReturn => {
	const opt = dnaOpt[0], min = opt[0], max = opt[1], pattern = opt[2];
	const tests = ["typeof " + varName + '==="string"'];
	if (min !== null) tests.push(varName + ".length>=" + min);
	if (max !== null) tests.push(varName + ".length<=" + max);
	if (pattern !== null) tests.push("/" + pattern + "/.test(" + varName + ")");
	return "(" + tests.join("&&") + ")";
};

export const n = (dnaOpt: tsNumberDNA, varName: string = "v"): tsJSFuncReturn => {
	const opt = dnaOpt[0], min = opt[0], exclMin = opt[1], max = opt[2], exclMax = opt[3], multOf = opt[4];
	const tests = ["typeof " + varName + '==="number"'];
	if (min !== null) tests.push(varName + (exclMin ? ">" : ">=") + min);
	if (max !== null) tests.push(varName + (exclMax ? "<" : "<=") + max);
	if (multOf !== null) tests.push(varName + "%" + multOf + "===0");
	return "(" + tests.join("&&") + ")";
};

export const i = (dnaOpt: tsNumberDNA, varName: string = "v"): tsJSFuncReturn =>
	"(" + n(dnaOpt, varName) + "&&" + varName + "%1===0)";

export const b = (dnaOpt: [tsMeta], varName: string = "v"): tsJSFuncReturn =>
	'typeof ' + varName + '==="boolean"';

export const n0 = (dnaOpt: [tsMeta], varName: string = "v"): tsJSFuncReturn =>
	varName + "===null";

export const T = (): tsJSFuncReturn => "true";
export const F = (): tsJSFuncReturn => "false";

export const c = (dnaOpt: tsConstDNA, varName: string = "v"): tsJSFuncReturn =>
	varName + "===" + JSON.stringify(dnaOpt[0]);

export const l = c;
export const e = (dnaOpt: tsConstDNA, varName: string = "v"): tsJSFuncReturn =>
	JSON.stringify(dnaOpt[0]) + ".includes(" + varName + ")";

export const o = (dnaOpt: tsObjectDNA, varName: string = "o", fnCache: tsFnInlineCache): tsJSFuncReturnLong => {
	const opt = dnaOpt[0];
	const tests = ["typeof " + varName + '==="object"&&' + varName + "!==null"];

	for (let i = 0; i < opt.length; i++) {
		const [key, data] = opt[i];
		switch (key) {
			case "required":
				data.forEach((k: string) => tests.push('Object.hasOwn(' + varName + ',"' + k + '")'));
				break;
			case "properties":
				data.forEach(([pk, idx]: [string, number]) => {
					tests.push('(!Object.hasOwn(' + varName + ',"' + pk + '")||' + fnCache[idx](varName + '["' + pk + '"]', "") + ')');
				});
				break;
			case "minProperties": tests.push("Object.keys(" + varName + ").length>=" + data); break;
			case "maxProperties": tests.push("Object.keys(" + varName + ").length<=" + data); break;
		}
	}
	return ["", [tests.join("&&"), varName]];
};

export const a = (dnaOpt: tsArrayDNA, varName: string = "ar", fnCache: tsFnInlineCache): tsJSFuncReturnLong => {
	const opt = dnaOpt[0];
	const tests = ["Array.isArray(" + varName + ")"];

	for (let i = 0; i < opt.length; i++) {
		const [key, data] = opt[i];
		switch (key) {
			case "minItems": tests.push(varName + ".length>=" + data); break;
			case "maxItems": tests.push(varName + ".length<=" + data); break;
			case "items":
				tests.push(varName + ".every(v=>" + fnCache[data]("v", "") + ")");
				break;
		}
	}
	return ["", [tests.join("&&"), varName]];
};

export const ifThenElse = (dnaOpt: tsIfThenElseDNA, varName: string = "v", fnCache: tsFnInlineCache): tsJSFuncReturn => {
	const [ifIdx, thenIdx, elseIdx] = dnaOpt[0];
	const ifPart = ifIdx === -1 ? "true" : fnCache[ifIdx](varName, "");
	const thenPart = thenIdx === -1 ? "true" : fnCache[thenIdx](varName, "");
	const elsePart = elseIdx === -1 ? "true" : fnCache[elseIdx](varName, "");
	return "(" + ifPart + "?" + thenPart + ":" + elsePart + ")";
};

export const not = (dnaOpt: [any], varName: string = "v", fnCache: tsFnInlineCache): tsJSFuncReturnLong =>
	["", ["!" + fnCache[dnaOpt[0][0]](varName, ""), varName]];

export const anyOf = (dnaOpt: [any], varName: string = "v", fnCache: tsFnInlineCache): tsJSFuncReturn => {
	const indices = dnaOpt[0];
	return "(" + indices.map((idx: number) => fnCache[idx](varName, "")).join("||") + ")";
};

// Aliases pour compatibilité mapper
export { b as boolean, c as constType, e as enumType, F as falseLiteral, l as literal, n0 as nullType, T as trueLiteral };

