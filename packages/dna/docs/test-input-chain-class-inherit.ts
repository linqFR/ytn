// 1. Les utilitaires d'inférence adaptés à 'unknown'
type inputLocalTest<T> = T extends { _input: infer I } ? I : never;

type inputTest<T> = T extends { _head: infer H }
  ? unknown extends H // Vérifie si _head est resté à sa valeur par défaut 'unknown'
    ? inputLocalTest<T> // Oui : fin de la chaîne
    : inputTest<H>      // Non : on continue la récursivité
  : inputLocalTest<T>;

// 2. La classe parente allégée (plus de générique H global)
class MockDnaType<T = unknown, I = unknown> {
  declare _output: T;
  declare _input: I;
  
  // On utilise unknown au lieu de never
  protected _headValue?: unknown;

  get _head(): unknown {
    return this._headValue;
  }

  // L'intersection 'this & ...' préserve la sous-classe et met à jour uniquement _head
  setHead<HL>(value: HL): this & { readonly _head: HL } {
    this._headValue = value;
    return this as any;
  }
}

// 3. --- TEST AVEC SOUS-CLASSE ---
class CustomDnaType<T, I> extends MockDnaType<T, I> {
  customMethod() {
    return "Je suis bien une sous-classe !";
  }
}

const innerCustom = new CustomDnaType<string, number>(); // Input final attendu : number

const outerCustom = new CustomDnaType<boolean, string>()
  .setHead(innerCustom);

// ✅ Les méthodes de la sous-classe sont préservées après le setHead !
outerCustom.customMethod(); 

// ✅ L'inférence de la chaîne fonctionne parfaitement !
type SubClassInput = inputTest<typeof outerCustom>; // number

type headType = typeof outerCustom._head; // CustomDnaType<string, number>