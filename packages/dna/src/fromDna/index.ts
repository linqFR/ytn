import { initDna } from '../builder/dna-core.js';
import * as c from '../builder/dna-interfaces.js';
import { DnaMap, DnaSet } from '../builder/api-enhanced.js';
import { getRegisteredExternals } from '../toJs/registry.js';
import type { tsDnaMeta } from '../shared/meta-context.type.js';
import type { tsDna, tsDnaSeq } from '../types/core.types.js';
import type { tsPrimitiveClass } from '../shared/base.types.js';

function isMeta(v: unknown): v is tsDnaMeta {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function getMeta(node: tsDna): tsDnaMeta | undefined {
  const last = node[node.length - 1];
  return isMeta(last) ? (last as tsDnaMeta) : undefined;
}

function getParams(node: tsDna): unknown {
  if (node.length === 2 && isMeta(node[1])) return undefined;
  return node[1];
}

function reconstructFunc(fnStr: string, arity: number): (...args: unknown[]) => void {
  const args: string[] =
    arity <= 0 ? [] :
    arity === 1 ? ['ctx'] :
    arity === 2 ? ['value', 'ctx'] :
    Array.from({ length: arity }, (_, i) => `_${i}`);
  const fn = new Function(...args, '') as (...args: unknown[]) => unknown;
  Object.defineProperty(fn, 'toString', { value: () => fnStr, writable: true, configurable: true });
  return fn as unknown as (...args: unknown[]) => void;
}

function regexFromString(s: string | null): RegExp | null {
  if (!s) return null;
  const match = s.match(/^\/(.*)\/([a-z]*)$/);
  return match ? new RegExp(match[1], match[2]) : new RegExp(s);
}

function buildNode(node: tsDna, build: (id: number) => c.DnaTypeWithWrappers<any, any>, dnaList: tsDna[], id?: number, cache?: Map<number, c.DnaTypeWithWrappers<any, any>>): c.DnaTypeWithWrappers<any, any> {
  const opcode = node[0];
  const params = getParams(node);
  const meta = getMeta(node);

  switch (opcode) {
    case 's': {
      const [min, max, pattern, format] = params as [number | null, number | null, any, any];
      return initDna(c.DnaString, { min, max, pattern, format }, meta);
    }

    case 'sb': {
      const [truthy, falsy, caseSensitive] = params as [string[], string[], boolean];
      return initDna(c.DnaStringBool, { truthy, falsy, case: caseSensitive ? 'sensitive' : 'insensitive' }, meta);
    }

    case 'n': {
      const [min, exclMin, max, exclMax, multOf] = params as [number | null, boolean, number | null, boolean, number | null];
      return initDna(c.DnaNumber, { min, max, exclMin, exclMax, multOf }, meta);
    }

    case 'i': {
      const [min, exclMin, max, exclMax, multOf] = params as [number | null, boolean, number | null, boolean, number | null];
      return initDna(c.DnaInt, { min, max, exclMin, exclMax, multOf }, meta);
    }

    case 'bi': {
      const [min, exclMin, max, exclMax, multOf] = params as [bigint | null, boolean, bigint | null, boolean, bigint | null];
      return initDna(c.DnaBigInt, { min, max, exclMin, exclMax, multOf }, meta);
    }

    case 'b':
      return initDna(c.DnaBoolean, undefined, meta);

    case 'cidrv6':
      return initDna(c.DnaCidrv6, undefined, meta);

    case 'l': {
      const values = params as unknown[];
      const value = values.length === 1 ? values[0] : values;
      return initDna(c.DnaLiteral, { value }, meta);
    }

    case 'e': {
      const values = params as unknown[];
      const enumObj = Object.fromEntries((values as unknown[]).map((v, i) => [String(i), v]));
      return initDna(c.DnaEnum, { enumObj }, meta);
    }

    case 'n0':
      return initDna(c.DnaNull, undefined, meta);

    case 'undefined':
      return initDna(c.DnaUndefined, undefined, meta);

    case 'T':
      return initDna(c.DnaAny, undefined, meta);

    case 'F':
      // DnaNever is not structurally assignable to DnaTypeWithWrappers<any, any>
      // because of invariant transform/and/readonly signatures; up-cast via unknown.
      return initDna(c.DnaNever, undefined, meta) as unknown as c.DnaTypeWithWrappers<any, any>;

    case 'nan':
      return initDna(c.DnaNaN, undefined, meta);

    case 'symbol':
      return initDna(c.DnaSymbol, undefined, meta);

    case 'date': {
      const [min, max] = params as [Date | null, Date | null];
      return initDna(c.DnaDate, { min, max }, meta);
    }

    case 'wrp': {
      const [wrptype, innerId, , value] = params as [string, number, string, any];
      const inner = build(innerId);
      let wrapped: c.DnaTypeWithWrappers<any, any>;
      switch (wrptype) {
        case 'optional': wrapped = inner.optional(); break;
        case 'nullable': wrapped = inner.nullable(); break;
        case 'nullish': wrapped = inner.nullish(); break;
        case 'nonoptional': wrapped = inner.nonoptional(); break;
        case 'exactOptional': wrapped = inner.exactOptional(); break;
        case 'catch': wrapped = inner.catch(value); break;
        case 'default': wrapped = inner.default(value); break;
        case 'prefault': wrapped = inner.prefault(value); break;
        default:
          throw new Error(`fromDna: wrp type not implemented: ${wrptype}`);
      }
      if (meta) {
        const cleanMeta = { ...meta as any };
        // passDefault is a runtime marker emitted by DnaOptional._emitSelf; it
        // should not be persisted as schema meta because it pollutes object propMeta.
        delete cleanMeta.passDefault;
        if (Object.keys(cleanMeta).length) wrapped = wrapped.meta(cleanMeta);
      }
      return wrapped;
    }

    case 'o':
    case '_o': {
      const constraints = params as [string, ...unknown[]][];
      const propertySchemas: Record<string, c.DnaTypeWithWrappers<any, any>> = {};
      let addPropSchema: c.DnaTypeWithWrappers<any, any> | boolean | undefined;
      let objType: 'strict' | 'loose' | 'standard' | 'object' = 'standard';
      let requiredKeys: string[] | undefined;
      // `keepOnly` is set for standard objects that should output only the
      // declared property names (and omit undefined optional values).
      let hasKeepOnly = false;

      for (const [name, value] of constraints) {
        if (name === 'properties' || name === 'defaultProperties') {
          for (const [key, childId] of (value as [string, number, tsDnaMeta][])) {
            propertySchemas[key] = build(childId);
          }
        } else if (name === 'required') {
          requiredKeys = value as string[];
        } else if (name === 'keepOnly') {
          hasKeepOnly = true;
        } else if (name === 'additionalProperties') {
          if (value === false) objType = 'strict';
          else if (value === true) objType = 'loose';
          else { objType = 'standard'; addPropSchema = build(value as number); }
        }
      }

      if (hasKeepOnly && addPropSchema === undefined && objType !== 'strict' && objType !== 'loose') objType = 'standard';

      const inst = cache?.has(id!) ? cache.get(id!)! : initDna(c.DnaObject, {}, meta);
      inst._state.propertySchemas = propertySchemas;
      inst._state.objType = objType;
      if (addPropSchema !== undefined) inst._state.addPropSchema = addPropSchema;
      inst._state.declared = (opcode !== '_o');
      inst._state.requiredKeys = (opcode !== '_o') ? (requiredKeys ?? []) : requiredKeys;
      return inst;
    }

    case 'coerce': {
      const [coerceCode, innerId] = params as [string, number];
      const inner = build(innerId);
      switch (coerceCode) {
        case 'toString': return initDna(c.DnaCoerceString, inner._state, meta);
        case 'toNumber': return initDna(c.DnaCoerceNumber, inner._state, meta);
        case 'toInt': return initDna(c.DnaCoerceInt, inner._state, meta);
        case 'toBigInt': return initDna(c.DnaCoerceBigInt, inner._state, meta);
        case 'toBoolean': return initDna(c.DnaCoerceBoolean, undefined, meta);
        case 'toDate': return initDna(c.DnaCoerceDate, inner._state, meta);
        default: throw new Error(`fromDna: coerce code not implemented: ${coerceCode}`);
      }
    }

    case 'a': {
      const constraints = params as [string, ...unknown[]][];
      const prefixEntry = constraints.find(([name]) => name === 'prefixItems');
      if (prefixEntry) {
        const prefixIds = prefixEntry[1] as number[];
        const itemsEntry = constraints.find(([name]) => name === 'items');
        if (!itemsEntry) throw new Error('fromDna: tuple missing items');
        const restId = itemsEntry[1] as number | false;
        const items = prefixIds.map(build);
        const rest = restId === false ? undefined : build(restId);
        return initDna(c.DnaTuple, { items, rest }, meta);
      }
      const itemEntry = constraints.find(([name]) => name === 'items');
      if (!itemEntry) throw new Error('fromDna: array missing items');
      const minEntry = constraints.find(([name]) => name === 'minItems');
      const maxEntry = constraints.find(([name]) => name === 'maxItems');
      return initDna(c.DnaArray, {
        itemSchema: build(itemEntry[1] as number),
        min: minEntry ? (minEntry[1] as number) : null,
        max: maxEntry ? (maxEntry[1] as number) : null,
        length: null,
      }, meta);
    }

    case 'anyOf': {
      const [, ...ids] = params as [string, ...number[]];
      const schemas = ids.map(build);
      return initDna(c.DnaUnion, { schemas, combinatorType: 'anyOf' }, meta);
    }

    case 'allOf': {
      const [, ...ids] = params as [string, ...number[]];
      const schemas = ids.map(build);
      return initDna(c.DnaIntersection, { schemas, combinatorType: 'allOf' }, meta);
    }

    case 'oneOf': {
      const [, ...ids] = params as [string, ...number[]];
      const schemas = ids.map(build);
      return initDna(c.DnaXorUnion, { schemas, combinatorType: 'oneOf' }, meta);
    }

    case 'rcd': {
      const constraints = params as [string, ...unknown[]][];
      const patternProperties = constraints.find(([name]) => name === 'patternProperties');
      if (patternProperties) {
        const [pattern, valueId] = (patternProperties[1] as [string, number][])[0];
        const valueSchema = build(valueId);
        const keySchema = initDna(c.DnaString, { pattern: new RegExp(pattern, 'u') }, meta);
        return initDna(c.DnaRecord, { keySchema, valueSchema, type: 'loose' }, meta);
      }
      const propertyNames = constraints.find(([name]) => name === 'propertyNames');
      const additionalProperties = constraints.find(([name]) => name === 'additionalProperties');
      const required = constraints.find(([name]) => name === 'required');
      if (!propertyNames || !additionalProperties) {
        throw new Error('fromDna: rcd missing propertyNames/additionalProperties');
      }
      const keySchema = build(propertyNames[1] as number);
      const valueSchema = build(additionalProperties[1] as number);
      const isFiniteKeys = propertyNames[2] === 'string';
      const type = (required || !isFiniteKeys) ? 'standard' : 'partial';
      return initDna(c.DnaRecord, { keySchema, valueSchema, type }, meta);
    }

    case 'jwt':
      return initDna(c.DnaJwt, { alg: params as string | null }, meta);

    case 'promise': {
      const innerId = params as number;
      return initDna(c.DnaPromise, { inner: build(innerId) }, meta);
    }

    case 'discriminator': {
      const discriminDef = node[3] as number[];
      const schemas = discriminDef.slice(1).map(build) as unknown as c.DnaObject[];
      return initDna(c.DnaDiscriminatedUnion, { discriminator: params as string, schemas }, meta);
    }

    case 'chkSeq': {
      const ids = params as number[];
      const [innerId, ...checkIds] = ids;
      let inner = build(innerId);
      for (const checkId of checkIds) {
        const checkNode = dnaList[checkId];
        const stepParams = checkNode[1] as unknown[];
        const stepMeta = getMeta(checkNode);
        const stepOp = checkNode[0] as string;
        if (stepOp === 'sb') {
          inner = build(checkId);
          continue;
        }
        const kind = stepParams[0] as string;
        const stepItemMeta = stepOp === 's' ? stepParams[2] as tsDnaMeta | undefined : stepMeta;
        if (kind === 'property') {
          const key = stepParams[1] as string | number;
          const schema = build(stepParams[2] as number);
          const prop = initDna(c.DnaCheckProperty, { property: key, schema }, stepMeta);
          inner = inner.check(prop);
        } else if (kind === 'func') {
          const fnStr = stepParams[1] as string;
          const arity = stepParams[2] as number;
          inner = inner.check(reconstructFunc(fnStr, arity) as unknown as (ctx: unknown) => void);
          if (stepMeta) inner = inner.meta(stepMeta);
        } else if (inner instanceof c.DnaString) {
          const str = inner;
          switch (kind) {
            case 'trim': inner = str.trim(); break;
            case 'toLowerCase': inner = str.toLowerCase(); break;
            case 'toUpperCase': inner = str.toUpperCase(); break;
            case 'normalize': inner = str.normalize(); break;
            case 'uppercase': inner = str.uppercase(stepItemMeta); break;
            case 'lowercase': inner = str.lowercase(stepItemMeta); break;
            case 'startsWith': inner = str.startsWith(JSON.parse(stepParams[1] as string), stepItemMeta); break;
            case 'endsWith': inner = str.endsWith(JSON.parse(stepParams[1] as string), stepItemMeta); break;
            case 'includes': {
              const inc = JSON.parse(stepParams[1] as string) as string;
              const position = stepParams[2] as number | undefined;
              if (position !== undefined) {
                inner = str.includes(inc, stepItemMeta ? { ...stepItemMeta, position } : { position });
              } else {
                inner = stepItemMeta ? str.includes(inc, stepItemMeta) : str.includes(inc);
              }
              break;
            }
            case 'min': inner = str.min(stepParams[1] as number, stepItemMeta); break;
            case 'max': inner = str.max(stepParams[1] as number, stepItemMeta); break;
            case 'length': inner = str.length(stepParams[1] as number, stepItemMeta); break;
            case 'pattern': inner = str.pattern(new RegExp(stepParams[1] as string, 'u'), stepItemMeta); break;
            case 'format': inner = str.format(stepParams[1] as string, stepItemMeta); break;
            default:
              throw new Error(`fromDna: refine check kind not implemented: ${kind}`);
          }
        } else {
          throw new Error(`fromDna: refine check kind not implemented: ${kind}`);
        }
      }
      return inner;
    }

    case 'chkList': {
      const ids = params as number[];
      let inner = build(ids[0]);
      for (let i = 1; i < ids.length; i++) {
        inner = inner.and(build(ids[i]));
      }
      return inner;
    }

    case 'transform': {
      const [fnStr, arity] = params as [string, number];
      return initDna(c.DnaTransform, { fnStr, arity }, meta);
    }

    case 'url': {
      const [protocolSerialized, hostnameSerialized, normalize] = (params as [string | null, string | null, boolean]);
      return initDna(c.DnaUrl, { protocol: regexFromString(protocolSerialized), hostname: regexFromString(hostnameSerialized), normalize: normalize ?? false }, meta);
    }

    case 'instanceOf': {
      const constructorName = params as string;
      const constructor = getRegisteredExternals()[constructorName] as tsPrimitiveClass;
      if (!constructor) throw new Error(`fromDna: external constructor not registered: ${constructorName}`);
      return initDna(c.DnaInstanceOf, { constructor }, meta);
    }

    default:
      throw new Error(`fromDna: opcode not implemented: ${opcode}`);
  }
}

export function fromDna(seq: tsDnaSeq): c.DnaType<any, any> {
  const refListRaw = seq[seq.length - 1];
  const dnaList = (Array.isArray(refListRaw) ? seq.slice(0, -1) : seq) as tsDna[];
  const cache = new Map<number, c.DnaTypeWithWrappers<any, any>>();

  function extractMapSet(seqNode: tsDna): c.DnaTypeWithWrappers<any, any> | undefined {
    const stepIds = getParams(seqNode) as number[];
    const steps: tsDna[] = [];
    function add(id: number) {
      const n = dnaList[id];
      if (n[0] === 'pipe') {
        const children = getParams(n) as number[];
        for (const child of children) add(child);
      } else {
        steps.push(n);
      }
    }
    for (const child of stepIds) add(child);

    const instance = steps.find(n => n[0] === 'instanceOf' || n[0] === 'chkSeq');
    if (!instance) return undefined;
    let ctor: string;
    let chk: tsDna | undefined;
    if (instance[0] === 'chkSeq') {
      const ids = instance[1] as number[];
      const instanceOfNode = dnaList[ids[0]];
      if (instanceOfNode[0] !== 'instanceOf') return undefined;
      ctor = instanceOfNode[1] as string;
      chk = instance;
    } else {
      ctor = instance[1] as string;
      chk = steps.find(n => n[0] === 'chkSeq');
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
          const numMin = num._state.min as number | null;
          const numMax = num._state.max as number | null;
          if (numMin === numMax && numMin !== null) size = numMin;
          else { min = numMin; max = numMax; }
        }
      }
    }

    const instanceMeta = instance ? getMeta(instance) : getMeta(seqNode);

    if (ctor === 'Map') {
      const rcd = steps.find(n => n[0] === 'rcd');
      if (!rcd) return undefined;
      const rcdParams = getParams(rcd) as [string, ...unknown[]][];
      const propertyNames = rcdParams.find(([name]) => name === 'propertyNames');
      const additionalProperties = rcdParams.find(([name]) => name === 'additionalProperties');
      if (!propertyNames || !additionalProperties) return undefined;
      return initDna(DnaMap, {
        keySchema: build(propertyNames[1] as number),
        valueSchema: build(additionalProperties[1] as number),
        min, max, size,
      }, instanceMeta);
    }

    if (ctor === 'Set') {
      const arr = steps.find(n => n[0] === 'a');
      if (!arr) return undefined;
      const arrParams = getParams(arr) as [string, ...unknown[]][];
      const itemEntry = arrParams.find(([name]) => name === 'items');
      if (!itemEntry) return undefined;
      return initDna(DnaSet, {
        itemSchema: build(itemEntry[1] as number),
        min, max, size,
      }, instanceMeta);
    }

    return undefined;
  }

  const lazyByTarget = new Map<number, c.DnaTypeWithWrappers<any, any>>();

  function build(id: number): c.DnaTypeWithWrappers<any, any> {
    if (cache.has(id)) return cache.get(id)!;
    const node = dnaList[id];
    const meta = getMeta(node);
    if (node[0] === 'ref') {
      const targetId = node[1] as number;
      // If the target is itself a ref/lazy node, share its reconstructed DnaLazy.
      if (dnaList[targetId]?.[0] === 'ref') {
        const target = build(targetId);
        cache.set(id, target);
        return target;
      }
      const existing = lazyByTarget.get(targetId);
      if (existing) {
        cache.set(id, existing);
        return existing;
      }
      if (cache.has(targetId)) {
        const target = cache.get(targetId)!;
        cache.set(id, target);
        return target;
      }
      const inst = initDna(c.DnaLazy, { getter: () => cache.has(targetId) ? cache.get(targetId)! : build(targetId) }, meta);
      lazyByTarget.set(targetId, inst);
      cache.set(id, inst);
      return inst;
    }
    if (node[0] === 'pipe') {
      const maybe = extractMapSet(node);
      if (maybe) {
        cache.set(id, maybe);
        return maybe;
      }
      const inst = initDna(c.DnaPipe, {}, meta);
      cache.set(id, inst);
      const stepIds = getParams(node) as number[];
      inst._state.steps = stepIds.map(stepId => build(stepId));
      return inst;
    }
    if (node[0] === 'o' || node[0] === '_o' || node[0] === 'rcd') {
      const skeleton = initDna(c.DnaObject, {}, meta);
      cache.set(id, skeleton);
      const inst = buildNode(node, build, dnaList, id, cache);
      return inst;
    }
    const inst = buildNode(node, build, dnaList, id, cache);
    cache.set(id, inst);
    return inst;
  }

  return build(0);
}
