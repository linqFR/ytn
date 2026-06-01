/**
 * @deprecated
 * Zod to DNA conversion is deprecated.
 * schvalid now focuses on JSON Schema to DNA conversion only.
 * Use @ytn/dna for schema building with Zod-like syntax.
 */
import { z } from "zod";
import { getZodShape, unwrapZod } from "@ytn/shared/zod/zod-reflection.js";
import { fastMergeArrays } from "@ytn/dna/toJs/utils.js";
import type { tsDna } from "./dna.type.js";

/**
 * Extract metadata from Zod schema's toJSONSchema output
 * toJSONSchema() handles registry, meta, and describe() internally
 */
function extractMeta(schema: any): Record<string, any> | {} {
  try {
    const jsonSchema = schema.toJSONSchema ? schema.toJSONSchema() : null;
    if (jsonSchema) {
      // Extract all metadata fields (description, title, etc.)
      const result: Record<string, any> = {};
      if (jsonSchema.description) result.description = jsonSchema.description;
      if (jsonSchema.title) result.title = jsonSchema.title;
      if (jsonSchema.examples) result.examples = jsonSchema.examples;
      // Add any other metadata fields
      Object.keys(jsonSchema).forEach(key => {
        if (!['type', 'properties', 'items', 'required', 'additionalProperties', 'patternProperties', 'anyOf', 'allOf', 'oneOf', 'not', 'enum', 'const', 'format', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', 'uniqueItems', 'minProperties', 'maxProperties', '$id', '$schema', '$defs', 'definitions'].includes(key)) {
          result[key] = jsonSchema[key];
        }
      });
      return result;
    }
  } catch (e) {
    // Ignore errors from toJSONSchema
  }
  return {};
}

/**
 * @function zodToDna
 * @description Converts a Zod schema to DNA bytecode representation using iterative approach.
 * Uses flat indexed DNA format like jschema-to-dna.
 *
 * @param {z.ZodType} schema - The Zod schema to convert.
 * @returns {tsDna} The DNA bytecode representation.
 */
export function zodToDna(schema: z.ZodType): tsDna {
  // Flat DNA array (object-based like jschema-to-dna)
  const dna: { [idx: number]: tsDna } = { 0: ["T", {}] };
  let countDNA = 0;

  // Store for placeholder replacements
  const store = new Map<number, any>();

  // DNA cache to avoid duplicate DNA instructions for identical schemas
  const dnaCache = new Map<string, number>();

  // Lazy memoization — Zod's analogue of jschema's `refDNACache`. Maps each
  // `ZodLazy` instance to the DNA index of its `ref` entry, so subsequent
  // encounters (e.g. self-recursion) emit a parent-slot fill back to the
  // existing entry instead of looping into the resolver.
  const lazyMap = new Map<any, number>();
  let lazyIdCounter = 0;

  // Helper to set a store entry
  let storeId = 0;
  const setStore = (targets: any): number => {
    const storeSize = storeId++;
    store.set(storeSize, targets);
    return storeSize;
  };

  // Helper to update a store position
  const updateStore = (storeMark: number, targetIdx: number, position?: number | number[]) => {
    if (typeof position === "number") store.get(storeMark)[position] = targetIdx;
    else if (Array.isArray(position)) store.get(storeMark)[position[0]][position[1]] = targetIdx;
    else store.set(storeMark, targetIdx);
  };

  // Cycle-safe key generator for the DNA dedup cache.
  // Some type-handler cache keys include LIVE Zod schemas (e.g. arrays embed
  // their `itemSchema`, objects embed their `shape`). For recursive Zod
  // schemas (`z.lazy(...)` cycles), `JSON.stringify` would throw. Here we
  // substitute every Zod node with a stable per-instance id so the resulting
  // key is finite and dedup-friendly. Two structurally identical recursive
  // schemas remain de-duplicated as long as their Zod instances align.
  const zodKeyMap = new WeakMap<any, number>();
  let zodKeyCounter = 0;
  const cacheKey = (meta: any): string => {
    return JSON.stringify(meta, (_k, v) => {
      if (v && typeof v === "object" && (v as any)._zod) {
        let id = zodKeyMap.get(v);
        if (id === undefined) { id = zodKeyCounter++; zodKeyMap.set(v, id); }
        return "@zod#" + id;
      }
      return v;
    });
  };

  // Helper to update DNA (exact pattern from jschema-to-dna)
  const updateDNA = (meta: any, byteDNA: any): number => {
    byteDNA.push(meta[meta.length - 1]);
    const _dna = cacheKey(meta);
    if (dnaCache.has(_dna)) return dnaCache.get(_dna);
    const idx = countDNA++;
    dna[idx] = byteDNA;
    dnaCache.set(_dna, idx);
    return idx;
  };

  // Helper to emit DNA instruction with optional store (exact pattern from jschema-to-dna)
  const storeDNA = (meta: any, byteDNA: any, storeMark?: number | null, storePosition?: number | number[]): number => {
    const idx = updateDNA(meta, byteDNA);
    if (typeof storeMark === "number") {
      updateStore(storeMark, idx, storePosition);
    }
    return idx;
  };

  // Stack for iterative processing (matches jschema-to-dna pattern)
  const stack: [z.ZodType, number | null, number | undefined][] = [];

  stack.push([schema, null, undefined]);

  const storePosition: any = (opt?: number): number | undefined => {
    if (typeof opt === "number" && opt > 0) { storePosition.fixed = opt }
    if (typeof opt === "undefined") { return storePosition.mode === "counter" ? storePosition.counter++ : storePosition.fixed; }
  };
  storePosition.count = () => { storePosition.mode = "counter"; storePosition.counter = 0; };
  storePosition.fix = (val: number) => { storePosition.mode = "fix"; storePosition.fixed = val };

  while (stack.length > 0) {
    const item = stack.pop()!;
    const [schema, _storeMark, _storePosition] = item;
    storePosition.fix(_storePosition);
    let storeMark = _storeMark;

    // Wrappers (`optional`, `nullable`) MUST be processed BEFORE their inner
    // schema, otherwise the inner ends up at the lowest DNA index and the
    // runtime (which starts dispatch at index 0) would skip the wrapper.
    // Pattern is identical to the way `array` / `object` reserve their own
    // index first and push children onto the stack to fill placeholder slots.
    if (schema instanceof z.ZodOptional) {
      const innerSchema = schema._zod.def.innerType;
      const innerDef: number[] = [-1];
      const innerStoreId = setStore(innerDef);
      storeDNA([innerSchema, extractMeta(schema)], ["optional", innerDef], storeMark, storePosition());
      stack.push([innerSchema, innerStoreId, 0]);
      continue;
    }
    if (schema instanceof z.ZodNullable) {
      const innerSchema = schema._zod.def.innerType;
      const innerDef: number[] = [-1];
      const innerStoreId = setStore(innerDef);
      storeDNA([innerSchema, extractMeta(schema)], ["nullable", innerDef], storeMark, storePosition());
      stack.push([innerSchema, innerStoreId, 0]);
      continue;
    }
    // `default` / `prefault`: undefined-substitution wrappers.
    //   default  → undefined input becomes the default OUTPUT (skip inner validation).
    //   prefault → undefined input is replaced upstream, then validated by inner.
    //
    // KNOWN LIMITATION (eager getter evaluation):
    // Zod V4 stores `defaultValue` as an accessor whose getter calls the
    // user-supplied function on every read AND returns the result. The original
    // function is hidden inside the property's closure with no public way to
    // recover its source. Therefore the FIRST access (here) freezes the value,
    // and subsequent parses always reuse it. Static defaults (numbers, strings,
    // objects) round-trip correctly; non-deterministic getters such as
    // `() => Date.now()` capture a single timestamp at conversion time.
    // A future improvement is to stash the Zod schema's getter in the
    // compiler's `extras` registry and reference it by name in generated code,
    // restoring lazy semantics at the cost of an external binding.
    // `z.lazy(() => Schema)` — forward declaration for recursive types.
    //
    // Implemented EXACTLY like jschema's `$ref`: a `refDef` array
    // `["ref", -1]` is registered as both DNA byteCode AND a store entry.
    // The inner schema is pushed onto the stack with that store; when it
    // completes, the placeholder `-1` is mutated in place to the inner's
    // actual DNA index. Subsequent encounters of the SAME `ZodLazy` instance
    // (typically through self-recursion) just point the parent slot at the
    // previously-registered ref entry — no extra DNA emission.
    //
    // Cache key: a fresh numeric id (NOT the Zod schema), because Zod
    // schemas can hold cyclic internals that break `JSON.stringify` used
    // by `dnaCache`.
    if (schema instanceof z.ZodLazy) {
      const cachedRefIdx = lazyMap.get(schema);
      if (cachedRefIdx !== undefined) {
        // Re-encounter — wire the parent's slot to the existing ref entry.
        // No new DNA is stored; the recursion loop closes here.
        if (typeof storeMark === "number") updateStore(storeMark, cachedRefIdx, storePosition());
        continue;
      }
      const refDef: [string, number] = ["ref", -1];
      const refStoreId = setStore(refDef);
      // Push the inner FIRST so that, when popped, its `storeDNA` mutates
      // `refDef[1]` to the real index. Pushing before `storeDNA` here is
      // safe because the loop only pops AFTER this handler returns.
      const innerSchema = schema._zod.def.getter();
      stack.push([innerSchema, refStoreId, 1]);
      const refDnaId = storeDNA(["lazy", lazyIdCounter++, {}], refDef, storeMark, storePosition());
      lazyMap.set(schema, refDnaId);
      continue;
    }

    if (schema instanceof z.ZodDefault || schema instanceof z.ZodPrefault) {
      const isPrefault = schema instanceof z.ZodPrefault;
      const def = schema._zod.def;
      const innerSchema = def.innerType;
      const value = def.defaultValue; // eager — see comment above
      const innerDef: number[] = [-1];
      const innerStoreId = setStore(innerDef);
      const opcode = isPrefault ? "prefault" : "default";
      storeDNA([innerSchema, value, extractMeta(schema)], [opcode, innerDef, JSON.stringify(value)], storeMark, storePosition());
      stack.push([innerSchema, innerStoreId, 0]);
      continue;
    }

    const unwrapped = unwrapZod(schema);

    // Compute metadata ONCE per loop iteration. Mirrors the pattern used in
    // `jschema-to-dna`. Avoids the previous per-type-case `extractMeta(...)`
    // which re-invoked `schema.toJSONSchema()` (expensive) for every dispatch
    // branch we touched. Branches that need to add a marker (e.g. zodType for
    // `unknown` / `void`) spread `meta` and append their own field.
    const meta = extractMeta(unwrapped);

    // No-op now that wrappers are handled above. Kept as a hand-off helper
    // so the per-type cases below can stay untouched.
    const applyModifiers = (baseIndex: number): number => baseIndex;

    // Array
    if (schema instanceof z.ZodArray) {
      const itemSchema = schema.element;
      const arrayStoreId = setStore([-1]);
      const baseIndex = storeDNA(["a", itemSchema, {}], ["a", [-1]], arrayStoreId, 0);
      stack.push([itemSchema, arrayStoreId, 0]);
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Tuple (ZodTuple maps to prefixItems in DNA)
    if (schema instanceof z.ZodTuple) {
      const items = schema._zod.items || [];

      if (items.length === 0) {
        const baseIndex = storeDNA(["a", null, null, null, null, null, [], null, null, null, {}], ["a", []], storeMark, storePosition());
        const finalIndex = applyModifiers(baseIndex);
        continue;
      }

      // Use prefixItems pattern like jschema-to-dna
      const prefixItemsDef: number[] = Array(items.length).fill(-1);
      const itemToSeq = [["prefixItems", prefixItemsDef]];
      const prefixItemsStoreId = setStore(prefixItemsDef);
      prefixItemsDef.fill(prefixItemsStoreId);

      const localStack = [];
      for (let i = 0; i < items.length; i++) {
        localStack.push([items[i], prefixItemsStoreId, i]);
      }
      fastMergeArrays(stack, localStack);

      const baseIndex = storeDNA(["a", null, null, null, null, null, items, null, null, null, {}], ["a", itemToSeq], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }



    // String (including all format variants which extend ZodString)
    const stringFormatTypes = [
      "ZodEmail", "ZodUUID", "ZodUrl", "ZodHttpUrl", "ZodHostname", "ZodE164",
      "ZodEmoji", "ZodBase64", "ZodBase64url", "ZodHex", "ZodJwt", "ZodNanoid",
      "ZodCuid", "ZodCuid2", "ZodUlid", "ZodIpv4", "ZodIpv6", "ZodMac",
      "ZodCidrv4", "ZodCidrv6", "ZodHash", "ZodIsoDate", "ZodIsoTime",
      "ZodIsoDatetime", "ZodIsoDuration"
    ];
    if (unwrapped instanceof z.ZodString || stringFormatTypes.includes(unwrapped.constructor.name)) {
      const bag = unwrapped._zod.bag || {};
      const minVal = bag.minimum !== undefined ? bag.minimum : null;
      const maxVal = bag.maximum !== undefined ? bag.maximum : null;

      // Extract pattern from checks for formats like email
      const checks = unwrapped._zod.def.checks || [];
      let patternVal = null;

      for (const check of checks) {
        if (check.def && check.def.pattern && typeof check.def.pattern === 'string') {
          patternVal = check.def.pattern;
          break;
        }
      }

      // If no pattern found in checks, try to extract from toJSONSchema
      if (!patternVal && bag.format) {
        try {
          const jsonSchema = unwrapped.toJSONSchema ? unwrapped.toJSONSchema() : null;
          if (jsonSchema && jsonSchema.pattern) {
            patternVal = jsonSchema.pattern;
          }
        } catch (e) {
          // Ignore errors from toJSONSchema
        }
      }

      // Always include format (for compatibility/future use)
      const formatVal = bag.format !== undefined ? bag.format : null;

      const baseIndex = storeDNA(["s", minVal, maxVal, patternVal, formatVal, meta], ["s", [minVal, maxVal, patternVal, formatVal]], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Number
    if (unwrapped instanceof z.ZodNumber) {
      const bag = unwrapped._zod.bag || {};
      const minVal = bag.minimum !== undefined ? bag.minimum : null;
      const maxVal = bag.maximum !== undefined ? bag.maximum : null;
      const multOfVal = bag.multipleOf !== undefined ? bag.multipleOf : null;
      const isInt = bag.format === "safeint";

      // Handle exclusive bounds
      const hasExclMin = bag.exclusiveMinimum !== undefined;
      const hasExclMax = bag.exclusiveMaximum !== undefined;

      // Follow jschema-to-dna logic
      const effectiveMinVal = hasExclMin ? bag.exclusiveMinimum : minVal;
      const effectiveMaxVal = hasExclMax ? bag.exclusiveMaximum : maxVal;
      const exclMinVal = hasExclMin ? true : null;
      const exclMaxVal = hasExclMax ? true : null;

      const opcode = isInt ? "i" : "n";
      const baseIndex = storeDNA([opcode, minVal, maxVal, multOfVal, bag.exclusiveMinimum, bag.exclusiveMaximum, meta], [opcode, [effectiveMinVal, exclMinVal, effectiveMaxVal, exclMaxVal, multOfVal]], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Boolean
    if (schema instanceof z.ZodBoolean) {
      const baseIndex = storeDNA(["b", meta], ["b"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // NaN — accepts only the NaN value (any type)
    if (unwrapped instanceof z.ZodNaN) {
      const baseIndex = storeDNA(["nan", meta], ["nan"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // BigInt
    if (unwrapped instanceof z.ZodBigInt) {
      const baseIndex = storeDNA(["bi", meta], ["bi"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Date — Zod's `z.date()` accepts a real `Date` instance (NOT an ISO
    // string; that would be `z.iso.date()` mapped to `s` with format "date").
    if (unwrapped instanceof z.ZodDate) {
      const baseIndex = storeDNA(["date", meta], ["date"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Symbol
    if (unwrapped instanceof z.ZodSymbol) {
      const baseIndex = storeDNA(["sym", meta], ["sym"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // File
    if (unwrapped instanceof z.ZodFile) {
      const baseIndex = storeDNA(["file", meta], ["file"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Null
    if (unwrapped instanceof z.ZodNull) {
      const baseIndex = storeDNA(["n0", meta], ["n0"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Undefined / Void — both accept only `undefined`. Reuse the existing
    // `undefined` opcode; tag void via meta so a back-conversion can recover
    // the `z.void()` form if needed.
    if (unwrapped instanceof z.ZodUndefined) {
      const baseIndex = storeDNA(["undefined", meta], ["undefined"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }
    if (unwrapped instanceof z.ZodVoid) {
      const baseIndex = storeDNA(["undefined", { ...meta, zodType: "void" }], ["undefined"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Any (ZodAny maps to a true schema — accepts everything). The meta tuple's
    // first cell is just a discriminant for the DNA cache; using "any" / "unknown"
    // / "never" keeps it self-explanatory regardless of where the schema sits in
    // the tree (the previous "#/true" / "#/false" labels suggested a root-level
    // JSON Schema canonical path, which is misleading for nested occurrences).
    if (unwrapped instanceof z.ZodAny) {
      const baseIndex = storeDNA(["any", meta], ["T"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Unknown (also a true schema, but tagged via meta so a round-trip back
    // to Zod can recover the `z.unknown()` form).
    if (unwrapped instanceof z.ZodUnknown) {
      const baseIndex = storeDNA(["unknown", { ...meta, zodType: "unknown" }], ["T"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Never (false schema — rejects everything).
    if (unwrapped instanceof z.ZodNever) {
      const baseIndex = storeDNA(["never", meta], ["F"], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Literal
    if (unwrapped instanceof z.ZodLiteral) {
      const def = unwrapped._zod.def;
      const values = def.values;

      // Check if literal has multiple values (behaves like enum)
      if (Array.isArray(values) && values.length > 1) {
        const hasComplex = values.some((v: unknown) => v !== null && typeof v === "object");
        // Use values array in meta (not hash) to distinguish from ZodEnum
        const baseIndex = storeDNA([values, meta], [hasComplex ? "eD" : "e", values], storeMark, storePosition());
        const finalIndex = applyModifiers(baseIndex);
        continue;
      }

      // Single value literal
      const value = Array.isArray(values) ? values[0] : values;
      const opcode = typeof value === "object" && value !== null ? "cD" : "c";
      const baseIndex = storeDNA([value, meta], [opcode, JSON.stringify(value)], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Enum
    if (unwrapped instanceof z.ZodEnum) {
      const values = unwrapped.options;
      const enumObj = unwrapped.enum;
      const hasComplex = values.some((v: unknown) => v !== null && typeof v === "object");
      // Use enum object (hash) in meta for distinction from literal multi-value
      const baseIndex = storeDNA([enumObj, meta], [hasComplex ? "eD" : "e", values], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Discriminated Union (check before Union since ZodDiscriminatedUnion extends ZodUnion)
    if (schema instanceof z.ZodDiscriminatedUnion) {
      const def = schema._zod.def;
      const discriminator = def.discriminator; // Property name
      const options = def.options; // Array of object schemas

      const discriminatorKeys: any[] = [];
      const discriminatorDef = new Array(options.length);
      const discriminatorStoreId = setStore(discriminatorDef);

      // Initialize placeholders
      for (let i = 0; i < options.length; i++) {
        discriminatorDef[i] = -1;
      }

      // Push schemas to stack first (they will be processed and fill placeholders)
      const localStack = [];
      for (let i = options.length - 1; i >= 0; i--) {
        const optionSchema = options[i];
        // Extract discriminator value from the literal property
        const shape = getZodShape(optionSchema);
        const discriminatorProp = shape[discriminator];
        // Zod V4: no public API for literal value, use internal ._zod.def
        const discriminatorValue = discriminatorProp._zod.def.value;
        discriminatorKeys[i] = JSON.stringify(discriminatorValue);

        // Create modified schema without discriminator property
        const shapeWithoutDiscriminator: any = { ...shape };
        delete shapeWithoutDiscriminator[discriminator];

        // Create a new object schema without the discriminator property
        const modifiedSchema = z.object(shapeWithoutDiscriminator);

        localStack.push([modifiedSchema, discriminatorStoreId, i]);
      }
      fastMergeArrays(stack, localStack);

      // Then call storeDNA with storeMark to register the discriminator DNA
      const prevStoreMark = storeMark;
      const prevStorePositionMode = storePosition.mode;
      storeMark = discriminatorStoreId;
      storePosition.count();

      const baseIndex = storeDNA([discriminator, options, meta], ["discriminator", JSON.stringify(discriminator), discriminatorKeys, discriminatorDef], storeMark, storePosition());

      // Restore previous storeMark
      storeMark = prevStoreMark;
      storePosition.mode = prevStorePositionMode;

      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Union
    if (schema instanceof z.ZodUnion) {
      // Zod V4: no public API for options, use internal ._zod.def
      const options = schema._zod.def.options;
      const unionDef = new Array(options.length + 1);
      const unionStoreId = setStore(unionDef);
      unionDef.fill(unionStoreId);
      unionDef[0] = JSON.stringify(JSON.stringify(options)).slice(1, -1);

      const localStack = [];
      for (let i = 0; i < options.length; i++) {
        localStack.push([options[i], unionStoreId, i + 1]);
      }
      fastMergeArrays(stack, localStack);

      const baseIndex = storeDNA([JSON.stringify(JSON.stringify(options)).slice(1, -1), meta], ["anyOf", unionDef], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Intersection
    if (schema instanceof z.ZodIntersection) {
      const def = schema._zod.def;
      const leftSchema = def.left;
      const rightSchema = def.right;
      const schemas = [leftSchema, rightSchema];

      const intersectionDef = new Array(schemas.length + 1);
      const intersectionStoreId = setStore(intersectionDef);
      intersectionDef.fill(intersectionStoreId);
      intersectionDef[0] = JSON.stringify(JSON.stringify(schemas)).slice(1, -1);

      const localStack = [];
      for (let i = 0; i < schemas.length; i++) {
        localStack.push([schemas[i], intersectionStoreId, i + 1]);
      }
      fastMergeArrays(stack, localStack);

      const baseIndex = storeDNA([JSON.stringify(JSON.stringify(schemas)).slice(1, -1), meta], ["allOf", intersectionDef], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Record (maps to additionalProperties with propertyNames for key constraints)
    if (schema instanceof z.ZodRecord) {
      const def = schema._zod.def;
      const keyType = def.keyType;
      const valueType = def.valueType;

      // For ZodRecord, we use propertyNames for key schema and additionalProperties for value schema
      const itemToSeq = [];

      // Process propertyNames (key schema)
      const propNamesDef: [string, number] = ["propertyNames", -1];
      const propNamesStoreId = setStore(propNamesDef);
      propNamesDef[1] = propNamesStoreId;
      stack.push([keyType, propNamesStoreId, 1]);
      itemToSeq.push(propNamesDef);

      // Process additionalProperties (value schema)
      const addPropDef: [string, number] = ["additionalProperties", -1];
      const addPropStoreId = setStore(addPropDef);
      addPropDef[1] = addPropStoreId;
      stack.push([valueType, addPropStoreId, 1]);
      itemToSeq.push(addPropDef);

      const baseIndex = storeDNA([keyType, valueType, meta], itemToSeq, null, null);
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // Object - needs special handling for multiple children
    if (schema instanceof z.ZodObject) {
      const shape = getZodShape(schema);
      if (!shape) {
        throw new Error("ZodObject shape is undefined");
      }

      const entries = Object.entries(shape);

      // Determine object type based on strictness
      // In Zod V4, strict mode is indicated by catchall being ZodNever
      const def = schema._zod.def;
      const isStrict = def.catchall && def.catchall.constructor.name === "ZodNever";
      const isLoose = def.catchall && def.catchall.constructor.name === "ZodAny";
      const objectOp = isStrict ? "o" : isLoose ? "_o" : "o";

      if (entries.length === 0) {
        const baseIndex = storeDNA([objectOp, [], meta], [objectOp, []], storeMark, storePosition());
        const finalIndex = applyModifiers(baseIndex);
        continue;
      }

      const minProperties = undefined;
      const maxProperties = undefined;

      // Use jschema-to-dna pattern: propertiesDef with [key, storeId] tuples
      const propertiesDef: [string, number][] = [];
      const propertiesStoreId = setStore(propertiesDef);

      // Extract required fields (non-optional)
      const required: string[] = [];
      entries.forEach(([key, fieldSchema]) => {
        const isOptional = fieldSchema instanceof z.ZodOptional ||
          fieldSchema instanceof z.ZodNullable ||
          fieldSchema instanceof z.ZodDefault;
        if (!isOptional) {
          required.push(key);
        }
      });

      const localStack = [];
      for (let i = 0; i < entries.length; i++) {
        const [key, fieldSchema] = entries[i];
        propertiesDef.push([key, undefined]); // Placeholder for ref
        // Unwrap optional/nullable/default for object properties (optional is handled by required array)
        const unwrappedField = unwrapZod(fieldSchema);
        localStack.push([unwrappedField, propertiesStoreId, [i, 1]]);
      }
      fastMergeArrays(stack, localStack);

      const objectArgs: any[] = [];
      if (required.length > 0) {
        objectArgs.push(["required", required]);
      }
      objectArgs.push(["properties", propertiesDef]);

      if (isStrict) {
        objectArgs.push(["additionalProperties", false]);
      } else if (isLoose) {
        objectArgs.push(["additionalProperties", true]);
      }

      const baseIndex = storeDNA([objectOp, required, minProperties, maxProperties, shape, undefined, undefined, isStrict ? false : isLoose ? true : undefined, undefined, undefined, meta], [objectOp, objectArgs], storeMark, storePosition());
      const finalIndex = applyModifiers(baseIndex);
      continue;
    }

    // (`ZodDefault` is now handled at the top of the loop alongside other
    // wrappers — kept dead-code-free here.)

    if (schema instanceof z.ZodCodec
      && schema._zod.def.in instanceof z.ZodString
      && schema._zod.def.out instanceof z.ZodBoolean
      && schema._zod.def.transform.toString().includes('expected: "stringbool",')
    ) {
      storeDNA([], ["sb", [], []])
      continue;
    }

    if (schema instanceof z.ZodCodec) {
      const typeIn = schema._zod.def.in;
      const typeOut = schema._zod.def.out;
      const decodeFn = schema._zod.def.transform.toString();
      const encodeFn = schema._zod.def.reverseTransform.toString();
      const subSch = new Array(2);
      const codecStoreId = setStore(subSch);
      subSch.fill(codecStoreId);
      const codecDef = ["codec", [decodeFn, encodeFn], subSch];

      stack.push([typeIn, codecStoreId, 0]);
      stack.push([typeOut, codecStoreId, 0]);
      storeDNA(
        ["codec", typeIn, typeOut, decodeFn, encodeFn, extractMeta(schema)],
        codecDef,
        storeMark, storePosition()
      )
      continue;
    }

    // (`ZodLazy` is handled at the top of the loop alongside the other
    //  wrappers — see comment block there.)

    throw new Error(`Unsupported Zod type: ${schema.constructor.name}`);
  }

  // Convert object-based DNA to array format
  const finalDNA = Object.values(dna);

  // Build refList by scanning the resolved DNA. Every `ref` entry's target —
  // whether literal number (jschema) or shared array `[idx]` (lazy) — needs
  // to appear in `refList` so the compiler emits a function for it.
  const refSet = new Set<number>();
  for (const entry of finalDNA) {
    if (Array.isArray(entry) && entry[0] === "ref") {
      const t = entry[1];
      const idx = Array.isArray(t) ? t[0] : t;
      if (typeof idx === "number" && idx >= 0) refSet.add(idx);
    }
  }

  // Append complementary arrays (refList, extraArgs).
  finalDNA.push(Array.from(refSet), []);

  return finalDNA;
}
