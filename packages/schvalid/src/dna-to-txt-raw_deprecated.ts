import { type tsLegacyMapperRec } from "./dna-helpers.js";

const stringify = (value: any) =>
  value === undefined ? "undefined" : JSON.stringify(value);

const useFn = (target: number, varName: string = "v") => `fn${target}(${varName})`;

export const mapper: tsLegacyMapperRec = {
  // Primitives
  string: () => `typeof v === "string"`,
  number: () => `typeof v === "number"`,
  integer: () => `Number.isInteger(v)`,
  bigint: () => `typeof v === "bigint"`,
  boolean: () => `typeof v === "boolean"`,
  boolish: () => `typeof v === "boolean" || v === 0 || v === 1`,
  undefined: () => `typeof v === "undefined"`,
  null: () => `v === null`,
  nullish: () => `v === null || v === undefined`,
  date: () => `v instanceof Date`,
  any: () => `true`,
  true: () => `true`,
  false: () => `false`,
  $defs: () => `true`,
  definitions: () => `true`,

  // Wrappers
  optional: (target: [number]) => `v === undefined || ${useFn(target[0])}`,
  nullable: (target: [number]) => `v === null || ${useFn(target[0])}`,
  default: (target: [number], defValue: any) =>
    `{ const res = ${useFn(target[0])}; return res ?? ${stringify(
      defValue,
    )}; }`,
  prefault: (target: [number], prefValue: any) =>
    `{ let _v = v ?? ${stringify(prefValue)}; return ${useFn(
      target[0],
      "_v",
    )}; }`,
  const: (value: any) => `_deepEq(v, ${stringify(value)})`,
  literal: (value: any) => `_deepEq(v, ${stringify(value)})`,

  enum: (values: any[]) => {
    if (values.length === 0) return "false";
    if (values.length <= 3) {
      const checks = values.map((v) =>
        typeof v === "object" && v !== null
          ? `_deepEq(v, ${stringify(v)})`
          : `v === ${stringify(v)}`,
      );
      return checks.join(" || ");
    }

    const isAllPrimitive = values.every(
      (v) => typeof v !== "object" || v === null,
    );
    if (isAllPrimitive) {
      return `(new Set(${stringify(values)}).has(v))`;
    }

    return `{
      const vals = ${stringify(values)};
      for (let i = 0; i < vals.length; i++) {
        if (_deepEq(v, vals[i])) return true;
      }
      return false;
    }`;
  },

  // Composites
  not: (target: [number]) => `!${useFn(target[0])}`,
  seq: (targets: number[]) => targets.map((v) => useFn(v)).join(" && "),

  allOf: (targets: number[]) =>
    targets.length === 0 ? "true" : targets.map((v) => useFn(v)).join(" && "),
  anyOf: (targets: number[]) =>
    targets.length === 0
      ? "false"
      : `(${targets.map((v) => useFn(v)).join(" || ")})`,
  oneOf: (targets: number[]) =>
    `{ let c = 0; ${targets
      .map((idx) => `if (${useFn(idx)}) c++;`)
      .join(" ")} return c === 1; }`,

  ifThenElse: (targets: number[]) => {
    const useConst = (idx: number) => {
      if (idx === -1) return "true";
      if (idx === -2) return "false";
      return useFn(idx);
    };
    return targets.length === 3
      ? `(${useFn(targets[0])} ? ${useConst(targets[1])} : ${useConst(targets[2])})`
      : `(!${useFn(targets[0])} || ${useConst(targets[1])})`;
  },

  // String Checkers
  minLength: (min: number) => `v.length >= ${min}`,
  maxLength: (max: number) => `v.length <= ${max}`,
  strMin: (min: number) => `v.length >= ${min}`,
  strMax: (max: number) => `v.length <= ${max}`,
  eqLength: (len: number) => `v.length === ${len}`,
  strLength: (len: number) => `v.length === ${len}`,
  pattern: (p: string) => `${new RegExp(p).toString()}.test(v)`,
  email: () => `/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v)`,
  uuid: () =>
    `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)`,
  url: () => `{ try { new URL(v); return true; } catch { return false; } }`,

  // Number Checkers
  multipleOf: (m: number) => `v % ${m} === 0`,
  minimum: (min: number) => `v >= ${min}`,
  min: (min: number) => `v >= ${min}`,
  maximum: (max: number) => `v <= ${max}`,
  max: (max: number) => `v <= ${max}`,
  exclusiveMinimum: (min: number) => `v > ${min}`,
  exclusiveMaximum: (max: number) => `v < ${max}`,

  $ref: (target: [number], _path?: any) => useFn(target[0]),

  // Object Checkers
  object: (targets?: number[]) => {
    const base = `(typeof v === 'object' && v !== null && !Array.isArray(v))`;
    return targets && targets.length
      ? `{ return ${base} && ${targets
          .map((idx) => useFn(idx))
          .join(" && ")}; }`
      : `{ return ${base}; }`;
  },
  dependentRequired: (deps: Record<string, string[]>) => {
    const keys = Object.keys(deps);
    if (keys.length === 0) return `true`;
    const checks = keys.map((key) => {
      const reqs = deps[key];
      if (reqs.length === 0) return `true`;
      const reqStr = reqs
        .map((r) => `_has.call(v, ${stringify(r)})`)
        .join(" && ");
      return `(!_has.call(v, ${stringify(key)}) || (${reqStr}))`;
    });
    return checks.filter((c) => c !== "true").join(" && ") || "true";
  },
  dependentSchemas: (deps: Record<string, number>) => {
    const keys = Object.keys(deps);
    if (keys.length === 0) return `true`;
    const checks = keys.map(
      (k) => `(!_has.call(v, ${stringify(k)}) || ${useFn(deps[k])})`,
    );
    return checks.join(" && ");
  },
  properties: (targets: number[]) => targets.map((v) => useFn(v)).join(" && "),
  proptype: (key: string, target: [number]) =>
    `(!_has.call(v, ${stringify(key)}) || ${useFn(
      target[0],
      `v[${stringify(key)}]`,
    )})`,
  patternProperties: (rules: [string, [number]][]) => `{
    for (const k in v) {
        if (!_has.call(v, k)) continue;
        ${rules
          .map(
            ([p, target]) => `
        if (${new RegExp(p).toString()}.test(k)) {
            if (!${useFn(target[0], "v[k]")}) return false;
        }`,
          )
          .join("")}
    }
    return true;
  }`,
  additionalProperties: (
    target: [number],
    allowedKeys: string[] = [],
    patterns: string[] = [],
  ) => {
    const skipKeys =
      allowedKeys && allowedKeys.length > 0
        ? `if (${allowedKeys
            .map((k) => `k === ${stringify(k)}`)
            .join(" || ")}) continue;`
        : "";

    const skipPatterns =
      patterns && patterns.length > 0
        ? `if (${patterns
            .map((p) => `${new RegExp(p).toString()}.test(k)`)
            .join(" || ")}) continue;`
        : "";

    // When target is -2 (false), directly return false for disallowed properties
    if (target[0] === -2) {
      return `{
      for (const k in v) {
          if (!_has.call(v, k)) continue;
          ${skipKeys}
          ${skipPatterns}
          return false;
      }
      return true;
    }`;
    }

    // When target is -1 (true), skip the check since it will never fail
    if (target[0] === -1) {
      return `{
      for (const k in v) {
          if (!_has.call(v, k)) continue;
          ${skipKeys}
          ${skipPatterns}
      }
      return true;
    }`;
    }

    return `{
      for (const k in v) {
          if (!_has.call(v, k)) continue;
          ${skipKeys}
          ${skipPatterns}
          if (!${useFn(target[0], "v[k]")}) return false;
      }
      return true;
    }`;
  },
  required: (keys: string[]) =>
    keys.length === 0 ? "true" : keys.map((k) => `_has.call(v, ${stringify(k)})`).join(" && "),
  propertyNames: (target: [number]) => `{
      for (const k in v) {
          if (!_has.call(v, k)) continue;
          if (!${useFn(target[0], "k")}) return false;
      }
      return true;
  }`,
  maxProperties: (max: number) => `Object.keys(v).length <= ${max}`,
  minProperties: (min: number) => `Object.keys(v).length >= ${min}`,

  // Array Checkers
  array: (targets: number[]) =>
    `(Array.isArray(v) && ${
      targets.length ? targets.map((idx) => useFn(idx)).join(" && ") : "true"
    })`,
  items: (target: [number], offset: number = 0) => {
    // When target is -2 (false), directly return false if there are items beyond offset
    if (target[0] === -2) {
      return `{
        if (v.length > ${offset}) return false;
        return true;
      }`;
    }
    // When target is -1 (true), skip the check since it will never fail
    if (target[0] === -1) {
      return `true`;
    }
    return `{
        for (let i = ${offset}; i < v.length; i++) {
            if (!${useFn(target[0], "v[i]")}) return false;
        }
        return true;
    }`;
  },
  uniqueItems: () => `{
        const len = v.length;
        for (let i = 0; i < len; i++) {
            for (let j = i + 1; j < len; j++) {
                if (_deepEq(v[i], v[j])) return false;
            }
        }
        return true;
  }`,
  minItems: (min: number) => `v.length >= ${min}`,
  maxItems: (max: number) => `v.length <= ${max}`,
  prefixItems: (targets: number[]) => {
    if (targets.length === 0) return `true`;
    return targets
      .map((t, idx) => `(${idx} >= v.length || ${useFn(t, `v[${idx}]`)})`)
      .join(" && ");
  },
  contains: (target: [number], min?: number, max?: number) => {
    // FAST PATH (99% of cases): No min, no max.
    // Returns true as soon as a match is found!
    if (min === undefined && max === undefined) {
      return `{for (let i = 0; i < v.length; i++) {if (${useFn(
        target[0],
        "v[i]",
      )}) return true;}; return false; }`;
    }

    // SLOW PATH: If min/max are defined, we must count occurrences
    return `{ let c = 0; for (let i = 0; i < v.length; i++) { if (${useFn(
      target[0],
      "v[i]",
    )}) { c++; ${
      max !== undefined ? `if (c > ${max}) return false;` : ""
    } } } return c >= ${min !== undefined ? min : 1}; }`;
  },
};
