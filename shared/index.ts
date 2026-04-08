/**
 * Global YTN Toolbox Barrel File.
 * All utilities are namespaced to avoid global scope pollution.
 */

/* -------------------------------------------------------------------------- */
/*                                LOGIC & ENGINES                             */
/* -------------------------------------------------------------------------- */

export * as safe from "./safe/safemode.js";
export type * as tsSafe from "./safe/safemode.js";

// Advanced object protection
export * as lockobj from "./js/guarded_object.js";
export type * as tsLockobj from "./js/guarded_object.js";

// Zod Specialized Toolbox (reflect, cases, safe, predef)
export * as zod from "./zod/index.js";
export type * as tsZod from "./zod/index.js";

/* -------------------------------------------------------------------------- */
/*                                TOOLS & LIBS                                */
/* -------------------------------------------------------------------------- */

export * as cast from "./js/cast-ops.js";

export * as obj from "./js/object-utils.js";
export type * as tsObj from "./js/object-utils.js";

export * as str from "./js/string-cases.js";
export type * as tsStr from "./js/string-cases.js";

export * as arr from "./js/array-ops.js";
export type * as tsArr from "./js/array-ops.js";

export * as rec from "./js/set-ops.js";
export type * as tsRec from "./js/set-ops.js";

export * as bitops from "./js/bit-ops.js";
export type * as tsBitops from "./js/bit-ops.js";

export * as memo from "./js/mem-ops.js";
export type * as tsMemo from "./js/mem-ops.js";

export * as math from "./js/math-ops.js";
export type * as tsMath from "./js/math-ops.js";

export * as json from "./js/json.js";
export type * as tsJson from "./js/json.js";

export * as pkg from "./js/packages.js";
export type * as tsPkg from "./js/packages.js";

export * as timeout from "./js/timeout.js";
export type * as tsTimeout from "./js/timeout.js";

// Virtual Machine Operations (Execution Sandbox)
export * as vms from "./js/vm-ops.js";
export type * as tsVms from "./js/vm-ops.js";

// Function Reflection & AST Analysis
export * as fn from "./js/fn-reflect.js";
export type * as tsFn from "./js/fn-reflect.js";

/* -------------------------------------------------------------------------- */
/*                                     FS OPS                                 */
/* -------------------------------------------------------------------------- */

export * as fsops from "./dirpath/fs-ops.js";
export type * as tsFsops from "./dirpath/fs-ops.js";

export * as dirops from "./dirpath/dir-ops.js";
export type * as tsDirops from "./dirpath/dir-ops.js";

export * as pathops from "./dirpath/path-ops.js";
export type * as tsPathops from "./dirpath/path-ops.js";

/* -------------------------------------------------------------------------- */
/*                                  TEMPLATES                                 */
/* -------------------------------------------------------------------------- */

export * as tpl from "./template/template-parser.js";
export type * as tsTpl from "./template/template-parser.js";

export * as yaml from "./template/yaml-parser.js";
export type * as tsYaml from "./template/yaml-parser.js";

/* -------------------------------------------------------------------------- */
/*                                GLOBAL TYPES                                */
/* -------------------------------------------------------------------------- */

export type * as ts from "./types/index.js";
