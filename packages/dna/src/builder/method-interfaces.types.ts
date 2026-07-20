// import type { tsDnaMeta } from "../shared/meta-context.type.js";

// // ============================================
// // Method Interfaces (Internal)
// // ============================================

// export interface INumberMethods<T = number> {
//   min(value: T, meta?: tsDnaMeta): this;
//   max(value: T, meta?: tsDnaMeta): this;
//   gt(value: T, meta?: tsDnaMeta): this;
//   gte(value: T, meta?: tsDnaMeta): this;
//   lt(value: T, meta?: tsDnaMeta): this;
//   lte(value: T, meta?: tsDnaMeta): this;
//   eq(value: T, meta?: tsDnaMeta): this;
//   multipleOf(value: T, meta?: tsDnaMeta): this;
//   int(): tsDnaType<number, number>;
//   positive(): this;
//   nonnegative(): this;
//   negative(): this;
//   nonpositive(): this;
// }

// export interface IBigIntMethods extends Omit<INumberMethods<bigint>, "int"> { }

// export interface IBooleanMethods { }

// export interface IObjectMethods<T extends Record<string, any>> {
//   catchall(s: tsDnaType<T>): this;
//   catchAll(s: tsDnaType<T>): this;
//   apply<R>(fn: (schema: this) => R): R;
//   omit<K extends keyof T>(keys: Record<K, boolean>): tsDnaType<Omit<T, K>, Omit<T, K>>;
//   pick<K extends keyof T>(keys: Record<K, boolean>): tsDnaType<Pick<T, K>, Pick<T, K>>;
//   strict(): this;
//   loose(): this;
//   partial(keys?: Record<string, boolean>): this;
//   required(keys?: Record<string, boolean>): this;
//   extend<U extends Record<string, any>>(shape: U): tsDnaType<T & U, T & U>;
// }

// export interface IArrayMethods<T> {
//   unwrap(): T;
//   min(n: number, meta?: string | tsDnaMeta): this;
//   max(n: number, meta?: string | tsDnaMeta): this;
//   length(n: number, meta?: string | tsDnaMeta): this;
//   nonempty(): this;
// }

// export interface IMapMethods<K, V, I = Map<K, V>> {
//   min(n: number): this;
//   max(n: number): this;
//   size(n: number): this;
//   nonempty(): this;
// }

// export interface ISetMethods<T, I = Set<T>> {
//   min(n: number): this;
//   max(n: number): this;
//   size(n: number): this;
//   nonempty(): this;
// }

// export interface IUnionMethods<T> { }

// export interface IEnumMethods<T extends any> {
//   enum: Record<string, any>;
//   values: readonly any[];
//   extract(values: any[]): tsDnaType<any, any>;
//   exclude(values: any[]): tsDnaType<any, any>;
// }

// export interface ILiteralMethods<T> { }

// export interface IPseudoTypeMethods<T> { }

// export interface IDateMethods {
//   min(date: Date, meta?: tsDnaMeta): this;
//   max(date: Date, meta?: tsDnaMeta): this;
// }

// export interface IUrlMethods {
//   protocol(protocol: RegExp): this;
//   hostname(hostname: RegExp): this;
// }
