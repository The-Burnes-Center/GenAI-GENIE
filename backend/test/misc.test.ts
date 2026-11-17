import { describe, expect, it } from "vitest";
import { aggregate, daysBetween, resolveRange } from "../src/api/admin-reports.js";
import { parseAuthParams } from "../src/lib/config.js";
import { classifyFile } from "../src/lib/files.js";
import { evaluateSignup } from "../src/lib/signup.js";
import { cleanTitle } from "../src/chat/title.js";

describe("evaluateSignup (pre sign-up rules)", () => {
  it("rejects everything when sign-up is off", () => {
    const d = evaluateSignup({ signupMode: "off", allowedEmailDomains: [] }, "a@b.org");
    expect(d).toMatchObject({ allowed: false });
  });
  it("allows any domain when open with no list", () => {
    expect(evaluateSignup({ signupMode: "open", allowedEmailDomains: [] }, "a@anything.io")).toEqual({ allowed: true });
  });
  it("matches the domain exactly and case-insensitively", () => {
    const s: { signupMode: "open"; allowedEmailDomains: string[] } = { signupMode: "open", allowedEmailDomains: ["Example.org", "@Uni.edu"] };
    expect(evaluateSignup(s, "A@EXAMPLE.ORG").allowed).toBe(true);
    expect(evaluateSignup(s, "a@uni.edu").allowed).toBe(true);
    expect(evaluateSignup(s, "a@sub.example.org").allowed).toBe(false);
    expect(evaluateSignup(s, "a@notexample.org").allowed).toBe(false);
    expect(evaluateSignup(s, "a@example.org.evil.com").allowed).toBe(false);
    expect(evaluateSignup(s, undefined).allowed).toBe(false);
  });
  it("explains the rejection", () => {
    const d = evaluateSignup({ signupMode: "open", allowedEmailDomains: ["x.org"] }, "a@y.org");
    expect(d.allowed === false && d.message).toContain("x.org");
  });
});

describe("cleanTitle", () => {
  it("strips quotes, prefixes and punctuation and limits to 12 words", () => {
    expect(cleanTitle('"Planning the Q3 budget."')).toBe("Planning the Q3 budget");
    expect(cleanTitle("Title: Hello world")).toBe("Hello world");
    expect(cleanTitle("one two three four five six seven eight nine ten eleven twelve thirteen")).toBe(
      "one two three four five six seven eight nine ten eleven twelve",
    );
    expect(cleanTitle("   ")).toBe("");
  });
});

describe("classifyFile", () => {
  it("uses content type, then extension for blank or generic types", () => {
    expect(classifyFile("image/jpeg", "a.jpg")?.kind).toBe("image");
    expect(classifyFile("application/pdf", "a.pdf")).toMatchObject({ kind: "document", format: "pdf" });
    expect(classifyFile("", "notes.md")).toMatchObject({ format: "md" });
    expect(classifyFile("application/octet-stream", "x.docx")).toMatchObject({ format: "docx" });
    expect(classifyFile("application/zip", "x.zip")).toBeUndefined();
  });
});

describe("auth parameter parsing", () => {
  it("requires both ids", () => {
    expect(parseAuthParams('{"userPoolId":"p","userPoolClientId":"c"}')).toEqual({ userPoolId: "p", userPoolClientId: "c" });
    expect(() => parseAuthParams('{"userPoolId":"p"}')).toThrow();
    expect(() => parseAuthParams(undefined)).toThrow();
  });
});

describe("usage report helpers", () => {
  it("builds inclusive day ranges and validates input", () => {
    expect(daysBetween("2026-11-15", "2026-11-17")).toEqual(["2026-11-15", "2026-11-16", "2026-11-17"]);
    expect(resolveRange("2026-11-01", "2026-11-17")).toEqual({ from: "2026-11-01", to: "2026-11-17" });
    expect(() => resolveRange("bad", "2026-11-17")).toThrow();
    expect(() => resolveRange("2026-11-17", "2026-11-01")).toThrow();
    expect(() => resolveRange("2026-01-01", "2026-11-17")).toThrow(/at most/);
  });
  it("aggregates rows by key", () => {
    const rows = [
      { day: "d1", modelId: "m", sub: "s", email: "e", requests: 1, inputTokens: 10, outputTokens: 5 },
      { day: "d1", modelId: "m", sub: "t", email: "f", requests: 2, inputTokens: 1, outputTokens: 1 },
    ];
    expect(aggregate(rows, (r) => r.modelId)).toEqual([{ key: "m", requests: 3, inputTokens: 11, outputTokens: 6 }]);
  });
});
