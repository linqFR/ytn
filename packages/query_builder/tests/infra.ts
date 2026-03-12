import assert from "node:assert";

/**
 * @class TestRunner
 * @description Provides a unified reporting system for QueryBuilder tests.
 */
export class TestRunner {
    private suiteName: string;
    private passed: number = 0;
    private total: number = 0;

    constructor(suiteName: string) {
        this.suiteName = suiteName;
        console.log(`\n🚀 Starting Suite: ${suiteName}...`);
    }

    /**
     * @function it
     * @description Runs a single test case with standardized output.
     */
    it(name: string, fn: () => void) {
        this.total++;
        const caseLabel = `  [Case ${this.total}] ${name}`;
        try {
            fn();
            this.passed++;
            console.log(`✅ ${caseLabel}`);
        } catch (error: any) {
            console.error(`❌ ${caseLabel}`);
            if (error.code === 'ERR_ASSERTION') {
                console.error(`     - Expected: ${JSON.stringify(error.expected, null, 2)}`);
                console.error(`     - Actual:   ${JSON.stringify(error.actual, null, 2)}`);
            } else {
                console.error(`     - Error: ${error.stack || error.message}`);
            }
        }
    }

    /**
     * @function assertSQL
     * @description Helper to assert SQL matches exactly.
     */
    assertSQL(actual: string, expected: string) {
        assert.strictEqual(actual.trim(), expected.trim());
    }

    /**
     * @function assertContains
     * @description Helper to assert SQL contains a specific fragment.
     */
    assertContains(sql: string, fragment: string) {
        assert.ok(sql.includes(fragment), `SQL does not contain: ${fragment}\nSQL: ${sql}`);
    }

    /**
     * @function finish
     * @description Prints summary and exits with non-zero code if any test failed.
     */
    finish() {
        console.log(`\n--- ${this.suiteName} Summary ---`);
        console.log(`Result: ${this.passed}/${this.total} passed`);
        if (this.passed === this.total) {
            console.log(`✅ ALL TESTS PASSED!\n`);
        } else {
            const failedCount = this.total - this.passed;
            console.error(`❌ ${failedCount} TEST(S) FAILED!\n`);
            process.exit(1);
        }
    }
}
