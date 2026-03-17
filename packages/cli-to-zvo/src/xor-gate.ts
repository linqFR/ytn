import { z } from "zod";
import {
  RoutedResult,
  RoutedResultType,
  RouterZodSymbol,
  TargetObjects,
  XorSchema,
} from "./cli-contract-schema_old.js";

/**
 * @class xorGate
 * @description Encapsulates a dictionary of schemas into a XOR union
 * and injects invisible routing metadata into the parsed output.
 *
 * ### Architectural Rationale:
 * 1. **Persistence through Spread (`{...data}`)**: Metadata defined via `Object.defineProperty`
 *    (non-enumerable) is lost when an object is shallow-cloned using the spread operator.
 *    However, the internal `Symbol` key ($mark) **survives** spreads, ensuring that `router.isRoute(data, 'X')`
 *    remains valid even after multiple data transformations in a pipeline.
 *
 * 2. **No Data Pollution**: By using non-enumerable properties (`route` and `isRoute`) and a private `Symbol`,
 *    the routing metadata does not appear in `JSON.stringify(data)` or `Object.keys(data)`.
 *    This keeps the "business data" clean and compliant with the original schema.
 *
 * 3. **Collision Avoidance**: Using a `Symbol` avoids name-clashes with user-defined keys.
 *    If a schema defines a property named "route", it will coexist with the
 *    invisible routing `route` property without conflict.
 */
export class xorGate {
  /**
   * @property {symbol} mark - Unique identifier used as a "hidden tag" on parsed objects.
   * Survivors spreads: {...parsed} will still contain this Symbol.
   * @private
   * @readonly
   */
  private readonly mark = RouterZodSymbol;

  /**
   * @property {RoutedTargetsSchema} schemaDict - Dictionary of individual schemas, each transformed to include routing tags.
   * @public
   * @readonly
   */
  public readonly schemaDict: Record<string, RoutedResultType>;

  /**
   * @property {XorSchema} xorSchema - The final XOR union schema (exclusive OR) that performs the routing.
   * @public
   * @readonly
   */
  public readonly xorSchema: XorSchema;

  /**
   * @constructor
   * @param {TargetObjects} dict - A dictionary of schema shapes or Zod schemas to be routed.
   */
  constructor(dict: TargetObjects) {
    this.schemaDict = Object.fromEntries(
      Object.entries(dict).map(([key, item]) => {
        /**
         * addMarker : Injects identifiers into the successful parse result.
         */
        const addMarker = (val: any) => {
          // 1. Inject the Symbol for robust internal checking (survives spreads)
          const res = { ...val, [this.mark]: key };

          // 2. Inject convenience helpers as non-enumerable properties (hidden from JSON/keys)
          Object.defineProperties(res, {
            /** The name of the matched route/case. */
            route: {
              get: () => key,
              enumerable: false, // Prevents pollution in JSON.stringify/loops
              configurable: true,
            },
            /** Method to verify if the object belongs to a specific route. */
            isRoute: {
              value: (k: string) => k === key,
              enumerable: false,
              configurable: true,
            },
          });
          return res as RoutedResult;
        };

        const baseSchema =
          item instanceof z.ZodType ? item : z.strictObject(item);

        return [key, baseSchema.transform(addMarker)];
      }),
    );

    // Create the final XOR union from the transformed branches
    this.xorSchema = z.xor(
      Object.values(this.schemaDict) as RoutedResultType[],
    ) as XorSchema;
  }

  /**
   * @method isRoute
   * @description Universal check to verify if a parsed object matches a specific route.
   * Reliably uses the internal Symbol, making it safe after object spreads.
   *
   * @param {any} data - The object to check (result of a successful parse).
   * @param {string} key - The route name to verify against.
   * @returns {boolean} true if the object was produced by the specified route.
   * @public
   */
  public isRoute(data: any, key: string): boolean {
    return data && typeof data === "object" && data[this.mark] === key;
  }
}
