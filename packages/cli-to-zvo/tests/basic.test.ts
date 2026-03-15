import { describe, it, expect } from 'vitest';
import { cliToZod } from '../src/index.js';

describe('cli-to-zvo basic verification', () => {
    it('should process a basic contract', () => {
        const contract = {
            name: "test",
            description: "test description",
            def: {
                flag: {
                    type: "boolean",
                    description: "a flag",
                    flags: { long: "flag", short: "f" }
                }
            },
            targets: {
                run: {
                    caseName: "Run",
                    description: "run it",
                    flags: { flag: { optional: true } }
                }
            }
        };

        const { xorSchema, router } = cliToZod(contract as any);
        expect(xorSchema).toBeDefined();
        expect(router).toBeDefined();

        const data = { flag: true };
        const result = xorSchema.parse(data) as any;

        // Local check
        expect(result.isRoute("run")).toBe(true);

        // Global check (robust after spread)
        const spread = { ...result };
        expect(router.isRoute(spread, "run")).toBe(true);
    });
});
