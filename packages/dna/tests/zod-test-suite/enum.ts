import * as z from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const MyEnumZod = z.enum(["Red", "Green", "Blue"]);
const MyEnumDna = dna.enum(["Red", "Green", "Blue"]);

const Fruits: { Apple: "apple"; Banana: "banana" } = {
  Apple: "apple",
  Banana: "banana",
};
const fruitEnumZod = z.nativeEnum(Fruits);
const fruitEnumDna = dna.enum(["apple", "banana"]);

const FruitValues = {
  Apple: 10,
  Banana: 20,
} as const;
const fruitEnumNumericZod = z.nativeEnum(FruitValues);
const fruitEnumNumericDna = dna.enum([10, 20]);

const issueMetadataZod = z.enum(["Red", "Green", "Blue"]);
const issueMetadataDna = dna.enum(["Red", "Green", "Blue"]);

const foodsZod = z.enum(["Pasta", "Pizza", "Tacos", "Burgers", "Salad"]);
const foodsDna = dna.enum(["Pasta", "Pizza", "Tacos", "Burgers", "Salad"]);

const HTTP_SUCCESS = ["200", "201"] as const;
const argZod = z.enum(HTTP_SUCCESS);
const argDna = dna.enum(["200", "201"]);

const errorMapZod = z.enum(["test"], { error: (iss) => (iss.input === undefined ? "REQUIRED" : undefined) });
const errorMapDna = dna.enum(["test"], { error: (iss) => (iss.input === undefined ? "REQUIRED" : undefined) });

const tunaTroutZod = z.enum(["Tuna", "Trout"]);
const tunaTroutDna = dna.enum(["Tuna", "Trout"]);

const appleBananaZod = z.enum(["apple", "banana"], {
  message: "the value provided is invalid",
});
const appleBananaDna = dna.enum(["apple", "banana"], {
  message: "the value provided is invalid",
});

const diagonalKeysZod = z.enum({
  A: 1,
  B: "A",
});
const diagonalKeysDna = dna.enum([1, "A"]);

export const enumTests = [
  {
    description: "enum from string array",
    zodSchema: MyEnumZod,
    dnaSchema: MyEnumDna,
    tests: [
      { description: "valid Red", data: "Red", valid: true },
      { description: "valid Green", data: "Green", valid: true },
      { description: "valid Blue", data: "Blue", valid: true },
    ],
  },
  {
    description: "enum from const object",
    zodSchema: fruitEnumZod,
    dnaSchema: fruitEnumDna,
    tests: [
      { description: "valid apple", data: "apple", valid: true },
      { description: "valid banana", data: "banana", valid: true },
      { description: "valid from object Apple", data: Fruits.Apple, valid: true },
      { description: "valid from object Banana", data: Fruits.Banana, valid: true },
    ],
  },
  {
    description: "enum from native enum with numeric keys",
    zodSchema: fruitEnumNumericZod,
    dnaSchema: fruitEnumNumericDna,
    tests: [
      { description: "valid 10", data: 10, valid: true },
      { description: "valid 20", data: 20, valid: true },
      { description: "valid from object Apple", data: FruitValues.Apple, valid: true },
      { description: "valid from object Banana", data: FruitValues.Banana, valid: true },
    ],
  },
  {
    description: "issue metadata",
    zodSchema: issueMetadataZod,
    dnaSchema: issueMetadataDna,
    tests: [
      { description: "invalid Yellow", data: "Yellow", valid: false },
    ],
  },
  {
    description: "enum from non-const inputs",
    zodSchema: foodsZod,
    dnaSchema: foodsDna,
    tests: [
      { description: "valid Pasta", data: "Pasta", valid: true },
      { description: "invalid Cucumbers", data: "Cucumbers", valid: false },
    ],
  },
  {
    description: "readonly enum",
    zodSchema: argZod,
    dnaSchema: argDna,
    tests: [
      { description: "valid 201", data: "201", valid: true },
      { description: "invalid 202", data: "202", valid: false },
    ],
  },
  {
    description: "error map",
    zodSchema: errorMapZod,
    dnaSchema: errorMapDna,
    tests: [
      { description: "invalid undefined", data: undefined, valid: false },
    ],
  },
  {
    description: "enum error message, invalid enum element string",
    zodSchema: tunaTroutZod,
    dnaSchema: tunaTroutDna,
    tests: [
      { description: "invalid Salmon", data: "Salmon", valid: false },
    ],
  },
  {
    description: "enum error message, invalid type",
    zodSchema: tunaTroutZod,
    dnaSchema: tunaTroutDna,
    tests: [
      { description: "invalid 12", data: 12, valid: false },
    ],
  },
  {
    description: "enum with message returns the custom error message",
    zodSchema: appleBananaZod,
    dnaSchema: appleBananaDna,
    tests: [
      { description: "invalid berries", data: "berries", valid: false },
      { description: "invalid undefined", data: undefined, valid: false },
      { description: "valid banana", data: "banana", valid: true },
      { description: "invalid null", data: null, valid: false },
    ],
  },
  {
    description: "enum with diagonal keys",
    zodSchema: diagonalKeysZod,
    dnaSchema: diagonalKeysDna,
    tests: [
      { description: "valid A", data: "A", valid: true },
    ],
  },
];
