import * as z from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const urlWithHostnameZod = z.url({ hostname: /^example\.com$/ });
const urlWithHostnameDna = dna.url({ hostname: /^example\.com$/ });

const basicUrlZod = z.url();
const basicUrlDna = dna.url();

export const urlTests = [
  {
    description: "url with hostname constraint",
    zodSchema: urlWithHostnameZod,
    dnaSchema: urlWithHostnameDna,
    tests: [
      { description: "valid matching hostname", data: "http://example.com/", valid: true },
      { description: "invalid non-matching hostname", data: "http://example.org/", valid: false },
    ],
  },
  {
    description: "basic url validation",
    zodSchema: basicUrlZod,
    dnaSchema: basicUrlDna,
    tests: [
      { description: "valid http url", data: "http://example.com", valid: true },
      { description: "valid https url", data: "https://example.com", valid: true },
      { description: "invalid not a url", data: "not-a-url", valid: false },
      { description: "invalid plain string", data: "example.com", valid: false },
    ],
  },
];
