import { pico } from "../pico-zod/index.js";

pico.define(
  "help",
  (msg: string = "Show help information", key: string = "help") => {
    const obj = {} as any;
    // We use pico.literal directly because it's already "bridged"
    // by the Proxy in pico-zod/index.ts
    obj[key] = pico.literal(true).desc(msg);

    Object.defineProperties(obj, {
      key: {
        get: () => key,
        configurable: false,
        enumerable: false,
      },
      flag: {
        get: () => ({ [key]: { type: "boolean", desc: msg } }),
        configurable: false,
        enumerable: false,
      },
    });
    return obj;
  },
);

export { pico };
