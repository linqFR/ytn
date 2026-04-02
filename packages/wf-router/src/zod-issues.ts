import { RefinementCtx } from "zod";

export const pushGateIssue = (ctx: RefinementCtx, data: any, path: string[]) => {
  ctx.issues.push({
    code: "custom",
    message: "Gate execution failed",
    path: path,
    input: data,
  });
};
