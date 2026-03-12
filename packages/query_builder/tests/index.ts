/**
 * QueryBuilder Master Test Index
 * This file imports and runs all test suites for the QueryBuilder package.
 */

console.log("Running QueryBuilder Test Suite...\n");

await import('./v4_compliance_verify.js');
await import('./query_construction_verify.js');
await import('./advanced_query_verify.js');
await import('./readme_examples_verify.js');




