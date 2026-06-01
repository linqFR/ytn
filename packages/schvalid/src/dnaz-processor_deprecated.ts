import type { tsDna, tsDnaOpcode, tsDnaSeq, tsMapFn, tsResExc, tsErr, tsFrame, tsMapFnEntry } from "./dna.type.js";


// Helper functions for cleaner validator code
const ok = (v: any): tsResExc => [v, undefined];
const err = (input: any, expected: any, code: string, path: string[], abort: boolean = false, message?: string | Function, restObj?: object): tsErr => {
    const issue = {
        ...restObj,
        input,
        expected,
        code,
        path,
        abort: false,
        message,
    }
    if (typeof message === "function") issue.message = message(issue);
    return issue;
};

const invalidInputErrMsg = (fmt: (s: any) => string) => (issue: any): string => `Invalid input: expected ${issue.expected}, received ${fmt(issue.input)}`;

const checkTypeOf = (type: string): tsMapFnEntry => (input, s) => {
    if (typeof input === type) { s.result = input; return; }
    return err(input, type, "invalid_type", [type], true, invalidInputErrMsg((i: any): string => typeof i));
}


/**
 * @constant mapFn
 * @description Map of opcodes to their validation functions.
 */
const mapFn: tsMapFn = {

    /** Validators - signature uniforme (args, input) => tsRes */
    string: checkTypeOf("string"),
    number: checkTypeOf("number"),
    bigint: checkTypeOf("bigint"),
    boolean: checkTypeOf("boolean"),
    any: (input, s) => { s.result = input; },
    undefined: checkTypeOf("undefined"),
    null: (input, s) => {
        if (input === null) { s.result = input; return; }
        return err(input, "null", "invalid_type", ["null"], true, invalidInputErrMsg(JSON.stringify));
    },
    date: (input, s) => {
        if (input instanceof Date) { s.result = input; return; }
        return err(input, "Date", "invalid_type", ["Date"], true, invalidInputErrMsg(JSON.stringify));
    },

    // Value validators
    literal: (input, s) => {
        if (Array.isArray(input)) return mapFn.enum(input, s);
        if (input === s.dna) { s.result = input; return; }
        return err(input, s.dna, "invalide_literal", ["literal"], false, s.errmsg);
    },
    enum: (input, s) => {
        if (s.dna.includes(input)) { s.result = input; return; }
        return err(input, s.dna, "invalide_enum", ["enum"], false, s.errmsg)
    },

    
    // String constraints - signature (args, input) => tsRes
    strMin: (input, s) => { if (input.length >= s.dna) return err(input, `Minimum length ${s.dna}`,"invalid_value", [...s.path, "min"], true, undefined, {minimum:s.dna, inclusive:false})},
    strMax: (args: any[], input: any): tsResExc => input.length <= args[0] ? ok(input) : err(`Maximum length ${args[0]}`),
    strLength: (args: any[], input: any): tsResExc => input.length === args[0] ? ok(input) : err(`Expected length ${args[0]}`),
    // JSON Schema 2020-12 pattern (regex)
    pattern: (args: any[], input: any): tsResExc => {
        const regex = new RegExp(args[0]);
        return regex.test(input) ? ok(input) : err(`Pattern ${args[0]} not matched`);
    },
    // Number constraints
    minimum: (input, s) => { if (input < s.dna) return err(input, `Minimum ${s.dna}`, "invalid_value", [...s.path, "min"], true) },
    maximum: (input, s) => { if (input > s.dna) return err(input, `Maximum ${s.dna}`, "invalid_value", [...s.path, "max"], true) },
    exclusiveMinimum: (input, s) => { if (input <= s.dna) return err(input, `Exclusive minimum ${s.dna}`, "invalid_value", [...s.path, "exclusiveMinimum"], true) },
    exclusiveMaximum: (input, s) => { if (input >= s.dna) return err(input, `Exclusive maximum ${s.dna}`, "invalid_value", [...s.path, "exclusiveMaximum"], true) },
    multipleOf: (input, s) => { if (input % s.dna !== 0) return err(input, `Multiple of ${s.dna}`, "invalid_value", [...s.path, "multipleOf"], true) },
    
    // Format validators - using pattern internally
    email: (args: any[], input: any): tsResExc => {
        const [, emailErr] = mapFn.pattern(["^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"], input);
        return emailErr ? err("Invalid email") : ok(input);
    },
    uuid: (args: any[], input: any): tsResExc => {
        const [, uuidErr] = mapFn.pattern(["^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"], input);
        return uuidErr ? err("Invalid UUID") : ok(input);
    },
    url: (args: any[], input: any): tsResExc => {
        try {
            new URL(input);
            return ok(input);
        } catch {
            return err("Invalid URL");
        }
    },


    /** Applicators */
    allOf: (input, s) => {
        for (const it of s.dna) {
            const res = exc([it] as any, input);
            if (!res.success) return res.error[0];
        }
    },
    anyOf: (input, s) => {
        const issues = [];
        for (const it of s.dna) {
            const res = exc([it] as any, input);
            if (res.success) { s.result = res.data; return; }
            issues.push(...res.error);
        }
        return err(input, "anyOf", "anyof_failed", s.path, false, "None of the schemas matched", { branches: issues });
    },
    oneOf: (input, s) => {
        let matchCount = 0;
        let lastRes = null;
        for (const it of s.dna) {
            const res = exc([it] as any, input);
            if (res.success) { matchCount++; lastRes = res.data; }
        }
        if (matchCount === 1) { s.result = lastRes; return; }
        return err(input, "oneOf", "oneof_failed", s.path, false, `Expected exactly one match, found ${matchCount}`);
    },
    // JSON Schema 2020-12 properties
    // dna: [[key, subDna], ...]
    properties: (dna: [string, tsDna][], v: Record<string, any>, state?: tsFrame): tsResExc => {
        const collecRes: Record<string, any> = {};
        const collecErr: [string, any][] = [];

        for (const [key, subDna] of dna) {
            if (key in v) {
                // Pass state to nested exc for shared stack
                const [res, err] = state
                    ? exc(subDna, v[key], state)
                    : exc(subDna, v[key]);
                if (!err) collecRes[key] = res;
                else collecErr.push([key, err]);
            }
        }

        return collecErr.length === 0 ? ok(collecRes) : err(collecErr);
    },
    // JSON Schema 2020-12 patternProperties
    // dna: [[pattern, subDna], ...]
    patternProperties: (dna: [string, tsDna][], v: Record<string, any>): tsResExc => {
        const collecRes: Record<string, any> = {};
        const collecErr: [string, any][] = [];

        for (const [pattern, subDna] of dna) {
            const regex = new RegExp(pattern);
            for (const key of Object.keys(v)) {
                if (regex.test(key)) {
                    const [res, err] = exc(subDna, v[key]);
                    if (!err) collecRes[key] = res;
                    else collecErr.push([key, err]);
                }
            }
        }

        return collecErr.length === 0 ? ok(collecRes) : err(collecErr);
    },
    dependentRequired: (input, s) => {
        for (const [key, deps] of Object.entries(s.dna as Record<string, string[]>)) {
            if (key in input) {
                for (const dep of deps) {
                    if (!(dep in input)) return err(input, dep, "missing_dependent_key", [...s.path, dep], false, `Missing dependent key: ${dep}`);
                }
            }
        }
    },
    // JSON Schema 2020-12 additionalProperties
    // dna: [schema | boolean, coveredKeys[]]
    additionalProperties: (dna: [tsDna | boolean, string[]], v: Record<string, any>): tsResExc => {
        const [schema, coveredKeys] = dna;
        const coveredSet = new Set(coveredKeys);

        if (schema === true) {
            // Allow all additional properties, no validation
            const extraRes: Record<string, any> = {};
            for (const key of Object.keys(v)) {
                if (!coveredSet.has(key)) extraRes[key] = v[key];
            }
            return ok(extraRes);
        }

        if (schema === false) {
            // Strict - no extra keys allowed
            const extraKeys = Object.keys(v).filter(k => !coveredSet.has(k));
            return extraKeys.length === 0 ? ok({}) : err(extraKeys.map(k => [k, "Additional property not allowed"]));
        }

        // Schema provided - validate extra properties
        const collecRes: Record<string, any> = {};
        const collecErr: [string, any][] = [];
        for (const key of Object.keys(v)) {
            if (!coveredSet.has(key)) {
                const [res, error] = exc(schema as tsDna, v[key]);
                if (!error) collecRes[key] = res;
                else collecErr.push([key, error]);
            }
        }
        return collecErr.length === 0 ? ok(collecRes) : err(collecErr);
    },
    /**
     *  Wrappers with % syntax: [%, [wrapper, [args, towrap]]] 
     * Wrapper are only called by "%"
    */
    "%": (dna: [[tsDnaOpcode, any[], tsDna]], v: any) => {
        const [wrapperName, [wrapperArgs, toWrap]] = dna[0];
        const wrapperFn = mapFn[wrapperName];
        if (!wrapperFn) return [null, `Unknown wrapper: ${wrapperName}`];

        // Wrapper calls exc internally and transforms result
        return wrapperFn(wrapperArgs, toWrap, v);
    },
    "$ref": (input, s) => {
        // Le processeur actuel n'ayant pas accès au tableau DNA global complet (parce qu'il shift le tableau), 
        // l'exécution d'un saut indexé n'est pas possible de façon isolée sans refactorisation du run-loop.
        // On retourne ok par défaut pour éviter le crash.
    },
    // Wrapper definitions - signature: (args, toWrap, input) => tsRes
    default: (args: any[], toWrap: tsDna, v: any): tsResExc => {
        const [res, err] = exc(toWrap, v);
        return err ? [args[0], undefined] : [res, undefined];
    },
    prefault: (args: any[], toWrap: tsDna, v: any): tsResExc => {
        const [res, err] = exc(toWrap, v);
        return [err ? args[0] : res, undefined];
    },
    optional: (args: any[], toWrap: tsDna, v: any): tsResExc => {
        if (v === undefined) return [undefined, undefined];
        const [res, err] = exc(toWrap, v);
        return [res, err];
    },
    nullable: (args: any[], toWrap: tsDna, v: any): tsResExc => {
        if (v === null) return [null, undefined];
        const [res, err] = exc(toWrap, v);
        return [res, err];
    },
    // JSON Schema 2020-12 not: inverse le résultat
    // [%, [not, [], [dna]]]
    not: (args: any[], toWrap: tsDna, v: any): tsResExc => {
        const [res, err] = exc(toWrap, v);
        // Succès si le wrapped échoue, échec si le wrapped réussit
        return err ? [v, undefined] : [null, "Not: validation succeeded but should fail"];
    },
    // JSON Schema 2020-12 if/then/else
    // [%, [ifThenElse, [[ifDna], [thenDna], [elseDna]], toWrap]]
    // ou directement: [%, [ifThenElse, [[ifDna], [thenDna]], toWrap]] sans else
    ifThenElse: (args: any[], toWrap: tsDna, v: any): tsResExc => {
        const [[ifDna], [thenDna], elseDna] = args;
        // Condition: ifDna validé contre v
        const [, ifErr] = exc(ifDna, v);
        if (!ifErr) {
            // if passe → then
            return exc(thenDna, v);
        } else if (elseDna) {
            // if échoue et else existe → else
            return exc(elseDna, v);
        }
        // if échoue et pas d'else → passe le input tel quel
        return [v, undefined];
    },

    // JSON Schema 2020-12 object applicator combining properties, patternProperties, additionalProperties
    object: (dna: tsDna[], v: any): tsResExc => {
        if (typeof v !== "object" || v === null || Array.isArray(v)) {
            return err("Expected object");
        }

        let result: Record<string, any> = {};
        let errors: any[] = [];
        let propKeys: string[] = [];
        let patternMatchedKeys: string[] = [];
        let additionalPropsSchema: tsDna | boolean | null = null;
        let propertiesDna: [string, tsDna][] | null = null;
        let patternPropertiesDna: [string, tsDna][] | null = null;

        // First pass: collect all applicators
        for (const [op, ...args] of dna) {
            if (op === "properties") {
                propertiesDna = args[0];
                propKeys = args[0].map((p: [string, tsDna]) => p[0]);
            } else if (op === "patternProperties") {
                patternPropertiesDna = args[0];
            } else if (op === "additionalProperties") {
                additionalPropsSchema = args[0];
            }
        }

        // Apply properties via exc
        if (propertiesDna) {
            const [propsRes, propsErr] = exc(["properties", propertiesDna], v);
            if (propsErr) errors.push(["properties", propsErr]);
            else {
                result = { ...result, ...propsRes };
                propKeys = propertiesDna.map((p: [string, tsDna]) => p[0]);
            }
        }

        // Apply patternProperties via exc and collect matched keys
        if (patternPropertiesDna) {
            const [patRes, patErr] = exc(["patternProperties", patternPropertiesDna], v);
            if (patErr) errors.push(["patternProperties", patErr]);
            else {
                result = { ...result, ...patRes };
                patternMatchedKeys = Object.keys(patRes);
            }
        }

        // Apply additionalProperties via exc (if not specified, default is true per JSON Schema)
        const addSchema = additionalPropsSchema !== null ? additionalPropsSchema : true;
        const coveredKeys = [...propKeys, ...patternMatchedKeys];
        const [addRes, addErr] = exc(["additionalProperties", addSchema, coveredKeys], v);
        if (addErr) errors.push(["additionalProperties", addErr]);
        else result = { ...result, ...addRes };

        return errors.length === 0 ? ok(result) : err(errors);
    },
    // strictObject = sugar for obj with additionalProperties: false by default
    strictObject: (dna: tsDna[], v: any): tsResExc => {
        const hasAdditionalProps = dna.some(([op]) => op === "additionalProperties");
        const fullDna = hasAdditionalProps ? dna : [...dna, ["additionalProperties", false] as tsDna];
        return mapFn.obj(fullDna, v);
    },
    // looseObject = sugar for obj with additionalProperties: true by default
    looseObject: (dna: tsDna[], v: any): tsResExc => {
        const hasAdditionalProps = dna.some(([op]) => op === "additionalProperties");
        const fullDna = hasAdditionalProps ? dna : [...dna, ["additionalProperties", true] as tsDna];
        return mapFn.obj(fullDna, v);
    },
    // Nouveau applicateur obj déclaratif simplifié
    // ["obj", [["properties", [...]], ["patternProperties", [...]], ["additionalProperties", false]]]
    obj: (dna: tsDna[], v: any): tsResExc => {
        if (typeof v !== "object" || v === null || Array.isArray(v)) {
            return err(v, "Expected object");
        }

        let result: Record<string, any> = {};
        let errors: any[] = [];
        let coveredKeys: string[] = [];

        for (const [op, ...args] of dna) {
            if (op === "properties") {
                // Collecte des clés de properties
                const props = args[0] as [string, tsDna][];
                coveredKeys.push(...props.map(p => p[0]));

                // Validation
                const [propsRes, propsErr] = exc(["properties", props], v);
                if (propsErr) errors.push(["properties", propsErr]);
                else result = { ...result, ...propsRes };
            }
            else if (op === "patternProperties") {
                const [patRes, patErr] = exc(["patternProperties", args[0]], v);
                if (patErr) errors.push(["patternProperties", patErr]);
                else {
                    result = { ...result, ...patRes };
                    coveredKeys.push(...Object.keys(patRes));
                }
            }
            else if (op === "additionalProperties") {
                const [addRes, addErr] = exc(["additionalProperties", args[0], coveredKeys], v);
                if (addErr) errors.push(["additionalProperties", addErr]);
                else result = { ...result, ...addRes };
            }
        }

        return errors.length === 0 ? ok(result) : err(errors);
    },
    array: (args: any[], input: any): tsResExc => {
        if (!Array.isArray(input)) return err("Expected array");
        const innerOp = args[0] as tsDnaOpcode;
        const innerFn = mapFn[innerOp];
        for (const item of input) {
            const [validated, error] = innerFn([], item);
            if (error) return err(error);
        }
        return ok(input);
    },
    tuple: (args: any[], input: any): tsResExc => {
        if (!Array.isArray(input)) return err("Expected array");
        const items = args[0] as tsDna[];
        if (input.length !== items.length) return err(`Expected ${items.length} items`);
        const result: any[] = [];
        for (let i = 0; i < items.length; i++) {
            const [validated, error] = exc(items[i], input[i]);
            if (error) return err(error);
            result[i] = validated;
        }
        return ok(result);
    },
};

/**
 * @function exc
 * @description Executes DNA bytecode using a state machine with while loop.
 *
 * @param {tsDna} dna - The DNA bytecode to execute.
 * @param {any} input - The input to validate.
 * @returns {tsResExc} [result, undefined] on success or [null, error] on failure.
 */
export function exc(dna: tsDna, input: any): tsResExc {
    // If no state provided, create a new one (top-level call)
    const currentState : tsFrame = {
        dna: dna,
        idx:0,
        input: input,
        targetKey: undefined,
        path: [],
        result: undefined as any,
        errors: [],
    };

    if (!Array.isArray(dna)) {
        throw new Error("DNA must be an array");
    }

    let codeStack: tsDna[] = dna;
    let stop: undefined | boolean;

    // If this is a nested call (state provided), execute single instruction
    while (codeStack.length > 0 && !stop) {
        const next = codeStack.shift();
        const [op, ...rest] = next!;
        if (Array.isArray(op)) { codeStack.push(...rest); continue; }
        const opIsStr = typeof op === "string"
        const fn = opIsStr && mapFn[op]
        if (opIsStr && !fn) {
            currentState.errors.push(err(
                input,
                Object.keys(mapFn).join("|"),
                "unknown_operation",
                [op],
                true,
                `Unknown operation: ${op}`,
            ));
            stop = true;
            continue;
        }
        currentState.dna = rest;
        const error = fn && fn(input, currentState);
        if (error) { currentState.errors.push(error); stop = error.abort; }
    }

    if (currentState.errors.length > 0) return { success: false, error: currentState.errors };
    return { success: true, data: currentState.result }
}
