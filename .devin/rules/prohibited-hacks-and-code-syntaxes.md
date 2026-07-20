---
trigger: always_on
---

# **Prohibited Hacks and Code Syntaxes**

THESE RULES ARE CRITICAL.

## TypeScript Type Assertions

- **`as any`**: Strictly forbidden. Use proper typing instead.
- **`as unknown`**: Strictly forbidden, except for the double-cast pattern `as unknown as T` for exceptional cases where type system limitations require it.

## Function Parameters

- **`any` or `| any` in parameters**: Forbidden when used to hide type errors. Use proper typing or generics instead.

## Console Output

- **`JSON.stringify(obj, null, 2)`**: Forbidden for console output. Use 1st/`console.dir(obj, { depth: null })` or 2nd/`console.log(JSON.stringify(obj))` instead for better readability.

## Zod V4 Specific
- **ZOD V4 ONLY**: use only Zod v4 API.
- **`_def` access**: Strictly forbidden. Use `._zod` for V4 internal reflection.
- **`@ts-ignore`**: Forbidden. Fix the type issue properly.
- **`.passthrough()`**: Deprecated in V4. Use `.loose()` or `z.looseObject()` instead.

## General Anti-Patterns

- **`@ts-expect-error`**: Use sparingly and only with explicit comments explaining why.
- **`@ts-nocheck`**: Forbidden at file level. Fix the types instead.
- **Type casting without validation**: Avoid casting without runtime validation when dealing with external data.
- **Editing protected blocks**: Forbidden to edit code blocks marked with comments like "NEVER EDIT" or similar protection markers.
