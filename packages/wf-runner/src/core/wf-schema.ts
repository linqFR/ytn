import { z } from "zod";
import { schWFStepSchema } from "./step-schema.js";

/** @constant schWFDef */
const schWFDefBase = z.record(z.string(), schWFStepSchema);



export const schWFDef = schWFDefBase.superRefine((val, ctx) => {
  const allKeys = Object.keys(val);

  const seen = new Set<string>();
  for (const key of allKeys) {
    const low = key.toLowerCase();
    if (seen.has(low)) {
      ctx.issues.push({
        code: "invalid_value",
        input: key,
        values: allKeys,
        path: [key],
        message: `Duplicate Step ID found (case-insensitive collision): "${key}".`,
      });
    }
    seen.add(low);
  }

  // Graph Integrity: Verify that all transitions target existing steps.
  let hasExit = false;
  for (const p in val) {
    const step = val[p];
    if (!step.on || Object.keys(step.on).length === 0) {
      hasExit = true;
    } else {
      for (const onp in step.on) {
        const ref = step.on[onp];
        const isfound = allKeys.some((v) => v === ref);
        if (!isfound)
          ctx.issues.push({
            code: "invalid_value",
            input: ref,
            values: allKeys,
            path: [p, "on", onp],
            message: `${p}.on.${onp} = ${ref} is not related to any step.`,
          });
      }
    }
  }

  if (!hasExit) {
    ctx.issues.push({
      code: "custom",
      input: val,
      message:
        "Workflow must have at least one terminal exit (step without 'on' transitions).",
      path: [],
    });
  }

  // Cycle Detection: Ensure no closed loops exist that can never reach an exit.
  // NOTE: Do we need that if there is a maxlength loop detection ?
  for (const startStep in val) {
    const visited = new Set<string>();
    const stack = [startStep];
    let canReachExit = false;

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const step = val[current];
      if (!step.on || Object.keys(step.on).length === 0) {
        canReachExit = true;
        break;
      }

      for (const signal in step.on) {
        stack.push(step.on[signal]);
      }
    }

    if (!canReachExit) {
      ctx.issues.push({
        code: "custom",
        input: val[startStep],
        message: `Cycle detected: Step "${startStep}" and its descendants form a closed loop with no path to a terminal exit.`,
        path: [startStep],
      });
    }
  }
});
