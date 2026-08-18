export { createContract } from "./contract.js";
export { executeContract, cliFactory, fullCli, execute } from "./factory.js";
export { compile } from "./compile.js";
export { formatCliError } from "./error.js";
export { buildHelp, printHelp } from "./help.js";

import type {
  IContract,
  IContractOptions,
  IProcessedContract,
  IExecutableContract,
  IFormattedContract,
  ICliOptions,
  ICliMeta,
  IFlagMap,
  OParseArgsConfig,
  OPositionalMeta,
  OExecuteResult,
  OHandlerResult,
  OFormattedResult,
  CliError as CliErrorType,
  IHandlers,
  RouteHandler as RouteHandlerType,
  FormatterFn as FormatterFnType,
} from "./types/contract.types.js";

/**
 * Public type namespace — all public types accessible as `ts.Contract`,
 * `ts.HandlerResult`, etc. Names are stripped of the internal I/O prefix.
 */
export namespace ts {
  export type Contract = IContract;
  export type ContractOptions = IContractOptions;
  export type ProcessedContract = IProcessedContract;
  export type ExecutableContract = IExecutableContract;
  export type FormattedContract = IFormattedContract;
  export type CliOptions = ICliOptions;
  export type CliMeta = ICliMeta;
  export type FlagMap = IFlagMap;
  export type ParseArgsConfig = OParseArgsConfig;
  export type PositionalMeta = OPositionalMeta;
  export type ExecuteResult = OExecuteResult;
  export type HandlerResult = OHandlerResult;
  export type FormattedResult = OFormattedResult;
  export type CliError = CliErrorType;
  export type Handlers = IHandlers;
  export type RouteHandler = RouteHandlerType;
  export type FormatterFn = FormatterFnType;
}
