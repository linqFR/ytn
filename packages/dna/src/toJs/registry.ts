
// export const deepEqual = (a: any, b: any): boolean => {
// 	const stack = [[a, b]];
// 	while (stack.length > 0) {
// 		const [currA, currB] = stack.pop()!;
// 		if (currA === currB) continue;
// 		if (currA && currB && typeof currA === "object" && typeof currB === "object") {
// 			if (currA.constructor !== currB.constructor) return false;
// 			if (Array.isArray(currA)) {
// 				if (currA.length !== currB.length) return false;
// 				for (let i = currA.length; i-- !== 0; ) stack.push([currA[i], currB[i]]);
// 			} else {
// 				const keys = Object.keys(currA);
// 				if (keys.length !== Object.keys(currB).length) return false;
// 				for (let i = keys.length; i-- !== 0; ) {
// 					const key = keys[i];
// 					if (!Object.prototype.hasOwnProperty.call(currB, key)) return false;
// 					stack.push([currA[key], currB[key]]);
// 				}
// 			}
// 		} else {
// 			if (currA !== currB) return false;
// 		}
// 	}
// 	return true;
// };

// Constructor registry for instanceof validation
const constructorRegistry = new Map<string, Function>();

export const registerExternal = (name: string, fnConstruct: Function): void => {
	constructorRegistry.set(name, fnConstruct);
};

export const getExternal = (name: string): Function | undefined => {
	return constructorRegistry.get(name);
};

export const getRegisteredExternals=()=>{
	return Object.fromEntries(constructorRegistry);
}

export default { registerExternal, getExternal };





