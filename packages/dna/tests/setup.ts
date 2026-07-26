// Vitest setup: polyfill for esbuild's `__name` helper injected when
// `keepNames` is active. The generated DNA validators inline user function
// strings (`fn.toString()`) that may contain `__name(...)` calls; this makes
// them runnable under Vitest without polluting the generated source code.
const __name = <T extends object>(target: T, value: string): T => {
	Object.defineProperty(target, "name", { value, configurable: true });
	return target;
};

Object.defineProperty(globalThis, "__name", {
	value: __name,
	writable: true,
	configurable: true,
});

// Vitest/Vite rewrites imported namespace references in function source strings
// to `__vite_ssr_import_X__.name`. This polyfill strips those prefixes so that
// the generated DNA validators can resolve externals (e.g. `dna`) from their
// closure without changing the runtime or codegen code paths.
const origToString = Function.prototype.toString;
Object.defineProperty(Function.prototype, "toString", {
	value: function (this: Function) {
		return origToString.call(this).replace(/__vite_ssr_import_\d+__\./g, "");
	},
	configurable: true,
});
