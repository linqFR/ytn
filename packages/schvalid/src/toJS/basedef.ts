// import { classifiers, pTypes, applicators, metaClassifiers } from "./jshelpers.js";
const { dic: pk, rev: pkr, keys: pkKeys } = pTypes;
const { dic: app, rev: appr } = applicators;
const { dic: c, rev: cr } = classifiers;

export type tsAllKW = Record<string, [number, number]>

export function filterByClassifier(reg: tsAllKW, options: { [k: number]: { [x: string]: number } }) {
    const collector: { [k: string]: (keyof tsAllKW)[] } = {};
    const refType: { [k: string]: string } = {}

    // Initialize collector arrays
    for (const idx in options) {
        const _opt = options[idx];
        for (const p in _opt) {
            collector[p] = []
        }
    }

    for (const k in reg) {
        refType[k] = pkr[reg[k][0]];
        for (const idx in options) {
            const _opt = options[idx];
            for (const p in _opt) {
                // Filter by classifier (second element)
                if (0 !== (reg[k][1] & _opt[p])) collector[p].push(k)
                // Filter by type (first element) if the option matches a type
                else if (reg[k][0] === _opt[p]) collector[p].push(k)
            }
        }
    }
    return { ...collector, refType };
}

export const allkeywords: tsAllKW = {
    // [onlyForType, classifiers]

    // Type declarations
    type: [pk.any, c.pointsToValues | c.typeDecl],
    enum: [pk.any, c.pointsToValues | c.containerArrayKeys | c.typeDecl],
    const: [pk.any, c.pointsToValues | c.typeDecl],

    // String constraints
    minLength: [pk.string, c.pointsToValues | c.constraint],
    maxLength: [pk.string, c.pointsToValues | c.constraint],
    pattern: [pk.string, c.pointsToValues | c.constraint],
    format: [pk.string, c.pointsToValues | c.constraint],

    // Number constraints
    minimum: [pk.number, c.pointsToValues | c.constraint],
    maximum: [pk.number, c.pointsToValues | c.constraint],
    exclusiveMinimum: [pk.number, c.pointsToValues | c.modifier | c.constraint],
    exclusiveMaximum: [pk.number, c.pointsToValues | c.modifier | c.constraint],
    multipleOf: [pk.number, c.pointsToValues | c.constraint],

    // Array constraints
    prefixItems: [pk.array, c.pointsToSchemas | c.containerArrayKeys | c.container],
    items: [pk.array, c.pointsToSchemas | c.container],
    additionalItems: [pk.array, c.pointsToSchemas | c.container],
    uniqueItems: [pk.array, c.pointsToValues | c.constraint],
    contains: [pk.array, c.pointsToSchemas | c.container],
    minContains: [pk.array, c.pointsToValues | c.constraint],
    maxContains: [pk.array, c.pointsToValues | c.constraint],
    minItems: [pk.array, c.pointsToValues | c.constraint],
    maxItems: [pk.array, c.pointsToValues | c.constraint],
    unevaluatedItems: [pk.array, c.pointsToSchemas | c.container],

    // Object constraints
    properties: [pk.object, c.pointsToSchemas | c.containerObjectKeys | c.priority1],
    patternProperties: [pk.object, c.pointsToSchemas | c.containerObjectKeys | c.priority1],
    additionalProperties: [pk.object, c.pointsToSchemas | c.priority1],
    unevaluatedProperties: [pk.object, c.pointsToSchemas | c.priority1],
    propertyNames: [pk.object, c.pointsToSchemas | c.priority1],
    required: [pk.object, c.pointsToValues | c.containerArrayKeys | c.priority0],
    minProperties: [pk.object, c.pointsToValues | c.containerObjectKeys | c.priority0],
    maxProperties: [pk.object, c.pointsToValues | c.containerObjectKeys | c.priority0],
    dependentRequired: [pk.object, c.pointsToValues | c.containerObjectKeys | c.priority0],
    dependentSchemas: [pk.object, c.pointsToSchemas | c.containerObjectKeys | c.priority0],

    // Applicators
    allOf: [pk.any, c.pointsToSchemas | c.containerArrayKeys],
    anyOf: [pk.any, c.pointsToSchemas | c.containerArrayKeys],
    oneOf: [pk.any, c.pointsToSchemas | c.containerArrayKeys],
    not: [pk.any, c.pointsToSchemas | c.wrapper],
    if: [pk.any, c.pointsToSchemas | c.wrapper],
    then: [pk.any, c.pointsToSchemas | c.wrapper],
    else: [pk.any, c.pointsToSchemas | c.wrapper],

    // References
    $ref: [pk.any, c.pointsToValues],
    $anchor: [pk.any, c.pointsToValues],
    $dynamicRef: [pk.any, c.pointsToValues],
    $dynamicAnchor: [pk.any, c.pointsToValues],

    // Metadata
    $id: [pk.any, c.pointsToValues],
    $schema: [pk.any, c.pointsToValues],
    $defs: [pk.object, c.containerObjectKeys],
    definitions: [pk.object, c.containerObjectKeys],
    title: [pk.any, c.pointsToValues | c.nonActionable],
    description: [pk.any, c.pointsToValues | c.nonActionable],
    default: [pk.any, c.pointsToValues | c.wrapper],
    examples: [pk.any, c.pointsToValues | c.containerArrayKeys | c.nonActionable],
    $comment: [pk.any, c.pointsToValues | c.nonActionable],
}

export default {
    ...filterByClassifier(allkeywords, {
        1: {
            constraint: c.constraint,
            container: metaClassifiers.dic.container,
            containerArrayKeys: c.containerArrayKeys,
            containerObjectKeys: c.containerObjectKeys,
            modifier: c.modifier,
            nonActionable: c.nonActionable,
            priority0: c.priority0,
            priority1: c.priority1,
            typeDecl: c.typeDecl,
            valueArrayKeys: c.pointsToValues,
            wrapper: c.wrapper,
        },
        0: { constraintsForObject: pk.object }
    }),
    primitiveTypes: Object.keys(pkKeys),
};