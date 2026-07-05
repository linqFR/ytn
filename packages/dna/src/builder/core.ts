/**
 * DNA Schema Builder Core
 *
 * Discriminated schema types and implementation export classes
 */
import type { IAddIssue, IRefinerErrorOpt, tsRefineOptions } from "../shared/error.types.js";
import type {
  tsCheckOpt,
  tsDecodeFn,
  tsEncodeFn,
  tsTmplLitArg,
  tsTmplPartPrimitives,
  tsTransformFn
} from "../shared/handlers-builder.types.js";
import type { tsExternalsDecl } from "../shared/runtime.types.js";
import type {
  ICheckContext,
  IContext,
  IRefineContext,
  ISuperRefineContext,
  ITransformContext,
  tsDnaMeta,
  tsDnaInnerMeta
} from "../shared/meta-context.type.js";
import type {
  tsExternals,
  tsParserFn,
  tsParserResult,
  tsValidatorFn
} from "../shared/runtime.types.js";
import type {
  tsStateFull,
  tsStateDef,
  tsStateLiteral,
  tsStateString,
  tsStateNumber,
  tsStateBoolean,
  tsStateEnum,
  tsStateArray,
  tsStateObject,
  tsStateRecord,
  tsStateTuple,
  tsStateDate,
  tsStateUrl,
  tsStateBigInt,
  tsStateInt,
  tsStateInt32,
  tsStateStringBool,
  tsStateTemplateLiteral,
  tsStateTemplateLiteralMutate,
  tsStatePromise,
  tsStateCodec,
  tsStateGetter,
  tsStateSeqRaw,
  tsStateSeq,
  tsStateWrp,
  tsStateDiscriminator,
  tsStateCombinator,
  tsStatePropCheck,
  tsWrpTypes,
} from "./state.types.js";

import { stringify } from "@ytn/shared/js/json.js";
import { deepMerge, isPureObject } from "@ytn/shared/js/object-utils.js";
import { isWrapped, WRAPPERS_PREPROCESS, ABSENT_TOLERANT_WRAPPERS, WRAPPERS_KEYOPT } from "../shared/constants.js";
import { STRING_FORMAT_PATTERNS, escReg, numRegex } from "../shared/string-format.js";
import { parserBuilder, validatorBuilder } from "../toJs/dna-to-js.js";
import type {
  $DnaInfer,
  $DnaInferInput,
  $SeqLastOutput,
  $ValidatePipeArgs,
  IDnaCollector,
  IDnaLazySchema,
  tsDnaType,
  tsStoreMark,
  tsStorePosition
} from "../shared/base.types.js";
import type {
  schNumberMethods,
  schPseudoTypeMethods,
} from "../../_archives/builder.types.js";
import type {
  tsDnaArray,
  tsDnaBigInt,
  tsDnaBoolean,
  tsDnaCheck,
  tsDnaDefault,
  tsDnaEnum, tsDnaInteger,
  tsDnaInteger32, tsDnaLiteral, tsDnaNullable,
  tsDnaNullish,
  tsDnaEnumValueType,
  tsDnaEnumValues,
  tsDnaEnumInput,
  tsDnaNumber,
  tsDnaObject,
  tsDnaOptional,
  tsDnaPrefault,
  tsDnaString,
  tsDnaTmplLit,
  tsDnaTuple, tsDnaTupleSchemaBase,
  tsDnaTupleSchemaRO,
  tsDnaTupleValueWithRest,
  tsDnaUnion, tsDnaUrl,
  tsDnaPipe,
  tsDnaIntersection,
  tsDnaXorUnion,
  tsDnaCodec, tsDnaPropertyCheck,
  $ApiClass,
  tsAllDnaTypes
} from "../types/api-builder.types.js";
import { StateManager, type tsStateMgrInst } from "./state-manager.js";
import type { tsDna, tsDnaId, tsDnaNoMeta, tsDnaOpcode, tsDnaSeq } from "../types/core.types.js";
import type { $CatchValue, $Input, $MaybeAsync, $Output, $State, $UnionToIntersection, $WithBrand, $Xor } from "../types/helpers.types.js";
import type { $toAPIClass } from "./type-mapper.types.js";


// ============================================
// DNA Collector
// ===========================================

export class DnaCollector implements IDnaCollector {
  dnaList: tsDna[] = [];
  dnaCache = new Map<string, number>();
  count = 0;
  refList: tsDnaId[] = [];
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
    const key = stringify([dna, discriminant]);
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
    return [...this.dnaList, this.refList];
  }
}

// ============================================
// Factories
// ===========================================

export function pipeFactory<T, U, I>(src: tsDnaType<T, I>, target: tsDnaType<U, T>): tsDnaType<U, I> {
  return src.pipe(target);
}


/** Normalize an externals declaration into a mapper `{ nameInFn: externalsKey }`
 * (identity by default). Array form derives names from `.name`; object form uses keys. */
export function externalsMap(externals?: tsExternalsDecl): Record<string, string> {
  const map: Record<string, string> = {};
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

export function transformFactory<T, R>(fn: tsTransformFn<T, R>, externals?: tsExternalsDecl): tsDnaType<R, T> {
  // External names live in `meta.externals` (not the opt tuple) so the DNA opcode shape
  // `["transform", [fnStr, arity], meta]` is unchanged.
  const map = externalsMap(externals);
  if (typeof fn === "function") {
    const s = DnaGenericWrapped.init<R, T>("transform", ["transform", [fn.toString(), fn.length]]);
    return Object.keys(map).length ? s._core.rawMeta({ externals: map }) : s;
  }
  return DnaGenericWrapped.init<R, T>("transform", ["transform", ["()=>" + stringify(fn), 0]]);
}

export function preprocessFactory<O>(fn: (value: unknown) => O, target: tsDnaType<O, O>): tsDnaType<O> {
  const trueSchema = DnaGenericWrapped.init<O, unknown>("unknown", ["T"]);
  const transformSchema = trueSchema.transform(fn);
  // Tag as `preprocess` so an enclosing object treats the key as not-required and
  // always-evaluated (the preprocess runs on `undefined` for an absent key, matching
  // Zod, whose preprocess input is `unknown`).
  return pipeFactory(transformSchema, target).meta({ [WRAPPERS_PREPROCESS.preprocess]: true });
}

function metaNormalize(meta?: string | tsDnaInnerMeta, target?: string): tsDnaInnerMeta {
  if (meta === undefined) return {};
  let _meta: any;
  if (typeof meta === "string") _meta = { error: meta };
  else _meta = meta;
  if (target) return { "~inner": _meta };
  return _meta
}

export function cloner<T extends SchemaImpl<any, any, tsStateDef>>(schema: T, fn: (cl: T) => void): T {
  const cl = schema.clone();
  // Preserve head reference (all schemas in a chain point to the same head)
  if (cl._core && schema._core instanceof StateManager && schema._core.head) cl._core.setHead(schema._core.head);
  fn(cl);
  return cl;
}

export function withMeta<T>(instance: T, meta?: string | tsDnaMeta): T {
  if (meta === undefined || !(instance instanceof SchemaImpl)) return instance;
  return instance.meta(meta);
};



// ============================================
// Schema Builder export class (with discriminated types)
// ============================================

export class SchemaImpl<T, I = unknown, StateDef extends tsStateDef = tsStateDef> implements tsDnaType<T, I, StateDef> {
  declare _output: T;
  declare _input: I;
  declare _stateDef: StateDef;

  #mapper = new Map<IDnaCollector, tsDnaId>();


  // _core is already defined dans tsDnaType
  _core!: tsStateMgrInst<StateDef>;
  get _head(): tsDnaType<any> | undefined { return this._core.head; }
  get description(): string | undefined { return this._core.state.meta.description; }
  get type() { return this._core.fullState.type; }

  /**
   * Coercion mutator (e.g. "toNumber") applied as the OUTERMOST serialization
   * layer. Set by `dna.coerce.*`. `undefined` means no coercion.
  */
  get _coerce(): boolean { return this._core.coerce; }
  set _coerce(bool: boolean) { }
  get _coerceCode(): string | undefined { return this._core.state.coerceCode; }

  get asAPI(): $toAPIClass<this> { return this as unknown as $toAPIClass<this>; }

  /**
   * Force coercion on this schema, walking through wrappers to the leaf.
   * Used internally for record keys which must be coerced to strings.
   * Returns a cloned schema with coercion enabled to avoid mutating the original.
   */
  forceCoerce(): this {
    // Clone the schema to avoid mutating the original
    const cloned = this.clone();
    let leaf = cloned;
    while (leaf instanceof WrapperImpl) leaf = leaf.unwrap();
    leaf._core.coerce = true;
    return cloned;
  }



  getDnaId(coll: IDnaCollector): tsDnaId | undefined {
    const _dnaId = this.#mapper.get(coll);
    if (_dnaId !== undefined) return _dnaId;
    return _dnaId;
  }
  setDnaId(coll: IDnaCollector, value: tsDnaId): tsDnaId {
    this.#mapper.set(coll, value);
    return value;
  }

  meta(): tsDnaInnerMeta;
  meta(value: string | tsDnaMeta): this;
  meta(value?: string | tsDnaMeta): this | tsDnaInnerMeta {
    if (arguments.length === 0 || value === undefined) return this._core.meta;
    return cloner(this, cl => cl._core.rawMeta(value));
  }

  // protected ._core.innerMeta(target: string | string[], meta?: any | tsDnaMeta): void {
  //   if (meta) {
  //     const errorMsg = !isPureObject(meta) ? meta : meta.error;
  //     const targetObj: Record<string, any> = {};
  //     if (Array.isArray(target)) for (const t of target) targetObj[t] = { error: errorMsg };
  //     else targetObj[target] = { error: errorMsg };
  //     this._core.meta["~inner"] = targetObj;
  //   }
  // }

  get templateRegex(): string { return "\x00" }

  static initCore<T, I, State extends tsStateDef>(type: string = "any", innerState: State, coerceCode?: string) {
    const inst = new this<T, I, State>();
    const stateFull: tsStateFull<State> = {
      type,
      meta: {} as tsDnaInnerMeta,
      coerce: false,
      coerceCode,
      refinerList: [],
      dna: ["T"],
      innerState
    };
    inst._core = StateManager.create(stateFull);
    inst._core.head = inst;
    return inst as this["_apiType"];
  }


  protected get _state() { return this._core.state };

  clone(): this {
    const clone = new (this.constructor as new () => this)();
    const clonedState = this._core.cloneState();
    clone._core = StateManager.create(clonedState);
    clone._core.head = clone;
    return clone as this;
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
  _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
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
   * `_emitSelf` (position 0) and the `check` opcodes (positions 1..n) in a `seq`.
   * Otherwise delegates straight to `_emitSelf`.
   */
  protected _emitRefiners(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): tsDnaId {
    const checks = this._core.state.refinerList;
    if (checks.length === 0) return this._emitSelf(coll, mark, pos);
    const params: any[] = new Array(checks.length + 1);
    const storeId = coll.setStore(params);
    // `storeId` is unique -> use it as discriminant so empty-param seq nodes
    // never falsely dedupe against each other in the collector cache.
    const SeqDnaId = coll.storeDNA(["seq", params, this.meta()], mark, pos, storeId);
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
  protected _emitSelf(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): tsDnaId {
    return coll.storeDNA(this._core.dna, mark, pos);
  }


  toDna(): tsDnaSeq;
  toDna(collector: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId;
  toDna(collector?: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId | tsDnaSeq {
    if (collector instanceof DnaCollector) {
      const _dnaId = this.getDnaId(collector);
      if (_dnaId !== undefined) { collector.updateStore(storeMark!, _dnaId, storePosition); return _dnaId };
      const dnaId = this._toDna(collector, storeMark, storePosition);
      return this.setDnaId(collector, dnaId);
    }

    if (this._core.fullDna) return this._core.fullDna;

    // const customToDna = customToDnaMap.get(this) as tsFnToDnaSeq;
    // if (customToDna) { this.#fullDna = customToDna(); return this.#fullDna; }

    const coll = new DnaCollector();
    this.#mapper.set(coll, 0);

    this._toDna(coll, storeMark, storePosition);
    this._core.fullDna = coll.getDnaSeq();
    return this._core.fullDna;
  }

  pipe<U extends tsDnaType<any, T>>(target: U): tsDnaType<$Output<U>, I>;
  pipe<Schemas extends readonly [tsDnaType<any, any>, ...tsDnaType<any, any>[]]>(
    ...schemas: Schemas & $ValidatePipeArgs<T, Schemas>
  ): tsDnaType<$SeqLastOutput<Schemas>, I>;
  pipe<U>(target: tsDnaType<U, T>, ...rest: tsDnaType<any, any>[]): tsDnaType<$Output<U>, I> {
    const allSchemas = [target, ...rest];
    const pipeSeq = SeqSchemaImpl.init<U, I>([
      this,
      ...allSchemas
    ]);
    pipeSeq.setHead(this);
    // On garantit que l'Output final est dynamique (any en interne, résolu par la signature)
    // mais que l'Input d'origine "I" est conservé
    return pipeSeq as tsDnaType<$Output<U>, I>;
  }

  transform<R>(fn: (arg: $Output<this>) => $MaybeAsync<R>, externals?: tsExternalsDecl): tsDnaType<R, I>;
  transform<R>(fn: (arg: $Output<this>, ctx: ITransformContext<$Output<this>>) => $MaybeAsync<R>, externals?: tsExternalsDecl): tsDnaType<R, I>;
  transform<R>(fn: (ctx: ITransformContext<$Output<this>>) => $MaybeAsync<R>, externals?: tsExternalsDecl): tsDnaType<R, I>;
  // transform<R>(fn: (arg: any) => $MaybeAsync<R>): IDnaSchemaBase<R, I>;
  transform<R>(fn: tsTransformFn<T, R>, externals?: tsExternalsDecl): tsDnaType<R, I> {
    return this.pipe(transformFactory(fn, externals));
  }

  refine(fn: (value: $Output<this>) => boolean): this;
  refine(fn: (value: $Output<this>) => Promise<boolean>): this;
  refine(fn: (value: $Output<this>) => boolean, options: tsRefineOptions<this>): this;
  refine(fn: (value: $Output<this>) => Promise<boolean>, options: tsRefineOptions<this>): this;
  refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => boolean): this;
  refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => Promise<boolean>): this;
  refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => boolean, options: tsRefineOptions<this>): this;
  refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => Promise<boolean>, options: tsRefineOptions<this>): this;
  refine(fn: any, options?: tsRefineOptions<this>): this {
    return cloner(this, cl => {
      // Handle string options or object options
      const errorOpt = typeof options === "string" ? { error: options } : (options?.error ? { error: options.error } : {}) as IRefinerErrorOpt;
      // External refs declared via `options.externals` ([myFn] or { myFn }) — stored at
      // entry index 4 so `_emitRefiners` can surface them in the check meta.
      const map = externalsMap(typeof options === "object" ? options?.externals as tsExternalsDecl : undefined);
      if (Object.keys(map).length) {
        cl._core.refinerList.push(["func", fn.toString(), fn.length, errorOpt, map]);
      } else {
        cl._core.refinerList.push(["func", fn.toString(), fn.length, errorOpt]);
      }
    }) as this;
  }

  check(...checks: (tsDnaCheck | tsDnaPropertyCheck<keyof $Input<this>, tsDnaType<any>> | ((ctx: ICheckContext<$Input<this>>) => void))[]): this {
    return cloner(this, cl => {
      for (const check of checks) {
        if (typeof check === "function") cl._core.refinerList.push(["func", check.toString(), check.length]);
        else if (check.kind === "describe") cl._core.rawMeta({ description: check.description });
        else if (check.kind === "meta") cl._core.rawMeta(check.meta);
        else if (check.kind === "validation") cl._core.refinerList.push(check.check);
        else if (check.kind === "property") cl._core.refinerList.push(["property", stringify(check.property), check.schema]);
      }
    }) as this;
  }

  // Utility methods
  with(...checks: (tsDnaCheck | ((ctx: ICheckContext<$Input<this>>) => void))[]): this {
    return this.check(...checks);
  }

  // Additional validation
  superRefine(fn: (value: $Output<this>, ctx: ISuperRefineContext<$Output<this>>) => void): this | never {
    // In Zod, superRefine provides a refinement context for custom error reporting
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
  //   // In Zod, .custom() creates a schema with a custom validation function
  //   // For DNA compatibility, we accumulate the checker
  //   this._checkerList.push(["func", fn.toString(), fn.length]);
  //   return this as IDnaSchemaBase<R>;
  // }

  brand<B extends string, D extends "out" | "in" | "inout" = "out">(): $WithBrand<this, B, D> {
    // .brand() adds a brand to the type for type-level discrimination
    // This is purely for TypeScript typing, no runtime effect
    // The direction parameter ("out" | "in" | "inout") controls which type gets branded
    return this.clone() as $WithBrand<this, B, D>;
  }

  catch<R>(defaultValue: R): tsDnaType<T | R, I>;
  catch<R>(catchfn: (ctx: IContext<unknown>) => R): tsDnaType<T | R, I>;
  catch<R>(arg0: R | ((ctx: IContext<unknown>) => R)): tsDnaType<T | R, I> {
    // .catch() provides a default value when parsing fails
    // Unlike .default() which only handles undefined, .catch() handles ALL parsing errors
    const wrapper = WrapperImpl.init(this, "catch", arg0 as $CatchValue<T>);
    wrapper._core.setHead(this);
    return wrapper;
  }

  // Properties
  toJSONSchema(): Record<string, unknown> {
    // Placeholder for JSON Schema conversion
    return {};
  }

  // Composition methods
  array(): tsDnaArray<this> {
    const arraySchema = ArrayImpl.init<this>(this);

    // arraySchema._core.rawMeta(this.meta());
    arraySchema._core.setHead(this._head);
    return arraySchema;
  }

  or<U>(other: tsDnaType<U>): tsDnaType<T | U> {
    const union = UnionImpl.init<T | U, I>("anyOf", [this, other]);

    // union._core.rawMeta(this.meta());
    union._core.setHead(this._head);
    return union;
  }

  and<U>(other: tsDnaType<U>) {
    // In Zod, and() creates an intersection
    // For DNA, we use allOf (intersection) with a store pattern like UnionImpl
    const intersection = IntersectionImpl.create([this, other]);
    // intersection._core.rawMeta(this.meta());
    intersection._core.setHead(this._head);
    return intersection;

  }

  xor<U>(other: tsDnaType<U>): tsDnaType<$Xor<T, U>> {
    // In Zod, xor() creates an exclusive union (exactly one must match)
    // For DNA, we use oneOf opcode
    const xorSchema = XorImpl.init<$Xor<T, U>, I>("oneOf", [this, other]);

    // xorSchema._core.rawMeta(this.meta());
    xorSchema._core.setHead(this._head);
    return xorSchema;
  }

  describe(description: string): this { return cloner(this, cl => cl._core.meta.description = description) as this; }
  readonly(): this { return cloner(this, cl => cl._core.meta.readonly = true) as this; }

  register(fn: (schema: this) => void): this { return cloner(this, cl => fn(cl)) as this; }

  overwrite<U>(fn: (schema: this) => U): U { return fn(this); }

  apply<R, A extends unknown[] = []>(fn: (schema: this, ...args: A[]) => R, args: A[] = []): R {
    return fn(this, ...args);
  }


  _validate(ctx?: tsExternals): tsValidatorFn {
    if (this._core.state.cachedValidator) return this._core.state.cachedValidator;
    this._core.state.cachedValidator = validatorBuilder(this.toDna(), ctx);

    return this._core.state.cachedValidator;
  }

  validate(value: unknown, ctx?: tsExternals): boolean {
    // Invoke the validator returned by `_validate` (which subclasses like CodecImpl
    // override with their own cache) rather than reading `#state.cachedValidator`
    // directly — the override stores it elsewhere, so reading the field would be undefined.
    return this._validate(ctx)(value);
  }

  validateAsync(value: unknown, ctx?: tsExternals): Promise<boolean> {
    if (value instanceof Promise) {
      return value.then((v) => this.validate(v, ctx));
    }
    return Promise.resolve(this.validate(value, ctx));
  }

  _safeParse(ctx?: tsExternals): tsParserFn {
    if (this._core.state.cachedParser) return this._core.state.cachedParser;
    this._core.state.cachedParser = parserBuilder(this.toDna(), ctx);

    return this._core.state.cachedParser;
  }

  safeParse(value: unknown, ctx?: tsExternals): tsParserResult {
    // Invoke the parser from `_safeParse` (subclass-overridable, e.g. CodecImpl) for
    // the same reason as `validate` above.
    return this._safeParse(ctx)(value);
  }

  // Additional parsing methods
  parse(value: unknown, ctx?: tsExternals): T | never {
    const res = this.safeParse(value, ctx);
    if (res.success) return res.data;
    throw res.errors;
  }

  parseAsync(value: unknown, ctx?: tsExternals): Promise<T> | never {
    if (value instanceof Promise) {
      return value.then((v) => this.parse(v, ctx));
    }
    return Promise.resolve(this.parse(value, ctx));
  }

  safeParseAsync(value: unknown, ctx?: tsExternals,): Promise<tsParserResult> {
    // If value is a Promise, await it before parsing
    if (value instanceof Promise) {
      return value.then((v) => this.safeParse(v, ctx));
    }
    return Promise.resolve(this.safeParse(value, ctx));
  }

  spa(value: unknown, ctx?: tsExternals): Promise<tsParserResult> {
    return this.safeParseAsync(value, ctx);
  }

  safeDecode(value: unknown, ctx: tsExternals): tsParserResult { return this.safeParse(value, ctx); }
  safeDecodeAsync(value: unknown, ctx: tsExternals): Promise<tsParserResult> { return this.spa(value, ctx); }
  decode(value: unknown, ctx: tsExternals): T { return this.parse(value, ctx); }
  decodeAsync(value: unknown, ctx: tsExternals): Promise<T> { return Promise.resolve(this.parseAsync(value, ctx)); }

  safeEncode(value: unknown, ctx?: tsExternals): tsParserResult { return this.safeParse(value, ctx); }
  safeEncodeAsync(value: unknown, ctx?: tsExternals): Promise<tsParserResult> { return Promise.resolve(this.safeEncode(value, ctx)); }
  encode(value: unknown, ctx?: tsExternals): T {
    const res = this.safeEncode(value, ctx);
    if (res.success) return res.data;
    throw res.errors;
  }
  encodeAsync(value: unknown, ctx?: tsExternals): Promise<T> { return Promise.resolve(this.encode(value, ctx)); }



  // Stub wrapper methods for interface compliance (should not be called on base SchemaImpl)
  optional(): tsDnaOptional<T, I> {
    throw new Error("optional() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  nullable(): tsDnaNullable<T, I> {

    throw new Error("nullable() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  nullish(): tsDnaNullish<T, I> {
    throw new Error("nullish() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  default(value: T): tsDnaDefault<T, I> {
    throw new Error("default() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  prefault(value: I): tsDnaPrefault<T, I> {
    throw new Error("prefault() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  // Additional meta flags for object key behavior
  exactOptional(): this {
    // Marks the schema so that when used as an object property key, the key becomes
    // non-required (an absent key is allowed). However, the VALUE is still validated
    // strictly by the inner schema — an explicit `undefined` or `null` is REJECTED
    // (unlike `.optional()` which accepts these values). This flag only has meaning
    // inside an object definition; on a bare schema it has no effect.
    // See `acceptsAbsent` in the object handler for the implementation.
    return cloner(this, cl => cl._core.rawMeta({ exactOptional: true }));
  }

  nonoptional(): tsDnaType<T, I> {
    // Marks the schema so that when used as an object property key, the key becomes
    // REQUIRED again, even if the schema was previously marked as optional or nullish.
    // This overrides the optional behavior at the OBJECT KEY level only — the value-level
    // handling (accepting undefined/null) is managed separately by WrapperImpl.nonoptional().
    // On a bare schema (not inside an object), this flag has no effect since the value
    // is already required by default.
    // Also removes conflicting flags (exactOptional, optional) to ensure consistency.
    return cloner(this, cl => {
      const currentMeta = cl.meta() as tsDnaInnerMeta;

      const { exactOptional, optional, ...rest } = currentMeta;
      cl._core.rawMeta({ ...rest, nonoptional: true });

    });

  }

  // Information methods
  isOptional(): boolean {
    return this._core.state.meta.optional === true;
  }

  isNullable(): boolean {
    return this._core.state.meta.nullable === true;
  }

  isNullish(): boolean {
    return this._core.state.meta.nullish === true;
  }
}

export class SchemaImplWithWrappers<T, I = T, StateDef extends tsStateDef = tsStateDef> extends SchemaImpl<T, I, StateDef> {
  unwrap(): tsDnaType<T, I> | never {
    throw new Error("unwrap() can only be called when a wrapper (optional, nullable, nullish, default, prefault) has been applied");
  }
  optional(): any {
    // For any/unknown (falsyWrp=true), optional is a no-op since these types accept all values
    const wrp = WrapperImpl.init(this, "optional");
    wrp._core.setHead(this._head);
    return wrp;
  }
  nullable(): any {
    // For any/unknown (falsyWrp=true), nullable is a no-op since these types accept all values
    const wrp = WrapperImpl.init(this, "nullable");
    wrp._core.setHead(this._head);
    return wrp;
  }
  nullish(): any {
    const wrp = WrapperImpl.init<T, I, this>(this, "nullish");
    wrp._core.setHead(this._head);
    return wrp;
  }
  default(value: T): any {
    const wrp = WrapperImpl.init<T, I, this>(this, "default", value);
    wrp._core.setHead(this._head);
    return wrp;
  }
  prefault(value: I): any {
    const wrp = WrapperImpl.init<T, I, this>(this, "prefault", value);
    wrp._core.setHead(this._head);
    return wrp;
  }

}

export class DnaGeneric<T, I = T> extends SchemaImpl<T, I> {
  static init<T, I = T>(type: string = "any", dna: tsDnaNoMeta): any {
    const inst = this.initCore<T, I, tsStateDef>(type, {});
    (inst as any)._dna = dna;
    return inst;
  }
}

export class DnaGenericWrapped<T, I = T> extends SchemaImplWithWrappers<T, I, tsStateDef> implements schPseudoTypeMethods<T> {
  static init<T, I = T>(type: string = "any", dna: tsDnaNoMeta): any {
    const inst = this.initCore<T, I, tsStateDef>(type, {});
    (inst as any)._dna = dna;
    return inst;
  }
}


/* Wrappers bubble up their meta, so they dont need one  */
export class WrapperImpl<T, I = T, Inner extends tsDnaType<T, I> = tsDnaType<T, I>, StateDef = tsStateDef> extends SchemaImplWithWrappers<T, I, tsStateWrp<T, I, Inner> & StateDef> {
  declare _input: I;
  declare _output: T & {
    tsWrpTypes: boolean | $CatchValue<T, I>;
  }
  defaultValue?: () => T | undefined;
  prefaultValue?: () => I | undefined;
  catchValue?: () => $CatchValue<T, I> | undefined;

  // override set _coerce(bool: boolean) { (this._core.state.inner as SchemaImpl<T, I>)._coerce = bool; }

  static init<T, I, Inner extends tsDnaType<T, I>>(inner: Inner, wrapperType: tsWrpTypes, value?: T | I | $CatchValue<T, I>): any {
    // `wrapperType` is a dynamic runtime string here, so TS cannot discriminate
    // which union member of tsStateWrp is being built — a single cast at this
    // construction boundary is the correct, minimal way to bridge that gap.
    const inst = this.initCore<T, I, tsStateWrp<T, I, Inner>>("wrp", {
      inner,
      wrapperType,
      value,
    } as tsStateWrp<T, I, Inner>);
    inst._core.rawMeta({ [wrapperType]: value ?? true });

    if (wrapperType === "default") {
      (inst as any).defaultValue = (): T | undefined => inst._core.state.value as T | undefined;
    };
    if (wrapperType === "prefault") {
      (inst as any).prefaultValue = (): I | undefined => inst._core.state.value as I | undefined;
    }
    if (wrapperType === "catch") (inst as any).catchValue = (): $CatchValue<T, I> | undefined => inst._core.state.value as $CatchValue<T, I> | undefined;
    return inst;
  }

  override unwrap(): Inner {
    // this._core.state.inner.meta({ [this.#wrapperType] undefined });
    return this._core.state.inner;
  }

  override get templateRegex(): string {
    const innerRegex = this._core.state.inner._templateRegex;
    // Only optional/nullable/nullish affect the regex pattern
    // default/prefault/catch provide fallback values but don't change validity
    // Return \x00 for these to force full schema validation
    if (this._core.state.wrapperType === "default" || this._core.state.wrapperType === "prefault" || this._core.state.wrapperType === "catch") {
      return "\x00";
    }
    if (this._core.state.wrapperType === "optional" && innerRegex !== "\x00") {
      return "(?:" + innerRegex + ")?";
    }
    if (this._core.state.wrapperType === "nullable" && innerRegex !== "\x00") {
      return "(?:" + innerRegex + "|null)";
    }
    if (this._core.state.wrapperType === "nullish" && innerRegex !== "\x00") {
      return "(?:" + innerRegex + ")?|null";
    }
    return innerRegex;
  }

  override nonoptional() {
    // nonoptional REMOVES the `optional` wrapper wherever it sits in the chain
    // (even nested under e.g. `default`), so the value no longer accepts
    // `undefined`. The recursion strips `optional` at every level and rebuilds
    // the kept wrappers around the cleaned inner:
    //   - optional -> dropped (recurse into inner)
    //   - nullish  -> downgraded to nullable (nullish = optional + nullable)
    //   - others   -> rebuilt around the de-optionalised inner
    const cleanedInner = this._core.state.inner.nonoptional();
    let result: tsDnaType<T, I>;
    if (this._core.state.wrapperType === "optional") result = cleanedInner;
    else if (this._core.state.wrapperType === "nullish") result = cleanedInner.nullable();
    else result = WrapperImpl.init(cleanedInner, this._core.state.wrapperType, this._core.state.value);
    // Force the key required in an enclosing object (overrides default/prefault's
    // absent-tolerance), matching Zod's `nonoptional`.
    result._core.rawMeta({ nonoptional: true });
    return result;
  }

  // #propagateMeta(key: string, value: any) {
  //   if (this.#inner instanceof WrapperImpl) {
  //     this.#inner.#propagateMeta(key, value);
  //   } else this.#inner.meta({ [key]: value ?? true });
  // }

  /** @deprecated Use unwrap() instead */
  removeDefault(): tsDnaType<T, I> { return this.unwrap(); }

  // Build this wrapper's modifier entry for the unified `wrp` node:
  //   [type] | [type, serializedValue] | [type, fnSource, arity]
  #toModifierEntry(): [string] | [string, string] | [string, string, number] {
    if (typeof this._core.state.value === "function") {
      // catch may receive a recovery function `(ctx) => value`. Serialize its
      // source + arity (like transform/check) so it survives into the DNA.
      const fn = this._core.state.value;
      return [this._core.state.wrapperType, fn.toString(), fn.length];
    }
    if (this._core.state.value !== undefined) return [this._core.state.wrapperType, stringify(this._core.state.value)];
    return [this._core.state.wrapperType];
  }

  protected override _emitSelf(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): tsDnaId {
    // Flatten the wrapper chain (this = outermost) into an ordered modifier list,
    // descending to the first non-wrapper inner (the single leaf).
    const modifiers: ([string] | [string, string] | [string, string, number])[] = [];
    let leaf = this;
    while (leaf instanceof WrapperImpl) {
      const w = leaf;
      // any/unknown: a wrapper directly around any/unknown is a no-op (these types
      // accept all values) — drop it and treat its inner as the leaf.
      if (["any", "unknown"].includes(w._core.state.inner.type)) { leaf = w._core.state.inner; break; }
      modifiers.push(w.#toModifierEntry());
      // Bubble wrapper flags up onto the outer node's meta (annotation hint).
      this._core.rawMeta(w.meta());
      leaf = w._core.state.inner;
    }

    // Fully collapsed (e.g. optional(any)) -> emit just the leaf.
    if (modifiers.length === 0) return leaf.toDna(coll, mark!, pos);

    // Payload [targetId, modifiers] is a NESTED array shared by reference with the
    // stored node, so the leaf's id (written via the store after emission) reaches
    // the final DNA. targetId starts at -1 until relinked.
    // const wrpDef: tsDna = ["wrp", -1, modifiers, this.meta()];
    const wrpDef: tsDna = ["wrp", -1, modifiers, {}]; // wrapper dont need meta as they propagate it
    const wrpStoreId = coll.setStore(wrpDef);
    const dnaId = coll.storeDNA(wrpDef, mark, pos, wrpStoreId); // wrpDef and not _dna because _dna destructures the value pf wrpDef
    this._core.dna = wrpDef;
    leaf.toDna(coll, wrpStoreId, 1);
    return dnaId;
  }
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
function isRequiredKey(schema: tsDnaType<any>): boolean {
  if (schema.meta()[WRAPPERS_KEYOPT.nonoptional]) return true;
  let s: tsDnaType<any> = schema;
  while (s instanceof WrapperImpl) {
    if (ABSENT_TOLERANT_WRAPPERS.includes(s._core.state.wrapperType)) return false;
    s = s.unwrap();
  }
  return !ABSENT_TOLERANT_WRAPPERS.some(it => s.meta()[it] !== undefined);
}

// Literal implementation
export class LiteralImpl<T, I = T> extends SchemaImplWithWrappers<T, I, tsStateLiteral<T>> {

  static init<T, I = T>(value: T): any {
    const inst = this.initCore<T, T, tsStateLiteral<T>>("literal", { value });
    (inst as any)._dna = ["l", [value]];
    return inst;
  }
  // getValue(): T { return this._core.state.value; }

  get values(): Set<T> {
    const value = this._core.state.value;
    return new Set(Array.isArray(value) ? value : [value]);
  }
  get _rawValues(): Array<T> {
    const value = this._core.state.value;
    return Array.isArray(value) ? value : [value];
  }

  override get templateRegex(): string { return escReg(String(this._core.state.value)); }
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
  | ["s", "pattern", RegExp, tsDnaMeta]
  | ["s", "format", string, tsDnaMeta]
  | tsStrChekOrMutation;

// String implementation
export class StringImpl extends SchemaImplWithWrappers<string, string, tsStateString> {

  static create(options?: { format?: string }): any {
    const format = options?.format ?? null
    const inst = this.initCore<string, string, tsStateString>("string", {
      min: null,
      max: null,
      pattern: null,
      format,
      startsWith: undefined,
      endsWith: undefined,
      includes: undefined,
      sequence: []
    }, "toString");
    if (format) (inst as any).#addSeq(["s", "format", format, inst.meta()]);
    return inst;
  }

  #addSeq(seqarr: tsStrSeqItem) {
    if (seqarr[0] === "mutate" || seqarr[0] === "check") {
      // Keep mutations and checks as-is
      this._core.state.sequence.push(seqarr as any);
    } else if (this._core.state.sequence.length > 0 || seqarr[0] !== "s") {
      const sq1 = seqarr[1], sq2 = seqarr[2];
      this._core.state.sequence.push(["s", [
        sq1 === "min" ? sq2 : null,
        sq1 === "max" ? sq2 : null,
        sq1 === "pattern" ? sq2.toString() : null,
        sq1 === "format" ? sq2 : null,
      ], seqarr[3]
      ]);
    } else if (seqarr[0] === "s") {
      switch (seqarr[1]) {
        case "min": this._core.state.min = seqarr[2]; break;
        case "max": this._core.state.max = seqarr[2]; break;
        case "pattern": this._core.state.pattern = seqarr[2]; break;
        case "format": this._core.state.format = seqarr[2]; break;
      }
      this.meta(seqarr[3]);
    };
  }

  min(length: number, meta?: string | tsDnaMeta): this {
    return cloner(this, cl => { cl._core.state.min = length; cl._core.innerMeta("min", meta); cl.#addSeq(["s", "min", length, metaNormalize(meta, "min")]); });
  }

  max(length: number, meta?: string | tsDnaMeta): this {
    return cloner(this, cl => { cl._core.state.max = length; cl._core.innerMeta("max", meta); cl.#addSeq(["s", "max", length, metaNormalize(meta, "max")]); });
  }

  length(length: number, meta?: string | tsDnaMeta): this {
    return cloner(this, cl => { cl._core.state.min = length; cl._core.state.max = length; if (meta) cl._core.innerMeta(["min", "max"], meta); });
  }

  eq(length: number, meta?: string | tsDnaMeta): this {
    return cloner(this, cl => { cl._core.state.min = length; cl._core.state.max = length; cl._core.innerMeta("eq", meta); });
  }

  pattern(regex: RegExp, meta?: string | tsDnaMeta): this {
    return cloner(this, cl => { cl._core.state.pattern = regex; cl._core.innerMeta("pattern", meta); cl.#addSeq(["s", "pattern", regex, metaNormalize(meta, "pattern")]); });
  }
  regex = this.pattern;

  format(fmt: string, meta?: string | tsDnaMeta): this {
    return cloner(this, cl => { cl._core.innerMeta("format", meta); cl.#addSeq(["s", "format", fmt, metaNormalize(meta, "format:" + fmt)]); cl._core.state.format = fmt; });
  }

  /** @deprecated Use dna.email() instead */
  email(meta?: string | tsDnaMeta): this {
    return this.format("email", meta);
  }

  /** @deprecated Use dna.url() instead */
  url(): tsDnaUrl {
    // Use UrlImpl for proper URL validation with new URL()
    const newUrl = UrlImpl.init();
    newUrl._core.rawMeta(this.meta())
    return newUrl;
  }

  /** @deprecated Use dna.uuid() instead */
  uuid(): this {
    return this.format("uuid");
  }

  /** @deprecated Use dna.base64() instead */
  base64(): this {
    return this.format("base64");
  }

  override get templateRegex(): string {
    if (this._core.state.sequence.length) return "\x00";
    if (this._core.state.pattern) return this._core.state.pattern.source;
    if (this._core.state.format) {
      const formatPattern = STRING_FORMAT_PATTERNS[this._core.state.format];
      if (formatPattern) return formatPattern;
    }
    let r = ".*";
    if (this._core.state.min !== null || this._core.state.max !== null) {
      r = ".{" + (this._core.state.min ?? 0);
      if (this._core.state.max !== null) r += "," + this._core.state.max;
      r += "}";
    }
    // Add startsWith/endsWith/includes constraints if present
    if (this._core.state.startsWith) r = escReg(this._core.state.startsWith) + r;
    if (this._core.state.endsWith) r = r + escReg(this._core.state.endsWith);
    if (this._core.state.includes) r = ".*" + escReg(this._core.state.includes) + ".*";
    return r;
  }

  /** @deprecated Use dna.base64url() instead */
  base64url(): this {
    return this.format("base64url");
  }

  /** @deprecated Use dna.jwt() instead */
  jwt(): this {
    return this.format("jwt");
  }

  /** @deprecated Use dna.emoji() instead */
  emoji(): this {
    return this.format("emoji");
  }

  /** @deprecated Use dna.nanoid() instead */
  nanoid(error?: string): this {
    return this.format("nanoid");
  }

  /** @deprecated Use dna.uuid() instead */
  guid(error?: string): this {
    return this.format("guid");
  }

  /** @deprecated Use dna.cuid() instead */
  cuid(): this {
    return this.format("cuid");
  }

  /** @deprecated Use dna.cuid2() instead */
  cuid2(): this {
    return this.format("cuid2");
  }

  /** @deprecated Use dna.ulid() instead */
  ulid(): this {
    return this.format("ulid");
  }

  /** @deprecated Use dna.xid() instead */
  xid(): this {
    return this.format("xid");
  }

  /** @deprecated Use dna.ksuid() instead */
  ksuid(): this {
    return this.format("ksuid");
  }

  /** @deprecated Use dna.ipv4() instead */
  ipv4(): this {
    return this.format("ipv4");
  }

  /** @deprecated Use dna.ipv6() instead */
  ipv6(): this {
    return this.format("ipv6");
  }

  /** @deprecated Use dna.mac() instead */
  mac(): this {
    return this.format("mac");
  }

  trim(): this { return cloner(this, cl => cl.#addSeq(["mutate", ["trim"]])); }
  toLowerCase(): this { return cloner(this, cl => cl.#addSeq(["mutate", ["toLowerCase"]])); }
  toUpperCase(): this { return cloner(this, cl => cl.#addSeq(["mutate", ["toUpperCase"]])); }
  normalize(): this { return cloner(this, cl => cl.#addSeq(["mutate", ["normalize"]])); }
  uppercase(meta: string | tsDnaMeta): this { return cloner(this, cl => cl.#addSeq(["check", ["uppercase"], metaNormalize(meta)])); }
  lowercase(meta: string | tsDnaMeta): this { return cloner(this, cl => cl.#addSeq(["check", ["lowercase"], metaNormalize(meta)])); }
  startsWith(start: string, meta?: string | tsDnaMeta): this {
    return cloner(this, cl => {
      cl._core.state.startsWith = start;
      cl.#addSeq(["check", ["startsWith", stringify(start)], metaNormalize(meta)]);
    });
  }
  endsWith(end: string, meta?: string | tsDnaMeta): this {
    return cloner(this, cl => {
      cl._core.state.endsWith = end;
      cl.#addSeq(["check", ["endsWith", stringify(end)], metaNormalize(meta)]);
    });
  }
  includes(inc: string, params?: string | tsDnaMeta | { position?: number; error?: string }): this {
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
      cl._core.state.includes = inc;
      const check: tsCheckOpt = position !== undefined
        ? ["includes", stringify(inc), position]
        : ["includes", stringify(inc)];
      cl.#addSeq(["check", check, metaNormalize(meta)]);
    });
  }

  /**
   * @deprecated Use dna.iso.datetime() instead
   */
  datetime(options?: { local?: boolean; offset?: boolean; precision?: number; error?: string }): tsDnaString { return Iso.datetime(options); }

  /**
   * @deprecated Use dna.iso.date() instead
   */
  date(options?: { error?: string }): tsDnaString { return Iso.date(options); }

  /**
   * @deprecated Use dna.iso.time() instead
   */
  time(options?: { precision?: number; error?: string }): tsDnaString { return Iso.time(options); }

  /**
   * @deprecated Use dna.iso.duration() instead
   */
  duration(options?: { error?: string }): tsDnaString { return Iso.duration(options); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    // Serialize RegExp as string using toString() to preserve pattern and flags
    const patternSerialized = this._core.state.pattern ? this._core.state.pattern.toString() : null;
    this._core.dna = ["s", [this._core.state.min ?? null, this._core.state.max ?? null, patternSerialized, this._core.state.format ?? null]];

    if (this._core.state.sequence.length > 0) {
      const seqInst = SeqRawImpl.init([
        this._core.dna,
        ...this._core.state.sequence,
      ]);
      return seqInst.toDna(coll, storeMark!, storePosition);

    } else {
      return coll.storeDNA(this._core.dna, storeMark, storePosition);
    }
  }
}

// Enhanced Template literal implementation that enables tranformation and mutation
export class TemplateLiteralMutateImpl extends SchemaImplWithWrappers<string, string, tsStateTemplateLiteralMutate> {

  get canMutate() { return true }

  static init(parts: tsTmplLitArg[]): any {
    return this.initCore<string, string, tsStateTemplateLiteralMutate>("string", { parts, canMutate: true });
  }

  getParts(): tsTmplLitArg[] {
    return this._core.state.parts;
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const passiveParts: tsTmplPartPrimitives[] = [], schemaParts: tsDnaType<any>[] = [];
    if (!this._core.state.parts.length) {
      passiveParts.push("");
    } else this._core.state.parts.forEach((part, i) => {
      if (part instanceof SchemaImpl) {
        const partRegex = part.templateRegex;
        if (partRegex === "\x00") {
          // Use placeholder and include schema for validation
          passiveParts[i] = "\x00";
          schemaParts.push(part);
        } else {
          // Use regex pattern for validation
          passiveParts[i] = partRegex;
        }
      } else {
        passiveParts[i] = escReg(String(part));
      }
    });
    let schLen = schemaParts.length;
    const partIds = new Array<number>(schLen);
    const storeId = coll.setStore(partIds);
    this._core.dna = ["template", passiveParts, partIds, this.canMutate];
    const dnaId = coll.storeDNA(this._core.dna, storeMark, storePosition, storeId);
    for (; schLen--;) { // NEVER change this line
      const schema = schemaParts[schLen];
      // The captured group is always a string, so the part schema must coerce it to
      // its target type. Coercion belongs to the inner LEAF (e.g. number -> toNumber),
      // NOT to optional/nullable wrappers (a wrapper has no business coercing), so walk
      // through wrappers to the leaf before flagging it.
      let leaf: tsDnaType<any> = schema;
      while (leaf instanceof WrapperImpl) leaf = leaf.unwrap();
      (leaf as any)._coerce = true;
      schema.toDna(coll, storeId, schLen);
    }
    return this.setDnaId(coll, dnaId);
  }
}

// Template literal implementation - for Zod Compatibility
export class TemplateLiteralImpl extends TemplateLiteralMutateImpl {

  override get canMutate() { return false }

  static init(parts: tsTmplLitArg[]): any {
    return this.initCore<string, string, tsStateTemplateLiteral>("string", { parts, canMutate: false });
  }

}

// Mutate implementation - mutation operation
export class MutateImpl<T, I = T> extends SchemaImpl<T, I> {
  private _mutator: string = "";

  static init<T, I = T>(mutator: string): any {
    const inst = this.initCore<T, I, tsStateDef>("mutate", {});
    (inst as any)._mutator = mutator;
    (inst as any)._dna = ["mutate", mutator];
    return inst;
  }



  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    return coll.storeDNA(this._core.dna, storeMark, storePosition);
  }
}

// SeqRawImpl - wraps raw DNA into ISchemaBase for SeqSchemaImpl
export class SeqRawImpl extends SchemaImpl<unknown, unknown, tsStateSeqRaw> {
  static init(dnaSteps: tsDna[]): any {
    return this.initCore<unknown, unknown, tsStateSeqRaw>("seq", { dnaSteps });
  }



  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const dna_params = new Array(this._core.state.dnaSteps.length);
    const storeId = coll.setStore(dna_params);
    this._core.dna = ["seq", dna_params];
    const dnaId = coll.storeDNA(this._core.dna, storeMark, storePosition, this._core.state.dnaSteps);
    this._core.state.dnaSteps.forEach((step: any, i: number) => coll.storeDNA(step, storeId, i));
    return dnaId;
  }
}

// Seq implementation - sequence of DNA operations
export class SeqSchemaImpl<T, I, U = I | unknown> extends SchemaImplWithWrappers<T, I | U, tsStateSeq<T, I, U>> {

  static init<T, I, U = I | unknown>(steps: tsDnaType<any, any>[]): any {
    return this.initCore<T, I | U, tsStateSeq<T, I, U>>("seq", { dnaSteps: steps });
  }

  addStep(step: tsDnaType<any, any>): any {
    this._core.state.dnaSteps.push(step);
    return this.clone();
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const dna_params = new Array(this._core.state.dnaSteps.length);
    const storeId = coll.setStore(dna_params);
    this._core.dna = ["seq", dna_params];
    const dnaId = coll.storeDNA(this._core.dna, storeMark, storePosition, storeId);
    this._core.state.dnaSteps.forEach((step: any, i: number) => step.toDna(coll, storeId, i));
    return dnaId;
  }
}


// Coerce implementation - static methods
export class Coerce {
  // Coercion is now a serialization layer driven by the `_coerce` flag on the
  // base schema (see SchemaImpl._emitCoerce). No wrapper instance / toDna
  // substitution is needed: the impl is returned as-is, only flagged.
  static string(): any { const impl = StringImpl.create({}); impl._coerce = true; return impl; }
  static number(): any { const impl = NumberImpl.init(); impl._coerce = true; return impl; }
  static int(): any { const impl = IntImpl.create(); impl._coerce = true; return impl; }
  static int32(): any { const impl = Int32Impl.create(); impl._coerce = true; return impl; }
  static boolean(): any { const impl = BooleanImpl.create(); impl._coerce = true; return impl; }
  static bigint(): any { const impl = BigIntImpl.create(); impl._coerce = true; return impl; }
  static date(): any { const impl = DateImpl.create(); impl._coerce = true; return impl; }
}

// StringBool implementation - Zod V4 stringbool compatibility
export class StringBoolImpl extends SchemaImplWithWrappers<boolean, boolean, tsStateStringBool> {
  static init(options?: string | { truthy?: string[]; falsy?: string[]; case?: "sensitive" | "insensitive"; error?: string; message?: string }): any {
    let opts, metaDef;
    if (typeof options === "string") { metaDef = options; opts = {}; }
    else { opts = options ?? {}; metaDef = options ? { error: options.error } : {} }
    const caseDef = opts?.case === "sensitive";
    const truthy: string[] = opts?.truthy ?? ["true", "yes", "1", "on", "y", "enabled"];
    const falsy: string[] = opts?.falsy ?? ["false", "no", "0", "off", "n", "disabled"];
    const inst = this.initCore<boolean, boolean, tsStateStringBool>("boolean", { map: { truthy, falsy, case: caseDef }, case: caseDef }, "toBoolean");
    inst._core.rawMeta(metaDef);
    return inst;
  }

  override get templateRegex(): string {
    const keys = Object.keys(this._core.state.map);
    return "(?:" + keys.map(escReg).join("|") + ")";
  }

  override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const map = this._core.state.map;
    this._core.dna = ["sb", [map.truthy, map.falsy, map.case]];
    const seqDna = SeqRawImpl.init([
      ["s", [null, null, null, null], this.meta()],
      this._core.dna
    ]);
    return seqDna.toDna(coll, storeMark!, storePosition);
  }
}

// ISO implementation - static methods
export class Iso {
  static datetime(options?: { local?: boolean; offset?: boolean; precision?: number; error?: string; message?: string }): tsDnaString {
    let format = "date-time";
    if (options?.local) format += "-local";
    if (options?.offset) format += "-offset";
    if (options?.precision !== undefined) format += "-precision-" + options.precision;
    const instance = StringImpl.create({ format });
    if (options?.error || options?.message) instance.meta({ error: options.error ?? options.message });
    return instance;
  }

  static date(options?: { error?: string }): tsDnaString {
    const instance = StringImpl.create({ format: "date" });
    if (options?.error) instance.meta({ error: options.error });
    return instance;
  }

  static time(options?: { precision?: number; error?: string }): tsDnaString {
    let format = "time";
    if (options?.precision !== undefined) format += "-precision-" + options.precision;
    const instance = StringImpl.create({ format });
    if (options?.error) instance.meta({ error: options.error });
    return instance;
  }

  static duration(options?: { error?: string }): tsDnaString {
    const format = "duration";
    const instance = StringImpl.create({ format });
    if (options?.error) {
      instance.meta({ error: options.error });
    }
    return instance;
  }
}

// Date implementation
export class DateImpl extends SchemaImplWithWrappers<Date, Date, tsStateDate> {

  static create(): any {
    // State-only (like NumberImpl): bounds live in `_stt`, the node is built in
    // `_emitSelf`. No cached `_dna`, so cloning can never desync the bounds.
    return this.initCore<Date, Date, tsStateDate>("date", { min: null, max: null }, "toDate");
  }
  min(date: Date, meta?: tsDnaMeta): this { return cloner(this, cl => { cl._core.state.min = date; cl._core.innerMeta("min", meta); }); }
  max(date: Date, meta?: tsDnaMeta): this { return cloner(this, cl => { cl._core.state.max = date; cl._core.innerMeta("max", meta); }); }
  eq(date: Date, meta?: tsDnaMeta): this { return cloner(this, cl => { cl._core.state.min = date; cl._core.state.max = date; cl._core.innerMeta("eq", meta); }); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const selfDna: tsDna = ["date", [this._core.state.min, this._core.state.max], this.meta()];
    return coll.storeDNA(selfDna, storeMark, storePosition);
  }
}


// URL implementation
export class UrlImpl extends SchemaImplWithWrappers<string, string, tsStateUrl> {

  static init(options?: { normalize?: boolean, protocol?: RegExp, hostname?: RegExp }): any {
    const inst = this.initCore<string, string, tsStateUrl>("url", { protocol: null, hostname: null, normalize: false }, "toString");
    if (options?.normalize) {
      inst._core.state.normalize = true;
    }
    if (options?.protocol) {
      inst._core.state.protocol = options.protocol;
    }
    if (options?.hostname) {
      inst._core.state.hostname = options.hostname;
    }
    return inst;
  }

  protocol(protocol: RegExp): this { return cloner(this, cl => cl._core.state.protocol = protocol); }
  hostname(hostname: RegExp): this { return cloner(this, cl => cl._core.state.hostname = hostname); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    // Serialize RegExp as string using toString() to preserve pattern and flags
    const protocolSerialized = this._core.state.protocol ? this._core.state.protocol.toString() : null;
    const hostnameSerialized = this._core.state.hostname ? this._core.state.hostname.toString() : null;
    this._core.dna = ["url", [protocolSerialized, hostnameSerialized, this._core.state.normalize]];
    return coll.storeDNA(this._core.dna, storeMark, storePosition);
  }
}


// Number implementation (base export class, does not implement public interface)
export class NumberImpl<T extends number | bigint, I = unknown> extends SchemaImplWithWrappers<T, I, tsStateNumber<T>> implements schNumberMethods<T> {

  static init<T extends number | bigint, I = T>(type: tsDnaOpcode = "n", coerceCode: string = "toNumber"): any {
    return this.initCore<T, I, tsStateNumber<T>>(type, { min: null, max: null, exclMin: false, exclMax: false, multOf: null }, coerceCode);
  }

  min(value: T, meta?: tsDnaMeta): this { return cloner(this, cl => { cl._core.state.min = value; cl._core.innerMeta("min", meta); }); }
  max(value: T, meta?: tsDnaMeta): this { return cloner(this, cl => { cl._core.state.max = value; cl._core.innerMeta("max", meta); }); }
  gt(value: T, meta?: tsDnaMeta): this { return cloner(this, cl => { cl._core.state.min = value; cl._core.state.exclMin = true; cl._core.innerMeta("gt", meta); }); }
  gte(value: T, meta?: tsDnaMeta): this { return cloner(this, cl => { cl._core.state.min = value; cl._core.state.exclMin = false; cl._core.innerMeta("gte", meta); }); }
  lt(value: T, meta?: tsDnaMeta): this { return cloner(this, cl => { cl._core.state.max = value; cl._core.state.exclMax = true; cl._core.innerMeta("lt", meta); }); }
  lte(value: T, meta?: tsDnaMeta): this { return cloner(this, cl => { cl._core.state.max = value; cl._core.state.exclMax = false; cl._core.innerMeta("lte", meta); }); }
  eq(value: T, meta?: tsDnaMeta): this { return cloner(this, cl => { cl._core.state.max = value; cl._core.state.min = value; cl._core.state.exclMax = false; cl._core.innerMeta("eq", meta); }); }
  multipleOf(value: T, meta?: tsDnaMeta): this { return cloner(this, cl => { cl._core.state.multOf = value; cl._core.innerMeta("multipleOf", meta); }); }

  /** @deprecated Use multipleOf() instead */
  step(value: T, meta?: tsDnaMeta): this { return this.multipleOf(value, meta); }
  /** @deprecated No-op in DNA, returns this */
  finite(): any { return this.clone(); }
  /** Safe integer: an integer within [MIN_SAFE_INTEGER, MAX_SAFE_INTEGER]. */
  safe(): any {
    // `int()` carries over existing bounds; clamp them to the safe-integer range
    // (intersect, so any tighter user bound wins).
    const impl = this.int() as unknown as NumberImpl<number>;
    if (impl._core.state.min === null || impl._core.state.min < Number.MIN_SAFE_INTEGER) impl._core.state.min = Number.MIN_SAFE_INTEGER;
    if (impl._core.state.max === null || impl._core.state.max > Number.MAX_SAFE_INTEGER) impl._core.state.max = Number.MAX_SAFE_INTEGER;
    return impl;
  }

  int(): any {
    const impl = IntImpl.create();
    if (this._core.state.min !== null) {
      if (this._core.state.exclMin) impl.gt(this._core.state.min as number);
      else impl.gte(this._core.state.min as number);
    }
    if (this._core.state.max !== null) {
      if (this._core.state.exclMax) impl.lt(this._core.state.max as number);
      else impl.lte(this._core.state.max as number);
    }
    if (this._core.state.multOf !== null) impl.multipleOf(this._core.state.multOf as number);
    return impl;
  }

  positive(): this { return cloner(this, cl => { cl._core.state.min = 0 as T; cl._core.state.exclMin = true; }); }
  nonnegative(): this { return cloner(this, cl => cl._core.state.min = 0 as T); }
  negative(): this { return cloner(this, cl => { cl._core.state.max = 0 as T; cl._core.state.exclMax = true; }); }
  nonpositive(): this { return cloner(this, cl => cl._core.state.max = 0 as T); }

  override get templateRegex(): string { return numRegex(this._core.state.min, this._core.state.exclMin, this._core.state.max, this._core.state.exclMax, true); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const selfDna: tsDna = [this.type, [this._core.state.min, this._core.state.exclMin, this._core.state.max, this._core.state.exclMax, this._core.state.multOf], this.meta()];
    return coll.storeDNA(selfDna, storeMark, storePosition);
  }
}

// Boolean implementation
export class BooleanImpl extends SchemaImplWithWrappers<boolean, boolean, tsStateBoolean> {
  static create(): any {
    const inst = this.initCore<boolean, boolean, tsStateBoolean>("b", {}, "toBoolean");
    (inst as any)._dna = ["b"];
    return inst;
  }

  override get templateRegex(): string { return "(?:true|false)"; }
}

export class BigIntImpl extends NumberImpl<bigint> {
  static create(): any { return this.init<bigint>("bi", "toBigInt"); }
  // int() and safe() are not applicable to bigint, so they are not implemented
  override positive(): this { return cloner(this, cl => { cl._core.state.min = BigInt(0); cl._core.state.exclMin = true; }); }
  override nonnegative(): this { return cloner(this, cl => cl._core.state.min = BigInt(0)); }
  override negative(): this { return cloner(this, cl => { cl._core.state.max = BigInt(0); cl._core.state.exclMax = true; }); }
  override nonpositive(): this { return cloner(this, cl => cl._core.state.max = BigInt(0)); }

  override get templateRegex(): string { return numRegex(this._core.state.min, this._core.state.exclMin, this._core.state.max, this._core.state.exclMax, false) + "n"; }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const selfDna: tsDna = [this.type, [this._core.state.min, this._core.state.exclMin, this._core.state.max, this._core.state.exclMax, this._core.state.multOf], this.meta()];
    return coll.storeDNA(selfDna, storeMark, storePosition);
  }
}

export class IntImpl extends NumberImpl<number> {
  static create(): any { return this.init<number>("i", "toInt"); }
  override get templateRegex(): string { return numRegex(this._core.state.min, this._core.state.exclMin, this._core.state.max, this._core.state.exclMax, false); }
}

export class Int32Impl extends NumberImpl<number> {
  static create(): any {
    const inst = this.init<number>("i", "toInt");
    (inst as any)._core.state.min = -(2 ** 31);
    (inst as any)._core.state.max = 2 ** 31 - 1;
    return inst;
  }

  override get templateRegex(): string {
    // Int32Impl has fixed min/max constraints, always require full validation
    return "\x00";
  }

  override min(value: number): this { return cloner(this, cl => cl._core.state.min = Math.max(cl._core.state.min!, value)); }
  override max(value: number): this { return cloner(this, cl => cl._core.state.max = Math.min(cl._core.state.max!, value)); }
  override gt(value: number): this { return cloner(this, cl => { cl._core.state.min = Math.max(cl._core.state.min!, value); cl._core.state.exclMin = true; }); }
  override gte(value: number): this { return cloner(this, cl => { cl._core.state.min = Math.max(cl._core.state.min!, value); cl._core.state.exclMin = false; }); }
  override lt(value: number): this { return cloner(this, cl => { cl._core.state.max = Math.min(cl._core.state.max!, value); cl._core.state.exclMax = true; }); }
  override lte(value: number): this { return cloner(this, cl => { cl._core.state.max = Math.min(cl._core.state.max!, value); cl._core.state.exclMax = false; }); }
  override multipleOf(value: number): this { return cloner(this, cl => cl._core.state.multOf = Math.max(cl._core.state.min!, Math.min(cl._core.state.max!, value))); }
}


// Enum implementation
export class EnumImpl<T extends tsDnaEnumInput> extends SchemaImplWithWrappers<
  tsDnaEnumValueType,
  tsDnaEnumValueType,
  tsStateEnum<T>
> {

  static init<T extends tsDnaEnumInput>(values: T): any {
    const inst = this.initCore<tsDnaEnumValueType, tsDnaEnumValueType, tsStateEnum<T>>("enum", { enumList: [], isObject: false });
    // Support arrays, object literals, and TypeScript enums
    if (Array.isArray(values)) {
      inst._core.state.enumList = [...values];
    } else {
      // Object literal or TypeScript enum - extract keys and values
      inst._core.state.isObject = true;
      inst._core.state.enumList = Object.values(values);
    }
    return inst;
  }

  get values(): tsDnaEnumValues { return this._core.state.enumList; }

  get enum(): Record<string, tsDnaEnumValueType> {
    return this._core.state.enumList.reduce((acc, val) => ({ ...acc, [String(val)]: val }), {});
  }
  extract(values: tsDnaEnumValueType[]): any {
    return cloner(this, cl => cl._core.state.enumList = cl._core.state.enumList.filter((v: any) => values.includes(v)));
  }
  exclude(values: tsDnaEnumValueType[]): any {
    return cloner(this, cl => cl._core.state.enumList = cl._core.state.enumList.filter((v: any) => !values.includes(v)));
  }

  override get templateRegex(): string {
    // For object enums, match both keys and values
    if (this._core.state.isObject) {
      const allValues = [...this._core.state.enumList, ...Object.keys(this._core.state.enumList)];
      return "(?:" + allValues.map((v: tsDnaEnumValueType) => escReg(String(v))).join("|") + ")";
    }
    return "(?:" + this._core.state.enumList.map((v: tsDnaEnumValueType) => escReg(String(v))).join("|") + ")";
  }

  override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this._core.dna = ["e", this._core.state.enumList];
    return coll.storeDNA(this._core.dna, storeMark, storePosition);
  }
}

// Array implementation
export class ArrayImpl<S extends tsDnaType<any, any>> extends SchemaImplWithWrappers<
  S[], S[],
  tsStateArray<S>
> {

  static init<S extends tsDnaType<any, any>>(itemSchema: S): any {
    return this.initCore<S[], S[], tsStateArray<S>>("array", { min: null, max: null, length: null, itemSchema });
  }



  unwrap(): S { //wrap for Array is not wrap for wrapper, unwrap of wrapper override until there is no wrapper anymore.
    return this._core.state.itemSchema;
  }

  min(n: number, meta?: string | tsDnaMeta): this { return cloner(this, cl => { cl._core.state.min = n; cl._core.innerMeta("min", meta); }); }
  max(n: number, meta?: string | tsDnaMeta): this { return cloner(this, cl => { cl._core.state.max = n; cl._core.innerMeta("max", meta); }); }
  length(n: number, meta?: string | tsDnaMeta): this { return cloner(this, cl => { cl._core.state.length = n; cl._core.innerMeta("length", meta); }); }
  nonempty(): this { return cloner(this, cl => cl._core.state.min = 1); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const constraints: any[] = [];
    if (this._core.state.min !== null) constraints.push(["minItems", this._core.state.min]);
    if (this._core.state.max !== null) constraints.push(["maxItems", this._core.state.max]);
    if (this._core.state.length !== null) {
      constraints.push(["minItems", this._core.state.length]);
      constraints.push(["maxItems", this._core.state.length]);
    }
    const itemsDef = ["items", -1];
    const itemsStoreId = coll.setStore(itemsDef);
    constraints.push(itemsDef);
    this._core.dna = ["a", constraints];
    const dnaId = coll.storeDNA(this._core.dna, storeMark, storePosition);
    this._core.state.itemSchema.toDna(coll, itemsStoreId, 1);
    return dnaId;
  }
}

// Promise implementation
export class PromiseImpl<T, I = unknown> extends SchemaImplWithWrappers<T, I, tsStatePromise<T, I>> {

  static init<T, I = unknown>(innerSchema: tsDnaType<T>): any {
    return this.initCore<T, I, tsStatePromise<T, I>>("promise", { innerSchema: innerSchema as any });
  }

  override unwrap() {
    return this._core.state.innerSchema;
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const innerState: tsDna = ["promise", -1, this.meta()];
    const innerStoreId = coll.setStore(innerState);
    const dnaId = coll.storeDNA(innerState, storeMark, storePosition);
    this._core.state.innerSchema.toDna(coll, innerStoreId, 1);
    this._core.dna = [...innerState];
    return dnaId;
  }
}

// Tuple implementation (Zod's z.tuple(items, rest?)): one schema per position,
// plus an optional rest schema for any extra items.
export class TupleImpl<S extends tsDnaTupleSchemaRO, R = never> extends SchemaImplWithWrappers<
  tsDnaTupleValueWithRest<S, R>,
  tsDnaTupleValueWithRest<S, R>,
  tsStateTuple<S, R>
> {

  static init<S extends tsDnaTupleSchemaRO, R = never>(items: S, rest?: tsDnaType<R>): any {
    return this.initCore<tsDnaTupleValueWithRest<S, R>, tsDnaTupleValueWithRest<S, R>, tsStateTuple<S, R>>("tuple", { items, rest });
  }

  min(n: number, meta?: string | tsDnaMeta): this { return cloner(this, () => { }); }
  max(n: number, meta?: string | tsDnaMeta): this { return cloner(this, () => { }); }
  length(n: number, meta?: string | tsDnaMeta): this { return cloner(this, () => { }); }
  nonempty(): this { return cloner(this, () => { }); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const len = this._core.state.items.length;
    const prefixItems = new Array(len);
    const prefixStoreId = coll.setStore(prefixItems);
    // No rest -> `items: false` (no extra items, Zod default). Rest -> the rest schema id.
    const itemsDef: any[] = ["items", this._core.state.rest ? 0 : false];
    const itemsStoreId = this._core.state.rest ? coll.setStore(itemsDef) : -1;
    const constraints: any[] = [
      ["prefixItems", prefixItems],
      ["minItems", len],
      itemsDef,
    ];
    this._core.dna = ["a", constraints];
    const dnaId = coll.storeDNA(this._core.dna, storeMark, storePosition);
    for (let poz = len; poz--;) this._core.state.items[poz].toDna(coll, prefixStoreId, poz);
    if (this._core.state.rest) this._core.state.rest.toDna(coll, itemsStoreId, 1);
    return dnaId;
  }
}

// Object implementation
export class ObjectImpl<T extends Record<string, tsDnaType<any, any>> = Record<string, tsDnaType<any, any>>, I = Record<string, unknown>> extends SchemaImplWithWrappers<T, I, tsStateObject> {

  static init<T extends Record<string, tsDnaType<any, any>> = Record<string, tsDnaType<any, any>>, I = Record<string, unknown>>(propertySchemas?: T, objType: 'strict' | 'loose' | 'standard' = 'standard') {
    const inst = this.initCore<T, I, tsStateObject>("object", { propertySchemas, addPropSchema: undefined, objType, requiredKeys: [] });
    for (const prop in propertySchemas) {
      const desc = Object.getOwnPropertyDescriptor(propertySchemas, prop);
      if (desc?.get !== undefined) inst._core.state.propertySchemas[prop] = GetterSchemaImpl.init<T[keyof T]>(desc.get);
      else inst._core.state.propertySchemas[prop] = propertySchemas[prop];
    }
    // A key is required unless its schema carries an absent-tolerant wrapper
    // (optional/nullish/default/prefault/catch). `nullable` stays required.
    inst._core.state.requiredKeys = Object.keys(inst._core.state.propertySchemas).filter(
      k => isRequiredKey(inst._core.state.propertySchemas![k])
    );
    return inst;
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const constraints: any[] = [];
    this._core.dna = ["o", constraints];
    // Schema instances serialize identically in the collector discriminant, so two
    // objects with the same keys but different value schemas (e.g. discriminated-union
    // branches differing only by their `literal` discriminator) would falsely dedupe.
    // Add a per-property signature (leaf opcode + literal value) to distinguish them.
    const propSig = this._core.state.propertySchemas
      ? Object.entries(this._core.state.propertySchemas).map(([k, v]) => {
        let leaf: tsDnaType<any> = v;
        while (leaf instanceof WrapperImpl) leaf = leaf.unwrap();
        return leaf instanceof LiteralImpl ? [k, "l", Array.from(leaf.values)] : [k, leaf.type];
      })
      : undefined;
    const dnaId = coll.storeDNA(this._core.dna, storeMark, storePosition, [this._core.state.objType, this._core.state.propertySchemas, this._core.state.requiredKeys, this._core.state.addPropSchema, propSig]);
    if (this._core.state.propertySchemas) {
      const properties: [string, number, tsDnaMeta][] = [];
      const defaultProperties: [string, number, tsDnaMeta][] = [];

      // Store each property schema and update its index.
      // NOTE: optional properties are NOT unwrapped here — the `wrp` wrapper must
      // survive so an explicitly-present `undefined` (e.g. `{ a: undefined }`) is
      // still accepted. Absent keys are handled separately via the required list.
      for (const [key, schema] of Object.entries(this._core.state.propertySchemas)) {
        const schemaToTarget = schema;
        const schemaMeta = schema.meta();
        // A `lazy`/getter property can't be resolved at object-init time (the
        // recursive const is still in its TDZ), so its key-optionality meta
        // (optional/nullable/default on the recursive ref) is invisible there. At emit
        // time the const exists, so resolve the getter now to read its REAL meta —
        // otherwise an optional/nullable recursive key is wrongly treated as required.
        const realMeta = schema instanceof GetterSchemaImpl ? schema.innerType.meta() : schemaMeta;
        const propDef: [string, number, tsDnaMeta] = [key, 0, schemaMeta];
        const propStoreId = coll.setStore(propDef);

        schemaToTarget.toDna(coll, propStoreId, 1);

        // A `nonoptional` key is required, so it must NOT go to defaultProperties
        // (which would silently supply the default for an absent key); keep it in
        // `properties` where the default still applies to a present `undefined`.
        if (isWrapped(realMeta)) defaultProperties.push(propDef); else properties.push(propDef);
        // coll.updateStore(propStoreId, schema.meta(), 2)
      }
      if (properties.length) constraints.push(["properties", properties]);
      if (defaultProperties.length) constraints.push(["defaultProperties", defaultProperties]);
      // `requiredKeys` was computed at init; a getter property could not be resolved
      // then, so re-check those here against their resolved meta (respecting any
      // `.partial()`/`.required()` already applied, which left them out / in).
      const requiredKeys = this._core.state.requiredKeys.filter(k => {
        const s = this._core.state.propertySchemas![k];
        return !(s instanceof GetterSchemaImpl) || isRequiredKey(s.innerType);
      });
      if (requiredKeys.length) constraints.push(["required", requiredKeys]);
    }
    if (this._core.state.objType === 'strict') {
      constraints.push(["additionalProperties", false]);
    } else if (this._core.state.objType === 'loose') {
      constraints.push(["additionalProperties", true]);
    } else if (this._core.state.addPropSchema && typeof this._core.state.addPropSchema !== 'boolean') {
      // catchall takes precedence over strict/loose
      const addPropDef = ["additionalProperties", 0];
      const addPropStoreId = coll.setStore(addPropDef);
      constraints.push(addPropDef);
      (this._core.state.addPropSchema as tsDnaType<any>).toDna(coll, addPropStoreId, 1);
    }
    return dnaId;
  }

  strict() { return cloner(this, cl => cl._core.state.objType = "strict"); }
  loose() { return cloner(this, cl => cl._core.state.objType = "loose"); }
  /** @deprecated Use loose() instead */
  passthrough() { return this.loose(); }

  catchall(addPropSchema: tsDnaType<any, any>) { this._core.state.addPropSchema = addPropSchema; return this }
  /** Alias of catchall() for compatibility @see catchall() */
  catchAll(addPropSchema: tsDnaType<any, any>) { return this.catchall(addPropSchema); }

  partial(keys?: Record<string, boolean>) {
    return cloner(this, cl => {
      if (keys) cl._core.state.requiredKeys = cl._core.state.requiredKeys?.filter(k => !keys[k]); else cl._core.state.requiredKeys = [];
      if (cl._core.state.propertySchemas) {
        for (const key in cl._core.state.propertySchemas) {
          const schema = cl._core.state.propertySchemas[key];
          const makeOptional = keys ? keys[key] : true;
          if (makeOptional) {
            const meta = schema.meta();
            if (meta && meta.optional === undefined) cl._core.state.propertySchemas[key] = WrapperImpl.init(schema, "optional");
          }
        }
      }
    });
  }

  required(keys?: Record<string, boolean>) {
    return cloner(this, cl => {
      if (keys) cl._core.state.requiredKeys = Object.keys(cl._core.state.propertySchemas ?? {}).filter(k => keys[k]);
      else cl._core.state.requiredKeys = Object.keys(cl._core.state.propertySchemas ?? {});
    });
  }

  get shape(): Record<string, tsDnaType<any>> | undefined {
    return this._core.state.propertySchemas;
  }

  keyOf(): PropertyKey[] {
    return Object.keys(this._core.state.propertySchemas ?? {});
  }

  apply<R>(fn: (schema: this) => R): R {
    return fn(this);
  }

  omit<K extends keyof T>(keys: Record<K, boolean>): tsDnaObject<Omit<T, K>> {
    if (!this._core.state.propertySchemas) {
      return this as unknown as tsDnaObject<Omit<T, K>>;
    }
    const newPropertySchemas: Record<string, tsDnaType<any>> = {};
    for (const [key, schema] of Object.entries(this._core.state.propertySchemas)) {
      if (!keys[key as K]) {
        newPropertySchemas[key] = schema;
      }
    }
    const newObject = ObjectImpl.init(newPropertySchemas, this._core.state.objType);
    newObject._core.rawMeta(this.meta());
    return newObject as unknown as tsDnaObject<Omit<T, K>>;
  }

  pick<K extends keyof T>(keys: Record<K, boolean>): tsDnaObject<Pick<T, K>> {
    if (!this._core.state.propertySchemas) {
      return this as unknown as tsDnaObject<Pick<T, K>>;
    }
    const newPropertySchemas: Record<string, tsDnaType<any>> = {};
    for (const [key, schema] of Object.entries(this._core.state.propertySchemas)) {
      if (keys[key as K]) {
        newPropertySchemas[key] = schema;
      }
    }
    const newObject = ObjectImpl.init(newPropertySchemas, this._core.state.objType);
    newObject._core.rawMeta(this.meta());
    return newObject as unknown as tsDnaObject<Pick<T, K>>;
  }

  extend<U extends Record<string, any>>(shape: U): tsDnaObject<T & U> {
    const newPropertySchemas: Record<string, tsDnaType<any>> = { ...this._core.state.propertySchemas };
    for (const [key, schema] of Object.entries(shape)) {
      newPropertySchemas[key] = schema;
    }
    const newObject = ObjectImpl.init(newPropertySchemas, this._core.state.objType);
    newObject._core.rawMeta(this.meta());
    return newObject.asAPI as tsDnaObject<T & U>;
  }
}

// Generic combinator implementation (anyOf, allOf, oneOf)
export class CombinatorImpl<T, I = T, S extends tsDnaTupleSchemaBase = tsDnaTupleSchemaBase> extends SchemaImplWithWrappers<
  T, I,
  tsStateCombinator<S>
> {

  static init<T, I = T, S extends tsDnaTupleSchemaBase = tsDnaTupleSchemaBase>(combinatorType: "anyOf" | "allOf" | "oneOf", schemas: S): any {
    return this.initCore<T, I, tsStateCombinator<S>>(combinatorType, { schemas, combinatorType });
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    let nbItems = this._core.state.schemas.length
    const combinatorDef = new Array(nbItems + 1);
    const storeId = coll.setStore(combinatorDef);
    combinatorDef[0] = this._core.state.combinatorType;
    this._core.dna = [this._core.state.combinatorType, combinatorDef];
    const dnaId = coll.storeDNA(this._core.dna, storeMark, storePosition);
    for (; nbItems--;) this._core.state.schemas[nbItems].toDna(coll, storeId, nbItems + 1);
    return dnaId;
  }
}

// Union implementation (anyOf)
export class UnionImpl<S extends tsDnaTupleSchemaBase> extends CombinatorImpl<$DnaInfer<S[number]>, $DnaInfer<S[number]>, S> {

  static create<S extends tsDnaTupleSchemaBase>(schemas: S): any {
    return CombinatorImpl.init("anyOf", schemas);
  }
}

// Intersection implementation (allOf)
export class AllOfImpl<T, U, I = T & U> extends CombinatorImpl<T & U, I, [tsDnaType<T, I>, tsDnaType<U, I>]> {

  static create<T, U, I = T & U>(schemas: [tsDnaType<T, I>, tsDnaType<U, I>]): any {
    return CombinatorImpl.init<T, I>("allOf", schemas);
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
function finiteValueSet(s: tsDnaType<any>): any[] | undefined {
  const head = (s as any).head;
  if (head instanceof LiteralImpl) {
    return head._rawValues;
  }
  if (head instanceof EnumImpl) return [...head.values];
  if (head instanceof GetterSchemaImpl) {
    // Lazy: Zod does not enforce exhaustiveness on lazy schemas
    return undefined;
  }
  if (head instanceof CombinatorImpl) {
    if (head._core.state.combinatorType !== "anyOf") return undefined; // only unions have a value set
    const out: any[] = [];
    for (const m of head._core.state.schemas as tsDnaType<any>[]) {
      const mv = finiteValueSet(m);
      if (!mv) return undefined;
      out.push(...mv);
    }
    return out;
  }
  // For wrappers, we still need to traverse to add their values (optional -> undefined, etc.)
  if (s instanceof WrapperImpl) {
    const inner = finiteValueSet(s.unwrap());
    if (!inner) return undefined;
    switch (s._core.state.wrapperType) {
      case "optional": return [...inner, undefined];
      case "nullable": return [...inner, null];
      case "nullish": return [...inner, undefined, null];
      default: return inner; // default / prefault / catch
    }
  }
  if (head.type === "null") return [null];
  if (head.type === "undefined") return [undefined];
  return undefined;
}

// Discriminated union implementation (discriminator opcode)
export class DiscriminatorImpl<K extends string, S extends tsDnaTupleSchemaBase, I = $DnaInfer<S[number]>> extends SchemaImplWithWrappers<
  $DnaInfer<S[number]>,
  I,
  tsStateDiscriminator<K, S, I>
> {

  static init<K extends string, S extends tsDnaTupleSchemaBase, I = $DnaInfer<S[number]>>(discriminator: K, schemas: S) {
    return this.initCore<$DnaInfer<S[number]>, I, tsStateDiscriminator<K, S, I>>("discriminator", { discriminator, schemas })
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const nbItems = this._core.state.schemas.length;
    // `discriminatorDef[1][i]` is the value SET (array) accepted by branch `i`.
    const discriminatorDef: [string, any[][], number[]] = [this._core.state.discriminator, new Array(nbItems), new Array(nbItems)];
    const storeId = coll.setStore(discriminatorDef);
    this._core.dna = ["discriminator", discriminatorDef];
    const dnaId = coll.storeDNA(this._core.dna, storeMark, storePosition);

    // Convert schemas in reverse order (LIFO like CombinatorImpl)
    for (let i = nbItems; i--;) {
      const schema = this._core.state.schemas[i];

      // Extract the discriminator value set from the branch's discriminator schema.
      if (schema instanceof ObjectImpl) {
        const discriminatorSchema = schema.shape?.[this._core.state.discriminator];
        const values = discriminatorSchema ? finiteValueSet(discriminatorSchema) : undefined;
        if (values) discriminatorDef[1][i] = values;
      }

      schema.toDna(coll, storeId, [2, i]);
    }

    return dnaId;
  }
}

// Intersection implementation (allOf)
export class IntersectionImpl<S extends tsDnaType<any>[]> extends CombinatorImpl<$UnionToIntersection<$Output<S[number]>>, S> {
  static create<S extends tsDnaTupleSchemaBase>(schemas: S): tsDnaType<$UnionToIntersection<$Output<S[number]>>> {
    return CombinatorImpl.init("allOf", schemas) as tsDnaIntersection<S>;
  }
}

// Exclusive union implementation (oneOf)
export class XorImpl<S extends tsDnaTupleSchemaBase> extends CombinatorImpl<$DnaInfer<S[number]>, $Output<S[number]>, S> {
  static create<S extends tsDnaTupleSchemaBase>(schemas: S): any {
    return CombinatorImpl.init("oneOf", schemas);
  }
}

// Record implementation
export class RecordImpl<K extends tsDnaType<any>, V extends tsDnaType<any>, I = Record<$Output<K>, $Output<V>>> extends SchemaImplWithWrappers<
  Record<$Output<K>, $Output<V>>, I,
  tsStateRecord<K, V>
> {

  static init<K extends tsDnaType<any>, V extends tsDnaType<any>, I = Record<$Output<K>, $Output<V>>>(keySchema: K, valueSchema: V, type: "partial" | "loose" | "standard" = "standard"): any {
    return this.initCore<Record<$Output<K>, $Output<V>>, I, tsStateRecord<K, V>>("record", { keySchema, valueSchema, type });
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const keySchema = this._core.state.keySchema;
    // A record matches only a *plain* object (Zod `z.record` rejects Date/Map/class
    // instances, unlike `z.object`). The "o" compiler turns this flag into a
    // prototype check (Object.prototype | null).
    const constraints: any[] = [["plainObject"]];

    // loose: keys matching the key schema validate their value; non-matching keys
    // pass through unchanged. Modeled as `patternProperties(keyPattern -> value)` +
    // `additionalProperties: true`, reusing the tested pattern-matching path. The
    // pattern is the key schema's `templateRegex` (e.g. `string().regex(/^S_/)` ->
    // "^S_"; plain `string()` -> ".*" so every key matches and every value is checked).
    if (this._core.state.type === "loose") {
      const keyPattern = keySchema.templateRegex;
      const patternPair: [string, number] = [keyPattern, 0];
      const patternStoreId = coll.setStore(patternPair);
      constraints.push(["patternProperties", [patternPair]]);
      constraints.push(["additionalProperties", true]);
      this._core.dna = ["o", constraints];
      const dnaId = coll.storeDNA(this._core.dna, storeMark, storePosition);
      this._core.state.valueSchema.toDna(coll, patternStoreId, 1);
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
      if (this._core.state.type !== "partial") constraints.push(["required", finiteKeys]);
      this._core.dna = ["o", constraints];
      const dnaId = coll.storeDNA(this._core.dna, storeMark, storePosition);
      // Use head to check if the root schema is a literal array
      const head = (keySchema as any).head;
      const isLiteralArray = head instanceof LiteralImpl && head._rawValues.length > 1;
      // Use keySchema.toDna() for transformations on non-literal-array schemas (to preserve them)
      // Use EnumImpl for literal arrays (to validate individual elements instead of the whole array)
      // Use EnumImpl for other finite schemas (enum, union of literals)
      if (isLiteralArray) {
        EnumImpl.init(finiteKeys).toDna(coll, keyStoreId, 1);
      } else if (keySchema.type === "seq" || (keySchema instanceof SchemaImpl && keySchema._core.state.wrapperType === "transform")) {
        keySchema.toDna(coll, keyStoreId, 1);
      } else {
        EnumImpl.init(finiteKeys).toDna(coll, keyStoreId, 1);
      }
      this._core.state.valueSchema.toDna(coll, valueStoreId, 1);
      return dnaId;
    }

    const keyDef = ["propertyNames", 0, null];
    const keyStoreId = coll.setStore(keyDef);
    constraints.push(keyDef, valueDef);

    this._core.dna = ["o", constraints];
    const dnaId = coll.storeDNA(this._core.dna, storeMark, storePosition);

    const coercedKeySchema = keySchema._core.inst.forceCoerce();
    coercedKeySchema.toDna(coll, keyStoreId, 1);

    this._core.state.valueSchema.toDna(coll, valueStoreId, 1);
    return dnaId;
  }
}


// Codec implementation - bidirectional encode/decode
// Decode direction reuses the BASE `#state` validator/parser cache (CodecImpl
// overrides `toDna()` to return the decode twin, so the base `_validate`/`_safeParse`
// build the right thing). Only the ENCODE direction needs its own cache here.
export class CodecImpl<I, O> extends SchemaImplWithWrappers<
  O, I,
  tsStateCodec<I, O>
> {

  static init<I, O>(inSchema: tsDnaType<I>, outSchema: tsDnaType<O>, decode: tsDecodeFn<I, O>, encode: tsEncodeFn<O, I>, externals?: tsExternalsDecl): any {
    // External refs used by decode/encode flow through the inner transforms.
    return this.initCore<O, I, tsStateCodec<I, O>>("codec", {
      inSchema,
      outSchema,
      decodeTwin: inSchema.transform(decode, externals).pipe(outSchema),
      encodeTwin: outSchema.transform(encode, externals).pipe(inSchema),
    }, undefined);
  }



  // Emit the decode twin as this codec's own node via `_emitSelf` (NOT a `toDna`
  // override) so the base refiner layer (`_emitRefiners`) still wraps any
  // `.refine()`/`.check()` added on the codec around it. A `toDna` override returned
  // the twin directly and silently dropped codec-level refinements.
  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    return this._core.state.decodeTwin.toDna(coll, storeMark!, storePosition);
  }

  // Decode direction (`_validate`/`_safeParse`) is inherited: the base builds from
  // `this.toDna()` and caches in `#state`.

  override safeEncode(value: unknown, ctx?: tsExternals): tsParserResult {
    if (this._core.state.cachedEncodeParser) return this._core.state.cachedEncodeParser(value);
    this._core.state.cachedEncodeParser = parserBuilder(this._core.state.encodeTwin.toDna(), ctx);
    return this._core.state.cachedEncodeParser(value);
  }
}


// ============================================
// Getter Schema for recursive definitions
// ============================================
export class GetterSchemaImpl<T extends tsDnaType<any>, I = $DnaInfer<T>> extends SchemaImplWithWrappers<
  $DnaInfer<T>, I,
  tsStateGetter<T, I>
> {
  static init<T extends tsDnaType<any>, I = $DnaInfer<T>>(getter: () => T): any {
    return this.initCore<$DnaInfer<T>, I, tsStateGetter<T, I>>("lazy", { getter });
  }

  get innerType(): T {
    return this._core.state.getter();
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const dna: tsDna = ["ref", -1, this.meta()];
    const storeId = coll.setStore(dna);
    const dnaId = coll.storeDNA(dna, storeMark, storePosition, storeId);
    const getterDnaId = this._core.state.getter().toDna(coll, storeId, 1);
    coll.refList.push(getterDnaId);
    this._core.dna = dna;
    return dnaId;
  }
}

// ============================================
// Property Check Schema for type-safe property validation (Zod V4 compatibility)
// ============================================
export class PropCheckImpl<K extends string | number, S extends tsDnaType<any, any, any>> implements tsDnaPropertyCheck<K, S> {
  kind: "property" = "property";
  #state: tsStateFull<tsStatePropCheck<K, S>> = {
    type: "property",
    meta: {},
    coerceCode: undefined,
    refinerList: [],
    dna: ["T"],
    innerState: { property: "" as K, schema: SchemaImpl.initCore<$Output<S>, $Input<S>, $State<S>>("any", {}) }
  };

  static init<K extends string | number, S extends tsDnaType<any, any, any>>(property: K, schema: S): tsDnaPropertyCheck<K, S> {
    const inst = new PropCheckImpl<K, S>();
    inst.#state.innerState = { property, schema };
    return inst;
  }

  get property(): K { return this.#state.innerState.property; }
  get schema(): S { return this.#state.innerState.schema; }

}