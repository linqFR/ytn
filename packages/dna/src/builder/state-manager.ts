import { deepMerge, isPureObject } from "@ytn/shared/js/object-utils.js";
import type { tsDnaType } from "../shared/base.types.js";
import type { tsDnaInnerMeta, tsDnaMeta } from "../shared/meta-context.type.js";
import type * as ts from "../types/api-builder.types.js";
import type { tsStateDef, tsStateFull} from "./state.types.js";
import type { tsDna, tsDnaNoMeta, tsDnaSeq } from "../types/core.types.js";
import { BaseCore } from "./dna-core.js";


// export interface ClassType = tsDnaType<any>;

export function normalizeCoreDefinition(methods: Record<string, any>): PropertyDescriptorMap {
  const nm: PropertyDescriptorMap = {}
  for(const m in Object.getOwnPropertyDescriptors(methods)){
    nm[m] = {
      value: methods[m],
      writable: false,
      enumerable: true,
      configurable: false
    }
  }
  return nm;
}


export class CoreFactory<State extends tsStateFull> {

  declare _state: State;

  #state!: State;


  static create<S extends tsStateFull>(state: S): CoreFactory<S> {
    const manager = new CoreFactory<S>();
    // manager.inst = cls;
    manager.#state = state;
    return manager;
  }

  get state(): tsStateFull["innerState"] { return this.#state.innerState; }
  get fullState(): tsStateFull { return this.#state; }

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

  clone() {
    const clonedState = this.cloneState();
    const manager = new CoreFactory<State>();
    manager.#state = clonedState;
    // Copy dynamic properties (methods/getters) from original to clone
    const descriptors = Object.getOwnPropertyDescriptors(this);
    Object.defineProperties(manager, descriptors);
    return manager;
  }

  // get castAPI(): clsType { return this.inst; }
  // get castCLS(): this["_cls"] { return this.inst as this["_cls"]; }

  // rawMeta(meta?: string | tsDnaInnerMeta) {
  //   if (typeof meta === "string") { this.#state.meta.message = meta; }
  //   if (isPureObject(meta)) deepMerge(this.#state.meta, meta);
  //   return this;
  // }

  // get refinerList() { return this.#state.refinerList; }
  // get meta() { return this.#state.meta; }

  // innerMeta(target: string | string[], meta?: any | tsDnaMeta): void {
  //   if (meta) {
  //     const errorMsg = !isPureObject(meta) ? meta : meta.error;
  //     const targetObj: Record<string, any> = {};
  //     if (Array.isArray(target)) for (const t of target) targetObj[t] = { error: errorMsg };
  //     else targetObj[target] = { error: errorMsg };
  //     this.#state.meta["~inner"] = targetObj;
  //   }
  // }

}

export type tsStateMgrInst<S extends tsStateDef> = BaseCore<tsStateFull<S>>;
