# @ytn/shared/template

Dynamic template rendering, tag injection, and safe YAML parsing. This package provides lightweight tools for content generation and structured configuration analysis.

## Table of Contents

- [Template Rendering (tpl)](#template-rendering-tpl)
- [YAML and Frontmatter (yaml)](#yaml-and-frontmatter-yaml)
  - [safeParseYaml](#safeparseyaml)
  - [safeToYaml](#safetoyaml)
  - [extractSafeFrontmatter](#extractsafefrontmatter)
  - [buildWithSafeFrontmatter](#buildwithsafefrontmatter)

---

## Template Rendering (`tpl`)

The `tpl` namespace offers a direct approach to string interpolation using tag-based injection.

### Tag Injection: `renderTemplate(text, tagmap)`

Replaces multiple placeholders in a string using a predefined map.

```typescript
import { renderTemplate } from "@ytn/shared/template/template-parser.js";

const text = "Hello {{ name }}! Welcome to {{ city }}.";
const tags = [
  { tag: "{{ name }}", txt: "Admin" },
  { tag: "{{ city }}", txt: "Paris" },
];

const result = renderTemplate(text, tags);
console.log(result); // "Hello Admin! Welcome to Paris."
```

---

## YAML and Frontmatter (`yaml`)

We use a safe and type-verified YAML parser to handle complex configurations.

### `safeParseYaml`

Deterministic YAML parsing using the **SafeMode** philosophy. Returns a `SafeResult`.

```typescript
import { safeParseYaml } from "@ytn/shared/template/yaml-parser.js";
const [err, config] = safeParseYaml(rawYaml);
```

### `safeToYaml`

Bidirectional serialization. Transforms a JavaScript object back into a clean YAML string.

### `extractSafeFrontmatter`

Specialized utility for parsing markdown or text files with `---` YAML headers. Returns both the structured data and the remaining content.

```typescript
import { extractSafeFrontmatter } from "@ytn/shared/template/yaml-parser.js";

const raw = "---\ntitle: Hello\n---\nBody text here";
const [err, { data, content }] = extractSafeFrontmatter(raw);

console.log(data.title); // "Hello"
console.log(content); // "Body text here"
```

### `buildWithSafeFrontmatter`

The inverse of extraction. Wraps structured metadata around a text body using standard `---` separators.
