
export const STEP = {
	BODY: -1,
	CONST: -2,
	LET: -3,
	START_REF:-4,
	END_REF:-5,
	STR_REF:-6,
	OUT_ARG:-7,
	OUT_CONST:-8,
	ASYNC:-9,
} as const;

export type tsSTEP_KEYS = typeof STEP[keyof typeof STEP];

export type tsSTEP_BODY = typeof STEP.BODY;
export type tsSTEP_CONST = typeof STEP.CONST;
export type tsSTEP_LET = typeof STEP.LET;
export type tsSTEP_START_REF = typeof STEP.START_REF;
export type tsSTEP_END_REF = typeof STEP.END_REF;
export type tsSTEP_STR_REF = typeof STEP.STR_REF;
export type tsSTEP_OUT_ARG = typeof STEP.OUT_ARG;
export type tsSTEP_OUT_CONST = typeof STEP.OUT_CONST;
export type tsSTEP_ASYNC = typeof STEP.ASYNC;
