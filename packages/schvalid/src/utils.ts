
// export const PARSE_RETURN = "return errors.length?{success:false, errors}:{success:true, data};";
// export const _PARSE_RETURN = ";" + PARSE_RETURN;
// export const VALIDATE_RETURN = "return !errors.length;";
// export const _VALIDATE_RETURN = ";" + VALIDATE_RETURN;
// export const ERR_RETURN = "return {success:false, errors};";
// export const _ERR_RETURN = ";" + ERR_RETURN;
// export const ERR_UNDEF = "&&undefined";
// export const ERR_UNDEF_ = ERR_UNDEF + ";";

// export const MAIN_BLOCK_ID = "mb";
// export const BREAK_MAIN = "break " + MAIN_BLOCK_ID + ";";
// export const $BREAK_MAIN = " " + BREAK_MAIN;
// export const _BREAK_MAIN = ";" + BREAK_MAIN;
// export const IFERR_BREAK_ = "if(errors.length)" + BREAK_MAIN +";";

/** Function that maps a numeric index to a label string (used for naming generated DNA labels). */
export type namerFn = (idx: number) => string;
// export const namer: namerFn = (idx: number) => "L" + idx.toString().padStart(4, "0");

// export const STEP = {
// 	BODY: -1,
// 	CONST: -2,
// 	LET: -3,
// 	START_REF:-4,
// 	END_REF:-5,
// 	STR_REF:-6,
// } as const;


/**
 * Escapes a string for safe embedding inside a double-quoted JavaScript string
 * literal (e.g. inside generated source code).
 *
 * Performs a double `JSON.stringify` and strips the outer quotes, producing a
 * string with all control characters and special sequences properly escaped.
 *
 * @param s - The raw string to escape.
 * @returns The escaped string, safe for insertion between double quotes in generated code.
 */
export const escStr = (s:string):string =>JSON.stringify(JSON.stringify(s)).slice(1,-1);

/**
 * Merges a source array into a target array in-place, avoiding the overhead of
 * `Array.prototype.push.apply` / spread for large arrays.
 *
 * Grows `target`'s length and copies `source` elements directly into the
 * newly allocated slots. The returned array is the same reference as `target`
 * (mutated in place).
 *
 * @param target - The destination array to merge into (mutated in place).
 * @param source - The source array whose elements are appended to `target`.
 * @returns The mutated `target` array reference.
 */
export const fastMergeArrays = <T=any>(target:T[], source:T[]):T[]=>{
	const startLength = target.length;
	const addLen = source.length;
	target.length += addLen;
	for (let i = 0; i < source.length; i++) {
		target[startLength + i] = source[i];
	}
	return target
}