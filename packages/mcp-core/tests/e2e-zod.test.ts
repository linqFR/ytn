import { z } from "zod";
import { e2eSuite } from "./e2e-suite.js";

const input = z
  .object({ name: z.string() })
  .meta({ description: "Greets by name." });

e2eSuite("zod", {
  input,
  output: z.object({ greeting: z.string() }),
  arrayOutput: z.array(z.string()),
  expectedDescription: "Greets by name.",
  parseName: (v) => input.parse(v).name,
});
