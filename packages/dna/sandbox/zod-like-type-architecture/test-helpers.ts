export type $Expect<T extends true> = T;

export type $IsAny<T> = 0 extends 1 & T ? true : false;

export type $ExpectSame<T, U> =
  $IsAny<T> extends true
    ? false
    : $IsAny<U> extends true
    ? false
    : [T] extends [U]
    ? [U] extends [T]
      ? true
      : false
    : false;

export type $FlattenObject<T> = { [K in keyof T]: T[K] } & {};

export type $ReadOnly<T> = { -readonly [K in keyof T]: T[K] };
