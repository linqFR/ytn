import { describe, it, expect, expectTypeOf } from "vitest";
import { dna } from "../src/index.js";
import { toJS } from "../src/toJs/dna-to-js.js";
import { toParseArgsConfig } from "../src/introspect.js";
import { fromDna } from "../src/fromDna/index.js";
import { DnaCliUnion, DnaMarangetUnion } from "@ytrynot/dna/core";
import { hasKey } from "@ytrynot/shared/js/object-utils.js";

describe("cliUnion — builder", () => {
	it("should detect discriminators automatically", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("prod") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.enum(["dev", "staging"]) }),
		]);
		expect(cli.type).toBe("marangetUnion"); // type renamed from "cliUnion"
		expect(cli.discriminators).toEqual(["cmd", "mode"]);
	});

	it("should detect positionals automatically (both cmd and mode are required with few values)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		]);
		// Both cmd and mode are required, non-boolean, with few distinct values
		// Auto-detection scores them by 1/distinctValues: cmd=1/2=0.5, mode=1/2=0.5
		// Both become positionals (tie broken by declaration order)
		expect(cli.positionals).toEqual(["cmd", "mode"]);
	});

	it("positionals are DERIVED (config override removed — lives in toParseArgsConfig)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		]);
		// Derived from the branch schemas + discriminator order (single source).
		expect(cli.positionals).toEqual(["cmd", "mode"]);
		// CLI-level override changes the parseArgs config only.
		const config = toParseArgsConfig(cli, { positionals: ["mode"] });
		expect(config.options).toHaveProperty("cmd");
		expect(config.options).not.toHaveProperty("mode");
	});

	it("should accept explicit discriminators config", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev"), verbose: dna.literal(true).optional() }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod"), verbose: dna.literal(true) }),
		], { discriminators: ["cmd"] });
		expect(cli.discriminators).toEqual(["cmd"]);
	});

	it("discriminator override — routing uses overridden key only", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("prod") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		], { discriminators: ["cmd"] });
		expect(cli.discriminators).toEqual(["cmd"]);
		// cmd="build" is ambiguous (branches 0 and 1) — first-match-wins → branch 0
		const r1 = cli.safeParse({ cmd: "build", mode: "dev" });
		expect(r1.success).toBe(true);
		if (r1.success) expect(r1.data.mode).toBe("dev");
		// cmd="build" + mode="prod" → still routes to branch 0, which validates mode="dev" → fail
		const r2 = cli.safeParse({ cmd: "build", mode: "prod" });
		expect(r2.success).toBe(false);
		// cmd="deploy" → branch 2
		const r3 = cli.safeParse({ cmd: "deploy", mode: "prod" });
		expect(r3.success).toBe(true);
	});

	it("discriminator override — different key than auto-detected", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("prod") }),
		], { discriminators: ["mode"] });
		expect(cli.discriminators).toEqual(["mode"]);
		// Routing on mode only — cmd is validated in the branch
		const r1 = cli.safeParse({ cmd: "build", mode: "dev" });
		expect(r1.success).toBe(true);
		const r2 = cli.safeParse({ cmd: "build", mode: "prod" });
		expect(r2.success).toBe(true);
		// cmd="deploy" is not a valid literal in any branch → fail (branch validates cmd)
		const r3 = cli.safeParse({ cmd: "deploy", mode: "dev" });
		expect(r3.success).toBe(false);
	});

	it("discriminator override — key not declared in any branch becomes a wildcard column (variable rule)", () => {
		// An absent discriminator key no longer throws — every branch
		// produces a wildcard cell on that column, which the variable rule skips.
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		], { discriminators: ["cmd", "mode", "port"] });
		expect(() => cli.toDna()).not.toThrow();
		// Routing still works on cmd/mode (port column is skipped)
		const r1 = cli.safeParse({ cmd: "build", mode: "dev" });
		expect(r1.success).toBe(true);
		const r2 = cli.safeParse({ cmd: "deploy", mode: "prod" });
		expect(r2.success).toBe(true);
		// port is not declared in any branch → stripped by the branch (keepOnly)
		const r3 = cli.safeParse({ cmd: "build", mode: "dev", port: 8080 });
		expect(r3.success).toBe(true);
		if (r3.success) expect(r3.data).not.toHaveProperty("port");
	});

	it("positionals override — CLI layer (toParseArgsConfig opts) changes options output", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		]);
		// Derived positionals (no override): both cmd+mode are positional → no options.
		expect(cli.positionals).toEqual(["cmd", "mode"]);
		expect(cli.flags).toEqual([]);
		// Override: only cmd positional → mode becomes an option.
		const config = toParseArgsConfig(cli, { positionals: ["cmd"] });
		expect(config.options).toHaveProperty("mode");
		expect(config.options).not.toHaveProperty("cmd");
	});

	it("positionals override — reordering/empty via toParseArgsConfig opts", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		]);
		// Reordering respected (both positional → no options either way).
		expect(toParseArgsConfig(cli, { positionals: ["mode", "cmd"] }).options).toEqual({});
		// Empty array makes all keys flags.
		const config = toParseArgsConfig(cli, { positionals: [] });
		expect(config.options).toHaveProperty("cmd");
		expect(config.options).toHaveProperty("mode");
	});

	it("discriminator override — positionals derived from the overridden order", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		], { discriminators: ["cmd"] });
		expect(cli.discriminators).toEqual(["cmd"]);
		expect(cli.positionals).toEqual(["cmd"]); // derived from the overridden discriminators
		expect(cli.flags).toContain("mode");
		const r1 = cli.safeParse({ cmd: "build", mode: "dev" });
		expect(r1.success).toBe(true);
		const r2 = cli.safeParse({ cmd: "deploy", mode: "prod" });
		expect(r2.success).toBe(true);
	});

	it("explicit discriminators — same behavior as auto-detection when they match", () => {
		const branches = [
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		];
		const auto = dna.cliUnion(branches);
		const explicit = dna.cliUnion(branches, {
			discriminators: ["cmd", "mode"],
		});
		expect(auto.discriminators).toEqual(explicit.discriminators);
		expect(auto.positionals).toEqual(explicit.positionals); // both derived
		const inputs = [
			{ cmd: "build", mode: "dev" },
			{ cmd: "deploy", mode: "prod" },
			{ cmd: "build", mode: "prod" },
			{ cmd: "unknown" },
		];
		for (const input of inputs) {
			expect(auto.safeParse(input)).toEqual(explicit.safeParse(input));
		}
	});

	it("should expose branch schemas via .options", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		expect(cli.options).toHaveLength(2);
	});
});

describe("cliUnion — safeParse (Maranget tree routing)", () => {
	const cli = dna.cliUnion([
		// branch 0: build dev [--verbose] [--output]
		dna.object({
			cmd: dna.literal("build"),
			mode: dna.literal("dev"),
			verbose: dna.literal(true).optional(),
			output: dna.string().optional(),
		}),
		// branch 1: build prod
		dna.object({
			cmd: dna.literal("build"),
			mode: dna.literal("prod"),
		}),
		// branch 2: deploy <dev|staging> --verbose
		dna.object({
			cmd: dna.literal("deploy"),
			mode: dna.enum(["dev", "staging"]),
			verbose: dna.literal(true),
		}),
	]);

	it("should route build/dev (no verbose) → branch 0", () => {
		const r = cli.safeParse({ cmd: "build", mode: "dev" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", mode: "dev" });
	});

	it("should route build/dev/verbose → branch 0 with verbose", () => {
		const r = cli.safeParse({ cmd: "build", mode: "dev", verbose: true });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", mode: "dev", verbose: true });
	});

	it("should route build/dev/verbose/output → branch 0 with all fields", () => {
		const r = cli.safeParse({ cmd: "build", mode: "dev", verbose: true, output: "dist/" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", mode: "dev", verbose: true, output: "dist/" });
	});

	it("should route build/prod → branch 1", () => {
		const r = cli.safeParse({ cmd: "build", mode: "prod" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", mode: "prod" });
	});

	it("should route deploy/dev/verbose → branch 2", () => {
		const r = cli.safeParse({ cmd: "deploy", mode: "dev", verbose: true });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "deploy", mode: "dev", verbose: true });
	});

	it("should route deploy/staging/verbose → branch 2 (multi-value enum)", () => {
		const r = cli.safeParse({ cmd: "deploy", mode: "staging", verbose: true });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "deploy", mode: "staging", verbose: true });
	});

	it("should reject deploy/prod (mode not in enum)", () => {
		const r = cli.safeParse({ cmd: "deploy", mode: "prod", verbose: true });
		expect(r.success).toBe(false);
	});

	it("should reject unknown cmd", () => {
		const r = cli.safeParse({ cmd: "unknown", mode: "dev" });
		expect(r.success).toBe(false);
	});

	it("should reject deploy without verbose (required in branch 2)", () => {
		const r = cli.safeParse({ cmd: "deploy", mode: "dev" });
		expect(r.success).toBe(false);
	});

	it("should reject missing required key (cmd)", () => {
		const r = cli.safeParse({ mode: "dev" });
		expect(r.success).toBe(false);
	});

	it("should reject missing required key (mode)", () => {
		const r = cli.safeParse({ cmd: "build" });
		expect(r.success).toBe(false);
	});

	it("should reject non-object input", () => {
		const r = cli.safeParse("not an object");
		expect(r.success).toBe(false);
	});

	it("should reject null input", () => {
		const r = cli.safeParse(null);
		expect(r.success).toBe(false);
	});
});

describe("cliUnion — validate (boolean mode)", () => {
	const cli = dna.cliUnion([
		dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
		dna.object({ cmd: dna.literal("build"), mode: dna.literal("prod") }),
		dna.object({ cmd: dna.literal("deploy"), mode: dna.enum(["dev", "staging"]) }),
	]);

	it("should return true for valid input", () => {
		expect(cli.validate({ cmd: "build", mode: "dev" })).toBe(true);
		expect(cli.validate({ cmd: "build", mode: "prod" })).toBe(true);
		expect(cli.validate({ cmd: "deploy", mode: "dev" })).toBe(true);
		expect(cli.validate({ cmd: "deploy", mode: "staging" })).toBe(true);
	});

	it("should return false for invalid input", () => {
		expect(cli.validate({ cmd: "unknown", mode: "dev" })).toBe(false);
		expect(cli.validate({ cmd: "deploy", mode: "prod" })).toBe(false);
		expect(cli.validate({ mode: "dev" })).toBe(false);
		expect(cli.validate(null)).toBe(false);
		expect(cli.validate("string")).toBe(false);
	});
});

describe("cliUnion — optional discriminator key", () => {
	const cli = dna.cliUnion([
		dna.object({ cmd: dna.literal("build"), verbose: dna.literal(true).optional() }),
		dna.object({ cmd: dna.literal("deploy"), verbose: dna.literal(true) }),
	]);

	it("should route build without verbose (optional undefined)", () => {
		const r = cli.safeParse({ cmd: "build" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build" });
	});

	it("should route build with verbose=true", () => {
		const r = cli.safeParse({ cmd: "build", verbose: true });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", verbose: true });
	});

	it("should route deploy with verbose=true", () => {
		const r = cli.safeParse({ cmd: "deploy", verbose: true });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "deploy", verbose: true });
	});

	it("should reject deploy without verbose (required)", () => {
		const r = cli.safeParse({ cmd: "deploy" });
		expect(r.success).toBe(false);
	});

	it("should reject build with verbose=false (literal true only)", () => {
		const r = cli.safeParse({ cmd: "build", verbose: false });
		expect(r.success).toBe(false);
	});
});

describe("cliUnion — optional discriminator with multi-value (bug regression)", () => {
	// This test covers the case where an optional key has ≥2 non-undefined values.
	// The codegen emits a switch inside a sub-block; each case must break the
	// sub-block (not just the switch) to skip the fall-through fail.
	const cli = dna.cliUnion([
		// branch 0: build, level=info|warn (optional: can be undefined)
		dna.object({
			cmd: dna.literal("build"),
			level: dna.enum(["info", "warn"]).optional(),
		}),
		// branch 1: deploy, level=error (required)
		dna.object({
			cmd: dna.literal("deploy"),
			level: dna.literal("error"),
		}),
	]);

	it("should route build with level=info (optional multi-value case 1)", () => {
		const r = cli.safeParse({ cmd: "build", level: "info" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", level: "info" });
	});

	it("should route build with level=warn (optional multi-value case 2)", () => {
		const r = cli.safeParse({ cmd: "build", level: "warn" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", level: "warn" });
	});

	it("should route build without level (optional undefined)", () => {
		const r = cli.safeParse({ cmd: "build" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build" });
	});

	it("should route deploy with level=error (required)", () => {
		const r = cli.safeParse({ cmd: "deploy", level: "error" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "deploy", level: "error" });
	});

	it("should reject build with level=error (not in build's enum)", () => {
		const r = cli.safeParse({ cmd: "build", level: "error" });
		expect(r.success).toBe(false);
	});

	it("should reject deploy without level (required in deploy)", () => {
		const r = cli.safeParse({ cmd: "deploy" });
		expect(r.success).toBe(false);
	});

	it("should reject deploy with level=info (not deploy's literal)", () => {
		const r = cli.safeParse({ cmd: "deploy", level: "info" });
		expect(r.success).toBe(false);
	});
});

describe("cliUnion — non-discriminator properties (brandId)", () => {
	// Each branch has a brandId literal that is NOT a discriminator key.
	// The branch validator should include it in the output.
	const cli = dna.cliUnion([
		dna.object({
			cmd: dna.literal("build"),
			mode: dna.literal("dev"),
			brandId: dna.literal("brand-build-dev"),
		}),
		dna.object({
			cmd: dna.literal("build"),
			mode: dna.literal("prod"),
			brandId: dna.literal("brand-build-prod"),
		}),
		dna.object({
			cmd: dna.literal("deploy"),
			mode: dna.enum(["dev", "staging"]),
			brandId: dna.literal("brand-deploy"),
		}),
	]);

	it("should include brandId in output for build/dev", () => {
		const r = cli.safeParse({ cmd: "build", mode: "dev", brandId: "brand-build-dev" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", mode: "dev", brandId: "brand-build-dev" });
	});

	it("should include brandId in output for build/prod", () => {
		const r = cli.safeParse({ cmd: "build", mode: "prod", brandId: "brand-build-prod" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", mode: "prod", brandId: "brand-build-prod" });
	});

	it("should include brandId in output for deploy/dev", () => {
		const r = cli.safeParse({ cmd: "deploy", mode: "dev", brandId: "brand-deploy" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "deploy", mode: "dev", brandId: "brand-deploy" });
	});

	it("should include brandId in output for deploy/staging", () => {
		const r = cli.safeParse({ cmd: "deploy", mode: "staging", brandId: "brand-deploy" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "deploy", mode: "staging", brandId: "brand-deploy" });
	});

	it("should reject wrong brandId for build/dev", () => {
		const r = cli.safeParse({ cmd: "build", mode: "dev", brandId: "wrong" });
		expect(r.success).toBe(false);
	});

	it("should reject missing brandId for build/dev", () => {
		const r = cli.safeParse({ cmd: "build", mode: "dev" });
		expect(r.success).toBe(false);
	});
});

describe("cliUnion — single branch (edge case)", () => {
	it("should route to the only branch", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
		]);
		const r = cli.safeParse({ cmd: "build", mode: "dev" });
		expect(r.success).toBe(true);
	});

	it("should reject non-matching input", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
		]);
		expect(cli.safeParse({ cmd: "build", mode: "prod" }).success).toBe(false);
	});
});

describe("cliUnion — toDna / fromDna roundtrip", () => {
	it("should produce maranget opcode in DNA", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		]);
		const seq = cli.toDna();
		const firstNode = seq[0];
		expect(firstNode[0]).toBe("maranget"); // opcode renamed from "cli"
	});

	it("should preserve discriminators in DNA", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		]);
		const seq = cli.toDna();
		const firstNode = seq[0];
		expect(firstNode[1]).toEqual(["cmd", "mode"]);
	});
});

// ============================================================
// marangetUnion (canonical factory) — routing, modes, ADN, roundtrip
// ============================================================

describe("marangetUnion — canonical factory", () => {
	it("routes like cliUnion and is the canonical type", () => {
		const m = dna.marangetUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		]);
		expect(m.type).toBe("marangetUnion");
		expect(m.discriminators).toEqual(["cmd", "mode"]);
		const r1 = m.safeParse({ cmd: "build", mode: "dev" });
		expect(r1.success).toBe(true);
		const r2 = m.safeParse({ cmd: "deploy", mode: "prod" });
		expect(r2.success).toBe(true);
		const r3 = m.safeParse({ cmd: "build", mode: "prod" });
		expect(r3.success).toBe(false);
	});

	it("serializes the clause matrix + optionality marker + wildcard cells in the ADN", () => {
		const m = dna.marangetUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.enum(["dev", "prod"]), verbose: dna.literal(true).optional() }),
			dna.object({ cmd: dna.literal("deploy") }),
			dna.looseObject({}),
		]);
		const node = m.toDna()[0];
		expect(node[0]).toBe("maranget");
		// discAdn: required columns as strings, optional columns in the final sub-array
		expect(node[1]).toEqual(["cmd", "mode", ["verbose"]]);
		// clause matrix: per branch array, COMPACT — trailing absences stay
		// sparse ("beyond the array length" = wildcard); only NON-TRAILING
		// absences carry the explicit WILDCARD_CELL marker ("\x00") to keep the
		// matrix aligned (F1 fix). Here all absences are trailing → no marker.
		expect(node[2]).toEqual([
			["build", ["dev", "prod"], [true, undefined]],
			["deploy"],
			[],
		]);
		expect(node[4]).toBe("constructor-priority");
	});

	it("F1 fixed: a branch routing on a different key (Test 14) is aligned and reachable (marangetUnion)", () => {
		const m = dna.marangetUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
			dna.object({ help: dna.literal("help") }),
		]);
		// The matrix is ALIGNED where needed: branches 0/1 keep trailing-sparse
		// cells (["build"], ["deploy"]); branch 2 pushes the WILDCARD_CELL marker
		// on cmd (position 0) BEFORE its value "help" (position 1) — the only
		// non-trailing absence (a wildcard before a constructor value).
		const node = m.toDna()[0] as unknown[];
		expect(node[2]).toEqual([["build"], ["deploy"], ["\x00", "help"]]);
		// The intended input reaches the help branch; the invalid one is rejected.
		expect(m.safeParse({ help: "help" }).success).toBe(true);
		expect(m.safeParse({ cmd: "help" }).success).toBe(false);
		expect(m.safeParse({ cmd: "build" }).success).toBe(true);
		expect(m.safeParse({ cmd: "deploy" }).success).toBe(true);
	});

	it("non-trailing wildcard: 3-column matrix with wildcard in middle position", () => {
		// 3 discriminators: cmd, sub, extra. Branch 2 has wildcard on sub
		// (non-trailing: wildcard BEFORE extra). The WILDCARD_CELL marker
		// must be pushed for the non-trailing absence on branch 2.
		const m = dna.marangetUnion([
			dna.object({ cmd: dna.literal("build"), sub: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("build"), sub: dna.literal("prod") }),
			dna.object({ cmd: dna.literal("deploy"), extra: dna.literal("force") }),
		]);
		// Exact matches
		expect(m.safeParse({ cmd: "build", sub: "dev" }).success).toBe(true);
		expect(m.safeParse({ cmd: "build", sub: "prod" }).success).toBe(true);
		expect(m.safeParse({ cmd: "deploy", extra: "force" }).success).toBe(true);
		// branch 2 has no sub → sub is a discriminator for branches 0/1,
		// so {cmd:"deploy", sub:"dev"} routes on sub="dev" → branch 0,
		// but cmd="deploy" ≠ "build" → fail (no catch-all on cmd in this subtree)
		expect(m.safeParse({ cmd: "deploy", sub: "dev" }).success).toBe(false);
		// branches 0/1 have no extra → extra is a discriminator for branch 2,
		// so {cmd:"build", extra:"force"} routes on cmd="build" → branches 0/1,
		// then sub=undefined → no match → fail
		expect(m.safeParse({ cmd: "build", extra: "force" }).success).toBe(false);
		// unknown cmd → fail
		expect(m.safeParse({ cmd: "unknown" }).success).toBe(false);
	});

	it("non-trailing wildcard: branch with only a trailing key (wildcard on all leading columns)", () => {
		// 2 discriminators: cmd, help. Branch 2 declares only help (wildcard on cmd).
		// This is the F1 case: wildcard BEFORE a value → WILDCARD_CELL marker.
		const m = dna.marangetUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
			dna.object({ help: dna.literal("help") }),
		]);
		const node = m.toDna()[0] as unknown[];
		// The matrix must have the WILDCARD_CELL marker on branch 2 position 0
		expect(node[2]).toEqual([["build"], ["deploy"], ["\x00", "help"]]);
		// Routing: help branch reachable, no misrouting
		expect(m.safeParse({ help: "help" }).success).toBe(true);
		expect(m.safeParse({ cmd: "help" }).success).toBe(false);
		expect(m.safeParse({ cmd: "build" }).success).toBe(true);
		expect(m.safeParse({ cmd: "deploy" }).success).toBe(true);
		// Both keys → help wins (constructor-priority: help is a constructor on its column)
		expect(m.safeParse({ cmd: "build", help: "help" }).success).toBe(true);
	});

	it("non-trailing wildcard: source-order mode preserves first-match for catch-all", () => {
		// In source-order mode, a catch-all (wildcard on all columns) that
		// appears FIRST should win over later constructor branches.
		const so = dna.marangetUnion([
			dna.looseObject({}).transform((d: Record<string, unknown>) => ({ ...d, w: "catch" })),
			dna.object({ cmd: dna.literal("build") }),
		], { mode: "source-order" });
		// catch-all is first → wins for any input
		const r1 = so.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		if (r1.success) expect((r1.data as Record<string, unknown>).w).toBe("catch");
		const r2 = so.safeParse({ cmd: "unknown" });
		expect(r2.success).toBe(true);
		if (r2.success) expect((r2.data as Record<string, unknown>).w).toBe("catch");
	});

	it("D2: cli mode with non-trailing wildcards — column sort + WILDCARD_CELL", () => {
		// Mode "cli" sorts requireds by positional priority, optionals last.
		// With a non-trailing wildcard (branch 2 has help but not cmd), the
		// WILDCARD_CELL marker must be pushed AND the column order must be
		// cli-sorted (cmd before help, both required here).
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
			dna.object({ help: dna.literal("help") }),
		]);
		expect(cli.type).toBe("marangetUnion");
		// cmd is positional (required, non-boolean, fewest values) → first
		// help is required too but more values → second
		expect(cli.discriminators).toEqual(["cmd", "help"]);
		// Routing: same as constructor-priority (cli routes like CP)
		expect(cli.safeParse({ cmd: "build" }).success).toBe(true);
		expect(cli.safeParse({ cmd: "deploy" }).success).toBe(true);
		expect(cli.safeParse({ help: "help" }).success).toBe(true);
		expect(cli.safeParse({ cmd: "help" }).success).toBe(false);
		// Both keys → help wins (constructor on its column)
		expect(cli.safeParse({ cmd: "build", help: "help" }).success).toBe(true);
	});

	it("D3: optional discriminator column routes on value AND undefined", () => {
		// verbose is optional in branch 0 (dna.literal(true).optional()),
		// absent in branch 1. detectDiscriminators includes verbose because
		// at least one branch has a finite value set (some, not required).
		// The column is optional → routes on true/false/undefined.
		const m = dna.marangetUnion([
			dna.object({ cmd: dna.literal("build"), verbose: dna.literal(true).optional() }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		// verbose is an optional discriminator (after cmd)
		expect(m.discriminators).toEqual(["cmd", "verbose"]);
		// verbose=true → branch 0
		expect(m.safeParse({ cmd: "build", verbose: true }).success).toBe(true);
		// verbose absent → branch 0 (verbose is optional, absent matches)
		expect(m.safeParse({ cmd: "build" }).success).toBe(true);
		// cmd=deploy → branch 1 (regardless of verbose)
		expect(m.safeParse({ cmd: "deploy", verbose: true }).success).toBe(true);
		expect(m.safeParse({ cmd: "deploy" }).success).toBe(true);
		// unknown cmd → fail
		expect(m.safeParse({ cmd: "unknown" }).success).toBe(false);
	});

	it("D5: detectDiscriminators uses some (not required) — optional key with finite values is discriminator", () => {
		// detectDiscriminators uses schemas.some(...)
		// not schemas.every(...). A key that is optional in one branch but
		// has a finite value set is still a discriminator.
		const m = dna.marangetUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.enum(["dev", "prod"]).optional() }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		// mode is optional in branch 0, absent in branch 1 → still a discriminator
		// because branch 0 has a finite value set for it (some, not every).
		expect(m.discriminators).toContain("mode");
		// mode=dev → branch 0
		expect(m.safeParse({ cmd: "build", mode: "dev" }).success).toBe(true);
		expect(m.safeParse({ cmd: "build", mode: "prod" }).success).toBe(true);
		// mode absent → branch 0 (optional, absent matches)
		expect(m.safeParse({ cmd: "build" }).success).toBe(true);
		// cmd=deploy → branch 1 (mode is wildcard for branch 1)
		expect(m.safeParse({ cmd: "deploy", mode: "dev" }).success).toBe(true);
		// unknown mode → fail (no catch-all on mode column for branch 0)
		expect(m.safeParse({ cmd: "build", mode: "unknown" }).success).toBe(false);
	});

	it("roundtrips through fromDna with optionality marker", () => {
		const m = dna.marangetUnion([
			dna.object({ cmd: dna.literal("build"), verbose: dna.literal(true).optional() }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		const rebuilt = fromDna<DnaMarangetUnion>(m.toDna());
		expect(rebuilt.discriminators).toEqual(["cmd", "verbose"]);
		const r1 = rebuilt.safeParse({ cmd: "build", verbose: true });
		expect(r1.success).toBe(true);
		if (r1.success) expect(r1.data).toEqual({ cmd: "build", verbose: true });
		const r2 = rebuilt.safeParse({ cmd: "deploy" });
		expect(r2.success).toBe(true);
	});
});

describe("marangetUnion — routing modes", () => {
	// constructor-priority (default): constructors win over earlier wildcards
	it("constructor-priority: specific branch wins over an earlier catch-all", () => {
		const cp = dna.marangetUnion([
			dna.looseObject({}).transform((d: Record<string, unknown>) => ({ ...d, w: "catch" })),
			dna.object({ cmd: dna.literal("build") }),
		]);
		const r1 = cp.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		if (hasKey(r1, "w")) expect(r1.data.w).toBeUndefined(); // build branch, not catch-all
		const r2 = cp.safeParse({ cmd: "zzz" });
		expect(r2.success).toBe(true);
		if (hasKey(r2, "w")) expect(r2.data.w).toBe("catch");
	});

	// source-order (Maranget strict): the first matching branch in source order wins
	it("source-order: catch-all first catches everything", () => {
		const so = dna.marangetUnion(
			[
				dna.looseObject({}).transform((d: Record<string, unknown>) => ({ ...d, w: "catch" })),
				dna.object({ cmd: dna.literal("build") }),
			],
			{ mode: "source-order" }
		);
		const r1 = so.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		if (hasKey(r1, "w")) expect(r1.data.w).toBe("catch");
		const r2 = so.safeParse({ cmd: "zzz" });
		expect(r2.success).toBe(true);
		if (hasKey(r2, "w")) expect(r2.data.w).toBe("catch");
	});

	it("serializes the mode into the ADN", () => {
		const so = dna.marangetUnion(
			[dna.object({ cmd: dna.literal("build") }), dna.looseObject({})],
			{ mode: "source-order" }
		);
		const node = so.toDna()[0];
		expect(node[4]).toBe("source-order");
	});
});

// ============================================================
// cliUnion — CLI mode ("cli"): sorted required columns, derived
// positionals (never stored / serialized), roundtrip fidelity
// ============================================================

describe("cliUnion — CLI mode (mode 'cli')", () => {
	it("cliUnion emits mode 'cli' in the ADN (marangetUnion default stays 'constructor-priority')", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		]);
		expect((cli.toDna()[0] as unknown[])[4]).toBe("cli");

		const m = dna.marangetUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		expect((m.toDna()[0] as unknown[])[4]).toBe("constructor-priority");
	});

	it("cliUnion constructs a real DnaCliUnion (CLI views); generic marangetUnion has none; fromDna preserves the class", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("git"), sub: dna.literal("commit") }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		expect(cli instanceof DnaCliUnion).toBe(true);
		expect(cli instanceof DnaMarangetUnion).toBe(true);
		expect(cli.positionals).toEqual(["cmd"]);
		expect(cli.flags).toEqual(["sub"]);

		// Generic marangetUnion carries NO CLI views (SoC: CLI views live on DnaCliUnion).
		const m = dna.marangetUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		expect(m instanceof DnaCliUnion).toBe(false);
		expect((m as { positionals?: unknown }).positionals).toBeUndefined();

		// Roundtrip preserves the CLI class for mode "cli".
		const rebuilt = fromDna(cli.toDna()) as DnaCliUnion<typeof cli.options>;
		expect(rebuilt instanceof DnaCliUnion).toBe(true);
		expect(rebuilt.positionals).toEqual(cli.positionals);
		expect(rebuilt.flags).toEqual(cli.flags);
	});

	it("cli mode sorts REQUIRED columns by positional priority; optionals stay last (no order)", () => {
		// Declaration order: mode first, cmd second, verbose optional third.
		// Positional scores: cmd=1 value → 1.0, mode=2 values → 0.5 → sorted: [cmd, mode].
		const cli = dna.cliUnion([
			dna.object({ mode: dna.literal("dev"), cmd: dna.literal("git"), verbose: dna.literal(true).optional() }),
			dna.object({ mode: dna.literal("prod"), cmd: dna.literal("git") }),
		]);
		expect(cli.positionals).toEqual(["cmd", "mode"]); // derived, score-ordered
		// discAdn: sorted requireds [cmd, mode] + optional sub-array [verbose] last
		const node = cli.toDna()[0] as unknown[];
		expect(node[1]).toEqual(["cmd", "mode", ["verbose"]]);
		// auto (non-cli) keeps declaration order — the sort is cli-only
		const m = dna.marangetUnion([
			dna.object({ mode: dna.literal("dev"), cmd: dna.literal("git"), verbose: dna.literal(true).optional() }),
			dna.object({ mode: dna.literal("prod"), cmd: dna.literal("git") }),
		]);
		expect((m.toDna()[0] as unknown[])[1]).toEqual(["mode", "cmd", ["verbose"]]);
	});

	it("roundtrip: fromDna re-derives identical positionals and toParseArgsConfig", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("git"), sub: dna.literal("commit") }),
			dna.object({ cmd: dna.literal("git"), sub: dna.literal("push") }),
			dna.object({ cmd: dna.literal("deploy"), env: dna.literal("prod").optional() }),
		]);
		const rebuilt = fromDna(cli.toDna()) as typeof cli;
		expect(rebuilt.positionals).toEqual(cli.positionals); // derived, not stored
		expect(toParseArgsConfig(rebuilt)).toEqual(toParseArgsConfig(cli));
		// CLI-level override still works after the roundtrip
		expect(toParseArgsConfig(rebuilt, { positionals: ["cmd"] })).toEqual(toParseArgsConfig(cli, { positionals: ["cmd"] }));
		// routing identical
		for (const input of [
			{ cmd: "git", sub: "commit" },
			{ cmd: "git", sub: "unknown" },
			{ cmd: "deploy", env: "prod" },
			{ cmd: "zzz" },
		]) {
			expect(rebuilt.safeParse(input).success).toBe(cli.safeParse(input).success);
		}
	});

	it("cli mode routing is identical to constructor-priority (sort + mode are routing-invariant)", () => {
		const branches = [
			dna.object({ mode: dna.literal("dev"), cmd: dna.literal("git"), verbose: dna.literal(true).optional() }),
			dna.object({ mode: dna.literal("prod"), cmd: dna.literal("git") }),
			dna.object({ cmd: dna.literal("deploy") }),
			dna.object({}).loose(),
		];
		const cli = dna.cliUnion(branches);
		const cp = dna.marangetUnion(branches); // constructor-priority, declaration order
		const inputs = [
			{ cmd: "git", mode: "dev" },
			{ cmd: "git", mode: "prod", verbose: true },
			{ cmd: "deploy" },
			{ cmd: "git", mode: "unknown" },
			{ cmd: "zzz", mode: "dev" },
			{ mode: "dev" },
			{},
		];
		for (const input of inputs) {
			const a = cli.safeParse(input);
			const b = cp.safeParse(input);
			expect(a.success).toBe(b.success);
			if (a.success && b.success) expect(a.data).toEqual(b.data);
		}
	});
});

// ============================================================
// Branch mutation: .extend() + .default()
// ============================================================

describe("cliUnion — .extend() + .default() branch mutation", () => {
	const cli = dna.cliUnion([
		dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") })
			.extend({ branchId: dna.string().optional().default("brand-build-dev") }),
		dna.object({ cmd: dna.literal("build"), mode: dna.literal("prod") })
			.extend({ branchId: dna.string().optional().default("brand-build-prod") }),
		dna.object({ cmd: dna.literal("deploy"), mode: dna.enum(["dev", "staging"]) })
			.extend({ branchId: dna.string().optional().default("brand-deploy") }),
	]);

	it("should inject branchId via .default() when absent from input (build/dev)", () => {
		const r = cli.safeParse({ cmd: "build", mode: "dev" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", mode: "dev", branchId: "brand-build-dev" });
	});

	it("should inject branchId via .default() when absent from input (build/prod)", () => {
		const r = cli.safeParse({ cmd: "build", mode: "prod" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", mode: "prod", branchId: "brand-build-prod" });
	});

	it("should inject branchId via .default() when absent from input (deploy/staging)", () => {
		const r = cli.safeParse({ cmd: "deploy", mode: "staging" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "deploy", mode: "staging", branchId: "brand-deploy" });
	});

	it("should inject branchId via .default() when absent from input (deploy/dev)", () => {
		const r = cli.safeParse({ cmd: "deploy", mode: "dev" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "deploy", mode: "dev", branchId: "brand-deploy" });
	});

	it("should accept custom branchId when provided in input", () => {
		const r = cli.safeParse({ cmd: "build", mode: "dev", branchId: "custom-id" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.branchId).toBe("custom-id");
	});

	it("should reject non-string branchId", () => {
		const r = cli.safeParse({ cmd: "build", mode: "dev", branchId: 123 });
		expect(r.success).toBe(false);
	});

	it("should not deduplicate branches with same shape but different defaults (regression)", () => {
		const r1 = cli.safeParse({ cmd: "build", mode: "dev" });
		const r2 = cli.safeParse({ cmd: "build", mode: "prod" });
		const r3 = cli.safeParse({ cmd: "deploy", mode: "staging" });
		expect(r1.success && r1.data.branchId).toBe("brand-build-dev");
		expect(r2.success && r2.data.branchId).toBe("brand-build-prod");
		expect(r3.success && r3.data.branchId).toBe("brand-deploy");
	});

	it("should validate with .validate() (boolean mode) with mutations", () => {
		expect(cli.validate({ cmd: "build", mode: "dev" })).toBe(true);
		expect(cli.validate({ cmd: "build", mode: "prod" })).toBe(true);
		expect(cli.validate({ cmd: "deploy", mode: "staging" })).toBe(true);
		expect(cli.validate({ cmd: "unknown", mode: "dev" })).toBe(false);
	});
});

// ============================================================
// Branch mutation: .transform() — DnaPipe support
// ============================================================

describe("cliUnion — .transform() branch mutation (DnaPipe)", () => {
	const cli = dna.cliUnion([
		dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") })
			.transform((data) => ({ ...data, branchId: "brand-build-dev" })),
		dna.object({ cmd: dna.literal("build"), mode: dna.literal("prod") })
			.transform((data) => ({ ...data, branchId: "brand-build-prod" })),
		dna.object({ cmd: dna.literal("deploy"), mode: dna.enum(["dev", "staging"]) })
			.transform((data) => ({ ...data, branchId: "brand-deploy" })),
	]);

	it("should inject branchId via .transform() when absent from input (build/dev)", () => {
		const r = cli.safeParse({ cmd: "build", mode: "dev" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", mode: "dev", branchId: "brand-build-dev" });
	});

	it("should inject branchId via .transform() when absent from input (build/prod)", () => {
		const r = cli.safeParse({ cmd: "build", mode: "prod" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", mode: "prod", branchId: "brand-build-prod" });
	});

	it("should inject branchId via .transform() when absent from input (deploy/staging)", () => {
		const r = cli.safeParse({ cmd: "deploy", mode: "staging" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "deploy", mode: "staging", branchId: "brand-deploy" });
	});

	it("should not deduplicate branches with same shape but different transforms (regression)", () => {
		const r1 = cli.safeParse({ cmd: "build", mode: "dev" });
		const r2 = cli.safeParse({ cmd: "build", mode: "prod" });
		const r3 = cli.safeParse({ cmd: "deploy", mode: "staging" });
		expect(r1.success && r1.data.branchId).toBe("brand-build-dev");
		expect(r2.success && r2.data.branchId).toBe("brand-build-prod");
		expect(r3.success && r3.data.branchId).toBe("brand-deploy");
	});
});

// ============================================================
// Branch mutation: .extend() with multiple injected fields
// ============================================================

describe("cliUnion — .extend() with multiple injected fields", () => {
	const cli = dna.cliUnion([
		dna.object({ cmd: dna.literal("build") })
			.extend({
				branchId: dna.string().optional().default("b-build"),
				priority: dna.number().optional().default(1),
			}),
		dna.object({ cmd: dna.literal("deploy") })
			.extend({
				branchId: dna.string().optional().default("b-deploy"),
				priority: dna.number().optional().default(5),
			}),
	]);

	it("should inject both branchId and priority (build)", () => {
		const r = cli.safeParse({ cmd: "build" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", branchId: "b-build", priority: 1 });
	});

	it("should inject both branchId and priority (deploy)", () => {
		const r = cli.safeParse({ cmd: "deploy" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "deploy", branchId: "b-deploy", priority: 5 });
	});

	it("should accept custom values for injected fields", () => {
		const r = cli.safeParse({ cmd: "build", branchId: "custom", priority: 99 });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "build", branchId: "custom", priority: 99 });
	});
});

// ============================================================
// Portability: generated function is self-contained
// ============================================================

describe("cliUnion — portability (generated function self-contained)", () => {
	const cli = dna.cliUnion([
		dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") })
			.extend({ branchId: dna.string().optional().default("brand-build-dev") }),
		dna.object({ cmd: dna.literal("build"), mode: dna.literal("prod") })
			.extend({ branchId: dna.string().optional().default("brand-build-prod") }),
		dna.object({ cmd: dna.literal("deploy"), mode: dna.enum(["dev", "staging"]) })
			.extend({ branchId: dna.string().optional().default("brand-deploy") }),
	]);

	it("should produce code containing 'return function'", () => {
		const seq = cli.toDna();
		const result = toJS(false, true)(seq);
		// result.code is an array of parts for new Function(...parts).
		// The last part is the function body; it should contain "return function".
		const body = result.code[result.code.length - 1];
		expect(body.includes("return function")).toBe(true);
	});

	it("should have no required externals", () => {
		const seq = cli.toDna();
		const result = toJS(false, true)(seq);
		expect(result.requiredExternals).toEqual([]);
	});

	it("should produce a working function via new Function", () => {
		const seq = cli.toDna();
		const result = toJS(false, true)(seq);
		const fn = new Function(...result.code)() as (v: unknown) => any;
		expect(typeof fn).toBe("function");
		const r = fn({ cmd: "build", mode: "dev" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.branchId).toBe("brand-build-dev");
	});

	it("should be rehydratable from full source (result.code)", () => {
		const seq = cli.toDna();
		const result = toJS(false, true)(seq);
		// Rehydrate from the full parts array (new Function(...parts)).
		// This is the supported portability path — fn.toString() alone loses
		// STEP.OUT_CONST entries (regexes, _hop, ref functions) that live in
		// the outer closure.
		const rehydrated = new Function(...result.code)() as Function;
		const r = rehydrated({ cmd: "deploy", mode: "staging" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.branchId).toBe("brand-deploy");
	});

	it("should produce a working validator via new Function", () => {
		const seq = cli.toDna();
		const result = toJS(true, true)(seq);
		const fn = new Function(...result.code)() as (v: unknown) => boolean;
		expect(typeof fn).toBe("function");
		expect(fn({ cmd: "build", mode: "dev" })).toBe(true);
		expect(fn({ cmd: "unknown", mode: "dev" })).toBe(false);
	});

	it("should produce identical results from raw fn and safeParse", () => {
		const seq = cli.toDna();
		const result = toJS(false, true)(seq);
		const fn = new Function(...result.code)() as (v: unknown) => any;
		const inputs = [
			{ cmd: "build", mode: "dev" },
			{ cmd: "build", mode: "prod" },
			{ cmd: "deploy", mode: "staging" },
			{ cmd: "unknown", mode: "dev" },
			{ cmd: "build", mode: "dev", branchId: "custom" },
		];
		for (const input of inputs) {
			const rawResult = fn(input);
			const dnaResult = cli.safeParse(input);
			expect(rawResult.success).toBe(dnaResult.success);
			if (rawResult.success && dnaResult.success) {
				expect(rawResult.data).toEqual(dnaResult.data);
			}
		}
	});
});

// ============================================================
// Edge cases: trying to break cliUnion
// ============================================================

describe("cliUnion — edge cases and break attempts", () => {
	it("should handle empty string as discriminator value", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal(""), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
		]);
		expect(cli.safeParse({ cmd: "", mode: "dev" }).success).toBe(true);
		expect(cli.safeParse({ cmd: "build", mode: "dev" }).success).toBe(true);
		expect(cli.safeParse({ cmd: " ", mode: "dev" }).success).toBe(false);
	});

	it("should handle 0 as discriminator value", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal(0), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal(1), mode: dna.literal("dev") }),
		]);
		expect(cli.safeParse({ cmd: 0, mode: "dev" }).success).toBe(true);
		expect(cli.safeParse({ cmd: 1, mode: "dev" }).success).toBe(true);
		expect(cli.safeParse({ cmd: 2, mode: "dev" }).success).toBe(false);
	});

	it("should handle false as discriminator value", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal(false), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal(true), mode: dna.literal("dev") }),
		]);
		expect(cli.safeParse({ cmd: false, mode: "dev" }).success).toBe(true);
		expect(cli.safeParse({ cmd: true, mode: "dev" }).success).toBe(true);
	});

	it("should handle null as discriminator value", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal(null), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
		]);
		expect(cli.safeParse({ cmd: null, mode: "dev" }).success).toBe(true);
		expect(cli.safeParse({ cmd: "build", mode: "dev" }).success).toBe(true);
	});

	it("should handle array input (not object)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		expect(cli.safeParse([]).success).toBe(false);
		expect(cli.safeParse(["build"]).success).toBe(false);
	});

	it("should handle Date input (not plain object)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		expect(cli.safeParse(new Date()).success).toBe(false);
	});

	it("should handle extra properties in input (standard object mode)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		]);
		const r = cli.safeParse({ cmd: "build", mode: "dev", extra: "ignored" });
		expect(r.success).toBe(true);
		// CAST: r.data is now precisely typed (no `extra` property) after the safeParse
		// type fix. This test verifies the runtime behavior (keepOnly strips extra props),
		// so we cast to access the property that the type correctly says is absent.
		if (r.success) expect((r.data as Record<string, unknown>).extra).toBeUndefined();
	});

	it("should handle deeply nested discriminator values (3 keys)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev"), sub: dna.literal("a") }),
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev"), sub: dna.literal("b") }),
		]);
		expect(cli.safeParse({ cmd: "build", mode: "dev", sub: "a" }).success).toBe(true);
		expect(cli.safeParse({ cmd: "build", mode: "dev", sub: "b" }).success).toBe(true);
		expect(cli.safeParse({ cmd: "build", mode: "dev", sub: "c" }).success).toBe(false);
	});

	it("should handle 10 branches without dedup issues", () => {
		const branches = Array.from({ length: 10 }, (_, i) =>
			dna.object({ cmd: dna.literal(`cmd${i}`) })
				.extend({ branchId: dna.string().optional().default(`brand-${i}`) })
		);
		const cli = dna.cliUnion(branches as any);
		for (let i = 0; i < 10; i++) {
			const r = cli.safeParse({ cmd: `cmd${i}` });
			expect(r.success).toBe(true);
			if (r.success) expect(r.data.branchId).toBe(`brand-${i}`);
		}
	});

	it("should handle branches with identical non-discriminator shapes but different defaults", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("a") }).extend({ tag: dna.string().optional().default("tag-a") }),
			dna.object({ cmd: dna.literal("b") }).extend({ tag: dna.string().optional().default("tag-b") }),
			dna.object({ cmd: dna.literal("c") }).extend({ tag: dna.string().optional().default("tag-c") }),
		]);
		const ra = cli.safeParse({ cmd: "a" });
		const rb = cli.safeParse({ cmd: "b" });
		const rc = cli.safeParse({ cmd: "c" });
		expect(ra.success && ra.data.tag).toBe("tag-a");
		expect(rb.success && rb.data.tag).toBe("tag-b");
		expect(rc.success && rc.data.tag).toBe("tag-c");
	});

	it("should handle very long string values as discriminators", () => {
		const longA = "a".repeat(1000);
		const longB = "b".repeat(1000);
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal(longA) }),
			dna.object({ cmd: dna.literal(longB) }),
		]);
		expect(cli.safeParse({ cmd: longA }).success).toBe(true);
		expect(cli.safeParse({ cmd: longB }).success).toBe(true);
		expect(cli.safeParse({ cmd: "a".repeat(999) }).success).toBe(false);
	});

	it("should handle Symbol as input (not a valid discriminator)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		expect(cli.safeParse({ cmd: Symbol("test") }).success).toBe(false);
	});

	it("should handle object with null prototype", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		const input = Object.create(null);
		input.cmd = "build";
		expect(cli.safeParse(input).success).toBe(true);
	});

	it("should handle nested .extend() chains", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") })
				.extend({ level: dna.number().optional().default(1) })
				.extend({ tag: dna.string().optional().default("build-tag") }),
			dna.object({ cmd: dna.literal("deploy") })
				.extend({ level: dna.number().optional().default(5) })
				.extend({ tag: dna.string().optional().default("deploy-tag") }),
		]);
		const r1 = cli.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		if (r1.success) expect(r1.data).toEqual({ cmd: "build", level: 1, tag: "build-tag" });
		const r2 = cli.safeParse({ cmd: "deploy" });
		expect(r2.success).toBe(true);
		if (r2.success) expect(r2.data).toEqual({ cmd: "deploy", level: 5, tag: "deploy-tag" });
	});

	it("should handle .prefault() on branch property", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") })
				.extend({ port: dna.number().prefault(3000) }),
			dna.object({ cmd: dna.literal("deploy") })
				.extend({ port: dna.number().prefault(8080) }),
		]);
		const r1 = cli.safeParse({ cmd: "build", port: undefined });
		expect(r1.success).toBe(true);
		if (r1.success) expect(r1.data.port).toBe(3000);
		const r2 = cli.safeParse({ cmd: "deploy", port: undefined });
		expect(r2.success).toBe(true);
		if (r2.success) expect(r2.data.port).toBe(8080);
	});

	it("should handle mixed mutation types across branches", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") })
				.extend({ branchId: dna.string().optional().default("b1") }),
			dna.object({ cmd: dna.literal("deploy") })
				.transform((data) => ({ ...data, branchId: "b2" })),
		]);
		const r1 = cli.safeParse({ cmd: "build" });
		expect(r1.success && r1.data.branchId).toBe("b1");
		const r2 = cli.safeParse({ cmd: "deploy" });
		expect(r2.success && r2.data.branchId).toBe("b2");
	});

	it("should not inject branchId from wrong branch (no state leakage)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("a") }).extend({ id: dna.string().optional().default("A") }),
			dna.object({ cmd: dna.literal("b") }).extend({ id: dna.string().optional().default("B") }),
			dna.object({ cmd: dna.literal("c") }).extend({ id: dna.string().optional().default("C") }),
		]);
		for (let round = 0; round < 5; round++) {
			const ra = cli.safeParse({ cmd: "a" });
			const rb = cli.safeParse({ cmd: "b" });
			const rc = cli.safeParse({ cmd: "c" });
			expect(ra.success && ra.data.id).toBe("A");
			expect(rb.success && rb.data.id).toBe("B");
			expect(rc.success && rc.data.id).toBe("C");
		}
	});
});

// ============================================================
// DNA structure verification with mutations
// ============================================================

describe("cliUnion — DNA structure with mutations", () => {
	it("should emit distinct DNA indices for branches with different defaults", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }).extend({ tag: dna.string().optional().default("t1") }),
			dna.object({ cmd: dna.literal("deploy") }).extend({ tag: dna.string().optional().default("t2") }),
		]);
		const seq = cli.toDna();
		const firstNode = seq[0] as any;
		const branchDef = firstNode[3] as number[];
		expect(branchDef[1]).not.toBe(branchDef[2]);
	});

	it("should emit cli opcode with correct discriminator keys", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") })
				.extend({ tag: dna.string().optional().default("t1") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") })
				.extend({ tag: dna.string().optional().default("t2") }),
		]);
		const seq = cli.toDna();
		const firstNode = seq[0] as any;
		expect(firstNode[0]).toBe("maranget"); // opcode renamed from "cli"
		expect(firstNode[1]).toEqual(["cmd", "mode"]);
		expect(firstNode[1]).not.toContain("tag");
	});

	it("should not include injected fields in discriminators", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") })
				.extend({ branchId: dna.string().optional().default("b1") }),
			dna.object({ cmd: dna.literal("deploy") })
				.extend({ branchId: dna.string().optional().default("b2") }),
		]);
		expect(cli.discriminators).toEqual(["cmd"]);
		expect(cli.discriminators).not.toContain("branchId");
	});
});

// ============================================================
// mixture rule (Maranget §3.3 rule 4): catch-all branches
// ============================================================

describe("cliUnion — mixture rule (catch-all)", () => {
	// Test 1: absolute catch-all LAST — fallback for unknown/missing values
	it("Test 1: catch-all last — fallback for unknown cmd", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), files: dna.string().optional() }),
			dna.object({ cmd: dna.literal("deploy"), target: dna.string() }),
			dna.looseObject({}),
		]);
		const r1 = cli.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		if (hasKey(r1, "cmd")) expect(r1.data.cmd).toBe("build");
		const r2 = cli.safeParse({ cmd: "deploy", target: "prod" });
		expect(r2.success).toBe(true);
		if (hasKey(r2, "target")) expect(r2.data.target).toBe("prod");
		// Unknown cmd → catch-all (no longer silent data loss)
		const r3 = cli.safeParse({ cmd: "nope" });
		expect(r3.success).toBe(true);
		if (hasKey(r3, "cmd")) expect(r3.data.cmd).toBe("nope");
		// Empty input → catch-all
		const r4 = cli.safeParse({});
		expect(r4.success).toBe(true);
	});

	// Test 2: catch-all with no discriminator properties FIRST — Option B constructor-priority
	it("Test 2: catch-all first — constructor-priority (Option B, deliberate deviation)", () => {
		const cli = dna.cliUnion([
			dna.looseObject({}),
			dna.object({ cmd: dna.literal("build"), files: dna.string().optional() }),
			dna.object({ cmd: dna.literal("deploy"), target: dna.string() }),
		]);
		// Constructor rows win over the earlier catch-all (constructor-priority)
		const r1 = cli.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		if (hasKey(r1, "cmd")) expect(r1.data.cmd).toBe("build");
		const r2 = cli.safeParse({ cmd: "deploy", target: "p" });
		expect(r2.success).toBe(true);
		if (hasKey(r2, "target")) expect(r2.data.target).toBe("p");
		// Unknown cmd → catch-all fallback
		const r3 = cli.safeParse({ cmd: "nope" });
		expect(r3.success).toBe(true);
		if (hasKey(r3, "cmd")) expect(r3.data.cmd).toBe("nope");
	});

	// Test 3: catch-all with a broad discriminator type (cmd: dna.string())
	it("Test 3: catch-all via broad discriminator type (cmd: dna.string())", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
			dna.looseObject({ cmd: dna.string() }),
		]);
		expect(cli.discriminators).toEqual(["cmd"]);
		const r1 = cli.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		const r2 = cli.safeParse({ cmd: "deploy" });
		expect(r2.success).toBe(true);
		// Any other string cmd → broad catch-all branch
		const r3 = cli.safeParse({ cmd: "anything-else" });
		expect(r3.success).toBe(true);
		if (r3.success) expect(r3.data.cmd).toBe("anything-else");
		// Non-string cmd → fail (no branch matches)
		const r4 = cli.safeParse({ cmd: 42 });
		expect(r4.success).toBe(false);
	});

	// Test 4: multi-column catch-all — P2' carried into each constructor case (§4)
	it("Test 4: multi-column catch-all — git commit/push/status + catch-all", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("git"), sub: dna.literal("commit") }),
			dna.object({ cmd: dna.literal("git"), sub: dna.literal("push") }),
			dna.object({ cmd: dna.literal("git"), sub: dna.literal("status") }),
			dna.looseObject({}),
		]);
		const r1 = cli.safeParse({ cmd: "git", sub: "commit" });
		expect(r1.success).toBe(true);
		if (hasKey(r1, "sub")) expect(r1.data.sub).toBe("commit");
		const r2 = cli.safeParse({ cmd: "git", sub: "unknown" });
		expect(r2.success).toBe(true);
		if (hasKey(r2, "sub")) expect(r2.data.sub).toBe("unknown"); // catch-all via P2' carry
		const r3 = cli.safeParse({ cmd: "foo", sub: "bar" });
		expect(r3.success).toBe(true);
		if (hasKey(r3, "sub")) expect(r3.data.sub).toBe("bar"); // catch-all via default
	});

	// Test 5: partial wildcard on a later column (git * — subcmd wildcard)
	it("Test 5: partial wildcard on later column (git * — subcmd: string)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("git"), sub: dna.literal("commit") }),
			dna.object({ cmd: dna.literal("git"), sub: dna.literal("push") }),
			dna.object({ cmd: dna.literal("git"), sub: dna.string() }),
		]);
		const r1 = cli.safeParse({ cmd: "git", sub: "commit" });
		expect(r1.success).toBe(true);
		if (r1.success) expect(r1.data.sub).toBe("commit");
		const r2 = cli.safeParse({ cmd: "git", sub: "unknown" });
		expect(r2.success).toBe(true);
		if (r2.success) expect(r2.data.sub).toBe("unknown"); // git * branch
		// Non-git cmd → fail (no catch-all on cmd column)
		const r3 = cli.safeParse({ cmd: "foo", sub: "bar" });
		expect(r3.success).toBe(false);
	});

	// Test 6: branches with DIFFERENT discriminator keys (Test 14 from reviews)
	// For a CLI the subcommand key is COMMON to all branches — a branch that
	// routes on a different key alone (e.g. { help: "help" }) is a design error:
	// required keys (Maranget/CLI sense) are keys shared by ALL branches. The
	// route is expressed as a cmd value instead.
	it("Test 6: branches with different discriminator values (cmd build/deploy/help)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
			dna.object({ cmd: dna.literal("help") }),
		]);
		// cmd is the single common discriminator
		expect(cli.discriminators).toEqual(["cmd"]);
		const r1 = cli.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		const r2 = cli.safeParse({ cmd: "deploy" });
		expect(r2.success).toBe(true);
		const r3 = cli.safeParse({ cmd: "help" });
		expect(r3.success).toBe(true);
		// No catch-all → unknown values fail
		const r4 = cli.safeParse({ cmd: "unknown" });
		expect(r4.success).toBe(false);
		const r5 = cli.safeParse({});
		expect(r5.success).toBe(false);
	});

	// Test 7: optional discriminator — undefined routes on the optional branch
	it("Test 7: optional discriminator routes undefined to the optional branch", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build").optional(), files: dna.string().optional() }),
			dna.object({ cmd: dna.literal("deploy"), target: dna.string() }),
		]);
		const r1 = cli.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		const r2 = cli.safeParse({});
		expect(r2.success).toBe(true); // undefined cmd → optional branch
		if (hasKey(r2, "files")) expect(r2.data.files).toBeUndefined();
		const r3 = cli.safeParse({ cmd: "deploy", target: "p" });
		expect(r3.success).toBe(true);
		// Unknown cmd → no branch matches
		const r4 = cli.safeParse({ cmd: "zzz" });
		expect(r4.success).toBe(false);
	});

	// Test 8: nullable finite discriminator
	it("Test 8: nullable finite discriminator routes null to the nullable branch", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build").nullable() }),
			dna.object({ cmd: dna.literal("deploy") }),
		]);
		const r1 = cli.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		const r2 = cli.safeParse({ cmd: null });
		expect(r2.success).toBe(true);
		if (r2.success) expect(r2.data.cmd).toBeNull();
		const r3 = cli.safeParse({ cmd: "deploy" });
		expect(r3.success).toBe(true);
	});

	// Test 9: input WITHOUT discriminator key + catch-all → catch-all matches (no prevalidation rejection)
	it("Test 9: missing discriminator key reaches catch-all (prevalidation does not reject)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), files: dna.string().optional() }),
			dna.object({ cmd: dna.literal("deploy"), target: dna.string() }),
			dna.looseObject({}),
		]);
		// prevalidationRequired must NOT include cmd (absent in catch-all branch)
		const r = cli.safeParse({});
		expect(r.success).toBe(true); // would fail before mixture rule (Gap D)
		if (r.success) expect(r.data).toEqual({});
	});

	// Test 10: enum alias (orpat — non-regression) combined with catch-all
	it("Test 10: enum alias + catch-all combine (mixture × orpat)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.enum(["build", "b"]), files: dna.string().optional() }),
			dna.object({ cmd: dna.literal("deploy"), target: dna.string() }),
			dna.looseObject({}),
		]);
		const r1 = cli.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		const r2 = cli.safeParse({ cmd: "b" });
		expect(r2.success).toBe(true);
		if (hasKey(r2, "cmd")) expect(r2.data.cmd).toBe("b");
		const r3 = cli.safeParse({ cmd: "zzz" });
		expect(r3.success).toBe(true);
		if (hasKey(r3, "cmd")) expect(r3.data.cmd).toBe("zzz");
	});

	// Test 11: orpat row unique — single branch with dna.enum(["a","b"])
	it("Test 11: orpat row unique — single enum branch routes on both values", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.enum(["a", "b"]), tag: dna.string().optional() }),
		]);
		const r1 = cli.safeParse({ cmd: "a" });
		expect(r1.success).toBe(true);
		const r2 = cli.safeParse({ cmd: "b" });
		expect(r2.success).toBe(true);
		const r3 = cli.safeParse({ cmd: "c" });
		expect(r3.success).toBe(false);
	});

	// Test 12: detectPositionals does not crash with missing keys (Gap B)
	it("Test 12: detectPositionals tolerates absent discriminator keys (Gap B)", () => {
		// cmd is a discriminator in branches 0-1 but absent in the loose catch-all
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
			dna.looseObject({}),
		]);
		expect(() => cli.positionals).not.toThrow();
		const r = cli.safeParse({ cmd: "build" });
		expect(r.success).toBe(true);
	});

	// Test 13: zero candidate keys — all branches wildcard (catch-all-only union)
	it("Test 13: catch-all-only union validates via first branch (no silent loss)", () => {
		const cli = dna.cliUnion([
			dna.looseObject({ a: dna.string().optional() }),
			dna.looseObject({ b: dna.string().optional() }),
		]);
		expect(cli.discriminators).toEqual([]);
		expect(() => cli.toDna()).not.toThrow();
		const r = cli.safeParse({ a: "x" });
		expect(r.success).toBe(true);
	});

	// Test 14: branch priority — specific branch before catch-all
	it("Test 14: specific branch before catch-all — specific wins for matching input", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.looseObject({}),
		]);
		const r1 = cli.safeParse({ cmd: "build" });
		expect(r1.success).toBe(true);
		if (hasKey(r1, "cmd")) expect(r1.data.cmd).toBe("build");
		const r2 = cli.safeParse({ cmd: "other" });
		expect(r2.success).toBe(true);
		if (hasKey(r2, "cmd")) expect(r2.data.cmd).toBe("other"); // catch-all
	});

	// Test 15: multiple wildcard rows — source-order precedence among wildcards.
	// Both wildcard branches have the same routing shape (empty) and are
	// distinguished only by a transform — for an unmatched value, the first
	// wildcard row (source order) wins the base case (col === -1).
	it("Test 15: multiple wildcard rows — first wildcard wins for unmatched values", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.looseObject({}).transform((d) => ({ ...d, w: "first" })),
			dna.looseObject({}).transform((d) => ({ ...d, w: "second" })),
		]);
		// cmd is the only discriminator (both catch-alls have empty shapes)
		expect(cli.discriminators).toEqual(["cmd"]);
		const r = cli.safeParse({ cmd: "zzz" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual({ cmd: "zzz", w: "first" }); // branch 1 wins
	});

	// Test 16: invalid input still fails when no wildcard matches
	it("Test 16: invalid input fails when no wildcard matches", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), files: dna.string().optional() }),
			dna.object({ cmd: dna.literal("deploy"), target: dna.string() }),
		]);
		expect(cli.safeParse({ cmd: "nope" }).success).toBe(false);
		expect(cli.safeParse({}).success).toBe(false);
	});
});

// ============================================================
// type-level regression (catch-all in _output)
// ============================================================

describe("cliUnion — mixture rule type-level", () => {
	it("type-level: catch-all widens _output union with the loose branch (empty object type)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), files: dna.string().optional() }),
			dna.object({ cmd: dna.literal("deploy"), target: dna.string() }),
			dna.looseObject({}),
		]);
		type Out = dna.infer<typeof cli>;
		expectTypeOf<Out>().toEqualTypeOf<
			{ cmd: "build"; files: string | undefined } | { cmd: "deploy"; target: string } | {}
		>();
	});

	it("type-level: tuple precision is preserved (not widened to DnaObject[])", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build") }),
			dna.object({ cmd: dna.literal("deploy") }),
			dna.looseObject({}),
		]);
		type Options = (typeof cli)["options"];
		expectTypeOf<Options>().toEqualTypeOf<
			readonly [ReturnType<typeof dna.object<{ cmd: ReturnType<typeof dna.literal<"build">> }>>, ReturnType<typeof dna.object<{ cmd: ReturnType<typeof dna.literal<"deploy">> }>>, ReturnType<typeof dna.looseObject<{}>>]
		>();
	});

	it("type-level: enum alias output is a union of literals (orpat)", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.enum(["build", "b"]), files: dna.string().optional() }),
			dna.object({ cmd: dna.literal("deploy"), target: dna.string() }),
		]);
		type Out = dna.infer<typeof cli>;
		expectTypeOf<Out>().toEqualTypeOf<
			{ cmd: "build" | "b"; files: string | undefined } | { cmd: "deploy"; target: string }
		>();
	});
});
