import type { tsDnaInnerMeta, tsDnaMeta } from "./meta-context.type.js";

export const WRAPPERS_XFAULT:Record<string, keyof tsDnaInnerMeta> = {
  default:"default" ,
  prefault:"prefault"
} as const;

export const WRAPPERS_OPT:Record<string, keyof tsDnaInnerMeta> = {
  optional:"optional",
  nullish:"nullish",
  nullable:"nullable",
  catch:"catch"
} as const;

// Key-optionality modifiers: they don't add a value wrapper, they only change
// whether an enclosing object treats the key as required.
export const WRAPPERS_KEYOPT:Record<string, keyof tsDnaInnerMeta> = {
  exactOptional:"exactOptional",
  nonoptional:"nonoptional"
} as const;

// `preprocess` is not a value wrapper, but for object-key semantics it behaves like
// `default`/`prefault`: its input is `unknown` (accepts an absent key) and it must run
// even when the key is absent — i.e. always-evaluated and not-required.
export const WRAPPERS_PREPROCESS:Record<string, keyof tsDnaInnerMeta> = {
  preprocess:"preprocess"
} as const;

export const WRAPPERS = {...WRAPPERS_XFAULT, ...WRAPPERS_OPT};

export const WRAPPER_NAMES = Object.values(WRAPPERS);
export const WRAPPER_XFAULT_NAMES = Object.values(WRAPPERS_XFAULT);

// Names that make an object key ALWAYS-evaluated (supply/produce a value even when
// the key is absent): default, prefault, and preprocess.
export const ALWAYS_EVALUATED_NAMES = [...WRAPPER_XFAULT_NAMES, WRAPPERS_PREPROCESS.preprocess];

export const isWrapped=(meta:tsDnaInnerMeta)=>ALWAYS_EVALUATED_NAMES.some(it=>meta[it]) && !meta[WRAPPERS_KEYOPT.nonoptional];

// Object property keys are NON-required when they carry any wrapper that accepts
// an absent key. Per Zod object semantics that is every wrapper EXCEPT `nullable`
// (which only permits an explicit `null`, not `undefined`/absent), plus `exactOptional`.
export const ABSENT_TOLERANT_WRAPPERS = [
  WRAPPERS_OPT.optional,
  WRAPPERS_OPT.nullish,
  WRAPPERS_OPT.catch,
  WRAPPERS_XFAULT.default,
  WRAPPERS_XFAULT.prefault,
  WRAPPERS_KEYOPT.exactOptional,
  WRAPPERS_PREPROCESS.preprocess,
];

