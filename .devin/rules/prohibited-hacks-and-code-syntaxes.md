---
trigger: always_on
---

# **Prohibited Hacks and Code Syntaxes**

THESE RULES ARE CRITICAL.

## TypeScript Type Assertions

- **`as any`**: Strictly forbidden. Use proper typing instead.
- **`as unknown`**: Strictly forbidden, except for the double-cast pattern `as unknown as T` for exceptional cases where type system limitations require it.
- **All casts must be justified**: Every `as` cast (including `as unknown as T` and intersection casts `as T & { ... }`) MUST be accompanied by an inline `// CAST:` comment explaining WHY the cast is necessary. Unjustified casts are forbidden. Prefer eliminating the cast (proper typing, type guards, interface extension) over justifying it.

## Read Before You Cast or Type

- **NEVER guess types or invent structural casts to avoid reading the source.** Before adding a cast, a type annotation, or a type guard, you MUST read the actual source: the class definition, the interface, the exported types, and the `.d.ts` files in `node_modules`.
- **List the available APIs first.** When facing a type mismatch, enumerate what the source type actually exposes (class methods, interface fields, exported type guards, `instanceof` checks). Do not assume — verify.
- **Prefer `instanceof` over duck-typing.** If a class is exported at runtime, use `instanceof ClassName` as the type guard. Do not invent structural shapes (`as T & { prop?: unknown }`) when a proper class guard exists.
- **Prefer the public API over reimplementing it.** If a method exists on the class (e.g., `isOptional()`, `unwrap()`), call it via a type guard narrowing to that class — do not reimplement the method's logic via internal field access (`_core.seed.xxx`) just to avoid the type guard.
- **Casting to avoid reading docs is a violation.** A cast that exists because "I didn't know the class was exported" or "I didn't check the interface" is not a justified cast — it is laziness. Read the source first.

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
