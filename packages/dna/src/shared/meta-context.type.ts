import type { IAddIssue, IIssue } from "./error.types.js";
import type { tsDnaExternals } from "./runtime.types.js";

//============================================
// Refine Context Types
//============================================

// Unified context type for all validation contexts
export interface tsDnaBaseCtx<T> {
  value: T;
  issues: Array<IIssue<T>>;
  error?: {
    issues: Array<IIssue<T>>;
  };
  input?: unknown;
  path?: PropertyKey[];
}

// Context type for refine / superRefine / transform / preprocess
export interface tsDnaRefineCtx<T> extends tsDnaBaseCtx<T> {
  path: PropertyKey[];
  addIssue(arg: string | IAddIssue): void;
}

//============================================
// Meta Types
//============================================

// Metadata type for schema metadata
export interface tsDnaMeta<T = unknown> {
  description?: string;
  error?: string | ((issue: IIssue<T>) => string | undefined);
  message?: string;
  [key: string]: unknown;
}


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
