
import { describe, it, expect } from "vitest";
import { ContractSchema, pico } from "../dist/editor.js"; // IMPORT FROM BUNDLE

describe("📦 Bundle Smoke Test (dist/index.js)", () => {
  it("should be able to import and compile a basic contract from the production bundle", async () => {
    const rawContract = {
      name: "smoke-test",
      description: "testing the bundle",
      cli: {
        flags: {
          "check": { desc: "run check" }
        }
      },
      targets: {
        run: {
          check: pico.literal(true)
        }
      }
    };

    const compiled = ContractSchema.parse(rawContract);
    
    expect(compiled.name).toBe("smoke-test");
    expect(compiled.routing.groups.get(1)).toContain("run"); // Bit 1 for --check
    expect(compiled.zvoSchema).toBeDefined();
  });
});
