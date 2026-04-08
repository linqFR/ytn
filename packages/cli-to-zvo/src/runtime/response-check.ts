import type {
  OResponseErr,
  OResponseOk,
  OSafeResult,
} from "../types/contract.types.js";

/**
 * Type guard to verify if an object is a safe Zod parsing response (wrapper).
 */
export const isSafeResponse = <T = any>(
  val: unknown,
): val is OSafeResult<T> => {
  return typeof val === "object" && val !== null && "success" in val;
};

/**
 * Type guard to verify if an object is a success response (containing data).
 */
export const isResponseOk = <T = any>(val: unknown): val is OResponseOk<T> => {
  return (
    typeof val === "object" &&
    val !== null &&
    "data" in val &&
    !("error" in val)
  );
};

/**
 * Type guard to verify if an object is an error response (containing error).
 */
export const isResponseErr = <T = any>(
  val: unknown,
): val is OResponseErr<T> => {
  return (
    typeof val === "object" &&
    val !== null &&
    "error" in val &&
    !("data" in val)
  );
};
