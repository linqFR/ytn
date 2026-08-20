import { describe, it, expectTypeOf } from "vitest";
import type {
  $Flatten,
  $FlattenCombinative,
  $ToRecord,
  $FlattenDistributive,
  $Xor,
  $Without,
  $Or,
  $DeepReadonly,
  $ReadonlyValue,
  $RemoveUndefined,
} from "../types/structural.type.js";
import type {
  $IsAny,
  $IsDigit,
  $IsLower,
  $IsUpper,
  $HasProperty,
  $PropertyCheck,
} from "../types/predicates.type.js";
import type {
  $EnumKeys,
  $EnumValues,
  $EnumAsObj,
  $EnumObj,
  $ArrayItem,
  $ToEnum,
} from "../types/enum.type.js";
import type {
  $Keys,
  $Entries,
  $RecordSetToArray,
  $UnionToIntersection,
  $RequireAtLeastOne,
  $RequiredNotNull,
} from "../types/record.type.js";
import type {
  $Awaitable,
  $UnwrapPromise,
  $MaybeAsync,
  $InferReturnType,
} from "../types/async.type.js";
import type { $Branded } from "../types/branding.type.js";
import type { tsJSONPrimitive, $isValidJSON } from "../types/json.type.js";

describe("shared/types — structural", () => {
  it("$Flatten resolves Omit to flat object", () => {
    type Source = { a: string; b: number; c: boolean };
    type Result = $Flatten<Omit<Source, "c">>;
    expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: number }>();
  });

  it("$Flatten resolves Pick to flat object", () => {
    type Source = { a: string; b: number; c: boolean };
    type Result = $Flatten<Pick<Source, "a" | "b">>;
    expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: number }>();
  });

  it("$FlattenCombinative is alias of $Flatten", () => {
    type Source = { a: string; b: number };
    expectTypeOf<$FlattenCombinative<Source>>().toEqualTypeOf<$Flatten<Source>>();
  });

  it("$ToRecord is alias of $Flatten", () => {
    type Source = { a: string; b: number };
    expectTypeOf<$ToRecord<Source>>().toEqualTypeOf<$Flatten<Source>>();
  });

  it("$Flatten on union intersects common keys (non-distributive)", () => {
    type A = { cmd: "build"; files: string[] };
    type B = { cmd: "deploy"; target: string };
    type Result = $Flatten<A | B>;
    // Non-distributive: common keys survive with intersected values,
    // non-common keys become never. Result extends the common-keys-only type.
    expectTypeOf<Result>().toExtend<{ cmd: "build" | "deploy" }>();
  });

  it("$FlattenDistributive preserves each union member", () => {
    type A = { cmd: "build"; files: string[] };
    type B = { cmd: "deploy"; target: string };
    type Result = $FlattenDistributive<A | B>;
    expectTypeOf<Result>().toEqualTypeOf<{ cmd: "build"; files: string[] } | { cmd: "deploy"; target: string }>();
  });

  it("$Xor enforces mutual exclusion for objects", () => {
    type Config = $Xor<{ file: string }, { url: string }>;
    const validFile: Config = { file: "config.json" };
    const validUrl: Config = { url: "https://example.com" };
    expectTypeOf<typeof validFile>().toExtend<Config>();
    expectTypeOf<typeof validUrl>().toExtend<Config>();
  });

  it("$Xor falls back to plain union for non-objects", () => {
    type Result = $Xor<string, number>;
    expectTypeOf<Result>().toEqualTypeOf<string | number>();
  });

  it("$Or is trivial union", () => {
    expectTypeOf<$Or<string, number>>().toEqualTypeOf<string | number>();
  });

  it("$DeepReadonly applies readonly recursively", () => {
    type Data = { user: { name: string; roles: string[] } };
    type Result = $DeepReadonly<Data>;
    expectTypeOf<Result>().toEqualTypeOf<{
      readonly user: { readonly name: string; readonly roles: readonly string[] };
    }>();
  });

  it("$DeepReadonly preserves functions", () => {
    type Data = { compute: () => number; value: string };
    type Result = $DeepReadonly<Data>;
    expectTypeOf<Result>().toEqualTypeOf<{ readonly compute: () => number; readonly value: string }>();
  });

  it("$ReadonlyValue is identity for primitives", () => {
    expectTypeOf<$ReadonlyValue<string>>().toEqualTypeOf<string>();
    expectTypeOf<$ReadonlyValue<number>>().toEqualTypeOf<number>();
    expectTypeOf<$ReadonlyValue<null>>().toEqualTypeOf<null>();
    expectTypeOf<$ReadonlyValue<undefined>>().toEqualTypeOf<undefined>();
  });

  it("$ReadonlyValue wraps top-level for objects", () => {
    type Data = { x: number; nested: { y: number } };
    type Result = $ReadonlyValue<Data>;
    expectTypeOf<Result>().toEqualTypeOf<Readonly<{ x: number; nested: { y: number } }>>();
  });

  it("$RemoveUndefined removes undefined from unions", () => {
    expectTypeOf<$RemoveUndefined<string | undefined>>().toEqualTypeOf<string>();
    expectTypeOf<$RemoveUndefined<string | undefined | number | undefined>>().toEqualTypeOf<string | number>();
  });
});

describe("shared/types — predicates", () => {
  it("$IsAny detects exactly any", () => {
    expectTypeOf<$IsAny<any>>().toEqualTypeOf<true>();
    expectTypeOf<$IsAny<unknown>>().toEqualTypeOf<false>();
    expectTypeOf<$IsAny<string>>().toEqualTypeOf<false>();
    expectTypeOf<$IsAny<never>>().toEqualTypeOf<false>();
  });

  it("$IsDigit checks single chars", () => {
    expectTypeOf<$IsDigit<"5">>().toEqualTypeOf<true>();
    expectTypeOf<$IsDigit<"0">>().toEqualTypeOf<true>();
    expectTypeOf<$IsDigit<"9">>().toEqualTypeOf<true>();
    expectTypeOf<$IsDigit<"a">>().toEqualTypeOf<false>();
  });

  it("$IsLower checks single chars", () => {
    expectTypeOf<$IsLower<"a">>().toEqualTypeOf<true>();
    expectTypeOf<$IsLower<"z">>().toEqualTypeOf<true>();
    expectTypeOf<$IsLower<"A">>().toEqualTypeOf<false>();
    expectTypeOf<$IsLower<"1">>().toEqualTypeOf<false>();
  });

  it("$IsUpper checks single chars", () => {
    expectTypeOf<$IsUpper<"A">>().toEqualTypeOf<true>();
    expectTypeOf<$IsUpper<"Z">>().toEqualTypeOf<true>();
    expectTypeOf<$IsUpper<"a">>().toEqualTypeOf<false>();
  });

  it("$HasProperty returns T or never", () => {
    type T = { a: 1; b: 2 };
    expectTypeOf<$HasProperty<T, "a">>().toEqualTypeOf<T>();
    expectTypeOf<$HasProperty<T, "c">>().toEqualTypeOf<never>();
  });

  it("$PropertyCheck returns T or shape with K:S", () => {
    type T = { a: 1; b: 2 };
    expectTypeOf<$PropertyCheck<T, "a", string>>().toEqualTypeOf<T>();
    expectTypeOf<$PropertyCheck<T, "c", string>>().toEqualTypeOf<{ c: string }>();
  });
});

describe("shared/types — enum & array", () => {
  it("$EnumKeys extracts key type", () => {
    type T = { a: 1; b: 2 };
    expectTypeOf<$EnumKeys<T>>().toEqualTypeOf<"a" | "b">();
  });

  it("$EnumValues extracts value type from object", () => {
    type T = { a: 1; b: 2 };
    expectTypeOf<$EnumValues<T>>().toEqualTypeOf<1 | 2>();
  });

  it("$EnumValues extracts value type from array", () => {
    type T = ["a", "b", "c"];
    expectTypeOf<$EnumValues<T>>().toEqualTypeOf<"a" | "b" | "c">();
  });

  it("$EnumAsObj normalizes array to readonly enum object (index signature)", () => {
    type Result = $EnumAsObj<["build", "deploy"]>;
    // `as string` remapping creates an index signature, not named keys
    expectTypeOf<Result>().toEqualTypeOf<{ readonly [x: string]: "build" | "deploy" }>();
  });

  it("$EnumAsObj normalizes object to readonly enum object (values unioned)", () => {
    type Result = $EnumAsObj<{ build: "build"; deploy: "deploy" }>;
    // $EnumAsObj infers V as the union of all values, then maps each key to V
    expectTypeOf<Result>().toEqualTypeOf<{ readonly build: "build" | "deploy"; readonly deploy: "build" | "deploy" }>();
  });

  it("$ArrayItem extracts item type", () => {
    expectTypeOf<$ArrayItem<string[]>>().toEqualTypeOf<string>();
    expectTypeOf<$ArrayItem<[number, string]>>().toEqualTypeOf<number | string>();
  });

  it("$ToEnum converts string union to flattened enum object", () => {
    type Result = $ToEnum<"build" | "deploy">;
    expectTypeOf<Result>().toEqualTypeOf<{ build: "build"; deploy: "deploy" } & {}>();
  });
});

describe("shared/types — record & keys", () => {
  it("$Keys returns array of keys", () => {
    type T = { a: 1; b: 2 };
    expectTypeOf<$Keys<T>>().toEqualTypeOf<("a" | "b")[]>();
  });

  it("$Entries returns array of tuples", () => {
    type T = { a: 1; b: 2 };
    type Result = $Entries<T>;
    // $Entries produces (["a", 1] | ["b", 2])[] — parentheses matter for precedence
    expectTypeOf<Result>().toEqualTypeOf<(["a", 1] | ["b", 2])[]>();
  });

  it("$UnionToIntersection converts union to intersection", () => {
    type Result = $UnionToIntersection<{ a: 1 } | { b: 2 }>;
    expectTypeOf<Result>().toEqualTypeOf<{ a: 1 } & { b: 2 }>();
  });

  it("$RequireAtLeastOne enforces at least one key", () => {
    type Config = $RequireAtLeastOne<
      { host?: string; port?: number; socket?: string },
      "host" | "socket"
    >;
    const validHost: Config = { host: "localhost" };
    const validSocket: Config = { socket: "/tmp/sock" };
    const validBoth: Config = { host: "localhost", port: 3000 };
    expectTypeOf<typeof validHost>().toExtend<Config>();
    expectTypeOf<typeof validSocket>().toExtend<Config>();
    expectTypeOf<typeof validBoth>().toExtend<Config>();
  });

  it("$RequiredNotNull makes property required and non-null", () => {
    type Result = $RequiredNotNull<{ host?: string | null; port: number }, "host">;
    // $RequiredNotNull intersects T with the required non-null property
    expectTypeOf<{ host: string; port: number }>().toExtend<Result>();
  });
});

describe("shared/types — async", () => {
  it("$Awaitable wraps in union with Promise", () => {
    expectTypeOf<$Awaitable<string>>().toEqualTypeOf<string | Promise<string>>();
  });

  it("$MaybeAsync is alias of $Awaitable", () => {
    expectTypeOf<$MaybeAsync<string>>().toEqualTypeOf<$Awaitable<string>>();
  });

  it("$UnwrapPromise extracts inner type", () => {
    expectTypeOf<$UnwrapPromise<Promise<string>>>().toEqualTypeOf<string>();
    expectTypeOf<$UnwrapPromise<number>>().toEqualTypeOf<number>();
  });

  it("$InferReturnType unwraps Promise from async functions", () => {
    async function fetchUser(): Promise<string> { return "Alice"; }
    expectTypeOf<$InferReturnType<typeof fetchUser>>().toEqualTypeOf<string>();
  });

  it("$InferReturnType works for sync functions", () => {
    function syncUser(): { name: string } { return { name: "Bob" }; }
    expectTypeOf<$InferReturnType<typeof syncUser>>().toEqualTypeOf<{ name: string }>();
  });
});

describe("shared/types — branding", () => {
  it("$Branded creates phantom type", () => {
    type RouteId = $Branded<string, "RouteId">;
    // A plain string is NOT assignable to RouteId
    expectTypeOf<string>().not.toExtend<RouteId>();
    // RouteId IS assignable to string
    expectTypeOf<RouteId>().toExtend<string>();
  });
});

describe("shared/types — json", () => {
  it("tsJSONPrimitive is the base set", () => {
    expectTypeOf<tsJSONPrimitive>().toEqualTypeOf<string | number | boolean | null>();
  });

  it("$isValidJSON returns T for serializable types", () => {
    type Good = $isValidJSON<{ name: string; age: number }>;
    expectTypeOf<Good>().toEqualTypeOf<{ name: string; age: number }>();
  });

  it("$isValidJSON returns never for functions at top level", () => {
    type Bad = $isValidJSON<() => void>;
    expectTypeOf<Bad>().toEqualTypeOf<never>();
  });

  it("$isValidJSON returns never for symbols at top level", () => {
    type Bad = $isValidJSON<symbol>;
    expectTypeOf<Bad>().toEqualTypeOf<never>();
  });

  it("$isValidJSON returns never for bigint", () => {
    type Bad = $isValidJSON<bigint>;
    expectTypeOf<Bad>().toEqualTypeOf<never>();
  });

  it("$isValidJSON maps function properties to never", () => {
    type Bad = $isValidJSON<{ fn: () => void }>;
    // Object with function property: the property type becomes never, not the whole object
    expectTypeOf<Bad>().toEqualTypeOf<{ fn: never }>();
  });

  it("$isValidJSON maps symbol properties to never", () => {
    type Bad = $isValidJSON<{ sym: symbol }>;
    expectTypeOf<Bad>().toEqualTypeOf<{ sym: never }>();
  });
});
