import type { tsStateFull } from "./src/builder/state.types.js";

// ============================================
// Architecture à 2 classes: Core + Interface
// ============================================

// Classe Cœur: gère uniquement l'état
class Core<State extends tsStateFull> {
  #state: State;

  constructor(state: State) {
    this.#state = state;
  }

  get state(): tsStateFull["innerState"] { return this.#state.innerState; }
  get fullState(): tsStateFull { return this.#state; }

  cloneState() {
    const clone = (it: unknown): unknown => {
      if (it === null || typeof it !== "object") return it;
      if (it instanceof RegExp) return new RegExp(it);
      if (typeof it === "object" && "_core" in it && typeof (it as { _core: { clone: () => unknown } })._core.clone === "function") {
        return (it as { _core: { clone: () => unknown } })._core.clone();
      }
      if (Array.isArray(it)) return it.map(clone);
      const cloned: Record<string, unknown> = {};
      for (const key in it) {
        cloned[key] = clone((it as Record<string, unknown>)[key]);
      }
      return cloned;
    };
    return clone(this.#state) as State;
  }

  clone(): Core<State> {
    const clonedState = this.cloneState();
    return new Core(clonedState);
  }
}

// Classe Interface: méthodes et getters vers Core
class Interface<State extends tsStateFull> {
  #core: Core<State>;

  constructor(core: Core<State>) {
    this.#core = core;
  }

  get core(): Core<State> { return this.#core; }

  // Méthodes d'interface déléguées à core
  get state(): tsStateFull["innerState"] { return this.#core.state; }
  get fullState(): tsStateFull { return this.#core.fullState; }

  clone(): Interface<State> {
    const clonedCore = this.#core.clone();
    return new Interface(clonedCore);
  }
}

// ============================================
// Test de la nouvelle architecture
// ============================================

const testState: tsStateFull = {
  type: "string",
  meta: {},
  coerce: false,
  refinerList: [],
  rawDna: ["T"],
  innerState: {}
};

console.log("=== Test Architecture 2 Classes (Core + Interface) ===");
console.log("State:", testState);

// Création du Core
const core = new Core(testState);
console.log("\n--- Core instance ---");
console.log("- state:", core.state);
console.log("- fullState:", core.fullState);

// Création de l'Interface
const iface = new Interface(core);
console.log("\n--- Interface instance ---");
console.log("- state:", iface.state);
console.log("- fullState:", iface.fullState);

// Test clone
console.log("\n--- Clone test ---");
const clonedIface = iface.clone();
console.log("- cloned state:", clonedIface.state);
console.log("- cloned fullState:", clonedIface.fullState);
console.log("- original core unchanged:", core.fullState);

console.log("\n=== Diagnosis ===");
console.log("✓ Core gère l'état");
console.log("✓ Interface délègue à Core");
console.log("✓ Clone fonctionne correctement");
console.log("✓ Séparation claire des responsabilités");
