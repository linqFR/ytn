import { z } from "zod";
import { dna } from "../../src/index.js";

export const nestedRefineTests = [
  {
    description: "nested refinements",
    zodSchema: z
      .object({
        password: z.string().min(1),
        nested: z
          .object({
            confirm: z.string().min(1).refine((value) => value.length > 2, {
              message: "Confirm length should be > 2",
            }),
          })
          .refine(
            (data) => {
              return data.confirm === "bar";
            },
            {
              path: ["confirm"],
              error: 'Value must be "bar"',
            }
          ),
      })
      .refine(
        (data) => {
          return data.nested.confirm === data.password;
        },
        {
          path: ["nested", "confirm"],
          error: "Password and confirm must match",
        }
      ),
    dnaSchema: dna
      .object({
        password: dna.string().min(1),
        nested: dna
          .object({
            confirm: dna.string().min(1).refine((value) => value.length > 2, {
              message: "Confirm length should be > 2",
            }),
          })
          .refine(
            (data) => {
              return data.confirm === "bar";
            },
            {
              path: ["confirm"],
              error: 'Value must be "bar"',
            }
          ),
      })
      .refine(
        (data) => {
          return data.nested.confirm === data.password;
        },
        {
          path: ["nested", "confirm"],
          error: "Password and confirm must match",
        }
      ),
    tests: [
      { description: "valid", data: { password: "bar", nested: { confirm: "bar" } }, valid: true },
      { description: "invalid too short", data: { password: "bar", nested: { confirm: "" } }, valid: false },
    ],
  },
];
