import type { IIssue } from "./error.types.js";
import type { tsDnaExternals } from "./runtime.types.js";

//============================================
// Refine Context Types
//============================================

// Unified context type for all validation contexts
export interface IContext<T> {
  value: T;
  issues: Array<IIssue<T>>;
  error?: {
    issues: Array<IIssue<T>>;
  };
  input?: unknown;
  path?: PropertyKey[];
}

// Context type for refine (extends unified context)
export interface IRefineContext<T> extends IContext<T> {
  addIssue(issue: { code?: string; message: string; path?: PropertyKey[] }): void;
}

// Context type for superRefine (extends refine context for addIssue support)
export interface ISuperRefineContext<T> extends IRefineContext<T> {
  path: PropertyKey[];
}

// Context type for transform (extends unified context with addIssue support)
export interface ITransformContext<T> extends IContext<T> {
  addIssue(issue: { code?: string; message: string; path?: PropertyKey[] }): void;
}

// Context type for check (extends unified context)
export interface ICheckContext<T> extends IContext<T> { }

// Catch context (extends unified context)
export type ICatchContext<T = unknown> = IContext<T>;



export interface IRefineContext<T> extends IContext<T> {
  addIssue(issue: { code?: string; message: string; path?: PropertyKey[] }): void;
}

export interface ISuperRefineContext<T> extends IRefineContext<T> {
  path: PropertyKey[];
}

//============================================
// Meta Types
//============================================

// Metadata type for schema metadata
export type tsDnaMeta<T = unknown> = {
  description?: string;
  error?: string | ((issue: IIssue<T>) => string | undefined);
  message?: string;
};


// Internal metadata type with additional properties
export type tsDnaInnerMeta<D = unknown, P = unknown, C = unknown, T = unknown> = tsDnaMeta<T> & {
  "~inner"?: Record<string, tsDnaMeta>;
  coerced?: boolean;
  default?: D;
  exactOptional?: boolean;
  externals?: tsDnaExternals;
  nullable?: boolean;
  nullish?: boolean;
  optional?: boolean;
  prefault?: P;
  readonly?: boolean;
  nonoptional?: boolean;
  preprocess?: boolean;
  catch?: C;
  passDefault?: boolean;
};
