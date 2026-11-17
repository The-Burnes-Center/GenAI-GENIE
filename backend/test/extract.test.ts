import { describe, expect, it } from "vitest";
import { extractDocumentText, inlineTextBlock } from "../src/lib/extract.js";

const enc = (s: string) => new TextEncoder().encode(s);
const fakes = { pdf: async () => "pdf text", docx: async () => "docx text" };

describe("extractDocumentText (fallback for models without document blocks)", () => {
  it("reads txt, md and csv as utf-8", async () => {
    expect(await extractDocumentText("txt", "a.txt", enc(" hello \n"), fakes)).toBe("hello");
    expect(await extractDocumentText("csv", "a.csv", enc("a,b\n1,2"), fakes)).toBe("a,b\n1,2");
    expect(await extractDocumentText("md", "a.md", enc("# T"), fakes)).toBe("# T");
  });

  it("strips tags and scripts from html", async () => {
    const out = await extractDocumentText("html", "a.html", enc("<style>x{}</style><h1>Title</h1><p>Hi &amp; bye</p><script>evil()</script>"), fakes);
    expect(out).toContain("Title");
    expect(out).toContain("Hi & bye");
    expect(out).not.toContain("evil");
    expect(out).not.toContain("<");
  });

  it("delegates pdf and docx to the extractors", async () => {
    expect(await extractDocumentText("pdf", "a.pdf", enc("x"), fakes)).toBe("pdf text");
    expect(await extractDocumentText("docx", "a.docx", enc("x"), fakes)).toBe("docx text");
  });

  it("refuses spreadsheets and legacy doc with a BAD_REQUEST", async () => {
    await expect(extractDocumentText("xlsx", "s.xlsx", enc("x"), fakes)).rejects.toMatchObject({ status: 400 });
    await expect(extractDocumentText("xls", "s.xls", enc("x"), fakes)).rejects.toThrow(/Spreadsheets/);
    await expect(extractDocumentText("doc", "o.doc", enc("x"), fakes)).rejects.toMatchObject({ status: 400 });
  });

  it("turns extractor failures and empty text into friendly 400s", async () => {
    const broken = { pdf: async () => { throw new Error("corrupt"); }, docx: async () => "  " };
    await expect(extractDocumentText("pdf", "a.pdf", enc("x"), broken)).rejects.toThrow(/could not be read/);
    await expect(extractDocumentText("docx", "a.docx", enc("x"), broken)).rejects.toThrow(/no readable text/);
  });
});

describe("inlineTextBlock", () => {
  it("labels and fences, switching fence if the text contains backticks", () => {
    expect(inlineTextBlock("a.txt", "hi")).toBe("[Attached file: a.txt]\n```\nhi\n```");
    expect(inlineTextBlock("a.md", "```js\nx\n```")).toContain("~~~~");
  });
});
