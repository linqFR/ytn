import { dna } from "@ytrynot/dna";
import { e2eSuite } from "./e2e-suite.js";

const input = dna
  .object({ name: dna.string() })
  .meta({ description: "Greets by name." });

e2eSuite("dna", {
  input,
  output: dna.object({ greeting: dna.string() }),
  arrayOutput: dna.array(dna.string()),
  expectedDescription: "Greets by name.",
  parseName: (v) => input.parse(v).name,
});
