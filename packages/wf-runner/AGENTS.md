# AGENTS.md (Package: @ytn/wf)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**.

## Naming Standards Enforcement

This package follows the global naming standards. Refer to the examples below for specific implementations within this codebase.

### 1. Runtime Validation (Zod)

- **Examples**: `WorkflowSchema`, `StepSchema`, `GateSchema`.

### 2. Input Data Structures (`I*`)

- **Examples**: `IWorkflowConfig`, `IStepDefinition`.

### 3. Output Data Structures (`O*`)

- **Examples**: `ORunnerResult`, `OExecutionError`.

### 4. Simple TypeScript Type Aliases (`ts*`)

- **Examples**:
  - `tsWFSpec`: Definition of the workflow map.
  - `tsStep`: A single step logic and metadata.
  - `tsGateResult`: The outcome of a gate function.
  - `tsWFTools`: Tools injected into gate execution.

### 5. High-level Utility Types (`u*`)

- **Example**: `uDefineWf<T>`. Final utility function for workflow orchestration.

---

## Architectural Context

- **Workflow Engine**: This package provides a high-performance, Zod-validated workflow router.
- **AOT Optimization**: Uses `zod-aot` pre-compilation for fastest gate evaluation and data transformation.
- **Boxed Steps**: Steps are encapsulated in "boxed" objects (containing `__step` and `__data`) to allow for type-safe routing and state preservation.

---

## TS 6.0 Specifics

- **DSL Inference**: When using `uDefineWf`, prefer the method shorthand `gate(ctx) { ... }` (which TS 6.0 now treats as "this-less" and prioritizes for inference) over property-based arrow functions where applicable to improve compile-time performance and readability.

---

## Zod v4 Standards

- **Strict Contracts**: All workflow-related schemas (`WorkflowSchema`, `StepSchema`) MUST use `z.strictObject()` by default to prevent non-compliant data injection.
- **Reflection**: Use the `._zod` buffer exclusively for inspecting step metadata or schemas. Access to `._def` is strictly forbidden.
- **Error Unification**: Prefer the `{ error: "..." }` parameter in `z.custom` or refinements over the deprecated `{ message: "..." }`.

---

## Testing Standards

- **Functional Regression**: Maintain `tests/basic-execution.test.ts` for runtime validation.
- **Type Regression**: ALWAYS maintain and update `tests/types.test.ts` using **`expectTypeOf`** to ensure the stability of the `uStep` and `uDefineWF` inference engine. Any change to the DSL architecture MUST be reflected and validated in these type tests.
