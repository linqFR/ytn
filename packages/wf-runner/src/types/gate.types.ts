import { sGateResult } from "../core/constants.js";
import type { $Awaitable } from "@ytn/shared/types/async.type.js"

export type tsWFGateName = string;
export type tsWFOnMapKey = string;

export type tsWFOnMap = Record<tsWFOnMapKey, tsWFGateName>;

/** @type {Object} tsGateResult */
export type tsGateResultRaw<T = unknown> = {
  nextStep: string;
  data: T;
  [sGateResult]: true;
};

export type tsGateResultVoid<T = unknown> = tsGateResultRaw<T> | void;

export type tsGateResult<T = unknown> = $Awaitable<tsGateResultVoid<T>>;
