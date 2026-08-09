import { isObject } from "./object-utils.js";

/**
 * @type tsGuardedObject
 * @description Public contract of a guarded/protected object proxy created by `protectObject`.
 * Exposes the control interface (`_lock`, `_unlock`, `_isLocked`, `_unwrap`) alongside the
 * original object's shape via intersection `T & tsGuardedObject<T>`.
 * @template T - The original object type (defaults to `unknown`).
 */
export type tsGuardedObject<T = unknown> = {
  _lock: () => void;
  _unlock: () => void;
  _isLocked: () => boolean;
  _unwrap: () => T;
};

/**
 * @function createGuardedObject
 * @description Internal factory that creates a recursive protective proxy around an object.
 *
 * @template {object} T
 * @param {T} target - The object to protect.
 * @param {boolean} [locked=true] - Initial lock state.
 * @param {boolean} [throwErrors=true] - Whether to throw TypeError on forbidden mutations.
 * @returns {T & tsGuardedObject<T>} The protected proxy.
 */
const createGuardedObject = <T extends object>(
  target: T,
  locked: boolean = true,
  throwErrors: boolean = true,
): T & tsGuardedObject<T> => {
  let _locked = locked;
  const _throwErrors = throwErrors;

  // Cache to maintain identity of nested proxies and prevent redundant wrapping
  const _proxyCache = new WeakMap<object, any>();

  const createProxy = (obj: any): any => {
    // Only wrap actual objects or arrays
    if (obj === null || typeof obj !== "object" || isProtected(obj)) return obj;

    // Return cached proxy if available
    if (_proxyCache.has(obj)) return _proxyCache.get(obj);

    const handler: ProxyHandler<any> = {
      has(t, prop) {
        if (
          t === target &&
          (prop === "_lock" ||
            prop === "_unlock" ||
            prop === "_isLocked" ||
            prop === "_unwrap")
        ) {
          return true;
        }
        return Reflect.has(t, prop);
      },
      get(t, prop, receiver) {
        // Control Interface Injection
        if (t === target) {
          if (prop === "_lock")
            return () => {
              _locked = true;
            };
          if (prop === "_unlock")
            return () => {
              _locked = false;
            };
          if (prop === "_isLocked") return () => _locked;
          if (prop === "_unwrap") return () => target;
        }

        const val = Reflect.get(t, prop, receiver);
        return createProxy(val);
      },
      set(t, prop, val, receiver) {
        if (_locked) {
          if (_throwErrors)
            throw new TypeError(
              `Cannot set value ${val} to the "${
                typeof prop === "symbol" ? "[Symbol]" : prop
              }" property of the protected object`,
            );
          return false;
        }

        return Reflect.set(t, prop, val, receiver);
      },
      deleteProperty(t, prop) {
        if (_locked) {
          if (_throwErrors)
            throw new TypeError(
              `Cannot delete the property "${
                typeof prop === "symbol" ? "[Symbol]" : prop
              }" of the protected object`,
            );
          return false;
        }
        return Reflect.deleteProperty(t, prop);
      },
      defineProperty(t, prop, desc) {
        if (_locked) {
          if (_throwErrors)
            throw new TypeError(
              `Cannot define a new property "${
                typeof prop === "symbol" ? "[Symbol]" : prop
              }" in the protected object`,
            );
          return false;
        }
        return Reflect.defineProperty(t, prop, desc);
      },
    };

    const proxy = new Proxy(obj, handler);
    _proxyCache.set(obj, proxy);
    return proxy;
  };

  return createProxy(target);
};

/**
 * @function isProtected
 * @description Checks if an object is already a guarded proxy created by this utility.
 *
 * @param {unknown} item - The value to inspect.
 * @returns {boolean} True if the item is a protected proxy.
 */
export const isProtected = (item: unknown): item is tsGuardedObject => {
  return (
    isObject(item) &&
    "_unwrap" in item &&
    typeof item._unwrap === "function"
  );
};

/**
 * @function protectObject
 * @description Wraps an object in a recursive, lockable Proxy to prevent unauthorized mutations.
 * If the item is already protected or not an object, it is returned as-is.
 *
 * @template T
 * @param {T} item - The target item to protect.
 * @returns {T} The protected version of the item.
 */
export const protectObject = <T>(item: T): T => {
  if (isProtected(item)) return item;
  // CAST: Proxy preserves T's shape at runtime but TS cannot verify structural compatibility with generic T
  return isObject(item) ? (createGuardedObject(item as object) as unknown as T) : item;
};

/**
 * @function unProtectObject
 * @description Strips the protective proxy from an object and returns the original raw value.
 *
 * @template T
 * @param {T} item - The protected proxy to unwrap.
 * @returns {any} The original raw object.
 */
export const unProtectObject = <T>(item: T): any => {
  if (isProtected(item)) {
    return item._unwrap();
  }
  return item;
};
