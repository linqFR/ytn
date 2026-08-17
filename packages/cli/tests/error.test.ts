import { describe, it, expect } from "vitest";
import { formatCliError } from "../src/error.js";

describe("formatCliError", () => {
  it("should format a single error with message and path", () => {
    const errors = [
      { message: "String is required", path: "cmd.value" },
    ];
    const result = formatCliError(errors);
    expect(result).toBe("Error: String is required at cmd.value");
  });

  it("should format a single error with string path", () => {
    const errors = [
      { message: "Required property missing", path: "#/cli/object/required/cmd" },
    ];
    const result = formatCliError(errors);
    expect(result).toBe("Error: Required property missing at #/cli/object/required/cmd");
  });

  it("should format error without path", () => {
    const errors = [
      { message: "No CLI branch matches (cmd)", path: "" },
    ];
    const result = formatCliError(errors);
    expect(result).toBe("Error: No CLI branch matches (cmd)");
  });

  it("should format multiple errors joined with newline", () => {
    const errors = [
      { message: "String is required", path: "cmd" },
      { message: "Number is required", path: "port" },
    ];
    const result = formatCliError(errors);
    expect(result).toBe("Error: String is required at cmd\nError: Number is required at port");
  });

  it("should handle error with empty path", () => {
    const errors = [
      { message: "Unknown error", path: "" },
    ];
    const result = formatCliError(errors);
    expect(result).toBe("Error: Unknown error");
  });

  it("should handle error without message field", () => {
    const errors = [
      { path: "cmd" },
    ];
    const result = formatCliError(errors);
    expect(result).toBe("Error: Unknown error at cmd");
  });

  it("should handle empty errors array", () => {
    const result = formatCliError([]);
    expect(result).toBe("");
  });
});
