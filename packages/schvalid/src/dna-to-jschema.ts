/**
 * @file dna-to-jschema.ts
 * @description Decompiler to transform DNA bytecode back into a JSON Schema.
 */

export function dnaToJSchema(dna: any[]): any {
  if (!Array.isArray(dna) || dna.length === 0) return {};

  const cache = new Map<number, any>();

  function resolve(idx: number): any {
    if (cache.has(idx)) return cache.get(idx);

    // Handle special sentinel values
    if (idx === -1) return true; // true schema
    if (idx === -2) return false; // false schema

    const instruction = dna[idx];
    if (!Array.isArray(instruction)) return instruction;

    const [op, ...args] = instruction;
    let schema: any = {};

    // Place a placeholder in cache for recursive structures
    cache.set(idx, schema);

    switch (op) {
      case "string":
      case "s":
        schema.type = "string";
        // Handle compact constraint format: [minLength, maxLength, pattern, format]
        if (args.length > 0 && Array.isArray(args[0])) {
          const [minVal, maxVal, patternVal, formatVal] = args[0];
          if (minVal !== null && minVal !== undefined) schema.minLength = minVal;
          if (maxVal !== null && maxVal !== undefined) schema.maxLength = maxVal;
          if (patternVal !== null && patternVal !== undefined) schema.pattern = patternVal;
          if (formatVal !== null && formatVal !== undefined) schema.format = formatVal;
        }
        break;
      case "number":
      case "n":
        schema.type = "number";
        // Handle compact constraint format: [minimum, exclusiveMinimum, maximum, exclusiveMaximum, multipleOf]
        if (args.length > 0 && Array.isArray(args[0])) {
          const [minVal, exclMinVal, maxVal, exclMaxVal, multOfVal] = args[0];
          if (minVal !== null && minVal !== undefined) schema.minimum = minVal;
          if (exclMinVal !== null && exclMinVal !== undefined) schema.exclusiveMinimum = exclMinVal;
          if (maxVal !== null && maxVal !== undefined) schema.maximum = maxVal;
          if (exclMaxVal !== null && exclMaxVal !== undefined) schema.exclusiveMaximum = exclMaxVal;
          if (multOfVal !== null && multOfVal !== undefined) schema.multipleOf = multOfVal;
        }
        break;
      case "integer":
      case "i":
        schema.type = "integer";
        // Handle compact constraint format: [minimum, exclusiveMinimum, maximum, exclusiveMaximum, multipleOf]
        if (args.length > 0 && Array.isArray(args[0])) {
          const [minVal, exclMinVal, maxVal, exclMaxVal, multOfVal] = args[0];
          if (minVal !== null && minVal !== undefined) schema.minimum = minVal;
          if (exclMinVal !== null && exclMinVal !== undefined) schema.exclusiveMinimum = exclMinVal;
          if (maxVal !== null && maxVal !== undefined) schema.maximum = maxVal;
          if (exclMaxVal !== null && exclMaxVal !== undefined) schema.exclusiveMaximum = exclMaxVal;
          if (multOfVal !== null && multOfVal !== undefined) schema.multipleOf = multOfVal;
        }
        break;
      case "boolean":
      case "b":
        schema.type = "boolean";
        break;
      case "null":
        schema.type = "null";
        break;
      case "any":
        break; // Empty schema
      case "true":
        cache.set(idx, true);
        return true;
      case "false":
        cache.set(idx, false);
        return false;

      case "enum":
        schema.enum = args[0];
        break;

      case "$ref":
        schema.$ref = args[1];
        break;

      case "minLength":
      case "minL":
        schema.minLength = args[0];
        break;
      case "maxLength":
      case "maxL":
        schema.maxLength = args[0];
        break;
      case "eqLength":
      case "eqL":
        schema.minLength = schema.maxLength = args[0];
        break;
      case "pattern":
      case "pat":
        schema.pattern = args[0];
        break;

      case "minimum":
      case "min":
        schema.minimum = args[0];
        break;
      case "maximum":
      case "max":
        schema.maximum = args[0];
        break;
      case "exclusiveMinimum":
      case "exclMin":
        schema.exclusiveMinimum = args[0];
        break;
      case "exclusiveMaximum":
      case "exclMax":
        schema.exclusiveMaximum = args[0];
        break;
      case "multipleOf":
      case "mult":
        schema.multipleOf = args[0];
        break;
      case "minItems":
      case "minI":
        schema.minItems = args[0];
        break;
      case "maxItems":
      case "maxI":
        schema.maxItems = args[0];
        break;
      case "uniqueItems":
      case "uniq":
        schema.uniqueItems = true;
        break;

      case "email":
        schema.format = "email";
        break;
      case "uuid":
        schema.format = "uuid";
        break;
      case "url":
        schema.format = "uri";
        break;

      case "array":
      case "a":
        schema.type = "array";
        const innerRefs = args[0];
        if (Array.isArray(innerRefs)) {
          for (const ref of innerRefs) {
            const res = resolve(ref);
            if (res && res.__prefixItems)
              schema.prefixItems = res.__prefixItems;
            else if (res && res.__uniqueItems) schema.uniqueItems = true;
            else if (res && res.items) schema.items = res.items;
            else if (res && res.__contains) {
              schema.contains = res.__contains.schema;
              if (res.__contains.min !== undefined)
                schema.minContains = res.__contains.min;
              if (res.__contains.max !== undefined)
                schema.maxContains = res.__contains.max;
            } else if (res && res.__minItems) schema.minItems = res.__minItems;
            else if (res && res.__maxItems) schema.maxItems = res.__maxItems;
            else if (res && res.__minContains) schema.minContains = res.__minContains;
            else if (res && res.__maxContains) schema.maxContains = res.__maxContains;
            else if (typeof res === "object" && Object.keys(res).length > 0) Object.assign(schema, res);
          }
        }
        break;

      case "tuple":
        schema.type = "array";
        schema.prefixItems = args[0].map(resolve);
        schema.additionalItems = false;
        break;

      case "items":
        if (args.length > 1 && args[1] !== undefined) {
          // items with offset (for additional items after prefixItems)
          return { items: resolve(args[0][0]) };
        }
        return { items: resolve(args[0][0]) };

      case "prefixItems":
        return { __prefixItems: args[0].map(resolve) };

      case "uniqueItems":
        return { __uniqueItems: true };

      case "contains":
        return {
          __contains: { schema: resolve(args[0]), min: args[1], max: args[2] },
        };

      case "minItems":
        return { __minItems: args[0] };

      case "maxItems":
        return { __maxItems: args[0] };

      case "minContains":
        return { __minContains: args[0] };

      case "maxContains":
        return { __maxContains: args[0] };

      case "unevaluatedItems":
        schema.unevaluatedItems = resolve(args[0]);
        break;

      case "object":
      case "o":
        schema.type = "object";
        const refs = args[0];
        if (Array.isArray(refs)) {
          for (const refIdx of refs) {
            const part = resolve(refIdx);
            Object.assign(schema, part);
          }
        }
        break;

      case "strictObject":
        schema.type = "object";
        schema.additionalProperties = false;
        const strictRefs = args[0];
        if (Array.isArray(strictRefs)) {
          for (const refIdx of strictRefs) {
            const part = resolve(refIdx);
            Object.assign(schema, part);
          }
        }
        break;

      case "looseObject":
        schema.type = "object";
        schema.additionalProperties = true;
        const looseRefs = args[0];
        if (Array.isArray(looseRefs)) {
          for (const refIdx of looseRefs) {
            const part = resolve(refIdx);
            Object.assign(schema, part);
          }
        }
        break;

      case "obj":
        schema.type = "object";
        const objRefs = args[0];
        if (Array.isArray(objRefs)) {
          for (const refIdx of objRefs) {
            const part = resolve(refIdx);
            Object.assign(schema, part);
          }
        }
        break;

      case "properties":
        schema.properties = {};
        for (const pIdx of args[0]) {
          const p = resolve(pIdx);
          if (p && p.__prop) schema.properties[p.__prop.key] = p.__prop.schema;
        }
        break;

      case "proptype":
        return { __prop: { key: args[0], schema: resolve(args[1][0]) } };

      case "const":
        schema.const = args[0];
        break;

      case "required":
        schema.required = args[0];
        break;

      case "dependentRequired":
      case "dr":
        schema.dependentRequired = args[0];
        break;

      case "dependentSchemas":
      case "ds": {
        schema.dependentSchemas = {};
        for (const [k, idx] of Object.entries(
          args[0] as Record<string, number>,
        )) {
          schema.dependentSchemas[k] = resolve(idx);
        }
        break;
      }

      case "propertyNames":
      case "pn":
        schema.propertyNames = resolve(args[0]);
        break;

      case "additionalProperties": {
        const idx = args[0][0];
        if (idx === -1) {
          schema.additionalProperties = true;
        } else if (idx === -2) {
          schema.additionalProperties = false;
        } else {
          const res = resolve(idx);
          schema.additionalProperties = res;
        }
        const allowedKeys = args[1];
        const patterns = args[2];
        if (allowedKeys && allowedKeys.length > 0) {
          // If allowedKeys is specified, it's handled in the compilation logic
          // but for decompilation we just set the schema
        }
        break;
      }

      case "patternProperties": {
        schema.patternProperties = {};
        for (const [pattern, idx] of args[0]) {
          schema.patternProperties[pattern] = resolve(idx[0]);
        }
        break;
      }

      case "unevaluatedProperties":
        schema.unevaluatedProperties = resolve(args[0][0]);
        break;

      case "minProperties":
      case "minP":
        schema.minProperties = args[0];
        break;
      case "maxProperties":
      case "maxP":
        schema.maxProperties = args[0];
        break;

      case "anyOf":
        // Filter out the last element which is a JSON description
        const anyOfRefs = args[0].slice(0, -1);
        schema.anyOf = anyOfRefs.map(resolve);
        break;
      case "oneOf":
        // Filter out the last element which is a JSON description
        const oneOfRefs = args[0].slice(0, -1);
        schema.oneOf = oneOfRefs.map(resolve);
        break;
      case "allOf":
        // Filter out the last element which is a JSON description
        const allOfRefs = args[0].slice(0, -1);
        schema.allOf = allOfRefs.map(resolve);
        break;
      case "not":
        schema.not = resolve(args[0][0]);
        break;

      case "ifThenElse": {
        const ifSchema = resolve(args[0]);
        const thenSchema = resolve(args[1]);
        const elseIdx = args[2];

        // If else is -1 (any schema), this is a type-specific constraint
        // Simplify to just the then branch (the constraint)
        if (elseIdx === -1) {
          Object.assign(schema, thenSchema);
        } else if (elseIdx !== undefined) {
          schema.if = ifSchema;
          schema.then = thenSchema;
          schema.else = resolve(elseIdx);
        } else {
          schema.if = ifSchema;
          schema.then = thenSchema;
        }
        break;
      }

      case "seq": {
        for (const sIdx of args[0]) {
          Object.assign(schema, resolve(sIdx));
        }
        break;
      }

      case "nullable":
        Object.assign(schema, resolve(args[0][0]));
        if (schema.type && !Array.isArray(schema.type))
          schema.type = [schema.type, "null"];
        break;

      case "optional":
        Object.assign(schema, resolve(args[0][0]));
        break;

      case "prefault":
        Object.assign(schema, resolve(args[0][0]));
        break;

      case "default":
      case "d":
        Object.assign(schema, resolve(args[0][0]));
        schema.default = args[1];
        break;

      case "$defs":
      case "definitions": {
        const defs: Record<string, any> = {};
        for (const [name, idx] of Object.entries(
          args[0] as Record<string, number>,
        )) {
          defs[name] = resolve(idx);
        }
        schema[op] = defs;
        break;
      }

      case "dynRef":
      case "$dr":
        schema.$dynamicRef = "#" + args[0];
        break;

      case "dynAnchor":
      case "$da": {
        // dynAnchor wraps an inner instruction
        const innerIdx = args[1];
        const innerSchema = resolve(innerIdx);
        Object.assign(schema, innerSchema);
        schema.$dynamicAnchor = args[0];
        break;
      }

      default:
        break;
    }

    return schema;
  }

  const finalSchema = resolve(0);

  // Final pass to find the floated $defs/definitions opcodes in DNA
  // These are separate instructions in the DNA array (compiled after root schema)
  for (let i = 0; i < dna.length; i++) {
    const instruction = dna[i];
    if (Array.isArray(instruction)) {
      const [op, args] = instruction;
      if (op === "$defs" || op === "definitions") {
        const defs: Record<string, any> = {};
        for (const [name, idx] of Object.entries(
          args as Record<string, number>,
        )) {
          defs[name] = resolve(idx);
        }
        // Only add if not already present (avoid duplicates)
        if (!finalSchema[op]) {
          finalSchema[op] = defs;
        }
      }
    }
  }

  // Clean up internal properties
  const cleaned = JSON.parse(
    JSON.stringify(finalSchema, (k, v) => (k.startsWith("__") ? undefined : v)),
  );

  // Handle boolean schema true (compiled as ["any"] with no constraints)
  if (Object.keys(cleaned).length === 0 && !finalSchema.$defs && !finalSchema.definitions) {
    // Check if the root instruction is ["any"]
    const rootInstruction = dna[0];
    if (Array.isArray(rootInstruction) && rootInstruction[0] === "any" && rootInstruction.length === 1) {
      return true;
    }
  }

  return cleaned;
}
