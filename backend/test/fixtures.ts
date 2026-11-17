import type { Context, Prepared } from "../src/chat/prepare.js";
import { DEFAULT_MODELS, DEFAULT_SETTINGS } from "../src/lib/defaults.js";
import type { Message, ModelEntry } from "../src/lib/types.js";

export const model = (id: string): ModelEntry => {
  const found = DEFAULT_MODELS.find((m) => m.modelId === id);
  if (!found) throw new Error(`no default model ${id}`);
  return found;
};

export const SONNET = "us.anthropic.claude-sonnet-5-5";
export const GPT = "global.openai.gpt-6.2-sol";
export const MISTRAL = "mistral.mistral-large-3-675b-instruct";
export const NOVA = "us.amazon.nova-pro-v1:0";

export function msg(role: "user" | "assistant", content: string, n: number, extra: Partial<Message> = {}): Message {
  return {
    messageId: `m${n}`,
    sessionId: "s1",
    role,
    content,
    createdAt: `2026-11-17T10:00:${String(n).padStart(2, "0")}.000Z`,
    ...extra,
  };
}

export function prepared(m: ModelEntry, over: Partial<Prepared> & { history?: Message[] } = {}): Prepared {
  return {
    req: { modelId: m.modelId, prompt: "hello", attachments: [], mode: "chat" },
    model: m,
    settings: DEFAULT_SETTINGS,
    session: {
      sessionId: "s1", title: "t", mode: "chat", modelId: m.modelId,
      createdAt: "", updatedAt: "", messageCount: 0,
    },
    isNewSession: false,
    allMessages: [],
    history: [],
    maxTokens: m.maxOutputTokens,
    turn: 0,
    plan: { kinds: [], asText: [] },
    ...over,
  } as Prepared;
}

export const emptyContext = (): Context => ({
  citations: [], sources: [], attachments: [], historyAttachments: new Map(), notices: [], textAttachments: [],
});
