import { z } from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const datetimeZod = z.iso.datetime();
const datetimeDna = dna.iso.datetime();

const datetimePrecisionMinus1Zod = z.string().datetime({ precision: -1, offset: true, local: true });
const datetimePrecisionMinus1Dna = dna.string().datetime({ precision: -1, offset: true, local: true });

const datetimePrecision0Zod = z.string().datetime({ precision: 0 });
const datetimePrecision0Dna = dna.string().datetime({ precision: 0 });

const datetimePrecision3Zod = z.string().datetime({ precision: 3 });
const datetimePrecision3Dna = dna.string().datetime({ precision: 3 });

const datetimeOffsetZod = z.string().datetime({ offset: true });
const datetimeOffsetDna = dna.string().datetime({ offset: true });

const datetimeOffsetPrecision0Zod = z.string().datetime({ offset: true, precision: 0 });
const datetimeOffsetPrecision0Dna = dna.string().datetime({ offset: true, precision: 0 });

const datetimeOffsetPrecision4Zod = z.string().datetime({ offset: true, precision: 4 });
const datetimeOffsetPrecision4Dna = dna.string().datetime({ offset: true, precision: 4 });

const datetimeLocalZod = z.string().datetime({ local: true });
const datetimeLocalDna = dna.string().datetime({ local: true });

const datetimeLocalOffsetZod = z.string().datetime({ local: true, offset: true });
const datetimeLocalOffsetDna = dna.string().datetime({ local: true, offset: true });

const dateZod = z.string().date();
const dateDna = dna.string().date();

const timeZod = z.string().time();
const timeDna = dna.string().time();

const timePrecision2Zod = z.string().time({ precision: 2 });
const timePrecision2Dna = dna.string().time({ precision: 2 });

const timePrecisionMinuteZod = z.string().time({ precision: z.TimePrecision.Minute });
const timePrecisionMinuteDna = dna.string().time({ precision: z.TimePrecision.Minute });

const durationZod = z.string().duration();
const durationDna = dna.string().duration();

export const datetimeTests = [
  {
    description: "datetime basic",
    zodSchema: datetimeZod,
    dnaSchema: datetimeDna,
    tests: [
      { description: "valid datetime", data: "1970-01-01T00:00:00.000Z", valid: true },
      { description: "valid datetime", data: "2022-10-13T09:52:31.816Z", valid: true },
      { description: "valid datetime high precision", data: "2022-10-13T09:52:31.8162314Z", valid: true },
      { description: "valid datetime no ms", data: "1970-01-01T00:00:00Z", valid: true },
      { description: "valid datetime no ms", data: "2022-10-13T09:52:31Z", valid: true },
      { description: "invalid empty", data: "", valid: false },
      { description: "invalid string", data: "foo", valid: false },
      { description: "invalid date only", data: "2020-10-14", valid: false },
      { description: "invalid time only", data: "T18:45:12.123", valid: false },
      { description: "invalid with offset", data: "2020-10-14T17:42:29+00:00", valid: false },
    ],
  },
  {
    description: "datetime with precision -1",
    zodSchema: datetimePrecisionMinus1Zod,
    dnaSchema: datetimePrecisionMinus1Dna,
    tests: [
      { description: "valid no ms", data: "1970-01-01T00:00Z", valid: true },
      { description: "valid no ms", data: "2022-10-13T09:52Z", valid: true },
      { description: "valid with offset", data: "2022-10-13T09:52+02:00", valid: true },
      { description: "valid local", data: "2022-10-13T09:52", valid: true },
      { description: "invalid string", data: "tuna", valid: false },
      { description: "invalid offset no colon", data: "2022-10-13T09:52+02", valid: false },
      { description: "invalid with ms", data: "1970-01-01T00:00:00.000Z", valid: false },
      { description: "invalid with ms dot", data: "1970-01-01T00:00:00.Z", valid: false },
      { description: "invalid with ms", data: "2022-10-13T09:52:31.816Z", valid: false },
    ],
  },
  {
    description: "datetime with precision 0",
    zodSchema: datetimePrecision0Zod,
    dnaSchema: datetimePrecision0Dna,
    tests: [
      { description: "valid", data: "1970-01-01T00:00:00Z", valid: true },
      { description: "valid", data: "2022-10-13T09:52:31Z", valid: true },
      { description: "invalid string", data: "tuna", valid: false },
      { description: "invalid with ms", data: "1970-01-01T00:00:00.000Z", valid: false },
      { description: "invalid with ms dot", data: "1970-01-01T00:00:00.Z", valid: false },
      { description: "invalid with ms", data: "2022-10-13T09:52:31.816Z", valid: false },
    ],
  },
  {
    description: "datetime with precision 3",
    zodSchema: datetimePrecision3Zod,
    dnaSchema: datetimePrecision3Dna,
    tests: [
      { description: "valid", data: "1970-01-01T00:00:00.000Z", valid: true },
      { description: "valid", data: "2022-10-13T09:52:31.123Z", valid: true },
      { description: "invalid string", data: "tuna", valid: false },
      { description: "invalid wrong precision", data: "1970-01-01T00:00:00.1Z", valid: false },
      { description: "invalid wrong precision", data: "1970-01-01T00:00:00.12Z", valid: false },
      { description: "invalid no ms", data: "2022-10-13T09:52:31Z", valid: false },
    ],
  },
  {
    description: "datetime with offset",
    zodSchema: datetimeOffsetZod,
    dnaSchema: datetimeOffsetDna,
    tests: [
      { description: "valid Z", data: "1970-01-01T00:00:00.000Z", valid: true },
      { description: "valid high precision", data: "2022-10-13T09:52:31.816234134Z", valid: true },
      { description: "valid no ms", data: "1970-01-01T00:00:00Z", valid: true },
      { description: "valid decimal", data: "2022-10-13T09:52:31.4Z", valid: true },
      { description: "valid +00:00", data: "2020-10-14T17:42:29+00:00", valid: true },
      { description: "valid +03:15", data: "2020-10-14T17:42:29+03:15", valid: true },
      { description: "invalid offset no colon", data: "2020-10-14T17:42:29+0315", valid: false },
      { description: "invalid offset no colon", data: "2020-10-14T17:42:29+03", valid: false },
      { description: "invalid string", data: "tuna", valid: false },
      { description: "invalid ms dot", data: "2022-10-13T09:52:31.Z", valid: false },
      { description: "invalid offset hours out of range", data: "2020-10-14T17:42:29+24:00", valid: false },
      { description: "invalid offset minutes out of range", data: "2020-10-14T17:42:29+00:60", valid: false },
      { description: "invalid offset single digit hours", data: "2020-10-14T17:42:29+1:30", valid: false },
      { description: "invalid offset incomplete", data: "2020-10-14T17:42:29+00:", valid: false },
    ],
  },
  {
    description: "datetime with offset and precision 0",
    zodSchema: datetimeOffsetPrecision0Zod,
    dnaSchema: datetimeOffsetPrecision0Dna,
    tests: [
      { description: "valid Z", data: "1970-01-01T00:00:00Z", valid: true },
      { description: "valid Z", data: "2022-10-13T09:52:31Z", valid: true },
      { description: "valid +00:00", data: "2020-10-14T17:42:29+00:00", valid: true },
      { description: "invalid offset no colon", data: "2020-10-14T17:42:29+0000", valid: false },
      { description: "invalid offset no colon", data: "2020-10-14T17:42:29+00", valid: false },
      { description: "invalid string", data: "tuna", valid: false },
      { description: "invalid with ms", data: "1970-01-01T00:00:00.000Z", valid: false },
      { description: "invalid with ms dot", data: "1970-01-01T00:00:00.Z", valid: false },
      { description: "invalid with ms", data: "2022-10-13T09:52:31.816Z", valid: false },
      { description: "invalid with ms in offset", data: "2020-10-14T17:42:29.124+00:00", valid: false },
    ],
  },
  {
    description: "datetime with offset and precision 4",
    zodSchema: datetimeOffsetPrecision4Zod,
    dnaSchema: datetimeOffsetPrecision4Dna,
    tests: [
      { description: "valid Z", data: "1970-01-01T00:00:00.1234Z", valid: true },
      { description: "valid +00:00", data: "2020-10-14T17:42:29.1234+00:00", valid: true },
      { description: "invalid offset no colon", data: "2020-10-14T17:42:29.1234+0000", valid: false },
      { description: "invalid offset no colon", data: "2020-10-14T17:42:29.1234+00", valid: false },
      { description: "invalid string", data: "tuna", valid: false },
      { description: "invalid wrong precision", data: "1970-01-01T00:00:00.123Z", valid: false },
      { description: "invalid wrong precision", data: "2020-10-14T17:42:29.124+00:00", valid: false },
    ],
  },
  {
    description: "datetime with local option",
    zodSchema: datetimeLocalZod,
    dnaSchema: datetimeLocalDna,
    tests: [
      { description: "valid HH:MM", data: "1970-01-01T00:00", valid: true },
      { description: "valid HH:MM:SS", data: "1970-01-01T00:00:00", valid: true },
      { description: "valid with ms", data: "2022-10-13T09:52:31.816", valid: true },
      { description: "valid with ms", data: "1970-01-01T00:00:00.000", valid: true },
      { description: "invalid HH only", data: "1970-01-01T00", valid: false },
      { description: "invalid with offset", data: "2022-10-13T09:52:31+00:00", valid: false },
      { description: "invalid space separator", data: "2022-10-13 09:52:31", valid: false },
      { description: "invalid hour 24", data: "2022-10-13T24:52:31", valid: false },
      { description: "invalid hour 24 no seconds", data: "2022-10-13T24:52", valid: false },
      { description: "invalid hour 24 with Z", data: "2022-10-13T24:52Z", valid: false },
    ],
  },
  {
    description: "datetime with local and offset",
    zodSchema: datetimeLocalOffsetZod,
    dnaSchema: datetimeLocalOffsetDna,
    tests: [
      { description: "valid HH:MM:SS", data: "2022-10-13T12:52:00", valid: true },
      { description: "valid with Z", data: "2022-10-13T12:52:00Z", valid: true },
      { description: "valid HH:MM with Z", data: "2022-10-13T12:52Z", valid: true },
      { description: "valid HH:MM", data: "2022-10-13T12:52", valid: true },
      { description: "valid with offset", data: "2022-10-13T12:52+02:00", valid: true },
      { description: "invalid offset no colon", data: "2022-10-13T12:52:00+02", valid: false },
    ],
  },
  {
    description: "date parsing",
    zodSchema: dateZod,
    dnaSchema: dateDna,
    tests: [
      { description: "valid", data: "1970-01-01", valid: true },
      { description: "valid", data: "2022-01-31", valid: true },
      { description: "valid", data: "2022-03-31", valid: true },
      { description: "valid", data: "2022-04-30", valid: true },
      { description: "valid", data: "2022-05-31", valid: true },
      { description: "valid", data: "2022-06-30", valid: true },
      { description: "valid", data: "2022-07-31", valid: true },
      { description: "valid", data: "2022-08-31", valid: true },
      { description: "valid", data: "2022-09-30", valid: true },
      { description: "valid", data: "2022-10-31", valid: true },
      { description: "valid", data: "2022-11-30", valid: true },
      { description: "valid", data: "2022-12-31", valid: true },
      { description: "valid leap year", data: "2000-02-29", valid: true },
      { description: "valid leap year", data: "2400-02-29", valid: true },
      { description: "invalid non-leap year", data: "2022-02-29", valid: false },
      { description: "invalid century non-leap", data: "2100-02-29", valid: false },
      { description: "invalid century non-leap", data: "2200-02-29", valid: false },
      { description: "invalid century non-leap", data: "2300-02-29", valid: false },
      { description: "invalid century non-leap", data: "2500-02-29", valid: false },
      { description: "invalid empty", data: "", valid: false },
      { description: "invalid string", data: "foo", valid: false },
      { description: "invalid year too short", data: "200-01-01", valid: false },
      { description: "invalid year too long", data: "20000-01-01", valid: false },
      { description: "invalid month single digit", data: "2000-0-01", valid: false },
      { description: "invalid month triple digit", data: "2000-011-01", valid: false },
      { description: "invalid day single digit", data: "2000-01-0", valid: false },
      { description: "invalid day triple digit", data: "2000-01-011", valid: false },
      { description: "invalid slash separator", data: "2000/01/01", valid: false },
      { description: "invalid reversed order", data: "01-01-2022", valid: false },
      { description: "invalid slash separator reversed", data: "01/01/2022", valid: false },
      { description: "invalid with time", data: "2000-01-01 00:00:00Z", valid: false },
      { description: "invalid ISO datetime", data: "2020-10-14T17:42:29+00:00", valid: false },
      { description: "invalid ISO datetime Z", data: "2020-10-14T17:42:29Z", valid: false },
      { description: "invalid ISO datetime", data: "2020-10-14T17:42:29", valid: false },
      { description: "invalid ISO datetime with ms", data: "2020-10-14T17:42:29.123Z", valid: false },
      { description: "invalid month 0", data: "2000-00-12", valid: false },
      { description: "invalid day 0", data: "2000-12-00", valid: false },
      { description: "invalid day 32", data: "2000-01-32", valid: false },
      { description: "invalid month 13", data: "2000-13-01", valid: false },
      { description: "invalid month 21", data: "2000-21-01", valid: false },
      { description: "invalid Feb 30", data: "2000-02-30", valid: false },
      { description: "invalid Feb 31", data: "2000-02-31", valid: false },
      { description: "invalid Apr 31", data: "2000-04-31", valid: false },
      { description: "invalid Jun 31", data: "2000-06-31", valid: false },
      { description: "invalid Sep 31", data: "2000-09-31", valid: false },
      { description: "invalid Nov 31", data: "2000-11-31", valid: false },
    ],
  },
  {
    description: "time parsing",
    zodSchema: timeZod,
    dnaSchema: timeDna,
    tests: [
      { description: "valid", data: "00:00:00", valid: true },
      { description: "valid", data: "23:00:00", valid: true },
      { description: "valid", data: "00:59:00", valid: true },
      { description: "valid", data: "00:00:59", valid: true },
      { description: "valid", data: "23:59:59", valid: true },
      { description: "valid", data: "09:52:31", valid: true },
      { description: "valid with ms", data: "23:59:59.9999999", valid: true },
      { description: "valid HH:MM", data: "00:00", valid: true },
      { description: "invalid empty", data: "", valid: false },
      { description: "invalid string", data: "foo", valid: false },
      { description: "invalid with Z", data: "00:00:00Z", valid: false },
      { description: "invalid single digit hour", data: "0:00:00", valid: false },
      { description: "invalid single digit minute", data: "00:0:00", valid: false },
      { description: "invalid single digit second", data: "00:00:0", valid: false },
      { description: "invalid with offset", data: "00:00:00.000+00:00", valid: false },
      { description: "invalid hour 24", data: "24:00:00", valid: false },
      { description: "invalid minute 60", data: "00:60:00", valid: false },
      { description: "invalid second 60", data: "00:00:60", valid: false },
      { description: "invalid all out of range", data: "24:60:60", valid: false },
    ],
  },
  {
    description: "time with precision 2",
    zodSchema: timePrecision2Zod,
    dnaSchema: timePrecision2Dna,
    tests: [
      { description: "valid", data: "00:00:00.00", valid: true },
      { description: "valid", data: "09:52:31.12", valid: true },
      { description: "valid", data: "23:59:59.99", valid: true },
      { description: "invalid empty", data: "", valid: false },
      { description: "invalid string", data: "foo", valid: false },
      { description: "invalid no ms", data: "00:00:00", valid: false },
      { description: "invalid with Z", data: "00:00:00.00Z", valid: false },
      { description: "invalid wrong precision", data: "00:00:00.0", valid: false },
      { description: "invalid wrong precision", data: "00:00:00.000", valid: false },
      { description: "invalid with offset", data: "00:00:00.00+00:00", valid: false },
    ],
  },
  {
    description: "time with precision minute",
    zodSchema: timePrecisionMinuteZod,
    dnaSchema: timePrecisionMinuteDna,
    tests: [
      { description: "valid HH:MM", data: "00:00", valid: true },
      { description: "invalid with seconds", data: "00:00:00", valid: false },
    ],
  },
  {
    description: "duration",
    zodSchema: durationZod,
    dnaSchema: durationDna,
    tests: [
      { description: "valid", data: "P3Y6M4DT12H30M5S", valid: true },
      { description: "valid", data: "P2Y9M3DT12H31M8.001S", valid: true },
      { description: "valid comma decimal", data: "PT0,001S", valid: true },
      { description: "valid", data: "PT12H30M5S", valid: true },
      { description: "valid", data: "P1Y", valid: true },
      { description: "valid", data: "P2MT30M", valid: true },
      { description: "valid", data: "PT6H", valid: true },
      { description: "valid", data: "P5W", valid: true },
      { description: "invalid string", data: "foo bar", valid: false },
      { description: "invalid empty", data: "", valid: false },
      { description: "invalid space", data: " ", valid: false },
      { description: "invalid P only", data: "P", valid: false },
      { description: "invalid PT only", data: "PT", valid: false },
      { description: "invalid T in middle", data: "P1Y2MT", valid: false },
      { description: "invalid T without P", data: "T1H", valid: false },
      { description: "invalid decimal in designator", data: "P0.5Y1D", valid: false },
      { description: "invalid comma decimal in designator", data: "P0,5Y6M", valid: false },
      { description: "invalid T at end", data: "P1YT", valid: false },
      { description: "invalid negative designator", data: "P-2M-1D", valid: false },
      { description: "invalid negative designator", data: "P-5DT-10H", valid: false },
      { description: "invalid week with day", data: "P1W2D", valid: false },
      { description: "invalid negative", data: "-P1D", valid: false },
    ],
  },
];
