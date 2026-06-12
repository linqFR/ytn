
export const PARSE_RETURN = "return errors.length?{success:false, errors}:{success:true, data};";
export const _PARSE_RETURN = ";" + PARSE_RETURN;
export const VALIDATE_RETURN = "return !errors.length;";
export const _VALIDATE_RETURN = ";" + VALIDATE_RETURN;
export const ERR_RETURN = "return {success:false, errors};";
export const _ERR_RETURN = ";" + ERR_RETURN;
export const ERR_UNDEF = "&&undefined";
export const ERR_UNDEF_ = ERR_UNDEF + ";";

export const MAIN_BLOCK_ID = "mb";
export const BREAK_MAIN = "break " + MAIN_BLOCK_ID + ";";
export const $BREAK_MAIN = " " + BREAK_MAIN;
export const _BREAK_MAIN = ";" + BREAK_MAIN;
export const IFERR_BREAK_ = "if(errors.length)" + BREAK_MAIN + ";";

export type namerFn = (idx: number) => string;
export const namer: namerFn = (idx: number) => "L" + idx.toString().padStart(4, "0");


export const escStr = (s: string): string => JSON.stringify(JSON.stringify(s)).slice(1, -1);

export const fastMergeArrays = <T = any>(target: T[], source: T[]): T[] => {
	const startLength = target.length;
	const addLen = source.length;
	target.length += addLen;
	for (let i = 0; i < source.length; i++) {
		target[startLength + i] = source[i];
	}
	return target
}

// Helper functions for DNA to JS compilation
// These are shared between dna-js-full.ts and dna-js-builder.ts
import type { tsJSParentCtx } from "../types/index.js";

/**
 * DNA → JS CODE CONVENTIONS
 *
 * 1. COUNTERS
 *    - `parentCtx.counter` is ALWAYS an expression WITHOUT semicolon
 *    - Declaration: `"++count"` or `"count"` (never `"++count;"`)
 *    - Emission in validator mode (isCond=true): counter + ";"
 *      Example: `parentCtx.counter ? parentCtx.counter + ";" : ""`
 *    - Emission in parser mode (isCond=false): counter (no semicolon, embedded in ternary)
 *      Example: `(parentCtx.counter ? "(++" + parentCtx.counter + ")&&" : "")`
 *
 * 2. TYPE CONDITIONS
 *    - POSITIVE form: "typeof v === 'string'", "Array.isArray(v)"
 *    - If true = success, if false = failure
 *    - Used in: type handlers, _assignOrCond (test parameter)
 *
 * 3. CHECKERS (preChecks, postChecks)
 *    - POSITIVE FAILURE form: "len < min", "!uniqueVar"
 *    - If true = FAILURE (break), if false = continue
 *    - Used in: object, array handlers
 *    - Emission: "if((check1)||(check2))" + break_
 *
 * 4. BLOCKS
 *    - Default: create own block ("clean block by default")
 *    - Skip when parent provides a `failCase` (redundant)
 */

export const _err = (ctx: tsJSParentCtx, _inVarName: string, path: string, msg: string, isLiteral = true) =>
	"errors.push({message:" + (isLiteral ? JSON.stringify(msg) : escStr(msg)) + ",path:'" + path + "',input:" + _inVarName + "})";

export const simpleNodeToJs = (
	parentCtx: tsJSParentCtx,
	_inVarName: string, _outVarName: string,
	errMsg: string,
	test: string,
	preBody: string = "", body: string | string[] = "",
	mustMatchType: boolean = true
): string => {
	const counter = parentCtx.counter ?? "";
	const _body: string = Array.isArray(body)
		? body.length > 1 ? "(" + body.join(")&&(") + ")" : body.length ? body[0] : ""
		: typeof body === "string" ? body : "";


	if (parentCtx.isCond) {

		// Project-wide convention: `parentCtx.unEvalArr` / `unEvalObj` carry a
		// SET NAME (never a statement). Eval-set propagation is the responsibility
		// of in-place applicators (`anyOf`/`allOf`/`oneOf`/`_unEvalEnv`/...) which
		// emit `<localSet>.forEach(...)` explicitly on their success path.
		// `_assignOrCond` is a scalar-level helper with no lexical key context —
		// it cannot meaningfully emit any eval marking.

		// counter may be an array because of contains
		const counter_ = counter ? (Array.isArray(counter) ? counter.join(";") + ";" : counter + ";") : "";
		const failCase = parentCtx.failCase;
		const outAssigned_ = _outVarName ? _outVarName + "=true;" : "";

		// Encoding: `encodedCase = (D<<3) | (T<<2) | (B<<1) | C` — 4 bits, 16 cases.
		// D = MustMatchType : 1 = type check failure must throw out; 0 = undeclared (vacuous success on type mismatch)
		// T = Test          : 1 = test set (must be emitted); 0 = test already known true upstream (test == "")
		// B = Body          : 1 = constraint body present (additional check after test)
		// C = Counter       : 1 = parent provided a counter — body failure means "don't increment" (no break)
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
				: preBody + "if(!(" + _body + "))" + failCase + outAssigned_;
		}
		if (!mustMatchType) { // D=0, T=1  (vacuous success on type mismatch)
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
			const bodyStr = preBody + "if(!(" + _body + "))" + failCase;
			return "if(" + test + "){" + bodyStr + "}" + outAssigned_;
		}
		if (counter_) { // D=1, T=1, C=1
			const bodyStr = _body
				? preBody + "if(" + _body + "){" + counter_ + outAssigned_ + "}"
				: counter_ + outAssigned_;
			return "if(" + test + "){" + bodyStr + "}";
		} else { // D=1, T=1, C=0
			const bodyStr = _body
				? preBody + "if(!(" + _body + "))" + failCase + outAssigned_
				: outAssigned_;
			return "if(!(" + test + "))" + failCase + bodyStr;
		}

	} else {
		const condErr = counter ? (Array.isArray(counter) ? counter.join(";") : counter) : errMsg;

		// Handle trueSchema case in parser mode: if test is empty/true and body/counter are empty, just assign
		if ((!test || test === "true") && !_body && !parentCtx.counter) {
			return _outVarName + "=" + _inVarName + ";";
		}
		// `preBody` is a STATEMENT (e.g. `strCnt = fCount(v);`) that prepares
		// state read by `_body`/`test` (e.g. surrogate-aware string length).
		// In validator mode it is woven into the emitted statements; in parser
		// mode (ternary assignment) we MUST prepend it as a leading statement,
		// otherwise reads in the ternary observe an undefined value.
		const counterExpr = counter ? (Array.isArray(counter) ? "(" + counter.map(c => "(++" + c + ")").join("&&") + ")&&" : "(++" + counter + ")&&") : "";
		const bodyExpr = _body ? "(" + _body + ")&&" : "";
		const failExpr = (mustMatchType && condErr) ? condErr : _inVarName;
		if (test)	return preBody + _outVarName + "=" + test + "?" + bodyExpr + counterExpr + _inVarName + ":" + failExpr + ";" + parentCtx.failCase;
		return preBody + _outVarName + "=" + bodyExpr + counterExpr + _inVarName + ";" + parentCtx.failCase;
	}
};

