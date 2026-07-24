import { initDna } from '../builder/dna-core.js';
import * as c from '../builder/dna-interfaces.js';
import { DnaMap, DnaSet } from '../builder/api-enhanced.js';
import type { tsDnaMeta } from '../shared/meta-context.type.js';
import type { tsDna, tsDnaSeq } from '../types/core.types.js';

function buildNode(node: tsDna, build: (id: number) => c.DnaTypeWithWrappers<any, any>, dnaList: tsDna[]): c.DnaTypeWithWrappers<any, any> {
  const [opcode, params] = node;

  switch (opcode) {
    case 's': {
      const [min, max, pattern, format] = params as [number | null, number | null, any, any];
      return initDna(c.DnaString, { min, max, pattern, format }, node[2]);
    }

    case 'n': {
      const [min, exclMin, max, exclMax, multOf] = params as [number | null, boolean, number | null, boolean, number | null];
      return initDna(c.DnaNumber, { min, max, exclMin, exclMax, multOf }, node[2]);
    }

    case 'i': {
      const [min, exclMin, max, exclMax, multOf] = params as [number | null, boolean, number | null, boolean, number | null];
      return initDna(c.DnaInt, { min, max, exclMin, exclMax, multOf }, node[2]);
    }

    case 'bi': {
      const [min, exclMin, max, exclMax, multOf] = params as [bigint | null, boolean, bigint | null, boolean, bigint | null];
      return initDna(c.DnaBigInt, { min, max, exclMin, exclMax, multOf }, node[2]);
    }

    case 'b':
      return initDna(c.DnaBoolean, undefined, node[2]);

    case 'l': {
      const values = params as unknown[];
      const value = values.length === 1 ? values[0] : values;
      return initDna(c.DnaLiteral, { value }, node[2]);
    }

    case 'e': {
      const values = params as unknown[];
      const enumObj = Object.fromEntries((values as unknown[]).map((v, i) => [String(i), v]));
      return initDna(c.DnaEnum, { enumObj }, node[2]);
    }

    case 'n0':
      return initDna(c.DnaNull, undefined, node[2]);

    case 'undefined':
      return initDna(c.DnaUndefined, undefined, node[2]);

    case 'T':
      return initDna(c.DnaAny, undefined, node[2]);

    case 'F':
      return initDna(c.DnaNever, undefined, node[2]);

    case 'nan':
      return initDna(c.DnaNaN, undefined, node[2]);

    case 'symbol':
      return initDna(c.DnaSymbol, undefined, node[2]);

    case 'date': {
      const [min, max] = params as [Date | null, Date | null];
      return initDna(c.DnaDate, { min, max }, node[2]);
    }

    case 'wrp': {
      const [wrptype, innerId, , value] = params as [string, number, string, any];
      const inner = build(innerId);
      let wrapped;
      switch (wrptype) {
        case 'optional': wrapped = inner.optional(); break;
        case 'nullable': wrapped = inner.nullable(); break;
        case 'nullish': wrapped = inner.nullish(); break;
        case 'nonoptional': wrapped = inner.nonoptional(); break;
        case 'exactOptional': wrapped = inner.exactOptional(); break;
        case 'default': wrapped = inner.default(value); break;
        case 'prefault': wrapped = inner.prefault(value); break;
        default:
          throw new Error(`fromDna: wrp type not implemented: ${wrptype}`);
      }
      wrapped._core.rawMeta(node[2]);
      return wrapped;
    }

    case '$o': {
      const constraints = params as any[];
      const propertySchemas: Record<string, c.DnaTypeWithWrappers<any, any>> = {};
      let addPropSchema: c.DnaTypeWithWrappers<any, any> | boolean | undefined;
      let objType: 'strict' | 'loose' | 'standard' = 'standard';
      let requiredKeys: string[] | undefined;

      for (const [name, value] of constraints) {
        if (name === 'properties' || name === 'defaultProperties') {
          for (const [key, childId] of (value as [string, number, tsDnaMeta][])) {
            propertySchemas[key] = build(childId);
          }
        } else if (name === 'required') {
          requiredKeys = value as string[];
        } else if (name === 'additionalProperties') {
          if (value === false) objType = 'strict';
          else if (value === true) objType = 'loose';
          else addPropSchema = build(value as number);
        }
      }

      return initDna(c.DnaObject, { propertySchemas, objType, addPropSchema, requiredKeys }, node[2]);
    }

    case 'coerce': {
      const [coerceCode, innerId] = params as [string, number];
      const inner = build(innerId);
      switch (coerceCode) {
        case 'toString': return initDna(c.DnaCoerceString, inner._core.seed, node[2]);
        case 'toNumber': return initDna(c.DnaCoerceNumber, inner._core.seed, node[2]);
        case 'toInt': return initDna(c.DnaCoerceInt, inner._core.seed, node[2]);
        case 'toBigInt': return initDna(c.DnaCoerceBigInt, inner._core.seed, node[2]);
        case 'toBoolean': return initDna(c.DnaCoerceBoolean, undefined, node[2]);
        case 'toDate': return initDna(c.DnaCoerceDate, inner._core.seed, node[2]);
        default: throw new Error(`fromDna: coerce code not implemented: ${coerceCode}`);
      }
    }

    case 'a': {
      const constraints = params as any[];
      const prefixEntry = constraints.find((entry: any[]) => entry[0] === 'prefixItems');
      if (prefixEntry) {
        const prefixIds = prefixEntry[1] as number[];
        const itemsEntry = constraints.find((entry: any[]) => entry[0] === 'items') as [string, number | false];
        const restId = itemsEntry[1];
        const items = prefixIds.map(build);
        const rest = restId === false ? undefined : build(restId as number);
        return initDna(c.DnaTuple, { items, rest }, node[2]);
      }
      const itemEntry = constraints.find((entry: any[]) => entry[0] === 'items') as [string, number];
      const minEntry = constraints.find((entry: any[]) => entry[0] === 'minItems');
      const maxEntry = constraints.find((entry: any[]) => entry[0] === 'maxItems');
      return initDna(c.DnaArray, {
        itemSchema: build(itemEntry[1]),
        min: minEntry ? (minEntry[1] as number) : null,
        max: maxEntry ? (maxEntry[1] as number) : null,
        length: null,
      }, node[2]);
    }

    case 'anyOf': {
      const [, ...ids] = params as [string, ...number[]];
      const schemas = ids.map(build);
      return initDna(c.DnaUnion, { schemas, combinatorType: 'anyOf' }, node[2]);
    }

    case 'allOf': {
      const [, ...ids] = params as [string, ...number[]];
      const schemas = ids.map(build);
      return initDna(c.DnaIntersection, { schemas, combinatorType: 'allOf' }, node[2]);
    }

    case 'rcd': {
      const constraints = params as any[];
      const propertyNames = constraints.find((entry: any[]) => entry[0] === 'propertyNames') as [string, number, string | null] | undefined;
      const additionalProperties = constraints.find((entry: any[]) => entry[0] === 'additionalProperties') as [string, number | boolean] | undefined;
      const required = constraints.find((entry: any[]) => entry[0] === 'required');
      if (!propertyNames || !additionalProperties) {
        throw new Error('fromDna: rcd missing propertyNames/additionalProperties');
      }
      const keySchema = build(propertyNames[1]);
      const valueSpec = additionalProperties[1];
      const valueSchema = typeof valueSpec === 'boolean' ? valueSpec : build(valueSpec as number);
      const type = required ? 'standard' : 'standard';
      return initDna(c.DnaRecord, { keySchema, valueSchema, type }, node[2]);
    }

    case 'jwt':
      return initDna(c.DnaJwt, { alg: params as string | null }, node[2]);

    case 'discriminator': {
      const discriminDef = node[3] as number[];
      const schemas = discriminDef.slice(1).map(build) as unknown as c.DnaObject[];
      return initDna(c.DnaDiscriminatedUnion, { discriminator: params as string, schemas }, node[4]);
    }

    case 'chk': {
      const ids = params as number[];
      const [innerId, ...checkIds] = ids;
      let inner = build(innerId);
      for (const checkId of checkIds) {
        const checkNode = dnaList[checkId];
        const checkDef = checkNode[1] as unknown[];
        if (checkDef[0] === 'property') {
          const key = checkDef[1] as string | number;
          const schema = build(checkDef[2] as number);
          const prop = initDna(c.DnaProperty, { property: key, schema });
          inner = inner.check(prop);
        } else {
          throw new Error('fromDna: func refine checks are not round-trippable');
        }
      }
      return inner;
    }

    default:
      throw new Error(`fromDna: opcode not implemented: ${opcode}`);
  }
}

export function fromDna(seq: tsDnaSeq): c.DnaType<any, any> {
  const refListRaw = seq[seq.length - 1];
  const dnaList = (Array.isArray(refListRaw) ? seq.slice(0, -1) : seq) as tsDna[];
  const cache = new Map<number, c.DnaTypeWithWrappers<any, any>>();

  function extractMapSet(seqNode: tsDna) {
    const steps = [];
    function add(id) {
      const n = dnaList[id];
      if (n[0] === 'seq') {
        for (const child of n[1]) add(child);
      } else {
        steps.push(n);
      }
    }
    for (const child of seqNode[1]) add(child);

    const instance = steps.find(n => n[0] === 'instanceOf' || n[0] === 'chk');
    if (!instance) return undefined;
    let ctor: string;
    let chk: tsDna | undefined;
    if (instance[0] === 'chk') {
      const ids = instance[1] as number[];
      const instanceOfNode = dnaList[ids[0]];
      if (instanceOfNode[0] !== 'instanceOf') return undefined;
      ctor = instanceOfNode[1] as string;
      chk = instance;
    } else {
      ctor = instance[1] as string;
      chk = steps.find(n => n[0] === 'chk');
    }

    let min: number | null = null;
    let max: number | null = null;
    let size: number | null = null;
    const check = chk;
    if (check) {
      const checkIds = check[1] as number[];
      const checkNode = dnaList[checkIds[1]];
      const checkDef = checkNode[1] as unknown[];
      if (checkDef[0] === 'property' && checkDef[1] === 'size') {
        const num = build(checkDef[2] as number);
        if (num instanceof c.DnaNumber) {
          const numState = (num as unknown as { _core: { seed: { min: number | null; max: number | null } } })._core.seed;
          if (numState.min === numState.max && numState.min !== null) size = numState.min;
          else { min = numState.min; max = numState.max; }
        }
      }
    }

    if (ctor === 'Map') {
      const rcd = steps.find(n => n[0] === 'rcd');
      if (!rcd) return undefined;
      const propertyNames = rcd[1].find(entry => entry[0] === 'propertyNames');
      const additionalProperties = rcd[1].find(entry => entry[0] === 'additionalProperties');
      if (!propertyNames || !additionalProperties) return undefined;
      return initDna(DnaMap, {
        keySchema: build(propertyNames[1]),
        valueSchema: build(additionalProperties[1]),
        min, max, size,
      }, seqNode[2]);
    }

    if (ctor === 'Set') {
      const arr = steps.find(n => n[0] === 'a');
      if (!arr) return undefined;
      const itemEntry = arr[1].find(entry => entry[0] === 'items');
      if (!itemEntry) return undefined;
      return initDna(DnaSet, {
        itemSchema: build(itemEntry[1]),
        min, max, size,
      }, seqNode[2]);
    }

    return undefined;
  }

  const lazyByTarget = new Map<number, c.DnaTypeWithWrappers<any, any>>();

  function build(id: number): c.DnaTypeWithWrappers<any, any> {
    if (cache.has(id)) return cache.get(id)!;
    const node = dnaList[id];
    if (node[0] === 'ref') {
      const targetId = node[1];
      if (dnaList[targetId][0] === 'ref') {
        return build(targetId);
      }
      const existing = lazyByTarget.get(targetId);
      if (existing) {
        cache.set(id, existing);
        return existing;
      }
      let inner;
      const inst = initDna(c.DnaLazy, { getter: () => inner }, node[2]);
      lazyByTarget.set(targetId, inst);
      cache.set(id, inst);
      inner = build(targetId);
      return inst;
    }
    if (node[0] === 'seq') {
      const maybe = extractMapSet(node);
      if (maybe) {
        cache.set(id, maybe);
        return maybe;
      }
    }
    const inst = buildNode(node, build, dnaList);
    cache.set(id, inst);
    return inst;
  }

  return build(0);
}
