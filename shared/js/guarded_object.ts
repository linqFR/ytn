

import { isSymbolObject } from "node:util/types";
import { isObject } from "./object-utils.js";


const createGuardedObject = <T extends object>(
  target: T,
  locked: boolean = true,
  throwErrors: boolean = true,
): T & {
  _lock: () => void;
  _unlock: () => void;
  _isLocked: () => boolean;
  _unwrap: () => T;
} => {
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
        if (t === target && (prop === "_lock" || prop === "_unlock" || prop === "_isLocked" || prop === "_unwrap")) {
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
              `Cannot set value ${val} to the "${isSymbolObject(prop) ? "[Symbol]" : prop}" property of the protected object`,
            );
          return false;
        }

        return Reflect.set(t, prop, val, receiver);
      },
      deleteProperty(t, prop) {
        if (_locked) {
          if (_throwErrors)
            throw new TypeError(
              `Cannot delete the property "${isSymbolObject(prop) ? "[Symbol]" : prop}" of the protected object`,
            );
          return false;
        }
        return Reflect.deleteProperty(t, prop);
      },
      defineProperty(t, prop, desc) {
        if (_locked) {
          if (_throwErrors)
            throw new TypeError(
              `Cannot define a new property "${isSymbolObject(prop) ? "[Symbol]" : prop}" in the protected object`,
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



/** Checks if an object is already a protected proxy. */
export const isProtected = (item: any): boolean => {
  return (
    isObject(item) &&
    "_unwrap" in (item as any) &&
    typeof (item as any)._unwrap === "function"
  );
};


export const protectObject = <T>(item: T): T => {
  if (isProtected(item)) return item;
  return isObject(item) ? (createGuardedObject(item as object) as any) : item;
};


export const unProtectObject = <T>(item: T): any => {
  if (isProtected(item)) {
    return (item as any)._unwrap();
  }
  return item;
};
