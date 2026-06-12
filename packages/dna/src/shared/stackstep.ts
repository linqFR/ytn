export const STEP = {
	BODY: -1,
	CONST: -2,
	LET: -3,
	START_REF:-4,
	END_REF:-5,
	STR_REF:-6,
	OUT_ARG:-7,
	OUT_CONST:-8,
} as const;

export type tsSTEP_KEYS = typeof STEP[keyof typeof STEP];

type tsSTEP_BODY = typeof STEP.BODY;
type tsSTEP_CONST = typeof STEP.CONST;
type tsSTEP_LET = typeof STEP.LET;
type tsSTEP_START_REF = typeof STEP.START_REF;
type tsSTEP_END_REF = typeof STEP.END_REF;
type tsSTEP_STR_REF = typeof STEP.STR_REF;
type tsSTEP_OUT_ARG = typeof STEP.OUT_ARG;
type tsSTEP_OUT_CONST = typeof STEP.OUT_CONST;

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
	| [tsSTEP_END_REF, number | string]  // END_REF (ref index or function name)
	| [tsSTEP_STR_REF, string, number, string, any]  // STR_REF: [code, refIdx, "", parentCtx]
	| [tsSTEP_OUT_ARG, string]  // OUT_CONST: [code, name]
	| [tsSTEP_OUT_CONST, string];  // OUT_CONST: [code, name=value]