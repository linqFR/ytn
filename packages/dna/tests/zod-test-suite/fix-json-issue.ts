import { z } from "zod";
import { dna } from "../../src/index.js";

const DataTypeZod = z.object({
  data: z.json(),
});

const ContainerZod = z.object({
  contained: z
    .nullable(DataTypeZod)
    .transform((v) => v ?? { data: "" }),
});

const DataTypeDna = dna.object({
  data: dna.json(),
});

const ContainerDna = dna.object({
  contained: dna
    .nullable(DataTypeDna)
    .transform((v: any) => v ?? { data: "" }),
});

export const fixJsonIssueTests = [
  {
    description: "json issue reproduction compiles and is defined",
    zodSchema: ContainerZod,
    dnaSchema: ContainerDna,
    tests: [
      {
        description: "container is defined and parses a valid value",
        data: { contained: { data: "" } },
        valid: true,
        customCheck: () => ContainerDna !== undefined && ContainerZod !== undefined,
      },
    ],
  },
];
