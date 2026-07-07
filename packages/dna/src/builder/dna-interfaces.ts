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
import { isWrapped, WRAPPERS_PREPROCESS, ABSENT_TOLERANT_WRAPPERS, WRAPPERS_KEYOPT, INT32Bounds } from "../shared/constants.js";
import { STRING_FORMAT_PATTERNS, escReg, numRegex } from "../shared/string-format.js";
import { parserBuilder, validatorBuilder } from "../toJs/dna-to-js.js";
import type {
  $DnaInfer,
  $DnaInferInput,
  $SeqLastOutput,
  $ValidatePipeArgs,
  IDnaLazySchema,
  // DnaType,
  tsPrimitive,
  tsPrimitiveBase,
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
  // tsDnaString as DnaString,
  tsDnaTmplLit,
  tsDnaTuple, tsDnaTupleSchemaBase,
  tsDnaTupleSchemaRO,
  tsDnaTupleValueWithRest,
  tsDnaUnion,
  tsDnaPipe,
  tsDnaIntersection as DnaIntersection,
  tsDnaXorUnion,
  tsDnaCodec, tsDnaPropertyCheck,
  tsAllDnaTypes
} from "../types/api-builder.types.js";
import { CoreFactory, normalizeCoreDefinition, type tsStateMgrInst } from "./state-manager.js";
import type { tsDna, tsDnaId, tsDnaNoMeta, tsDnaOpcode, tsDnaSeq } from "../types/core.types.js";
import type { $CatchValue, $DnaBranded, $Input, $MaybeAsync, $Output, $State, $UnionToIntersection, $WithBrand, $Xor } from "../types/helpers.types.js";
import { BaseCore, initDna } from "./dna-core.js";
import type { IDnaCollector } from "./collector.types.js";
import { coerce } from "./api-primitives.js";


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
// ============================================


export function pipeFactory<T, U, I>(src: DnaType<T, I>, target: DnaType<U, T>): DnaType<U, I> {
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

export function transformFactory<T, R>(fn: tsTransformFn<T, R>, externals?: tsExternalsDecl): DnaType<R, T> {
  // External names live in `meta.externals` (not the opt tuple) so the DNA opcode shape
  // `["transform", [fnStr, arity], meta]` is unchanged.
  const map = externalsMap(externals);
  if (typeof fn === "function") {
    const s = DnaGenericWrapped.init<R, T>("transform", ["transform", [fn.toString(), fn.length]]);
    return Object.keys(map).length ? s._core.rawMeta({ externals: map }) : s;
  }
  return DnaGenericWrapped.init<R, T>("transform", ["transform", ["()=>" + stringify(fn), 0]]);
}

export function preprocessFactory<O>(fn: (value: unknown) => O, target: DnaType<O, O>): DnaType<O> {
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


const SymSetHead = Symbol("setHead");
const SymForceCoerce = Symbol("forceCoerce");
const SymCore = Symbol("_core");

export function cloner<T extends DnaType<any, any>>(schema: T, fn: (cl: T) => void): T {
  const cl = schema.clone();
  let clHeaded: any = cl;
  // Preserve head reference (all schemas in a chain point to the same head)
  if (schema._head) clHeaded = cl[SymSetHead](schema._head);
  fn(clHeaded);
  return clHeaded;
}

// export function withMeta<T>(instance: T, meta?: string | tsDnaMeta): T {
//   if (meta === undefined || !(instance instanceof DnaType)) return instance;
//   return instance.meta(meta);
// };


// ============================================
// Schema Builder export class (with discriminated types)
// ============================================

export class DnaType<T = unknown, I = unknown> {
  declare _output: T;
  declare _input: I;
  // declare _stateDef: StateDef;

  // #mapper = new Map<IDnaCollector, tsDnaId>();


  // _core is already defined dans DnaType
  protected _core = new BaseCore("any", { rawDna: ["T"] });
  [SymCore] = this._core;

  protected get _state() { return this._core.seed };
  get _head(): unknown { return this._core.head; }
  [SymSetHead]<HL>(head: HL): this & { readonly _head: HL } { this._core.setHead(head); return this as any; }

  get description(): string | undefined { return this._core.seed.meta.description; }
  get type() { return this._core.state.type; }

  /**
   * Coercion mutator (e.g. "toNumber") applied as the OUTERMOST serialization
   * layer. Set by `dna.coerce.*`. `undefined` means no coercion.
  */
  get _coerce(): boolean { return this._core.coerce; }
  set _coerce(bool: boolean) { }
  get _coerceCode(): string | undefined { return this._core.seed.coerceCode; }

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
    while (leaf instanceof WrapperImpl) leaf = leaf.unwrap();
    leaf._core.coerce = true;
    return cloned;
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

  // protected get _templateRegex(): string { return "\x00" }
  // protected get _templateRegex(): string { return this._core.templateRegex; }

  // constructor(coerceCode?:string){
  //   this._core = new DnaTypeCore(coerceCode);
  // }

  // static initCore<T, I, State extends tsStateDef>(type: string = "any", seed: State, coerceCode?: string) {
  //   const inst = new this<T, I, State>();
  //   const stateFull: tsStateFull<State> = {
  //     type,
  //     meta: {} as tsDnaInnerMeta,
  //     coerce: false,
  //     coerceCode,
  //     refinerList: [],
  //     rawDna: ["T"],
  //     seed
  //   };
  //   inst._core = new BaseCore(stateFull);
  //   inst._core.head = inst;
  //   return inst as this["_apiType"];
  // }

  clone() {
    const clone = new (this.constructor as new () => this)();
    const clonedState = this._core.cloneState();
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
   * `_emitSelf` (position 0) and the `check` opcodes (positions 1..n) in a `seq`.
   * Otherwise delegates straight to `_emitSelf`.
   */
  protected _emitRefiners(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): tsDnaId {
    const checks = this._core.refinerList;
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
  // protected override _emitSelf(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): tsDnaId {
  protected _emitSelf(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): tsDnaId {
    return coll.storeDNA(this._core.dnaWithMeta, mark, pos);
  }


  toDna(): tsDnaSeq;
  toDna(collector: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId;
  toDna(collector?: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId | tsDnaSeq {
    if (collector instanceof DnaCollector) {
      const _dnaId = this._core.getDnaId(collector);
      if (_dnaId !== undefined) { collector.updateStore(storeMark!, _dnaId, storePosition); return _dnaId };
      const dnaId = this._toDna(collector, storeMark, storePosition);
      return this._core.setDnaId(collector, dnaId);
    }

    if (this._core.fullDna) return this._core.fullDna;

    // const customToDna = customToDnaMap.get(this) as tsFnToDnaSeq;
    // if (customToDna) { this.#fullDna = customToDna(); return this.#fullDna; }

    const coll = new DnaCollector();
    this._core.mapper.set(coll, 0);

    this._toDna(coll, storeMark, storePosition);
    this._core.fullDna = coll.getDnaSeq();
    return this._core.fullDna;
  }

  pipe<U extends DnaType<any, T>>(target: U): DnaType<$Output<U>, I>;
  pipe<Schemas extends readonly [DnaType<any, any>, ...DnaType<any, any>[]]>(
    ...schemas: Schemas & $ValidatePipeArgs<T, Schemas>
  ): DnaType<$SeqLastOutput<Schemas>, I>;
  pipe<U>(target: DnaType<U, T>, ...rest: DnaType<any, any>[]): DnaType<$Output<U>, I> {
    const allSchemas = [target, ...rest];
    const pipeSeq = DnaPipe.init<U, I>([
      this,
      ...allSchemas
    ]);
    pipeSeq.setHead(this);
    // On garantit que l'Output final est dynamique (any en interne, résolu par la signature)
    // mais que l'Input d'origine "I" est conservé
    return pipeSeq as DnaType<$Output<U>, I>;
  }

  transform<R>(fn: (arg: $Output<this>) => $MaybeAsync<R>, externals?: tsExternalsDecl): DnaType<R, I>;
  transform<R>(fn: (arg: $Output<this>, ctx: ITransformContext<$Output<this>>) => $MaybeAsync<R>, externals?: tsExternalsDecl): DnaType<R, I>;
  transform<R>(fn: (ctx: ITransformContext<$Output<this>>) => $MaybeAsync<R>, externals?: tsExternalsDecl): DnaType<R, I>;
  // transform<R>(fn: (arg: any) => $MaybeAsync<R>): IDnaSchemaBase<R, I>;
  transform<R>(fn: tsTransformFn<T, R>, externals?: tsExternalsDecl): DnaType<R, I> {
    return this.pipe(transformFactory(fn, externals));
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
      const map = externalsMap(typeof options === "object" ? options?.externals as tsExternalsDecl : undefined);
      if (Object.keys(map).length) {
        cl._core.refinerList.push(["func", fn.toString(), fn.length, errorOpt, map]);
      } else {
        cl._core.refinerList.push(["func", fn.toString(), fn.length, errorOpt]);
      }
    }) as this;
  }

  check(...checks: (tsDnaCheck | tsDnaPropertyCheck<keyof $Input<this>, DnaType<any>> | ((ctx: ICheckContext<$Input<this>>) => void))[]) {
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
  with(...checks: (tsDnaCheck | ((ctx: ICheckContext<$Input<this>>) => void))[]) {
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

  brand<T extends PropertyKey = PropertyKey, Dir extends "in" | "out" | "inout" = "out">(value?: T): PropertyKey extends T ? this : $DnaBranded<this, T, Dir> {
    // .brand() adds a brand to the type for type-level discrimination
    // This is purely for TypeScript typing, no runtime effect
    // The direction parameter ("in" | "out" | "inout") controls which type gets branded
    return this as PropertyKey extends T ? this : $DnaBranded<this, T, Dir>;
  }

  catch<R>(defaultValue: R): DnaCatch<T | R, I>;
  catch<R>(catchfn: (ctx: IContext<unknown>) => R): DnaCatch<T | R, I>;
  catch<R>(arg0: R | ((ctx: IContext<unknown>) => R)): DnaCatch<T | R, I> {
    // .catch() provides a default value when parsing fails
    // Unlike .default() which only handles undefined, .catch() handles ALL parsing errors
    const wrapper = initDna(DnaCatch<T | R, I>, { inner: this, value: arg0 });
    wrapper._core.setHead(this);
    return wrapper;
  }

  // Properties
  toJSONSchema(): Record<string, unknown> {
    // Placeholder for JSON Schema conversion
    return {};
  }

  // Composition methods
  array(): DnaArray<this> {
    const arraySchema = ArrayImpl.init<this>(this);

    // arraySchema._core.rawMeta(this.meta());
    arraySchema._core.setHead(this._head);
    return arraySchema;
  }

  or<U>(other: DnaType<U>): DnaType<T | U> {
    const union = UnionImpl.init<T | U, I>("anyOf", [this, other]);

    // union._core.rawMeta(this.meta());
    union._core.setHead(this._head);
    return union;
  }

  and<U>(other: DnaType<U>) {
    // In Zod, and() creates an intersection
    // For DNA, we use allOf (intersection) with a store pattern like UnionImpl
    // const intersection = IntersectionImpl.create([this, other]);
    const intersection = initDna(DnaItersection)
    // intersection._core.rawMeta(this.meta());
    intersection._core.setHead(this._head);
    return intersection;

  }

  xor<U>(other: DnaType<U>): DnaType<$Xor<T, U>> {
    // In Zod, xor() creates an exclusive union (exactly one must match)
    // For DNA, we use oneOf opcode
    // const xorSchema = XorImpl.init<$Xor<T, U>, I>("oneOf", [this, other]);
    const xorSchema = initDna(DnaXorUnion)

    // xorSchema._core.rawMeta(this.meta());
    xorSchema._core.setHead(this._head);
    return xorSchema;
  }

  describe(description: string) { return cloner(this, cl => cl._core.meta.description = description) as this; }
  readonly() { return cloner(this, cl => cl._core.meta.readonly = true) as this; }

  register(fn: (schema: this) => void) { return cloner(this, cl => fn(cl)) as this; }

  overwrite<U>(fn: (schema: this) => U): U { return fn(this); }

  apply<R, A extends unknown[] = []>(fn: (schema: this, ...args: A[]) => R, args: A[] = []): R {
    return fn(this, ...args);
  }


  _validate(ctx?: tsExternals): tsValidatorFn {
    if (this._core.seed.cachedValidator) return this._core.seed.cachedValidator;
    this._core.seed.cachedValidator = validatorBuilder(this.toDna(), ctx);

    return this._core.seed.cachedValidator;
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
    if (this._core.seed.cachedParser) return this._core.seed.cachedParser;
    this._core.seed.cachedParser = parserBuilder(this.toDna(), ctx);

    return this._core.seed.cachedParser;
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
  optional(): DnaOptional<T, I> {
    throw new Error("optional() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  nullable(): DnaNullable<T, I> {

    throw new Error("nullable() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  nullish(): DnaNullish<T, I> {
    throw new Error("nullish() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  default(value: T): DnaDefault<T, I> {
    throw new Error("default() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  prefault(value: $Input<this>): DnaPrefault<this> {
    throw new Error("prefault() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  // Additional meta flags for object key behavior
  exactOptional() {
    // Marks the schema so that when used as an object property key, the key becomes
    // non-required (an absent key is allowed). However, the VALUE is still validated
    // strictly by the inner schema — an explicit `undefined` or `null` is REJECTED
    // (unlike `.optional()` which accepts these values). This flag only has meaning
    // inside an object definition; on a bare schema it has no effect.
    // See `acceptsAbsent` in the object handler for the implementation.
    return cloner(this, cl => cl._core.rawMeta({ exactOptional: true }));
  }

  nonoptional(): DnaType<T, I> {
    // Marks the schema so that when used as an object property key, the key becomes
    // REQUIRED again, even if the schema was previously marked as optional or nullish.
    // This overrides the optional behavior at the OBJECT KEY level only — the value-level
    // handling (accepting undefined/null) is managed separately by WrapperImpl.nonoptional().
    // On a bare schema (not inside an object), this flag has no effect since the value
    // is already required by default.
    // Also removes conflicting flags (exactOptional, optional) to ensure consistency.
    return cloner(this, cl => {
      const currentMeta = cl._core.meta as tsDnaInnerMeta;

      const { exactOptional, optional, ...rest } = currentMeta;
      cl._core.rawMeta({ ...rest, nonoptional: true });

    });

  }

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
  unwrap(): DnaType<T, I> | never {
    throw new Error("unwrap() can only be called when a wrapper (optional, nullable, nullish, default, prefault) has been applied");
  }
  optional(): DnaOptional<this> {
    const wrp = initDna(DnaOptional, { inner: this })[SymSetHead](this._head);
    return wrp as unknown as DnaOptional<this>;
  }
  nullable(): DnaNullable<this> {
    const wrp = initDna(DnaNullable, { inner: this })[SymSetHead](this._head);
    return wrp as unknown as DnaNullable<this>;
  }
  nullish(): DnaNullish<this> {
    const wrp = initDna(DnaNullish, { inner: this })[SymSetHead](this._head);
    return wrp as unknown as DnaNullish<this>;
  }
  default(value: $Output<this>): DnaDefault<this> {
    const wrp = initDna(DnaDefault, { inner: this, value })[SymSetHead](this._head);
    // wrp._core.setHead(this._head);
    return wrp as unknown as DnaDefault<this>;
  }
  prefault(value: $Input<this>): DnaPrefault<this> {
    const wrp = initDna(DnaPrefault, { inner: this, value })[SymSetHead](this._head);
    return wrp as unknown as DnaPrefault<this>;
  }

}

export class DnaGeneric<T, I = T> extends DnaType<T, I> {
  protected override _core = new BaseCore("any");
}

export class DnaGenericWrapped<T, I = T> extends DnaTypeWithWrappers<T, I> { //implements schPseudoTypeMethods<T> {
  protected override _core = new BaseCore("any");
}

export function InitCustomDna<T, I = T, State extends tsStateDef = tsStateDef>(
  type:string,
  codeDef:{
    rawDna?: tsDnaNoMeta,
    coerce?: boolean,
    coerceCode?: string,
    seed?: State,
    templateRegex?: string,
  },
  meta : string | tsDnaMeta
){
  const inst = initDna(DnaGeneric<T,I>, undefined, meta);
  inst[SymCore] = new BaseCore<State>(type, {
        rawDna: codeDef?.rawDna,
        coerce: codeDef?.coerce,
        coerceCode: codeDef?.coerceCode,
        seed: codeDef?.seed,
        templateRegex: codeDef?.templateRegex,
      });
  return inst
}

export class DnaAny extends DnaTypeWithWrappers<any, any> {
  protected override _core = new BaseCore("any",{templateRegex:""});
}


/* Wrappers bubble up their meta, so they dont need one  */
// export class WrapperImpl<T, I = T, Inner extends DnaType<T, I> = DnaType<T, I>, StateDef = tsStateDef> extends DnatypeWithWrappers<T, I, tsStateWrp<T, I, Inner> & StateDef> {
export class WrapperImpl<
  Inner extends DnaType<any, any> = DnaType<any, any>,
> extends DnaTypeWithWrappers<$Output<Inner>, $Input<Inner>> {
  protected override _core = new BaseCore<{ wrapperType: tsWrpTypes, inner: Inner, value?: $Output<Inner> | $Input<Inner> | $CatchValue<$Output<Inner>, $Input<Inner>> }>("wrap");
  declare _input: $Input<Inner>;
  declare _output: $Output<Inner>
  // declare _output: $Output<Inner> & {
  //   tsWrpTypes: boolean | $CatchValue<$Output<Inner>, $Input<Inner>>;
  // }
  // defaultValue?: () => T | undefined;
  // prefaultValue?: () => I | undefined;
  // catchValue?: () => $CatchValue<T, I> | undefined;

  get wrapperType(): tsWrpTypes { return this._core.seed.wrapperType; }

  // override set _coerce(bool: boolean) { (this._core.state.inner as SchemaImpl<T, I>)._coerce = bool; }

  // static init<T, I, Inner extends DnaType<T, I>>(inner: Inner, wrapperType: tsWrpTypes, value?: T | I | $CatchValue<T, I>): any {
  //   // `wrapperType` is a dynamic runtime string here, so TS cannot discriminate
  //   // which union member of tsStateWrp is being built — a single cast at this
  //   // construction boundary is the correct, minimal way to bridge that gap.
  //   const inst = this.initCore<T, I, tsStateWrp<T, I, Inner>>("wrp", {
  //     inner,
  //     wrapperType,
  //     value,
  //   } as tsStateWrp<T, I, Inner>);
  //   inst._core.rawMeta({ [wrapperType]: value ?? true });

  //   if (wrapperType === "default") {
  //     (inst as any).defaultValue = (): T | undefined => inst._core.state.value as T | undefined;
  //   };
  //   if (wrapperType === "prefault") {
  //     (inst as any).prefaultValue = (): I | undefined => inst._core.state.value as I | undefined;
  //   }
  //   if (wrapperType === "catch") (inst as any).catchValue = (): $CatchValue<T, I> | undefined => inst._core.state.value as $CatchValue<T, I> | undefined;
  //   return inst;
  // }

  override unwrap(): Inner {
    // this._core.state.inner.meta({ [this.#wrapperType] undefined });
    return this._core.seed.inner;
  }

  override get templateRegex(): string {
    const innerRegex = this._core.templateRegex;
    // Only optional/nullable/nullish affect the regex pattern
    // default/prefault/catch provide fallback values but don't change validity
    // Return \x00 for these to force full schema validation
    if (this._core.seed.wrapperType === "default" || this._core.seed.wrapperType === "prefault" || this._core.seed.wrapperType === "catch") {
      return "\x00";
    }
    if (this._core.seed.wrapperType === "optional" && innerRegex !== "\x00") {
      return "(?:" + innerRegex + ")?";
    }
    if (this._core.seed.wrapperType === "nullable" && innerRegex !== "\x00") {
      return "(?:" + innerRegex + "|null)";
    }
    if (this._core.seed.wrapperType === "nullish" && innerRegex !== "\x00") {
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
    const cleanedInner = this._core.seed.inner.nonoptional();
    let result: any;
    if (this._core.seed.wrapperType === "optional") result = cleanedInner;
    else if (this._core.seed.wrapperType === "nullish") result = cleanedInner.nullable();
    else if (this._core.seed.wrapperType === "default") result = initDna(DnaDefault, { inner: cleanedInner, value: this._core.seed.value });
    else if (this._core.seed.wrapperType === "prefault") result = initDna(DnaPrefault, { inner: cleanedInner, value: this._core.seed.value });
    else if (this._core.seed.wrapperType === "catch") result = initDna(DnaCatch, { inner: cleanedInner, value: this._core.seed.value });
    else result = initDna(DnaNullable, { inner: cleanedInner });
    // Force the key required in an enclosing object (overrides default/prefault's
    // absent-tolerance), matching Zod's `nonoptional`.
    result[SymCore].rawMeta({ nonoptional: true });
    return result;
  }

  // #propagateMeta(key: string, value: any) {
  //   if (this.#inner instanceof WrapperImpl) {
  //     this.#inner.#propagateMeta(key, value);
  //   } else this.#inner.meta({ [key]: value ?? true });
  // }

  /** @deprecated Use unwrap() instead */
  removeDefault(): Inner { return this.unwrap(); }
}

// Optional wrapper - allows undefined
export class DnaOptional<Inner extends DnaType<any, any> = DnaType<any, any>> extends WrapperImpl<Inner> {
  protected override _core = new BaseCore<{ wrapperType: "optional", inner: Inner }>("wrap");
}

// Nullable wrapper - allows null
export class DnaNullable<Inner extends DnaType<any, any> = DnaType<any, any>> extends WrapperImpl<Inner> {
  protected override _core = new BaseCore<{ wrapperType: "nullable", inner: Inner }>("wrap");
}

// Nullish wrapper - allows undefined and null
export class DnaNullish<Inner extends DnaType<any, any> = DnaType<any, any>> extends WrapperImpl<Inner> {
  protected override _core = new BaseCore<{ wrapperType: "nullish", inner: Inner }>("wrap");
}

// Default wrapper - provides default value for output
export class DnaDefault<Inner extends DnaType<any, any> = DnaType<any, any>> extends WrapperImpl<Inner> {
  protected override _core = Object.defineProperty(
    new BaseCore<{ wrapperType: "default", inner: Inner, value: $Output<Inner> }>("wrap"),
    "defaultValue",
    { get() { return this.seed.value; } }
  );
}

// Prefault wrapper - provides default value for input
export class DnaPrefault<Inner extends DnaType<any, any> = DnaType<any, any>> extends WrapperImpl<Inner> {
  protected override _core = Object.defineProperty(
    new BaseCore<{ wrapperType: "prefault", inner: Inner, value: $Input<Inner> }>("wrap"),
    "prefaultValue",
    { get() { return this.seed.value; } }
  );
}

// Catch wrapper - provides fallback value on error
export class DnaCatch<Inner extends DnaType<any, any> = DnaType<any, any>> extends WrapperImpl<Inner> {
  protected override _core = Object.defineProperty(
    new BaseCore<{ wrapperType: "catch", inner: Inner, value: $CatchValue<$Output<Inner>, $Input<Inner>> }>("wrap"),
    "catchValue",
    { get() { return this.seed.value; } }
  );
}

// Build this wrapper's modifier entry for the unified `wrp` node:
//   [type] | [type, serializedValue] | [type, fnSource, arity]
// #toModifierEntry(): [string] | [string, string] | [string, string, number] {
//   if (typeof this._core.state.value === "function") {
//     // catch may receive a recovery function `(ctx) => value`. Serialize its
//     // source + arity (like transform/check) so it survives into the DNA.
//     const fn = this._core.state.value;
//     return [this._core.state.wrapperType, fn.toString(), fn.length];
//   }
//   if (this._core.state.value !== undefined) return [this._core.state.wrapperType, stringify(this._core.state.value)];
//   return [this._core.state.wrapperType];
// }

// protected override _emitSelf(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): tsDnaId {
//   // Flatten the wrapper chain (this = outermost) into an ordered modifier list,
//   // descending to the first non-wrapper inner (the single leaf).
//   const modifiers: ([string] | [string, string] | [string, string, number])[] = [];
//   let leaf = this;
//   while (leaf instanceof WrapperImpl) {
//     const w = leaf;
//     // any/unknown: a wrapper directly around any/unknown is a no-op (these types
//     // accept all values) — drop it and treat its inner as the leaf.
//     if (["any", "unknown"].includes(w._core.state.inner.type)) { leaf = w._core.state.inner; break; }
//     modifiers.push(w.#toModifierEntry());
//     // Bubble wrapper flags up onto the outer node's meta (annotation hint).
//     this._core.rawMeta(w.meta());
//     leaf = w._core.state.inner;
//   }

//   // Fully collapsed (e.g. optional(any)) -> emit just the leaf.
//   if (modifiers.length === 0) return leaf.toDna(coll, mark!, pos);

//   // Payload [targetId, modifiers] is a NESTED array shared by reference with the
//   // stored node, so the leaf's id (written via the store after emission) reaches
//   // the final DNA. targetId starts at -1 until relinked.
//   // const wrpDef: tsDna = ["wrp", -1, modifiers, this.meta()];
//   const wrpDef: tsDna = ["wrp", -1, modifiers, {}]; // wrapper dont need meta as they propagate it
//   const wrpStoreId = coll.setStore(wrpDef);
//   const dnaId = coll.storeDNA(wrpDef, mark, pos, wrpStoreId); // wrpDef and not _dna because _dna destructures the value pf wrpDef
//   this._core.dna = wrpDef;
//   leaf.toDna(coll, wrpStoreId, 1);
//   return dnaId;
// }


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
  while (s instanceof WrapperImpl) {
    if (ABSENT_TOLERANT_WRAPPERS.includes(s.wrapperType)) return false;
    s = s.unwrap();
  }
  return !ABSENT_TOLERANT_WRAPPERS.some(it => s.meta()[it] !== undefined);
}

// Literal implementation
export class DnaLiteral<T, I = T> extends DnaTypeWithWrappers<T, I> {
  protected override _core = new BaseCore<{ value: T }>("literal")

  // static init<T, I = T>(value: T): any {
  //   const inst = this.initCore<T, T, tsStateLiteral<T>>("literal", { value });
  //   (inst as any)._dna = ["l", [value]];
  //   return inst;
  // }
  // getValue(): T { return this._core.state.value; }

  get values(): Set<T> {
    const value = this._core.seed.value;
    return new Set(Array.isArray(value) ? value : [value]);
  }
  get _rawValues(): Array<T> {
    const value = this._core.seed.value;
    return Array.isArray(value) ? value : [value];
  }

  override get templateRegex(): string { return escReg(String(this._core.seed.value)); }
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

const strCoreFactory = (format: string = "", coerce: boolean = false) => {
  return new BaseCore<{
    min: number | null;
    max: number | null;
    pattern: RegExp | null;
    format: string | null;
    startsWith?: string;
    endsWith?: string;
    includes?: string;
    sequence: tsStrSeqItem[]
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
      this._core.seed.sequence.push(["s", [
        sq1 === "min" ? sq2 : null,
        sq1 === "max" ? sq2 : null,
        sq1 === "pattern" ? sq2.toString() : null,
        sq1 === "format" ? sq2 : null,
      ], seqarr[3]
      ]);
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
    if (this._core.seed.pattern) return this._core.seed.pattern.source;
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
  jwt() { return this.format("jwt"); }

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
  time(options?: { precision?: number; error?: string }): DnaString { return Iso.time(options); }

  /**
   * @deprecated Use dna.iso.duration() instead
   */
  // duration(options?: { error?: string }): DnaString { return Iso.duration(options); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    // Serialize RegExp as string using toString() to preserve pattern and flags
    const patternSerialized = this._core.seed.pattern ? this._core.seed.pattern.toString() : null;
    this._core.rawDna = ["s", [this._core.seed.min ?? null, this._core.seed.max ?? null, patternSerialized, this._core.seed.format ?? null]];

    if (this._core.seed.sequence.length > 0) {
      const seqInst = SeqRawImpl.init([
        this._core.dnaWithMeta,
        ...this._core.seed.sequence,
      ]);
      return seqInst.toDna(coll, storeMark!, storePosition);

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
export class DnaCidrv6 extends DnaString {
  protected override _core = strCoreFactory("cidrv6");
}
export class DnaHash extends DnaString {
  protected override _core = strCoreFactory();
}


// Enhanced Template literal implementation that enables tranformation and mutation
// export class DnaTmplLiteralMutate extends DnatypeWithWrappers<string, string, tsStateTemplateLiteralMutate> {
export class DnaTmplLiteralMutate extends DnaTypeWithWrappers<string, string> {

  protected override _core = new BaseCore<{ parts: tsTmplLitArg[] }>("string", {
    seed: { parts: [] }
  })

  get canMutate() { return true }

  // static init(parts: tsTmplLitArg[]): any {
  //   return this.initCore<string, string, tsStateTemplateLiteralMutate>("string", { parts, canMutate: true });
  // }

  getParts(): tsTmplLitArg[] {
    return this._core.seed.parts;
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const passiveParts: tsTmplPartPrimitives[] = [], schemaParts: DnaType<any>[] = [];
    if (!this._core.seed.parts.length) {
      passiveParts.push("");
    } else this._core.seed.parts.forEach((part, i) => {
      if (part instanceof DnaType) {
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
    this._core.rawDna = ["template", passiveParts, partIds, this.canMutate];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, storeId);
    for (; schLen--;) { // NEVER change this line
      const schema = schemaParts[schLen];
      // The captured group is always a string, so the part schema must coerce it to
      // its target type. Coercion belongs to the inner LEAF (e.g. number -> toNumber),
      // NOT to optional/nullable wrappers (a wrapper has no business coercing), so walk
      // through wrappers to the leaf before flagging it.
      let leaf: DnaType<any> = schema;
      while (leaf instanceof WrapperImpl) leaf = leaf.unwrap();
      (leaf as any)._coerce = true;
      schema.toDna(coll, storeId, schLen);
    }
    // return this.setDnaId(coll, dnaId); // IMPORTANT: ne pas effacer, migré vers _core
    return this._core.setDnaId(coll, dnaId);
  }
}

// Template literal implementation - for Zod Compatibility
export class DnaTemplateLiteral extends DnaTmplLiteralMutate {
  // protected override _core = new BaseCore<{parts: tsTmplLitArg[], canMutate: boolean}>("string");

  override get canMutate() { return false }

  // static init(parts: tsTmplLitArg[]): any {
  //   return this.initCore<string, string, tsStateTemplateLiteral>("string", { parts, canMutate: false });
  // }

}

// Mutate implementation - mutation operation
export class MutateImpl<T, I = T> extends DnaType<T, I> {
  protected override _core = new BaseCore("mutate");
  private _mutator: string = "";

  static init<T, I = T>(mutator: string): any {
    const inst = this.initCore<T, I, tsStateDef>("mutate", {});
    (inst as any)._mutator = mutator;
    (inst as any)._dna = ["mutate", mutator];
    return inst;
  }



  // protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }
}

// SeqRawImpl - wraps raw DNA into ISchemaBase for SeqSchemaImpl
export class SeqRawImpl extends DnaType<unknown, unknown> {
  protected override _core = new BaseCore<{ dnaSteps: tsDna[] }>("seq");
  static init(dnaSteps: tsDna[]): any {
    return this.initCore<unknown, unknown, tsStateSeqRaw>("seq", { dnaSteps });
  }
  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const dna_params = new Array(this._core.seed.dnaSteps.length);
    const storeId = coll.setStore(dna_params);
    this._core.rawDna = ["seq", dna_params];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, this._core.seed.dnaSteps);
    this._core.seed.dnaSteps.forEach((step: any, i: number) => coll.storeDNA(step, storeId, i));
    return dnaId;
  }
}

// Seq implementation - sequence of DNA operations
class DnaPipe<T, I, U = I | unknown> extends DnaTypeWithWrappers<T, I | U> {
  protected override _core = new BaseCore<{ steps: DnaType<any, any>[] }>("pipe", {
    seed: {
      steps: []
    }
  })
  // static init<T, I, U = I | unknown>(steps: DnaType<any, any>[]): any {
  //   return this.initCore<T, I | U, tsStateSeq<T, I, U>>("seq", { dnaSteps: steps });
  // }

  // addStep(step: DnaType<any, any>): any {
  //   this._core.seed.dnaSteps.push(step);
  //   return this.clone();
  // }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
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
  protected override _core = new BaseCore<{ map: { truthy: string[], falsy: string[], case: "sensitive" | "insensitive" } }>("sb", {
    seed:
    {
      map: {
        truthy: ["true", "yes", "1", "on", "y", "enabled"],
        falsy: ["false", "no", "0", "off", "n", "disabled"],
        case: "sensitive"
      }
    }
  })

  // static init(options?: string | { truthy?: string[]; falsy?: string[]; case?: "sensitive" | "insensitive"; error?: string; message?: string }): any {
  //   let opts, metaDef;
  //   if (typeof options === "string") { metaDef = options; opts = {}; }
  //   else { opts = options ?? {}; metaDef = options ? { error: options.error } : {} }
  //   const caseDef = opts?.case === "sensitive";
  //   const truthy: string[] = opts?.truthy ?? ["true", "yes", "1", "on", "y", "enabled"];
  //   const falsy: string[] = opts?.falsy ?? ["false", "no", "0", "off", "n", "disabled"];
  //   const inst = this.initCore<boolean, boolean, tsStateStringBool>("boolean", { map: { truthy, falsy, case: caseDef }, case: caseDef }, "toBoolean");
  //   inst._core.rawMeta(metaDef);
  //   return inst;
  // }

  override get templateRegex(): string {
    const keys = Object.keys(this._core.seed.map);
    this._core.templateRegex = "(?:" + keys.map(escReg).join("|") + ")";
    return this._core.templateRegex;
  }

  override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const map = this._core.seed.map;
    this._core.rawDna = ["sb", [map.truthy, map.falsy, map.case === "sensitive"]];
    const seqDna = SeqRawImpl.init([
      ["s", [null, null, null, null], this._core.meta],
      this._core.dnaWithMeta
    ]);
    return seqDna.toDna(coll, storeMark!, storePosition);
  }
}

export class DnaIsoDatetime extends DnaString { protected override _core = strCoreFactory("date-time") }
export class DnaIsoDate extends DnaString { protected override _core = strCoreFactory("date"); }
export class DnaIsoTime extends DnaString { protected override _core = strCoreFactory("time"); }
// export class DnaIsoDuration extends DnaString { protected override _core = strCoreFactory("duration"); }

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

  static time(options?: { precision?: number; error?: string }) {
    let format = "time";
    if (options?.precision !== undefined) format += "-precision-" + options.precision;
    return initDna(DnaIsoTime, { format }, { error: options?.error });
  }

  // static duration(options?: { error?: string }) {
  //   return initDna(DnaIsoDuration, undefined, { error: options?.error });
  // }
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

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
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

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
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

  override get templateRegex(): string { return numRegex(this._core.seed.min, this._core.seed.exclMin, this._core.seed.max, this._core.seed.exclMax, true); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
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

  override get templateRegex(): string { return numRegex(this._core.seed.min, this._core.seed.exclMin, this._core.seed.max, this._core.seed.exclMax, false) + "n"; }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const selfDna: tsDna = [this.type as tsDnaOpcode, [this._core.seed.min, this._core.seed.exclMin, this._core.seed.max, this._core.seed.exclMax, this._core.seed.multOf], this.meta()];
    return coll.storeDNA(selfDna, storeMark, storePosition);
  }
}

export class DnaInt extends NumberImpl<number> {
  protected override _core = numCoreFactory<number>("i", "toInt");
  // static create(): any { return this.init<number>("i", "toInt"); }
  override get templateRegex(): string { return numRegex(this._core.seed.min, this._core.seed.exclMin, this._core.seed.max, this._core.seed.exclMax, false); }
}

export class DnaInt32 extends NumberImpl<number> {
  protected override _core = numCoreFactory<number>("i", "toInt", false, INT32Bounds);
  // static create(): any {
  //   const inst = this.init<number>("i", "toInt");
  //   (inst as any)._core.state.min = -(2 ** 31);
  //   (inst as any)._core.state.max = 2 ** 31 - 1;
  //   return inst;
  // }

  override get templateRegex(): string {
    // Int32Impl has fixed min/max constraints, always require full validation
    return "\x00";
  }

  override min(value: number) { return cloner(this, cl => cl._core.seed.min = Math.max(cl._core.seed.min!, value)); }
  override max(value: number) { return cloner(this, cl => cl._core.seed.max = Math.min(cl._core.seed.max!, value)); }
  override gt(value: number) { return cloner(this, cl => { cl._core.seed.min = Math.max(cl._core.seed.min!, value); cl._core.seed.exclMin = true; }); }
  override gte(value: number) { return cloner(this, cl => { cl._core.seed.min = Math.max(cl._core.seed.min!, value); cl._core.seed.exclMin = false; }); }
  override lt(value: number) { return cloner(this, cl => { cl._core.seed.max = Math.min(cl._core.seed.max!, value); cl._core.seed.exclMax = true; }); }
  override lte(value: number) { return cloner(this, cl => { cl._core.seed.max = Math.min(cl._core.seed.max!, value); cl._core.seed.exclMax = false; }); }
  override multipleOf(value: number) { return cloner(this, cl => cl._core.seed.multOf = Math.max(cl._core.seed.min!, Math.min(cl._core.seed.max!, value))); }
}




export class DnaCoerceString extends DnaString { protected override _core = strCoreFactory("", true); }
export class DnaCoerceNumber extends NumberImpl<number> { protected override _core = numCoreFactory<number>("n", "toNumber", true); }
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

// Enum implementation
export class DnaEnum<T extends tsDnaEnumInput> extends DnaTypeWithWrappers<
  tsDnaEnumValueType,
  tsDnaEnumValueType
// tsStateEnum<T>
> {

  protected override _core = new BaseCore<{ enumObj: Record<string, tsDnaEnumValueType> }>("enum", { seed: { enumObj: {} } });

  // static init<T extends tsDnaEnumInput>(values: T): any {
  //     const inst = this.initCore<tsDnaEnumValueType, tsDnaEnumValueType, tsStateEnum<T>>("enum", { enumList: [], isObject: false });
  //     // Support arrays, object literals, and TypeScript enums
  //     if (Array.isArray(values)) {
  //       inst._core.state.enumList = [...values];
  //     } else {
  //       // Object literal or TypeScript enum - extract keys and values
  //       inst._core.state.isObject = true;
  //       inst._core.state.enumList = Object.values(values);
  //   }
  //   return inst;
  // }

  get values(): tsDnaEnumValues { return Object.values(this._core.seed.enumObj); }
  get options(): tsDnaEnumValues { return Object.values(this._core.seed.enumObj); }

  get enum(): Record<string, tsDnaEnumValueType> { return this._core.seed.enumObj; }

  extract(values: tsDnaEnumValueType[]): any {
    return cloner(this, cl => cl._core.seed.enumObj = Object.fromEntries(Object.entries(cl._core.seed.enumObj).filter(([k, v]) => values.includes(v))));
  }
  exclude(values: tsDnaEnumValueType[]): any {
    return cloner(this, cl => cl._core.seed.enumObj = Object.fromEntries(Object.entries(cl._core.seed.enumObj).filter(([k, v]) => !values.includes(v))));
  }

  override get templateRegex(): string {
    this._core.templateRegex = "(?:" + this.values.map((v) => escReg(String(v))).join("|") + ")";
    return this._core.templateRegex;
  }

  // override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this._core.rawDna = ["e", this.values];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }
}

// Array implementation
export class ArrayImpl<S extends DnaType<any, any>> extends DnaTypeWithWrappers<S[], S[]> {
  protected override _core = new BaseCore<{ itemSchema: S, min: number | null, max: number | null, length: number | null }>("array");

  static init<S extends DnaType<any, any>>(itemSchema: S): any {
    return this.initCore<S[], S[], tsStateArray<S>>("array", { min: null, max: null, length: null, itemSchema });
  }



  unwrap(): S { //wrap for Array is not wrap for wrapper, unwrap of wrapper override until there is no wrapper anymore.
    return this._core.seed.itemSchema;
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
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
    this._core.seed.itemSchema.toDna(coll, itemsStoreId, 1);
    return dnaId;
  }
}

// Promise implementation
export class DnaPromise<T, I = unknown> extends DnaTypeWithWrappers<T, I> {
  protected override _core = new BaseCore<{ inner: DnaType<T, I> }>("promise");

  // static init<T, I = unknown>(innerSchema: DnaType<T>): any {
  //   return this.initCore<T, I, tsStatePromise<T, I>>("promise", { innerSchema: innerSchema as any });
  // }

  unwrap() {
    return this._core.seed.inner;
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const innerState: tsDna = ["promise", -1, this.meta()];
    const innerStoreId = coll.setStore(innerState);
    const dnaId = coll.storeDNA(innerState, storeMark, storePosition);
    this._core.seed.inner.toDna(coll, innerStoreId, 1);
    this._core.rawDna = [...innerState];
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
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
    for (let poz = len; poz--;) this._core.seed.items[poz].toDna(coll, prefixStoreId, poz);
    if (this._core.seed.rest) this._core.seed.rest.toDna(coll, itemsStoreId, 1);
    return dnaId;
  }
}

// Object implementation
export class ObjectImpl<T extends Record<string, DnaType<any, any>> = Record<string, DnaType<any, any>>, I = Record<string, unknown>> extends DnaTypeWithWrappers<T, I> {
  protected override _core = new BaseCore<{ propertySchemas?: T, addPropSchema?: DnaType<any>, objType: 'strict' | 'loose' | 'standard', requiredKeys: string[] }>("object");

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
        while (leaf instanceof WrapperImpl) leaf = leaf.unwrap();
        return leaf instanceof DnaLiteral ? [k, "l", Array.from(leaf.values)] : [k, leaf.type];
      })
      : undefined;
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, [this._core.seed.objType, this._core.seed.propertySchemas, this._core.seed.requiredKeys, this._core.seed.addPropSchema, propSig]);
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
        const realMeta = schema instanceof GetterSchemaImpl ? schema.innerType.meta() : schemaMeta;
        const propDef: [string, number, tsDnaMeta] = [key, 0, schemaMeta];
        const propStoreId = coll.setStore(propDef);

        schema.toDna(coll, propStoreId, 1);

        // A `nonoptional` key is required, so it must NOT go to defaultProperties
        // (which would silently supply the default for an absent key); keep it in
        // `properties` where the default still applies to a present `undefined`.
        if (isWrapped(realMeta)) defaultProperties.push(propDef); else properties.push(propDef);
        // coll.updateStore(propStoreId, schema._core.meta, 2)
      }
      if (properties.length) constraints.push(["properties", properties]);
      if (defaultProperties.length) constraints.push(["defaultProperties", defaultProperties]);
      // `requiredKeys` was computed at init; a getter property could not be resolved
      // then, so re-check those here against their resolved meta (respecting any
      // `.partial()`/`.required()` already applied, which left them out / in).
      const requiredKeys = this._core.seed.requiredKeys.filter(k => {
        const s = this._core.seed.propertySchemas![k];
        return !(s instanceof GetterSchemaImpl) || isRequiredKey(s.innerType);
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
      (this._core.seed.addPropSchema as DnaType<any>).toDna(coll, addPropStoreId, 1);
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
            if (meta && meta.optional === undefined) cl._core.seed.propertySchemas[key] = initDna(DnaOptional, { inner: schema });
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

  get shape(): Record<string, DnaType<any>> | undefined {
    return this._core.seed.propertySchemas;
  }

  keyOf(): PropertyKey[] {
    return Object.keys(this._core.seed.propertySchemas ?? {});
  }

  apply<R>(fn: (schema: this) => R): R {
    return fn(this);
  }

  omit<K extends keyof T>(keys: Record<K, boolean>): tsDnaObject<Omit<T, K>> {
    if (!this._core.seed.propertySchemas) {
      return this as unknown as tsDnaObject<Omit<T, K>>;
    }
    const newPropertySchemas: Record<string, DnaType<any>> = {};
    for (const [key, schema] of Object.entries(this._core.seed.propertySchemas)) {
      if (!keys[key as K]) {
        newPropertySchemas[key] = schema;
      }
    }
    const newObject = ObjectImpl.init(newPropertySchemas, this._core.seed.objType);
    newObject._core.rawMeta(this._core.meta);
    return newObject as unknown as tsDnaObject<Omit<T, K>>;
  }

  pick<K extends keyof T>(keys: Record<K, boolean>): tsDnaObject<Pick<T, K>> {
    if (!this._core.seed.propertySchemas) {
      return this as unknown as tsDnaObject<Pick<T, K>>;
    }
    const newPropertySchemas: Record<string, DnaType<any>> = {};
    for (const [key, schema] of Object.entries(this._core.seed.propertySchemas)) {
      if (keys[key as K]) {
        newPropertySchemas[key] = schema;
      }
    }
    const newObject = ObjectImpl.init(newPropertySchemas, this._core.seed.objType);
    newObject._core.rawMeta(this._core.meta);
    return newObject as unknown as tsDnaObject<Pick<T, K>>;
  }

  extend<U extends Record<string, any>>(shape: U): tsDnaObject<T & U> {
    const newPropertySchemas: Record<string, DnaType<any>> = { ...this._core.seed.propertySchemas };
    for (const [key, schema] of Object.entries(shape)) {
      newPropertySchemas[key] = schema;
    }
    const newObject = ObjectImpl.init(newPropertySchemas, this._core.seed.objType);
    newObject._core.rawMeta(this._core.meta);
    return newObject.asAPI as tsDnaObject<T & U>;
  }
}

// Generic combinator implementation (anyOf, allOf, oneOf)
export class CombinatorImpl<T, I = T, S extends tsDnaTupleSchemaBase = tsDnaTupleSchemaBase> extends DnaTypeWithWrappers<T, I> {
  protected override _core = new BaseCore<{ schemas: S, combinatorType: "anyOf" | "allOf" | "oneOf" }>("anyOf");

  static init<T, I = T, S extends tsDnaTupleSchemaBase = tsDnaTupleSchemaBase>(combinatorType: "anyOf" | "allOf" | "oneOf", schemas: S): any {
    return this.initCore<T, I, tsStateCombinator<S>>(combinatorType, { schemas, combinatorType });
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    let nbItems = this._core.seed.schemas.length
    const combinatorDef = new Array(nbItems + 1);
    const storeId = coll.setStore(combinatorDef);
    combinatorDef[0] = this._core.seed.combinatorType;
    this._core.rawDna = [this._core.seed.combinatorType, combinatorDef];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
    for (; nbItems--;) this._core.seed.schemas[nbItems].toDna(coll, storeId, nbItems + 1);
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
export class AllOfImpl<T, U, I = T & U> extends CombinatorImpl<T & U, I, [DnaType<T, I>, DnaType<U, I>]> {

  static create<T, U, I = T & U>(schemas: [DnaType<T, I>, DnaType<U, I>]): any {
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
function finiteValueSet(s: DnaType<any>): any[] | undefined {
  const head = (s as any).head;
  if (head instanceof DnaLiteral) {
    return head._rawValues;
  }
  if (head instanceof DnaEnum) return [...head.values];
  if (head instanceof GetterSchemaImpl) {
    // Lazy: Zod does not enforce exhaustiveness on lazy schemas
    return undefined;
  }
  if (head instanceof CombinatorImpl) {
    if (head[SymCore].seed.combinatorType !== "anyOf") return undefined; // only unions have a value set
    const out: any[] = [];
    for (const m of head[SymCore].seed.schemas as DnaType<any>[]) {
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
    switch (s.wrapperType) {
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
export class DiscriminatorImpl<K extends string, S extends tsDnaTupleSchemaBase, I = $DnaInfer<S[number]>> extends DnaTypeWithWrappers<
  $DnaInfer<S[number]>,
  I
> {

  static init<K extends string, S extends tsDnaTupleSchemaBase, I = $DnaInfer<S[number]>>(discriminator: K, schemas: S) {
    return this.initCore<$DnaInfer<S[number]>, I, tsStateDiscriminator<K, S, I>>("discriminator", { discriminator, schemas })
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const nbItems = this._core.seed.schemas.length;
    // `discriminatorDef[1][i]` is the value SET (array) accepted by branch `i`.
    const discriminatorDef: [string, any[][], number[]] = [this._core.seed.discriminator, new Array(nbItems), new Array(nbItems)];
    const storeId = coll.setStore(discriminatorDef);
    this._core.rawDna = ["discriminator", discriminatorDef];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);

    // Convert schemas in reverse order (LIFO like CombinatorImpl)
    for (let i = nbItems; i--;) {
      const schema = this._core.seed.schemas[i];

      // Extract the discriminator value set from the branch's discriminator schema.
      if (schema instanceof ObjectImpl) {
        const discriminatorSchema = schema.shape?.[this._core.seed.discriminator];
        const values = discriminatorSchema ? finiteValueSet(discriminatorSchema) : undefined;
        if (values) discriminatorDef[1][i] = values;
      }

      schema.toDna(coll, storeId, [2, i]);
    }

    return dnaId;
  }
}

// Intersection implementation (allOf)
export class IntersectionImpl<S extends DnaType<any>[]> extends CombinatorImpl<$UnionToIntersection<$Output<S[number]>>, S> {

  static create<S extends tsDnaTupleSchemaBase>(schemas: S): DnaType<$UnionToIntersection<$Output<S[number]>>> {
    return CombinatorImpl.init("allOf", schemas) as DnaIntersection<S>;
  }
}

// Exclusive union implementation (oneOf)
export class XorImpl<S extends tsDnaTupleSchemaBase> extends CombinatorImpl<$DnaInfer<S[number]>, $Output<S[number]>, S> {

  static create<S extends tsDnaTupleSchemaBase>(schemas: S): any {
    return CombinatorImpl.init("oneOf", schemas);
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
      const head = (keySchema as any).head;
      const isLiteralArray = head instanceof DnaLiteral && head._rawValues.length > 1;
      // Use keySchema.toDna() for transformations on non-literal-array schemas (to preserve them)
      // Use EnumImpl for literal arrays (to validate individual elements instead of the whole array)
      // Use EnumImpl for other finite schemas (enum, union of literals)
      if (isLiteralArray) {
        initDna(DnaEnum, finiteKeys).toDna(coll, keyStoreId, 1);
      } else if (keySchema.type === "seq" || (keySchema instanceof DnaType && keySchema[SymCore].seed.wrapperType === "transform")) {
        keySchema.toDna(coll, keyStoreId, 1);
      } else {
        initDna(DnaEnum, finiteKeys).toDna(coll, keyStoreId, 1);
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
// Decode direction reuses the BASE `#state` validator/parser cache (CodecImpl
// overrides `toDna()` to return the decode twin, so the base `_validate`/`_safeParse`
// build the right thing). Only the ENCODE direction needs its own cache here.
export class CodecImpl<I, O> extends DnaTypeWithWrappers<O, I> {

  static init<I, O>(inSchema: DnaType<I>, outSchema: DnaType<O>, decode: tsDecodeFn<I, O>, encode: tsEncodeFn<O, I>, externals?: tsExternalsDecl): any {
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
    return this._core.seed.decodeTwin.toDna(coll, storeMark!, storePosition);
  }

  // Decode direction (`_validate`/`_safeParse`) is inherited: the base builds from
  // `this.toDna()` and caches in `#state`.

  override safeEncode(value: unknown, ctx?: tsExternals): tsParserResult {
    if (this._core.seed.cachedEncodeParser) return this._core.seed.cachedEncodeParser(value);
    this._core.seed.cachedEncodeParser = parserBuilder(this._core.seed.encodeTwin.toDna(), ctx);
    return this._core.seed.cachedEncodeParser(value);
  }
}


// ============================================
// Getter Schema for recursive definitions
// ============================================
export class GetterSchemaImpl<T extends DnaType<any>, I = $DnaInfer<T>> extends DnaTypeWithWrappers<$DnaInfer<T>, I> {
  protected override _core = new BaseCore<{ getter: () => T }>("lazy");

  static init<T extends DnaType<any>, I = $DnaInfer<T>>(getter: () => T): any {
    return this.initCore<$DnaInfer<T>, I, tsStateGetter<T, I>>("lazy", { getter });
  }

  get innerType(): T {
    return this._core.seed.getter();
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const dna: tsDna = ["ref", -1, this._core.meta];
    const storeId = coll.setStore(dna);
    const dnaId = coll.storeDNA(dna, storeMark, storePosition, storeId);
    const getterDnaId = this._core.seed.getter().toDna(coll, storeId, 1);
    coll.refList.push(getterDnaId);
    this._core.rawDna = dna;
    return dnaId;
  }
}

// ============================================
// Property Check Schema for type-safe property validation (Zod V4 compatibility)
// ============================================
// export class DnaProperty<K extends string | number, S extends DnaType<any, any, any>> implements tsDnaPropertyCheck<K, S> {
export class DnaProperty<K extends string | number, S extends DnaType<any, any>> {
  protected _core = new BaseCore<{ property: K, schema: S }>("property");

  kind: "property" = "property";
  // #state: tsStateFull<tsStatePropCheck<K, S>> = {
  //   type: "property",
  //   meta: {},
  //   coerceCode: undefined,
  //   refinerList: [],
  //   rawDna: ["T"],
  //   seed: 
  // };

  // static init<K extends string | number, S extends DnaType<any, any, any>>(property: K, schema: S): tsDnaPropertyCheck<K, S> {
  //   const inst = new DnaProperty<K, S>();
  //   inst.#state.innerState = { property, schema };
  //   return inst;
  // }

  get property(): K { return this._core.seed.property; }
  get schema(): S { return this._core.seed.schema; }

}