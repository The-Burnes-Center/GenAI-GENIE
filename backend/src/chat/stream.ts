import { ConverseStreamCommand, type ConverseStreamCommandInput, type ConverseStreamOutput } from "@aws-sdk/client-bedrock-runtime";
import { bedrockRuntime } from "../lib/aws.js";
import { buildConverseMessages, buildSystem, temperatureFor, thinkingFields } from "../lib/converse.js";
import { dropOldestHalf, estimateMessagesTokens, inputBudget, isTooLongError, MAX_TRIM_RETRIES, preTrim } from "../lib/context.js";
import type { ChatEvent } from "../lib/ndjson.js";
import type { Message, Usage } from "../lib/types.js";
import { bedrockFailure, ChatFailure } from "./errors.js";
import type { Context, Prepared } from "./prepare.js";

export interface StreamResult {
  text: string;
  usage: Usage;
  stopReason: string;
  latencyMs: number;
}

/** Seam for tests: the Bedrock call. */
export type ConverseStreamSender = (
  input: ConverseStreamCommandInput,
  abortSignal: AbortSignal,
) => Promise<{ stream?: AsyncIterable<ConverseStreamOutput> }>;

const defaultSender: ConverseStreamSender = (input, abortSignal) =>
  bedrockRuntime().send(new ConverseStreamCommand(input), { abortSignal });

const ABORT_MARGIN_MS = 8000;
const REFUSAL_REASONS = new Set(["guardrail_intervened", "content_filtered"]);

/** The Converse request for one attempt. Temperature only appears when the model allows it. */
export function buildRequest(p: Prepared, ctx: Context, history: Message[]): ConverseStreamCommandInput {
  const cache = p.model.capabilities.promptCache;
  const messages = buildConverseMessages({ history, prompt: p.req.prompt, attachments: ctx.attachments, historyAttachments: ctx.historyAttachments, cache });
  const system = buildSystem(p.template, ctx.sources, cache, p.settings.assistantInstructions);
  const temperature = temperatureFor(p.model);
  const extra = thinkingFields(p.model, p.req.settings?.thinking);
  return {
    modelId: p.req.modelId,
    messages,
    ...(system ? { system } : {}),
    inferenceConfig: { maxTokens: p.maxTokens, ...(temperature !== undefined ? { temperature } : {}) },
    ...(extra ? { additionalModelRequestFields: extra } : {}),
  };
}

/** Live view of what has streamed so far, so a failure can still keep the partial answer. */
export interface Progress {
  text: string;
  stopReason?: string;
}

async function consume(
  stream: AsyncIterable<ConverseStreamOutput>,
  emit: (e: ChatEvent) => void,
  progress: Progress,
): Promise<{ text: string; usage: Usage; stopReason: string }> {
  let text = "";
  let stopReason = "end_turn";
  let usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  for await (const event of stream) {
    const delta = event.contentBlockDelta?.delta;
    if (delta?.text) {
      text += delta.text;
      progress.text = text;
      emit({ type: "delta", text: delta.text });
    } else if (delta?.reasoningContent && "text" in delta.reasoningContent && delta.reasoningContent.text) {
      emit({ type: "reasoning", text: delta.reasoningContent.text });
    }
    if (event.messageStop?.stopReason) {
      stopReason = event.messageStop.stopReason;
      progress.stopReason = stopReason;
    }
    const u = event.metadata?.usage;
    if (u) usage = { inputTokens: u.inputTokens ?? 0, outputTokens: u.outputTokens ?? 0, cacheReadTokens: u.cacheReadInputTokens ?? 0 };
  }
  return { text, usage, stopReason };
}

/**
 * Run ConverseStream. History is pre-trimmed only past 90% of the window; if
 * Bedrock still reports the input as too long, the oldest half of prior turns
 * is dropped and the call retried (at most twice). Throws ChatFailure.
 */
export async function streamModel(
  p: Prepared,
  ctx: Context,
  emit: (e: ChatEvent) => void,
  remainingMs: () => number,
  send: ConverseStreamSender = defaultSender,
  progress: Progress = { text: "" },
): Promise<StreamResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, remainingMs() - ABORT_MARGIN_MS));
  const noticeTrimmed = () => emit({ type: "notice", code: "HISTORY_TRIMMED", message: "Older messages were left out so this conversation fits the model's memory." });
  try {
    const budget = inputBudget(p.model);
    const estimate = (h: Message[]) => estimateMessagesTokens(buildConverseMessages({ history: h, prompt: p.req.prompt, attachments: ctx.attachments, historyAttachments: ctx.historyAttachments }));
    let { history, trimmed } = preTrim(p.history, estimate, budget);
    if (trimmed) noticeTrimmed();
    for (let attempt = 0; ; attempt++) {
      let emitted = false;
      try {
        const out = await send(buildRequest(p, ctx, history), controller.signal);
        const guarded = (e: ChatEvent) => {
          if (e.type === "delta" || e.type === "reasoning") emitted = true;
          emit(e);
        };
        const result = await consume(out.stream ?? (async function* () {})(), guarded, progress);
        if (REFUSAL_REASONS.has(result.stopReason)) {
          throw new ChatFailure("REFUSED", "The model declined to answer this request.");
        }
        return { ...result, latencyMs: Date.now() - startedAt };
      } catch (err) {
        if (err instanceof ChatFailure) throw err;
        if (!emitted && isTooLongError(err)) {
          if (history.length === 0) {
            throw new ChatFailure(
              "CONTEXT_TOO_LONG",
              ctx.attachments.length > 0
                ? "This file is too large for this model. Try a model with a larger context, such as Claude."
                : "This message is too long for the model. Attach it as a file or shorten it.",
            );
          }
          if (attempt >= MAX_TRIM_RETRIES) {
            throw new ChatFailure("CONTEXT_TOO_LONG", "The conversation is too long for this model even after trimming. Start a new chat.");
          }
          history = dropOldestHalf(history);
          if (!trimmed) noticeTrimmed();
          trimmed = true;
          continue;
        }
        console.error(JSON.stringify({ level: "error", message: "converse stream failed", modelId: p.req.modelId, error: String(err) }));
        throw bedrockFailure(err);
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
