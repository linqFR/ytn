import type {
	tsSTEP_ASYNC,
	tsSTEP_BODY,
	tsSTEP_CONST,
	tsSTEP_END_REF,
	tsSTEP_LET,
	tsSTEP_OUT_ARG,
	tsSTEP_OUT_CONST,
	tsSTEP_START_REF,
	tsSTEP_STR_REF
} from "../shared/const-steps.js";

/**
 * @type tsJSFuncReturn
 * @description Return type for DNA→JS code generation functions (string-based)
 */
export type tsJSFuncReturn = string;

/**
 * @type tsJSFuncReturnLong
 * @description Return type for DNA→JS code generation functions (tuple-based)
 */
export type tsJSFuncReturnLong = [string, string];

/**
 * @type tsOwnPropertiesMode
 * @description Presence-check strategy for `ownProperties` option of `toJS`.
 *
 * - `"hasown"`: always use `_hop.call(v,key)` (Object.prototype.hasOwnProperty).
 *   Strict own-property semantics. Required for JSON Schema Test Suite
 *   compliance when not using `"in-filtered"`.
 * - `"in-filtered"`: use `_hop.call` for the 12 well-known Object.prototype
 *   member names (`__proto__`, `toString`, `constructor`, `hasOwnProperty`,
 *   `valueOf`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`,
 *   `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`,
 *   `__lookupSetter__`), and `"key" in v` for all other keys. Passes the
 *   JSON Schema Test Suite while gaining `in` performance on the common
 *   case (non-Object.prototype key names).
 * - `"in-object"`: always use `("key" in v)`. Matches Zod v4 fastpath behavior
 *   (see `packages/zod/src/v4/core/schemas.ts` `$ZodObjectJIT` L2088).
 *   `toString`/`constructor`/etc. collisions with Object.prototype are
 *   treated as alignment with Zod, not as bugs.
 *
 * Default: `"in-filtered"` when `enhancedMapper === false` (schvalid),
 * `"in-object"` when `enhancedMapper === true` (builder).
 */
export type tsOwnPropertiesMode = "hasown" | "in-filtered" | "in-object";

/**
 * @type tsPresenceCheckFn
 * @description Compile-time factory that returns the JavaScript expression
 * string used for property-presence checks in generated code. The returned
 * string is inlined at each presence-check site (6 INPUT sites in
 * `dna-js-json.ts`). The keepOnly copy loop (L1143, OUTPUT site) always
 * uses `_hop.call` directly and does NOT call this function — it checks
 * own-property presence on a temp output object, where `in` would
 * incorrectly see inherited Object.prototype members on `{}`.
 */
export type tsPresenceCheckFn = (inVar: string, key: string, steps?: tsStackFrame[]) => string;

/**
 * @type tsJSParentCtx
 * @description Parent context for DNA→JS code generation
 */
export type tsJSParentCtx = {
	/**
	 * Validator mode (`true`, fail-fast boolean) vs parser mode (`false`,
	 * error-collecting with output construction). Threaded unchanged through
	 * almost every handler; drives which of the two code shapes
	 * `simpleNodeToJs` (`utils.ts`) emits for every scalar check — see
	 * `docs/technical.md` §"Validation Modes" and §2 ("Fast-fail primitive").
	 */
	isCond: boolean,

	/**
	 * Name of the closest enclosing labelled block (`oB3`, `discB0`, `anyB2`,
	 * ...) that a bare `break` currently targets. Handlers that don't need a
	 * *fresh* label of their own (their failure path is already correctly
	 * captured by the parent's) reuse it via the `parentCtx.outerblock ||
	 * <newBlock>` pattern instead of introducing a new one — see
	 * `dna-js-json.ts` lines 273, 314, 869, 1020, 1136, 1145 for examples.
	 * Only informational for handlers that always create their own block.
	 */
	outerblock:string

	/**
	 * The exact code snippet to emit on failure at the current point —
	 * `"return false;"` at the top level of a validator, `"break
	 * <block>;"`/`"if(errors.length)break <block>;"` when nested inside a
	 * labelled block that must short-circuit without terminating the whole
	 * function. Every `simpleNodeToJs`-based leaf check (`docs/technical.md`
	 * §2) appends this verbatim on the negative branch of its `if(!(test))`.
	 */
	failCase:string,

	/**
	 * Last `typeof`/type-family already asserted by an ancestor on the SAME
	 * value (`"string"`, `"number"`, `"object"`, `"array"`, ...), so a
	 * descendant scalar check can skip re-testing it. See §5
	 * ("Type-check hoisting") in `docs/technical.md` for the full mechanism
	 * and the `state.kind` vs `.type` caveat.
	 */
	typeChecked?: string,

	/**
	 * Code fragment(s) (e.g. `"++allCnt0"`) that an enclosing combinator
	 * (`anyOf`/`allOf`/`discriminator` prevalidation/...) reads back to tally
	 * how many of its members succeeded. A descendant leaf that succeeds
	 * appends `parentCtx.counter + ";"` to its passing branch instead of (or
	 * in addition to) assigning `outVar=true` — see `dna-js-json.ts` lines
	 * 70, 232, 294, 303, 325, 1415. `string[]` supports nested combinators
	 * that must increment more than one ancestor's counter at once.
	 */
	counter?: string | string[],

	/**
	 * Name of the local `unEvalObj`/`unEvalArr` set object (e.g. `evalPSet2`)
	 * that JSON Schema in-place applicators (`properties`, `additionalProperties`,
	 * `patternProperties`, `items`, `contains`, branches of `discriminator`/
	 * `cli`/`allOf`/`oneOf`/`if-then-else`, ...) write into to mark a
	 * property/item as evaluated. An enclosing `unevaluatedProperties`/
	 * `unevaluatedItems` (`_unEvalEnv`, `dna-js-json.ts` ~line 142) reads the
	 * accumulated set afterwards to reject anything not marked. `undefined`
	 * when no `unevaluatedProperties`/`unevaluatedItems` is active in scope —
	 * downstream handlers must guard on this (`evalParent.length`) rather
	 * than assume the set always exists.
	 */
	unEvalObj?: string,
	/** Array counterpart of {@link unEvalObj}, for `unevaluatedItems`. */
	unEvalArr?: string,

	/**
	 * Routing keys already verified by the enclosing `discriminator`/`cli`
	 * router's `switch`, mapped to the JavaScript variable name that holds the
	 * already-read value (e.g. `{ cmd: "discVal0" }`). Handler `o` skips the
	 * redundant `hasOwn` presence check for these keys AND uses the pre-bound
	 * variable instead of re-reading `v[k]` — eliminating one property access
	 * per routing key per parse. It also shrinks this map to `{ [k]: varName }`
	 * (or `undefined`) per property in the `childrenCtx` it passes to that
	 * property's own sub-schema — so the `literal`/`enumType` handler can skip
	 * its own (also redundant) const check. See `dna-js-json.ts` (`literal`,
	 * `enumType`) for why a single `testedProp && testedProp[...]` check is
	 * sufficient there: the `switch`'s `case` control flow, not the leaf's own
	 * `===` test, is what proves membership.
	 *
	 * Propagation boundary: only meaningful along a **linear** chain from the
	 * object property down to the literal/enum leaf that consumes it — e.g.
	 * `wrp` (optional/nullable/default/prefault) and `pipe` steps, which
	 * always represent the *same* value along one deterministic path, may
	 * forward `parentCtx` (and thus this field) unchanged. It must NOT be
	 * forwarded across a **branching** applicator (`allOf`/`oneOf`, several
	 * simultaneous or alternative sub-schemas that the router's `switch` does
	 * not necessarily validate as a whole) — currently moot because
	 * `finiteValueSet` rejects any `allOf`/`oneOf`-shaped routing key before
	 * construction, but keep this invariant if that restriction is ever
	 * relaxed. `enumTypeDeep` deliberately never reads this field: a
	 * `switch`/`case` compares by `===`, so a deep-equal discriminator value
	 * can never legitimately reach it.
	 */
	testedProp?: Record<string, string>,
};



/**
 * @type tsJSStepString
 * @description String-based step for DNA→JS code generation
 */
export type tsJSStepString = string;

/**
 * @type tsJSStepOp
 * @description Operation step for DNA→JS code generation
 * Format: [dnaId, inVarName, outVarName?, pathVar?, parentCtx?]
 */
export type tsJSStepOp = [number, string, string, string, tsJSParentCtx];
// export type tsJSStepOpRaw = [number, string, string, string];

/**
 * @type tsJSStepAct
 * @description Action step for DNA→JS code generation (BODY, CONST, LET, etc.)
 * Discriminated union based on STEP key
 */
export type tsJSStepAct =
	| [tsSTEP_BODY, string]  // BODY
	| [tsSTEP_CONST, string]  // CONST
	| [tsSTEP_LET, string]  // LET
	| [tsSTEP_START_REF, string]  // START_REF
	| [tsSTEP_END_REF, number | string, string|undefined, string|undefined, tsJSParentCtx]  // END_REF (ref index or function name)
	| [tsSTEP_STR_REF, string, number, string, tsJSParentCtx]  // STR_REF: [code, refIdx, "", parentCtx]
	| [tsSTEP_OUT_ARG, string]  // OUT_CONST: [code, name]
	| [tsSTEP_OUT_CONST, string]  // OUT_CONST: [code, name=value]
	| [tsSTEP_ASYNC];  // ASYNC

/**
 * @type tsStackFrame
 * @description Combined type for stack frames (operations or actions)
 * Properly discriminated union for type-safe access
 */
export type tsStackFrame = tsJSStepAct | tsJSStepOp;
// export type tsStackFrameRaw = tsJSStepOpRaw | tsJSStepAct;

/**
 * @type tsJSFn
 * @description Function type for DNA→JS code generation
 */
export type tsJSFn = tsJSStepString | tsStackFrame[];

/**
 * @type tsLabelId
 * @description Label ID generator for DNA→JS code generation
 */
export type tsLabelId = (_?: 0 | 1) => number;

/**
 * @type tsUtils
 * @description Shared utilities passed to every DNA→JS code generation handler.
 * Replaces the former standalone `labelId` parameter. Grouping `labelId` and
 * `presenceCheck` into a single object avoids growing the positional parameter
 * list of `tsFnDNA` each time a new compile-time utility is added.
 *
 * `hopcall` is the shared `_hop.call` expression generator with lazy hoisting:
 * on first call it pushes `STEP.OUT_CONST` for `_hop=Object.prototype.hasOwnProperty`,
 * then returns the `_hop.call(v,"k")` string. Used by `presenceCheck` in `"partial"`
 * mode (for sensitive keys) and by the keepOnly copy loop in the object handler.
 */
export type tsUtils = {
	labelId: tsLabelId;
	presenceCheck: tsPresenceCheckFn;
	hopcall: tsPresenceCheckFn;
};

/**
 * @type tsFnDNA
 * @description DNA function signature for code generation
 */
export type tsFnDNA = (args: any[], inputVarName: string, outputVarName: string, pathVar: string, utils?: tsUtils, parentCtx?: tsJSParentCtx) => tsJSFn;

/**
 * @type tsMapper
 * @description Mapper for DNA opcodes to code generation functions
 */
export type tsMapper = Record<string, tsFnDNA>;
