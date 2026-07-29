import { deepMerge, isPureObject } from "@ytn/shared/js/object-utils.js";
import type { tsDnaInnerMeta, tsDnaMeta } from "../shared/meta-context.type.js";
import type { tsDnaParserFn, tsDnaValidatorFn } from "../shared/runtime.types.js";
import type { tsDna, tsDnaId, tsDnaNoMeta, tsDnaSeq } from "../types/core.types.js";
import type { $Input, $Output } from "../types/helpers.types.js";
import type { IDnaCollector } from "./collector.types.js";
import type { tsStateDef, tsStateFull } from "./state.types.js";
import type { tsCheckOpt } from "../shared/handlers-builder.types.js";



export const DNA_BINDABLE_METHODS = [
  'validate', 'validateAsync',
  'safeParse', 'parse', 'safeParseAsync', 'parseAsync', 'spa',
  'safeDecode', 'decode', 'safeDecodeAsync', 'decodeAsync',
  'safeEncode', 'encode', 'safeEncodeAsync', 'encodeAsync',
] as const;

export const bindMethods = (inst: any, ...methodNames: string[]): any => {
  const names = methodNames.length ? methodNames : DNA_BINDABLE_METHODS;
  for (const methodName of names) {
    const method = inst[methodName];
    if (typeof method !== 'function') continue;
    inst[methodName] = method.bind(inst);
  }
  return inst;
};

export const initDna = <Cls extends new () => any, State extends tsStateDef = tsStateDef>(cls: Cls, state?: State, meta?: string | tsDnaInnerMeta): InstanceType<Cls> => {
  const inst = new cls();
  bindMethods(inst);
  if (state) Object.assign(inst._core.seed, state);
  if (meta) inst._core.rawMeta(meta);
  return inst;
};


export class BaseCore<State extends tsStateDef = tsStateDef> {

  #mapper = new Map<IDnaCollector, tsDnaId>();

  readonly #state: tsStateFull<State>;

  constructor(
    type: string,
    opt?: {
      rawDna?: tsDnaNoMeta,
      coerce?: boolean,
      coerceCode?: string,
      seed?: State,
      templateRegex?: string,
    }) {
    this.#state = {
      type,
      rawDna: opt?.rawDna ?? ["T"],
      meta: {},
      coerce: opt?.coerce ?? false,
      coerceCode: opt?.coerceCode,
      refinerList: [],
      templateRegex: opt?.templateRegex ?? "\x00",
      head:undefined,
      seed: opt?.seed ?? {} as State
    } as tsStateFull<State>;
  }


  // State accessors
  get seed(): State { return this.#state.seed; }
  get state(): tsStateFull<State> { return this.#state; }
  get meta(): tsDnaInnerMeta { return this.#state.meta; }
  get coerce(): boolean { return this.#state.coerce ?? false; }

  set coerce(bool: boolean) { if (this.#state.coerceCode && !this.#state.coerce) this.#state.coerce = bool; }
  get refinerList() { return this.#state.refinerList; }

  // DNA accessors
  get rawDna() { return this.#state.rawDna; }
  set rawDna(dna: tsDnaNoMeta) { this.#state.rawDna = dna; }

  get dnaWithMeta(): tsDna { return [this.#state.rawDna[0], ...this.#state.rawDna.slice(1), this.#state.meta]; }

  // Cached parsers/validators
  get fullDna(): tsDnaSeq | undefined { return this.#state.fullDna; }
  set fullDna(value: tsDnaSeq) { this.#state.fullDna = value; }

  get mapper() { return this.#mapper; }

  get cachedParser(): tsDnaParserFn | undefined { return this.#state.cachedParser; }
  set cachedParser(value: tsDnaParserFn | undefined) { this.#state.cachedParser = value; }

  get cachedValidator(): tsDnaValidatorFn | undefined { return this.#state.cachedValidator; }
  set cachedValidator(value: tsDnaValidatorFn | undefined) { this.#state.cachedValidator = value; }

  // Template regex
  get templateRegex(): string { return this.#state.templateRegex; }
  set templateRegex(value: string) { this.#state.templateRegex = value; }

  // DNA ID mapping
  getDnaId(coll: IDnaCollector): tsDnaId | undefined {
    return this.#mapper.get(coll);
  }

  setDnaId(coll: IDnaCollector, value: tsDnaId): tsDnaId {
    this.#mapper.set(coll, value);
    return value;
  }

  // Head reference
  get head(){return this.#state.head};
  setHead(head: unknown) { this.#state.head = head; }

  // Meta manipulation
  rawMeta(meta?: string | tsDnaInnerMeta): this {
    if (typeof meta === "string") { this.#state.meta.message = meta; }
    if (isPureObject(meta)) deepMerge(this.#state.meta, meta);
    return this;
  }

  innerMeta(target: string | string[], meta?: any | tsDnaMeta): void {
    if (meta) {
      const errorMsg = !isPureObject(meta) ? meta : meta.error;
      const targetObj: Record<string, any> = {};
      if (Array.isArray(target)) for (const t of target) targetObj[t] = { error: errorMsg };
      else targetObj[target] = { error: errorMsg };
      this.#state.meta["~inner"] = targetObj;
    }
  }

  preSeed(partialSeed:Partial<State>){
    this.#state.seed = { ...this.#state.seed, ...partialSeed };
    return this;
  }

  // Cloning
  cloneState() {
    const clone = (it: any): any => {
      if (it === null || typeof it !== "object") return it;
      if (it instanceof RegExp) return new RegExp(it);
      if ("_core" in it && typeof it.clone === "function") return it.clone();
      if (Array.isArray(it)) return it.map(clone);
      const cloned: any = {};
      for (const key of Reflect.ownKeys(it)) {
        const desc = Object.getOwnPropertyDescriptor(it, key)!;
        if (desc.get || desc.set) {
          Object.defineProperty(cloned, key, desc);
        } else {
          Object.defineProperty(cloned, key, { ...desc, value: clone(desc.value) });
        }
      }
      return cloned;
    };
    return clone(this.#state.seed);
  }

  clone(): BaseCore<State> {
    const clonedState = this.cloneState();
    const core = new BaseCore<State>(this.#state.type, { seed: clonedState });
    core.#state.templateRegex = this.#state.templateRegex;
    core.#state.coerce = this.#state.coerce;
    core.#state.coerceCode = this.#state.coerceCode;
    // Shallow-clone each refiner tuple so every `BaseCore` clone owns its own
    // mutable array. Without `.slice()`, later mutations to one clone's
    // refiner metadata would be shared with the original and sibling clones.
    core.#state.refinerList = this.#state.refinerList.map(r => r.slice() as tsCheckOpt);
    const clonedMeta: Record<string, unknown> = {};
    deepMerge(clonedMeta, this.#state.meta);
    core.#state.meta = clonedMeta;

    // do not clone the following, they have to be recomputed
    // core.#state.head = this.#state.head;
    // core.#state.rawDna = this.#state.rawDna;
    // core.#state.fullDna = this.#state.fullDna;
    // core.#state.cachedParser = this.#state.cachedParser;
    // core.#state.cachedValidator = this.#state.cachedValidator;
    return core;
  }
}

export class MapSetCore extends BaseCore {
  constructor(type: "map" | "set", seed: tsStateDef) {
    super(type, { seed });
  }
}