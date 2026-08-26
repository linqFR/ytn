import * as c from '@ytrynot/dna/core';
import { getRegisteredExternals, initDna } from '@ytrynot/dna/core';
import { CLI_MODE, CONSTRUCTOR_PRIORITY, type tsMarangetMode } from '../algo/maranget.js';
import { DnaMap, DnaSet } from '../builder/api-enhanced.js';
import type { IDnaCollector, tsStoreMark, tsStorePosition } from '../builder/collector.types.js';
import type { tsPrimitiveClass, tsPrimitiveLiteral } from '../shared/base.types.js';
import type { tsDnaMeta } from '../shared/meta-context.type.js';
import type { tsDna, tsDnaId, tsDnaOpcode, tsDnaSeq } from '../types/core.types.js';

function isMeta(v: unknown): v is tsDnaMeta {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function getMeta(node: tsDna): tsDnaMeta | undefined {
  const last = node[node.length - 1];
  return isMeta(last) ? last : undefined;
}

function getParams(node: tsDna): unknown {
  if (node.length === 2 && isMeta(node[1])) return undefined;
  return node[1];
}

/**
 * Maps each DNA opcode to the static type of its `params` field (node[1]).
 * `tsDna` uses `...any[]` for the middle elements, so `node[1]` is `any` and
 * TS cannot infer the opcode-specific shape from a runtime string. This type
 * provides the compile-time mapping that the runtime `switch (opcode)` enforces.
 */
type tsDnaParamsFor<O extends tsDnaOpcode> =
  O extends 's' | '_s' ? [number | null, number | null, string | null, string | null]
  : O extends 'sb' ? [string[], string[], boolean]
  : O extends 'n' | '_n' | 'i' ? [number | null, boolean, number | null, boolean, number | null]
  : O extends 'bi' ? [bigint | null, boolean, bigint | null, boolean, bigint | null]
  : O extends 'date' ? [Date | null, Date | null]
  : O extends 'wrp' ? [string, number, string, unknown]
  : O extends 'o' | '_o' | 'a' | '_a' | 'rcd' ? [string, ...unknown[]][]
  : O extends 'anyOf' | 'allOf' | 'oneOf' ? [string, ...number[]]
  : O extends 'jwt' ? string | null
  : O extends 'promise' ? number
  : O extends 'discriminator' ? string
  : O extends 'not' ? [number, string]
  : O extends 'ifThenElse' ? [number, number, number]
  : O extends 'chkSeq' | 'chkList' ? number[]
  : O extends 'transform' ? [string, number]
  : O extends 'url' ? [string | null, string | null, boolean]
  : O extends 'instanceOf' ? string
  : O extends 'coerce' ? [string, number]
  : O extends 'e' | 'eD' ? unknown[]
  : O extends 'c' | 'cD' | 'l' ? unknown
  : unknown;

/**
 * Typed params extraction: returns `tsDnaParamsFor<O>` for the given opcode.
 * The cast is centralized here (node[1] is `any` from `tsDna`'s `...any[]`);
 * all call sites in `buildNode` receive a properly typed value.
 */
function paramsFor<O extends tsDnaOpcode>(opcode: O, node: tsDna): tsDnaParamsFor<O> {
  if (node.length === 2 && isMeta(node[1])) return undefined as tsDnaParamsFor<O>;
  // CAST: node[1] is `any` from tsDna's `...any[]` spread; the opcode→params mapping is enforced by the runtime switch but TS cannot verify it
  return node[1] as tsDnaParamsFor<O>;
}

function reconstructFunc(fnStr: string, arity: number): (...args: unknown[]) => void {
  const args: string[] =
    arity <= 0 ? [] :
    arity === 1 ? ['ctx'] :
    arity === 2 ? ['value', 'ctx'] :
    Array.from({ length: arity }, (_, i) => `_${i}`);
  // CAST: new Function returns Function; the concrete callable signature cannot be inferred
  const fn = new Function(...args, '') as (...args: unknown[]) => unknown;
  Object.defineProperty(fn, 'toString', { value: () => fnStr, writable: true, configurable: true });
  // CAST: the callable returns unknown but refine callbacks expect (...args) => void; TS cannot unify the return types
  return fn as unknown as (...args: unknown[]) => void;
}

function regexFromString(s: string | null): RegExp | null {
  if (!s) return null;
  const match = s.match(/^\/(.*)\/([a-z]*)$/);
  return match ? new RegExp(match[1], match[2]) : new RegExp(s);
}

/**
 * Internal subclass for fromDna reconstruction of `template` opcodes.
 * Overrides `_emitSelf` to inject the pre-computed `passiveParts` and child
 * schema IDs directly, bypassing the normal part→regex transformation (which
 * is irreversible: literals and regex fragments are indistinguishable after
 * the original serialization).
 */
class DnaTemplateReconstructed extends c.DnaTmplLiteralMutate<any> {
  declare _reconstructedPassiveParts: tsPrimitiveLiteral[];
  declare _reconstructedSchemaParts: c.DnaType<any>[];
  declare _reconstructedCanMutate: boolean;

  override get canMutate() { return this._reconstructedCanMutate; }
  override get type() { return this._reconstructedCanMutate ? "templateLiteralMutate" : "templateLiteral"; }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const partIds = new Array<number>(this._reconstructedSchemaParts.length);
    const storeId = coll.setStore(partIds);
    this._core.rawDna = ["template", this._reconstructedPassiveParts, partIds, this.canMutate];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, storeId);
    this._core.setDnaId(coll, dnaId);
    for (let i = this._reconstructedSchemaParts.length; i--;) {
      this._reconstructedSchemaParts[i].toDna(coll, storeId, i);
    }
    return dnaId;
  }
}

function buildNode(node: tsDna, build: (id: number) => c.DnaTypeWithWrappers<any, any>, dnaList: tsDna[], id?: number, cache?: Map<number, c.DnaTypeWithWrappers<any, any>>) {
  const opcode = node[0];
  const meta = getMeta(node);

  switch (opcode) {
    case '_s':
    case 's': {
      const [min, max, pattern, format] = paramsFor(opcode, node);
      return initDna(c.DnaString, { min, max, pattern, format }, meta);
    }

    case 'sb': {
      const [truthy, falsy, caseSensitive] = paramsFor(opcode, node);
      return initDna(c.DnaStringBool, { truthy, falsy, case: caseSensitive ? 'sensitive' : 'insensitive' }, meta);
    }

    case '_n':
    case 'n': {
      const [min, exclMin, max, exclMax, multOf] = paramsFor(opcode, node);
      return initDna(c.DnaNumber, { min, max, exclMin, exclMax, multOf }, meta);
    }

    case 'i': {
      const [min, exclMin, max, exclMax, multOf] = paramsFor(opcode, node);
      return initDna(c.DnaInt, { min, max, exclMin, exclMax, multOf }, meta);
    }

    case 'bi': {
      const [min, exclMin, max, exclMax, multOf] = paramsFor(opcode, node);
      return initDna(c.DnaBigInt, { min, max, exclMin, exclMax, multOf }, meta);
    }

    case 'b':
      return initDna(c.DnaBoolean, undefined, meta);

    case 'cidrv6':
      return initDna(c.DnaCidrv6, undefined, meta);

    case 'c':
    case 'cD':
    case 'l': {
      // `l`: params is already an array of values.
      // `c`/`cD`: params is a single value — wrap to match `l` format.
      // DnaLiteral._rawValues normalizes the array for emission.
      const params = paramsFor(opcode, node);
      const values = Array.isArray(params) ? params : [params];
      return initDna(c.DnaLiteral, { value: values }, meta);
    }

    case 'eD':
    case 'e': {
      const params = paramsFor(opcode, node);
      const enumObj = Object.fromEntries(params.map((v, i) => [String(i), v]));
      return initDna(c.DnaEnum, { enumObj }, meta);
    }

    case 'n0':
      return initDna(c.DnaNull, undefined, meta);

    case 'undefined':
      return initDna(c.DnaUndefined, undefined, meta);

    case 'T':
      return initDna(c.DnaAny, undefined, meta);

    case 'F':
      // CAST: DnaNever has invariant transform/and/readonly method signatures that
      // prevent structural assignment to DnaTypeWithWrappers<any,any>; TS cannot verify the subtype
      return initDna(c.DnaNever, undefined, meta) as unknown as c.DnaTypeWithWrappers<any, any>;

    case 'nan':
      return initDna(c.DnaNaN, undefined, meta);

    case 'symbol':
      return initDna(c.DnaSymbol, undefined, meta);

    case 'date': {
      const [min, max] = paramsFor(opcode, node);
      return initDna(c.DnaDate, { min, max }, meta);
    }

    case 'wrp': {
      const [wrptype, innerId, , value] = paramsFor(opcode, node);
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
        const cleanMeta = { ...meta };
        // passDefault is a runtime marker emitted by DnaOptional._emitSelf; it
        // should not be persisted as schema meta because it pollutes object propMeta.
        delete cleanMeta.passDefault;
        // Use _core.rawMeta directly (mutate in place) instead of wrapped.meta()
        // which clones the wrapper AND its inner — breaking object identity for
        // recursive types (cycle detection in the collector keys on this._core).
        // `wrapped` is freshly created above, so mutating it is safe.
        if (Object.keys(cleanMeta).length) wrapped._core.rawMeta(cleanMeta);
      }
      return wrapped;
    }

    case 'o':
    case '_o': {
      const constraints = paramsFor(opcode, node);
      const propertySchemas: Record<string, c.DnaTypeWithWrappers<any, any>> = {};
      let addPropSchema: c.DnaTypeWithWrappers<any, any> | boolean | undefined;
      let objType: 'strict' | 'loose' | 'standard' | 'object' = 'standard';
      let requiredKeys: string[] | undefined;
      // `keepOnly` is set for standard objects that should output only the
      // declared property names (and omit undefined optional values).
      let hasKeepOnly = false;

      for (const [name, value] of constraints) {
        if (name === 'properties' || name === 'defaultProperties') {
          // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
          for (const [key, childId] of (value as [string, number, tsDnaMeta][])) {
            propertySchemas[key] = build(childId);
          }
        } else if (name === 'required') {
          // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
          requiredKeys = value as string[];
        } else if (name === 'keepOnly') {
          hasKeepOnly = true;
        } else if (name === 'additionalProperties') {
          if (value === false) objType = 'strict';
          else if (value === true) objType = 'loose';
          else {
            objType = 'standard';
            // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
            addPropSchema = build(value as number);
          }
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
      const [coerceCode, innerId] = paramsFor(opcode, node);
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

    case '_a':
    case 'a': {
      const constraints = paramsFor(opcode, node);
      const prefixEntry = constraints.find(([name]) => name === 'prefixItems');
      if (prefixEntry) {
        // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
        const prefixIds = prefixEntry[1] as number[];
        const itemsEntry = constraints.find(([name]) => name === 'items');
        if (!itemsEntry) throw new Error('fromDna: tuple missing items');
        // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
        const restId = itemsEntry[1] as number | false;
        const items = prefixIds.map(build);
        const rest = restId === false ? undefined : build(restId);
        const minEntry = constraints.find(([name]) => name === 'minItems');
        const maxEntry = constraints.find(([name]) => name === 'maxItems');
        const prefixLen = prefixIds.length;
        // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
        const minVal = minEntry ? (minEntry[1] as number) : null;
        const maxVal = maxEntry ? (maxEntry[1] as number) : null;
        // Distinguish user-specified .length() from .min()/.max()
        // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
        const isLength = minEntry && maxEntry && (minEntry[1] as number) === (maxEntry[1] as number);
        return initDna(c.DnaTuple, {
          items,
          rest,
          min: isLength ? null : (minVal !== null && minVal > prefixLen ? minVal : null),
          max: isLength ? null : maxVal,
          length: isLength ? minVal : null,
        }, meta);
      }
      const itemEntry = constraints.find(([name]) => name === 'items');
      // `_a` (undeclared array) may have no items constraint — accept any items.
      if (!itemEntry) {
        if (opcode === '_a') {
          const minEntry = constraints.find(([name]) => name === 'minItems');
          const maxEntry = constraints.find(([name]) => name === 'maxItems');
          return initDna(c.DnaArray, {
            itemSchema: initDna(c.DnaAny, undefined, undefined),
            // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
            min: minEntry ? (minEntry[1] as number) : null,
            // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
            max: maxEntry ? (maxEntry[1] as number) : null,
            length: null,
          }, meta);
        }
        throw new Error('fromDna: array missing items');
      }
      const minEntry = constraints.find(([name]) => name === 'minItems');
      const maxEntry = constraints.find(([name]) => name === 'maxItems');
      return initDna(c.DnaArray, {
        // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
        itemSchema: build(itemEntry[1] as number),
        // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
        min: minEntry ? (minEntry[1] as number) : null,
        // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
        max: maxEntry ? (maxEntry[1] as number) : null,
        length: null,
      }, meta);
    }

    case 'anyOf': {
      const [, ...ids] = paramsFor(opcode, node);
      const schemas = ids.map(build);
      return initDna(c.DnaUnion, { schemas, combinatorType: 'anyOf' }, meta);
    }

    case 'allOf': {
      const [, ...ids] = paramsFor(opcode, node);
      const schemas = ids.map(build);
      return initDna(c.DnaIntersection, { schemas, combinatorType: 'allOf' }, meta);
    }

    case 'oneOf': {
      const [, ...ids] = paramsFor(opcode, node);
      const schemas = ids.map(build);
      return initDna(c.DnaXorUnion, { schemas, combinatorType: 'oneOf' }, meta);
    }

    case 'rcd': {
      const constraints = paramsFor(opcode, node);
      const patternProperties = constraints.find(([name]) => name === 'patternProperties');
      if (patternProperties) {
        // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
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
      // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
      const keySchema = build(propertyNames[1] as number);
      // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
      const valueSchema = build(additionalProperties[1] as number);
      const isFiniteKeys = propertyNames[2] === 'string';
      const type = (required || !isFiniteKeys) ? 'standard' : 'partial';
      return initDna(c.DnaRecord, { keySchema, valueSchema, type }, meta);
    }

    case 'jwt':
      return initDna(c.DnaJwt, { alg: paramsFor(opcode, node) }, meta);

    case 'promise': {
      const innerId = paramsFor(opcode, node);
      return initDna(c.DnaPromise, { inner: build(innerId) }, meta);
    }

    case 'discriminator': {
      const discriminatorName = paramsFor(opcode, node);
      // CAST: tsDna uses `...any[]` for middle elements; node[2] is `any` and the cast annotates the discriminKeys type for this opcode
      const discriminKeys = node[2] as (tsPrimitiveLiteral | tsPrimitiveLiteral[])[];
      // CAST: tsDna uses `...any[]` for middle elements; node[3] is `any` and the cast annotates the branchDef type for this opcode
      const discriminDef = node[3] as number[];
      const schemas = discriminDef.slice(1).map((refId, i) => {
        // CAST: build returns DnaTypeWithWrappers<any,any>; TS cannot infer the concrete DnaObject subclass from a runtime child id
        const built = build(refId) as unknown as c.DnaObject;
        // Clone the branch: multiple branches may share the same DNA index
        // (identical except for the discriminant), so without cloning we'd
        // mutate the same cached instance repeatedly.
        // CAST: cloner is typed as returning DnaType<any,any>; the clone preserves the specific subtype but TS cannot track this
        const branch = c.cloner(built, () => {}) as unknown as c.DnaObject;
        // Reconstruct the discriminator schema from discriminKeys.
        // discriminKeys[i] is either a primitive (single const) or an array (enum/multi-literal).
        const rawKey = discriminKeys[i];
        const values: tsPrimitiveLiteral[] = Array.isArray(rawKey) ? rawKey : [rawKey];
        const hasUndefined = values.includes(undefined);
        const hasNull = values.includes(null);
        const rest = values.filter(v => v !== undefined && v !== null);
        let discSchema: c.DnaTypeWithWrappers<any, any>;
        if (rest.length === 1) {
          discSchema = initDna(c.DnaLiteral, { value: rest[0] });
        } else if (rest.length > 1) {
          const enumObj: Record<string, tsPrimitiveLiteral> = {};
          for (const v of rest) enumObj[String(v)] = v;
          discSchema = initDna(c.DnaEnum, { enumObj });
        } else {
          // Only null and/or undefined — use DnaNull / DnaUndefined
          if (hasNull && !hasUndefined) discSchema = initDna(c.DnaNull);
          else if (hasUndefined && !hasNull) discSchema = initDna(c.DnaUndefined);
          else discSchema = initDna(c.DnaNull).nullable();
        }
        if (hasNull && rest.length > 0) discSchema = discSchema.nullable();
        if (hasUndefined && rest.length > 0) discSchema = discSchema.optional();
        // Reinject the discriminator into the branch shape
        const originalShape = branch._core.seed.propertySchemas ?? {};
        const newShape = { ...originalShape, [discriminatorName]: discSchema };
        branch._core.seed.propertySchemas = newShape;
        return branch;
      });
      return initDna(c.DnaDiscriminatedUnion, { discriminator: discriminatorName, schemas }, meta);
    }

    case 'not': {
      // DNA format: ["not", [innerId, jsonStr], meta]
      const [innerId] = paramsFor(opcode, node);
      return initDna(c.DnaNot, { inner: build(innerId) }, meta);
    }

    case 'ifThenElse': {
      // DNA format: ["ifThenElse", [ifId, thenId, elseId], meta]
      // -1 means absent (no then/else branch).
      const [ifId, thenId, elseId] = paramsFor(opcode, node);
      return initDna(c.DnaIfThenElse, {
        ifSchema: build(ifId),
        thenSchema: thenId >= 0 ? build(thenId) : undefined,
        elseSchema: elseId >= 0 ? build(elseId) : undefined,
      }, meta);
    }

    case 'maranget': {
      // DNA format: ["maranget", discAdn, discriminKeys, branchDef, mode, meta]
      // discAdn = required columns (strings) + optional columns (final sub-array)
      // branchDef = [prevalidationId, branch0Id, branch1Id, ...]
      // prevalidation is an internal object schema (type/required check) —
      // not part of the public schema, so we skip it and reconstruct only
      // the branch schemas. positionals are DERIVED by the class
      // (detectPositionals on the branch schemas + discriminator order) —
      // they are never stored in the seed nor the ADN (single source of
      // truth = the Maranget input).
      // CAST: tsDna uses `...any[]` for middle elements; node[1] is `any` and the cast annotates the discAdn type for this opcode
      const discAdn = node[1] as (string | string[])[];
      // Unfold: required columns are strings, optional columns are in the final sub-array.
      const discriminators: string[] = [];
      for (const d of discAdn) {
        if (Array.isArray(d)) discriminators.push(...d);
        else discriminators.push(d);
      }
      // CAST: tsDna uses `...any[]` for middle elements; node[3] is `any` and the cast annotates the branchDef type for this opcode
      const branchDef = node[3] as number[];
      // CAST: tsDna uses `...any[]` for middle elements; node[4] is `any` and the cast annotates the routing mode type for this opcode
      const mode = node[4] as tsMarangetMode | undefined;
      const branchIds = branchDef.slice(1);
      const schemas = branchIds.map(build);
      // Mode "cli" reconstructs the CLI construct (`DnaCliUnion` — adds the
      // derived positionals/flags views); other modes the generic class.
      return initDna(
        mode === CLI_MODE ? c.DnaCliUnion : c.DnaMarangetUnion,
        { schemas, discriminators, mode: mode ?? CONSTRUCTOR_PRIORITY },
        meta
      );
    }

    case 'chkSeq': {
      const ids = paramsFor(opcode, node);
      const [innerId, ...checkIds] = ids;
      let inner = build(innerId);
      for (const checkId of checkIds) {
        const checkNode = dnaList[checkId];
        // CAST: tsDna uses `...any[]` for middle elements; checkNode[1] is `any` and the cast annotates the step params array type
        const stepParams = checkNode[1] as unknown[];
        const stepMeta = getMeta(checkNode);
        const stepOp = checkNode[0];
        if (stepOp === 'sb') {
          inner = build(checkId);
          continue;
        }
        // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
        const kind = stepParams[0] as string;
        // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime opcode check
        const stepItemMeta = stepOp === 's' ? stepParams[2] as tsDnaMeta | undefined : stepMeta;
        if (kind === 'property') {
          // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
          const key = stepParams[1] as string | number;
          // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
          const schema = build(stepParams[2] as number);
          const prop = initDna(c.DnaCheckProperty, { property: key, schema }, stepMeta);
          inner = inner.check(prop);
        } else if (kind === 'func') {
          // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
          const fnStr = stepParams[1] as string;
          // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
          const arity = stepParams[2] as number;
          // CAST: reconstructFunc returns (...args:unknown[])=>void; check expects (ctx)=>void and TS cannot verify the overload narrowing
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
            case 'startsWith':
              // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
              inner = str.startsWith(JSON.parse(stepParams[1] as string), stepItemMeta); break;
            case 'endsWith':
              // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
              inner = str.endsWith(JSON.parse(stepParams[1] as string), stepItemMeta); break;
            case 'includes': {
              // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
              const inc = JSON.parse(stepParams[1] as string) as string;
              // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
              const position = stepParams[2] as number | undefined;
              if (position !== undefined) {
                inner = str.includes(inc, stepItemMeta ? { ...stepItemMeta, position } : { position });
              } else {
                inner = stepItemMeta ? str.includes(inc, stepItemMeta) : str.includes(inc);
              }
              break;
            }
            case 'min':
              // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
              inner = str.min(stepParams[1] as number, stepItemMeta); break;
            case 'max':
              // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
              inner = str.max(stepParams[1] as number, stepItemMeta); break;
            case 'length':
              // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
              inner = str.length(stepParams[1] as number, stepItemMeta); break;
            case 'pattern':
              // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
              inner = str.pattern(new RegExp(stepParams[1] as string, 'u'), stepItemMeta); break;
            case 'format':
              // CAST: stepParams is unknown[]; TS cannot narrow element types by position from a runtime check kind
              inner = str._format(stepParams[1] as string, stepItemMeta); break;
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
      const ids = paramsFor(opcode, node);
      let inner = build(ids[0]);
      for (let i = 1; i < ids.length; i++) {
        inner = inner.and(build(ids[i]));
      }
      return inner;
    }

    case 'transform': {
      const [fnStr, arity] = paramsFor(opcode, node);
      return initDna(c.DnaTransform, { fnStr, arity }, meta);
    }

    case 'url': {
      const [protocolSerialized, hostnameSerialized, normalize] = paramsFor(opcode, node);
      return initDna(c.DnaUrl, { protocol: regexFromString(protocolSerialized), hostname: regexFromString(hostnameSerialized), normalize: normalize ?? false }, meta);
    }

    case 'instanceOf': {
      const constructorName = paramsFor(opcode, node);
      // CAST: externals registry is typed as Record<string, unknown>; the constructor type cannot be inferred from the lookup
      const constructor = getRegisteredExternals()[constructorName] as tsPrimitiveClass;
      if (!constructor) throw new Error(`fromDna: external constructor not registered: ${constructorName}`);
      return initDna(c.DnaInstanceOf, { constructor }, meta);
    }

    case 'template': {
      // DNA layout: ["template", passiveParts, partIds, canMutate, meta?]
      // passiveParts, partIds, canMutate are direct node elements (not nested in params)
      // CAST: tsDna uses `...any[]` for middle elements; node[1] is `any` and the cast annotates the passiveParts type for this opcode
      const passiveParts = node[1] as tsPrimitiveLiteral[];
      // CAST: tsDna uses `...any[]` for middle elements; node[2] is `any` and the cast annotates the partIds type for this opcode
      const partIds = node[2] as number[];
      // CAST: node[3] is typed as any from tsDna; TS cannot narrow by opcode since the index is a runtime string
      const canMutate = node[3] as boolean;
      const schemaParts: c.DnaType<any>[] = [];
      for (const partId of partIds) {
        schemaParts.push(build(partId));
      }
      // CAST: initDna returns the base class type; the concrete subclass cannot be inferred from the class argument
      const inst = initDna(DnaTemplateReconstructed, { parts: [] }, meta) as DnaTemplateReconstructed;
      inst._reconstructedPassiveParts = passiveParts;
      inst._reconstructedSchemaParts = schemaParts;
      inst._reconstructedCanMutate = canMutate;
      return inst;
    }

    case 'function': {
      // DNA layout: ["function", [inputDnaId, outputDnaId], meta?]
      // CAST: tsDna uses `...any[]` for middle elements; node[1] is `any` and the cast annotates the ids type for this opcode
      const ids = node[1] as number[];
      const inputSchema = build(ids[0]);
      const outputSchema = build(ids[1]);
      const inst = initDna(c.DnaFunction, { input: inputSchema, output: outputSchema }, meta);
      return inst;
    }

    default:
      throw new Error(`fromDna: opcode not implemented: ${opcode}`);
  }
}

export function fromDna<S extends c.DnaSomeType<any, any> = c.DnaSomeType<any, any>>(seq: tsDnaSeq): S {
  const refListRaw = seq[seq.length - 1];
  // CAST: tsDnaSeq is a fixed tuple type; TS cannot narrow the spread from a runtime Array.isArray check
  const dnaList = (Array.isArray(refListRaw) ? seq.slice(0, -1) : seq) as tsDna[];
  const cache = new Map<number, c.DnaTypeWithWrappers<any, any>>();

  function extractMapSet(seqNode: tsDna): c.DnaTypeWithWrappers<any, any> | undefined {
    // CAST: getParams returns unknown (generic across all opcodes); TS cannot narrow to the opcode-specific array from a runtime string
    const stepIds = getParams(seqNode) as number[];
    const steps: tsDna[] = [];
    function add(id: number) {
      const n = dnaList[id];
      if (n[0] === 'pipe') {
        // CAST: getParams returns unknown (generic across all opcodes); TS cannot narrow to the opcode-specific array from a runtime string
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
      // CAST: node[1] is typed as any from tsDna; TS cannot narrow by opcode since the index is a runtime string
      const ids = instance[1] as number[];
      const instanceOfNode = dnaList[ids[0]];
      if (instanceOfNode[0] !== 'instanceOf') return undefined;
      // CAST: node[1] is typed as any from tsDna; TS cannot narrow by opcode since the index is a runtime string
      ctor = instanceOfNode[1] as string;
      chk = instance;
    } else {
      // CAST: node[1] is typed as any from tsDna; TS cannot narrow by opcode since the index is a runtime string
      ctor = instance[1] as string;
      chk = steps.find(n => n[0] === 'chkSeq');
    }

    let min: number | null = null;
    let max: number | null = null;
    let size: number | null = null;
    const check = chk;
    if (check) {
      // CAST: node[1] is typed as any from tsDna; TS cannot narrow by opcode since the index is a runtime string
      const checkIds = check[1] as number[];
      const checkNode = dnaList[checkIds[1]];
      // CAST: node[1] is typed as any from tsDna; TS cannot narrow by opcode since the index is a runtime string
      const checkDef = checkNode[1] as unknown[];
      if (checkDef[0] === 'property' && checkDef[1] === 'size') {
        // CAST: checkDef is unknown[]; TS cannot narrow element types by position from a runtime property check
        const num = build(checkDef[2] as number);
        if (num instanceof c.DnaNumber) {
          // CAST: _state is a generic internal type; TS cannot narrow the field type from a runtime instanceof check
          const numMin = num._state.min as number | null;
          // CAST: _state is a generic internal type; TS cannot narrow the field type from a runtime instanceof check
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
      // CAST: getParams returns unknown (generic across all opcodes); TS cannot narrow to the constraint array tuple from a runtime string
      const rcdParams = getParams(rcd) as [string, ...unknown[]][];
      const propertyNames = rcdParams.find(([name]) => name === 'propertyNames');
      const additionalProperties = rcdParams.find(([name]) => name === 'additionalProperties');
      if (!propertyNames || !additionalProperties) return undefined;
      return initDna(DnaMap, {
        // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
        keySchema: build(propertyNames[1] as number),
        // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
        valueSchema: build(additionalProperties[1] as number),
        min, max, size,
      }, instanceMeta);
    }

    if (ctor === 'Set') {
      const arr = steps.find(n => n[0] === 'a');
      if (!arr) return undefined;
      // CAST: getParams returns unknown (generic across all opcodes); TS cannot narrow to the constraint array tuple from a runtime string
      const arrParams = getParams(arr) as [string, ...unknown[]][];
      const itemEntry = arrParams.find(([name]) => name === 'items');
      if (!itemEntry) return undefined;
      return initDna(DnaSet, {
        // CAST: constraint array elements are unknown from the [string, ...unknown[]] cast; TS cannot narrow the element type from a runtime constraint name
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
      // CAST: node[1] is typed as any from tsDna; TS cannot narrow by opcode since the index is a runtime string
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
      // CAST: getParams returns unknown (generic across all opcodes); TS cannot narrow to the opcode-specific array from a runtime string
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

  const finalBuild = build(0);
  // S defaults to DnaSomeType<any, any>; callers can narrow via explicit type arg.
  // CAST: DNA bytecode carries no compile-time type info; S is caller-provided and TS cannot verify the runtime reconstruction matches S
  return finalBuild as unknown as S;
}
