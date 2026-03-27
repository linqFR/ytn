import { tsParseArgObjectName } from "../config/parse-args.js";

export type tsBitCodes = Record<
  tsParseArgObjectName, // dataName
  bigint
>;
export type tsBitRouter = Record<string, tsParseArgObjectName>;
export type tsBitGroups = Map<bigint, tsParseArgObjectName[]>;

export type tsInterceptor = Record<tsParseArgObjectName, bigint>;
