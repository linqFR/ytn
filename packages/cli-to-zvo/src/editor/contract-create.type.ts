/**
 * @type $KebabToCamel
 * @description Type-level utility to convert kebab-case strings to camelCase.
 */
type $KebabToCamel<S extends string> = S extends `${infer T}-${infer U}`
  ? `${T}${Capitalize<$KebabToCamel<U>>}`
  : S;

/**
 * @type $GetAllowedKeys
 * @description Extracts all valid keys from positionals and flags, converted to camelCase.
 */
type $GetAllowedKeys<T> = T extends {
  cli: { positionals?: (infer P extends string)[]; flags?: infer F };
}
  ? $KebabToCamel<P | (keyof F & string)>
  : never;

/** Utility to safely extract targets and fallbacks or return fallback objects. */
type $GetTargets<T> = T extends { targets: infer Tar } ? Tar : object;
type $GetFallbacks<T> = T extends { fallbacks?: infer Fal } ? Fal : object;

/**
 * @type $ValidateFields
 * @description Logic that ensures each target or fallback field is defined in 'cli'.
 * Also prevents empty objects.
 */
type $ValidateFields<Fields, AllowedKeys> = string extends AllowedKeys
  ? Fields
  : keyof Fields extends never
    ? "ERROR: Target fields cannot be empty. Use 'fallbacks' for catch-all (with at least one field)."
    : {
        [F in keyof Fields]: F extends AllowedKeys
          ? Fields[F]
          : `ERROR: Field '${F &
              string}' is not defined in 'cli'. Is it misspelled?`;
      };

/**
 * @type uValidateContract
 * @description A top-level validation helper enforcing both non-empty targets AND
 * ensuring all field names sync correctly with the 'cli' definition (camelCase conversion).
 */
export type uValidateContract<T> = T & {
  targets: {
    [K in keyof $GetTargets<T>]: T extends { targets: Record<K, infer Fields> }
      ? $ValidateFields<Fields, $GetAllowedKeys<T>>
      : never;
  };
  fallbacks?: {
    [K in keyof $GetFallbacks<T>]: T extends {
      fallbacks?: Record<K, infer Fields>;
    }
      ? $ValidateFields<Fields, $GetAllowedKeys<T>>
      : never;
  };
};
