// 1. Modification du type par défaut de H (utiliser 'never' ou 'undefined' pour éviter l'empoisonnement par 'any')
class MockDnaType<T = unknown, I = unknown, H = never> {
  declare _output: T;
  declare _input: I;
  #head?: H;

  get _head(): H | undefined {
    return this.#head;
  }

  // 2. Builder pattern : on retourne le nouveau type pour que TypeScript suive la mutation statiquement
  setHead<HL>(value: HL): MockDnaType<T, I, HL> {
    this.#head = value as any;
    // On force le type de retour pour informer TypeScript du changement
    return this as unknown as MockDnaType<T, I, HL>;
  }
}

// Récupération de l'input local (simplifiée)
type inputLocalTest<T> = T extends { _input: infer I } ? I : never;

// 3. Récursivité et nettoyage de 'undefined' avec NonNullable
type inputTest<T> = T extends { _head: infer H }
  ? NonNullable<H> extends never // On vérifie si la classe possède un head
    ? inputLocalTest<T>          // Non -> on retourne son propre input
    : inputTest<NonNullable<H>>  // Oui -> on rappelle inputTest (récursivité)
  : inputLocalTest<T>;


// --- TESTS ---

// Test 1: inputLocal sur un schéma simple
const simpleSchemaClass = new MockDnaType<string, unknown>();
type SimpleInputLocalClass = inputLocalTest<typeof simpleSchemaClass>; // unknown

// Test 2: inputLocal sur un schéma avec input explicite
const explicitInputSchemaClass = new MockDnaType<string, number>();
type ExplicitInputLocalClass = inputLocalTest<typeof explicitInputSchemaClass>; // number

// Test 3: input avec _head (la chaîne)
const innerSchemaClass = new MockDnaType<string, string>();

// On utilise le retour du setHead pour typer correctement la variable finale
const wrappedSchemaClass = new MockDnaType<string | undefined, unknown>()
    .setHead(innerSchemaClass);

type WrappedInputClass = inputTest<typeof wrappedSchemaClass>; // string  <== OK
type WrappedInputLocalClass = inputLocalTest<typeof wrappedSchemaClass>; // unknown

// Test 4: Vérification que input utilise _head quand présent
type WithHeadInputClass = inputTest<typeof wrappedSchemaClass>; // string <== OK
type WithoutHeadInputClass = inputTest<typeof simpleSchemaClass>; // unknown (pas de _head)

// Test 5: Chaîne multiple de _head
const deepInnerClass = new MockDnaType<number, number>();

const middleClass = new MockDnaType<string, string>()
    .setHead(deepInnerClass);

const outerClass = new MockDnaType<boolean, unknown>()
    .setHead(middleClass);

type DeepInputClass = inputTest<typeof outerClass>; // number <== OK