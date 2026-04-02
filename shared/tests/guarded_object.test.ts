import { describe, expect, it } from "vitest";
import { protectObject, unProtectObject, isProtected } from "../js/guarded_object.js";

describe("shared/guarded_object (Functional & Rupture)", () => {
  it("should enforce deep immutability when locked", () => {
    const data = { user: { name: "John", age: 30 }, settings: [1, 2, 3] };
    const protectedObj = protectObject(data) as any;

    expect(isProtected(protectedObj)).toBe(true);
    expect(protectedObj._isLocked()).toBe(true);

    // Initial check
    expect(protectedObj.user.name).toBe("John");

    // Rupture: attempt to modify root
    expect(() => {
      protectedObj.user = { name: "Alice" };
    }).toThrow(TypeError);

    // Rupture: attempt to modify nested
    expect(() => {
      protectedObj.user.name = "Alice";
    }).toThrow(TypeError);

    // Rupture: attempt to modify array
    expect(() => {
      protectedObj.settings.push(4);
    }).toThrow(TypeError);
  });

  it("should allow modification when unlocked", () => {
    const data = { count: 0 };
    const protectedObj = protectObject(data) as any;

    protectedObj._unlock();
    expect(protectedObj._isLocked()).toBe(false);

    protectedObj.count = 1;
    expect(protectedObj.count).toBe(1);
    expect(data.count).toBe(1); // Original is modified

    protectedObj._lock();
    expect(() => {
      protectedObj.count = 2;
    }).toThrow(TypeError);
  });

  it("should unwrap correctly using _unwrap", () => {
    const data = { secret: "123" };
    const protectedObj = protectObject(data) as any;
    
    const unwrapped = unProtectObject(protectedObj);
    expect(unwrapped).toBe(data);
    expect(isProtected(unwrapped)).toBe(false);
  });

  it("should prevent double-wrapping (Anti-redondance)", () => {
    const data = { id: 1 };
    const p1 = protectObject(data) as any;
    const p2 = protectObject(p1) as any;

    expect(p1).toBe(p2); // Identity check
    
    p1._unlock();
    expect(p2._isLocked()).toBe(false); // Both refer to the same proxy
  });

  it("should handle mixed nesting (Guarded object inside plain object)", () => {
    const inner = protectObject({ value: 10 });
    const outer = { content: inner };

    // outer is not protected, but inner is
    outer.content = { value: 20 } as any; 
    // Wait, outer.content is replaced, not inner modified. This is expected.
    
    const frozenInner = protectObject({ value: 10 }) as any;
    const outerProtected = protectObject({ nested: frozenInner }) as any;

    expect(isProtected(outerProtected)).toBe(true);
    expect(isProtected(outerProtected.nested)).toBe(true);

    // Identity check: the proxy for 'nested' should be the same as 'frozenInner' OR a sub-proxy from outer
    // Since createProxy uses a WeakMap per root, and 'frozenInner' is already protected, 
    // it was returned as-is by the outer protectObject call if it was a root? 
    // Wait, let's re-read protectObject:
    // if (isProtected(item)) return item;
    
    expect(outerProtected.nested).toBe(frozenInner);
  });

  it("should throw TypeError on deleteProperty or defineProperty when locked", () => {
    const protectedObj = protectObject({ a: 1 }) as any;
    
    expect(() => {
      delete protectedObj.a;
    }).toThrow(TypeError);

    expect(() => {
      Object.defineProperty(protectedObj, "b", { value: 2 });
    }).toThrow(TypeError);
  });
});
