// import * as acorn from "acorn";
import { ancestor, simple } from "acorn-walk";
import { protectObject } from "./guarded_object.js";
import { parse as acorn_parse } from "acorn";

/**
 * @function getFnUndeclared
 * @description [Safe Mode] Analyzes a JavaScript function string via Acorn AST to find all
 * external dependencies (global variables, tools, or functions) that are used without being
 * declared locally within the function's scope.
 *
 * This analysis is performed entirely in memory (Virtual File System).
 *
 * @param {string} code - The serialized source code of the function to be analyzed.
 * @returns {string[]} An array of unique undeclared identifier names. Returns are protected by 'lockobj'.
 */
export function getFnUndeclared(code: string): string[] {
  // We use Acorn instead of TypeScript to save ~10MB in the bundle
  const ast = acorn_parse(
    code.trim().startsWith("(") ? code : `(${code})`,
    { ecmaVersion: "latest", sourceType: "module" }
  );

  const undeclared = new Set<string>();
  const scopes: Set<string>[] = [new Set()];

  /** Recursive binding extraction (handles destructuring like { a, b: c }, [a, b]) */
  function collectBindingNames(node: any, scope: Set<string>) {
    if (!node) return;
    if (node.type === "Identifier") {
      scope.add(node.name);
    } else if (node.type === "ObjectPattern") {
      node.properties.forEach((prop: any) => {
        if (prop.type === "Property") collectBindingNames(prop.value, scope);
        else if (prop.type === "RestElement") collectBindingNames(prop.argument, scope);
      });
    } else if (node.type === "ArrayPattern") {
      node.elements.forEach((el: any) => collectBindingNames(el, scope));
    } else if (node.type === "RestElement") {
      collectBindingNames(node.argument, scope);
    } else if (node.type === "AssignmentPattern") {
      collectBindingNames(node.left, scope);
    }
  }

  // PASS 1: Scope Declaration Collection
  simple(ast, {
    VariableDeclarator(node: any) {
      collectBindingNames(node.id, scopes[0]);
    },
    FunctionDeclaration(node: any) {
      if (node.id) collectBindingNames(node.id, scopes[0]);
      node.params.forEach((p: any) => collectBindingNames(p, scopes[0]));
    },
    FunctionExpression(node: any) {
      if (node.id) collectBindingNames(node.id, scopes[0]);
      node.params.forEach((p: any) => collectBindingNames(p, scopes[0]));
    },
    ArrowFunctionExpression(node: any) {
      node.params.forEach((p: any) => collectBindingNames(p, scopes[0]));
    },
    ClassDeclaration(node: any) {
      if (node.id) collectBindingNames(node.id, scopes[0]);
    },
  });

  // PASS 2: Usage Detection
  // We need ancestor walker for checking parents of identifiers,
  // but now scopes[0] is already fully populated from Pass 1!
  ancestor(ast, {
    Identifier(node: any, state: any, ancestors: any[]) {
      const parent = ancestors[ancestors.length - 2];
      if (!parent) return;

      // Ignore keys of objects
      if (parent.type === "Property" && parent.key === node && !parent.computed) return;
      // Ignore property access (obj.prop)
      if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return;
      // Ignore declarations themselves
      if (parent.type === "VariableDeclarator" && parent.id === node) return;
      if (parent.type === "FunctionDeclaration" && parent.id === node) return;
      if (parent.type === "ClassDeclaration" && parent.id === node) return;
      
      // Destructuring/Assignment left sides are declarations handled elsewhere
      // If it's pure usage:
      const name = node.name;
      const found = scopes.some((s) => s.has(name));
      if (!found) undeclared.add(name);
    }
  });

  return protectObject(Array.from(undeclared));
}
