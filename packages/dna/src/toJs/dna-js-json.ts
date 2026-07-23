import type { tsDnaInnerMeta } from "../shared/meta-context.type.js";
import { STEP } from "../shared/const-steps.js";
import { getStringFormatPattern } from "../shared/string-format.js";
import type {
	tsArrayDNA,
	tsConstDNA, tsIfThenElseDNA,
	tsJSFn,
	tsJSFuncReturn, tsJSParentCtx,
	tsJSStepAct,
	tsJSStepOp,
	tsJSStepString,
	tsLaberlId,
	tsNumberDNA,
	tsObjectDNA,
	tsOfList,
	tsStackFrame,
	tsStringDNA,
} from "../types/index.js";
import {
	simpleNodeToJs,
	_err,
	_errMode,
	ERR_UNDEF,
	ERR_UNDEF_,
	fastMergeArrays,
	namer,
	tojsStr
} from "./utils.js";
import { FN_cidrV6, FN_dEq, FN_fCount } from "./inline-func.js";

// Shared type test

const TEST_STRING = (inVar: string) => "typeof " + inVar + '==="string"';
const TEST_OBJECT = (inVar: string) => "typeof " + inVar + '==="object"&&' + inVar + "!==null&&!Array.isArray(" + inVar + ")";
const TEST_NUMBER = (inVar: string) => "typeof " + inVar + '==="number"&&Number.isFinite(' + inVar + ")";

/**
 * Statement-level envelope for collection validators (object / array).
 * See companion scalar helper `_assignOrCond`.
 * Factors the shared boilerplate (own-block, type-validation matrix, preChecks,
 * postChecks, trailing counter + out=true). Caller provides loops/sub-DNA via
 * `innerSteps`.
 */
type tsCondEnvOpts = {
	block: string;
	break_: string;
	_break_: string;
	mustMatchType: boolean;
	typeChecked: "array" | "object";
	typePosTest: string;
	typeErrMsg: string;
	preDecls: string;
	preChecks: [string, string][];
	extraInits: string;
	innerSteps: tsStackFrame[];
	postChecks: [string, string][];
	parserOutInit: string;
};

const _assignOrCondEnv = (parentCtx: tsJSParentCtx, inVar: string, outVar: string, opts: tsCondEnvOpts): tsStackFrame[] => {
	const {
		block, break_, _break_, mustMatchType, typeChecked,
		typePosTest, typeErrMsg, preDecls, preChecks, extraInits,
		innerSteps, postChecks, parserOutInit,
	} = opts;

	const isCond = parentCtx.isCond;
	const hasOut = outVar.length > 0;
	const counter = parentCtx.counter ?? "";

	const beenTested = parentCtx.typeChecked === typeChecked;
	const typeNegTest = "!(" + typePosTest + ")";

	const steps: tsStackFrame[] = [];
	if (block.length) steps.push([STEP.BODY, block + ":{"]);

	if (isCond) {
		let validation = "", validationEnd = "";
		if (beenTested) {
			// already type-checked upstream
		} else if (!mustMatchType) {
			validation = "if(" + typePosTest + "){";
			validationEnd = "}";
		} else if (counter) {
			// declared with counter: bad type bails out without incrementing the counter
			validation = "if(" + typeNegTest + "){" + break_ + "}";
		} else {
			validation = "if(" + typeNegTest + ")" + break_;
		}

		const headBody =
			validation
			+ preDecls
			+ (preChecks.length ? "if((" + preChecks.map(it => it[0]).join(")||(") + "))" + break_ : "")
			+ extraInits;
		if (headBody) steps.push([STEP.BODY, headBody]);

		fastMergeArrays(steps, innerSteps);

		// IMPORTANT placement: in `!declared` mode, the `if(typePosTest){...}` wraps
		// preChecks/body/postChecks/counter — but `_out=true` must be emitted
		// AFTER `validationEnd` (i.e. unconditionally), so that a type mismatch
		// in an undeclared schema still resolves as success (JSON-Schema semantics).
		const tail =
			(postChecks.length ? "if((" + postChecks.map(it => it[0]).join(")||(") + "))" + break_ : "")
			+ (counter ? (Array.isArray(counter) ? counter.join(";") : counter) + ";" : "")
			+ validationEnd
			+ (outVar ? outVar + "=true;" : "");
		if (tail) steps.push([STEP.BODY, tail]);

	} else {
		const typeCheck = beenTested ? ""
			: "if(" + typeNegTest + "){"
			+ (mustMatchType ? typeErrMsg : (hasOut ? outVar + "=" + inVar : inVar))
			+ _break_
			+ "}";

		const headBody =
			typeCheck
			+ preDecls
			+ preChecks.map(it => "if(" + it[0] + "){" + it[1] + _break_ + "}").join("")
			+ extraInits
			+ (hasOut ? parserOutInit : "");
		if (headBody) steps.push([STEP.BODY, headBody]);

		fastMergeArrays(steps, innerSteps);

		const tail =
			postChecks.map(it => "if(" + it[0] + "){" + it[1] + _break_ + "}").join("")
			+ (counter ? (Array.isArray(counter) ? counter.join(";") : counter) + ";" : "");
		if (tail) steps.push([STEP.BODY, tail]);
	}

	if (block.length) steps.push([STEP.BODY, "}"]);

	parentCtx.typeChecked = typeChecked;
	return steps;
};

/**
 * Unified envelope for `unevaluatedItems` / `unevaluatedProperties`.
 *
 * Replaces the duplicated structure that lived in `unevaluatedItems_old` and
 * `unevaluatedProperties_old`. Centralizes:
 *   - opening `<eval>B<idx>` block
 *   - allocating the local `<eval>Set<idx>` set
 *   - dispatching every `seq` child with our set as their `unEvalArr/unEvalObj`
 *   - the single positive type check (skipped when `parentCtx.typeChecked` matches)
 *   - the three branches of `unEvalSchema`: `false`, `true`, sub-schema
 *   - propagation of the local set to the parent's set at end
 *
 * Naming invariant (also enforced for downstream callers):
 *   `parentCtx.unEvalArr` / `parentCtx.unEvalObj` are ALWAYS a bare set name,
 *   never a `.add(...)` statement nor a full loop. Statement emission is the
 *   responsibility of THIS layer.
 */
type tsUnEvalKind = "items" | "properties";

const _unEvalEnv = (parentCtx: tsJSParentCtx, opts: { kind: tsUnEvalKind; idx: number; seq: number[]; unEvalSchema: number | boolean; inVar: string; outVar: string; pathVar: string; }): tsStackFrame[] => {
	const { kind, idx, seq, unEvalSchema, inVar, outVar, pathVar } = opts;
	const isArr = kind === "items";
	const isCond = parentCtx.isCond;

	const block = (isArr ? "evalIB" : "evalPB") + idx;
	const evalSet = (isArr ? "evalISet" : "evalPSet") + idx;
	const ctxKey: "unEvalArr" | "unEvalObj" = isArr ? "unEvalArr" : "unEvalObj";
	const typeChecked = isArr ? "array" : "object";
	const typeName = isArr ? "Items" : "Properties";

	const typePosTest = isArr
		? "Array.isArray(" + inVar + ")"
		// : '(typeof ' + inVar + '==="object"&&' + inVar + '!==null&&!Array.isArray(' + inVar + '))';
		: "(" + TEST_OBJECT(inVar) + ")";

	const beenTested = parentCtx.typeChecked === typeChecked;
	// `innerBreak_` exits the local block as a *vacuous success* (skip-OK on
	// type-mismatch). `outerBreak_` propagates a *real failure* to the parent's
	// failCase — necessary because the parent may unconditionally set its own
	// success marker after dispatching us (e.g. `properties` handler adds the key
	// to its eval set right after the child returns). Swallowing failures into
	// the local block would let those markers fire on invalid input.
	const innerBreak_ = "break " + block + ";";
	// When dispatched by a *break-pattern* parent (e.g. `properties` handler
	// which unconditionally fires its eval-marker AFTER the child returns), we
	// must escalate failures to that parent's failCase to skip the marker.
	// When dispatched by a *counter-pattern* parent (oneOf/anyOf/allOf branches
	// have no failCase), fall back to the local block: skipping
	// our own success markers is enough — the counter naturally stays unset
	// and the combinator detects "this branch didn't match".
	const outerBreak_ = parentCtx.failCase;
	const ifErrBreak_ = isCond ? "" : "if(errors.length)" + outerBreak_;

	const lengthExpr = isArr ? inVar + ".length" : "Object.keys(" + inVar + ").length";
	const parentSet = parentCtx[ctxKey];
	let propagateAtEnd = !!parentSet;

	const steps: tsStackFrame[] = [];
	steps.push(
		[STEP.BODY, block + ":{"],
		[STEP.BODY, "const " + evalSet + "=Object.create(null);"]
	);
	if (!isCond) steps.push([STEP.BODY, outVar + "=" + inVar + ";"]);

	// (1) dispatch every seq child with OUR evalSet as their unEval target.
	// CRUCIAL: strip `counter` from children's ctx. If we passed the parent's
	// counter through, a child's "success" would fire it BEFORE we get to
	// validate the `unEvalSchema` check (which may reject). A late rejection
	// then can't un-fire the counter — leading to outer combinators (anyOf/allOf)
	// treating us as a match incorrectly. We fire `parentCtx.counter` ourselves
	// at the END (after all checks pass).
	const seqChildCtx: tsJSParentCtx = {
		...parentCtx,
		counter: undefined,
		[ctxKey]: evalSet,
		failCase: isCond ? innerBreak_ : "if(errors.length)" + innerBreak_,
		outerblock: block,
		isCond,
	} as tsJSParentCtx;
	for (let i = 0; i < seq.length; i++) {
		if (i > 0) steps.push([STEP.BODY, ifErrBreak_]);
		steps.push([seq[i], inVar, isCond ? "" : outVar, pathVar, seqChildCtx]);
	}

	// (2) type check (skip if upstream already validated).
	// Per JSON Schema: `unevaluated*` is a no-op on values of the "wrong" type
	// (booleans, numbers, strings, null, opposite container kind). For these,
	// validation succeeds (vacuous) — so we fire BOTH the parent's counter and
	// the local `outVar=true;` BEFORE breaking out of our block.
	if (!beenTested) {
		const passthrough = isCond
			? (parentCtx.counter ? parentCtx.counter + ";" : "") + (outVar ? outVar + "=true;" : "")
			: outVar + "=" + inVar + ";";
		steps.push([STEP.BODY, "if(!" + typePosTest + "){" + passthrough + innerBreak_ + "}"]);
	}

	// (3) unEvalSchema branches
	if (typeof unEvalSchema === "boolean") {
		if (!unEvalSchema) {
			// FALSE → success requires every key/index to be in evalSet
			const failAction = isCond
				? (outerBreak_ || innerBreak_)
				: (_err(parentCtx, inVar, pathVar + "/unevaluated" + typeName, "Unevaluated " + (isArr ? "items" : "properties") + " are not allowed") + ";" + outerBreak_);
			steps.push([STEP.BODY, "if(" + lengthExpr + ">Object.keys(" + evalSet + ").length){" + failAction + "}"]);
		} else {
			// TRUE → accept everything; copy directly to parent if any (skip
			// redundant forEach), and in parser mode copy un-evaluated to outVar
			if (parentSet) {
				steps.push([STEP.BODY, isArr
					? "for(let i=" + inVar + ".length;i--;)" + parentSet + "[i]=1;"
					: "for(const k of Object.keys(" + inVar + "))" + parentSet + "[k]=1;"
				]);
				propagateAtEnd = false;
			}
			if (!isCond) {
				steps.push([STEP.BODY, isArr
					? "for(let i=" + inVar + ".length;i--;){if(!" + evalSet + "[i])" + outVar + "[i]=" + inVar + "[i];}"
					: "for(const k of Object.keys(" + inVar + ")){if(!" + evalSet + "[k])" + outVar + "[k]=" + inVar + "[k];}"
				]);
			}
		}
	} else {
		// SCHEMA → iterate keys/indices NOT in evalSet, validate each.
		// Sub-DNA gets `failCase` only: validation failure breaks our block
		// (whole unEval fails), success falls through and we emit the
		// `<evalSet>.add(k);` ourselves (we own the lexical key/index).
		const enumOpen = isArr
			? "for(let i=" + inVar + ".length;i--;){const k=i,val=" + inVar + "[i];"
			: "for(const k of Object.keys(" + inVar + ")){const val=" + inVar + "[k];";
		const childOutVar = isCond ? "" : outVar + "[k]";
		const childCtx: tsJSParentCtx = {
			isCond,
			failCase: parentCtx.failCase, outerblock: parentCtx.outerblock || block,
		};

		steps.push([STEP.BODY, enumOpen + "if(!" + evalSet + "[k]){"]);
		steps.push([unEvalSchema, "val", childOutVar, pathVar + "/unevaluated" + typeName, childCtx]);
		steps.push([STEP.BODY,
		(isCond ? "" : "if(errors.length)" + outerBreak_)
		+ evalSet + "[k]=1;"
		+ "}}"
		]);
	}

	// (4) propagate our set to parent (chains with oneOf/allOf/anyOf/nested unEval)
	if (propagateAtEnd) {
		steps.push([STEP.BODY, "for(const k in " + evalSet + ")" + parentSet + "[k]=1;"]);
	}

	// (5) cond-mode success markers — only reached if all checks passed:
	//   - parent's counter (we're a child of anyOf/allOf/oneOf/...): fire ONCE here
	//   - local `outVar=true;` (we're producing a result directly)
	if (isCond) {
		const tail = (parentCtx.counter ? parentCtx.counter + ";" : "") + (outVar ? outVar + "=true;" : "");
		if (tail) steps.push([STEP.BODY, tail]);
	}

	steps.push([STEP.BODY, "}"]);
	return steps;
};

export const assign = (dnaOpt: [number[], tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx) => {
	if (parentCtx.isCond) return (parentCtx.counter ? parentCtx.counter + ";" : "");
	else return _outVarName + "=" + _inVarName + ";";
}

export const chk = (dnaOpt: [number[], tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsStackFrame[] => {
	const seq = dnaOpt[0];
	const isCond = parentCtx.isCond;
	const idx = labelId();
	const chkBlock = "chkB" + idx;
	const steps: tsStackFrame[] = [];
	const ctx = { ...parentCtx, counter: undefined, outerblock: parentCtx.outerblock || chkBlock };
	const condCtx = { ...ctx, failCase: parentCtx.failCase || ("break " + chkBlock + ";") }; //FIXME: weird way to do it

	steps.push([STEP.BODY, chkBlock + ":{"]);
	if (isCond) {
		for (let i = 0; i < seq.length; i++) {
			const it = seq[i];
			steps.push(
				[it, _inVarName, "", pathVar, { ...condCtx }],
			);
		}
		steps.push([STEP.BODY, (_outVarName ? _outVarName + "=true;" : "") + (parentCtx.counter ? parentCtx.counter + ";" : "") + "}"]);
	} else {
		for (let i = 0; i < seq.length; i++) {
			const it = seq[i];
			steps.push(
				[it, _inVarName, _outVarName, pathVar, { ...ctx }],
			);
		}
		steps.push([STEP.BODY, "}"]);
	}
	return steps;
}

export const ref = (dnaOpt: [number, tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFuncReturn => {
	const opt = dnaOpt[0];
	// Forward caller's eval-sets to the ref'd function when present (in-place
	// applicator semantic — e.g. `$ref` sibling of `unevaluatedProperties`).
	// When `parentCtx.unEvalArr/Obj` is undefined (nested via properties/items,
	// or no uneval context), we pass `undefined` and the function preludes a
	// dummy set internally → no propagation back to caller.
	const ea = parentCtx.unEvalArr, eo = parentCtx.unEvalObj;
	const refArgs = [_inVarName];
	// The compiled ref function has 2 signatures: (v, _ea, _eo) in Validate (isCond) Mode and (v, errors, _p, _ea, _eo) in Parse Mode.
	// `_p` only exists in parse mode: `_err` (and thus any path) is never built
	// when `isCond` (see `_errMode` in `utils.ts`), so validate mode has nothing
	// to pass a path for.
	if (!parentCtx.isCond) {
		refArgs.push("errors");
		// `_p` is THIS call site's actual path (e.g. "#/self") — the ref function is
		// shared across every place that references it, so its baked-in error paths
		// are compiled relative to a runtime `_p` param instead of a fixed literal
		// (see `dna-to-js.ts`'s `'+_p+'` injection). Every call site must pass its
		// own path here for that runtime concatenation to produce a correct result.
		// Wrapped the SAME way `_err` wraps paths (single quotes, not JSON.stringify):
		// when this call site is itself INSIDE another ref's body, `pathVar` already
		// contains a `'+_p+'` injection marker — JSON.stringify would re-escape it
		// into inert text instead of leaving it as a live runtime expression.
		refArgs.push("'" + pathVar + "'");
	}
	if (ea || eo) {
		refArgs.push(ea ?? "undefined");
		refArgs.push(eo ?? "undefined");
	}
	const res = namer(opt) + "(" + refArgs.join(",") + ")";
	// In parser mode, `L####` returns the parsed value (or an error object); do not
	// wrap it in a `test ? input : input` ternary that discards transforms/defaults.
	if (parentCtx.isCond) {
		return simpleNodeToJs(parentCtx, _inVarName, _outVarName, "", res, "", "", true);
	}
	return _outVarName + "=" + res + ";" + parentCtx.failCase;
}

export const type = (dnaOpt: [string[], tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const indices = dnaOpt[0];
	const tests: string[] = [];
	for (let i = 0; i < indices.length; i++) {
		switch (indices[i]) {
			case "string": tests.push(TEST_STRING(_inVarName)); break;
			case "number": tests.push(TEST_NUMBER(_inVarName)); break;
			case "integer": tests.push('typeof ' + _inVarName + '==="number"&&Number.isInteger(' + _inVarName + ')'); break;
			case "boolean": tests.push('typeof ' + _inVarName + '==="boolean"'); break;
			case "null": tests.push(_inVarName + '===null'); break;
			case "object": tests.push(TEST_OBJECT(_inVarName)); break;
			case "array": tests.push('Array.isArray(' + _inVarName + ')'); break;
		}
	}
	if (tests.length === 0) return "";
	// Positive disjunction: "value is one of these types". Routed through
	// `_assignOrCond` so it handles cond/parser/counter modes uniformly
	// (the old impl emitted `errors.push` directly, breaking validator mode).
	const test = "(" + tests.join(")||(") + ")";
	const errMsg = _err(parentCtx, _inVarName, pathVar + "/type", "Data should be valid to at least one type of:" + indices.join(", ")) + ERR_UNDEF;
	return simpleNodeToJs(parentCtx, _inVarName, _outVarName, errMsg, test, "", "", true);
};

const string = (dnaOpt: tsStringDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx, declared: boolean): tsJSFn => {
	const opt = dnaOpt[0], min = opt[0], max = opt[1], pattern = opt[2], format = opt[3];
	const isCond = parentCtx.isCond;
	const body: string[] = [];
	const test = parentCtx.typeChecked === "string" ? "" : TEST_STRING(_inVarName);
	const steps: tsJSStepAct[] = [];

	if (min !== null || max !== null) {
		steps.push([STEP.OUT_CONST, FN_fCount]);
	};

	if (min !== null) body.push(_errMode(isCond,
		"strCnt>=" + String(min),
		_err(parentCtx, _inVarName, pathVar + "/string/minLength", "String length must be at least " + String(min)) + ERR_UNDEF
	));
	if (max !== null) body.push(_errMode(isCond,
		"strCnt<=" + String(max),
		_err(parentCtx, _inVarName, pathVar + "/string/maxLength", "String length must be at most " + String(max)) + ERR_UNDEF
	));

	if (pattern !== null) body.push(_errMode(isCond,
		// `u` flag: enables Unicode-aware regex (e.g. `\p{Letter}`). JSON Schema's
		// ECMA-262 dialect supports these only in Unicode mode.
		"/" + pattern + "/u.test(" + _inVarName + ")",
		_err(parentCtx, _inVarName, pathVar + "/string/pattern", "String must match pattern " + pattern) + ERR_UNDEF
	));


	const formatPattern = format !== null ? getStringFormatPattern(format) : undefined;
	if (formatPattern) body.push(_errMode(isCond,
		"/" + formatPattern + "/" + (["emoji"].includes(format!) ? "u" : "") + ".test(" + _inVarName + ")",
		_err(parentCtx, _inVarName, pathVar + "/string/format", "String must match format :" + format) + ERR_UNDEF
	));

	const errMsg = _err(parentCtx, _inVarName, pathVar + "/string", "String is required") + ERR_UNDEF;
	const preBody = (min !== null || max !== null) ? "strCnt=fCount(" + _inVarName + ");" : "";

	const res = simpleNodeToJs(parentCtx, _inVarName, _outVarName, errMsg, test, preBody, body, declared);

	steps.push([STEP.BODY, res]);
	parentCtx.typeChecked = "string";
	return steps;
};

export const s = (dnaOpt: tsStringDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn =>
	string(dnaOpt, _inVarName, _outVarName, pathVar, labelId, parentCtx, true);
export const _s = (dnaOpt: tsStringDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn =>
	string(dnaOpt, _inVarName, _outVarName, pathVar, labelId, parentCtx, false);

const number = (dnaOpt: tsNumberDNA, type = "n", _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx, declared = true): tsJSStepString => {
	const opt = dnaOpt[0], min = opt[0], exclMin = opt[1], max = opt[2], exclMax = opt[3], multOf = opt[4];
	const body: string[] = [];
	const isCond = parentCtx.isCond;

	let test = "", typeName = "", suffix = "";
	switch (type) {
		case "n":
			typeName = "number";
			test = TEST_NUMBER(_inVarName);

			break;
		case "i":
			typeName = "integer";
			test = "typeof " + _inVarName + '==="number"&&' + _inVarName + "%1===0";
			break;
		case "bi":
			typeName = "bigint";
			test = "typeof " + _inVarName + '==="bigint"';
			suffix = "n";
			break;
	}

	test = parentCtx.typeChecked === "number" ? "" : test;

	if (min !== null) body.push(_errMode(isCond,
		_inVarName + (exclMin ? ">" : ">=") + min + suffix,
		_err(parentCtx, _inVarName, pathVar + "/" + typeName + "/" + (exclMin ? "exclusiveMinimum" : "minimum"), "Number must be greater" + (exclMin ? "" : " or egal") + " than " + min + suffix) + ERR_UNDEF
	));
	if (max !== null) body.push(_errMode(isCond,
		_inVarName + (exclMax ? "<" : "<=") + max + suffix,
		_err(parentCtx, _inVarName, pathVar + "/" + typeName + "/" + (exclMax ? "exclusiveMaximum" : "maximum"), "Number must be smaller" + (exclMax ? "" : " or egal") + " than " + max + suffix) + ERR_UNDEF
	));
	if (multOf !== null) {
		// Use modulo for integers and bigint, division for floats to avoid floating-point precision issues
		if (Number.isInteger(multOf) || type === "bi") {
			body.push(_errMode(isCond,
				_inVarName + "%" + multOf + suffix + "===0" + suffix,
				_err(parentCtx, _inVarName, pathVar + "/" + typeName + "/multipleOf", "Number must be a multiple of " + multOf + suffix) + ERR_UNDEF
			));
		} else {
			body.push(_errMode(isCond,
				"Math.abs(" + _inVarName + "/" + multOf + "-Math.round(" + _inVarName + "/" + multOf + "))<1e-10",
				_err(parentCtx, _inVarName, pathVar + "/" + typeName + "/multipleOf", "Number must be a multiple of " + multOf) + ERR_UNDEF
			));
		}
	}

	const testErr = _err(parentCtx, _inVarName, pathVar + "/" + typeName, typeName + " is required") + ERR_UNDEF;

	parentCtx.typeChecked = "number";
	return simpleNodeToJs(parentCtx, _inVarName, _outVarName, testErr, test, "", body, declared);

};

export const n = (dnaOpt: tsNumberDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString =>
	number(dnaOpt, "n", _inVarName, _outVarName, pathVar, labelId, parentCtx, true);
export const _n = (dnaOpt: tsNumberDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString =>
	number(dnaOpt, "n", _inVarName, _outVarName, pathVar, labelId, parentCtx, false);
export const i = (dnaOpt: tsNumberDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString =>
	number(dnaOpt, "i", _inVarName, _outVarName, pathVar, labelId, parentCtx, true);
export const bi = (dnaOpt: tsNumberDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString =>
	number(dnaOpt, "bi", _inVarName, _outVarName, pathVar, labelId, parentCtx, true);

export const boolean = (dnaOpt: [tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const test = parentCtx.typeChecked === "boolean" ? "" : "typeof " + _inVarName + '==="boolean"';
	const testErr = _err(parentCtx, _inVarName, pathVar + "/boolean", "Boolean is required") + ERR_UNDEF;
	parentCtx.typeChecked = "boolean";
	return simpleNodeToJs(parentCtx, _inVarName, _outVarName, testErr, test, "", "", true);
};
// `nan`: matches only NaN, regardless of input type.
// `v !== v` is true ONLY when v is NaN (NaN is the only JS value not equal to
// itself), so no upstream `typeof === "number"` is needed. This is the fastest
// possible test (single inequality, no function call, no temp).
export const nan = (dnaOpt: [tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const test = _inVarName + "!==" + _inVarName;
	const condErr = _err(parentCtx, _inVarName, pathVar + "/nan", "NaN is required") + ERR_UNDEF;
	parentCtx.typeChecked = "nan";
	return simpleNodeToJs(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true);
};
export const nullType = (dnaOpt: [tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const test = parentCtx.typeChecked === "null" ? "" : _inVarName + "===null";
	const condErr = _err(parentCtx, _inVarName, pathVar + "/null", "Null is required") + ERR_UNDEF;
	parentCtx.typeChecked = "null";
	return simpleNodeToJs(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true);
};
export const n0 = nullType;

// `undefined` opcode (Zod's `z.undefined()` and `z.void()`): only the value
// `undefined` passes. Exported under its actual opcode name via `export {}`
// since `undefined` is a JS global and unsafe as a local identifier.
const undefinedType = (dnaOpt: [tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const test = _inVarName + "===void 0";
	const condErr = _err(parentCtx, _inVarName, pathVar + "/undefined", "Undefined is required") + ERR_UNDEF;
	parentCtx.typeChecked = "undefined";
	return simpleNodeToJs(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true);
};
export { undefinedType as undefined };

export const trueSchema = (dnaOpt: [tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	// `trueSchema` has no lexical index/key context, so it cannot meaningfully
	// emit `set.add(...)`. The convention is: the dispatching parent (e.g.
	// `prefixItems` / items loop / `_unEvalEnv` schema branch) is responsible
	// for emitting the eval-set additions AFTER the sub-DNA succeeds.
	const ctx = { isCond: parentCtx.isCond, failCase: parentCtx.failCase, counter: parentCtx.counter, outerblock: parentCtx.outerblock };
	return simpleNodeToJs(ctx, _inVarName, _outVarName, "", "", "", "", true);
};
export const falseSchema = (dnaOpt: [tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	// `false` schema always rejects. Cannot go through `_assignOrCond` because
	// that helper's success path emits the OK code (counter/outAssign) — we want
	// the opposite.
	const break_ = parentCtx.failCase;
	if (parentCtx.isCond) {
		// With a counter context (anyOf/allOf/oneOf children, etc.) failure
		// simply means "don't increment" — the outer combinator catches it.
		// Without counter, we must exit the local block / root function.
		return parentCtx.counter ? "" : break_;
	}
	// Parser mode: emit the error then exit.
	const err = _err(parentCtx, _inVarName, pathVar + "/false", "Schema is always false") + ERR_UNDEF_;
	return err + break_;
};

export const constType = (dnaOpt: tsConstDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const check = dnaOpt[0];
	const checkStr = tojsStr(check);
	const test = _inVarName + "===" + checkStr;
	const condErr = _err(parentCtx, _inVarName, pathVar + "/const", "Const value is expected:" + checkStr) + ERR_UNDEF;
	// parentCtx.typeChecked = "const";
	return simpleNodeToJs(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true);
};
export const constTypeComplex = (dnaOpt: tsConstDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn => {
	const check = dnaOpt[0];
	const steps: tsJSStepAct[] = [];
	// For complex constants (objects/arrays), use deepEqual
	steps.push([STEP.OUT_CONST, FN_dEq])
	const checkStr = tojsStr(check);
	const test = "dEq(" + _inVarName + "," + checkStr + ")";
	const condErr = _err(parentCtx, _inVarName, pathVar + "/const", "Const value is expected:" + checkStr) + ERR_UNDEF;

	let res: string;
	if (parentCtx.isCond) res = _outVarName.length ? _outVarName + "=" + test + ";" : test;

	else res = _outVarName.length ? _outVarName + "=" + test + "?" + checkStr + ":" + condErr + ";" : "if(!(" + test + ")){" + condErr + "}";

	steps.push([STEP.BODY, res]);
	// parentCtx.typeChecked = "const";
	return steps;
};
export const literal = (dnaOpt: tsConstDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const enumList = dnaOpt[0];
	// Use a switch-like expression for strict type checking
	let enumLen = enumList.length;
	const checks = new Array(enumLen);
	if (enumLen) for (; enumLen--;) { const v = enumList[enumLen]; checks[enumLen] = _inVarName + "===" + tojsStr(v) }
	const test = "(" + checks.join(")||(") + ")";
	const condErr = _err(parentCtx, _inVarName, pathVar + "/const", "Const value is expected:" + tojsStr(enumList)) + ERR_UNDEF;
	return simpleNodeToJs(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true);
};
/**
 * `enumType` — primitive-only enum (strings, numbers, booleans, null).
 * Strict `===` comparison: `0 !== false`, `1 !== true`, `0 === 0.0` per JSON
 * Schema 2020-12 semantics. For enums containing object/array values, the
 * DNA layer emits the `eD` opcode (`enumTypeDeep`) instead.
 *
 * Empty enum (`enum: []`) matches nothing — emits literal `false`.
 */
export const enumType = (dnaOpt: tsConstDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const enumList = dnaOpt[0];
	const checks: string[] = new Array(enumList.length);
	for (let i = enumList.length; i--;) checks[i] = _inVarName + "===" + tojsStr(enumList[i]);
	const test = checks.length === 0 ? "false" : "(" + checks.join("||") + ")";
	const condErr = _err(parentCtx, _inVarName, pathVar + "/enum", "Value must be one of: " + tojsStr(enumList)) + ERR_UNDEF;
	return simpleNodeToJs(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true);
};

/**
 * `enumTypeDeep` — enum containing at least one object/array value.
 * Uses `dEq(inVar, <literal>)` (deep-equal) for non-primitive entries and
 * `===` for primitive ones. Emits the `FN_dEq` shared function.
 */
export const enumTypeDeep = (dnaOpt: tsConstDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn => {
	const enumList = dnaOpt[0];
	const steps: tsJSStepAct[] = [];
	const checks: string[] = new Array(enumList.length);
	for (let i = enumList.length; i--;) {
		const v = enumList[i];
		checks[i] = (v !== null && typeof v === "object")
			? "dEq(" + _inVarName + "," + tojsStr(v) + ")"
			: _inVarName + "===" + tojsStr(v);
	}
	steps.push([STEP.CONST, FN_dEq]);
	const test = checks.length === 0 ? "false" : "(" + checks.join("||") + ")";
	const condErr = _err(parentCtx, _inVarName, pathVar + "/enum", "Value must be one of: " + tojsStr(enumList)) + ERR_UNDEF;
	steps.push([STEP.BODY, simpleNodeToJs(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true)]);
	return steps;
};


export const unevaluatedProperties = (dnaOpt: [number, number[], tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsStackFrame[] =>
	_unEvalEnv(parentCtx, {
		kind: "properties",
		idx: labelId(),
		seq: dnaOpt[1],
		unEvalSchema: dnaOpt[0],
		inVar: _inVarName,
		outVar: _outVarName,
		pathVar,
	});


/**
 * Migrated `object` validator using `_assignOrCondEnv`.
 * Behavior should match `object_old` for all opt combinations EXCEPT the
 * documented divergence on `isCond + !declared` type-mismatch (envelope adopts
 * the array semantics: no `_outVar=true` on bad type; old object used to set it).
 */
const object = (dnaOpt: tsObjectDNA, inVar: string, outVar: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx, declared = true): tsJSFn => {
	const isCond = parentCtx.isCond;
	const idx = labelId();
	const oVar = "oVar" + idx;
	const oLen = "oLen" + idx;
	const oVarIdx = oVar + "[i]";
	const loopVar = "val" + idx;

	const block = "oB" + idx;
	const breakBase = "break " + block + ";";
	const break_ = isCond ? (parentCtx.failCase || breakBase) : breakBase;
	const _break_ = ";" + break_;
	const innerIfErrFail_ = "if(errors.length)" + break_;
	const _innerIfErrFail_ = ";" + innerIfErrFail_;

	let passedIdx = "";
	const evalParent = parentCtx.unEvalObj ?? "";
	const evalParentKey_ = evalParent.length ? evalParent + "[key]=1;" : "";

	const opt = dnaOpt[0];

	const neededConstants: string[] = [];
	const regexConstants: string[] = [];
	let objectCheck: [string, string][] = [];

	let propertiesChecks: any[] = [];
	let defaultPropertiesChecks: any[] = [];
	let dependentSchemasChecks: any[] = [];
	let patternPropChecks: any[] = [];
	let patternPropertiesBooleanChecks: boolean | undefined;
	let propertyNamesCheck: number | boolean | undefined = undefined;
	let additionalPropertiesCheck: number | boolean | undefined = undefined;
	// Per-key concerns extracted into structured state so we can emit a single
	// `if(Object.hasOwn(v,K))` block per declared key (AJV-style grouping) that
	// fuses `properties`, `required`, `dependentRequired`, `dependentSchemas`.
	// Fast-fail style: required keys emit `if(!hasOwn) break` upfront (no else).
	// `depReqMap` is a Map (not a plain object) so reserved names such as
	// `__proto__`, `toString`, `constructor` are stored as data, not as
	// prototype-chain lookups.
	let requiredList: string[] = [];
	const depReqMap = new Map<string, string[]>();

	let needLength = false;
	const requiresAddPropTracking = true;
	let hasDynamicProps = false;

	for (let i = 0; i < opt.length; i++) {
		const it = opt[i];
		const data = it[1];
		switch (it[0]) {
			case "minProperties":
				needLength = true;
				objectCheck.push([
					oLen + "<" + String(data),
					_err(parentCtx, inVar, pathVar + "/object/minProperties", "Object requires at least " + String(data) + " properties")
				]);
				break;
			case "maxProperties":
				needLength = true;
				if (data > -1)
					objectCheck.push([
						oLen + ">" + String(data),
						_err(parentCtx, inVar, pathVar + "/object/maxProperties", "Object requires at most " + String(data) + " properties")
					]);
				break;
			case "required":
				// Captured for per-key fast-fail emission below.
				if (Array.isArray(data) && data.length > 0) requiredList = data;
				break;
			case "dependentRequired":
				// Captured for per-key fast-fail emission below.
				// `Object.keys` is safe — schema authors don't put inherited
				// keys here, and `for..in` would walk the chain.
				if (data && typeof data === "object") {
					for (const triggerProp of Object.keys(data)) {
						const reqs = data[triggerProp];
						if (Array.isArray(reqs)) depReqMap.set(triggerProp, reqs);
					}
				}
				break;
			case "properties":
				propertiesChecks = data;
				break;
			case "defaultProperties":
				defaultPropertiesChecks = data;
				break;
			case "dependentSchemas":
				dependentSchemasChecks = data;
				break;
			case "patternProperties":
				hasDynamicProps = true;
				for (let j = 0; j < data.length; j++) {
					const el = data[j];
					const regexVar = "rxPP" + idx + "_" + j;
					neededConstants.push(regexVar + "=/" + el[0] + "/u");
					patternPropChecks.push([regexVar, el[0], el[1]]);
				}
				break;
			case "propertyNames":
				hasDynamicProps = true;
				propertyNamesCheck = data;
				break;
			case "additionalProperties":
				hasDynamicProps = true;
				passedIdx = "passed" + idx;
				neededConstants.push(passedIdx + "={}");
				additionalPropertiesCheck = data;
				break;
		}
	}
	const passedIdxAddKey_ = passedIdx.length ? passedIdx + "[key]=1;" : "";

	const keyLoopNeededIsCond = (propertyNamesCheck !== undefined && typeof propertyNamesCheck !== "boolean")
		|| (typeof propertyNamesCheck === "boolean" && propertyNamesCheck === true && (!!evalParent.length || !!passedIdx))
		|| (typeof propertyNamesCheck === "boolean" && propertyNamesCheck === false)
		|| patternPropChecks.length > 0
		|| patternPropertiesBooleanChecks !== undefined
		|| typeof additionalPropertiesCheck === "number"
		// `additionalProperties: true` normally has no work to do, BUT if we
		// have an `evalParent` we MUST iterate to mark every non-property key
		// as evaluated (otherwise outer `unevaluatedProperties` rejects them).
		|| (additionalPropertiesCheck === true && !!evalParent.length);
	const keyLoopNeededParser = keyLoopNeededIsCond
		|| additionalPropertiesCheck === true
		|| typeof propertyNamesCheck === "boolean";

	if (needLength || hasDynamicProps) {
		if (!hasDynamicProps) neededConstants.push(oLen + "=Object.keys(" + inVar + ").length");
		else neededConstants.push(oVar + "=Object.keys(" + inVar + ")", oLen + "=" + oVar + ".length");
	}
	if (regexConstants.length) fastMergeArrays(neededConstants, regexConstants);

	const preDecls = neededConstants.length ? "const " + neededConstants.join(",") + ";" : "";
	// const typePosTest = "typeof " + inVar + '==="object"&&' + inVar + "!==null&&!Array.isArray(" + inVar + ")";
	const typePosTest = TEST_OBJECT(inVar);
	const typeErrMsg = _err(parentCtx, inVar, pathVar + "/object", "Object is required");

	// Build innerSteps depending on mode
	const innerSteps: tsStackFrame[] = [];

	// ---------------------------------------------------------------
	// UNIFIED PER-KEY EMISSION (AJV-style grouping, fast-fail)
	// ---------------------------------------------------------------
	// For every declared key (union of `properties`, `required`,
	// `dependentRequired` triggers, `dependentSchemas` triggers) emit AT MOST
	// one `if(Object.hasOwn(v,K)) { ... }` block fusing all per-key concerns.
	// Required keys use the fast-fail form `if(!hasOwn(K)) break;` upfront
	// (no `else` clause).
	const effectiveIsCond = isCond || !outVar.length;
	const childrenCtx: tsJSParentCtx = {
		isCond,
		failCase: isCond
			? (parentCtx.failCase || "break " + block + ";")
			: (parentCtx.failCase || "if(errors.length)break " + block + ";"),
		outerblock: parentCtx.outerblock || block,
	};
	const propMap = new Map<string, number>([...propertiesChecks, ...defaultPropertiesChecks].map((c: any) => [c[0], c[1]]));
	const requiredSet = new Set(requiredList);
	const defaultSet = new Set<string>(defaultPropertiesChecks.map((c: any) => c[0]));
	const depSchMap = new Map<string, number | boolean>(dependentSchemasChecks.map((c: any) => [c[0], c[1]]));

	// Stable key order: properties order first, then any extras introduced by
	// required / dependentRequired / dependentSchemas in their declaration order.
	const declaredKeyOrder: string[] = [];
	const seenKey = new Set<string>();
	const pushKey = (k: string) => { if (!seenKey.has(k)) { seenKey.add(k); declaredKeyOrder.push(k); } };
	for (const c of propertiesChecks) pushKey(c[0]);
	for (const c of defaultPropertiesChecks) pushKey(c[0]);
	for (const r of requiredList) pushKey(r);
	for (const t of depReqMap.keys()) pushKey(t);
	for (const c of dependentSchemasChecks) pushKey(c[0]);

	// Per-key emission split by mode.
	const propValCounter = { n: 0 };

	for (const k of declaredKeyOrder) {
		const _name = JSON.stringify(k);
		const propDnaIdx = propMap.get(k);
		const isReq = requiredSet.has(k);
		const isDefault = defaultSet.has(k);
		const deps = depReqMap.get(k) || [];
		const depSchSub = depSchMap.get(k);

		const propVal = propDnaIdx !== undefined ? "ob" + idx + "pp" + propValCounter.n++ : "";
		const objKey = inVar + "[" + _name + "]";
		const evalMark = propDnaIdx !== undefined && evalParent.length ? evalParent + "[" + _name + "]=" + _name + ";" : "";
		const passMark = propDnaIdx !== undefined && passedIdx ? passedIdx + "[" + _name + "]=" + _name + ";" : "";

		if (effectiveIsCond) {
			// Validator mode: fail-fast, no output allocation.
			if (isReq) innerSteps.push([STEP.BODY, "if(!Object.hasOwn(" + inVar + "," + _name + "))" + (isCond ? break_ : ("{" + _err(parentCtx, inVar, pathVar + "/object/required/" + k, "Required property missing: " + k) + _break_ + "}"))]);
			else if (!isDefault) innerSteps.push([STEP.BODY, "if(Object.hasOwn(" + inVar + "," + _name + ")){"]);
			for (const r of deps) innerSteps.push([STEP.BODY, "if(!Object.hasOwn(" + inVar + "," + JSON.stringify(r) + "))" + (isCond ? break_ : ("{" + _err(parentCtx, inVar, pathVar + "/object/dependentRequired/" + k + "/" + r, "Dependent required property missing: " + r) + _break_ + "}"))]);
			if (depSchSub === false) innerSteps.push([STEP.BODY, isCond ? break_ : "{" + _err(parentCtx, inVar, pathVar + "/object/dependentSchemas/" + k, "Dependent schema forbidden for property: " + k) + _break_ + "}"]);
			else if (typeof depSchSub === "number") {
				const depChildrenCtx: tsJSParentCtx = { ...childrenCtx, unEvalArr: parentCtx.unEvalArr, unEvalObj: parentCtx.unEvalObj };
				innerSteps.push([depSchSub, inVar, "", pathVar + "/object/dependentSchemas/" + k, depChildrenCtx]);
			}
			if (propDnaIdx !== undefined) {
				innerSteps.push(
					[STEP.BODY, "let " + propVal + "=" + objKey + ";"],
					[propDnaIdx, propVal, "", pathVar + "/object/properties/" + k, { ...childrenCtx }],
				);
				const marks = evalMark + passMark;
				if (marks) innerSteps.push([STEP.BODY, marks]);
			}
			if (!isReq && !isDefault) innerSteps.push([STEP.BODY, "}"]);
		} else {
			// Parser mode: push errors and allocate output.
			if (isReq) innerSteps.push([STEP.BODY, "if(!Object.hasOwn(" + inVar + "," + _name + ")){" + _err(parentCtx, inVar, pathVar + "/object/required/" + k, "Required property missing: " + k) + ";" + break_ + "}"]);
			else if (!isDefault) innerSteps.push([STEP.BODY, "if(Object.hasOwn(" + inVar + "," + _name + ")){"]);
			for (const r of deps) innerSteps.push([STEP.BODY, "if(!Object.hasOwn(" + inVar + "," + JSON.stringify(r) + ")){" + _err(parentCtx, inVar, pathVar + "/object/dependentRequired/" + k + "/" + r, "Dependent required property missing: " + r) + ";" + break_ + "}"]);
			if (depSchSub === false) {
				innerSteps.push([STEP.BODY, _err(parentCtx, inVar, pathVar + "/object/dependentSchemas/" + k, "Dependent schema forbidden for property: " + k) + ";" + break_]);
			} else if (typeof depSchSub === "number") {
				const depChildrenCtx: tsJSParentCtx = { ...childrenCtx, unEvalArr: parentCtx.unEvalArr, unEvalObj: parentCtx.unEvalObj };
				innerSteps.push([depSchSub, inVar, "", pathVar + "/object/dependentSchemas/" + k, depChildrenCtx]);
			}
			if (propDnaIdx !== undefined) {
				const outDest = outVar + "[" + _name + "]";
				innerSteps.push(
					[STEP.BODY, "let " + propVal + "=" + objKey + ";"],
					[propDnaIdx, propVal, outDest, pathVar + "/object/properties/" + k, { ...childrenCtx }],
				);
				const marks = evalMark + passMark;
				if (marks) innerSteps.push([STEP.BODY, marks]);
			}
			if (!isReq && !isDefault) innerSteps.push([STEP.BODY, "}"]);
		}
	}

	if (isCond) {
		if (hasDynamicProps && keyLoopNeededIsCond) {
			innerSteps.push([STEP.BODY, "for(let i=0;i<" + oLen + ";i++){let key=" + oVarIdx + "," + loopVar + "=" + inVar + "[key];"]);

			if (propertyNamesCheck !== undefined) {
				if (typeof propertyNamesCheck === "boolean") {
					if (propertyNamesCheck === false) {
						innerSteps.push([STEP.BODY, break_]);
					} else {
						if (evalParent.length || passedIdx) innerSteps.push([STEP.BODY, evalParentKey_ + passedIdxAddKey_]);
					}
				} else {
					innerSteps.push(
						[propertyNamesCheck, "key", "", pathVar + "/object/propertyNames", { ...childrenCtx }],
						// [STEP.BODY, evalParentKey_]
					);
				}
			}

			if (patternPropChecks.length) {
				for (let i = 0; i < patternPropChecks.length; i++) {
					const el = patternPropChecks[i];
					// Mark BOTH the eval set (for unevaluatedProperties) AND the
					// `passedIdx` set (for additionalProperties) — a key matched
					// by a pattern is NOT an "additional" property.
					innerSteps.push(
						[STEP.BODY, "if(" + el[0] + ".test(key)){"],
						[el[2], loopVar, "", pathVar + "/object/patternProperties/" + el[1], { ...childrenCtx }],
						[STEP.BODY, (evalParent.length ? evalParent + "[key]=key;" : "") + passedIdxAddKey_ + "}"]
					);
				}
			}
			if (patternPropertiesBooleanChecks !== undefined) {
				if (patternPropertiesBooleanChecks === false) {
					innerSteps.push([STEP.BODY, _err(parentCtx, "key", pathVar + "/object/propertyNames", "Property names not allowed") + _break_]);
				}
				innerSteps.push([STEP.BODY, evalParentKey_ + passedIdxAddKey_]);
			}

			if (additionalPropertiesCheck !== undefined) {
				if (typeof additionalPropertiesCheck === "boolean") {
					if (additionalPropertiesCheck === false)
						innerSteps.push([STEP.BODY, "}if(Object.keys(" + passedIdx + ").length<" + oLen + ")" + break_ + (evalParentKey_ ? "else " + evalParentKey_ : "")]);
					// additionalProperties: true → every non-properties key is
					// "evaluated" by JSON Schema semantics → mark in parent eval set.
					else innerSteps.push([STEP.BODY,
					(evalParent.length ? "if(!" + passedIdx + "[key])" + evalParent + "[key]=1;" : "")
					+ "}"
					]);
				} else {
					// schema for additionalProperties → on sub-DNA success, mark key as evaluated.
					innerSteps.push(
						[STEP.BODY, "if(!" + passedIdx + "[key]){"],
						[additionalPropertiesCheck, loopVar, "", pathVar + "/object/additionalProperties/", { ...childrenCtx }],
						[STEP.BODY, (evalParent.length ? evalParent + "[key]=1;" : "") + "}}"]
					);
				}
			} else {
				innerSteps.push([STEP.BODY, "}"]);
			}
		} else if (hasDynamicProps && additionalPropertiesCheck === false) {
			innerSteps.push([STEP.BODY, "if(Object.keys(" + passedIdx + ").length<" + oLen + ")" + break_]);
		}

	} else {
		// parser mode — per-key blocks were emitted above (shared with isCond).
		if (hasDynamicProps && keyLoopNeededParser) {
			const childCtx: tsJSParentCtx = {
				isCond,
				failCase: isCond
					? (parentCtx.failCase || "break " + block + ";")
					: (parentCtx.failCase || "if(errors.length)break " + block + ";"),
				outerblock: parentCtx.outerblock || block,
			};
			innerSteps.push([STEP.BODY, "for(let i=0;i<" + oLen + ";i++){let key=" + oVarIdx + "," + loopVar + "=" + inVar + "[key];"]);
			if (propertyNamesCheck !== undefined) {
				if (typeof propertyNamesCheck === "boolean") {
					if (propertyNamesCheck === false) {
						innerSteps.push([STEP.BODY, _err(parentCtx, "key", pathVar + "/object/propertyNames", "Property names not allowed") + _break_]);
					} else {
						innerSteps.push([STEP.BODY, outVar + "[key]=" + loopVar + ";"]);
					}
				} else {
					innerSteps.push(
						[propertyNamesCheck, "key", "key", pathVar + "/object/propertyNames", { ...childCtx }],
						[STEP.BODY, "if(errors.length){"
							+ _err(parentCtx, oVarIdx, pathVar + "/object/propertyNames", "Property name does not match schema")
							+ _break_ + "}"
							+ outVar + "[key]=" + loopVar + ";"
						]
					);
				}
			}
			if (patternPropChecks.length) for (let i = 0; i < patternPropChecks.length; i++) {
				const el = patternPropChecks[i];
				innerSteps.push(
					[STEP.BODY, "if(" + el[0] + ".test(key)){"],
					[el[2], loopVar, outVar + "[key]", pathVar + "/object/patternProperties/" + el[1], childCtx],
					[STEP.BODY, evalParentKey_ + passedIdxAddKey_ + "}"]
				);
			}
			if (patternPropertiesBooleanChecks !== undefined) {
				if (patternPropertiesBooleanChecks === false) {
					innerSteps.push([STEP.BODY, _err(parentCtx, "key", pathVar + "/object/propertyNames", "Property names not allowed") + _break_]);
				}
				innerSteps.push([STEP.BODY, outVar + "[key]=" + loopVar + ";" + evalParentKey_ + passedIdxAddKey_]);
			}
			if (additionalPropertiesCheck !== undefined) {
				if (typeof additionalPropertiesCheck === "boolean") {
					if (additionalPropertiesCheck === true) {
						innerSteps.push([STEP.BODY, "if(!" + passedIdx + "[key]){" + outVar + "[key]=" + loopVar + ";" + evalParentKey_ + "}"]);
					} // false handled as a post-loop check after patternProperties have run
				} else {
					// schema for additionalProperties (parser) → on sub-DNA success,
					// mark key as evaluated in the parent eval set.
					innerSteps.push(
						[STEP.BODY, "if(!" + passedIdx + "[key]){"],
						[additionalPropertiesCheck, loopVar, outVar.length ? outVar + "[key]" : "", pathVar + "/object/additionalProperties/", { ...childCtx }],
						[STEP.BODY, innerIfErrFail_ + (evalParent.length ? evalParent + "[key]=1;" : "") + "}"]
					);
				}
			}
			innerSteps.push([STEP.BODY, "}"]);
		}
		if (hasDynamicProps && additionalPropertiesCheck === false) {
			innerSteps.push([STEP.BODY, "if(Object.keys(" + passedIdx + ").length<" + oLen + "){"
				+ _err(parentCtx, inVar, pathVar + "/object/additionalProperties", "Additional properties not allowed")
				+ _break_ + "}"]);
		}
	}

	// Parser-mode init: only copy the whole input object when we need to preserve
	// unknown keys (default/additionalProperties:true) or merge with a previous
	// seq result (unevaluatedProperties). Otherwise start empty to avoid the spread.
	const parserOutInit = parentCtx.unEvalObj
		? outVar + "={..." + inVar + ",..." + outVar + "};"
		: (additionalPropertiesCheck === false || typeof additionalPropertiesCheck === "number")
			? outVar + "={};"
			: outVar + "={..." + inVar + "};"

	return _assignOrCondEnv(parentCtx, inVar, outVar, {
		block, break_, _break_, mustMatchType: declared, typeChecked: "object",
		typePosTest, typeErrMsg,
		preDecls, preChecks: objectCheck, extraInits: "",
		innerSteps,
		postChecks: [],
		parserOutInit,
	});
};

export const o = (dnaOpt: tsObjectDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx) =>
	object(dnaOpt, _inVarName, _outVarName, pathVar, labelId, parentCtx, true);
export const _o = (dnaOpt: tsObjectDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx) =>
	object(dnaOpt, _inVarName, _outVarName, pathVar, labelId, parentCtx, false);


export const unevaluatedItems = (dnaOpt: [number, number[], tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsStackFrame[] =>
	_unEvalEnv(parentCtx, {
		kind: "items",
		idx: labelId(),
		seq: dnaOpt[1],
		unEvalSchema: dnaOpt[0],
		inVar: _inVarName,
		outVar: _outVarName,
		pathVar,
	});


/**
 * Migrated `array` validator using `_assignOrCondEnv`.
 * Mirrors `array_old` behavior; envelope absorbs the head/tail boilerplate.
 */
const array = (dnaOpt: tsArrayDNA, inVar: string, outVar: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx, declared = true): tsJSFn => {
	const isCond = parentCtx.isCond;
	const idx = labelId();
	const aLen = "aLen" + idx;
	const loopVar = "val" + idx;
	const iName = "i" + idx;

	const block = "arB" + idx;
	const breakTarget = parentCtx.outerblock || block;
	const break_ = "break " + breakTarget + ";";
	const _break_ = ";" + break_;
	const innerIfErrFail_ = "if(errors.length)" + break_;

	// Child context for array elements: failure breaks the array block
	const childCtx: tsJSParentCtx = {
		isCond,
		failCase: isCond ? break_ : ("if(errors.length)" + break_),
		outerblock: parentCtx.outerblock || block,
	};

	const opt = dnaOpt[0];
	const containsSteps: tsJSStepOp[] = [];

	let arrayCheck: [string, string][] = [];
	let uniqueItemsState: { decl: string; unikVar: string; standalone: string; perItem: string; err: string; } | undefined;

	let prefixItemsIndices: any[] = [];
	let prefixItemsLength = 0;
	let itemsIndex: number | boolean = 0;

	let needLength = false;
	let needLoop = false;
	let containsCount = "";
	const containsPreloop: [string, string][] = [];
	const containsCheck: [string, string][] = [];

	// Build innerSteps
	const innerSteps: tsStackFrame[] = [];

	for (let i = 0; i < opt.length; i++) {
		const it = opt[i];
		const data = it[1];
		switch (it[0]) {
			case "uniqueItems": {
				needLength = true;
				const unikVar = "unik" + idx;
				const auErr = _err(parentCtx, inVar, pathVar + "/array/uniqueItems", "Array items must be unique");
				const decl = "let " + unikVar + "=true;";
				let standalone = "", perItem = "";
				if (data === 0) {
					standalone = "if(" + aLen + ">1){let i=" + aLen + ",j;for(;" + unikVar + "&&i--;){j=i-1;for(;j>=0;j--){if(" + inVar + "[i]===" + inVar + "[j]){" + unikVar + "=false;break;}}}}";
					perItem = "if(" + unikVar + "){let j=" + iName + ";for(;j--;){if(" + loopVar + "===" + inVar + "[j]){" + unikVar + "=false;break;}}}";
				} else if (data === 1) {
					innerSteps.push([STEP.OUT_CONST, FN_dEq]);
					standalone = "if(" + aLen + ">1){let i=" + aLen + ",j;for(;" + unikVar + "&&i--;){j=i-1;for(;j>=0;j--){if(dEq(" + inVar + "[i]," + inVar + "[j])){" + unikVar + "=false;break;}}}}";
					perItem = "if(" + unikVar + "){let j=" + iName + ";for(;j--;){if(dEq(" + loopVar + "," + inVar + "[j])){" + unikVar + "=false;break;}}}";
				}
				uniqueItemsState = { decl, unikVar, standalone, perItem, err: auErr };
				break;
			}
			case "minItems":
				if (data > -1) {
					needLength = true;
					arrayCheck.push([
						aLen + "<" + String(data),
						_err(parentCtx, inVar, pathVar + "/array/minItems", "Array requires at least " + String(data) + " items")
					]);
				}
				break;
			case "maxItems":
				if (data > -1) {
					needLength = true;
					arrayCheck.push([
						aLen + ">" + String(data),
						_err(parentCtx, inVar, pathVar + "/array/maxItems", "Array requires at most " + String(data) + " items")
					]);
				}
				break;
			case "prefixItems":
				prefixItemsIndices = data;
				prefixItemsLength = data.length;
				break;
			case "items":
				needLength = true;
				needLoop = true;
				itemsIndex = data;
				break;
			case "contains": {
				needLength = true;
				const containsData = data[0];
				const minContains = data[1];
				const maxContains = data[2];
				// Per JSON Schema 2020-12: when `contains` is present, the default
				// `minContains` is 1. The DNA encodes "unspecified" as `-1`, so we
				// resolve it to 1 here to drive the always-fail logic for `false`
				// and the implicit non-empty check for `true`.
				const effMin = minContains < 0 ? 1 : minContains;
				if (containsData === true) {
					// Every item matches → match count = aLen.
					if (effMin > 0) containsCheck.push([
						aLen + "<" + String(effMin),
						_err(parentCtx, inVar, pathVar + "/array/contains", "Array must contain at least " + String(effMin) + " valid item(s)")
					]);
					if (maxContains > -1) containsCheck.push([
						aLen + ">" + String(maxContains),
						_err(parentCtx, inVar, pathVar + "/array/contains", "Array must contain at most " + String(maxContains) + " valid item(s)")
					]);
				} else if (containsData === false) {
					// `contains: false` matches nothing → match count is always 0.
					// - effMin > 0 → always invalid (regardless of array length)
					// - effMin === 0 → always valid (vacuously)
					if (effMin > 0) containsPreloop.push([
						"true",
						_err(parentCtx, inVar, pathVar + "/array/contains", "Array must contain at least " + String(effMin) + " valid item(s)")
					]);
				} else {
					needLoop = true;
					containsCount = "containsCnt" + idx;
					// When the parent provides an eval set (`unEvalArr` as a bare
					// set name), mark the current index `i` as evaluated whenever
					// the contains sub-schema matches.
					const u = parentCtx.unEvalArr;
					const evalAdd_ = u ? u + "[" + iName + "]=1" : "";
					// Counter and eval-set propagation are separate: counter is emitted
					// as part of the success path, evalAdd_ as a trailing statement.
					const counterValue = evalAdd_ ? ["++" + containsCount, evalAdd_] : "++" + containsCount;
					containsSteps.push(
						[containsData, loopVar, "", pathVar + "/array/contains", { isCond: true, failCase: "", counter: counterValue, outerblock: childCtx.outerblock }]
					);
					if (effMin > 0) containsCheck.push([
						containsCount + "<" + String(effMin),
						_err(parentCtx, inVar, pathVar + "/array/minContains", "Array must contain at least " + String(effMin) + " valid item(s)")
					]);
					if (maxContains > -1) containsCheck.push([
						containsCount + ">" + String(maxContains),
						_err(parentCtx, inVar, pathVar + "/array/maxContains", "Array must contain at most " + String(maxContains) + " valid item(s)")
					]);
				}
				break;
			}
		}
	}

	const fuseUnique = !!uniqueItemsState && needLoop && !prefixItemsLength && itemsIndex !== false;
	const evalParent = parentCtx.unEvalArr ?? "";

	// If prefixItems are present but no items/contains is declared, the remaining
	// positions are unconstrained and must be copied to the output.
	if (prefixItemsLength && itemsIndex === 0 && !parentCtx.unEvalArr) {
		needLoop = true;
	}

	// preDecls: aLen const + uniqueItems setup + containsCount init
	const aLenDecl = (needLength || needLoop || prefixItemsLength) ? "const " + aLen + "=" + inVar + ".length;" : "";
	const uniqDecl = uniqueItemsState ? uniqueItemsState.decl : "";
	const uniqSweep = (uniqueItemsState && !fuseUnique) ? uniqueItemsState.standalone : "";
	const containsInit = containsCount ? "let " + containsCount + "=0;" : "";
	const preDecls = aLenDecl + uniqDecl + uniqSweep + containsInit;

	// preChecks: arrayCheck + standalone-unique check + containsPreloop
	const preChecks: [string, string][] = [...arrayCheck];
	if (uniqueItemsState && !fuseUnique) preChecks.push(["!" + uniqueItemsState.unikVar, uniqueItemsState.err]);
	preChecks.push(...containsPreloop);

	// postChecks: fuseUnique post-loop check + containsCheck
	const postChecks: [string, string][] = [];
	if (fuseUnique) postChecks.push(["!" + uniqueItemsState!.unikVar, uniqueItemsState!.err]);
	postChecks.push(...containsCheck);

	if (isCond) {
		// Convention: `array` itself owns the `<set>.add(<idx>);` emissions.
		// We do NOT propagate `unEvalArr` to sub-DNA — they have no lexical
		// index/key context and would otherwise concatenate the bare set name
		// into their own bodies (causing `evalISet0evalISet0.add(...)` style
		// breakage). The eval-set additions are emitted EXPLICITLY by this
		// loop after each successful sub-DNA dispatch.
		const evalAddItem_ = evalParent ? evalParent + "[" + iName + "]=1;" : "";

		if (prefixItemsLength) for (let i = 0; i < prefixItemsLength; i++) {
			innerSteps.push(
				[STEP.BODY, "if(" + aLen + ">" + i + "){"],
				[prefixItemsIndices[i], inVar + "[" + i + "]", "", pathVar + "/array/prefixItems/" + i, childCtx],
				[STEP.BODY, evalParent ? evalParent + "[" + i + "]=1;}" : "}"]
			);
		}

		if (needLoop) {
			innerSteps.push([STEP.BODY,
			"for(let " + iName + "=" + prefixItemsLength + ";" + iName + "<" + aLen + ";" + iName + "++){const " + loopVar + "=" + inVar + "[" + iName + "];"
			]);
			if (typeof itemsIndex === "number" && itemsIndex) {
				innerSteps.push([itemsIndex, loopVar, "", pathVar + "/array/items", childCtx]);
				if (evalAddItem_) innerSteps.push([STEP.BODY, evalAddItem_]);
			} else if (itemsIndex === true) {
				if (evalAddItem_) innerSteps.push([STEP.BODY, evalAddItem_]);
			} else if (itemsIndex === false) {
				// `items: false` past `prefixItems` → any extra item invalidates
				// the entire array. We MUST break the array block (not just the
				// `for` loop) so post-checks don't accidentally validate the array.
				innerSteps.push([STEP.BODY, break_]);
			}
			if (containsSteps.length) fastMergeArrays(innerSteps, containsSteps);
			if (fuseUnique) innerSteps.push([STEP.BODY, uniqueItemsState!.perItem]);
			innerSteps.push([STEP.BODY, "}"]);
		}
	} else {
		// parser mode
		if (prefixItemsLength) for (let i = 0; i < prefixItemsLength; i++) {
			innerSteps.push(
				[STEP.BODY, "if(" + aLen + ">" + i + "){"],
				[prefixItemsIndices[i], inVar + "[" + i + "]", outVar + "[" + i + "]", pathVar + "/array/prefixItems/" + i, childCtx],
				[STEP.BODY, innerIfErrFail_ + (evalParent ? evalParent + "[" + i + "]=1;" : "") + "}"]
			);
		}

		if (needLoop) {
			innerSteps.push([STEP.BODY, "for(let " + iName + "=" + prefixItemsLength + ";" + iName + "<" + aLen + ";" + iName + "++){const " + loopVar + "=" + inVar + "[" + iName + "];"]);
			if (containsSteps.length) fastMergeArrays(innerSteps, containsSteps);
			if (fuseUnique) innerSteps.push([STEP.BODY, uniqueItemsState!.perItem]);
			if (typeof itemsIndex === "number" && itemsIndex !== 0) {
				innerSteps.push(
					[itemsIndex, loopVar, outVar + "[" + iName + "]", pathVar + "/array/items", childCtx],
					[STEP.BODY, innerIfErrFail_ + (evalParent ? evalParent + "[" + iName + "]=1;" : "")]
				);
			} else if (itemsIndex === true) {
				innerSteps.push([STEP.BODY, outVar + "[" + iName + "]=" + loopVar + ";" + (evalParent ? evalParent + "[" + iName + "]=1;" : "")]);
			} else if (itemsIndex === false) {
				innerSteps.push([STEP.BODY, _err(parentCtx, loopVar, pathVar + "/array/items", "Additional items not allowed") + _break_]);
			} else {
				innerSteps.push([STEP.BODY, outVar + "[" + iName + "]=" + loopVar + ";"]);
			}
			innerSteps.push([STEP.BODY, "}"]);
		}

	}

	// Parser-mode init: only copy all input items when unevaluatedItems needs to
	// merge with a previous seq result. If a reconstructing loop exists, let it
	// fill the remaining positions. Otherwise, preserve the original array.
	const parserOutInit = (prefixItemsLength || needLoop)
		? (parentCtx.unEvalArr
			? outVar + "=new Array(" + aLen + ");for(let i=0;i<" + aLen + ";i++)" + outVar + "[i]=" + inVar + "[i];"
			: outVar + "=new Array(" + aLen + ");")
		: outVar + "=" + inVar + ";"

	return _assignOrCondEnv(parentCtx, inVar, outVar, {
		block, break_, _break_, mustMatchType: declared, typeChecked: "array",
		typePosTest: "Array.isArray(" + inVar + ")",
		typeErrMsg: _err(parentCtx, inVar, pathVar + "/array", "Array is required"),
		preDecls, preChecks, extraInits: "",
		innerSteps,
		postChecks,
		parserOutInit,
	});
};

export const a = (dnaOpt: tsArrayDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx) =>
	array(dnaOpt, _inVarName, _outVarName, pathVar, labelId, parentCtx, true);
export const _a = (dnaOpt: tsArrayDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx) =>
	array(dnaOpt, _inVarName, _outVarName, pathVar, labelId, parentCtx, false);

export const ifThenElse = (dnaOpt: tsIfThenElseDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn => {
	const indices = dnaOpt[0];
	const ifPart = indices[0];
	const thenPart = indices[1];
	const elsePart = indices[2];
	const isCond = parentCtx.isCond;

	const idx = labelId();
	const block = "ifB" + idx;
	const ifSubBlock = "ifSubB" + idx;
	const tmpVar = "ifV" + idx;
	const innerFail_ = parentCtx?.failCase || "break " + block + ";";

	if (thenPart === -1 && elsePart === -1) {
		// No then/else → schema is satisfied either way, BUT the `if` body must
		// still be dispatched so its successful annotations (eval-set marks)
		// propagate to outer `unevaluated*` siblings, AND its side effects
		// (errors[] in parser mode) are produced. We run the `if` body in
		// a sub-block where failure is silent (no `break` out of caller's flow).
		const ifteEval = { unEvalArr: parentCtx.unEvalArr, unEvalObj: parentCtx.unEvalObj };
		const steps: tsStackFrame[] = [];
		if (isCond) {
			const success_ = parentCtx.counter
				? parentCtx.counter + ";"
				: (_outVarName ? _outVarName + "=true;" : "");
			if (parentCtx.unEvalArr || parentCtx.unEvalObj)
				return [
					[STEP.BODY, ifSubBlock + ":{"],
					[ifPart, _inVarName, "", pathVar + "/if", { isCond: true, failCase: "break " + ifSubBlock + ";", outerblock: ifSubBlock, ...ifteEval }],
					[STEP.BODY, "}" + success_]
				];
			else return success_;
		} else {
			// Parser mode: dispatch the `if` body for its side effects (errors[]),
			// but DO NOT write to `_outVarName` — a bare `if` is not a transformer;
			// the caller is responsible for any output value.
			return [
				[STEP.BODY, ifSubBlock + ":{"],
				[ifPart, _inVarName, "", pathVar + "/if", { ...parentCtx, isCond: true, failCase: "break " + ifSubBlock + ";", outerblock: ifSubBlock }],
				[STEP.BODY, "}" + (_outVarName ? _outVarName + "=" + _inVarName + ";" : "")]
			];
		}
		return steps;
	}

	const steps: tsStackFrame[] = [];

	if (isCond) {
		// "Success" statement emitted in either branch when the corresponding
		// sub-schema is absent (treated as `true` — i.e. success).
		// Precedence: parent's `counter` (we're a child of anyOf/allOf/...)
		// > `_outVarName=true;` (we're producing the root result)
		// > nothing (caller doesn't care; downstream logic handles it).
		const successCounter = parentCtx.counter
			? parentCtx.counter
			: (_outVarName ? _outVarName + "=true" : "");

		// In-place applicator semantics: `if`/`then`/`else` are in-place, so
		// their annotations (eval-set contributions) propagate UP to the
		// parent's `unEvalArr`/`unEvalObj`. We pass these through to every
		// branch ctx. Failures short-circuit via `failCase`, so leaked
		// eval marks before a failure can't reach the parent's success path.
		const ifteEval = { unEvalArr: parentCtx.unEvalArr, unEvalObj: parentCtx.unEvalObj };

		// `if`-part is a CONDITION TEST, not a hard validation: a failure must
		// NOT skip the `else` branch. We isolate it in its own sub-block so a
		// `break` only exits the if-part scope, leaving `ifV<idx>=false` and
		// the surrounding `if(ifV)…else…` chooses the else branch.
		steps.push(
			[STEP.BODY, block + ":{"],
			[STEP.BODY, "let " + tmpVar + "=false;" + ifSubBlock + ":{"],
			[ifPart, _inVarName, "", pathVar + "/if", { isCond: true, failCase: "break " + ifSubBlock + ";", outerblock: ifSubBlock, ...ifteEval }],
			[STEP.BODY, tmpVar + "=true;"],
			[STEP.BODY, "}if(" + tmpVar + ")"]
		);

		// Push then schema step
		if (thenPart === -1) {
			// Then absent → success when condition holds.
			steps.push([STEP.BODY, "{" + successCounter + "}"]);
		} else {
			const thenCtx: tsJSParentCtx = { isCond: true, failCase: "break " + block + ";", outerblock: block, counter: successCounter, ...ifteEval };
			steps.push(
				[STEP.BODY, "{"],
				[thenPart, _inVarName, "", pathVar + "/then", thenCtx],
				[STEP.BODY, "}"],
			);
		}

		// Push else schema step
		if (elsePart === -1) {
			// Else absent → success when condition does not hold.
			steps.push([STEP.BODY, "else{" + successCounter + "}"]);
		} else {
			const elseCtx: tsJSParentCtx = { isCond: true, failCase: "break " + block + ";", outerblock: block, counter: successCounter, ...ifteEval };
			steps.push(
				[STEP.BODY, "else{"],
				[elsePart, _inVarName, "", pathVar + "/else", elseCtx],
				[STEP.BODY, "}"]
			);
		}

	} else {
		// Parser mode: the if-part is a condition test that only breaks the sub-block on failure.
		const passThrough = _outVarName ? _outVarName + "=" + _inVarName + ";" : "";
		const ifteEval = { unEvalArr: parentCtx.unEvalArr, unEvalObj: parentCtx.unEvalObj };
		steps.push(
			[STEP.BODY, block + ":{let " + tmpVar + "=false;" + ifSubBlock + ":{"],
			[ifPart, _inVarName, "", pathVar + "/if", { isCond: true, failCase: "break " + ifSubBlock + ";", outerblock: ifSubBlock, ...ifteEval }],
			[STEP.BODY, tmpVar + "=true;"],
			[STEP.BODY, "}if(" + tmpVar + ")"]
		);

		// Push then schema step
		if (thenPart === -1) {
			// Then absent → pass through the original value when condition holds.
			steps.push([STEP.BODY, "{" + passThrough + "}"]);
		} else {
			steps.push(
				[STEP.BODY, "{"],
				[thenPart, _inVarName, _outVarName, pathVar + "/then", { ...parentCtx, ...ifteEval }],
				[STEP.BODY, "}"]
			);
		}

		// Push else schema step
		if (elsePart === -1) {
			// Else absent → pass through the original value when condition does not hold.
			steps.push([STEP.BODY, "else{" + passThrough + "}"]);
		} else {
			steps.push(
				[STEP.BODY, "else{"],
				[elsePart, _inVarName, _outVarName, pathVar + "/else", { ...parentCtx, ...ifteEval }],
				[STEP.BODY, "}"]
			);
		}
	}
	steps.push([STEP.BODY, "}"]); //end of if then else bloc
	return steps;
};

export const not = (dnaOpt: [any], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsStackFrame[] => {
	const isCond = parentCtx.isCond;
	const innerIndex = dnaOpt[0][0];

	const idx = labelId();
	const block = "notB" + idx;
	const _result = "notRes" + idx;
	const childCtx: tsJSParentCtx = { isCond: true, failCase: "break " + block + ";", outerblock: block };

	const steps: tsStackFrame[] = [];

	// `not` doesn't propagate annotations: by definition, the inner schema either
	// succeeds (we fail) or fails (we succeed) — in either case the inner's
	// eval-set marks are NOT in-scope contributions of the current schema.
	// Since `_assignOrCond` no longer emits `unEvals_`, we just call it with
	// `parentCtx` directly — no need to strip anymore.

	if (isCond) {
		steps.push(
			[STEP.BODY, "let " + _result + ";"],
			[STEP.BODY, block + ":{"],
			[innerIndex, _inVarName, _result, pathVar + "/not", childCtx],
			[STEP.BODY, "}"], // closing block
			[STEP.BODY, simpleNodeToJs(parentCtx, _inVarName, _outVarName, "", "!" + _result, "", "", true)]
		);
	} else {
		// Check if validation failed
		const ErrMsg = _err(parentCtx, _inVarName, pathVar + "/not", "Data should NOT be valid to schema:" + dnaOpt[0][1]) + ERR_UNDEF;
		steps.push(
			[STEP.BODY, "let " + _result + ";"],
			[STEP.BODY, block + ":{"],
			[innerIndex, _inVarName, _result, pathVar + "/not", childCtx],
			[STEP.BODY, "}"], // closing block
			[STEP.BODY, simpleNodeToJs(parentCtx, _inVarName, _outVarName, ErrMsg, "!" + _result, "", "", true)],
		);
	}
	return steps;
};

export const anyOf = (dnaOpt: tsOfList, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn => {
	const isCond = parentCtx.isCond;
	const content = dnaOpt[0][0];
	const indices: number[] = dnaOpt[0].slice(1) as number[];

	const idx = labelId();
	const block = "anyB" + idx;
	const innerFail_ = "break " + block + ";";
	const outerFail_ = parentCtx.failCase;

	const count = "anyCnt" + idx;
	const ctx: tsJSParentCtx = { isCond, failCase: "break " + block + ";", outerblock: block };

	const steps: tsStackFrame[] = [];
	const childrenCtx: tsJSParentCtx = { isCond: true, failCase: "", outerblock: block, counter: "++" + count };

	// Annotation-collection (`unevaluated*`) bookkeeping.
	// Per JSON Schema, `anyOf` contributes annotations from ALL matching branches
	// (not just the first), so when an `evalParent` set is present we must:
	//   - dispatch every child (no short-circuit on first match)
	//   - give each child a fresh scratch set (so a child that fails doesn't leak)
	//   - commit scratch → accumulator only if that child actually matched
	//   - propagate accumulator → parent at the very end
	type tsEvalSlot = { accum: string; scratch: string; commit: string; propagate: string };
	const slots: tsEvalSlot[] = [];
	if (parentCtx.unEvalArr) {
		const accum = "anyEvalArr" + idx, scratch = "anyEvalArrTmp" + idx;
		childrenCtx.unEvalArr = scratch;
		slots.push({
			accum, scratch,
			commit: "for(const k in " + scratch + ")" + accum + "[k]=1;",
			propagate: "for(const k in " + accum + ")" + parentCtx.unEvalArr + "[k]=1;",
		});
	}
	if (parentCtx.unEvalObj) {
		const accum = "anyEvalObj" + idx, scratch = "anyEvalObjTmp" + idx;
		childrenCtx.unEvalObj = scratch;
		slots.push({
			accum, scratch,
			commit: "for(const k in " + scratch + ")" + accum + "[k]=1;",
			propagate: "for(const k in " + accum + ")" + parentCtx.unEvalObj + "[k]=1;",
		});
	}
	const hasEvals = slots.length > 0;
	const countBefore = "anyCntB" + idx;
	const outTemp = "anyOut" + idx;

	const decls = [
		...slots.map(s => s.accum + "=Object.create(null)"),
		...slots.map(s => s.scratch + "=Object.create(null)"),
		...(!isCond && _outVarName ? [outTemp] : []),
		...(hasEvals ? [countBefore] : []),
		count + "=0",
	];
	steps.push([STEP.BODY, "let " + decls.join(",") + ";" + block + ":{"]);

	if (isCond) {
		// Outer counter: when this `anyOf` is itself a child of `anyOf`/`allOf`/
		// `oneOf`, success must fire the parent's counter so the outer combinator
		// counts us as a match. Fired exactly once on success.
		const parentCounter_ = parentCtx.counter ? parentCtx.counter + ";" : "";
		// const childrenCtx: tsJSParentCtx = { ...specCtx, isCond: true, counter: count + ";" };


		for (let i = 0; i < indices.length; i++) {
			if (hasEvals) {
				// Reset scratch sets + snapshot count, dispatch, then commit on match.
				// No short-circuit — we need to keep collecting from later matches.
				steps.push([STEP.BODY,
				slots.map(s => s.scratch + "={};").join("")
				+ countBefore + "=" + count + ";"
				]);
				steps.push([indices[i], _inVarName, "", pathVar + "/anyOf/" + i, childrenCtx]);
				steps.push([STEP.BODY,
				"if(" + count + ">" + countBefore + "){"
				+ slots.map(s => s.commit).join("")
				+ "}"
				]);
			} else {
				steps.push(
					[indices[i], _inVarName, "", pathVar + "/anyOf/" + i, childrenCtx],
					[STEP.BODY, "if(" + count + "){" + parentCounter_ + (_outVarName ? _outVarName + "=true;" : "") + innerFail_ + "}"]
				);
			}
		}
		steps.push(
			[STEP.BODY, "if(" + count + "===0)"
				+ (parentCtx.counter ? innerFail_ : outerFail_)
				+ parentCounter_
				+ (_outVarName ? _outVarName + "=true;" : "")
				+ "}"
				+ slots.map(s => s.propagate).join("")
			]
		);
	} else {
		const scratchReset = hasEvals ? slots.map(s => s.scratch + "={};").join("") : "";
		for (let i = 0; i < indices.length; i++) {
			const childBlock = "anyChB" + idx + "_" + i;
			const errLen = "anyErr" + idx + "_" + i;
			const childCtx: tsJSParentCtx = { isCond: false, failCase: "if(errors.length)break " + childBlock + ";", outerblock: childBlock, fastFail: parentCtx.fastFail, unEvalArr: childrenCtx.unEvalArr, unEvalObj: childrenCtx.unEvalObj };
			const commit = hasEvals ? slots.map(s => s.commit).join("") : "";
			const childOut = _outVarName ? outTemp : "";
			const assignOut = _outVarName ? (_outVarName + "=" + outTemp + ";") : "";
			steps.push(
				[STEP.BODY, scratchReset + "let " + errLen + "=errors.length;"],
				[STEP.BODY, childBlock + ":{"],
				[indices[i], _inVarName, childOut, pathVar + "/anyOf/" + i, childCtx],
				[STEP.BODY, "}"],
				[STEP.BODY, "if(" + errLen + "===errors.length){" + assignOut + commit + count + "=1;}else{errors.length=" + errLen + ";" + scratchReset + "}"]
			);
		}
		steps.push(
			[STEP.BODY, "if(" + count + "===0){" + _err(ctx, _inVarName, pathVar + "/anyOf", "Data should be valid to at least one schema of:" + content) + ";" + innerFail_ + "}"]
		);
		steps.push([STEP.BODY, "}" + (hasEvals ? slots.map(s => s.propagate).join("") : "")]);
	}
	return steps;
};

export const or = anyOf;

export const allOf = (dnaOpt: tsOfList, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn => {
	const isCond = parentCtx.isCond;
	const content = dnaOpt[0][0];
	const indices: number[] = dnaOpt[0].slice(1) as number[];

	const idx = labelId();
	const block = "alB" + idx;
	const count = "allCnt" + idx;

	const childrenCtx: tsJSParentCtx = {
		...parentCtx,
		failCase: parentCtx.fastFail ? "break " + block + ";" : parentCtx.failCase,
		outerblock: block,
		isCond: true,
		unEvalArr: undefined,
		unEvalObj: undefined,
		counter: "++" + count
	};

	// Local eval sets + their explicit propagation statements.
	// (Replaces the legacy `_assignOrCond.unEvals_` stash pattern. Each
	// applicator now owns its eval-set propagation explicitly.)
	const evalDecls: string[] = [];
	let propagateArr_ = "", propagateObj_ = "";
	if (parentCtx.unEvalArr) {
		const localSet = "allEvalArr" + idx;
		childrenCtx.unEvalArr = localSet;
		evalDecls.push(localSet + "=Object.create(null)");
		propagateArr_ = "for(const k in " + localSet + ")" + parentCtx.unEvalArr + "[k]=1;";
	}
	if (parentCtx.unEvalObj) {
		const localSet = "allEvalObj" + idx;
		childrenCtx.unEvalObj = localSet;
		evalDecls.push(localSet + "=Object.create(null)");
		propagateObj_ = "for(const k in " + localSet + ")" + parentCtx.unEvalObj + "[k]=1;";
	}

	const steps: tsStackFrame[] = [];
	steps.push([STEP.BODY,
	"let " + [...evalDecls, count + "=0"].join(",") + ";" + block + ":{"
	]);

	if (isCond) {
		for (let i = 0; i < indices.length; i++) {
			steps.push([indices[i], _inVarName, "", pathVar + "/allOf/" + i, childrenCtx]);
		}
		const failBreak_ = parentCtx.counter
			? "break " + block + ";"
			: parentCtx.failCase;
		steps.push([STEP.BODY,
		"if(" + count + "!==" + indices.length + ")" + failBreak_
		+ propagateArr_ + propagateObj_
		+ (parentCtx.counter ? parentCtx.counter + ";" : "")
		+ (_outVarName ? _outVarName + "=true;" : "")
		+ "}"
		]);
	} else {
		for (let i = 0; i < indices.length; i++) {
			const childBlock = "allChB" + idx + "_" + i;
			const errLen = "allErr" + idx + "_" + i;
			const childCtx: tsJSParentCtx = { isCond: false, failCase: "if(errors.length)break " + childBlock + ";", outerblock: childBlock, unEvalArr: childrenCtx.unEvalArr, unEvalObj: childrenCtx.unEvalObj, fastFail: childrenCtx.fastFail };
			steps.push(
				[STEP.BODY, "let " + errLen + "=errors.length;"],
				[STEP.BODY, childBlock + ":{"],
				[indices[i], _inVarName, _outVarName, pathVar + "/allOf/" + i, childCtx],
				[STEP.BODY, "}"],
				[STEP.BODY, "if(" + errLen + "===" + "errors.length){" + count + "++;}" + (parentCtx.fastFail ? "else{break " + block + ";}" : "")]
			);
		}
		const errMsg = _err(parentCtx, _inVarName, pathVar + "/allOf", "Data should be valid to all schemas of:" + content);
		steps.push([STEP.BODY,
		"if(" + count + "!==" + indices.length + "){" + errMsg + ";" + "break " + block + ";" + "}"
		+ propagateArr_ + propagateObj_
		+ (_outVarName ? _outVarName + "=" + _inVarName + ";" : "")
		+ "}"
		]);
	}
	return steps;
};

export const oneOf = (dnaOpt: tsOfList, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn => {
	const isCond = parentCtx.isCond;
	const content = dnaOpt[0][0];
	const indices: number[] = dnaOpt[0].slice(1) as number[];

	const idx = labelId();
	const block = "oneB" + idx;
	const count = "oneCnt" + idx;
	const innerFail_ = "break " + block + ";";
	const outerCounter = parentCtx.counter ?? "";
	const strReturn_ = parentCtx.failCase

	const ctx: tsJSParentCtx = { isCond, outerblock: block, failCase: "break " + block + ";" };

	const steps: tsStackFrame[] = [];

	// Declarations and code fragments for eval-set propagation across oneOf:
	// - `declareLet`: extra `let`-declared identifiers (eval sets + their snapshots)
	// - `initEvals`:  reset local eval sets at the start of the oneB block
	// - `captureEvals`: snapshot the local eval set into its global twin on the
	//                   first matching branch (count===1)
	// - `propagateEvals`: forward the snapshot to the parent's eval set on overall success
	const declareLet: string[] = [];
	const initEvals: string[] = [];
	const captureEvals: string[] = [];
	const propagateEvals: string[] = [];

	const childrenCtx: tsJSParentCtx = {
		...parentCtx,
		failCase: "",
		outerblock: block,
		isCond: true,
		unEvalArr: undefined,
		unEvalObj: undefined,
		counter: "++" + count
	};

	if (parentCtx.unEvalArr) {
		const evalSet = "oneEvalArr" + idx;
		const globalEvalSet = "oneEvalGlobalArr" + idx;
		childrenCtx.unEvalArr = evalSet;
		declareLet.push(evalSet, globalEvalSet);
		initEvals.push(evalSet + "=Object.create(null);");
		captureEvals.push(globalEvalSet + "=Object.assign(Object.create(null)," + evalSet + ");");
		propagateEvals.push("for(const it in " + globalEvalSet + ")" + parentCtx.unEvalArr + "[it]=1;");
	}
	if (parentCtx.unEvalObj) {
		const evalSet = "oneEvalObj" + idx;
		const globalEvalSet = "oneEvalGlobalObj" + idx;
		childrenCtx.unEvalObj = evalSet;
		declareLet.push(evalSet, globalEvalSet);
		initEvals.push(evalSet + "=Object.create(null);");
		captureEvals.push(globalEvalSet + "=Object.assign(Object.create(null)," + evalSet + ");");
		propagateEvals.push("for(const it in " + globalEvalSet + ")" + parentCtx.unEvalObj + "[it]=1;");
	}

	const letDecl = "let " + (declareLet.length ? declareLet.join(",") + "," : "") + count + "=0;";
	const captureBlock = captureEvals.length ? "if(" + count + "===1){" + captureEvals.join("") + "}" : "";

	if (isCond) {
		// childrenCtx.counter +=  ";" ;

		steps.push([STEP.BODY, letDecl + block + ":{"]);
		if (initEvals.length) steps.push([STEP.BODY, initEvals.join("")]);
		for (let i = 0; i < indices.length; i++) {
			const childBlock = "oneChB" + idx + "_" + i;
			const childCtx: tsJSParentCtx = { ...childrenCtx, outerblock: childBlock, failCase: "break " + childBlock + ";" };
			steps.push(
				[STEP.BODY, childBlock + ":{"],
				[indices[i], _inVarName, "", pathVar + "/oneOf/" + i, childCtx],
				[STEP.BODY, "}"]
			);
			if (captureBlock) steps.push([STEP.BODY, captureBlock]);
			if (0 < i) steps.push([STEP.BODY, "if(" + count + ">1)" + (parentCtx.counter ? innerFail_ : strReturn_)]);
		}
		steps.push([STEP.BODY, "if(" + count + "!==1)"
			+ (parentCtx.counter ? innerFail_ : strReturn_)
			+ (outerCounter ? outerCounter + ";" : "")
			+ (_outVarName ? _outVarName + "=true;" : "")
			+ propagateEvals.join("")
			+ "}"
		]); //closing oneBlock

	} else {

		steps.push([STEP.BODY, letDecl
			+ "const errMsg=()=>" + _err(ctx, _inVarName, pathVar + "/oneOf", "Data should be valid to exactly one schema of:" + content) + ";"
			+ block + ":{"]);
		if (initEvals.length) steps.push([STEP.BODY, initEvals.join("")]);
		for (let i = 0; i < indices.length; i++) {
			const childBlock = "oneChB" + idx + "_" + i;
			const errLen = "oneErr" + idx + "_" + i;
			const childCtx: tsJSParentCtx = { isCond: false, failCase: "if(errors.length)break " + childBlock + ";", outerblock: childBlock, unEvalArr: childrenCtx.unEvalArr, unEvalObj: childrenCtx.unEvalObj, fastFail: childrenCtx.fastFail };
			steps.push(
				[STEP.BODY, "let " + errLen + "=errors.length;"],
				[STEP.BODY, childBlock + ":{"],
				[indices[i], _inVarName, _outVarName, pathVar + "/oneOf/" + i, childCtx],
				[STEP.BODY, "}"],
				[STEP.BODY, "if(" + errLen + "===errors.length){"
					+ count + "++;"
					+ (captureBlock ? captureBlock : "")
					+ "if(" + count + ">1){errMsg();" + innerFail_ + "}"
					+ "}else{errors.length=" + errLen + ";}" // TODO: if no error, what is the purpose to reassign 0 errors?
				]
			);
		}
		steps.push(
			[STEP.BODY, "if(" + count + "!==1){"
				+ "errMsg();"
				+ innerFail_ + "}"],
			[STEP.BODY, _outVarName + "=" + _inVarName + ";" + propagateEvals.join("") + "}"]
		);
	}

	return steps;
};

export const discriminator = (dnaOpt: [string, any[], number[], tsDnaInnerMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn => {
	const isCond = parentCtx.isCond;
	const [discriminatorName, discriminKeys, indices] = dnaOpt;
	const discriminator = tojsStr(discriminatorName);

	const idx = labelId();
	const discValVar = "discVal" + idx;
	const block = "discB" + idx;
	const outerBreak_ = parentCtx.failCase;

	// Setup eval sets for unevaluated properties/items
	const declareLet: string[] = [];
	const initEvals: string[] = [];
	const propagateEvals: string[] = [];
	const childCtx: tsJSParentCtx = { isCond, outerblock: block, typeChecked: "object", failCase: outerBreak_ };

	if (parentCtx.unEvalArr) {
		const evalSet = "discEvalArr" + idx;
		childCtx.unEvalArr = evalSet;
		declareLet.push(evalSet);
		initEvals.push(evalSet + "=Object.create(null);");
		propagateEvals.push("for(const it in " + evalSet + ")" + parentCtx.unEvalArr + "[it]=1;");
	}
	if (parentCtx.unEvalObj) {
		const evalSet = "discEvalObj" + idx;
		childCtx.unEvalObj = evalSet;
		declareLet.push(evalSet);
		initEvals.push(evalSet + "=Object.create(null);");
		propagateEvals.push("for(const it in " + evalSet + ")" + parentCtx.unEvalObj + "[it]=1;");
	}

	const outerCounter = parentCtx.counter ?? "";

	const steps: tsStackFrame[] = [];
	steps.push(
		[indices[0], _inVarName, _outVarName, pathVar + "/discriminator", parentCtx],
		[STEP.BODY, block + ":{const " + discValVar + "=" + _inVarName + "[" + discriminator + "];"],
	);

	// Initialize eval sets
	if (initEvals.length) steps.push([STEP.BODY, initEvals.join("")]);

	// Generate switch with cases
	steps.push([STEP.BODY, "switch(" + discValVar + "){"]);

	for (let i = 1; i < indices.length; i++) {
		const key = tojsStr(discriminKeys[i - 1]);
		steps.push(
			[STEP.BODY, "case " + key + ":"],
			// Call sub-schema
			[indices[i], _inVarName, _outVarName, pathVar + "/discriminator/" + i, { ...childCtx }],
			[STEP.BODY, "break;"]
		);
	}

	if (isCond) {
		steps.push([STEP.BODY, "default:" + outerBreak_ + "}"]);
	} else {
		steps.push(
			[STEP.BODY, "default:"
				+ _err(parentCtx, _inVarName, pathVar + "/discriminator/" + discriminatorName, "Discriminator value not recognized") + ";"
				+ _outVarName + "=undefined;}if(!errors.length)" + _outVarName + "[" + discriminator + "]=" + discValVar + ";"
			]);
	}
	steps.push([STEP.BODY, (outerCounter ? outerCounter + ";" : "") + propagateEvals.join("") + "}"]);

	return steps;
};

export {
	boolean as b,
	constType as c,
	constTypeComplex as cD,
	enumType as e,
	enumTypeDeep as eD,
	falseSchema as F,
	literal as l,
	trueSchema as T
};

