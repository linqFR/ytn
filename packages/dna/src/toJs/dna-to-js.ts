import { STEP } from "../shared/const-steps.js";
import type { tsDnaSeq } from "../types/core.types.js";
import type { tsJSParentCtx, tsLabelId, tsStackFrame } from "../types/dna-js.types.js";
import type { tsDnaExternals, tsDnaParserFn, tsDnaValidatorFn } from "../shared/runtime.types.js";
import * as basicHandlers from "./dna-js-json.js";
import * as builderHandlers from "./dna-js-builder.js";
import { getRegisteredExternals } from "@ytrynot/dna/core";
import { fastMergeArrays, PARSE_RETURN } from "./utils.js";

type tsMapperIndex = Record<string, any>;

/**
 * Parts for `new Function(...parts)`. Contains:
 * - an optional destructured-context argument string (e.g. `"{ext0,ext1}"`) when externals are referenced
 * - the function body string (e.g. `"return function(v){...};"`)
 *
 * When spread into `new Function(...parts)`, the first element (if present) becomes a
 * destructured parameter and the last element is the function body.
 */
export type tsCompiledParts = string[];

export type tsToJSResult = { code: tsCompiledParts; requiredExternals: string[]; };

type namerFn = (idx: number | string) => string;
const namer: namerFn = (idx: number | string) => "L" + idx.toString().padStart(4, "0");

export function toJS(validateMode: boolean, enhancedMapper: false): (dna: tsDnaSeq) => tsCompiledParts;
export function toJS(validateMode: boolean, enhancedMapper: true): (dna: tsDnaSeq) => tsToJSResult;
export function toJS(validateMode: boolean = true, enhancedMapper: boolean = false) {

	// Mapper for @ytrynot/schvalid (canonical DNA opcodes only)
	// Mapper for DNA builder (canonical + builder-specific opcodes)
	const mapper: tsMapperIndex = enhancedMapper ? { ...basicHandlers, ...builderHandlers } : basicHandlers;

	return (dna: tsDnaSeq): tsCompiledParts | tsToJSResult => {

		if (dna.length < 2) throw new Error("Invalid DNA");

		// const rootPath = "#";

		let varName = "v";
		const jsFnArgs = [varName];
		// const extHelpers = externals ? { ...jshelpers, ...externals } : jshelpers;
		const refList = new Set<number>(dna.slice(-1)[0]);

		const outerCtxArg: Record<string, boolean> = {};
		const outerCtxConst: Record<string, boolean> = {};
		const constBody: Record<string, boolean> = {};
		const letBody: Record<string, boolean> = {};
		const initBody: Record<string, boolean> = {};
		let isAsync: boolean = false;

		let target = "data";
		// CAST: tsJSParentCtx has required fields (isCond, outerblock, failCase) but {} is a temporary init reassigned immediately below
		let defaultCtx: tsJSParentCtx = {} as tsJSParentCtx;

		if (validateMode) { // true = pure validation
			target = "valid";
			defaultCtx = { isCond: true, failCase: "return false;", outerblock: "" };
		} else {
			defaultCtx = { isCond: false, failCase: "if(errors.length)return{success:false,errors};", outerblock: "" };
			target = "data";
			constBody["errors=[]"] = true;
		}
		letBody[target] = true;

		let labelIdCounter = 0;
		const labelId: tsLabelId = (v = 1) => v === 0 ? labelIdCounter : labelIdCounter++;
		let sBody = "";
		let swap = "";
		// let resBody = "";

		const stack: tsStackFrame[] = [[0, varName, target, "#", defaultCtx]];

		// Generate function declarations for references.
		// Each ref'd schema is compiled with `_ea`/`_eo` placeholder set names
		// for `parentCtx.unEvalArr/Obj`, so when the schema contains in-place
		// applicators (e.g. `properties` sibling of an outer `unevaluatedProperties`),
		// its annotations can be propagated back to the caller's eval set via the
		// function parameters. Callers who don't need this pass `undefined`
		// — the function preludes a dummy Set so the body operates safely either way.
		const refStack: tsStackFrame[] = [];
		for (const refIdx of refList) {
			const refDna = dna[refIdx];
			if (refDna) {
				// Fresh context per ref compilation: each ref'd schema produces an
				// independent validator function, so mutations on `parentCtx` (e.g.
				// `typeChecked`) MUST NOT leak across siblings. A previous ref
				// setting `typeChecked = "number"` would otherwise suppress the
				// type check in the next ref's body.
				const refDefaultCtx:tsJSParentCtx = { ...defaultCtx, unEvalArr: "_ea", unEvalObj: "_eo" };
				// Inject the runtime `_p` param into every baked-in error path this ref's
				// body produces: handlers build paths via plain string concatenation
				// (`pathVar + "/required/foo"`), and `_err` embeds the result inside a
				// single-quoted literal (`"path:'" + path + "'"`). Starting `pathVar`
				// as `"'+_p+'"` hijacks those quote boundaries so the FINAL generated
				// code reads `path:''+_p+'/required/foo'` — a real runtime concatenation
				// of the caller's actual path (`_p`) with this ref's own literal suffix,
				// instead of a fixed path baked in at compile time (wrong for a shared
				// function referenced from multiple call sites with different paths).
				const refSteps = mapper[refDna[0]](refDna.slice(1), "v", "d", validateMode ? "#" : "'+_p+'", labelId, refDefaultCtx);
				if (typeof refSteps === "string") {
					refStack.push([STEP.STR_REF, refSteps, refIdx, "", refDefaultCtx]);
					continue;
				}
				refStack.push([STEP.START_REF, ""])
				fastMergeArrays(refStack, refSteps)
				refStack.push([STEP.END_REF, refIdx, "", "", refDefaultCtx])
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
		// Hashmap, not Set: the body of every ref'd schema accesses `_ea`/`_eo`
		// via property access (`set[k]=1`, `for(const k in set)`, `Object.keys(set).length`).
		// A plain object is strictly faster than `Set` for that access pattern
		// (monomorphic prop access vs megamorphic builtin call).

		while (stack.length > 0) {
			const frame = stack.pop()!;
			const dnaId = frame[0];
			const ctx = frame[1];
			const outVar = frame[2] ?? "";
			// CAST: {} fallback is never read (action steps continue before accessing isCond) but TS cannot prove it
			const parentCtx = frame[4] ?? {} as tsJSParentCtx; // Additional metadata for special handling

			switch (dnaId) {
				case STEP.BODY:
					sBody += ctx;
					continue;
				case STEP.CONST:
					constBody[ctx as string] = true;
					continue;
				case STEP.LET:
					letBody[ctx as string] = true;
					continue;
				case STEP.START_REF:
					swap = sBody;
					sBody = "";
					continue;
				case STEP.END_REF: {
					let letD = "let d;", returnD = parentCtx.isCond ? "!!d;":"d;";
					// `_p` is the caller's current path (a runtime string, since a single
					// compiled ref function is shared by every call site referencing it —
					// see the `ref` handler, which passes its own `pathVar` as `_p`). Only
					// needed in parse mode: `_err` (and thus any path) is never built when
					// `isCond` (see `_errMode` in `utils.ts`).
					const params = parentCtx.isCond ? "(v,_ea={},_eo={})" : '(v,errors,_p="#",_ea={},_eo={})';

					// Prelude: if caller didn't pass eval sets (`_ea`/`_eo` undefined),
					// allocate dummy ones so the body's `.add()` calls don't crash.
					// The dummies are discarded after return — no propagation.
					const fnName = namer(ctx as number | string);
					const visit = fnName + ".visit";
					outerCtxConst[fnName + "=" + params + "=>{"
						// + visit + "??=new Map();"
						+ "if(" + visit + ".has(v))return " + visit + ".get(v);" + visit + ".set(v,true);"
						+ letD
						+ sBody
						+ visit + ".set(v,d);return " + returnD
						+ "}"
					] = true;
					initBody[visit + "=new Map();"] = true;
					sBody = swap;
					swap = "";
					continue;
				}
				case STEP.STR_REF: {
					// Same signature as END_REF: `(v, _ea, _eo)` in validate mode, `(v, errors, _p, _ea, _eo)`
					// in parse mode — dummy-init prelude so callers can pass eval-set names
					// for in-place applicator propagation.
					let letD = "let d;", returnD = parentCtx.isCond ? "!!d;":"d;";
					const params = parentCtx.isCond ? "(v,_ea={},_eo={})" : '(v,errors,_p="#",_ea={},_eo={})';
					
					const fnName = namer(outVar);
					const visit = fnName + ".visit";
					outerCtxConst[fnName + "=" + params + "=>{"
						// + visit+"??=new Map();"
						+ "if(" + visit + ".has(v))return " + visit + ".get(v);" + visit + ".set(v,true);"
						+ letD
						+ ctx + visit + ".set(v,d);return " + returnD
						+ "}"
					] = true;
					initBody[visit + "=new Map();"] = true;
					continue;
				}
				case STEP.OUT_ARG: outerCtxArg[ctx as string] = true; continue;
				case STEP.OUT_CONST: outerCtxConst[ctx as string] = true; continue;
				case STEP.ASYNC: isAsync = true; continue;
			}

			const step = dna[dnaId];
			const pathVar = frame[3] ?? "#";
			const steps = mapper[step[0]](step.slice(1), ctx, outVar, pathVar, labelId, parentCtx);

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
		const _constBody = Object.keys(constBody);
		const _letBody = Object.keys(letBody);
		const _initBody = Object.keys(initBody);
		const body = (_constBody.length ? "const " + _constBody.join(',') + ";" : "")
			+ (_letBody.length ? "let " + _letBody.join(',') + ";" : "")
			+ (_initBody.length ? _initBody.join('') : "")
			+ sBody
			+ (validateMode ? "return !!" + target + ";" : PARSE_RETURN);

		// if (context) {
		// 	// Generate wrapper function with context in closure
		// 	const contextKeys = Object.keys(context);
		// 	const contextArgs = contextKeys.join(',');
		// 	const contextAssign = contextKeys.map(k => k + ":" + k).join(',');
		// 	return [
		// 		...jsFnArgs,
		// 		"const context={" + contextAssign + "};return " + body
		// 	];
		// }

		const _outerCtxArg = Object.keys(outerCtxArg);
		const _outerCtxConst = Object.keys(outerCtxConst);
		const toJSArgFn = [];
		if (_outerCtxArg.length) toJSArgFn.push("{" + _outerCtxArg + "}");
		toJSArgFn.push(
			(_outerCtxConst.length ? "const " + _outerCtxConst.join(",") + ";" : "")
						+ "return " + (isAsync ? "async " : "") + "function(" + jsFnArgs.join(",") + "){" + body + "};"
		)

		return enhancedMapper ? { code: toJSArgFn, requiredExternals: _outerCtxArg } : toJSArgFn;
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

// schvalid-specific validator/parser (canonical DNA opcodes only)
export const validator = (dna: tsDnaSeq /* , externals?: tsDnaExternals */): tsDnaValidatorFn => new Function(...toJS(true, false)(dna))();
export const parser = (dna: tsDnaSeq /* , externals?: tsDnaExternals */): tsDnaParserFn => new Function(...toJS(false, false)(dna))();

// Default validator/parser use builderMapper (for DNA builder API)
export const validatorBuilder = (dna: tsDnaSeq, externals?: tsDnaExternals) => {
	const { code, requiredExternals } = toJS(true, true)(dna);
	const fn = new Function(...code)({ ...getRegisteredExternals(), ...externals });
	fn.requiredExternals = requiredExternals;
	// CAST: new Function returns any; document the concrete return type with the requiredExternals field
	return fn as tsDnaValidatorFn & {requiredExternals:string[]};
};
export const parserBuilder = (dna: tsDnaSeq, externals?: tsDnaExternals) => {
	const { code, requiredExternals } = toJS(false, true)(dna);
	const fn = new Function(...code)({ ...getRegisteredExternals(), ...externals });
	fn.requiredExternals = requiredExternals;
	// CAST: new Function returns any; document the concrete return type with the requiredExternals field
	return fn as tsDnaParserFn & {requiredExternals:string[]};
};



