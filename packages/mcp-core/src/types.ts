/**
 * Core contracts for @ytrynot/mcp-core — transport-agnostic and
 * schema-library-agnostic.
 *
 * A domain package exposes a `toolList`: declarative entries pairing a tool
 * name with its input/output schemas and a pure `(ctx, input, req?) →
 * tsToolOutcome` handler. `Ctx` is the domain-owned context (db, queries,
 * directories…); mcp-core never interprets it.
 */

/**
 * Minimal schema contract — Standard Schema V1 `validate` + Standard JSON
 * Schema `jsonSchema` converter, i.e. exactly what `@modelcontextprotocol/
 * server` requires of `inputSchema`/`outputSchema` (its `StandardSchemaWithJSON`
 * type). Structurally satisfied by @ytrynot/dna schemas, Zod v4, ArkType, and
 * Valibot — mcp-core depends on none of them.
 *
 * `meta()` is a soft capability present on DNA and Zod v4 schemas; when absent
 * the tool simply has no derived description.
 */
/**
 * JSON Schema conversion target — mirrors the SDK's `StandardJSONSchemaV1.
 * Target` union verbatim so `IToolSchema` stays SDK-free while accepting
 * `StandardSchemaWithJSON` implementations (e.g. `fromJsonSchema` results).
 *
 * `(object & string)` is the spec's "any other string" escape hatch — note it
 * is actually an empty intersection (`string & object` accepts nothing), so
 * the union is effectively closed to the three literals. Kept verbatim for
 * fidelity with the SDK declaration, which has the same inoperative hatch.
 */
export type tsJsonSchemaTarget = "draft-2020-12" | "draft-07" | "openapi-3.0" | (object & string);

/**
 * Help-page category descriptor carried by a schema's `.meta()` payload.
 * Domains enumerate their own values (e.g. a read/write/admin/system set);
 * mcp-core only defines the shape so list-mode grouping has a stable
 * contract: `order` sorts categories, `key` identifies them
 * programmatically, `name` is the human heading.
 */
export interface IToolHelpCategory {
  /** Human-readable section heading, e.g. "Administration". */
  readonly name: string;
  /** Stable machine key, e.g. "admin". */
  readonly key: string;
  /** Sort position of the section within the help page. */
  readonly order: number;
}

export interface IToolSchema<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
    readonly validate: (
      value: unknown,
      options?: { readonly libraryOptions?: Record<string, unknown> | undefined } | undefined,
    ) => IToolSchemaResult<Output> | Promise<IToolSchemaResult<Output>>;
    readonly jsonSchema: {
      readonly input: (options: {
        readonly target: tsJsonSchemaTarget;
        readonly libraryOptions?: Record<string, unknown> | undefined;
      }) => Record<string, unknown>;
      readonly output: (options: {
        readonly target: tsJsonSchemaTarget;
        readonly libraryOptions?: Record<string, unknown> | undefined;
      }) => Record<string, unknown>;
    };
  };
  meta?(): {
    readonly description?: string;
    /**
     * Help prose paragraphs — what the tool does, how to call it, pitfalls.
     * Rendered joined by blank lines in the `{{usage}}` token. The closing
     * note (caveats, security warnings, "what this tool cannot do") is a
     * distinct part: declare it in `foot`, rendered by `{{foot}}`.
     */
    readonly usage?: readonly string[];
    /** Return-shape hint, e.g. `"{ id, seq }"`. */
    readonly returns?: string;
    /**
     * Closing note rendered last by `{{foot}}` — caveats, security warnings,
     * limitations. A real part (stylable, movable by custom templates),
     * not just the last `usage` paragraph.
     */
    readonly foot?: string;
    /**
     * Grouping category for help pages — declares which section of a help
     * listing the tool belongs to. mcp-core never interprets it; the domain
     * reads `entry.args.meta()?.category` to group before rendering (the
     * `help()` pattern). Shape convention: `{ name, key, order }`.
     */
    readonly category?: IToolHelpCategory;
  } | undefined;
}

/** Standard Schema V1 validation result (success value or issue list). */
export type IToolSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string }> };

/**
 * Content-item annotations (MCP spec: `audience`, `priority`, `lastModified`)
 * — same shape on every content type.
 */
export interface IContentAnnotations {
  readonly audience?: ("user" | "assistant")[];
  /** 0..1 — higher means more important for the end user. */
  readonly priority?: number;
  /** ISO-8601 timestamp of last modification. */
  readonly lastModified?: string;
}

/**
 * One content item in a tool result — the full MCP `ContentBlock` union:
 * `text`, `image`, `audio`, `resource_link`, or embedded `resource`.
 * Declared locally so the core entry stays SDK-free; structurally assignable
 * to the SDK's `CallToolResult["content"]` items.
 */
export type tsToolContent =
  | { readonly type: "text"; readonly text: string; readonly annotations?: IContentAnnotations }
  | {
      readonly type: "image";
      readonly data: string;
      readonly mimeType: string;
      readonly annotations?: IContentAnnotations;
    }
  | {
      readonly type: "audio";
      readonly data: string;
      readonly mimeType: string;
      readonly annotations?: IContentAnnotations;
    }
  | {
      readonly type: "resource_link";
      readonly uri: string;
      readonly name: string;
      readonly description?: string;
      readonly mimeType?: string;
      readonly annotations?: IContentAnnotations;
    }
  | {
      readonly type: "resource";
      readonly resource:
        | { readonly uri: string; readonly mimeType?: string; readonly text: string; readonly annotations?: IContentAnnotations }
        | { readonly uri: string; readonly mimeType?: string; readonly blob: string; readonly annotations?: IContentAnnotations };
      readonly annotations?: IContentAnnotations;
    };

/** A tool result — MCP `CallToolResult`-compatible plain object. */
export interface IToolResult {
  content: tsToolContent[];
  structuredContent?: unknown;
  isError: boolean;
}

/**
 * A form-mode elicitation embedded in an `input_required` result: the
 * client renders `message` and collects fields described by
 * `requestedSchema` — a Standard Schema (e.g. a DNA `dna.object`) or a
 * raw JSON Schema document in the restricted elicitation shape (an
 * object of primitive properties only).
 */
export interface IToolInputRequestForm {
  readonly kind: "form";
  readonly message: string;
  readonly requestedSchema: IToolSchema | Record<string, unknown>;
}

/**
 * A URL-mode elicitation embedded in an `input_required` result: the
 * client must send the user to `url` out-of-band (an OAuth or consent
 * page); `message` explains why.
 */
export interface IToolInputRequestUrl {
  readonly kind: "url";
  readonly message: string;
  readonly url: string;
}

/**
 * One embedded request of an `input_required` result. Only the
 * elicitation kinds are exposed: embedded sampling (`createMessage`) and
 * roots (`listRoots`) exist in the 2026-07-28 vocabulary but are
 * deprecated (SEP-2577).
 */
export type IToolInputRequest = IToolInputRequestForm | IToolInputRequestUrl;

/**
 * A tool's `input_required` answer (protocol revision 2026-07-28 — the
 * spec's multi-round-trip pattern): asks the client to fulfil
 * `inputRequests` and retry the same call. The retry reaches the handler
 * again with the client's answers in `req.inputResponses` — see
 * {@link IToolCallInfo}.
 *
 * `requestState` is opaque server state the client echoes back verbatim;
 * on re-entry it is attacker-controlled input — if it drives
 * authorization or business logic, integrity-protect it (HMAC/AEAD) and
 * reject state that fails verification.
 */
export interface IToolInputRequired {
  readonly resultType: "input_required";
  readonly inputRequests?: Readonly<Record<string, IToolInputRequest>>;
  readonly requestState?: string;
}

/** What a tool handler may return: a final result, or an `input_required` round. */
export type tsToolOutcome = IToolResult | IToolInputRequired;

/**
 * Wire context of the current `tools/call` round — the handler's
 * optional third argument. Populated by `registerTools`; absent on
 * in-process dispatch (`core.call`, `dispatchTool` without it) and empty
 * on first-round calls.
 */
export interface IToolCallInfo {
  /**
   * Client answers to a previous `input_required` round, keyed by the
   * `inputRequests` keys the handler sent. Values arrive from the client
   * unvalidated — read them via {@link toolAcceptedContent}.
   */
  readonly inputResponses?: Readonly<Record<string, unknown>>;
  /**
   * Keys of `inputResponses` the transport dropped because they were not
   * bare response objects — re-issue the corresponding input request
   * rather than hard-fail.
   */
  readonly droppedInputResponseKeys?: readonly string[];
  /**
   * The `requestState` the client echoed back — unverified unless the
   * server configured a verify hook; treat as attacker-controlled input.
   */
  readonly requestState?: unknown;
}

/**
 * One registered tool. `args` is the input schema (serialized to JSON Schema
 * for `tools/list` and used by the SDK to validate protocol calls); `output`
 * validates `structuredContent` when present.
 *
 * `handler` is declared as a method so per-tool input types remain assignable
 * under strictFunctionTypes (bivariant method position): handlers keep their
 * concrete inferred input type in the domain package while the registry sees
 * a uniform `unknown`. A handler answers either an {@link IToolResult} or an
 * {@link IToolInputRequired} to drive a multi-round-trip call.
 */
export interface IToolEntry<Ctx> {
  readonly name: string;
  readonly args: IToolSchema;
  readonly output?: IToolSchema;
  /** Override description; defaults to `args.meta().description` when the schema library provides it. */
  readonly description?: string;
  handler(ctx: Ctx, input: unknown, req?: IToolCallInfo): tsToolOutcome;
}

/** Result of a dispatched call — the tool's own result, or a not-found error. */
export function toolError(text: string): IToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** Type guard for the `input_required` variant of {@link tsToolOutcome}. */
export function isToolInputRequired(result: tsToolOutcome): result is IToolInputRequired {
  return "resultType" in result && result.resultType === "input_required";
}

/**
 * Build an `input_required` result. Mirrors the wire contract: at least
 * one of `inputRequests` or `requestState` is required — enforced here so
 * the failure surfaces in-process, not only at the transport seam.
 */
export function toolInputRequired(
  spec: Omit<IToolInputRequired, "resultType">,
): IToolInputRequired {
  if (spec.inputRequests === undefined && spec.requestState === undefined)
    throw new TypeError(
      "toolInputRequired: at least one of inputRequests or requestState is required",
    );
  return { resultType: "input_required", ...spec };
}

/**
 * Read the `content` of an accepted form-elicitation answer from
 * `req.inputResponses`. Returns `undefined` for a missing key, a
 * declined/cancelled elicitation, or a response of another kind. The
 * values arrive from the client unvalidated — pair the asserted type
 * with the schema the request asked for.
 */
export function toolAcceptedContent<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  responses: Readonly<Record<string, unknown>> | undefined,
  key: string,
): T | undefined {
  const entry = responses?.[key];
  if (typeof entry !== "object" || entry === null) return undefined;
  if (!("action" in entry) || entry.action !== "accept") return undefined;
  if (!("content" in entry)) return undefined;
  // CAST: caller-asserted output type — the response content arrives
  // from the client unvalidated; the caller pairs T with the schema the
  // input request advertised.
  return entry.content as T;
}

/**
 * Find a tool by name and invoke its handler — no transport involved.
 * Used by hooks, tests, and any in-process embedding. `req` carries the
 * {@link IToolCallInfo} of a retried call when the caller replays an
 * `input_required` round itself.
 */
export function dispatchTool<Ctx>(
  tools: readonly IToolEntry<Ctx>[],
  ctx: Ctx,
  name: string,
  args: unknown,
  req?: IToolCallInfo,
): tsToolOutcome {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return toolError(`Unknown tool: ${name}`);
  return tool.handler(ctx, args, req);
}

/** Bound dispatcher — create once per core instance, then `call(name, args)`. */
export function createDispatcher<Ctx>(
  tools: readonly IToolEntry<Ctx>[],
  ctx: Ctx,
): (name: string, args: unknown, req?: IToolCallInfo) => tsToolOutcome {
  return (name, args, req) => dispatchTool(tools, ctx, name, args, req);
}

/**
 * A running core: the tool registry bound to its domain context.
 *
 * `ctx` carries whatever the domain needs — db handle, compiled queries,
 * directories, config. `call` dispatches in-process (hooks, tests); the same
 * core is passed to `registerTools`/`startStdioServer` for MCP transport.
 */
export interface IMcpCore<Ctx> {
  readonly tools: readonly IToolEntry<Ctx>[];
  readonly ctx: Ctx;
  call(name: string, args: unknown, req?: IToolCallInfo): tsToolOutcome;
  /** Idempotent lifecycle hook — runs the domain-provided `close` once. */
  close(): void | Promise<void>;
}

/**
 * MCP spec tool-name recommendation (SHOULD): 1-128 chars of
 * `[A-Za-z0-9_.-]`. Not enforced by the spec or the SDK — a violation is
 * legal on the wire, but clients may not handle such names reliably.
 */
const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

/**
 * Fail-fast registry validation, run once at `createCore` so an invalid
 * registry fails identically whether it is consumed in-process
 * (`dispatchTool` finds the first match and silently shadows later entries)
 * or via `registerTools` (the SDK throws on duplicates at server startup —
 * much later). Charset/length violations follow the SDK: warn and proceed.
 */
function checkToolNames<Ctx>(tools: readonly IToolEntry<Ctx>[]): void {
  const seen = new Set<string>();
  for (const tool of tools) {
    if (seen.has(tool.name)) throw new Error(`Duplicate tool name: "${tool.name}"`);
    seen.add(tool.name);
    if (!TOOL_NAME_PATTERN.test(tool.name))
      console.warn(
        `[mcp-core] Tool name ${JSON.stringify(tool.name)} does not conform to the MCP naming recommendation (expected /^[A-Za-z0-9_.-]{1,128}$/); registration proceeds but clients may not handle it reliably.`,
      );
  }
}

/**
 * Bind a tool registry to its context.
 *
 * `close` is optional and domain-owned — mcp-core does not know how to close
 * a db or flush state; pass `close: (ctx) => ctx.db.close()` when needed.
 * `core.close()` is safe to call repeatedly.
 *
 * Throws on duplicate tool names — the same failure `registerTool` would
 * raise at server start, surfaced here so in-process and transport paths
 * share the contract.
 */
export function createCore<Ctx>(opts: {
  tools: readonly IToolEntry<Ctx>[];
  ctx: Ctx;
  close?: (ctx: Ctx) => void | Promise<void>;
}): IMcpCore<Ctx> {
  checkToolNames(opts.tools);
  // Snapshot: a post-construction push into `opts.tools` must not bypass
  // checkToolNames — the core dispatches only the validated list.
  const tools = [...opts.tools];
  let closed = false;
  return {
    tools,
    ctx: opts.ctx,
    call: createDispatcher(tools, opts.ctx),
    close() {
      if (closed) return;
      closed = true;
      return opts.close?.(opts.ctx);
    },
  };
}

/**
 * Human-facing description for a tool: explicit `description`, else the
 * `description` carried by the input schema's `.meta()` when the schema
 * library provides one (DNA, Zod v4).
 */
export function toolDescription<Ctx>(tool: IToolEntry<Ctx>): string {
  if (tool.description !== undefined) return tool.description;
  return tool.args.meta?.()?.description ?? "";
}
