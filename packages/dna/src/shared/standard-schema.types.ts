/**
 * Standard Schema Protocol Types
 *
 * This module provides type definitions for the Standard Schema Protocol V1,
 * enabling DNA schemas to be compatible with frameworks that support
 * the standard validation interface (Remix, Next.js, tRPC, etc.).
 *
 * These types follow the official Standard Schema V1 specification.
 * see https://github.com/standard-schema/standard-schema
 * see https://standardschema.dev/
 */

/**
 * Standard Schema V1 interface
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export namespace StandardSchemaV1 {
	/**
	 * The Standard Schema properties interface
	 */
	export interface Props<Input = unknown, Output = Input> {
		/** The version number of the standard. */
		readonly version: 1;
		/** The vendor name of the schema library. */
		readonly vendor: string;
		/** Inferred types associated with the schema. */
		readonly types?: Types<Input, Output> | undefined;
		/** Validates unknown input values. */
		readonly validate: (value: unknown, options?: Options | undefined) => Result<Output> | Promise<Result<Output>>;
	}

	/**
	 * The result interface of the validate function.
	 */
	export type Result<Output> = SuccessResult<Output> | FailureResult;

	/**
	 * The result interface if validation succeeds.
	 */
	export interface SuccessResult<Output> {
		/** The typed output value. */
		readonly value: Output;
		/** The absence of issues indicates success. */
		readonly issues?: undefined;
	}

	/**
	 * The result interface if validation fails.
	 */
	export interface FailureResult {
		/** The issues of failed validation. */
		readonly issues: ReadonlyArray<Issue>;
	}

	/**
	 * The issue interface of the failure output.
	 */
	export interface Issue {
		/** The error message of the issue. */
		readonly message: string;
		/** The path of the issue, if any. */
		readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
	}

	/**
	 * The path segment interface of the issue.
	 */
	export interface PathSegment {
		/** The key representing a path segment. */
		readonly key: PropertyKey;
	}

	/**
	 * The options for the validate function.
	 */
	export interface Options {
		/** Implicit support for additional vendor-specific parameters, if needed. */
		readonly libraryOptions?: Record<string, unknown> | undefined;
	}

	/**
	 * The Standard types interface.
	 */
	export interface Types<Input = unknown, Output = Input> {
		/** The input type of the schema. */
		readonly input: Input;
		/** The output type of the schema. */
		readonly output: Output;
	}
}

/**
 * Standard JSON Schema V1 interface
 */
export interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
	readonly "~standard": StandardJSONSchemaV1.Props<Input, Output>;
}

export namespace StandardJSONSchemaV1 {
	/**
	 * The Standard JSON Schema properties interface.
	 */
	export interface Props<Input = unknown, Output = Input> {
		/** The version number of the standard. */
		readonly version: 1;
		/** The vendor name of the schema library. */
		readonly vendor: string;
		/** Inferred types associated with the schema. */
		readonly types?: Types<Input, Output> | undefined;
		/** Methods for generating the input/output JSON Schema. */
		readonly jsonSchema: Converter;
	}

	/**
	 * The Standard JSON Schema converter interface.
	 */
	export interface Converter {
		/** Converts the input type to JSON Schema. May throw if conversion is not supported. */
		readonly input: (options: Options) => Record<string, unknown>;
		/** Converts the output type to JSON Schema. May throw if conversion is not supported. */
		readonly output: (options: Options) => Record<string, unknown>;
	}

	/**
	 * The target version of the generated JSON Schema.
	 */
	export type Target = "draft-2020-12" | "draft-07" | "openapi-3.0" | ({} & string);

	/**
	 * The options for the input/output methods.
	 */
	export interface Options {
		/** Specifies the target version of the generated JSON Schema. */
		readonly target: Target;
		/** Implicit support for additional vendor-specific parameters, if needed. */
		readonly libraryOptions?: Record<string, unknown> | undefined;
	}

	/**
	 * The Standard types interface.
	 */
	export interface Types<Input = unknown, Output = Input> {
		/** The input type of the schema. */
		readonly input: Input;
		/** The output type of the schema. */
		readonly output: Output;
	}
}

/**
 * Combined interface for schemas with both validation and JSON Schema support.
 */
export interface StandardSchemaWithJSONProps<Input = unknown, Output = Input> extends StandardSchemaV1.Props<Input, Output>, StandardJSONSchemaV1.Props<Input, Output> {
}

/**
 * An interface that combines StandardJSONSchema and StandardSchema.
 */
export interface StandardSchemaWithJSON<Input = unknown, Output = Input> {
	readonly "~standard": StandardSchemaWithJSONProps<Input, Output>;
}
