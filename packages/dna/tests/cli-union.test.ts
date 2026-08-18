import { describe, it, expect } from "vitest";
import { dna } from "../src/index.js";
import { toJS } from "../src/toJs/dna-to-js.js";

describe("cliUnion — builder", () => {
	it("should detect discriminators automatically", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("prod") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.enum(["dev", "staging"]) }),
		]);
		expect(cli.type).toBe("cliUnion");
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

	it("should accept explicit positionals config", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		], { positionals: ["mode"] });
		expect(cli.positionals).toEqual(["mode"]);
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

	it("discriminator override — key not declared in all branches throws", () => {
		expect(() => {
			dna.cliUnion([
				dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
				dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
			], { discriminators: ["cmd", "mode", "port"] }).toDna();
		}).toThrow();
	});

	it("positionals override — changes toParseArgsConfig output", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		], { positionals: ["cmd"] });
		expect(cli.positionals).toEqual(["cmd"]);
		expect(cli.flags).toContain("mode");
		const config = cli.toParseArgsConfig();
		expect(config.options).toHaveProperty("mode");
		expect(config.options).not.toHaveProperty("cmd");
	});

	it("positionals override — reordering respected", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		], { positionals: ["mode", "cmd"] });
		expect(cli.positionals).toEqual(["mode", "cmd"]);
		expect(cli.flags).toEqual([]);
		const config = cli.toParseArgsConfig();
		expect(config.options).toEqual({});
	});

	it("positionals override — empty array makes all keys flags", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		], { positionals: [] });
		expect(cli.positionals).toEqual([]);
		expect(cli.flags).toContain("cmd");
		expect(cli.flags).toContain("mode");
		const config = cli.toParseArgsConfig();
		expect(config.options).toHaveProperty("cmd");
		expect(config.options).toHaveProperty("mode");
	});

	it("both overrides — discriminators and positionals together", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		], { discriminators: ["cmd"], positionals: ["cmd"] });
		expect(cli.discriminators).toEqual(["cmd"]);
		expect(cli.positionals).toEqual(["cmd"]);
		expect(cli.flags).toContain("mode");
		const r1 = cli.safeParse({ cmd: "build", mode: "dev" });
		expect(r1.success).toBe(true);
		const r2 = cli.safeParse({ cmd: "deploy", mode: "prod" });
		expect(r2.success).toBe(true);
	});

	it("override vs auto-detection — same behavior when override matches auto-detect", () => {
		const branches = [
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		];
		const auto = dna.cliUnion(branches);
		const explicit = dna.cliUnion(branches, {
			discriminators: ["cmd", "mode"],
			positionals: ["cmd", "mode"],
		});
		expect(auto.discriminators).toEqual(explicit.discriminators);
		expect(auto.positionals).toEqual(explicit.positionals);
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
	it("should produce cli opcode in DNA", () => {
		const cli = dna.cliUnion([
			dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
			dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
		]);
		const seq = cli.toDna();
		const firstNode = seq[0];
		expect(firstNode[0]).toBe("cli");
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
		if (r.success) expect(r.data.extra).toBeUndefined();
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
		expect(firstNode[0]).toBe("cli");
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
