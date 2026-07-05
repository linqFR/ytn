import type { tsJSStepAct } from "../shared/stackstep.js";

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
 * @type tsJSInnerCtx
 * @description Parent context for DNA→JS code generation
 */
export type tsJSInnerCtx = {
	outerblock:string
	isCond: boolean,
	failCase:string,
	counter?: string | string[],
	typeChecked?: string,
	not?: string,
	unEvalObj?: string,
	unEvalArr?: string,
	onFailure?: string,
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
export type tsJSStepOp = [number, string, string, string, tsJSInnerCtx];
// export type tsJSStepOpRaw = [number, string, string, string];

/**
 * @type tsStackFrame
 * @description Combined type for stack frames (operations or actions)
 * Properly discriminated union for type-safe access
 */
export type tsStackFrame = tsJSStepOp | tsJSStepAct;
// export type tsStackFrameRaw = tsJSStepOpRaw | tsJSStepAct;

/**
 * @type tsJSFn
 * @description Function type for DNA→JS code generation
 */
export type tsJSFn = tsJSStepString | (tsJSStepOp | tsJSStepAct)[];

/**
 * @type tsLaberlId
 * @description Label ID generator for DNA→JS code generation
 */
export type tsLaberlId = (_?: 0 | 1) => number;

/**
 * @type tsFnDNA
 * @description DNA function signature for code generation
 */
export type tsFnDNA = (args: any[], inputVarName: string, outputVarName: string, pathVar: string, labelId?: tsLaberlId, parentCtx?: tsJSInnerCtx) => tsJSFn;

/**
 * @type tsMapper
 * @description Mapper for DNA opcodes to code generation functions
 */
export type tsMapper = Record<string, tsFnDNA>;
