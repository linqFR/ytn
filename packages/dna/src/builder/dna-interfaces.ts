/**
 * DNA Schema Builder Core
 */
import type { tsParserError, tsRefineOptions } from "../shared/error.types.js";
import { DnaError, dnaErrorSource } from "../shared/error.types.js";
import type {
  tsCheckOpt,
  tsTransformFn
} from "../shared/handlers-builder.types.js";
import type {
  tsDnaBaseCtx,
  tsDnaInnerMeta,
  tsDnaMeta,
  tsDnaRefineCtx
} from "../shared/meta-context.type.js";
import type {
  tsDnaExternals, tsDnaExternalsDecl, tsDnaParserFn,
  tsDnaParserResult,
  tsDnaValidatorFn
} from "../shared/runtime.types.js";

import { stringify } from "@ytrynot/shared/js/json.js";
import { isValidRegex } from "@ytrynot/shared/regex/is-valid-regex.js";
import type {
  tsPrimitiveLiteral,
  tsStoreMark,
  tsStorePosition,
  tsTmplLitPart
} from "../shared/base.types.js";
import { ABSENT_TOLERANT_WRAPPERS, INT32Bounds, WRAPPERS_KEYOPT, WRAPPERS_XFAULT, isWrapped } from "../shared/const-wrp.js";
import { convertToStandardFailure } from "../shared/standard-schema-utils.js";
import type { StandardJSONSchemaV1, StandardSchemaV1, StandardSchemaWithJSONProps } from "../shared/standard-schema.types.js";
import { STRING_FORMAT_PATTERNS, escReg } from "../shared/string-format.js";
import type { tsToJSResult } from "../toJs/dna-to-js.js";
import { parserBuilder, toJS, validatorBuilder } from "../toJs/dna-to-js.js";
import { dnaToJsonSchema } from "../toJs/dna-to-json-schema.js";
import { getRegisteredExternals, registerExternal } from "../toJs/registry.js";
import { isAsyncFnStr } from "../toJs/utils.js";
import type {
  DnaFunctionArgs,
  DnaFunctionInput,
  tsDnaCheck,
  tsDnaDiscriminatedUnionObjects,
  tsDnaEnumLike,
  tsDnaEnumValueType,
  tsDnaTupleSchemaArray,
  tsDnaTupleSchemaRO,
  tsDnaTupleValueWithRest,
  tsFunctionType
} from "../types/api-builder.types.js";
import type { tsDna, tsDnaCombinatorType, tsDnaId, tsDnaObjectType, tsDnaOpcode, tsDnaSeq } from "../types/core.types.js";
import type {
  $CatchValue,
  $DnaBranded,
  $DnaPartialShape,
  $Input,
  $MaybeAsync,
  $Output,
  $ReadonlyValue,
  $RemoveUndefined,
  $SafeExtendShape,
  $Xor
} from "../types/helpers.types.js";
import type { IDnaCollector } from "./collector.types.js";
import { BaseCore, bindMethods, initDna } from "./dna-core.js";
import type { tsWrpPhase, tsWrpTypes } from "./state.types.js";
import { cacheKey } from "./util.js";


// ============================================
// DNA Collector
// ===========================================

/**
 * Collector that accumulates DNA bytecode nodes during schema emission.
 * Each schema node is stored once (deduplicated by a stable cache key) and
 * assigned a numeric index. Forward references for circular schemas are
 * tracked via `refList` and `pendingRefs`.
 */
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

  /**
   * Stores an arbitrary object (typically a params array) and returns a
   * numeric mark that can later be used to retrieve or update it.
   *
   * @param objToStore - The object to store (usually a DNA params array).
   * @returns A numeric store mark used as a handle.
   */
  setStore(objToStore: any): tsStoreMark {
    const storeSize = this.storeId++;
    this.store.set(storeSize, objToStore);
    return storeSize;
  }

  /**
   * Updates a previously stored object at the given store mark, either by
   * overwriting it entirely or by writing a DNA index at a specific position
   * (scalar index or `[row, col]` pair).
   *
   * @param storeMark - The store handle returned by {@link setStore}.
   * @param targetIdx - The DNA index to write.
   * @param position - A scalar index, a `[row, col]` pair, or `undefined` to
   *   replace the whole stored value.
   */
  updateStore(storeMark: tsStoreMark, targetIdx: tsDnaId, position?: tsStorePosition): void {
    if (typeof position === "number") {
      this.store.get(storeMark)[position] = targetIdx;
    } else if (Array.isArray(position)) {
      this.store.get(storeMark)[position[0]][position[1]] = targetIdx;
    } else {
      this.store.set(storeMark, targetIdx);
    }
  }

  /**
   * Stores a DNA node, deduplicating by a cache key derived from the node
   * and an optional discriminant. When a `storeMark`/`storePosition` is
   * provided, the resulting DNA index is also written back into the parent
   * store so the parent's params array references this node.
   *
   * @param dna - The DNA tuple to store.
   * @param storeMark - Optional parent store handle for back-writing.
   * @param storePosition - Optional position within the parent store.
   * @param discriminant - Extra value folded into the cache key to prevent
   *   false deduplication of structurally identical nodes.
   * @returns The numeric DNA index assigned to this node.
   */
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

  /**
   * Returns the complete DNA sequence: a flat array of all stored DNA nodes
   * followed by the `refList` (array of node IDs used as forward references).
   *
   * @returns The full {@link tsDnaSeq}.
   */
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

/**
 * Structural interface shared by all DNA schema instances. Defines the
 * minimum public contract: type metadata, parsing/validation entry points,
 * DNA emission, and metadata access. Every concrete schema class
 * (`DnaString`, `DnaObject`, ...) implements this interface.
 *
 * @typeParam T - The output type produced by a successful parse.
 * @typeParam I - The input type accepted by the schema (before coercion).
 */
export interface DnaSomeType<T = unknown, I = unknown> {
  readonly _output: T;
  readonly _input: I;
  readonly type: string;
  readonly templateRegex: string;
  readonly _core: BaseCore<any>;
  readonly _head: unknown;
  [SymForceCoerce](): DnaSomeType<T, I>;
  parse(value: unknown, ctx?: tsDnaExternals): T;
  safeParse(value: unknown, ctx?: tsDnaExternals): tsDnaParserResult;
  parseAsync(value: unknown, ctx?: tsDnaExternals): Promise<T>;
  safeParseAsync(value: unknown, ctx?: tsDnaExternals): Promise<tsDnaParserResult>;
  validate(value: unknown, ctx?: tsDnaExternals): boolean;
  validateAsync(value: unknown, ctx?: tsDnaExternals): Promise<boolean>;

  meta(): tsDnaInnerMeta;
  meta(value: string | tsDnaMeta): DnaSomeType<T, I>;

  toDna(): tsDnaSeq;
  toDna(collector: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId;
}

// Runtime discriminant for compiled validator/parser functions: `toJs`
// (see `dna-to-js.ts` STEP.ASYNC) emits an `async function` when the DNA
// tree contains an async refiner/transform, and a plain `function` otherwise.
// Comparing against this constructor is how sync entry points (`validate`,
// `safeParse`) detect — and reject — a schema they cannot run synchronously.
const AsyncFunction = (async function () { }).constructor;

function isDnaObject(schema: DnaSomeType): schema is DnaObject {
  return schema instanceof DnaObject;
}

/**
 * Clones a schema, preserves its head reference, then applies a mutation
 * function to the clone. Returns the mutated clone, leaving the original
 * schema untouched. Used internally by every fluent builder method to
 * maintain immutability.
 *
 * @typeParam T - The concrete schema type.
 * @param schema - The source schema to clone.
 * @param fn - A callback that mutates the clone in place.
 * @returns The mutated clone with the original head reference preserved.
 */
export function cloner<T extends DnaType<any, any>>(schema: T, fn: (cl: T) => void): T {
  const clHeaded = schema.clone();
  // Preserve head reference (all schemas in a chain point to the same head)
  if (schema._head) clHeaded[SymSetHead](schema._head);
  fn(clHeaded);
  return clHeaded;
}

// ============================================
// Schema Builder export classes (with discriminated types)
// ============================================

type $ReadonlyReturnType<S extends { _output: any; _input: any }> =
  Omit<S, "_output" | "_input" | "readonly"> & { readonly _output: $ReadonlyValue<S["_output"]>; readonly _input: $ReadonlyValue<S["_input"]>; };

/**
 * Base class for all DNA schema types. Provides the core validation, parsing,
 * DNA emission, composition, and metadata APIs inherited by every concrete
 * schema class (`DnaString`, `DnaObject`, `DnaArray`, ...).
 *
 * @typeParam T - The output type produced by a successful parse.
 * @typeParam I - The input type accepted by the schema (before coercion).
 */
export class DnaType<T = unknown, I = unknown> implements DnaSomeType<T, I> {
  // expected typescript type input
  readonly declare _input: I;
  // typescript type output if validation / parsing is ok
  readonly declare _output: T;


  get _head(): unknown { return this._core.head; }
  // [SymSetHead]<HL>(head: HL): this & { readonly _head: HL } { this._core.setHead(head); return this as any; }
  [SymSetHead](head: unknown): this { this._core.setHead(head); return this; }

  // _core is already defined dans DnaType
  _core = new BaseCore("any", { rawDna: ["T"] });

  get _state() { return this._core.seed };

  get description(): string | undefined { return this._core.meta.description; }
  get type() { return this._core.state.kind; }

  /**
   * Standard Schema Protocol V1 compatibility
   * Provides a standardized interface for validation frameworks
   */
  get "~standard"(): StandardSchemaWithJSONProps<I, T> {
    return {
      version: 1,
      vendor: "@ytrynot/dna",
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



  /**
   * Getter/setter for the schema's inner metadata. When called with no
   * arguments, returns the current metadata object. When called with a
   * string or metadata object, returns a **cloned** schema with the
   * metadata applied (the original is not mutated).
   *
   * @param value - A string (treated as an error message) or a metadata object.
   * @returns The current metadata (getter) or a cloned schema (setter).
   */
  meta(): tsDnaInnerMeta;
  meta(value: string | tsDnaMeta): this;
  meta(value?: string | tsDnaMeta): this | tsDnaInnerMeta {
    if (arguments.length === 0 || value === undefined) return this._core.meta;
    return cloner(this, (cl: this) => cl._core.rawMeta(value));
  }

  /**
   * Returns a deep clone of this schema, including its core state and head
   * reference. Bound methods are re-bound to the clone so `this` is correct.
   *
   * @returns A new schema instance with the same state as `this`.
   */
  clone() {
    const clone = new (this.constructor as new () => this)();
    clone._core = this._core.clone();
    bindMethods(clone);
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

  protected _emitRefiners(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition): tsDnaId {
    const checks = this._core.refinerList;
    if (checks.length === 0) return this._emitSelf(coll, mark, pos);
    const { dnaId: SeqDnaId, storeId } = this._emitChkSeq(coll, mark, pos, checks.length);
    // const storeId = coll.setStore(params);
    // `storeId` is unique -> use it as discriminant so empty-param chk nodes
    // never falsely dedupe against each other in the collector cache.
    // const SeqDnaId = coll.storeDNA(["chkSeq", params, this.meta()], mark, pos, storeId);
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

  /** Emits a `chkSeq` node with `nbSteps` child slots (excluding self). */
  protected _emitChkSeq(coll: IDnaCollector, mark?: tsStoreMark, pos?: tsStorePosition, nbSteps = 0): { dnaId: tsDnaId; storeId: tsStoreMark } {
    const params = new Array(nbSteps + 1);
    const storeId = coll.setStore(params);
    // `storeId` is unique -> use it as a discriminant so empty-param chk nodes
    // never falsely dedupe against each other in the collector cache.
    const dnaId = coll.storeDNA(["chkSeq", params, this.meta()], mark, pos, storeId);
    return { dnaId, storeId };
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

  /**
   * Emits the full DNA bytecode sequence for this schema (root call).
   * Creates a fresh {@link DnaCollector}, emits all nodes, and returns the
   * complete `tsDnaSeq`. The result is cached on the schema's core.
   *
   * @returns The complete DNA bytecode sequence.
   */
  toDna(): tsDnaSeq;
  /**
   * Emits this schema's DNA node into an existing collector (recursive call).
   * Used by parent schemas (object, array, union, ...) to emit their children.
   *
   * @param collector - The active DNA collector.
   * @param storeMark - Optional parent store handle for back-writing the index.
   * @param storePosition - Optional position within the parent store.
   * @returns The numeric DNA index assigned to this node.
   */
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

  /**
   * Pipes the output of this schema into another schema, creating a
   * {@link DnaPipe} that validates in sequence: `this` first, then `target`.
   *
   * @typeParam U - The target schema type.
   * @param target - The schema to pipe into.
   * @returns A `DnaPipe` schema representing the composition.
   */
  pipe<U extends DnaType<any, any>>(target: U) {
    const pipeSeq = initDna(DnaPipe<this, U>, { steps: [this, target] });
    pipeSeq[SymSetHead](this._head);
    return pipeSeq;
  }

  /**
   * Transforms the validated output of this schema by applying `fn`, producing
   * a new type `R`. Returns a {@link DnaPipe} that validates with `this` then
   * applies the transform. Supports async functions (use `parseAsync`).
   *
   * @typeParam R - The transform's return type.
   * @param fn - The transform function (sync or async).
   * @param externals - Optional externals declaration for captured variables.
   * @returns A `DnaPipe` schema ending in a `DnaTransform`.
   */
  transform<R>(fn: (arg: $Output<this>, ctx: tsDnaRefineCtx<$Output<this>>) => $MaybeAsync<R>, externals?: tsDnaExternalsDecl): DnaPipe<this, DnaTransform<$Output<this>, R>>;
  transform<R>(fn: (arg: $Output<this>) => $MaybeAsync<R>, externals?: tsDnaExternalsDecl): DnaPipe<this, DnaTransform<$Output<this>, R>>;
  transform<R>(fn: (ctx: tsDnaRefineCtx<$Output<this>>) => $MaybeAsync<R>, externals?: tsDnaExternalsDecl): DnaPipe<this, DnaTransform<$Output<this>, R>>;
  // transform<R>(fn: (arg: any) => $MaybeAsync<R>): IDnaSchemaBase<R, I>;
  transform<R>(fn: tsTransformFn<$Output<this>, R>, externals?: tsDnaExternalsDecl): DnaPipe<this, DnaTransform<$Output<this>, R>> {
    const map = externalsMap(externals);
    const meta: tsDnaInnerMeta | undefined = Object.keys(map).length ? { externals: map } : undefined;
    const transformSchema = initDna(DnaTransform<$Output<this>, R>, { fnStr: fn.toString().trim(), arity: fn.length }, meta);
    const pipeSeq = initDna(DnaPipe<this, DnaTransform<$Output<this>, R>>, { steps: [this, transformSchema] })[SymSetHead](this._head);
    return pipeSeq;
  }

  /**
   * Adds a refinement check to this schema. If `fn` returns a falsy value,
   * a validation issue is added with the provided error message/path.
   * Returns a **cloned** schema with the refiner appended.
   *
   * @typeParam R - The return type of the refiner (truthy/falsy check).
   * @param fn - The refinement function (sync or async).
   * @param options - A string (error message) or an options object with
   *   `error` and `path` fields.
   * @returns A cloned schema with the refiner added.
   */
  refine<R>(fn: (value: $Output<this>, ctx?: tsDnaRefineCtx<$Output<this>>) => $MaybeAsync<R>, options?: string | tsRefineOptions<DnaType<any, any>>): this {
    const errorMessage = typeof options === "string"
      ? options
      : (typeof options?.error === "string" ? options.error : "Invalid");
    const errorPath = typeof options === "string" ? [] : (options?.path ?? []);
    const fnStr = fn.toString().trim();
    const async_ = isAsyncFnStr(fnStr);
    const callArgs = fn.length === 2 ? "value,ctx" : "value";
    const issue = "{code:'custom',message:" + JSON.stringify(errorMessage) + ",path:" + JSON.stringify(errorPath) + ",input:value}";
    const body = async_
      ? "async function(value,ctx){var ret=await(" + fnStr + ")(" + callArgs + ");if(!ret)ctx.addIssue(" + issue + ");}"
      : "function(value,ctx){var ret=(" + fnStr + ")(" + callArgs + ");if(!ret)ctx.addIssue(" + issue + ");}"
    return cloner(this, cl => { cl._core.refinerList.push(["func", body, 2]); });
  }

  /**
   * Adds a low-level refinement that receives the value and a context object
   * for manually adding issues via `ctx.addIssue()`. Unlike `.refine()`, the
   * function's return value is ignored — issues are added explicitly.
   *
   * @param fn - The super-refine function (sync or async).
   * @returns A cloned schema with the super-refiner added.
   */
  // Additional validation
  superRefine(fn: (value: $Output<this>, ctx: tsDnaRefineCtx<$Output<this>>) => $MaybeAsync<void>): this | never {
    return cloner(this, cl => { cl._core.refinerList.push(["func", fn.toString().trim(), fn.length]); });
  }

  /**
   * Adds one or more checks to this schema. Checks can be:
   * - A `tsDnaCheck` tuple (validation rule),
   * - A {@link DnaCheckProperty} (property-level validation),
   * - A bare function (treated as a refiner),
   * - A `describe` or `meta` check object.
   *
   * Returns a **cloned** schema with the checks appended to its refiner list.
   *
   * @param checks - The checks to add.
   * @returns A cloned schema with the checks added.
   */
  check(...checks: (tsDnaCheck | DnaCheckProperty<string | number, DnaType<any, any>> | (() => $MaybeAsync<unknown>) | ((ctx: tsDnaBaseCtx<$Input<this>>) => $MaybeAsync<unknown>))[]): this {
    return cloner(this, cl => {
      for (const check of checks) {
        if (typeof check === "function") {
          const fnStr = check.toString().trim();
          cl._core.refinerList.push(["func", fnStr, check.length]);
        }
        else if (check.kind === "describe") cl._core.rawMeta({ description: check.description });
        else if (check.kind === "meta") cl._core.rawMeta(check.meta);
        else if (check.kind === "validation") cl._core.refinerList.push(check.check);
        else if (check.kind === "property") cl._core.refinerList.push(["property", check.property, check.schema]);
      }
    });
  }

  /**
   * Alias for {@link check} that accepts a single check. Useful for fluent
   * chaining: `schema.with(myCheck).with(myOtherCheck)`.
   *
   * @param check - A `tsDnaCheck` tuple or a refiner function.
   * @returns A cloned schema with the check added.
   */
  // Utility methods
  with(check: tsDnaCheck | ((ctx: tsDnaBaseCtx<$Input<this>>) => $MaybeAsync<unknown>)): this {
    return this.check(check);
  }


  // custom<R>(fn: (data: any) => R): IDnaSchemaBase<R> {
  //   // .custom() creates a schema with a custom validation function
  //   // For DNA compatibility, we accumulate the checker
  //   this._checkerList.push(["func", fn.toString().trim(), fn.length]);
  //   return this as IDnaSchemaBase<R>;
  // }

  /**
   * Adds a nominal brand to the schema's type for compile-time discrimination.
   * This is purely a TypeScript-level operation with no runtime effect.
   *
   * @typeParam T - The brand key (defaults to a unique symbol).
   * @typeParam Dir - The branding direction: `"in"`, `"out"`, or `"inout"`.
   * @param value - The brand value.
   * @returns `this` if no brand value is given, otherwise a branded type.
   */
  brand<T extends PropertyKey = PropertyKey, Dir extends "in" | "out" | "inout" = "out">(value?: T): PropertyKey extends T ? this : $DnaBranded<this, T, Dir> {
    // .brand() adds a brand to the type for type-level discrimination
    // This is purely for TypeScript typing, no runtime effect
    // The direction parameter ("in" | "out" | "inout") controls which type gets branded
    return this as PropertyKey extends T ? this : $DnaBranded<this, T, Dir>;
  }

  /**
   * Wraps this schema in a {@link DnaCatch} that provides a fallback value (or
   * recovery function) when parsing fails. Unlike `.default()` (which only
   * handles `undefined`), `.catch()` handles **all** parsing errors.
   *
   * @typeParam R - The catch value type.
   * @param catchValue - A static fallback value.
   * @returns A `DnaCatch` wrapper schema.
   */
  catch<R>(catchValue: R): DnaCatch<this>;
  /**
   * Wraps this schema in a {@link DnaCatch} with a recovery function.
   *
   * @typeParam R - The recovery function's return type.
   * @param catchfn - A function receiving the parse context and returning a fallback.
   * @param externals - Optional externals for captured variables.
   * @returns A `DnaCatch` wrapper schema.
   */
  catch<R>(catchfn: (ctx: tsDnaBaseCtx<unknown>) => R, externals?: tsDnaExternalsDecl): DnaCatch<this>;
  catch<R>(arg0: R | ((ctx: tsDnaBaseCtx<unknown>) => R), externals?: tsDnaExternalsDecl): DnaCatch<this> {
    // .catch() provides a default value when parsing fails
    // Unlike .default() which only handles undefined, .catch() handles ALL parsing errors
    const valueExternals = typeof arg0 === "function" ? externalsMap(externals) : undefined;
    const wrapper = initDna(DnaCatch<this>, { inner: this, value: arg0, valueExternals })[SymSetHead](this._head);
    return wrapper;
  }

  /**
   * Converts this schema to a JSON Schema (Draft 2020-12) object by first
   * emitting DNA bytecode and then mapping it to JSON Schema.
   *
   * @returns A JSON Schema object with the `$schema` dialect set.
   */
  // Properties
  toJSONSchema(): Record<string, unknown> {
    // Convert DNA bytecode to JSON Schema
    const dnaSeq = this.toDna();
    const schema = dnaToJsonSchema(dnaSeq);
    const dialect = "https://json-schema.org/draft/2020-12/schema";
    if (typeof schema === 'boolean') {
      if (schema) {
        return { $schema: dialect };
      }
      return { $schema: dialect, not: {} };
    }
    return { ...schema, $schema: dialect };
  }

  /**
   * Wraps this schema in a {@link DnaArray} so each element is validated
   * against `this`.
   *
   * @returns A `DnaArray` schema with `this` as its item schema.
   */
  // Composition methods
  array(): DnaArray<this> {
    const arraySchema = initDna(DnaArray<this>, { min: null, max: null, length: null, itemSchema: this })[SymSetHead](this._head);
    return arraySchema;
  }

  /**
   * Creates a union (`anyOf`) of this schema and `other`. The resulting
   * schema accepts values valid against either branch.
   *
   * @typeParam Other - The other schema type.
   * @param other - The schema to union with.
   * @returns A `DnaUnion` schema.
   */
  or<Other extends DnaType<any, any>>(other: Other) {
    const union = initDna(DnaUnion<[this, Other]>, { schemas: [this, other] })[SymSetHead](this._head);
    return union;
  }

  /**
   * Creates an intersection (`allOf`) of this schema and `other`. The
   * resulting schema requires values valid against **both** branches.
   *
   * @typeParam OU - The other schema's output type.
   * @typeParam OI - The other schema's input type.
   * @param other - The schema to intersect with.
   * @returns A `DnaIntersection` schema.
   */
  and<OU, OI = I>(other: DnaType<OU, OI>) {
    // and() creates an intersection
    // For DNA, we use allOf (intersection) with a store pattern like UnionImpl
    const intersection = initDna(DnaIntersection<T, OU, I & OI>, { schemas: [this, other] })[SymSetHead](this._head);
    return intersection;

  }

  /**
   * Creates an exclusive union (`oneOf`) of this schema and `other`. The
   * resulting schema requires a value valid against **exactly one** branch.
   *
   * @typeParam U - The other schema's output type.
   * @param other - The schema to XOR with.
   * @returns A `DnaXorUnion` schema.
   */
  xor<U>(other: DnaType<U>) {
    // xor() creates an exclusive union (exactly one must match)
    // For DNA, we use oneOf opcode
    const xorSchema = initDna(DnaXorUnion<T, U>, { schemas: [this, other] })[SymSetHead](this._head);
    return xorSchema;
  }

  /**
   * Sets a human-readable description on the schema's metadata.
   *
   * @param description - The description string.
   * @returns A cloned schema with the description set.
   */
  describe(description: string) { return cloner(this, cl => cl._core.meta.description = description); }
  /**
   * Marks the schema's output as readonly at the type level. Returns a
   * cloned schema with `readonly: true` in its metadata.
   *
   * @returns A cloned schema with a readonly output type.
   */
  readonly(): $ReadonlyReturnType<this> {
    const r = cloner(this as unknown as DnaType<any, any>, cl => cl._core.meta.readonly = true);
    return r as unknown as $ReadonlyReturnType<this>;
  }

  /**
   * Registers a side-effecting callback that receives a clone of this schema.
   * Useful for applying external configuration without breaking the fluent chain.
   *
   * @param fn - A callback receiving the cloned schema.
   * @returns The cloned schema after `fn` has been applied.
   */
  register(fn: (schema: this) => void) { return cloner(this, cl => fn(cl)); }

  /**
   * Overwrites the schema's type by applying `fn` to `this` directly (no clone).
   * The return type is whatever `fn` produces.
   *
   * @typeParam U - The return type of `fn`.
   * @param fn - A function receiving the schema and returning a value.
   * @returns The value returned by `fn`.
   */
  overwrite<U>(fn: (schema: this) => U): U { return fn(this); }

  /**
   * Applies a function to this schema with additional arguments. A general-
   * purpose escape hatch for custom schema processing.
   *
   * @typeParam R - The return type of `fn`.
   * @typeParam A - The tuple of extra argument types.
   * @param fn - A function receiving the schema and extra args.
   * @param args - Extra arguments to spread into `fn`.
   * @returns The value returned by `fn`.
   */
  apply<R, A extends unknown[] = []>(fn: (schema: this, ...args: A[]) => R, args: A[] = []): R {
    return fn(this, ...args);
  }


  /**
   * Compiles (and caches) a synchronous boolean validator function for this
   * schema. Subclasses (e.g. `DnaCodec`) may override this to provide their
   * own caching strategy.
   *
   * @param ctx - Optional externals map for transform/refine functions.
   * @returns A compiled validator function.
   */
  _validate(ctx?: tsDnaExternals): tsDnaValidatorFn {
    if (!this._core.seed.cachedValidatorMap) this._core.seed.cachedValidatorMap = new WeakMap();
    const key = ctx ?? this;
    const cached = this._core.seed.cachedValidatorMap.get(key);
    if (cached) return cached;
    const fn = validatorBuilder(this.toDna(), ctx);
    this._core.seed.cachedValidatorMap.set(key, fn);
    return fn;
  }

  /**
   * Synchronously validates `value` against this schema, returning `true` or
   * `false` (fail-fast, no error collection). Throws if the schema contains
   * async refinements/transforms — use {@link validateAsync} in that case.
   *
   * @param value - The value to validate.
   * @param ctx - Optional externals map for transform/refine functions.
   * @returns `true` if valid, `false` otherwise.
   */
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

  /**
   * Asynchronously validates `value` against this schema. If `value` is a
   * Promise, it is awaited first. Works uniformly for sync and async schemas.
   *
   * @param value - The value to validate (or a Promise resolving to it).
   * @param ctx - Optional externals map for transform/refine functions.
   * @returns `true` if valid, `false` otherwise.
   */
  async validateAsync(value: unknown, ctx?: tsDnaExternals): Promise<boolean> {
    if (value instanceof Promise) value = await value;
    // Awaiting a plain (non-async) compiled function's return value is a
    // no-op — this works uniformly whether `_validate` compiled a sync or
    // an async validator (see `AsyncFunction` above).
    return await this._validate(ctx)(value);
  }

  /**
   * Compiles (and caches) a parser function for this schema. The parser
   * returns a structured result with either `{ success, data }` or
   * `{ success, errors }`. Subclasses may override for custom caching.
   *
   * @param ctx - Optional externals map for transform/refine functions.
   * @returns A compiled parser function.
   */
  _safeParse(ctx?: tsDnaExternals): tsDnaParserFn {
    if (!this._core.seed.cachedParserMap) this._core.seed.cachedParserMap = new WeakMap();
    const key = ctx ?? this;
    const cached = this._core.seed.cachedParserMap.get(key);
    if (cached) return cached;
    const fn = parserBuilder(this.toDna(), ctx);
    this._core.seed.cachedParserMap.set(key, fn);
    return fn;
  }

  /**
   * Synchronously parses `value` against this schema, returning a structured
   * result: `{ success: true, data }` on success or `{ success: false, errors }`
   * on failure. Throws if the schema contains async refinements/transforms —
   * use {@link safeParseAsync} in that case.
   *
   * @param value - The value to parse.
   * @param ctx - Optional externals map for transform/refine functions.
   * @returns A parser result object.
   */
  safeParse(value: unknown, ctx?: tsDnaExternals): tsDnaParserResult {
    // Invoke the parser from `_safeParse` (subclass-overridable, e.g. DnaCodec) for
    // the same reason as `validate` above.
    const fn = this._safeParse(ctx);
    if (fn instanceof AsyncFunction) {
      throw new Error("Schema contains async refinements/transforms — use safeParseAsync() instead of safeParse().");
    }
    return fn(value);
  }

  /**
   * Synchronously parses `value` and returns the validated/transformed data.
   * Throws a {@link DnaError} if validation fails. Throws if the schema
   * contains async refinements/transforms — use {@link parseAsync} instead.
   *
   * @param value - The value to parse.
   * @param ctx - Optional externals map for transform/refine functions.
   * @returns The parsed and validated data.
   * @throws {DnaError} When validation fails.
   */
  // Additional parsing methods
  parse(value: unknown, ctx?: tsDnaExternals): T | never {
    const res = this.safeParse(value, ctx);
    if (res.success) return res.data;
    throw new DnaError(res.errors);
  }

  /**
   * Asynchronously parses `value` and returns the validated/transformed data.
   * Throws a {@link DnaError} if validation fails.
   *
   * @param value - The value to parse (or a Promise resolving to it).
   * @param ctx - Optional externals map for transform/refine functions.
   * @returns The parsed and validated data.
   * @throws {DnaError} When validation fails.
   */
  async parseAsync(value: unknown, ctx?: tsDnaExternals): Promise<T> {
    const res = await this.safeParseAsync(value, ctx);
    if (res.success) return res.data;
    throw new DnaError(res.errors);
  }

  /**
   * Asynchronously parses `value`, returning a structured result. If `value`
   * is a Promise, it is awaited first. Works uniformly for sync and async schemas.
   *
   * @param value - The value to parse (or a Promise resolving to it).
   * @param ctx - Optional externals map for transform/refine functions.
   * @returns A parser result object.
   */
  async safeParseAsync(value: unknown, ctx?: tsDnaExternals): Promise<tsDnaParserResult> {
    if (value instanceof Promise) value = await value;
    // Awaiting a plain (non-async) compiled function's return value is a
    // no-op — this works uniformly whether `_safeParse` compiled a sync or
    // an async parser (see `AsyncFunction` above).
    return await this._safeParse(ctx)(value);
  }

  /**
   * Shorthand alias for {@link safeParseAsync}.
   *
   * @param value - The value to parse.
   * @param ctx - Optional externals map for transform/refine functions.
   * @returns A promise resolving to a parser result object.
   */
  spa(value: unknown, ctx?: tsDnaExternals): Promise<tsDnaParserResult> {
    return this.safeParseAsync(value, ctx);
  }

  /** Alias for {@link safeParse} (codec decode direction). */
  safeDecode(value: unknown, ctx: tsDnaExternals): tsDnaParserResult { return this.safeParse(value, ctx); }
  /** Alias for {@link spa} (async codec decode direction). */
  safeDecodeAsync(value: unknown, ctx: tsDnaExternals): Promise<tsDnaParserResult> { return this.spa(value, ctx); }
  /** Alias for {@link parse} (codec decode direction). */
  decode(value: unknown, ctx: tsDnaExternals): T { return this.parse(value, ctx); }
  /** Alias for {@link parseAsync} (async codec decode direction). */
  decodeAsync(value: unknown, ctx: tsDnaExternals): Promise<T> { return Promise.resolve(this.parseAsync(value, ctx)); }

  /** Alias for {@link safeParse} (codec encode direction). Overridden by {@link DnaCodec}. */
  safeEncode(value: unknown, ctx?: tsDnaExternals): tsDnaParserResult { return this.safeParse(value, ctx); }
  /** Alias for {@link spa} (async codec encode direction). */
  safeEncodeAsync(value: unknown, ctx?: tsDnaExternals): Promise<tsDnaParserResult> { return Promise.resolve(this.safeEncode(value, ctx)); }
  /** Alias for {@link parse} (codec encode direction). */
  encode(value: unknown, ctx?: tsDnaExternals): T {
    const res = this.safeEncode(value, ctx);
    if (res.success) return res.data;
    throw new DnaError(res.errors);
  }
  /** Alias for {@link parseAsync} (async codec encode direction). */
  encodeAsync(value: unknown, ctx?: tsDnaExternals): Promise<T> { return Promise.resolve(this.encode(value, ctx)); }


  // Information methods
  /**
   * Returns `true` if this schema accepts absent/undefined values (i.e. it
   * is wrapped in `optional`, `nullish`, `catch`, `default`, or `prefault`).
   * A `nonoptional` wrapper anywhere in the chain cancels optionality.
   *
   * @returns `true` if the schema is optional.
   */
  isOptional(): boolean {
    let s: DnaSomeType = this instanceof DnaLazy ? this.innerType : this;
    while (s instanceof _DnaWrapper) {
      if (s.wrapperType === "nonoptional") return false;
      if (ABSENT_TOLERANT_WRAPPERS.includes(s.wrapperType)) return true;
      s = s.unwrap();
    }
    return false;
  }

  /**
   * Returns `true` if this schema accepts `null` (i.e. it is wrapped in
   * `nullable` or `nullish`).
   *
   * @returns `true` if the schema is nullable.
   */
  isNullable(): boolean {
    let s: DnaSomeType = this instanceof DnaLazy ? this.innerType : this;
    while (s instanceof _DnaWrapper) {
      if (s.wrapperType === "nullable" || s.wrapperType === "nullish") return true;
      s = s.unwrap();
    }
    return false;
  }

  /**
   * Returns `true` if this schema accepts both `null` and `undefined`
   * (i.e. it is wrapped in `nullish`).
   *
   * @returns `true` if the schema is nullish.
   */
  isNullish(): boolean {
    let s: DnaSomeType = this instanceof DnaLazy ? this.innerType : this;
    while (s instanceof _DnaWrapper) {
      if (s.wrapperType === "nullish") return true;
      s = s.unwrap();
    }
    return false;
  }
}

// export class DnatypeWithWrappers<T, I = T, StateDef extends tsStateDef = tsStateDef> extends DnaType<T, I, StateDef> {
/**
 * Extension of {@link DnaType} that adds wrapper-creation methods
 * (`optional`, `nullable`, `default`, ...). All concrete schema classes
 * inherit from this so every schema can be wrapped.
 *
 * @typeParam T - The output type.
 * @typeParam I - The input type (defaults to `T`).
 */
export class DnaTypeWithWrappers<T, I = T> extends DnaType<T, I> {
  /**
   * Unwraps a wrapper schema to its inner schema. Throws if this schema is
   * not a wrapper (no `optional`/`nullable`/`default`/... has been applied).
   *
   * @returns The inner schema.
   * @throws {Error} When called on a non-wrapper schema.
   */
  unwrap(): DnaSomeType {
    throw new Error("unwrap() can only be called when a wrapper (optional, nullable, nullish, default, prefault) has been applied");
  }
  /**
   * Wraps this schema in a {@link DnaOptional}, allowing `undefined` values.
   *
   * @returns A `DnaOptional` wrapper.
   */
  optional<This extends DnaSomeType>(this: This): DnaOptional<This> {
    return initDna(DnaOptional<This>, { inner: this })[SymSetHead](this._head);
  }
  /**
   * Wraps this schema in a {@link DnaNonOptional}, forcing the key to be
   * required even if an inner `optional` wrapper exists.
   *
   * @returns A `DnaNonOptional` wrapper.
   */
  nonoptional<This extends DnaSomeType>(this: This): DnaNonOptional<This> {
    return initDna(DnaNonOptional<This>, { inner: this })[SymSetHead](this._head);
  }
  /**
   * Wraps this schema in a {@link DnaNullable}, allowing `null` values.
   *
   * @returns A `DnaNullable` wrapper.
   */
  nullable<This extends DnaSomeType>(this: This): DnaNullable<This> {
    return initDna(DnaNullable<This>, { inner: this })[SymSetHead](this._head);
  }
  /**
   * Wraps this schema in a {@link DnaNullish}, allowing both `null` and
   * `undefined` values.
   *
   * @returns A `DnaNullish` wrapper.
   */
  nullish<This extends DnaSomeType>(this: This): DnaNullish<This> {
    return initDna(DnaNullish<This>, { inner: this })[SymSetHead](this._head);
  }
  /**
   * Wraps this schema in a {@link DnaDefault} that substitutes `value` when
   * the parsed output is `undefined`.
   *
   * @param value - The default value to use when output is `undefined`.
   * @returns A `DnaDefault` wrapper.
   */
  default<This extends DnaSomeType>(this: This, value: This["_output"]): DnaDefault<This> {
    return initDna(DnaDefault<This>, { inner: this, value })[SymSetHead](this._head);
  }
  /**
   * Wraps this schema in a {@link DnaPrefault} that substitutes `value` when
   * the **input** is `undefined` (before validation runs).
   *
   * @param value - The prefault value to use when input is `undefined`.
   * @returns A `DnaPrefault` wrapper.
   */
  prefault<This extends DnaSomeType>(this: This, value: This["_input"]): DnaPrefault<This> {
    return initDna(DnaPrefault<This>, { inner: this, value })[SymSetHead](this._head);
  }
  /**
   * Wraps this schema in a {@link DnaExactOptional}, making an object key
   * optional at the type level without adding `undefined` to the value type.
   *
   * @returns A `DnaExactOptional` wrapper.
   */
  exactOptional<This extends DnaSomeType>(this: This): DnaExactOptional<This> {
    return initDna(DnaExactOptional<This>, { inner: this })[SymSetHead](this._head);
  }
}

/** Schema accepting any value (`any`). Mirrors Zod's `z.any()`. */
export class DnaAny extends DnaTypeWithWrappers<any, any> {
  override _core = new BaseCore("any", { templateRegex: "" });
}

/** Schema accepting any value (`unknown`). Mirrors Zod's `z.unknown()`. */
export class DnaUnknown extends DnaTypeWithWrappers<unknown, unknown> {
  override _core = new BaseCore("unknown", { templateRegex: "" });
}

/** Schema that never matches any value. Mirrors Zod's `z.never()`. */
export class DnaNever extends DnaTypeWithWrappers<never, unknown> {
  override _core = new BaseCore("never", { rawDna: ["F"], templateRegex: "" });
}

/** Schema accepting only `null`. Mirrors Zod's `z.null()`. */
export class DnaNull extends DnaTypeWithWrappers<null, null> {
  override _core = new BaseCore("null", { rawDna: ["n0"] });
}

/** Schema accepting only `undefined`. Mirrors Zod's `z.undefined()`. */
export class DnaUndefined extends DnaTypeWithWrappers<undefined, undefined> {
  override _core = new BaseCore("undefined", { rawDna: ["undefined"] });
}


/** Schema accepting only `symbol` values. Mirrors Zod's `z.symbol()`. */
export class DnaSymbol extends DnaTypeWithWrappers<symbol, symbol> {
  override _core = new BaseCore("symbol", { rawDna: ["symbol"] });
}

/** Schema accepting only `void` (treated as `undefined` at runtime). Mirrors Zod's `z.void()`. */
export class DnaVoid extends DnaTypeWithWrappers<void, void> {
  override _core = new BaseCore("void", { rawDna: ["undefined"] });
}

/** Schema accepting only `NaN`. Mirrors Zod's `z.nan()`. */
export class DnaNaN extends DnaTypeWithWrappers<typeof NaN, typeof NaN> {
  override _core = new BaseCore("nan", { rawDna: ["nan"] });
}

// Generic combinator implementation (anyOf, allOf, oneOf)
class DnaCombinator<T, I = T, S extends readonly DnaSomeType[] = readonly DnaSomeType[]> extends DnaTypeWithWrappers<T, I> {
  override _core = new BaseCore<{ schemas: DnaSomeType[], combinatorType: tsDnaCombinatorType }>("anyOf");
  override get type() {
    switch (this._core.seed.combinatorType) {
      case "anyOf": return "union";
      case "allOf": return "intersection";
      case "oneOf": return "xor";
      default: return this._core.state.kind;
    }
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    let nbItems = this._core.seed.schemas.length
    const combinatorDef = new Array(nbItems + 1);
    const storeId = coll.setStore(combinatorDef);
    combinatorDef[0] = this._core.seed.combinatorType + "'s schemas";
    this._core.rawDna = [this._core.seed.combinatorType, combinatorDef];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, storeId);
    this._core.setDnaId(coll, dnaId);
    for (; nbItems--;) this._core.seed.schemas[nbItems].toDna(coll, storeId, nbItems + 1);
    return dnaId;
  }
}

/**
 * Union schema (`anyOf`): accepts values valid against any of its member
 * schemas. Mirrors Zod's `z.union([...])`.
 *
 * @typeParam S - A readonly tuple of member schema types.
 */
export class DnaUnion<S extends tsDnaTupleSchemaRO> extends DnaCombinator<$Output<S[number]>, $Output<S[number]>, S> {
  override _core = new BaseCore<{ schemas: DnaSomeType[], combinatorType: tsDnaCombinatorType }>("anyOf")
    .preSeed({ combinatorType: "anyOf" });

  /** Returns the union's option schemas (Zod v4 parity: `.options`). */
  get options(): S { return this._core.seed.schemas as unknown as S; }
}

/**
 * Intersection schema (`allOf`): requires values valid against **both**
 * member schemas. When both members are objects, their shapes are merged.
 * Mirrors Zod's `z.intersection(left, right)`.
 *
 * @typeParam T - The left schema's output type.
 * @typeParam U - The right schema's output type.
 * @typeParam I - The combined input type (defaults to `T & U`).
 */
export class DnaIntersection<T, U, I = T & U> extends DnaCombinator<T & U, I, [DnaType<T, I>, DnaType<U, I>]> {
  override _core = new BaseCore<{ schemas: DnaSomeType[], combinatorType: tsDnaCombinatorType }>("allOf")
    .preSeed({ combinatorType: "allOf" });

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const [left, right] = this._core.seed.schemas;
    if (isDnaObject(left) && isDnaObject(right)) {
      const deltaLeft = Object.keys(right.shape).filter(k => !(k in left.shape));
      const deltaRight = Object.keys(left.shape).filter(k => !(k in right.shape));
      const objTypes = [left, right].map(s => s._objType);
      const extdLeft = left.extend(Object.fromEntries(Object.entries(right.shape).filter(([k, _]) => deltaLeft.includes(k)))).partial(Object.fromEntries(deltaLeft.map(k => [k, true])));
      const extdRight = right.extend(Object.fromEntries(Object.entries(left.shape).filter(([k, _]) => deltaRight.includes(k)))).partial(Object.fromEntries(deltaRight.map(k => [k, true])));

      if (objTypes.includes("loose")) {
        this._core.seed.schemas = [extdLeft.loose(), extdRight.loose()];
      } else if (objTypes.includes("standard")) {
        this._core.seed.schemas = [extdLeft.standard(), extdRight.standard()];
      } else {
        this._core.seed.schemas = [extdLeft.strict(), extdRight.strict()];
      }
    }
    return super._emitSelf(coll, storeMark, storePosition);
  }
}

/**
 * Exclusive union schema (`oneOf`): accepts values valid against **exactly
 * one** of its member schemas. Mirrors Zod's `z.xor(left, right)`.
 *
 * @typeParam T - The left schema's output type.
 * @typeParam U - The right schema's output type.
 */
export class DnaXorUnion<T = unknown, U = unknown> extends DnaCombinator<$Xor<T, U>> {
  override _core = new BaseCore<{ schemas: DnaSomeType[], combinatorType: tsDnaCombinatorType }>("oneOf")
    .preSeed({ combinatorType: "oneOf" });
}


/**
 * Transform schema node: represents a single transformation function applied
 * to validated data. Usually created via `.transform()` and wrapped in a
 * {@link DnaPipe}.
 *
 * @typeParam T - The input type to the transform.
 * @typeParam R - The transform's return type.
 */
export class DnaTransform<T, R> extends DnaTypeWithWrappers<R, T> {
  override _core = new BaseCore<{ fnStr: string, arity: number }>("transform");

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this._core.rawDna = ["transform", [this._core.seed.fnStr, this._core.seed.arity]];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }
}


/* Wrappers bubble up their meta, so they dont need one  */
// export class WrapperImpl<T, I = T, Inner extends DnaType<T, I> = DnaType<T, I>, StateDef = tsStateDef> extends DnatypeWithWrappers<T, I, tsStateWrp<T, I, Inner> & StateDef> {
/**
 * Internal base class for all wrapper schemas (`optional`, `nullable`,
 * `default`, `prefault`, `catch`, `nullish`, `nonoptional`, `exactOptional`).
 * Wraps an inner schema and adds absent-value tolerance, fallback values,
 * or error recovery. Not exported directly — use the concrete subclasses.
 *
 * @typeParam Inner - The inner schema type being wrapped.
 * @typeParam Out - The wrapper's output type.
 * @typeParam In - The wrapper's input type.
 */
class _DnaWrapper<
  Inner extends DnaSomeType,
  Out = $Output<Inner>,
  In = $Input<Inner>,
> extends DnaTypeWithWrappers<any, any> {
  override _core = new BaseCore<{ wrapperType: tsWrpTypes, phase: tsWrpPhase, inner: Inner, value?: Out | In | $CatchValue<Out, In>, valueExternals?: tsDnaExternals }>("wrap");
  declare _input: In;
  declare _output: Out;
  // declare _output: $Output<Inner> & {
  //   tsWrpTypes: boolean | $CatchValue<$Output<Inner>, $Input<Inner>>;
  // }
  // defaultValue?: () => T | undefined;
  // prefaultValue?: () => I | undefined;
  // catchValue?: () => $CatchValue<T, I> | undefined;

  get wrapperType(): tsWrpTypes { return this._core.seed.wrapperType; }
  override get type() { return this._core.seed.wrapperType; }

  override unwrap(): Inner {
    // this._core.state.inner.meta({ [this.#wrapperType] undefined });
    return this._core.seed.inner;
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


  /**
   * @deprecated Use {@link unwrap} instead.
   * @returns The inner schema.
   */
  removeDefault(): Inner { return this.unwrap(); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const wrapperType = this._core.seed.wrapperType;
    const inner = this.unwrap();
    // `wrp` format: ["wrp", [wrptype, innerId, value?, phase], meta]
    // The params array is the store so the inner schema can fill innerId at position 1.
    // Value-bearing wrappers serialize their payload so codegen/converters can read it.
    // The phase (pre/post/around/catch) drives codegen dispatch without re-testing wrapperType.
    if (wrapperType === "optional") {
      let current: DnaSomeType | undefined = this.unwrap();
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

/** Optional wrapper: allows `undefined` values. Created via `.optional()`. */
// Optional wrapper - allows undefined
export class DnaOptional<Inner extends DnaSomeType = DnaSomeType> extends _DnaWrapper<Inner, any, any> {
  declare readonly _output: $Output<Inner> | undefined;
  declare readonly _input: $Input<Inner> | undefined;
  override _core = new BaseCore<{ wrapperType: "optional", phase: "pre", inner: Inner }>("wrap").preSeed({ wrapperType: "optional", phase: "pre" }).rawMeta({optional:true});
}

/**
 * ExactOptional wrapper: makes an object key optional at the type level
 * without adding `undefined` to the value type. Created via `.exactOptional()`.
 */
// ExactOptional wrapper - type-level marker: makes an object key optional without adding `undefined` to the value type.
export class DnaExactOptional<Inner extends DnaSomeType = DnaSomeType> extends _DnaWrapper<Inner> {
  override _core = new BaseCore<{ wrapperType: "exactOptional", phase: "pre", inner: Inner }>("wrap").preSeed({ wrapperType: "exactOptional", phase: "pre" }).rawMeta({ exactOptional: true });
}

/**
 * NonOptional wrapper: forces a schema to be required in object keys,
 * cancelling any inner `optional`/`nullish` wrapper. Created via `.nonoptional()`.
 */
// NonOptional wrapper - marks schema as required in object keys (preserves wrapper chain type)
export class DnaNonOptional<Inner extends DnaSomeType = DnaSomeType> extends _DnaWrapper<Inner, any, any> {
  declare readonly _output: $RemoveUndefined<$Output<Inner>>;
  declare readonly _input: $RemoveUndefined<$Input<Inner>>;
  override _core = new BaseCore<{ wrapperType: "nonoptional", phase: "pre", inner: Inner }>("wrap").preSeed({ wrapperType: "nonoptional", phase: "pre" }).rawMeta({ nonoptional: true });
}

/** Nullable wrapper: allows `null` values. Created via `.nullable()`. */
// Nullable wrapper - allows null
export class DnaNullable<Inner extends DnaSomeType = DnaSomeType> extends _DnaWrapper<Inner, any, any> {
  declare readonly _output: $Output<Inner> | null;
  declare readonly _input: $Input<Inner> | null;
  override _core = new BaseCore<{ wrapperType: "nullable", phase: "pre", inner: Inner }>("wrap").preSeed({ wrapperType: "nullable", phase: "pre" }).rawMeta({ nullable: true });
}

/** Nullish wrapper: allows both `null` and `undefined` values. Created via `.nullish()`. */
// Nullish wrapper - allows undefined and null
export class DnaNullish<Inner extends DnaSomeType = DnaSomeType> extends _DnaWrapper<Inner, any, any> {
  declare readonly _output: $Output<Inner> | null | undefined;
  declare readonly _input: $Input<Inner> | null | undefined;
  override _core = new BaseCore<{ wrapperType: "nullish", phase: "pre", inner: Inner }>("wrap").preSeed({ wrapperType: "nullish", phase: "pre" }).rawMeta({ nullish: true, optional:true, nullable:true });
}

/** Default wrapper: substitutes a default value when the output is `undefined`. Created via `.default(value)`. */
// Default wrapper - provides default value for output
export class DnaDefault<Inner extends DnaSomeType = DnaSomeType> extends _DnaWrapper<Inner> {
  override _core = Object.defineProperty(
    new BaseCore<{ wrapperType: "default", phase: "around", inner: Inner, value: $Output<Inner> }>("wrap").preSeed({ wrapperType: "default", phase: "around" }),
    "defaultValue",
    { get() { return this.seed.value; } }
  );
}

/** Prefault wrapper: substitutes a default value when the **input** is `undefined` (before validation). Created via `.prefault(value)`. */
// Prefault wrapper - provides default value for input
export class DnaPrefault<Inner extends DnaSomeType = DnaSomeType> extends _DnaWrapper<Inner> {
  override _core = Object.defineProperty(
    new BaseCore<{ wrapperType: "prefault", phase: "pre", inner: Inner, value: $Input<Inner> }>("wrap").preSeed({ wrapperType: "prefault", phase: "pre" }),
    "prefaultValue",
    { get() { return this.seed.value; } }
  );
}

/** Catch wrapper: provides a fallback value (or recovery function) on **any** parsing error. Created via `.catch(value)`. */
// Catch wrapper - provides fallback value on error
export class DnaCatch<Inner extends DnaSomeType = DnaSomeType> extends _DnaWrapper<Inner> {
  override _core = Object.defineProperty(
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
function isRequiredKey(schema: DnaSomeType): boolean {
  if (schema.meta()[WRAPPERS_KEYOPT.nonoptional]) return true;
  let s: DnaSomeType = schema instanceof DnaLazy ? schema.innerType : schema;
  while (s instanceof _DnaWrapper) {
    if (ABSENT_TOLERANT_WRAPPERS.includes(s.wrapperType)) return false;
    s = s.unwrap();
  }
  if (s instanceof DnaLazy) s = s.innerType;
  return !ABSENT_TOLERANT_WRAPPERS.some(it => s.meta()[it] !== undefined);
}

/**
 * Literal schema class for a single value or a union of literal values.
 * `const T` is required because `literal()` passes a const literal type (or a union of
 * const literal values) as the type argument. Without `const`, TS would widen it to `any`.
 */
export class DnaLiteral<const T> extends DnaTypeWithWrappers<T, T> {
  override _core = new BaseCore<{ value: T }>("literal")

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
      format: format || null,
      startsWith: undefined,
      endsWith: undefined,
      includes: undefined,
      sequence: []
    }
  });
}

/**
 * String schema with constraints (min/max length, pattern, format, mutations).
 * Mirrors Zod's `z.string()`. Supports a rich fluent API for string-specific
 * validation and transformation.
 */
// String implementation
// export class DnaString extends DnatypeWithWrappers<string, string, tsStateString> {
export class DnaString extends DnaTypeWithWrappers<string, string> {
  override _core = strCoreFactory();
  override get type() { return this._core.seed.format || "string"; }

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

  /**
   * Sets the minimum string length. Returns a cloned schema.
   *
   * @param length - The minimum number of characters.
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the min constraint.
   */
  min(length: number, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.seed.min = length; cl._core.innerMeta("min", meta); cl.#addSeq(["s", "min", length, metaNormalize(meta, "min")]); });
  }

  /**
   * Sets the maximum string length. Returns a cloned schema.
   *
   * @param length - The maximum number of characters.
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the max constraint.
   */
  max(length: number, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.seed.max = length; cl._core.innerMeta("max", meta); cl.#addSeq(["s", "max", length, metaNormalize(meta, "max")]); });
  }

  /**
   * Sets both min and max string length to the same value (exact length).
   *
   * @param length - The exact number of characters.
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the length constraint.
   */
  length(length: number, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.seed.min = length; cl._core.seed.max = length; if (meta) cl._core.innerMeta(["min", "max"], meta); });
  }

  /**
   * Alias for {@link length} — sets an exact string length.
   *
   * @param length - The exact number of characters.
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the eq constraint.
   */
  eq(length: number, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.seed.min = length; cl._core.seed.max = length; cl._core.innerMeta("eq", meta); });
  }

  /**
   * Sets a regex pattern the string must match.
   *
   * @param regex - The regular expression to match.
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the pattern constraint.
   */
  pattern(regex: RegExp, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.seed.pattern = regex; cl._core.innerMeta("pattern", meta); cl.#addSeq(["s", "pattern", regex, metaNormalize(meta, "pattern")]); });
  }
  /** Alias for {@link pattern}. */
  regex = this.pattern;

  /** @internal Used by fromDna reconstruction and deprecated string constraint methods. Not part of the public API. */
  _format(fmt: string, meta?: string | tsDnaMeta) {
    return cloner(this, cl => { cl._core.innerMeta("format", meta); cl.#addSeq(["s", "format", fmt, metaNormalize(meta, "format:" + fmt)]); cl._core.seed.format = fmt; });
  }

  /** @deprecated Use dna.email() instead */
  email(meta?: string | tsDnaMeta) {
    return this._format("email", meta);
  }

  /** @deprecated Use dna.url() instead */
  url(meta?: string | tsDnaMeta): DnaUrl {
    // Use UrlImpl for proper URL validation with new URL()
    return initDna(DnaUrl, undefined, meta ?? this._core.meta);
  }

  /** @deprecated Use dna.uuid() instead */
  uuid(meta?: string | tsDnaMeta) {
    return this._format("uuid", meta);
  }

  /** @deprecated Use dna.base64() instead */
  base64(meta?: string | tsDnaMeta) {
    return this._format("base64", meta);
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
  base64url(meta?: string | tsDnaMeta) { return this._format("base64url", meta); }

  /** @deprecated Use dna.jwt() instead */
  jwt(options?: { alg?: string }, meta?: string | tsDnaMeta): DnaJwt {
    return initDna(DnaJwt, { alg: options?.alg ?? null }, meta);
  }

  /** @deprecated Use dna.emoji() instead */
  emoji(meta?: string | tsDnaMeta) { return this._format("emoji", meta); }

  /** @deprecated Use dna.nanoid() instead */
  nanoid(error?: string | tsDnaMeta) { return this._format("nanoid", error); }

  /** @deprecated Use dna.uuid() instead */
  guid(error?: string | tsDnaMeta) { return this._format("guid", error); }

  /** @deprecated Use dna.cuid() instead */
  cuid(meta?: string | tsDnaMeta) { return this._format("cuid", meta); }

  /** @deprecated Use dna.cuid2() instead */
  cuid2(meta?: string | tsDnaMeta) { return this._format("cuid2", meta); }

  /** @deprecated Use dna.ulid() instead */
  ulid(meta?: string | tsDnaMeta) { return this._format("ulid", meta); }

  /** @deprecated Use dna.xid() instead */
  xid(meta?: string | tsDnaMeta) { return this._format("xid", meta); }

  /** @deprecated Use dna.ksuid() instead */
  ksuid(meta?: string | tsDnaMeta) { return this._format("ksuid", meta); }

  /** @deprecated Use dna.ipv4() instead */
  ipv4(meta?: string | tsDnaMeta) { return this._format("ipv4", meta); }

  /** @deprecated Use dna.ipv6() instead */
  ipv6(meta?: string | tsDnaMeta) { return this._format("ipv6", meta); }

  /** @deprecated Use dna.mac() instead */
  mac(meta?: string | tsDnaMeta) { return this._format("mac", meta); }

  /** Trims whitespace from both ends of the string (mutation). Returns a cloned schema. */
  trim() { return cloner(this, cl => cl.#addSeq(["mutate", ["trim"]])); }
  /** Converts the string to lower case (mutation). Returns a cloned schema. */
  toLowerCase() { return cloner(this, cl => cl.#addSeq(["mutate", ["toLowerCase"]])); }
  /** Converts the string to upper case (mutation). Returns a cloned schema. */
  toUpperCase() { return cloner(this, cl => cl.#addSeq(["mutate", ["toUpperCase"]])); }
  /** Normalizes the string using Unicode normalization (mutation). Returns a cloned schema. */
  normalize() { return cloner(this, cl => cl.#addSeq(["mutate", ["normalize"]])); }
  /**
   * Checks that the string is all upper case.
   *
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the uppercase check.
   */
  uppercase(meta?: string | tsDnaMeta) { return cloner(this, cl => cl.#addSeq(["check", ["uppercase"], metaNormalize(meta)])); }
  /**
   * Checks that the string is all lower case.
   *
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the lowercase check.
   */
  lowercase(meta?: string | tsDnaMeta) { return cloner(this, cl => cl.#addSeq(["check", ["lowercase"], metaNormalize(meta)])); }
  /**
   * Checks that the string starts with `start`.
   *
   * @param start - The expected prefix.
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the startsWith check.
   */
  startsWith(start: string, meta?: string | tsDnaMeta) {
    return cloner(this, cl => {
      cl._core.seed.startsWith = start;
      cl.#addSeq(["check", ["startsWith", stringify(start)], metaNormalize(meta)]);
    });
  }
  /**
   * Checks that the string ends with `end`.
   *
   * @param end - The expected suffix.
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the endsWith check.
   */
  endsWith(end: string, meta?: string | tsDnaMeta) {
    return cloner(this, cl => {
      cl._core.seed.endsWith = end;
      cl.#addSeq(["check", ["endsWith", stringify(end)], metaNormalize(meta)]);
    });
  }
  /**
   * Checks that the string includes `inc` as a substring. An optional
   * `position` narrows the match to `str.includes(inc, position)`.
   *
   * @param inc - The substring that must be present.
   * @param params - A string (error message) or an object with optional
   *   `position` and error metadata.
   * @returns A cloned schema with the includes check.
   */
  includes(inc: string, params?: string | (tsDnaMeta & { position?: number; })) {
    // Zod's 2nd arg is a message string OR `{ position?, error? }`. A `position`
    // narrows the match to `str.includes(inc, position)` (substring at index >= position).
    let position: number | undefined;
    let meta: string | tsDnaMeta | undefined;
    if (params !== null && typeof params === "object") {
      ({ position, ...meta } = params);
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
    const sDna = this._core.dnaWithMeta;
    if (this._core.seed.sequence.length === 0) {
      return coll.storeDNA(sDna, storeMark, storePosition);
    }
    const { dnaId, storeId } = this._emitChkSeq(coll, storeMark, storePosition, this._core.seed.sequence.length);
    coll.storeDNA(sDna, storeId, 0);
    this._core.seed.sequence.forEach((step, i) => coll.storeDNA(step as tsDna, storeId, i + 1));
    return dnaId;
  }
}

/** String schema with the `email` format. Created via `dna.email()`. */
export class DnaEmail extends DnaString {
  override _core = strCoreFactory("email");
}
/** String schema with the `httpUrl` format. Created via `dna.httpUrl()`. */
export class DnaHttpUrl extends DnaString {
  override _core = strCoreFactory("httpUrl");
}
/** String schema with the `hostname` format. Created via `dna.hostname()`. */
export class DnaHostname extends DnaString {
  override _core = strCoreFactory("hostname");
}
/** String schema with the `uuid` format. Created via `dna.uuid()`. */
export class DnaUUID extends DnaString {
  override _core = strCoreFactory("uuid");
}
/** String schema with the `guid` format. Created via `dna.guid()`. */
export class DnaGuid extends DnaString {
  override _core = strCoreFactory("guid");
}
/** String schema with the `e164` (phone number) format. Created via `dna.e164()`. */
export class DnaE164 extends DnaString {
  override _core = strCoreFactory("e164");
}
/** String schema with the `emoji` format. Created via `dna.emoji()`. */
export class DnaEmoji extends DnaString {
  override _core = strCoreFactory("emoji");
}
/** String schema with the `base64` format. Created via `dna.base64()`. */
export class DnaBase64 extends DnaString {
  override _core = strCoreFactory("base64");
}
/** String schema with the `base64url` format. Created via `dna.base64url()`. */
export class DnaBase64Url extends DnaString {
  override _core = strCoreFactory("base64url");
}
/** String schema with the `hex` format. Created via `dna.hex()`. */
export class DnaHex extends DnaString {
  override _core = strCoreFactory("hex");
}
/** String schema with the `nanoid` format. Created via `dna.nanoid()`. */
export class DnaNanoId extends DnaString {
  override _core = strCoreFactory("nanoid");
}
/** String schema with the `cuid` format. Created via `dna.cuid()`. */
export class DnaCuid extends DnaString {
  override _core = strCoreFactory("cuid");
}
/** String schema with the `cuid2` format. Created via `dna.cuid2()`. */
export class DnaCuid2 extends DnaString {
  override _core = strCoreFactory("cuid2");
}
/** String schema with the `ulid` format. Created via `dna.ulid()`. */
export class DnaUlid extends DnaString {
  override _core = strCoreFactory("ulid");
}
/** String schema with the `xid` format. Created via `dna.xid()`. */
export class DnaXid extends DnaString {
  override _core = strCoreFactory("xid");
}
/** String schema with the `ksuid` format. Created via `dna.ksuid()`. */
export class DnaKsuid extends DnaString {
  override _core = strCoreFactory("ksuid");
}
/** String schema with the `ipv4` format. Created via `dna.ipv4()`. */
export class DnaIpv4 extends DnaString {
  override _core = strCoreFactory("ipv4");
}
/** String schema with the `ipv6` format. Created via `dna.ipv6()`. */
export class DnaIpv6 extends DnaString {
  override _core = strCoreFactory("ipv6");
}
/** String schema with the `mac` address format. Created via `dna.mac()`. */
export class DnaMac extends DnaString {
  override _core = strCoreFactory("mac");
}
/** String schema with the `cidrv4` format. Created via `dna.cidrv4()`. */
export class DnaCidrv4 extends DnaString {
  override _core = strCoreFactory("cidrv4");
}
/** String schema with the `cidrv6` format. Created via `dna.cidrv6()`. */
export class DnaCidrv6 extends DnaTypeWithWrappers<string, string> {
  override _core = new BaseCore("cidrv6", { coerceCode: "toString" });

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this._core.rawDna = ["cidrv6", this.meta()];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }
}
/** JWT string schema with optional algorithm constraint. Created via `dna.jwt()`. */
export class DnaJwt extends DnaTypeWithWrappers<string, string> {
  override _core = new BaseCore<{ alg: string | null }>("jwt", { coerceCode: "toString", seed: { alg: null } });

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this._core.rawDna = ["jwt", this._core.seed.alg ?? null];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, this._core.seed.alg);
  }
}
/** Hash string schema (generic, no specific format). Created via `dna.hash()`. */
export class DnaHash extends DnaString {
  override _core = strCoreFactory();
}


/**
 * Enhanced template literal schema that enables transformation and mutation.
 * Built from a sequence of literal parts and schema placeholders. The parser
 * reconstructs the string by matching each part against its regex or schema.
 *
 * @typeParam Parts - The tuple of template literal parts.
 */
// Enhanced Template literal implementation that enables tranformation and mutation
// export class DnaTmplLiteralMutate extends DnatypeWithWrappers<string, string, tsStateTemplateLiteralMutate> {
export class DnaTmplLiteralMutate<Parts> extends DnaTypeWithWrappers<Parts, Parts> {
  // declare _output: Parts;
  // declare _input: string;
  override _core = new BaseCore<{ parts: readonly tsTmplLitPart[] }>("string", {
    seed: { parts: [] }
  })

  get canMutate() { return true }

  // static init(parts: tsTmplLitArg[]): any {
  //   return this.initCore<string, string, tsStateTemplateLiteralMutate>("string", { parts, canMutate: true });
  // }

  /**
   * Returns the array of template literal parts (literals and schema placeholders).
   *
   * @returns The parts array.
   */
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
            const wrapperType = leaf._core.seed.wrapperType;
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
      leaf._core.coerce = true;
      schema.toDna(coll, storeId, schLen);
    }
    return dnaId;
  }
}

/**
 * Template literal schema for Zod compatibility (`z.templateLiteral()`).
 * Unlike {@link DnaTmplLiteralMutate}, this variant does not mutate the
 * parsed value — it validates only.
 *
 * @typeParam Parts - The tuple of template literal parts.
 */
// Template literal implementation - for Zod Compatibility
export class DnaTemplateLiteral<Parts> extends DnaTmplLiteralMutate<Parts> {
  // declare _output: Parts;
  // declare _input: string;
  // override _core = new BaseCore<{parts: tsTmplLitArg[], canMutate: boolean}>("string");
  override get type() { return "templateLiteral"; }

  override get canMutate() { return false }

}


/**
 * Pipe schema: chains multiple schemas so validation runs in sequence. The
 * output of each step becomes the input of the next. Created via `.pipe()`
 * or `.transform()`.
 *
 * @typeParam S - The source (first step) schema type.
 * @typeParam T - The target (last step) schema type.
 */
// Seq implementation - sequence of DNA operations
export class DnaPipe<out S, out T> extends DnaTypeWithWrappers<any, any> {
  declare readonly _output: $Output<T>;
  declare readonly _input: $Input<S>;
  override _core = new BaseCore<{ steps: DnaSomeType[] }>("pipe", {
    rawDna: ["pipe"],
    seed: {
      steps: []
    }
  })

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const dna_params = new Array(this._core.seed.steps.length);
    const storeId = coll.setStore(dna_params);
    this._core.rawDna = ["pipe", dna_params];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, storeId);
    this._core.seed.steps.forEach((step: any, i: number) => step.toDna(coll, storeId, i));
    return dnaId;
  }
}


/**
 * StringBool schema (Zod V4 `z.stringbool()` compatibility): parses a
 * boolean from a string using configurable truthy/falsy keyword sets.
 */
// StringBool implementation - Zod V4 stringbool compatibility
export class DnaStringBool extends DnaTypeWithWrappers<boolean, boolean> {
  override _core = new BaseCore<{ truthy: string[]; falsy: string[]; case: "sensitive" | "insensitive" }>("sb", {
    seed: {
      truthy: ["true", "yes", "1", "on", "y", "enabled"],
      falsy: ["false", "no", "0", "off", "n", "disabled"],
      case: "insensitive"
    }
  })
  override get type() { return "stringbool"; }

  override get templateRegex(): string {
    const keys = [...this._core.seed.truthy, ...this._core.seed.falsy].map(k => this._core.seed.case === "insensitive" ? k.toLowerCase() : k);
    this._core.templateRegex = "(?:" + keys.map(escReg).join("|") + ")";
    return this._core.templateRegex;
  }

  override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const seed = this._core.seed;
    this._core.rawDna = ["sb", [seed.truthy, seed.falsy, seed.case === "sensitive"]];
    const sbDna = this._core.dnaWithMeta;
    const sDna: tsDna = ["s", [null, null, null, null], this._core.meta];
    const { dnaId, storeId } = this._emitChkSeq(coll, storeMark, storePosition, 1);
    coll.storeDNA(sDna, storeId, 0);
    coll.storeDNA(sbDna, storeId, 1);
    return dnaId;
  }
}

/** ISO 8601 date-time string schema. Created via `dna.iso.datetime()`. */
export class DnaIsoDatetime extends DnaString { override _core = strCoreFactory("date-time") }
/** ISO 8601 date string schema. Created via `dna.iso.date()`. */
export class DnaIsoDate extends DnaString { override _core = strCoreFactory("date"); }
/** ISO 8601 time string schema. Created via `dna.iso.time()`. */
export class DnaIsoTime extends DnaString { override _core = strCoreFactory("time"); }
/** ISO 8601 duration string schema. Created via `dna.iso.duration()`. */
export class DnaIsoDuration extends DnaString { override _core = strCoreFactory("duration"); }

/**
 * Static factory for ISO 8601 date/time schemas. Accessed via `dna.iso.*`.
 */
// ISO implementation - static methods
export class Iso {
  /**
   * Creates an ISO 8601 date-time schema with optional `local`, `offset`,
   * and `precision` constraints.
   *
   * @param options - Optional constraints.
   * @returns A `DnaIsoDatetime` schema.
   */
  static datetime(options?: { local?: boolean; offset?: boolean; precision?: number; error?: string; message?: string }) {
    let format = "date-time";
    if (options?.local) format += "-local";
    if (options?.offset) format += "-offset";
    if (options?.precision !== undefined) format += "-precision-" + options.precision;
    return initDna(DnaIsoDatetime, { format }, { message: options?.message, error: options?.error });
  }

  /**
   * Creates an ISO 8601 date schema (YYYY-MM-DD).
   *
   * @param options - Optional error message.
   * @returns A `DnaIsoDate` schema.
   */
  static date(options?: { error?: string }) {
    return initDna(DnaIsoDate, undefined, { error: options?.error });
  }

  /**
   * Creates an ISO 8601 time schema with optional `precision`.
   *
   * @param options - Optional precision and error message.
   * @returns A `DnaIsoTime` schema.
   */
  static time(options?: { precision?: number | "minute"; message?: string; error?: string }) {
    let format = "time";
    if (options?.precision !== undefined) format += "-precision-" + options.precision;
    return initDna(DnaIsoTime, { format }, { message: options?.message, error: options?.error });
  }

  /**
   * Creates an ISO 8601 duration schema.
   *
   * @param meta - Optional error message or metadata.
   * @returns A `DnaIsoDuration` schema.
   */
  static duration(meta?: string | tsDnaMeta) {
    return initDna(DnaIsoDuration, undefined, typeof meta === "string" ? { error: meta } : meta);
  }
}

/**
 * Date schema: validates `Date` instances with optional min/max bounds.
 * Mirrors Zod's `z.date()`.
 */
// Date implementation
export class DnaDate extends DnaTypeWithWrappers<Date, Date> {
  override _core = new BaseCore<{ min: Date | null, max: Date | null }>("date", { seed: { min: null, max: null } });

  // static create(): any {
  //   // State-only (like NumberImpl): bounds live in `_stt`, the node is built in
  //   // `_emitSelf`. No cached `_dna`, so cloning can never desync the bounds.
  //   return this.initCore<Date, Date, tsStateDate>("date", { min: null, max: null }, "toDate");
  // }
  /**
   * Sets the minimum date (inclusive).
   *
   * @param date - The minimum date.
   * @param meta - Optional metadata.
   * @returns A cloned schema with the min constraint.
   */
  min(date: Date, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = date; cl._core.innerMeta("min", meta); }); }
  /**
   * Sets the maximum date (inclusive).
   *
   * @param date - The maximum date.
   * @param meta - Optional metadata.
   * @returns A cloned schema with the max constraint.
   */
  max(date: Date, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = date; cl._core.innerMeta("max", meta); }); }
  /**
   * Sets an exact date (min and max to the same value).
   *
   * @param date - The exact date.
   * @param meta - Optional metadata.
   * @returns A cloned schema with the eq constraint.
   */
  eq(date: Date, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = date; cl._core.seed.max = date; cl._core.innerMeta("eq", meta); }); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const selfDna: tsDna = ["date", [this._core.seed.min, this._core.seed.max], this.meta()];
    return coll.storeDNA(selfDna, storeMark, storePosition);
  }
}


/**
 * URL string schema: validates strings parseable by `new URL()`. Supports
 * optional protocol and hostname regex constraints. Mirrors Zod's `z.url()`.
 */
// URL implementation
export class DnaUrl extends DnaTypeWithWrappers<string, string> {
  override _core = new BaseCore<{ normalize: boolean, protocol: RegExp | null, hostname: RegExp | null }>("url", { coerceCode: "toString", seed: { protocol: null, hostname: null, normalize: false } });

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

  /**
   * Sets a protocol regex constraint (e.g. `/^https?:$/`).
   *
   * @param protocol - The protocol regex to match.
   * @returns A cloned schema with the protocol constraint.
   */
  protocol(protocol: RegExp) { return cloner(this, cl => cl._core.seed.protocol = protocol); }
  /**
   * Sets a hostname regex constraint.
   *
   * @param hostname - The hostname regex to match.
   * @returns A cloned schema with the hostname constraint.
   */
  hostname(hostname: RegExp) { return cloner(this, cl => cl._core.seed.hostname = hostname); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    // Serialize RegExp as string using toString() to preserve pattern and flags
    const protocolSerialized = this._core.seed.protocol ? this._core.seed.protocol.toString() : null;
    const hostnameSerialized = this._core.seed.hostname ? this._core.seed.hostname.toString() : null;
    this._core.rawDna = ["url", [protocolSerialized, hostnameSerialized, this._core.seed.normalize]];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }
}


/** Boolean schema: validates `boolean` values. Mirrors Zod's `z.boolean()`. */
// Boolean implementation
export class DnaBoolean extends DnaTypeWithWrappers<boolean, boolean> {
  override _core = new BaseCore("b", { coerceCode: "toBoolean", rawDna: ["b"] });
  override get type() { return "boolean"; }

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
/**
 * Base number schema implementation with min/max/gt/lt/multipleOf constraints.
 * Extended by {@link DnaNumber}, {@link DnaBigInt}, {@link DnaInt}, and {@link DnaInt32}.
 *
 * @typeParam T - The numeric type (`number` or `bigint`).
 * @typeParam I - The input type (defaults to `unknown`).
 */
export class NumberImpl<T extends number | bigint, I = unknown> extends DnaTypeWithWrappers<T, I> {
  override _core = numCoreFactory<T>("n", "toNumber");
  override get type() { return "number"; }

  // static init<T extends number | bigint, I = T>(type: tsDnaOpcode = "n", coerceCode: string = "toNumber"): any {
  //   return this.initCore<T, I, tsStateNumber<T>>(type, { min: null, max: null, exclMin: false, exclMax: false, multOf: null }, coerceCode);
  // }

  /**
   * Sets the minimum value (inclusive).
   *
   * @param value - The minimum value.
   * @param meta - Optional metadata.
   * @returns A cloned schema with the min constraint.
   */
  min(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = value; cl._core.innerMeta("min", meta); }); }
  /**
   * Sets the maximum value (inclusive).
   *
   * @param value - The maximum value.
   * @param meta - Optional metadata.
   * @returns A cloned schema with the max constraint.
   */
  max(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = value; cl._core.innerMeta("max", meta); }); }
  /**
   * Sets a strictly-greater-than constraint (exclusive minimum).
   *
   * @param value - The exclusive lower bound.
   * @param meta - Optional metadata.
   * @returns A cloned schema with the gt constraint.
   */
  gt(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = value; cl._core.seed.exclMin = true; cl._core.innerMeta("gt", meta); }); }
  /**
   * Sets a greater-than-or-equal constraint (inclusive minimum). Alias for {@link min}.
   *
   * @param value - The inclusive lower bound.
   * @param meta - Optional metadata.
   * @returns A cloned schema with the gte constraint.
   */
  gte(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = value; cl._core.seed.exclMin = false; cl._core.innerMeta("gte", meta); }); }
  /**
   * Sets a strictly-less-than constraint (exclusive maximum).
   *
   * @param value - The exclusive upper bound.
   * @param meta - Optional metadata.
   * @returns A cloned schema with the lt constraint.
   */
  lt(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = value; cl._core.seed.exclMax = true; cl._core.innerMeta("lt", meta); }); }
  /**
   * Sets a less-than-or-equal constraint (inclusive maximum). Alias for {@link max}.
   *
   * @param value - The inclusive upper bound.
   * @param meta - Optional metadata.
   * @returns A cloned schema with the lte constraint.
   */
  lte(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = value; cl._core.seed.exclMax = false; cl._core.innerMeta("lte", meta); }); }
  /**
   * Sets an exact value (min and max to the same value).
   *
   * @param value - The exact value.
   * @param meta - Optional metadata.
   * @returns A cloned schema with the eq constraint.
   */
  eq(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = value; cl._core.seed.min = value; cl._core.seed.exclMax = false; cl._core.innerMeta("eq", meta); }); }
  /**
   * Sets a multipleOf constraint.
   *
   * @param value - The divisor.
   * @param meta - Optional metadata.
   * @returns A cloned schema with the multipleOf constraint.
   */
  multipleOf(value: T, meta?: tsDnaMeta) { return cloner(this, cl => { cl._core.seed.multOf = value; cl._core.innerMeta("multipleOf", meta); }); }

  /** @deprecated Use multipleOf() instead */
  step(value: T, meta?: tsDnaMeta) { return this.multipleOf(value, meta); }
  /** @deprecated No-op in DNA, returns this */
  finite() { return this.clone(); }
  /** Safe integer: an integer within [MIN_SAFE_INTEGER, MAX_SAFE_INTEGER]. */
  safe() {
    // `int()` carries over existing bounds; clamp them to the safe-integer range
    // (intersect, so any tighter user bound wins).
    const impl: NumberImpl<number> = this.int();
    if (impl._core.seed.min === null || impl._core.seed.min < Number.MIN_SAFE_INTEGER) impl._core.seed.min = Number.MIN_SAFE_INTEGER;
    if (impl._core.seed.max === null || impl._core.seed.max > Number.MAX_SAFE_INTEGER) impl._core.seed.max = Number.MAX_SAFE_INTEGER;
    return impl;
  }

  /**
   * Converts this number schema to an integer schema (`DnaInt`), carrying
   * over existing constraints.
   *
   * @returns A `DnaInt` schema with the current constraints.
   */
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

  /**
   * Constrains the number to be strictly positive (> 0).
   *
   * @returns A cloned schema with the positive constraint.
   */
  positive() {
    return cloner(this, cl => {
      const min: any = cl._core.seed.min;
      if (min === null || (typeof min === 'bigint' ? min <= 0n : min <= 0)) {
        cl._core.seed.min = 0 as T;
        cl._core.seed.exclMin = true;
      }
    });
  }
  /**
   * Constrains the number to be non-negative (>= 0).
   *
   * @returns A cloned schema with the nonnegative constraint.
   */
  nonnegative() {
    return cloner(this, cl => {
      const min: any = cl._core.seed.min;
      if (min === null || (typeof min === 'bigint' ? min < 0n : min < 0)) {
        cl._core.seed.min = 0 as T;
        cl._core.seed.exclMin = false;
      }
    });
  }
  /**
   * Constrains the number to be strictly negative (< 0).
   *
   * @returns A cloned schema with the negative constraint.
   */
  negative() {
    return cloner(this, cl => {
      const max: any = cl._core.seed.max;
      if (max === null || (typeof max === 'bigint' ? max >= 0n : max >= 0)) {
        cl._core.seed.max = 0 as T;
        cl._core.seed.exclMax = true;
      }
    });
  }
  /**
   * Constrains the number to be non-positive (<= 0).
   *
   * @returns A cloned schema with the nonpositive constraint.
   */
  nonpositive() {
    return cloner(this, cl => {
      const max: any = cl._core.seed.max;
      if (max === null || (typeof max === 'bigint' ? max > 0n : max > 0)) {
        cl._core.seed.max = 0 as T;
        cl._core.seed.exclMax = false;
      }
    });
  }

  override get templateRegex(): string { return this._core.seed.min === null && this._core.seed.max === null && this._core.seed.multOf === null ? "-?\\d+(?:\\.\\d+)?" : "\x00"; }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const selfDna: tsDna = [this._core.state.kind as tsDnaOpcode, [this._core.seed.min, this._core.seed.exclMin, this._core.seed.max, this._core.seed.exclMax, this._core.seed.multOf], this.meta()];
    return coll.storeDNA(selfDna, storeMark, storePosition);
  }
}

/** Number schema for `number` values. Mirrors Zod's `z.number()`. */
export class DnaNumber extends NumberImpl<number> { }

/** BigInt schema for `bigint` values. Mirrors Zod's `z.bigint()`. */
export class DnaBigInt extends NumberImpl<bigint> {
  override _core = numCoreFactory<bigint>("bi", "toBigInt");
  override get type() { return "bigint"; }
  // static create(): any { return this.init<bigint>("bi", "toBigInt"); }
  // int() and safe() are not applicable to bigint, so they are not implemented
  override positive() { return cloner(this, cl => { cl._core.seed.min = BigInt(0); cl._core.seed.exclMin = true; }); }
  override nonnegative() { return cloner(this, cl => cl._core.seed.min = BigInt(0)); }
  override negative() { return cloner(this, cl => { cl._core.seed.max = BigInt(0); cl._core.seed.exclMax = true; }); }
  override nonpositive() { return cloner(this, cl => cl._core.seed.max = BigInt(0)); }

  override get templateRegex(): string { return this._core.seed.min === null && this._core.seed.max === null && this._core.seed.multOf === null ? "-?\\d+n" : "\x00"; }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const selfDna: tsDna = [this._core.state.kind as tsDnaOpcode, [this._core.seed.min, this._core.seed.exclMin, this._core.seed.max, this._core.seed.exclMax, this._core.seed.multOf], this.meta()];
    return coll.storeDNA(selfDna, storeMark, storePosition);
  }
}

/** Integer schema: validates `number` values that are integers. Mirrors Zod's `z.int()`. */
export class DnaInt extends NumberImpl<number> {
  override _core = numCoreFactory<number>("i", "toInt");
  override get type() { return "int"; }
  // static create(): any { return this.init<number>("i", "toInt"); }
  override get templateRegex(): string { return this._core.seed.min === null && this._core.seed.max === null && this._core.seed.multOf === null ? "-?\\d+" : "\x00"; }
}

/** Int32 schema: validates integers within the signed 32-bit range [-2^31, 2^31-1]. */
export class DnaInt32 extends NumberImpl<number> {
  override _core = numCoreFactory<number>("i", "toInt", false, INT32Bounds);
  override get type() { return "int32"; }
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


/** Coercing string schema: converts input to string before validation. Created via `dna.coerce.string()`. */
export class DnaCoerceString extends DnaString { override _core = strCoreFactory("", true); }
/** Coercing number schema: converts input to number before validation. Created via `dna.coerce.number()`. */
export class DnaCoerceNumber extends DnaNumber { override _core = numCoreFactory<number>("n", "toNumber", true); }
/** Coercing integer schema: converts input to integer before validation. Created via `dna.coerce.int()`. */
export class DnaCoerceInt extends DnaInt { override _core = numCoreFactory<number>("i", "toInt", true); }
/** Coercing int32 schema: converts input to int32 before validation. Created via `dna.coerce.int32()`. */
export class DnaCoerceInt32 extends DnaInt32 { override _core = numCoreFactory<number>("i", "toInt", true, INT32Bounds); }
/** Coercing bigint schema: converts input to bigint before validation. Created via `dna.coerce.bigint()`. */
export class DnaCoerceBigInt extends DnaBigInt { override _core = numCoreFactory<bigint>("bi", "toBigInt", true); }

/** Coercing boolean schema: converts input to boolean before validation. Created via `dna.coerce.boolean()`. */
export class DnaCoerceBoolean extends DnaBoolean { override _core = new BaseCore("b", { coerce: true, coerceCode: "toBoolean", rawDna: ["b"] }); }
/** Coercing date schema: converts input to Date before validation. Created via `dna.coerce.date()`. */
export class DnaCoerceDate extends DnaDate { override _core = new BaseCore<{ min: Date | null, max: Date | null }>("date", { coerce: true, coerceCode: "toDate", seed: { min: null, max: null } }); }

/**
 * Static factory for coercing schemas. Accessed via `dna.coerce.*`.
 * Coercion is a serialization layer driven by the `_coerce` flag on the base
 * schema — no wrapper instance is needed.
 */
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

  override _core = new BaseCore<{ enumObj: T }>("enum");

  get values(): T[keyof T][] { return Object.values(this._core.seed.enumObj) as T[keyof T][]; }
  get options(): T[keyof T][] { return Object.values(this._core.seed.enumObj) as T[keyof T][]; }

  get enum() { return this._core.seed.enumObj; }

  /**
   * Returns a new enum schema containing only the specified values.
   *
   * @param values - The values to keep.
   * @returns A cloned enum schema with only the extracted values.
   */
  extract(values: tsDnaEnumValueType[]) {
    return cloner(this, cl => cl._core.seed.enumObj = Object.fromEntries(Object.entries(cl._core.seed.enumObj).filter(([k, v]) => values.includes(v))) as T);
  }
  /**
   * Returns a new enum schema excluding the specified values.
   *
   * @param values - The values to exclude.
   * @returns A cloned enum schema without the excluded values.
   */
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

/**
 * Array schema: validates arrays where each element matches the item schema.
 * Supports min/max/length constraints. Mirrors Zod's `z.array(item)`.
 *
 * @typeParam S - The item schema type.
 */
// Array implementation
export class DnaArray<S extends DnaSomeType = DnaSomeType> extends DnaTypeWithWrappers<any, any> {
  declare readonly _output: $Output<S>[];
  declare readonly _input: $Input<S>[];
  override _core = new BaseCore<{ itemSchema: DnaSomeType, min: number | null, max: number | null, length: number | null }>("array");


  override unwrap<W extends S>(): W { //wrap for Array is not wrap for wrapper, unwrap of wrapper override until there is no wrapper anymore.
    return this._core.seed.itemSchema as W;
  }

  /**
   * Sets the minimum number of elements.
   *
   * @param n - The minimum element count.
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the min constraint.
   */
  min(n: number, meta?: string | tsDnaMeta) { return cloner(this, cl => { cl._core.seed.min = n; cl._core.innerMeta("min", meta); }); }
  /**
   * Sets the maximum number of elements.
   *
   * @param n - The maximum element count.
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the max constraint.
   */
  max(n: number, meta?: string | tsDnaMeta) { return cloner(this, cl => { cl._core.seed.max = n; cl._core.innerMeta("max", meta); }); }
  /**
   * Sets an exact element count (min and max to the same value).
   *
   * @param n - The exact element count.
   * @param meta - Optional error message or metadata.
   * @returns A cloned schema with the length constraint.
   */
  length(n: number, meta?: string | tsDnaMeta) { return cloner(this, cl => { cl._core.seed.length = n; cl._core.innerMeta("length", meta); }); }
  /**
   * Requires the array to be non-empty (min = 1).
   *
   * @returns A cloned schema with the nonempty constraint.
   */
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
/**
 * Promise schema: validates `Promise` values by awaiting them and validating
 * the resolved value against the inner schema. Sync `parse`/`safeParse` reject
 * with a dedicated error — use `parseAsync`/`safeParseAsync` instead.
 * Mirrors Zod's `z.promise(inner)`.
 *
 * @typeParam T - The resolved value's output type.
 * @typeParam I - The resolved value's input type.
 */
// TODO: comment about depreciation of dna.promise
export class DnaPromise<T, I = unknown> extends DnaTypeWithWrappers<T, I> {
  override _core = new BaseCore<{ inner: DnaSomeType<T, I> }>("promise");

  // static init<T, I = unknown>(innerSchema: DnaType<T>): any {
  //   return this.initCore<T, I, tsStatePromise<T, I>>("promise", { innerSchema: innerSchema as any });
  // }

  override unwrap(): DnaSomeType {
    return this._core.seed.inner;
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

/**
 * Tuple schema (Zod's `z.tuple(items, rest?)`): validates fixed-length arrays
 * with one schema per position, plus an optional rest schema for extra items.
 *
 * @typeParam S - A readonly tuple of position schema types.
 * @typeParam R - The rest schema type (or `never` if no rest).
 */
// Tuple implementation (Zod's z.tuple(items, rest?)): one schema per position,
// plus an optional rest schema for any extra items.
export class DnaTuple<S extends tsDnaTupleSchemaRO, R extends DnaType<any, any> | never = never> extends DnaTypeWithWrappers<any, any> {
  declare readonly _output: tsDnaTupleValueWithRest<S, [R] extends [never] ? never : $Output<R>>;
  declare readonly _input: tsDnaTupleValueWithRest<S, [R] extends [never] ? never : $Input<R>>;
  override _core = new BaseCore<{ items: DnaSomeType[], rest?: DnaSomeType, min: number | null, max: number | null, length: number | null }>("tuple")
    .preSeed({ min: null, max: null, length: null });


  /** Sets the rest schema for extra items beyond the fixed prefix. */
  rest<R2 extends DnaType<any, any>>(restSchema: R2): DnaTuple<S, R2> {
    return cloner(this, cl => { cl._core.seed.rest = restSchema; }) as unknown as DnaTuple<S, R2>;
  }
  /** Validates that the tuple has at least `n` items. */
  min(n: number, meta?: string) { return cloner(this, cl => { cl._core.seed.min = n; cl._core.innerMeta("min", meta); }); }
  /** Validates that the tuple has at most `n` items. */
  max(n: number, meta?: string) { return cloner(this, cl => { cl._core.seed.max = n; cl._core.innerMeta("max", meta); }); }
  /** Validates that the tuple has exactly `n` items. */
  length(n: number, meta?: string) { return cloner(this, cl => { cl._core.seed.length = n; cl._core.innerMeta("length", meta); }); }
  /** Requires the tuple to have at least 1 item. */
  nonempty() { return this.min(1); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const len = this._core.seed.items.length;
    const prefixItems = new Array(len);
    const prefixStoreId = coll.setStore(prefixItems);
    // No rest -> `items: false` (no extra items, Zod default). Rest -> the rest schema id.
    const itemsDef: any[] = ["items", this._core.seed.rest ? 0 : false];
    const itemsStoreId = this._core.seed.rest ? coll.setStore(itemsDef) : -1;
    const constraints: any[] = [
      ["prefixItems", prefixItems],
    ];
    // Native minItems/maxItems opcodes: prefix length is the baseline; user constraints override if larger/smaller
    const userMin = this._core.seed.length !== null ? this._core.seed.length : this._core.seed.min;
    const userMax = this._core.seed.length !== null ? this._core.seed.length : this._core.seed.max;
    constraints.push(["minItems", userMin !== null ? Math.max(len, userMin) : len]);
    if (userMax !== null) constraints.push(["maxItems", userMax]);
    constraints.push(itemsDef);
    this._core.rawDna = ["a", constraints];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, prefixStoreId);
    this._core.setDnaId(coll, dnaId);
    for (let poz = len; poz--;) this._core.seed.items[poz].toDna(coll, prefixStoreId, poz);
    if (this._core.seed.rest) this._core.seed.rest.toDna(coll, itemsStoreId, 1);
    return dnaId;
  }
}

/**
 * Object schema: validates plain objects with named properties. Supports
 * strict/loose/standard modes, partial/required, pick/omit, extend, and
 * catchall. Mirrors Zod's `z.object(shape)`.
 *
 * @typeParam T - The shape type (a record of property name to schema).
 */
// Object implementation
export class DnaObject< T extends Record<string, DnaSomeType> = Record<string, DnaSomeType>> extends DnaTypeWithWrappers<any, any> {
  /** No `out` variance on `T`: the deferred pattern (parent `any, any` + `declare` fields) breaks circular type inference on its own. Adding `out T` triggers a variance check that fails because `$ReadonlyValue` (conditional type) wrapping `$DnaObjectOutput<T>` (mapped type) is not provably covariant. */
  // Deferred output/input: the parent uses `any, any` to break circular type inference
  // (recursive schemas with getters). The actual types are re-declared here via `declare`
  // so that `this["_output"]` / `this["_input"]` resolve correctly. This mirrors Zod's
  // pattern where `ZodObject<out Shape>` extends `$ZodType<any, any, $ZodObjectInternals<Shape>>`.
  declare readonly _output: { [K in keyof T]: $Output<T[K]> };
  declare readonly _input: { [K in keyof T]: $Input<T[K]> };
  override _core = new BaseCore<{ propertySchemas: Record<string, DnaSomeType>, addPropSchema: DnaSomeType | boolean | undefined, objType: tsDnaObjectType, requiredKeys?: string[], declared?: boolean }>("object");

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const constraints: any[] = [];
    const declared = this._core.seed.declared ?? true;
    const opcode = this._core.seed.objType === 'plainObject' ? 'rcd' : (declared ? 'o' : '_o');
    this._core.rawDna = [opcode, constraints];
    // Schema instances serialize identically in the collector discriminant, so two
    // objects with the same keys but different value schemas (e.g. discriminated-union
    // branches differing only by their `literal` discriminator) would falsely dedupe.
    // Add a per-property signature (leaf opcode + literal value) to distinguish them.
    const propSig = this._core.seed.propertySchemas
      ? Object.entries(this._core.seed.propertySchemas).map(([k, v]) => {
        let leaf: DnaSomeType = v;
        while (leaf instanceof _DnaWrapper) leaf = leaf.unwrap();
        switch (true) {
          case leaf instanceof DnaLiteral:
            return [k, "l", Array.from(leaf.values)];
          case leaf instanceof DnaEnum:
            return [k, leaf._core.state.kind, Array.from(leaf.values)];
          case leaf instanceof DnaObject:
            return [k, leaf._core.state.kind, Object.keys(leaf._core.seed.propertySchemas ?? {})];
          default:
            return [k, leaf._core.state.kind];
        }
      })
      : undefined;
    const dnaId = coll.storeDNA(
      this._core.dnaWithMeta,
      storeMark, storePosition,
      [this._core.seed.objType, this._core.seed.requiredKeys, this._core.seed.addPropSchema, propSig]
    );
    this._core.setDnaId(coll, dnaId);
    let keepKeys: string[] | undefined = undefined;
    if (this._core.seed.propertySchemas) {
      const properties: [string, number, tsDnaMeta][] = [];
      const defaultProperties: [string, number, tsDnaMeta][] = [];

      // Store each property schema and update its index.
      // NOTE: optional properties are NOT unwrapped here — the `wrp` wrapper must
      // survive so an explicitly-present `undefined` (e.g. `{ a: undefined }`) is
      // still accepted. Absent keys are handled separately via the required list.
      for (const [key, schema] of Object.entries(this._core.seed.propertySchemas)) {
        const schemaMeta = schema._core.meta;
        // A `lazy`/getter property can't be resolved at object-init time (the
        // recursive const is still in its TDZ), so its key-optionality meta
        // (optional/nullable/default on the recursive ref) is invisible there. At emit
        // time the const exists, so resolve the getter now to read its REAL meta —
        // otherwise an optional/nullable recursive key is wrongly treated as required.
        const realMeta = schema instanceof DnaLazy ? schema.innerType.meta() : schemaMeta;

        // Mark default/prefault presence in the property meta so `isWrapped` can
        // detect them even when their value is `undefined` or falsy. The actual
        // value lives in the `wrp` opcode params for runtime.
        const propMeta: tsDnaInnerMeta = { ...realMeta };
        let current: DnaSomeType | undefined = schema instanceof DnaLazy ? schema.innerType : schema;
        while (current instanceof _DnaWrapper) {
          if (current.wrapperType === WRAPPERS_XFAULT.default) propMeta.default = true;
          else if (current.wrapperType === WRAPPERS_XFAULT.prefault) propMeta.prefault = true;
          current = current.unwrap();
        }
        if (current?.meta().preprocess) propMeta.preprocess = true;

        // A `nonoptional` key is required, so it must NOT go to defaultProperties
        // (which would silently supply the default for an absent key); keep it in
        // `properties` where the default still applies to a present `undefined`.
        const isDefault = isWrapped(propMeta);
        const propDef: [string, number, tsDnaMeta] = [key, 0, propMeta];
        const propStoreId = coll.setStore(propDef);
        schema.toDna(coll, propStoreId, 1);
        (isDefault ? defaultProperties : properties).push(propDef);
      }
      if (properties.length) constraints.push(["properties", properties]);
      if (defaultProperties.length) constraints.push(["defaultProperties", defaultProperties]);
      keepKeys = [...properties, ...defaultProperties].map(c => c[0]);
    }

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
    if (this._core.seed.objType === 'strict') {
      constraints.push(["additionalProperties", false]);
    } else if (this._core.seed.objType === 'loose') {
      constraints.push(["additionalProperties", true]);
    } else if (this._core.seed.addPropSchema !== undefined) {
      const ap = this._core.seed.addPropSchema;
      if (typeof ap === 'boolean') {
        constraints.push(["additionalProperties", ap]);
      } else {
        const addPropDef = ["additionalProperties", -1];
        const addPropStoreId = coll.setStore(addPropDef);
        constraints.push(addPropDef);
        ap.toDna(coll, addPropStoreId, 1);
      }
    }
    // Standard Zod-like objects emit a `keepOnly` constraint listing the
    // declared property names. The parser uses it to materialize only those
    // keys in the output, skipping absent/undefined optional values.
    if (this._core.seed.objType === 'standard' && this._core.seed.addPropSchema === undefined) {
      constraints.push(["keepOnly", keepKeys ?? []]);
    }
    return dnaId;
  }

  /**
   * Switches the object to strict mode: unknown properties cause validation
   * errors (equivalent to `additionalProperties: false`).
   *
   * @returns A cloned schema in strict mode.
   */
  strict() { return cloner(this, cl => cl._core.seed.objType = "strict"); }
  /**
   * Switches the object to loose mode: unknown properties pass through
   * unchanged (equivalent to `additionalProperties: true`).
   *
   * @returns A cloned schema in loose mode.
   */
  loose() { return cloner(this, cl => cl._core.seed.objType = "loose"); }
  /** @deprecated Use loose() instead */
  passthrough() { return this.loose(); }

  /**
   * Switches the object to standard (Zod-like) mode: unknown properties are
   * stripped from the output. This is the default mode.
   *
   * @returns A cloned schema in standard mode.
   */
  standard() { return cloner(this, cl => cl._core.seed.objType = "standard"); }
  /** @deprecated Use standard() instead */
  strip() { return this.standard(); }

  /**
   * Sets a catchall schema for unknown properties (validated against the
   * given schema). Mutates `this` in place.
   *
   * @param addPropSchema - The schema for additional properties.
   * @returns `this` (mutated).
   */
  catchall(addPropSchema: DnaSomeType) { this._core.seed.addPropSchema = addPropSchema; return this }
  /** Alias of catchall() for compatibility @see catchall() */
  catchAll(addPropSchema: DnaSomeType) { return this.catchall(addPropSchema); }

  /**
   * Makes some or all properties optional. When called with no arguments,
   * all properties become optional. When called with a `keys` object, only
   * the specified keys are made optional.
   *
   * @typeParam K - The keys to make optional (defaults to all keys).
   * @param keys - A record mapping key names to booleans (`true` = make optional).
   * @returns A new `DnaObject` with the specified keys optional.
   */
  partial<const K extends keyof T = keyof T>(keys?: Record<K, boolean>): DnaObject<$DnaPartialShape<T, K>> {
    const ks = keys as Record<string, boolean> | undefined;
    return cloner(this, cl => {
      if (ks) cl._core.seed.requiredKeys = cl._core.seed.requiredKeys?.filter(k => !ks[k]); else cl._core.seed.requiredKeys = [];
      if (cl._core.seed.propertySchemas) {
        for (const key in cl._core.seed.propertySchemas) {
          const schema = cl._core.seed.propertySchemas[key];
          const makeOptional = ks ? ks[key] : true;
          if (makeOptional) {
            const meta = schema._core.meta;
            if (meta && meta.optional === undefined) cl._core.seed.propertySchemas[key] = initDna(DnaOptional, { inner: schema });
          }
        }
      }
    }) as unknown as DnaObject<$DnaPartialShape<T, K>>;
  }

  /**
   * Makes some or all properties required (cancels `optional` wrappers).
   * When called with no arguments, all properties become required. When
   * called with a `keys` object, only the specified keys are made required.
   *
   * @param keys - A record mapping key names to booleans (`true` = make required).
   * @returns A new `DnaObject` with the specified keys required.
   */
  required(keys?: Record<string, boolean>): DnaObject<T> {
    return cloner(this, cl => {
      if (keys) cl._core.seed.requiredKeys = Object.keys(cl._core.seed.propertySchemas ?? {}).filter(k => keys[k]);
      else cl._core.seed.requiredKeys = Object.keys(cl._core.seed.propertySchemas ?? {});
    }) as DnaObject<T>;
  }

  get shape(): T {
    return this._core.seed.propertySchemas as T;
  }

  get _objType(): tsDnaObjectType {
    return this._core.seed.objType;
  }

  /**
   * Returns the property keys of this object schema.
   *
   * @returns An array of property key strings.
   */
  keyOf(): PropertyKey[] {
    return Object.keys(this._core.seed.propertySchemas ?? {});
  }

  /**
   * Applies a function to this object schema and returns the result. A
   * general-purpose escape hatch for custom processing.
   *
   * @typeParam R - The return type of `fn`.
   * @param fn - A function receiving this schema.
   * @returns The value returned by `fn`.
   */
  apply<R>(fn: (schema: this) => R): R {
    return fn(this);
  }

  /**
   * Returns a new object schema with the specified keys omitted.
   *
   * @typeParam K - The keys to omit.
   * @param keys - A record mapping key names to booleans (`true` = omit).
   * @returns A new `DnaObject` without the omitted keys.
   */
  omit<K extends keyof T>(keys: Record<K, boolean>): DnaObject<Omit<T, K>> {
    const newPropertySchemas: Record<string, DnaSomeType> = {};
    for (const [key, schema] of Object.entries(this._core.seed.propertySchemas ?? {})) {
      if (!keys[key as K]) {
        newPropertySchemas[key] = schema;
      }
    }
    // CAST: cloner preserves the DnaObject class but TS can't prove the omitted shape type Omit<T, K>
    return cloner(this, cl => { cl._core.seed.propertySchemas = newPropertySchemas; }) as DnaObject<Omit<T, K>>;
  }

  /**
   * Returns a new object schema with only the specified keys picked.
   *
   * @typeParam K - The keys to pick.
   * @param keys - A record mapping key names to booleans (`true` = pick).
   * @returns A new `DnaObject` with only the picked keys.
   */
  pick<K extends keyof T>(keys: Record<K, boolean>): DnaObject<Pick<T, K>> {
    const newPropertySchemas: Record<string, DnaSomeType> = {};
    for (const [key, schema] of Object.entries(this._core.seed.propertySchemas ?? {})) {
      if (keys[key as K]) {
        newPropertySchemas[key] = schema;
      }
    }
    // CAST: cloner preserves the DnaObject class but TS can't prove the picked shape type Pick<T, K>
    return cloner(this, cl => { cl._core.seed.propertySchemas = newPropertySchemas; }) as DnaObject<Pick<T, K>>;
  }

  /**
   * Shared runtime implementation of `.extend()` and `.safeExtend()`.
   * Clones the current object's `propertySchemas` and merges/overrides them with `shape`,
   * then builds a new `DnaObject` typed with the combined `T & U` generics.
   * It does not perform validation / safety checks itself; callers such as `.extend()`
   * handle those before delegating here.
   */
  private _applyExtend<U extends Record<string, DnaSomeType>>(shape: Record<string, DnaSomeType>): DnaObject<T & U> {
    const newPropertySchemas: Record<string, DnaSomeType> = { ...this._core.seed.propertySchemas };
    for (const [key, schema] of Object.entries(shape)) {
      newPropertySchemas[key] = schema;
    }
    // CAST: cloner preserves the DnaObject class but TS can't prove the extended shape type T & U
    return cloner(this, cl => { cl._core.seed.propertySchemas = newPropertySchemas; }) as unknown as DnaObject<T & U>;
  }

  /**
   * Returns a new object schema with additional properties merged in. Throws
   * if the schema has refinements and a key would be overwritten (use
   * {@link safeExtend} in that case).
   *
   * @typeParam U - The shape of the new properties.
   * @param shape - A record of property name to schema to add.
   * @returns A new `DnaObject` with the combined shape `T & U`.
   */
  extend<U extends Record<string, DnaSomeType>>(shape: U): DnaObject<T & U> {
    if (shape === null || typeof shape !== "object" || Array.isArray(shape)) {
      throw new Error("Invalid input to extend: expected a plain object");
    }
    if (this._core.refinerList.length) {
      const existing = this._core.seed.propertySchemas ?? {};
      for (const key in shape) {
        if (key in existing) {
          throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
        }
      }
    }
    return this._applyExtend(shape);
  }

  /**
   * Like {@link extend} but allows overwriting keys even when the schema has
   * refinements. The type parameter enforces that existing keys can only be
   * replaced with compatible schemas.
   *
   * @typeParam U - The shape of the new/overwritten properties.
   * @param shape - A record of property name to schema.
   * @returns A new `DnaObject` with the combined shape `T & U`.
   */
  safeExtend<U extends Record<string, DnaSomeType>>(
    shape: U & $SafeExtendShape<T, U> & Partial<Record<keyof T, DnaSomeType>>
  ): DnaObject<T & U> {
    if (shape === null || typeof shape !== "object" || Array.isArray(shape)) {
      throw new Error("Invalid input to safeExtend: expected a plain object");
    }
    return this._applyExtend(shape);
  }

  /**
   * @deprecated Use `.extend()` instead.
   */
  merge(other: DnaObject<Record<string, DnaSomeType>>): DnaObject<Record<string, DnaSomeType>> {
    const left = (this._core.seed.propertySchemas ?? {}) as Record<string, DnaType<any, any>>;
    const right = (other._core.seed.propertySchemas ?? {}) as Record<string, DnaType<any, any>>;
    const merged: Record<string, DnaSomeType> = { ...left, ...right };
    for (const key of Object.keys(left)) {
      if (key in right) {
        merged[key] = left[key].and(right[key]);
      }
    }
    const leftType = this._core.seed.objType;
    const rightType = other._core.seed.objType;
    const objType: 'strict' | 'loose' | 'standard' =
      leftType === 'loose' || rightType === 'loose' ? 'loose'
        : leftType === 'strict' && rightType === 'strict' ? 'strict'
          : 'standard';
    return initDna(DnaObject, { propertySchemas: merged, objType }, this._core.meta);
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
function finiteValueSet(s: DnaSomeType): tsPrimitiveLiteral[] | undefined {
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
    return finiteValueSet(s._core.seed.steps[0]);
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
    if (head._core.seed.combinatorType !== "anyOf") return undefined; // only unions have a value set
    const out: tsPrimitiveLiteral[] = [];
    for (const m of head._core.seed.schemas) {
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

/**
 * Discriminated union schema: a union of object schemas that share a common
 * discriminator property. The parser dispatches to the correct branch based
 * on the discriminator value, making it more efficient than a plain union.
 * Mirrors Zod's `z.discriminatedUnion(key, options)`.
 *
 * @typeParam K - The discriminator property name.
 * @typeParam S - A tuple of object schema types, each having the discriminator key.
 */
// Discriminated union implementation (discriminator opcode)
export class DnaDiscriminatedUnion<K extends string, S extends tsDnaDiscriminatedUnionObjects<K>> extends DnaTypeWithWrappers<any, any> {
  declare readonly _output: $Output<S[number]>;
  declare readonly _input: $Input<S[number]>;
  override _core = new BaseCore<{ discriminator: K, schemas: DnaSomeType[] }>("discriminator");
  override get type() { return "discriminatedUnion"; }

  /** Returns the discriminated union's option schemas (Zod v4 parity: `.options`). */
  get options(): S { return this._core.seed.schemas as S; }
  /** Returns the discriminator property name (Zod v4 parity: via `._zod.def.discriminator`). */
  get discriminator(): K { return this._core.seed.discriminator; }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const schemas = this._core.seed.schemas;
    const discriminator = this._core.seed.discriminator;
    const nbItems = schemas.length;

    const discriminDef = new Array<tsDnaId | undefined>(1 + nbItems);
    const discriminKeys = new Array<tsPrimitiveLiteral[]>(nbItems);
    const discriminStoreId = coll.setStore(discriminDef);
    let discRequired: string[] = [discriminator];

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
      discriminKeys[i] = values;
      if (values.includes(undefined)) discRequired = [];
    }

    this._core.rawDna = ["discriminator", discriminator, discriminKeys, discriminDef];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, discriminStoreId);
    this._core.setDnaId(coll, dnaId);

    const prevalidation = initDna(DnaObject, { objType: 'object', requiredKeys: discRequired });
    prevalidation.toDna(coll, discriminStoreId, 0);
    for (let i = 0; i < nbItems; i++) {
      const schema = schemas[i];
      if (!(schema instanceof DnaObject)) {
        throw new Error(`Discriminated union branch at index ${i} must be a DnaObject`);
      }
      const discSchema = schema.shape[discriminator];
      const isOptional = !isRequiredKey(discSchema);
      const stripped = schema.extend({ [discriminator]: isOptional ? initDna(DnaAny).optional() : initDna(DnaAny) });
      stripped.toDna(coll, discriminStoreId, 1 + i);
    }

    return dnaId;
  }
}


/**
 * Record schema: validates plain objects whose keys match `keySchema` and
 * whose values match `valueSchema`. Supports `standard`, `partial`, and
 * `loose` modes. Mirrors Zod's `z.record(keySchema, valueSchema)`.
 *
 * @typeParam K - The key schema type.
 * @typeParam V - The value schema type.
 */
// Record implementation
export class DnaRecord<K extends DnaType<any, any>, V extends DnaType<any, any>> extends DnaTypeWithWrappers<any, any> {
  declare readonly _output: Record<$Output<K> & PropertyKey, $Output<V>>;
  declare readonly _input: Record<$Input<K> & PropertyKey, $Input<V>>;

  override _core = new BaseCore<{ keySchema: DnaSomeType, valueSchema: DnaSomeType, type: "partial" | "loose" | "standard" }>("record")

  /** Returns the key schema (Zod v4 parity: `keyType`). */
  get keySchema(): K { return this._core.seed.keySchema as K; }
  /** Returns the value schema (Zod v4 parity: `valueType`). */
  get valueSchema(): V { return this._core.seed.valueSchema as V; }
  /** Alias for {@link keySchema} (Zod v4 naming). */
  get keyType(): K { return this.keySchema; }
  /** Alias for {@link valueSchema} (Zod v4 naming). */
  get valueType(): V { return this.valueSchema; }

  // static init<K extends DnaType<any>, V extends DnaType<any>, I = Record<$Output<K>, $Output<V>>>(keySchema: DnaSomeType, valueSchema: DnaSomeType, type: "partial" | "loose" | "standard" = "standard"): any {
  //   return this.initCore<Record<$Output<K>, $Output<V>>, I, tsStateRecord<K, V>>("record", { keySchema, valueSchema, type });
  // }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const keySchema = this._core.seed.keySchema;
    // A record matches only a *plain* object (Zod `z.record` rejects Date/Map/class
    // instances, unlike `z.object`). The "o" compiler turns this flag into a
    // prototype check (Object.prototype | null).
    const constraints: any[] = [];

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
      this._core.rawDna = ["rcd", constraints];
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
      this._core.rawDna = ["rcd", constraints];
      const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
      // Use head to check if the root schema is a literal array
      const head = keySchema._head;
      const isLiteralArray = head instanceof DnaLiteral && head._rawValues.length > 1;
      // Preserve pipe/transform/refine key schemas before falling back to
      // EnumImpl for literal arrays or other finite schemas.
      const hasRefiners = keySchema._core.refinerList.length > 0;
      if (
        keySchema.type === "pipe" ||
        keySchema.type === "transform" ||
        hasRefiners ||
        (keySchema instanceof DnaType && keySchema._core.seed.wrapperType === "transform")
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

    this._core.rawDna = ["rcd", constraints];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);

    const coercedKeySchema = keySchema[SymForceCoerce]();
    coercedKeySchema.toDna(coll, keyStoreId, 1);

    this._core.seed.valueSchema.toDna(coll, valueStoreId, 1);
    return dnaId;
  }
}


/**
 * Codec schema: bidirectional encode/decode. The decode direction (input →
 * output) reuses the base validator/parser cache, while the encode direction
 * (output → input) has its own cache. Created via `dna.codec()`.
 *
 * @typeParam I - The input (decode) type.
 * @typeParam O - The output (encode) type.
 */
// Codec implementation - bidirectional encode/decode
// Decode direction reuses the BASE `#state` validator/parser cache (DnaCodec
// overrides `toDna()` to return the decode twin, so the base `_validate`/`_safeParse`
// build the right thing). Only the ENCODE direction needs its own cache here.
export class DnaCodec<I, O> extends DnaTypeWithWrappers<O, I> {
  override _core = new BaseCore<{ decodeTwin: DnaType<O>, encodeTwin: DnaType<I>, cachedEncodeParserMap?: WeakMap<object, tsDnaParserFn> }>("codec");
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
    if (!this._core.seed.cachedEncodeParserMap) this._core.seed.cachedEncodeParserMap = new WeakMap();
    const key = ctx ?? this;
    const cached = this._core.seed.cachedEncodeParserMap.get(key);
    if (cached) return cached(value);
    const fn = parserBuilder(this._core.seed.encodeTwin.toDna(), ctx);
    this._core.seed.cachedEncodeParserMap.set(key, fn);
    return fn(value);
  }
}



/**
 * Lazy schema: defers schema construction until validation time via a getter
 * function. Used for recursive/circular schemas. Mirrors Zod's `z.lazy(getter)`.
 *
 * @typeParam Out - The output type.
 * @typeParam In - The input type.
 * @typeParam Inner - The inner schema type returned by the getter.
 */
export class DnaLazy<Out = any, In = any, Inner extends DnaType<Out, In> = DnaType<Out, In>> extends DnaTypeWithWrappers<Out, In> {
  readonly declare Inner: Inner;
  override _core = new BaseCore<{ getter: () => Inner }>("lazy");

  get innerType(): Inner {
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


/**
 * Function schema: validates function arguments against an input tuple
 * schema and the return value against an output schema. Supports
 * `.implement()` and `.implementAsync()` for creating validated wrappers.
 * Mirrors Zod's `z.function()`.
 *
 * @typeParam I - The input tuple type (arguments).
 * @typeParam O - The output schema type (return value).
 */
export class DnaFunction<I extends DnaFunctionInput = never, O extends DnaType<any> = DnaType<unknown>> extends DnaTypeWithWrappers<
  tsFunctionType<I, O>,
  tsFunctionType<I, O>
> {
  override _core = new BaseCore<{ input: DnaFunctionInput | DnaType<any, any>, output: DnaType<any> }>("function");
  #inputJS?: tsToJSResult;
  #outputJS?: tsToJSResult;


  /**
   * Sets the input (arguments) schema for this function schema.
   *
   * @typeParam NewI - The new input tuple schema type.
   * @param input - A `DnaTuple` schema or a raw tuple schema array.
   * @returns A new `DnaFunction` with the updated input schema.
   */
  input<const NewI extends DnaTuple<any, any>>(input: NewI): DnaFunction<NewI, O>;
  /**
   * Sets the input (arguments) schema with a rest schema for variadic args.
   *
   * @typeParam NewI - The new input tuple schema array type.
   * @typeParam NewR - The rest schema type.
   * @param input - A tuple schema array.
   * @param rest - An optional rest schema for extra arguments.
   * @returns A new `DnaFunction` with the updated input schema.
   */
  input<const NewI extends tsDnaTupleSchemaArray, const NewR extends DnaType<any, any> | never = never>(input: NewI, rest?: NewR): DnaFunction<DnaTuple<NewI, NewR>, O>;
  input(input: DnaFunctionInput, rest?: DnaType): DnaFunction<any, O> {
    let actualInput: DnaFunctionInput | DnaType<any, any> = input;
    if (rest !== undefined) {
      actualInput = initDna(DnaTuple, { items: input, rest });
    } else if (!(input instanceof DnaType)) {
      actualInput = initDna(DnaTuple, { items: input });
    }
    const newSchema = initDna(DnaFunction, { input: actualInput, output: this._core.seed.output }, this._core.meta) as unknown as DnaFunction<any, O>;
    newSchema._core.rawDna = this._core.rawDna;
    return newSchema;
  }

  /**
   * Sets the output (return value) schema for this function schema.
   *
   * @typeParam NewO - The new output schema type.
   * @param output - The output schema.
   * @returns A new `DnaFunction` with the updated output schema.
   */
  output<NewO extends DnaType<any>>(output: NewO): DnaFunction<I, NewO> {
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
    return (raw instanceof DnaType ? raw : initDna(DnaTuple, { items: raw })) as DnaType<DnaFunctionArgs<I>>;
  }

  /**
   * Normalizes `_core.seed.output` (either an already-built `DnaType` or
   * `undefined`) into a concrete `DnaType` usable with `.parse()`/`.parseAsync()`.
   * Defaults to `DnaUnknown` when no output schema was provided.
   */
  private _outputSchema(): O {
    const raw = this._core.seed.output;
    return (raw instanceof DnaType ? raw : initDna(DnaUnknown, {})) as unknown as O;
  }

  /**
   * `z.function().implement(fn)` equivalent: returns a wrapped function that
   * validates arguments against `.input()` before calling `fn`, then validates
   * the return value against `.output()`. Throws (via `DnaType.parse()`) on
   * either side mismatching — never silently passes invalid data through.
   *
   * Externals: if the input/output schemas use `.transform()`/`.refine()` with
   * captured externals, pass them via the second argument (same `tsDnaExternals`
   * type as `.parse()`). They are merged with `getRegisteredExternals()` and
   * destructured directly into the closure scope — matching the codegen pattern
   * used by `transform`/`refine` (names are inlined, not accessed via
   * `externals.name`).
   */
  implement(fn: (...args: DnaFunctionArgs<I>) => $Output<O>, externals?: tsDnaExternals): ((...args: DnaFunctionArgs<I>) => $Output<O>) & { requiredExternals: string[] } {
    const inputJS = this.#inputJS ??= toJS(false, true)(this._inputSchema().toDna());
    const outputJS = this.#outputJS ??= toJS(false, true)(this._outputSchema().toDna());
    const inputBody = inputJS.code.length > 1 ? inputJS.code[1] : inputJS.code[0];
    const outputBody = outputJS.code.length > 1 ? outputJS.code[1] : outputJS.code[0];
    if (fn instanceof AsyncFunction || isAsyncFnStr(inputBody) || isAsyncFnStr(outputBody)) {
      throw new Error("Schema or function is async — use implementAsync() instead of implement().");
    }
    // toJS code layout: [externalsParam?, body] where externalsParam is a
    // destructuring pattern (e.g. "{ext1,ext2}") and body is
    // "const ...; return [async] function(v){...};".
    // Inline each as an IIFE so externals are destructured from the shared
    // `externals` argument and baked into the parser's closure scope.
    const inputParam = inputJS.code.length > 1 ? inputJS.code[0] : "";
    const outputParam = outputJS.code.length > 1 ? outputJS.code[0] : "";
    const body = dnaErrorSource + ";" +
      "const inputParse=(function(" + inputParam + "){" + inputBody + "})(externals);" +
      "const outputParse=(function(" + outputParam + "){" + outputBody + "})(externals);" +
      "return function(...args){" +
      "const inRes=inputParse(args);" +
      "if(!inRes.success){throw new DnaError(inRes.errors);}" +
      "const result=fn.apply(this,inRes.data);" +
      "const outRes=outputParse(result);" +
      "if(!outRes.success){throw new DnaError(outRes.errors);}" +
      "return outRes.data;" +
      "}";
    const mergedExternals = { ...getRegisteredExternals(), ...externals };
    const result = new Function("fn", "externals", body).call(undefined, fn, mergedExternals) as ((...args: DnaFunctionArgs<I>) => $Output<O>) & { requiredExternals: string[] };
    result.requiredExternals = [...new Set([...inputJS.requiredExternals, ...outputJS.requiredExternals])];
    return result;
  }

  /**
   * Async counterpart: awaits `fn`'s result (sync or async, per `$MaybeAsync`)
   * and validates both sides via `parseAsync` — required so async refiners/
   * transforms on `.input()`/`.output()` schemas are honored (see `AsyncFunction`
   * guard in `validate`/`safeParse`).
   *
   * Externals: same semantics as `.implement()` — pass captured externals via
   * the second argument; merged with `getRegisteredExternals()` and destructured
   * directly into the closure scope.
   */
  implementAsync(fn: (...args: DnaFunctionArgs<I>) => $MaybeAsync<$Output<O>>, externals?: tsDnaExternals): ((...args: DnaFunctionArgs<I>) => Promise<$Output<O>>) & { requiredExternals: string[] } {
    const inputJS = this.#inputJS ??= toJS(false, true)(this._inputSchema().toDna());
    const outputJS = this.#outputJS ??= toJS(false, true)(this._outputSchema().toDna());
    const inputParam = inputJS.code.length > 1 ? inputJS.code[0] : "";
    const inputBody = inputJS.code.length > 1 ? inputJS.code[1] : inputJS.code[0];
    const outputParam = outputJS.code.length > 1 ? outputJS.code[0] : "";
    const outputBody = outputJS.code.length > 1 ? outputJS.code[1] : outputJS.code[0];
    const body = dnaErrorSource + ";" +
      "const inputParse=(function(" + inputParam + "){" + inputBody + "})(externals);" +
      "const outputParse=(function(" + outputParam + "){" + outputBody + "})(externals);" +
      "return async function(...args){" +
      "const inRes=await inputParse(args);" +
      "if(!inRes.success){throw new DnaError(inRes.errors);}" +
      "const result=await fn.apply(this,inRes.data);" +
      "const outRes=await outputParse(result);" +
      "if(!outRes.success){throw new DnaError(outRes.errors);}" +
      "return outRes.data;" +
      "}";
    const mergedExternals = { ...getRegisteredExternals(), ...externals };
    const result = new Function("fn", "externals", body).call(undefined, fn, mergedExternals) as ((...args: DnaFunctionArgs<I>) => Promise<$Output<O>>) & { requiredExternals: string[] };
    result.requiredExternals = [...new Set([...inputJS.requiredExternals, ...outputJS.requiredExternals])];
    return result;
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const fnDef = new Array(2);
    const storeId = coll.setStore(fnDef);
    this._core.rawDna = ["function", fnDef];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition, storeId);
    this._inputSchema().toDna(coll, storeId, 0);
    this._outputSchema().toDna(coll, storeId, 1);
    return dnaId;
  }
}


/**
 * Custom validation schema: validates values using a user-provided boolean
 * function. Mirrors Zod's `z.custom(fn)`.
 *
 * @typeParam TSType - The TypeScript type of valid values.
 * @typeParam I - The input type.
 */
export class DnaCustom<TSType extends any = any, I = any> extends DnaTypeWithWrappers<TSType, I> {
  override _core = new BaseCore<{ fn: (v?: TSType) => boolean }>("custom", { templateRegex: "" });
}

/**
 * Instance-of schema: validates values using `instanceof` against a
 * constructor. Mirrors Zod's `z.instanceof(Constructor)`.
 *
 * @typeParam T - The constructor type.
 * @typeParam O - The instance type (defaults to `InstanceType<T>`).
 */
export class DnaInstanceOf<T extends abstract new (...args: any[]) => any, O = InstanceType<T>> extends DnaTypeWithWrappers<O, O> {
  override _core = new BaseCore<{ constructor: T }>("instanceOf");

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const constructorName = this._core.seed.constructor.name;
    registerExternal(constructorName, this._core.seed.constructor);
    this._core.rawDna = ["instanceOf", constructorName];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }
}

/**
 * File schema: validates `File` instances with optional min/max size and
 * MIME type constraints. Mirrors Zod's `z.file()`.
 */
export class DnaFile extends DnaTypeWithWrappers<File, File> {
  override _core = new BaseCore<{ constructor: new (...args: any[]) => File, min?: number, max?: number, mime?: string | string[] }>("instanceOf", {
    seed: { constructor: File }
  });

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const constructorName = this._core.seed.constructor.name;
    registerExternal(constructorName, this._core.seed.constructor);
    this._core.rawDna = ["instanceOf", constructorName];
    return coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
  }

  /**
   * Sets the minimum file size in bytes.
   *
   * @param bytes - The minimum size in bytes.
   * @returns A cloned schema with the min size constraint.
   */
  min(bytes: number): this { return cloner(this, cl => { cl._core.seed.min = bytes; cl._core.innerMeta("min", bytes); }); }
  /**
   * Sets the maximum file size in bytes.
   *
   * @param bytes - The maximum size in bytes.
   * @returns A cloned schema with the max size constraint.
   */
  max(bytes: number): this { return cloner(this, cl => { cl._core.seed.max = bytes; cl._core.innerMeta("max", bytes); }); }
  /**
   * Sets the allowed MIME type(s).
   *
   * @param mimeType - A single MIME type string or an array of allowed types.
   * @returns A cloned schema with the MIME type constraint.
   */
  mime(mimeType: string | string[]): this { return cloner(this, cl => { cl._core.seed.mime = mimeType; cl._core.innerMeta("mime", mimeType); }); }
}

// ============================================
// Property Check Schema for type-safe property validation (Zod V4 compatibility)
// ============================================
/**
 * Property check schema for type-safe property validation (Zod V4
 * compatibility). Used in `.check()` to validate a specific property of an
 * object against a sub-schema.
 *
 * @typeParam K - The property key (string or number).
 * @typeParam S - The property's schema type.
 */
// export class DnaProperty<K extends string | number, S extends DnaType<any, any, any>> implements tsDnaPropertyCheck<K, S> {
export class DnaCheckProperty<K extends string | number, S extends DnaType<any, any> = DnaType<any, any>> {
  protected _core = new BaseCore<{ property: K, schema: S }>("property");

  kind: "property" = "property";
  get property(): K { return this._core.seed.property; }
  get schema(): S { return this._core.seed.schema; }

}

export type tsJsonValue = string | number | boolean | null | tsJsonValue[] | { [x: string]: tsJsonValue };

// NEVER EDIT - if  TS triggers an error the cause is elsewhere
export type DnaJsonRaw = DnaUnion<[
  DnaString,
  DnaNumber,
  DnaBoolean,
  DnaNull,
  DnaArray<DnaJson>,
  DnaRecord<DnaString, DnaJson>
]>;
// NEVER EDIT - if  TS triggers an error the cause is elsewhere
export type DnaJson = DnaLazy<tsJsonValue>;