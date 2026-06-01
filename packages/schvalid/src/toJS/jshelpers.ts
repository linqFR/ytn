
// function buildClassifier(names: string[], startAt: number = 0, metaDict?: Record<string, number>) {
//     const dic: [string, number][] = [];
//     const rev: [number, string][] = [];
//     const keys: [string, string][] = []
//     for (let i = 0; i < names.length; i++) {
//         const n = names[i];
//         let v = 1 << (startAt + i)
//         if (metaDict && n in metaDict) v |= metaDict[n];
//         dic.push([n, v]);
//         rev.push([v, n]);
//         keys.push([n, n]);
//     }
//     return {
//         dic: Object.fromEntries(dic),
//         keys: Object.fromEntries(keys),
//         rev: Object.fromEntries(rev),
//         count: names.length+startAt
//     }
// }


// export const pTypes = buildClassifier([
//     "any",
//     "string",
//     "boolean",
//     "null",
//     "integer",
//     "bigint",
//     "number",
//     "array",
//     "object",
// ])

// export const applicators = buildClassifier([
//     "enum",
//     "allOf",
//     "anyOf",
//     "oneOf",
//     "not",
//     "if",
//     "then",
//     "else",
// ], pTypes.count)

// export const metaClassifiers = buildClassifier([
//     "container",
// ], applicators.count)


// export const classifiers = buildClassifier([
//     "constraint",
//     "containerArrayKeys",
//     "containerObjectKeys",
//     "modifier",
//     "nonActionable",
//     "pointsToSchemas",
//     "pointsToValues",
//     "priority0",
//     "priority1",
//     "root",
//     "typeDecl",
//     "wrapper",
// ], metaClassifiers.count, {
//     "containerArrayKeys": metaClassifiers.dic.container,
//     "containerObjectKeys": metaClassifiers.dic.container,
// })

export const deepEqual = (a: any, b: any): boolean => {
	const stack = [[a, b]];
	while (stack.length > 0) {
		const [currA, currB] = stack.pop()!;
		if (currA === currB) continue;
		if (currA && currB && typeof currA === "object" && typeof currB === "object") {
			if (currA.constructor !== currB.constructor) return false;
			if (Array.isArray(currA)) {
				if (currA.length !== currB.length) return false;
				for (let i = currA.length; i-- !== 0; ) stack.push([currA[i], currB[i]]);
			} else {
				const keys = Object.keys(currA);
				if (keys.length !== Object.keys(currB).length) return false;
				for (let i = keys.length; i-- !== 0; ) {
					const key = keys[i];
					if (!Object.prototype.hasOwnProperty.call(currB, key)) return false;
					stack.push([currA[key], currB[key]]);
				}
			}
		} else {
			if (currA !== currB) return false;
		}
	}
	return true;
};

export default { deepEqual };





