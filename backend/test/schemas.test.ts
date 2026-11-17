import { describe, expect, it } from "vitest";
import { HttpError } from "../src/lib/http.js";
import {
  chatRequestSchema, inviteUserSchema, MAX_PROMPT_CHARS, parseJsonBody, parseWith, settingsSchema, updateUserSchema,
} from "../src/lib/schemas.js";
import { DEFAULT_SETTINGS } from "../src/lib/defaults.js";

describe("chatRequestSchema", () => {
  it("applies defaults", () => {
    const r = parseWith(chatRequestSchema, { modelId: "m", prompt: "  hi  " });
    expect(r).toMatchObject({ prompt: "hi", mode: "chat", attachments: [] });
  });

  it("accepts thinking and turn, rejects unknown thinking values", () => {
    expect(parseWith(chatRequestSchema, { modelId: "m", prompt: "x", turn: 2, settings: { thinking: "deep" } }).settings?.thinking).toBe("deep");
    expect(() => parseWith(chatRequestSchema, { modelId: "m", prompt: "x", settings: { thinking: "max" } })).toThrow(HttpError);
  });

  it("drops user temperature and maxTokens silently (never forwarded)", () => {
    const r = parseWith(chatRequestSchema, { modelId: "m", prompt: "x", settings: { thinking: "standard", temperature: 1, maxTokens: 5 } });
    expect(r.settings).toEqual({ thinking: "standard" });
  });

  it("enforces the 400,000 character prompt cap", () => {
    expect(() => parseWith(chatRequestSchema, { modelId: "m", prompt: "a".repeat(MAX_PROMPT_CHARS + 1) })).toThrow(/Attach it as a file/);
    expect(parseWith(chatRequestSchema, { modelId: "m", prompt: "a".repeat(MAX_PROMPT_CHARS) }).prompt.length).toBe(MAX_PROMPT_CHARS);
  });

  it("rejects empty prompts and bad modes with a 400", () => {
    for (const bad of [{ modelId: "m", prompt: " " }, { modelId: "m", prompt: "x", mode: "other" }, {}]) {
      expect(() => parseWith(chatRequestSchema, bad)).toThrowError(expect.objectContaining({ status: 400 }));
    }
  });
});

describe("other schemas", () => {
  it("parseJsonBody rejects invalid JSON", () => {
    expect(() => parseJsonBody(chatRequestSchema, "{nope")).toThrow(/valid JSON/);
  });
  it("invites need a valid email and default to user", () => {
    expect(parseWith(inviteUserSchema, { email: "a@b.org" }).role).toBe("user");
    expect(() => parseWith(inviteUserSchema, { email: "nope" })).toThrow(HttpError);
  });
  it("user updates need at least one field and allow status", () => {
    expect(() => parseWith(updateUserSchema, {})).toThrow(/Nothing to update/);
    expect(parseWith(updateUserSchema, { status: "active" }).status).toBe("active");
    expect(() => parseWith(updateUserSchema, { status: "pending" })).toThrow(HttpError);
  });
  it("settings validate domains and ranges", () => {
    expect(parseWith(settingsSchema, { ...DEFAULT_SETTINGS, allowedEmailDomains: ["Example.org"] }).allowedEmailDomains).toEqual(["example.org"]);
    expect(() => parseWith(settingsSchema, { ...DEFAULT_SETTINGS, allowedEmailDomains: ["not a domain"] })).toThrow(HttpError);
    expect(() => parseWith(settingsSchema, { ...DEFAULT_SETTINGS, retrievalTopK: 0 })).toThrow(HttpError);
  });
});
