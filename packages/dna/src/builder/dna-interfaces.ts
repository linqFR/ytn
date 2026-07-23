/**
 * DNA Schema Builder Core
 */
import { DnaError } from "../shared/error.types.js";
import type { IAddIssue, IRefinerErrorOpt, tsParserError, tsRefineOptions } from "../shared/error.types.js";
import type {
  tsCheckOpt,
  tsDecodeFn,
  tsEncodeFn,
  tsTransformFn
} from "../shared/handlers-builder.types.js";
import type {
  ICheckContext,
  IContext,
  IRefineContext,
  ISuperRefineContext,
  ITransformContext,
  tsDnaInnerMeta,
  tsDnaMeta
} from "../shared/meta-context.type.js";
import type {
  tsDnaExternals, tsDnaExternalsDecl, tsDnaParserFn,
  tsDnaParserResult,
  tsDnaValidatorFn
} from "../shared/runtime.types.js";

import { stringify } from "@ytn/shared/js/json.js";
import { cacheKey } from "./util.js";
import { isValidRegex } from "@ytn/shared/regex/is-valid-regex.js";
import type {
  tsPrimitiveLiteral,
  tsStoreMark,
  tsStorePosition,
  tsTmplLitPart
} from "../shared/base.types.js";
import { ABSENT_TOLERANT_WRAPPERS, INT32Bounds, WRAPPERS_KEYOPT, WRAPPERS_OPT, WRAPPERS_PREPROCESS, WRAPPERS_XFAULT, isWrapped } from "../shared/const-wrp.js";
import { convertToStandardFailure } from "../shared/standard-schema-utils.js";
import type { StandardJSONSchemaV1, StandardSchemaV1, StandardSchemaWithJSONProps } from "../shared/standard-schema.types.js";
import { STRING_FORMAT_PATTERNS, escReg } from "../shared/string-format.js";
import { parserBuilder, validatorBuilder } from "../toJs/dna-to-js.js";
import { registerExternal } from "../toJs/registry.js";
import { dnaToJsonSchema } from "../toJs/dna-to-json-schema.js";
import type {
  tsDnaCheck,
  tsDnaEnumInput,
  tsDnaEnumLike,
  tsDnaEnumValueType,
  tsDnaEnumValues,
  DnaFunctionArgs,
  DnaFunctionInput,
  tsFunctionType,
  tsDnaTupleSchemaArray,
  tsDnaTupleSchemaBase,
  tsDnaTupleSchemaRO,
  tsDnaTupleValueWithRest,
  tsDnaDiscriminatedUnionObjects
} from "../types/api-builder.types.js";
import type { tsDna, tsDnaId, tsDnaOpcode, tsDnaSeq } from "../types/core.types.js";
import type {
  $CatchValue,
  $DnaBranded,
  $DnaObjectInput,
  $DnaObjectOutput,
  $Input,
  $MaybeAsync,
  $Output,
  $RemoveUndefined,
  $TemplateLiteral,
  $Xor
} from "../types/helpers.types.js";
import type { IDnaCollector } from "./collector.types.js";
import { BaseCore, initDna } from "./dna-core.js";
import type { tsWrpPhase, tsWrpTypes } from "./state.types.js";


// ============================================
// DNA Collector
// ===========================================

export class DnaCollector implements IDnaCollector {
  dnaList: tsDna[] = [];
  dnaCache = new Map<string, number>();
  count = 0;
  refList: Set<tsDnaId> = new Set();
  // Cycle tracker keyed by node identity (`this._core`), not dnaId: several
  // container `_emitSelf`s assign their dnaId EARLY, before recursing into
  // their own children, so a cyclic re-entry's dnaId may already be known —
  // but it's never known BEFORE `_toDna()` starts, which is when this needs
  // to be marked. See `DnaType#toDnaNode` for the full explanation.
  inProgress: Set<unknown> = new Set();
  pendingRefs: Map<unknown, tsStoreMark> = new Map();
  store = new Map<number, any>();
  storeId = 0;

  // private cacheKey(enhancedDna: [tsDna, any]): string {
  //   return (enhancedDna, (key, value) => {
  //     if (typeof value === 'bigint') return value.toString();
  //     return value;
  //   });
  // }

  setStore(objToStore: any): tsStoreMark {
    const storeSize = this.storeId++;
    this.store.set(storeSize, objToStore);
    return storeSize;
  }

  updateStore(storeMark: tsStoreMark, targetIdx: tsDnaId, position?: tsStorePosition): void {
    if (typeof position === "number") {
      this.store.get(storeMark)[position] = targetIdx;
    } else if (Array.isArray(position)) {
      this.store.get(storeMark)[position[0]][position[1]] = targetIdx;
    } else {
      this.store.set(storeMark, targetIdx);
    }
  }

  storeDNA(dna: tsDna, storeMark?: tsStoreMark, storePosition?: tsStorePosition, discriminant: any = {}): tsDnaId {
    const key = cacheKey([dna, discriminant]);
    if (this.dnaCache.has(key)) {
      const cachedIdx = this.dnaCache.get(key)!;
      if (typeof storeMark === "number") {
        this.updateStore(storeMark, cachedIdx, storePosition);
      }
      return cachedIdx;
    }
    const idx = this.count++;
    this.dnaList[idx] = dna;
    this.dnaCache.set(key, idx);
    if (typeof storeMark === "number") {
      this.updateStore(storeMark, idx, storePosition);
    }
    return idx;
  }

  getDnaSeq(): tsDnaSeq {
    return [...this.dnaList, [...this.refList]];
  }
}

// ============================================
// Factories
// ============================================

/** Normalize an externals declaration into a mapper `{ nameInFn: externalsKey }`
 * (identity by default). Array form derives names from `.name`; object form uses keys. */
export function externalsMap(externals?: tsDnaExternalsDecl): tsDnaExternals {
  const map: tsDnaExternals = {};
  if (!externals) return map;
  if (Array.isArray(externals)) {
    externals.forEach((e, i) => {
      const n = (e as { name?: string } | null)?.name;
      if (!n) throw new Error("transform/refine external #" + i + " has no name; use the object form { myFn } for anonymous or minified values");
      map[n] = n;
    });
  } else {
    for (const k of Object.keys(externals)) map[k] = k;
  }
  return map;
}

function metaNormalize(meta?: string | tsDnaInnerMeta, target?: string): tsDnaInnerMeta {
  if (meta === undefined) return {};
  let _meta: any;
  if (typeof meta === "string") _meta = { error: meta };
  else _meta = meta;
  if (target) return { "~inner": _meta };
  return _meta
}


const SymSetHead = Symbol("setHead");
const SymForceCoerce = Symbol("forceCoerce");
const SymCore = Symbol("_core");

// Runtime discriminant for compiled validator/parser functions: `toJs`
// (see `dna-to-js.ts` STEP.ASYNC) emits an `async function` when the DNA
// tree contains an async refiner/transform, and a plain `function` otherwise.
// Comparing against this constructor is how sync entry points (`validate`,
// `safeParse`) detect — and reject — a schema they cannot run synchronously.
const AsyncFunction = (async function () { }).constructor;

export function cloner<T extends DnaType<any, any>>(schema: T, fn: (cl: T) => void): T {
  const cl = schema.clone();
  let clHeaded: any = cl;
  // Preserve head reference (all schemas in a chain point to the same head)
  if (schema._head) clHeaded = cl[SymSetHead](schema._head);
  fn(clHeaded);
  return clHeaded;
}

// ============================================
// Schema Builder export classes (with discriminated types)
// ============================================

export class DnaType<T = unknown, I = unknown> {
  declare _output: T;
  declare _input: I;
  // declare _stateDef: StateDef;


  get _head(): unknown { return this._core.head; }
  // [SymSetHead]<HL>(head: HL): this & { readonly _head: HL } { this._core.setHead(head); return this as any; }
  [SymSetHead]<HL>(head: HL): this { this._core.setHead(head); return this; }

  // _core is already defined dans DnaType
  protected _core = new BaseCore("any", { rawDna: ["T"] });
  get [SymCore]() { return this._core; }

  get _state() { return this._core.seed };

  get description(): string | undefined { return this._core.seed.meta.description; }
  get type() { return this._core.state.type; }

  /**
   * Standard Schema Protocol V1 compatibility
   * Provides a standardized interface for validation frameworks
   */
  get "~standard"(): StandardSchemaWithJSONProps<I, T> {
    return {
      version: 1,
      vendor: "@ytn/dna",
      types: {
        input: undefined as I,
        output: undefined as T
      },
      validate: (value: unknown): StandardSchemaV1.Result<T> => {
        const result = this.safeParse(value);
        if (result.success) {
          return { value: result.data };
        }
        return convertToStandardFailure(result.errors);
      },
      jsonSchema: {
        input: (options: StandardJSONSchemaV1.Options): Record<string, unknown> => {
          const schema = dnaToJsonSchema(this.toDna());
          return typeof schema === 'boolean' ? {} : schema as Record<string, unknown>;
        },
        output: (options: StandardJSONSchemaV1.Options): Record<string, unknown> => {
          const schema = dnaToJsonSchema(this.toDna());
          return typeof schema === 'boolean' ? {} : schema as Record<string, unknown>;
        }
      }
    };
  }

  /**
   * Coercion mutator (e.g. "toNumber") applied as the OUTERMOST serialization
   * layer. Set by `dna.coerce.*`. `undefined` means no coercion.
  */
  get _coerce(): boolean { return this._core.coerce; }
  set _coerce(bool: boolean) { }
  get _coerceCode(): string | undefined { return this._core.state.coerceCode; }

  get templateRegex(): string { return this._core.templateRegex; }

  /**
   * Force coercion on this schema, walking through wrappers to the leaf.
   * Used internally for record keys which must be coerced to strings.
   * Returns a cloned schema with coercion enabled to avoid mutating the original.
   */
  [SymForceCoerce]() {
    // Clone the schema to avoid mutating the original
    const cloned = this.clone();
    let leaf = cloned;
    while (leaf instanceof _DnaWrapper) leaf = leaf.unwrap();
    leaf._core.coerce = true;
    return cloned;
  }



  meta(): tsDnaInnerMeta;
  meta(value: string | tsDnaMeta): this;
  meta(value?: string | tsDnaMeta): this | tsDnaInnerMeta {
    if (arguments.length === 0 || value === undefined) return this._core.meta;
    return cloner(this, cl => cl._core.rawMeta(value));
  }

  clone() {
    const clone = new (this.constructor as new () => this)();
    clone._core = this._core.clone();
    return clone[SymSetHead](this._head);
  }


  /**
   * FINAL serialization template (Template Method). Leaves MUST override
   * `_emitSelf` only — NEVER `_toDna`. Layers are emitted outermost -> innermost:
   * coerce -> wrappers (optional/nullable/default/prefault) -> refiners (check/
   * refine seq) -> self. Each layer emits its opcode at the incoming
   * (storeMark, position) and returns the (storeMark, position) the next inner
   * layer must write into. This centralizes store-mark threading so a leaf can
   * never silently drop a wrapper again (root cause of the former StringImpl bug).
   */
  protected _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    let mark: tsStoreMark | undefined = storeMark;
    let pos: tsStorePosition | undefined = storePosition;
    [mark, pos] = this._emitCoerce(coll, mark, pos);
    // [mark, pos] = this._emitWrappers(coll, mark, pos);
    return this._emitRefiners(coll, mark, pos);
  }

  /** Coerce layer: emits `["coerce",[mutator, innerId]]` when `_coerce` is set. */
  protected _emitCoerce(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): [tsStoreMark | undefined, tsStorePosition | undefined] {
    if (!this._coerce) return [mark, pos];
    const params: [string, number] = [this._coerceCode!, 0];
    const storeId = coll.setStore(params);
    const localMeta: tsDnaInnerMeta = { coerced: this._coerce };
    this.meta(localMeta);
    coll.storeDNA(["coerce", params, {}], mark, pos, [mark, pos]);
    // Return storeId as the new mark, and position 1 for the inner schema
    // The inner schema will be stored at params[1] = 0 by _emitRefiners/_emitSelf
    return [storeId, 1];
  }

  // /** Wrapper layer: no-op in the base; overridden by `SchemaImplWithWrappers`. */
  // protected _emitWrappers(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): [tsStoreMark | undefined, tsStorePosition | undefined] {
  //   return [mark, pos];
  // }

  /**
   * Refiner layer: when `.refine()`/`.check()` accumulated entries, wraps
   * `_emitSelf` (position 0) and the `check` opcodes (positions 1..n) in a `chk`.
   * Otherwise delegates straight to `_emitSelf`.
   */
  protected _emitRefiners(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): tsDnaId {
    const checks = this._core.refinerList;
    if (checks.length === 0) return this._emitSelf(coll, mark, pos);
    const params: any[] = new Array(checks.length + 1);
    const storeId = coll.setStore(params);
    // `storeId` is unique -> use it as discriminant so empty-param chk nodes
    // never falsely dedupe against each other in the collector cache.
    const SeqDnaId = coll.storeDNA(["chk", params, this.meta()], mark, pos, storeId);
    // Store self at position 0, checks at positions 1..n
    this._emitSelf(coll, storeId, 0);
    for (let i = 0; i < checks.length; i++) {
      const it = checks[i];
      if (it[0] === "property") {
        const checkPropDef = [...it.slice(0, 2), -1];
        const checkStoreId = coll.setStore(checkPropDef);
        const schema = it[2];
        coll.storeDNA(["check", checkPropDef, schema.meta()], storeId, i + 1);
        schema.toDna(coll, checkStoreId, 2);
      } else {
        // A `func` refiner may carry an externals mapper at index 4
        // (`refine(fn, opts, [myFn])`); surface it in the check meta so codegen can
        // normalize + expose it (`const name = externals.name`).
        const ext = it.length > 4 ? it[4] : undefined;
        coll.storeDNA(["check", it, ext && Object.keys(ext).length ? { externals: ext } : {}], storeId, i + 1);
      }
    }
    return SeqDnaId;
  }

  /**
   * Emits this schema's OWN node at (mark, pos). Default stores the precomputed
   * `_dna`. Leaves with children (object/array/union/...) override this to build
   * their node and thread their children.
   */
  // protected override _emitSelf(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): tsDnaId {
  protected _emitSelf(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): tsDnaId {
    return coll.storeDNA(this._core.dnaWithMeta, mark, pos);
  }


  /** Core recursive emission logic, shared by both `toDna()` overload branches
   * (kept as a private helper — NOT called back through `toDna()` itself — so
   * the public overload dispatch stays a straight if/else, not self-recursion).
   *
   * Cycle detection is keyed by `this._core` (object identity), NOT by dnaId:
   * many container `_emitSelf`s (`DnaObject`, `DnaArray`, `DnaCombinator`,
   * `DnaTuple`, `DnaTemplateLiteral`, `DnaLazy`, ...) call `setDnaId` EARLY —
   * before recursing into their own children — specifically so a direct
   * self-reference (e.g. an object property getter returning the same
   * instance, no `.lazy()` needed) resolves to a real id instead of infinite
   * recursion. At the moment such a cyclic re-entry happens, the dnaId is
   * already known, but it isn't known yet HERE, before `_toDna()` starts —
   * so `this._core` is the only identity available to bracket the whole
   * `_toDna()` call (which may or may not early-assign, opaque to us). */
  #toDnaNode(collector: DnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const progressKey = this._core;
    const _dnaId = this._core.getDnaId(collector);

    if (_dnaId !== undefined) {
      if (collector.inProgress.has(progressKey)) {
        let refStoreId = collector.pendingRefs.get(progressKey);
        if (refStoreId === undefined) {
          const refDna: tsDna = ["ref", -1, {}];
          refStoreId = collector.setStore(refDna);
          const refDnaId = collector.storeDNA(refDna, storeMark, storePosition, refStoreId);
          collector.pendingRefs.set(progressKey, refStoreId);
          return refDnaId;
        }
        const refDna: tsDna = collector.store.get(refStoreId);
        return collector.storeDNA(refDna, storeMark, storePosition, refStoreId);
      }
      collector.updateStore(storeMark!, _dnaId, storePosition);
      return _dnaId;
    }
    
    collector.inProgress.add(progressKey);
    const dnaId = this._toDna(collector, storeMark, storePosition);
    collector.inProgress.delete(progressKey);
    this._core.setDnaId(collector, dnaId);
    const refStoreId = collector.pendingRefs.get(progressKey);
    if (refStoreId !== undefined) {
      const stored = collector.store.get(refStoreId);
      if (stored) stored[1] = dnaId;
      collector.refList.add(dnaId);
      collector.pendingRefs.delete(progressKey);
    }
    return dnaId;
  }

  toDna(): tsDnaSeq;
  toDna(collector: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId;
  toDna(collector?: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId | tsDnaSeq {
    if (collector instanceof DnaCollector) {
      return this.#toDnaNode(collector, storeMark, storePosition);
    }

    if (this._core.fullDna) return this._core.fullDna;


    const coll = new DnaCollector();

    this.#toDnaNode(coll, storeMark, storePosition);
    this._core.fullDna = coll.getDnaSeq();
    return this._core.fullDna;
  }

  pipe<U extends DnaType<any, T>>(target: U){
    const pipeSeq = initDna(DnaPipe<$Output<U>, I>, { steps: [this, target] });
    pipeSeq[SymSetHead](this._head);
    return pipeSeq;
  }

  transform<R>(fn: (arg: $Output<this>) => $MaybeAsync<R>, externals?: tsDnaExternalsDecl): DnaPipe<R, I>;
  transform<R>(fn: (arg: $Output<this>, ctx: ITransformContext<$Output<this>>) => $MaybeAsync<R>, externals?: tsDnaExternalsDecl): DnaPipe<R, I>;
  transform<R>(fn: (ctx: ITransformContext<$Output<this>>) => $MaybeAsync<R>, externals?: tsDnaExternalsDecl): DnaPipe<R, I>;
  // transform<R>(fn: (arg: any) => $MaybeAsync<R>): IDnaSchemaBase<R, I>;
  transform<R>(fn: tsTransformFn<$Output<this>, R>, externals?: tsDnaExternalsDecl): DnaPipe<R, I> {
    const map = externalsMap(externals);
    const meta: tsDnaInnerMeta | undefined = Object.keys(map).length ? { externals: map } : undefined;
    const transformSchema = initDna(DnaTransform<R, $Output<this>>, { fnStr: fn.toString().trim(), arity: fn.length }, meta);
    const pipeSeq = initDna(DnaPipe<R, I>, { steps: [this, transformSchema] })[SymSetHead](this._head);
    return pipeSeq;
  }

  refine(fn: (value: $Output<this>) => boolean): this;
  refine(fn: (value: $Output<this>) => Promise<boolean>): this;
  refine(fn: (value: $Output<this>) => boolean, options?: string | tsRefineOptions<DnaType<any, any>>): this;
  refine(fn: (value: $Output<this>) => Promise<boolean>, options?: string | tsRefineOptions<DnaType<any, any>>): this;
  refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => boolean): this;
  refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => Promise<boolean>): this;
  refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => boolean, options?: string | tsRefineOptions<DnaType<any, any>>): this;
  refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => Promise<boolean>, options?: string | tsRefineOptions<DnaType<any, any>>): this;
  refine(fn: any, options?: string | tsRefineOptions<DnaType<any, any>>) {
    return cloner(this, cl => {
      // Handle string options or object options
      const errorOpt = typeof options === "string" ? { error: options } : (options?.error ? { error: options.error } : {}) as IRefinerErrorOpt;
      // External refs declared via `options.externals` ([myFn] or { myFn }) — stored at
      // entry index 4 so `_emitRefiners` can surface them in the check meta.
      const map = externalsMap(typeof options === "object" ? options?.externals as tsDnaExternals : undefined);
      if (Object.keys(map).length) {
        cl._core.refinerList.push(["func", fn.toString().trim(), fn.length, errorOpt, map]);
      } else {
        cl._core.refinerList.push(["func", fn.toString().trim().trim(), fn.length, errorOpt]);
      }
    }) as this;
  }

  check(...checks: (tsDnaCheck | DnaProperty<string|number, DnaType<any, any>> | ((ctx: ICheckContext<$Input<this>>) => void))[]) {
    return cloner(this, cl => {
      for (const check of checks) {
        if (typeof check === "function") cl._core.refinerList.push(["func", check.toString(), check.length]);
        else if (check.kind === "describe") cl._core.rawMeta({ description: check.description });
        else if (check.kind === "meta") cl._core.rawMeta(check.meta);
        else if (check.kind === "validation") cl._core.refinerList.push(check.check);
        else if (check.kind === "property") cl._core.refinerList.push(["property", check.property, check.schema]);
      }
    }) as this;
  }

  // Utility methods
  with(...checks: (tsDnaCheck | ((ctx: ICheckContext<$Input<this>>) => void))[]) {
    return this.check(...checks);
  }

  // Additional validation
  superRefine(fn: (value: $Output<this>, ctx: ISuperRefineContext<$Output<this>>) => void): this | never {
    // superRefine provides a refinement context for custom error reporting
    // For DNA compatibility, we use refine with a context-aware function
    return this.refine((value) => {
      const ctx: ISuperRefineContext<$Output<this>> = {
        value,
        path: [],
        issues: [],
        addIssue: (issue: IAddIssue) => {
          // Store issue for later handling
          ctx.issues.push({
            code: issue.code,
            message: issue.message,
            input: value as $Output<this> | undefined,
            path: issue.path || []
          });
        }
      };
      fn(value, ctx);
      return ctx.issues.length === 0;
    });
  }

  // custom<R>(fn: (data: any) => R): IDnaSchemaBase<R> {
  //   // .custom() creates a schema with a custom validation function
  //   // For DNA compatibility, we accumulate the checker
  //   this._checkerList.push(["func", fn.toString().trim(), fn.length]);
  //   return this as IDnaSchemaBase<R>;
  // }

  brand<T extends PropertyKey = PropertyKey, Dir extends "in" | "out" | "inout" = "out">(value?: T): PropertyKey extends T ? this : $DnaBranded<this, T, Dir> {
    // .brand() adds a brand to the type for type-level discrimination
    // This is purely for TypeScript typing, no runtime effect
    // The direction parameter ("in" | "out" | "inout") controls which type gets branded
    return this as PropertyKey extends T ? this : $DnaBranded<this, T, Dir>;
  }

  catch<R>(catchValue: R): DnaCatch<this>;
  catch<R>(catchfn: (ctx: IContext<unknown>) => R, externals?: tsDnaExternalsDecl): DnaCatch<this>;
  catch<R>(arg0: R | ((ctx: IContext<unknown>) => R), externals?: tsDnaExternalsDecl): DnaCatch<this> {
    // .catch() provides a default value when parsing fails
    // Unlike .default() which only handles undefined, .catch() handles ALL parsing errors
    const valueExternals = typeof arg0 === "function" ? externalsMap(externals) : undefined;
    const wrapper = initDna(DnaCatch<this>, { inner: this, value: arg0, valueExternals })[SymSetHead](this._head);
    return wrapper;
  }

  // Properties
  toJSONSchema(): Record<string, unknown> {
    // Convert DNA bytecode to JSON Schema
    const dnaSeq = this.toDna();
    const schema = dnaToJsonSchema(dnaSeq);
    // Ensure we return an object, not a boolean
    return typeof schema === 'boolean' ? {} : schema;
  }

  // Composition methods
  array(): DnaArray<this> {
    const arraySchema = initDna(DnaArray<this>, { min: null, max: null, length: null, itemSchema: this })[SymSetHead](this._head);
    return arraySchema;
  }

  or<U>(other: DnaType<U>): DnaType<T | U> {
    const union = initDna(DnaUnion, { schemas: [this, other] })[SymSetHead](this._head);
    return union;
  }

  and<U>(other: U) {
    // and() creates an intersection
    // For DNA, we use allOf (intersection) with a store pattern like UnionImpl
    // const intersection = IntersectionImpl.create([this, other]);
    const intersection = initDna(DnaIntersection<this, U>)[SymSetHead](this._head);
    return intersection;

  }

  xor<U>(other: DnaType<U>): DnaType<$Xor<T, U>> {
    // xor() creates an exclusive union (exactly one must match)
    // For DNA, we use oneOf opcode
    const xorSchema = initDna(DnaXorUnion, { schemas: [this, other] })[SymSetHead](this._head);
    return xorSchema as DnaType<$Xor<T, U>>;
  }

  describe(description: string) { return cloner(this, cl => cl._core.meta.description = description) as this; }
  readonly() { return cloner(this, cl => cl._core.meta.readonly = true) as this; }

  register(fn: (schema: this) => void) { return cloner(this, cl => fn(cl)) as this; }

  overwrite<U>(fn: (schema: this) => U): U { return fn(this); }

  apply<R, A extends unknown[] = []>(fn: (schema: this, ...args: A[]) => R, args: A[] = []): R {
    return fn(this, ...args);
  }


  _validate(ctx?: tsDnaExternals): tsDnaValidatorFn {
    if (this._core.seed.cachedValidator) return this._core.seed.cachedValidator;
    this._core.seed.cachedValidator = validatorBuilder(this.toDna(), ctx);

    return this._core.seed.cachedValidator;
  }

  validate(value: unknown, ctx?: tsDnaExternals): boolean {
    // Invoke the validator returned by `_validate` (which subclasses like DnaCodec
    // override with their own cache) rather than reading `#state.cachedValidator`
    // directly — the override stores it elsewhere, so reading the field would be undefined.
    const fn = this._validate(ctx);
    if (fn instanceof AsyncFunction) {
      throw new Error("Schema contains async refinements/transforms — use validateAsync() instead of validate().");
    }
    return fn(value);
  }

  async validateAsync(value: unknown, ctx?: tsDnaExternals): Promise<boolean> {
    if (value instanceof Promise) value = await value;
    // Awaiting a plain (non-async) compiled function's return value is a
    // no-op — this works uniformly whether `_validate` compiled a sync or
    // an async validator (see `AsyncFunction` above).
    return await this._validate(ctx)(value);
  }

  _safeParse(ctx?: tsDnaExternals): tsDnaParserFn {
    if (this._core.seed.cachedParser) return this._core.seed.cachedParser;
    this._core.seed.cachedParser = parserBuilder(this.toDna(), ctx);

    return this._core.seed.cachedParser;
  }

  safeParse(value: unknown, ctx?: tsDnaExternals): tsDnaParserResult {
    // Invoke the parser from `_safeParse` (subclass-overridable, e.g. DnaCodec) for
    // the same reason as `validate` above.
    const fn = this._safeParse(ctx);
    if (fn instanceof AsyncFunction) {
      throw new Error("Schema contains async refinements/transforms — use safeParseAsync() instead of safeParse().");
    }
    return fn(value);
  }

  // Additional parsing methods
  parse(value: unknown, ctx?: tsDnaExternals): T | never {
    const res = this.safeParse(value, ctx);
    if (res.success) return res.data;
    throw new DnaError(res.errors);
  }

  async parseAsync(value: unknown, ctx?: tsDnaExternals): Promise<T> {
    const res = await this.safeParseAsync(value, ctx);
    if (res.success) return res.data;
    throw new DnaError(res.errors);
  }

  async safeParseAsync(value: unknown, ctx?: tsDnaExternals): Promise<tsDnaParserResult> {
    if (value instanceof Promise) value = await value;
    // Awaiting a plain (non-async) compiled function's return value is a
    // no-op — this works uniformly whether `_safeParse` compiled a sync or
    // an async parser (see `AsyncFunction` above).
    return await this._safeParse(ctx)(value);
  }

  spa(value: unknown, ctx?: tsDnaExternals): Promise<tsDnaParserResult> {
    return this.safeParseAsync(value, ctx);
  }

  safeDecode(value: unknown, ctx: tsDnaExternals): tsDnaParserResult { return this.safeParse(value, ctx); }
  safeDecodeAsync(value: unknown, ctx: tsDnaExternals): Promise<tsDnaParserResult> { return this.spa(value, ctx); }
  decode(value: unknown, ctx: tsDnaExternals): T { return this.parse(value, ctx); }
  decodeAsync(value: unknown, ctx: tsDnaExternals): Promise<T> { return Promise.resolve(this.parseAsync(value, ctx)); }

  safeEncode(value: unknown, ctx?: tsDnaExternals): tsDnaParserResult { return this.safeParse(value, ctx); }
  safeEncodeAsync(value: unknown, ctx?: tsDnaExternals): Promise<tsDnaParserResult> { return Promise.resolve(this.safeEncode(value, ctx)); }
  encode(value: unknown, ctx?: tsDnaExternals): T {
    const res = this.safeEncode(value, ctx);
    if (res.success) return res.data;
    throw new DnaError(res.errors);
  }
  encodeAsync(value: unknown, ctx?: tsDnaExternals): Promise<T> { return Promise.resolve(this.encode(value, ctx)); }


  // Information methods
  isOptional(): boolean {
    return this._core.seed.meta.optional === true;
  }

  isNullable(): boolean {
    return this._core.seed.meta.nullable === true;
  }

  isNullish(): boolean {
    return this._core.seed.meta.nullish === true;
  }
}

// export class DnatypeWithWrappers<T, I = T, StateDef extends tsStateDef = tsStateDef> extends DnaType<T, I, StateDef> {
export class DnaTypeWithWrappers<T, I = T> extends DnaType<T, I> {
  unwrap<W extends never>(): W {
    throw new Error("unwrap() can only be called when a wrapper (optional, nullable, nullish, default, prefault) has been applied");
  }
  optional() {
    return initDna(DnaOptional<this>, { inner: this })[SymSetHead](this._head);
  }
  nonoptional() {
    return initDna(DnaNonOptional<this>, { inner: this })[SymSetHead](this._head);
  }
  nullable() {
    return initDna(DnaNullable<this>, { inner: this })[SymSetHead](this._head);
  }
  nullish() {
    return initDna(DnaNullish<this>, { inner: this })[SymSetHead](this._head);
  }
  default(value: $Output<this>) {
    return initDna(DnaDefault<this>, { inner: this, value })[SymSetHead](this._head);
  }
  prefault(value: $Input<this>): DnaPrefault<this> {
    return initDna(DnaPrefault<this>, { inner: this, value })[SymSetHead](this._head);
  }
  exactOptional() {
    return initDna(DnaExactOptional<this>, { inner: this })[SymSetHead](this._head);
  }
}

export class DnaAny extends DnaTypeWithWrappers<any, any> {
  protected override _core = new BaseCore("any", { templateRegex: "" });
}

export class DnaUnknown extends DnaTypeWithWrappers<unknown, unknown> {
  protected override _core = new BaseCore("unknown", { templateRegex: "" });
}

export class DnaNever extends DnaTypeWithWrappers<never, never> {
  protected override _core = new BaseCore("never", { rawDna: ["F"], templateRegex: "" });
}

export class DnaNull extends DnaTypeWithWrappers<null, null> {
  protected override _core = new BaseCore("null", { rawDna: ["n0"] });
}

export class DnaUndefined extends DnaTypeWithWrappers<undefined, undefined> {
  protected override _core = new BaseCore("undefined", { rawDna: ["undefined"] });
}


export class DnaSymbol extends DnaTypeWithWrappers<symbol, symbol> {
  protected override _core = new BaseCore("symbol", { rawDna: ["symbol"] });
}

export class DnaVoid extends DnaTypeWithWrappers<void, void> {
  protected override _core = new BaseCore("void", { rawDna: ["undefined"] });
}

export class DnaNaN extends DnaTypeWithWrappers<typeof NaN, typeof NaN> {
  protected override _core = new BaseCore("nan", { rawDna: ["nan"] });
}

// Generic combinator implementation (anyOf, allOf, oneOf)
class DnaCombinator<T, I = T, S extends tsDnaTupleSchemaBase = tsDnaTupleSchemaBase> extends DnaTypeWithWrappers<T, I> {
  protected override _core = new BaseCore<{ schemas: S, combinatorType: "anyOf" | "allOf" | "oneOf" }>("anyOf");

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    let nbItems = this._core.seed.schemas.length
    const combinatorDef = new Array(nbItems + 1);
    const storeId = coll.setStore(combinatorDef);
    combinatorDef[0] = this._core.seed.combinatorType+"'s schemas";
    this._core.rawDna = [this._core.seed.combinatorType, combinatorDef];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, storeId);
    this._core.setDnaId(coll, dnaId);
    for (; nbItems--;) this._core.seed.schemas[nbItems].toDna(coll, storeId, nbItems + 1);
    return dnaId;
  }
}

export class DnaUnion<S extends tsDnaTupleSchemaBase> extends DnaCombinator<$Output<S[number]>, $Output<S[number]>, S> {
  protected override _core = new BaseCore<{ schemas: S, combinatorType: "anyOf" | "allOf" | "oneOf" }>("anyOf")
    .preSeed({ combinatorType: "anyOf" });
}

export class DnaIntersection<T, U, I = T & U> extends DnaCombinator<T & U, I, [DnaType<T, I>, DnaType<U, I>]> {
  protected override _core = new BaseCore<{ schemas: [DnaType<T, I>, DnaType<U, I>], combinatorType: "anyOf" | "allOf" | "oneOf" }>("allOf")
    .preSeed({ combinatorType: "allOf" });
}

export class DnaXorUnion<T = unknown> extends DnaCombinator<T, T, tsDnaTupleSchemaBase> {
  protected override _core = new BaseCore<{ schemas: tsDnaTupleSchemaBase, combinatorType: "anyOf" | "allOf" | "oneOf" }>("oneOf")
    .preSeed({ combinatorType: "oneOf" });
}


export class DnaTransform<T, R> extends DnaTypeWithWrappers<R, T> {
  protected override _core = new BaseCore<{ fnStr: string, arity: number }>("transform");

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this._core.rawDna = ["transform", [this._core.seed.fnStr, this._core.seed.arity]];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }
}


/* Wrappers bubble up their meta, so they dont need one  */
// export class WrapperImpl<T, I = T, Inner extends DnaType<T, I> = DnaType<T, I>, StateDef = tsStateDef> extends DnatypeWithWrappers<T, I, tsStateWrp<T, I, Inner> & StateDef> {
class _DnaWrapper<
  Inner extends DnaType<unknown, unknown>,
  Out = $Output<Inner>,
  In = $Input<Inner>,
> extends DnaTypeWithWrappers<Out, In> {
  protected override _core = new BaseCore<{ wrapperType: tsWrpTypes, phase: tsWrpPhase, inner: Inner, value?: Out | In | $CatchValue<Out, In>, valueExternals?: tsDnaExternals }>("wrap");
  declare _input: In;
  declare _output: Out;
  // declare _output: $Output<Inner> & {
  //   tsWrpTypes: boolean | $CatchValue<$Output<Inner>, $Input<Inner>>;
  // }
  // defaultValue?: () => T | undefined;
  // prefaultValue?: () => I | undefined;
  // catchValue?: () => $CatchValue<T, I> | undefined;

  get wrapperType(): tsWrpTypes { return this._core.seed.wrapperType; }

  override unwrap<W extends Inner>(): W {
    // this._core.state.inner.meta({ [this.#wrapperType] undefined });
    return this._core.seed.inner as W;
  }

  override get templateRegex(): string {
    const innerRegex = this.unwrap().templateRegex;
    // default/prefault/catch provide fallback values but don't change validity.
    // For template literals they still need to be validated by their schema.
    if (this._core.seed.wrapperType === "default" || this._core.seed.wrapperType === "prefault" || this._core.seed.wrapperType === "catch") {
      return "\x00";
    }
    if (innerRegex === "\x00") return "\x00";
    if (this._core.seed.wrapperType === "optional") {
      return "(?:" + innerRegex + ")?";
    }
    if (this._core.seed.wrapperType === "nullable") {
      return "(?:" + innerRegex + "|null)";
    }
    if (this._core.seed.wrapperType === "nullish") {
      return "(?:(?:" + innerRegex + ")?|null)";
    }
    return innerRegex;
  }


  /** @deprecated Use unwrap() instead */
  removeDefault(): Inner { return this.unwrap(); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const wrapperType = this._core.seed.wrapperType;
    const inner = this.unwrap();
    // `wrp` format: ["wrp", [wrptype, innerId, value?, phase], meta]
    // The params array is the store so the inner schema can fill innerId at position 1.
    // Value-bearing wrappers serialize their payload so codegen/converters can read it.
    // The phase (pre/post/around/catch) drives codegen dispatch without re-testing wrapperType.
    if (wrapperType === "optional") {
      let current: DnaType<any> | undefined = this.unwrap();
      while (current instanceof _DnaWrapper) {
        if (current.wrapperType === "default" || current.wrapperType === "prefault") {
          this._core.rawMeta({ passDefault: true });
          break;
        }
        current = current.unwrap();
      }
    }
    const wrpParams: any[] = [wrapperType, -1, this._core.seed.phase];
    if (wrapperType === "default" || wrapperType === "prefault" || wrapperType === "catch") {
      const rawValue = this._core.seed.value;
      // `.catch()` (unlike `.default()`/`.prefault()`) accepts a recovery
      // FUNCTION `(ctx) => R`. Functions aren't JSON-serializable DNA payloads,
      // so stringify them the same way `.refine()`/`.transform()` do — codegen
      // (`wrpValueCode`) detects this tuple shape and emits a real call.
      // The 4th slot carries the `.catch(fn, externals)` externals map, if any,
      // so codegen can expose captured names via `[STEP.OUT_ARG, name]`.
      const serializedValue = typeof rawValue === "function"
        ? ["fn", rawValue.toString().trim(), rawValue.length, this._core.seed.valueExternals]
        : rawValue;
      // this._core.rawMeta({ [wrapperType + "Value"]: serializedValue });
      wrpParams[3] = serializedValue;
    }
    const innerState: tsDna = ["wrp", wrpParams, this._core.meta];
    const storeId = coll.setStore(wrpParams);
    const dnaId = coll.storeDNA(innerState, storeMark, storePosition, storeId);
    inner.toDna(coll, storeId, 1);
    return dnaId;
  }
}

// Optional wrapper - allows undefined
export class DnaOptional<Inner extends DnaType<any, any> = DnaType<any, any>> extends _DnaWrapper<Inner, $Output<Inner> | undefined, $Input<Inner> | undefined> {
  protected override _core = new BaseCore<{ wrapperType: "optional", phase: "pre", inner: Inner }>("wrap").preSeed({ wrapperType: "optional", phase: "pre" });
}

// ExactOptional wrapper - type-level marker: makes an object key optional without adding `undefined` to the value type.
export class DnaExactOptional<Inner extends DnaType<any, any> = DnaType<any, any>> extends _DnaWrapper<Inner> {
  protected override _core = new BaseCore<{ wrapperType: "exactOptional", phase: "pre", inner: Inner }>("wrap").preSeed({ wrapperType: "exactOptional", phase: "pre" }).rawMeta({ exactOptional: true });
}

// NonOptional wrapper - marks schema as required in object keys (preserves wrapper chain type)
export class DnaNonOptional<Inner extends DnaType<any, any> = DnaType<any, any>> extends _DnaWrapper<Inner, $RemoveUndefined<$Output<Inner>>, $RemoveUndefined<$Input<Inner>>> {
  protected override _core = new BaseCore<{ wrapperType: "nonoptional", phase: "pre", inner: Inner }>("wrap").preSeed({ wrapperType: "nonoptional", phase: "pre" });
}

// Nullable wrapper - allows null
export class DnaNullable<Inner extends DnaType<any, any> = DnaType<any, any>> extends _DnaWrapper<Inner, $Output<Inner> | null, $Input<Inner> | null> {
  protected override _core = new BaseCore<{ wrapperType: "nullable", phase: "pre", inner: Inner }>("wrap").preSeed({ wrapperType: "nullable", phase: "pre" });
}

// Nullish wrapper - allows undefined and null
export class DnaNullish<Inner extends DnaType<any, any> = DnaType<any, any>> extends _DnaWrapper<Inner, $Output<Inner> | null | undefined, $Input<Inner> | null | undefined> {
  protected override _core = new BaseCore<{ wrapperType: "nullish", phase: "pre", inner: Inner }>("wrap").preSeed({ wrapperType: "nullish", phase: "pre" });
}

// Default wrapper - provides default value for output
export class DnaDefault<Inner extends DnaType<any, any> = DnaType<any, any>> extends _DnaWrapper<Inner> {
  protected override _core = Object.defineProperty(
    new BaseCore<{ wrapperType: "default", phase: "around", inner: Inner, value: $Output<Inner> }>("wrap").preSeed({ wrapperType: "default", phase: "around" }),
    "defaultValue",
    { get() { return this.seed.value; } }
  );
}

// Prefault wrapper - provides default value for input
export class DnaPrefault<Inner extends DnaType<any, any> = DnaType<any, any>> extends _DnaWrapper<Inner> {
  protected override _core = Object.defineProperty(
    new BaseCore<{ wrapperType: "prefault", phase: "pre", inner: Inner, value: $Input<Inner> }>("wrap").preSeed({ wrapperType: "prefault", phase: "pre" }),
    "prefaultValue",
    { get() { return this.seed.value; } }
  );
}

// Catch wrapper - provides fallback value on error
export class DnaCatch<Inner extends DnaType<any, any> = DnaType<any, any>> extends _DnaWrapper<Inner> {
  protected override _core = Object.defineProperty(
    new BaseCore<{ wrapperType: "catch", phase: "post", inner: Inner, value: $CatchValue<$Output<Inner>, $Input<Inner>>, valueExternals?: tsDnaExternals }>("wrap").preSeed({ wrapperType: "catch", phase: "post" }),
    "catchValue",
    { get() { return this.seed.value; } }
  );
}


/**
 * Whether an object key built from `schema` is REQUIRED. Walks the wrapper CHAIN
 * rather than reading `meta()`: chained wrappers collapse into one `wrp` node that
 * carries every modifier, but `meta()` reflects only the outermost — so e.g.
 * `.optional().nullable()` (outer `nullable`) would look required even though the
 * inner `optional` makes an absent key valid. Rules (matching Zod):
 * - `nonoptional` (a meta flag) anywhere -> forces required.
 * - any absent-tolerant wrapper in the chain (`optional`/`nullish`/`catch`/`default`/
 *   `prefault`) -> not required. `nullish` counts (it is optional + nullable); plain
 *   `nullable` does NOT (only an explicit `null` is allowed, not an absent key).
 * - otherwise the leaf's meta decides (e.g. `preprocess`/`exactOptional`).
 */
function isRequiredKey(schema: DnaType<any>): boolean {
  if (schema.meta()[WRAPPERS_KEYOPT.nonoptional]) return true;
  let s: DnaType<any> = schema;
  while (s instanceof _DnaWrapper) {
    if (ABSENT_TOLERANT_WRAPPERS.includes(s.wrapperType)) return false;
    s = s.unwrap();
  }
  return !ABSENT_TOLERANT_WRAPPERS.some(it => s.meta()[it] !== undefined);
}

/**
 * Literal schema class for a single value or a union of literal values.
 * `const T` is required because `literal()` passes a const literal type (or a union of
 * const literal values) as the type argument. Without `const`, TS would widen it to `any`.
 */
export class DnaLiteral<const T> extends DnaTypeWithWrappers<T, T> {
  protected override _core = new BaseCore<{ value: T }>("literal")

  // TypeScript static warning: .value returns never for multi-value literals
  // Runtime check: throws error if accessed on multi-value literal
  get value(): T extends readonly any[] ? never : T {
    if (Array.isArray(this._core.seed.value)) {
      throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
    }
    return this._core.seed.value as T extends readonly any[] ? never : T;
  }
  get values(): Set<T> {
    const value = this._core.seed.value;
    return new Set(Array.isArray(value) ? value : [value]);
  }
  get _rawValues(): Array<T> {
    const value = this._core.seed.value;
    return Array.isArray(value) ? value : [value];
  }

  override get templateRegex(): string { return escReg(String(this._core.seed.value)); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this._core.rawDna = ["l", this._rawValues];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, this._rawValues);
  }
}


type tsStrChekOrMutation = | ["check", [string], tsDnaMeta]
  | ["check", [string, any?, any?], tsDnaMeta]
  | ["mutate", [string, any?]]
  | ["mutate", [string, any?], tsDnaMeta];

type tsSeqItem =
  | ["s", [number | null, number | null, string | RegExp | null, string | null,], tsDnaMeta]
  | tsStrChekOrMutation;

type tsStrSeqItem =
  | ["s", "min", number, tsDnaMeta]
  | ["s", "max", number, tsDnaMeta]
  | ["s", "pattern", RegExp | string, tsDnaMeta]
  | ["s", "format", string, tsDnaMeta]
  | tsStrChekOrMutation;

const strCoreFactory = (format: string = "", coerce: boolean = false) => {
  return new BaseCore<{
    min: number | null;
    max: number | null;
    pattern: RegExp | string | null;
    format: string | null;
    startsWith?: string;
    endsWith?: string;
    includes?: string;
    sequence: tsSeqItem[]
  }>("string", {
    coerce,
    coerceCode: "toString",
    seed: {
      min: null,
      max: null,
      pattern: null,
      format: format ?? null,
      startsWith: undefined,
      endsWith: undefined,
      includes: undefined,
      sequence: []
    }
  });
}

// String implementation
// export class DnaString extends DnatypeWithWrappers<string, string, tsStateString> {
export class DnaString extends DnaTypeWithWrappers<string, string> {
  protected override _core = strCoreFactory();

  // static create(options?: { format?: string }): any {
  //   const format = options?.format ?? null
  //   const inst = this.initCore<string, string, tsStateString>("string", {
  //     min: null,
  //     max: null,
  //     pattern: null,
  //     format,
  //     startsWith: undefined,
  //     endsWith: undefined,
  //     includes: undefined,
  //     sequence: []
  //   }, "toString");
  //   if (format) (inst as any).#addSeq(["s", "format", format, inst._core.meta]);
  //   return inst;
  // }

  #addSeq(seqarr: tsStrSeqItem) {
    if (seqarr[0] === "mutate" || seqarr[0] === "check") {
      // Keep mutations and checks as-is
      this._core.seed.sequence.push(seqarr);
    } else if (this._core.seed.sequence.length > 0 || seqarr[0] !== "s") {
      const sq1 = seqarr[1], sq2 = seqarr[2];
      this._core.seed.sequence.push(["s",
        [
          sq1 === "min" ? sq2 : null,
          sq1 === "max" ? sq2 : null,
          sq1 === "pattern" ? (sq2 instanceof RegExp ? sq2.source : sq2) : null,
          sq1 === "format" ? sq2 : null,
        ] as [number | null, number | null, string | null, string | null],
        seqarr[3]]);
    } else if (seqarr[0] === "s") {
      switch (seqarr[1]) {
        case "min": this._core.seed.min = seqarr[2]; break;
        case "max": this._core.seed.max = seqarr[2]; break;
        case "pattern": this._core.seed.pattern = seqarr[2]; break;
        case "format": this._core.seed.format = seqarr[2]; break;
      }
      this.meta(seqarr[3]);
    };
  }

  min(length: number, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.seed.min = length; cl._core.innerMeta("min", meta); cl.#addSeq(["s", "min", length, metaNormalize(meta, "min")]); });
  }

  max(length: number, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.seed.max = length; cl._core.innerMeta("max", meta); cl.#addSeq(["s", "max", length, metaNormalize(meta, "max")]); });
  }

  length(length: number, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.seed.min = length; cl._core.seed.max = length; if (meta) cl._core.innerMeta(["min", "max"], meta); });
  }

  eq(length: number, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.seed.min = length; cl._core.seed.max = length; cl._core.innerMeta("eq", meta); });
  }

  pattern(regex: RegExp, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.seed.pattern = regex; cl._core.innerMeta("pattern", meta); cl.#addSeq(["s", "pattern", regex, metaNormalize(meta, "pattern")]); });
  }
  regex = this.pattern;

  format(fmt: string, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.innerMeta("format", meta); cl.#addSeq(["s", "format", fmt, metaNormalize(meta, "format:" + fmt)]); cl._core.seed.format = fmt; });
  }

  /** @deprecated Use dna.email() instead */
  email(meta?: string | tsDnaMeta) {
    return this.format("email", meta);
  }

  /** @deprecated Use dna.url() instead */
  url(): DnaUrl {
    // Use UrlImpl for proper URL validation with new URL()
    return initDna(DnaUrl, undefined, this._core.meta);
  }

  /** @deprecated Use dna.uuid() instead */
  uuid() {
    return this.format("uuid");
  }

  /** @deprecated Use dna.base64() instead */
  base64() {
    return this.format("base64");
  }

  override get templateRegex(): string {
    if (this._core.seed.sequence.length) return "\x00";
    if (this._core.seed.pattern) return typeof this._core.seed.pattern === "string" ? this._core.seed.pattern : this._core.seed.pattern.source;
    if (this._core.seed.format) {
      const formatPattern = STRING_FORMAT_PATTERNS[this._core.seed.format];
      if (formatPattern) return formatPattern;
    }
    let r = ".*";
    if (this._core.seed.min !== null || this._core.seed.max !== null) {
      r = ".{" + (this._core.seed.min ?? 0);
      if (this._core.seed.max !== null) r += "," + this._core.seed.max;
      r += "}";
    }
    // Add startsWith/endsWith/includes constraints if present
    if (this._core.seed.startsWith) r = escReg(this._core.seed.startsWith) + r;
    if (this._core.seed.endsWith) r = r + escReg(this._core.seed.endsWith);
    if (this._core.seed.includes) r = ".*" + escReg(this._core.seed.includes) + ".*";
    return r;
  }

  /** @deprecated Use dna.base64url() instead */
  base64url() { return this.format("base64url"); }

  /** @deprecated Use dna.jwt() instead */
  jwt(options?: { alg?: string }, meta?: string | tsDnaMeta): DnaJwt {
    return initDna(DnaJwt, { alg: options?.alg ?? null }, meta);
  }

  /** @deprecated Use dna.emoji() instead */
  emoji() { return this.format("emoji"); }

  /** @deprecated Use dna.nanoid() instead */
  nanoid(error?: string) { return this.format("nanoid"); }

  /** @deprecated Use dna.uuid() instead */
  guid(error?: string) { return this.format("guid"); }

  /** @deprecated Use dna.cuid() instead */
  cuid() { return this.format("cuid"); }

  /** @deprecated Use dna.cuid2() instead */
  cuid2() { return this.format("cuid2"); }

  /** @deprecated Use dna.ulid() instead */
  ulid() { return this.format("ulid"); }

  /** @deprecated Use dna.xid() instead */
  xid() { return this.format("xid"); }

  /** @deprecated Use dna.ksuid() instead */
  ksuid() { return this.format("ksuid"); }

  /** @deprecated Use dna.ipv4() instead */
  ipv4() { return this.format("ipv4"); }

  /** @deprecated Use dna.ipv6() instead */
  ipv6() { return this.format("ipv6"); }

  /** @deprecated Use dna.mac() instead */
  mac() { return this.format("mac"); }

  trim() { return cloner(this, cl => cl.#addSeq(["mutate", ["trim"]])); }
  toLowerCase() { return cloner(this, cl => cl.#addSeq(["mutate", ["toLowerCase"]])); }
  toUpperCase() { return cloner(this, cl => cl.#addSeq(["mutate", ["toUpperCase"]])); }
  normalize() { return cloner(this, cl => cl.#addSeq(["mutate", ["normalize"]])); }
  uppercase(meta: string | tsDnaMeta) { return cloner(this, cl => cl.#addSeq(["check", ["uppercase"], metaNormalize(meta)])); }
  lowercase(meta: string | tsDnaMeta) { return cloner(this, cl => cl.#addSeq(["check", ["lowercase"], metaNormalize(meta)])); }
  startsWith(start: string, meta?: string | tsDnaMeta) {
    return cloner(this, cl => {
      cl._core.seed.startsWith = start;
      cl.#addSeq(["check", ["startsWith", stringify(start)], metaNormalize(meta)]);
    });
  }
  endsWith(end: string, meta?: string | tsDnaMeta) {
    return cloner(this, cl => {
      cl._core.seed.endsWith = end;
      cl.#addSeq(["check", ["endsWith", stringify(end)], metaNormalize(meta)]);
    });
  }
  includes(inc: string, params?: string | tsDnaMeta | { position?: number; error?: string }) {
    // Zod's 2nd arg is a message string OR `{ position?, error? }`. A `position`
    // narrows the match to `str.includes(inc, position)` (substring at index >= position).
    let position: number | undefined;
    let meta: string | tsDnaMeta | undefined;
    if (params !== null && typeof params === "object" && "position" in params) {
      position = params.position;
      meta = params.error;
    } else {
      meta = params;
    }
    return cloner(this, cl => {
      cl._core.seed.includes = inc;
      const check: tsCheckOpt = position !== undefined
        ? ["includes", stringify(inc), position]
        : ["includes", stringify(inc)];
      cl.#addSeq(["check", check, metaNormalize(meta)]);
    });
  }

  /**
   * @deprecated Use dna.iso.datetime() instead
   */
  datetime(options?: { local?: boolean; offset?: boolean; precision?: number; error?: string }): DnaString { return Iso.datetime(options); }

  /**
   * @deprecated Use dna.iso.date() instead
   */
  date(options?: { error?: string }): DnaString { return Iso.date(options); }

  /**
   * @deprecated Use dna.iso.time() instead
   */
  time(options?: { precision?: number | "minute"; message?: string; error?: string }): DnaString { return Iso.time(options); }

  /**
   * @deprecated Use dna.iso.duration() instead
   */
  // duration(options?: { error?: string }): DnaString { return Iso.duration(options); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    // Store the regex source string (without slashes) so the JS generator can emit a literal regex
    const patternRaw = this._core.seed.pattern;
    const patternSerialized = patternRaw instanceof RegExp
      ? (isValidRegex(patternRaw.source, "u") ? patternRaw.source : null)
      : (typeof patternRaw === "string" && isValidRegex(patternRaw, "u")
        ? new RegExp(patternRaw, "u").source
        : null);
    this._core.rawDna = ["s", [this._core.seed.min ?? null, this._core.seed.max ?? null, patternSerialized, this._core.seed.format ?? null]];

    if (this._core.seed.sequence.length > 0) {
      const checkSeqInst = initDna(_DnaChkRaw, {
        dnaSteps: [
          this._core.dnaWithMeta,
          ...this._core.seed.sequence,
        ]
      });
      return checkSeqInst.toDna(coll, storeMark!, storePosition);

    } else {
      return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
    }
  }
}

export class DnaEmail extends DnaString {
  protected override _core = strCoreFactory("email");
}
export class DnaHttpUrl extends DnaString {
  protected override _core = strCoreFactory("httpUrl");
}
export class DnaHostname extends DnaString {
  protected override _core = strCoreFactory("hostname");
}
export class DnaUUID extends DnaString {
  protected override _core = strCoreFactory("uuid");
}
export class DnaE164 extends DnaString {
  protected override _core = strCoreFactory("e164");
}
export class DnaEmoji extends DnaString {
  protected override _core = strCoreFactory("emoji");
}
export class DnaBase64 extends DnaString {
  protected override _core = strCoreFactory("base64");
}
export class DnaBase64Url extends DnaString {
  protected override _core = strCoreFactory("base64url");
}
export class DnaHex extends DnaString {
  protected override _core = strCoreFactory("hex");
}
export class DnaNanoId extends DnaString {
  protected override _core = strCoreFactory("nanoid");
}
export class DnaCuid extends DnaString {
  protected override _core = strCoreFactory("cuid");
}
export class DnaCuid2 extends DnaString {
  protected override _core = strCoreFactory("cuid2");
}
export class DnaUlid extends DnaString {
  protected override _core = strCoreFactory("ulid");
}
export class DnaXid extends DnaString {
  protected override _core = strCoreFactory("xid");
}
export class DnaKsuid extends DnaString {
  protected override _core = strCoreFactory("ksuid");
}
export class DnaIpv4 extends DnaString {
  protected override _core = strCoreFactory("ipv4");
}
export class DnaIpv6 extends DnaString {
  protected override _core = strCoreFactory("ipv6");
}
export class DnaMac extends DnaString {
  protected override _core = strCoreFactory("mac");
}
export class DnaCidrv4 extends DnaString {
  protected override _core = strCoreFactory("cidrv4");
}
export class DnaCidrv6 extends DnaTypeWithWrappers<string, string> {
  protected override _core = new BaseCore("cidrv6", { coerceCode: "toString" });

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this._core.rawDna = ["cidrv6", this.meta()];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }
}
export class DnaJwt extends DnaTypeWithWrappers<string, string> {
  protected override _core = new BaseCore<{ alg: string | null }>("jwt", { coerceCode: "toString", seed: { alg: null } });

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this._core.rawDna = ["jwt", this._core.seed.alg ?? null];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, this._core.seed.alg);
  }
}
export class DnaHash extends DnaString {
  protected override _core = strCoreFactory();
}


// Enhanced Template literal implementation that enables tranformation and mutation
// export class DnaTmplLiteralMutate extends DnatypeWithWrappers<string, string, tsStateTemplateLiteralMutate> {
export class DnaTmplLiteralMutate<Parts> extends DnaTypeWithWrappers<Parts, Parts> {
  // declare _output: Parts;
  // declare _input: string;
  protected override _core = new BaseCore<{ parts: readonly tsTmplLitPart[] }>("string", {
    seed: { parts: [] }
  })

  get canMutate() { return true }

  // static init(parts: tsTmplLitArg[]): any {
  //   return this.initCore<string, string, tsStateTemplateLiteralMutate>("string", { parts, canMutate: true });
  // }

  getParts() {
    return this._core.seed.parts;
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const passiveParts: tsPrimitiveLiteral[] = [], schemaParts: DnaType<any>[] = [];
    if (!this._core.seed.parts.length) {
      passiveParts.push("");
    } else this._core.seed.parts.forEach((part, i) => {
      if (part instanceof DnaType) {
        const partRegex = part.templateRegex;
        if (partRegex === "\x00") {
          // Placeholder: the wrapped schema will be validated by the wrp opcode.
          // Required placeholders use "+"; optional-ish placeholders use "?".
          // Both are regex-special chars, so escReg() escapes any user-provided "+" or "?",
          // preventing collision with these markers.
          let isOptional = false;
          let leaf: DnaType<any> = part;
          while (leaf instanceof _DnaWrapper) {
            const wrapperType = leaf[SymCore].seed.wrapperType;
            if (wrapperType === "optional" || wrapperType === "nullish" || wrapperType === "default" || wrapperType === "prefault" || wrapperType === "catch") isOptional = true;
            leaf = leaf.unwrap();
          }
          passiveParts[i] = isOptional ? "?" : "+";
          schemaParts.push(part);
        } else {
          // Use regex pattern for validation, but remove ^ and $ anchors
          // since the template will add its own anchors
          const cleanedRegex = partRegex.replace(/^\^/, "").replace(/\$$/, "");
          passiveParts[i] = cleanedRegex;
        }
      } else {
        passiveParts[i] = escReg(String(part));
      }
    });
    let schLen = schemaParts.length;
    const partIds = new Array<number>(schLen);
    const storeId = coll.setStore(partIds);
    this._core.rawDna = ["template", passiveParts, partIds, this.canMutate];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, storeId);
    this._core.setDnaId(coll, dnaId)
    for (; schLen--;) { // NEVER change this line
      const schema = schemaParts[schLen];
      // The captured group is always a string, so the part schema must coerce it to
      // its target type. Coercion belongs to the inner LEAF (e.g. number -> toNumber).
      let leaf: DnaType<any> = schema;
      while (leaf instanceof _DnaWrapper) leaf = leaf.unwrap();
      leaf[SymCore].coerce = true;
      schema.toDna(coll, storeId, schLen);
    }
    return dnaId;
  }
}

// Template literal implementation - for Zod Compatibility
export class DnaTemplateLiteral<Parts> extends DnaTmplLiteralMutate<Parts> {
  // declare _output: Parts;
  // declare _input: string;
  // protected override _core = new BaseCore<{parts: tsTmplLitArg[], canMutate: boolean}>("string");

  override get canMutate() { return false }

}

// Mutate implementation - mutation operation
// export class MutateImpl<T, I = T> extends DnaType<T, I> {
//   protected override _core = new BaseCore("mutate");
//   private _mutator: string = "";

//   static init<T, I = T>(mutator: string): any {
//     const inst = this.initCore<T, I, tsStateDef>("mutate", {});
//     (inst as any)._mutator = mutator;
//     (inst as any)._dna = ["mutate", mutator];
//     return inst;
//   }
//   // protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
//   protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
//     return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
//   }
// }

// _DnaChkRaw - wraps raw DNA into ISchemaBase for SeqSchemaImpl
class _DnaChkRaw extends DnaType<unknown, unknown> {
  protected override _core = new BaseCore<{ dnaSteps: tsDna[] }>("chk");

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const dna_params = new Array(this._core.seed.dnaSteps.length);
    const storeId = coll.setStore(dna_params);
    this._core.rawDna = ["chk", dna_params];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, this._core.seed.dnaSteps);
    this._core.seed.dnaSteps.forEach((step: any, i: number) => coll.storeDNA(step, storeId, i));
    return dnaId;
  }
}

// Seq implementation - sequence of DNA operations
export class DnaPipe<T, I> extends DnaTypeWithWrappers<T, I> {
  protected override _core = new BaseCore<{ steps: DnaType<any, any>[] }>("pipe", {
    rawDna: ["seq"],
    seed: {
      steps: []
    }
  })

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const dna_params = new Array(this._core.seed.steps.length);
    const storeId = coll.setStore(dna_params);
    this._core.rawDna = ["seq", dna_params];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, storeId);
    this._core.seed.steps.forEach((step: any, i: number) => step.toDna(coll, storeId, i));
    return dnaId;
  }
}


// StringBool implementation - Zod V4 stringbool compatibility
export class DnaStringBool extends DnaTypeWithWrappers<boolean, boolean> {
  protected override _core = new BaseCore<{ truthy: string[]; falsy: string[]; case: "sensitive" | "insensitive" }>("sb", {
    seed: {
      truthy: ["true", "yes", "1", "on", "y", "enabled"],
      falsy: ["false", "no", "0", "off", "n", "disabled"],
      case: "insensitive"
    }
  })

  override get templateRegex(): string {
    const keys = [...this._core.seed.truthy, ...this._core.seed.falsy].map(k => this._core.seed.case === "insensitive" ? k.toLowerCase() : k);
    this._core.templateRegex = "(?:" + keys.map(escReg).join("|") + ")";
    return this._core.templateRegex;
  }

  override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const seed = this._core.seed;
    this._core.rawDna = ["sb", [seed.truthy, seed.falsy, seed.case === "sensitive"]];
    const seqDna = initDna(_DnaChkRaw, {
      dnaSteps: [
        ["s", [null, null, null, null], this._core.meta],
        this._core.dnaWithMeta
      ]
    });
    return seqDna.toDna(coll, storeMark!, storePosition);
  }
}

export class DnaIsoDatetime extends DnaString { protected override _core = strCoreFactory("date-time") }
export class DnaIsoDate extends DnaString { protected override _core = strCoreFactory("date"); }
export class DnaIsoTime extends DnaString { protected override _core = strCoreFactory("time"); }
export class DnaIsoDuration extends DnaString { protected override _core = strCoreFactory("duration"); }

// ISO implementation - static methods
export class Iso {
  static datetime(options?: { local?: boolean; offset?: boolean; precision?: number; error?: string; message?: string }) {
    let format = "date-time";
    if (options?.local) format += "-local";
    if (options?.offset) format += "-offset";
    if (options?.precision !== undefined) format += "-precision-" + options.precision;
    return initDna(DnaIsoDatetime, { format }, { message: options?.message, error: options?.error });
  }

  static date(options?: { error?: string }) {
    return initDna(DnaIsoDate, undefined, { error: options?.error });
  }

  static time(options?: { precision?: number | "minute"; message?: string; error?: string }) {
    let format = "time";
    if (options?.precision !== undefined) format += "-precision-" + options.precision;
    return initDna(DnaIsoTime, { format }, { message: options?.message, error: options?.error });
  }

  static duration(meta?: string | tsDnaMeta) {
    return initDna(DnaIsoDuration, undefined, typeof meta === "string" ? { error: meta } : meta);
  }
}

// Date implementation
export class DnaDate extends DnaTypeWithWrappers<Date, Date> {
  protected override _core = new BaseCore<{ min: Date | null, max: Date | null }>("date", { seed: { min: null, max: null } });

  // static create(): any {
  //   // State-only (like NumberImpl): bounds live in `_stt`, the node is built in
  //   // `_emitSelf`. No cached `_dna`, so cloning can never desync the bounds.
  //   return this.initCore<Date, Date, tsStateDate>("date", { min: null, max: null }, "toDate");
  // }
  min(date: Date, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = date; cl._core.innerMeta("min", meta); }); }
  max(date: Date, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = date; cl._core.innerMeta("max", meta); }); }
  eq(date: Date, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = date; cl._core.seed.max = date; cl._core.innerMeta("eq", meta); }); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const selfDna: tsDna = ["date", [this._core.seed.min, this._core.seed.max], this.meta()];
    return coll.storeDNA(selfDna, storeMark, storePosition);
  }
}


// URL implementation
export class DnaUrl extends DnaTypeWithWrappers<string, string> {
  protected override _core = new BaseCore<{ normalize: boolean, protocol: RegExp | null, hostname: RegExp | null }>("url", { coerceCode: "toString", seed: { protocol: null, hostname: null, normalize: false } });

  // static init(options?: { normalize?: boolean, protocol?: RegExp, hostname?: RegExp }): any {
  //   const inst = this.initCore<string, string, tsStateUrl>("url", { protocol: null, hostname: null, normalize: false }, "toString");
  //   if (options?.normalize) {
  //     inst._core.state.normalize = true;
  //   }
  //   if (options?.protocol) {
  //     inst._core.state.protocol = options.protocol;
  //   }
  //   if (options?.hostname) {
  //     inst._core.state.hostname = options.hostname;
  //   }
  //   return inst;
  // }

  protocol(protocol: RegExp) { return cloner(this, cl => cl._core.seed.protocol = protocol); }
  hostname(hostname: RegExp) { return cloner(this, cl => cl._core.seed.hostname = hostname); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    // Serialize RegExp as string using toString() to preserve pattern and flags
    const protocolSerialized = this._core.seed.protocol ? this._core.seed.protocol.toString() : null;
    const hostnameSerialized = this._core.seed.hostname ? this._core.seed.hostname.toString() : null;
    this._core.rawDna = ["url", [protocolSerialized, hostnameSerialized, this._core.seed.normalize]];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }
}


// Boolean implementation
export class DnaBoolean extends DnaTypeWithWrappers<boolean, boolean> {
  protected override _core = new BaseCore("b", { coerceCode: "toBoolean", rawDna: ["b"] });

  // static create(): any {
  //   const inst = this.initCore<boolean, boolean, tsStateBoolean>("b", {}, "toBoolean");
  //   (inst as any)._dna = ["b"];
  //   return inst;
  // }

  override get templateRegex(): string { return "(?:true|false)"; }
}

const numCoreFactory = <N extends number | bigint>(type: tsDnaOpcode, coerceCode: string, coerce: boolean = false, bounds?: { min?: N | null, max?: N | null }) => {
  return new BaseCore<{ min: N | null, max: N | null, exclMin: boolean, exclMax: boolean, multOf: N | null }>(
    type,
    {
      coerce,
      coerceCode,
      seed: {
        min: bounds?.min ?? null,
        max: bounds?.max ?? null,
        exclMin: false,
        exclMax: false,
        multOf: null
      }
    }
  );
};


// Number implementation (base export class, does not implement public interface)
// export class NumberImpl<T extends number | bigint, I = unknown> extends DnatypeWithWrappers<T, I, tsStateNumber<T>> implements schNumberMethods<T> {
// export class NumberImpl<T extends number | bigint, I = unknown> extends DnatypeWithWrappers<T, I, tsStateNumber<T>>{
export class NumberImpl<T extends number | bigint, I = unknown> extends DnaTypeWithWrappers<T, I> {
  protected override _core = numCoreFactory<T>("n", "toNumber");

  // static init<T extends number | bigint, I = T>(type: tsDnaOpcode = "n", coerceCode: string = "toNumber"): any {
  //   return this.initCore<T, I, tsStateNumber<T>>(type, { min: null, max: null, exclMin: false, exclMax: false, multOf: null }, coerceCode);
  // }

  min(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = value; cl._core.innerMeta("min", meta); }); }
  max(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = value; cl._core.innerMeta("max", meta); }); }
  gt(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = value; cl._core.seed.exclMin = true; cl._core.innerMeta("gt", meta); }); }
  gte(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = value; cl._core.seed.exclMin = false; cl._core.innerMeta("gte", meta); }); }
  lt(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = value; cl._core.seed.exclMax = true; cl._core.innerMeta("lt", meta); }); }
  lte(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = value; cl._core.seed.exclMax = false; cl._core.innerMeta("lte", meta); }); }
  eq(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = value; cl._core.seed.min = value; cl._core.seed.exclMax = false; cl._core.innerMeta("eq", meta); }); }
  multipleOf(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.multOf = value; cl._core.innerMeta("multipleOf", meta); }); }

  /** @deprecated Use multipleOf() instead */
  step(value: T, meta?: tsDnaMeta) { return this.multipleOf(value, meta); }
  /** @deprecated No-op in DNA, returns this */
  finite() { return this.clone(); }
  /** Safe integer: an integer within [MIN_SAFE_INTEGER, MAX_SAFE_INTEGER]. */
  safe() {
    // `int()` carries over existing bounds; clamp them to the safe-integer range
    // (intersect, so any tighter user bound wins).
    const impl = this.int() as unknown as NumberImpl<number>;
    if (impl._core.seed.min === null || impl._core.seed.min < Number.MIN_SAFE_INTEGER) impl._core.seed.min = Number.MIN_SAFE_INTEGER;
    if (impl._core.seed.max === null || impl._core.seed.max > Number.MAX_SAFE_INTEGER) impl._core.seed.max = Number.MAX_SAFE_INTEGER;
    return impl;
  }

  int() {
    // if (this._core.seed.min !== null) {
    //   if (this._core.seed.exclMin) stateimpl.gt(this._core.seed.min as number);
    //   else impl.gte(this._core.seed.min as number);
    // }
    // if (this._core.seed.max !== null) {
    //   if (this._core.seed.exclMax) impl.lt(this._core.seed.max as number);
    //   else impl.lte(this._core.seed.max as number);
    // }
    // if (this._core.seed.multOf !== null) impl.multipleOf(this._core.seed.multOf as number);
    const impl = initDna(DnaInt, this._core.seed, this._core.meta);
    return impl;
  }

  positive() { return cloner(this, cl => { cl._core.seed.min = 0 as T; cl._core.seed.exclMin = true; }); }
  nonnegative() { return cloner(this, cl => cl._core.seed.min = 0 as T); }
  negative() { return cloner(this, cl => { cl._core.seed.max = 0 as T; cl._core.seed.exclMax = true; }); }
  nonpositive() { return cloner(this, cl => cl._core.seed.max = 0 as T); }

  override get templateRegex(): string { return this._core.seed.min === null && this._core.seed.max === null && this._core.seed.multOf === null ? "-?\\d+(?:\\.\\d+)?" : "\x00"; }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const selfDna: tsDna = [this._core.state.type as tsDnaOpcode, [this._core.seed.min, this._core.seed.exclMin, this._core.seed.max, this._core.seed.exclMax, this._core.seed.multOf], this.meta()];
    return coll.storeDNA(selfDna, storeMark, storePosition);
  }
}

export class DnaNumber extends NumberImpl<number> { }

export class DnaBigInt extends NumberImpl<bigint> {
  protected override _core = numCoreFactory<bigint>("bi", "toBigInt");
  // static create(): any { return this.init<bigint>("bi", "toBigInt"); }
  // int() and safe() are not applicable to bigint, so they are not implemented
  override positive() { return cloner(this, cl => { cl._core.seed.min = BigInt(0); cl._core.seed.exclMin = true; }); }
  override nonnegative() { return cloner(this, cl => cl._core.seed.min = BigInt(0)); }
  override negative() { return cloner(this, cl => { cl._core.seed.max = BigInt(0); cl._core.seed.exclMax = true; }); }
  override nonpositive() { return cloner(this, cl => cl._core.seed.max = BigInt(0)); }

  override get templateRegex(): string { return this._core.seed.min === null && this._core.seed.max === null && this._core.seed.multOf === null ? "-?\\d+n" : "\x00"; }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const selfDna: tsDna = [this.type as tsDnaOpcode, [this._core.seed.min, this._core.seed.exclMin, this._core.seed.max, this._core.seed.exclMax, this._core.seed.multOf], this.meta()];
    return coll.storeDNA(selfDna, storeMark, storePosition);
  }
}

export class DnaInt extends NumberImpl<number> {
  protected override _core = numCoreFactory<number>("i", "toInt");
  // static create(): any { return this.init<number>("i", "toInt"); }
  override get templateRegex(): string { return this._core.seed.min === null && this._core.seed.max === null && this._core.seed.multOf === null ? "-?\\d+" : "\x00"; }
}

export class DnaInt32 extends NumberImpl<number> {
  protected override _core = numCoreFactory<number>("i", "toInt", false, INT32Bounds);
  // static create(): any {
  //   const inst = this.init<number>("i", "toInt");
  //   (inst as any)._core.state.min = -(2 ** 31);
  //   (inst as any)._core.state.max = 2 ** 31 - 1;
  //   return inst;
  // }

  override get templateRegex(): string { return this._core.seed.min === null && this._core.seed.max === null && this._core.seed.multOf === null ? "-?\\d+" : "\x00"; }

  override min(value: number) { return cloner(this, cl => cl._core.seed.min = Math.max(cl._core.seed.min!, value)); }
  override max(value: number) { return cloner(this, cl => cl._core.seed.max = Math.min(cl._core.seed.max!, value)); }
  override gt(value: number) { return cloner(this, cl => { cl._core.seed.min = Math.max(cl._core.seed.min!, value); cl._core.seed.exclMin = true; }); }
  override gte(value: number) { return cloner(this, cl => { cl._core.seed.min = Math.max(cl._core.seed.min!, value); cl._core.seed.exclMin = false; }); }
  override lt(value: number) { return cloner(this, cl => { cl._core.seed.max = Math.min(cl._core.seed.max!, value); cl._core.seed.exclMax = true; }); }
  override lte(value: number) { return cloner(this, cl => { cl._core.seed.max = Math.min(cl._core.seed.max!, value); cl._core.seed.exclMax = false; }); }
  override multipleOf(value: number) { return cloner(this, cl => cl._core.seed.multOf = Math.max(cl._core.seed.min!, Math.min(cl._core.seed.max!, value))); }
}


export class DnaCoerceString extends DnaString { protected override _core = strCoreFactory("", true); }
export class DnaCoerceNumber extends DnaNumber { protected override _core = numCoreFactory<number>("n", "toNumber", true); }
export class DnaCoerceInt extends DnaInt { protected override _core = numCoreFactory<number>("i", "toInt", true); }
export class DnaCoerceInt32 extends DnaInt32 { protected override _core = numCoreFactory<number>("i", "toInt", true, INT32Bounds); }
export class DnaCoerceBigInt extends DnaBigInt { protected override _core = numCoreFactory<bigint>("bi", "toBigInt", true); }

export class DnaCoerceBoolean extends DnaBoolean { protected override _core = new BaseCore("b", { coerce: true, coerceCode: "toBoolean", rawDna: ["b"] }); }
export class DnaCoerceDate extends DnaDate { protected override _core = new BaseCore<{ min: Date | null, max: Date | null }>("date", { coerce: true, coerceCode: "toDate", seed: { min: null, max: null } }); }

// Coerce implementation - static methods
export class Coerce {
  // Coercion is now a serialization layer driven by the `_coerce` flag on the
  // base schema (see SchemaImpl._emitCoerce). No wrapper instance / toDna
  // substitution is needed: the impl is returned as-is, only flagged.
  static string() { return initDna(DnaCoerceString); }
  static number() { return initDna(DnaCoerceNumber); }
  static int() { return initDna(DnaCoerceInt); }
  static int32() { return initDna(DnaCoerceInt32); }
  static boolean() { return initDna(DnaCoerceBoolean); }
  static bigint() { return initDna(DnaCoerceBigInt); }
  static date() { return initDna(DnaCoerceDate); }
}

// Enum implementation: a single generic parameter T, mirroring Zod's ZodEnum<T>.
// T is always the enum object (arrays are converted to objects by the factory).
export class DnaEnum<T extends tsDnaEnumLike> extends DnaTypeWithWrappers<
  T[keyof T],
  T[keyof T]
> {

  protected override _core = new BaseCore<{ enumObj: T }>("enum");

  get values(): T[keyof T][] { return Object.values(this._core.seed.enumObj) as T[keyof T][]; }
  get options(): T[keyof T][] { return Object.values(this._core.seed.enumObj) as T[keyof T][]; }

  get enum() { return this._core.seed.enumObj; }

  extract(values: tsDnaEnumValueType[]) {
    return cloner(this, cl => cl._core.seed.enumObj = Object.fromEntries(Object.entries(cl._core.seed.enumObj).filter(([k, v]) => values.includes(v))) as T);
  }
  exclude(values: tsDnaEnumValueType[]) {
    return cloner(this, cl => cl._core.seed.enumObj = Object.fromEntries(Object.entries(cl._core.seed.enumObj).filter(([k, v]) => !values.includes(v))) as T);
  }

  override get templateRegex(): string {
    // Don't escape enum values for template literal context
    // They are literal strings, not regex patterns
    this._core.templateRegex = "(?:" + this.values.map((v) => String(v)).join("|") + ")";
    return this._core.templateRegex;
  }

  // override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this._core.rawDna = ["e", this.values];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, this.values);
  }
}

// Array implementation
export class DnaArray<S extends DnaType<any, any>> extends DnaTypeWithWrappers<$Output<S>[], $Input<S>[]> {
  protected override _core = new BaseCore<{ itemSchema: S, min: number | null, max: number | null, length: number | null }>("array");

  // static init<S extends DnaType<any, any>>(itemSchema: S): any {
  //   return this.initCore<S[], S[], tsStateArray<S>>("array", { min: null, max: null, length: null, itemSchema });
  // }

  override unwrap<W extends S>(): W { //wrap for Array is not wrap for wrapper, unwrap of wrapper override until there is no wrapper anymore.
    return this._core.seed.itemSchema as W;
  }

  min(n: number, meta?: string | tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = n; cl._core.innerMeta("min", meta); }); }
  max(n: number, meta?: string | tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = n; cl._core.innerMeta("max", meta); }); }
  length(n: number, meta?: string | tsDnaMeta) { return cloner(this, cl => { cl._core.seed.length = n; cl._core.innerMeta("length", meta); }); }
  nonempty() { return cloner(this, cl => cl._core.seed.min = 1); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const constraints: any[] = [];
    if (this._core.seed.min !== null) constraints.push(["minItems", this._core.seed.min]);
    if (this._core.seed.max !== null) constraints.push(["maxItems", this._core.seed.max]);
    if (this._core.seed.length !== null) {
      constraints.push(["minItems", this._core.seed.length]);
      constraints.push(["maxItems", this._core.seed.length]);
    }
    const itemsDef = ["items", -1];
    const itemsStoreId = coll.setStore(itemsDef);
    constraints.push(itemsDef);
    this._core.rawDna = ["a", constraints];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, itemsStoreId);
    this._core.setDnaId(coll, dnaId);
    this._core.seed.itemSchema.toDna(coll, itemsStoreId, 1);
    return dnaId;
  }
}

// Promise implementation
function nonPromiseIssue(value: unknown): tsParserError {
  return { message: `Non-Promise type: ${value === null ? "null" : typeof value}`, path: "#", input: value };
}

function syncPromiseIssue(value: unknown): tsParserError {
  return { message: "Promise cannot be resolved synchronously. Use safeParseAsync or parseAsync.", path: "#", input: value };
}
// TODO: comment about depreciation of dna.promise
export class DnaPromise<T, I = unknown> extends DnaTypeWithWrappers<T, I> {
  protected override _core = new BaseCore<{ inner: DnaType<T, I> }>("promise");

  // static init<T, I = unknown>(innerSchema: DnaType<T>): any {
  //   return this.initCore<T, I, tsStatePromise<T, I>>("promise", { innerSchema: innerSchema as any });
  // }

  override unwrap<W extends DnaType<T, I>>(): W {
    return this._core.seed.inner as W;
  }

  override safeParse(value: unknown, _ctx?: tsDnaExternals): tsDnaParserResult {
    if (!(value instanceof Promise)) return { success: false, errors: [nonPromiseIssue(value)] };
    throw new DnaError([syncPromiseIssue(value)]);
  }

  override parse(value: unknown, ctx?: tsDnaExternals): T {
    const res = this.safeParse(value, ctx);
    if (res.success) return res.data;
    throw new DnaError(res.errors);
  }

  override async safeParseAsync(value: unknown, ctx?: tsDnaExternals): Promise<tsDnaParserResult> {
    const resolved = value instanceof Promise ? await value : value;
    return this._core.seed.inner.safeParseAsync(resolved, ctx);
  }

  override async parseAsync(value: unknown, ctx?: tsDnaExternals): Promise<T> {
    const resolved = value instanceof Promise ? await value : value;
    return this._core.seed.inner.parseAsync(resolved, ctx);
  }

  override validate(value: unknown, _ctx?: tsDnaExternals): boolean {
    if (!(value instanceof Promise)) return false;
    throw new DnaError([syncPromiseIssue(value)]);
  }

  override async validateAsync(value: unknown, ctx?: tsDnaExternals): Promise<boolean> {
    try {
      const resolved = value instanceof Promise ? await value : value;
      return this._core.seed.inner.validateAsync(resolved, ctx);
    } catch {
      return false;
    }
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const innerState: tsDna = ["promise", -1, this._core.meta];
    const innerStoreId = coll.setStore(innerState);
    const dnaId = coll.storeDNA(innerState, storeMark, storePosition, innerStoreId);
    this._core.seed.inner.toDna(coll, innerStoreId, 1);
    return dnaId;
  }
}

// Tuple implementation (Zod's z.tuple(items, rest?)): one schema per position,
// plus an optional rest schema for any extra items.
export class DnaTuple<S extends tsDnaTupleSchemaRO, R = never> extends DnaTypeWithWrappers<
  tsDnaTupleValueWithRest<S, R>,
  tsDnaTupleValueWithRest<S, R>
> {
  protected override _core = new BaseCore<{ items: S, rest?: DnaType<R> }>("tuple");

  // static init<S extends tsDnaTupleSchemaRO, R = never>(items: S, rest?: DnaType<R>): any {
  //   return this.initCore<tsDnaTupleValueWithRest<S, R>, tsDnaTupleValueWithRest<S, R>, tsStateTuple<S, R>>("tuple", { items, rest });
  // }

  min(n: number, meta?: string | tsDnaMeta) { return cloner(this, () => { }); }
  max(n: number, meta?: string | tsDnaMeta) { return cloner(this, () => { }); }
  length(n: number, meta?: string | tsDnaMeta) { return cloner(this, () => { }); }
  nonempty() { return cloner(this, () => { }); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const len = this._core.seed.items.length;
    const prefixItems = new Array(len);
    const prefixStoreId = coll.setStore(prefixItems);
    // No rest -> `items: false` (no extra items, Zod default). Rest -> the rest schema id.
    const itemsDef: any[] = ["items", this._core.seed.rest ? 0 : false];
    const itemsStoreId = this._core.seed.rest ? coll.setStore(itemsDef) : -1;
    const constraints: any[] = [
      ["prefixItems", prefixItems],
      ["minItems", len],
      itemsDef,
    ];
    this._core.rawDna = ["a", constraints];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, prefixStoreId);
    this._core.setDnaId(coll, dnaId);
    for (let poz = len; poz--;) this._core.seed.items[poz].toDna(coll, prefixStoreId, poz);
    if (this._core.seed.rest) this._core.seed.rest.toDna(coll, itemsStoreId, 1);
    return dnaId;
  }
}

// Object implementation
export class DnaObject<T extends Record<string, DnaType<any, any>> = Record<string, DnaType<any, any>>> extends DnaTypeWithWrappers<$DnaObjectOutput<T>, $DnaObjectInput<T>> {
  protected override _core = new BaseCore<{ propertySchemas?: T, addPropSchema?: DnaType<any, any>, objType: 'strict' | 'loose' | 'standard', requiredKeys?: string[] }>("object");

  // static init<T extends Record<string, DnaType<any, any>> = Record<string, DnaType<any, any>>, I = Record<string, unknown>>(propertySchemas?: T, objType: 'strict' | 'loose' | 'standard' = 'standard') {
  //   const inst = this.initCore<T, I, tsStateObject>("object", { propertySchemas, addPropSchema: undefined, objType, requiredKeys: [] });
  //   for (const prop in propertySchemas) {
  //     const desc = Object.getOwnPropertyDescriptor(propertySchemas, prop);
  //     if (desc?.get !== undefined) inst._core.state.propertySchemas[prop] = GetterSchemaImpl.init<T[keyof T]>(desc.get);
  //     else inst._core.state.propertySchemas[prop] = propertySchemas[prop];
  //   }
  //   // A key is required unless its schema carries an absent-tolerant wrapper
  //   // (optional/nullish/default/prefault/catch). `nullable` stays required.
  //   inst._core.state.requiredKeys = Object.keys(inst._core.state.propertySchemas).filter(
  //     k => isRequiredKey(inst._core.state.propertySchemas![k])
  //   );
  //   return inst;
  // }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const constraints: any[] = [];
    this._core.rawDna = ["o", constraints];
    // Schema instances serialize identically in the collector discriminant, so two
    // objects with the same keys but different value schemas (e.g. discriminated-union
    // branches differing only by their `literal` discriminator) would falsely dedupe.
    // Add a per-property signature (leaf opcode + literal value) to distinguish them.
    const propSig = this._core.seed.propertySchemas
      ? Object.entries(this._core.seed.propertySchemas).map(([k, v]) => {
        let leaf: DnaType<any> = v;
        while (leaf instanceof _DnaWrapper) leaf = leaf.unwrap();
        return leaf instanceof DnaLiteral
          ? [k, "l", Array.from(leaf.values)]
          : leaf instanceof DnaEnum
            ? [k, leaf.type, Array.from(leaf.values)]
            : [k, leaf.type];
      })
      : undefined;
    const dnaId = coll.storeDNA(
      this._core.dnaWithMeta,
      storeMark, storePosition,
      [this._core.seed.objType, this._core.seed.requiredKeys, this._core.seed.addPropSchema, propSig]
    );
    this._core.setDnaId(coll, dnaId);
    if (this._core.seed.propertySchemas) {
      const properties: [string, number, tsDnaMeta][] = [];
      const defaultProperties: [string, number, tsDnaMeta][] = [];

      // Store each property schema and update its index.
      // NOTE: optional properties are NOT unwrapped here — the `wrp` wrapper must
      // survive so an explicitly-present `undefined` (e.g. `{ a: undefined }`) is
      // still accepted. Absent keys are handled separately via the required list.
      for (const [key, schema] of Object.entries(this._core.seed.propertySchemas)) {
        const schemaMeta = schema[SymCore].meta;
        // A `lazy`/getter property can't be resolved at object-init time (the
        // recursive const is still in its TDZ), so its key-optionality meta
        // (optional/nullable/default on the recursive ref) is invisible there. At emit
        // time the const exists, so resolve the getter now to read its REAL meta —
        // otherwise an optional/nullable recursive key is wrongly treated as required.
        const realMeta = schema instanceof DnaLazy ? schema.innerType.meta() : schemaMeta;
        const propDef: [string, number, tsDnaMeta] = [key, 0, schemaMeta];
        const propStoreId = coll.setStore(propDef);

        schema.toDna(coll, propStoreId, 1);

        // Mark default/prefault presence in the property meta so `isWrapped` can
        // detect them even when their value is `undefined` or falsy. The actual
        // value lives in the `wrp` opcode params for runtime.
        const propMeta: tsDnaInnerMeta = { ...realMeta };
        let current: DnaType<any> | undefined = schema instanceof DnaLazy ? schema.innerType : schema;
        while (current instanceof _DnaWrapper) {
          if (current.wrapperType === WRAPPERS_XFAULT.default) propMeta.default = true;
          else if (current.wrapperType === WRAPPERS_XFAULT.prefault) propMeta.prefault = true;
          current = current.unwrap();
        }
        if (current?.meta().preprocess) propMeta.preprocess = true;
        propDef[2] = propMeta;

        // A `nonoptional` key is required, so it must NOT go to defaultProperties
        // (which would silently supply the default for an absent key); keep it in
        // `properties` where the default still applies to a present `undefined`.
        if (isWrapped(propMeta)) defaultProperties.push(propDef); else properties.push(propDef);
        // coll.updateStore(propStoreId, schema._core.meta, 2)
      }
      if (properties.length) constraints.push(["properties", properties]);
      if (defaultProperties.length) constraints.push(["defaultProperties", defaultProperties]);
      
      // `requiredKeys` is either explicit (set by `.partial()` / `.required()`) or
      // `undefined` and must be derived from the property schemas. Derivation is
      // deferred until emit because getter properties (recursive lazy refs) could
      // not be resolved at init time.
      const propertySchemas = this._core.seed.propertySchemas || {};
      const explicitRequired = this._core.seed.requiredKeys;
      const requiredKeys = explicitRequired === undefined
        ? Object.keys(propertySchemas).filter(k => isRequiredKey(propertySchemas[k]))
        : explicitRequired.filter(k => {
          const s = propertySchemas[k];
          return !(s instanceof DnaLazy) || isRequiredKey(s.innerType);
        });
      if (requiredKeys.length) constraints.push(["required", requiredKeys]);
    }
    if (this._core.seed.objType === 'strict') {
      constraints.push(["additionalProperties", false]);
    } else if (this._core.seed.objType === 'loose') {
      constraints.push(["additionalProperties", true]);
    } else if (this._core.seed.addPropSchema && typeof this._core.seed.addPropSchema !== 'boolean') {
      // catchall takes precedence over strict/loose
      const addPropDef = ["additionalProperties", 0];
      const addPropStoreId = coll.setStore(addPropDef);
      constraints.push(addPropDef);
      this._core.seed.addPropSchema.toDna(coll, addPropStoreId, 1);
    }
    return dnaId;
  }

  strict() { return cloner(this, cl => cl._core.seed.objType = "strict"); }
  loose() { return cloner(this, cl => cl._core.seed.objType = "loose"); }
  /** @deprecated Use loose() instead */
  passthrough() { return this.loose(); }

  catchall(addPropSchema: DnaType<any, any>) { this._core.seed.addPropSchema = addPropSchema; return this }
  /** Alias of catchall() for compatibility @see catchall() */
  catchAll(addPropSchema: DnaType<any, any>) { return this.catchall(addPropSchema); }

  partial(keys?: Record<string, boolean>) {
    return cloner(this, cl => {
      if (keys) cl._core.seed.requiredKeys = cl._core.seed.requiredKeys?.filter(k => !keys[k]); else cl._core.seed.requiredKeys = [];
      if (cl._core.seed.propertySchemas) {
        for (const key in cl._core.seed.propertySchemas) {
          const schema = cl._core.seed.propertySchemas[key];
          const makeOptional = keys ? keys[key] : true;
          if (makeOptional) {
            const meta = schema[SymCore].meta;
            if (meta && meta.optional === undefined) (cl._core.seed.propertySchemas[key] as DnaType<any, any>) = initDna(DnaOptional, { inner: schema });
          }
        }
      }
    });
  }

  required(keys?: Record<string, boolean>) {
    return cloner(this, cl => {
      if (keys) cl._core.seed.requiredKeys = Object.keys(cl._core.seed.propertySchemas ?? {}).filter(k => keys[k]);
      else cl._core.seed.requiredKeys = Object.keys(cl._core.seed.propertySchemas ?? {});
    });
  }

  get shape(): T | undefined {
    return this._core.seed.propertySchemas;
  }

  keyOf(): PropertyKey[] {
    return Object.keys(this._core.seed.propertySchemas ?? {});
  }

  apply<R>(fn: (schema: this) => R): R {
    return fn(this);
  }

  omit<K extends keyof T>(keys: Record<K, boolean>): DnaObject<Omit<T, K>> {
    if (!this._core.seed.propertySchemas) {
      return this as unknown as DnaObject<Omit<T, K>>;
    }
    const newPropertySchemas: Record<string, DnaType<any>> = {};
    for (const [key, schema] of Object.entries(this._core.seed.propertySchemas)) {
      if (!keys[key as K]) {
        newPropertySchemas[key] = schema;
      }
    }
    const newObject = initDna(DnaObject, { propertySchemas: newPropertySchemas, objType: this._core.seed.objType }, this._core.meta);
    return newObject as unknown as DnaObject<Omit<T, K>>;
  }

  pick<K extends keyof T>(keys: Record<K, boolean>): DnaObject<Pick<T, K>> {
    if (!this._core.seed.propertySchemas) {
      return this as unknown as DnaObject<Pick<T, K>>;
    }
    const newPropertySchemas: Record<string, DnaType<any>> = {};
    for (const [key, schema] of Object.entries(this._core.seed.propertySchemas)) {
      if (keys[key as K]) {
        newPropertySchemas[key] = schema;
      }
    }
    const newObject = initDna(DnaObject, { propertySchemas: newPropertySchemas, objType: this._core.seed.objType }, this._core.meta);
    return newObject as unknown as DnaObject<Pick<T, K>>;
  }

  extend<U extends Record<string, any>>(shape: U): DnaObject<T & U> {
    const newPropertySchemas: Record<string, DnaType<any>> = { ...this._core.seed.propertySchemas };
    for (const [key, schema] of Object.entries(shape)) {
      newPropertySchemas[key] = schema;
    }
    const newObject = initDna(DnaObject, { propertySchemas: newPropertySchemas, objType: this._core.seed.objType }, this._core.meta);
    return newObject as DnaObject<T & U>;
  }
}

/**
 * Finite value SET of a schema, mirroring Zod's `_zod.values` — the closed set of
 * values a schema can match, or `undefined` when it's open-ended. Used by both the
 * discriminated union (branch selection) and `record` (key matching + exhaustiveness):
 * - literal -> its value (or all values for `literal([...])`)
 * - enum -> all members
 * - union (anyOf) -> the union of its members' value sets
 * - pipe / transform (a `seq`) -> the source/first step's value set
 * - wrapper -> inner set plus what the wrapper adds (`optional` -> undefined,
 *   `nullable` -> null, `nullish` -> both; default/prefault/catch add nothing)
 * - `z.null()` / `z.undefined()` -> `null` / `undefined`
 */
function finiteValueSet(s: DnaType<any>): tsPrimitiveLiteral[] | undefined {
  // Unwrap wrappers first so optional/nullable can add their sentinel values.
  if (s instanceof _DnaWrapper) {
    const inner = finiteValueSet(s.unwrap());
    if (!inner) return undefined;
    switch (s.wrapperType) {
      case "optional": return [...inner, undefined];
      case "nullable": return [...inner, null];
      case "nullish": return [...inner, undefined, null];
      default: return inner; // default / prefault / catch
    }
  }
  if (s instanceof DnaPipe) {
    return finiteValueSet(s[SymCore].seed.steps[0]);
  }
  // Use the type itself if _head is not explicitly set (e.g. DnaLiteral, DnaNull, DnaUndefined).
  const head = s._head ?? s;
  if (head instanceof DnaLiteral) {
    return head._rawValues;
  }
  if (head instanceof DnaEnum) return [...head.values];
  if (head instanceof DnaLazy) {
    // Lazy: Zod does not enforce exhaustiveness on lazy schemas
    return undefined;
  }
  if (head instanceof DnaCombinator) {
    if (head[SymCore].seed.combinatorType !== "anyOf") return undefined; // only unions have a value set
    const out: tsPrimitiveLiteral[] = [];
    for (const m of head[SymCore].seed.schemas as DnaType<any>[]) {
      const mv = finiteValueSet(m);
      if (!mv) return undefined;
      out.push(...mv);
    }
    return out;
  }
  if (head instanceof DnaType) {
    if (head.type === "null") return [null];
    if (head.type === "undefined") return [undefined];
  }
  return undefined;
}

// Discriminated union implementation (discriminator opcode)
export class DnaDiscriminatedUnion<K extends string, S extends tsDnaDiscriminatedUnionObjects<K>> extends DnaTypeWithWrappers<
  $Output<S[number]>,
  $Input<S[number]>
> {
  protected override _core = new BaseCore<{ discriminator: K, schemas: S }>("discriminator");

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const schemas = this._core.seed.schemas;
    const discriminator = this._core.seed.discriminator;
    const nbItems = schemas.length;

    const discriminDef = new Array<tsDnaId | undefined>(1 + nbItems);
    const discriminKeys = new Array<tsPrimitiveLiteral>(nbItems);
    const discriminStoreId = coll.setStore(discriminDef);
    const discRequired = [discriminator];

    for (let i = 0; i < nbItems; i++) {
      const schema = schemas[i];
      if (!(schema instanceof DnaObject)) {
        throw new Error(`Discriminated union branch at index ${i} must be a DnaObject`);
      }
      const discriminatorSchema = schema.shape?.[discriminator];
      if (!discriminatorSchema) {
        throw new Error(`Discriminated union branch at index ${i} is missing discriminator '${discriminator}'`);
      }
      const values = finiteValueSet(discriminatorSchema);
      if (!values || values.length === 0) {
        throw new Error(`Discriminator value in branch at index ${i} must be a finite primitive (literal, enum, null, undefined, or optional/nullable of one of these)`);
      }
      discriminKeys[i] = values[0];
    }

    this._core.rawDna = ["discriminator", discriminator, discriminKeys, discriminDef];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, discriminStoreId);
    this._core.setDnaId(coll, dnaId);

    const prevalidation = initDna(DnaObject, { objType: 'standard', requiredKeys: discRequired });
    prevalidation.toDna(coll, discriminStoreId, 0);
    for (let i = 0; i < nbItems; i++) {
      schemas[i].toDna(coll, discriminStoreId, 1 + i);
    }

    return dnaId;
  }
}


// Record implementation
export class DnaRecord<K extends DnaType<PropertyKey, any>, V extends DnaType<any, any>> extends DnaTypeWithWrappers<
  Record<$Output<K>, $Output<V>>,
  Record<$Input<K>, $Input<V>>
> {

  protected override _core = new BaseCore<{ keySchema: K, valueSchema: V, type: "partial" | "loose" | "standard" }>("record")

  // static init<K extends DnaType<any>, V extends DnaType<any>, I = Record<$Output<K>, $Output<V>>>(keySchema: K, valueSchema: V, type: "partial" | "loose" | "standard" = "standard"): any {
  //   return this.initCore<Record<$Output<K>, $Output<V>>, I, tsStateRecord<K, V>>("record", { keySchema, valueSchema, type });
  // }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const keySchema = this._core.seed.keySchema;
    // A record matches only a *plain* object (Zod `z.record` rejects Date/Map/class
    // instances, unlike `z.object`). The "o" compiler turns this flag into a
    // prototype check (Object.prototype | null).
    const constraints: any[] = [["plainObject"]];

    // loose: keys matching the key schema validate their value; non-matching keys
    // pass through unchanged. Modeled as `patternProperties(keyPattern -> value)` +
    // `additionalProperties: true`, reusing the tested pattern-matching path. The
    // pattern is the key schema's `templateRegex` (e.g. `string().regex(/^S_/)` ->
    // "^S_"; plain `string()` -> ".*" so every key matches and every value is checked).
    if (this._core.seed.type === "loose") {
      const keyPattern = keySchema.templateRegex;
      const patternPair: [string, number] = [keyPattern, 0];
      const patternStoreId = coll.setStore(patternPair);
      constraints.push(["patternProperties", [patternPair]]);
      constraints.push(["additionalProperties", true]);
      this._core.rawDna = ["o", constraints];
      const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
      this._core.seed.valueSchema.toDna(coll, patternStoreId, 1);
      return dnaId;
    }

    const valueDef = ["additionalProperties", 0];
    const valueStoreId = coll.setStore(valueDef);

    // A key schema with a FINITE value set (enum, literal, literal-array, union of
    // literals, `enum().pipe(...)`, typescript enum) means the record is keyed by a
    // closed set of values. Object keys are always strings, so we match against the
    // stringified members (which also handles numeric members: literal(21) -> "21",
    // enum 0 -> "0"). A `standard` record is exhaustive (every member required); a
    // `partial` record allows any subset.
    const valueSet = finiteValueSet(keySchema);
    const finiteKeys = valueSet ? [...new Set(valueSet.filter(v => v != null).map(v => String(v)))] : undefined;

    if (finiteKeys && finiteKeys.length) {
      const keyDef = ["propertyNames", 0, "string"];
      const keyStoreId = coll.setStore(keyDef);
      constraints.push(keyDef, valueDef);
      if (this._core.seed.type !== "partial") constraints.push(["required", finiteKeys]);
      this._core.rawDna = ["o", constraints];
      const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
      // Use head to check if the root schema is a literal array
      const head = keySchema._head;
      const isLiteralArray = head instanceof DnaLiteral && head._rawValues.length > 1;
      // Preserve pipe/seq/transform/refine key schemas before falling back to
      // EnumImpl for literal arrays or other finite schemas.
      const hasRefiners = keySchema[SymCore].refinerList.length > 0;
      if (
        keySchema.type === "pipe" ||
        keySchema.type === "seq" ||
        keySchema.type === "transform" ||
        hasRefiners ||
        (keySchema instanceof DnaType && keySchema[SymCore].seed.wrapperType === "transform")
      ) {
        keySchema.toDna(coll, keyStoreId, 1);
      } else if (isLiteralArray) {
        initDna(DnaEnum, { enumObj: Object.fromEntries(finiteKeys.map((k) => [k, k])) }).toDna(coll, keyStoreId, 1);
      } else {
        initDna(DnaEnum, { enumObj: Object.fromEntries(finiteKeys.map((k) => [k, k])) }).toDna(coll, keyStoreId, 1);
      }
      this._core.seed.valueSchema.toDna(coll, valueStoreId, 1);
      return dnaId;
    }

    const keyDef = ["propertyNames", 0, null];
    const keyStoreId = coll.setStore(keyDef);
    constraints.push(keyDef, valueDef);

    this._core.rawDna = ["o", constraints];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);

    const coercedKeySchema = keySchema[SymForceCoerce]();
    coercedKeySchema.toDna(coll, keyStoreId, 1);

    this._core.seed.valueSchema.toDna(coll, valueStoreId, 1);
    return dnaId;
  }
}


// Codec implementation - bidirectional encode/decode
// Decode direction reuses the BASE `#state` validator/parser cache (DnaCodec
// overrides `toDna()` to return the decode twin, so the base `_validate`/`_safeParse`
// build the right thing). Only the ENCODE direction needs its own cache here.
export class DnaCodec<I, O> extends DnaTypeWithWrappers<O, I> {
  protected override _core = new BaseCore<{ decodeTwin: DnaType<O>, encodeTwin: DnaType<I>, cachedEncodeParser?: tsDnaParserFn }>("codec");
  // Emit the decode twin as this codec's own node via `_emitSelf` (NOT a `toDna`
  // override) so the base refiner layer (`_emitRefiners`) still wraps any
  // `.refine()`/`.check()` added on the codec around it. A `toDna` override returned
  // the twin directly and silently dropped codec-level refinements.
  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    return this._core.seed.decodeTwin.toDna(coll, storeMark!, storePosition);
  }

  // Decode direction (`_validate`/`_safeParse`) is inherited: the base builds from
  // `this.toDna()` and caches in `#state`.

  override safeEncode(value: unknown, ctx?: tsDnaExternals): tsDnaParserResult {
    if (this._core.seed.cachedEncodeParser) return this._core.seed.cachedEncodeParser(value);
    this._core.seed.cachedEncodeParser = parserBuilder(this._core.seed.encodeTwin.toDna(), ctx);
    return this._core.seed.cachedEncodeParser(value);
  }
}



export class DnaLazy<S extends DnaType<any, any>> extends DnaTypeWithWrappers<$Output<S>, $Input<S>> {
  protected override _core = new BaseCore<{ getter: () => S }>("lazy");

  get innerType(): S {
    return this._core.seed.getter();
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const dna: tsDna = ["ref", -1, this._core.meta];
    const storeId = coll.setStore(dna);
    const dnaId = coll.storeDNA(dna, storeMark, storePosition, storeId);
    this._core.setDnaId(coll, dnaId); // to prevent recursive
    const getterDnaId = this.innerType.toDna(coll, storeId, 1);
    coll.refList.add(getterDnaId);
    this._core.rawDna = dna;
    return dnaId;
  }
}


export class DnaFunction<I extends DnaFunctionInput = never, O = unknown> extends DnaTypeWithWrappers<
  tsFunctionType<I, O>,
  tsFunctionType<I, O>
> {
  protected override _core = new BaseCore<{ input: I, output: DnaType<O> }>("function");


  input<NewI extends DnaFunctionInput>(input: NewI, rest?: DnaType): DnaFunction<NewI, O> {
    let actualInput: DnaFunctionInput | DnaType = input;
    if (rest !== undefined) {
      actualInput = initDna(DnaTuple, { items: input as tsDnaTupleSchemaRO, rest });
    } else if (!(input instanceof DnaType)) {
      actualInput = initDna(DnaTuple, { items: input as tsDnaTupleSchemaRO });
    }
    const newSchema = initDna(DnaFunction<NewI, O>, { input: actualInput as unknown as NewI, output: this._core.seed.output }, this._core.meta);
    newSchema._core.rawDna = this._core.rawDna;
    return newSchema;
  }

  output<NewO>(output: DnaType<NewO>): DnaFunction<I, NewO> {
    const newSchema = initDna(DnaFunction<I, NewO>, { input: this._core.seed.input, output }, this._core.meta);
    newSchema._core.rawDna = this._core.rawDna;
    return newSchema;
  }

  /**
   * Normalizes `_core.seed.input` (either a raw tuple schema or an
   * already-built `DnaType`, see `.input()` above) into a concrete `DnaType`
   * usable with `.parse()`/`.parseAsync()` — args are validated as a tuple.
   */
  private _inputSchema(): DnaType<DnaFunctionArgs<I>> {
    const raw = this._core.seed.input;
    return (raw instanceof DnaType ? raw : initDna(DnaTuple, { items: raw as tsDnaTupleSchemaRO })) as DnaType<DnaFunctionArgs<I>>;
  }

  /**
   * `z.function().implement(fn)` equivalent: returns a wrapped function that
   * validates arguments against `.input()` before calling `fn`, then validates
   * the return value against `.output()`. Throws (via `DnaType.parse()`) on
   * either side mismatching — never silently passes invalid data through.
   */
  implement(fn: (...args: DnaFunctionArgs<I>) => O): (...args: DnaFunctionArgs<I>) => O {
    const inputSchema = this._inputSchema();
    const outputSchema = this._core.seed.output;
    return (...args: DnaFunctionArgs<I>): O => {
      const parsedArgs = inputSchema.parse(args);
      const result = fn(...parsedArgs);
      return outputSchema.parse(result);
    };
  }

  /**
   * Async counterpart: awaits `fn`'s result (sync or async, per `$MaybeAsync`)
   * and validates both sides via `parseAsync` — required so async refiners/
   * transforms on `.input()`/`.output()` schemas are honored (see `AsyncFunction`
   * guard in `validate`/`safeParse`).
   */
  implementAsync(fn: (...args: DnaFunctionArgs<I>) => $MaybeAsync<O>): (...args: DnaFunctionArgs<I>) => Promise<O> {
    const inputSchema = this._inputSchema();
    const outputSchema = this._core.seed.output;
    return async (...args: DnaFunctionArgs<I>): Promise<O> => {
      const parsedArgs = await inputSchema.parseAsync(args);
      const result = await fn(...parsedArgs);
      return await outputSchema.parseAsync(result);
    };
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }
}


export class DnaCustom<TSType extends any = any, I = TSType> extends DnaTypeWithWrappers<TSType, I> {
  protected override _core = new BaseCore<{ fn: (v?: TSType) => boolean }>("custom", { templateRegex: "" });

  protected override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this.refine(this._core.seed.fn, undefined);
    return super._toDna(coll, storeMark, storePosition)
  }

}

export class DnaInstanceOf<T extends abstract new (...args: any[]) => any, O = InstanceType<T>> extends DnaTypeWithWrappers<O, O> {
  protected override _core = new BaseCore<{ constructor: T }>("instanceOf", {
    seed: { constructor: null as any }
  });

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const constructorName = this._core.seed.constructor.name;
    registerExternal(constructorName, this._core.seed.constructor);
    this._core.rawDna = ["instanceOf", constructorName];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }
}

export class DnaFile extends DnaTypeWithWrappers<File, File> {
  protected override _core = new BaseCore<{ constructor: new (...args: any[]) => File, min?: number, max?: number, mime?: string | string[] }>("instanceOf", {
    seed: { constructor: File }
  });

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const constructorName = this._core.seed.constructor.name;
    registerExternal(constructorName, this._core.seed.constructor);
    this._core.rawDna = ["instanceOf", constructorName];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }

  min(bytes: number): this { return cloner(this, cl => { cl._core.seed.min = bytes; cl._core.innerMeta("min", bytes); }); }
  max(bytes: number): this { return cloner(this, cl => { cl._core.seed.max = bytes; cl._core.innerMeta("max", bytes); }); }
  mime(mimeType: string | string[]): this { return cloner(this, cl => { cl._core.seed.mime = mimeType; cl._core.innerMeta("mime", mimeType); }); }
}

// ============================================
// Property Check Schema for type-safe property validation (Zod V4 compatibility)
// ============================================
// export class DnaProperty<K extends string | number, S extends DnaType<any, any, any>> implements tsDnaPropertyCheck<K, S> {
export class DnaProperty<K extends string | number, S extends DnaType<any, any> = DnaType<any, any>> {
  protected _core = new BaseCore<{ property: K, schema: S }>("property");

  kind: "property" = "property";
  get property(): K { return this._core.seed.property; }
  get schema(): S { return this._core.seed.schema; }

}

export type DnaJsonRaw = DnaUnion<[
  DnaString,
  DnaNumber,
  DnaBoolean,
  DnaNull,
  DnaArray<DnaJson>,
  DnaRecord<DnaString, DnaJson>
]>;
export type DnaJson = DnaLazy<DnaJsonRaw>;