import type { tsDnaId, tsDnaNoMeta, tsDna, tsDnaSeq } from "../types/core.types.js";
import type { IDnaCollector, tsStoreMark, tsStorePosition } from "./collector.types.js";
import type { tsDnaType } from "../shared/base.types.js";
import type { tsStateDef, tsStateFull } from "./state.types.js";
import type { tsDnaInnerMeta, tsDnaMeta } from "../shared/meta-context.type.js";
import type { tsParserFn, tsValidatorFn } from "../shared/runtime.types.js";
import { deepMerge, isPureObject } from "@ytn/shared/js/object-utils.js";


export const initDna = <Cls extends new () => any, State extends tsStateDef = tsStateDef>(cls: Cls, state?: State, meta?: string | tsDnaMeta): InstanceType<Cls> => {
  const inst = new cls();
  if (state) Object.assign(inst._core.seed, state);
  if (meta) inst._core.rawMeta(meta);
  return inst;
};


export class BaseCore<State extends tsStateDef = tsStateDef> {

  #mapper = new Map<IDnaCollector, tsDnaId>();

  #state!: tsStateFull<State>;
  head?: tsDnaType<any>;

  #rawDna: tsDnaNoMeta = ["T"];
  #fullDna?: tsDnaSeq;
  #cachedParser?: tsParserFn;
  #cachedValidator?: tsValidatorFn;
  #templateRegex: string = "\x00";

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
      head: undefined,
      seed: opt?.seed ?? {} as State
    } as tsStateFull<State>;
  }

  // seed<T extends State>(state: Partial<T>) { this.#state.seed = { ...this.#state.seed, ...state } as T; }

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

  get dnaWithMeta(): tsDna { return [this.#rawDna[0], ...this.#rawDna.slice(1), this.#state.meta]; }

  // Cached parsers/validators
  get fullDna(): tsDnaSeq | undefined { return this.#fullDna; }
  set fullDna(value: tsDnaSeq) { this.#fullDna = value; }

  get mapper() { return this.#mapper; }

  get cachedParser(): tsParserFn | undefined { return this.#cachedParser; }
  set cachedParser(value: tsParserFn | undefined) { this.#cachedParser = value; }

  get cachedValidator(): tsValidatorFn | undefined { return this.#cachedValidator; }
  set cachedValidator(value: tsValidatorFn | undefined) { this.#cachedValidator = value; }

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
  setHead(head: tsDnaType) { this.head = head; }

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

  // Cloning
  cloneState() {
    const clone = (it: any): any => {
      if (it === null || typeof it !== "object") return it;
      if (it instanceof RegExp) return new RegExp(it);
      if ("_core" in it && typeof it.clone === "function") return it.clone();
      if (Array.isArray(it)) return it.map(clone);
      const cloned: any = {};
      for (const key in it) {
        cloned[key] = clone(it[key]);
      }
      return cloned;
    };
    return clone(this.#state);
  }

  clone(): BaseCore<State> {
    const clonedState = this.cloneState();
    const core = new BaseCore<State>(clonedState);
    core.#rawDna = this.#rawDna;
    core.#fullDna = this.#fullDna;
    core.#cachedParser = this.#cachedParser;
    core.#cachedValidator = this.#cachedValidator;
    core.#templateRegex = this.#templateRegex;
    core.head = this.head;
    return core;
  }

}

export class MapSetCore extends BaseCore {
  constructor(type: "map" | "set", seed: tsStateDef) {
    super(type, { seed });
  }
}