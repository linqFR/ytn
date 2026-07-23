import { describe, it } from "vitest";
import { dna } from "../src/index.js";
import { toJS } from "../src/toJs/dna-to-js.js";

describe("inspect", () => {
  it("array of strings", () => {
    const s = dna.array(dna.string());
    const p = (s as any)._safeParse();
    console.log("=== toString ===");
    console.log(p.toString());
    console.log("=== [1,2,3] ===");
    console.log(JSON.stringify(p([1, 2, 3])));
    console.log("=== ['a','b'] ===");
    console.log(JSON.stringify(p(["a", "b"])));
  });

  it("json array", () => {
    const s = dna.json();
    const p = (s as any)._safeParse();
    console.log("=== json toString ===");
    console.log(p.toString());
    console.log("=== [1,2,3] ===");
    console.log(JSON.stringify(p([1, 2, 3])));
  });

  it("json code", () => {
    const s = dna.json();
    const dnaSeq = (s as any).toDna();
    const { code } = toJS(false, true)(dnaSeq) as { code: string[] };
    for (const c of code) console.log("===");
    for (const c of code) console.log(c);
  });

  it("boolean record", () => {
    const s = dna.record(dna.string(), dna.boolean());
    const p = (s as any)._safeParse();
    console.log("=== boolean record toString ===");
    console.log(p.toString());
    console.log("=== {asdf:1234} ===");
    console.log(JSON.stringify(p({ asdf: 1234 })));
  });

  it("record enum keys", () => {
    const s = dna.record(dna.enum(["Tuna", "Salmon"]), dna.string());
    const p = (s as any)._safeParse();
    console.log("=== record enum toString ===");
    console.log(p.toString());
    console.log("=== {Tuna:'asdf'} ===");
    console.log(JSON.stringify(p({ Tuna: "asdf" })));
  });

  it("record key refine", () => {
    const s = dna.record(
      dna.literal(["a", "b"]).refine((k: any) => k === "a", { message: "only 'a' is allowed" }),
      dna.string()
    );
    const p = (s as any)._safeParse();
    console.log("=== record key refine toString ===");
    console.log(p.toString());
    console.log("=== {a:'ok',b:'nope'} ===");
    console.log(JSON.stringify(p({ a: "ok", b: "nope" })));
  });

  it("union 2", () => {
    const s = dna.union([dna.number(), dna.string().refine(() => false)]);
    const p = (s as any)._safeParse();
    console.log("=== union2 toString ===");
    console.log(p.toString());
    console.log("=== 'a' ===");
    console.log(JSON.stringify(p("a")));
  });

  it("xor", () => {
    const s = dna.string().xor(dna.number());
    const p = (s as any)._safeParse();
    console.log("=== xor toString ===");
    console.log(p.toString());
    console.log("=== 'hello' ===");
    console.log(JSON.stringify(p("hello")));
  });

  it("union function parsing", () => {
    const s = dna.union([dna.string().refine(() => false), dna.number().refine(() => false)]);
    const p = (s as any)._safeParse();
    console.log("=== union function parsing toString ===");
    console.log(p.toString());
    console.log("=== 'asdf' ===");
    console.log(JSON.stringify(p("asdf")));
  });
});
