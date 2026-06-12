import { RefinementCtx } from "zod";

export const pushGateIssue = (
  ctx: RefinementCtx,
  data: any,
  path: string[],
  err?: any,
) => {
  const message = err instanceof Error ? err.message : String(err || "Gate execution failed");
  ctx.issues.push({
    code: "custom",
    message,
    path: [...path, "gate"],
    input: data,
  });
};
