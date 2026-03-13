/**
 * QueryBuilder Master Test Index
 * This file imports and runs all test suites for the QueryBuilder package.
 */

console.log("Running QueryBuilder Test Suite...\n");

await import('./v4-compliance-verify.js');
await import('./query-construction-verify.js');
await import('./advanced-query-verify.js');
await import('./readme-examples-verify.js');




