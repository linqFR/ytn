import * as z from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const minFiveZod = z.string().min(5, "min5");
const minFiveDna = dna.string().min(5, "min5");

const maxFiveZod = z.string().max(5, "max5");
const maxFiveDna = dna.string().max(5, "max5");

const justFiveZod = z.string().length(5);
const justFiveDna = dna.string().length(5);

const nonemptyZod = z.string().min(1, "nonempty");
const nonemptyDna = dna.string().min(1, "nonempty");

const includesZod = z.string().includes("includes");
const includesDna = dna.string().includes("includes");

const includesFromIndex2Zod = z.string().includes("includes", { position: 2 });
const includesFromIndex2Dna = dna.string().includes("includes", { position: 2 });

const startsWithZod = z.string().startsWith("startsWith");
const startsWithDna = dna.string().startsWith("startsWith");

const endsWithZod = z.string().endsWith("endsWith");
const endsWithDna = dna.string().endsWith("endsWith");

const includesWithMessageZod = z.string().includes("test", "must contain test");
const includesWithMessageDna = dna.string().includes("test", "must contain test");

const emailZod = z.string().email();
const emailDna = dna.string().email();

const base64Zod = z.string().base64();
const base64Dna = dna.string().base64();

const base64urlZod = z.string().base64url();
const base64urlDna = dna.string().base64url();

const jwtZod = z.string().jwt();
const jwtDna = dna.string().jwt();

const jwtEs256Zod = z.string().jwt({ alg: "ES256" });
const jwtEs256Dna = dna.string().jwt({ alg: "ES256" });

const urlZod = z.string().url();
const urlDna = dna.string().url();

const urlNormalizeZod = z.url({ normalize: true });
const urlNormalizeDna = dna.url({ normalize: true });

const emojiZod = z.string().emoji();
const emojiDna = dna.string().emoji();

const nanoidZod = z.string().nanoid("custom error");
const nanoidDna = dna.string().nanoid("custom error");

const uuidZod = z.string().uuid("custom error");
const uuidDna = dna.string().uuid("custom error");

const guidZod = z.string().guid("custom error");
const guidDna = dna.string().guid("custom error");

const cuidZod = z.string().cuid();
const cuidDna = dna.string().cuid();

const cuid2Zod = z.string().cuid2();
const cuid2Dna = dna.string().cuid2();

const ulidZod = z.string().ulid();
const ulidDna = dna.string().ulid();

const xidZod = z.string().xid();
const xidDna = dna.string().xid();

const ksuidZod = z.string().ksuid();
const ksuidDna = dna.string().ksuid();

const regexZod = z.string().regex(/^moo+$/);
const regexDna = dna.string().regex(/^moo+$/);

const regexCustomMessageZod = z.string().regex(/^moo+$/, { message: "Custom error message" });
const regexCustomMessageDna = dna.string().regex(/^moo+$/, { message: "Custom error message" });

const regexLastIndexZod = z.string().regex(/^\d+$/g);
const regexLastIndexDna = dna.string().regex(/^\d+$/g);

const lengthZeroZod = z.string().length(0);
const lengthZeroDna = dna.string().length(0);

const minZeroZod = z.string().min(0);
const minZeroDna = dna.string().min(0);

const maxZeroZod = z.string().max(0);
const maxZeroDna = dna.string().max(0);

const ipv4Zod = z.string().ipv4();
const ipv4Dna = dna.ipv4();

const ipv6Zod = z.string().ipv6();
const ipv6Dna = dna.ipv6();

const macZod = z.mac();
const macDna = dna.mac();

const cidrv4Zod = z.string().cidrv4();
const cidrv4Dna = dna.cidrv4();

const cidrv6Zod = z.string().cidrv6();
const cidrv6Dna = dna.cidrv6();

const e164Zod = z.string().e164();
const e164Dna = dna.e164();

const hostnameZod = z.hostname();
const hostnameDna = dna.hostname();

const hashMd5Zod = z.hash("md5");
const hashMd5Dna = dna.hash("md5");

const hashSha1Zod = z.hash("sha1");
const hashSha1Dna = dna.hash("sha1");

const hashSha256Zod = z.hash("sha256");
const hashSha256Dna = dna.hash("sha256");

const hashSha384Zod = z.hash("sha384");
const hashSha384Dna = dna.hash("sha384");

const hashSha512Zod = z.hash("sha512");
const hashSha512Dna = dna.hash("sha512");

const trimZod = z.string().trim();
const trimDna = dna.string().trim();

const toLowerCaseZod = z.string().toLowerCase();
const toLowerCaseDna = dna.string().toLowerCase();

const toUpperCaseZod = z.string().toUpperCase();
const toUpperCaseDna = dna.string().toUpperCase();

export const stringTests = [
  {
    description: "length checks - minFive",
    zodSchema: minFiveZod,
    dnaSchema: minFiveDna,
    tests: [
      { description: "valid 12345", data: "12345", valid: true },
      { description: "valid 123456", data: "123456", valid: true },
      { description: "invalid 1234", data: "1234", valid: false },
    ],
  },
  {
    description: "length checks - maxFive",
    zodSchema: maxFiveZod,
    dnaSchema: maxFiveDna,
    tests: [
      { description: "valid 12345", data: "12345", valid: true },
      { description: "valid 1234", data: "1234", valid: true },
      { description: "invalid 123456", data: "123456", valid: false },
    ],
  },
  {
    description: "length checks - nonempty",
    zodSchema: nonemptyZod,
    dnaSchema: nonemptyDna,
    tests: [
      { description: "valid 1", data: "1", valid: true },
      { description: "invalid empty", data: "", valid: false },
    ],
  },
  {
    description: "length checks - justFive",
    zodSchema: justFiveZod,
    dnaSchema: justFiveDna,
    tests: [
      { description: "valid 12345", data: "12345", valid: true },
      { description: "invalid 1234", data: "1234", valid: false },
      { description: "invalid 123456", data: "123456", valid: false },
    ],
  },
  {
    description: "includes",
    zodSchema: includesZod,
    dnaSchema: includesDna,
    tests: [
      { description: "valid XincludesXX", data: "XincludesXX", valid: true },
      { description: "invalid XincludeXX", data: "XincludeXX", valid: false },
    ],
  },
  {
    description: "includes from index 2",
    zodSchema: includesFromIndex2Zod,
    dnaSchema: includesFromIndex2Dna,
    tests: [
      { description: "valid XXXincludesXX", data: "XXXincludesXX", valid: true },
      { description: "invalid XincludesXX", data: "XincludesXX", valid: false },
    ],
  },
  {
    description: "startswith/endswith",
    zodSchema: startsWithZod,
    dnaSchema: startsWithDna,
    tests: [
      { description: "valid startsWithX", data: "startsWithX", valid: true },
      { description: "invalid x", data: "x", valid: false },
    ],
  },
  {
    description: "endswith",
    zodSchema: endsWithZod,
    dnaSchema: endsWithDna,
    tests: [
      { description: "valid XendsWith", data: "XendsWith", valid: true },
      { description: "invalid x", data: "x", valid: false },
    ],
  },
  {
    description: "includes with string error message",
    zodSchema: includesWithMessageZod,
    dnaSchema: includesWithMessageDna,
    tests: [
      { description: "valid this is a test", data: "this is a test", valid: true },
      { description: "invalid this is invalid", data: "this is invalid", valid: false },
    ],
  },
  {
    description: "email validations - valid",
    zodSchema: emailZod,
    dnaSchema: emailDna,
    tests: [
      { description: "valid email@domain.com", data: "email@domain.com", valid: true },
      { description: "valid firstname.lastname@domain.com", data: "firstname.lastname@domain.com", valid: true },
      { description: "valid email@subdomain.domain.com", data: "email@subdomain.domain.com", valid: true },
      { description: "valid firstname+lastname@domain.com", data: "firstname+lastname@domain.com", valid: true },
      { description: "valid 1234567890@domain.com", data: "1234567890@domain.com", valid: true },
      { description: "valid email@domain-one.com", data: "email@domain-one.com", valid: true },
      { description: "valid _______@domain.com", data: "_______@domain.com", valid: true },
      { description: "valid email@domain.name", data: "email@domain.name", valid: true },
      { description: "valid email@domain.co.jp", data: "email@domain.co.jp", valid: true },
      { description: "valid firstname-lastname@domain.com", data: "firstname-lastname@domain.com", valid: true },
      { description: "valid very.common@example.com", data: "very.common@example.com", valid: true },
      { description: "valid disposable.style.email.with+symbol@example.com", data: "disposable.style.email.with+symbol@example.com", valid: true },
      { description: "valid other.email-with-hyphen@example.com", data: "other.email-with-hyphen@example.com", valid: true },
      { description: "valid fully-qualified-domain@example.com", data: "fully-qualified-domain@example.com", valid: true },
      { description: "valid user.name+tag+sorting@example.com", data: "user.name+tag+sorting@example.com", valid: true },
      { description: "valid x@example.com", data: "x@example.com", valid: true },
      { description: "valid mojojojo@asdf.example.com", data: "mojojojo@asdf.example.com", valid: true },
      { description: "valid example-indeed@strange-example.com", data: "example-indeed@strange-example.com", valid: true },
      { description: "valid example@s.example", data: "example@s.example", valid: true },
      { description: "valid user-@example.org", data: "user-@example.org", valid: true },
      { description: "valid user@my-example.com", data: "user@my-example.com", valid: true },
      { description: "valid a@b.cd", data: "a@b.cd", valid: true },
      { description: "valid work+user@mail.com", data: "work+user@mail.com", valid: true },
      { description: "valid tom@test.te-st.com", data: "tom@test.te-st.com", valid: true },
      { description: "valid something@subdomain.domain-with-hyphens.tld", data: "something@subdomain.domain-with-hyphens.tld", valid: true },
      { description: "valid common'name@domain.com", data: "common'name@domain.com", valid: true },
      { description: "valid francois@etu.inp-n7.fr", data: "francois@etu.inp-n7.fr", valid: true },
    ],
  },
  {
    description: "email validations - invalid",
    zodSchema: emailZod,
    dnaSchema: emailDna,
    tests: [
      { description: "invalid double @", data: "francois@@etu.inp-n7.fr", valid: false },
      { description: "invalid quotes", data: '"email"@domain.com', valid: false },
      { description: "invalid quotes complex", data: '"e asdf sadf ?<>ail"@domain.com', valid: false },
      { description: "invalid quotes space", data: '" "@example.org', valid: false },
      { description: "invalid quotes dots", data: '"john..doe"@example.org', valid: false },
      { description: "invalid quotes very complex", data: '"very.(),:;<>[]\\".VERY.\\"very@\\ \\"very\\".unusual"@strange.example.com', valid: false },
      { description: "invalid comma", data: "a,b@domain.com", valid: false },
      { description: "invalid IPv4", data: "email@123.123.123.123", valid: false },
      { description: "invalid IPv4 brackets", data: "email@[123.123.123.123]", valid: false },
      { description: "invalid IPv4 postmaster", data: "postmaster@123.123.123.123", valid: false },
      { description: "invalid IPv4 user", data: "user@[68.185.127.196]", valid: false },
      { description: "invalid IPv4 ipv4", data: "ipv4@[85.129.96.247]", valid: false },
      { description: "invalid IPv4 valid", data: "valid@[79.208.229.53]", valid: false },
      { description: "invalid IPv4 255", data: "valid@[255.255.255.255]", valid: false },
      { description: "invalid IPv4 255.0", data: "valid@[255.0.55.2]", valid: false },
      { description: "invalid IPv6", data: "hgrebert0@[IPv6:4dc8:ac7:ce79:8878:1290:6098:5c50:1f25]", valid: false },
      { description: "invalid IPv6 bshapiro", data: "bshapiro4@[IPv6:3669:c709:e981:4884:59a3:75d1:166b:9ae]", valid: false },
      { description: "invalid IPv6 jsmith", data: "jsmith@[IPv6:2001:db8::1]", valid: false },
      { description: "invalid IPv6 postmaster", data: "postmaster@[IPv6:2001:0db8:85a3:0000:0000:8a2e:0370:7334]", valid: false },
      { description: "invalid IPv6 postmaster mixed", data: "postmaster@[IPv6:2001:0db8:85a3:0000:0000:8a2e:0370:192.168.1.1]", valid: false },
      { description: "invalid plainaddress", data: "plainaddress", valid: false },
      { description: "invalid special chars", data: "#@%^%#$@#$@#.com", valid: false },
      { description: "invalid @domain.com", data: "@domain.com", valid: false },
      { description: "invalid Joe Smith", data: "Joe Smith <email@domain.com>", valid: false },
      { description: "invalid email.domain.com", data: "email.domain.com", valid: false },
      { description: "invalid email@domain@domain.com", data: "email@domain@domain.com", valid: false },
      { description: "invalid .email@domain.com", data: ".email@domain.com", valid: false },
      { description: "invalid email.@domain.com", data: "email.@domain.com", valid: false },
      { description: "invalid email..email@domain.com", data: "email..email@domain.com", valid: false },
      { description: "invalid japanese", data: "あいうえお@domain.com", valid: false },
      { description: "invalid with name", data: "email@domain.com (Joe Smith)", valid: false },
      { description: "invalid email@domain", data: "email@domain", valid: false },
      { description: "invalid email@-domain.com", data: "email@-domain.com", valid: false },
      { description: "invalid email@111.222.333.44444", data: "email@111.222.333.44444", valid: false },
      { description: "invalid email@domain..com", data: "email@domain..com", valid: false },
      { description: "invalid Abc.example.com", data: "Abc.example.com", valid: false },
      { description: "invalid A@b@c@example.com", data: "A@b@c@example.com", valid: false },
      { description: "invalid colin..hacks", data: "colin..hacks@domain.com", valid: false },
      { description: "invalid complex special", data: 'a"b(c)d,e:f;g<h>i[j\\k]l@example.com', valid: false },
      { description: "invalid just not right", data: 'just"not"right@example.com', valid: false },
      { description: "invalid not allowed", data: 'this is"not\\allowed@example.com', valid: false },
      { description: "invalid still not allowed", data: 'this\\ still\\"not\\\\allowed@example.com', valid: false },
      { description: "invalid underscore", data: "i_like_underscore@but_its_not_allowed_in_this_part.example.com", valid: false },
      { description: "invalid icon", data: "QA[icon]CHOCOLATE[icon]@test.com", valid: false },
      { description: "invalid -start", data: "invalid@-start.com", valid: false },
      { description: "invalid end-", data: "invalid@end.com-", valid: false },
      { description: "invalid a.b@c.d", data: "a.b@c.d", valid: false },
      { description: "invalid [1.1.1.-1]", data: "invalid@[1.1.1.-1]", valid: false },
      { description: "invalid [68.185.127.196.55]", data: "invalid@[68.185.127.196.55]", valid: false },
      { description: "invalid [192.168.1]", data: "temp@[192.168.1]", valid: false },
      { description: "invalid [9.18.122.]", data: "temp@[9.18.122.]", valid: false },
      { description: "invalid double..point", data: "double..point@test.com", valid: false },
      { description: "invalid asdad@test..com", data: "asdad@test..com", valid: false },
      { description: "invalid asdad@hghg...sd...au", data: "asdad@hghg...sd...au", valid: false },
      { description: "invalid asdad@hghg........au", data: "asdad@hghg........au", valid: false },
      { description: "invalid [256.2.2.48]", data: "invalid@[256.2.2.48]", valid: false },
      { description: "invalid [999.465.265.1]", data: "invalid@[999.465.265.1]", valid: false },
      { description: "invalid IPv6 jkibbey", data: "jkibbey4@[IPv6:82c4:19a8::70a9:2aac:557::ea69:d985:28d]", valid: false },
      { description: "invalid IPv6 mlivesay", data: "mlivesay3@[9952:143f:b4df:2179:49a1:5e82:b92e:6b6]", valid: false },
      { description: "invalid IPv6 gbacher", data: "gbacher0@[IPv6:bc37:4d3f:5048:2e26:37cc:248e:df8e:2f7f:af]", valid: false },
      { description: "invalid IPv6 mixed", data: "invalid@[IPv6:5348:4ed3:5d38:67fb:e9b:acd2:c13:192.168.256.1]", valid: false },
      { description: "invalid test@.com", data: "test@.com", valid: false },
      { description: "invalid long email DoS", data: "aaaaaaaaaaaaaaalongemailthatcausesregexDoSvulnerability@test.c", valid: false },
    ],
  },
  {
    description: "base64 validations - valid",
    zodSchema: base64Zod,
    dnaSchema: base64Dna,
    tests: [
      { description: "valid SGVsbG8gV29ybGQ=", data: "SGVsbG8gV29ybGQ=", valid: true },
      { description: "valid VGhpcyBpcyBhbiBlbmNvZGVkIHN0cmluZw==", data: "VGhpcyBpcyBhbiBlbmNvZGVkIHN0cmluZw==", valid: true },
      { description: "valid TWFueSBoYW5kcyBtYWtlIGxpZ2h0IHdvcms=", data: "TWFueSBoYW5kcyBtYWtlIGxpZ2h0IHdvcms=", valid: true },
      { description: "valid UGF0aWVuY2UgaXMgdGhlIGtleSB0byBzdWNjZXNz", data: "UGF0aWVuY2UgaXMgdGhlIGtleSB0byBzdWNjZXNz", valid: true },
      { description: "valid QmFzZTY0IGVuY29kaW5nIGlzIGZ1bg==", data: "QmFzZTY0IGVuY29kaW5nIGlzIGZ1bg==", valid: true },
      { description: "valid MTIzNDU2Nzg5MA==", data: "MTIzNDU2Nzg5MA==", valid: true },
      { description: "valid YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=", data: "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=", valid: true },
      { description: "valid QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=", data: "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=", valid: true },
      { description: "valid ISIkJSMmJyonKCk=", data: "ISIkJSMmJyonKCk=", valid: true },
      { description: "valid empty", data: "", valid: true },
    ],
  },
  {
    description: "base64 validations - invalid",
    zodSchema: base64Zod,
    dnaSchema: base64Dna,
    tests: [
      { description: "invalid 12345", data: "12345", valid: false },
      { description: "invalid missing padding SGVsbG8gV29ybGQ", data: "SGVsbG8gV29ybGQ", valid: false },
      { description: "invalid missing padding VGhpcyBpcyBhbiBlbmNvZGVkIHN0cmluZw", data: "VGhpcyBpcyBhbiBlbmNvZGVkIHN0cmluZw", valid: false },
      { description: "invalid !UGF0aWVuY2UgaXMgdGhlIGtleSB0byBzdWNjZXNz", data: "!UGF0aWVuY2UgaXMgdGhlIGtleSB0byBzdWNjZXNz", valid: false },
      { description: "invalid ?QmFzZTY0IGVuY29kaW5nIGlzIGZ1bg==", data: "?QmFzZTY0IGVuY29kaW5nIGlzIGZ1bg==", valid: false },
      { description: "invalid .MTIzND2Nzg5MC4=", data: ".MTIzND2Nzg5MC4=", valid: false },
      { description: "invalid missing padding QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo", data: "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo", valid: false },
      { description: "invalid whitespace 123 ", data: "123 ", valid: false },
      { description: "invalid trailing space SGVsbG8gV29ybGQ= ", data: "SGVsbG8gV29ybGQ= ", valid: false },
      { description: "invalid leading space SGVsbG8gV29ybGQ=", data: " SGVsbG8gV29ybGQ=", valid: false },
      { description: "invalid trailing newline SGVsbG8gV29ybGQ=\n", data: "SGVsbG8gV29ybGQ=\n", valid: false },
      { description: "invalid internal space SGVs bG8gV29ybGQ=", data: "SGVs bG8gV29ybGQ=", valid: false },
      { description: "invalid internal newline SGVs\nbG8gV29ybGQ=", data: "SGVs\nbG8gV29ybGQ=", valid: false },
      { description: "invalid internal tab SGVs\tbG8gV29ybGQ=", data: "SGVs\tbG8gV29ybGQ=", valid: false },
    ],
  },
  {
    description: "base64url validations - valid",
    zodSchema: base64urlZod,
    dnaSchema: base64urlDna,
    tests: [
      { description: "valid SGVsbG8gV29ybGQ", data: "SGVsbG8gV29ybGQ", valid: true },
      { description: "valid VGhpcyBpcyBhbiBlbmNvZGVkIHN0cmluZw", data: "VGhpcyBpcyBhbiBlbmNvZGVkIHN0cmluZw", valid: true },
      { description: "valid TWFueSBoYW5kcyBtYWtlIGxpZ2h0IHdvcms", data: "TWFueSBoYW5kcyBtYWtlIGxpZ2h0IHdvcms", valid: true },
      { description: "valid UGF0aWVuY2UgaXMgdGhlIGtleSB0byBzdWNjZXNz", data: "UGF0aWVuY2UgaXMgdGhlIGtleSB0byBzdWNjZXNz", valid: true },
      { description: "valid QmFzZTY0IGVuY29kaW5nIGlzIGZ1bg", data: "QmFzZTY0IGVuY29kaW5nIGlzIGZ1bg", valid: true },
      { description: "valid MTIzNDU2Nzg5MA", data: "MTIzNDU2Nzg5MA", valid: true },
      { description: "valid YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo", data: "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo", valid: true },
      { description: "valid QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo", data: "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo", valid: true },
      { description: "valid ISIkJSMmJyonKCk", data: "ISIkJSMmJyonKCk", valid: true },
      { description: "valid empty", data: "", valid: true },
      { description: "valid w7_Dv8O-w74K", data: "w7_Dv8O-w74K", valid: true },
      { description: "valid 123456", data: "123456", valid: true },
    ],
  },
  {
    description: "base64url validations - invalid",
    zodSchema: base64urlZod,
    dnaSchema: base64urlDna,
    tests: [
      { description: "invalid with + and /", data: "w7/Dv8O+w74K", valid: false },
      { description: "invalid length 12345", data: "12345", valid: false },
      { description: "invalid padding 12345===", data: "12345===", valid: false },
      { description: "invalid !UGF0aWVuY2UgaXMgdGhlIGtleSB0byBzdWNjZXNz", data: "!UGF0aWVuY2UgaXMgdGhlIGtleSB0byBzdWNjZXNz", valid: false },
      { description: "invalid ?QmFzZTY0IGVuY29kaW5nIGlzIGZ1bg==", data: "?QmFzZTY0IGVuY29kaW5nIGlzIGZ1bg==", valid: false },
      { description: "invalid .MTIzND2Nzg5MC4=", data: ".MTIzND2Nzg5MC4=", valid: false },
      { description: "invalid with padding SGVsbG8gV29ybGQ=", data: "SGVsbG8gV29ybGQ=", valid: false },
      { description: "invalid with padding VGhpcyBpcyBhbiBlbmNvZGVkIHN0cmluZw==", data: "VGhpcyBpcyBhbiBlbmNvZGVkIHN0cmluZw==", valid: false },
      { description: "invalid with padding TWFueSBoYW5kcyBtYWtlIGxpZ2h0IHdvcms=", data: "TWFueSBoYW5kcyBtYWtlIGxpZ2h0IHdvcms=", valid: false },
      { description: "invalid with padding QmFzZTY0IGVuY29kaW5nIGlzIGZ1bg==", data: "QmFzZTY0IGVuY29kaW5nIGlzIGZ1bg==", valid: false },
      { description: "invalid with padding MTIzNDU2Nzg5MA==", data: "MTIzNDU2Nzg5MA==", valid: false },
      { description: "invalid with padding YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=", data: "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=", valid: false },
      { description: "invalid with padding QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=", data: "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=", valid: false },
      { description: "invalid with padding ISIkJSMmJyonKCk=", data: "ISIkJSMmJyonKCk=", valid: false },
    ],
  },
  {
    description: "jwt token - invalid",
    zodSchema: jwtZod,
    dnaSchema: jwtDna,
    tests: [
      { description: "invalid", data: "invalid", valid: false },
      { description: "invalid.invalid", data: "invalid.invalid", valid: false },
      { description: "invalid.invalid.invalid", data: "invalid.invalid.invalid", valid: false },
    ],
  },
  {
    description: "jwt token - valid ES256",
    zodSchema: jwtZod,
    dnaSchema: jwtDna,
    tests: [
      { description: "valid ES256", data: "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature", valid: true },
    ],
  },
  {
    description: "jwt token with ES256 - valid",
    zodSchema: jwtEs256Zod,
    dnaSchema: jwtEs256Dna,
    tests: [
      { description: "valid ES256", data: "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature", valid: true },
    ],
  },
  {
    description: "jwt token - invalid header",
    zodSchema: jwtZod,
    dnaSchema: jwtDna,
    tests: [
      { description: "invalid empty header", data: "e30.signature", valid: false },
    ],
  },
  {
    description: "jwt token - wrong algorithm",
    zodSchema: jwtEs256Zod,
    dnaSchema: jwtEs256Dna,
    tests: [
      { description: "invalid RS256", data: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature", valid: false },
    ],
  },
  {
    description: "jwt token - missing typ is fine",
    zodSchema: jwtZod,
    dnaSchema: jwtDna,
    tests: [
      { description: "valid missing typ", data: "eyJhbGciOiJIUzI1NiJ9.e30.signature", valid: true },
    ],
  },
  {
    description: "jwt token - type isn't JWT",
    zodSchema: jwtZod,
    dnaSchema: jwtDna,
    tests: [
      { description: "invalid SUP type", data: "eyJ0eXAiOiJTVVAiLCJhbGciOiJIUzI1NiJ9.eyJmb28iOiJiYXIifQ.signature", valid: false },
    ],
  },
  {
    description: "url validations - valid",
    zodSchema: urlZod,
    dnaSchema: urlDna,
    tests: [
      { description: "valid http://google.com", data: "http://google.com", valid: true },
      { description: "valid https://google.com/asdf?asdf=ljk3lk4&asdf=234#asdf", data: "https://google.com/asdf?asdf=ljk3lk4&asdf=234#asdf", valid: true },
      { description: "valid https://anonymous:flabada@developer.mozilla.org/en-US/docs/Web/API/URL/password", data: "https://anonymous:flabada@developer.mozilla.org/en-US/docs/Web/API/URL/password", valid: true },
      { description: "valid https://localhost", data: "https://localhost", valid: true },
      { description: "valid https://my.local", data: "https://my.local", valid: true },
      { description: "valid http://aslkfjdalsdfkjaf", data: "http://aslkfjdalsdfkjaf", valid: true },
      { description: "valid http://localhost", data: "http://localhost", valid: true },
      { description: "valid c:", data: "c:", valid: true },
    ],
  },
  {
    description: "url validations - invalid",
    zodSchema: urlZod,
    dnaSchema: urlDna,
    tests: [
      { description: "invalid asdf", data: "asdf", valid: false },
      { description: "invalid https:/", data: "https:/", valid: false },
      { description: "invalid asdfj@lkjsdf.com", data: "asdfj@lkjsdf.com", valid: false },
      { description: "invalid https://", data: "https://", valid: false },
    ],
  },
  {
    description: "url preserves original input",
    zodSchema: urlZod,
    dnaSchema: urlDna,
    tests: [
      { description: "valid https://example.com?key=NUXOmHqWNVTapJkJJHw8BfD155AuqhH_qju_5fNmQ4ZHV7u8", data: "https://example.com?key=NUXOmHqWNVTapJkJJHw8BfD155AuqhH_qju_5fNmQ4ZHV7u8", valid: true },
      { description: "valid https://example.com?foo=bar", data: "https://example.com?foo=bar", valid: true },
      { description: "valid http://example.com?test=123", data: "http://example.com?test=123", valid: true },
      { description: "valid https://sub.example.com?param=value&other=data", data: "https://sub.example.com?param=value&other=data", valid: true },
      { description: "valid https://example.com/", data: "https://example.com/", valid: true },
      { description: "valid https://example.com/path/", data: "https://example.com/path/", valid: true },
      { description: "valid https://example.com/path?query=param", data: "https://example.com/path?query=param", valid: true },
    ],
  },
  {
    description: "url trims whitespace",
    zodSchema: urlZod,
    dnaSchema: urlDna,
    tests: [
      { description: "valid trimmed", data: "  https://example.com  ", valid: true },
      { description: "valid trimmed with path", data: "  https://example.com/path?query=param  ", valid: true },
      { description: "valid trimmed with tabs", data: "\t\nhttps://example.com\t\n", valid: true },
      { description: "valid trimmed with key=value", data: "   https://example.com?key=value   ", valid: true },
      { description: "valid no whitespace", data: "https://example.com", valid: true },
      { description: "valid no whitespace path", data: "https://example.com/path", valid: true },
    ],
  },
  {
    description: "url normalize flag",
    zodSchema: urlNormalizeZod,
    dnaSchema: urlNormalizeDna,
    tests: [
      { description: "valid normalized https://example.com?key=value", data: "https://example.com?key=value", valid: true },
      { description: "valid normalized http://example.com?test=123", data: "http://example.com?test=123", valid: true },
      { description: "valid normalized https://example.com/", data: "https://example.com/", valid: true },
      { description: "valid normalized https://example.com/path?query=param", data: "https://example.com/path?query=param", valid: true },
      { description: "valid normalized https://example.com/../?key=value", data: "https://example.com/../?key=value", valid: true },
      { description: "valid normalized https://example.com/./path?key=value", data: "https://example.com/./path?key=value", valid: true },
      { description: "valid normalized trimmed", data: "  https://example.com?key=value  ", valid: true },
    ],
  },
  {
    description: "emoji validations - valid",
    zodSchema: emojiZod,
    dnaSchema: emojiDna,
    tests: [
      { description: "valid 👋👋👋👋", data: "👋👋👋👋", valid: true },
      { description: "valid 🍺👩‍🚀🫡", data: "🍺👩‍🚀🫡", valid: true },
      { description: "valid 💚💙💜💛❤️", data: "💚💙💜💛❤️", valid: true },
      { description: "valid 🐛🗝🐏🍡🎦🚢🏨💫🎌☘🗡😹🔒🎬➡️🍹🗂🚨⚜🕑〽️🚦🌊🍴💍🍌💰😳🌺🍃", data: "🐛🗝🐏🍡🎦🚢🏨💫🎌☘🗡😹🔒🎬➡️🍹🗂🚨⚜🕑〽️🚦🌊🍴💍�💰😳🌺🍃", valid: true },
      { description: "valid �🇷🤽🏿‍♂️", data: "🇹🇷🤽🏿‍♂️", valid: true },
      { description: "valid long emoji sequence", data: "😀😁😂🤣😃😄😅😆😉😊😋😎😍😘🥰😗😙😚☺️☺🙂🤗🤩🤔🤨😐😑😶🙄😏😣😥😮🤐😯😪😫😴😌😛😜😝🤤😒😓😔😕🙃🤑😲☹️☹🙁😖😞😟😤😢😭😦😧😨😩🤯😬😰😱🥵🥶😳🤪😵😡😠🤬😷🤒🤕🤢🤮🤧😇🤠🥳🥴🥺🤥🤫🤭🧐🤓😈👿🤡👹👺💀☠️☠👻👽👾🤖💩😺😸😹😻😼😽🙀😿😾🙈🙉🙊🏻🏼🏽🏾🏿👶👶🏻👶🏼👶🏽👶🏾👶🏿🧒🧒🏻🧒🏼🧒🏽🧒🏾🧒🏿👦👦🏻👦🏼👦🏽👦🏾👦🏿👧👧🏻👧🏼👧🏽👧🏾👧🏿🧑🧑🏻🧑🏼🧑🏽🧑🏾🧑🏿👨👨🏻👨🏼👨🏽👨🏾👨🏿👩👩🏻👩🏼👩🏽👩🏾👩🏿🧓🧓🏻🧓🏼🧓🏽🧓🏾🧓🏿👴👴🏻👴🏼👴🏽👴🏾👴🏿👵👵🏻👵🏼👵🏽👵🏾👵🏿👨‍⚕️👨‍⚕👨🏻‍⚕️👨🏻‍⚕👨🏼‍⚕️👨🏼‍⚕👨🏽‍⚕️👨🏽‍⚕👨🏾‍⚕️👨🏾‍⚕👨🏿‍⚕️👨🏿‍⚕👩‍⚕️👩‍⚕👩🏻‍⚕️👩🏻‍⚕👩🏼‍⚕️👩🏼‍⚕👩🏽‍⚕️👩🏽‍⚕👩🏾‍⚕️👩🏾‍⚕👩🏿‍⚕️👩🏿‍⚕👨‍🎓👨🏻‍🎓👨🏼‍🎓👨🏽‍🎓👨🏾‍🎓👨🏿‍🎓👩‍🎓👩🏻‍🎓👩🏼‍🎓👩🏽‍🎓👩🏾‍🎓👩🏿‍🎓👨‍🏫👨🏻‍🏫👨🏼‍🏫👨🏽‍🏫👨🏾‍🏫👨🏿‍🏫👩‍🏫👩🏻‍🏫👩🏼‍🏫👩🏽‍🏫👩🏾‍🏫👩🏿‍🏫👨‍⚖️👨‍⚖👨🏻‍⚖️👨🏻‍⚖👨🏼‍⚖️👨🏼‍⚖👨🏽‍⚖️👨🏽‍⚖👨🏾‍⚖️👨🏾‍⚖👨🏿‍⚖️👨🏿‍⚖👩‍⚖️👩‍⚖👩🏻‍⚖️👩🏻‍⚖👩🏼‍⚖️👩🏼‍⚖👩🏽‍⚖️👩🏽‍⚖👩🏾‍⚖️👩🏾‍⚖👩🏿‍⚖️👩🏿‍⚖👨‍🌾", data: "😀😁😂🤣😃😄😅😆😉😊😋😎😍😘🥰😗😙😚☺️☺🙂🤗🤩🤔🤨😐😑😶🙄😏😣😥😮🤐😯😪😫😴😌😛😜😝🤤😒😓😔😕🙃🤑😲☹️☹🙁😖😞😟😤😢😭😦😧😨😩🤯😬😰😱🥵🥶😳🤪😵😡😠🤬😷🤒🤕🤢🤮🤧😇🤠🥳🥴🥺🤥🤫🤭🧐🤓😈👿🤡👹👺💀☠️☠👻👽👾🤖💩😺😸😹😻😼😽🙀😿😾🙈🙉🙊🏻🏼🏽🏾🏿👶👶🏻👶🏼👶🏽👶🏾👶🏿🧒🧒🏻🧒🏼🧒🏽🧒🏾🧒🏿👦👦🏻👦🏼👦🏽👦🏾👦🏿👧👧🏻👧🏼👧🏽👧🏾👧🏿🧑🧑🏻🧑🏼🧑🏽🧑🏾🧑🏿👨👨🏻👨🏼👨🏽👨🏾👨🏿👩👩🏻👩🏼👩🏽👩🏾👩🏿🧓🧓🏻🧓🏼🧓🏽🧓🏾🧓🏿👴👴🏻👴🏼👴🏽👴🏾👴🏿👵👵🏻👵🏼👵🏽👵🏾👵🏿👨‍⚕️👨‍⚕👨🏻‍⚕️👨🏻‍⚕👨🏼‍⚕️👨🏼‍⚕👨🏽‍⚕️👨🏽‍⚕👨🏾‍⚕️👨🏾‍⚕👨🏿‍⚕️👨🏿‍⚕👩‍⚕️👩‍⚕👩🏻‍⚕️👩🏻‍⚕👩🏼‍⚕️👩🏼‍⚕👩🏽‍⚕️👩🏽‍⚕👩🏾‍⚕️👩🏾‍⚕👩🏿‍⚕️👩🏿‍⚕👨‍🎓👨🏻‍🎓👨🏼‍🎓👨🏽‍🎓👨🏾‍🎓👨🏿‍🎓👩‍🎓👩🏻‍🎓👩🏼‍🎓👩🏽‍🎓👩🏾‍🎓👩🏿‍🎓👨‍🏫👨🏻‍🏫👨🏼‍🏫👨🏽‍🏫👨🏾‍🏫👨🏿‍🏫👩‍🏫👩🏻‍🏫👩🏼‍🏫👩🏽‍🏫👩🏾‍🏫👩🏿‍🏫👨‍⚖️👨‍⚖👨🏻‍⚖️👨🏻‍⚖👨🏼‍⚖️👨🏼‍⚖👨🏽‍⚖️👨🏽‍⚖👨🏾‍⚖️👨🏾‍⚖👨🏿‍⚖️👨🏿‍⚖👩‍⚖️👩‍⚖👩🏻‍⚖️👩🏻‍⚖👩🏼‍⚖️👩🏼‍⚖👩🏽‍⚖️👩🏽‍⚖👩🏾‍⚖️👩🏾‍⚖👩🏿‍⚖️👩🏿‍⚖👨‍🌾", valid: true },
    ],
  },
  {
    description: "emoji validations - invalid",
    zodSchema: emojiZod,
    dnaSchema: emojiDna,
    tests: [
      { description: "invalid :-)", data: ":-)", valid: false },
      { description: "invalid 😀 is an emoji", data: "😀 is an emoji", valid: false },
      { description: "invalid 😀stuff", data: "😀stuff", valid: false },
      { description: "invalid stuff😀", data: "stuff😀", valid: false },
    ],
  },
  {
    description: "nanoid - valid",
    zodSchema: nanoidZod,
    dnaSchema: nanoidDna,
    tests: [
      { description: "valid lfNZluvAxMkf7Q8C5H-QS", data: "lfNZluvAxMkf7Q8C5H-QS", valid: true },
      { description: "valid mIU_4PJWikaU8fMbmkouz", data: "mIU_4PJWikaU8fMbmkouz", valid: true },
      { description: "valid Hb9ZUtUa2JDm_dD-47EGv", data: "Hb9ZUtUa2JDm_dD-47EGv", valid: true },
      { description: "valid 5Noocgv_8vQ9oPijj4ioQ", data: "5Noocgv_8vQ9oPijj4ioQ", valid: true },
    ],
  },
  {
    description: "nanoid - invalid",
    zodSchema: nanoidZod,
    dnaSchema: nanoidDna,
    tests: [
      { description: "invalid Xq90uDyhddC53KsoASYJGX", data: "Xq90uDyhddC53KsoASYJGX", valid: false },
      { description: "invalid nanoid", data: "invalid nanoid", valid: false },
    ],
  },
  {
    description: "bad nanoid - valid",
    zodSchema: nanoidZod,
    dnaSchema: nanoidDna,
    tests: [
      { description: "valid ySh_984wpDUu7IQRrLXAp", data: "ySh_984wpDUu7IQRrLXAp", valid: true },
    ],
  },
  {
    description: "uuid - valid",
    zodSchema: uuidZod,
    dnaSchema: uuidDna,
    tests: [
      { description: "valid 9491d710-3185-1e06-bea0-6a2f275345e0", data: "9491d710-3185-1e06-bea0-6a2f275345e0", valid: true },
      { description: "valid 9491d710-3185-2e06-bea0-6a2f275345e0", data: "9491d710-3185-2e06-bea0-6a2f275345e0", valid: true },
      { description: "valid 9491d710-3185-3e06-bea0-6a2f275345e0", data: "9491d710-3185-3e06-bea0-6a2f275345e0", valid: true },
      { description: "valid 9491d710-3185-4e06-bea0-6a2f275345e0", data: "9491d710-3185-4e06-bea0-6a2f275345e0", valid: true },
      { description: "valid 9491d710-3185-5e06-bea0-6a2f275345e0", data: "9491d710-3185-5e06-bea0-6a2f275345e0", valid: true },
      { description: "valid 9491d710-3185-5e06-aea0-6a2f275345e0", data: "9491d710-3185-5e06-aea0-6a2f275345e0", valid: true },
      { description: "valid 9491d710-3185-5e06-8ea0-6a2f275345e0", data: "9491d710-3185-5e06-8ea0-6a2f275345e0", valid: true },
      { description: "valid 9491d710-3185-5e06-9ea0-6a2f275345e0", data: "9491d710-3185-5e06-9ea0-6a2f275345e0", valid: true },
      { description: "valid 00000000-0000-0000-0000-000000000000", data: "00000000-0000-0000-0000-000000000000", valid: true },
      { description: "valid ffffffff-ffff-ffff-ffff-ffffffffffff", data: "ffffffff-ffff-ffff-ffff-ffffffffffff", valid: true },
    ],
  },
  {
    description: "uuid - invalid",
    zodSchema: uuidZod,
    dnaSchema: uuidDna,
    tests: [
      { description: "invalid 9491d710-3185-0e06-bea0-6a2f275345e0", data: "9491d710-3185-0e06-bea0-6a2f275345e0", valid: false },
      { description: "invalid 9491d710-3185-5e06-0ea0-6a2f275345e0", data: "9491d710-3185-5e06-0ea0-6a2f275345e0", valid: false },
      { description: "invalid d89e7b01-7598-ed11-9d7a-0022489382fd", data: "d89e7b01-7598-ed11-9d7a-0022489382fd", valid: false },
      { description: "invalid b3ce60f8-e8b9-40f5-1150-172ede56ff74", data: "b3ce60f8-e8b9-40f5-1150-172ede56ff74", valid: false },
      { description: "invalid 92e76bf9-28b3-4730-cd7f-cb6bc51f8c09", data: "92e76bf9-28b3-4730-cd7f-cb6bc51f8c09", valid: false },
      { description: "invalid uuid", data: "invalid uuid", valid: false },
      { description: "invalid 9491d710-3185-4e06-bea0-6a2f275345e0X", data: "9491d710-3185-4e06-bea0-6a2f275345e0X", valid: false },
    ],
  },
  {
    description: "guid - valid",
    zodSchema: guidZod,
    dnaSchema: guidDna,
    tests: [
      { description: "valid 9491d710-3185-4e06-bea0-6a2f275345e0", data: "9491d710-3185-4e06-bea0-6a2f275345e0", valid: true },
      { description: "valid d89e7b01-7598-ed11-9d7a-0022489382fd", data: "d89e7b01-7598-ed11-9d7a-0022489382fd", valid: true },
      { description: "valid b3ce60f8-e8b9-40f5-1150-172ede56ff74", data: "b3ce60f8-e8b9-40f5-1150-172ede56ff74", valid: true },
      { description: "valid 92e76bf9-28b3-4730-cd7f-cb6bc51f8c09", data: "92e76bf9-28b3-4730-cd7f-cb6bc51f8c09", valid: true },
      { description: "valid 00000000-0000-0000-0000-000000000000", data: "00000000-0000-0000-0000-000000000000", valid: true },
      { description: "valid ffffffff-ffff-ffff-ffff-ffffffffffff", data: "ffffffff-ffff-ffff-ffff-ffffffffffff", valid: true },
    ],
  },
  {
    description: "guid - invalid",
    zodSchema: guidZod,
    dnaSchema: guidDna,
    tests: [
      { description: "invalid 9491d710-3185-4e06-bea0-6a2f275345e0X", data: "9491d710-3185-4e06-bea0-6a2f275345e0X", valid: false },
    ],
  },
  {
    description: "cuid - valid",
    zodSchema: cuidZod,
    dnaSchema: cuidDna,
    tests: [
      { description: "valid ckopqwooh000001la8mbi2im9", data: "ckopqwooh000001la8mbi2im9", valid: true },
    ],
  },
  {
    description: "cuid - invalid",
    zodSchema: cuidZod,
    dnaSchema: cuidDna,
    tests: [
      { description: "invalid cifjhdsfhsd-invalid-cuid", data: "cifjhdsfhsd-invalid-cuid", valid: false },
      { description: "invalid cly63t164000245zw008pggon';select1;", data: "cly63t164000245zw008pggon';select1;", valid: false },
      { description: "invalid c<script>alert(1)</script>aaaaaa", data: "c<script>alert(1)</script>aaaaaa", valid: false },
      { description: "invalid c{};alert(1)//", data: "c{};alert(1)//", valid: false },
      { description: "invalid C0123_45678", data: "C0123_45678", valid: false },
      { description: "invalid cAAAAAAAAA", data: "cAAAAAAAAA", valid: false },
    ],
  },
  {
    description: "cuid2 - valid",
    zodSchema: cuid2Zod,
    dnaSchema: cuid2Dna,
    tests: [
      { description: "valid a", data: "a", valid: true },
      { description: "valid tz4a98xxat96iws9zmbrgj3a", data: "tz4a98xxat96iws9zmbrgj3a", valid: true },
      { description: "valid kf5vz6ssxe4zjcb409rjgo747tc5qjazgptvotk6", data: "kf5vz6ssxe4zjcb409rjgo747tc5qjazgptvotk6", valid: true },
    ],
  },
  {
    description: "cuid2 - invalid",
    zodSchema: cuid2Zod,
    dnaSchema: cuid2Dna,
    tests: [
      { description: "invalid empty", data: "", valid: false },
      { description: "invalid tz4a98xxat96iws-zmbrgj3a", data: "tz4a98xxat96iws-zmbrgj3a", valid: false },
      { description: "invalid tz4a98xxat96iws9zMbrgj3a", data: "tz4a98xxat96iws9zMbrgj3a", valid: false },
    ],
  },
  {
    description: "ulid - valid",
    zodSchema: ulidZod,
    dnaSchema: ulidDna,
    tests: [
      { description: "valid 01ARZ3NDEKTSV4RRFFQ69G5FAV", data: "01ARZ3NDEKTSV4RRFFQ69G5FAV", valid: true },
      { description: "valid case insensitive", data: "01arZ3nDeKTsV4RRffQ69G5FAV", valid: true },
    ],
  },
  {
    description: "ulid - invalid",
    zodSchema: ulidZod,
    dnaSchema: ulidDna,
    tests: [
      { description: "invalid invalidulid", data: "invalidulid", valid: false },
      { description: "invalid too long", data: "01ARZ3NDEKTSV4RRFFQ69G5FAVA", valid: false },
    ],
  },
  {
    description: "xid - valid",
    zodSchema: xidZod,
    dnaSchema: xidDna,
    tests: [
      { description: "valid 9m4e2mr0ui3e8a215n4g", data: "9m4e2mr0ui3e8a215n4g", valid: true },
    ],
  },
  {
    description: "xid - invalid",
    zodSchema: xidZod,
    dnaSchema: xidDna,
    tests: [
      { description: "invalid invalidxid", data: "invalidxid", valid: false },
    ],
  },
  {
    description: "ksuid - valid",
    zodSchema: ksuidZod,
    dnaSchema: ksuidDna,
    tests: [
      { description: "valid 0o0t9hkGxgFLtd3lmJ4TSTeY0Vb", data: "0o0t9hkGxgFLtd3lmJ4TSTeY0Vb", valid: true },
    ],
  },
  {
    description: "ksuid - invalid",
    zodSchema: ksuidZod,
    dnaSchema: ksuidDna,
    tests: [
      { description: "invalid invalidksuid", data: "invalidksuid", valid: false },
      { description: "invalid too long", data: "0o0t9hkGxgFLtd3lmJ4TSTeY0VbA", valid: false },
    ],
  },
  {
    description: "regex - valid",
    zodSchema: regexZod,
    dnaSchema: regexDna,
    tests: [
      { description: "valid mooooo", data: "mooooo", valid: true },
    ],
  },
  {
    description: "regex - invalid",
    zodSchema: regexZod,
    dnaSchema: regexDna,
    tests: [
      { description: "invalid boooo", data: "boooo", valid: false },
    ],
  },
  {
    description: "regex custom message - invalid",
    zodSchema: regexCustomMessageZod,
    dnaSchema: regexCustomMessageDna,
    tests: [
      { description: "invalid boooo", data: "boooo", valid: false },
    ],
  },
  {
    description: "regex lastIndex reset",
    zodSchema: regexLastIndexZod,
    dnaSchema: regexLastIndexDna,
    tests: [
      { description: "valid 123", data: "123", valid: true },
      { description: "valid 123 again", data: "123", valid: true },
      { description: "valid 123 third time", data: "123", valid: true },
    ],
  },
  {
    description: "length zero",
    zodSchema: lengthZeroZod,
    dnaSchema: lengthZeroDna,
    tests: [
      { description: "valid empty", data: "", valid: true },
      { description: "invalid a", data: "a", valid: false },
    ],
  },
  {
    description: "min zero",
    zodSchema: minZeroZod,
    dnaSchema: minZeroDna,
    tests: [
      { description: "valid empty", data: "", valid: true },
      { description: "valid a", data: "a", valid: true },
      { description: "valid hello", data: "hello", valid: true },
    ],
  },
  {
    description: "max zero",
    zodSchema: maxZeroZod,
    dnaSchema: maxZeroDna,
    tests: [
      { description: "valid empty", data: "", valid: true },
      { description: "invalid a", data: "a", valid: false },
    ],
  },
  {
    description: "IPv4 validation - valid",
    zodSchema: ipv4Zod,
    dnaSchema: ipv4Dna,
    tests: [
      { description: "valid 114.71.82.94", data: "114.71.82.94", valid: true },
      { description: "valid 0.0.0.0", data: "0.0.0.0", valid: true },
      { description: "valid 37.85.236.115", data: "37.85.236.115", valid: true },
      { description: "valid 192.168.0.1", data: "192.168.0.1", valid: true },
      { description: "valid 255.255.255.255", data: "255.255.255.255", valid: true },
      { description: "valid 1.2.3.4", data: "1.2.3.4", valid: true },
    ],
  },
  {
    description: "IPv4 validation - invalid",
    zodSchema: ipv4Zod,
    dnaSchema: ipv4Dna,
    tests: [
      { description: "invalid 256.0.4.4", data: "256.0.4.4", valid: false },
      { description: "invalid -1.0.555.4", data: "-1.0.555.4", valid: false },
      { description: "invalid 0.0.0.0.0", data: "0.0.0.0.0", valid: false },
      { description: "invalid 1.1.1", data: "1.1.1", valid: false },
      { description: "invalid ipv6 string", data: "1e5e:e6c8:daac:514b:114b:e360:d8c0:682c", valid: false },
      { description: "invalid mixed", data: "a6ea::2454:a5ce:94.105.123.75", valid: false },
      { description: "invalid not an ip", data: "not an ip", valid: false },
      { description: "invalid 1.2.3", data: "1.2.3", valid: false },
      { description: "invalid 1.2.3.4.5", data: "1.2.3.4.5", valid: false },
      { description: "invalid 1.2.3.256", data: "1.2.3.256", valid: false },
      { description: "invalid ipv6 6097", data: "6097:adfa:6f0b:220d:db08:5021:6191:7990", valid: false },
    ],
  },
  {
    description: "IPv6 validation - valid",
    zodSchema: ipv6Zod,
    dnaSchema: ipv6Dna,
    tests: [
      { description: "valid 1e5e:e6c8:daac:514b:114b:e360:d8c0:682c", data: "1e5e:e6c8:daac:514b:114b:e360:d8c0:682c", valid: true },
      { description: "valid 9d4:c956:420f:5788:4339:9b3b:2418:75c3", data: "9d4:c956:420f:5788:4339:9b3b:2418:75c3", valid: true },
      { description: "valid 474f:4c83::4e40:a47:ff95:0cda", data: "474f:4c83::4e40:a47:ff95:0cda", valid: true },
      { description: "valid d329:0:25b4:db47:a9d1:0:4926:0000", data: "d329:0:25b4:db47:a9d1:0:4926:0000", valid: true },
      { description: "valid e48:10fb:1499:3e28:e4b6:dea5:4692:912c", data: "e48:10fb:1499:3e28:e4b6:dea5:4692:912c", valid: true },
      { description: "valid ::1", data: "::1", valid: true },
      { description: "valid 2001:db8::", data: "2001:db8::", valid: true },
      { description: "valid 2001:0db8:85a3:0000:0000:8a2e:0370:7334", data: "2001:0db8:85a3:0000:0000:8a2e:0370:7334", valid: true },
    ],
  },
  {
    description: "IPv6 validation - invalid",
    zodSchema: ipv6Zod,
    dnaSchema: ipv6Dna,
    tests: [
      { description: "invalid too many groups", data: "d329:1be4:25b4:db47:a9d1:dc71:4926:992c:14af", valid: false },
      { description: "invalid double ::", data: "8f69::c757:395e:976e::3441", valid: false },
      { description: "invalid ipv4", data: "114.71.82.94", valid: false },
      { description: "invalid not an ip", data: "not an ip", valid: false },
      { description: "invalid g123", data: "g123::1234:5678", valid: false },
      { description: "invalid ipv4 254", data: "254.164.77.1", valid: false },
    ],
  },
  {
    description: "MAC validation - valid",
    zodSchema: macZod,
    dnaSchema: macDna,
    tests: [
      { description: "valid 00:1A:2B:3C:4D:5E", data: "00:1A:2B:3C:4D:5E", valid: true },
      { description: "valid FF:FF:FF:FF:FF:FF", data: "FF:FF:FF:FF:FF:FF", valid: true },
      { description: "valid 00:11:22:33:44:55", data: "00:11:22:33:44:55", valid: true },
      { description: "valid A1:B2:C3:D4:E5:F6", data: "A1:B2:C3:D4:E5:F6", valid: true },
      { description: "valid 0a:1b:2c:3d:4e:5f", data: "0a:1b:2c:3d:4e:5f", valid: true },
    ],
  },
  {
    description: "MAC validation - invalid",
    zodSchema: macZod,
    dnaSchema: macDna,
    tests: [
      { description: "invalid mixed delimiters", data: "00:1A-2B:3C-4D:5E", valid: false },
      { description: "invalid too short", data: "00:1A:2B:3C:4D", valid: false },
      { description: "invalid dash delimiter", data: "00-1A-2B-3C-4D", valid: false },
      { description: "invalid GZ", data: "00:1A:2B:3C:4D:GZ", valid: false },
      { description: "invalid too long", data: "00:1A:2B:3C:4D:5E:GG", valid: false },
      { description: "invalid EUI-64", data: "00:1A:2B:3C:3C:2B:1A:00", valid: false },
      { description: "invalid mixed-case", data: "00:1a:2B:3c:4D:5e", valid: false },
      { description: "invalid no delimiter", data: "001A2B3C4D5E", valid: false },
    ],
  },
  {
    description: "CIDR v4 validation - valid",
    zodSchema: cidrv4Zod,
    dnaSchema: cidrv4Dna,
    tests: [
      { description: "valid 192.168.0.0/24", data: "192.168.0.0/24", valid: true },
      { description: "valid 10.0.0.0/8", data: "10.0.0.0/8", valid: true },
      { description: "valid 172.16.0.0/12", data: "172.16.0.0/12", valid: true },
      { description: "valid 0.0.0.0/0", data: "0.0.0.0/0", valid: true },
      { description: "valid 255.255.255.255/32", data: "255.255.255.255/32", valid: true },
    ],
  },
  {
    description: "CIDR v4 validation - invalid",
    zodSchema: cidrv4Zod,
    dnaSchema: cidrv4Dna,
    tests: [
      { description: "invalid missing prefix", data: "192.168.0.0", valid: false },
      { description: "invalid prefix 33", data: "192.168.0.0/33", valid: false },
      { description: "invalid ip 256", data: "256.0.0.0/24", valid: false },
      { description: "invalid negative prefix", data: "192.168.0.0/-1", valid: false },
      { description: "invalid not a cidr", data: "not a cidr", valid: false },
    ],
  },
  {
    description: "CIDR v6 validation - valid",
    zodSchema: cidrv6Zod,
    dnaSchema: cidrv6Dna,
    tests: [
      { description: "valid 2001:db8::/32", data: "2001:db8::/32", valid: true },
      { description: "valid ::/0", data: "::/0", valid: true },
      { description: "valid ::1/128", data: "::1/128", valid: true },
    ],
  },
  {
    description: "CIDR v6 validation - invalid",
    zodSchema: cidrv6Zod,
    dnaSchema: cidrv6Dna,
    tests: [
      { description: "invalid missing prefix", data: "2001:db8::", valid: false },
      { description: "invalid prefix 129", data: "2001:db8::/129", valid: false },
      { description: "invalid prefix abc", data: "2001:db8::/abc", valid: false },
      { description: "invalid not a cidr", data: "not a cidr", valid: false },
      { description: "invalid ipv4 cidr", data: "192.168.0.0/24", valid: false },
    ],
  },
  {
    description: "E.164 validation - valid",
    zodSchema: e164Zod,
    dnaSchema: e164Dna,
    tests: [
      { description: "valid +1555555", data: "+1555555", valid: true },
      { description: "valid +15555555", data: "+15555555", valid: true },
      { description: "valid +1555555555", data: "+1555555555", valid: true },
      { description: "valid +155555555555", data: "+155555555555", valid: true },
      { description: "valid +100555555555555", data: "+100555555555555", valid: true },
    ],
  },
  {
    description: "E.164 validation - invalid",
    zodSchema: e164Zod,
    dnaSchema: e164Dna,
    tests: [
      { description: "invalid empty", data: "", valid: false },
      { description: "invalid only plus", data: "+", valid: false },
      { description: "invalid wrong sign", data: "-", valid: false },
      { description: "invalid starts with space", data: " 555555555", valid: false },
      { description: "invalid missing plus", data: "555555555", valid: false },
      { description: "invalid space after plus", data: "+1 555 555 555", valid: false },
      { description: "invalid multiple plus", data: "+1555+555", valid: false },
      { description: "invalid leading zero", data: "+0000000", valid: false },
      { description: "invalid too long", data: "+1555555555555555", valid: false },
      { description: "invalid non numeric", data: "+115abc55", valid: false },
      { description: "invalid space after number", data: "+1555555 ", valid: false },
    ],
  },
  {
    description: "hostname - valid",
    zodSchema: hostnameZod,
    dnaSchema: hostnameDna,
    tests: [
      { description: "valid localhost", data: "localhost", valid: true },
      { description: "valid example.com", data: "example.com", valid: true },
      { description: "valid sub.example.com", data: "sub.example.com", valid: true },
      { description: "valid a-b-c.example.com", data: "a-b-c.example.com", valid: true },
      { description: "valid 123.example.com", data: "123.example.com", valid: true },
      { description: "valid developer.mozilla.org", data: "developer.mozilla.org", valid: true },
      { description: "valid 192.168.1.1", data: "192.168.1.1", valid: true },
    ],
  },
  {
    description: "hostname - invalid",
    zodSchema: hostnameZod,
    dnaSchema: hostnameDna,
    tests: [
      { description: "invalid empty", data: "", valid: false },
      { description: "invalid double dot", data: "example..com", valid: false },
      { description: "invalid trailing dash label", data: "example-.com", valid: false },
      { description: "invalid leading dash", data: "-example.com", valid: false },
      { description: "invalid trailing dash", data: "example.com-", valid: false },
      { description: "invalid underscore", data: "example_com", valid: false },
      { description: "invalid with port", data: "example.com:8080", valid: false },
      { description: "invalid with protocol", data: "http://example.com", valid: false },
      { description: "invalid with at", data: "ex@mple.com", valid: false },
      { description: "invalid with space", data: "exa mple.com", valid: false },
    ],
  },
  {
    description: "hash md5 - valid",
    zodSchema: hashMd5Zod,
    dnaSchema: hashMd5Dna,
    tests: [
      { description: "valid lowercase", data: "5d41402abc4b2a76b9719d911017c592", valid: true },
      { description: "valid uppercase", data: "5D41402ABC4B2A76B9719D911017C592", valid: true },
    ],
  },
  {
    description: "hash md5 - invalid",
    zodSchema: hashMd5Zod,
    dnaSchema: hashMd5Dna,
    tests: [
      { description: "invalid too short", data: "5d41402abc4b2a76b9719d911017c59", valid: false },
      { description: "invalid too long", data: "5d41402abc4b2a76b9719d911017c592x", valid: false },
    ],
  },
  {
    description: "hash sha1 - valid",
    zodSchema: hashSha1Zod,
    dnaSchema: hashSha1Dna,
    tests: [
      { description: "valid sha1", data: "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d", valid: true },
    ],
  },
  {
    description: "hash sha256 - valid",
    zodSchema: hashSha256Zod,
    dnaSchema: hashSha256Dna,
    tests: [
      { description: "valid sha256", data: "2cf24dba4f21d4288094c4a2e2c2d6c6b0c3e0c8f0e0c8f0e0c8f0e0c8f0e0c8", valid: true },
    ],
  },
  {
    description: "hash sha384 - valid",
    zodSchema: hashSha384Zod,
    dnaSchema: hashSha384Dna,
    tests: [
      { description: "valid sha384", data: "59e1748777448c69de6b800d7a33bbfb9ff1b463e44354c3553bcdb9c666fa90125a3c79f90397bdf5f6a13de828684f", valid: true },
    ],
  },
  {
    description: "hash sha512 - valid",
    zodSchema: hashSha512Zod,
    dnaSchema: hashSha512Dna,
    tests: [
      { description: "valid sha512", data: "9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043", valid: true },
    ],
  },
  {
    description: "trim",
    zodSchema: trimZod,
    dnaSchema: trimDna,
    tests: [
      { description: "valid with spaces", data: " 12 ", valid: true },
      { description: "valid no spaces", data: "12", valid: true },
    ],
  },
  {
    description: "toLowerCase",
    zodSchema: toLowerCaseZod,
    dnaSchema: toLowerCaseDna,
    tests: [
      { description: "valid ASDF", data: "ASDF", valid: true },
      { description: "valid asdf", data: "asdf", valid: true },
    ],
  },
  {
    description: "toUpperCase",
    zodSchema: toUpperCaseZod,
    dnaSchema: toUpperCaseDna,
    tests: [
      { description: "valid asdf", data: "asdf", valid: true },
      { description: "valid ASDF", data: "ASDF", valid: true },
    ],
  },
];
