import { describe, expect, it } from "vitest";
import { tpl, yaml } from "../index.js";
import { isSuccess } from "../safe/safemode.js";

describe("shared/templates & yaml (Functional & Rupture)", () => {
  describe("Template Parser", () => {
    it("should render template with tags", () => {
      const text = "Hello {{NAME}}!";
      const tags = [{ tag: "{{NAME}}", txt: "World" }];
      expect(tpl.renderTemplate(text, tags)).toBe("Hello World!");
    });

    it("should handle multiple occurrences", () => {
      const text = "{{T}} {{T}}";
      const tags = [{ tag: "{{T}}", txt: "x" }];
      expect(tpl.renderTemplate(text, tags)).toBe("x x");
    });

    it("should handle onlyonce flag", () => {
      const text = "{{T}} {{T}}";
      const tags = [{ tag: "{{T}}", txt: "x", onlyonce: true }];
      expect(tpl.renderTemplate(text, tags)).toBe("x {{T}}");
    });

    it("should handle empty tag map (Rupture)", () => {
      expect(tpl.renderTemplate("test", [])).toBe("test");
    });
  });

  describe("YAML Parser", () => {
    it("should parse simple YAML", () => {
      const yml = "a: 1\nb: 2";
      const res = yaml.safeParseYaml(yml);
      expect(isSuccess(res)).toBe(true);
      expect(res[1]).toEqual({ a: 1, b: 2 });
    });

    it("should handle mid-line comments (Functional & Rupture)", () => {
      const yml =
        "key: val # this is a comment\n# whole-line: comment\nother: 123";
      const res = yaml.safeParseYaml(yml);
      expect(isSuccess(res)).toBe(true);
      expect(res[1]).toEqual({ key: "val", other: 123 });
    });

    it("should stringify to YAML", () => {
      const obj = { x: 10 };
      const res = yaml.safeToYaml(obj);
      expect(isSuccess(res)).toBe(true);
      expect(res[1]).toContain("x: 10");
    });
  });
});
