import { describe, expect, it } from "vitest";
import { buildRequest } from "../src/chat/stream.js";
import {
  buildConverseMessages, buildSystem, clampMaxTokens, historyForModel, makeTitle, planAttachments,
  sanitizeDocumentName, temperatureFor, thinkingFields, type LoadedAttachment,
} from "../src/lib/converse.js";
import { emptyContext, GPT, MISTRAL, model, msg, NOVA, prepared, SONNET } from "./fixtures.js";

const bytes = new Uint8Array([1, 2, 3]);
const att = (name: string, contentType: string) => ({ key: `attachments/u/x/${name}`, name, contentType, size: 3 });

describe("buildConverseMessages", () => {
  it("orders history by time and appends the new user turn", () => {
    const history = [msg("assistant", "a1", 2), msg("user", "u1", 1), msg("user", "u2", 3), msg("assistant", "a2", 4)];
    const out = buildConverseMessages({ history, prompt: "next", attachments: [] });
    expect(out.map((m) => [m.role, m.content?.[0]?.text])).toEqual([
      ["user", "u1"], ["assistant", "a1"], ["user", "u2"], ["assistant", "a2"], ["user", "next"],
    ]);
  });

  it("merges consecutive same-role turns and drops a leading assistant", () => {
    const history = [msg("assistant", "orphan", 1), msg("user", "u1", 2), msg("user", "u2", 3)];
    const out = buildConverseMessages({ history, prompt: "now", attachments: [] });
    expect(out).toHaveLength(1);
    expect(out[0]?.role).toBe("user");
    expect(out[0]?.content?.map((b) => b.text)).toEqual(["u1", "u2", "now"]);
  });

  it("maps attachments to image and document blocks before the prompt text", () => {
    const attachments: LoadedAttachment[] = [
      { name: "pic.png", kind: { kind: "image", format: "png", contentType: "image/png" }, bytes },
      { name: "My report_v2.final.pdf", kind: { kind: "document", format: "pdf", contentType: "application/pdf" }, bytes },
    ];
    const blocks = buildConverseMessages({ history: [], prompt: "look", attachments })[0]?.content ?? [];
    expect(blocks[0]).toEqual({ image: { format: "png", source: { bytes } } });
    expect(blocks[1]?.document).toMatchObject({ format: "pdf", name: "My report v2 final" });
    expect(blocks[2]).toEqual({ text: "look" });
  });

  it("inlines extracted text as a labelled fenced block when the model has no document support", () => {
    const attachments: LoadedAttachment[] = [
      { name: "notes.txt", kind: { kind: "document", format: "txt", contentType: "text/plain" }, bytes, text: "hello world" },
    ];
    const blocks = buildConverseMessages({ history: [], prompt: "summarize", attachments })[0]?.content ?? [];
    expect(blocks[0]?.document).toBeUndefined();
    expect(blocks[0]?.text).toBe("[Attached file: notes.txt]\n```\nhello world\n```");
  });

  it("adds a cache point after the last prior turn only when asked", () => {
    const history = [msg("user", "u", 1), msg("assistant", "a", 2)];
    const cached = buildConverseMessages({ history, prompt: "p", attachments: [], cache: true });
    expect(cached[1]?.content?.at(-1)).toEqual({ cachePoint: { type: "default" } });
    const plain = buildConverseMessages({ history, prompt: "p", attachments: [] });
    expect(JSON.stringify(plain)).not.toContain("cachePoint");
    const first = buildConverseMessages({ history: [], prompt: "p", attachments: [], cache: true });
    expect(JSON.stringify(first)).not.toContain("cachePoint");
  });

  it("names earlier attachments that are not being resent", () => {
    const history = [msg("user", "see file", 1, { attachments: [att("a.pdf", "application/pdf")] }), msg("assistant", "ok", 2)];
    const out = buildConverseMessages({ history, prompt: "more", attachments: [] });
    expect(out[0]?.content?.[0]?.text).toContain("[Attached earlier, not included: a.pdf]");
  });
});

describe("sanitizeDocumentName", () => {
  it("keeps only Bedrock-legal characters", () => {
    expect(sanitizeDocumentName("Q3 plan (draft)_[v2].docx")).toBe("Q3 plan (draft) [v2]");
    expect(sanitizeDocumentName("a__b..c.pdf")).toBe("a b c");
    expect(sanitizeDocumentName("***.pdf")).toBe("document");
    expect(sanitizeDocumentName("x".repeat(300) + ".pdf").length).toBeLessThanOrEqual(100);
  });
});

describe("planAttachments (capability checks)", () => {
  it("rejects images for non-vision models and accepts them for vision models", () => {
    expect(() => planAttachments(model(GPT), [att("p.png", "image/png")])).toThrow(/cannot read images/);
    expect(planAttachments(model(SONNET), [att("p.png", "image/png")]).kinds[0]?.kind).toBe("image");
  });

  it("sends extractable documents as text for non-document models and notes them", () => {
    const plan = planAttachments(model(MISTRAL), [att("a.pdf", "application/pdf"), att("n.md", "text/markdown")]);
    expect(plan.asText).toEqual(["a.pdf", "n.md"]);
  });

  it("rejects spreadsheets and legacy .doc on non-document models", () => {
    expect(() => planAttachments(model(GPT), [att("s.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")])).toThrow(/cannot read s.xlsx/);
    expect(() => planAttachments(model(GPT), [att("o.doc", "application/msword")])).toThrow(/cannot read/);
    expect(planAttachments(model(NOVA), [att("s.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]).asText).toEqual([]);
  });

  it("rejects unsupported types and over-limit counts", () => {
    expect(() => planAttachments(model(SONNET), [att("x.zip", "application/zip")])).toThrow(/not supported/);
    const six = Array.from({ length: 6 }, (_, i) => att(`d${i}.pdf`, "application/pdf"));
    expect(() => planAttachments(model(SONNET), six)).toThrow(/at most 5 documents/);
    const twentyOne = Array.from({ length: 21 }, (_, i) => att(`i${i}.png`, "image/png"));
    expect(() => planAttachments(model(SONNET), twentyOne)).toThrow(/at most 20 images/);
  });
});

describe("historyForModel", () => {
  const all = [
    msg("user", "q1", 1, { modelId: "A" }), msg("assistant", "a-A", 2, { modelId: "A" }),
    msg("user", "q1", 3, { modelId: "B" }), msg("assistant", "a-B", 4, { modelId: "B" }),
  ];
  it("compare: each model sees only messages tagged with its modelId", () => {
    expect(historyForModel(all, "B", "compare").map((m) => m.content)).toEqual(["q1", "a-B"]);
  });
  it("chat: sees everything", () => {
    expect(historyForModel(all, "B", "chat")).toHaveLength(4);
  });
});

describe("makeTitle", () => {
  it("returns short prompts untouched and cuts long ones at a word boundary", () => {
    expect(makeTitle("  Hello   world ")).toBe("Hello world");
    const long = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi";
    const t = makeTitle(long);
    expect(t.length).toBeLessThanOrEqual(60);
    expect(long.startsWith(t)).toBe(true);
    expect(long.charAt(t.length)).toBe(" ");
  });
  it("hard cuts a single long word", () => {
    expect(makeTitle("x".repeat(100))).toHaveLength(60);
  });
});

describe("clampMaxTokens", () => {
  it("defaults to the model maximum and clamps to [64, max]", () => {
    expect(clampMaxTokens(undefined, 128000)).toBe(128000);
    expect(clampMaxTokens(10, 32000)).toBe(64);
    expect(clampMaxTokens(999999, 32000)).toBe(32000);
    expect(clampMaxTokens(5000, 32000)).toBe(5000);
  });
});

describe("thinking and temperature", () => {
  it("maps thinking for reasoning Claude models only", () => {
    expect(thinkingFields(model(SONNET), "deep")).toEqual({
      thinking: { type: "adaptive", display: "summarized" }, output_config: { effort: "high" },
    });
    expect(thinkingFields(model(SONNET), "standard")).toMatchObject({ output_config: { effort: "low" } });
    expect(thinkingFields(model(SONNET), undefined)).toBeUndefined();
    expect(thinkingFields(model(GPT), "deep")).toBeUndefined();
  });

  it("never sends temperature when the capability is false, even if a default is set", () => {
    const sonnet = { ...model(SONNET), defaultTemperature: 0.7 };
    expect(temperatureFor(sonnet)).toBeUndefined();
    const req = buildRequest(prepared(sonnet), emptyContext(), []);
    expect(req.inferenceConfig).toEqual({ maxTokens: 128000 });
    expect(JSON.stringify(req)).not.toContain("temperature");
  });

  it("sends an admin default temperature only for models that support it", () => {
    const mistral = { ...model(MISTRAL), defaultTemperature: 0.3 };
    expect(buildRequest(prepared(mistral), emptyContext(), []).inferenceConfig).toEqual({ maxTokens: 32000, temperature: 0.3 });
    expect(buildRequest(prepared(model(MISTRAL)), emptyContext(), []).inferenceConfig).toEqual({ maxTokens: 32000 });
  });

  it("requests the full output budget and adds thinking fields to the request", () => {
    const p = prepared(model(SONNET));
    p.req = { ...p.req, settings: { thinking: "deep" } };
    const req = buildRequest(p, emptyContext(), []);
    expect(req.inferenceConfig?.maxTokens).toBe(128000);
    expect(req.additionalModelRequestFields).toMatchObject({ output_config: { effort: "high" } });
  });
});

describe("buildSystem", () => {
  it("numbers sources and adds a cache point when caching", () => {
    const blocks = buildSystem(undefined, [{ title: "a.pdf", text: "alpha" }], true) ?? [];
    expect(blocks[0]?.text).toContain('<source index="1" title="a.pdf">\nalpha\n</source>');
    expect(blocks.at(-1)).toEqual({ cachePoint: { type: "default" } });
    expect(buildSystem(undefined, [])).toBeUndefined();
  });
});
