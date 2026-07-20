import type {
	tsSTEP_ASYNC,
	tsSTEP_BODY,
	tsSTEP_CONST,
	tsSTEP_END_REF,
	tsSTEP_LET,
	tsSTEP_OUT_ARG,
	tsSTEP_OUT_CONST,
	tsSTEP_START_REF,
	tsSTEP_STR_REF
} from "../shared/const-steps.js";

/**
 * @type tsJSFuncReturn
 * @description Return type for DNA→JS code generation functions (string-based)
 */
export type tsJSFuncReturn = string;

/**
 * @type tsJSFuncReturnLong
 * @description Return type for DNA→JS code generation functions (tuple-based)
 */
export type tsJSFuncReturnLong = [string, string];

/**
 * @type tsJSParentCtx
 * @description Parent context for DNA→JS code generation
 */
export type tsJSParentCtx = {
	isCond: boolean,
	outerblock:string
	failCase:string,

	typeChecked?: string,
	
	counter?: string | string[],
	
	not?: string,
	
	unEvalObj?: string,
	unEvalArr?: string,
	// onFailure?: string,
}; 



/**
 * @type tsJSStepString
 * @description String-based step for DNA→JS code generation
 */
export type tsJSStepString = string;

/**
 * @type tsJSStepOp
 * @description Operation step for DNA→JS code generation
 * Format: [dnaId, inVarName, outVarName?, pathVar?, parentCtx?]
 */
export type tsJSStepOp = [number, string, string, string, tsJSParentCtx];
// export type tsJSStepOpRaw = [number, string, string, string];

/**
 * @type tsJSStepAct
 * @description Action step for DNA→JS code generation (BODY, CONST, LET, etc.)
 * Discriminated union based on STEP key
 */
export type tsJSStepAct =
	| [tsSTEP_BODY, string]  // BODY
	| [tsSTEP_CONST, string]  // CONST
	| [tsSTEP_LET, string]  // LET
	| [tsSTEP_START_REF, string]  // START_REF
	| [tsSTEP_END_REF, number | string, string|undefined, string|undefined, tsJSParentCtx]  // END_REF (ref index or function name)
	| [tsSTEP_STR_REF, string, number, string, tsJSParentCtx]  // STR_REF: [code, refIdx, "", parentCtx]
	| [tsSTEP_OUT_ARG, string]  // OUT_CONST: [code, name]
	| [tsSTEP_OUT_CONST, string]  // OUT_CONST: [code, name=value]
	| [tsSTEP_ASYNC];  // ASYNC

/**
 * @type tsStackFrame
 * @description Combined type for stack frames (operations or actions)
 * Properly discriminated union for type-safe access
 */
export type tsStackFrame = tsJSStepAct | tsJSStepOp;
// export type tsStackFrameRaw = tsJSStepOpRaw | tsJSStepAct;

/**
 * @type tsJSFn
 * @description Function type for DNA→JS code generation
 */
export type tsJSFn = tsJSStepString | tsStackFrame[];

/**
 * @type tsLaberlId
 * @description Label ID generator for DNA→JS code generation
 */
export type tsLaberlId = (_?: 0 | 1) => number;

/**
 * @type tsFnDNA
 * @description DNA function signature for code generation
 */
export type tsFnDNA = (args: any[], inputVarName: string, outputVarName: string, pathVar: string, labelId?: tsLaberlId, parentCtx?: tsJSParentCtx) => tsJSFn;

/**
 * @type tsMapper
 * @description Mapper for DNA opcodes to code generation functions
 */
export type tsMapper = Record<string, tsFnDNA>;
