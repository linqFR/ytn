import { describe, it, expect } from "vitest";
import { execute } from "../src/factory.js";
import { createContract } from "../src/contract.js";
import {
  routes
} from "./fixtures.js";

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  routes,
  cli: { positionals: ["cmd", "files"] },
});

const cli = (argv: string[]) => execute(processed, argv);

describe("cliFactory (parser-only)", () => {
  describe("help routing (via flagMap)", () => {
    it("should route --help to help", () => {
      const result = cli(["--help"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("help");
    });

    it("should route -h to help", () => {
      const result = cli(["-h"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("help");
    });

    it("should route 'help' subcommand to help", () => {
      const result = cli(["help"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("help");
    });

    it("should route 'help build' to help with files=['build']", () => {
      const result = cli(["help", "build"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("help");
        expect(result.payload.files).toEqual(["build"]);
      }
    });

    it("should route 'build --help' to help with files=['build']", () => {
      const result = cli(["build", "--help"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("help");
        expect(result.payload.files).toEqual(["build"]);
      }
    });

    it("should route 'deploy --help' to help with files=['deploy']", () => {
      const result = cli(["deploy", "--help"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("help");
        expect(result.payload.files).toEqual(["deploy"]);
      }
    });
  });

  describe("version routing (via flagMap)", () => {
    it("should route --version to version", () => {
      const result = cli(["--version"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("version");
    });

    it("should route -v to version", () => {
      const result = cli(["-v"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("version");
    });

    it("should route 'version' subcommand to version", () => {
      const result = cli(["version"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("version");
    });

    it("should route 'build --version' to version", () => {
      const result = cli(["build", "--version"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("version");
    });
  });

  describe("command routing", () => {
    it("should route 'build a.ts b.ts --output dist/' to build", () => {
      const result = cli(["build", "a.ts", "b.ts", "--output", "dist/"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("build");
        expect(result.payload.files).toEqual(["a.ts", "b.ts"]);
        expect(result.payload.output).toBe("dist/");
      }
    });

    it("should route 'deploy --target prod --port 3000' to deploy", () => {
      const result = cli(["deploy", "--target", "prod", "--port", "3000"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("deploy");
        expect(result.payload.target).toBe("prod");
        expect(result.payload.port).toBe(3000);
      }
    });

    it("should strip \\x00ID from payload", () => {
      const result = cli(["build"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload["\x00ID"]).toBeUndefined();
      }
    });
  });

  describe("error cases", () => {
    it("should return error for unknown command", () => {
      const result = cli(["unknown"]);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return error for empty argv", () => {
      const result = cli([]);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return error for invalid port type (non-coercible)", () => {
      const result = cli(["deploy", "--target", "prod", "--port", "abc"]);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("-- separator", () => {
    it("should handle -- separator for positional args", () => {
      const result = cli(["build", "--", "--weird-file-name"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("build");
        expect(result.payload.files).toContain("--weird-file-name");
      }
    });
  });
});
