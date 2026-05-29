
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
export const IFERR_BREAK_ = "if(errors.length)" + BREAK_MAIN +";";

export type namerFn = (idx: number) => string;
export const namer: namerFn = (idx: number) => "L" + idx.toString().padStart(4, "0");

export const STEP = {
	BODY: -1,
	CONST: -2,
	LET: -3,
	START_REF:-4,
	END_REF:-5,
	STR_REF:-6,
} as const;


export const escStr = (s:string):string =>JSON.stringify(JSON.stringify(s)).slice(1,-1);

export const fastMergeArrays = <T=any>(target:T[], source:T[]):T[]=>{
	const startLength = target.length;
	const addLen = source.length;
	target.length += addLen;
	for (let i = 0; i < source.length; i++) {
		target[startLength + i] = source[i];
	}
	return target
}