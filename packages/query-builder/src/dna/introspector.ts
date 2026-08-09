import * as introspect from "@ytrynot/dna/introspect";
import type {
  DnaObject,
  DnaSomeType,
  DnaType,
} from "@ytrynot/dna";
import type {
  qbColumn,
  ISchemaIntrospector,
  tsSqliteType,
  IForeignKeyDefinition,
} from "../types.js";

/**
 * @class DnaIntrospector
 * @description DNA introspector implementing ISchemaIntrospector.
 * Uses the `dna.introspect.*` public API (isOptional, isNullable, isObject, unwrap, unwrapDeep,
 * defaultValue) to extract a neutral qbColumn[] from a DNA schema.
 * No dependency on Zod or @ytrynot/shared. No casts — all introspection logic
 * lives inside the DNA package where the classes are available.
 */
export class DnaIntrospector implements ISchemaIntrospector<DnaType> {
  /**
   * @function getColumns
   * @description Extracts column shapes from a DNA schema.
   * @param {DnaType} schema - The DNA schema (typically DnaObject, handles wrappers).
   * @returns {qbColumn[] | null} Column shapes, or null if not a DnaObject.
   */
  getColumns(schema: DnaType): qbColumn[] | null {
    const obj = unwrapToDnaObject(schema);
    if (!obj) return null;

    const shape = obj.shape;
    if (!shape) return null;

    return Object.entries(shape).map(([key, f]) => {
      const meta = f.meta();
      const optional = introspect.isOptional(f) || introspect.isNullable(f);
      const unwrapped = introspect.unwrapDeep(f);
      const kind = unwrapped.type;

      const sqliteType = mapDnaKindToSqlite(kind);

      const def = introspect.defaultValue(f);
      const defaultValue = def !== undefined ? def : meta.default;
      const hasDefault = def !== undefined || defaultValue !== undefined;

      return {
        name: key,
        sqliteType,
        optional,
        hasDefault,
        defaultValue,
        pkauto: meta.pkauto === true,
        unique: meta.unique === true,
        fk: normalizeFk(meta.fk),
        meta,
      };
    });
  }

  /**
   * @function getPrimaryKey
   * @description Detects the primary key column from a DNA schema by inspecting
   * metadata (`.meta({ pk: true })` or `.meta({ pkauto: true })`) and standard
   * conventions (id, uuid).
   * @param {DnaType} schema - The DNA schema.
   * @returns {string | null} The primary key column name, or null.
   */
  getPrimaryKey(schema: DnaType): string | null {
    const obj = unwrapToDnaObject(schema);
    if (!obj) return null;

    const shape = obj.shape;
    if (!shape) return null;

    for (const [key, field] of Object.entries(shape)) {
      const meta = field.meta();
      if (meta.pk || meta.pkauto) return key;
    }

    const keys = Object.keys(shape);
    if (keys.includes("id")) return "id";
    if (keys.includes("uuid")) return "uuid";
    return null;
  }
}

/**
 * @function unwrapToDnaObject
 * @description Traverses wrappers (optional, default, nullable, ...) to find the inner DnaObject.
 * @param {DnaType} schema - The schema to unwrap.
 * @returns {DnaObject | null} The inner DnaObject, or null if not an object schema.
 */
function unwrapToDnaObject(schema: DnaType): DnaObject | null {
  let current: DnaSomeType = schema;
  for (let i = 0; i < 32; i++) {
    if (introspect.isObject(current)) return current;
    const inner = introspect.unwrap(current);
    if (!inner) return null;
    current = inner;
  }
  return null;
}

/**
 * @function mapDnaKindToSqlite
 * @description Maps a DNA kind (`.type`) to a SQLite column type.
 * @param {string} kind - The DNA kind string.
 * @returns {tsSqliteType} The SQLite type.
 */
function mapDnaKindToSqlite(kind: string): tsSqliteType {
  if (kind === "number") return "REAL";
  if (kind === "int" || kind === "int32" || kind === "bigint") return "INTEGER";
  if (kind === "boolean") return "BOOLEAN";
  if (kind === "date") return "DATETIME";
  if (kind === "buffer" || kind === "instanceof") return "BLOB";
  // String, email, uuid, url, enum, literal, etc. → TEXT
  return "TEXT";
}

/**
 * @function normalizeFk
 * @description Narrows `meta.fk` (typed as `unknown` via tsDnaMeta's index signature)
 * to `string | IForeignKeyDefinition | undefined`.
 * @param {unknown} value - The raw `meta.fk` value.
 * @returns {string | IForeignKeyDefinition | undefined} The normalized FK, or undefined.
 */
function normalizeFk(value: unknown): string | IForeignKeyDefinition | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (
    typeof value === "object" && value !== null &&
    typeof (value as IForeignKeyDefinition).table === "string" &&
    typeof (value as IForeignKeyDefinition).col === "string"
  ) {
    // CAST: validated table/col string fields — narrows unknown to IForeignKeyDefinition.
    return value as IForeignKeyDefinition;
  }
  return undefined;
}

/** Shared singleton instance. */
export const dnaIntrospector = new DnaIntrospector();
