# Node.js `util.parseArgs` Behavior Reference

This document summarizes the observed behaviors of `node:util.parseArgs` regarding `string` and `boolean` types, as well as positional argument management. These observations serve as the foundation for the Zod -> CLI mapping logic.

## Types Overview

| Feature            | `boolean` Type                                                | `string` Type                                                                                                                 |
| :----------------- | :------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- |
| **Consumption**    | **Never** consumes the next argument.                         | **Always** consumes the next argument as a value.                                                                             |
| **Grouped Flags**  | Can be anywhere in a group (`-v`).                            | Can only be at the **end** of a group, otherwise the rest of the group is used as the value (e.g., `-nv` becomes `--name v`). |
| **Explicit Value** | `flag=value` causes an **error** (does not take an argument). | `flag=value` or `flag value` works perfectly.                                                                                 |
| **Missing Value**  | `undefined` if not present.                                   | `undefined` if not present.                                                                                                   |
| **Positionals**    | Unconsumed arguments become positionals.                      | Unconsumed arguments become positionals.                                                                                      |

## Recommendations for `cli-to-zvo`

Based on these behaviors, here are the recommended best practices for library development:

1. **Prefer `strict: true` mode**: The `strict: false` mode treats all unknown options as booleans by default, which can make debugging difficult (a typo like `--mame` will be transformed into `mame: true` without error).
2. **Boolean vs String Flags**:
   - For `z.boolean()`, you MUST use `type: "boolean"`. The user will not be able to pass a value (e.g., `--flag=true` will fail).
   - If support for `--flag true/false` is required, use a type that accepts strings (like `pico.stringbool()`) and map it to `type: "string"` for the CLI.
3. **Negative Values**: Node does not natively handle `--no-verbose`. It is recommended to provide explicit mapping if support for this convention is desired.
4. **Using the `=` Separator**: To avoid "ambiguous argument" errors, recommend end-users use `--option=--value` if the value starts with a dash.
5. **Grouped Short Flags**: Avoid placing a `string` type option in the middle of a short flag group (e.g., `-abc`). Only the last letter of a group should be an option requiring a value to avoid confusion.
6. **Positionals**: Always enable `allowPositionals: true` if you want to collect "extra" arguments after Zod validation; otherwise, Node will ignore them or cause an error in strict mode.

**Configuring node:utils parseArgs**: How to correctly configure ParseArgs depending on the expected data type.

| data type   | flags type  | positionals type | allowPositionals | strict | value location (flag vs positional)          | Syntax Best Practice      |
| :---------- | :---------- | :--------------- | :--------------- | :----- | :------------------------------------------- | :------------------------ |
| **string**  | `"string"`  | always string    | `true`           | `true` | flag: `values[n]` <br> pos: `positionals[i]` | `--flag v` <br> `pos_val` |
| **boolean** | `"boolean"` | always string    | `true`           | `true` | flag: `values[n]` <br> pos: `positionals[i]` | `--flag` <br> `true`      |

## Terminology Reference

- **allowPositionals**: Allows the collection of arguments not associated with flags into `result.positionals`. Essential for supporting positional arguments.
- **strict**: Determines the parsing severity (see point 1 above).
  - `true` (default): Throws an error for unknown options or missing values.
  - `false`: Relaxes constraints (unknown options are then often treated as boolean flags).

## Key Observations on Grouped Flags

The order of short flags in a group (e.g., `-abc`) is crucial if one of them is of type `string`.

- If `a` and `b` are `boolean` and `c` is `string`: `-abc value` -> `a=true`, `b=true`, `c="value"`.
- If `a` is `string`: `-abc` -> `a="bc"`. The rest of the group is absorbed as the value for `a`.

## Positional Behavior

Positional arguments can be:

1. Placed before flags.
2. Placed between flags.
3. Placed after flags.
4. Forced after a `--` separator. Everything following `--` is treated as a positional, even strings starting with `-`.

## Common Errors

- **Option '-n, --name \<value>' argument missing**: Occurs if a `string` flag is the last argument on the command line.
- **Option '--name' argument is ambiguous**: Occurs if the value provided to a `string` flag looks like an option (starts with a dash, e.g., `--name --verbose`). Node refuses for safety to consume another flag as a value unless the explicit `--name=--verbose` syntax is used.
- **Option '-v, --verbose' does not take an argument**: Occurs if an attempt is made to pass a value to a boolean, for example `--verbose=true`.
- **Unknown option '--unknown'**: Occurs if an unknown flag is used (**in `strict: true` mode, which is the default**).

## Sandbox Example

Here is the code used to validate these behaviors:

```typescript
import { parseArgs } from "node:util";

const options = {
  verbose: { type: "boolean", short: "v" },
  name: { type: "string", short: "n" },
  tag: { type: "string", multiple: true, short: "t" },
};

const args = ["pos1", "--verbose", "pos2", "--name", "Alice", "pos3"];
const result = parseArgs({ args, options, allowPositionals: true });

// result.values -> { verbose: true, name: "Alice" }
// result.positionals -> ["pos1", "pos2", "pos3"]
```
