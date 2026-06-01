import type {
	tsArrayDNA,
	tsConstDNA, tsIfThenElseDNA,
	tsJSFn,
	tsJSFuncReturn, tsJSParentCtx, tsJSStepAct,
	tsJSStepOp,
	tsJSStepString,
	tsLaberlId,
	tsMeta,
	tsNumberDNA,
	tsObjectDNA,
	tsOfList,
	tsStringDNA,
} from "../dna.type.js";
import { ERR_UNDEF, ERR_UNDEF_, escStr, fastMergeArrays, namer, STEP } from "./utils.js";

/* This file contains the logic to accumulate all errors in fail fast mode */



const FN_fCount = "fCount=s=>{let i=s.length,c=0;while(i--){if((s.charCodeAt(i)&0xFC00)!==0xDC00)c++}return c}";
const FN_dEq = 'dEq=(a,b)=>{const s=[[a,b]];while(s.length){const[c,d]=s.pop();if(c===d)continue;if(c&&d&&"object"==typeof c&&"object"==typeof d){if(c.constructor!==d.constructor)return!1;if(Array.isArray(c)){if(c.length!==d.length)return!1;for(let i=c.length;i--;)s.push([c[i],d[i]])}else{const k=Object.keys(c);if(k.length!==Object.keys(d).length)return!1;for(let i=k.length;i--;){const f=k[i];if(!Object.hasOwn(d,f))return!1;s.push([c[f],d[f]])}}}else if(c!==d)return!1}return!0}';

const _err = (ctx: tsJSParentCtx, _inVarName: string, path: string, msg: string, isLiteral = true) =>
	"errors.push({message:" + (isLiteral ? JSON.stringify(msg) : escStr(msg)) + ",path:'" + path + "',input:" + _inVarName + "})";

const _errMode = (isCond: boolean | undefined, cond: string, err: string) => cond + (isCond ? "" : "||" + err);

const _assignOut = (_outVarName: string = "", val: string) => _outVarName.length ? _outVarName + "=" + val + ";" : val;

const _assignOrCond = (
	parentCtx: tsJSParentCtx,
	_inVarName: string,
	_outVarName: string,
	errMsg: string,
	test: string,
	preBody: string = "",
	body: string | string[] = "",
	declared: boolean = true
) => {
	const condErr = parentCtx.counter ? parentCtx.counter : errMsg;
	const _body = Array.isArray(body) ? body.length ? body.join("&&") : "" : typeof body === "string" ? body : "";

	if (parentCtx.isCond) {

		// Project-wide convention: `parentCtx.unEvalArr` / `unEvalObj` carry a
		// SET NAME (never a statement). Eval-set propagation is the responsibility
		// of in-place applicators (`anyOf`/`allOf`/`oneOf`/`_unEvalEnv`/...) which
		// emit `<localSet>.forEach(...)` explicitly on their success path.
		// `_assignOrCond` is a scalar-level helper with no lexical key context —
		// it cannot meaningfully emit any eval marking.
		const counter_ = parentCtx.counter ?? "";
		const strReturn_ = parentCtx.breakBlock ? "break " + parentCtx.breakBlock + ";" : "return false;";
		const outAssigned_ = _outVarName ? _outVarName + "=" + (parentCtx.not ?? "") + "true;" : "";

		// Encoding: `encodedCase = (D<<3) | (T<<2) | (B<<1) | C` — 4 bits, 16 cases.
		// D = Declared    : 1 = type check failure must throw out; 0 = undeclared (vacuous success on type mismatch)
		// T = Test        : 1 = test set (must be emitted); 0 = test already known true upstream (test == "")
		// B = Body        : 1 = constraint body present (additional check after test)
		// C = Counter     : 1 = parent provided a counter — body failure means "don't increment" (no break)
		//
		// Below the matrix in switch form (documentation only; the active code
		// is the linearized if/else chain after this comment).
		//
		// 	//   D=0, T=0  — test verified upstream, schema is undeclared
		// 	case 0b0000: return outAssigned_;
		// 	case 0b0001: return counter_ + outAssigned_;
		// 	case 0b0010: return preBody + "if(!(" + _body + "))" + strReturn_ + outAssigned_;
		// 	case 0b0011: return preBody + "if(" + _body + "){" + counter_ + outAssigned_ + "}";
		//
		// 	//   D=0, T=1  — test must be emitted, schema is undeclared (vacuous on !test)
		// 	case 0b0100: return outAssigned_;
		// 	case 0b0101: return counter_ + outAssigned_;
		// 	case 0b0110: return "if(" + test + "){" + preBody + "if(!(" + _body + "))" + strReturn_ + "}" + outAssigned_;
		// 	case 0b0111: return "if(" + test + "){" + preBody + "if(" + _body + "){" + counter_ + outAssigned_ + "}}else{" + counter_ + outAssigned_ + "}";
		//
		// 	//   D=1, T=0  — test verified upstream, schema is declared (no diff with D=0 here)
		// 	case 0b1000: return outAssigned_;
		// 	case 0b1001: return counter_ + outAssigned_;
		// 	case 0b1010: return preBody + "if(!(" + _body + "))" + strReturn_ + outAssigned_;
		// 	case 0b1011: return preBody + "if(" + _body + "){" + counter_ + outAssigned_ + "}";
		//
		// 	//   D=1, T=1  — test must be emitted, declared (type mismatch must fail)
		// 	case 0b1100: return "if(!(" + test + "))" + strReturn_ + outAssigned_;
		// 	case 0b1101: return "if(" + test + "){" + counter_ + outAssigned_ + "}";
		// 	case 0b1110: return "if(!(" + test + "))" + strReturn_ + preBody + "if(!(" + _body + "))" + strReturn_ + outAssigned_;
		// 	case 0b1111: return "if(" + test + "){" + preBody + "if(" + _body + "){" + counter_ + outAssigned_ + "}}";
		//
		// Compressed into 4 branches below:

		if (!test) { // T=0  (8 cases collapse to 3 emissions)
			if (!_body) return counter_ + outAssigned_;
			return counter_
				? preBody + "if(" + _body + "){" + counter_ + outAssigned_ + "}"
				: preBody + "if(!(" + _body + "))" + strReturn_ + outAssigned_;
		}
		if (!declared) { // D=0, T=1  (vacuous success on type mismatch)
			// Two patterns:
			//   no-counter: body failure breaks via `strReturn_` → `outAssigned_` fires
			//               unconditionally after the `if(test){}` (single emission).
			//   counter:    body failure leaves count unchanged (no break) → need
			//               explicit `else{counter+outAssign}` for the !test path.
			if (!_body) return counter_ + outAssigned_;
			if (counter_) {
				const bodyStr = preBody + "if(" + _body + "){" + counter_ + outAssigned_ + "}";
				return "if(" + test + "){" + bodyStr + "}else{" + counter_ + outAssigned_ + "}";
			}
			const bodyStr = preBody + "if(!(" + _body + "))" + strReturn_;
			return "if(" + test + "){" + bodyStr + "}" + outAssigned_;
		}
		if (counter_) { // D=1, T=1, C=1
			const bodyStr = _body
				? preBody + "if(" + _body + "){" + counter_ + outAssigned_ + "}"
				: counter_ + outAssigned_;
			return "if(" + test + "){" + bodyStr + "}";
		} else { // D=1, T=1, C=0
			const bodyStr = _body
				? preBody + "if(!(" + _body + "))" + strReturn_ + outAssigned_
				: outAssigned_;
			return "if(!(" + test + "))" + strReturn_ + bodyStr;
		}

	} else {
		// Handle trueSchema case in parser mode: if test is empty/true and body/counter are empty, just assign
		if ((!test || test === "true") && !_body && !parentCtx.counter) {
			return _outVarName + "=" + _inVarName + ";";
		}
		// Handle case where condErr is empty but declared is true - use _inVarName as fallback
		return _outVarName + "=" + test + "?" + _body + (_body.length ? "&&" : "") + (parentCtx.counter ? "(++" + parentCtx.counter + ")&&" : "") + _inVarName + ":" + ((declared && condErr) ? condErr : _inVarName) + ";";
	}
};


/**
 * Statement-level envelope for collection validators (object / array).
 * See companion scalar helper `_assignOrCond`.
 * Factors the shared boilerplate (own-block, type-validation matrix, preChecks,
 * postChecks, trailing counter + out=true). Caller provides loops/sub-DNA via
 * `innerSteps`. `object` / `array` are NOT migrated yet.
 */
type tsCondEnvFrame = {
	needsOwnBlock: boolean;
	block: string;
	innerBreak_: string;
	outerBreak_: string;
	break_: string;
	_break_: string;
};

/**
 * Compute the local block frame for a collection validator.
 * Naming convention (project-wide): `_X` = ";X", `X_` = "X;", `_X_` has both.
 * The caller must use these strings consistently when emitting sub-DNA loops.
 */
const _envFrame = (
	parentCtx: tsJSParentCtx,
	blockPrefix: string,
	idx: number | string
): tsCondEnvFrame => {
	// Block ownership:
	// - default: keep own block ("clean block by default")
	// - skip own block as an optimization when:
	//     a parent provides a `breakBlock` (would be redundant), or
	//     `ownScope: false` is explicitly opted-in AND no counter is needed
	const needsOwnBlock = !parentCtx.breakBlock && !(parentCtx.ownScope === false && !parentCtx.counter);
	const block = needsOwnBlock ? blockPrefix + idx : "";
	const innerBreak_ = "break " + block + ";";
	const outerBreak_ = parentCtx.breakBlock ? "break " + parentCtx.breakBlock + ";" : "return false;";
	const break_ = needsOwnBlock ? innerBreak_ : outerBreak_;
	const _break_ = ";" + break_;
	return { needsOwnBlock, block, innerBreak_, outerBreak_, break_, _break_ };
};

type tsCondEnvOpts = {
	frame: tsCondEnvFrame;
	declared: boolean;
	typeChecked: "array" | "object";
	typePosTest: string;
	typeErrMsg: string;
	preDecls: string;
	preChecks: [string, string][];
	extraInits: string;
	innerSteps: tsJSStepOp[];
	postChecks: [string, string][];
	parserOutInit: string;
};

const _assignOrCondEnv = (
	parentCtx: tsJSParentCtx,
	inVar: string,
	outVar: string,
	opts: tsCondEnvOpts
): tsJSStepOp[] => {
	const {
		frame, declared, typeChecked,
		typePosTest, typeErrMsg, preDecls, preChecks, extraInits,
		innerSteps, postChecks, parserOutInit,
	} = opts;
	const { block, break_, _break_ } = frame;

	const isCond = parentCtx.isCond;
	const counter_ = parentCtx.counter ?? "";
	const beenTested = parentCtx.typeChecked === typeChecked;
	const typeNegTest = "!(" + typePosTest + ")";

	const steps: tsJSStepOp[] = [];
	if (block.length) steps.push([STEP.BODY, block + ":{"]);

	if (isCond) {
		let validation = "", validationEnd = "";
		if (beenTested) {
			// already type-checked upstream
		} else if (!declared) {
			validation = "if(" + typePosTest + "){";
			validationEnd = "}";
		} else if (counter_) {
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
			+ counter_
			+ validationEnd
			+ (outVar ? outVar + "=true;" : "");
		if (tail) steps.push([STEP.BODY, tail]);

	} else {
		const typeCheck = beenTested ? ""
			: "if(" + typeNegTest + "){"
			+ (declared ? typeErrMsg : outVar + "=" + inVar)
			+ _break_
			+ "}";

		const headBody =
			typeCheck
			+ preDecls
			+ preChecks.map(it => "if(" + it[0] + "){" + it[1] + _break_ + "}").join("")
			+ extraInits
			+ parserOutInit;
		if (headBody) steps.push([STEP.BODY, headBody]);

		fastMergeArrays(steps, innerSteps);

		const tail =
			postChecks.map(it => "if(" + it[0] + "){" + it[1] + _break_ + "}").join("")
			+ counter_;
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

const _unEvalEnv = (
	parentCtx: tsJSParentCtx,
	opts: {
		kind: tsUnEvalKind;
		idx: number;
		seq: number[];
		unEvalSchema: number | boolean;
		inVar: string;
		outVar: string;
		pathVar: string;
	}
): tsJSStepOp[] => {
	const { kind, idx, seq, unEvalSchema, inVar, outVar, pathVar } = opts;
	const isArr = kind === "items";
	const isCond = parentCtx.isCond;

	const block       = (isArr ? "evalIB"   : "evalPB" )  + idx;
	const evalSet     = (isArr ? "evalISet" : "evalPSet") + idx;
	const ctxKey: "unEvalArr" | "unEvalObj" = isArr ? "unEvalArr" : "unEvalObj";
	const typeChecked = isArr ? "array" : "object";
	const typeName    = isArr ? "Items" : "Properties";

	const typePosTest = isArr
		? "Array.isArray(" + inVar + ")"
		: '(typeof ' + inVar + '==="object"&&' + inVar + '!==null&&!Array.isArray(' + inVar + '))';

	const beenTested = parentCtx.typeChecked === typeChecked;
	// `innerBreak_` exits the local block as a *vacuous success* (skip-OK on
	// type-mismatch). `outerBreak_` propagates a *real failure* to the parent's
	// breakBlock — necessary because the parent may unconditionally set its own
	// success marker after dispatching us (e.g. `properties` handler adds the key
	// to its eval set right after the child returns). Swallowing failures into
	// the local block would let those markers fire on invalid input.
	const innerBreak_ = "break " + block + ";";
	// When dispatched by a *break-pattern* parent (e.g. `properties` handler
	// which unconditionally fires its eval-marker AFTER the child returns), we
	// must escalate failures to that parent's breakBlock to skip the marker.
	// When dispatched by a *counter-pattern* parent (oneOf/anyOf/allOf branches
	// have `breakBlock: undefined`), fall back to the local block: skipping
	// our own success markers is enough — the counter naturally stays unset
	// and the combinator detects "this branch didn't match".
	const outerBreak_ = parentCtx.breakBlock ? "break " + parentCtx.breakBlock + ";" : innerBreak_;
	const ifErrBreak_ = isCond ? "" : "if(errors.length)" + outerBreak_;

	const lengthExpr = isArr ? inVar + ".length" : "Object.keys(" + inVar + ").length";
	const parentSet = (parentCtx as any)[ctxKey] as string | undefined;
	let propagateAtEnd = !!parentSet;

	const steps: tsJSStepOp[] = [];
	steps.push(
		[STEP.BODY, block + ":{"],
		[STEP.BODY, "const " + evalSet + "=new Set();"]
	);

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
		breakBlock: parentCtx.breakBlock ?? block,
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
			? (parentCtx.counter ?? "") + (outVar ? outVar + "=true;" : "")
			: "";
		steps.push([STEP.BODY, "if(!(" + typePosTest + ")){" + passthrough + innerBreak_ + "}"]);
	}

	// (3) unEvalSchema branches
	if (typeof unEvalSchema === "boolean") {
		if (!unEvalSchema) {
			// FALSE → success requires every key/index to be in evalSet
			steps.push([STEP.BODY,
				"if(" + lengthExpr + ">" + evalSet + ".size){"
				+ (isCond ? "" : _err(parentCtx, inVar, pathVar + "/unevaluated" + typeName, "Unevaluated " + (isArr ? "items" : "properties") + " are not allowed") + ";")
				+ outerBreak_
				+ "}"
			]);
		} else {
			// TRUE → accept everything; copy directly to parent if any (skip
			// redundant forEach), and in parser mode copy un-evaluated to outVar
			if (parentSet) {
				steps.push([STEP.BODY, isArr
					? "for(let i=" + inVar + ".length;i--;)" + parentSet + ".add(i);"
					: "for(const k of Object.keys(" + inVar + "))" + parentSet + ".add(k);"
				]);
				propagateAtEnd = false;
			}
			if (!isCond) {
				steps.push([STEP.BODY, isArr
					? "for(let i=" + inVar + ".length;i--;){if(!" + evalSet + ".has(i))" + outVar + "[i]=" + inVar + "[i];}"
					: "for(const k of Object.keys(" + inVar + ")){if(!" + evalSet + ".has(k))" + outVar + "[k]=" + inVar + "[k];}"
				]);
			}
		}
	} else {
		// SCHEMA → iterate keys/indices NOT in evalSet, validate each.
		// Sub-DNA gets `breakBlock` only: validation failure breaks our block
		// (whole unEval fails), success falls through and we emit the
		// `<evalSet>.add(k);` ourselves (we own the lexical key/index).
		const enumOpen = isArr
			? "for(let i=" + inVar + ".length;i--;){const k=i,val=" + inVar + "[i];"
			: "for(const k of Object.keys(" + inVar + ")){const val=" + inVar + "[k];";
		const childOutVar = isCond ? "" : outVar + "[k]";
		const childCtx: tsJSParentCtx = {
			isCond,
			breakBlock: parentCtx.breakBlock ?? block,
		};

		steps.push([STEP.BODY, enumOpen + "if(!" + evalSet + ".has(k)){"]);
		steps.push([unEvalSchema, "val", childOutVar, pathVar + "/unevaluated" + typeName, childCtx]);
		steps.push([STEP.BODY,
			(isCond ? "" : "if(errors.length)" + outerBreak_)
			+ evalSet + ".add(k);"
			+ "}}"
		]);
	}

	// (4) propagate our set to parent (chains with oneOf/allOf/anyOf/nested unEval)
	if (propagateAtEnd) {
		steps.push([STEP.BODY, evalSet + ".forEach(v=>" + parentSet + ".add(v));"]);
	}

	// (5) cond-mode success markers — only reached if all checks passed:
	//   - parent's counter (we're a child of anyOf/allOf/oneOf/...): fire ONCE here
	//   - local `outVar=true;` (we're producing a result directly)
	if (isCond) {
		const tail = (parentCtx.counter ?? "") + (outVar ? outVar + "=true;" : "");
		if (tail) steps.push([STEP.BODY, tail]);
	}

	steps.push([STEP.BODY, "}"]);
	return steps;
};

export const assign = (dnaOpt: [number[], tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx) => {
	if (parentCtx.isCond) return (parentCtx.counter ?? "");
	else return _outVarName + "=" + _inVarName + ";";
}

export const seq = (dnaOpt: [number[], tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepOp[] => {
	const isCond = parentCtx.isCond;
	const seq = dnaOpt[0];
	const steps: tsJSStepOp[] = [];
	const idx = labelId();
	const seqBlock = "seqB" + idx;
	const ctx = {}

	steps.push([STEP.BODY, seqBlock + ":{"]);
	if (isCond) {
		const tmpVar = "tmp" + idx;
		steps.push([STEP.BODY, "let " + tmpVar + ";"]);
		for (let i = 0; i < seq.length; i++) {
			const it = seq[i];
			steps.push([STEP.BODY, tmpVar + "=false;"]);
			steps.push(
				[it, _inVarName, tmpVar, pathVar, parentCtx],
				[STEP.BODY, "if(!" + tmpVar + ")break " + seqBlock + ";"]
			);
		}
		steps.push([STEP.BODY, (_outVarName ? _outVarName + "=true;" : "") + "}"]);
	} else {
		for (let i = 0; i < seq.length; i++) {
			const it = seq[i];
			steps.push(
				[it, _inVarName, _outVarName, pathVar, parentCtx],
				[STEP.BODY, "if(errors.length)break " + seqBlock + ";"]
			);
		}
		steps.push([STEP.BODY, "}"]);
	}
	return steps;
}

export const ref = (dnaOpt: [number, tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFuncReturn => {
	const opt = dnaOpt[0];
	// Forward caller's eval-sets to the ref'd function when present (in-place
	// applicator semantic — e.g. `$ref` sibling of `unevaluatedProperties`).
	// When `parentCtx.unEvalArr/Obj` is undefined (nested via properties/items,
	// or no uneval context), we pass `undefined` and the function preludes a
	// dummy set internally → no propagation back to caller.
	const ea = parentCtx.unEvalArr, eo = parentCtx.unEvalObj;
	const res = (ea || eo)
		? namer(opt) + "(" + _inVarName + "," + (ea ?? "undefined") + "," + (eo ?? "undefined") + ")"
		: namer(opt) + "(" + _inVarName + ")";
	return _assignOrCond(parentCtx, _inVarName, _outVarName, "", res, "", "", true);
}

export const type = (dnaOpt: [string[], tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const indices = dnaOpt[0];
	const tests: string[] = [];
	for (let i = 0; i < indices.length; i++) {
		switch (indices[i]) {
			case "string":  tests.push('typeof ' + _inVarName + '==="string"'); break;
			case "number":  tests.push('typeof ' + _inVarName + '==="number"'); break;
			case "integer": tests.push('typeof ' + _inVarName + '==="number"&&Number.isInteger(' + _inVarName + ')'); break;
			case "boolean": tests.push('typeof ' + _inVarName + '==="boolean"'); break;
			case "null":    tests.push(_inVarName + '===null'); break;
			case "object":  tests.push('typeof ' + _inVarName + '==="object"&&' + _inVarName + '!==null&&!Array.isArray(' + _inVarName + ')'); break;
			case "array":   tests.push('Array.isArray(' + _inVarName + ')'); break;
		}
	}
	if (tests.length === 0) return "";
	// Positive disjunction: "value is one of these types". Routed through
	// `_assignOrCond` so it handles cond/parser/counter modes uniformly
	// (the old impl emitted `errors.push` directly, breaking validator mode).
	const test = "(" + tests.join(")||(") + ")";
	const errMsg = _err(parentCtx, _inVarName, pathVar + "/type", "Data should be valid to at least one type of:" + indices.join(", ")) + ERR_UNDEF;
	return _assignOrCond(parentCtx, _inVarName, _outVarName, errMsg, test, "", "", true);
};

const string = (dnaOpt: tsStringDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx, declared: boolean): tsJSFn => {
	const opt = dnaOpt[0], min = opt[0], max = opt[1], pattern = opt[2], format = opt[3];
	const isCond = parentCtx.isCond;
	const body: string[] = [];
	const test = parentCtx.typeChecked === "string" ? "" : "typeof " + _inVarName + '==="string"';
	const steps: tsJSStepAct[] = [];

	if (min !== null || max !== null) {
		steps.push([STEP.CONST, FN_fCount]);
	};

	if (min !== null) body.push(_errMode(isCond,
		"(strCnt>=" + String(min) + ")",
		_err(parentCtx, _inVarName, pathVar + "/string/minLength", "String length must be at least " + String(min)) + ERR_UNDEF
	));
	if (max !== null) body.push(_errMode(isCond,
		"(strCnt<=" + String(max) + ")",
		_err(parentCtx, _inVarName, pathVar + "/string/maxLength", "String length must be at most " + String(max)) + ERR_UNDEF
	));

	if (pattern !== null) body.push(_errMode(isCond,
		// `u` flag: enables Unicode-aware regex (e.g. `\p{Letter}`). JSON Schema's
		// ECMA-262 dialect supports these only in Unicode mode.
		"(/" + pattern + "/u.test(" + _inVarName + "))",
		_err(parentCtx, _inVarName, pathVar + "/string/pattern", "String must match pattern " + pattern) + ERR_UNDEF
	));

	if (format !== null) {
	}

	const errMsg = _err(parentCtx, _inVarName, pathVar + "/string", "String is required") + ERR_UNDEF;
	const preBody = (min !== null || max !== null) ? "strCnt=fCount(" + _inVarName + ");" : "";

	const res = _assignOrCond(parentCtx, _inVarName, _outVarName, errMsg, test, preBody, body, declared);

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

	let test = "", typeName = "";
	switch (type) {
		case "n":
			typeName = "number";
			test = "typeof " + _inVarName + '==="number"';
			break;
		case "i":
			typeName = "integer";
			test = "typeof " + _inVarName + '==="number"&&' + _inVarName + "%1===0";
			break;
		case "bi":
			typeName = "bigint";
			test = "typeof " + _inVarName + '==="bigint"';
			break;
	}

	test = parentCtx.typeChecked === "number" ? "" : test;

	if (min !== null) body.push(_errMode(isCond,
		"(" + _inVarName + (exclMin ? ">" : ">=") + String(min) + ")",
		_err(parentCtx, _inVarName, pathVar + "/" + typeName + "/" + (exclMin ? "exclusiveMinimum" : "minimum"), "Number must be at least " + String(min)) + ERR_UNDEF
	));
	if (max !== null) body.push(_errMode(isCond,
		"(" + _inVarName + (exclMax ? "<" : "<=") + String(max) + ")",
		_err(parentCtx, _inVarName, pathVar + "/" + typeName + "/" + (exclMax ? "exclusiveMaximum" : "maximum"), "Number must be at most " + String(max)) + ERR_UNDEF
	));
	if (multOf !== null) {
		// Use modulo for integers, division for floats to avoid floating-point precision issues
		if (Number.isInteger(multOf)) {
			body.push(_errMode(isCond,
				"(" + _inVarName + "%" + String(multOf) + "===0)",
				_err(parentCtx, _inVarName, pathVar + "/" + typeName + "/multipleOf", "Number must be a multiple of " + String(multOf)) + ERR_UNDEF
			));
		} else {
			body.push(_errMode(isCond,
				"(Math.abs(" + _inVarName + "/" + String(multOf) + "-Math.round(" + _inVarName + "/" + String(multOf) + "))<1e-10)",
				_err(parentCtx, _inVarName, pathVar + "/" + typeName + "/multipleOf", "Number must be a multiple of " + String(multOf)) + ERR_UNDEF
			));
		}
	}

	const testErr = _err(parentCtx, _inVarName, pathVar + "/" + typeName, typeName + " is required") + ERR_UNDEF;

	parentCtx.typeChecked = "number";
	return _assignOrCond(parentCtx, _inVarName, _outVarName, testErr, test, "", body, declared);

};

export const n = (dnaOpt: tsNumberDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString =>
	number(dnaOpt, "n", _inVarName, _outVarName, pathVar, labelId, parentCtx, true);
export const _n = (dnaOpt: tsNumberDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString =>
	number(dnaOpt, "n", _inVarName, _outVarName, pathVar, labelId, parentCtx, false);
export const i = (dnaOpt: tsNumberDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString =>
	number(dnaOpt, "i", _inVarName, _outVarName, pathVar, labelId, parentCtx, true);
export const bi = (dnaOpt: tsNumberDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString =>
	number(dnaOpt, "bi", _inVarName, _outVarName, pathVar, labelId, parentCtx, true);

export const boolean = (dnaOpt: [tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const test = parentCtx.typeChecked === "boolean" ? "" : "typeof " + _inVarName + '==="boolean"';
	const testErr = _err(parentCtx, _inVarName, pathVar + "/boolean", "Boolean is required") + ERR_UNDEF;
	parentCtx.typeChecked = "boolean";
	return _assignOrCond(parentCtx, _inVarName, _outVarName, testErr, test, "", "", true);
};
export const nullType = (dnaOpt: [tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const test = parentCtx.typeChecked === "null" ? "" : _inVarName + "===null";
	const condErr = _err(parentCtx, _inVarName, pathVar + "/null", "Null is required") + ERR_UNDEF;
	parentCtx.typeChecked = "null";
	return _assignOrCond(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true);
};
export const n0 = nullType;

export const trueSchema = (dnaOpt: [tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	// `trueSchema` has no lexical index/key context, so it cannot meaningfully
	// emit `set.add(...)`. The convention is: the dispatching parent (e.g.
	// `prefixItems` / items loop / `_unEvalEnv` schema branch) is responsible
	// for emitting the eval-set additions AFTER the sub-DNA succeeds.
	const ctx = { isCond: parentCtx.isCond, breakBlock: parentCtx.breakBlock, counter: parentCtx.counter };
	return _assignOrCond(ctx, _inVarName, _outVarName, "", "", "", "", true);
};
export const falseSchema = (dnaOpt: [tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	// `false` schema always rejects. Cannot go through `_assignOrCond` because
	// that helper's success path emits the OK code (counter/outAssign) — we want
	// the opposite.
	const break_ = parentCtx.breakBlock ? "break " + parentCtx.breakBlock + ";" : "return false;";
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
	const test = _inVarName + "===" + check;
	const condErr = _err(parentCtx, _inVarName, pathVar + "/const", "Const value is expected:" + check) + ERR_UNDEF;
	// parentCtx.typeChecked = "const";
	return _assignOrCond(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true);
};
export const constTypeComplex = (dnaOpt: tsConstDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn => {
	const check = dnaOpt[0];
	const steps: tsJSStepAct[] = [];
	// For complex constants (objects/arrays), use deepEqual
	steps.push([STEP.CONST, FN_dEq])
	const test = "dEq(" + _inVarName + "," + check + ")";
	const condErr = _err(parentCtx, _inVarName, pathVar + "/const", "Const value is expected:" + check) + ERR_UNDEF;

	let res: string;
	if (parentCtx.isCond) res = _assignOut(_outVarName, test);
	else res = _outVarName + "=" + test + "?" + check + ":" + condErr + ";";

	steps.push([STEP.BODY, res]);
	// parentCtx.typeChecked = "const";
	return steps;
};
export const literal = (dnaOpt: tsConstDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
	const enumList = dnaOpt[0];
	// Use a switch-like expression for strict type checking
	let enumLen = enumList.length;
	const checks = new Array(enumLen);
	if (enumLen) for (; enumLen--;) { const v = enumList[enumLen]; checks[enumLen] = _inVarName + "===" + JSON.stringify(v) }
	const test = "(" + checks.join(")||(") + ")";
	const condErr = _err(parentCtx, _inVarName, pathVar + "/const", "Const value is expected:" + JSON.stringify(enumList)) + ERR_UNDEF;

	let res: string;
	if (parentCtx.isCond) res = _assignOut(_outVarName, test);
	else res = _outVarName + "=" + test + "?" + _inVarName + ":" + condErr + ";";

	// parentCtx.typeChecked = "literal";
	return res;
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
	for (let i = enumList.length; i--;) checks[i] = _inVarName + "===" + JSON.stringify(enumList[i]);
	const test = checks.length === 0 ? "false" : "(" + checks.join("||") + ")";
	const condErr = _err(parentCtx, _inVarName, pathVar + "/enum", "Value must be one of: " + JSON.stringify(enumList)) + ERR_UNDEF;
	return _assignOrCond(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true);
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
			? "dEq(" + _inVarName + "," + JSON.stringify(v) + ")"
			: _inVarName + "===" + JSON.stringify(v);
	}
	steps.push([STEP.CONST, FN_dEq]);
	const test = checks.length === 0 ? "false" : "(" + checks.join("||") + ")";
	const condErr = _err(parentCtx, _inVarName, pathVar + "/enum", "Value must be one of: " + JSON.stringify(enumList)) + ERR_UNDEF;
	steps.push([STEP.BODY, _assignOrCond(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true)]);
	return steps;
};


export const unevaluatedProperties = (dnaOpt: [number, number[], tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepOp[] =>
	_unEvalEnv(parentCtx, {
		kind: "properties",
		idx: labelId(),
		seq: dnaOpt[1],
		unEvalSchema: dnaOpt[0],
		inVar: _inVarName,
		outVar: _outVarName,
		pathVar,
	});

// const unevaluatedProperties_old = (dnaOpt: [number, number[], tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepOp[] => {
// 	const unEvalPropSchema = dnaOpt[0];
// 	const isCond = parentCtx.isCond;
// 	const seq = dnaOpt[1];
// 	const steps: tsJSStepOp[] = [];
// 	const idx = labelId()
// 	const evalVar = "evalP" + idx;
// 	const uEvalBlock = "evalPB" + idx;
// 	const evalSet = "evalPSet" + idx;
// 	const innerFail_ = "break " + uEvalBlock + ";"
// 	const ifLocalErr = isCond ? "if(!" + evalVar + ")" + innerFail_ : "if(errors.length)" + innerFail_;

// 	const childrenCtx = { unEvalObj: evalSet, breakBlock: uEvalBlock, isCond };

// 	const checkType = '!(typeof ' + _inVarName + '==="object"&&' + _inVarName + "!==null&&!Array.isArray(" + _inVarName + "))";

// 	steps.push(
// 		[STEP.BODY, uEvalBlock + ":{"],
// 		[STEP.BODY, "const " + evalSet + "=new Set();" + (seq.length > 1 ? "let " + evalVar + ";" : "")]
// 	);

// 	for (let i = 0; i < seq.length; i++) {
// 		const it = seq[i];
// 		if (i > 0) steps.push([STEP.BODY, ifLocalErr])
// 		steps.push(
// 			[it, i === 0 ? _inVarName : evalVar, i + 1 === seq.length ? _outVarName : evalVar, pathVar, childrenCtx],
// 		);
// 	}

// 	if (isCond) {
// 		if (typeof unEvalPropSchema === "boolean") {
// 			if (!unEvalPropSchema) { // false : reject everything
// 				steps.push([STEP.BODY,
// 				(parentCtx.typeChecked === "object" ? "" : "if(" + checkType + ")" + innerFail_)
// 				+ "if(Object.keys(" + _inVarName + ").length>" + evalSet + ".size)"
// 				+ innerFail_
// 				// + "}" //closure of if
// 				// + _assignOrCond(parentCtx, "", _inVarName, _outVarName)
// 				+ "}" //closure of evalBlock
// 				]);
// 				return steps;
// 			}
// 			// true : accept everything
// 			steps.push([STEP.BODY, _outVarName + "=true;}"]);
// 			return steps;
// 		}
// 		steps.push(
// 			[STEP.BODY,
// 			(parentCtx.typeChecked === "object" ? "" : "if(" + checkType + ")" + innerFail_)
// 			+ "const kk=Object.keys(" + _inVarName + ");let kl=kk.length;"
// 			+ "while(kl--){"
// 			+ "const key=kk[kl],val=" + _inVarName + "[key];"
// 			+ "if(!" + evalSet + ".has(key)){"],
// 			[unEvalPropSchema, "val", evalVar, pathVar + "/unevaluatedProperties", childrenCtx],
// 			[STEP.BODY, ifLocalErr + "}" + "}}"], // closing while and evalBlock
// 		);
// 	} else {
// 		if (typeof unEvalPropSchema === "boolean") {
// 			if (!unEvalPropSchema) { // false : reject everything
// 				steps.push([STEP.BODY,
// 				(parentCtx.typeChecked === "object" ? "" : "if(" + checkType + ")" + innerFail_)
// 				+ "if(Object.keys(" + _inVarName + ").length>" + evalSet + ".size){"
// 				+ _err(parentCtx, _inVarName, pathVar + "/unevaluatedProperties", "Unevaluated properties are not allowed") + ";"
// 				+ innerFail_
// 				+ "}" //closure of if
// 				+ "}" //closure of evalBlock
// 				]);
// 				return steps;
// 			}
// 			steps.push(
// 				[STEP.BODY,
// 				(parentCtx.typeChecked === "object" ? "" : "if(" + checkType + ")" + innerFail_)
// 				+ "const kk=Object.keys(" + _inVarName + ");let kl=kk.length;"
// 				+ "while(kl--){const key=kk[kl];"
// 				+ "if(!" + evalSet + ".has(key))" + _outVarName + "[key]=" + _inVarName + "[key];"
// 				+ "}" // closing while
// 				+ "}" // closing evalBlock
// 				]
// 			);
// 			return steps;
// 		}

// 		steps.push(
// 			[STEP.BODY,
// 			(parentCtx.typeChecked === "object" ? "" : "if(" + checkType + ")" + innerFail_)
// 			+ "const kk=Object.keys(" + _inVarName + ");let kl=kk.length;"
// 			+ "while(kl--){"
// 			+ "const key=kk[kl],val=" + _inVarName + "[key];"
// 			+ "if(!" + evalSet + ".has(key)){"],
// 			[unEvalPropSchema, "val", _outVarName + "[key]", pathVar + "/unevaluatedProperties", childrenCtx],
// 			[STEP.BODY, ifLocalErr + "}}}"] // closing while and breakBlock
// 		)
// 	}
// 	return steps;
// };

// const object_old = (dnaOpt: tsObjectDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx, declared = true): tsJSFn => {
// 	const isCond = parentCtx.isCond;
// 	const idx = labelId();
// 	const oVar = "oVar" + idx;
// 	const oLen = "oLen" + idx;
// 	const oVarIdx = oVar + "[i]";
// 	const loopVar = "val" + idx;

// 	// passedIdx for property tracking for additionalProperties
// 	let passedIdx = "";
// 	const evalParent = parentCtx.unEvalObj ?? "";  // set name only e.g. "evalPSet0"
// 	const evalParentKey_ = evalParent.length ? evalParent + ".add(key);" : "";

// 	const needsOwnBlock = !parentCtx.breakBlock && !(parentCtx.ownScope === false && !parentCtx.counter);
// 	const _block = needsOwnBlock ? "oB" + idx : "";
// 	const innerBreak_ = "break " + _block + ";"
// 	const outerFail_ = parentCtx.breakBlock ? "break " + parentCtx.breakBlock + ";" : "return false;";
// 	const innerFail_ = needsOwnBlock ? innerBreak_ : outerFail_;
// 	const _innerFail_ = ";" + innerFail_;
// 	const innerIfErrFail_ = "if(errors.length)" + innerFail_;
// 	const _innerIfErrFail_ = ";" + innerIfErrFail_;

// 	const opt = dnaOpt[0];
// 	const steps: tsJSStepOp[] = [];

// 	// Type validation
// 	const typeValidation =
// 		[
// 			// if - err (then)
// 			"typeof " + _inVarName + '!=="object"||' + _inVarName + "===null||Array.isArray(" + _inVarName + ")",
// 			declared ? _err(parentCtx, _inVarName, pathVar + "/object", "Object is required") : _outVarName + "=" + _inVarName
// 		];


// 	const neededConstants: string[] = []
// 	const regexConstants: string[] = []

// 	// object constraint checks
// 	let objectCheck = [];

// 	// object Properties
// 	let propertiesChecks = [];
// 	let patternPropChecks = [];
// 	let patternPropertiesBooleanChecks: boolean | undefined;
// 	let propertyNamesCheck: number | boolean | undefined = undefined
// 	let additionalPropertiesCheck: number | boolean | undefined = undefined;

// 	// dynamic properties & loop for dynamic properties
// 	let needLength = false;
// 	let requiresAddPropTracking = true;
// 	let hasDynamicProps = false;
// 	// `keyLoopNeeded` will be derived after the opt scan: a per-key loop is only
// 	// useful when something actually does work per key (patternProperties,
// 	// propertyNames as schema, additionalProperties as schema, or `:true` in parser
// 	// mode for copying unknown keys). Pure `additionalProperties: false` does NOT
// 	// require iterating: the Set size vs Object.keys length is enough.


// 	for (let i = 0; i < opt.length; i++) {
// 		const it = opt[i];
// 		const data = it[1];
// 		switch (it[0]) {
// 			case "minProperties":
// 				needLength = true;
// 				objectCheck.push([
// 					oLen + "<" + String(data),
// 					_err(parentCtx, _inVarName, pathVar + "/object/minProperties", "Object requires at least " + String(data) + " properties")
// 				])
// 				// objectCheck += "if(" + oLen + "<" + String(data) + "){"
// 				// 	+ innerFail_
// 				// 	+ "}";
// 				break;
// 			case "maxProperties":
// 				needLength = true;
// 				if (data > -1)
// 					objectCheck.push([
// 						oLen + ">" + String(data),
// 						_err(parentCtx, _inVarName, pathVar + "/object/maxProperties", "Object requires at most " + String(data) + " properties")
// 					])
// 				// += "if(" +  + "){"
// 				// 		+ (isCond ? "" : _err(parentCtx, _inVarName, pathVar + "/object/maxProperties", "Object requires at most " + String(data) + " properties") + ";")
// 				// 		+ innerFail_
// 				// 		+ "}";
// 				break;
// 			case "required":
// 				if (data.length > 0)
// 					for (let i = 0; i < data.length; i++) {
// 						const el = JSON.stringify(data[i]).slice(1, -1);
// 						objectCheck.push([
// 							"!Object.hasOwn(" + _inVarName + ',"' + el + '")',
// 							_err(parentCtx, _inVarName, pathVar + "/object/required/" + el, 'Required property "' + el + '" is missing')
// 						]);
// 					}
// 				break;

// 			case "dependentRequired":
// 				if (Object.keys(data).length > 0) {
// 					const keys = Object.keys(data);
// 					for (let i = 0; i < keys.length; i++) {
// 						const triggerProp = keys[i];
// 						const requiredProps = data[triggerProp];
// 						const triggerPropStr = JSON.stringify(triggerProp);
// 						const triggerPropDisplay = triggerPropStr.slice(1, -1);
// 						const condition = "Object.hasOwn(" + _inVarName + "," + triggerPropStr + ")";
// 						for (let j = 0; j < requiredProps.length; j++) {
// 							const reqPropStr = JSON.stringify(requiredProps[j]);
// 							const reqPropDisplay = reqPropStr.slice(1, -1);
// 							objectCheck.push([
// 								condition + "&&!Object.hasOwn(" + _inVarName + "," + reqPropStr + ")",
// 								_err(parentCtx, _inVarName, pathVar + "/object/dependentRequired/" + triggerPropDisplay, 'Property "' + reqPropDisplay + '" is required when "' + triggerPropDisplay + '" is present')
// 							]);
// 						}
// 					}
// 				}
// 				break;

// 			case "properties":
// 				propertiesChecks = data;
// 				break;

// 			case "patternProperties":
// 				hasDynamicProps = true;
// 				for (let i = 0; i < data.length; i++) {
// 					const el = data[i];
// 					const regexVar = "rxPP" + idx + "_" + i;
// 					neededConstants.push(regexVar + "=/" + el[0] + "/u");
// 					patternPropChecks.push([regexVar, el[0], el[1]]);
// 				}
// 				break;

// 			case "propertyNames":
// 				hasDynamicProps = true;
// 				propertyNamesCheck = data;
// 				break;

// 			case "additionalProperties": {
// 				hasDynamicProps = true;
// 				passedIdx = "passed" + idx;
// 				neededConstants.push(passedIdx + "=new Set()");
// 				additionalPropertiesCheck = data
// 				break;
// 			}
// 		}
// 	}
// 	const passedIdxAddKey_ = passedIdx.length ? passedIdx + ".add(key);" : "";

// 	// In isCond mode, only schemas/patterns trigger per-key work.
// 	const keyLoopNeededIsCond = (propertyNamesCheck !== undefined && typeof propertyNamesCheck !== "boolean")
// 		|| (typeof propertyNamesCheck === "boolean" && propertyNamesCheck === true && (!!evalParent.length || !!passedIdx))
// 		|| (typeof propertyNamesCheck === "boolean" && propertyNamesCheck === false)
// 		|| patternPropChecks.length > 0
// 		|| patternPropertiesBooleanChecks !== undefined
// 		|| typeof additionalPropertiesCheck === "number";
// 	// Parser mode additionally needs the loop for `additionalProperties: true`
// 	// (copying unknown keys), `propertyNames: false` (per-key error reporting),
// 	// and `propertyNames: true` (copying all keys).
// 	const keyLoopNeededParser = keyLoopNeededIsCond
// 		|| additionalPropertiesCheck === true
// 		|| typeof propertyNamesCheck === "boolean"


// 	if (needLength || hasDynamicProps) {
// 		if (!hasDynamicProps) neededConstants.push(oLen + "=Object.keys(" + _inVarName + ").length");
// 		else neededConstants.push(oVar + "=Object.keys(" + _inVarName + ")", oLen + "=" + oVar + ".length");
// 	}

// 	if (regexConstants.length) fastMergeArrays(neededConstants, regexConstants);
// 	// if (neededConstants.length) steps.push([STEP.BODY, "const " + neededConstants.join(",") + ";"]);

// 	// CODE GENERATION

// 	if (_block.length) steps.push([STEP.BODY, _block + ":{"]);

// 	if (isCond) {
// 		const childrenCtx: tsJSParentCtx = { isCond: true, breakBlock: parentCtx.breakBlock || _block };
// 		const _outTrue = _outVarName ? _outVarName + "=true;" : "";

// 		const strReturn =
// 			steps.push([STEP.BODY,
// 			// typevalidation
// 			"if(" + typeValidation[0] + ")" + (declared ? innerFail_ : "{" + _outTrue + innerBreak_ + "}")
// 			+ (neededConstants.length ? "const " + neededConstants.join(",") + ";" : "")
// 			+ (objectCheck.length ? "if((" + objectCheck.map(it => it[0]).join(")||(") + "))" + innerFail_ : "")
// 			]);
// 		if (propertiesChecks.length) {
// 			// let requiresPassed = hasDynamicProps && requiresAddPropTracking;
// 			for (let i = 0; i < propertiesChecks.length; i++) {
// 				const el = propertiesChecks[i], el0 = JSON.stringify(el[0]), el0Litteral = el0.slice(1, -1);
// 				const name = el[0], _name = JSON.stringify(name);
// 				const dnaIdx = el[1];
// 				const propVal = "ob" + idx + "pp" + i;
// 				const objKey = _inVarName + "[" + _name + "]";

// 				// Properties are optional by default (JSON Schema compliant)
// 				steps.push(
// 					[STEP.BODY, "if(Object.hasOwn(" + _inVarName + "," + _name + ")){"
// 						+ "let " + propVal + "=" + objKey + ";"
// 					],
// 					[dnaIdx, propVal, "", pathVar + "/properties/" + el0Litteral, childrenCtx],
// 					[STEP.BODY, (evalParent.length
// 						? evalParent + ".add(" + _name + ");"
// 						: "")
// 						+ (passedIdx ? passedIdx + ".add(" + _name + ");" : "")
// 					],
// 					[STEP.BODY, "}"]
// 				);
// 			}
// 			// steps.push([STEP.BODY, "else " + innerFail_ ]);
// 		}
// 		if (hasDynamicProps && keyLoopNeededIsCond) { //loop
// 			steps.push([STEP.BODY, "for(let i=0;i<" + oLen + ";i++){const key=" + oVarIdx + "," + loopVar + "=" + _inVarName + "[key];"]);

// 			//propertyNames
// 			if (propertyNamesCheck !== undefined) {
// 				if (typeof propertyNamesCheck === "boolean") {
// 					if (propertyNamesCheck === false) {
// 						// In isCond mode, just break without error (no errors array)
// 						steps.push([STEP.BODY, innerFail_]);

// 					} else {
// 						// If true, accept all - no validation needed, just store the property
// 						if (evalParent.length || passedIdx) steps.push([STEP.BODY, evalParentKey_ + passedIdxAddKey_]);
// 					}
// 				} else {
// 					steps.push(
// 						[propertyNamesCheck, "key", "", pathVar + "/propertyNames", childrenCtx],
// 						// [STEP.BODY, evalParentKey_]
// 						// [STEP.BODY, "))" + innerFail_
// 						// + _err(parentCtx, oVarIdx, pathVar + "/propertyNames", "Property name does not match schema") + _innerFail_ + "}"
// 						// + _outVarName + "[key]=val;"
// 						// + (evalParent.length || passedIdx ? "else{" + evalParentKey_ + passedIdxAddKey_ + "}" : "")
// 						// ]
// 					);
// 				}
// 			}

// 			//patternProperties 
// 			if (patternPropChecks.length) {
// 				for (let i = 0; i < patternPropChecks.length; i++) {
// 					const el = patternPropChecks[i];
// 					steps.push(
// 						[STEP.BODY, "if(" + el[0] + ".test(key)){"],
// 						[el[2], loopVar, "", pathVar + "/patternProperties/" + el[1], childrenCtx],
// 						[STEP.BODY, (evalParent.length ? evalParent + ".add(key);" : "") + "}"],
// 					);
// 				}
// 			}
// 			if (patternPropertiesBooleanChecks !== undefined) {
// 				if (patternPropertiesBooleanChecks === false) {
// 					steps.push([STEP.BODY, _err(parentCtx, "key", pathVar + "/propertyNames", "Property names not allowed") + _innerFail_]);
// 				}
// 				// If true, accept all - no validation needed, just store the property
// 				steps.push([STEP.BODY, evalParentKey_ + passedIdxAddKey_]);
// 			}
// 			//additionalProperties
// 			if (additionalPropertiesCheck !== undefined) {
// 				if (typeof additionalPropertiesCheck === "boolean") {
// 					if (additionalPropertiesCheck === false)
// 						steps.push(
// 							// close the loop and then test the size
// 							[STEP.BODY, "}if(" + passedIdx + ".size<" + oLen + ")" + innerFail_ + (evalParentKey_ ? "else " + evalParentKey_ : "")]
// 						);
// 					else steps.push([STEP.BODY, "}"]); // close the loop
// 				} else {
// 					steps.push(
// 						[STEP.BODY, "if(!" + passedIdx + ".has(key)){"],
// 						[additionalPropertiesCheck, loopVar, "", pathVar + "/additionalProperties/", childrenCtx],
// 						[STEP.BODY, "}}"]
// 					)
// 				}
// 			} else steps.push([STEP.BODY, "}"]); // close the loop
// 		} else if (hasDynamicProps && additionalPropertiesCheck === false) {
// 			// No per-key work needed: just verify that every input key was matched by
// 			// `properties` (Set populated above). No iteration required.
// 			steps.push([STEP.BODY, "if(" + passedIdx + ".size<" + oLen + ")" + innerFail_]);
// 		} // end of loop
// 		if (parentCtx.counter) steps.push([STEP.BODY, parentCtx.counter])
// 		if (!evalParent && _outVarName) steps.push([STEP.BODY, _outVarName + "=true;"]);

// 	} else { // isCond=false
// 		steps.push([STEP.BODY,
// 		// typevalidation
// 		"if(" + typeValidation[0] + "){" // changed from "if(" + typeValidation[0] + "){" to "if(" + typeValidation[0] + "){" 
// 		+ (declared ? typeValidation[1] : _outVarName + "=" + _inVarName) + _innerFail_
// 		+ "}"
// 		+ (neededConstants.length ? "const " + neededConstants.join(",") + ";" : "")
// 		+ ((propertiesChecks.length || hasDynamicProps) ? _outVarName + "={};" : _outVarName + "=" + _inVarName + ";")
// 		+ objectCheck.map(it => "if(" + it[0] + "){" + it[1] + _innerFail_ + "}").join("")
// 		]);

// 		if (propertiesChecks.length) {
// 			let requiresPassed = hasDynamicProps && requiresAddPropTracking;
// 			for (let i = 0; i < propertiesChecks.length; i++) {
// 				const el = propertiesChecks[i], el0 = JSON.stringify(el[0]), el0Litteral = el0.slice(1, -1);
// 				const name = el[0], _name = JSON.stringify(name);
// 				const dnaIdx = el[1];
// 				const objKey = _inVarName + "[" + _name + "]";

// 				steps.push(
// 					[STEP.BODY, "if(Object.hasOwn(" + _inVarName + "," + _name + ")){"],
// 					[dnaIdx, objKey, _outVarName + "[" + _name + "]", pathVar + "/properties/" + el0Litteral],
// 					[STEP.BODY, innerIfErrFail_
// 						+ (evalParent.length ? evalParent + ".add(" + _name + ");" : "")
// 						+ (requiresPassed ? passedIdx + ".add(" + _name + ");" : "")
// 						+ "}"
// 					]
// 				);
// 			}
// 		}

// 		if (hasDynamicProps && keyLoopNeededParser) { //loop
// 			steps.push([STEP.BODY, "for(let i=0;i<" + oLen + ";i++){const key=" + oVarIdx + "," + loopVar + "=" + _inVarName + "[key];"]);
// 			//propertyNames
// 			if (propertyNamesCheck !== undefined) {
// 				if (typeof propertyNamesCheck === "boolean") {
// 					if (propertyNamesCheck === false) {
// 						steps.push([STEP.BODY, _err(parentCtx, "key", pathVar + "/propertyNames", "Property names not allowed") + _innerFail_]);
// 					} else {
// 						// If true, accept all - no validation needed, just store the property
// 						steps.push([STEP.BODY, _outVarName + "[key]=" + loopVar + ";" + evalParentKey_ + passedIdxAddKey_]);
// 					}
// 				} else {
// 					steps.push(
// 						[propertyNamesCheck, "key", _outVarName + "[key]", pathVar + "/propertyNames"],
// 						[STEP.BODY, "if(errors.length){"
// 							+ _err(parentCtx, oVarIdx, pathVar + "/propertyNames", "Property name does not match schema")
// 							+ _innerFail_
// 							+ "}"
// 							+ _outVarName + "[key]=" + loopVar + ";"
// 							+ evalParentKey_ + passedIdxAddKey_
// 						]
// 					);
// 				}
// 			}

// 			//patternProperties 
// 			if (patternPropChecks.length) for (let i = 0; i < patternPropChecks.length; i++) {
// 				const el = patternPropChecks[i];
// 				// Push step to process this pattern property
// 				steps.push([STEP.BODY, "if(" + el[0] + ".test(key)){"],
// 					[el[2], loopVar, _outVarName + "[key]", pathVar + "/patternProperties/" + el[1], { isCond }],
// 					[STEP.BODY, evalParentKey_ + passedIdxAddKey_ + "}"]
// 				);
// 			}
// 			if (patternPropertiesBooleanChecks !== undefined) {
// 				if (patternPropertiesBooleanChecks === false) {
// 					steps.push([STEP.BODY, _err(parentCtx, "key", pathVar + "/propertyNames", "Property names not allowed") + _innerFail_]);
// 				}
// 				// If true, accept all - no validation needed, just store the property
// 				steps.push([STEP.BODY, _outVarName + "[key]=" + loopVar + ";" + evalParentKey_ + passedIdxAddKey_]);
// 			}
// 			//additionalProperties
// 			if (additionalPropertiesCheck !== undefined) {
// 				if (typeof additionalPropertiesCheck === "boolean") {
// 					if (additionalPropertiesCheck === true) {
// 						steps.push([STEP.BODY, "if(!" + passedIdx + ".has(key)){" + _outVarName + "[key]=" + loopVar + ";" + evalParentKey_ + "}"]);
// 					} else {
// 						steps.push(
// 							// close the loop and then test the size
// 							[STEP.BODY, "if(" + passedIdx + ".size<" + oLen + "){"
// 								+ _err(parentCtx, loopVar, pathVar + "/additionalProperties", "Additional properties not allowed")
// 								+ _innerIfErrFail_ + evalParentKey_ + "}"]
// 						);
// 					}
// 				} else {
// 					steps.push(
// 						[STEP.BODY, "if(!" + passedIdx + ".has(key)){"],
// 						[additionalPropertiesCheck, loopVar, _outVarName.length ? _outVarName + "[key]" : "", pathVar + "/additionalProperties/"],
// 						[STEP.BODY, "}" + innerIfErrFail_])
// 				}
// 			}

// 			// steps.push([STEP.BODY, _innerIfErrFail_]);
// 			steps.push([STEP.BODY, "}"]); // close the loop
// 		} else if (hasDynamicProps && additionalPropertiesCheck === false) {
// 			// No per-key work needed: emit the size check directly without iterating.
// 			steps.push([STEP.BODY, "if(" + passedIdx + ".size<" + oLen + "){"
// 				+ _err(parentCtx, _inVarName, pathVar + "/additionalProperties", "Additional properties not allowed")
// 				+ _innerFail_ + "}"]);
// 		} // end of loop
// 		if (parentCtx.counter) steps.push([STEP.BODY, parentCtx.counter + ";"]);
// 	}

// 	if (_block.length) steps.push([STEP.BODY, "}"]);

// 	parentCtx.typeChecked = "object";
// 	return steps;
// };

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

	const frame = _envFrame(parentCtx, "oB", idx);
	const { block, break_, _break_ } = frame;
	const innerIfErrFail_ = "if(errors.length)" + break_;
	const _innerIfErrFail_ = ";" + innerIfErrFail_;

	let passedIdx = "";
	const evalParent = parentCtx.unEvalObj ?? "";
	const evalParentKey_ = evalParent.length ? evalParent + ".add(key);" : "";

	const opt = dnaOpt[0];

	const neededConstants: string[] = [];
	const regexConstants: string[] = [];
	let objectCheck: [string, string][] = [];

	let propertiesChecks: any[] = [];
	let dependentSchemasChecks: any[] = [];
	let patternPropChecks: any[] = [];
	let patternPropertiesBooleanChecks: boolean | undefined;
	let propertyNamesCheck: number | boolean | undefined = undefined;
	let additionalPropertiesCheck: number | boolean | undefined = undefined;
	// Per-key concerns extracted into structured state so we can emit a single
	// `if(Object.hasOwn(v,K))` block per declared key (AJV-style grouping) that
	// fuses `properties`, `required`, `dependentRequired`, `dependentSchemas`.
	// Fast-fail style: required keys emit `if(!hasOwn) break` upfront (no else).
	let requiredList: string[] = [];
	let depReqMap: Record<string, string[]> = {};

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
				if (data && typeof data === "object") depReqMap = data;
				break;
			case "properties":
				propertiesChecks = data;
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
				neededConstants.push(passedIdx + "=new Set()");
				additionalPropertiesCheck = data;
				break;
		}
	}
	const passedIdxAddKey_ = passedIdx.length ? passedIdx + ".add(key);" : "";

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
	const typePosTest = "typeof " + inVar + '==="object"&&' + inVar + "!==null&&!Array.isArray(" + inVar + ")";
	const typeErrMsg = _err(parentCtx, inVar, pathVar + "/object", "Object is required");

	// Build innerSteps depending on mode
	const innerSteps: tsJSStepOp[] = [];

	// ---------------------------------------------------------------
	// UNIFIED PER-KEY EMISSION (AJV-style grouping, fast-fail)
	// ---------------------------------------------------------------
	// For every declared key (union of `properties`, `required`,
	// `dependentRequired` triggers, `dependentSchemas` triggers) emit AT MOST
	// one `if(Object.hasOwn(v,K)) { ... }` block fusing all per-key concerns.
	// Required keys use the fast-fail form `if(!hasOwn(K)) break;` upfront
	// (no `else` clause).
	const childrenCtx: tsJSParentCtx = { isCond, breakBlock: parentCtx.breakBlock || block };
	const propMap = new Map<string, number>(propertiesChecks.map((c: any) => [c[0], c[1]]));
	const requiredSet = new Set(requiredList);
	const depSchMap = new Map<string, number | boolean>(dependentSchemasChecks.map((c: any) => [c[0], c[1]]));

	// Stable key order: properties order first, then any extras introduced by
	// required / dependentRequired / dependentSchemas in their declaration order.
	const declaredKeyOrder: string[] = [];
	const seenKey = new Set<string>();
	const pushKey = (k: string) => { if (!seenKey.has(k)) { seenKey.add(k); declaredKeyOrder.push(k); } };
	for (const c of propertiesChecks) pushKey(c[0]);
	for (const r of requiredList) pushKey(r);
	for (const t of Object.keys(depReqMap)) pushKey(t);
	for (const c of dependentSchemasChecks) pushKey(c[0]);

	// Shared helpers parameterised by mode.
	const failBreak = (errMsg: string) =>
		isCond ? break_ : (errMsg ? "{" + errMsg + _break_ + "}" : _break_);
	const postSubFail = isCond ? "" : ("if(errors.length)" + break_);
	const propValCounter = { n: 0 };

	for (const k of declaredKeyOrder) {
		const _name = JSON.stringify(k);
		const propDnaIdx = propMap.get(k);
		const isReq = requiredSet.has(k);
		const deps = depReqMap[k] || [];
		const depSchSub = depSchMap.get(k);

		// 1. Required fast-fail (no else needed downstream).
		if (isReq) {
			const reqErr = isCond ? "" : _err(parentCtx, inVar, pathVar + "/object/required/" + k, 'Required property "' + k + '" is missing');
			innerSteps.push([STEP.BODY,
				"if(!Object.hasOwn(" + inVar + "," + _name + "))" + failBreak(reqErr)
			]);
		}

		// 2. Open the per-key block. When required, we already know hasOwn is
		// true → emit a bare block so subsequent statements live in their own
		// scope (cheap, lets us reuse the same flat structure as optional).
		// When optional, gate on hasOwn (no else).
		innerSteps.push([STEP.BODY,
			isReq ? "{" : "if(Object.hasOwn(" + inVar + "," + _name + ")){"
		]);

		// 3. `dependentRequired[k]` triggered: required-list checks.
		for (const r of deps) {
			const dReqErr = isCond ? "" : _err(parentCtx, inVar, pathVar + "/object/dependentRequired/" + k, 'Property "' + r + '" is required when "' + k + '" is present');
			innerSteps.push([STEP.BODY,
				"if(!Object.hasOwn(" + inVar + "," + JSON.stringify(r) + "))" + failBreak(dReqErr)
			]);
		}

		// 4. `dependentSchemas[k]`: false → fail; number → apply sub-DNA to v.
		if (depSchSub === false) {
			const dSchErr = isCond ? "" : _err(parentCtx, inVar, pathVar + "/dependentSchemas/" + k, 'Property "' + k + '" must not be present');
			innerSteps.push([STEP.BODY, failBreak(dSchErr)]);
		} else if (typeof depSchSub === "number") {
			const depChildrenCtx: tsJSParentCtx = {
				...childrenCtx,
				unEvalArr: parentCtx.unEvalArr,
				unEvalObj: parentCtx.unEvalObj,
			};
			const outDest = isCond ? "" : outVar;
			innerSteps.push([depSchSub, inVar, outDest, pathVar + "/dependentSchemas/" + k, depChildrenCtx]);
			if (postSubFail) innerSteps.push([STEP.BODY, postSubFail]);
		}

		// 5. `properties[k]` validation on v[k]. Fresh context per sibling
		// avoids `typeChecked = "number"` pollution between siblings that
		// share a cached sub-DNA.
		if (propDnaIdx !== undefined) {
			const propVal = "ob" + idx + "pp" + propValCounter.n++;
			const objKey = inVar + "[" + _name + "]";
			const propChildrenCtx: tsJSParentCtx = { ...childrenCtx };
			const outDest = isCond ? "" : outVar + "[" + _name + "]";
			innerSteps.push(
				[STEP.BODY, "let " + propVal + "=" + objKey + ";"],
				[propDnaIdx, propVal, outDest, pathVar + "/properties/" + k, propChildrenCtx],
			);
			if (postSubFail) innerSteps.push([STEP.BODY, postSubFail]);
		}

		// 6. Mark the key as evaluated for parent `unevaluatedProperties` and
		// as "passed" for `additionalProperties`. Only marks if the key is
		// actually declared via `properties` (other keywords don't "evaluate"
		// the key per JSON-Schema semantics).
		if (propDnaIdx !== undefined) {
			const evalMark = evalParent.length ? evalParent + ".add(" + _name + ");" : "";
			const passMark = passedIdx ? passedIdx + ".add(" + _name + ");" : "";
			if (evalMark || passMark) innerSteps.push([STEP.BODY, evalMark + passMark]);
		}

		// Close the block.
		innerSteps.push([STEP.BODY, "}"]);
	}

	if (isCond) {
		if (hasDynamicProps && keyLoopNeededIsCond) {
			innerSteps.push([STEP.BODY, "for(let i=0;i<" + oLen + ";i++){const key=" + oVarIdx + "," + loopVar + "=" + inVar + "[key];"]);

			if (propertyNamesCheck !== undefined) {
				if (typeof propertyNamesCheck === "boolean") {
					if (propertyNamesCheck === false) {
						innerSteps.push([STEP.BODY, break_]);
					} else {
						if (evalParent.length || passedIdx) innerSteps.push([STEP.BODY, evalParentKey_ + passedIdxAddKey_]);
					}
				} else {
					innerSteps.push(
						[propertyNamesCheck, "key", "", pathVar + "/propertyNames", childrenCtx],
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
						[el[2], loopVar, "", pathVar + "/patternProperties/" + el[1], childrenCtx],
						[STEP.BODY, (evalParent.length ? evalParent + ".add(key);" : "") + passedIdxAddKey_ + "}"]
					);
				}
			}
			if (patternPropertiesBooleanChecks !== undefined) {
				if (patternPropertiesBooleanChecks === false) {
					innerSteps.push([STEP.BODY, _err(parentCtx, "key", pathVar + "/propertyNames", "Property names not allowed") + _break_]);
				}
				innerSteps.push([STEP.BODY, evalParentKey_ + passedIdxAddKey_]);
			}

			if (additionalPropertiesCheck !== undefined) {
				if (typeof additionalPropertiesCheck === "boolean") {
					if (additionalPropertiesCheck === false)
						innerSteps.push([STEP.BODY, "}if(" + passedIdx + ".size<" + oLen + ")" + break_ + (evalParentKey_ ? "else " + evalParentKey_ : "")]);
					// additionalProperties: true → every non-properties key is
					// "evaluated" by JSON Schema semantics → mark in parent eval set.
					else innerSteps.push([STEP.BODY,
						(evalParent.length ? "if(!" + passedIdx + ".has(key))" + evalParent + ".add(key);" : "")
						+ "}"
					]);
				} else {
					// schema for additionalProperties → on sub-DNA success, mark key as evaluated.
					innerSteps.push(
						[STEP.BODY, "if(!" + passedIdx + ".has(key)){"],
						[additionalPropertiesCheck, loopVar, "", pathVar + "/additionalProperties/", childrenCtx],
						[STEP.BODY, (evalParent.length ? evalParent + ".add(key);" : "") + "}}"]
					);
				}
			} else {
				innerSteps.push([STEP.BODY, "}"]);
			}
		} else if (hasDynamicProps && additionalPropertiesCheck === false) {
			innerSteps.push([STEP.BODY, "if(" + passedIdx + ".size<" + oLen + ")" + break_]);
		}

	} else {
		// parser mode — per-key blocks were emitted above (shared with isCond).
		if (hasDynamicProps && keyLoopNeededParser) {
			innerSteps.push([STEP.BODY, "for(let i=0;i<" + oLen + ";i++){const key=" + oVarIdx + "," + loopVar + "=" + inVar + "[key];"]);
			if (propertyNamesCheck !== undefined) {
				if (typeof propertyNamesCheck === "boolean") {
					if (propertyNamesCheck === false) {
						innerSteps.push([STEP.BODY, _err(parentCtx, "key", pathVar + "/propertyNames", "Property names not allowed") + _break_]);
					} else {
						innerSteps.push([STEP.BODY, outVar + "[key]=" + loopVar + ";" + evalParentKey_ + passedIdxAddKey_]);
					}
				} else {
					innerSteps.push(
						[propertyNamesCheck, "key", outVar + "[key]", pathVar + "/propertyNames"],
						[STEP.BODY, "if(errors.length){"
							+ _err(parentCtx, oVarIdx, pathVar + "/propertyNames", "Property name does not match schema")
							+ _break_ + "}"
							+ outVar + "[key]=" + loopVar + ";"
							+ evalParentKey_ + passedIdxAddKey_
						]
					);
				}
			}
			if (patternPropChecks.length) for (let i = 0; i < patternPropChecks.length; i++) {
				const el = patternPropChecks[i];
				innerSteps.push(
					[STEP.BODY, "if(" + el[0] + ".test(key)){"],
					[el[2], loopVar, outVar + "[key]", pathVar + "/patternProperties/" + el[1], { isCond }],
					[STEP.BODY, evalParentKey_ + passedIdxAddKey_ + "}"]
				);
			}
			if (patternPropertiesBooleanChecks !== undefined) {
				if (patternPropertiesBooleanChecks === false) {
					innerSteps.push([STEP.BODY, _err(parentCtx, "key", pathVar + "/propertyNames", "Property names not allowed") + _break_]);
				}
				innerSteps.push([STEP.BODY, outVar + "[key]=" + loopVar + ";" + evalParentKey_ + passedIdxAddKey_]);
			}
			if (additionalPropertiesCheck !== undefined) {
				if (typeof additionalPropertiesCheck === "boolean") {
					if (additionalPropertiesCheck === true) {
						innerSteps.push([STEP.BODY, "if(!" + passedIdx + ".has(key)){" + outVar + "[key]=" + loopVar + ";" + evalParentKey_ + "}"]);
					} else {
						innerSteps.push([STEP.BODY, "if(" + passedIdx + ".size<" + oLen + "){"
							+ _err(parentCtx, loopVar, pathVar + "/additionalProperties", "Additional properties not allowed")
							+ _innerIfErrFail_ + evalParentKey_ + "}"]);
					}
				} else {
					// schema for additionalProperties (parser) → on sub-DNA success,
					// mark key as evaluated in the parent eval set.
					innerSteps.push(
						[STEP.BODY, "if(!" + passedIdx + ".has(key)){"],
						[additionalPropertiesCheck, loopVar, outVar.length ? outVar + "[key]" : "", pathVar + "/additionalProperties/"],
						[STEP.BODY, innerIfErrFail_ + (evalParent.length ? evalParent + ".add(key);" : "") + "}"]
					);
				}
			}
			innerSteps.push([STEP.BODY, "}"]);
		} else if (hasDynamicProps && additionalPropertiesCheck === false) {
			innerSteps.push([STEP.BODY, "if(" + passedIdx + ".size<" + oLen + "){"
				+ _err(parentCtx, inVar, pathVar + "/additionalProperties", "Additional properties not allowed")
				+ _break_ + "}"]);
		}
	}

	// Parser-mode init: always allocate an empty container.
	// The schema (via DNA opcodes) is the SOLE source of what ends up in `outVar`.
	// Defaults like `additionalProperties: true` (JSON Schema) or strict-by-default
	// (Zod) are resolved upstream by `jschemaToDna` / `zodToDna`, never assumed here.
	const parserOutInit = outVar + "={};";

	return _assignOrCondEnv(parentCtx, inVar, outVar, {
		frame, declared, typeChecked: "object",
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


export const unevaluatedItems = (dnaOpt: [number, number[], tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepOp[] =>
	_unEvalEnv(parentCtx, {
		kind: "items",
		idx: labelId(),
		seq: dnaOpt[1],
		unEvalSchema: dnaOpt[0],
		inVar: _inVarName,
		outVar: _outVarName,
		pathVar,
	});

// const unevaluatedItems_old = (dnaOpt: [number, number[], tsMeta], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepOp[] => {
// 	const isCond = parentCtx.isCond;
// 	const unEvalItemSchema = dnaOpt[0];
// 	const seq = dnaOpt[1];
// 	const steps: tsJSStepOp[] = [];
// 	const idx = labelId();
// 	const evalVar = "evalI" + idx;

// 	const uEvalBlock = "evalIB" + idx;
// 	const evalSet = "evalISet" + idx;
// 	const innerFail_ = "break " + uEvalBlock + ";"
// 	const strReturn_ = parentCtx.breakBlock ? "break " + parentCtx.breakBlock + ";" : "return false;";

// 	const ifLocalErr = isCond ? "" : "if(errors.length)" + innerFail_;
// 	const uEvalSet = "evalISet" + idx;

// 	const childrenCtx = { ...parentCtx, unEvalArr: uEvalSet, breakBlock: uEvalBlock, isCond };
// 	const checkTypePoz = "Array.isArray(" + _inVarName + ")";
// 	const checkTypeNeg = "!" + checkTypePoz;


// 	steps.push(
// 		[STEP.BODY, uEvalBlock + ":{"],
// 		[STEP.BODY, "const " + evalSet + "=new Set();"]
// 	);

// 	if (isCond) {

// 		const _outTrue = _outVarName ? _outVarName + "=true;" : "";

// 		for (let i = 0; i < seq.length; i++) {
// 			const it = seq[i];
// 			// if (i > 0) steps.push([STEP.BODY, ifLocalErr])
// 			steps.push([it, _inVarName, "", pathVar, childrenCtx]);
// 		}

// 		if (typeof unEvalItemSchema === "boolean") {

// 			if (!unEvalItemSchema) { // false : reject everything
// 				steps.push([STEP.BODY, _assignOrCond({ ...parentCtx, unEvalArr: "" },
// 					_inVarName, _outVarName, "",
// 					parentCtx.typeChecked === "array" ? "" : checkTypeNeg, "", _inVarName + ".length<" + evalSet + ".size", false) + "}"]
// 				);
// 				return steps;
// 			}
// 			// true : accept everything
// 			let unEvalArr = "";
// 			if (parentCtx.unEvalArr) unEvalArr = "let kl=" + _inVarName + ".length;"
// 				+ "for(;kl--;){"
// 				+ "if(!" + parentCtx.unEvalArr + ".has(kl)){" + parentCtx.unEvalArr + ".add(kl);}";
// 			steps.push([STEP.BODY, _assignOrCond({ ...parentCtx, unEvalArr }, _inVarName, _outVarName, "", parentCtx.typeChecked === "array" ? "" : checkTypeNeg, "", "", false) + "}"]);
// 			return steps;
// 		}

// 		/* 
// 		if parentCtx.typechecked === array => counter or not counter
// 		if type checking is needed, only the case declared = true is needed
// 		in this case, there will be a body to check the size of evalSet, and again we check whether we need a counter (outer counter)
// 		 */

// 		// Use counter pattern like not for simple schemas
// 		let unEvalArr = "";
// 		if (parentCtx.unEvalArr) unEvalArr = "let kl=" + _inVarName + ".length;"
// 			+ "for(;kl--;){"
// 			+ "if(!" + parentCtx.unEvalArr + ".has(kl)){" + parentCtx.unEvalArr + ".add(kl);}";
// 		steps.push(
// 			[STEP.BODY,
// 			(parentCtx.typeChecked === "array" ? "" : "if(" + checkTypeNeg + ")" + innerFail_)
// 			+ "let kl=" + _inVarName + ".length;"
// 			+ "for(;kl--;){"
// 			+ "const val=" + _inVarName + "[kl];"
// 			+ "if(!" + evalSet + ".has(kl)){"
// 			],
// 			[unEvalItemSchema, "val", "", pathVar + "/unevaluatedItems", { ...childrenCtx, breakBlock: uEvalBlock, unEvalArr: evalSet }],
// 			[STEP.BODY, ifLocalErr + "}}" + _outTrue + "}"] // closing for and evalBlock
// 		);

// 	} else {
// 		for (let i = 0; i < seq.length; i++) {
// 			const it = seq[i];
// 			if (i > 0) steps.push([STEP.BODY, ifLocalErr])
// 			steps.push(
// 				[it, i === 0 ? _inVarName : evalVar, i + 1 === seq.length ? _outVarName : evalVar, pathVar, childrenCtx],
// 			);
// 		}

// 		if (typeof unEvalItemSchema === "boolean") {
// 			if (!unEvalItemSchema) { // false : reject everything
// 				steps.push([STEP.BODY,
// 				(parentCtx.typeChecked === "array" ? "" : "if(" + checkTypeNeg + ")" + innerFail_)
// 				+ "if(" + _inVarName + ".length>" + evalSet + ".size){"
// 				+ _err(parentCtx, _inVarName, pathVar + "/unevaluatedItems", "Unevaluated Items are not allowed") + ";"
// 				+ innerFail_
// 				+ "}" //closure of if
// 				+ "}" //closure of evalBlock
// 				]);
// 				return steps;
// 			}
// 			steps.push(
// 				[STEP.BODY,
// 				(parentCtx.typeChecked === "array" ? "" : "if(" + checkTypeNeg + ")" + innerFail_)
// 				+ "let kl=" + _inVarName + ".length;"
// 				+ "for(;kl--;){"
// 				+ "if(!" + evalSet + ".has(kl))" + _outVarName + "[kl]=" + _inVarName + "[kl];"
// 				+ "}"] // closing while
// 			);
// 			steps.push([STEP.BODY, "}"]); // closing evalBlock
// 			return steps;
// 		}

// 		steps.push(
// 			[STEP.BODY,
// 			(parentCtx.typeChecked === "array" ? "" : "if(" + checkTypeNeg + ")" + innerFail_)
// 			+ "let kl=" + _inVarName + ".length;"
// 			+ "for(;kl--;){"
// 			+ "const val=" + _inVarName + "[kl];"
// 			+ "if(!" + evalSet + ".has(kl)){"],
// 			[unEvalItemSchema, "val", _outVarName + "[kl]", pathVar + "/unevaluatedItems", { ...childrenCtx, isCond: false, breakBlock: uEvalBlock, unEvalArr: evalSet + ".add(kl);" }],
// 			[STEP.BODY, ifLocalErr + "}}}"] // closing while and breakBlock/seqBlock
// 		)
// 	}
// 	return steps;
// }

// const array_old = (dnaOpt: tsArrayDNA, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx, declared = true): tsJSFn => {
// 	const isCond = parentCtx.isCond;
// 	const idx = labelId();
// 	const aLen = "aLen" + idx;
// 	const loopVar = "val" + idx;

// 	const opt = dnaOpt[0];
// 	const steps: tsJSStepOp[] = [];
// 	const containsSteps: tsJSStepOp[] = [];

// 	// array contraints checks
// 	let arrayCheck = [];
// 	// uniqueItems lives in two flavors: a standalone reverse sweep, and a per-item
// 	// forward check that can be folded into the items loop when eligible.
// 	let uniqueItemsState: {
// 		decl: string;       // "let unik0=true;"
// 		unikVar: string;    // "unik0"
// 		standalone: string; // full reverse sweep body (no final break)
// 		perItem: string;    // per-iteration check assuming `val` and `i` in scope
// 		err: string;        // _err(...) string
// 	} | undefined;

// 	// array items
// 	let prefixItemsIndices = []; // DNA indices for prefixItems
// 	let prefixItemsLength = 0;
// 	let itemsIndex: number | boolean = 0; // DNA index (number) or boolean schema (true/false) for items

// 	// dynamic items & loop for dynamics items 
// 	let needLength = false;
// 	let needLoop = false;
// 	let containsCount = ""; // empty unless schema-dispatch contains is used (countErr target)
// 	const containsPreloop: [string, string][] = []; // [test, err] checks emitted BEFORE the loop
// 	const containsCheck: [string, string][] = [];   // [test, err] checks emitted AFTER the loop

// 	for (let i = 0; i < opt.length; i++) {
// 		const it = opt[i];
// 		const data = it[1];
// 		switch (it[0]) {
// 			case "uniqueItems": {
// 				needLength = true;
// 				const unikVar = "unik" + idx;
// 				const auErr = _err(parentCtx, _inVarName, pathVar + "/array/uniqueItems", "Array items must be unique");
// 				const decl = "let " + unikVar + "=true;";
// 				// AJV-style double loop without Set allocation. Outer loop bails out via `&&unikVar`.
// 				// Two flavors:
// 				//  - standalone (reverse sweep, can fire even without an items loop)
// 				//  - perItem (forward j<i check, designed to be folded into the items loop)
// 				let standalone = "";
// 				let perItem = "";
// 				// data: 0 = strict equality, 1 = requires deepEqual
// 				if (data === 0) {
// 					standalone = "if(" + aLen + ">1){for(let i=" + aLen + "-1;i>=0&&" + unikVar + ";i--){for(let j=i-1;j>=0;j--){if(" + _inVarName + "[i]===" + _inVarName + "[j]){" + unikVar + "=false;break;}}}}";
// 					perItem = "if(" + unikVar + "){for(let j=0;j<i;j++){if(" + loopVar + "===" + _inVarName + "[j]){" + unikVar + "=false;break;}}}";
// 				} else if (data === 1) {
// 					standalone = "if(" + aLen + ">1){for(let i=" + aLen + "-1;i>=0&&" + unikVar + ";i--){for(let j=i-1;j>=0;j--){if(deepEqual(" + _inVarName + "[i]," + _inVarName + "[j])){" + unikVar + "=false;break;}}}}";
// 					perItem = "if(" + unikVar + "){for(let j=0;j<i;j++){if(deepEqual(" + loopVar + "," + _inVarName + "[j])){" + unikVar + "=false;break;}}}";
// 				}
// 				uniqueItemsState = { decl, unikVar, standalone, perItem, err: auErr };
// 				break;
// 			}
// 			case "minItems":
// 				if (data > -1) {
// 					needLength = true;
// 					arrayCheck.push([
// 						aLen + "<" + String(data),
// 						_err(parentCtx, _inVarName, pathVar + "/array/minItems", "Array requires at least " + String(data) + " items")

// 					]);
// 				}
// 				break;
// 			case "maxItems":
// 				if (data > -1) {
// 					needLength = true;
// 					arrayCheck.push([
// 						aLen + ">" + String(data),
// 						_err(parentCtx, _inVarName, pathVar + "/array/maxItems", "Array requires at most " + String(data) + " items")
// 					]);
// 				}
// 				break;
// 			case "prefixItems": {
// 				// needLength = true;
// 				// needLoop = true;
// 				prefixItemsIndices = data;
// 				prefixItemsLength = data.length
// 				break;
// 			}
// 			case "items": {
// 				needLength = true;
// 				needLoop = true;
// 				itemsIndex = data;

// 				break;
// 			}
// 			case "contains": {
// 				needLength = true;
// 				const containsData = data[0]; // number (DNA index) | boolean
// 				const minContains = data[1];
// 				const maxContains = data[2];
// 				if (containsData === true) {
// 					// Every item matches → match count = aLen, no loop/counter needed
// 					if (minContains > -1) containsCheck.push([
// 						aLen + "<" + String(minContains),
// 						_err(parentCtx, _inVarName, pathVar + "/array/contains", "Array must contain at least " + String(minContains) + " valid item(s)")
// 					]);
// 					if (maxContains > -1) containsCheck.push([
// 						aLen + ">" + String(maxContains),
// 						_err(parentCtx, _inVarName, pathVar + "/array/contains", "Array must contain at most " + String(maxContains) + " valid item(s)")
// 					]);
// 				} else if (containsData === false) {
// 					// No item matches → single length-based pre-check, no loop/counter
// 					containsPreloop.push([
// 						aLen + "===0",
// 						_err(parentCtx, _inVarName, pathVar + "/array/contains", "Array must not be empty")
// 					]);
// 				} else {
// 					// Schema dispatch: needs loop + counter. Sub-handler runs in cond-mode
// 					// Use temporary variable to avoid labeled blocks in expressions
// 					needLoop = true;
// 					containsCount = "containsCnt" + idx;
// 					// const tmpContainsVar = "tmpContains" + idx;
// 					containsSteps.push(
// 						// [STEP.BODY, "let " + tmpContainsVar + "=false;"],
// 						[containsData, loopVar, "", pathVar + "/array/contains", { isCond: true, counter: "++" + containsCount + ";" }],
// 						// [STEP.BODY, "if(!" + tmpContainsVar + ")++" + containsCount + ";"]
// 					)
// 					if (minContains > -1) containsCheck.push([
// 						containsCount + "<" + String(minContains),
// 						_err(parentCtx, _inVarName, pathVar + "/array/minContains", "Array must contain at least " + String(minContains) + " valid item(s)")
// 					]);
// 					if (maxContains > -1) containsCheck.push([
// 						containsCount + ">" + String(maxContains),
// 						_err(parentCtx, _inVarName, pathVar + "/array/maxContains", "Array must contain at most " + String(maxContains) + " valid item(s)")
// 					]);
// 				}
// 				break;
// 			}
// 		}
// 	}

// 	// uniqueItems can be folded INTO the items loop when there is one to fold into,
// 	// no prefixItems (would skip uniqueness pairs within the prefix), and items isn't
// 	// `false` (which short-circuits the loop with an error per iteration).
// 	const fuseUnique = !!uniqueItemsState && needLoop && !prefixItemsLength && itemsIndex !== false;

// 	// Type validation
// 	const typeValidation = [
// 		"!Array.isArray(" + _inVarName + ")",
// 		declared ? _err(parentCtx, _inVarName, pathVar + "/array", "Array is required") : _outVarName + "=" + _inVarName
// 	];

// 	const counter_ = parentCtx.counter ?? "";

// 	const evalParent = parentCtx.unEvalArr;

// 	const needsOwnBlock = !parentCtx.breakBlock && !(parentCtx.ownScope === false && !parentCtx.counter);
// 	const _block = needsOwnBlock ? "arB" + idx : "";
// 	const innerBreak_ = "break " + _block + ";"
// 	const outerFail_ = parentCtx.breakBlock ? "break " + parentCtx.breakBlock + ";" : "return false;";
// 	const innerFail_ = needsOwnBlock ? innerBreak_ : outerFail_;
// 	const _innerFail_ = ";" + innerFail_;
// 	const innerIfErrFail_ = "if(errors.length)" + innerFail_;


// 	// CODE GENERATION


// 	if (_block.length) steps.push([STEP.BODY, _block + ":{"]);
// 	if (isCond) {

// 		const childCtx: tsJSParentCtx = {
// 			// ...parentCtx,
// 			isCond,
// 			breakBlock: parentCtx.breakBlock || _block,
// 			// ownScope: false,
// 			unEvalArr: evalParent
// 		}
// 		const _outTrue = _outVarName ? _outVarName + "=true;" : "";
// 		const beenTested = parentCtx.typeChecked === "array";

// 		const strReturn_ = parentCtx.breakBlock ? "break " + parentCtx.breakBlock + ";" : "return false;";

// 		let validation, validationEnd, failReturn_ = counter_ ? counter_ : strReturn_;

// 		// type validation cases
// 		if (beenTested) {
// 			validation = "";
// 			validationEnd = "";
// 		}
// 		else if (!declared) {
// 			validation = "if(Array.isArray(" + _inVarName + ")){";
// 			validationEnd = "}"
// 		}
// 		else if (counter_) {
// 			validation = "if(!Array.isArray(" + _inVarName + ")){" + innerBreak_ + "}";
// 			validationEnd = "";
// 		}
// 		else {
// 			validation = "if(!Array.isArray(" + _inVarName + "))" + innerFail_;
// 			validationEnd = "";
// 		}



// 		steps.push([STEP.BODY,
// 		// typevalidation
// 		validation
// 		// + "let " + tmpVar + ";"
// 		+ ((needLength || needLoop || prefixItemsLength) ? "const " + aLen + "=" + _inVarName + ".length;" : "")
// 		+ (arrayCheck.length ? "if((" + arrayCheck.map(it => it[0]).join(")||(") + "))" + innerFail_ : "")
// 		+ (uniqueItemsState && !fuseUnique ? uniqueItemsState.decl + uniqueItemsState.standalone + "if(!" + uniqueItemsState.unikVar + ")" + innerFail_ : "")
// 		+ (fuseUnique ? uniqueItemsState!.decl : "")
// 		+ (containsCount ? "let " + containsCount + "=0;" : "")
// 		+ (containsPreloop.length ? "if((" + containsPreloop.map(it => it[0]).join(")||(") + "))" + innerFail_ : "")
// 		]);

// 		if (prefixItemsLength) for (let i = 0; i < prefixItemsLength; i++) {
// 			const prefixCtx = { ...childCtx, unEvalArr: childCtx.unEvalArr ? childCtx.unEvalArr + ".add(" + i + ");" : "" };
// 			steps.push(
// 				[STEP.BODY, "if(" + aLen + ">" + i + "){"],
// 				[prefixItemsIndices[i], _inVarName + "[" + i + "]", "", pathVar + "/array/prefixItems/" + i, prefixCtx],
// 				[STEP.BODY, "}"]
// 			)
// 		}

// 		if (needLoop) {
// 			// Loop for items (additional items after prefixItems)
// 			const loopCtx = { ...childCtx, unEvalArr: childCtx.unEvalArr ? childCtx.unEvalArr + ".add(i);" : "" };
// 			steps.push([STEP.BODY,
// 			"for(let i=" + prefixItemsLength + ";i<" + aLen + ";i++){const " + loopVar + "=" + _inVarName + "[i];"
// 			]);
// 			if (typeof itemsIndex === "number" && itemsIndex) {
// 				steps.push(
// 					[itemsIndex, loopVar, "", pathVar + "/array/items", loopCtx],
// 					// [STEP.BODY, ";"],
// 					// [STEP.BODY, "if(!" + tmpVar + ")" + innerFail_ + evalParentKey_],
// 				);
// 			} else if (itemsIndex === false) {
// 				// TODO: take it out of the loop
// 				// items: false → no item allowed past prefixItems
// 				// steps.push([STEP.BODY, _err(parentCtx, loopVar, pathVar + "/array/items", "Additional items not allowed") + _innerFail_ + evalParentKey_]);
// 			} else if (itemsIndex === true) {
// 				steps.push([STEP.BODY, childCtx.unEvalArr ? childCtx.unEvalArr + ".add(i);" : ""])
// 			}
// 			// itemsIndices === true or 0 → no per-item validation (accept all)
// 			if (containsSteps.length) fastMergeArrays(steps, containsSteps);
// 			if (fuseUnique) steps.push([STEP.BODY, uniqueItemsState!.perItem]);
// 			steps.push([STEP.BODY, "}"]);
// 		}

// 		if (fuseUnique) steps.push([STEP.BODY, "if(!" + uniqueItemsState!.unikVar + ")" + innerFail_]);
// 		if (containsCheck.length) steps.push([STEP.BODY, "if((" + containsCheck.map(it => it[0]).join(")||(") + "))" + innerFail_]);
// 		if (parentCtx.counter) steps.push([STEP.BODY, parentCtx.counter]);
// 		if (!evalParent && _outVarName.length) steps.push([STEP.BODY, _outVarName + "=true;"]);
// 		if (validationEnd) steps.push([STEP.BODY, validationEnd])

// 	} else {
// 		steps.push([STEP.BODY,
// 		// typevalidation
// 		"if(" + typeValidation[0] + "){" + (declared ? typeValidation[1] : _outVarName + "=" + _inVarName) + _innerFail_ + "}"
// 		+ "const " + aLen + "=" + _inVarName + ".length;"
// 		+ arrayCheck.map(it => "if(" + it[0] + "){" + it[1] + _innerFail_ + "}").join("")
// 		+ (uniqueItemsState && !fuseUnique ? uniqueItemsState.decl + uniqueItemsState.standalone + "if(!" + uniqueItemsState.unikVar + "){" + uniqueItemsState.err + _innerFail_ + "}" : "")
// 		+ (fuseUnique ? uniqueItemsState!.decl : "")
// 		+ (containsCount ? "let " + containsCount + "=0;" : "")
// 		+ containsPreloop.map(it => "if(" + it[0] + "){" + it[1] + _innerFail_ + "}").join("")
// 		+ (prefixItemsLength || needLoop ? _outVarName + "=new Array(" + aLen + ");" : "")
// 		]);

// 		// prefixItems validation in parser mode
// 		if (prefixItemsLength) for (let i = 0; i < prefixItemsLength; i++) {
// 			steps.push(
// 				[STEP.BODY, "if(" + aLen + ">" + i + "){"],
// 				[prefixItemsIndices[i], _inVarName + "[" + i + "]", _outVarName + "[" + i + "]", pathVar + "/array/prefixItems/" + i, parentCtx],
// 				[STEP.BODY, innerIfErrFail_ + (evalParent ? evalParent + ".add(" + i + ");" : "") + "}"],
// 			)
// 		}

// 		// items + contains validation in parser mode (loop for additional items)
// 		if (needLoop) {
// 			steps.push([STEP.BODY, "for(let i=" + prefixItemsLength + ";i<" + aLen + ";i++){const " + loopVar + "=" + _inVarName + "[i];"]);

// 			if (containsSteps.length) fastMergeArrays(steps, containsSteps);
// 			if (fuseUnique) steps.push([STEP.BODY, uniqueItemsState!.perItem]);

// 			if (typeof itemsIndex === "number" && itemsIndex !== 0) {
// 				steps.push(
// 					[itemsIndex, loopVar, _outVarName + "[i]", pathVar + "/array/items", parentCtx],
// 					[STEP.BODY, innerIfErrFail_ + evalParent],
// 				);
// 			} else if (itemsIndex === true) {
// 				// items: true → accept all extra items, copy as-is
// 				steps.push([STEP.BODY, _outVarName + "[i]=" + loopVar + ";" + evalParent]);
// 			} else if (itemsIndex === false) {
// 				// items: false → reject
// 				steps.push([STEP.BODY, _err(parentCtx, loopVar, pathVar + "/array/items", "Additional items not allowed") + _innerFail_ + evalParent]);
// 			} else {
// 				steps.push([STEP.BODY, _outVarName + "[i]=" + loopVar + ";"]);
// 			}
// 			steps.push([STEP.BODY, "}"]);
// 		}

// 		if (fuseUnique) steps.push([STEP.BODY, "if(!" + uniqueItemsState!.unikVar + "){" + uniqueItemsState!.err + _innerFail_ + "}"]);
// 		if (containsCheck.length) steps.push([STEP.BODY, containsCheck.map(it => "if(" + it[0] + "){" + it[1] + _innerFail_ + "}").join("")]);


// 		if (parentCtx.counter) steps.push([STEP.BODY, parentCtx.counter]);
// 		if (itemsIndex === 0 && !needLoop) {
// 			steps.push([STEP.BODY, _outVarName + "=" + _inVarName + ";"])
// 		}
// 	}
// 	if (_block.length) steps.push([STEP.BODY, "}"]) // closure of object block
// 	parentCtx.typeChecked = "array";
// 	return steps;
// };

/**
 * Migrated `array` validator using `_assignOrCondEnv`.
 * Mirrors `array_old` behavior; envelope absorbs the head/tail boilerplate.
 */
const array = (dnaOpt: tsArrayDNA, inVar: string, outVar: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx, declared = true): tsJSFn => {
	const isCond = parentCtx.isCond;
	const idx = labelId();
	const aLen = "aLen" + idx;
	const loopVar = "val" + idx;

	const frame = _envFrame(parentCtx, "arB", idx);
	const { block, break_, _break_ } = frame;
	const innerIfErrFail_ = "if(errors.length)" + break_;

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
					standalone = "if(" + aLen + ">1){for(let i=" + aLen + "-1;i>=0&&" + unikVar + ";i--){for(let j=i-1;j>=0;j--){if(" + inVar + "[i]===" + inVar + "[j]){" + unikVar + "=false;break;}}}}";
					perItem = "if(" + unikVar + "){for(let j=0;j<i;j++){if(" + loopVar + "===" + inVar + "[j]){" + unikVar + "=false;break;}}}";
				} else if (data === 1) {
					standalone = "if(" + aLen + ">1){for(let i=" + aLen + "-1;i>=0&&" + unikVar + ";i--){for(let j=i-1;j>=0;j--){if(deepEqual(" + inVar + "[i]," + inVar + "[j])){" + unikVar + "=false;break;}}}}";
					perItem = "if(" + unikVar + "){for(let j=0;j<i;j++){if(deepEqual(" + loopVar + "," + inVar + "[j])){" + unikVar + "=false;break;}}}";
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
					// set name, no trailing `;`), mark the current index `i` as
					// evaluated whenever the contains sub-schema matches.
					const u = parentCtx.unEvalArr;
					const evalAdd_ = (u && !u.endsWith(";")) ? u + ".add(i);" : "";
					containsSteps.push(
						[containsData, loopVar, "", pathVar + "/array/contains", { isCond: true, counter: "++" + containsCount + ";" + evalAdd_ }]
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
	const evalParent = parentCtx.unEvalArr;

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

	// Build innerSteps
	const innerSteps: tsJSStepOp[] = [];

	if (isCond) {
		// Convention: `array` itself owns the `<set>.add(<idx>);` emissions.
		// We do NOT propagate `unEvalArr` to sub-DNA — they have no lexical
		// index/key context and would otherwise concatenate the bare set name
		// into their own bodies (causing `evalISet0evalISet0.add(...)` style
		// breakage). The eval-set additions are emitted EXPLICITLY by this
		// loop after each successful sub-DNA dispatch.
		const childCtx: tsJSParentCtx = {
			isCond,
			breakBlock: parentCtx.breakBlock || block,
		};
		const evalAddPrefix_ = (i: number) => evalParent ? evalParent + ".add(" + i + ");" : "";
		const evalAddItem_   = evalParent ? evalParent + ".add(i);" : "";

		if (prefixItemsLength) for (let i = 0; i < prefixItemsLength; i++) {
			innerSteps.push(
				[STEP.BODY, "if(" + aLen + ">" + i + "){"],
				[prefixItemsIndices[i], inVar + "[" + i + "]", "", pathVar + "/array/prefixItems/" + i, childCtx],
				[STEP.BODY, evalAddPrefix_(i) + "}"]
			);
		}

		if (needLoop) {
			innerSteps.push([STEP.BODY,
				"for(let i=" + prefixItemsLength + ";i<" + aLen + ";i++){const " + loopVar + "=" + inVar + "[i];"
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
				[prefixItemsIndices[i], inVar + "[" + i + "]", outVar + "[" + i + "]", pathVar + "/array/prefixItems/" + i, parentCtx],
				[STEP.BODY, innerIfErrFail_ + (evalParent ? evalParent + ".add(" + i + ");" : "") + "}"]
			);
		}

		if (needLoop) {
			innerSteps.push([STEP.BODY, "for(let i=" + prefixItemsLength + ";i<" + aLen + ";i++){const " + loopVar + "=" + inVar + "[i];"]);
			if (containsSteps.length) fastMergeArrays(innerSteps, containsSteps);
			if (fuseUnique) innerSteps.push([STEP.BODY, uniqueItemsState!.perItem]);
			if (typeof itemsIndex === "number" && itemsIndex !== 0) {
				innerSteps.push(
					[itemsIndex, loopVar, outVar + "[i]", pathVar + "/array/items", parentCtx],
					[STEP.BODY, innerIfErrFail_ + evalParent]
				);
			} else if (itemsIndex === true) {
				innerSteps.push([STEP.BODY, outVar + "[i]=" + loopVar + ";" + evalParent]);
			} else if (itemsIndex === false) {
				innerSteps.push([STEP.BODY, _err(parentCtx, loopVar, pathVar + "/array/items", "Additional items not allowed") + _break_ + evalParent]);
			} else {
				innerSteps.push([STEP.BODY, outVar + "[i]=" + loopVar + ";"]);
			}
			innerSteps.push([STEP.BODY, "}"]);
		}

	}

	// Parser-mode init: always allocate an empty container — same principle as
	// for `object`: the schema (DNA opcodes) is the sole source of what ends up
	// in `outVar`. Defaults are resolved upstream.
	// When prefixItems/items declare positions, pre-size the array; otherwise `[]`.
	const parserOutInit = (prefixItemsLength || needLoop)
		? outVar + "=new Array(" + aLen + ");"
		: outVar + "=[];";

	return _assignOrCondEnv(parentCtx, inVar, outVar, {
		frame, declared, typeChecked: "array",
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
	const _block = "ifB" + idx;
	const tmpVar = "ifV" + idx;
	const innerFail_ = "break " + (parentCtx?.breakBlock ? parentCtx.breakBlock : _block) + ";";

	if (thenPart === -1 && elsePart === -1) {
		// No then/else → schema is satisfied either way, BUT the `if` body must
		// still be dispatched so its successful annotations (eval-set marks)
		// propagate to outer `unevaluated*` siblings, AND its side effects
		// (errors[] in parser mode) are produced. We run the `if` body in
		// a sub-block where failure is silent (no `break` out of caller's flow).
		const ifSubBlock = "ifSubB" + idx;
		const ifteEval = { unEvalArr: parentCtx.unEvalArr, unEvalObj: parentCtx.unEvalObj };
		const steps: tsJSStepOp[] = [];
		if (isCond) {
			const success_ = parentCtx.counter
				? parentCtx.counter
				: (_outVarName ? _outVarName + "=true;" : "");
			steps.push(
				[STEP.BODY, ifSubBlock + ":{"],
				[ifPart, _inVarName, "", pathVar + "/if", { isCond: true, breakBlock: ifSubBlock, ...ifteEval }],
				[STEP.BODY, "}" + success_]
			);
		} else {
			// Parser mode: dispatch the `if` body for its side effects (errors[]),
			// but DO NOT write to `_outVarName` — a bare `if` is not a transformer;
			// the caller is responsible for any output value.
			steps.push(
				[STEP.BODY, ifSubBlock + ":{"],
				[ifPart, _inVarName, "", pathVar + "/if", { ...parentCtx, breakBlock: ifSubBlock }],
				[STEP.BODY, "}"]
			);
		}
		return steps;
	}

	const steps: tsJSStepOp[] = [];

	if (isCond) {
		// "Success" statement emitted in either branch when the corresponding
		// sub-schema is absent (treated as `true` — i.e. success).
		// Precedence: parent's `counter` (we're a child of anyOf/allOf/...)
		// > `_outVarName=true;` (we're producing the root result)
		// > nothing (caller doesn't care; downstream logic handles it).
		const success_ = parentCtx.counter
			? parentCtx.counter
			: (_outVarName ? _outVarName + "=true;" : "");

		// In-place applicator semantics: `if`/`then`/`else` are in-place, so
		// their annotations (eval-set contributions) propagate UP to the
		// parent's `unEvalArr`/`unEvalObj`. We pass these through to every
		// branch ctx. Failures short-circuit via `breakBlock`, so leaked
		// eval marks before a failure can't reach the parent's success path.
		const ifteEval = { unEvalArr: parentCtx.unEvalArr, unEvalObj: parentCtx.unEvalObj };

		// `if`-part is a CONDITION TEST, not a hard validation: a failure must
		// NOT skip the `else` branch. We isolate it in its own sub-block so a
		// `break` only exits the if-part scope, leaving `ifV<idx>=false` and
		// the surrounding `if(ifV)…else…` chooses the else branch.
		const ifSubBlock = "ifSubB" + idx;
		steps.push(
			[STEP.BODY, _block + ":{"],
			[STEP.BODY, "let " + tmpVar + "=false;" + ifSubBlock + ":{"],
			[ifPart, _inVarName, "", pathVar + "/if", { isCond: true, breakBlock: ifSubBlock, counter: tmpVar + "=true;", ...ifteEval }],
			[STEP.BODY, "}if(" + tmpVar + ")"]
		);

		// Push then schema step
		if (thenPart === -1) {
			// Then absent → success when condition holds.
			steps.push([STEP.BODY, "{" + success_ + "}"]);
		} else {
			const thenCtx: tsJSParentCtx = { isCond: true, breakBlock: _block, counter: success_, ...ifteEval };
			steps.push(
				[STEP.BODY, "{"],
				[thenPart, _inVarName, "", pathVar + "/then", thenCtx],
				[STEP.BODY, "}"],
			);
		}

		// Push else schema step
		if (elsePart === -1) {
			// Else absent → success when condition does not hold.
			steps.push([STEP.BODY, "else{" + success_ + "}"]);
		} else {
			const elseCtx: tsJSParentCtx = { isCond: true, breakBlock: _block, counter: success_, ...ifteEval };
			steps.push(
				[STEP.BODY, "else{"],
				[elsePart, _inVarName, "", pathVar + "/else", elseCtx],
				[STEP.BODY, "}"]
			);
		}

	} else {
		// Push if schema step
		steps.push(
			[STEP.BODY, _block + ":{let " + tmpVar + "=false;"],
			[ifPart, _inVarName, tmpVar, pathVar + "/if", { ...parentCtx, isCond: true }],
			[STEP.BODY, "if(" + tmpVar + ")"]
		);

		// Push then schema step
		if (thenPart === -1) {
			// If then is absent, behave as true schema (no validation effect)
			steps.push([STEP.BODY, "{}"]);
		} else {
			steps.push(
				[STEP.BODY, "{"],
				[thenPart, _inVarName, _outVarName, pathVar + "/then", parentCtx],
				[STEP.BODY, "}"]
			);
		}

		// Push else schema step
		if (elsePart === -1) {
			// If else is absent, behave as true schema (no validation effect)
			steps.push([STEP.BODY, "else{}"]);
		} else {
			steps.push(
				[STEP.BODY, "else{"],
				[elsePart, _inVarName, _outVarName, pathVar + "/else", parentCtx],
				[STEP.BODY, "}"]
			);
		}
	}
	steps.push([STEP.BODY, "}"]); //end of if then else bloc
	return steps;
};

export const not = (dnaOpt: [any], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn => {
	const isCond = parentCtx.isCond;
	const innerIndex = dnaOpt[0][0];

	const idx = labelId();
	const _block = "notB" + idx;
	const _result = "notRes" + idx;
	// const _innerFail_ = ";break " + (parentCtx.breakBlock ? parentCtx.breakBlock : _block) + ";";
	const _innerFail_ = ";break " + _block + ";";
	const childCtx: tsJSParentCtx = { isCond: true, breakBlock: _block };

	const steps: tsJSStepOp[] = [];

	// `not` doesn't propagate annotations: by definition, the inner schema either
	// succeeds (we fail) or fails (we succeed) — in either case the inner's
	// eval-set marks are NOT in-scope contributions of the current schema.
	// Since `_assignOrCond` no longer emits `unEvals_`, we just call it with
	// `parentCtx` directly — no need to strip anymore.

	if (isCond) {
		steps.push(
			[STEP.BODY, "let " + _result + ";"],
			[STEP.BODY, _block + ":{"],
			[innerIndex, _inVarName, _result, pathVar + "/not", childCtx],
			[STEP.BODY, "}"], // closing block
			[STEP.BODY, _assignOrCond(parentCtx, _inVarName, _outVarName, "", "!" + _result, "", "", true)]
		);
	} else {
		// Check if validation failed
		const ErrMsg = _err(parentCtx, _inVarName, pathVar + "/not", "Data should NOT be valid to schema:" + dnaOpt[0][1]) + ERR_UNDEF;
		steps.push(
			[STEP.BODY, "let " + _result + ";"],
			[STEP.BODY, _block + ":{"],
			[innerIndex, _inVarName, _result, pathVar + "/not", childCtx],
			[STEP.BODY, "}"], // closing block
			[STEP.BODY, _assignOrCond(parentCtx, _inVarName, _outVarName, ErrMsg, "!" + _result, "", "", true)],
		);
	}
	return steps;
};

export const anyOf = (dnaOpt: tsOfList, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn => {
	const isCond = parentCtx.isCond;
	const content = dnaOpt[0][0];
	const indices: number[] = dnaOpt[0].slice(1);

	const idx = labelId();
	const _block = "anyB" + idx;
	const innerFail_ = "break " + _block + ";";
	const outerFail_ = "break " + (parentCtx.breakBlock ? parentCtx.breakBlock : _block) + ";";

	const count = "anyCnt" + idx;
	const ctx: tsJSParentCtx = { breakBlock: _block };
	const childrenCtx: tsJSParentCtx = { breakBlock: undefined, isCond: true, counter: "++" + count + ";" };

	const steps: tsJSStepOp[] = [];

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
			commit: scratch + ".forEach(v=>" + accum + ".add(v));",
			propagate: accum + ".forEach(v=>" + parentCtx.unEvalArr + ".add(v));",
		});
	}
	if (parentCtx.unEvalObj) {
		const accum = "anyEvalObj" + idx, scratch = "anyEvalObjTmp" + idx;
		childrenCtx.unEvalObj = scratch;
		slots.push({
			accum, scratch,
			commit: scratch + ".forEach(v=>" + accum + ".add(v));",
			propagate: accum + ".forEach(v=>" + parentCtx.unEvalObj + ".add(v));",
		});
	}
	const hasEvals = slots.length > 0;
	const countBefore = "anyCntB" + idx;

	const decls = [
		...slots.map(s => s.accum + "=new Set()"),
		...slots.map(s => s.scratch),
		...(hasEvals ? [countBefore] : []),
		count + "=0",
	];
	steps.push([STEP.BODY, "let " + decls.join(",") + ";" + _block + ":{"]);

	if (isCond) {
		// Outer counter: when this `anyOf` is itself a child of `anyOf`/`allOf`/
		// `oneOf`, success must fire the parent's counter so the outer combinator
		// counts us as a match. Fired exactly once on success.
		const parentCounter_ = parentCtx.counter ?? "";

		for (let i = 0; i < indices.length; i++) {
			if (hasEvals) {
				// Reset scratch sets + snapshot count, dispatch, then commit on match.
				// No short-circuit — we need to keep collecting from later matches.
				steps.push([STEP.BODY,
					slots.map(s => s.scratch + "=new Set();").join("")
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
		for (let i = 0; i < indices.length; i++) {
			steps.push(
				[indices[i], _inVarName, "", pathVar + "/anyOf/" + i, childrenCtx],
				[STEP.BODY, ";if(" + count + "){" + _outVarName + "=" + _inVarName + ";" + innerFail_ + "}"]
			);
		}
		steps.push(
			[STEP.BODY, "if(" + count + "===0){"
				+ _err(ctx, _inVarName, pathVar + "/anyOf", "Data should be valid to at least one schema of:" + content) + ";"
				+ innerFail_ + "}"],
			[STEP.BODY, _outVarName + "=" + _inVarName + ";}"]
		);
	}
	return steps;
};

export const or = anyOf;

export const allOf = (dnaOpt: tsOfList, _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn => {
	const isCond = parentCtx.isCond;
	const content = dnaOpt[0][0];
	const indices: number[] = dnaOpt[0].slice(1);

	const idx = labelId();
	const _block = "alB" + idx;
	const count = "allCnt" + idx;

	// Children: counter signals each successful child; no breakBlock (failure
	// just means "don't increment", letting the final count check decide).
	const childrenCtx: tsJSParentCtx = {
		...parentCtx,
		breakBlock: undefined,
		isCond: true,
		counter: "++" + count + ";",
		unEvalArr: undefined,
		unEvalObj: undefined,
	};

	// Local eval sets + their explicit propagation statements.
	// (Replaces the legacy `_assignOrCond.unEvals_` stash pattern. Each
	// applicator now owns its eval-set propagation explicitly.)
	const evalDecls: string[] = [];
	let propagateArr_ = "", propagateObj_ = "";
	if (parentCtx.unEvalArr) {
		const localSet = "allEvalArr" + idx;
		childrenCtx.unEvalArr = localSet;
		evalDecls.push(localSet + "=new Set()");
		propagateArr_ = localSet + ".forEach(v=>" + parentCtx.unEvalArr + ".add(v));";
	}
	if (parentCtx.unEvalObj) {
		const localSet = "allEvalObj" + idx;
		childrenCtx.unEvalObj = localSet;
		evalDecls.push(localSet + "=new Set()");
		propagateObj_ = localSet + ".forEach(v=>" + parentCtx.unEvalObj + ".add(v));";
	}

	const steps: tsJSStepOp[] = [];
	steps.push([STEP.BODY,
		"let " + [...evalDecls, count + "=0"].join(",") + ";" + _block + ":{"
	]);

	for (let i = 0; i < indices.length; i++) {
		steps.push([indices[i], _inVarName, "", pathVar + "/allOf/" + i, childrenCtx]);
	}

	// Fail-fast: not enough matches → bail. Then propagate + signal success.
	const failBreak_ = parentCtx.counter
		? "break " + _block + ";"
		: (parentCtx.breakBlock ? "break " + parentCtx.breakBlock + ";" : "return false;");

	if (isCond) {
		steps.push([STEP.BODY,
			"if(" + count + "!==" + indices.length + ")" + failBreak_
			+ propagateArr_ + propagateObj_
			+ (parentCtx.counter ?? "")
			+ (_outVarName ? _outVarName + "=true;" : "")
			+ "}"
		]);
	} else {
		const errMsg = _err(parentCtx, _inVarName, pathVar + "/allOf", "Data should be valid to all schemas of:" + content);
		steps.push([STEP.BODY,
			"if(" + count + "!==" + indices.length + "){" + errMsg + ";" + failBreak_ + "}"
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
	const indices: number[] = dnaOpt[0].slice(1);

	const idx = labelId();
	const _block = "oneB" + idx;
	const count = "oneCnt" + idx;
	const innerFail_ = "break " + _block + ";";
	const outerCounter = parentCtx.counter ?? "";
	const strReturn_ = parentCtx.breakBlock ? "break " + parentCtx.breakBlock + ";" : "return false;"

	const ctx: tsJSParentCtx = { breakBlock: _block };
	const childrenCtx: tsJSParentCtx = { breakBlock: undefined, isCond: true, counter: "++" + count + ";" };

	const steps: tsJSStepOp[] = [];

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
	if (parentCtx.unEvalArr) {
		const evalSet = "oneEvalArr" + idx;
		const globalEvalSet = "oneEvalGlobalArr" + idx;
		childrenCtx.unEvalArr = evalSet;
		declareLet.push(evalSet, globalEvalSet);
		initEvals.push(evalSet + "=new Set();");
		captureEvals.push(globalEvalSet + "=new Set(" + evalSet + ");");
		propagateEvals.push(globalEvalSet + ".forEach(it=>" + parentCtx.unEvalArr + ".add(it));");
	}
	if (parentCtx.unEvalObj) {
		const evalSet = "oneEvalObj" + idx;
		const globalEvalSet = "oneEvalGlobalObj" + idx;
		childrenCtx.unEvalObj = evalSet;
		declareLet.push(evalSet, globalEvalSet);
		initEvals.push(evalSet + "=new Set();");
		captureEvals.push(globalEvalSet + "=new Set(" + evalSet + ");");
		propagateEvals.push(globalEvalSet + ".forEach(it=>" + parentCtx.unEvalObj + ".add(it));");
	}

	const letDecl = "let " + (declareLet.length ? declareLet.join(",") + "," : "") + count + "=0;";
	const captureBlock = captureEvals.length ? "if(" + count + "===1){" + captureEvals.join("") + "}" : "";

	if (isCond) {
		steps.push([STEP.BODY, letDecl + _block + ":{"]);
		if (initEvals.length) steps.push([STEP.BODY, initEvals.join("")]);
		for (let i = 0; i < indices.length; i++) {
			steps.push(
				[indices[i], _inVarName, "", pathVar + "/oneOf/" + i, childrenCtx],
				// [STEP.BODY, ";"]
			);
			if (captureBlock) steps.push([STEP.BODY, captureBlock]);
			if (0 < i) steps.push([STEP.BODY, "if(" + count + ">1)" + (parentCtx.counter ? innerFail_ : strReturn_)]);
		}
		steps.push([STEP.BODY, "if(" + count + "!==1)"
			+ (parentCtx.counter ? innerFail_ : strReturn_)
			+ outerCounter
			+ (_outVarName ? _outVarName + "=true;" : "")
			+ propagateEvals.join("")
			+ "}"
		]); //closing oneBlock

	} else {
		steps.push([STEP.BODY, letDecl
			+ "const errMsg=()=>" + _err(ctx, _inVarName, pathVar + "/oneOf", "Data should be valid to exactly one schema of:" + content) + ";"
			+ _block + ":{"]);
		if (initEvals.length) steps.push([STEP.BODY, initEvals.join("")]);
		for (let i = 0; i < indices.length; i++) {
			steps.push(
				[indices[i], _inVarName, "", pathVar + "/oneOf/" + i, childrenCtx],
				// [STEP.BODY, ";"]
			);
			if (captureBlock) steps.push([STEP.BODY, captureBlock]);
			if (0 < i) steps.push([STEP.BODY, "if(" + count + ">1){errMsg();" + innerFail_ + "}"]);
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

export {
	boolean as b,
	constType as c,
	constTypeComplex as cD,
	enumType as e,
	enumTypeDeep as eD,
	falseSchema as F,
	literal as l,
	trueSchema as T,
};
