export type tsStringOpt = {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    _?: number;
}
export type tsStringDNA = ["s", number, number, string | -1, 0 | 1];

export const string = (opt: tsStringOpt, typeDeclared: boolean = true) => {
    const { minLength, maxLength, pattern } = opt || {};
    return [
        "s",
        typeof minLength !== "undefined" && typeof minLength === 'number' && minLength >= 0 ? minLength : -1,
        typeof maxLength !== "undefined" && typeof maxLength === 'number' && maxLength >= 0 ? maxLength : -1,
        typeof pattern !== "undefined" && pattern instanceof RegExp ? pattern.toString() : -1,
        typeDeclared ? 1 : 0,
    ];
}

export const minLength = (minLength: number) => string({ minLength }, false);
export const maxLength = (maxLength: number) => string({ maxLength }, false);
export const pattern = (pattern: RegExp) => string({ pattern }, false);

type tsNumberOpt = {
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: boolean;
    exclusiveMaximum?: boolean;
    multipleOf?: number;
}
export type tsNumberDNA = ["n", number | null, 0 | 1, number | null, 0 | 1, number | null, 0 | 1];

export const number = (opt: tsNumberOpt, typeDeclared: boolean = true, dnaCode: string = "n") => {
    const { minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf } = opt || {};
    return [
        dnaCode,
        typeof minimum !== "undefined" && typeof minimum === 'number' ? minimum : null,
        exclusiveMinimum ? 1 : 0,
        typeof maximum !== "undefined" && typeof maximum === 'number' ? maximum : null,
        exclusiveMaximum ? 1 : 0,
        typeof multipleOf !== "undefined" && typeof multipleOf === 'number' ? multipleOf : null,
        typeDeclared ? 1 : 0,
    ];
}

export const integer = (opt: tsNumberOpt, _: boolean = true) => {
    return number(opt, true, "i");
}

export const bigint = (opt: tsNumberOpt, _: boolean = true) => {
    return number(opt, true, "bi");
}

export type tsBooleanDNA = ["b"];

export const boolean = () => {
    return ["b"];
}

export type tsNullDNA = ["0"];

export const nullType = (typeDeclared: boolean = true) => {
    return ["0"];
}

export type tsConstDNA = ["c", string];

export const constType = (value: string) => {
    return ["c", value];
}

export type tsLiteralDNA = ["l", unknown];

export const literal = (value: unknown) => {
    return ["l", value];
}

export type tsEnumDNA = ["e", unknown[]];

export const enumType = (values: unknown[]) => {
    return ["e", values];
}

type tsObjectOpt = {
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean | string;
}
export type tsObjectDNA = ["o", Record<string, unknown>, string[] | -1, boolean | string | -1, 0 | 1];

export const object = (opt: tsObjectOpt, typeDeclared: boolean = true) => {
    const {type,  properties, required, additionalProperties } = opt || {};
    return [
        "o",
        properties || {},
        required && required.length > 0 ? required : -1,
        typeof additionalProperties !== "undefined" ? additionalProperties : -1,
        typeDeclared ? 1 : 0,
    ];
}



type tsArrayOpt = {
    items?: unknown;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
}
export type tsArrayDNA = ["a", unknown | -1, number, number, 0 | 1, 0 | 1];

export const array = (opt: tsArrayOpt, typeDeclared: boolean = true) => {
    const { items, minItems, maxItems, uniqueItems } = opt || {};
    return [
        "a",
        typeof items !== "undefined" ? items : -1,
        typeof minItems !== "undefined" && typeof minItems === 'number' ? minItems : -1,
        typeof maxItems !== "undefined" && typeof maxItems === 'number' ? maxItems : -1,
        uniqueItems ? 1 : 0,
        typeDeclared ? 1 : 0,
    ];
}

