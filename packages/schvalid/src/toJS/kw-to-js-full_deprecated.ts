import { _ } from "ajv";
import type {
	tsArrayDNA,
	tsConstDNA,
	tsFnInlineCache,
	tsIfThenElseDNA,
	tsJSFuncReturn,
	tsJSFuncReturnLong,
	tsMeta,
	tsNumberDNA,
	tsObjectDNA,
	tsStringDNA,
	tsTargetList,
} from "../dna.type.js";
import { JSONFORMAT } from "../string-formats.js";
import { namer } from "./utils.js";

/* This file contains the logic to accumulate all errors in fail fast mode */

export const _PARSE_RETURN = ";return errors.length?{success:false, errors}:{success:true, data};";
export const _VALIDATE_RETURN = ";return !errors.length;";
export const ERR_RETURN = "return {success:false, errors};";
export const _ERR_RETURN = ";" + ERR_RETURN;
export const ERR_UNDEF = "&&undefined";

export const MAIN_BLOCK_ID = "mb";
export const BREAK_MAIN = "break " + MAIN_BLOCK_ID + ";";
export const $BREAK_MAIN = " " + BREAK_MAIN;
export const _BREAK_MAIN = ";" + BREAK_MAIN;
export const IFERR_BREAK = "if(errors.length)" + BREAK_MAIN;

export const BLOCK_LOGIC = [
	"a", "_a",
	"o", "_o",
	"allOf", "anyOf", "oneOf",
	"not",
	"ifThenElse",
	"seq"
]

let instanceCount = 0;

export const resetInstanceCount = () => {
	instanceCount = 0;
};

const _err = (varName: string, path: string, msg: string, isLiteral = true) =>
	"errors.push({message:" + (isLiteral ? "'" + msg + "'" : msg) + ",path:'" + path + "',input:" + varName + "})";

export const seq = (dnaOpt: [number[], tsMeta], _vN: string = "", fnCache: tsFnInlineCache, pathVar: string): tsJSFuncReturnLong => {
	const opt = dnaOpt[0];
	const varName = _vN.length ? _vN : "v";
	const idx = instanceCount++;
	const _varName = "seq"+idx;
	let seqString = "let "+_varName+";";
	for (let i = 0; i < opt.length; i++) {
		const it = opt[i];
		seqString += fnCache[it](varName, pathVar, i+1===opt.length?_varName:"");
	}
	return [seqString, _varName];
}

export const ref = (dnaOpt: [number, tsMeta], _vN: string = "", fnCache: tsFnInlineCache, pathVar: string): tsJSFuncReturn => {
	const opt = dnaOpt[0];
	const varName = _vN.length ? _vN : "v";
	// Simple function call to the named function for the referenced DNA strand
	return namer(opt) + "(" + varName + ",'" + pathVar + "/$ref/" + (dnaOpt[1].$ref ?? "") + "')";
}

export const type = (dnaOpt: tsTargetList, _vN: string = "", fnCache: tsFnInlineCache, pathVar: string) => {
	// Extract the actual type array from dnaOpt[0]
	const indices = dnaOpt[0];
	const validations = [];
	const varName = _vN.length ? _vN : "v";
	for (let i = 0; i < indices.length; i++) {
		switch (indices[i]) {
			case "string": validations.push("typeof " + varName + '==="string"'); break;
			case "number": validations.push("typeof " + varName + '==="number"'); break;
			case "integer": validations.push("typeof " + varName + '==="number"&&' + varName + "%1===0"); break;
			case "bigint": validations.push("typeof " + varName + '==="bigint"'); break;
			case "boolean": validations.push("typeof " + varName + '==="boolean"'); break;
			case "object": validations.push("typeof " + varName + '==="object"&&' + varName + "!==null"); break;
			case "array": validations.push("Array.isArray(" + varName + ")"); break;
			case "null": validations.push(varName + "===null"); break;
			case "undefined": validations.push(varName + "===undefined"); break;
		}
	}
	validations.push(_err(varName, pathVar + "/type", "Invalid type, only " + indices.join(", ") + " allowed") + "&&0");
	return "(" + validations.join("||") + ")";
};
const string = (dnaOpt: tsStringDNA, _vN: string = "", declared: boolean, pathVar: string): tsJSFuncReturn => {
	const opt = dnaOpt[0], min = opt[0], max = opt[1], pattern = opt[2], format = opt[3];
	const varName = _vN.length ? _vN : "v";
	const body: string[] = [];
	const test = "typeof " + varName + '==="string"';

	if (min !== null) body.push(
		"([..." + varName + "].length>=" + String(min) + ")||"
		+ _err(varName, pathVar + "/string/minLength", "String length must be at least " + String(min))
		+ ERR_UNDEF
	);
	if (max !== null) body.push(
		"([..." + varName + "].length<=" + String(max) + ")||"
		+ _err(varName, pathVar + "/string/maxLength", "String length must be at most " + String(max))
		+ ERR_UNDEF
	);
	if (pattern !== null) body.push(
		"(/" + pattern + "/.test(" + varName + "))||"
		+ _err(varName, pathVar + "/string/pattern", "String must match pattern " + pattern)
		+ ERR_UNDEF
	);
	if (format !== null) {
		// Format validation is disabled by default per Draft 2020-12 spec (section 7.2.1)
		// Formats are annotations only by default. To enable format validation,
		// uncomment the code below or add an option to enable it.
		// const regFormat = JSONFORMAT[format];
		// if (regFormat) {
		// 	body.push(
		// 		"(" + regFormat + ".test(" + varName + "))||"
		// 		+ _err(varName, pathVar + "/string/pattern", "String must match format " + format)
		// 		+ ERR_UNDEF
		// 	);
		// }
	}
	const condErr = _err(varName, pathVar + "/string", "String is required") + ERR_UNDEF;
	return test + "?"
		+ (body.length ? "(" + body.join(")&&(") + ")&&" : "") + varName
		+ ":" + (declared ? condErr : varName);
};

export const s = (dnaOpt: tsStringDNA, _vN: string, cache?: tsFnInlineCache, pathVar?: string) => string(dnaOpt, _vN, true, pathVar ?? "");
export const _s = (dnaOpt: tsStringDNA, _vN: string, cache?: tsFnInlineCache, pathVar?: string) => string(dnaOpt, _vN, false, pathVar ?? "");

const number = (dnaOpt: tsNumberDNA, type = "n", _vN: string = "", declared = true, pathVar: string): tsJSFuncReturn => {
	const opt = dnaOpt[0], min = opt[0], exclMin = opt[1], max = opt[2], exclMax = opt[3], multOf = opt[4];
	const varName = _vN.length ? _vN : "v";
	const body: string[] = [];

	let test = "", typeName = "";
	switch (type) {
		case "n":
			typeName = "number";
			test = "typeof " + varName + '==="number"';
			break;
		case "i":
			typeName = "integer";
			test = "typeof " + varName + '==="number"&&' + varName + "%1===0";
			break;
		case "bi":
			typeName = "bigint";
			test = "typeof " + varName + '==="bigint"';
			break;
	}

	if (min !== null)
		body.push(
			"(" + varName + (exclMin ? ">" : ">=") + String(min) + ")||"
			+ _err(varName, pathVar + "/" + typeName + "/" + (exclMin ? "exclusiveMinimum" : "minimum"), "Number must be at least " + String(min))
			+ ERR_UNDEF
		)
	if (max !== null)
		body.push("(" + varName + (exclMax ? "<" : "<=") + String(max) + ")||"
			+ _err(varName, pathVar + "/" + typeName + "/" + (exclMax ? "exclusiveMaximum" : "maximum"), "Number must be at most " + String(max))
			+ ERR_UNDEF
		);
	if (multOf !== null) {
		// Use modulo for integers, division for floats to avoid floating-point precision issues
		if (Number.isInteger(multOf)) {
			body.push("(" + varName + "%" + String(multOf) + "===0)||"
				+ _err(varName, pathVar + "/" + typeName + "/multipleOf", "Number must be a multiple of " + String(multOf))
				+ ERR_UNDEF
			);
		} else {
			body.push("(Math.abs(" + varName + "/" + String(multOf) + "-Math.round(" + varName + "/" + String(multOf) + "))<1e-10)||"
				+ _err(varName, pathVar + "/" + typeName + "/multipleOf", "Number must be a multiple of " + String(multOf))
				+ ERR_UNDEF
			);
		}
	}

	const condErr = _err(varName, pathVar + "/" + typeName, typeName + " is required") + ERR_UNDEF;
	return test + "?"
		+ (body.length ? "(" + body.join(")&&(") + ")&&" : "") + varName
		+ ":" + (declared ? condErr : varName);
};

export const n = (dnaOpt: tsNumberDNA, _vN: string = "", cache?: tsFnInlineCache, pathVar?: string) =>
	number(dnaOpt, "n", _vN, true, pathVar ?? "");
export const _n = (dnaOpt: tsNumberDNA, _vN: string = "", cache?: tsFnInlineCache, pathVar?: string) =>
	number(dnaOpt, "n", _vN, false, pathVar ?? "");
export const i = (dnaOpt: tsNumberDNA, _vN: string = "", cache?: tsFnInlineCache, pathVar?: string): tsJSFuncReturn =>
	number(dnaOpt, "i", _vN, true, pathVar ?? "");
export const bi = (dnaOpt: tsNumberDNA, _vN: string = "", cache?: tsFnInlineCache, pathVar?: string): tsJSFuncReturn =>
	number(dnaOpt, "bi", _vN, true, pathVar ?? "");

export const boolean = (dnaOpt: [tsMeta], _vN: string = "", cache?: tsFnInlineCache, pathVar?: string): tsJSFuncReturn => {
	const varName = _vN.length ? _vN : "v";
	const test = "typeof " + varName + '==="boolean"';
	return "(" + test + ")?" + varName + ":" + _err(varName, pathVar + "/boolean", "Boolean is required") + ERR_UNDEF;
};
export const nullType = (dnaOpt: [tsMeta], _vN: string = "", cache?: tsFnInlineCache, pathVar?: string): tsJSFuncReturn => {
	const varName = _vN.length ? _vN : "v";
	const test = "(" + varName + "===null)";
	return "(" + test + ")?null:(" + _err(varName, pathVar + "/null", "Null is required") + ERR_UNDEF + ")";
};
export const trueLiteral = (dnaOpt: [tsMeta], _vN: string = "", cache?: tsFnInlineCache, pathVar?: string): tsJSFuncReturn => {
	const varName = _vN.length ? _vN : "v";
	return varName;
};
export const falseLiteral = (dnaOpt: [tsMeta], _vN: string = "", cache?: tsFnInlineCache, pathVar?: string): tsJSFuncReturn => {
	const varName = _vN.length ? _vN : "v";
	return _err(varName, pathVar + "/false", "Schema is always false") + ERR_UNDEF;
};

export const constType = (dnaOpt: tsConstDNA, _vN: string = "", cache?: tsFnInlineCache, pathVar?: string): tsJSFuncReturn => {
	const varName = _vN.length ? _vN : "v";
	const check = dnaOpt[0];
	// For simple constants (primitives), use strict equality
	return "(" + varName + "===" + check + ")?" + check + ":" + _err(varName, pathVar + "/const", "'Const value is expected:" + check + "'", false) + ERR_UNDEF;
};
export const constTypeComplex = (dnaOpt: tsConstDNA, _vN: string = "", cache?: tsFnInlineCache, pathVar?: string): tsJSFuncReturn => {
	const varName = _vN.length ? _vN : "v";
	const check = dnaOpt[0];
	// For complex constants (objects/arrays), use deepEqual
	return "(deepEqual(" + varName + "," + check + "))?" + check + ":" + _err(varName, pathVar + "/const", "'Const value is expected:" + check + "'", false) + ERR_UNDEF;
};
export const literal = (dnaOpt: tsConstDNA, _vN: string = "", cache?: tsFnInlineCache, pathVar?: string): tsJSFuncReturn => {
	const varName = _vN.length ? _vN : "v";
	const enumList = dnaOpt[0], acc: Record<string | number, true> = {};
	let enumLen = enumList.length;
	for (; enumLen--;) acc[enumList[enumLen]] = true;
	const check = JSON.stringify(acc)
	return "(" + check + "[" + varName + "])?" + varName + ":" + _err(varName, pathVar + "/const", "'Const value is expected:" + JSON.stringify(enumList) + "'", false) + ERR_UNDEF;
};
export const enumType = (dnaOpt: tsConstDNA, _vN: string = "", cache?: tsFnInlineCache, pathVar?: string): tsJSFuncReturn => {
	const varName = _vN.length ? _vN : "v";
	const enumList = dnaOpt[0], acc: Record<string | number, true> = {};
	let enumLen = enumList.length;
	for (; enumLen--;) acc[enumList[enumLen]] = true;
	const check = JSON.stringify(acc)
	return "(" + check + "[" + varName + "])?" + varName + ":" + _err(varName, pathVar + "/const", "'Const value is expected:" + JSON.stringify(enumList) + "'", false) + ERR_UNDEF;
};

const object = (fnCache: tsFnInlineCache, dnaOpt: tsObjectDNA, _vN: string = "", declared: boolean, pathVar: string): tsJSFuncReturnLong => {
	const opt = dnaOpt[0];
	const idx = instanceCount++;
	const varName = _vN.length ? _vN : "v";

	const _varName = "o" + idx;
	const _result = "res" + idx;
	const _block = "oB" + idx;
	const _innerRes = "tmpO" + idx;

	const localBreak = "break " + _block + ";";
	const _localBreak = ";" + localBreak;
	const _localIfErrBreak = "if(errors.length)" + localBreak;

	const oVar = "oVar" + idx;
	const oLen = "oLen" + idx;
	const oVarIdx = oVar + "[i]", _varNamePropIdx = _varName + "[" + oVarIdx + "]";

	const localConst = new Set();

	let needKeys = false,
		needLength = false,
		needLoop = false,
		hasDynamicProps = false; // patternProperties or additionalProperties

	const fixedProperties = [];
	let objectCheck = "";

	// Loop structure (similar to arrays)
	let preLoopContent = "";
	let loopBody = "";
	let loopFixedPropsContent = ""; // Fixed properties validation
	let loopPatternPropsContent = ""; // Pattern properties validation
	let loopDynamicPropsContent = ""; // Additional properties validation
	let postLoopContent = "";


	let typeValidation =
		"if(typeof " + _varName + '!=="object"||' + _varName + "==null||Array.isArray(" + _varName + ")){"
		+ (declared ? _err(_varName, pathVar + "/object", "Object is required") + _localBreak : _result + "=" + varName + _localBreak)
		+ "};";

	let body = "";

	for (let i = 0; i < opt.length; i++) {
		const it = opt[i];
		const data = it[1];
		switch (it[0]) {
			case "minProperties":
				needKeys = true;
				needLength = true;
				if (data > -1)
					objectCheck += "if(" + oLen + "<" + String(data) + "){"
						+ _err(_varName, pathVar + "/object/minProperties", "Object requires at least " + String(data) + " properties")
						+ _localBreak
						+ "}";
				break;
			case "maxProperties":
				needKeys = true;
				needLength = true;
				if (data > -1)
					objectCheck += "if(" + oLen + ">" + String(data) + "){"
						+ _err(_varName, pathVar + "/object/maxProperties", "Object requires at most " + String(data) + " properties")
						+ _localBreak
						+ "}";
				break;
			case "required":
				if (data.length > 0)
					for (let i = 0; i < data.length; i++) {
						const el = JSON.stringify(data[i]).slice(1, -1);
						typeValidation += "if(!Object.hasOwn(" + _varName + ',"' + el + '")){'
							+ _err(_varName, pathVar + "/object/required/" + el, 'Required property "' + el + '" is missing')
							+ _localBreak
							+ "}";
					}
				break;
			case "dependentRequired":
				if (Object.keys(data).length > 0) {
					const keys = Object.keys(data);
					for (let i = 0; i < keys.length; i++) {
						const triggerProp = keys[i];
						const requiredProps = data[triggerProp];
						const triggerPropStr = JSON.stringify(triggerProp);
						const triggerPropDisplay = triggerPropStr.slice(1, -1);
						const condition = "Object.hasOwn(" + _varName + "," + triggerPropStr + ")";
						for (let j = 0; j < requiredProps.length; j++) {
							const reqPropStr = JSON.stringify(requiredProps[j]);
							const reqPropDisplay = reqPropStr.slice(1, -1);
							typeValidation += "if(" + condition + "&&!Object.hasOwn(" + _varName + "," + reqPropStr + ")){" +
								_err(_varName, pathVar + "/object/dependentRequired/" + triggerPropDisplay, 'Property "' + reqPropDisplay + '" is required when "' + triggerPropDisplay + '" is present') +
								_localBreak +
								"}";
						}
					}
				}
				break;
			case "properties":
				for (let i = 0; i < data.length; i++) {
					const el = data[i], el0 = JSON.stringify(el[0]), el0Litteral = el0.slice(1, -1);
					fixedProperties.push([el[0], fnCache[el[1]], [_varName + "[" + el0 + "]", pathVar + "/properties/" + el0Litteral, _innerRes + "[" + el0 + "]"]]);
				}
				break;
			case "patternProperties":
				hasDynamicProps = true;
				needKeys = true;
				needLoop = true;
				const passedIdx = "passed" + idx;
				localConst.add(passedIdx + "=new Set()");
				for (let i = 0; i < data.length; i++) {
					const el = data[i];
					const regexVar = "re" + idx + "_" + i;
					localConst.add(regexVar + "=/" + el[0] + "/");

					// Use val instead of _varName[oVarIdx] in hybrid mode
					const valAccess = "val";
					const inlinedFnRes = fnCache[el[1]](valAccess, pathVar + "/patternProperties/" + el[0], _innerRes + "[" + oVarIdx + "]");
					// All matching patternProperties should be validated (conjunction)
					// Mark property as validated when pattern matches
					loopPatternPropsContent += "if(" + regexVar + ".test(" + oVarIdx + ")){" + passedIdx + ".add(" + oVarIdx + ");" + inlinedFnRes + "}";
				}
				break;
			case "propertyNamesB": {
				hasDynamicProps = true;
				needKeys = true;
				needLoop = true;
				// propertyNames validates all property keys against a schema
				// data can be a boolean (true/false) or a storeId (schema)
				// Boolean schema: true (accept all) or false (reject all)
				if (data === false) loopPatternPropsContent += _err(oVarIdx, pathVar + "/propertyNames", "Property names not allowed") + _localBreak;
				// If true, accept all - no validation needed, just store the property
				loopPatternPropsContent += _innerRes + "[" + oVarIdx + "]=val;";
				break;
			}
			case "propertyNames": {
				hasDynamicProps = true;
				needKeys = true;
				needLoop = true;
				// propertyNames validates all property keys against a schema
				// Schema: call validation function
				const propNamesFn = fnCache[data];
				const propNamesValidation = propNamesFn(oVarIdx, pathVar + "/propertyNames");
				loopPatternPropsContent += "if(!(" + propNamesValidation + ")){" + _err(oVarIdx, pathVar + "/propertyNames", "Property name does not match schema") + _localBreak + "}";
				loopPatternPropsContent += _innerRes + "[" + oVarIdx + "]=val;";
				break;
			}
			case "additionalProperties": {
				hasDynamicProps = true;
				needKeys = true;
				needLoop = true;
				// Use val instead of _varName[oVarIdx] in hybrid mode
				const valAccess = "val";
				const addPropCond = fnCache[data](valAccess, pathVar + "/additionalProperties", _innerRes + "[" + oVarIdx + "]");
				loopDynamicPropsContent += addPropCond;
				break;
			}
			case "additionalPropertiesB": {
				hasDynamicProps = true;
				needKeys = true;
				needLoop = true;
				// Use val instead of _varName[oVarIdx] in hybrid mode
				const valAccess = "val";
				const addPropCond = data;
				if (addPropCond === true) loopDynamicPropsContent += _innerRes + "[" + oVarIdx + "]=" + valAccess;
				else loopDynamicPropsContent += _err(valAccess, pathVar + "/additionalProperties", "Additional properties not allowed") + _localBreak;
				break;
			}
		}
	}
	// Generate properties code based on whether we have dynamic properties
	if (fixedProperties.length > 0) {
		if (!hasDynamicProps) {
			// Only fixed properties: direct access with Object.hasOwn (no loop needed)
			for (let i = 0; i < fixedProperties.length; i++) {
				const [name, stringFn, params] = fixedProperties[i];
				// Use a simple prop variable name (closure-safe)
				const propVarName = _varName + "Prop";
				body += 'if(Object.hasOwn(' + _varName + ',' + JSON.stringify(name) + ')){const ' + propVarName + '=' + _varName + '[' + JSON.stringify(name) + '];' + stringFn(propVarName, ...(params.slice(1))) + '}';
			}
		} else {
			// Hybrid: loop with fixed properties + pattern/additional
			needKeys = true;
			needLoop = true;
			const passedIdx = "passed" + idx;
			localConst.add(passedIdx + "=new Set()");
			// Build fixed properties validation as switch-like if chain
			for (let i = 0; i < fixedProperties.length; i++) {
				const [name, stringFn, params] = fixedProperties[i];
				const _name = JSON.stringify(name);
				loopFixedPropsContent += 'if(' + oVarIdx + '===' + _name + '){' + passedIdx + '.add(' + _name + ');' + stringFn('val', ...(params.slice(1))) + '}';
			}
		}
	} else if (hasDynamicProps) {
		// Only dynamic properties: need loop
		needKeys = true;
		needLoop = true;
		const passedIdx = "passed" + idx;
		localConst.add(passedIdx + "=new Set()");
	}

	// Build loop body following array pattern
	if (needLoop) {
		loopBody += preLoopContent;
		loopBody += "for(let i=0;i<" + oLen + ";i++){const val=" + _varNamePropIdx + ";";

		// Validate fixed properties (if any)
		if (loopFixedPropsContent.length > 0) {
			loopBody += loopFixedPropsContent;
		}

		// Validate pattern properties
		if (loopPatternPropsContent.length > 0) {
			loopBody += loopPatternPropsContent;
		}

		// Validate additional properties (if not already validated)
		if (loopDynamicPropsContent.length > 0) {
			const passedIdx = "passed" + idx;
			loopBody += "if(!" + passedIdx + ".has(" + oVarIdx + ")){" + loopDynamicPropsContent + "}";
		}

		loopBody += _localIfErrBreak;
		loopBody += "}";
		loopBody += postLoopContent;
	}

	if (needKeys || needLength) localConst.add(oVar + "=Object.keys(" + _varName + ")");
	if (needLength || needLoop) localConst.add(oLen + "=" + oVar + ".length");

	localConst.add(_innerRes + "={}")

	const fullbody =
		"const " + _varName + "=" + varName
		+ ";let " + _result + ";" + _block + ":{"
		+ typeValidation
		+ (localConst.size > 0 ? "const " + Array.from(localConst).join(",") + ";" : "")
		+ objectCheck
		+ body
		+ loopBody
		// + _localIfErrBreak
		+ _result + "=" + _innerRes + ";"
		+ "}";
	return [fullbody, _result];
};

export const o = (dnaOpt: tsObjectDNA, _vN: string = "", fnCache: tsFnInlineCache, pathVar: string) =>
	object(fnCache, dnaOpt, _vN, true, pathVar);
export const _o = (dnaOpt: tsObjectDNA, _vN: string = "", fnCache: tsFnInlineCache, pathVar: string) =>
	object(fnCache, dnaOpt, _vN, false, pathVar);

export const array = (fnCache: tsFnInlineCache, dnaOpt: tsArrayDNA, _vN: string = "", declared: boolean, pathVar: string): tsJSFuncReturnLong => {
	const idx = instanceCount++;
	const varName = _vN.length ? _vN : "v";

	const _varName = "ar" + idx;
	const _result = "res" + idx;
	const _block = "arB" + idx;
	const _innerRes = "tmpAr" + idx;
	const aLen = "aLen" + idx;
	const aIdx = _varName + "[i]";

	const localBreak = "break " + _block + ";";
	const _localBreak = ";" + localBreak;
	const _localIfErrBreak = "if(errors.length)" + localBreak;

	const localConst = new Set();
	const opt = dnaOpt[0];

	let needLength = false;
	let hasContains = false;

	let arrayCheck = "";

	let needLoop = false;
	let preLoopContent = "";
	let loopBody = ""; // Loop content for items/prefixItems/contains
	let loopContainsContent = "";
	const prefixItems = []; // [index, fn, params]
	let defaultCaseContent = ""; // Content for default case in switch (items validation)
	let postLoopContent = ""

	const typeValidation = "if(!Array.isArray(" + _varName + ")){"
		+ (declared ? _err(_varName, pathVar + "/array", "Array is required") + _localBreak : _result + "=" + varName + _localBreak)
		+ "};";


	for (let i = 0; i < opt.length; i++) {
		const it = opt[i];
		const data = it[1];
		switch (it[0]) {
			case "uniqueItems": {
				const auErr = _err(_varName, pathVar + "/array/uniqueItems", "Array items must be unique");
				needLength = true;
				switch (data) {
					case 1:
						arrayCheck += "if(new Set(" + _varName + ").size < " + aLen + "){" + auErr + _localBreak + "}";
						break;
					case 2:
						arrayCheck += "const auSet=new Set(),auObj=[];let aui=" + aLen + "-1;for(;aui--;){const it=" + _varName + "[aui];"
							+ 'if(typeof it !=="object"||it===null){if(auSet.has(it)){' + auErr + _localBreak
							+ "}auSet.add(it);"
							+ "}else{for(let j=0;j<auObj.length;j++){" + "if(deepEqual(it,auObj[j])){" + auErr + _localBreak + "}" + "}auObj.push(it)}}";
						break;
				}
				break;
			}
			case "minItems":
				if (data > -1) {
					needLength = true;
					arrayCheck += "if(" + aLen + "<" + String(data) + "){" + _err(_varName, pathVar + "/array/minItems", "Array requires at least " + String(data) + " items") + _localBreak + "}";
				}
				break;
			case "maxItems":
				if (data > -1) {
					needLength = true;
					arrayCheck += "if(" + aLen + ">" + String(data) + "){" + _err(_varName, pathVar + "/array/maxItems", "Array requires at most " + String(data) + " items") + _localBreak + "}";
				}
				break;
			case "prefixItems": {
				needLength = true;
				needLoop = true;
				for (let i = 0; i < data.length; i++) {
					const itemFn = fnCache[data[i]];
					prefixItems.push([i, itemFn, [_varName + "[" + i + "]", pathVar + "/prefixItems/" + i, _innerRes + "[" + i + "]"]]);
				}
				break;
			}
			case "itemsT": {
				needLength = true;
				needLoop = true;
				for (let i = 0; i < data.length; i++) {
					const itemFn = fnCache[data[i]];
					prefixItems.push([i, itemFn, [_varName + "[" + i + "]", pathVar + "/items/" + i, _innerRes + "[" + i + "]"]]);
				}
				break;
			}
			case "items": {
				needLength = true;
				needLoop = true;
				const valAccess = "val";
				defaultCaseContent = fnCache[data](valAccess, pathVar + "/items", _innerRes + "[i]");
				break;
			}
			case "itemsB": {
				needLength = true;
				needLoop = true;
				const valAccess = "val";
				defaultCaseContent = data ? (_innerRes + "[i]=" + valAccess + ";") : _err(_varName, pathVar + "/array/items", "Items not allowed") + _localBreak;
				break;
			}
			case "containsB": {
				needLength = true;
				needLoop = true;
				const containsData = data[0];
				const minContains = data[1];
				const maxContains = data[2];
				const containsCount = "containsCnt" + idx;
				preLoopContent += "let " + containsCount + "=0;";
				if (containsData === true) {
					loopContainsContent += containsCount + "=" + aLen + ";";
				} else {
					preLoopContent += "if(" + aLen + "===0){" + _err(_varName, pathVar + "/array/contains", "Array must not be empty") + _localBreak + "}";
				}
				if (containsData === true) {
					if (minContains > -1)
						postLoopContent += "if(" + containsCount + "<" + String(minContains) + "){"
							+ _err(_varName, pathVar + "/array/contains", "Array must contain at least " + String(minContains) + " valid item(s)")
							+ _localBreak + "}";
					if (maxContains > -1)
						postLoopContent += "if(" + containsCount + ">" + String(maxContains) + "){"
							+ _err(_varName, pathVar + "/array/contains", "Array must contain at most " + String(maxContains) + " valid item(s)")
							+ _localBreak + "}";
				}
				break;
			}
			case "contains": {
				needLength = true;
				needLoop = true;
				const containsData = data[0];
				const minContains = data[1];
				const maxContains = data[2];
				const containsCount = "containsCnt" + idx;
				preLoopContent += "let " + containsCount + "=0;";
				loopContainsContent += "if(" + fnCache[containsData]("val", pathVar + "/contains/" + i) + "){errors.length=0;" + containsCount + "++;}";
				if (minContains > -1)
					postLoopContent += "if(" + containsCount + "<" + String(minContains) + "){"
						+ _err(_varName, pathVar + "/array/contains", "Array must contain at least " + String(minContains) + " valid item(s)")
						+ _localBreak + "}";
				if (maxContains > -1)
					postLoopContent += "if(" + containsCount + ">" + String(maxContains) + "){"
						+ _err(_varName, pathVar + "/array/contains", "Array must contain at most " + String(maxContains) + " valid item(s)")
						+ _localBreak + "}";
				break;
			}
		}
	}

	if (needLength) localConst.add(aLen + "=" + _varName + ".length");

	if (needLoop) {
		loopBody += preLoopContent;
		loopBody += "for(let i=0;i<" + aLen + ";i++){const val=" + aIdx + ";"
		loopBody += loopContainsContent;
		// Generate loop content for prefixItems/items
		if (prefixItems.length > 0) {
			let switchContent = "switch(i){";
			for (let i = 0; i < prefixItems.length; i++) {
				const [idx, stringFn, params] = prefixItems[i];
				switchContent += "case " + idx + ":{" + stringFn("val", ...(params.slice(1))) + "}break;";
			}
			// Use defaultCaseContent for items, or accept additional items if no items schema (prefixItems only)
			switchContent += "default:{" + (defaultCaseContent.length ? defaultCaseContent : _innerRes + "[i]=val;") + "}}";
			loopBody += switchContent + _localIfErrBreak;
		} else if (defaultCaseContent.length) {
			// Only items: simple loop
			loopBody += defaultCaseContent + _localIfErrBreak;
		}
		loopBody += "}";
		loopBody += postLoopContent;
	}



	const fullbody = "const " + _varName + "=" + varName + ";let " + _result + ";" + _block + ":{" +
		typeValidation +
		(localConst.size > 0 ? "const " + Array.from(localConst).join(",") + ";" : "") +
		(needLength ? "const " + _innerRes + "=new Array(" + aLen + ");" : "const " + _innerRes + "=new Array();")
		+ "{"
		+ arrayCheck
		+ loopBody
		// + _localIfErrBreak
		+ _result + "=" + _innerRes + ";"
		+ "}}";
	return [fullbody, _result];
};

export const a = (dnaOpt: tsArrayDNA, _vN: string = "", fnCache: tsFnInlineCache, pathVar: string) =>
	array(fnCache, dnaOpt, _vN, true, pathVar ?? "");
export const _a = (dnaOpt: tsArrayDNA, _vN: string = "", fnCache: tsFnInlineCache, pathVar: string) =>
	array(fnCache, dnaOpt, _vN, false, pathVar ?? "");

export const ifThenElse = (dnaOpt: tsIfThenElseDNA, _vN: string = "", fnCache: tsFnInlineCache, pathVar: string): tsJSFuncReturnLong => {
	const indices = dnaOpt[0];
	const ifPart = indices[0];
	const thenPart = indices[1];
	const elsePart = indices[2];
	const varName = _vN.length ? _vN : "v";
	const idx = instanceCount++;
	const _result = "res" + idx;
	const _block = "ifB" + idx;
	const _localBreak = ";break " + _block + ";";

	const ifFn = ifPart === -1 ? "true" : fnCache[ifPart](varName, pathVar + "/if");
	const thenFn = thenPart === -1 ? varName : fnCache[thenPart](varName, pathVar + "/then");
	const elseFn = elsePart === -1 ? varName : fnCache[elsePart](varName, pathVar + "/else");

	const fullBody = "let " + _result + ";" + _block + ":{"
		+ "if(" + ifFn + "){" + _result + "=" + thenFn + "}"
		+ "else{" + _result + "=" + elseFn + "}"
		+ "}";
	return [fullBody, _result];
};

export const not = (dnaOpt: [any], _vN: string = "", fnCache: tsFnInlineCache, pathVar: string): tsJSFuncReturnLong => {
	const innerIndex = dnaOpt[0][0];
	const varName = _vN.length ? _vN : "v";
	const idx = instanceCount++;
	const _result = "res" + idx;
	const _block = "notB" + idx;
	const _localBreak = ";break " + _block + ";";

	const innerResult = fnCache[innerIndex](varName, pathVar + "/not");
	const innerBody = innerResult + ";";

	const fullBody = "let " + _result + ";" + _block + ":{"
		+ innerBody
		+ "if(errors.length){" + "errors.length=0;" + _result + "=" + varName + _localBreak + "}"
		+ _err(varName, pathVar + "/not", "Data should NOT be valid to schema:" + dnaOpt[0][1]) + _localBreak
		+ "}";
	return [fullBody, _result];
};

export const anyOf = (dnaOpt: [any], _vN: string = "", fnCache: tsFnInlineCache, pathVar: string): tsJSFuncReturnLong => {
	const indices = dnaOpt[0].slice(0, -1);
	const varName = _vN.length ? _vN : "v";
	const idx = instanceCount++;
	const _result = "res" + idx;
	const _block = "anyB" + idx;
	const _localBreak = ";break " + _block + ";";

	let body = "";
	for (let i = 0; i < indices.length; i++) {
		if (i > 0) body += "errors.length=0;";
		const fnResult = fnCache[indices[i]](varName, pathVar + "/anyOf/" + i, _result);
		body += fnResult + "if(!errors.length){" + _localBreak + "}";
	}

	const fullBody = 'let ' + _result + ";"
		+ _block + ":{"
		+ body
		+ _err(varName, pathVar + "/anyOf", "Data should be valid to at least one schema") + ERR_UNDEF
		+ "}";
	return [fullBody, _result];
};

export const allOf = (dnaOpt: [any], _vN: string = "", fnCache: tsFnInlineCache, pathVar: string): tsJSFuncReturnLong => {
	const indices = dnaOpt[0].slice(0, -1);
	const varName = _vN.length ? _vN : "v";
	const idx = instanceCount++;
	// const _varName = "al" + idx;
	const _result = "res" + idx;
	const _block = "alB" + idx;
	const localBreak = "break " + _block + ";";

	// const _innerRes = "tmpAl" + idx;
	let body = ""
	for (let i = 0; i < indices.length; i++) body += fnCache[indices[i]](varName, pathVar + "/allOf/" + i) + ";if(errors.length) " + localBreak;

	// allOf is valid if all schemas are valid
	// return "(" + validations.join("&&") + ")||(" + _err(_vN, pathVar + "/allOf", "Data should be valid to each and every schema") + ERR_UNDEF + ")";
	const fullBody = 'let ' + _result + ";"
		+ _block + ":{"
		+ body
		+ _result + "=" + varName
		+ "}";
	return [fullBody, _result]
};

export const oneOf = (dnaOpt: [any], _vN: string = "", fnCache: tsFnInlineCache, pathVar: string): tsJSFuncReturnLong => {
	const indices = dnaOpt[0].slice(0, -1);
	const varName = _vN.length ? _vN : "v";
	const idx = instanceCount++;
	const _result = "res" + idx;
	const _block = "oneB" + idx;
	const _count = "oneCnt" + idx;
	const localBreak = "break " + _block + ";";


	let body = "";
	for (let i = 0; i < indices.length; i++) {
		body += fnCache[indices[i]](varName, pathVar + "/oneOf/" + i) + ";if((!errors.length?++" + _count + ":(errors.length = 0))>1)" + localBreak;
	}

	const fullBody = "let " + _result + ";{"
		+ "let " + _count + "=0;"
		+ _block + ":{"
		+ body
		+ "}"
		+ "if(" + _count + "!==1){" + _err(varName, pathVar + "/oneOf", "Data should be valid to exactly one schema of:" + dnaOpt[0].slice(-1)) + ERR_UNDEF + "}"
		+ "else{" + _result + "=" + varName + "}"
		+ "}";
	return [fullBody, _result];
};

export {
	boolean as b,
	constType as c,
	constTypeComplex as _c,
	enumType as e,
	falseLiteral as F,
	literal as l,
	nullType as n0,
	trueLiteral as T,
};
