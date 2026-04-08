/**
 * @function castArrayValuesToString
 * @description Standard utility to cast all elements of an array to their string representation.
 *
 * @param {any[]} v - The array of values to cast.
 * @returns {string[]} An array of strings.
 */
export const castArrayValuesToString = (v: any[]): string[] => v.map(String);
