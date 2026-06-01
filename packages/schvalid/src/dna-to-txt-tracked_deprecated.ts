import { useFn, type tsMapperRec } from "./dna-helpers.js";
import { mapper } from "./dna-to-txt-raw_deprecated.js";

const stringify = (value: any) =>
  value === undefined ? "undefined" : JSON.stringify(value);

export const mapperTracked: tsMapperRec = {
  ...mapper,

  any: () => `true`,
  true: () => `true`,
  false: () => `false`,
  null: () => `v === null`,
  nullish: () => `v === null || v === undefined`,
  date: () => `v instanceof Date`,

  const: (value: any) => `_deepEq(v, ${stringify(value)})`,
  literal: (value: any) => `_deepEq(v, ${stringify(value)})`,
  enum: (values: any[]) => `(${stringify(values)}.some(x => _deepEq(v, x)))`,

  not: (target: [number]) =>
    `{ const cp = _e.length; const res = ${useFn(
      target[0],
    )}; _e.length = cp; return !res; }`,

  allOf: (targets: number[]) =>
    `{ const cp = _e.length; let u = []; ${targets
      .map((idx) => `{ const _cp = _e.length; if (!${useFn(idx)}) { _e.length = cp; return false; } const slice = _e.slice(_cp); for(let j=0; j<slice.length; j++) { if(!u.includes(slice[j])) u.push(slice[j]); } _e.length = _cp; }`)
      .join(" ")} for(let j=0; j<u.length; j++) { if(!_e.includes(u[j])) _e.push(u[j]); } return true; }`,

  anyOf: (targets: number[]) =>
    `{ const cp = _e.length; let match = false; let u = []; ${targets
      .map(
        (idx) =>
          `{ const _cp = _e.length; if (${useFn(idx)}) { match = true; const slice = _e.slice(_cp); for(let j=0; j<slice.length; j++) { if(!u.includes(slice[j])) u.push(slice[j]); } } _e.length = _cp; }`,
      )
      .join(" ")} if (match) { for(let j=0; j<u.length; j++) { if(!_e.includes(u[j])) _e.push(u[j]); } return true; } _e.length = cp; return false; }`,
      
  oneOf: (targets: number[]) =>
    `{ const cp = _e.length; let found = -1; let u = []; ${targets
      .map(
        (idx, i) =>
          `{ const _cp = _e.length; if (${useFn(idx)}) { if (found !== -1) { _e.length = cp; return false; } found = ${i}; u = _e.slice(_cp); } _e.length = _cp; }`,
      )
      .join(" ")} if (found === -1) { _e.length = cp; return false; } for(let j=0; j<u.length; j++) { if(!_e.includes(u[j])) _e.push(u[j]); } return true; }`,

  ifThenElse: (targets: number[]) => {
    const hasElse = targets.length === 3;
    return `{ const cp = _e.length; 
        let ifMatch = false; let u = [];
        {
          const _cp = _e.length;
          if (${useFn(targets[0])}) { 
              ifMatch = true; 
              const slice = _e.slice(_cp);
              for(let j=0; j<slice.length; j++) { if(!u.includes(slice[j])) u.push(slice[j]); }
          }
          _e.length = _cp;
        }
        if (ifMatch) {
            const _cp = _e.length;
            if (${useFn(targets[1])}) {
                const slice = _e.slice(_cp);
                for(let j=0; j<slice.length; j++) { if(!u.includes(slice[j])) u.push(slice[j]); }
                _e.length = _cp;
                for(let j=0; j<u.length; j++) { if(!_e.includes(u[j])) _e.push(u[j]); }
                return true;
            }
        } else {
            const _cp = _e.length;
            if (${hasElse ? useFn(targets[2]) : "true"}) {
                const slice = _e.slice(_cp);
                for(let j=0; j<slice.length; j++) { if(!u.includes(slice[j])) u.push(slice[j]); }
                _e.length = _cp;
                for(let j=0; j<u.length; j++) { if(!_e.includes(u[j])) _e.push(u[j]); }
                return true;
            }
        }
        _e.length = cp;
        return false;
    }`;
  },

  proptype: (key: string, target: [number]) =>
    `(!_has.call(v, ${stringify(key)}) || (_e.push(${stringify(key)}), _pushE(), (res = ${useFn(
      target[0],
      `v[${stringify(key)}]`,
    )}), _popE(), res))`,

  patternProperties: (rules: [string, [number]][]) => `{
    const rxRules = [${rules
      .map(([p]) => `new RegExp(${stringify(p)})`)
      .join(", ")}];
    const keys = Object.keys(v);
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        ${rules
          .map(
            (_, idx) => `
        if (rxRules[${idx}].test(k)) {
            _e.push(k);
            _pushE();
            const res = ${useFn(rules[idx][1][0], "v[k]")};
            _popE();
            if (!res) return false;
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
        ? `if (regexes.some((rx) => rx.test(k))) continue;`
        : "";

    const regexInit =
      patterns && patterns.length > 0
        ? `const regexes = [${patterns
            .map((p) => `new RegExp(${stringify(p)})`)
            .join(", ")}];`
        : "";

    return `{const keys = Object.keys(v);${regexInit}
            for (let i = 0; i < keys.length; i++) {const k = keys[i];
                ${skipKeys}
                ${skipPatterns}
                _e.push(k);
                _pushE();
                const res = ${useFn(target[0], "v[k]")};
                _popE();
                if (!res) return false;
            }
            return true;
        }`;
  },

  unevaluatedProperties: (target: [number]) => `{
      const keys = Object.keys(v);
      for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          if (_e.includes(k)) continue;
          _pushE();
          const res = ${useFn(target[0], "v[k]")};
          _popE();
          if (!res) return false;
          _e.push(k);
      }
      return true;
  }`,

  items: (target: [number]) => `{
        for (let i = 0; i < v.length; i++) {
            _e.push(i);
            _pushE();
            const res = ${useFn(target[0], "v[i]")};
            _popE();
            if (!res) return false;
        }
        return true;
    }`,

  prefixItems: (targets: number[]) => {
    if (targets.length === 0) return `true`;
    return targets
      .map(
        (t, idx) =>
          `(${idx} >= v.length || (_e.push(${idx}), _pushE(), (res = ${useFn(
            t,
            `v[${idx}]`,
          )}), _popE(), res))`,
      )
      .join(" && ");
  },

  unevaluatedItems: (target: [number]) => `{
      for (let i = 0; i < v.length; i++) {
          if (_e.includes(i)) continue;
          _pushE();
          const res = ${useFn(target[0], "v[i]")};
          _popE();
          if (!res) return false;
          _e.push(i);
      }
      return true;
  }`,
  
  contains: (target: [number], min?: number, max?: number) => {
    return `{ let c = 0; for (let i = 0; i < v.length; i++) {
        _pushE(); const res = ${useFn(target[0], "v[i]")}; _popE();
        if (res) { 
            c++; 
            if (!_e.includes(i)) _e.push(i); 
            ${max !== undefined ? `if (c > ${max}) return false;` : ""} 
        }
    } return c >= ${min !== undefined ? min : 1}; }`;
  },

  dynAnchor: (name: string, target: number) => 
    `{ 
        const oldLen = _d.length; 
        const anchorFn = (v) => ${useFn(target, "v")};
        _d.push({ [${JSON.stringify(name)}]: anchorFn }); 
        const res = anchorFn(v);
        _d.length = oldLen;
        return res; 
    }`,

  dynRef: (name: string) => 
    `{ const fn = _resolveDyn(${JSON.stringify(name)}); return fn ? fn(v) : true; }`,
};
