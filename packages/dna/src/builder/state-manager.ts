import { deepMerge, isPureObject } from "@ytn/shared/js/object-utils.js";
import type { tsDnaType } from "../shared/base.types.js";
import type { tsDnaInnerMeta, tsDnaMeta } from "../shared/meta-context.type.js";
import type * as ts from "../types/api-builder.types.js";
import type { tsStateDef, tsStateFull} from "./state.types.js";
import type { tsDna, tsDnaNoMeta, tsDnaSeq } from "../types/core.types.js";


// export interface ClassType = tsDnaType<any>;


export class StateManager<State extends tsStateFull> {

  declare _state: State;

  #state!: State;

  head?: tsDnaType<any>;
  // inst!: clsType;

  static create<S extends tsStateFull>(state: S): StateManager<S> {
    const manager = new StateManager<S>();
    // manager.inst = cls;
    manager.#state = state;
    return manager;
  }


  set dna(value: tsDna | tsDnaNoMeta) {
    const meta: tsDnaMeta = value.slice(-1)[0];
    let rest = value;
    if (isPureObject(meta)) { this.rawMeta(meta); this.#state.dna = value.slice(0, -1) as tsDnaNoMeta; return; };
    if (!Array.isArray(rest)) throw new TypeError("DNA must be an array of format [opCode:string, any[]] or [opCode:string, any[], meta:tsDnaMeta]");
    this.#state.dna = rest as tsDnaNoMeta;
  }
  get dna(): tsDna { return [...this.#state.dna!, this.#state.meta] as tsDna; };

  set fullDna(value: tsDnaSeq) { this.#state.fullDna = value };
  get fullDna(): tsDnaSeq | undefined { return this.#state.fullDna };

  get state(): tsStateFull["innerState"] { return this.#state.innerState; }
  get fullState(): tsStateFull { return this.#state; }

  get coerce() { return this.#state.coerce ?? false; }
  set coerce(bool: boolean) { if (this.#state.coerceCode && !this.#state.coerce) this.#state.coerce = bool; }
  setHead(head: tsDnaType) { this.head = head; }

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

  // clone() {
  //   const clonedState = this.cloneState();
  //   const manager = new StateManager<State>();
  //   manager.#state = clonedState;
  //   return manager;
  // }

  // get castAPI(): clsType { return this.inst; }
  // get castCLS(): this["_cls"] { return this.inst as this["_cls"]; }

  rawMeta(meta?: string | tsDnaInnerMeta) {
    if (typeof meta === "string") { this.#state.meta.message = meta; }
    if (isPureObject(meta)) deepMerge(this.#state.meta, meta);
    return this;
  }

  get refinerList() { return this.#state.refinerList; }
  get meta() { return this.#state.meta; }

  innerMeta(target: string | string[], meta?: any | tsDnaMeta): void {
    if (meta) {
      const errorMsg = !isPureObject(meta) ? meta : meta.error;
      const targetObj: Record<string, any> = {};
      if (Array.isArray(target)) for (const t of target) targetObj[t] = { error: errorMsg };
      else targetObj[target] = { error: errorMsg };
      this.#state.meta["~inner"] = targetObj;
    }
  }

}

export type tsStateMgrInst<S extends tsStateDef> = StateManager<tsStateFull<S>>;
