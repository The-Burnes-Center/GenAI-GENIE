import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockRuntime } from "../lib/aws.js";
import { makeTitle } from "../lib/converse.js";

const MAX_WORDS = 12;
const MAX_CHARS = 100;
const TITLE_TIMEOUT_MS = 20_000;

/** Quotes and trailing punctuation off, at most 12 words. Empty string when nothing usable. */
export function cleanTitle(raw: string): string {
  const line = raw.split("\n").find((l) => l.trim()) ?? "";
  const text = line
    .replace(/^(title\s*:\s*)/i, "")
    .replace(/["'`*#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.:;,\s]+$/, "");
  return text.split(" ").slice(0, MAX_WORDS).join(" ").slice(0, MAX_CHARS).trim();
}

/** A short generated title, or the first 60 characters of the prompt when the title model fails. */
export async function generateTitle(prompt: string, reply: string, titleModelId: string): Promise<string> {
  const fallback = makeTitle(prompt);
  try {
    const out = await bedrockRuntime().send(
      new ConverseCommand({
        modelId: titleModelId,
        system: [{ text: "You write conversation titles. Reply with only a title of at most 12 words. No quotes, no trailing punctuation." }],
        messages: [{ role: "user", content: [{ text: `User message:\n${prompt.slice(0, 1500)}\n\nAssistant reply:\n${reply.slice(0, 800)}\n\nTitle:` }] }],
        inferenceConfig: { maxTokens: 200 },
      }),
      { abortSignal: AbortSignal.timeout(TITLE_TIMEOUT_MS) },
    );
    const text = out.output?.message?.content?.map((b) => b.text ?? "").join("") ?? "";
    return cleanTitle(text) || fallback;
  } catch (err) {
    console.error(JSON.stringify({ level: "error", message: "title generation failed", error: String(err) }));
    return fallback;
  }
}
