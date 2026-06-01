import type { tsMapper } from "../dna.type.js";
import * as kw from "./kw-to-js-valid_deprecated.js";

export const mapperValid: tsMapper = {
	s: kw.s,
	_s: kw.s,
	n: kw.n,
	_n: kw.n,
	i: kw.i,
	bi: kw.n,
	b: kw.b,
	n0: kw.n0,
	T: kw.T,
	F: kw.F,
	c: kw.c,
	l: kw.l,
	e: kw.e,
	o: kw.o as any,
	_o: kw.o as any,
	a: kw.a as any,
	_a: kw.a as any,
	ifThenElse: kw.ifThenElse as any,
	not: kw.not as any,
	anyOf: kw.anyOf as any,
	
	// Aliases
	string: kw.s,
	number: kw.n,
	integer: kw.i,
	boolean: kw.b,
	nullType: kw.n0,
	trueLiteral: kw.T,
	falseLiteral: kw.F,
	constType: kw.c,
	literal: kw.l,
	enumType: kw.e,
	object: kw.o as any,
	array: kw.a as any,
};
