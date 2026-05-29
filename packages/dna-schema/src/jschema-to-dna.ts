import { isPureObject } from "@ytn/shared/js/object-utils.js";
import { isValidRegex } from "@ytn/shared/regex/is-valid-regex.js";
import { resolveUri } from "./dna-helpers.js";
import { fastMergeArrays } from "./toJS/utils.js";

export class OutOfScopeError extends Error {
  constructor(feature: string) {
    super(`Out of scope: ${feature}. DNA-SChema only supports draft 2020-12 with internal references (internal $ref, $def, $id).`);
    this.name = "OutOfScopeError";
  }
}

type tsDnaId = number;
type tsDna = { [kw: tsDnaId]: any };
type tsDnaResult = any[];

type tsStoreId = tsDnaId;

type tsStore = Map<tsStoreId, any>;


export function resolvePointer(pointer: string, root: any): any | undefined {
  if (!pointer) return [root, pointer];
  if (!pointer.startsWith("#")) return undefined;

  const fragment = pointer.substring(1);
  if (!fragment || fragment === "/") return [root, pointer];

  const parts = fragment.split("/");
  let target = root;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === 0 && part === "") continue;
    if (target === undefined || target === null || typeof target !== "object") return undefined;

    const key = part === "" ? "" : decodeURIComponent(part.replace(/~1/g, "/").replace(/~0/g, "~"));
    target = target[key];
  }

  return [target, pointer];
}


const COMPOSITE_OF = ["allOf", "anyOf", "oneOf"];
const META_KEYS = [
  "$id",
  "$anchor",
  "$dynamicAnchor",
  // "$ref",
  "title",
  "description",
  "default",
  "examples",
  "$comment",
  "readOnly",
  "writeOnly",
  "deprecated",
  "contentEncoding",
  "contentMediaType",
  "contentSchema",
];
const META_SET = new Set(META_KEYS);


const isTrueSchema = (node: true | {}) => (node === true) || (node && Object.keys(node).length === 0 && node.constructor === Object);


export function jschemaToDna(root: any, rootPath = "#"): tsDnaResult {
  if (root.$schema && !root.$schema.includes("2020-12")) {
    throw new OutOfScopeError(`JSON Schema version ${root.$schema}`);
  }

  const dna: tsDna = { 0: ["T", {}] };
  const store: tsStore = new Map();
  const dnaCache = new Map();

  const uriMap = new Map<string, [keyof typeof dna, string]>();
  const parentUriMap = new Map<string, string>();
  const refDNACache = new Map<string, number>();
  const refDNAList: [string, number][] = [];
  const extraArgs: string[] = []

  // let count: number = 0;
  let countDNA = 0;
  // let itemCount: number, markCount: number;
  let currentBase: string = typeof rootPath === "string" ? rootPath : "#";


  const updateDNA = (meta: any, byteDNA: any): number => {
    byteDNA.push(meta[meta.length - 1]);
    const _dna = JSON.stringify(meta);
    if (dnaCache.has(_dna)) return dnaCache.get(_dna);
    const idx = countDNA++;
    dna[idx] = byteDNA;
    dnaCache.set(_dna, idx);
    return idx;
  };

  const updateStore = (storeMark: number, targetIdx: number, position?: number | number[]) => {
    if (typeof position === "number") store.get(storeMark)[position] = targetIdx;
    else if (Array.isArray(position)) store.get(storeMark)[position[0]][position[1]] = targetIdx;
    else store.set(storeMark, targetIdx);
  };

  let storeId = 0;
  const setStore = (targets: any): number => {
    const storeSize = storeId++;
    store.set(storeSize, targets);
    return storeSize;
  };

  const storeDNA = (meta: any, byteDNA: any, storeMark?: number | null, storePosition?: number | number[]) => {
    const idx = updateDNA(meta, byteDNA);
    if (typeof storeMark === "number") {
      updateStore(storeMark, idx, storePosition);
    }
    return idx;
  };


  if (typeof root === "object" && root !== null && "$defs" in root) {
    const def = root.$defs;
    for (const p of Object.keys(def)) {
      const uri = currentBase + "/$defs/" + p;
      uriMap.set(uri, [def[p], uri]);
    }
  }

  // Lazy anchor scan. Walks the entire schema ONCE the first time a $ref to
  // an anchor (`#foo`, not `#/pointer`) is encountered. Schemas without any
  // anchor refs pay zero cost. Anchors are registered by ABSOLUTE URI
  // (base canon + "#" + name) so anchors of the same name under different
  // `$id` scopes do not collide. The ref handler resolves the lookup key
  // against the active `currentBase` to find the right one (spec §8.2.3.1).
  let anchorsScanned = false;
  const scanAnchorsOnce = (): void => {
    if (anchorsScanned) return;
    anchorsScanned = true;
    // Iterative DFS with explicit base tracking: each frame carries the
    // active base URI for the node being walked. Children inherit the base
    // unless the child has its own `$id` (which mints a new base).
    const walkStack: [any, string][] = [[root, currentBase]];
    while (walkStack.length > 0) {
      const [n, base] = walkStack.pop()!;
      if (!n || typeof n !== "object") continue;
      if (Array.isArray(n)) {
        for (let i = n.length; i--;) walkStack.push([n[i], base]);
        continue;
      }
      let curr = base;
      if (typeof n.$id === "string") curr = resolveUri(base, n.$id);
      const canon = curr.split("#")[0];
      if (typeof n.$anchor === "string") {
        const key = canon + "#" + n.$anchor;
        if (!uriMap.has(key)) uriMap.set(key, [n, key]);
      }
      if (typeof n.$dynamicAnchor === "string") {
        const key = canon + "#" + n.$dynamicAnchor;
        if (!uriMap.has(key)) uriMap.set(key, [n, key]);
      }
      const keys = Object.keys(n);
      for (let i = keys.length; i--;) walkStack.push([n[keys[i]], curr]);
    }
  };

  const stack = [[currentBase, root]];

  const storePosition: any = (opt?: number): number | undefined => {
    if (typeof opt === "number" && opt > 0) { storePosition.fixed = opt }
    if (typeof opt === "undefined") { return storePosition.mode === "counter" ? storePosition.counter++ : storePosition.fixed };
  };
  storePosition.count = () => { storePosition.mode = "counter"; storePosition.counter = 0; };
  storePosition.fix = (val: number) => { storePosition.mode = "fix"; storePosition.fixed = val };



  // prettier-ignore
  while (stack.length > 0) {
    const curStack = stack.pop()!;
    const [parentPath, node, _storeMark, _storePosition] = curStack;
    storePosition.fix(_storePosition);
    let storeMark = _storeMark;

    if (Array.isArray(node)) {
      continue;
    }

    // Handle boolean literal schemas and null (not objects)
    if (isTrueSchema(node)) {
      const uri = parentUriMap.get(parentPath);
      storeDNA(["#/true", uri ? { uri } : {}], ["T"], storeMark, storePosition());
      continue;
    }
    if (node === false) {
      const uri = parentUriMap.get(parentPath);
      storeDNA(["#/false", uri ? { uri } : {}], ["F"], storeMark, storePosition());
      continue;
    }
    if (node === null) {
      const uri = parentUriMap.get(parentPath);
      storeDNA(["#/null", uri ? { uri } : {}], ["n0"], storeMark, storePosition());
      continue;
    }

    if (typeof node === "object") {
      const uri = parentUriMap.get(parentPath);
      const meta: any = uri ? { uri } : {};

      for (const key of META_KEYS) {
        if (node[key] !== undefined) meta[key] = node[key];
      }

      // Track URI during parsing
      if ("$id" in node) {
        const newBase = resolveUri(currentBase, node.$id);
        currentBase = newBase;
        const canon = newBase.split("#")[0];
        uriMap.set(newBase, [node, newBase]);
        uriMap.set(canon + "#", [node, newBase]);
      }
      if ("$anchor" in node) {
        const anchorUri = currentBase.split("#")[0] + "#" + node.$anchor;
        uriMap.set(anchorUri, [node, anchorUri]);
      }
      if ("$dynamicAnchor" in node) {
        const dynUri = currentBase.split("#")[0] + "#" + node.$dynamicAnchor;
        uriMap.set(dynUri, [node, dynUri]);
      }

      const type = node.type;

      // Validate type keyword: must be string, array of strings, or undefined
      if (type !== undefined && typeof type !== "string" && !Array.isArray(type)) {
        throw new Error(`Invalid type value: ${JSON.stringify(type)}. Type must be a string or array of strings.`);
      }
      // const declaredTypes = new Set(typeof type === "undefined" ? [] : Array.isArray(type) ? type : [type]);

      // determination of pseudoTypes
      const pseudoTypes = new Set();

      if ("$ref" in node) pseudoTypes.add("$ref");

      if (typeof node.const !== "undefined") pseudoTypes.add("const");
      // Empty enum (`enum: []`) is a valid JSON Schema construct that matches
      // nothing — keep it in pseudoTypes so the opcode is still emitted.
      if (typeof node.enum !== "undefined" && Array.isArray(node.enum)) pseudoTypes.add("enum");

      const {
        // string
        minLength, maxLength, pattern, format,
        // number
        minimum, maximum, multipleOf, exclusiveMinimum, exclusiveMaximum,
        // object
        required, minProperties, maxProperties, properties, patternProperties, propertyNames, additionalProperties, unevaluatedProperties, dependentRequired, dependentSchemas,
        // array
        items, minItems, maxItems, uniqueItems, contains, prefixItems, unevaluatedItems, minContains, maxContains

      } = node

      // const { minLength, maxLength, pattern, format } = node;
      const hasMin = typeof minLength === 'number' && minLength >= 0;
      const hasMax = typeof maxLength === 'number' && maxLength >= 0;
      const hasPattern = isValidRegex(pattern);
      const hasFormat = typeof format === "string";
      if (type === "string" || hasMin || hasMax || hasPattern || hasFormat) pseudoTypes.add("string");

      // const { minimum, maximum, multipleOf, exclusiveMinimum, exclusiveMaximum } = node;
      const hasNumMin = typeof minimum === "number";
      const hasNumMax = typeof maximum === "number";
      const hasMultOf = typeof multipleOf === "number";
      const hasExclMin = typeof exclusiveMinimum === "number";
      const hasExclMax = typeof exclusiveMaximum === "number";
      if (type === "number" || type === "integer" || type === "bigint" || hasNumMin || hasNumMax || hasMultOf || hasExclMin || hasExclMax)
        pseudoTypes.add("number");

      if (type === "boolean") pseudoTypes.add("boolean");
      if (type === "null") pseudoTypes.add("null");


      // const { required, minProperties, maxProperties, properties, patternProperties, propertyNames, additionalProperties, unevaluatedProperties, dependentRequired } = node;

      const hasRequired = required != null && Array.isArray(required) && required.length > 0;
      const hasMinProp = typeof minProperties === 'number' && minProperties >= 0;
      const hasMaxProp = typeof maxProperties === 'number' && maxProperties >= 0;
      const hasProperties = properties != null && typeof properties === "object" && Object.keys(properties).length > 0;
      const hasPatternProperties = patternProperties != null && typeof patternProperties === "object" && Object.keys(patternProperties).length > 0;
      const hasPropertyNames = propertyNames != null && (typeof propertyNames === "boolean" || typeof propertyNames === "object");
      const hasDependentRequired = isPureObject(dependentRequired)
        && Object.keys(dependentRequired).length > 0 && Object.keys(dependentRequired).reduce((acc, cur) => {
          let it = dependentRequired[cur];
          acc &&= Array.isArray(it) && it.every(v => typeof v === "string");
          return acc;
        }, true)
      // `dependentSchemas`: object mapping property names to schemas (object or
      // boolean). When the trigger property is present in data, the associated
      // schema is applied to the whole object. We inline the validation
      // alongside `properties`/`dependentRequired`, sharing `parentCtx.unEvalObj`
      // so any property-evaluation done by the subschema propagates upward.
      const hasDependentSchemas = isPureObject(dependentSchemas)
        && Object.keys(dependentSchemas).length > 0;
      const hasAdditionalProp = typeof additionalProperties !== "undefined";
      if (type === "object"
        || hasProperties
        || hasMinProp
        || hasMaxProp
        || hasPatternProperties
        || hasPropertyNames
        || hasRequired
        || hasDependentRequired
        || hasDependentSchemas
        || hasAdditionalProp
        // || unevaluatedProperties !== undefined
      ) pseudoTypes.add("object");

      // const { items, minItems, maxItems, uniqueItems, contains, prefixItems, unevaluatedItems, minContains, maxContains } = node;
      const hasMinItems = typeof minItems === "number" && minItems > -1;
      const hasMaxItems = typeof maxItems === "number" && maxItems > -1;
      const hasContains = contains !== undefined && (typeof contains === "boolean" || isPureObject(contains))
      const hasMinContains = typeof minContains === "number" && minContains > 0;
      const hasMaxContains = typeof maxContains === "number" && maxContains > -1;
      const hasPrefixItems = prefixItems != null && Array.isArray(prefixItems) && prefixItems.length > 0;
      const hasItems = typeof items !== "undefined"
      const hasUniqueItems = typeof uniqueItems === "boolean";

      if (type === "array"
        || hasMinItems
        || hasMaxItems
        || hasPrefixItems
        || hasContains
        || hasMinContains
        || hasMaxContains
        || hasItems
        || hasUniqueItems
        // || unevaluatedItems !== undefined
      ) pseudoTypes.add("array");

      if (Array.isArray(type)) pseudoTypes.add(type.join());

      // end of determination of pseudoType

      //  identification of controlers
      const controlers = new Set();
      if (typeof node.not !== "undefined") controlers.add("not");

      for (const itemOf of COMPOSITE_OF) {
        const itemOfContent = node[itemOf]
        if (itemOfContent && Array.isArray(itemOfContent) && itemOfContent.length > 0) controlers.add(itemOf);
      };
      if (typeof node.if !== "undefined"
        || typeof node.then !== "undefined"
        || typeof node.else !== "undefined"
      ) controlers.add("if");
      // end of identification of controlers

      /*
       * Wrapper chain: (unevalProps) -> (unevalItems) -> (seq) -> content
       *
       * The three layers are INDEPENDENTLY OPTIONAL. Each `unevaluated*`
       * wrapper acts as both wrapper AND seq for its children when nothing
       * else nests inside; only when ANOTHER wrapper nests inside does it
       * fall back to a single-slot chain link.
       *
       * `seq` is only needed when NO uneval wraps and there are 2+ in-place
       * applicators in parallel (typically `allOf`/`oneOf` alongside type
       * validators or `$ref`).
       *
       * Slot counts:
       *   - unevalProps  : 1 if hasUnevalItems (chain) else innerCount (multi-slot)
       *   - unevalItems  : innerCount (always multi-slot when present, holds content)
       *   - seq          : innerCount (only when no uneval and innerCount > 1)
       *
       * Examples:
       *   {$ref, properties, items, unevalProps, unevalItems}
       *                                  → unevalProps[unevalItems[ref, object, array]]
       *   {$ref, properties, unevalProps} → unevalProps[ref, object]
       *   {$ref, unevalProps}             → unevalProps[ref]
       *   {$ref, properties}              → seq[ref, object]
       *   {$ref}                          → ref (no wrapper)
       */
      const innerCount = pseudoTypes.size + controlers.size;
      const hasUnevalProps = unevaluatedProperties !== undefined;
      const hasUnevalItems = unevaluatedItems !== undefined;

      // Process unevaluatedProperties.
      // Slot count: 1 if it just chains to unevalItems, else innerCount (multi-slot).
      if (hasUnevalProps) {
        const wrpDef = new Array(hasUnevalItems ? 1 : innerCount);
        const wrpStoreId = setStore(wrpDef);
        wrpDef.fill(wrpStoreId);

        let unEvalDef: [string, number | boolean, number[]] = ["unevaluatedProperties", -1, wrpDef];

        if (typeof unevaluatedProperties === "boolean") {
          unEvalDef[1] = unevaluatedProperties;
        } else if (isPureObject(unevaluatedProperties)) {
          const unEvalPropStoreId = setStore(unEvalDef);
          unEvalDef[1] = unEvalPropStoreId;
          stack.push([parentPath + "/unevaluatedProperties", unevaluatedProperties, unEvalPropStoreId, 1]);
        }
        storeDNA(["unevaluatedProperties", unevaluatedProperties, node, meta], unEvalDef, storeMark, storePosition());
        storeMark = wrpStoreId;
        storePosition.count();
      }

      // Process unevaluatedItems (always multi-slot when present, holds content directly).
      if (hasUnevalItems) {
        const wrpDef = new Array(innerCount);
        const wrpStoreId = setStore(wrpDef);
        wrpDef.fill(wrpStoreId);

        let unEvalDef: [string, number | boolean, number[]] = ["unevaluatedItems", -1, wrpDef];

        if (typeof unevaluatedItems === "boolean") {
          unEvalDef[1] = unevaluatedItems;
        } else if (isPureObject(unevaluatedItems)) {
          const unEvalItemStoreId = setStore(unEvalDef);
          unEvalDef[1] = unEvalItemStoreId;
          stack.push([parentPath + "/unevaluatedItems", unevaluatedItems, unEvalItemStoreId, 1]);
        }
        storeDNA(["unevaluatedItems", unevaluatedItems, node, meta], unEvalDef, storeMark, storePosition());
        storeMark = wrpStoreId;
        storePosition.count();
      }

      // seq only when NO uneval wraps and there are 2+ in-place applicators.
      if (!hasUnevalProps && !hasUnevalItems && innerCount > 1) {
        const seqDef = new Array(innerCount);
        const seqStoreId = setStore(seqDef);
        seqDef.fill(seqStoreId);
        storeDNA([node, meta], ["seq", seqDef], storeMark, storePosition());
        storeMark = seqStoreId;
        storePosition.count();
      }


      /**
       *  1 REF
       */

      if (pseudoTypes.has("$ref")) {
        const ref = node.$ref;
        if (!ref.startsWith("#")) {
          throw new OutOfScopeError(`External $ref: ${ref}`);
        }
        // Resolve `$ref` against the active base URI (spec §8.2.3.1). Two
        // refs with the same text in different `$id` scopes are distinct.
        const refAbs = currentBase.split("#")[0] + ref;
        let refDnaId = refDNACache.get(refAbs);
        if (typeof refDnaId !== "undefined") {
          updateStore(storeMark, refDnaId, storePosition());
          continue;
        }

        const refDef: [string, number] = ["ref", -1];
        const refStoreId = setStore(refDef);
        refDef[1] = refStoreId;
        refDNAList.push(refDef);

        let refNode;
        // Anchor-style ref (`#foo`, not `#` and not `#/pointer`): trigger a
        // one-shot scan of all anchors if not yet done.
        if (!uriMap.has(refAbs) && ref.length > 1 && !ref.startsWith("#/")) {
          scanAnchorsOnce();
        }
        if (uriMap.has(refAbs)) {
          refNode = uriMap.get(refAbs);
        } else {
          refNode = resolvePointer(ref, root);
          if (typeof refNode !== "undefined") uriMap.set(refAbs, refNode);
        }
        const pPath = parentPath + "/" + "$ref/" + ref;
        parentUriMap.set(pPath, refNode[1]);
        stack.push([pPath, refNode[0], refStoreId, 1]);
        refDnaId = storeDNA([node.$ref, { ...meta, $ref: ref }], refDef, storeMark, storePosition());
        refDNACache.set(refAbs, refDnaId);
        // continue;
      }

      /**
       *  2 TYPES AND PSEUDOS TYPES
       */

      // Handle multiple types (e.g., type: ["string", "number"])
      // to keep before before primitives and others
      if (Array.isArray(type) && type.length > 0) {
        // For multiple types, store the type array with the "type" opcode
        storeDNA([node.type, meta], ["type", type], storeMark, storePosition());
        // continue;
      }

      // if (typeof node.const !== "undefined") {
      if (pseudoTypes.has("const")) {
        const isComplex = typeof node.const === "object" && node.const !== null;
        const opcode = isComplex ? "cD" : "c";
        if (isComplex) extraArgs.push('deepEqual');
        storeDNA([node.const, meta], [opcode, JSON.stringify(node.const)], storeMark, storePosition());
        // continue;
      }
      if (pseudoTypes.has("enum")) {
        // Pick the right opcode based on the enum's contents:
        //  - `e`  : all values are primitives (string/number/boolean/null) → fast `===` checks
        //  - `eD` : at least one value is object/array → needs `deepEqual` (FN_dEq)
        const hasComplex = node.enum.some((v: unknown) => v !== null && typeof v === "object");
        storeDNA([node.enum, meta], [hasComplex ? "eD" : "e", node.enum], storeMark, storePosition());
      }

      // const { minLength, maxLength, pattern, format } = node;
      // const hasMin = typeof minLength === 'number' && minLength >= 0;
      // const hasMax = typeof maxLength === 'number' && maxLength >= 0;
      // const hasPattern = isValidRegex(pattern);
      // const hasFormat = typeof format === "string";

      // if (type === "string" || hasMin || hasMax || hasPattern || hasFormat) {
      if (pseudoTypes.has("string")) {
        const minVal = hasMin ? minLength : null;
        const maxVal = hasMax ? maxLength : null;
        // if (hasMin || hasMax) extraArgs.push("fCntStr");
        const patternVal = hasPattern ? pattern : null;
        const formatVal = hasFormat ? format : null;
        const pseudoType = type === "string" ? "s" : "_s";
        storeDNA([pseudoType, minLength, maxLength, pattern, format, meta],
          [pseudoType, [minVal, maxVal, patternVal, formatVal]], storeMark, storePosition());
        // continue;
      }

      // const { minimum, maximum, multipleOf, exclusiveMinimum, exclusiveMaximum } = node;
      // const hasNumMin = typeof minimum === "number";
      // const hasNumMax = typeof maximum === "number";
      // const hasMultOf = typeof multipleOf === "number";
      // const hasExclMin = typeof exclusiveMinimum === "number";
      // const hasExclMax = typeof exclusiveMaximum === "number";

      // if (type === "number" || type === "integer" || type === "bigint" || hasNumMin || hasNumMax || hasMultOf || hasExclMin || hasExclMax) {
      if (pseudoTypes.has("number")) {
        const minVal = hasNumMin ? minimum : (hasExclMin ? exclusiveMinimum : null);
        const exclMinVal = hasExclMin && hasNumMin ? exclusiveMinimum : (hasExclMin ? true : null);
        const exclMaxVal = hasExclMax && hasNumMax ? exclusiveMaximum : (hasExclMax ? true : null);
        const maxVal = hasNumMax ? maximum : (hasExclMax ? exclusiveMaximum : null);
        const multOfVal = hasMultOf ? multipleOf : null;
        const pseudoType = (type === "integer" && "i") || (type === "bigint" && "bi") || (type === "number" && "n") || "_n";
        storeDNA([pseudoType, minimum, maximum, multipleOf, exclusiveMinimum, exclusiveMaximum, meta],
          [pseudoType, [minVal, exclMinVal, maxVal, exclMaxVal, multOfVal]], storeMark, storePosition());
        // continue;
      }
      if (pseudoTypes.has("boolean")) { storeDNA(["b", meta], ["b"], storeMark, storePosition()); continue; };
      if (pseudoTypes.has("null")) { storeDNA(["n0", meta], ["n0"], storeMark, storePosition()); continue; }



      // const { required, minProperties, maxProperties, properties, patternProperties, propertyNames, additionalProperties, unevaluatedProperties, dependentRequired } = node;
      // const willCheckAdditionalProp = typeof additionalProperties !== "undefined";

      // const hasProperties = properties != null && typeof properties === "object" && Object.keys(properties).length > 0;
      // const hasPatternProperties = patternProperties != null && typeof patternProperties === "object" && Object.keys(patternProperties).length > 0;
      // const hasPropertyNames = propertyNames != null && (typeof propertyNames === "boolean" || typeof propertyNames === "object");
      // const hasRequired = required != null && Array.isArray(required) && required.length > 0;
      // const hasDependentRequired = dependentRequired != null && typeof dependentRequired === "object" && Object.keys(dependentRequired).length > 0;
      // const hasMinProp = typeof minProperties === 'number' && minProperties >= 0;
      // const hasMaxProp = typeof maxProperties === 'number' && maxProperties >= 0;

      // if (type === "object"
      //   || hasProperties
      //   || hasMinProp
      //   || hasMaxProp
      //   || hasPatternProperties
      //   || hasPropertyNames
      //   || hasRequired
      //   || hasDependentRequired
      //   || willCheckAdditionalProp
      //   || unevaluatedProperties != null
      // )
      if (pseudoTypes.has("object")) {

        const itemToSeq = [];

        // Process object type
        const minVal = hasMinProp ? minProperties : -1;
        const maxVal = hasMaxProp ? maxProperties : -1;
        if (minVal > -1) itemToSeq.push(["minProperties", minVal]);
        if (maxVal > -1) itemToSeq.push(["maxProperties", maxVal]);

        // Process required
        if (hasRequired) itemToSeq.push(["required", required]);

        // Process dependentRequired
        if (hasDependentRequired) itemToSeq.push(["dependentRequired", dependentRequired]);

        // Process dependentSchemas — mirrors `properties` but applies the
        // sub-schema to the whole object when the trigger key is present.
        // `true` subschemas are no-ops; `false` becomes an immediate fail
        // marker resolved at JS generation time.
        if (hasDependentSchemas) {
          const depSchDef: [string, number | boolean][] = [];
          const depSchStoreId = setStore(depSchDef);
          let localidx = 0;
          for (const [key, sub] of Object.entries(dependentSchemas)) {
            if (sub === true) continue;
            if (sub === false) {
              depSchDef.push([key, false]);
              localidx++;
            } else {
              depSchDef.push([key, depSchStoreId]);
              stack.push([parentPath + "/dependentSchemas/" + key, sub, depSchStoreId, [localidx++, 1]]);
            }
          }
          itemToSeq.push(["dependentSchemas", depSchDef]);
        }

        // Process propertyNames
        if (typeof propertyNames === "boolean") {
          let propNamesDef: [string, boolean] = ["propertyNames", propertyNames];
          itemToSeq.push(propNamesDef);
        }

        if (typeof propertyNames === "object") {
          let propNamesDef: [string, boolean | number] = ["propertyNames", true];
          // Schema: convert to DNA
          const propNamesStoreId = setStore(propNamesDef);
          propNamesDef[1] = propNamesStoreId;
          stack.push([parentPath + "/propertyNames", propertyNames, propNamesStoreId, 1]);
          itemToSeq.push(propNamesDef);
        }

        // Process properties
        if (properties != null) {
          const propertiesDef: [string, number | undefined][] = [];
          const propertiesStoreId = setStore(propertiesDef);
          let localidx = 0;
          for (const [key, propSchema] of Object.entries(properties)) {
            propertiesDef.push([key, propertiesStoreId]);
            stack.push([parentPath + "/properties/" + key, propSchema, propertiesStoreId, [localidx++, 1]]);
          }
          itemToSeq.push(["properties", propertiesDef]);
        }

        // Process patternProperties
        if (patternProperties != null) {
          // const patternPropsCount = count++;
          const patternPropDef: [string, number | undefined][] = [];
          itemToSeq.push(["patternProperties", patternPropDef]);
          const patternStoreId = setStore(patternPropDef);
          let localidx = 0;
          for (const [pattern, propSchema] of Object.entries(patternProperties)) {
            patternPropDef.push([pattern, patternStoreId]);
            stack.push([parentPath + "/patternProperties/" + pattern.toString(), propSchema, patternStoreId, [localidx++, 1]]);
          }
        }

        // Process additionalProperties
        if (additionalProperties !== undefined) {
          if (typeof additionalProperties === "boolean") {
            let addPropDef: [string, boolean] = ["additionalProperties", additionalProperties];
            itemToSeq.push(addPropDef);
          } else {
            let addPropDef: [string, number] = ["additionalProperties", -1];
            const addPropStoreId = setStore(addPropDef);
            addPropDef[1] = addPropStoreId;
            stack.push([parentPath + "/additionalProperties", additionalProperties, addPropStoreId, 1]);
            itemToSeq.push(addPropDef);
          }
        }
        const pseudoType = type === "object" ? "o" : "_o";

        storeDNA([pseudoType, required, minProperties, maxProperties, properties, patternProperties, propertyNames, additionalProperties, dependentRequired, dependentSchemas, meta],
          [pseudoType, itemToSeq], storeMark, storePosition());
        // continue;
      }



      // const { items, minItems, maxItems, uniqueItems, contains, prefixItems, unevaluatedItems, minContains, maxContains } = node;
      // const hasMinItems = typeof minItems === "number" && minItems > -1;
      // const hasMaxItems = typeof maxItems === "number" && maxItems > -1;
      // const hasContains = contains !== undefined && (typeof contains === "boolean" || isPureObject(contains))
      // const hasMinContains = typeof minContains === "number" && minContains > 0;
      // const hasMaxContains = typeof maxContains === "number" && maxContains > -1;
      // const hasPrefixItems = prefixItems != null && Array.isArray(prefixItems) && prefixItems.length > 0;
      // const hasItems = typeof items !== "undefined"
      // const hasUniqueItems = typeof uniqueItems === "boolean";

      // if (type === "array"
      //   || hasMinItems
      //   || hasMaxItems
      //   || hasPrefixItems
      //   || hasContains
      //   || hasMinContains
      //   || hasMaxContains
      //   || hasItems
      //   || hasUniqueItems
      //   || unevaluatedItems != null
      // )
      if (pseudoTypes.has("array")) {
        const itemToSeq = []
        // Process array type with constraints
        if (hasMinItems) itemToSeq.push(["minItems", minItems]);
        if (hasMaxItems) itemToSeq.push(["maxItems", maxItems]);

        if (hasUniqueItems && uniqueItems !== false) {
          let complexity = 1;
          if (hasItems && typeof items === "boolean" && items) complexity = 1; //requires deepEqual
          if ((hasItems && typeof items === "object") || hasPrefixItems) {
            let collectTypes = [];
            if (items && items.type) collectTypes.push(items.type)
            if (hasPrefixItems) {
              let len = prefixItems.length
              for (; len--;) if (prefixItems[len].type) collectTypes.push(prefixItems[len].type);
            }
            const collectSet = new Set(collectTypes);
            if (collectSet.has("array") || collectSet.has("object")) complexity = 1; //requires deepEqual
            else complexity = 0;
          }
          itemToSeq.push(["uniqueItems", complexity]);
          if (complexity) extraArgs.push('deepEqual');
        }

        // Process prefixItems (tuple)
        if (hasPrefixItems) {
          const prefixItemsDef: number[] = Array(prefixItems.length).fill(-1);
          itemToSeq.push(["prefixItems", prefixItemsDef]);
          const prefixItemsStoreId = setStore(prefixItemsDef);
          prefixItemsDef.fill(prefixItemsStoreId);
          for (let i = 0; i < prefixItems.length; i++) {
            const prefixItem = prefixItems[i];
            stack.push([parentPath + "/prefixItems/" + String(i), prefixItem, prefixItemsStoreId, i]);
          }
        }

        // if (Array.isArray(items)) {
        //   const tupleItemsDef: (number | boolean)[] = Array(items.length).fill(-1);
        //   itemToSeq.push(["itemsT", tupleItemsDef]);
        //   const tupleItemsStoreId = setStore(tupleItemsDef);
        //   tupleItemsDef.fill(tupleItemsStoreId);
        //   for (let i = 0; i < items.length; i++) {
        //     const tupleItem = items[i];
        //     // Boolean schemas (true/false) should not be compiled as separate DNA indices
        //     if (tupleItem === true || tupleItem === false) {
        //       tupleItemsDef[i] = tupleItem; // Store boolean directly
        //     } else {
        //       stack.push([parentPath + "/items/" + String(i), tupleItem, tupleItemsStoreId, i]);
        //     }
        //   }
        // }

        // Process items schema
        if (typeof items === "boolean") {
          itemToSeq.push(["items", items])
        }
        if (items != null && typeof items === "object" && !Array.isArray(items)) {
          const itemsDef = ["items", -1]
          const itemsStoreId = setStore(itemsDef);
          itemsDef[1] = itemsStoreId;
          itemToSeq.push(itemsDef)
          stack.push([parentPath + "/items", items, itemsStoreId, 1]);
        }

        // Process contains constraints (minContains, maxContains, contains)
        // minContains and maxContains are ignored without contains per JSON Schema spec
        if (typeof contains === "boolean") {
          // Per JSON Schema 2020-12: when `contains` is present, the default
          // `minContains` is 1, regardless of whether `contains` is true or false.
          // For `contains: false`, this means the schema is unsatisfiable when
          // the user did not explicitly opt-out via `minContains: 0`.
          const containsDef: [number | boolean, number, number] = [
            contains,
            typeof minContains === "number" && minContains >= 0 ? minContains : 1,
            typeof maxContains === "number" && maxContains >= 0 ? maxContains : -1,
          ]
          itemToSeq.push(["contains", containsDef])
        }
        if (isPureObject(contains)) {
          const containsDef: [number | boolean, number, number] = [
            true,
            typeof minContains === "number" && minContains >= 0 ? minContains : 1,
            typeof maxContains === "number" && maxContains >= 0 ? maxContains : -1,
          ]
          // Schema: use storeId pattern
          const containsStoreId = setStore(containsDef);
          containsDef[0] = containsStoreId;
          stack.push([parentPath + "/contains", contains, containsStoreId, 0]);

          itemToSeq.push(["contains", containsDef])
        }

        const pseudoType = type == "array" ? "a" : "_a";
        // Process parent schema first, then children
        storeDNA(
          [pseudoType, items, minItems, maxItems, uniqueItems, contains, prefixItems, unevaluatedItems, minContains, maxContains, meta],
          [pseudoType, itemToSeq], storeMark, storePosition())
        // continue;
      }

      /**
       * 3 APPLICATORS - CONTROLERS
       */


      if (controlers.has("not")) {
        const notDef = [-1, JSON.stringify(JSON.stringify(node.not)).slice(1, -1)];
        const notStoreId = setStore(notDef)
        notDef[0] = notStoreId;
        stack.push([parentPath + "/not", node.not, notStoreId, 0]);
        storeDNA([notDef, meta], ["not", notDef], storeMark, storePosition());
      }

      if (controlers.has("if")) {
        // see https://json-schema.org/understanding-json-schema/reference/conditionals#ifthenelse

        if (typeof node.if !== "undefined") {
          const ifNode = node.if, thenNode = node.then, elseNode = node.else;
          const ifthenelseDef: [number, number, number] = [-1, -1, -1];
          const iftheelseStoreId = setStore(ifthenelseDef);

          stack.push([parentPath + "/if", ifNode, iftheelseStoreId, 0]);

          if (typeof thenNode !== "undefined") {
            stack.push([parentPath + "/then", thenNode, iftheelseStoreId, 1]);
          };

          if (typeof elseNode !== "undefined") {
            stack.push([parentPath + "/else", elseNode, iftheelseStoreId, 2]);
          };
          storeDNA([ifNode, thenNode, elseNode, meta], ["ifThenElse", ifthenelseDef], storeMark, storePosition());
        } else storeDNA([{}, meta], ["T"], storeMark, storePosition());
      }
      // continue;


      // Process composite keywords (anyOf, allOf, oneOf) before base schema
      if ((controlers.has("allOf") || controlers.has("anyOf") || controlers.has("oneOf"))) for (const itemOf of COMPOSITE_OF) {
        const itemOfContent = node[itemOf];
        // if (itemOf in node && Array.isArray(node[itemOf]) && node[itemOf].length > 0) {
        if (itemOfContent && Array.isArray(itemOfContent) && itemOfContent.length > 0) {
          const itemOfDef = new Array(itemOfContent.length + 1);
          const itemOfStoreId = setStore(itemOfDef);
          itemOfDef.fill(itemOfStoreId);
          itemOfDef[0] = JSON.stringify(JSON.stringify(itemOfContent)).slice(1, -1);
          const localStack = [];
          let hasTrue = false;
          for (let i = 0; i < itemOfContent.length; i++) {
            const it = itemOfContent[i];
            hasTrue = isTrueSchema(it);
            localStack.push([parentPath + "/" + itemOf + "/" + String(i), it, itemOfStoreId, i + 1]);
          }
          // if (!hasTrue) {
          fastMergeArrays(stack, localStack)
          storeDNA([itemOfContent, meta], [itemOf, itemOfDef], storeMark, storePosition());
          // } else
          // storeDNA([meta], ["assign", itemOfDef.slice(0, 1)], storeMark, storePosition());
        }
      }
    }


    // if (stack.length === 0 && stack.length > 0) {
    //   stack.push(...stack);
    //   stack.length = 0;
    // }
  }
  // return dna;
  // console.dir(dna, {depth:null});
  const finalDNA = Object.values(dna);
  const refList = Array.from(new Set(refDNAList.map(it => it[1])));
  finalDNA.push(refList, Array.from(new Set(extraArgs)));
  return finalDNA;
}
