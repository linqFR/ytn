import { describe, expect, it } from "vitest";
import { jschemaToDna, validator, parser } from "../../src/index.js";
import { toJS } from "@ytrynot/dna/toJs";

/**
 * Regression tests derived from a deep-failure analysis session of @ytrynot/dna and
 * @ytrynot/schvalid. Each test guards a behavior that was flagged as a potential
 * flaw by static analysis but verified to be correct at runtime; keeping them
 * as real Vitest cases prevents future regressions in the toJS codegen and the
 * jschemaToDna converter.
 *
 * Scope:
 *  - regex pattern escaping (forward slashes inside `pattern`)
 *  - Draft 2020-12 `$ref` coexisting with sibling keywords
 *  - `const` / `enum` deep-equality dispatch (cD / eD opcodes)
 *  - deeply recursive `$ref` (memoized `.visit` Map)
 *  - `NaN` / `Infinity` rejection by `type: "integer"`
 *  - `discriminator` switch dispatch (only when all preconditions hold)
 *  - `contains` + `unevaluatedItems` interaction
 *  - JSON pointer escape ordering (`~0` / `~1`) and `%`-encoded keys
 */
describe("Regression — failure-analysis guards", () => {

	describe("regex pattern escaping", () => {
		it("compiles a pattern containing forward slashes without breaking the generated regex literal", () => {
			const schema = { type: "string", pattern: "^/test/" };
			const dna = jschemaToDna(schema, "#");
			const code = (toJS(true, false)(dna) as string[]).join("\n");
			// The generated regex literal must not contain an unescaped `/` that
			// would prematurely close the regex. `new RegExp(...).source` re-escapes
			// forward slashes as `\/`, so the literal should read `/^\/test\//u`.
			expect(code).toContain("/^\\/test\\//u");
			const v = validator(dna);
			expect(v("/test/foo")).toBe(true);
			expect(v("test/foo")).toBe(false);
		});

		it("rejects a non-matching string for a slash-containing pattern", () => {
			const schema = { type: "string", pattern: "a/b" };
			const dna = jschemaToDna(schema, "#");
			const v = validator(dna);
			expect(v("xa/by")).toBe(true);
			expect(v("xab")).toBe(false);
		});
	});

	describe("Draft 2020-12 $ref with sibling keywords", () => {
		it("applies sibling keywords (minLength) alongside a $ref", () => {
			const schema = {
				$defs: { str: { type: "string" } },
				$ref: "#/$defs/str",
				minLength: 5,
			};
			const dna = jschemaToDna(schema, "#");
			const v = validator(dna);
			expect(v("abc")).toBe(false);   // too short
			expect(v("abcdef")).toBe(true); // valid: string + length >= 5
		});

		it("applies sibling keywords (maximum) alongside a $ref to a number", () => {
			const schema = {
				$defs: { num: { type: "number" } },
				$ref: "#/$defs/num",
				maximum: 10,
			};
			const dna = jschemaToDna(schema, "#");
			const v = validator(dna);
			expect(v(5)).toBe(true);
			expect(v(11)).toBe(false);
		});
	});

	describe("const / enum deep-equality dispatch", () => {
		it("uses deep equality for a const object (cD opcode)", () => {
			const schema = { const: { a: 1 } };
			const dna = jschemaToDna(schema, "#");
			const code = (toJS(true, false)(dna) as string[]).join("\n");
			expect(code).toContain("dEq(");
			const v = validator(dna);
			expect(v({ a: 1 })).toBe(true);
			expect(v({ a: 2 })).toBe(false);
			expect(v({ a: 1, b: 2 })).toBe(false);
		});

		it("uses deep equality for a const array (cD opcode)", () => {
			const schema = { const: [1, 2, 3] };
			const dna = jschemaToDna(schema, "#");
			const v = validator(dna);
			expect(v([1, 2, 3])).toBe(true);
			expect(v([1, 2])).toBe(false);
			expect(v([1, 2, 3, 4])).toBe(false);
		});

		it("uses deep equality for an enum containing objects (eD opcode)", () => {
			const schema = { enum: [{ a: 1 }, { b: 2 }] };
			const dna = jschemaToDna(schema, "#");
			const code = (toJS(true, false)(dna) as string[]).join("\n");
			expect(code).toContain("dEq(");
			const v = validator(dna);
			expect(v({ a: 1 })).toBe(true);
			expect(v({ b: 2 })).toBe(true);
			expect(v({ c: 3 })).toBe(false);
		});

		it("uses strict === for a primitive-only enum (e opcode)", () => {
			const schema = { enum: ["a", "b", null] };
			const dna = jschemaToDna(schema, "#");
			const code = (toJS(true, false)(dna) as string[]).join("\n");
			expect(code).not.toContain("dEq(");
			const v = validator(dna);
			expect(v("a")).toBe(true);
			expect(v(null)).toBe(true);
			expect(v("c")).toBe(false);
		});
	});

	describe("recursive $ref with memoized .visit", () => {
		const treeSchema: any = {
			$defs: {
				node: {
					type: "object",
					properties: {
						value: { type: "string" },
						children: { type: "array", items: { $ref: "#/$defs/node" } },
					},
				},
			},
			$ref: "#/$defs/node",
		};

		it("validates a shallow tree", () => {
			const dna = jschemaToDna(treeSchema, "#");
			const v = validator(dna);
			expect(v({ value: "root", children: [{ value: "c1", children: [] }, { value: "c2", children: [] }] })).toBe(true);
			expect(v({ value: 42, children: [] })).toBe(false);
		});

		it("validates a deeply nested tree without stack overflow", () => {
			const dna = jschemaToDna(treeSchema, "#");
			const v = validator(dna);
			const root: any = { value: "a", children: [] };
			let cur = root;
			for (let i = 0; i < 1000; i++) {
				const next: any = { value: "x", children: [] };
				cur.children.push(next);
				cur = next;
			}
			expect(v(root)).toBe(true);
		});

		// Regression: a recursive `$ref` used as the `items` schema of an array
		// previously produced an empty items-loop body (sentinel collision: the
		// `itemsIndex` default `0` was indistinguishable from a valid DNA index
		// `0`). Fixed by switching the sentinel to `-1`. These cases now reject
		// invalid items at any depth.
		it("rejects a deeply nested tree with an invalid leaf", () => {
			const dna = jschemaToDna(treeSchema, "#");
			const v = validator(dna);
			const root: any = { value: "a", children: [] };
			let cur = root;
			for (let i = 0; i < 500; i++) {
				const next: any = { value: "x", children: [] };
				cur.children.push(next);
				cur = next;
			}
			cur.children.push({ value: 123, children: [] }); // invalid leaf
			expect(v(root)).toBe(false);
		});
	});

	describe("recursive $ref as array items — sentinel fix", () => {
		// Sentinel collision regression: `itemsIndex` defaulted to `0` which
		// collided with DNA index `0` (a valid items target, e.g. a recursive
		// `$ref` pointing back to the root node). The fix switches the sentinel
		// to `-1` so the items-loop body is emitted for every valid index.
		const recursiveArraySchema: any = {
			$defs: {
				node: {
					type: "object",
					properties: {
						value: { type: "string" },
						children: { type: "array", items: { $ref: "#/$defs/node" } },
					},
				},
			},
			$ref: "#/$defs/node",
		};

		it("rejects an invalid item one level deep", () => {
			const dna = jschemaToDna(recursiveArraySchema, "#");
			const v = validator(dna);
			expect(v({ value: "a", children: [{ value: 123, children: [] }] })).toBe(false);
		});

		it("rejects an invalid item two levels deep", () => {
			const dna = jschemaToDna(recursiveArraySchema, "#");
			const v = validator(dna);
			expect(v({ value: "a", children: [{ value: "b", children: [{ value: 123, children: [] }] }] })).toBe(false);
		});

		// Sanity: the root-level value IS still validated.
		it("still rejects an invalid root value", () => {
			const dna = jschemaToDna(recursiveArraySchema, "#");
			const v = validator(dna);
			expect(v({ value: 123, children: [] })).toBe(false);
		});

		// Sanity: a non-recursive $ref as array items works correctly.
		it("validates non-recursive $ref array items correctly", () => {
			const schema: any = {
				$defs: { leaf: { type: "object", properties: { value: { type: "string" } } } },
				type: "object",
				properties: {
					value: { type: "string" },
					children: { type: "array", items: { $ref: "#/$defs/leaf" } },
				},
			};
			const dna = jschemaToDna(schema, "#");
			const v = validator(dna);
			expect(v({ value: "a", children: [{ value: "b" }] })).toBe(true);
			expect(v({ value: "a", children: [{ value: 123 }] })).toBe(false);
		});

		// Sanity: the parser mode also reconstructs the recursive tree correctly.
		it("parses a valid recursive tree and rejects an invalid one", () => {
			const dna = jschemaToDna(recursiveArraySchema, "#");
			const p = parser(dna);
			const ok = p({ value: "a", children: [{ value: "b", children: [] }] });
			expect(ok.success).toBe(true);
			if (ok.success) {
				expect(ok.data.value).toBe("a");
				expect(ok.data.children[0].value).toBe("b");
			}
			const bad = p({ value: "a", children: [{ value: 123, children: [] }] });
			expect(bad.success).toBe(false);
		});
	});

	describe("integer type rejects NaN / Infinity", () => {
		it("rejects NaN, Infinity and -Infinity while accepting integers", () => {
			const schema = { type: "integer" };
			const dna = jschemaToDna(schema, "#");
			const v = validator(dna);
			expect(v(5)).toBe(true);
			expect(v(-5)).toBe(true);
			expect(v(0)).toBe(true);
			expect(v(-0)).toBe(true); // -0 is an integer
			expect(v(5.5)).toBe(false);
			expect(v(NaN)).toBe(false);
			expect(v(Infinity)).toBe(false);
			expect(v(-Infinity)).toBe(false);
		});
	});

	describe("discriminator switch dispatch", () => {
		// The fast `switch`-based discriminator opcode is only emitted when all
		// preconditions hold: `type: "object"` + `required` containing the
		// discriminator property at the root, and every branch declares the
		// discriminator property as a primitive `const`/`enum`.
		const discSchema = {
			type: "object",
			required: ["type"],
			discriminator: { propertyName: "type" },
			oneOf: [
				{ type: "object", properties: { type: { const: "cat" }, name: { type: "string" } }, required: ["type", "name"], additionalProperties: false },
				{ type: "object", properties: { type: { const: "dog" }, name: { type: "string" } }, required: ["type", "name"], additionalProperties: false },
			],
		};

		it("emits the switch-based discriminator opcode (discB / switch)", () => {
			const dna = jschemaToDna(discSchema, "#");
			const code = (toJS(true, false)(dna) as string[]).join("\n");
			expect(code).toContain("switch");
			expect(code).toContain("discB");
			expect(code).not.toContain("oneCnt");
		});

		it("routes to the matching branch", () => {
			const dna = jschemaToDna(discSchema, "#");
			const v = validator(dna);
			expect(v({ type: "cat", name: "Tom" })).toBe(true);
			expect(v({ type: "dog", name: "Rex" })).toBe(true);
		});

		it("rejects an unrecognized discriminator value", () => {
			const dna = jschemaToDna(discSchema, "#");
			const v = validator(dna);
			expect(v({ type: "fish", name: "Nemo" })).toBe(false);
		});

		it("rejects a missing discriminator property", () => {
			const dna = jschemaToDna(discSchema, "#");
			const v = validator(dna);
			expect(v({})).toBe(false);
			expect(v({ name: "Tom" })).toBe(false);
		});

		it("falls back to oneOf when preconditions are missing (no type:object at root)", () => {
			const noTypeSchema = {
				discriminator: { propertyName: "type" },
				oneOf: [
					{ type: "object", properties: { type: { const: "cat" } }, required: ["type"], additionalProperties: false },
					{ type: "object", properties: { type: { const: "dog" } }, required: ["type"], additionalProperties: false },
				],
			};
			const dna = jschemaToDna(noTypeSchema, "#");
			const code = (toJS(true, false)(dna) as string[]).join("\n");
			expect(code).toContain("oneCnt");
			expect(code).not.toContain("discB");
		});
	});

	describe("contains + unevaluatedItems interaction", () => {
		it("compiles and validates contains + unevaluatedItems:false without crashing", () => {
			const schema = {
				type: "array",
				contains: { type: "string" },
				unevaluatedItems: false,
			};
			const dna = jschemaToDna(schema, "#");
			const v = validator(dna);
			// At least one string is required by `contains`; `unevaluatedItems:false`
			// forbids items not evaluated by `contains`, so a mixed array fails.
			expect(v(["a"])).toBe(true);
			expect(v(["a", "b"])).toBe(true);
			expect(v(["a", 1])).toBe(false); // 1 is unevaluated
			expect(v([1])).toBe(false);      // no string → contains fails
		});
	});

	describe("JSON pointer escape ordering (~0 / ~1)", () => {
		// RFC 6901: `~1` → `/`, `~0` → `~`. The implementation applies `~1` first
		// then `~0`, which is the correct order (otherwise `~01` would become `//`
		// instead of `~1`).
		it("resolves ~01 to the key '~1' (not '/')", () => {
			const schema: any = {
				$defs: { "~1": { type: "string" }, "/0": { type: "number" } },
				$ref: "#/$defs/~01",
			};
			const dna = jschemaToDna(schema, "#");
			const v = validator(dna);
			expect(v("hello")).toBe(true);  // resolved to ~1 → string
			expect(v(42)).toBe(false);       // not a string
		});

		it("resolves ~10 to the key '/0' (not '~0')", () => {
			const schema: any = {
				$defs: { "/0": { type: "number" }, "~0": { type: "string" } },
				$ref: "#/$defs/~10",
			};
			const dna = jschemaToDna(schema, "#");
			const v = validator(dna);
			expect(v(42)).toBe(true);        // resolved to /0 → number
			expect(v("hello")).toBe(false);  // not a number
		});
	});

	describe("%-encoded $ref keys", () => {
		it("resolves a $ref with a valid percent-encoded key", () => {
			const schema: any = {
				$defs: { "a%20b": { type: "number" } }, // %20 = space
				$ref: "#/$defs/a%20b",
			};
			const dna = jschemaToDna(schema, "#");
			const v = validator(dna);
			expect(v(42)).toBe(true);
			expect(v("hello")).toBe(false);
		});

		it("resolves a $ref whose key contains a literal % (no hex sequence)", () => {
			// The key is stored verbatim in $defs; the pointer fragment is split
			// on `/` before decodeURIComponent runs, so a bare `%` in a def name
			// is matched against the raw (non-decoded) key when the def lookup
			// happens via the uriMap pre-scan.
			const schema: any = {
				$defs: { "a%b": { type: "number" } },
				$ref: "#/$defs/a%b",
			};
			const dna = jschemaToDna(schema, "#");
			const v = validator(dna);
			expect(v(42)).toBe(true);
			expect(v("hello")).toBe(false);
		});
	});

	describe("opcode-injection guard on malformed DNA", () => {
		it("throws a clear error when an unknown opcode is fed to toJS", () => {
			const badDna: any = [["unknownOpcode", {}], []];
			expect(() => toJS(true, false)(badDna)).toThrow();
		});
	});
});
