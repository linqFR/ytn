import type { tsDnaSeq, tsFnDNA, tsFnInlineCache, tsJSFuncReturn, tsMapper } from "./dna.type.js";

const VALIDATE_RETURN_PURE = ";return true;";

export const toJSValid = (mapper: tsMapper) => {
	return (arr: tsDnaSeq, varName: string = "v"): string => {
		const rootPath = "#";
		const inlineCache: tsFnInlineCache = {};
		const globalConst = new Set<string>();
		const globalLet = new Set<string>();

		globalLet.add("data=" + varName);

		let body: string[] = [];

		for (let idx = arr.length - 1; idx >= 0; idx--) {
			const item = arr[idx];
			const op = item[0];
			const args = item.slice(1);

			const fnToString = mapper[op] as tsFnDNA;
			if (!fnToString) throw new Error(`Unknown opcode in DNA: ${op}`);
			const res = fnToString(args, varName, inlineCache, rootPath);
			if (Array.isArray(res)) {
				if (res[1]) {
					const namer = "L" + idx.toString().padStart(4, "0");
					globalConst.add(namer + "=" + varName + "=>{" + res[1][0] + "}");
					inlineCache[idx] = (vn: string, pathVar: string): tsJSFuncReturn => namer + "(" + vn + ",'" + pathVar + "')";
					if (!idx) body.push(namer + "(" + varName + ",'" + rootPath + "')");
				}
			} else {
				if (!idx) body.push(res);
				else {
					const result = (vn: string, pathVar: string): tsJSFuncReturn => {
						return fnToString(args, vn, inlineCache, pathVar);
					};
					inlineCache[idx] = result;
				}
			}
		}
		const gConst = Array.from(globalConst);
		const gLet = Array.from(globalLet);
		const allConst = gConst.join(",");
		// In pure mode, the last expression in body is the validation result
		return (allConst ? "const " + allConst + ";" : "") + (gLet.length > 0 ? "let " + gLet.join(",") + ";" : "") + body.join("") + ";";
	};
};

/**
 * Crée un compilateur réutilisable pour un mapper donné (mode validation pure).
 */
export const createValidCompiler = (mapper: tsMapper) => {
	const validator = toJSValid(mapper);
	return {
		validate: (dna: tsDnaSeq) => new Function("v", validator(dna, "v")),
	};
};
