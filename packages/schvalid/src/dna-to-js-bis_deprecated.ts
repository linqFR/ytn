import type { tsDnaSeq, tsMapper, tsFnDNA, tsFnInlineCache, tsJSFuncReturn } from "./dna.type.js";
import { _PARSE_RETURN, _VALIDATE_RETURN } from "./toJS/dna-js-full.js";

/**
 * Unified DNA-to-JS compiler that supports both parsing/errors mode and pure validation mode.
 * 
 * @param mapper - The mapper object containing opcode-to-code-generator functions
 * @param validateMode - If true, generates pure boolean validation code (no error handling, no parsing)
 * @returns A function that takes a DNA sequence and variable name, and returns generated JavaScript code
 */
export const toJSBis = (mapper: tsMapper, validateMode = false) => {
	return (arr: tsDnaSeq, varName: string = "v"): string => {
		const rootPath = "#";
		const inlineCache: tsFnInlineCache = {};
		const globalConst = new Set<string>();
		const globalLet = new Set<string>();

		// Global declarations based on mode
		if (validateMode) {
			// Pure validation mode doesn't need errors array
			globalLet.add("data=" + varName);
		} else {
			globalConst.add("errors=[]");
			globalLet.add("data=" + varName);
		}

		let body: string[] = [];

		// Process DNA in reverse order to build inline cache properly
		for (let idx = arr.length - 1; idx >= 0; idx--) {
			const item = arr[idx];
			const op = item[0];
			const args = item.slice(1);

			const fnToString = mapper[op] as tsFnDNA;
			if (!fnToString) throw new Error(`Unknown opcode in DNA: ${op}`);
			
			const res = fnToString(args, varName, inlineCache, rootPath);
			
			if (Array.isArray(res)) {
				// Tuple return type: [code, [fnBody, fnVarName]]
				if (res[1]) {
					globalConst.add(declareFn(idx, res[1][0], res[1][1]));
					inlineCache[idx] = (vn: string, pathVar: string): tsJSFuncReturn => useFn(idx, vn, pathVar);
					if (!idx) body.push(useFn(idx, varName, rootPath));
				}
			} else {
				// String return type
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
		
		body.push(validateMode ? _VALIDATE_RETURN : _PARSE_RETURN);
		
		return (allConst ? "const " + allConst + ";" : "") + 
		       (gLet.length > 0 ? "let " + gLet.join(",") + ";" : "") + 
		       body.join("");
	};
};

/**
 * Creates a reusable compiler from a mapper and validateMode setting.
 * 
 * @param mapper - The mapper object containing opcode-to-code-generator functions
 * @param validateMode - If true, generates pure boolean validation code
 * @returns A function that takes a DNA sequence and returns a compiled Function
 */
export const createCompilerBis = (mapper: tsMapper, validateMode = false) => {
	const toJS = toJSBis(mapper, validateMode);
	
	return (dna: tsDnaSeq): Function => {
		const js = toJS(dna, "v");
		return new Function("v", js);
	};
};
