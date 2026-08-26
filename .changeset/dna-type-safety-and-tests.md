---
"@ytrynot/dna": patch
---

Type safety improvements for public API

- `custom()` params now typed as `tsRefineOptions`
- `IIssue.input` now typed as `$Input<T>` (distinguishes input from output type)
- `ODnaIssueNotMultipleOf.divisor` now accepts `number | bigint`
- Add 38 unit tests for `toJs/inline-func.ts` (`FN_fCount`, `FN_dEq`, 
`FN_cidrV6`, `FN_toBigInt`, `FN_toDate`, `FN_dMerge`)
