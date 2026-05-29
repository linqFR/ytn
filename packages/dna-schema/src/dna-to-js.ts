import type { tsDnaSeq, tsJSStepAct, tsJSStepOp, tsLaberlId } from "./dna.type.js";
import jshelpers from "./toJS/jshelpers.js";
import * as mapperBis from "./toJS/dna-js-full.js";
import { fastMergeArrays, PARSE_RETURN, STEP } from "./toJS/utils.js";




type namerFn = (idx: number) => string;
const namer: namerFn = (idx: number | string) => "L" + idx.toString().padStart(4, "0");
const declareFn = (idx: number, body: string, suffix = "") => namer(idx) + "=(" + suffix + ")=>{" + body + "}"; //format 0000
const declareBlock = (idx: number, body: string) => namer(idx) + "{" + body + "}"; //format 0000
const useFn = (idx: number, source: string, pathVar: string) => namer(idx) + '(' + source + ',"' + pathVar + '")';



export const toJS = (validateMode: boolean = true, externals?: Record<string, string | Function>) => {
	return (dna: tsDnaSeq): string[] => {

		if (dna.length < 3) throw new Error("Invalid DNA");

		// const rootPath = "#";

		let varName = "v";
		const jsFnArgs = [varName];
		const extHelpers = externals ? { ...jshelpers, ...externals } : jshelpers;
		const dnaConfig = dna.slice(-2);
		const refList = new Set(dnaConfig[0]);
		const extras = dnaConfig[1];


		const constBody = new Set<string>();
		const letBody = new Set<string>();
		const initBody = new Set<string>();

		let target = "data";
		let defaultCtx = {};

		if (validateMode) { // true = pure validation
			target = "valid";
			defaultCtx = { isCond: true }
		} else {
			target = "data";
			constBody.add("errors=[]");
		}
		letBody.add(target);

		if (typeof extHelpers === 'object' && extHelpers !== null) {
			let extraIdx = extras.length;
			for (; extraIdx--;) {
				let ext = extras[extraIdx] as string
				const fn = extHelpers[ext];
				switch (typeof fn) {
					case "string":
						ext += "=" + fn
						break;
					case "function":
						ext += "=" + fn.toString()
						break;
				}
				jsFnArgs.push(ext);
			}
		} else jsFnArgs.push(...extras);

		let labelIdCounter = 0;
		const labelId: tsLaberlId = (v = 1) => v === 0 ? labelIdCounter : labelIdCounter++;
		let sBody = "";
		let swap = "";
		// let resBody = "";

		const stack: tsJSStepOp[] = [[0, varName, target, "#", defaultCtx]];

		// Generate function declarations for references.
		// Each ref'd schema is compiled with `_ea`/`_eo` placeholder set names
		// for `parentCtx.unEvalArr/Obj`, so when the schema contains in-place
		// applicators (e.g. `properties` sibling of an outer `unevaluatedProperties`),
		// its annotations can be propagated back to the caller's eval set via the
		// function parameters. Callers who don't need this pass `undefined`
		// — the function preludes a dummy Set so the body operates safely either way.
		const refStack: tsJSStepOp[] = [];
		for (const refIdx of refList) {
			const refDna = dna[refIdx];
			if (refDna) {
				// Fresh context per ref compilation: each ref'd schema produces an
				// independent validator function, so mutations on `parentCtx` (e.g.
				// `typeChecked`) MUST NOT leak across siblings. A previous ref
				// setting `typeChecked = "number"` would otherwise suppress the
				// type check in the next ref's body.
				const refDefaultCtx = { ...defaultCtx, unEvalArr: "_ea", unEvalObj: "_eo" };
				const refSteps = mapperBis[refDna[0]](refDna.slice(1), "v", "d", refDna[refDna.length - 1]["uri"], labelId, refDefaultCtx);
				if (typeof refSteps === "string") {
					refStack.push([STEP.STR_REF, refSteps, refIdx, "", refDefaultCtx]);
					continue;
				}
				refStack.push([STEP.START_REF, ""])
				fastMergeArrays(refStack, refSteps)
				refStack.push([STEP.END_REF, refIdx])
			}
		}
		if (refStack.length > 0) {
			// constBody.add("visited=new Map()")
			let i = refStack.length, j = stack.length;
			stack.length += i;
			// step are given in the order of writing code
			// as stack pops out the last items, we MUST stack in the reserve order
			if (i) while (i--) stack[j++] = refStack[i];
		}
		const evalPrelude = "_ea||(_ea=new Set());_eo||(_eo=new Set());";

		while (stack.length > 0) {
			const frame: tsJSStepOp | tsJSStepAct = stack.pop()!;
			const dnaId = frame[0];
			const ctx = frame[1];
			const outVar = frame[2] ?? "";
			const parentCtx = frame[4] ?? {}; // Additional metadata for special handling

			switch (dnaId) {
				case STEP.BODY:
					sBody += ctx;
					continue;
				case STEP.CONST:
					constBody.add(ctx);
					continue;
				case STEP.LET:
					letBody.add(ctx);
					continue;
				case STEP.START_REF:
					swap = sBody;
					sBody = "";
					continue;
				case STEP.END_REF: {
					let letD = "let d;", returnD = "d;";
					if (parentCtx.isCond) { letD = ""; returnD = "!!d;" }
					
					// Prelude: if caller didn't pass eval sets (`_ea`/`_eo` undefined),
					// allocate dummy ones so the body's `.add()` calls don't crash.
					// The dummies are discarded after return — no propagation.
					const fnName = namer(ctx);
					const visit = fnName + ".visit";
					constBody.add(fnName + "=(v,_ea,_eo)=>{" 
						// + visit + "??=new Map();"
						+ "if(" + visit + ".has(v))return " + visit + ".get(v);" + visit + ".set(v,true);"
						+ evalPrelude
						+ letD
						+ sBody
						+ visit + ".set(v,d);return " + returnD
						+ "}"
					)
					initBody.add(visit+"=new Map();");
					sBody = swap;
					swap = "";
					continue;
				}
				case STEP.STR_REF: {
					// Same signature as END_REF: `(v, _ea, _eo)` with dummy-init prelude
					// so callers can pass eval-set names for in-place applicator propagation.
					let letD = "let d;", returnD = "d;";
					if (parentCtx.isCond) { letD = ""; returnD = "!!d;" }
					const fnName = namer(outVar);
					const visit = fnName + ".visit";
					constBody.add(fnName + "=(v,_ea,_eo)=>{" 
						// + visit+"??=new Map();"
						+ "if(" + visit + ".has(v))return " + visit + ".get(v);" + visit + ".set(v, true);"
						+ evalPrelude
						+ letD
						+ "let " + (parentCtx.isCond ? "d;" : "") + ctx + visit + ".set(v,d);return "+ returnD
						+ "}"
					);
					initBody.add(visit+"=new Map();");
					continue;
				}
			}

			const step = dna[dnaId];
			const pathVar = frame[3] ?? "#";
			const steps = mapperBis[step[0]](step.slice(1), ctx, outVar, pathVar, labelId, parentCtx);

			// Handle simple validators that return strings instead of steps
			if (typeof steps === "string") {
				sBody += steps;
				continue;
			}

			let i = steps.length, j = stack.length;
			stack.length += i;
			// step are given in the order of writing code
			// as stack pops out the last items, we MUST stack in the reserve order
			if (i) while (i--) stack[j++] = steps[i];

		}
		return [
			...jsFnArgs,
			(constBody.size ? "const " + Array.from(constBody).join(',') + ";" : "")
			+ (letBody.size ? "let " + Array.from(letBody).join(',') + ";" : "")
			+ (initBody.size ? Array.from(initBody).join('') : "")
			+ sBody
			// + resBody
			+ (validateMode ? "return !!" + target + ";" : PARSE_RETURN)];
	};
};

// export const createCompiler = (mapper: tsMapper, extras?: Record<string, string | Function>) => {
// 	const parser = toJS(mapper, false, mapper);
// 	const validator = toJS(mapper, true, mapper);
// 	return {
// 		parse: (dna: tsDnaSeq) => new Function(...parser(dna)),
// 		validate: (dna: tsDnaSeq) => new Function(...validator(dna)),
// 	};
// };

export const validator = (dna: tsDnaSeq) => new Function(...toJS(true, mapperBis)(dna));
export const parser = (dna: tsDnaSeq) => new Function(...toJS(false, mapperBis)(dna));

// export const parseFactory = (dna: tsDnaSeq, mapper: tsMapper): Function => createCompiler(mapper).parse(dna);
// export const validateFactory = (dna: tsDnaSeq, mapper: tsMapper): Function => createCompiler(mapper).validate(dna);


