import type { tsDnaInnerMeta } from "./meta-context.type.js";
import type { tsDnaExternals, tsDnaExternalsDecl } from "./runtime.types.js";

interface tsSerializeRawCtx {
	mode: "js" | "cache";
	sortKeys: boolean;
	cache: WeakMap<object, string>;
}

export function serializeRaw(value: any, ctx: tsSerializeRawCtx): string {
	const { mode, sortKeys, cache } = ctx;

	if (value === null) return "null";
	if (value === undefined) return mode === "js" ? "undefined" : '{"~":"undefined"}';
	if (typeof value === "bigint") return mode === "js" ? value + "n" : `{"~":"bigint","v":"${value.toString()}"}`;
	if (typeof value === "number") {
		if (Number.isNaN(value)) return mode === "js" ? "null" : '{"~":"nan"}';
		if (value === Infinity) return mode === "js" ? "null" : '{"~":"inf"}';
		if (value === -Infinity) return mode === "js" ? "null" : '{"~":"-inf"}';
		return JSON.stringify(value);
	}
	if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
	if (typeof value === "symbol") return mode === "js" ? JSON.stringify(value.toString()) : `{"~":"symbol","d":${JSON.stringify(value.description ?? "")}}`;
	if (typeof value === "function") return mode === "js" ? "undefined" : '{"~":"function"}';
	if (typeof value === "object") {
		if (cache.has(value)) return cache.get(value)!;
		const items: string[] = [];
		let result: string;
		if (Array.isArray(value)) {
			for (let i = 0; i < value.length; i++) {
				items.push(serializeRaw(value[i], ctx));
			}
			result = "[" + items.join(",") + "]";
		} else {
			const keys = sortKeys ? Object.keys(value).sort() : Object.keys(value);
			const props: string[] = [];
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				props.push(JSON.stringify(k) + ":" + serializeRaw(value[k], ctx));
			}
			result = "{" + props.join(",") + "}";
		}
		cache.set(value, result);
		return result;
	}
	return JSON.stringify(value);
}

/** Normalize an externals declaration into a mapper `{ nameInFn: externalsKey }`
 * (identity by default). Array form derives names from `.name`; object form uses keys. */
export function externalsMap(externals?: tsDnaExternalsDecl): tsDnaExternals {
	const map: tsDnaExternals = {};
	if (!externals) return map;
	if (Array.isArray(externals)) {
		externals.forEach((e, i) => {
			const n = e.name;
			if (!n) throw new Error("transform/refine external #" + i + " has no name; use the object form { myFn } for anonymous or minified values");
			map[n] = n;
		});
	} else {
		for (const k of Object.keys(externals)) map[k] = k;
	}
	return map;
}

export function metaNormalize(meta?: string | tsDnaInnerMeta, target?: string): tsDnaInnerMeta {
	if (meta === undefined) return {};
	let _meta: any;
	if (typeof meta === "string") _meta = { error: meta };
	else _meta = meta;
	if (target) return { "~inner": _meta };
	return _meta
}