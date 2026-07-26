import { describe, expect, it } from "vitest";
import { dna } from "../src/index.js";

describe("DnaPromise extra", () => {
	const schema = dna.promise(dna.string());

	it("rejects non-Promise input synchronously", () => {
		const result = schema.safeParse("hello");
		expect(result.success).toBe(false);
	});

	it("rejects Promise input in synchronous parse", () => {
		expect(() => schema.parse(Promise.resolve("hello"))).toThrow();
	});

	it("resolves and validates an awaited Promise", async () => {
		await expect(schema.parseAsync(Promise.resolve("hello"))).resolves.toBe("hello");
	});

	it("rejects an awaited Promise with invalid value", async () => {
		await expect(schema.parseAsync(Promise.resolve(123))).rejects.toThrow();
	});

	it("safeParseAsync returns success for a valid Promise", async () => {
		const result = await schema.safeParseAsync(Promise.resolve("hello"));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("hello");
		}
	});
});
